/* CODEX · SQL and concurrency interactive labs */
(function () {
  "use strict";
  const Widgets = window.Widgets || {};
  const e = (tag, attrs, ...children) => {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach((key) => {
      if (key === "class") node.className = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    children.flat().forEach((child) => {
      if (child == null) return;
      node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  };
  const button = (label, click) => {
    const b = e("button", { class: "w-btn ghost", type: "button" }, label);
    b.addEventListener("click", click);
    return b;
  };
  const shell = (mount, pill, title, desc) => {
    mount.classList.add("widget");
    mount.append(e("div", { class: "widget-head" }, e("span", { class: "w-pill" }, pill), e("h3", {}, title)));
    mount.append(e("p", { class: "widget-desc" }, desc));
  };

  Widgets.sqlwindow = function (mount) {
    shell(mount, "SQL lab", "Window Frame Visualizer", "Move the current row and compare a running ROWS frame with a three-row moving frame.");
    const rows = [
      ["09:00", 12], ["09:05", 8], ["09:05", 15], ["09:12", 5], ["09:20", 10]
    ];
    let current = 0;
    const table = e("div", { class: "round-table" });
    const readout = e("div", { class: "w-readout" });
    const select = e("select", { "aria-label": "Window frame" },
      e("option", { value: "running" }, "ROWS unbounded preceding"),
      e("option", { value: "moving" }, "ROWS 2 preceding"));
    function render() {
      const start = select.value === "moving" ? Math.max(0, current - 2) : 0;
      table.replaceChildren();
      table.append(e("div", { class: "round-tr head" }, "row", "time", "amount", "in frame"));
      rows.forEach((row, i) => {
        const inFrame = i >= start && i <= current;
        table.append(e("div", { class: "round-tr" + (i === current ? " current" : "") + (inFrame ? " framed" : "") },
          String(i + 1), row[0], String(row[1]), inFrame ? "✓" : "—"));
      });
      const total = rows.slice(start, current + 1).reduce((sum, row) => sum + row[1], 0);
      readout.replaceChildren(e("span", { class: "ro" }, "frame rows " + (start + 1) + "–" + (current + 1)),
        e("span", { class: "ro" }, "SUM(amount) = " + total));
    }
    select.addEventListener("change", render);
    mount.append(e("div", { class: "widget-controls" }, select,
      button("Previous row", () => { current = Math.max(0, current - 1); render(); }),
      button("Next row", () => { current = Math.min(rows.length - 1, current + 1); render(); })));
    mount.append(e("div", { class: "w-stage" }, table), readout);
    render();
  };

  Widgets.concurrencyqueue = function (mount) {
    shell(mount, "Concurrency lab", "Bounded Queue Timeline", "Step producers and a consumer against a capacity-three queue. Full producers block until a take changes the predicate.");
    const actions = [["P1", "put A"], ["P2", "put B"], ["P1", "put C"], ["P2", "put D"], ["C1", "take"], ["P2", "retry D"], ["C1", "take"]];
    let step = 0, queue = [], blocked = [];
    const lanes = e("div", { class: "round-lanes" });
    const queueEl = e("div", { class: "round-queue" });
    const status = e("div", { class: "w-readout" });
    function reset() { step = 0; queue = []; blocked = []; render(); }
    function next() {
      if (step >= actions.length) return;
      const [actor, action] = actions[step++];
      if (action.startsWith("put")) {
        const value = action.slice(-1);
        if (queue.length === 3) blocked.push(actor + " waits to put " + value);
        else queue.push(value);
      } else if (action === "take") queue.shift();
      else if (action.startsWith("retry") && queue.length < 3) {
        queue.push(action.slice(-1)); blocked = blocked.filter((x) => !x.startsWith(actor));
      }
      render(actor + " · " + action);
    }
    function render(last) {
      queueEl.replaceChildren(...[0, 1, 2].map((i) => e("div", { class: "round-slot" + (queue[i] ? " filled" : "") }, queue[i] || "empty")));
      lanes.replaceChildren(...actions.map((a, i) =>
        e("div", { class: "round-action" + (i === step - 1 ? " active" : "") + (i < step - 1 ? " done" : "") },
          (i + 1) + ". " + a[0] + " — " + a[1])));
      status.replaceChildren(e("span", { class: "ro" }, last || "ready"),
        e("span", { class: "ro" }, blocked.length ? blocked.join("; ") : "no blocked callers"));
    }
    mount.append(e("div", { class: "widget-controls" }, button("Step", next), button("Reset", reset)));
    mount.append(e("div", { class: "w-stage round-queue-stage" }, e("div", {}, e("strong", {}, "Schedule"), lanes),
      e("div", {}, e("strong", {}, "Queue · capacity 3"), queueEl)), status);
    render();
  };

  Widgets.concurrencytimeline = function (mount) {
    shell(mount, "Concurrency lab", "Deadlock Timeline", "Compare inconsistent lock acquisition with one global order. The same two transfers either cycle or complete.");
    let ordered = false;
    const stage = e("div", { class: "round-deadlock" });
    const readout = e("div", { class: "w-readout" });
    function render() {
      const events = ordered
        ? [["T1", "lock A", "ok"], ["T2", "wait A", "wait"], ["T1", "lock B → transfer → release", "ok"], ["T2", "lock A, lock B → transfer", "ok"]]
        : [["T1", "lock A", "ok"], ["T2", "lock B", "ok"], ["T1", "wait B", "wait"], ["T2", "wait A", "wait"]];
      stage.replaceChildren(...events.map((x) =>
        e("div", { class: "round-event " + x[2] }, e("b", {}, x[0]), e("span", {}, x[1]))));
      readout.replaceChildren(e("span", { class: "ro" },
        ordered ? "A before B everywhere → circular wait is impossible" : "T1 holds A, T2 holds B, each waits for the other → deadlock"));
    }
    const toggle = button("Use global lock order", () => {
      ordered = !ordered;
      toggle.textContent = ordered ? "Show naive order" : "Use global lock order";
      render();
    });
    mount.append(e("div", { class: "widget-controls" }, toggle), e("div", { class: "w-stage" }, stage), readout);
    render();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);
})();
