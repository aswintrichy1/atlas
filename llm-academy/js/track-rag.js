/* =====================================================================
   LUMEN · RAG & Context Engineering
   window.TRACKS.rag — modules: retrieval / quality / context

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
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

  /* labelled range slider; onChange receives the numeric value */
  function slider(label, min, max, step, value, onChange) {
    var out = h("b", { style: "font-family:var(--font-mono)" }, String(value));
    var input = h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(value), "aria-label": label, style: "flex:1" });
    input.addEventListener("input", function () {
      var v = Number(input.value);
      if (isNaN(v)) v = value;
      out.textContent = String(v);
      onChange(v);
    });
    return h("label", { class: "w-field", style: "display:flex;gap:10px;align-items:center;font-size:0.84rem" },
      h("span", { style: "min-width:150px" }, label), input, out);
  }

  var HUES = ["var(--accent)", "var(--cyan)", "var(--lime)", "var(--amber)", "var(--violet)", "var(--rose)"];

  var Widgets = {};

  /* ==================================================================
     1. ragChunker — chunk size / overlap / strategy on a sample policy.
        Words stand in for tokens to keep the arithmetic visible.
  ================================================================== */
  var CHUNK_DOC = [
    "Travel expense policy. Employees may book economy class for flights under six hours. Business class requires director approval in advance. Approval requests go through the travel portal at least ten days before departure.",
    "Hotels must not exceed the city rate cap listed in the appendix. If no cap is listed, the limit is two hundred dollars per night. Receipts are required for every night, including nights covered by a conference package.",
    "Meals are reimbursed up to sixty dollars per day while travelling. Alcohol is not reimbursable. Client dinners follow the hospitality policy instead and need the client name on the claim.",
    "Claims must be submitted within thirty days of returning. Late claims need a written reason and manager sign-off. Claims older than ninety days are rejected automatically."
  ];

  function words(s) { return String(s).split(/\s+/).filter(function (w) { return w.length > 0; }); }
  function endsSentence(w) { return /[.!?]$/.test(w || ""); }

  function chunkFixed(size, overlap) {
    var all = words(CHUNK_DOC.join(" "));
    var step = Math.max(1, size - overlap);
    var out = [];
    for (var start = 0; start < all.length && out.length < 500; start += step) {
      out.push(all.slice(start, Math.min(start + size, all.length)));
      if (start + size >= all.length) break;
    }
    return out;
  }

  function chunkRecursive(size, overlap) {
    var out = [];
    var cur = [], curNew = 0;               // cur: array of sentence word-arrays
    function len(arr) { var n = 0; for (var i = 0; i < arr.length; i++) n += arr[i].length; return n; }
    function flush() {
      if (!curNew) return;
      var flat = [];
      for (var i = 0; i < cur.length; i++) flat = flat.concat(cur[i]);
      out.push(flat);
      var carry = [], c = 0;
      for (var j = cur.length - 1; j > 0; j--) {
        if (c + cur[j].length > overlap) break;
        carry.unshift(cur[j]);
        c += cur[j].length;
      }
      cur = carry; curNew = 0;
    }
    for (var p = 0; p < CHUNK_DOC.length; p++) {
      var sents = CHUNK_DOC[p].match(/[^.!?]+[.!?]+/g) || [CHUNK_DOC[p]];
      var paraWords = words(CHUNK_DOC[p]).length;
      if (curNew && len(cur) + paraWords > size) flush();
      for (var s = 0; s < sents.length; s++) {
        var sw = words(sents[s]);
        if (curNew && len(cur) + sw.length > size) flush();
        if (len(cur) + sw.length > size) { cur = []; }
        cur.push(sw); curNew++;
      }
    }
    flush();
    return out;
  }

  Widgets.ragChunker = function (mount) {
    shell(mount, "simulator", "Chunking lab",
      "Split a short expense policy into chunks. Fixed-size cuts every N words regardless of meaning; recursive packs whole sentences and prefers paragraph breaks. Words stand in for tokens.");
    var st = { size: 40, overlap: 5, mode: "fixed" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var srcWords = words(CHUNK_DOC.join(" ")).length;

    function paint() {
      var ov = Math.min(st.overlap, st.size - 5);
      var chunks = st.mode === "fixed" ? chunkFixed(st.size, ov) : chunkRecursive(st.size, ov);
      var stored = 0, cuts = 0, i;
      clear(stage);
      for (i = 0; i < chunks.length; i++) {
        var c = chunks[i];
        stored += c.length;
        if (i < chunks.length - 1 && !endsSentence(c[c.length - 1])) cuts++;
        if (i < 12) {
          var preview = c.length > 12 ? c.slice(0, 7).join(" ") + " … " + c.slice(-4).join(" ") : c.join(" ");
          stage.appendChild(h("div", { style: "border-left:4px solid " + HUES[i % HUES.length] + ";padding:3px 8px;margin:4px 0;font-size:0.8rem;background:var(--surface-solid);border-radius:4px" },
            h("b", { style: "font-family:var(--font-mono)" }, "#" + (i + 1) + " · " + c.length + "w "),
            h("span", {}, preview)));
        }
      }
      if (chunks.length > 12) stage.appendChild(h("div", { style: "font-size:0.8rem;color:var(--text-dim)" }, "+" + (chunks.length - 12) + " more chunks"));
      var avg = chunks.length ? Math.round(stored / chunks.length) : 0;
      var overhead = srcWords ? Math.round((stored / srcWords - 1) * 100) : 0;
      var feel = st.size <= 30 ? "precise hits, but each chunk lacks context" : st.size >= 80 ? "rich context, but diluted embeddings and costly prompts" : "balanced";
      clear(readout);
      readout.appendChild(ro("source", srcWords + " words"));
      readout.appendChild(ro("chunks", chunks.length));
      readout.appendChild(ro("avg size", avg + "w"));
      readout.appendChild(ro("storage overhead", "+" + overhead + "%"));
      readout.appendChild(ro("mid-sentence cuts", cuts));
      readout.appendChild(ro("overlap used", ov + "w"));
      readout.appendChild(ro("trade-off", feel));
    }

    var controls = h("div", { class: "widget-controls", style: "flex-direction:column;align-items:stretch" },
      segment([["fixed", "Fixed-size"], ["recursive", "Recursive (sentence / paragraph)"]], 0, function (v) { st.mode = v; paint(); }),
      slider("Chunk size (words)", 20, 100, 5, st.size, function (v) { st.size = v; paint(); }),
      slider("Overlap (words)", 0, 30, 5, st.overlap, function (v) { st.overlap = v; paint(); }));
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. ragRrf — reciprocal rank fusion of a keyword and a vector list.
  ================================================================== */
  var RRF_DOCS = {
    d1: "Updating a saved payment card",
    d2: "Payment methods we accept",
    d3: "ERR-4012: card token expired",
    d4: "Refund timelines",
    d5: "Card payments FAQ",
    d6: "Why a new card can be declined",
    d7: "Error code reference",
    d8: "Billing address mismatch"
  };
  var RRF_SCEN = {
    code: { q: "ERR-4012 after card update", bm25: ["d3", "d7", "d1", "d5", "d2"], vec: ["d1", "d6", "d3", "d2", "d8"] },
    para: { q: "why can't I pay with my new card", bm25: ["d5", "d2", "d3", "d8", "d7"], vec: ["d6", "d1", "d3", "d2", "d4"] }
  };

  function rrfFuse(lists, k) {
    var score = {}, order = [];
    for (var l = 0; l < lists.length; l++) {
      for (var r = 0; r < lists[l].length; r++) {
        var id = lists[l][r];
        if (!(id in score)) { score[id] = 0; order.push(id); }
        score[id] += 1 / (k + r + 1);
      }
    }
    order.sort(function (a, b) { return score[b] - score[a] || (a < b ? -1 : 1); });
    return order.map(function (id) { return { id: id, s: score[id] }; });
  }

  Widgets.ragRrf = function (mount) {
    shell(mount, "fusion", "Reciprocal rank fusion",
      "Two retrievers rank the same help-centre articles. RRF ignores their raw scores and adds 1 / (k + rank) from each list. Switch the query, change k, and compare fused results with either retriever alone.");
    var st = { scen: "code", k: 60, view: "fused" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function listBox(title, ids) {
      var box = h("div", { style: "flex:1;min-width:200px" }, h("div", { style: "font-weight:600;font-size:0.82rem;margin-bottom:4px" }, title));
      for (var i = 0; i < ids.length; i++) {
        box.appendChild(h("div", { style: "font-size:0.8rem;padding:2px 0" },
          h("b", { style: "font-family:var(--font-mono)" }, (i + 1) + ". " + ids[i] + " "), RRF_DOCS[ids[i]]));
      }
      return box;
    }

    function paint() {
      var sc = RRF_SCEN[st.scen];
      var fused = rrfFuse([sc.bm25, sc.vec], st.k);
      var shown = st.view === "fused" ? fused.map(function (f) { return f.id; })
        : st.view === "bm25" ? sc.bm25.slice() : sc.vec.slice();
      clear(stage);
      stage.appendChild(h("div", { style: "font-size:0.82rem;margin-bottom:6px" }, "Query: ", h("code", { class: "tok" }, sc.q)));
      stage.appendChild(h("div", { style: "display:flex;gap:16px;flex-wrap:wrap" }, listBox("BM25 (keywords)", sc.bm25), listBox("Vector (meaning)", sc.vec)));
      var tbl = h("div", { style: "margin-top:10px;border-top:1px solid var(--line);padding-top:6px" },
        h("div", { style: "font-weight:600;font-size:0.82rem;margin-bottom:4px" }, st.view === "fused" ? "Fused ranking (RRF, k = " + st.k + ")" : (st.view === "bm25" ? "BM25 only" : "Vector only")));
      var maxS = fused.length ? fused[0].s : 1;
      for (var i = 0; i < shown.length; i++) {
        var f = null;
        for (var j = 0; j < fused.length; j++) if (fused[j].id === shown[i]) f = fused[j];
        var s = f ? f.s : 0;
        tbl.appendChild(h("div", { style: "display:grid;grid-template-columns:30px 1fr 90px 120px;gap:8px;align-items:center;font-size:0.8rem;padding:2px 0" },
          h("b", { style: "font-family:var(--font-mono)" }, String(i + 1)),
          h("span", {}, shown[i] + " · " + RRF_DOCS[shown[i]]),
          h("span", { style: "font-family:var(--font-mono);color:var(--cyan-ink)" }, s.toFixed(4)),
          h("span", { style: "display:block;height:8px;background:var(--surface-solid);border-radius:4px;overflow:hidden" },
            h("i", { style: "display:block;height:100%;width:" + Math.round(s / maxS * 100) + "%;background:var(--accent)" }))));
      }
      stage.appendChild(tbl);
      var both = 0;
      for (var b = 0; b < sc.bm25.length; b++) if (sc.vec.indexOf(sc.bm25[b]) >= 0) both++;
      clear(readout);
      readout.appendChild(ro("top result", shown[0] + " " + RRF_DOCS[shown[0]]));
      readout.appendChild(ro("top 3", shown.slice(0, 3).join(", ")));
      readout.appendChild(ro("k", st.k));
      readout.appendChild(ro("docs in both lists", both + " of " + sc.bm25.length));
      readout.appendChild(ro("rank-1 weight vs rank-5", (((1 / (st.k + 1)) / (1 / (st.k + 5)))).toFixed(2) + "×"));
    }

    var controls = h("div", { class: "widget-controls", style: "flex-direction:column;align-items:stretch" },
      segment([["code", "Query with an exact error code"], ["para", "Paraphrased question"]], 0, function (v) { st.scen = v; paint(); }),
      segment([["fused", "Fused (RRF)"], ["bm25", "BM25 only"], ["vec", "Vector only"]], 0, function (v) { st.view = v; paint(); }),
      slider("k (smoothing)", 1, 100, 1, st.k, function (v) { st.k = v; paint(); }));
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. ragBudget — context-window budget for one RAG call.
  ================================================================== */
  Widgets.ragBudget = function (mount) {
    shell(mount, "budget", "Context budget planner",
      "Fit instructions, retrieved chunks, chat history and an output reserve into one context window. The bar is the window; anything past the edge does not fit.");
    var st = { win: 32000, sys: 800, n: 8, size: 512, hist: 2000, out: 1024 };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var retr = st.n * st.size;
      var parts = [
        ["Instructions", st.sys, "var(--violet)"],
        ["Retrieved chunks", retr, "var(--lime)"],
        ["History", st.hist, "var(--cyan)"],
        ["Output reserve", st.out, "var(--amber)"]
      ];
      var total = st.sys + retr + st.hist + st.out;
      var input = total - st.out;
      clear(stage);
      var bar = h("div", { style: "display:flex;height:22px;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:var(--surface-solid)" });
      var used = 0;
      for (var i = 0; i < parts.length; i++) {
        var w = Math.max(0, Math.min(parts[i][1], st.win - used));
        used += w;
        bar.appendChild(h("i", { title: parts[i][0], style: "display:block;height:100%;width:" + (w / st.win * 100).toFixed(2) + "%;background:" + parts[i][2] }));
      }
      stage.appendChild(bar);
      var legend = h("div", { style: "display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;font-size:0.8rem" });
      for (var j = 0; j < parts.length; j++) {
        legend.appendChild(h("span", {}, h("i", { style: "display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;background:" + parts[j][2] }), parts[j][0] + " " + parts[j][1].toLocaleString()));
      }
      stage.appendChild(legend);
      var fits = total <= st.win;
      var advice = [];
      if (!fits) advice.push("over by " + (total - st.win).toLocaleString() + ": drop low-ranked chunks or summarize history");
      if (st.n > 10) advice.push("many chunks: put the strongest first and last (lost in the middle)");
      if (st.hist > retr && st.hist > 4000) advice.push("history outweighs evidence: summarize older turns");
      if (st.out < 512) advice.push("small output reserve may truncate answers");
      clear(readout);
      readout.appendChild(ro("total", total.toLocaleString() + " / " + st.win.toLocaleString()));
      readout.appendChild(ro("fits", fits ? "yes" : "no"));
      readout.appendChild(ro("headroom", (fits ? (st.win - total) : 0).toLocaleString()));
      readout.appendChild(ro("retrieval share of input", input ? Math.round(retr / input * 100) + "%" : "0%"));
      readout.appendChild(ro("input vs a 4k-token prompt", (input / 4000).toFixed(1) + "× cost"));
      readout.appendChild(ro("advice", advice.length ? advice.join("; ") : "balanced"));
    }

    var controls = h("div", { class: "widget-controls", style: "flex-direction:column;align-items:stretch" },
      segment([[8000, "8k window"], [32000, "32k window"], [128000, "128k window"]], 1, function (v) { st.win = v; paint(); }),
      slider("Instructions (tokens)", 200, 3000, 100, st.sys, function (v) { st.sys = v; paint(); }),
      slider("Chunks retrieved", 1, 40, 1, st.n, function (v) { st.n = v; paint(); }),
      slider("Chunk size (tokens)", 128, 1024, 64, st.size, function (v) { st.size = v; paint(); }),
      slider("History (tokens)", 0, 20000, 500, st.hist, function (v) { st.hist = v; paint(); }),
      slider("Output reserve (tokens)", 256, 4096, 256, st.out, function (v) { st.out = v; paint(); }));
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "rag-retrieval": {
      title: "Retrieval basics checkpoint",
      sub: "Why RAG, chunking, embeddings and vector indexes.",
      questions: [
        {
          q: "A team wants its assistant to answer questions about internal policies that change monthly, with sources shown. Which approach fits best?",
          options: [
            "Fine-tune the model on the policies every month",
            "Paste every policy into the system prompt",
            "Retrieval-augmented generation over an index that is refreshed when policies change",
            "Raise the temperature so the model explores more answers"
          ],
          answer: 2,
          explain: "RAG handles all three needs: fresh content (re-index, no retraining), private data (it stays in your store) and citations (you know which chunks were used). Fine-tuning is slow to refresh and does not give sources; pasting everything wastes tokens and breaks once the corpus outgrows the window."
        },
        {
          q: "You split a 10,000-token document into 512-token chunks with 64 tokens of overlap. Roughly how many chunks do you get?",
          options: ["About 23", "About 20", "About 156", "About 12"],
          answer: 0,
          explain: "Each new chunk starts 512 - 64 = 448 tokens after the previous one. Starts at 0, 448, 896 and so on reach the end of the document after about 23 chunks, storing roughly 14% more tokens than the source because of the overlap."
        },
        {
          q: "What is the main downside of very small chunks, say 64 tokens?",
          options: [
            "They cannot be embedded",
            "Each chunk often lacks the surrounding context needed to answer, so the right fact is split across several pieces",
            "They make the vector index smaller and slower",
            "They always reduce retrieval precision"
          ],
          answer: 1,
          explain: "Small chunks give sharp, specific embeddings but strip away context: a rule and its exception may land in different chunks. Large chunks keep context but dilute the embedding and cost more prompt tokens. Most teams start in the few-hundred-token range and tune with evals."
        },
        {
          q: "Which statement about HNSW indexes is accurate?",
          options: [
            "They return exact nearest neighbours by comparing the query with every vector",
            "They require clustering the data into a fixed number of cells first",
            "They only work with keyword search",
            "They navigate a layered proximity graph, trading a little recall and extra memory for much faster search"
          ],
          answer: 3,
          explain: "HNSW builds a multi-layer graph where each vector links to near neighbours; search hops from coarse upper layers down to fine ones. It is approximate, so recall is slightly below exact search, and the graph links cost memory. Clustering into cells describes IVF, not HNSW."
        },
        {
          q: "You already run PostgreSQL and have about 2 million chunks. Which vector-store category is usually the simplest sensible start?",
          options: [
            "A managed vector service, because Postgres cannot store vectors",
            "An in-process library with no persistence",
            "A database extension such as pgvector, keeping vectors next to your relational data",
            "A custom index you write yourself"
          ],
          answer: 2,
          explain: "An extension lets you store embeddings beside the rows they describe, filter with SQL and reuse your existing backups and access control. A few million vectors is well within its comfort zone. Dedicated servers or managed services earn their keep at larger scale or when you need features the extension lacks."
        }
      ]
    },
    "rag-quality": {
      title: "Retrieval quality checkpoint",
      sub: "Hybrid search, reciprocal rank fusion, reranking and grounding.",
      questions: [
        {
          q: "Users search for exact error codes like ERR-4012, and pure vector search keeps missing them. What is the usual fix?",
          options: [
            "Use a larger embedding model",
            "Add keyword search (BM25) alongside vectors and fuse the two rankings",
            "Lower the chunk size to 32 tokens",
            "Increase the temperature of the generator"
          ],
          answer: 1,
          explain: "Embeddings capture meaning but blur rare exact strings such as codes, SKUs and names. BM25 matches those tokens precisely. Hybrid search runs both and fuses the ranked lists, so exact matches and paraphrases are both covered."
        },
        {
          q: "With reciprocal rank fusion and k = 60, document A is ranked 1st by BM25 and 4th by vectors; document B is 3rd by BM25 and 1st by vectors. Which ranks higher after fusion?",
          options: [
            "A, because it is first in the keyword list",
            "They tie exactly",
            "Neither, since RRF needs raw scores to compare them",
            "B, with about 0.0323 against about 0.0320 for A"
          ],
          answer: 3,
          explain: "A scores 1/61 + 1/64, about 0.03202; B scores 1/63 + 1/61, about 0.03227. B wins narrowly because both of its ranks are strong. RRF uses only ranks, which is exactly why it can fuse retrievers whose raw scores are on incomparable scales."
        },
        {
          q: "Why retrieve around 50 candidates and then rerank down to 5, instead of retrieving 5 directly?",
          options: [
            "Cheap first-stage retrieval maximises recall, and a slower, more accurate cross-encoder then picks the best few for the prompt",
            "Rerankers are faster than vector search",
            "The model needs to see all 50 chunks",
            "Retrieving 5 directly is impossible with ANN indexes"
          ],
          answer: 0,
          explain: "Bi-encoder or BM25 retrieval is fast but coarse, so the best chunk is often in the top 50 without being in the top 5. A cross-encoder reads the query and each candidate together, which is far more accurate but too slow to run over the whole corpus. Two stages give you recall and precision."
        },
        {
          q: "Your grounded assistant cites chunk ids like [c12]. What check should run before the answer is shown?",
          options: [
            "None, since citations prove the answer is correct",
            "Check that the answer is under 100 words",
            "Verify every cited id exists in the chunks actually retrieved for this request, and flag answers with uncited claims",
            "Re-run the query with a higher temperature"
          ],
          answer: 2,
          explain: "Models can invent ids or cite chunks that do not support the claim. Checking cited ids against the retrieved set catches fabricated citations cheaply; faithfulness evals then check that each cited chunk really supports its sentence."
        },
        {
          q: "Retrieval returns nothing relevant for a question. What should a well-grounded assistant do?",
          options: [
            "Answer from its general knowledge without saying so",
            "Pick the closest chunk and cite it anyway",
            "Ask the user to rephrase five times",
            "Say it does not have that information in the provided sources, and optionally suggest where to look"
          ],
          answer: 3,
          explain: "The grounding rule is: answer only from the context, otherwise say you do not know. Silent fallback to general knowledge produces confident, uncited and possibly outdated answers, which is the failure RAG exists to prevent."
        },
        {
          "q": "Your RAG system has recall@10 of 0.95 but recall@1 of 0.40, and answers often cite the wrong passage. What is the most targeted fix?",
          "options": [
            "Switch to a larger embedding model and re-index everything",
            "Add or tune a reranker so the relevant chunk moves to the top, then pass fewer, better-ordered chunks",
            "Increase chunk size so each chunk holds more text",
            "Raise the temperature"
          ],
          "answer": 1,
          "explain": "The evidence is almost always retrieved (high recall@10) but ranked poorly (low recall@1, which also drags MRR down). That is a ranking problem: a cross-encoder reranker reorders the candidates, and passing fewer top chunks reduces distraction. Re-embedding attacks recall, which is already fine."
        }
      ]
    },
    "rag-context": {
      title: "Context engineering checkpoint",
      sub: "Budgets, ordering, lost-in-the-middle and long context versus RAG.",
      questions: [
        {
          q: "You pass 20 retrieved chunks and notice the model ignores relevant facts in chunks 8 to 13. What is the most likely cause and fix?",
          options: [
            "The lost-in-the-middle effect; send fewer, better chunks and place the strongest at the start and end",
            "The model's temperature is too low; raise it",
            "Chunks 8 to 13 were embedded with a different model; re-embed",
            "The context window is always too small for 20 chunks"
          ],
          answer: 0,
          explain: "Long-context models tend to use information at the beginning and end of the context more reliably than the middle. Reranking to fewer chunks and ordering the best ones at the edges usually helps more than adding more text."
        },
        {
          q: "Which item should you reserve space for before filling a context window with retrieved chunks?",
          options: [
            "Nothing, since output tokens do not count against the window",
            "A copy of the entire chat history",
            "The model's answer, because input and output usually share the same window",
            "Duplicate chunks for redundancy"
          ],
          answer: 2,
          explain: "On most models the window covers input plus output, so filling it to the brim leaves no room for the answer and truncates it. Budget instructions, evidence, history and an output reserve explicitly."
        },
        {
          q: "Compared with a RAG prompt of about 5,000 tokens, sending a 200,000-token document on every question costs roughly how much more in input tokens?",
          options: ["About 4×", "About 400×", "The same, because long context is free", "About 40×"],
          answer: 3,
          explain: "200,000 divided by 5,000 is 40. Prompt caching can cut that when the same document is reused, but latency to the first token also grows with input length. Long context buys simplicity at a per-question price."
        },
        {
          q: "When is stuffing a long context window usually the better choice than building a RAG pipeline?",
          options: [
            "A corpus of millions of documents updated hourly",
            "A single contract of 60 pages that a user asks several questions about in one session",
            "A multi-tenant help centre where each user may only see their own documents",
            "Any workload where cost per question must be minimal"
          ],
          answer: 1,
          explain: "One bounded document, many questions, one session: long context is simple, sees every clause, and caching amortises the cost. Huge, fast-changing or permission-scoped corpora still need retrieval, and cost-sensitive workloads favour small prompts."
        },
        {
          q: "Which technique reduces wasted context in a RAG prompt without losing evidence?",
          options: [
            "Repeating the system prompt at the end of every chunk",
            "Raising top-k from 5 to 50",
            "Deduplicating near-identical chunks and summarizing older chat turns",
            "Translating chunks into a shorter language"
          ],
          answer: 2,
          explain: "Overlapping chunks and copied documents often retrieve the same passage several times; dedupe keeps one copy. Old chat turns rarely need verbatim text, so a running summary preserves meaning in far fewer tokens."
        },
        {
          "q": "Chunks such as 'This limit doubles for managers.' are retrieved for the wrong questions because they have lost their context. Which fix targets this directly?",
          "options": [
            "HyDE, generating a hypothetical answer for each query",
            "Contextual chunks: prepend a short description of the document and section to each chunk before embedding it",
            "Raising top-k from 5 to 50",
            "Switching from cosine similarity to dot product"
          ],
          "answer": 1,
          "explain": "The problem is on the document side: the chunk alone does not say which limit or which policy. Adding a generated context line ('From the travel policy, per-diem section: ...') before embedding restores that meaning, so both vector and keyword search match it to the right questions."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.rag = {
    id: "rag",
    name: "RAG & Context Engineering",
    short: "RAG",
    tagline: "Give the model the right page",
    color: "#34d399",
    blurb: "Build retrieval-augmented generation the practical way: why it beats retraining for fresh and private data, how to chunk, embed and index, how hybrid search with reciprocal rank fusion and cross-encoder reranking raise quality, how to ground answers with checkable citations, and how to spend a context window wisely, including when a long-context model makes RAG unnecessary.",
    modules: [
      {
        id: "retrieval",
        name: "Retrieval Basics",
        icon: "database",
        lessons: [
          {
            id: "why-rag",
            title: "Why retrieval-augmented generation",
            summary: "Turn a closed-book model into an open-book one: fresh knowledge, private data and citations.",
            minutes: 9,
            tags: ["rag", "retrieval", "grounding", "architecture"],
            blocks: [
              { t: "p", html: "A bare model takes a closed-book exam: it answers from whatever it absorbed during training, frozen at a cutoff date, and it cannot show its sources. Retrieval-augmented generation (RAG) makes it an open-book exam. Before the model answers, your code finds the most relevant passages and puts them in the prompt." },
              { t: "diagram", id: "rag-pipeline", caption: "Index time: chunk, embed and store documents. Query time: embed the question, retrieve, optionally rerank, then generate from the retrieved context with citations." },
              { t: "table", headers: ["Problem", "Without RAG", "With RAG"], rows: [
                ["Stale knowledge", "Model knows nothing after its training cutoff", "Re-index the changed documents; no retraining"],
                ["Private data", "Model never saw your wiki, tickets or contracts", "Your data stays in your store and is retrieved per request"],
                ["Citations", "Cannot say where an answer came from", "Every answer can point at the chunks it used"],
                ["Hallucination pressure", "Model guesses when unsure", "Model can be told to answer only from the context"]
              ] },
              { t: "h", text: "The two halves of the pipeline" },
              { t: "ol", items: [
                "<strong>Index time (offline):</strong> load documents, split them into chunks, embed each chunk, store vectors plus text and metadata.",
                "<strong>Query time (online):</strong> embed the question, retrieve the top candidates, optionally rerank, build a prompt with the winners and generate a cited answer."
              ] },
              { t: "code", lang: "text", code:
                "SYSTEM\n" +
                "Answer the question using only the sources below. Cite the source id\n" +
                "in square brackets after each claim, e.g. [c12]. If the sources do not\n" +
                "contain the answer, say \"I don't have that information.\"\n\n" +
                "<sources>\n" +
                "<source id=\"c12\">Business class requires director approval in advance.</source>\n" +
                "<source id=\"c13\">Approval requests go through the travel portal at least ten days before departure.</source>\n" +
                "</sources>\n\n" +
                "USER\n" +
                "Can I fly business class to the offsite next week?"
              },
              { t: "compare",
                bad: { title: "Fine-tune to add knowledge", items: ["Retrain whenever facts change", "No sources for answers", "Facts can still be recalled wrongly", "Good for style and format, weak for facts"] },
                good: { title: "RAG to add knowledge", items: ["Update the index in minutes", "Citations by construction", "Access control at retrieval time", "Quality depends on retrieval quality"] } },
              { t: "note", variant: "warn", html: "<strong>RAG moves the problem, it does not delete it.</strong> If retrieval returns the wrong page, the model will faithfully answer from the wrong page. Most production RAG bugs are retrieval bugs, which is why the rest of this track is about retrieval quality. Background on why models guess is in <a class='inline' href='#/core/generation/hallucinations'>why hallucinations happen</a>." },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> The Blueprint atlas covers the surrounding architecture at system-design depth in <em>HLD › AI &amp; ML › Production RAG system design</em>. Lumen stays at the level of building and tuning one pipeline." },
              { t: "table", headers: ["Tier", "First RAG build", "What it misses"], rows: [
                ["Naive", "Fixed chunks, vector top-5, paste into prompt", "Exact terms, citations, any measurement"],
                ["Solid", "Sensible chunks with metadata, hybrid search, grounded prompt with citations", "Systematic quality tracking"],
                ["Standout", "Solid, plus reranking, citation checks and a retrieval eval set with recall@k", "Little: failures are measured and attributable"]
              ] },
              { t: "cue", html: "<strong>Say it out loud:</strong> \"RAG gives the model an open book: fresh and private data without retraining, plus citations. Its quality ceiling is retrieval quality, so that is what I measure first.\"" },
              { t: "note", variant: "key", html: "<strong>Retrieval decides what the model can know on this call.</strong> RAG solves freshness, privacy and citations, and every answer is only as good as the chunks you retrieved." }
            ]
          },
          {
            id: "chunking",
            title: "Chunking strategies",
            summary: "How you cut documents decides what can ever be retrieved; size, overlap and boundaries are the levers.",
            minutes: 10,
            tags: ["chunking", "overlap", "indexing", "rag"],
            blocks: [
              { t: "p", html: "Retrieval returns chunks, never whole documents, so a chunk is the unit of knowledge your model can receive. Cut a rule away from its exception and no retriever can put them back together. Chunking is the cheapest place to win or lose RAG quality." },
              { t: "table", headers: ["Strategy", "How it splits", "Strength", "Weakness"], rows: [
                ["Fixed-size", "Every N tokens, with optional overlap", "Simple, predictable sizes", "Cuts mid-sentence and mid-table"],
                ["Recursive", "Try paragraphs, then sentences, then words, until pieces fit N", "Respects natural boundaries", "Sizes vary"],
                ["Structure-aware", "Split on headings, sections, functions or table rows", "Keeps logical units whole; good metadata", "Needs a parser per format"],
                ["Semantic", "Embed sentences, cut where similarity between neighbours drops", "Topic-coherent chunks", "Slower to index; extra tuning"]
              ] },
              { t: "h", text: "The size trade-off, with numbers" },
              { t: "code", lang: "text", code:
                "doc        = 10,000 tokens\n" +
                "chunk size = 512, overlap = 64  ->  step = 512 - 64 = 448\n" +
                "chunks     = about 23   (starts at 0, 448, 896, ... 9,856)\n" +
                "stored     = about 11,400 tokens  ->  ~14% overhead from overlap\n\n" +
                "same doc, same 1/8 overlap ratio:\n" +
                "  256-token chunks  -> ~45 chunks\n" +
                "  512-token chunks  -> ~23 chunks\n" +
                "  1024-token chunks -> ~12 chunks\n\n" +
                "prompt cost of top-5:  5 x 256 = 1,280   vs   5 x 1024 = 5,120 tokens"
              },
              { t: "table", headers: ["Chunk size", "Retrieval behaviour", "Prompt cost"], rows: [
                ["Small (~128–256 tokens)", "Precise matches; context often missing", "Low per chunk, but you need more of them"],
                ["Medium (~300–600 tokens)", "Usually the sweet spot for prose", "Moderate"],
                ["Large (~1,000+ tokens)", "Rich context; embedding averages many topics, so matches blur", "High; fewer chunks fit"]
              ] },
              { t: "widget", id: "ragChunker" },
              { t: "p", html: "Overlap repeats the tail of one chunk at the head of the next, so a sentence near a boundary appears whole somewhere. Ten to twenty percent is a common starting point; more overlap means more storage and more near-duplicate hits that waste prompt space." },
              { t: "code", lang: "python", code:
                "def recursive_split(text: str, max_tokens: int, count, seps=(\"\\n\\n\", \". \", \" \")):\n" +
                "    if count(text) <= max_tokens or not seps:\n" +
                "        return [text]\n" +
                "    sep, rest = seps[0], seps[1:]\n" +
                "    chunks, buf = [], \"\"\n" +
                "    for part in text.split(sep):\n" +
                "        candidate = (buf + sep + part) if buf else part\n" +
                "        if count(candidate) <= max_tokens:\n" +
                "            buf = candidate\n" +
                "        else:\n" +
                "            if buf:\n" +
                "                chunks.append(buf)\n" +
                "            buf = \"\"\n" +
                "            if count(part) > max_tokens:\n" +
                "                chunks.extend(recursive_split(part, max_tokens, count, rest))\n" +
                "            else:\n" +
                "                buf = part\n" +
                "    if buf:\n" +
                "        chunks.append(buf)\n" +
                "    return chunks"
              },
              { t: "note", variant: "trap", html: "<strong>Tables and code hate fixed-size cuts.</strong> A table split mid-row loses its header; a function split mid-body loses its signature. Chunk them structurally and store the section heading and document title as metadata, or prepend them to the chunk text before embedding." },
              { t: "table", headers: ["Tier", "Chunking", "Result"], rows: [
                ["Naive", "Fixed 1,000 characters, no overlap, no metadata", "Mid-sentence cuts; no way to cite a section"],
                ["Solid", "Recursive splitting at a few hundred tokens, ~10–15% overlap, doc id and heading stored", "Coherent chunks with traceable sources"],
                ["Standout", "Structure-aware per format, heading path prepended, size tuned on a retrieval eval set", "Chunks match how people ask questions"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> the answer exists in the docs but retrieval returns half of it, citations point at fragments, or tables come back headless. Look at chunk boundaries before touching the model." },
              { t: "note", variant: "key", html: "<strong>A chunk is the unit of knowledge the model can receive.</strong> Split on natural boundaries, keep a modest overlap, store headings as metadata, and tune size with evals rather than taste." }
            ]
          },
          {
            id: "vector-dbs",
            title: "Embeddings and vector databases",
            summary: "Turn chunks into vectors, index them for fast approximate search, and pick a store category that fits.",
            minutes: 11,
            tags: ["embeddings", "vector-database", "hnsw", "ivf", "pgvector"],
            blocks: [
              { t: "p", html: "An embedding model maps text to a point in a high-dimensional space where similar meanings land close together; the foundations are in <a class='inline' href='#/found/tokens/embeddings'>embeddings: meaning as coordinates</a> and <a class='inline' href='#/found/tokens/vector-space'>vector-space intuition</a>. Retrieval becomes geometry: embed the question, find the nearest chunk vectors." },
              { t: "h", text: "Embedding the corpus" },
              { t: "ul", items: [
                "Use the <strong>same embedding model</strong> for documents and queries; vectors from different models are not comparable.",
                "Dimensions are typically in the hundreds to low thousands; more dimensions mean more memory per vector.",
                "Normalise vectors and use cosine similarity, or dot product on normalised vectors, unless the model's guidance says otherwise.",
                "Changing the embedding model means <strong>re-embedding everything</strong>; record the model name and version with each vector.",
                "Some models expect different prefixes or modes for queries and documents; follow the model card."
              ] },
              { t: "h", text: "Approximate nearest neighbour indexes" },
              { t: "p", html: "Exact search compares the query with every vector. At a million 768-dimension vectors that is around 768 million multiply-adds per query. ANN indexes trade a little recall for orders-of-magnitude speed." },
              { t: "stat", items: [
                { v: "~3.1 GB", k: "1M vectors × 768 dims × 4 bytes (float32)" },
                { v: "~6.1 GB", k: "same at 1,536 dims" },
                { v: "~768M", k: "multiply-adds for one exact search over 1M × 768" }
              ] },
              { t: "table", headers: ["Index", "Intuition", "Buys you", "Costs you"], rows: [
                ["Flat (exact)", "Compare with everything", "Perfect recall, no build step", "Linear time; fine only for small sets"],
                ["HNSW", "A layered \"small world\" graph: hop across coarse layers, then refine among near neighbours", "Fast, high recall, incremental inserts", "Extra memory for graph links; slower builds"],
                ["IVF", "Cluster vectors into cells; search only the few cells nearest the query", "Smaller, quick to build, scales well", "Recall depends on how many cells you probe"],
                ["IVF + PQ", "IVF with vectors compressed into short codes", "Fits huge corpora in RAM", "Lossy compression lowers accuracy; often paired with reranking"]
              ] },
              { t: "h", text: "Store categories" },
              { t: "table", headers: ["Category", "Example", "Fits when"], rows: [
                ["Library", "FAISS", "You embed it in your own service and handle persistence yourself"],
                ["Database extension", "pgvector", "You already run Postgres and want vectors beside relational data and SQL filters"],
                ["Embedded or self-hosted server", "Chroma, Qdrant", "You want a purpose-built vector store you run yourself, from laptop to cluster"],
                ["Managed service", "Pinecone", "You want someone else to run scaling, replication and upgrades"]
              ] },
              { t: "code", lang: "sql", code:
                "CREATE EXTENSION IF NOT EXISTS vector;\n\n" +
                "CREATE TABLE chunks (\n" +
                "  id         bigserial PRIMARY KEY,\n" +
                "  doc_id     text NOT NULL,\n" +
                "  heading    text,\n" +
                "  body       text NOT NULL,\n" +
                "  embedding  vector(768) NOT NULL\n" +
                ");\n\n" +
                "CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);\n\n" +
                "-- $1 = query embedding; <=> is cosine distance (smaller is closer)\n" +
                "SELECT id, doc_id, heading, body\n" +
                "FROM chunks\n" +
                "WHERE doc_id LIKE 'policy/%'\n" +
                "ORDER BY embedding <=> $1\n" +
                "LIMIT 20;"
              },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> The Blueprint atlas compares index families and store architectures at system-design depth in <em>HLD › AI &amp; ML › RAG &amp; vector databases</em>." },
              { t: "table", headers: ["Tier", "Store choice", "Trade-off"], rows: [
                ["Naive", "Pick the most-hyped dedicated service on day one", "New infrastructure, before you know your scale or filters"],
                ["Solid", "Extension or embedded store matched to current scale; HNSW; metadata filters", "Simple ops; revisit past tens of millions of vectors"],
                ["Standout", "Solid, plus recall measured against exact search, embedding model versioned, re-embed path rehearsed", "Migrations and model swaps become planned events"]
              ] },
              { t: "quiz", id: "rag-retrieval" },
              { t: "note", variant: "key", html: "<strong>Same model for queries and documents, approximate index, boring store.</strong> HNSW or IVF trades a little recall for speed; choose library, extension, server or managed by the ops you can afford." }
            ]
          }
        ]
      },
      {
        id: "quality",
        name: "Retrieval Quality",
        icon: "diamond",
        lessons: [
          {
            id: "hybrid-search",
            title: "Hybrid search: keywords plus vectors",
            summary: "Run keyword and vector retrieval together and fuse the rankings with reciprocal rank fusion.",
            minutes: 10,
            tags: ["hybrid-search", "bm25", "rrf", "fusion"],
            blocks: [
              { t: "p", html: "Vector search understands that \"can't pay with my new card\" is about declined payments. It is much worse at the exact string <code class='tok'>ERR-4012</code>, a SKU or a person's surname, because rare tokens get blurred into nearby meaning. Keyword search has the opposite profile. Hybrid search runs both and lets each cover the other's blind spot." },
              { t: "table", headers: ["Retriever", "Strong at", "Weak at"], rows: [
                ["BM25 (keywords)", "Exact codes, names, acronyms, rare terms; no model needed", "Synonyms and paraphrases"],
                ["Vector (embeddings)", "Paraphrases, synonyms, cross-lingual matches", "Exact identifiers and rare tokens"],
                ["Hybrid", "Both", "One more index to maintain, plus a fusion step"]
              ] },
              { t: "h", text: "Reciprocal rank fusion" },
              { t: "p", html: "BM25 scores and cosine similarities live on unrelated scales, so adding them is meaningless without careful normalisation. Reciprocal rank fusion (RRF) sidesteps that by using only each document's <em>rank</em> in each list: every list contributes <code class='tok'>1 / (k + rank)</code>, and the contributions are summed." },
              { t: "code", lang: "text", code:
                "RRF(d) = sum over lists of 1 / (k + rank_in_list(d))      k = 60 here\n\n" +
                "doc   BM25 rank   vector rank   score\n" +
                "A     1           4             1/61 + 1/64 = 0.01639 + 0.01563 = 0.03202\n" +
                "B     3           1             1/63 + 1/61 = 0.01587 + 0.01639 = 0.03227\n" +
                "C     2           -             1/62        = 0.01613\n" +
                "D     -           2             1/62        = 0.01613\n\n" +
                "fused order: B, A, then C and D tied\n" +
                "-> documents both retrievers like rise above single-list winners"
              },
              { t: "widget", id: "ragRrf" },
              { t: "code", lang: "python", code:
                "from collections import defaultdict\n\n" +
                "def rrf(ranked_lists, k: int = 60, top_n: int = 10):\n" +
                "    scores = defaultdict(float)\n" +
                "    for ranking in ranked_lists:            # each is a list of doc ids, best first\n" +
                "        for rank, doc_id in enumerate(ranking, start=1):\n" +
                "            scores[doc_id] += 1.0 / (k + rank)\n" +
                "    return sorted(scores, key=scores.get, reverse=True)[:top_n]\n\n" +
                "fused = rrf([bm25_search(q, 50), vector_search(q, 50)])"
              },
              { t: "note", variant: "tip", html: "<strong>What k does.</strong> Small k makes rank 1 dominate; large k flattens the curve so agreement across lists matters more. A value around 60 is a widely used default; tune it only if your retrieval evals say so." },
              { t: "note", variant: "warn", html: "<strong>Fusion cannot invent recall.</strong> RRF only reorders what the retrievers returned. Retrieve generously from each, often 20 to 50 apiece, then fuse and pass the result to a reranker." },
              { t: "table", headers: ["Tier", "Search setup", "Trade-off"], rows: [
                ["Naive", "Vectors only", "Misses exact identifiers that users type constantly"],
                ["Solid", "BM25 plus vectors, RRF with k around 60, metadata filters applied to both", "Two indexes to keep in sync"],
                ["Standout", "Solid, plus per-query-type evals and a reranker after fusion", "Best recall and precision; more latency to budget"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> users paste error codes, part numbers or names and get \"related\" but wrong results. That is the signature of vector-only retrieval; add keywords and fuse." },
              { t: "note", variant: "key", html: "<strong>Keywords catch the exact, vectors catch the meaning, RRF fuses ranks not scores.</strong> Score each document with the sum of 1 / (k + rank) and let agreement between retrievers win." }
            ]
          },
          {
            id: "reranking",
            title: "Reranking",
            summary: "Retrieve wide with fast models, then let a cross-encoder choose the few chunks that reach the prompt.",
            minutes: 9,
            tags: ["reranking", "cross-encoder", "precision", "two-stage"],
            blocks: [
              { t: "p", html: "First-stage retrieval is a wide net: fast, cheap and coarse. Reranking is the careful second look. A <strong>bi-encoder</strong> embeds query and chunk separately, which is what makes indexing possible. A <strong>cross-encoder</strong> reads the query and a chunk <em>together</em> and outputs a relevance score, which is far more accurate and far too slow to run over a whole corpus." },
              { t: "compare",
                bad: { title: "Bi-encoder (first stage)", items: ["Embeds each side separately", "Chunk vectors precomputed and indexed", "Milliseconds over millions of chunks", "Misses fine-grained relevance"] },
                good: { title: "Cross-encoder (reranker)", items: ["Reads query and chunk jointly", "Nothing precomputable per pair", "Practical only for tens of candidates", "Much sharper relevance judgements"] } },
              { t: "code", lang: "text", code:
                "query\n" +
                "  -> BM25 top 50  +  vector top 50\n" +
                "  -> RRF fuse, dedupe          (~70 unique candidates)\n" +
                "  -> keep top 50\n" +
                "  -> cross-encoder scores 50 (query, chunk) pairs\n" +
                "  -> keep top 5 above a score threshold\n" +
                "  -> prompt"
              },
              { t: "stat", items: [
                { v: "50 → 5", k: "typical retrieve-then-rerank funnel" },
                { v: "50", k: "cross-encoder forward passes per query" },
                { v: "tens–hundreds ms", k: "rough added latency, hardware-dependent" }
              ] },
              { t: "code", lang: "python", code:
                "def retrieve(query: str, top_k: int = 5, pool: int = 50, min_score: float = 0.2):\n" +
                "    candidates = rrf([bm25_search(query, pool), vector_search(query, pool)], top_n=pool)\n" +
                "    pairs = [(query, chunk_text(c)) for c in candidates]\n" +
                "    scores = reranker.score(pairs)            # one relevance score per pair\n" +
                "    ranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)\n" +
                "    return [c for c, s in ranked[:top_k] if s >= min_score]"
              },
              { t: "note", variant: "warn", html: "<strong>A reranker can only reorder what it is given.</strong> If the right chunk is not in the top 50, no reranker saves you. Measure recall@50 for the first stage and precision@5 after reranking as separate numbers." },
              { t: "note", variant: "tip", html: "An LLM can also act as a reranker by scoring or ordering candidates. It understands nuance well but costs far more per query; dedicated cross-encoders are the usual default, with an LLM pass reserved for high-value queries." },
              { t: "table", headers: ["Tier", "Ranking", "Trade-off"], rows: [
                ["Naive", "Top 5 straight from vector search", "Relevant chunk sits at rank 9 and never reaches the model"],
                ["Solid", "Retrieve ~50, cross-encoder rerank to ~5", "Adds latency per query; big precision gain"],
                ["Standout", "Solid, plus a score threshold, so weak results are dropped and \"I don't know\" is possible", "Fewer, better chunks; needs threshold tuning"]
              ] },
              { t: "cue", html: "<strong>Say it out loud:</strong> \"Stage one optimises recall cheaply, stage two optimises precision expensively. I retrieve about 50, rerank with a cross-encoder to about 5, and track recall@50 and precision@5 separately.\"" },
              { t: "note", variant: "key", html: "<strong>Retrieve wide, rerank narrow.</strong> Bi-encoders find candidates fast, cross-encoders pick winners accurately, and a reranker can never fix a first stage that missed." }
            ]
          },
          {
            "id": "rag-evals",
            "title": "Evaluating RAG: recall@k, MRR and faithfulness",
            "summary": "Measure retrieval and generation separately, with a small labelled set and a handful of metrics you can compute by hand.",
            "minutes": 12,
            "tags": [
              "rag-evaluation",
              "recall-at-k",
              "mrr",
              "faithfulness",
              "golden-set"
            ],
            "blocks": [
              {
                "t": "p",
                "html": "When a RAG answer is wrong, there are two very different causes: the right passage never reached the model, or it did and the model misused it. Evaluate the two halves <strong>separately</strong>, or every fix becomes a guess."
              },
              {
                "t": "h",
                "text": "The evaluation set"
              },
              {
                "t": "p",
                "html": "Start with 50–200 real questions. For each, record the ids of the chunks that contain the answer (the <em>relevant set</em>) and a reference answer. Include questions the corpus cannot answer, so you can test abstaining. Label once, rerun on every change to chunking, embeddings, top-k or prompts."
              },
              {
                "t": "code",
                "lang": "json",
                "code": "{ \"q\": \"How many days of leave carry over?\",\n  \"relevant\": [\"hr-leave#3\"],\n  \"reference\": \"Up to 5 days carry over into the next year.\" }\n{ \"q\": \"What is the CEO's home address?\",\n  \"relevant\": [],\n  \"reference\": \"ABSTAIN\" }"
              },
              {
                "t": "h",
                "text": "Retrieval metrics"
              },
              {
                "t": "table",
                "headers": [
                  "Metric",
                  "Definition",
                  "Question it answers"
                ],
                "rows": [
                  [
                    "Recall@k",
                    "Share of questions with at least one relevant chunk in the top k (or share of relevant chunks found)",
                    "Did the evidence make it into the context at all?"
                  ],
                  [
                    "Precision@k",
                    "Share of the top k that is relevant",
                    "How much noise am I paying for?"
                  ],
                  [
                    "MRR",
                    "Mean of 1 / rank of the first relevant chunk",
                    "Is the evidence near the top, where models use it best?"
                  ],
                  [
                    "nDCG@k",
                    "Rank-discounted gain, normalised against the ideal order; handles graded relevance",
                    "Is the whole ranking good, not just the first hit?"
                  ]
                ]
              },
              {
                "t": "code",
                "lang": "text",
                "code": "3 questions, top-5 retrieved, first relevant hit at rank:\n  q1 -> rank 1      q2 -> rank 3      q3 -> not in top 5\n\nrecall@5 = 2 / 3                  = 0.67\nMRR      = (1/1 + 1/3 + 0) / 3    = 0.44\nrecall@1 = 1 / 3                  = 0.33   <- a reranker should lift this"
              },
              {
                "t": "h",
                "text": "Generation metrics"
              },
              {
                "t": "table",
                "headers": [
                  "Metric",
                  "Checks",
                  "How to score"
                ],
                "rows": [
                  [
                    "Faithfulness (groundedness)",
                    "Every claim in the answer is supported by the retrieved passages",
                    "Split the answer into claims; an LLM judge or entailment model marks each supported or not"
                  ],
                  [
                    "Answer relevance",
                    "The answer addresses the question that was asked",
                    "Judge with a rubric, or compare with the reference"
                  ],
                  [
                    "Correctness",
                    "Matches the reference answer",
                    "Exact match for short facts; rubric judge for prose"
                  ],
                  [
                    "Citation accuracy",
                    "Each cited id exists and supports its sentence",
                    "Deterministic id check plus a judge for support"
                  ],
                  [
                    "Abstention",
                    "Says 'I don't know' when nothing relevant was retrieved",
                    "Rate on the unanswerable questions"
                  ]
                ]
              },
              {
                "t": "compare",
                "bad": {
                  "title": "Diagnosis by vibes",
                  "items": [
                    "Read five answers, tweak the prompt, ship",
                    "One blended 'quality score'",
                    "Change chunk size and top-k and the model in the same run"
                  ]
                },
                "good": {
                  "title": "Diagnosis by stage",
                  "items": [
                    "Low recall@k → chunking, embeddings, hybrid search, query rewriting",
                    "Good recall, low recall@1 or MRR → add or tune a reranker",
                    "Good retrieval, low faithfulness → prompt, context ordering, model, or citation checks",
                    "One change per run, metrics stored with the config"
                  ]
                }
              },
              {
                "t": "note",
                "variant": "warn",
                "html": "LLM judges drift and have biases. Calibrate any judge against a few dozen human labels first, keep the judge model and prompt pinned, and treat small metric moves as noise until they repeat. The general method is in <a class='inline' href='#/ops/evals/llm-judge'>LLM-as-judge</a>."
              },
              {
                "t": "note",
                "variant": "tip",
                "html": "Tune top-k and reranking interactively in the RAG pane of the <a class='inline' href='#/playground'>LLM playground</a>. <strong>Go deeper:</strong> the Blueprint atlas discusses failure modes at scale in <em>HLD › AI &amp; ML › Production RAG failure modes and LLMOps</em>. <strong>Say it out loud:</strong> 'I measure retrieval with recall@k and MRR against labelled chunk ids, and generation with faithfulness and abstention. That tells me whether to fix the retriever or the prompt.'"
              },
              {
                "t": "note",
                "variant": "key",
                "html": "<strong>Two halves, two scorecards.</strong> Recall@k and MRR say whether the evidence arrived and how high; faithfulness, citation accuracy and abstention say whether the model used it honestly."
              }
            ]
          },
          {
            id: "grounding",
            title: "Grounding and citations",
            summary: "Make answers come from the retrieved context, cite chunk ids, verify the citations and allow \"I don't know\".",
            minutes: 10,
            tags: ["grounding", "citations", "faithfulness", "hallucination"],
            blocks: [
              { t: "p", html: "Retrieving the right chunks is half the job; the model still has to <em>use</em> them and only them. Grounding is the contract: answer only from the provided context, cite where each claim came from, and say \"I don't know\" when the context is silent. Citations turn a trust-me answer into a check-me answer." },
              { t: "code", lang: "text", code:
                "SYSTEM\n" +
                "You answer questions about company policy.\n" +
                "Rules:\n" +
                "1. Use only the content inside <sources>. Do not use outside knowledge.\n" +
                "2. After every factual sentence, cite the supporting source ids, e.g. [c12] or [c12][c40].\n" +
                "3. If the sources do not answer the question, reply exactly:\n" +
                "   \"I don't have that information in the provided documents.\"\n" +
                "4. If sources conflict, say so and cite both.\n\n" +
                "<sources>\n" +
                "<source id=\"c12\" doc=\"travel-policy\" section=\"Flights\">...</source>\n" +
                "<source id=\"c40\" doc=\"travel-policy\" section=\"Approvals\">...</source>\n" +
                "</sources>"
              },
              { t: "code", lang: "python", code:
                "import re\n\n" +
                "CITE = re.compile(r\"\\[(c\\d+)\\]\")\n\n" +
                "def check_citations(answer: str, retrieved_ids: set) -> dict:\n" +
                "    cited = set(CITE.findall(answer))\n" +
                "    unknown = cited - retrieved_ids              # invented or stale ids\n" +
                "    sentences = [s for s in re.split(r\"(?<=[.!?])\\s+\", answer) if s.strip()]\n" +
                "    uncited = [s for s in sentences if not CITE.search(s)]\n" +
                "    return {\"ok\": not unknown, \"unknown_ids\": sorted(unknown), \"uncited\": uncited}"
              },
              { t: "table", headers: ["Failure", "What it looks like", "Mitigation"], rows: [
                ["Unsupported claim", "Fluent sentence with no basis in the sources", "Faithfulness eval; require a citation per sentence"],
                ["Fabricated citation", "Cites [c99], which was never retrieved", "Validate ids against the retrieved set"],
                ["Wrong citation", "Real id, but the chunk says something else", "Judge-model check that the chunk supports the sentence"],
                ["Blending", "Merges two documents into a claim neither makes", "Ask for per-source statements and conflict flags"],
                ["Over-refusal", "Says \"I don't know\" when the answer is there", "Fix retrieval recall first, then soften the refusal rule"]
              ] },
              { t: "note", variant: "warn", html: "<strong>Citations can be hallucinated too.</strong> A bracketed id looks authoritative whether or not it is real. Checking ids against the retrieved set is cheap and catches the worst cases; checking support needs an evaluator." },
              { t: "h", text: "Measuring grounding" },
              { t: "table", headers: ["Metric", "Question it answers"], rows: [
                ["Context recall", "Did retrieval bring back the chunks needed to answer?"],
                ["Context precision", "How much of what we retrieved was actually relevant?"],
                ["Faithfulness", "Is every claim in the answer supported by the retrieved context?"],
                ["Citation precision", "Does each cited chunk actually support its sentence?"],
                ["Answer relevance", "Does the answer address the question that was asked?"]
              ] },
              { t: "p", html: "Most of these need a judge with a rubric; see <a class='inline' href='#/ops/evals/llm-judge'>LLM-as-judge</a> for how to build one you can trust." },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> The Blueprint atlas catalogues how RAG systems fail in production and how teams monitor them in <em>HLD › AI &amp; ML › Production RAG failure modes and LLMOps</em>." },
              { t: "table", headers: ["Tier", "Grounding", "Trade-off"], rows: [
                ["Naive", "\"Use the context below\" and hope", "Silent mixing of context and memory; no traceability"],
                ["Solid", "Answer-only-from-context rule, chunk-id citations, explicit \"I don't know\" path, id validation", "Some over-refusal to tune"],
                ["Standout", "Solid, plus faithfulness and citation-precision evals, and UI that links each citation to its source", "Evaluator cost; users can verify every claim"]
              ] },
              { t: "quiz", id: "rag-quality" },
              { t: "note", variant: "key", html: "<strong>Answer only from context, cite chunk ids, verify the ids, allow \"I don't know\".</strong> Grounding makes answers checkable; evals make sure the checks pass." }
            ]
          }
        ]
      },
      {
        id: "context",
        name: "Context Engineering",
        icon: "grid",
        lessons: [
          {
            id: "context-engineering",
            title: "Managing the context window",
            summary: "Treat the context window as a budget: decide what goes in, in which order, and what gets compressed or dropped.",
            minutes: 10,
            tags: ["context-engineering", "context-window", "lost-in-the-middle", "budget"],
            blocks: [
              { t: "p", html: "The context window is a desk of fixed size. Instructions, retrieved evidence, conversation history, tool results and the answer itself all compete for space on it. Context engineering is deciding what earns a place, where it sits, and what gets summarised or thrown away. More is not better; relevant is better." },
              { t: "stat", items: [
                { v: "input + output", k: "usually share one window" },
                { v: "edges > middle", k: "where long contexts are used most reliably" },
                { v: "every token", k: "costs money and time to first token" }
              ] },
              { t: "h", text: "Ordering and lost in the middle" },
              { t: "p", html: "Studies of long-context models have repeatedly found that information at the start and end of a long prompt is used more reliably than information buried in the middle. The practical response is to send fewer, better chunks and to place what matters most at the edges." },
              { t: "ul", items: [
                "Put stable instructions first, and restate the key output rule near the end for long prompts.",
                "Order evidence by reranker score, strongest first; if you send many chunks, put the second-strongest last.",
                "Group chunks from the same document together, in document order, so the model sees coherent passages.",
                "Put the user's question after the evidence, so the model reads the material with the question fresh."
              ] },
              { t: "widget", id: "ragBudget" },
              { t: "table", headers: ["Technique", "What it does", "Cost"], rows: [
                ["Dedupe", "Drop near-identical chunks from overlap or copied docs", "Cheap similarity check"],
                ["History summarisation", "Replace old turns with a running summary", "One extra call every few turns; some detail lost"],
                ["Metadata filters", "Restrict retrieval by product, date or tenant before ranking", "Requires clean metadata"],
                ["Contextual compression", "Extract only the relevant sentences from each chunk", "Extra model call; risk of dropping nuance"],
                ["Tool-result trimming", "Keep the fields the task needs, not whole payloads", "Per-tool shaping code"]
              ] },
              { t: "code", lang: "text", code:
                "window            32,000 tokens\n" +
                "- output reserve  -1,024\n" +
                "- instructions      -800\n" +
                "- history         -2,000  (summary + last 3 turns)\n" +
                "= evidence budget 28,176\n\n" +
                "at 512 tokens per chunk, up to ~55 chunks would fit,\n" +
                "but 5-8 reranked chunks (2.5k-4k tokens) usually answer better,\n" +
                "cost far less and keep time to first token low."
              },
              { t: "note", variant: "trap", html: "<strong>Filling the window is not a strategy.</strong> Extra marginal chunks add cost, add latency and dilute attention across irrelevant text. A tight, well-ordered context usually beats a stuffed one. The mechanics of why long prompts are slow are in <a class='inline' href='#/core/generation/context-kv'>context windows and the KV cache</a>." },
              { t: "table", headers: ["Tier", "Context policy", "Trade-off"], rows: [
                ["Naive", "Append everything: all chunks, full history, raw tool output", "Truncated answers, high cost, lost-in-the-middle misses"],
                ["Solid", "Explicit budget per section, dedupe, reranked top few, best at the edges, output reserve", "Needs a token counter in the request path"],
                ["Standout", "Solid, plus history summaries, compression for long chunks and per-section budgets tuned on evals", "More moving parts; lowest cost per correct answer"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> answers get cut off, costs creep up as chats get longer, or the model ignores a fact you can see in the prompt. Audit the budget and the ordering before changing models." },
              { t: "note", variant: "key", html: "<strong>The context window is a budget, not a bucket.</strong> Reserve output space, dedupe and summarise, send fewer, better chunks, and put the strongest evidence at the edges." }
            ]
          },
          {
            "id": "advanced-retrieval",
            "title": "Query rewriting, HyDE and contextual chunks",
            "summary": "Patterns that fix the retrieval failures basic RAG cannot: vague queries, orphaned chunks, multi-hop questions and metadata.",
            "minutes": 11,
            "tags": [
              "query-rewriting",
              "hyde",
              "contextual-retrieval",
              "parent-child",
              "multi-hop"
            ],
            "blocks": [
              {
                "t": "p",
                "html": "Basic RAG embeds the user's question as typed and searches chunks as they were cut. Both sides of that match can be improved. Reach for these patterns <em>after</em> your evaluation set shows which failure you actually have (see <a class='inline' href='#/rag/quality/rag-evals'>evaluating RAG</a>)."
              },
              {
                "t": "h",
                "text": "Fixing the query side"
              },
              {
                "t": "table",
                "headers": [
                  "Pattern",
                  "How it works",
                  "Fixes",
                  "Cost"
                ],
                "rows": [
                  [
                    "Conversational rewrite",
                    "An LLM turns 'and for contractors?' into a standalone question using the chat history",
                    "Follow-ups that make no sense on their own",
                    "One small model call"
                  ],
                  [
                    "Multi-query",
                    "Generate 3–5 paraphrases, retrieve for each, merge with reciprocal rank fusion",
                    "Vocabulary mismatch between users and documents",
                    "More searches"
                  ],
                  [
                    "HyDE",
                    "Ask a model to write a hypothetical answer, embed that, and search with it",
                    "Short questions whose embedding looks nothing like the answer passage",
                    "One generation; the fake answer must never be shown as fact"
                  ],
                  [
                    "Decomposition",
                    "Split 'compare plan A and plan B' into one query per entity",
                    "Multi-hop and comparison questions",
                    "Several retrievals plus a merge"
                  ],
                  [
                    "Metadata filters",
                    "Extract structured filters (team, year, product) and apply them before vector search",
                    "Correct topic, wrong version or region",
                    "Needs clean metadata at ingestion"
                  ]
                ]
              },
              {
                "t": "code",
                "lang": "text",
                "code": "user:     \"what's the refund window?\"\nHyDE doc: \"Customers may request a refund within 30 days of purchase\n           provided the item is unused ...\"      <- invented, never shown\nsearch:   embed(HyDE doc)  -> nearest real chunks: policy/refunds#2, #3\nanswer:   generated ONLY from the real chunks, with citations"
              },
              {
                "t": "h",
                "text": "Fixing the document side"
              },
              {
                "t": "table",
                "headers": [
                  "Pattern",
                  "How it works",
                  "Fixes"
                ],
                "rows": [
                  [
                    "Contextual chunks",
                    "Before embedding, prepend a one- or two-sentence summary of where the chunk sits ('From the 2025 travel policy, section on per-diem rates: ...')",
                    "Chunks that lose their meaning out of context, like 'This limit doubles for managers.'"
                  ],
                  [
                    "Parent-child (small-to-big)",
                    "Search over small chunks for precision, then pass their larger parent section to the model",
                    "Precise matches that lack surrounding detail"
                  ],
                  [
                    "Summaries and questions as keys",
                    "Index generated summaries or 'questions this chunk answers' that point back to the chunk",
                    "Users asking at a different level of detail than the text"
                  ],
                  [
                    "Structure-aware parsing",
                    "Keep tables, headings and code blocks intact; carry headings into every chunk",
                    "Tables split mid-row, steps separated from their titles"
                  ]
                ]
              },
              {
                "t": "h",
                "text": "Agentic retrieval"
              },
              {
                "t": "p",
                "html": "For open-ended research questions, give the model a search tool and let it decide what to look up next, read, and search again. This handles multi-hop questions well, at the price of more calls, more latency and harder evaluation. Bound the number of searches and log every query — the loop itself is covered in <a class='inline' href='#/agent/loop/react'>the ReAct loop</a>."
              },
              {
                "t": "note",
                "variant": "trap",
                "html": "Every added stage is another place to fail and another model call to pay for. Teams often stack query rewriting, HyDE, multi-query and a reranker, then cannot tell which one helped. Add one pattern at a time and keep it only if recall@k or faithfulness moves on your set."
              },
              {
                "t": "note",
                "variant": "tip",
                "html": "<strong>Go deeper.</strong> The Synapse atlas walks through a full retrieval-augmented assistant over a document corpus as an ML system-design breakdown. <strong>Say it out loud:</strong> 'I rewrite follow-ups into standalone queries, use contextual chunks so passages keep their meaning, search small and return big, and only add HyDE or multi-query when evals show a vocabulary gap.'"
              },
              {
                "t": "note",
                "variant": "key",
                "html": "<strong>Improve both sides of the match.</strong> Rewrite, expand or decompose the query; enrich, structure or parent-link the chunks — one change at a time, kept only when the retrieval metrics move."
              }
            ]
          },
          {
            id: "long-context-vs-rag",
            title: "Long context vs RAG",
            summary: "When a big context window replaces retrieval, when it does not, and how the two combine.",
            minutes: 10,
            tags: ["long-context", "rag", "cost", "latency", "trade-offs"],
            blocks: [
              { t: "p", html: "Context windows have grown from a few thousand tokens to hundreds of thousands or more, which raises a fair question: why build a retrieval pipeline when you can paste the whole document? Sometimes you should not. The answer depends on corpus size, freshness, permissions and the price you pay per question." },
              { t: "table", headers: ["Dimension", "Long context (stuff it all)", "RAG (retrieve a few chunks)"], rows: [
                ["Cost per question", "Pays for every token, every time, unless cached", "Pays for a few thousand tokens"],
                ["Latency", "Time to first token grows with input length", "Retrieval adds tens of ms; small prompt is fast"],
                ["Freshness", "Re-send the new version; simple", "Re-index changed docs; also simple"],
                ["Corpus size", "Bounded by the window", "Effectively unbounded"],
                ["Recall", "Sees everything, but may miss facts in the middle", "Only as good as retrieval"],
                ["Permissions", "Must assemble a per-user document set anyway", "Filter at retrieval time per user"],
                ["Citations", "Possible, but coarse", "Natural, at chunk level"],
                ["Build effort", "Minimal", "Chunking, indexing, evals"]
              ] },
              { t: "code", lang: "text", code:
                "long context:  200,000 input tokens per question\n" +
                "RAG:             5,000 input tokens per question\n" +
                "ratio:              40x more input tokens with long context\n\n" +
                "at 10,000 questions/day:\n" +
                "  long context  -> 2,000,000,000 input tokens/day\n" +
                "  RAG           ->    50,000,000 input tokens/day\n\n" +
                "prompt caching can discount a repeated prefix substantially,\n" +
                "but only when the same document is reused across calls."
              },
              { t: "stat", items: [
                { v: "40×", k: "input tokens: 200k context vs 5k RAG prompt" },
                { v: "1 doc", k: "where long context shines" },
                { v: "millions", k: "of docs: retrieval is mandatory" }
              ] },
              { t: "h2", text: "Long context wins when" },
              { t: "ul", items: [
                "The material is one bounded document or a small set: a contract, a codebase module, a meeting transcript.",
                "Many questions hit the same material in one session, so prompt caching amortises the cost.",
                "The task needs whole-document reasoning, such as \"find every inconsistency\", where chunking would hide relationships.",
                "You are prototyping and want to learn what users ask before building retrieval."
              ] },
              { t: "h2", text: "RAG wins when" },
              { t: "ul", items: [
                "The corpus is larger than any window, or grows continuously.",
                "Different users may see different documents.",
                "Cost or latency per question matters at volume.",
                "You need precise, chunk-level citations."
              ] },
              { t: "p", html: "The two combine well: retrieve generously, then let a larger window hold more context than older models could, such as whole sections instead of fragments. Repeated prefixes like instructions and shared documents are prime candidates for caching; see <a class='inline' href='#/ops/evals/cost-control'>caching and cost control</a>. The capstone puts both into one assistant in <a class='inline' href='#/cap/build/prompt-rag'>the system prompt and retrieval</a>." },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> The Synapse atlas walks through an end-to-end case study in <em>ML case studies › A retrieval-augmented assistant over a document corpus</em>, including how to frame metrics and offline evaluation at system-design depth." },
              { t: "table", headers: ["Tier", "Decision", "Trade-off"], rows: [
                ["Naive", "\"Windows are huge now, RAG is dead\" or \"always RAG\"", "Overpays at volume, or over-engineers a one-document tool"],
                ["Solid", "Choose by corpus size, permissions, volume and citation needs", "A defensible default per use case"],
                ["Standout", "Hybrid: retrieval for selection, a large window for coherent sections, caching for shared prefixes, all measured on cost per correct answer", "Best economics; more design work"]
              ] },
              { t: "quiz", id: "rag-context" },
              { t: "note", variant: "key", html: "<strong>Long context is simple and expensive per question; RAG is cheaper per question and has to be built.</strong> Choose by corpus size, permissions, volume and citations, and combine them when you can." }
            ]
          }
        ]
      }
    ]
  };
})();
