/* =====================================================================
   SYNAPSE · Training at Scale
   window.TRACKS.train — modules: parallel / experiments / compute

   Self-contained: this file registers its own widgets (trainParallel,
   trainCost), its own quizzes (train-parallel, train-experiments,
   train-compute) and its own track data.
   ===================================================================== */
(function () {
  "use strict";

  /* ==================================================================
     0. DOM helpers (local to this file so load order never matters)
  ================================================================== */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }

  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, pill),
      h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
  }

  /* A .w-seg group. `pairs` is [[value, label], ...]; onPick gets the value. */
  function segment(pairs, initialIdx, onPick) {
    var seg = h("div", { class: "w-seg" });
    var btns = [];
    for (var i = 0; i < pairs.length; i++) {
      (function (pair, idx) {
        var b = h("button", { type: "button", class: "w-seg-btn" + (idx === initialIdx ? " active" : "") }, pair[1]);
        b.addEventListener("click", function () {
          for (var j = 0; j < btns.length; j++) btns[j].classList.remove("active");
          b.classList.add("active");
          onPick(pair[0]);
        });
        btns.push(b);
        seg.appendChild(b);
      })(pairs[i], i);
    }
    return seg;
  }

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  var Widgets = {};

  /* ==================================================================
     1. trainParallel — "Pick a parallelism strategy"
     Deterministic rule table over (model size, data need, interconnect).
     Memory units are bytes per parameter of a mixed-precision Adam run
     (2 weights + 2 grads + 12 optimizer) plus a nominal activation slice.
  ================================================================== */
  var MEM_SEGS = [
    { key: "w", label: "weights", fill: "var(--accent)" },
    { key: "g", label: "gradients", fill: "var(--cyan)" },
    { key: "o", label: "optimizer state", fill: "var(--violet)" },
    { key: "a", label: "activations", fill: "var(--amber)" }
  ];
  var MEM_MAX = 20;

  function dev(label, w, g, o, a, text) {
    return { label: label, w: w, g: g, o: o, a: a, text: text, idle: false };
  }
  function idleDev(label) {
    return { label: label, w: 0, g: 0, o: 0, a: 0, text: "idle — not needed for this job", idle: true };
  }

  function parallelPlan(size, data, link) {
    var fast = link === "fast";
    var big = data === "large";
    var i, devices = [];

    if (size === "fits" && !big) {
      devices.push(dev("GPU 0", 2, 2, 12, 4, "the whole model, its gradients, its optimizer state and the full batch"));
      for (i = 1; i < 4; i++) devices.push(idleDev("GPU " + i));
      return {
        name: "Single GPU",
        used: 1,
        comm: "none",
        reason: "Everything fits on one device and one device is fast enough for the data, so any parallelism would only add communication, failure modes and debugging cost. Tune the input pipeline and use mixed precision before you reach for a second GPU.",
        devices: devices
      };
    }

    if (size === "fits" && big) {
      for (i = 0; i < 4; i++) devices.push(dev("GPU " + i, 2, 2, 12, 4, "a full replica of model, gradients and optimizer · batch shard " + (i + 1) + "/4"));
      return {
        name: "Data parallel",
        used: 4,
        comm: fast ? "moderate" : "high",
        reason: fast
          ? "The model fits, so the only problem is throughput: replicate it, split each batch four ways, and average gradients with one all-reduce per step. On a fast link that all-reduce hides almost entirely behind the backward pass."
          : "The model fits, so data parallelism is still the right shape, but every step now pushes about two model-sizes of gradient bytes across the slow link. Accumulate gradients over several micro-batches so you sync less often, and keep each replica's batch large enough to hide the transfer.",
        devices: devices
      };
    }

    if (size === "optstate") {
      for (i = 0; i < 4; i++) devices.push(dev("GPU " + i, 2, 0.5, 3, 4, "full weights · 1/4 of the gradients and optimizer state · batch shard " + (i + 1) + "/4"));
      return {
        name: "Data parallel + sharded optimizer states",
        used: 4,
        comm: fast ? "moderate" : "high",
        reason: (big ? "" : "You need several GPUs here for memory, not speed. ") +
          "The weights fit but twelve bytes per parameter of optimizer state do not, and plain data parallelism stores that state on every replica. Shard it (and the gradients) so each GPU owns a quarter: the traffic is a reduce-scatter plus an all-gather, roughly the same bytes as the all-reduce you were already doing" +
          (fast ? "." : ", which is why the slow link still hurts — accumulate gradients to sync less often."),
        devices: devices
      };
    }

    /* size === "layer": a single layer or embedding table exceeds one GPU */
    if (fast) {
      for (i = 0; i < 4; i++) devices.push(dev("GPU " + i, 0.5, 0.5, 3, 3, "1/4 of each large matrix or embedding rows shard " + (i + 1) + "/4 · same batch, exchanged by all-to-all"));
      return {
        name: big ? "Tensor/embedding sharding in the node + data parallel across" : "Tensor/embedding sharding within the node",
        used: 4,
        comm: "high volume, fast link",
        reason: "One layer or table is bigger than a GPU, so no amount of replication helps — the tensor itself has to be split. That split communicates inside every layer (an all-reduce for split matrices, an all-to-all for embedding lookups), so it must stay on the fast intra-node link." +
          (big ? " Throughput then comes from replicating the whole sharded group across nodes with ordinary data parallelism." : ""),
        devices: devices
      };
    }

    devices.push(dev("GPU 0", 0.5, 0.5, 3, 4, "node A · pipeline stage 1 · half of each matrix in layers 1–12 · holds the most in-flight micro-batches"));
    devices.push(dev("GPU 1", 0.5, 0.5, 3, 4, "node A · pipeline stage 1 · other half of layers 1–12"));
    devices.push(dev("GPU 2", 0.5, 0.5, 3, 2, "node B · pipeline stage 2 · half of each matrix in layers 13–24"));
    devices.push(dev("GPU 3", 0.5, 0.5, 3, 2, "node B · pipeline stage 2 · other half of layers 13–24"));
    return {
      name: "Pipeline across nodes (tensor sharding inside each node)",
      used: 4,
      comm: "low–moderate across nodes",
      reason: "The model must span nodes but the link between them is slow, so put the cut where the traffic is smallest: between layers. Only boundary activations cross the slow link, point to point. Inside each node the oversized layer is still tensor-split on the fast link. The price is the pipeline bubble, so feed many micro-batches." +
        (big ? " Add throughput by replicating the whole pipeline with data parallelism." : ""),
      devices: devices
    };
  }

  Widgets.trainParallel = function (mount) {
    shell(mount, "strategy picker", "Pick a parallelism strategy",
      "Describe the job: how big the model is relative to one GPU, how much data you must push through, and what links the GPUs. The rule table picks a strategy and shows what lives on each of four devices. Bar lengths are illustrative bytes per parameter.");

    var size = "fits", data = "small", link = "fast";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var plan = parallelPlan(size, data, link), i, j, d;
      clear(stage);

      var legend = h("div", { style: "display:flex;flex-wrap:wrap;gap:14px;padding:0 0 10px" });
      for (j = 0; j < MEM_SEGS.length; j++) {
        legend.appendChild(h("span", { style: "display:inline-flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--text-dim)" },
          h("i", { style: "display:inline-block;width:12px;height:12px;border-radius:3px;background:" + MEM_SEGS[j].fill }),
          MEM_SEGS[j].label));
      }
      stage.appendChild(legend);

      for (i = 0; i < plan.devices.length; i++) {
        d = plan.devices[i];
        var track = h("span", {
          style: "display:flex;height:12px;border-radius:6px;overflow:hidden;background:var(--surface-solid);" +
            (d.idle ? "border:1px dashed var(--line-strong)" : "")
        });
        for (j = 0; j < MEM_SEGS.length; j++) {
          var v = d[MEM_SEGS[j].key];
          if (v > 0) track.appendChild(h("i", { style: "display:block;height:100%;background:" + MEM_SEGS[j].fill + ";width:" + (v / MEM_MAX * 100).toFixed(1) + "%" }));
        }
        stage.appendChild(h("div", {
          style: "display:grid;grid-template-columns:52px minmax(80px,1.2fr) minmax(140px,2fr);gap:12px;align-items:center;padding:6px 0"
        },
          h("span", { style: "font-family:var(--font-mono);font-size:0.8rem;color:" + (d.idle ? "var(--text-dim)" : "var(--text)") }, d.label),
          track,
          h("span", { style: "font-size:0.82rem;line-height:1.45;color:" + (d.idle ? "var(--text-dim)" : "var(--text)") }, d.text)
        ));
      }

      clear(readout);
      readout.appendChild(ro("strategy", plan.name));
      readout.appendChild(ro("GPUs busy", plan.used + "/4"));
      readout.appendChild(ro("communication", plan.comm));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, plan.reason));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["fits", "Fits on one GPU"], ["optstate", "Weights fit, optimizer doesn't"], ["layer", "A layer/table exceeds a GPU"]], 0, function (v) { size = v; paint(); }),
      segment([["small", "Small data"], ["large", "Large data"]], 0, function (v) { data = v; paint(); }),
      segment([["fast", "Fast intra-node link"], ["slow", "Slow cross-node link"]], 0, function (v) { link = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. trainCost — "What will this run cost?"
     FLOPs ~= 6 x params x tokens. Peak, price and HBM size are
     illustrative constants, stated as such in the UI.
  ================================================================== */
  var COST_PARAMS = [10e6, 30e6, 100e6, 300e6, 1e9, 3e9, 10e9, 20e9];
  var COST_TOKENS = [1e8, 3e8, 1e9, 3e9, 1e10, 3e10, 1e11, 3e11, 1e12];
  var COST_GPUS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
  var COST_PEAK = 300e12;
  var COST_PRICE = 2.5;
  var COST_HBM = 80e9;
  var COST_BPP = 16;

  function countLabel(n) {
    var units = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
    for (var i = 0; i < units.length; i++) {
      if (n >= units[i][0]) {
        var v = n / units[i][0];
        return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + units[i][1];
      }
    }
    return String(Math.round(n));
  }

  function sci(x) {
    if (!(x > 0)) return "0";
    var e = Math.floor(Math.log(x) / Math.LN10);
    var m = x / Math.pow(10, e);
    if (m >= 9.95) { m = 1; e += 1; }
    return m.toFixed(1) + "e" + e;
  }

  function commas(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function money(x) {
    if (x < 1) return "under $1";
    return "$" + commas(x);
  }

  function duration(hours) {
    if (hours < 1) return Math.max(1, Math.round(hours * 60)) + " min";
    if (hours < 48) return hours.toFixed(1) + " h";
    var days = hours / 24;
    return (days < 100 ? days.toFixed(1) : commas(days)) + " days";
  }

  function gpuHoursLabel(x) {
    if (x < 0.01) return "under 0.01";
    return x < 10 ? x.toFixed(2) : commas(x);
  }

  function bytesLabel(b) {
    if (b < 1e9) return Math.max(1, Math.round(b / 1e6)) + " MB";
    if (b < 100e9) return (b / 1e9).toFixed(1) + " GB";
    return commas(b / 1e9) + " GB";
  }

  function costState(pi, ti, gi, util) {
    var P = COST_PARAMS[pi], D = COST_TOKENS[ti], N = COST_GPUS[gi];
    var flops = 6 * P * D;
    var gpuHours = flops / (COST_PEAK * util) / 3600;
    var wallHours = gpuHours / N;
    var full = COST_BPP * P;
    var perGpu = full / N;
    var verdict, tone;
    if (full <= COST_HBM) {
      verdict = "Fits: a full copy of weights, gradients and optimizer state fits on every GPU, so plain data parallelism works (leave headroom for activations).";
      tone = "ok";
    } else if (perGpu <= COST_HBM) {
      verdict = "Needs sharding: one full copy is " + bytesLabel(full) + ", over the 80 GB budget, but sharded across " + N + " GPUs each holds " + bytesLabel(perGpu) + ". Shard optimizer state, gradients and if necessary parameters.";
      tone = "shard";
    } else {
      verdict = "Needs more GPUs: even fully sharded, each of the " + N + " GPU" + (N > 1 ? "s" : "") + " would hold " + bytesLabel(perGpu) + ", over the 80 GB budget. Add devices, offload state to CPU memory, or shrink the model.";
      tone = "more";
    }
    if (wallHours / 24 > 60) verdict += " Wall-clock is over two months; add GPUs or cut the token budget before you commit.";
    return { P: P, D: D, N: N, flops: flops, gpuHours: gpuHours, wallHours: wallHours, cost: gpuHours * COST_PRICE, full: full, perGpu: perGpu, verdict: verdict, tone: tone };
  }

  Widgets.trainCost = function (mount) {
    shell(mount, "estimator", "What will this run cost?",
      "Pick a model size, a training volume, a GPU count and a utilisation. Compute is about 6 × parameters × tokens processed; the 300 TFLOP/s peak, $2.50 per GPU-hour and 80 GB per GPU are illustrative constants, not quotes.");

    var pi = 4, ti = 4, gi = 3, util = 0.45;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function slider(label, values, idx, fmt, onMove) {
      var out = h("b", { style: "font-family:var(--font-mono);color:var(--accent-ink)" }, fmt(values[idx]));
      var input = h("input", { type: "range", min: "0", max: String(values.length - 1), step: "1", value: String(idx), "aria-label": label });
      input.addEventListener("input", function () {
        var k = parseInt(input.value, 10);
        if (isNaN(k)) k = 0;
        out.textContent = fmt(values[k]);
        onMove(k);
      });
      return h("label", { class: "w-field" }, label + " ", input, " ", out);
    }

    function memRow(label, bytes) {
      var pct = Math.min(100, bytes / COST_HBM * 100);
      var over = bytes > COST_HBM;
      return h("div", {
        style: "display:grid;grid-template-columns:minmax(130px,1.2fr) minmax(80px,2fr) minmax(120px,1fr);gap:12px;align-items:center;padding:6px 0"
      },
        h("span", { style: "font-size:0.84rem" }, label),
        h("span", { style: "display:block;height:12px;background:var(--surface-solid);border-radius:6px;overflow:hidden" },
          h("i", { style: "display:block;height:100%;width:" + Math.max(1, pct).toFixed(1) + "%;background:" + (over ? "var(--rose)" : "var(--accent)") })),
        h("span", { style: "font-family:var(--font-mono);font-size:0.8rem;color:" + (over ? "var(--rose-ink)" : "var(--text)") },
          bytesLabel(bytes) + " / 80 GB" + (over ? " · over" : ""))
      );
    }

    function paint() {
      var s = costState(pi, ti, gi, util);
      clear(stage);
      stage.appendChild(h("div", {
        style: "font-family:var(--font-mono);font-size:0.8rem;line-height:1.7;color:var(--text-dim);padding:0 0 8px"
      },
        "FLOPs = 6 × " + countLabel(s.P) + " × " + countLabel(s.D) + " = " + sci(s.flops), h("br"),
        "GPU-hours = FLOPs / (300 TFLOP/s × " + Math.round(util * 100) + "%) / 3600 = " + gpuHoursLabel(s.gpuHours), h("br"),
        "wall-clock = GPU-hours / " + s.N + (s.N === 1 ? " GPU" : " GPUs") + " = " + duration(s.wallHours)));
      stage.appendChild(memRow("one full copy (16 B/param)", s.full));
      stage.appendChild(memRow("per GPU, fully sharded", s.perGpu));

      clear(readout);
      readout.appendChild(ro("compute", sci(s.flops) + " FLOPs"));
      readout.appendChild(ro("GPU-hours", gpuHoursLabel(s.gpuHours)));
      readout.appendChild(ro("wall-clock", duration(s.wallHours)));
      readout.appendChild(ro("cost (illustrative)", money(s.cost)));
      readout.appendChild(ro("memory/GPU", bytesLabel(s.perGpu)));
      readout.appendChild(ro("verdict", s.tone === "ok" ? "fits" : s.tone === "shard" ? "needs sharding" : "needs more GPUs"));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, s.verdict));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      slider("Parameters", COST_PARAMS, pi, countLabel, function (k) { pi = k; paint(); }),
      slider("Tokens / samples processed", COST_TOKENS, ti, countLabel, function (k) { ti = k; paint(); }),
      slider("GPUs", COST_GPUS, gi, function (n) { return String(n); }, function (k) { gi = k; paint(); }),
      segment([[0.3, "30% util"], [0.45, "45% util"], [0.6, "60% util"]], 1, function (v) { util = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     3. Quizzes — every `answer` is a ZERO-BASED index, hand-counted
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "train-parallel": {
      title: "Parallelism checkpoint",
      sub: "Bottlenecks, gradient sync, sharded state, pipelines and embedding tables.",
      questions: [
        {
          q: "A single-GPU job shows the GPU busy about 35% of the time while every data-loader worker sits at 100% CPU. What is the best first move?",
          options: [
            "Add three more GPUs and switch the job to synchronous data parallelism",
            "Move to a larger model so the idle compute gets used",
            "Fix the input pipeline: pre-decode, cache, add workers, prefetch",
            "Lower the learning rate so each step does less work"
          ],
          answer: 2,
          explain: "The GPU is starved, not saturated, so the bottleneck is the input pipeline. Adding GPUs multiplies the demand on a loader that already cannot keep up and makes each GPU-hour more wasteful. Pre-decoding, caching, more loader workers and prefetching attack the actual wall."
        },
        {
          q: "With ring all-reduce, roughly how many bytes does each of N GPUs send per step to synchronise gradients of total size S?",
          options: [
            "2(N−1)/N × S, which approaches 2S as N grows",
            "N × S, which grows linearly with the cluster",
            "S / N, which shrinks as you add GPUs",
            "S × log₂N, from a binary tree of pairwise exchanges"
          ],
          answer: 0,
          explain: "A ring all-reduce is a reduce-scatter followed by an all-gather, each taking N−1 steps that move S/N bytes. That totals 2(N−1)/N × S per GPU — nearly constant in N — which is why ring all-reduce scales well when bandwidth, not latency, dominates."
        },
        {
          q: "You move from 8 to 64 GPUs with the same per-GPU batch, so the effective batch grows eightfold. What is the most defensible learning-rate change?",
          options: [
            "Leave it unchanged, because batch size and learning rate are fully independent",
            "Divide it by 8 so each update stays the same size",
            "Multiply it by 64 from the very first step",
            "Scale it up roughly with the batch, add warmup, and confirm on validation"
          ],
          answer: 3,
          explain: "A larger batch gives a less noisy gradient, so you can usually take a proportionally larger step — the linear scaling heuristic. Jumping straight to the large rate tends to diverge early, so a warmup ramp is standard. The rule is a starting point, not a law, which is why you confirm it on validation."
        },
        {
          q: "What problem does sharding optimizer states across data-parallel workers primarily solve?",
          options: [
            "Slow gradient traffic over cross-node links",
            "Every replica redundantly storing the full optimizer state",
            "Idle bubbles at the start and end of a pipeline",
            "Nondeterministic results from asynchronous parameter-server updates"
          ],
          answer: 1,
          explain: "In plain data parallelism every GPU holds identical copies of the optimizer state, which with Adam in mixed precision is about 12 of the 16 bytes per parameter. Sharding gives each GPU one slice, cutting that memory by roughly N with about the same communication volume. It does not make the link faster or remove pipeline bubbles."
        },
        {
          q: "A pipeline has 4 stages and you feed 4 micro-batches per step. Roughly what fraction of device time is lost to the bubble?",
          options: [
            "About 8%",
            "About 25%",
            "About 43%",
            "About 75%"
          ],
          answer: 2,
          explain: "The bubble fraction is about (p−1)/(m+p−1) = 3/7 ≈ 43% for p = 4 stages and m = 4 micro-batches. Raising m to 32 drops it to 3/35 ≈ 9%, which is why pipelines want many small micro-batches per step, limited by activation memory."
        },
        {
          q: "A ranking model has 400 GB of embedding tables and a small dense network, trained on 8 GPUs in one node. Which layout fits the problem?",
          options: [
            "Replicate the full model on all 8 GPUs with synchronous data parallelism",
            "Shard the tables across GPUs; keep the dense layers data-parallel",
            "Pipeline the dense network across nodes with many micro-batches",
            "Keep the tables on one GPU and stream the rest from disk"
          ],
          answer: 1,
          explain: "The tables are far too large to replicate, and they are sparse: each example touches a handful of rows. Sharding them across GPUs and exchanging the looked-up vectors with an all-to-all solves the memory problem, while the small dense part is cheap to replicate and sync with ordinary data parallelism."
        }
      ]
    },

    "train-experiments": {
      title: "Search and tracking checkpoint",
      sub: "Search strategies, budget math, validation discipline, lineage and noise bands.",
      questions: [
        {
          q: "You have nine trials and two hyperparameters, but only the learning rate really matters. Why does random search usually beat a 3×3 grid here?",
          options: [
            "Random trials use fewer GPU-hours each",
            "Random search tries nine distinct learning rates; the grid tries three",
            "Grid trials cannot be run in parallel",
            "Random search is guaranteed to reach the global optimum within nine trials"
          ],
          answer: 1,
          explain: "A grid spends its budget on combinations, so the important axis only ever sees three values and six trials are wasted varying the unimportant one. Random sampling gives every trial a fresh value on every axis. Neither method guarantees the optimum; random simply covers the axis that matters more densely."
        },
        {
          q: "Successive halving starts 81 configurations at 1 epoch and keeps the top third at each rung (3, 9, 27, 81 epochs). How many epochs does the whole search cost?",
          options: [
            "6,561 epochs",
            "81 epochs",
            "243 epochs",
            "405 epochs"
          ],
          answer: 3,
          explain: "Each rung costs the same: 81×1, 27×3, 9×9, 3×27 and 1×81 are 81 epochs apiece, for 405 in total. Training all 81 configurations to 81 epochs would cost 6,561, so the bracket is about 16 times cheaper — at the risk of killing slow starters early."
        },
        {
          q: "How should you sample a learning rate whose plausible range is 1e-5 to 1e-1?",
          options: [
            "Log-uniformly, so each decade gets about the same number of trials",
            "Uniformly on a linear scale, so every value in the range is equally likely",
            "Hold it at 1e-3 and tune everything else first",
            "On a linear grid with 0.02 spacing"
          ],
          answer: 0,
          explain: "Learning rate acts multiplicatively, so the difference between 1e-4 and 1e-3 matters as much as between 1e-2 and 1e-1. A linear sample would put about 90% of trials in the top decade. Log-uniform sampling spreads them evenly across orders of magnitude."
        },
        {
          q: "You run 400 trials, choose the best by validation AUC, and report that validation AUC as the expected production number. What is wrong?",
          options: [
            "Nothing, because the validation data was never used to fit the weights",
            "AUC is not a valid metric for model selection",
            "Max over 400 noisy trials is optimistic; score an untouched test set",
            "400 trials is too few to trust the winner"
          ],
          answer: 2,
          explain: "Picking the best of many noisy estimates selects partly for luck, so the winner's validation score overstates its true performance. That optimism grows with the number of trials. A test set touched once, after selection is finished, gives the honest number."
        },
        {
          q: "A production model misbehaves and you need to know exactly which data it was trained on. Which tracked field answers that in one lookup?",
          options: [
            "The final validation loss of the run",
            "The human-readable display name of the run",
            "The GPU type and driver version recorded in the run's environment block",
            "A data snapshot id stored with the run and the registered artifact"
          ],
          answer: 3,
          explain: "Lineage only works if the artifact points to an immutable data identifier, such as a snapshot id or a content hash of the training table. Names and metrics describe the run; they do not let you reconstruct its inputs. With the snapshot id you can re-read the exact rows and diff them against the current data."
        },
        {
          q: "The same config and seed, run twice on GPUs, gives AUC 0.8412 and 0.8398. What is the best interpretation?",
          options: [
            "Expected run-to-run noise; measure a seed band and judge changes against it",
            "A bug, since identical seeds must give bitwise-identical results on any hardware",
            "The training data must have changed between the two runs",
            "The second run diverged and should simply be discarded"
          ],
          answer: 0,
          explain: "Nondeterministic GPU kernels, floating-point reduction order and data-loader timing all cause small differences even with fixed seeds. The right response is to measure that noise across several seeds and treat any change smaller than the band as unproven. Chasing bitwise identity is usually not worth the throughput it costs."
        }
      ]
    },

    "train-compute": {
      title: "Compute and cost checkpoint",
      sub: "Memory per parameter, FLOP budgets, CPU versus GPU, and the efficiency levers.",
      questions: [
        {
          q: "Before counting activations, about how much GPU memory does mixed-precision Adam training need for a 1-billion-parameter model?",
          options: [
            "About 2 GB",
            "About 4 GB",
            "About 8 GB",
            "About 16 GB"
          ],
          answer: 3,
          explain: "The rule of thumb is about 16 bytes per parameter: 2 for half-precision weights, 2 for gradients, and 12 for the full-precision master weights plus Adam's two moment estimates. Two gigabytes is only the half-precision weights, which is what inference needs, not training."
        },
        {
          q: "A 1B-parameter model trains on 10B tokens. Using 6 × params × tokens, a 300 TFLOP/s peak and 50% utilisation, roughly how many GPU-hours is that?",
          options: [
            "About 11 GPU-hours",
            "About 111 GPU-hours",
            "About 1,100 GPU-hours",
            "About 11,000 GPU-hours"
          ],
          answer: 1,
          explain: "6 × 1e9 × 1e10 = 6e19 FLOPs. Effective throughput is 300e12 × 0.5 = 1.5e14 FLOP/s, so the run takes 4e5 GPU-seconds, about 111 GPU-hours. The factor of 6 is two FLOPs per parameter for the forward pass and four for the backward pass."
        },
        {
          q: "A team wants an 8-GPU node to train gradient-boosted trees on 5 million rows and 200 features. What is the best response?",
          options: [
            "Approve it, because GPUs are always faster for training",
            "Use data parallelism across all eight GPUs to cut the wall-clock time eightfold",
            "Benchmark on a multi-core CPU first; at this size it often takes minutes",
            "Rewrite the model as a neural network so the GPUs are used"
          ],
          answer: 2,
          explain: "Tree boosting at a few million rows is usually fast on a good multi-core CPU, and the GPU's advantage only becomes compelling at much larger or wider data. Start with a cheap benchmark; a GPU that spends most of its time waiting on data loading is the most expensive way to train a small model."
        },
        {
          q: "What does gradient (activation) checkpointing trade?",
          options: [
            "Extra compute from recomputing activations for lower activation memory",
            "Lower numeric precision for higher throughput",
            "More frequent checkpoint writes to disk in exchange for better fault tolerance",
            "Smaller batches for a better generalisation gap"
          ],
          answer: 0,
          explain: "Checkpointing stores activations only at a few layer boundaries and recomputes the rest during the backward pass. That costs roughly one extra forward pass, often 20–35% more compute, in exchange for a large cut in activation memory. It is unrelated to saving the model to disk, despite the similar name."
        },
        {
          q: "You train on discounted spot capacity that is preempted every few hours. What must the checkpoint contain for a correct resume?",
          options: [
            "Just the model weights, written once the run finishes",
            "Weights, optimizer state, schedule step, data-loader position and RNG state",
            "The final metrics plus the original config file",
            "The weights plus the full training logs, uploaded to object storage every hour"
          ],
          answer: 1,
          explain: "Resuming from weights alone resets Adam's moment estimates and the learning-rate schedule, which shows up as a loss spike. Without the data-loader position you repeat or skip examples, and without the RNG state dropout and shuffling diverge. A full training state makes a preemption cost minutes, not a restart."
        },
        {
          q: "You want an effective batch of 1,024. Only 128 examples fit per GPU and you have 4 GPUs. How many gradient-accumulation steps do you need?",
          options: [
            "8 accumulation steps",
            "4 accumulation steps",
            "2 accumulation steps",
            "None — raise the learning rate instead"
          ],
          answer: 2,
          explain: "Effective batch = micro-batch × GPUs × accumulation steps, so 1,024 = 128 × 4 × 2. Accumulating sums gradients over two forward-backward passes before one optimizer step. Raising the learning rate does not change the batch statistics you were trying to reach."
        }
      ]
    }
  });

  /* ==================================================================
     4. Module: parallel
  ================================================================== */
  var MOD_PARALLEL = {
    id: "parallel",
    name: "Parallelism",
    icon: "grid",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "why-distributed",
        title: "Why training goes distributed — and when it should not",
        summary: "Compute, memory and input are three different walls. Find which one you hit before buying more GPUs, and scale up before you scale out.",
        minutes: 9,
        tags: ["training", "distributed", "throughput"],
        blocks: [
          { t: "p", html: "\"Make training faster\" hides three unrelated problems. A job can be <strong>compute-bound</strong> (the GPUs are busy and the run is still too slow), <strong>memory-bound</strong> (the model, its gradients and optimizer state do not fit on one device), or <strong>input-bound</strong> (the GPUs are idle, waiting for the next batch). Each wall has a different fix, and the expensive mistake is applying the fix for one to a job that has hit another." },
          { t: "p", html: "This track is about classical and deep model training infrastructure — the recommenders, rankers, vision and tabular models most ML systems actually run. Pretraining and fine-tuning large language models has its own scale and failure modes; <a href='../llm-academy/index.html'>Lumen</a> covers those in depth." },
          {
            t: "table",
            headers: ["Wall", "What you observe", "First fix", "Scale-out answer"],
            rows: [
              ["Compute", "GPU busy &gt; 90%, step time dominated by forward/backward", "Mixed precision, fused kernels, a better batch size", "Data parallelism across more GPUs"],
              ["Memory", "Out-of-memory at the batch size you need", "Smaller micro-batch + accumulation, gradient checkpointing", "Sharded optimizer state, tensor or pipeline parallelism"],
              ["Input", "GPU busy 30–60%, loader workers pegged, step time spiky", "Pre-decode, cache, more workers, prefetch", "Usually none — more GPUs make it worse"]
            ]
          },
          { t: "h", text: "Measure before you scale" },
          { t: "p", html: "Ten minutes of profiling decides the whole plan. You want a breakdown of one training step into time waiting for data, time in forward and backward, time in communication, and time in the optimizer step — plus the peak memory high-water mark." },
          {
            t: "ul", items: [
              "<strong>GPU utilisation over time</strong>, not a single average. A sawtooth that drops to zero between steps is the input pipeline.",
              "<strong>Data-wait time per step.</strong> If the loop spends more than a few percent blocked on the next batch, fix that first.",
              "<strong>Peak memory versus device memory.</strong> Running at 95% means the next feature you add will crash the job.",
              "<strong>Scaling efficiency.</strong> Throughput on 2 GPUs divided by twice the throughput on 1. Below about 0.8 the extra device is mostly buying communication."
            ]
          },
          { t: "h", text: "The input pipeline is the hidden bottleneck" },
          { t: "p", html: "GPUs got faster much more quickly than JPEG decoding, Parquet parsing and feature joins did. A modern accelerator can consume examples faster than a handful of CPU cores can prepare them, and the work of reading, decoding, augmenting and collating happens on the CPU side. Do the throughput math explicitly; the numbers below are illustrative but the shape is typical." },
          {
            t: "code", lang: "text", code:
              "target      1 epoch of 50M images in 6 hours\n" +
              "need        50e6 / (6 * 3600)           ~= 2,300 images/s\n" +
              "\n" +
              "one GPU     ~800 images/s for this model (measured, not guessed)\n" +
              "GPUs        2,300 / 800                 ~= 3   -> plan 4 for headroom\n" +
              "\n" +
              "decode      ~150 images/s per CPU core (decode + augment)\n" +
              "cores       2,300 / 150                 ~= 16 cores just for input\n" +
              "storage     2,300 * 110 KB              ~= 250 MB/s sustained read\n" +
              "\n" +
              "if the node has 8 spare cores, the job tops out near 1,200 images/s\n" +
              "no matter how many GPUs you attach"
          },
          { t: "note", variant: "trap", html: "<strong>Adding GPUs to an input-bound job lowers throughput per dollar.</strong> Each new GPU waits on the same starved loader, and you now pay for the idle time plus the gradient sync. Pre-decode once into a compact binary format, cache hot shards locally, raise loader parallelism and prefetch a few batches ahead — then re-measure. For heavy feature joins, move them upstream into the data pipeline; <a href='../data-eng-academy/index.html'>Cascade</a> covers building those pipelines." },
          { t: "h", text: "Scale up before you scale out" },
          { t: "p", html: "One bigger box — more GPUs on a fast intra-node link — is almost always simpler than many boxes on a network. Intra-node interconnects are typically an order of magnitude faster than the links between nodes, failures are rarer, and debugging is a single process tree instead of a distributed system." },
          {
            t: "compare",
            bad: { title: "Scaling out first", items: ["Eight nodes of one GPU each over the data-centre network", "Gradient sync crosses the slowest link every step", "Any node failing kills the run", "Debugging means correlating logs across machines"] },
            good: { title: "Scaling up first", items: ["One node with eight GPUs on a fast local link", "Sync stays on the fastest wire you have", "One failure domain to checkpoint around", "Go multi-node only when one node is measurably not enough"] }
          },
          { t: "stat", items: [
            { v: "3", k: "walls: compute, memory, input" },
            { v: "~0.8", k: "scaling efficiency worth defending" },
            { v: "1 node", k: "exhaust it before many" }
          ] },
          { t: "p", html: "Distribution is never free: it costs communication time, a larger failure surface, harder reproducibility and a more complicated learning-rate story. The <a href='#/mlsd/concepts/training-pipelines'>training pipeline lesson</a> covers what happens around the training step; this module is about the step itself." },
          { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"training takes too long\", \"retrain daily on a growing log\", \"the model no longer fits\". Before naming a parallelism strategy, ask which wall it is — and say out loud that you would profile the input pipeline first, because that is where most slow jobs actually are." },
          { t: "note", variant: "key", html: "<strong>Name the wall before the fix.</strong> Compute-bound wants more devices, memory-bound wants sharding, input-bound wants a faster loader — and more GPUs make an input-bound job slower per dollar. Scale up on one node before you scale out across many." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "data-parallel",
        title: "Data parallelism and gradient synchronisation",
        summary: "Replicate the model, shard the batch, average the gradients — what all-reduce costs, why sync beat async, and how batch size drags the learning rate along.",
        minutes: 11,
        tags: ["training", "distributed", "data-parallel"],
        blocks: [
          { t: "p", html: "Data parallelism is the default because it changes nothing about the model. Every GPU holds a full copy; each step, every GPU takes a different slice of the batch, computes gradients on it, and then all GPUs average their gradients so every copy applies the identical update. Mathematically you trained on one large batch; physically you split the arithmetic N ways." },
          {
            t: "ol", items: [
              "<strong>Shard the batch.</strong> A global batch of 1,024 on 8 GPUs is 128 examples each, drawn from disjoint parts of the data.",
              "<strong>Forward and backward locally.</strong> Each GPU computes gradients for its 128 examples.",
              "<strong>All-reduce the gradients.</strong> Sum (then divide by N) across GPUs, so every GPU ends with the same averaged gradient.",
              "<strong>Step the optimizer locally.</strong> Same gradient, same starting weights, same update — the replicas stay identical without ever sending weights."
            ]
          },
          { t: "h", text: "Ring all-reduce and what it costs" },
          { t: "p", html: "The naive way to average — everyone sends to one coordinator — makes the coordinator's link the bottleneck. A ring all-reduce arranges the N GPUs in a loop and splits the gradient into N chunks. In a <em>reduce-scatter</em> phase each GPU passes one chunk to its neighbour and adds the one it receives, N−1 times, until each GPU owns the full sum for one chunk. An <em>all-gather</em> phase then circulates those finished chunks another N−1 times." },
          {
            t: "code", lang: "text", code:
              "bytes sent per GPU per step  = 2 * (N-1)/N * S        (S = gradient bytes)\n" +
              "\n" +
              "model            100M params, fp16 gradients -> S = 200 MB\n" +
              "N = 8            2 * 7/8 * 200 MB            = 350 MB per GPU per step\n" +
              "\n" +
              "fast local link  ~300 GB/s (illustrative)   -> ~1.2 ms\n" +
              "cross-node link  ~25 GB/s  (illustrative)   -> ~14 ms\n" +
              "\n" +
              "if forward+backward takes 120 ms, both hide behind the backward pass;\n" +
              "if it takes 10 ms, the cross-node sync is now the slowest thing in the step"
          },
          { t: "p", html: "Two consequences follow. First, the per-GPU traffic barely grows with N, which is why data parallelism scales well — until the per-step <em>latency</em> of 2(N−1) hops starts to matter on very large rings. Second, what matters is the ratio of communication to compute: a big model with a tiny per-GPU batch is communication-bound even on a good network." },
          { t: "note", variant: "tip", html: "Frameworks hide most of the sync by <strong>bucketing</strong>: gradients for the last layers are ready first, so their all-reduce starts while the backward pass is still computing earlier layers. Communication that overlaps compute is nearly free; communication that waits for it is pure cost. If a profile shows sync as a separate block at the end of each step, overlap is not happening." },
          { t: "h", text: "Synchronous versus asynchronous" },
          {
            t: "table",
            headers: ["Mode", "How it works", "Buys you", "Costs you"],
            rows: [
              ["Synchronous all-reduce", "Every worker waits for the averaged gradient before stepping", "Identical math to one big batch; easy to reason about and reproduce", "The slowest worker sets the pace (stragglers)"],
              ["Asynchronous parameter servers", "Workers push gradients to central servers and pull fresh weights whenever ready", "No waiting on stragglers; tolerated heterogeneous hardware", "Stale gradients computed on old weights; noisier convergence, harder to debug"],
              ["Bounded staleness", "Async, but no worker may run more than k steps ahead", "A middle ground on unreliable clusters", "Still non-reproducible; one more knob to tune"]
            ]
          },
          { t: "p", html: "Parameter servers dominated early large-scale training on commodity clusters, and they survive where they fit naturally — very large sparse embedding tables updated a few rows at a time. For dense models on modern interconnects, synchronous all-reduce won: stale gradients cost more convergence than stragglers cost wall-clock, and a straggler is easier to fix than a convergence mystery." },
          { t: "h", text: "Effective batch size drags the learning rate along" },
          { t: "p", html: "Adding workers while keeping the per-GPU batch fixed multiplies the <strong>effective batch</strong>. A bigger batch averages more examples, so the gradient is less noisy, and you can usually take a larger step. The common starting heuristic is to scale the learning rate roughly linearly with the batch for SGD-style optimizers (adaptive optimizers often tolerate less, closer to square-root scaling), and to ramp it up over a warmup period because the large rate is unstable while the weights are still random." },
          {
            t: "code", lang: "python", code:
              "import math\n" +
              "\n" +
              "def learning_rate(step, base_lr=0.1, base_batch=256, batch=2048,\n" +
              "                  warmup_steps=2000, total_steps=60000):\n" +
              "    peak = base_lr * batch / base_batch      # linear scaling heuristic\n" +
              "    if step < warmup_steps:\n" +
              "        return peak * (step + 1) / warmup_steps\n" +
              "    progress = (step - warmup_steps) / max(1, total_steps - warmup_steps)\n" +
              "    return peak * 0.5 * (1 + math.cos(math.pi * progress))  # cosine decay"
          },
          { t: "note", variant: "trap", html: "<strong>Big batches are not free generalisation.</strong> Past some critical batch size, extra examples per step stop reducing the number of steps you need, so you are burning compute for no speed-up — and very large batches can land in solutions that generalise slightly worse. Treat the scaling rule as a starting point, and check validation, not just training loss. The <a href='#/mlsd/concepts/generalization'>generalisation lesson</a> covers why the gap matters, and <a href='#/found/framing/bias-variance'>bias and variance</a> gives the underlying picture." },
          { t: "h", text: "Sharding what every replica duplicates" },
          { t: "p", html: "Plain data parallelism stores the full training state on every GPU. With Adam in mixed precision that is about 16 bytes per parameter, and 12 of them are optimizer state that only the optimizer step ever touches. Sharding that state across the N workers — each GPU owns and updates one slice, then shares the updated weights — removes the duplication without changing the math." },
          {
            t: "table",
            headers: ["What is sharded", "Memory per GPU (bytes/param)", "Communication versus plain data parallel"],
            rows: [
              ["Nothing (plain data parallel)", "16", "Baseline: one all-reduce of gradients"],
              ["Optimizer state", "4 + 12/N", "About the same: reduce-scatter + all-gather"],
              ["Optimizer state + gradients", "2 + 14/N", "About the same"],
              ["Optimizer state + gradients + parameters", "16/N", "About 1.5×: weights are gathered just in time for forward and backward"]
            ]
          },
          { t: "p", html: "The first two levels are close to a free lunch on a decent link. Full parameter sharding is how a model whose training state is far larger than one GPU can still be trained with data-parallel code — at the price of more traffic and a dependency on the network staying fast." },
          { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"the model fits but training is slow\", \"we have more data than one GPU can chew through\". Reach for data parallelism, and earn the credit by naming the all-reduce cost, the learning-rate and warmup adjustment, and sharded optimizer state as the next step if memory gets tight." },
          { t: "note", variant: "key", html: "<strong>Data parallelism is the default because it leaves the model alone.</strong> Ring all-reduce costs about two model-sizes of traffic per GPU per step, nearly independent of N; overlap it with the backward pass. A bigger effective batch needs a retuned learning rate with warmup, and duplicated optimizer state is the first thing to shard." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "model-pipeline-parallel",
        title: "Tensor, pipeline and embedding-table sharding",
        summary: "When the model itself does not fit: split the math inside a layer, split the layers into stages, or split the embedding tables — and choose by memory and interconnect.",
        minutes: 12,
        tags: ["training", "distributed", "recsys"],
        blocks: [
          { t: "p", html: "Data parallelism assumes one GPU can hold the whole model. When it cannot — even after sharding optimizer state — you have to split the model itself. There are three ways to cut it, and they differ mainly in <em>where</em> the cut is and therefore <em>how much traffic crosses it</em>." },
          { t: "h", text: "Tensor parallelism: splitting the math" },
          { t: "p", html: "A large matrix multiply can be split by columns or by rows. Each GPU holds a slice of the weight matrix, computes a partial result on the same input, and the partial results are combined. Paired correctly — split the first matrix by columns and the second by rows — a two-layer block needs one all-reduce in the forward pass and one in the backward pass." },
          {
            t: "code", lang: "text", code:
              "Y = X · W      W is [4096 x 16384], too big to want on one GPU\n" +
              "\n" +
              "split W by columns across 4 GPUs:\n" +
              "  GPU k holds W[:, k*4096:(k+1)*4096]\n" +
              "  GPU k computes Y_k = X · W_k           (same X everywhere)\n" +
              "\n" +
              "next layer Z = Y · V, split V by rows to match:\n" +
              "  GPU k computes Z_k = Y_k · V_k\n" +
              "  Z = all_reduce(sum of Z_k)              <- one sync per block\n" +
              "\n" +
              "cost: an all-reduce of activations inside EVERY block, forward and backward"
          },
          { t: "p", html: "That per-layer traffic is the catch. Tensor parallelism communicates activations many times per step, so it only performs on the fastest interconnect you have — in practice, GPUs inside one node. Stretched over a slow cross-node link, the GPUs spend most of the step waiting." },
          { t: "h", text: "Pipeline parallelism: splitting the layers" },
          { t: "p", html: "Pipeline parallelism cuts between layers instead: GPU 0 owns layers 1–12, GPU 1 owns 13–24, and so on. Only the boundary activations (forward) and their gradients (backward) cross the cut, point to point, which is far less traffic than tensor parallelism — good enough for slower cross-node links. The problem is idleness: stage 2 cannot start until stage 1 finishes. The fix is to split each batch into <strong>micro-batches</strong> so the stages overlap, like an assembly line." },
          {
            t: "code", lang: "text", code:
              "bubble fraction  ~= (p - 1) / (m + p - 1)     p = stages, m = micro-batches\n" +
              "\n" +
              "p = 4, m = 4     3 / 7   ~= 43% of device time idle\n" +
              "p = 4, m = 16    3 / 19  ~= 16%\n" +
              "p = 4, m = 32    3 / 35  ~=  9%\n" +
              "\n" +
              "more micro-batches shrink the bubble, but each in-flight micro-batch\n" +
              "keeps its activations alive until its backward pass -> memory caps m"
          },
          { t: "note", variant: "trap", html: "<strong>A pipeline runs at the speed of its slowest stage.</strong> Splitting 24 layers into four stages of six only balances if the layers cost the same. An embedding lookup at the front or a big output projection at the back can make one stage twice as slow as the rest, and every other GPU waits on it. Balance by measured time per layer, not by layer count." },
          { t: "h", text: "Embedding-table sharding: the recommender case" },
          { t: "p", html: "This is the classic ML-systems version of the problem, and it looks nothing like a language model. A ranking or recommendation model might have a modest dense network but enormous embedding tables: one row per user, item, advertiser or hashed feature value. The tables are where the parameters live, and they are <em>sparse</em> — each example touches only a few dozen rows." },
          {
            t: "code", lang: "text", code:
              "user table      1,000,000,000 ids x 128 dims x 4 bytes  = 512 GB\n" +
              "item table        200,000,000 ids x 128 dims x 4 bytes  = 102 GB\n" +
              "optimizer state  (row-wise adaptive, ~1 float per row)  + a few GB\n" +
              "dense network    ~50M params                             = tiny by comparison\n" +
              "\n" +
              "the dense part fits anywhere; the tables fit nowhere"
          },
          { t: "p", html: "So you split the two parts differently: shard the tables across GPUs (model parallel) and replicate the dense network (data parallel). Each step, every GPU looks up the rows its examples need, which mostly live on other GPUs, so lookups are exchanged with an <strong>all-to-all</strong>: send ids out, receive vectors back, and reverse it for the gradients. The rows used by a step are a tiny fraction of the table, so only those rows are updated. This is the training-side view of the towers in <a href='#/rank/retrieval/two-tower'>two-tower retrieval</a> and the ID features in <a href='#/mlcase/recsys/ad-click-prediction'>ad click prediction</a>." },
          {
            t: "table",
            headers: ["Scheme", "How the table is split", "Fits when", "Watch out for"],
            rows: [
              ["Table-wise", "Whole tables assigned to different GPUs", "Many medium tables of similar size", "One huge table still does not fit; uneven load"],
              ["Row-wise", "Rows of one table spread across GPUs (often by hashed id)", "A single table larger than a GPU", "Hot ids (popular items) overload one shard"],
              ["Column-wise", "Embedding dimensions split across GPUs", "Very wide embeddings", "Every lookup touches every shard"],
              ["Hybrid with caching", "Hot rows replicated or cached, long tail sharded", "Heavy-tailed id popularity — the usual case", "Keeping cached copies consistent"]
            ]
          },
          { t: "h", text: "Hybrid strategies and how to choose" },
          { t: "p", html: "Real large jobs combine these: tensor parallelism inside each node where the link is fast, pipeline stages across nodes where it is slow, and data parallelism replicating the whole arrangement for throughput. The choosing rule is short — <em>pick by what does not fit, then by which link the traffic must cross</em>." },
          {
            t: "table",
            headers: ["Tier", "Answer to \"the model no longer fits on one GPU\""],
            rows: [
              ["<strong>Naive</strong>", "\"Use model parallelism\" — no statement of which part does not fit or where the cut goes."],
              ["<strong>Solid</strong>", "Shard optimizer state first; if one layer or table still exceeds a GPU, split it with tensor or embedding sharding inside the node."],
              ["<strong>Standout</strong>", "Does the memory math per component, keeps the chatty split on the fast link and the thin pipeline cut on the slow one, sizes micro-batches against the bubble, and handles hot embedding rows explicitly."]
            ]
          },
          { t: "widget", id: "trainParallel" },
          { t: "h", text: "How this scores at each level" },
          {
            t: "table",
            headers: ["Bar", "On a \"train this at scale\" prompt, that means"],
            rows: [
              ["<strong>Mid</strong>", "Knows data parallelism and that gradients are averaged. Says \"split the model\" when it does not fit, without saying how."],
              ["<strong>Senior</strong>", "Diagnoses the wall first, prices the all-reduce, adjusts learning rate for the effective batch, and picks tensor, pipeline or embedding sharding from the memory math and interconnect."],
              ["<strong>Staff</strong>", "Designs the hybrid layout end to end — what lives on which device and why — and connects it to cost, fault tolerance and how often the job can afford to retrain."]
            ]
          },
          { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"billions of users or items\", \"huge ID vocabulary\", \"the model does not fit in GPU memory\". For recommenders, say embedding-table sharding with an all-to-all and a data-parallel dense part. For deep dense models, say tensor parallelism inside the node and pipeline across nodes, with the bubble formula ready." },
          { t: "note", variant: "key", html: "<strong>Cut where the traffic is smallest for the link it crosses.</strong> Tensor parallelism is chatty and belongs on the fast intra-node link; pipeline parallelism is thin and tolerates slow links but needs many micro-batches; recommender embedding tables are sharded by rows with an all-to-all while the dense part stays data-parallel." },
          { t: "quiz", id: "train-parallel" }
        ]
      }
    ]
  };

  /* ==================================================================
     5. Module: experiments
  ================================================================== */
  var MOD_EXPERIMENTS = {
    id: "experiments",
    name: "Search and tracking",
    icon: "map",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "hyperparameter-search",
        title: "Hyperparameter search on a budget",
        summary: "Grid, random, Bayesian and early-stopping searches as ways to spend a fixed compute budget — plus which knobs matter and how not to overfit validation.",
        minutes: 10,
        tags: ["training", "tuning"],
        blocks: [
          { t: "p", html: "Hyperparameter search is a budget-allocation problem. You have a fixed number of GPU-hours and a space of configurations far too large to try exhaustively; every method below is just a different policy for deciding which configurations get compute, and how much." },
          {
            t: "table",
            headers: ["Method", "How it spends the budget", "Strength", "Weakness"],
            rows: [
              ["Grid", "Every combination of a few values per knob", "Simple, exhaustive over its grid", "Wastes trials on unimportant axes; explodes with dimensions"],
              ["Random", "Independent samples from each knob's distribution", "Covers important axes densely; trivially parallel", "No learning from earlier trials"],
              ["Bayesian optimisation", "Fits a model of score versus config, picks the next most promising trial", "Fewer trials for expensive runs in small spaces", "Sequential by nature; struggles with many dimensions or categorical knobs"],
              ["Early stopping (successive halving)", "Starts many configs cheaply, keeps only the best fraction at each rung", "Huge savings when early scores predict final ones", "Kills slow starters that would have won"]
            ]
          },
          { t: "p", html: "The case for random over grid is about dimensions that do not matter. With nine trials over two knobs where only the learning rate matters, a 3×3 grid tests three learning rates and repeats each three times; random search tests nine. Since most problems have a few knobs that matter and many that barely do, random search is the strong default baseline." },
          { t: "h", text: "Kill the losers early" },
          { t: "p", html: "Successive halving starts many configurations with a small budget, ranks them, keeps the top 1/η, and gives the survivors η times more budget. A bandit-style extension runs several such brackets with different trade-offs between \"many configs, short runs\" and \"few configs, long runs\", hedging against the case where early scores are misleading." },
          {
            t: "code", lang: "text", code:
              "successive halving, eta = 3, max budget = 81 epochs\n" +
              "\n" +
              "rung   configs   epochs each   epochs spent\n" +
              "  0       81          1             81\n" +
              "  1       27          3             81\n" +
              "  2        9          9             81\n" +
              "  3        3         27             81\n" +
              "  4        1         81             81\n" +
              "                                  -----\n" +
              "                                   405 epochs\n" +
              "\n" +
              "train all 81 to completion:  81 * 81 = 6,561 epochs  (~16x more)"
          },
          { t: "note", variant: "warn", html: "<strong>Early stopping assumes early rank predicts final rank.</strong> That fails for configurations that start slowly by design — small learning rates, heavy regularisation, long warmups. If your best final configs were all near the bottom at rung 0, raise the minimum budget or use several brackets so not every config is judged at one epoch." },
          { t: "h", text: "What to search, and on what scale" },
          {
            t: "table",
            headers: ["Model family", "Tune first", "Then", "Usually leave alone"],
            rows: [
              ["Neural networks", "Learning rate (and its schedule)", "Batch size, weight decay, dropout, warmup length", "Optimizer betas, epsilon, init details"],
              ["Gradient-boosted trees", "Learning rate with number of trees (via early stopping)", "Tree depth or leaf count, minimum child weight, row and column subsampling", "Histogram bins, exotic split criteria"],
              ["Linear / logistic models", "Regularisation strength", "L1 versus L2 mix, feature crosses", "Solver tolerance"]
            ]
          },
          { t: "p", html: "Knobs that act multiplicatively — learning rate, regularisation strength, weight decay — must be searched on a log scale. Sampling 1e-5 to 1e-1 uniformly puts about 90% of trials in the top decade and almost none where small-rate configs live." },
          {
            t: "code", lang: "python", code:
              "import math, random\n" +
              "\n" +
              "def log_uniform(rng, lo, hi):\n" +
              "    return math.exp(rng.uniform(math.log(lo), math.log(hi)))\n" +
              "\n" +
              "def sample_config(rng):\n" +
              "    return {\n" +
              "        \"lr\":           log_uniform(rng, 1e-5, 1e-1),\n" +
              "        \"weight_decay\": log_uniform(rng, 1e-6, 1e-2),\n" +
              "        \"batch_size\":   rng.choice([128, 256, 512, 1024]),\n" +
              "        \"dropout\":      rng.uniform(0.0, 0.5),   # bounded, linear is fine\n" +
              "    }\n" +
              "\n" +
              "rng = random.Random(17)           # seeded so the search itself is reproducible\n" +
              "trials = [sample_config(rng) for _ in range(64)]"
          },
          { t: "h", text: "Do not overfit the validation set" },
          { t: "p", html: "Every trial you score on validation is a small leak: choose the best of 400 and you have selected partly for noise, so its validation score is optimistic. The more trials, the larger the optimism. Keep a test set that nothing touches until the search is done, and score it once. For small datasets, nested cross-validation separates the tuning loop from the estimate. The split rules from the <a href='#/mlsd/concepts/training-pipelines'>training pipeline lesson</a> apply here too — a temporal split for time-ordered data." },
          {
            t: "table",
            headers: ["Tier", "Tuning discipline"],
            rows: [
              ["<strong>Naive</strong>", "Tune on the test set, or report the best validation score from hundreds of trials as the expected production result."],
              ["<strong>Solid</strong>", "Random or early-stopping search on validation, log-scale for multiplicative knobs, one final scoring on an untouched test set."],
              ["<strong>Standout</strong>", "Sets the budget up front, tunes the knobs that matter for this model family, reports the seed-noise band alongside the winner, and re-checks that the winner's margin survives on the test set."]
            ]
          },
          { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"how would you tune this model\", \"we have a fixed GPU budget\", \"the offline score looked better than production\". Say random search with early stopping as the baseline, name the two or three knobs that matter for this model family, and point out that heavy tuning inflates the validation score." },
          { t: "note", variant: "key", html: "<strong>Search is budget allocation.</strong> Random beats grid because few knobs matter; early stopping turns a 6,561-epoch search into roughly 405 when early rank predicts final rank. Search multiplicative knobs on a log scale, and touch the test set once, after the search is done." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "experiment-tracking",
        title: "Experiment tracking and lineage",
        summary: "What every run must record, how a deployed model points back to its code and data, and how to compare runs without fooling yourself.",
        minutes: 9,
        tags: ["training", "tracking", "lineage"],
        blocks: [
          { t: "p", html: "Treat every training run as a row in a database you will query later, usually under pressure: \"which data trained the model that is misbehaving?\", \"what changed between the run that worked and the one that did not?\". A tracked run is one where those questions take a lookup. An untracked one takes an archaeology project." },
          {
            t: "table",
            headers: ["Record", "Why", "Example"],
            rows: [
              ["Code version", "Reproduce the exact training logic", "Commit hash, plus a dirty-tree flag"],
              ["Data snapshot", "Know exactly which rows trained it", "Snapshot id or content hash of the training table, time window"],
              ["Config", "Every knob, including defaults you did not set", "Full resolved config, not just the overrides"],
              ["Metrics", "Compare runs and catch divergence", "Loss curves per step, final validation and slice metrics"],
              ["Artifacts", "Deploy, roll back, debug", "Model weights, preprocessing state, evaluation reports"],
              ["Environment", "Explain differences that the code does not", "Library versions, container image digest, GPU type and count"],
              ["Seed and lineage", "Rerun and trace parentage", "Seeds, parent run id for warm starts or fine-tunes"]
            ]
          },
          { t: "p", html: "In practice a tracking record is a small structured document written at the start of the run (so crashed runs are visible too) and updated as it progresses. Whatever tool stores it, the shape is the same." },
          {
            t: "code", lang: "python", code:
              "run = {\n" +
              "    \"run_id\":      \"ctr-ranker-2026-10-28-a3f9\",\n" +
              "    \"experiment\":  \"ctr-ranker/lr-sweep\",\n" +
              "    \"code\":        {\"commit\": \"9c1e4b7\", \"dirty\": False},\n" +
              "    \"data\":        {\"snapshot\": \"impressions_v412\", \"window\": [\"2026-09-01\", \"2026-10-20\"],\n" +
              "                    \"rows\": 1843201177, \"label_def\": \"click_within_30s\"},\n" +
              "    \"config\":      {\"lr\": 3e-4, \"batch\": 4096, \"emb_dim\": 64, \"epochs\": 2},\n" +
              "    \"env\":         {\"image\": \"trainer@sha256:5be0...\", \"gpus\": \"8x80GB\"},\n" +
              "    \"seed\":        1234,\n" +
              "    \"parent_run\":  \"ctr-ranker-2026-10-21-77d2\",   # warm-started from\n" +
              "    \"metrics\":     {\"val_logloss\": 0.4127, \"val_auc\": 0.7841,\n" +
              "                    \"auc_new_users\": 0.7312},\n" +
              "    \"artifacts\":   [\"model.bin\", \"feature_vocab.json\", \"eval_report.html\"],\n" +
              "    \"status\":      \"finished\",\n" +
              "}"
          },
          { t: "h", text: "Lineage: from a model back to its data" },
          { t: "p", html: "Lineage is the chain that lets you walk backwards from a prediction in production to the rows that taught the model to make it. Each link has to be an immutable identifier, not a description. The registry end of this chain is covered in <a href='#/ops/delivery/model-registry'>the model registry lesson</a>." },
          {
            t: "ol", items: [
              "<strong>Serving version</strong> — the deployment records which registered model version it loaded.",
              "<strong>Registered model</strong> — the registry entry points at the run id that produced it.",
              "<strong>Run</strong> — the tracking record holds the commit, config, seed and data snapshot id.",
              "<strong>Data snapshot</strong> — an immutable, as-of-time copy (or versioned table) that can be re-read exactly, built with the <a href='#/data/correctness/point-in-time'>point-in-time</a> rules."
            ]
          },
          { t: "note", variant: "tip", html: "<strong>Name experiments by question, runs by identity.</strong> An experiment name like <code class='tok'>ctr-ranker/lr-sweep</code> groups the runs that answer one question; a run id should be unique and machine-generated, with human context in tags. Names like <code class='tok'>final_v2_really_final</code> are a sign that the tracking system is not the source of truth." },
          { t: "h", text: "Comparing runs honestly" },
          {
            t: "ul", items: [
              "<strong>Change one thing.</strong> A run that changes the learning rate and the data window cannot tell you which one helped.",
              "<strong>Compare at matched budget.</strong> A run trained for twice as many steps is not evidence that its architecture is better.",
              "<strong>Compare against the noise band.</strong> Rerun the baseline with a few seeds; a difference smaller than that spread is not a result yet (see <a href='#/train/experiments/reproducibility'>reproducibility</a>).",
              "<strong>Compare on slices, not just the headline.</strong> A 0.3-point overall gain that costs two points on new users may not ship."
            ]
          },
          {
            t: "compare",
            bad: { title: "Tracking as an afterthought", items: ["Metrics pasted into a spreadsheet after the fact", "Data described as \"last month's logs\"", "Crashed runs leave no trace", "The deployed model's origin is a guess"] },
            good: { title: "Tracking as infrastructure", items: ["Run record created automatically at launch", "Data pinned by snapshot id or content hash", "Failed and killed runs are queryable too", "Registry → run → snapshot is one click each"] }
          },
          {
            t: "table",
            headers: ["Tier", "What gets tracked"],
            rows: [
              ["<strong>Naive</strong>", "Final metric and a model file in a shared folder."],
              ["<strong>Solid</strong>", "Code, config, data snapshot, metrics, artifacts and environment logged automatically for every run, linked from the registry."],
              ["<strong>Standout</strong>", "All of that plus parent-run lineage for warm starts, slice metrics as first-class fields, and a policy that a model without a resolvable data snapshot cannot be promoted."]
            ]
          },
          { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"how do you know which model is in production\", \"a retrained model regressed\", \"audit what trained this\". Answer with the lineage chain — serving version, registry entry, run, data snapshot — and say the run record is created at launch, not reconstructed afterwards." },
          { t: "note", variant: "key", html: "<strong>A model is a pointer to code, config and data.</strong> Log code version, data snapshot, full config, metrics, artifacts and environment for every run, automatically; link the registry to the run and the run to an immutable snapshot, and compare runs one change at a time against a noise band." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "reproducibility",
        title: "Reproducibility you can actually achieve",
        summary: "Where nondeterminism comes from, how snapshots and pinned environments remove most of it, and why the practical target is a tolerance band, not bitwise identity.",
        minutes: 9,
        tags: ["training", "reproducibility"],
        blocks: [
          { t: "p", html: "\"Reproducible\" means two different things, and conflating them wastes weeks. <strong>Bitwise reproducible</strong> means the same inputs produce the identical bytes. <strong>Statistically reproducible</strong> means a rerun lands within a known noise band of the original. The first is possible on one fixed machine at a throughput cost; the second is what you need to make decisions, and it is achievable almost everywhere." },
          {
            t: "table",
            headers: ["Source", "Why it varies", "Control"],
            rows: [
              ["Random seeds", "Initialisation, dropout, sampling", "Seed every library you use, and record the seeds"],
              ["Data order", "Shuffling, loader worker scheduling, sharding across GPUs", "Seeded shuffles per epoch; seed each loader worker"],
              ["GPU kernels", "Parallel reductions and atomic adds sum in varying order; autotuning picks different algorithms", "Deterministic-algorithm flags, autotuning off — at a speed cost"],
              ["Distributed reductions", "Floating-point addition is not associative; ring order changes the sum", "Fixed topology and GPU count; accept small drift"],
              ["Library and driver versions", "Different kernels, defaults and bug fixes", "Pinned lockfile, container image digest"],
              ["Data itself", "Late-arriving rows, backfills, mutable tables", "Immutable snapshot or versioned table, recorded by id"]
            ]
          },
          {
            t: "code", lang: "python", code:
              "import os, random\n" +
              "import numpy as np\n" +
              "import torch\n" +
              "\n" +
              "def make_deterministic(seed: int) -> None:\n" +
              "    random.seed(seed)\n" +
              "    np.random.seed(seed)\n" +
              "    torch.manual_seed(seed)                 # seeds CPU and all GPUs\n" +
              "    os.environ[\"CUBLAS_WORKSPACE_CONFIG\"] = \":4096:8\"\n" +
              "    torch.use_deterministic_algorithms(True)  # raise on nondeterministic ops\n" +
              "    torch.backends.cudnn.benchmark = False    # no per-run kernel autotuning\n" +
              "\n" +
              "def worker_init(worker_id: int) -> None:     # pass to the data loader\n" +
              "    s = torch.initial_seed() % 2**32\n" +
              "    np.random.seed(s + worker_id)\n" +
              "    random.seed(s + worker_id)"
          },
          { t: "note", variant: "warn", html: "<strong>Deterministic mode costs throughput</strong> — sometimes a little, sometimes a lot for scatter-heavy models like embedding lookups. Use it for debugging a specific divergence or for a regulated artifact, not as the default for every sweep." },
          { t: "h", text: "Data snapshots" },
          { t: "p", html: "Most \"I cannot reproduce last month's model\" stories are not GPU nondeterminism — the training table changed underneath. Late events arrived, a backfill rewrote a partition, a label definition was fixed. Train from an immutable snapshot (or a table version you can time-travel to), record its id in the run, and features computed as of the right time — see <a href='#/data/correctness/point-in-time'>point-in-time correctness</a>. Building versioned tables upstream is pipeline work; <a href='../data-eng-academy/index.html'>Cascade</a> covers it." },
          { t: "h", text: "Environment: containers and lockfiles" },
          {
            t: "ul", items: [
              "<strong>Lockfile</strong> with exact versions and hashes for every dependency, not a range like <code class='tok'>&gt;=2.0</code>.",
              "<strong>Container image referenced by digest</strong>, not by a mutable tag like <code class='tok'>latest</code>.",
              "<strong>Driver and accelerator type recorded</strong> in the run, because they change kernels without changing your code.",
              "<strong>Preprocessing shipped with the model</strong> — vocabularies, normalisation statistics, tokenisers — so serving cannot drift from training."
            ]
          },
          { t: "h", text: "Reproducible enough: tolerance bands" },
          { t: "p", html: "Decide in advance how close a rerun has to be, by measuring it. Run the baseline config with several seeds; the spread is your noise band. A proposed change has to beat the baseline by more than that band before you call it a win, and a reproduction attempt passes if it lands inside the band." },
          {
            t: "code", lang: "text", code:
              "baseline, 5 seeds:   val AUC 0.7836  0.7843  0.7829  0.7848  0.7839\n" +
              "mean 0.7839, spread (max - min) 0.0019\n" +
              "\n" +
              "candidate, 5 seeds:  mean 0.7851              -> +0.0012, inside the band: not proven\n" +
              "candidate B:         mean 0.7884              -> +0.0045, clearly outside: real\n" +
              "\n" +
              "reproduction of last month's run: 0.7841 vs recorded 0.7839 -> within band, pass"
          },
          { t: "note", variant: "trap", html: "<strong>One run against one run is not a comparison.</strong> If the seed noise is 0.002 AUC and your change moved AUC by 0.001, a single pair of runs will \"confirm\" or \"refute\" it at random. This is how teams ship regressions dressed as improvements. Rerun-to-verify any result that is about to change a decision." },
          {
            t: "compare",
            bad: { title: "Chasing bitwise identity", items: ["Deterministic kernels forced on every run", "Weeks spent explaining a 0.0003 difference", "Throughput lost on every sweep", "Data still read from a mutable table"] },
            good: { title: "Reproducible enough", items: ["Pinned data, code, config and environment", "Seed band measured once per model family", "Decisions require clearing the band", "Deterministic mode reserved for debugging"] }
          },
          { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"we could not reproduce the old model\", \"the new model is 0.1% better\", \"results differ between runs\". Ask whether the data was snapshotted before blaming GPUs, and propose a seed-noise band as the bar a change must clear." },
          { t: "note", variant: "key", html: "<strong>Aim for reproducible enough, and measure what enough means.</strong> Pin data by snapshot, code by commit and environment by image digest; seed everything; then measure the seed band and require changes to clear it. Bitwise determinism is a debugging tool, not a default." },
          { t: "quiz", id: "train-experiments" }
        ]
      }
    ]
  };

  /* ==================================================================
     6. Module: compute
  ================================================================== */
  var MOD_COMPUTE = {
    id: "compute",
    name: "Compute and cost",
    icon: "bolt",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "gpu-economics",
        title: "GPU economics: memory, throughput and cost",
        summary: "Sixteen bytes per parameter, six FLOPs per parameter per token, and the utilisation factor that decides the bill — plus when a GPU is the wrong tool.",
        minutes: 11,
        tags: ["training", "cost", "gpu"],
        blocks: [
          { t: "p", html: "Two budgets govern any training run. <strong>Memory</strong> decides whether the job runs at all on a given device. <strong>Throughput</strong> decides how long it runs and therefore what it costs. Both can be estimated on a napkin before anyone provisions a cluster, and an estimate that is right within a factor of two is enough to choose between \"one GPU for a day\" and \"a rack for a month\"." },
          { t: "h", text: "The sixteen-bytes-per-parameter rule" },
          {
            t: "table",
            headers: ["Component (Adam, mixed precision)", "Bytes per parameter", "Why it exists"],
            rows: [
              ["Half-precision weights", "2", "Used in forward and backward"],
              ["Half-precision gradients", "2", "Produced by backward"],
              ["Full-precision master weights", "4", "Small updates would vanish in half precision"],
              ["Adam first moment", "4", "Running mean of gradients"],
              ["Adam second moment", "4", "Running mean of squared gradients"],
              ["<strong>Total before activations</strong>", "<strong>~16</strong>", "Inference needs only the 2-byte weights"]
            ]
          },
          {
            t: "code", lang: "text", code:
              "model         training state (16 B/param)    vs one 80 GB GPU (illustrative)\n" +
              "100M params   1.6 GB                         fits easily\n" +
              "1B params     16 GB                          fits, room for activations\n" +
              "5B params     80 GB                          full before a single activation\n" +
              "20B params    320 GB                         needs >= 4-way sharding, realistically 8"
          },
          { t: "p", html: "<strong>Activation memory</strong> sits on top of that and is the part people forget. The forward pass keeps intermediate outputs alive until the backward pass uses them, so activation memory grows with batch size × layer width × depth (and sequence length, for sequence models). For a modest model with a big batch, activations can exceed the parameter state. It is also the part you control without touching the model: smaller micro-batches, checkpointing, lower precision." },
          { t: "note", variant: "warn", html: "<strong>Recommender models break the rule of thumb the other way.</strong> Their parameters are mostly embedding rows, often trained with lighter optimizers that keep about one extra value per row, and only the rows touched by a batch get gradients. Do the memory math per component — tables and dense network separately — rather than applying sixteen bytes to everything." },
          { t: "h", text: "Compute and cost" },
          { t: "p", html: "For dense networks, a useful approximation is that training costs about <strong>6 FLOPs per parameter per training token</strong> (or per input element processed): about 2 for the forward pass and 4 for the backward pass. Divide by what the hardware actually delivers — peak throughput times a <strong>utilisation</strong> factor, typically somewhere in the 30–60% range for well-tuned jobs and lower for poorly fed ones — and you have GPU-hours. Multiply by price and you have the bill." },
          {
            t: "code", lang: "text", code:
              "model          P = 1e9 params\n" +
              "data           D = 1e10 tokens (or samples x elements per sample)\n" +
              "FLOPs          6 * P * D = 6e19\n" +
              "\n" +
              "peak           300 TFLOP/s per GPU      (illustrative)\n" +
              "utilisation    45%\n" +
              "GPU-seconds    6e19 / (300e12 * 0.45)  = 4.4e5\n" +
              "GPU-hours      ~123\n" +
              "\n" +
              "on 8 GPUs      ~15 hours wall-clock\n" +
              "cost           123 * $2.50 (illustrative) ~= $310 per run\n" +
              "x 20 tuning runs + 1 final               ~= $6,500 per model version"
          },
          { t: "p", html: "The last line is the one that matters for a design discussion: a retraining cadence multiplies it. Daily retraining at that size is roughly 365 final runs a year, before any tuning. The 6×P×D rule is a dense-network approximation; embedding lookups contribute memory traffic rather than FLOPs, so for recommenders estimate compute from the dense part and time from the lookups." },
          { t: "widget", id: "trainCost" },
          { t: "h", text: "CPU versus GPU" },
          {
            t: "table",
            headers: ["Workload", "Usually trained on", "Why"],
            rows: [
              ["Gradient-boosted trees, up to tens of millions of rows", "Multi-core CPU", "Fast histogram algorithms; minutes to an hour; GPU help is real but often not worth the setup"],
              ["Gradient-boosted trees, very large or very wide data", "GPU worth benchmarking", "Histogram building parallelises well at scale"],
              ["Linear and logistic models", "CPU", "Data loading dominates; compute is trivial"],
              ["Deep nets on images, audio, text, sequences", "GPU", "Dense matrix math is what accelerators exist for"],
              ["Recommenders with large embedding tables", "GPUs plus large host memory", "Dense part on GPU; tables sharded or partly in host memory"]
            ]
          },
          { t: "note", variant: "trap", html: "<strong>Where GPUs are wasted:</strong> a small model fed by a slow loader (the GPU idles most of the step), a tree model at a few million rows, a hyperparameter sweep where each trial uses a whole 80 GB device for a 50 MB model, and evaluation or feature computation that runs on the GPU host but uses only its CPUs. Pack several small trials per device, or move them to CPU." },
          { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"how much would this cost to train\", \"can we retrain daily\", \"do we need GPUs\". Do the 16-bytes memory check and the 6×P×D compute estimate out loud, state your utilisation and price assumptions as assumptions, and multiply by the retraining cadence." },
          { t: "note", variant: "key", html: "<strong>Two napkin numbers decide the plan.</strong> About 16 bytes per parameter for Adam in mixed precision (plus activations) says whether it fits; about 6 × parameters × tokens FLOPs, divided by peak × utilisation, says how many GPU-hours it costs. Multiply by the retraining cadence — and check whether the workload needs a GPU at all." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "training-efficiency",
        title: "Training efficiency: the levers that pay",
        summary: "Mixed precision, gradient accumulation and checkpointing, fault-tolerant checkpoints for cheap preemptible capacity, early stopping, data caching and warm starts.",
        minutes: 11,
        tags: ["training", "cost", "efficiency"],
        blocks: [
          { t: "p", html: "Once you know which wall a job hits and what it costs, a short list of levers moves the bill. Each one buys memory, time or money — and each charges for it somewhere, usually in compute, complexity or a subtle correctness risk." },
          {
            t: "table",
            headers: ["Lever", "Saves", "Costs", "Reach for it when"],
            rows: [
              ["Mixed precision", "Memory and time (often 1.5–3× faster math)", "Numeric care: loss scaling for fp16, a few ops kept in fp32", "Almost always on modern accelerators"],
              ["Gradient accumulation", "Memory: big effective batch from small micro-batches", "Fewer optimizer steps per hour; no speed-up", "The batch you want does not fit"],
              ["Gradient checkpointing", "Activation memory, often by a large factor", "Roughly one extra forward pass (~20–35% compute)", "Activations, not parameters, are the memory wall"],
              ["Checkpoint + resume", "Lost work on failure; enables preemptible capacity", "Write time and storage", "Runs longer than a few hours, or any spot capacity"],
              ["Early stopping", "Wasted epochs after validation plateaus", "Needs a trustworthy validation signal", "Every run with a validation set"],
              ["Data caching", "Input-pipeline time on every epoch", "Storage, and a cache to invalidate", "Preprocessing is deterministic and repeated"],
              ["Warm starts", "Most of the retraining compute", "Drift and accumulated bias; lineage to track", "Frequent retraining on a sliding window"]
            ]
          },
          { t: "h", text: "Mixed precision" },
          { t: "p", html: "Run the heavy math in 16-bit and keep a 32-bit master copy of the weights for the update. Two 16-bit formats exist: one with a wider exponent range that rarely needs special handling, and an older one with more mantissa bits but a narrow range, which needs <em>loss scaling</em> — multiply the loss before backward so small gradients do not underflow to zero, then divide before the update. Keep reductions like softmax and normalisation statistics in 32-bit." },
          { t: "h", text: "Gradient accumulation" },
          {
            t: "code", lang: "text", code:
              "effective batch = micro-batch x GPUs x accumulation steps\n" +
              "\n" +
              "want 1,024   fits 128 per GPU   have 4 GPUs\n" +
              "accumulation = 1,024 / (128 * 4) = 2\n" +
              "\n" +
              "loop: forward+backward on micro-batch 1 (keep gradients)\n" +
              "      forward+backward on micro-batch 2 (add to gradients)\n" +
              "      all-reduce once, optimizer step once, zero gradients"
          },
          { t: "p", html: "Accumulation reaches the batch statistics you want, and on a slow link it also cuts how often you synchronise. It does not make training faster; it makes an impossible batch possible. Watch layers that compute statistics per micro-batch (batch normalisation), which see the small batch, not the effective one." },
          { t: "h", text: "Gradient checkpointing" },
          { t: "p", html: "Instead of storing every layer's activations for the backward pass, store them only at a few boundaries and recompute the rest when the backward pass needs them. With checkpoints every √L layers, activation memory falls from proportional to L to roughly proportional to √L, for about one extra forward pass. It is the standard trade of compute for memory — and despite the name, it has nothing to do with saving the model to disk." },
          { t: "h", text: "Fault tolerance and preemptible capacity" },
          { t: "p", html: "Preemptible or spot capacity is often sold at a deep discount — frequently more than half off, varying by provider and region — in exchange for being reclaimable with short notice. Long multi-GPU runs also fail on their own: one bad device or network blip stops a synchronous job. Both are survivable only if resume is cheap and correct, which means checkpointing the full training state, not just the weights." },
          {
            t: "code", lang: "python", code:
              "state = {\n" +
              "    \"model\":      model.state_dict(),\n" +
              "    \"optimizer\":  optimizer.state_dict(),     # Adam moments: 12 of the 16 bytes\n" +
              "    \"scheduler\":  scheduler.state_dict(),     # where in warmup/decay we are\n" +
              "    \"step\":       global_step,\n" +
              "    \"data\":       loader.state(),             # epoch, shard, offset\n" +
              "    \"rng\":        capture_rng_states(),       # python, numpy, framework, per device\n" +
              "    \"run_id\":     run_id,\n" +
              "}\n" +
              "save_atomically(state, f\"ckpt/{run_id}/step-{global_step:08d}\")  # write, then rename"
          },
          {
            t: "code", lang: "text", code:
              "how often to checkpoint (first-order rule):  interval ~= sqrt(2 * C * MTBF)\n" +
              "\n" +
              "C    = time to write a checkpoint       = 2 min\n" +
              "MTBF = mean time between interruptions = 6 h = 360 min (spot, illustrative)\n" +
              "interval ~= sqrt(2 * 2 * 360) ~= 38 min\n" +
              "\n" +
              "expected loss per interruption ~= half an interval + restart time"
          },
          { t: "note", variant: "trap", html: "<strong>Resuming from weights alone is a silent bug.</strong> The optimizer moments reset, the learning-rate schedule restarts its warmup, and the loader replays the epoch from the beginning — the loss curve shows a spike and the model sees some examples twice. Save the full state, write it atomically so a preemption mid-write does not corrupt the latest checkpoint, and test resume deliberately by killing a run." },
          { t: "h", text: "Early stopping, caching and warm starts" },
          {
            t: "ul", items: [
              "<strong>Early stopping:</strong> stop when validation has not improved for a patience window, and keep the best checkpoint rather than the last. It is regularisation and cost control at once.",
              "<strong>Data caching:</strong> decode, tokenise and join once, store as sharded binary files close to the GPUs, and reuse across epochs and sweep trials. Invalidate by keying the cache on the data snapshot id and preprocessing code version.",
              "<strong>Warm starts and incremental training:</strong> initialise from yesterday's model and train on the newest window instead of retraining on the full history — often a small fraction of the compute."
            ]
          },
          {
            t: "compare",
            bad: { title: "Warm-starting forever", items: ["Each model inherits all previous models' quirks", "Bias from a bad week never fully washes out", "Lineage becomes a long chain of parents", "A feature or schema change has nowhere clean to start"] },
            good: { title: "Warm starts with a reset cadence", items: ["Daily warm-started updates on the newest data", "Periodic full retrain from scratch as the reference", "Compare the two to detect accumulated drift", "Parent run recorded in the tracking record"] }
          },
          { t: "p", html: "Which of these a system needs depends on how often it retrains and why — the policy side is in <a href='#/ops/monitoring/retraining-triggers'>retraining triggers</a>, and every artifact they produce should land in the <a href='#/ops/delivery/model-registry'>model registry</a> with its lineage." },
          { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"training is too expensive\", \"jobs keep dying\", \"we retrain every day\". Name mixed precision and data caching as the near-free wins, spot capacity with full-state checkpoints as the big cost lever, and warm starts with a periodic from-scratch retrain for frequent retraining." },
          { t: "note", variant: "key", html: "<strong>Every efficiency lever is a trade.</strong> Mixed precision trades numeric care for speed, accumulation trades steps for batch size, checkpointing trades compute for memory, spot capacity trades interruptions for price — and only a full-state, atomically written checkpoint makes that last trade safe." },
          { t: "quiz", id: "train-compute" }
        ]
      }
    ]
  };

  /* ==================================================================
     7. Track registration
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.train = {
    id: "train",
    name: "Training at Scale",
    short: "Train",
    tagline: "From one notebook to a cluster you can afford",
    color: "#fbbf24",
    blurb: "The infrastructure half of model training, for the recommenders, rankers, vision and tabular models most ML systems actually run. Starts by naming which wall a slow job has hit — compute, memory or a starved input pipeline — then works through data parallelism and the all-reduce bill, tensor and pipeline splits, and the embedding-table sharding that recommender models live on. The middle module turns tuning into budget allocation and makes every run traceable and reproducible within a measured noise band. Closes with the napkin math that sets the bill — sixteen bytes per parameter, six FLOPs per parameter per token — and the levers that cut it: mixed precision, accumulation, checkpointing, spot capacity and warm starts.",
    modules: [MOD_PARALLEL, MOD_EXPERIMENTS, MOD_COMPUTE]
  };
})();
