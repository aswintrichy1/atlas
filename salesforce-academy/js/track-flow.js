/* =====================================================================
   ORBIT · Declarative Automation
   window.TRACKS.flow — modules: flows / engine / choose
   Self-contained: registers its own widgets, quizzes and track data.
   ===================================================================== */
(function () {
  "use strict";

  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
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
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
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
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }
  function checkbox(label, checked, onChange) {
    var input = h("input", { type: "checkbox" });
    input.checked = !!checked;
    input.addEventListener("change", function () { onChange(input.checked); });
    return h("label", { class: "w-field" }, input, label);
  }

  var Widgets = {};

  /* obOrderStepper — walk one save through the simplified order of execution */
  Widgets.obOrderStepper = function (mount) {
    shell(mount, "simulator", "Save order stepper",
      "Tick what is configured on the object, then step through a single save. Steps with nothing configured are skipped; the readout says what can still change the record at that point.");

    var cfg = { beforeFlow: true, beforeTrigger: true, validation: true, duplicate: false, afterTrigger: true, assignment: false, afterFlow: true, rollup: false, async: false };
    var STEPS = [
      { key: null, name: "System validation",
        what: "The platform loads the record, applies the incoming values and runs its own checks: field formats and lengths, valid lookups, and layout-required fields for saves from the UI.",
        can: "Nothing you built has run yet. The values are exactly what the user or the API sent." },
      { key: "beforeFlow", name: "Before-save record-triggered flows",
        what: "Flows optimised for fast field updates run and assign values straight onto $Record.",
        can: "Fields on the triggering record can be set with no DML and no extra save. Other records cannot be touched here." },
      { key: "beforeTrigger", name: "Apex before triggers",
        what: "before insert / before update logic runs on Trigger.new, in chunks of up to 200 records.",
        can: "Assign to Trigger.new directly, no DML needed. A before trigger runs after before-save flows, so if both set one field, the trigger's value is the one saved." },
      { key: "validation", name: "System re-checks + custom validation rules",
        what: "Required-field and format checks run again, then your validation rules evaluate the record exactly as flows and triggers left it.",
        can: "Nothing changes the record. A failing rule stops the save and rolls back the whole transaction with the rule's message." },
      { key: "duplicate", name: "Duplicate rules",
        what: "Matching rules compare the record with existing ones. A blocking rule stops the save; an alerting rule lets it through with a warning.",
        can: "Nothing changes the record; the only outcomes are block, warn or allow." },
      { key: null, name: "Saved to the database, not committed",
        what: "The row is written inside the open transaction. Inserts now have an Id and system fields such as CreatedDate, but nothing is permanent yet.",
        can: "From here on, changing this record again takes a DML update, and that update runs the save order again." },
      { key: "afterTrigger", name: "Apex after triggers",
        what: "after insert / after update logic runs. Trigger.new is read-only now, and Trigger.newMap has Ids for inserted rows.",
        can: "Other records change only through DML, which counts against 150 statements. Changing this same record means another update and a re-entry into the save order." },
      { key: "assignment", name: "Assignment, auto-response and escalation rules",
        what: "Lead and Case assignment rules may set a new owner; auto-response and escalation rules evaluate.",
        can: "The platform, not your code, may change the owner here, and every later step sees the new owner." },
      { key: "afterFlow", name: "After-save record-triggered flows",
        what: "Flows set to run for actions and related records execute their immediate paths.",
        can: "Related records change through Create or Update Records elements (DML). Updating the triggering record from here starts another save, so guard it with entry conditions." },
      { key: "rollup", name: "Entitlements, roll-ups and parent updates",
        what: "Entitlement rules run and roll-up summary fields recalculate. The parent goes through its own save, so the parent's triggers and flows run inside this transaction.",
        can: "Parent automation can change the parent and, through DML, even this record again. This is the recursion path nobody sees in the child's code." },
      { key: null, name: "Commit",
        what: "Every DML operation in the transaction becomes permanent at once. Any unhandled exception before this point rolls all of it back.",
        can: "Nothing in this transaction can change the record any more." },
      { key: "async", name: "Post-commit: email, async jobs, outbound messages",
        what: "Emails send, queued Queueable and future jobs are released, outbound messages go out, and platform events set to publish after commit are delivered.",
        can: "Only new transactions (async jobs, event subscribers) can change the record now, each with its own fresh limits." }
    ];
    var LABELS = [
      ["beforeFlow", "Before-save flow"], ["beforeTrigger", "Before trigger"], ["validation", "Validation rule"],
      ["duplicate", "Duplicate rule"], ["afterTrigger", "After trigger"], ["assignment", "Assignment rule"],
      ["afterFlow", "After-save flow"], ["rollup", "Roll-up summary to parent"], ["async", "Async / post-commit action"]
    ];
    var cur = 0, last = "none yet";

    var controls = h("div", { class: "widget-controls" });
    var boxes = h("div", { class: "ob-row" });
    for (var i = 0; i < LABELS.length; i++) {
      (function (pair) {
        boxes.appendChild(checkbox(pair[1], cfg[pair[0]], function (on) {
          cfg[pair[0]] = on;
          last = (on ? "configured " : "removed ") + pair[1].toLowerCase();
          paint();
        }));
      })(LABELS[i]);
    }
    var prevBtn = h("button", { type: "button", class: "w-btn ghost" }, "Prev");
    var nextBtn = h("button", { type: "button", class: "w-btn primary" }, "Next");
    var resetBtn = h("button", { type: "button", class: "w-btn ghost" }, "Reset");
    prevBtn.addEventListener("click", function () { cur = (cur - 1 + STEPS.length) % STEPS.length; last = "Prev to step " + (cur + 1); paint(); });
    nextBtn.addEventListener("click", function () { cur = (cur + 1) % STEPS.length; last = "Next to step " + (cur + 1); paint(); });
    resetBtn.addEventListener("click", function () { cur = 0; last = "Reset to step 1"; paint(); });
    controls.appendChild(boxes);
    controls.appendChild(h("div", { class: "ob-row" }, prevBtn, nextBtn, resetBtn));

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function runs(step) { return step.key === null || !!cfg[step.key]; }

    function paint() {
      clear(stage);
      var list = h("ol", { class: "ob-steps" });
      var configured = 0;
      for (var s = 0; s < STEPS.length; s++) {
        var st = STEPS[s];
        var on = runs(st);
        if (st.key && on) configured++;
        var cls = "ob-step";
        if (!on) cls += " is-skip";
        else if (s < cur) cls += " is-done";
        if (s === cur) cls += " is-active";
        var suffix = st.key === null ? " (always)" : (on ? "" : " (not configured, skipped)");
        list.appendChild(h("li", { class: cls }, h("span", { class: "ob-num" }, String(s + 1)), h("span", {}, st.name + suffix)));
      }
      stage.appendChild(list);
      var step = STEPS[cur];
      var on2 = runs(step);
      stage.appendChild(h("p", { class: "ob-dim", style: "margin:10px 0 0" },
        on2 ? step.what : "Nothing of this kind is configured on the object, so the platform moves straight on to the next step."));

      clear(readout);
      readout.appendChild(ro("step", (cur + 1) + " of " + STEPS.length));
      readout.appendChild(ro("now", step.name));
      readout.appendChild(ro("status", on2 ? "runs" : "skipped"));
      readout.appendChild(ro("can still change the record", on2 ? step.can : "n/a at this step"));
      readout.appendChild(ro("automation configured", configured + " of " + LABELS.length + " kinds"));
      readout.appendChild(ro("last action", last));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* obFlowVsApex — decision tree aligned with the house automation-selection matrix */
  Widgets.obFlowVsApex = function (mount) {
    shell(mount, "decision", "Flow or Apex?",
      "Answer the questions in priority order. The tree checks the object's existing automation first, then the shape of the work, then who maintains it, and explains each step.");

    var st = { trigger: "no", change: "same", logic: "simple", volume: "normal", owner: "admin", reuse: "no", timing: "now" };
    var REC = {
      before: { name: "Before-save record-triggered flow", avoid: "An after-save flow or after trigger that updates the same record, which pays for a second save." },
      after: { name: "After-save record-triggered flow", avoid: "Get Records or Update Records inside a loop; collect into a collection and write once." },
      apex: { name: "Apex trigger: handler + service", avoid: "A parallel record-triggered flow on the same object and event." },
      hybrid: { name: "Hybrid: flow + @InvocableMethod", avoid: "Throwing from the invocable; return result objects the flow can branch on." },
      sched: { name: "Scheduled path on a record-triggered flow", avoid: "A nightly job that scans every record to find the few that are due." },
      async: { name: "Async Apex (Queueable or Batch, scheduled if needed)", avoid: "@future for new work; prefer Queueable, and Batch for large volumes." }
    };

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function decide() {
      var chain = [], rec;
      if (st.trigger === "yes") {
        chain.push("The object already has an Apex trigger. One automation owner per object per event: extend the existing handler and service instead of adding a parallel flow.");
        rec = "apex";
        if (st.logic === "complex" || st.timing === "later" || st.volume === "high") chain.push("Callouts and heavy or deferred work cannot run inside the save, so the service enqueues a Queueable with fresh limits.");
        if (st.reuse === "yes") chain.push("Expose the same service method through an @InvocableMethod so flows reuse the rule rather than copying it.");
      } else if (st.timing === "later") {
        chain.push("No trigger on the object, and the work does not have to happen inside the save.");
        if (st.logic === "complex" || st.volume === "high") {
          rec = "async";
          chain.push("Deferred work that is heavy or calls out belongs in async Apex: Queueable for one unit of work, Batch for large volumes, a Schedulable to put it on a timetable.");
        } else {
          rec = "sched";
          chain.push("Simple deferred work, such as a reminder N days after a date field, fits a scheduled path. Admins can see and change it.");
        }
      } else if (st.logic === "complex") {
        chain.push("No trigger yet, but callouts, maps and multi-object collections are where Flow gets slow and hard to read. That logic belongs in Apex.");
        if (st.owner === "admin" || st.reuse === "yes") {
          rec = "hybrid";
          chain.push("Keep the orchestration (entry conditions, ordering) in Flow where admins can see it, and make the heavy step an @InvocableMethod that delegates to a service.");
          chain.push("If the step calls out, put the action on the flow's asynchronous path: callouts cannot run before the save commits.");
        } else {
          rec = "apex";
          chain.push("Developers own it and no flows exist on the object: create a logic-free trigger, a handler, a service and a selector.");
        }
      } else if (st.reuse === "yes") {
        rec = "hybrid";
        chain.push("Simple logic that several flows need: write it once as a service method behind an @InvocableMethod (or a subflow if it is purely declarative).");
      } else if (st.change === "same") {
        rec = "before";
        chain.push("A same-record field update with simple logic is the textbook before-save flow: it assigns $Record with no DML and no second save.");
        if (st.volume === "high") chain.push("High volume does not change this: fast field updates are the cheapest automation per record on the platform.");
        if (st.owner === "dev") chain.push("Developer ownership is fine here. If a trigger is added to the object later, move this logic into its handler.");
      } else {
        if (st.volume === "high") {
          rec = st.owner === "admin" ? "hybrid" : "apex";
          chain.push("Related-record DML at high volume: Flow hides per-element costs, so the bulk work moves into Apex.");
          chain.push(st.owner === "admin" ? "Admins still own the trigger point, so Flow calls an invocable that does the bulk DML." : "Developers own it, so a trigger handler and service do the work directly.");
        } else {
          rec = "after";
          chain.push("Creating or updating related records needs DML, which only after-save automation can do. With no trigger present, that is an after-save flow.");
          if (st.owner === "dev") chain.push("Developer ownership does not force Apex. Switch when the logic outgrows a handful of elements.");
        }
      }
      return { rec: REC[rec], chain: chain };
    }

    function paint() {
      var out = decide();
      clear(stage);
      stage.appendChild(h("div", { class: "ob-card is-on" }, h("h4", {}, out.rec.name), h("span", { class: "ob-dim" }, "Avoid: " + out.rec.avoid)));
      var steps = h("ol", { class: "ob-steps", style: "margin-top:10px" });
      for (var i = 0; i < out.chain.length; i++) {
        steps.appendChild(h("li", { class: "ob-step is-done" }, h("span", { class: "ob-num" }, String(i + 1)), h("span", {}, out.chain[i])));
      }
      stage.appendChild(steps);
      clear(readout);
      readout.appendChild(ro("recommendation", out.rec.name));
      readout.appendChild(ro("trigger on object", st.trigger === "yes" ? "yes" : "no"));
      readout.appendChild(ro("change", st.change === "same" ? "same record" : "related records"));
      readout.appendChild(ro("logic", st.logic === "simple" ? "simple" : "callouts / collections"));
      readout.appendChild(ro("volume", st.volume === "normal" ? "normal" : "high / tight CPU"));
      readout.appendChild(ro("maintainer", st.owner === "admin" ? "admins" : "developers"));
      readout.appendChild(ro("reusable from Flow", st.reuse));
      readout.appendChild(ro("timing", st.timing === "now" ? "in the save" : "can wait"));
    }

    function pick(key) { return function (v) { st[key] = v; paint(); }; }
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["no", "No Apex trigger yet"], ["yes", "Apex trigger exists"]], 0, pick("trigger")),
      segment([["same", "Same-record field update"], ["related", "Related records or actions"]], 0, pick("change")),
      segment([["simple", "Simple logic"], ["complex", "Callouts or maps / collections"]], 0, pick("logic")),
      segment([["normal", "Normal volume"], ["high", "Thousands per transaction or tight CPU"]], 0, pick("volume")),
      segment([["admin", "Admins maintain it"], ["dev", "Developers maintain it"]], 0, pick("owner")),
      segment([["no", "One-off logic"], ["yes", "Reusable, callable from Flow"]], 0, pick("reuse")),
      segment([["now", "Must happen in the save"], ["later", "Can run later or on a schedule"]], 0, pick("timing"))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "flow-flows": {
      title: "Flow Builder checkpoint",
      sub: "Flow types, before vs after save, bulk-safe design and fault paths.",
      questions: [
        { q: "Every time an Account is saved, Region__c must be derived from BillingState. Which automation is the cheapest correct choice?",
          options: ["An after-save flow with an Update Records element on the Account", "A before-save record-triggered flow that assigns $Record.Region__c", "A schedule-triggered flow that fixes Region__c nightly", "A screen flow on the Account page"],
          answer: 1,
          explain: "A before-save flow edits the record that is already being saved, so it costs no DML and no second pass through the save order. An after-save update re-saves the same record, and a nightly fix leaves the data wrong for hours." },
        { q: "Which flow type has no trigger of its own and runs when Apex, another flow or an API call starts it?",
          options: ["Autolaunched flow with no trigger", "Screen flow", "Record-triggered flow", "Schedule-triggered flow"],
          answer: 0,
          explain: "An autolaunched flow with no trigger is reusable logic that a caller starts, for example as a subflow or from Apex. It runs inside the caller's transaction and shares its limits. Screen flows need a user, and the other two have their own start conditions." },
        { q: "A record-triggered flow loops over related records and runs Get Records inside the loop. What happens during a 200-record data load?",
          options: ["The runtime merges every iteration into a single query", "Nothing, because Get Records does not count against SOQL limits", "Each iteration issues its own query, so the transaction can pass the 100-query limit", "The loop is capped at 50 iterations and then exits"],
          answer: 2,
          explain: "Get Records is a SOQL query, and inside a loop it runs once per iteration. The runtime can batch the same element across interviews, but it cannot rewrite your loop. Query once before the loop and work from the collection." },
        { q: "What is the main job of a fault connector on a Create Records element?",
          options: ["Retrying the element three times automatically", "Switching the flow into system context", "Skipping the element when the record is locked", "Sending the error down a handled path, such as publishing a log event, instead of failing with a generic message"],
          answer: 3,
          explain: "Without a fault path, an element error ends the interview with a generic error, or a record saves without the automation finishing. A fault path lets you log through a platform event (which survives rollback), show a useful screen, or return an error to a parent flow." },
        { q: "When does $Record__Prior hold values?",
          options: ["Only in before-save flows on insert", "In record-triggered flows running on an update, where it holds the field values from before the change", "In screen flows, after the first screen", "In schedule-triggered flows, once per batch"],
          answer: 1,
          explain: "$Record__Prior is the record as it was before the triggering update, so it is empty on create. Compare it with $Record, or use an is-changed entry condition, so the flow runs only when the field you care about actually changed." }
      ]
    },
    "flow-engine": {
      title: "Execution engine checkpoint",
      sub: "Save order, same-field conflicts, recursion and post-commit work.",
      questions: [
        { q: "A before-save flow and a before-update Apex trigger both set Priority on the same Case. Which value is saved?",
          options: ["The flow's value, because declarative automation always wins", "The trigger's value, because before triggers run after before-save flows", "Whichever was activated most recently", "Neither: the save fails with a conflict error"],
          answer: 1,
          explain: "Before-save flows run first, then before triggers, so the trigger has the last word on the field. Do not design two tools to write the same field. If you inherit that situation, write down the ordering and plan to consolidate." },
        { q: "When do custom validation rules evaluate, relative to Apex before triggers?",
          options: ["Before any before-save flow runs", "Only on insert, never on update", "After before triggers, so values set by Apex are validated too", "After the transaction commits"],
          answer: 2,
          explain: "Validation rules run after before-save flows and before triggers have changed the record. A value your trigger sets must therefore pass validation, and a failure rolls back the whole save with the rule's message." },
        { q: "An after-save flow on Opportunity updates its own triggering Opportunity, with no guarding entry condition. What is the risk?",
          options: ["The update re-enters the save order and can keep re-firing the flow until the platform's recursion cap or a limit stops it", "None, because flows cannot update their triggering record", "The platform silently ignores the update", "The flow is converted to a before-save flow at runtime"],
          answer: 0,
          explain: "Updating the triggering record from after-save automation is a new DML on that record, so triggers and flows run again. Set same-record fields in a before-save flow, and give after-save flows is-changed entry conditions so a second pass finds nothing to do." },
        { q: "Why is a static Boolean 'already ran' flag a weak recursion guard in a trigger handler?",
          options: ["Static variables reset between 200-record chunks", "Apex does not allow static Boolean variables", "Each check of the flag costs one SOQL query", "It blocks every record on re-entry, including records in later chunks of the same DML that were never processed"],
          answer: 3,
          explain: "Static variables live for the whole transaction, so once the flag is set, chunk two of a 400-record load is skipped silently. A Set of processed record Ids blocks only records that were already handled." },
        { q: "Which of these happens only after the transaction commits?",
          options: ["Before triggers", "Roll-up summary recalculation", "Sending emails and starting queued async jobs", "Duplicate rule evaluation"],
          answer: 2,
          explain: "Email sends, queued Queueable and future jobs, outbound messages and publish-after-commit events wait for the commit, so a rollback never leaves them half-done. Roll-ups, duplicate rules and triggers all run inside the transaction." }
      ]
    },
    "flow-choose": {
      title: "Choosing the tool checkpoint",
      sub: "Flow vs Apex, one owner per object, invocable Apex and hybrids.",
      questions: [
        { q: "Case already has CaseTrigger, CaseHandler and CaseService. A new rule must update related Contacts after a Case update. Where should it go?",
          options: ["A new after-save record-triggered flow on Case", "A new Process Builder process on Case", "A workflow rule with a field update", "A new CaseService method called from the handler's after-update path"],
          answer: 3,
          explain: "When an object already has a trigger, new logic for the same event belongs in its handler and service. A parallel flow creates ordering and recursion problems that neither the admin nor the developer can see from their side. Process Builder and workflow rules are legacy." },
        { q: "Admins need to own the schedule of a nightly job that needs complex queries and governor-aware processing. What fits best?",
          options: ["A schedule-triggered flow that calls an @InvocableMethod delegating to an Apex service", "A screen flow launched by a user each night", "A before-save flow on the target object", "An Apex trigger on the target object"],
          answer: 0,
          explain: "The hybrid gives admins the schedule and the entry criteria in Setup, while Apex handles the joins and bulk DML. The flow stays thin: it collects parameters and calls the action. The invocable gets its own test class." },
        { q: "How should an @InvocableMethod report a business failure back to the flow that called it?",
          options: ["Throw an exception so the interview fails", "Return a result object with success and error fields that the flow can branch on", "Write the message with System.debug", "Return null for the failed input"],
          answer: 1,
          explain: "An uncaught exception fails the interview and can roll back the triggering save. A typed result per input lets the flow take a decision or fault path. Keep the results in the same order as the requests." },
        { q: "A record-triggered flow calls an @InvocableMethod during a 200-record update. What does the method receive?",
          options: ["Two hundred separate calls, one per record", "One call containing a single record", "One call with a list of inputs, one per interview, so the method must be bulk-safe", "Nothing, because record-triggered flows cannot call invocable actions"],
          answer: 2,
          explain: "Flow batches the action across interviews and passes a list of requests in one call. Code that queries or writes per request inside a loop hits the same limits as a non-bulkified trigger. Accumulate the inputs, query once, write once." },
        { q: "Which requirement points most clearly to Apex rather than Flow?",
          options: ["Several callouts with retry logic plus map-heavy cross-object processing", "Defaulting a field on the same record", "Sending an email alert when Status changes", "A simple required-field check"],
          answer: 0,
          explain: "Callout chains, retries and map-based joins are where Flow becomes slow and hard to read, while Apex makes the cost visible and testable. The other three are cheaper and easier to maintain declaratively, as a before-save flow, a flow email action or a validation rule." }
      ]
    }
  });

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "flow-ai": {
      title: "Agentforce and Einstein checkpoint",
      sub: "Topics, actions, the trust layer, and reusing your automation as agent actions.",
      questions: [
        { q: "An agent should look up order status. You already have a bulk-safe Apex service. What is the cleanest way to expose it?",
          options: ["Paste the Apex into the agent's instructions", "An @InvocableMethod wrapper with clear labels and descriptions, added as an agent action", "A new REST endpoint the agent calls over the internet", "A scheduled job that emails status to customers"], answer: 1,
          explain: "Agent actions reuse invocable Apex, flows and prompt templates. The reasoning engine reads the action and input descriptions to decide when and how to call it, so those descriptions matter as much as the code. The service keeps with sharing and user mode." },
        { q: "What is a topic in Agentforce?",
          options: ["A Chatter group", "A dataset in Data Cloud", "A job the agent can do, with a classification description, instructions, scope and the actions allowed for it", "A platform event channel"], answer: 2,
          explain: "Topics group related actions with natural-language instructions and boundaries. The agent classifies a request into a topic, then plans with only that topic's actions, which keeps behaviour focused and easier to test." },
        { q: "Which statement about the Einstein Trust Layer is accurate?",
          options: ["It removes the need for sharing and field-level security", "It sits between your data and the model, with features such as data masking, zero data retention with model providers, toxicity checks and audit", "It trains a private model on all of your org's records", "It only applies to CRM Analytics"], answer: 1,
          explain: "The trust layer governs prompts and responses in transit. It does not replace the access model: grounding and actions still respect the running user's permissions, which is why your actions must enforce sharing and FLS." },
        { q: "Which action design is riskiest to give an autonomous customer-facing agent?",
          options: ["Get order status for the verified customer", "Create a case with the customer's description", "Summarise the customer's last three cases", "Delete any record by Id passed in from the conversation"], answer: 3,
          explain: "A generic, destructive action driven by model output invites abuse through prompt injection. Prefer narrow, read-mostly actions scoped to the verified user, require confirmation for changes, and validate every input in the action itself." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.flow = {
    id: "flow",
    name: "Declarative Automation",
    short: "FLOW",
    tagline: "Automate with Flow, and know when to stop",
    color: "#fbbf24",
    blurb: "Flow Builder is the platform's default automation tool, and it lives inside the same save transaction as Apex. Learn the flow types, before-save versus after-save design, bulk-safe patterns and fault paths, the order of execution every automation slots into, how recursion creeps in, and a decision framework for Flow, Apex or a hybrid of the two.",
    modules: [
      {
        id: "flows",
        name: "Flow Builder",
        icon: "bolt",
        lessons: [
          {
            id: "flow-types",
            title: "Flow types and when each runs",
            summary: "What starts each kind of flow, which transaction it joins, and the naming that keeps an org navigable.",
            minutes: 9,
            tags: ["flow-types", "flow-builder"],
            blocks: [
              { t: "p", html: "Think of a flow as a small program the platform runs for you. The <strong>type</strong> decides two things: what starts it, and whose transaction it runs in. Get those two right and most flow design questions answer themselves." },
              { t: "table", headers: ["Flow type", "Started by", "Runs in", "Typical job"], rows: [
                ["Screen flow", "A user: quick action, Lightning page, utility bar", "The user's request; waits on each screen", "Guided wizards, data capture with validation"],
                ["Record-triggered", "Create, update or delete of a record", "The save transaction itself", "Field defaults, related records, notifications"],
                ["Schedule-triggered", "A start time and frequency", "Its own transactions, records in batches of 200", "Nightly sweeps, reminders"],
                ["Platform event-triggered", "An event message on the bus", "A separate subscriber transaction", "Decoupled reactions to something that happened"],
                ["Autolaunched (no trigger)", "Apex, a parent flow, REST or an invocable action", "The caller's transaction and limits", "Reusable logic, subflows"],
                ["Orchestration", "A record change or a launch", "Many steps over hours or days, across users", "Multi-stage processes with human steps"]
              ] },
              { t: "h", text: "Run context" },
              { t: "p", html: "Record-triggered and schedule-triggered flows run in <strong>system context</strong> by default, so they can read and change records the triggering user cannot see. Screen flows usually run in <strong>user context</strong>. Choose the mode on purpose and write the reason in the flow's description." },
              { t: "note", variant: "warn", html: "A screen flow switched to <em>system context without sharing</em> lets any user who can launch it reach every record it queries. Treat that setting like a <code class='tok'>without sharing</code> Apex class: justify it, document it, and keep the flow small." },
              { t: "h", text: "Naming and descriptions" },
              { t: "table", headers: ["Type", "Convention", "Example"], rows: [
                ["Record-triggered, before save", "<code class='tok'>Object_BeforeSave_Action</code>", "<code class='tok'>Case_BeforeSave_DefaultFields</code>"],
                ["Record-triggered, after save", "<code class='tok'>Object_AfterSave_Action</code>", "<code class='tok'>Case_AfterSave_NotifyOwner</code>"],
                ["Schedule-triggered", "<code class='tok'>Object_Scheduled_Action</code>", "<code class='tok'>Case_Scheduled_EscalateOverdue</code>"],
                ["Screen", "<code class='tok'>Process_Screen_Purpose</code>", "<code class='tok'>Onboarding_Screen_Wizard</code>"],
                ["Subflow", "<code class='tok'>Sub_Domain_Action</code>", "<code class='tok'>Sub_Notification_SendEmail</code>"]
              ] },
              { t: "code", lang: "text", code: [
                "Description template (every flow, every version)",
                "  What:     Creates a follow-up Task when a Case is escalated.",
                "  When:     After save, Case updated, Status changed to Escalated.",
                "  Affects:  Case (read), Task (create).",
                "  Story:    SUP-412.  v2: added fault path to Log_Event__e."
              ].join("\n") },
              { t: "table", headers: ["Tier", "Requirement: follow-up task when a Case escalates"], rows: [
                ["Naive", "A screen flow that agents must remember to run. It depends on people, and the task is missing whenever they forget."],
                ["Solid", "An after-save record-triggered flow with the entry condition Status equals Escalated."],
                ["Standout", "The same flow with an is-changed condition so it fires once, a fault path that logs through a platform event, a convention name, and a line in the object's automation inventory."]
              ] },
              { t: "cue", html: "Spotting it in a prompt: <em>when a record is created or changed</em> means record-triggered; <em>every night</em> or <em>N days after</em> means scheduled or a scheduled path; <em>walk the user through</em> means screen flow; <em>reuse this from several places</em> means an autolaunched subflow or invocable Apex." },
              { t: "note", variant: "tip", html: "Workflow rules and Process Builder are legacy. Build nothing new on them, and when you touch an object that still has them, plan the migration into record-triggered flows or the trigger handler." },
              { t: "note", variant: "key", html: "<strong>Type decides trigger and transaction.</strong> Pick the flow type from what starts the work and whose limits it shares, then name and describe it so the next person can find it." }
            ]
          },
          {
            id: "record-triggered",
            title: "Record-triggered flows: before vs after save",
            summary: "Two hooks into one save: edit the record in hand before the write, or reach out to other records after it.",
            minutes: 10,
            tags: ["record-triggered", "before-save", "after-save"],
            blocks: [
              { t: "p", html: "A record-triggered flow hooks into the save at one of two points. <strong>Before save</strong>, you are holding the record that is about to be written, so you just change it. <strong>After save</strong>, the record exists, so you can reach out to other records, but touching the original again costs another save." },
              { t: "table", headers: ["Aspect", "Before save (fast field updates)", "After save (actions and related records)"], rows: [
                ["Change the triggering record", "Assign <code class='tok'>$Record</code> fields; no DML", "Needs Update Records, which is a second save"],
                ["Create or update other records", "Not available", "Yes, through Create and Update Records (DML)"],
                ["Record Id on insert", "Not assigned yet", "Available"],
                ["Scheduled and async paths", "Not available", "Available"],
                ["Relative cost", "Far cheaper: no extra save, no DML", "Pays DML, and possibly a re-entry"]
              ] },
              { t: "h", text: "Entry conditions do the filtering" },
              { t: "p", html: "Entry conditions are evaluated before an interview starts, so a record that fails them costs almost nothing. Use them instead of a Decision element as the first step, and combine them with <em>only when a record is updated to meet the condition requirements</em> so the flow fires on the change, not on every later edit." },
              { t: "code", lang: "text", code: [
                "Entry condition (formula evaluates to true)",
                "  AND(",
                "    ISCHANGED({!$Record.Status}),",
                "    TEXT({!$Record.Status}) = 'Escalated'",
                "  )",
                "",
                "Equivalent check inside the flow:",
                "  {!$Record.Status} <> {!$Record__Prior.Status}"
              ].join("\n") },
              { t: "h", text: "Paths after the save" },
              { t: "ul", items: [
                "<strong>Immediate path</strong>: runs inside the save transaction and shares its limits with triggers and other flows.",
                "<strong>Scheduled paths</strong>: run later, relative to the trigger time or a date field (for example, 3 days before Close Date), in their own transactions.",
                "<strong>Run asynchronously path</strong>: runs after commit in a separate transaction. Use it for callout actions, which cannot run inside the save."
              ] },
              { t: "note", variant: "trap", html: "An after-save flow that updates its own triggering record sends it back through triggers, validation and flows. If the value only depends on the record, set it in a before-save flow instead." },
              { t: "table", headers: ["Tier", "Requirement: set Next_Review__c to 30 days after close, then notify the owner"], rows: [
                ["Naive", "One after-save flow that updates <code class='tok'>$Record</code> and sends the email. That is two saves per record, and it re-runs on every later edit."],
                ["Solid", "A before-save flow sets the date, and an after-save flow sends the notification."],
                ["Standout", "Both flows filter on an is-changed condition, the email has a fault path, the names follow convention, and a 200-record test proves both."]
              ] },
              { t: "p", html: "When several record-triggered flows share an object and timing, set the <strong>Trigger Order</strong> value on each so the sequence is explicit. Do not rely on any implicit ordering between peers, and write the sequence into the object's automation inventory." },
              { t: "code", lang: "text", code: [
                "<!-- Case_BeforeSave_SetPriority.flow-meta.xml (excerpt) -->",
                "<triggerType>RecordBeforeSave</triggerType>",
                "<objectType>Case</objectType>",
                "<triggerOrder>1</triggerOrder>",
                "<assignments>",
                "    <name>Set_Priority_High</name>",
                "    <assignmentItems>",
                "        <assignToReference>$Record.Priority</assignToReference>",
                "        <operator>Assign</operator>",
                "        <value><stringValue>High</stringValue></value>",
                "    </assignmentItems>",
                "</assignments>"
              ].join("\n") },
              { t: "cue", html: "Spotting it in a prompt: <em>default</em>, <em>derive</em> or <em>stamp a field on the same record</em> means before save. <em>Create a child</em>, <em>update the parent</em>, <em>notify</em> or <em>call out</em> means after save, and a callout goes on the async path." },
              { t: "note", variant: "key", html: "<strong>Same record before, other records after.</strong> Before-save flows edit the record in hand for free; after-save flows pay DML to reach anything else, and should never re-save their own record without a guard." }
            ]
          },
          {
            id: "flow-bulk",
            title: "Bulk-safe flows and fault paths",
            summary: "How the runtime batches interviews, where you can still break limits, and how to fail loudly instead of silently.",
            minutes: 10,
            tags: ["bulkification", "fault-paths", "flow-limits"],
            blocks: [
              { t: "p", html: "When 200 records arrive in one save, the platform starts <strong>200 interviews</strong> and tries to run each element for all of them together. That batching only works across interviews at the same element. Anything you put <em>inside a Loop</em> runs once per iteration, per interview." },
              { t: "ol", items: [
                "A data load updates 200 Cases, so 200 interviews start.",
                "The runtime batches a top-level Get Records into roughly one query for all 200.",
                "A Get Records inside a Loop over 10 related records runs 10 times in each interview, and the queries add up fast.",
                "All of it shares the transaction's 100 SOQL, 150 DML and 10 seconds of CPU with every trigger on the object."
              ] },
              { t: "compare",
                bad: { title: "Hidden per-record cost", items: ["Get Records inside a Loop", "Update Records on every iteration", "Record Ids or user names typed into Decisions", "One giant flow with a dozen branches"] },
                good: { title: "Bulk-safe shape", items: ["Get Records once, before the Loop, into a collection", "Assignment adds to a collection; one Update Records after the Loop", "Custom metadata or labels for configuration", "Heavy branching handed to an invocable Apex action"] } },
              { t: "code", lang: "text", code: [
                "Get Records    -> openTasks (all open Tasks for the triggering Accounts)",
                "Loop           -> over openTasks",
                "  Assignment   -> task.Status = 'Deferred'; add task to tasksToUpdate",
                "Update Records -> tasksToUpdate          (one DML for the whole batch)",
                "  Fault        -> Create Log_Event__e    (publishes even if the save rolls back)"
              ].join("\n") },
              { t: "h", text: "Fault paths" },
              { t: "table", headers: ["Flow type", "Fault strategy", "Why"], rows: [
                ["Record-triggered", "Publish a log platform event, then end", "The save may roll back; an immediately published event is kept"],
                ["Screen", "Show an error screen with retry or cancel", "A user is waiting and needs to fix the input"],
                ["Schedule-triggered", "Log and alert an admin", "Nobody is watching the run"],
                ["Subflow", "Set <code class='tok'>outputIsSuccess = false</code> and an error message", "The parent decides what to do next"]
              ] },
              { t: "p", html: "Why an event rather than a <code class='tok'>Log__c</code> insert? If the transaction fails, a log row inserted by the flow rolls back with everything else. An event set to <strong>publish immediately</strong> is delivered anyway, and its subscriber writes the log in a separate transaction." },
              { t: "note", variant: "warn", html: "Debug mode runs one record, with no concurrency and no other automation competing for limits. Never sign off a flow from debug mode alone. Prove it with a 200-record Apex test or a sandbox data load." },
              { t: "code", lang: "java", code: [
                "@IsTest",
                "static void escalatedCasesBulkGetOneFollowUpTaskEach() {",
                "    User agent = TestDataFactory.createUserWithPermSet('Support_Agent');",
                "    System.runAs(agent) {",
                "        List<Case> cases = TestDataFactory.buildCases(200, 'New');",
                "        insert cases;",
                "        for (Case c : cases) {",
                "            c.Status = 'Escalated';",
                "        }",
                "        Test.startTest();",
                "        update cases;",
                "        Test.stopTest();",
                "    }",
                "    Integer taskCount = [SELECT COUNT() FROM Task WHERE Subject = 'Follow up on escalated case'];",
                "    Assert.areEqual(200, taskCount, 'Each escalated case should get exactly one follow-up task');",
                "}"
              ].join("\n") },
              { t: "table", headers: ["Shared budget", "Synchronous limit", "Who else spends it"], rows: [
                ["SOQL queries", "100", "Triggers, other flows, managed packages on the same save"],
                ["DML statements", "150", "Same"],
                ["CPU time", "10 s", "Same, and flow interpretation itself"],
                ["Schedule-triggered batches", "200 records each", "Each batch is its own transaction with fresh limits"]
              ] },
              { t: "cue", html: "Spotting it in a prompt: <em>works in debug but fails on import</em>, <em>Too many SOQL queries: 101 from a flow</em>, or <em>the record saved but the task never appeared</em>. Look for elements inside loops and for missing fault connectors." },
              { t: "quiz", id: "flow-flows" },
              { t: "note", variant: "key", html: "<strong>The runtime batches interviews, not loops.</strong> Query before the loop, write once after it, give every action a fault path, and prove the flow with 200 records rather than one." }
            ]
          }
        ]
      },
      {
        id: "engine",
        name: "Execution Engine",
        icon: "queue",
        lessons: [
          {
            id: "order-of-execution",
            title: "The save order of execution",
            summary: "Every flow, trigger and rule has a fixed slot in one save; know the slots and most automation bugs explain themselves.",
            minutes: 12,
            tags: ["order-of-execution", "triggers", "flows"],
            blocks: [
              { t: "p", html: "A save is a pipeline with fixed slots. Your before-save flow, your trigger and your validation rule do not run whenever they like; each waits for its turn, and <strong>nothing is permanent until the commit</strong> at the end. Most of the hard automation bugs come from not knowing which slot runs first." },
              { t: "diagram", id: "order-of-execution", caption: "Simplified save order. Before-save flows run ahead of before triggers, after-save flows run after after triggers, and parent roll-ups re-run the parent's own automation before anything commits." },
              { t: "table", headers: ["#", "Step", "What can still change the record"], rows: [
                ["1", "System validation", "Only the incoming values"],
                ["2", "Before-save flows", "<code class='tok'>$Record</code> assignments, no DML"],
                ["3", "Before triggers", "<code class='tok'>Trigger.new</code> assignments, no DML; wins over step 2"],
                ["4", "System re-checks + validation rules", "Nothing; a failure rolls back"],
                ["5", "Duplicate rules", "Nothing; block or warn"],
                ["6", "Saved, not committed", "Only a new DML update, which re-runs the order"],
                ["7", "After triggers", "Other records through DML"],
                ["8", "Assignment, auto-response, escalation", "The platform may change the owner"],
                ["9", "After-save flows", "Related records through DML"],
                ["10", "Entitlements, roll-ups, parent saves", "Parent automation runs in this transaction"],
                ["11", "Commit", "Nothing"],
                ["12", "Post-commit work", "Only new transactions (async jobs, subscribers)"]
              ] },
              { t: "widget", id: "obOrderStepper" },
              { t: "h", text: "Three consequences worth saying out loud" },
              { t: "ul", items: [
                "<strong>Same field, two tools:</strong> a before trigger overwrites what a before-save flow set, so the trigger's value is saved.",
                "<strong>Validation after Apex:</strong> values your before trigger assigns must still pass validation rules.",
                "<strong>Re-saves cost a full pass:</strong> any after-save update to the same record, including a legacy workflow field update, runs the before and after update logic again."
              ] },
              { t: "note", variant: "trap", html: "A child insert that rolls up to a master makes the <em>parent</em> save inside the child's transaction. The parent's triggers and flows spend the same 100 SOQL and 150 DML, so a cheap child trigger can fail because of parent automation it never mentions." },
              { t: "h", text: "Chunks share one budget" },
              { t: "p", html: "A 1,000-record DML runs the per-record steps in five chunks of 200, and triggers and flows fire once per chunk. All five chunks belong to <strong>one transaction</strong>, so they share one set of limits and commit together at the end." },
              { t: "stat", items: [
                { v: "200", k: "records per trigger chunk" },
                { v: "100", k: "SOQL queries, sync" },
                { v: "150", k: "DML statements" },
                { v: "10 s", k: "CPU, sync" }
              ] },
              { t: "table", headers: ["Tier", "Answering: does my trigger run before or after my flow?"], rows: [
                ["Naive", "Flows run after triggers. That is half true, and it is the half that misleads you."],
                ["Solid", "Before-save flows, then before triggers, then validation, then after triggers, then after-save flows."],
                ["Standout", "The Solid answer, plus who wins on a shared field, that roll-ups re-run parent automation, that email and async jobs wait for commit, and that you keep an automation inventory for each object."]
              ] },
              { t: "cue", html: "Spotting it in a prompt: <em>my flow's value gets overwritten</em>, <em>validation fails on a field the user never touched</em>, <em>the parent's trigger runs when I insert a child</em>, or <em>the email went out but the record rolled back</em>. Each one is an order-of-execution question." },
              { t: "note", variant: "key", html: "<strong>Fixed slots, one transaction, commit at the end.</strong> Before-save flows, before triggers, validation, after triggers, after-save flows, roll-ups, commit, then post-commit work. Every chunk of 200 shares the same limits." }
            ]
          },
          {
            id: "recursion",
            title: "Recursion, re-entry and automation conflicts",
            summary: "How one save turns into many, the guards that actually work, and why each object needs a single automation owner.",
            minutes: 10,
            tags: ["recursion", "trigger-guards", "automation-conflicts"],
            blocks: [
              { t: "p", html: "Recursion is a save that causes another save of the same record, or the same object, inside one transaction. It does not need a trigger. Any automation that writes back to a record it was fired by can start the loop, and each lap spends the same shared limits." },
              { t: "table", headers: ["Source", "How it re-enters"], rows: [
                ["After-save flow updates its own object", "The update re-fires the same flow and every trigger on the object"],
                ["Trigger DML on its own object", "after update writes the same rows, so the trigger fires again"],
                ["Roll-up to a parent", "The child's save makes the parent save; parent automation updates the children; repeat"],
                ["Legacy workflow field update", "The record re-runs before and after update triggers, and after-save flows can run twice"],
                ["Trigger and flow on one object", "Each writes a field the other watches, and they take turns re-firing"]
              ] },
              { t: "h", text: "Guards that work" },
              { t: "compare",
                bad: { title: "Static Boolean flag", items: ["Set to true on first run", "Skips every record on re-entry", "Silently skips chunk two of a 400-record load", "Hides legitimate second updates"] },
                good: { title: "Set of processed Ids", items: ["Tracks exactly which records were handled", "Lets unprocessed records through", "Handles before insert, where there is no Id yet", "Cleared deliberately when a job ends"] } },
              { t: "code", lang: "java", code: [
                "public with sharing class TriggerRecursionGuard {",
                "    private static Map<String, Set<Id>> processedIds = new Map<String, Set<Id>>();",
                "",
                "    public static List<SObject> filterUnprocessed(String objectName, List<SObject> records) {",
                "        if (!processedIds.containsKey(objectName)) {",
                "            processedIds.put(objectName, new Set<Id>());",
                "        }",
                "        Set<Id> seen = processedIds.get(objectName);",
                "        List<SObject> fresh = new List<SObject>();",
                "        for (SObject rec : records) {",
                "            if (rec.Id == null || !seen.contains(rec.Id)) {",
                "                fresh.add(rec);",
                "                if (rec.Id != null) {",
                "                    seen.add(rec.Id);",
                "                }",
                "            }",
                "        }",
                "        return fresh;",
                "    }",
                "}",
                "",
                "// In AccountService.handleAfterUpdate(...)",
                "List<Account> toProcess = (List<Account>) TriggerRecursionGuard.filterUnprocessed('Account', newRecords);"
              ].join("\n") },
              { t: "p", html: "In flows, the guard is the <strong>entry condition</strong>. Run only when the field you depend on changed, compare <code class='tok'>$Record</code> with <code class='tok'>$Record__Prior</code>, and pick <em>only when updated to meet the condition</em>. A second pass then finds nothing to do." },
              { t: "note", variant: "warn", html: "Static variables live for the whole transaction, including every 200-record chunk of the same DML. That is why a Boolean flag set in chunk one silently skips chunk two, and why the guard must track Ids." },
              { t: "h", text: "One owner per object per event" },
              { t: "table", headers: ["Situation", "Recommendation"], rows: [
                ["Object has a trigger", "Extend the handler and service; do not add a record-triggered flow for the same event"],
                ["Object has flows only", "Extend the flows; add a trigger only when Flow genuinely cannot do the job"],
                ["Both needed, different purposes", "Document the ordering, for example a before-save flow for defaults plus an after trigger for integration"],
                ["Flow calls an @InvocableMethod", "The Apex runs in the flow's transaction and spends its limits"]
              ] },
              { t: "table", headers: ["Tier", "Stopping an Account update loop"], rows: [
                ["Naive", "A static Boolean <code class='tok'>hasRun</code> in the handler. The loop stops, and so does processing for every later chunk."],
                ["Solid", "A Set-based guard in the service, plus is-changed entry conditions on the after-save flows."],
                ["Standout", "Consolidate to one owner per event, so the loop cannot form, keep the guard as a backstop, and add a 200-record test that asserts each record was processed exactly once."]
              ] },
              { t: "cue", html: "Spotting it in a prompt: <em>Maximum trigger depth exceeded</em>, <em>the flow ran twice</em>, <em>half the records in a big load were not processed</em>, or <em>it only happens when the parent has a roll-up</em>." },
              { t: "quiz", id: "flow-engine" },
              { t: "note", variant: "key", html: "<strong>Recursion is any write-back, not just triggers.</strong> Track processed Ids rather than flags, filter flows on real changes, and give each object one automation owner per event so the loop has nowhere to start." }
            ]
          }
        ]
      },
      {
        id: "choose",
        name: "Choosing the Tool",
        icon: "compass",
        lessons: [
          {
            id: "flow-vs-apex",
            title: "Flow vs Apex: a decision framework",
            summary: "Inventory first, then the shape of the work, then who maintains it. Pick a single owner for each object and event.",
            minutes: 11,
            tags: ["flow-vs-apex", "architecture", "decision"],
            blocks: [
              { t: "p", html: "Flow versus Apex is rarely about which tool is better. It is about <strong>what already owns the object</strong>, how complex the work is, and who will maintain it next year. Ask those questions in that order, and write the answer down." },
              { t: "ol", items: [
                "<strong>Does the object already have a trigger?</strong> If so, put the new logic in its handler and service. Do not add a parallel flow.",
                "<strong>Is it a security or access rule?</strong> Enforce it on the server, with a validation rule or Apex, never only in a flow or component.",
                "<strong>Must it coordinate with existing Apex?</strong> Put it in the same service so the ordering stays in one place.",
                "<strong>Is it purely a UI concern?</strong> Handle it in the component, and back anything security-critical on the server.",
                "<strong>Can a declarative tool do it cleanly?</strong> With no trigger on the object and simple logic, prefer Flow or a validation rule."
              ] },
              { t: "table", headers: ["Mechanism", "Best when", "Avoid when"], rows: [
                ["Validation rule", "Field and cross-field checks with a clear message", "It needs related-record queries"],
                ["Formula field", "Derived values that are always current", "You need history, or other objects' data"],
                ["Record-triggered flow", "Field updates, related records and alerts on objects with no trigger", "The object already has a complex trigger"],
                ["Apex trigger (handler + service)", "Complex or bulk logic, an existing trigger, precise ordering, integrations", "A simple default that a flow or formula can handle"],
                ["Platform event", "Decoupled async reactions and fan-out", "Simple logic in the same transaction"],
                ["Queueable or Batch", "Heavy work, callouts, more than sync limits allow", "Logic that fits in the save"]
              ] },
              { t: "widget", id: "obFlowVsApex" },
              { t: "h", text: "Performance cuts both ways" },
              { t: "table", headers: ["Scenario", "Usually faster", "Why"], rows: [
                ["Same-record field default", "Flow (before save)", "No Apex class loading, no extra save"],
                ["Email alert on a change", "Flow", "Native action; house standard keeps email in Flow"],
                ["More than about five branches of logic", "Apex", "Compiled code beats interpreted elements"],
                ["Cross-object joins", "Apex", "One query with a subquery instead of several Get Records"],
                ["More than about a thousand records of bulk work", "Apex (Batch or Queueable)", "Predictable limits and chunking"]
              ] },
              { t: "note", variant: "tip", html: "Write a short decision record every time: what you chose, what you rejected and why, and how it fits the object's existing pattern. It saves the next person from adding the parallel flow you deliberately avoided." },
              { t: "code", lang: "text", code: [
                "Decision: add rule to CaseService.handleAfterUpdate",
                "Rejected: new after-save flow on Case. Case already has",
                "          CaseTrigger -> CaseHandler -> CaseService; a parallel flow",
                "          would split ordering across two tools.",
                "Fits:     CaseHandler already delegates after-update work to",
                "          CaseService; this follows the same path."
              ].join("\n") },
              { t: "table", headers: ["Tier", "How you justify the choice"], rows: [
                ["Naive", "We always use Flow, or we always use Apex."],
                ["Solid", "Simple field work goes to Flow, complex or bulk work to Apex, because of maintainability and limits."],
                ["Standout", "First I check what owns the object today, then the shape of the work, then the maintainer. I keep one owner per event, enforce security on the server, and record what I rejected."]
              ] },
              { t: "cue", html: "Spotting it in a prompt: <em>should this be a flow or a trigger</em>, <em>admins want to change it themselves</em>, <em>the object already has a trigger</em>, or <em>this has to call an external system</em>." },
              { t: "note", variant: "trap", html: "A flow or component that hides a button is not security. If a rule protects data, it must hold for API saves and data loads too, so enforce it in a validation rule or in Apex running in user mode." },
              { t: "note", variant: "key", html: "<strong>Inventory, shape, maintainer, in that order.</strong> An existing trigger means the handler, simple same-record work means a before-save flow, and complex or bulk work means Apex. Write down what you rejected." }
            ]
          },
          {
            id: "hybrid",
            title: "Hybrid automation: invocable Apex and subflows",
            summary: "Let Flow orchestrate and Apex compute: bulk-safe invocable actions, reusable subflows and tests at the seam.",
            minutes: 11,
            tags: ["invocable", "subflows", "hybrid"],
            blocks: [
              { t: "p", html: "A hybrid splits the work at a clean seam: <strong>Flow orchestrates</strong> (when, for which records, in what order) and <strong>Apex computes</strong> (joins, callouts, bulk DML). Admins keep control of timing and criteria, and developers keep the hard logic testable." },
              { t: "table", headers: ["Pattern", "Flow side", "Apex side", "Use when"], rows: [
                ["Scheduled flow + invocable", "Runs on a schedule set in Setup, passes parameters", "<code class='tok'>@InvocableMethod</code> delegates to a service", "Admins own the schedule; the logic needs joins or careful limits"],
                ["Screen flow + invocable", "Collects input across screens", "Validates, writes and calls out", "A wizard with real backend work"],
                ["Flow + platform event + Apex", "Record-triggered flow publishes an event", "Event trigger processes it asynchronously", "Async work started by a record change, visible to admins"]
              ] },
              { t: "code", lang: "java", code: [
                "/**",
                " * @description Flow action: recalculates credit holds for a batch of Accounts.",
                " */",
                "public with sharing class CreditHoldAction {",
                "",
                "    /** @description One input per flow interview. */",
                "    public class Request {",
                "        @InvocableVariable(required=true label='Account Id')",
                "        public Id accountId;",
                "    }",
                "",
                "    /** @description One result per request, in request order. */",
                "    public class Result {",
                "        @InvocableVariable public Boolean isSuccess;",
                "        @InvocableVariable public String errorMessage;",
                "    }",
                "",
                "    /** @description Bulk entry point: Flow passes every interview's request in one call. */",
                "    @InvocableMethod(label='Recalculate Credit Hold' category='Accounts')",
                "    public static List<Result> recalculate(List<Request> requests) {",
                "        Set<Id> accountIds = new Set<Id>();",
                "        for (Request req : requests) {",
                "            accountIds.add(req.accountId);",
                "        }",
                "        Map<Id, String> errorsById = CreditService.getInstance().recalculateHolds(accountIds);",
                "        List<Result> results = new List<Result>();",
                "        for (Request req : requests) {",
                "            Result res = new Result();",
                "            res.errorMessage = errorsById.get(req.accountId);",
                "            res.isSuccess = String.isBlank(res.errorMessage);",
                "            results.add(res);",
                "        }",
                "        return results;",
                "    }",
                "}"
              ].join("\n") },
              { t: "ul", items: [
                "One <code class='tok'>@InvocableMethod</code> per class, and it must be <code class='tok'>static</code>.",
                "It takes a list and returns a list. Flow batches interviews, so expect up to 200 requests in a single call.",
                "Return errors as data. An uncaught exception fails the interview and can roll back the triggering save.",
                "It runs in the flow's transaction and spends the flow's limits, so the service must be bulk-safe."
              ] },
              { t: "h", text: "Subflows: build once, call everywhere" },
              { t: "p", html: "Pull a sequence into a subflow when two or more flows repeat it. Prefix it <code class='tok'>Sub_</code>, take typed inputs, return typed outputs, and keep it object-agnostic by accepting a record Id as text. Its fault path should set the outputs rather than swallow the error." },
              { t: "table", headers: ["Variable", "Direction", "Type", "Purpose"], rows: [
                ["<code class='tok'>inputRecordId</code>", "In", "Text", "The record the notification is about"],
                ["<code class='tok'>inputTemplateName</code>", "In", "Text", "Which email template to merge"],
                ["<code class='tok'>outputIsSuccess</code>", "Out", "Boolean", "False when the fault path ran"],
                ["<code class='tok'>outputErrorMessage</code>", "Out", "Text", "Readable reason for the parent flow"]
              ] },
              { t: "note", variant: "tip", html: "House standard: production email notifications go through Flow (an email action or a <code class='tok'>Sub_Notification_SendEmail</code> subflow), not Apex <code class='tok'>Messaging</code>. The invocable returns data; the flow decides who hears about it." },
              { t: "h", text: "Test the seam" },
              { t: "code", lang: "java", code: [
                "@IsTest",
                "private class CreditHoldActionTest {",
                "",
                "    @TestSetup",
                "    static void makeData() {",
                "        TestDataFactory.createAccounts(200, true);",
                "    }",
                "",
                "    @IsTest",
                "    static void recalculateBulkRequestsReturnsOneResultPerRequest() {",
                "        User manager = TestDataFactory.createUserWithPermSet('Credit_Manager');",
                "        List<CreditHoldAction.Request> requests = new List<CreditHoldAction.Request>();",
                "        for (Account acc : [SELECT Id FROM Account]) {",
                "            CreditHoldAction.Request req = new CreditHoldAction.Request();",
                "            req.accountId = acc.Id;",
                "            requests.add(req);",
                "        }",
                "        List<CreditHoldAction.Result> results;",
                "        System.runAs(manager) {",
                "            Test.startTest();",
                "            results = CreditHoldAction.recalculate(requests);",
                "            Test.stopTest();",
                "        }",
                "        Assert.areEqual(200, results.size(), 'Flow expects exactly one result per interview');",
                "        Assert.isTrue(results[0].isSuccess, 'An account in good standing should not report an error');",
                "    }",
                "}"
              ].join("\n") },
              { t: "table", headers: ["Tier", "A flow needs complex credit logic"], rows: [
                ["Naive", "Thirty flow elements with nested loops and Get Records in each branch."],
                ["Solid", "The flow calls an invocable action that delegates to a service."],
                ["Standout", "A bulk-safe invocable that returns result objects, a fault path on the action, a test with 200 requests run as the feature user, and the service reused by the trigger handler too."]
              ] },
              { t: "cue", html: "Spotting it in a prompt: <em>admins want to own the schedule</em>, <em>the wizard needs to call an API</em>, <em>three flows repeat the same steps</em>, or <em>Flow needs a calculation it cannot express</em>." },
              { t: "quiz", id: "flow-choose" },
              { t: "note", variant: "key", html: "<strong>Flow orchestrates, Apex computes.</strong> Invocable actions take lists, return results instead of throwing, and share the flow's limits; subflows give repeated steps one home with typed inputs and outputs." }
            ]
          }
        ]
      },
      {
        id: "ai",
        name: "Agentforce & Einstein",
        icon: "bolt",
        lessons: [
          {
            id: "agentforce",
            title: "Agentforce and Einstein for builders",
            summary: "How agents use topics and actions, why your flows and invocable Apex become agent tools, and the guardrails that keep them safe.",
            minutes: 11,
            tags: ["agentforce", "einstein", "invocable"],
            blocks: [
              { t: "p", html: "An agent is a <strong>new colleague with a radio</strong>. It listens to the request, decides which job it is (a topic), and calls teammates who actually do the work (actions): your flows, invocable Apex and prompt templates. The model chooses <em>what</em> to call; your automation decides <em>what is allowed</em>. That split is the whole safety story." },
              { t: "table", headers: ["Building block", "What it is", "Builder's responsibility"], rows: [
                ["Agent", "A configured assistant for employees or customers", "Who it runs as, which channels, which topics"],
                ["Topic", "A job to be done: description, instructions, scope", "Clear boundaries and what is out of scope"],
                ["Action", "A flow, invocable Apex method, prompt template or standard action", "Bulk-safe, permission-aware logic with precise descriptions"],
                ["Reasoning engine", "Classifies the request, plans and calls actions", "Testing with realistic utterances"],
                ["Trust layer", "Masking, zero data retention with providers, toxicity checks, audit", "Still enforce sharing and FLS in actions"]
              ] },
              { t: "h", text: "An action the agent can call" },
              { t: "code", lang: "java", code: [
                "public with sharing class OrderStatusAction {",
                "    public class Request {",
                "        @InvocableVariable(label='Order number' description='The order number the customer gave, such as 00012345' required=true)",
                "        public String orderNumber;",
                "    }",
                "    public class Result {",
                "        @InvocableVariable(label='Status' description='One sentence describing the order status')",
                "        public String status;",
                "    }",
                "",
                "    @InvocableMethod(label='Get Order Status' description='Returns the current status of one order for the signed-in customer.')",
                "    public static List<Result> getStatus(List<Request> requests) {",
                "        Set<String> numbers = new Set<String>();",
                "        for (Request r : requests) { numbers.add(r.orderNumber); }",
                "        Map<String, Order> byNumber = OrderSelector.getInstance().byOrderNumbers(numbers); // WITH USER_MODE inside",
                "        List<Result> out = new List<Result>();",
                "        for (Request r : requests) {",
                "            Result res = new Result();",
                "            Order o = byNumber.get(r.orderNumber);",
                "            res.status = o == null ? 'No order with that number is visible to you.' : 'Order ' + o.OrderNumber + ' is ' + o.Status + '.';",
                "            out.add(res);",
                "        }",
                "        return out;",
                "    }",
                "}"
              ].join("\n") },
              { t: "note", variant: "tip", html: "The model reads labels and descriptions to pick an action and fill its inputs. Write them like an API contract for a new hire: what it does, what each input means, and what it returns." },
              { t: "h", text: "Guardrails" },
              { t: "ul", items: [
                "Prefer narrow actions (<em>get my order status</em>) over generic ones (<em>run any query</em>).",
                "Validate every input inside the action; treat conversation text as untrusted, like any user input.",
                "Run actions as the right user and keep <code class='tok'>with sharing</code> and <code class='tok'>WITH USER_MODE</code>, so the agent can never see more than the person it serves.",
                "Require confirmation before changes, and keep destructive operations out of autonomous agents.",
                "Test with many phrasings, including hostile ones, before activating."
              ] },
              { t: "h", text: "Other Einstein features you will meet" },
              { t: "table", headers: ["Feature", "Use"], rows: [
                ["Prompt templates (Prompt Builder)", "Reusable prompts grounded with merge fields, flows or Apex, callable from flows and agents"],
                ["Prediction Builder", "Predict a field value, such as churn risk, from historical records"],
                ["Lead and Opportunity Scoring", "Ranked scores from your sales history"],
                ["Next Best Action", "Recommendations driven by strategies and flows"]
              ] },
              { t: "note", variant: "warn", html: "Product names, packaging and limits in this area change quickly between releases. Learn the architecture (topics, actions, trust layer, user context), and check the current release notes before promising specific features." },
              { t: "cue", html: "Think agent actions when you hear <em>\"let customers ask where their order is\"</em> or <em>\"reuse our flows in the assistant\"</em>; think guardrails when you hear <em>\"the agent should be able to fix anything\"</em>." },
              { t: "quiz", id: "flow-ai" },
              { t: "note", variant: "key", html: "<strong>The model picks the action; your automation enforces the rules.</strong> Expose narrow, well-described, bulk-safe invocable actions that respect sharing and FLS, and validate every input." }
            ]
          }
        ]
      }
    ]
  };
})();
