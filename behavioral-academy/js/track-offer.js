/* =====================================================================
   COMPASS · Offers & Negotiation track   (curriculum + quizzes + widget)
   Registers window.TRACKS.offer, the offer-* quizzes, and offerCompLab.
   Self-contained: nothing outside this file needs to change.
   ===================================================================== */
(function () {
  "use strict";

  /* =====================================================================
     WIDGET — offerCompLab
     ===================================================================== */
  var Widgets = {};

  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }

  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, pill),
      h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
  }

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, value));
  }

  /* thousands separators, no currency symbol — the numbers are in whatever
     currency the reader's offer happens to be in */
  function money(n) {
    var v = Math.round(isFinite(n) ? n : 0);
    var neg = v < 0;
    var s = String(Math.abs(v));
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  /* read a field defensively: strip anything non-numeric, fall back to the
     default on empty / NaN / Infinity, then clamp. never throws. */
  function num(input, dflt, min, max) {
    var raw = input && input.value != null ? String(input.value) : "";
    var v = parseFloat(raw.replace(/[^0-9.]/g, ""));
    if (!isFinite(v)) v = dflt;
    if (v < min) v = min;
    if (v > max) v = max;
    return v;
  }

  /* Three vesting shapes, as fractions of the whole grant per year.
     The cliff row counts the 12-month tranche in year two on purpose: before
     that tranche lands, nothing at all is in your hands. Every row sums to 1,
     which is why the four-year average never moves when you switch shapes. */
  var SHAPES = [
    { v: "even",  label: "Even four-year", pct: [0.25, 0.25, 0.25, 0.25],
      verdict: "Even vesting tracks the headline most honestly: leave at 24 months and you keep about half the grant." },
    { v: "cliff", label: "1-yr cliff, then even", pct: [0.00, 0.50, 0.25, 0.25],
      verdict: "The cliff punishes leaving early hardest \u2014 walk before the 12-month mark and the equity line is worth nothing, whatever the headline said." },
    { v: "back",  label: "Back-loaded", pct: [0.10, 0.20, 0.30, 0.40],
      verdict: "A back-loaded grant only pays the headline to people who stay \u2014 two years in you have banked under a third of it, so read the four-year average as a projection, not a wage." }
  ];

  function shapeOf(v) {
    for (var i = 0; i < SHAPES.length; i++) if (SHAPES[i].v === v) return SHAPES[i];
    return SHAPES[0];
  }

  Widgets.offerCompLab = function (mount) {
    shell(mount, "calculator", "What the headline number is actually worth",
      "Type your own numbers in (any currency \u2014 the arithmetic does not care). Then switch the vesting shape and watch which years the money actually lands in.");

    var shapeKey = "even";
    var stage = h("div", { class: "w-stage" });
    var controls = h("div", { style: "display:flex;flex-wrap:wrap;gap:14px;align-items:center" });
    var readout = h("div", { class: "w-readout" });
    var verdict = h("p", { class: "widget-desc", style: "margin-top:14px" });
    var breakdown = h("div", { style: "font-family:var(--font-mono);font-size:.72rem;line-height:1.9;color:var(--text-dim);white-space:pre" });

    function field(labelText, dflt) {
      var input = h("input", { type: "text", inputmode: "numeric", "aria-label": labelText });
      input.value = String(dflt);
      input.addEventListener("input", paint);
      input.addEventListener("change", paint);
      controls.appendChild(h("label", { class: "w-field" }, labelText, input));
      return input;
    }

    var fBase  = field("Base", 150000);
    var fEqty  = field("Equity / yr", 60000);
    var fBonus = field("Bonus %", 15);
    var fSign  = field("Sign-on", 20000);

    var seg = h("div", { class: "w-seg" });
    for (var si = 0; si < SHAPES.length; si++) {
      (function (sh) {
        var b = h("button", { class: "w-seg-btn" + (sh.v === shapeKey ? " active" : ""), type: "button" }, sh.label);
        b.addEventListener("click", function () {
          shapeKey = sh.v;
          var all = seg.querySelectorAll("button");
          for (var j = 0; j < all.length; j++) all[j].classList.remove("active");
          b.classList.add("active");
          paint();
        });
        seg.appendChild(b);
      })(SHAPES[si]);
    }
    controls.appendChild(h("label", { class: "w-field" }, "Vesting", seg));

    function paint() {
      var base  = num(fBase, 150000, 0, 100000000);
      var eqty  = num(fEqty, 60000, 0, 100000000);
      var bonus = base * (num(fBonus, 15, 0, 200) / 100);
      var sign  = num(fSign, 20000, 0, 100000000);
      var sh = shapeOf(shapeKey);

      var grant = eqty * 4;                 // whole grant, spread over four years
      var year = [], i;
      for (i = 0; i < 4; i++) {
        year[i] = base + bonus + grant * sh.pct[i] + (i === 0 ? sign : 0);
      }
      var avg = (year[0] + year[1] + year[2] + year[3]) / 4;
      var banked24 = Math.round((sh.pct[0] + sh.pct[1]) * 100);

      breakdown.textContent =
        "                 base      bonus     equity    sign-on   total\n" +
        "  year 1     " + pad(money(base)) + pad(money(bonus)) + pad(money(grant * sh.pct[0])) + pad(money(sign)) + money(year[0]) + "\n" +
        "  year 2     " + pad(money(base)) + pad(money(bonus)) + pad(money(grant * sh.pct[1])) + pad("0") + money(year[1]) + "\n" +
        "  year 3     " + pad(money(base)) + pad(money(bonus)) + pad(money(grant * sh.pct[2])) + pad("0") + money(year[2]) + "\n" +
        "  year 4     " + pad(money(base)) + pad(money(bonus)) + pad(money(grant * sh.pct[3])) + pad("0") + money(year[3]);

      readout.innerHTML = "";
      readout.appendChild(ro("year one", money(year[0])));
      readout.appendChild(ro("year two", money(year[1])));
      readout.appendChild(ro("four-year average", money(avg)));
      readout.appendChild(ro("grant banked by month 24", banked24 + "%"));

      verdict.textContent = sh.verdict +
        " The four-year average does not move when you change the shape \u2014 only the timing does, and the timing is the part you actually live through.";
    }

    function pad(s) {
      s = String(s);
      while (s.length < 10) s += " ";
      return s;
    }

    stage.appendChild(breakdown);
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    mount.appendChild(verdict);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {

    "offer-anatomy": {
      title: "What's on the table \u2014 checkpoint",
      sub: "Components, vesting shapes, levels and bands, and honest leverage.",
      questions: [
        {
          q: "Two offers quote the same four-year total. Offer A vests evenly across four years; offer B is back-loaded, paying most of the grant in years three and four. You think there is a real chance you leave after two years. Which is worth more to you?",
          options: [
            "Offer B, because back-loaded schedules normally come with a larger headline total",
            "Offer B, because unvested equity is normally paid out when you leave",
            "They are identical, because the four-year totals match",
            "Offer A, because more of the grant lands inside the window you will actually be there"
          ],
          answer: 3,
          explain: "Equity is only worth what vests while you are still employed, so the shape matters as much as the total. Under even vesting you have banked about half the grant at 24 months; under a back-loaded schedule you have banked far less, because the large tranches are still ahead of you. Unvested equity is normally forfeited on departure, not paid out, so the headline four-year total quietly assumes you stay all four years."
        },
        {
          q: "Your grant has a one-year cliff and you resign at month eleven. What have you earned from the equity component?",
          options: [
            "Nothing from the grant",
            "About eleven twelfths of the first year's tranche",
            "About a quarter of the grant, prorated across eleven months",
            "The full first-year tranche, paid out at exit"
          ],
          answer: 0,
          explain: "That is the entire point of a cliff: nothing vests at all until the cliff date, so there is no proration to claim. This is why a cliff makes a headline number much riskier than an even schedule for anyone who is unsure about the role. If you are joining a situation you are not confident about, the cliff is a real cost that never appears in the total-compensation figure."
        },
        {
          q: "A recruiter tells you base is already at the top of the band for your level. Which component is most commonly available as an alternative lever?",
          options: [
            "The bonus target percentage, since it is set individually",
            "A one-time sign-on, which sits outside the recurring band",
            "The vesting schedule, which is usually written per candidate",
            "The benefits package, which is usually chosen per candidate"
          ],
          answer: 1,
          explain: "A sign-on is generally the most flexible component precisely because it is one-time: it does not raise your position in the band, so it does not create an internal-equity problem the way an out-of-band base would. Bonus targets and vesting schedules are usually set uniformly by level or by policy, and benefits are almost never individually negotiable. Worth checking whether the sign-on carries a clawback if you leave inside the first year."
        },
        {
          q: "Your loop landed you one level below the one you targeted, and the offer already sits near the top of that lower band. What is usually the higher-value thing to push on?",
          options: [
            "The very top of the lower band, since you are already close to it",
            "A larger sign-on, to bridge the gap for the first year",
            "The level itself, using concrete scope evidence from your own work",
            "The bonus target, since it compounds with base"
          ],
          answer: 2,
          explain: "Being near the top of a band means the dollar negotiation has almost no room left in it, while a level change moves you to a different band entirely. A strong position in a lower band is also a weak place to start from: your next raise, bonus target and promotion all get measured against that band's ceiling. A sign-on only papers over year one and leaves the structural problem in place."
        },
        {
          q: "You have no competing offer. Which of these is the most honest description of your position?",
          options: [
            "You have no negotiating room at all; accept the offer or withdraw",
            "You should imply another process is further along than it really is",
            "You have the same leverage as a competing offer as long as you ask confidently",
            "You have real but smaller room, built on scope, band data and the cost to them of restarting the search"
          ],
          answer: 3,
          explain: "Leverage-free negotiation genuinely has a lower ceiling, and pretending otherwise leads people to over-push and damage the relationship. What you do still have is real: the scope you are stepping into, whatever you can see of the band, the sunk cost of their search, and the simple fact that asking politely is usually free. Inventing a competing offer is the one move that can lose you the offer outright, because it can be checked and it changes how they read everything else you said."
        },
        {
          q: "When is the most effective moment to influence the level you are offered?",
          options: [
            "During the loop, by making the scope of your own work explicit in your stories",
            "After the written offer arrives, when the recruiter has approval to adjust it",
            "At the reference-check stage, when the manager is most invested",
            "Six months after joining, at the first performance cycle"
          ],
          answer: 0,
          explain: "Level is normally decided from the evidence the loop produced, so the leverage is in the loop itself: how much you owned, how much ambiguity you absorbed, how wide the blast radius of your decisions was. By the time the written offer exists, that evidence is already recorded and the recruiter is typically working inside a level someone else set. Asking what evidence would change the level is still worth doing, but it is a much harder conversation than telling the right stories two weeks earlier."
        }
      ]
    },

    "offer-execution": {
      title: "Running the conversation \u2014 checkpoint",
      sub: "Recruiter authority, counter framing, and the self-inflicted mistakes.",
      questions: [
        {
          q: "You ask for a base increase that would put you above the published band for your level. What is the most likely outcome?",
          options: [
            "The recruiter approves it, since base is the easiest lever they hold",
            "It needs an exception approved above the recruiter, and is often refused",
            "It is granted automatically once you mention a competing offer",
            "The recruiter has to withdraw the offer to protect internal equity"
          ],
          answer: 1,
          explain: "Out-of-band base is usually the single hardest ask in the whole conversation, because it creates a permanent internal-equity problem that outlives your hire. Most recruiters can move freely inside the band and need sign-off above it, so an out-of-band request turns into an exception request with a real chance of a no. If base is the binding constraint, the productive move is to accept the ceiling out loud and redirect to a one-time component."
        },
        {
          q: "What makes a recruiter most able to argue your case upward?",
          options: [
            "A firm deadline plus a clear statement that the current number is unacceptable",
            "A list of every component you would like improved",
            "One specific number attached to a reason they can repeat to an approver",
            "A candid account of the personal financial pressure you are under"
          ],
          answer: 2,
          explain: "The recruiter is not the decision-maker on exceptions; they are the person who has to retell your case to someone who never met you. A single number with a reason attached survives that retelling intact, while a long list forces them to choose for you and a bare demand gives them nothing to say. Personal need is sympathetic but is not an argument an approver can act on, because it says nothing about the role."
        },
        {
          q: "Early in the process a recruiter asks what number you are looking for. What is the strongest response?",
          options: [
            "Give a wide range, so they cannot anchor you at the bottom of it",
            "Give your current compensation, to keep the conversation honest",
            "Give a deliberately high number so their counter lands where you want it",
            "Ask for the band for the level, and say you will engage on numbers once scope and level are settled"
          ],
          answer: 3,
          explain: "Whoever names a number first sets the ceiling of the conversation, and this early you do not yet know the level, so any number you name is a guess against unknown information. Redirecting to the band is not evasion: it answers the real question, which is whether the two of you are in the same universe. Naming a wide range hands them the bottom of it, and naming your current pay anchors your next role to your last one."
        },
        {
          q: "You need more time and have another loop finishing next week. What framing best protects the relationship?",
          options: [
            "Name a specific date, say what will happen by then, and reconfirm your interest",
            "Ask for an open-ended extension until you have made up your mind",
            "Say nothing and let the deadline pass, since deadlines are rarely enforced",
            "Tell them your competing offer expires sooner than it actually does"
          ],
          answer: 0,
          explain: "An extension request reads as stalling unless it comes with a date and a reason, because the fear on their side is that you are shopping the offer indefinitely. A specific date plus a reconfirmation of interest converts the same request into a plan they can hold you to. Silence and open-ended requests both spend goodwill for nothing, and inventing a deadline is a claim that can be checked."
        },
        {
          q: "Grade this counter: \u201cI need more than this to make it work.\u201d",
          options: [
            "Great \u2014 it is short, firm, and leaves the number to them",
            "Bad \u2014 it gives no number and no reason, so there is nothing to take upward",
            "Good \u2014 it signals a gap without over-explaining",
            "Bad \u2014 it is far too aggressive for a first counter"
          ],
          answer: 1,
          explain: "The problem is not tone, it is that the sentence cannot be acted on: the recruiter has to guess your number, invent your reason, and then defend both to an approver. Leaving the number to them sounds generous but almost always produces the smallest move they can justify. The upgrade is one number plus one reason \u2014 scope, band position, or a competing figure \u2014 and ideally a sentence that says what closes it."
        },
        {
          q: "Which of these sentences most damages your own position?",
          options: [
            "Here is the scope I am stepping into, and here is the number that closes it.",
            "Could you tell me the band for this level?",
            "I know this probably is not possible, but could you take another look at base?",
            "I would like to come back to you on Thursday with a decision."
          ],
          answer: 2,
          explain: "That sentence concedes the answer before the other side has said anything, which is the clearest form of negotiating against yourself. Pre-apologising invites the easy no, and it tells the recruiter they do not need to spend any effort advocating for you. The same request without the disclaimer costs you nothing and keeps the burden of saying no where it belongs."
        }
      ]
    },

    "offer-close": {
      title: "Closing well \u2014 checkpoint",
      sub: "Accepting, declining, and handling the offer that gets pulled.",
      questions: [
        {
          q: "You have agreed terms verbally. What should happen next?",
          options: [
            "Nothing \u2014 the verbal agreement is what counts and the paperwork just follows",
            "Resign from your current role immediately so the start date is safe",
            "Ask for one more improvement, since acceptance is your moment of maximum leverage",
            "Confirm the agreed components in writing before you stop your other processes"
          ],
          answer: 3,
          explain: "Verbal agreements drift, not usually through bad faith but because four components discussed across three calls are easy to misremember. A short written summary \u2014 base, bonus target, grant value, vesting schedule, sign-on and any clawback \u2014 costs nothing and catches the gap while it is still cheap to fix. Resigning or shutting down other processes before the written offer exists removes your only fallback at exactly the wrong moment."
        },
        {
          q: "You are declining an offer you worked hard to get. What most protects the relationship?",
          options: [
            "Decline promptly and warmly, name what you valued, and leave the door open",
            "Explain in detail everything that was wrong with the offer",
            "Decline by simply not replying, to avoid an awkward conversation",
            "Ask them to counter one more time so the decision feels justified"
          ],
          answer: 0,
          explain: "Recruiters and hiring managers have long memories and small worlds, and you may well be in front of these same people in two years. A prompt, specific, warm no costs you one message and leaves you as someone they would re-open a process for. Going silent is remembered, an itemised critique invites a defensive reply, and asking for a counter you will not accept spends their approval capital for nothing."
        },
        {
          q: "Why is an early verbal \u201cyes, that works\u201d expensive?",
          options: [
            "It is legally binding in most places, so the terms become fixed",
            "It ends the negotiation in one sentence, and reopening it afterwards costs goodwill",
            "It automatically cancels any competing processes you have open",
            "It transfers the level decision to the hiring committee"
          ],
          answer: 1,
          explain: "Acceptance is the moment your leverage goes to zero, because the thing they wanted from you has already been given. You can technically raise something afterwards, but you now look like you are moving the goalposts, and that impression follows you into the team you are about to join. If you are still thinking, say you are still thinking \u2014 enthusiasm about the role is free, agreement to the terms is not."
        },
        {
          q: "An offer you had accepted is rescinded before your start date. What is the most useful first move?",
          options: [
            "Assume it is a negotiation tactic and hold firm on your original start date",
            "Wait quietly and give them time to resolve it internally",
            "Get the facts and the timing in writing, then restart your search and ask what support is available",
            "Escalate publicly so the decision gets reversed"
          ],
          answer: 2,
          explain: "Rescinded offers are almost always about budget or headcount rather than about you, so treating it as a tactic wastes the only thing you are short of, which is time. Getting it in writing establishes what happened and when, which matters for any notice you have already given and for anything they might offer by way of help. Asking directly what support exists is reasonable and sometimes produces something; waiting quietly reliably produces nothing."
        },
        {
          q: "You have a warm verbal yes and the written offer is \u201ccoming this week\u201d. Your other two processes are at final round. What is the right sequence?",
          options: [
            "Withdraw from the other processes now, as a courtesy to their recruiters",
            "Keep the other processes alive and hold off resigning until the signed written offer is in your hands",
            "Resign today so your notice period overlaps with the paperwork",
            "Tell your current manager informally so they are not surprised later"
          ],
          answer: 1,
          explain: "The gap between a verbal yes and a countersigned letter is the most expensive window in a job search, because it is exactly when an offer can still be resized or pulled. Every irreversible step \u2014 resigning, telling your manager, closing other loops \u2014 belongs after the signature, not before. Once it is signed, withdraw from the other processes promptly and warmly; doing it the same day is the courtesy, doing it early is just giving away your fallback."
        }
      ]
    }
  });

  /* =====================================================================
     TRACK
     ===================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.offer = {
    id: "offer",
    name: "Offers & Negotiation",
    short: "OFFER",
    tagline: "The last conversation pays the most per minute",
    color: "#fbbf24",
    blurb: "The half-hour at the end of a hiring process where the number gets decided. What an offer is actually made of and which parts of it move, why level matters more than dollars, what a recruiter can and cannot approve, the exact words for a counter with and without competing leverage, the mistakes candidates inflict on themselves, and how to accept or decline without damaging a relationship you may need again.",
    modules: [

      /* ==================== MODULE 1 · ANATOMY ==================== */
      {
        id: "anatomy",
        name: "What's Actually On The Table",
        icon: "blocks",
        lessons: [

          /* ---------- 1.1 components ---------- */
          {
            id: "components",
            title: "The components of an offer, and which ones move",
            summary: "An offer is a bundle of parts with wildly different degrees of freedom. Learn which parts flex, which are policy, and why the headline total lies.",
            minutes: 9,
            tags: ["offer", "compensation", "mental-model"],
            blocks: [
              { t: "p", html: "The mental model to hold: <strong>an offer is not a number, it is a bundle</strong>, and the parts of the bundle have completely different degrees of freedom. Some are set by a policy nobody in the conversation can override. Some the recruiter can adjust in the next five minutes. Treating the whole thing as one figure to push against is why most negotiations produce a small, grudging move on the hardest component instead of a large, easy move on a soft one." },
              { t: "p", html: "So before you push on anything, take the offer apart. Every component answers three separate questions: how much is it, how likely is it to actually arrive, and can it move?" },
              { t: "h", text: "What is in the envelope" },
              { t: "ul", items: [
                "<strong>Base salary</strong> — the recurring, certain part. It also sets the denominator for your bonus and for future percentage raises, which is why it compounds in a way nothing else does.",
                "<strong>Equity grant</strong> — usually quoted as a total value across a vesting period. Two numbers matter, not one: the size of the grant and the <em>shape</em> of the schedule that releases it.",
                "<strong>Annual bonus</strong> — almost always a <em>target</em> percentage of base, not a guarantee. A target is a forecast about a future payout decision.",
                "<strong>Sign-on</strong> — a one-time payment, sometimes split across the first year or two, and often carrying a clawback if you leave early.",
                "<strong>Everything else</strong> — benefits, leave policy, relocation, start date, review-cycle timing, title and level. Mostly fixed, but two of them are unusually cheap to ask for and we will come back to that."
              ] },
              { t: "h", text: "Why the headline number lies" },
              { t: "p", html: "Equity is the component that breaks naive comparison, because it is quoted as a total but delivered on a schedule. You do not own the total; you own whatever has vested on the day you leave. Change the schedule and the headline stays identical while the value to a specific person changes enormously." },
              { t: "code", lang: "text", code:
                "Three offers, identical headline: \"grant worth 4G over four years\"\n" +
                "\n" +
                "                              Y1     Y2     Y3     Y4\n" +
                "  even four-year vest        25%    25%    25%    25%\n" +
                "  1-yr cliff, then even       0%    50%    25%    25%\n" +
                "  back-loaded                10%    20%    30%    40%\n" +
                "\n" +
                "grant banked if you leave at month 24\n" +
                "  even            50% of the grant\n" +
                "  cliff           50%  (but 0% if you leave at month 11)\n" +
                "  back-loaded     30% of the grant\n" +
                "\n" +
                "the four-year average is identical in all three rows.\n" +
                "only the timing differs -- and the timing is what you live through."
              },
              { t: "p", html: "The cliff row groups the twelve-month tranche into year two on purpose. Nothing is in your hands before that tranche lands, so if you resign at month eleven the equity component of your offer was worth exactly zero. Meanwhile the back-loaded row is the one that quietly assumes you will still be there in year four to collect the largest slice. <strong>Neither of those assumptions is in the headline total.</strong>" },
              { t: "note", variant: "tip", html: "Ask two questions about the bonus that most people skip: is the target a percentage of base or a fixed amount, and what has the company actually paid against target recently? A widely-reported pattern is that targets are described as if they were entitlements and then paid at a company-performance multiplier. Discount a target you cannot verify." },
              { t: "h", text: "Which parts actually move" },
              { t: "table",
                headers: ["Component", "Typically movable?", "What it's really worth"],
                rows: [
                  ["Base salary", "Sometimes, within the band for your level", "The only certain, recurring number — and the one that compounds into future raises and bonus"],
                  ["Equity grant", "Often, and frequently the easiest large move", "Only what vests while you are still there. Read the schedule before you read the total"],
                  ["Annual bonus target", "Rarely — usually fixed per level by policy", "A forecast, not a promise. Discount it if you cannot learn the recent payout history"],
                  ["Sign-on", "Usually the most movable single component", "Real cash, but it buys one year and may carry a clawback if you leave early"],
                  ["Level / title", "Movable on evidence, and mostly <em>before</em> the offer exists", "The band itself — the largest lever in the entire conversation"],
                  ["Benefits, leave, policy", "Effectively fixed", "Not worth spending negotiating capital on"],
                  ["Start date, first review date", "Often movable and cheap to ask for", "Genuinely valuable, and almost nobody asks"]
                ]
              },
              { t: "widget", id: "offerCompLab" },
              { t: "h", text: "The trade-off nobody names" },
              { t: "compare",
                bad: { title: "Optimising the headline", items: ["Chase the biggest four-year total", "Accept any vesting shape that gets you there", "Take sign-on as if it were salary", "Compare two offers on one number"] },
                good: { title: "Optimising for the years you'll be there", items: ["Weight the grant by what vests inside your realistic horizon", "Treat a cliff as a real risk, not a formality", "Read sign-on as a one-year bridge with possible strings", "Compare offers year by year, then on the average"] }
              },
              { t: "p", html: "The cost of the right-hand column is that it sometimes tells you to take the smaller headline, and that is genuinely uncomfortable to do. A back-loaded offer with a bigger total is the better deal <em>if</em> you stay; the honest question is what you actually believe about that, and the honest answer is usually less confident than the spreadsheet." },
              { t: "note", variant: "trap", html: "The most common self-inflicted error in this lesson is negotiating hard on the bonus target. It is usually fixed per level, so you spend real credibility to be told no, and you spend it before you have asked about the sign-on — which was sitting there, soft, the whole time." },
              { t: "note", variant: "key", html: "<strong>Take the offer apart before you push on it.</strong> Sign-on is usually softest, equity is often next, base moves only inside its band, and bonus target and benefits are usually policy. And never compare two offers on the headline total when the vesting shapes differ — compare them year by year, against how long you honestly expect to stay." }
            ]
          },

          /* ---------- 1.2 level-bands ---------- */
          {
            id: "level-bands",
            title: "Level determines the band, so level is the negotiation",
            summary: "Dollars move you inside a band; level moves you to a different band. That single fact reorders everything you should be doing and when.",
            minutes: 8,
            tags: ["offer", "levels", "strategy"],
            blocks: [
              { t: "p", html: "Here is the structural fact that most candidates learn one negotiation too late: <strong>your level selects a band, and every dollar conversation happens inside that band.</strong> Negotiating dollars is asking to move within a range someone else already chose for you. Negotiating level is asking for a different range. These are not two versions of the same conversation; one has roughly an order of magnitude more upside than the other." },
              { t: "stat", items: [
                { v: "1 level", k: "moves you to an entirely different band" },
                { v: "~1 notch", k: "is what most dollar counters actually move you" },
                { v: "0", k: "levels a recruiter can typically re-grant alone" }
              ] },
              { t: "h", text: "How bands actually behave" },
              { t: "p", html: "Bands overlap, and the overlap is where the damage hides. The top of one level's band commonly reaches past the bottom of the next level's band, which means a well-paid position in a lower band and a modest position in the next band up can be <em>the same number on day one</em> — and then diverge for years." },
              { t: "code", lang: "text", code:
                "band overlap, schematically\n" +
                "\n" +
                "  level N     [------------------]\n" +
                "  level N+1            [------------------]\n" +
                "  level N+2                     [------------------]\n" +
                "                       ^        ^\n" +
                "                       |        |\n" +
                "              bottom of N+1   top of N\n" +
                "\n" +
                "these two can be the same number today.\n" +
                "they are not the same position:\n" +
                "  - your next raise is a % of a different base\n" +
                "  - your bonus target is set by level, not by base\n" +
                "  - your next promotion starts from a lower ceiling\n" +
                "  - your next grant is sized off the level band"
              },
              { t: "p", html: "So the trade-off is explicit and it is about time. Taking the top of a lower band is better <em>this year</em> and worse for every year after it, because four separate mechanisms — raise percentages, bonus target, grant sizing, and promotion runway — are all indexed to the level rather than to the number you negotiated." },
              { t: "h", text: "Dollars versus level" },
              { t: "compare",
                bad: { title: "Negotiating dollars, late", items: ["Starts when the written offer arrives", "Ceiling is the top of a band you didn't choose", "Recruiter can often decide it alone — which is why it is small", "Wins are one-time and do not change your trajectory", "Best case: you move a notch inside the band"] },
                good: { title: "Negotiating level, early", items: ["Starts in the loop, through the scope in your stories", "Ceiling is a different band entirely", "Requires evidence a committee or manager will accept", "Wins compound through raises, bonus, grants and promotion", "Best case: every future conversation starts higher"] }
              },
              { t: "h", text: "What follows from this" },
              { t: "ul", items: [
                "<strong>Negotiate level early, not dollars late.</strong> Level is normally inferred from loop evidence — how much you owned, how much ambiguity you absorbed, how wide the consequences of your calls were. That evidence is produced in your stories, weeks before anyone talks money.",
                "<strong>A down-level at a strong band position is usually worse than the next level at its floor.</strong> Same money now; different ceiling, different bonus target, different grant sizing, and a promotion you now have to earn to get back to where you thought you already were.",
                "<strong>If you're told the level is fixed, ask what evidence would change it.</strong> That is a genuinely different question from asking them to change it, and it sometimes gets you a real answer: a missing scope signal, a specific concern from one interviewer, or a straight \u201cnothing would, the band is full.\u201d All three are useful.",
                "<strong>Ask when the first review cycle is</strong> and whether you are eligible. A level you can be re-evaluated for in six months is a very different proposition from one you carry for two years."
              ] },
              { t: "note", variant: "trap", html: "Do not push for a level you cannot hold. Being up-levelled into a bar you fail to clear is worse than starting one level down and being visibly strong — the first performance cycle is a much harsher audience than a recruiter, and a down-level after joining is far more expensive than one before." },
              { t: "table",
                headers: ["What candidates say", "Why it doesn't move a level", "What would"],
                rows: [
                  ["\u201cI have eight years of experience\u201d", "Tenure is an input, not evidence of scope", "\u201cFor the last two years I owned the whole X surface, including the on-call and the roadmap for it\u201d"],
                  ["\u201cMy current title is senior\u201d", "Titles are not comparable across companies", "\u201cHere is the decision I made that nobody above me reviewed, and what it cost when I got it wrong\u201d"],
                  ["\u201cThe other offer is at a higher level\u201d", "It tells them about another company's calibration, not about you", "\u201cHere is the scope the other role scoped me into — the same scope this role describes\u201d"],
                  ["\u201cI'll prove it in six months\u201d", "It asks them to take the risk instead of the evidence", "\u201cWhat evidence from the loop was missing? I can speak to it directly\u201d"]
                ]
              },
              { t: "cue", html: "You are in a <strong>level</strong> conversation, not a dollar conversation, whenever you hear: \u201cthe band for this level tops out at\u2026\u201d, \u201cwe scoped you as a strong fit for level N\u201d, \u201cthat number would be out of band\u201d, or \u201cwe could revisit at the next cycle.\u201d Every one of those sentences is telling you where the real constraint is." },
              { t: "note", variant: "key", html: "<strong>The band is set by the level, so the level is the negotiation.</strong> Do it in the loop with scope evidence, not in the offer call with a number. And when you compare a strong position in a lower band against a weak position in the next one, remember you are comparing this year's cash against every subsequent year's ceiling." }
            ]
          },

          /* ---------- 1.3 leverage ---------- */
          {
            id: "leverage",
            title: "Leverage, and what to do without it",
            summary: "Competing offers are the only strong leverage. Here is how to use timing, and the honest — smaller — version of the conversation when you have neither.",
            minutes: 8,
            tags: ["offer", "leverage", "timing"],
            blocks: [
              { t: "p", html: "Leverage in a negotiation is one thing only: <strong>a credible alternative</strong>. Not how much you deserve it, not how well the loop went, not how confidently you ask. The reason a competing offer is powerful is not that it is impressive; it is that it makes the cost of losing you concrete and immediate to someone who has to decide today." },
              { t: "p", html: "Which means the honest ranking of leverage sources is short, and most of what candidates believe is leverage is not." },
              { t: "h", text: "What counts, ranked" },
              { t: "table",
                headers: ["Source", "Real strength", "How to use it"],
                rows: [
                  ["A written competing offer", "Strongest", "Name the number and the component. One number, once. Attach a close: \u201cthis gets it signed\u201d"],
                  ["A live process you're confident in", "Moderate", "Use it for <em>timing</em>, not for numbers. Ask for a date, don't imply a figure you don't have"],
                  ["The scope you're stepping into", "Moderate and underused", "Compare the role's stated scope to what you already own. This is the reason an approver can repeat"],
                  ["Whatever you can see of the band", "Moderate", "Anchor on band position — \u201cthis sits near the floor\u201d — rather than on a number out of the air"],
                  ["Their cost of restarting the search", "Weak but real", "Never say it out loud. It is why a modest ask is usually cheaper for them than a no"],
                  ["Being the strongest candidate they saw", "Weak", "It is why you got the offer. It is not why they would raise it"],
                  ["Your personal financial need", "None", "It is not an argument an approver can act on. Leave it out"]
                ]
              },
              { t: "h", text: "Timing is the leverage you can manufacture" },
              { t: "p", html: "You usually cannot create a competing offer on demand, but you can often influence <em>when</em> decisions land. Two processes that finish within the same week give you a real choice; the same two processes three weeks apart give you none. This is the one part of your leverage you can actually build, and it is built early — by pacing the slower process up and asking the faster one for room, before either has produced an offer." },
              { t: "code", lang: "text", code:
                "the shape you want                the shape you usually get\n" +
                "\n" +
                "  A: offer ----+                   A: offer --+\n" +
                "  B: offer ----+                              |  (expires)\n" +
                "               |                              +--> decide blind\n" +
                "               +--> real choice    B: offer ------------+\n" +
                "\n" +
                "levers, in the order they are worth pulling:\n" +
                "  1. ask the slow process to compress  (\"can the last two\n" +
                "     rounds be in the same week?\")\n" +
                "  2. ask the fast process for a specific date\n" +
                "  3. accept that sometimes you must decide on one offer,\n" +
                "     and decide on the role rather than on the number"
              },
              { t: "p", html: "Asking for an extension is not a hostile act, but it becomes one if you do it wrong. An open-ended \u201ccan I have more time\u201d reads as shopping the offer; a specific date with a reason and a reconfirmation of interest reads as a plan. The trade-off is real, though: every extension you ask for spends a little goodwill, and a second extension spends considerably more than the first." },
              { t: "h", text: "When there is no competing offer" },
              { t: "p", html: "Be clear-eyed here, because this is where most advice starts inventing things. With no alternative, <strong>your ceiling is genuinely lower</strong>. You can often still move the offer, and it is almost always worth trying, but you should expect a smaller move and you should not push as if the balance of power were even. Anyone telling you that confidence substitutes for an alternative is selling you something." },
              { t: "ul", items: [
                "<strong>Band position.</strong> If you can establish, even roughly, that the offer sits near the floor of the band, \u201ccan we get to the midpoint\u201d is a specific and defensible ask that does not require an alternative.",
                "<strong>The scope you're stepping into.</strong> If the role is a genuine step up from what you do now, say so concretely. This is the reason a recruiter can carry upward, and it is available to everyone.",
                "<strong>Their sunk cost.</strong> A search that has run for weeks and produced one acceptable candidate is expensive to restart. You never mention this — it is simply why a modest ask is cheaper for them to grant than to refuse.",
                "<strong>Just asking.</strong> Unglamorous, and the most underused move in the whole topic. A polite, specific, single ask is very rarely penalised. The most common reason people get nothing is that they never asked.",
                "<strong>The cheap non-cash asks.</strong> Start date, an earlier first review, a specific team or scope commitment in writing. These frequently cost the company little and are worth real money to you."
              ] },
              { t: "note", variant: "warn", html: "Never invent a competing offer, and never inflate a real one. It can be checked more easily than people assume, it converts a negotiation into a credibility problem, and it retroactively makes every other claim you made in the loop look negotiable. It is the one move in this entire track that can lose you the offer outright." },
              { t: "compare",
                bad: { title: "Overplaying a hand you don't have", items: ["Implying another process is at offer stage", "Multiple rounds of counters with nothing behind them", "Hard deadlines you cannot enforce", "Reading a first no as an opening move"] },
                good: { title: "Playing a small hand well", items: ["Saying plainly that you're not shopping it", "One specific ask, anchored on scope or band", "Naming what closes it, and meaning it", "Taking a genuine no as information and moving to a softer component"] }
              },
              { t: "cue", html: "You <strong>actually</strong> have leverage when at least one of these is true: a written offer exists elsewhere, a second process will conclude inside their decision window, the role's stated scope visibly exceeds your current level, or they have told you in some form that you are their choice. If none of those hold, you are in the small-ceiling conversation — still worth having, but ask once, ask specifically, and don't bluff." },
              { t: "note", variant: "key", html: "<strong>Leverage is a credible alternative, and nothing else substitutes for it.</strong> Build timing early so two processes can land together; if they can't, negotiate on scope and band position, ask once and specifically, and accept the smaller ceiling honestly. Bluffing an offer is the one unforced error that can cost you the whole thing." },
              { t: "quiz", id: "offer-anatomy" }
            ]
          }
        ]
      },

      /* ==================== MODULE 2 · EXECUTION ==================== */
      {
        id: "execution",
        name: "Running The Conversation",
        icon: "compass",
        lessons: [

          /* ---------- 2.1 recruiter-scope ---------- */
          {
            id: "recruiter-scope",
            title: "What a recruiter can and cannot approve",
            summary: "The person you're negotiating with is an intermediary with a band, an approval ceiling, and a strong incentive to close. Work with all three.",
            minutes: 7,
            tags: ["offer", "recruiter", "mental-model"],
            blocks: [
              { t: "p", html: "The mental model: <strong>the recruiter is not your opponent and not your advocate — they are an intermediary with a band, a ceiling, and a quota.</strong> They generally want to close you, which is genuinely on your side. They also want to close you at a number that does not cost them an exception request, which is genuinely not. Both are true simultaneously and neither is personal." },
              { t: "p", html: "Everything useful follows from one question: for any given ask, <em>who has to say yes?</em> If the answer is \u201conly them,\u201d you can get a decision in one call. If the answer is \u201csomeone who has never met you,\u201d your ask has to survive being retold by a third party." },
              { t: "h", text: "What they're optimising for" },
              { t: "ul", items: [
                "<strong>Closing the requisition</strong> — an accepted offer is the outcome they are measured on. A candidate who says \u201cX closes it today\u201d is offering them exactly what they want.",
                "<strong>Not spending exception capital</strong> — every out-of-band request costs them credibility with approvers they will need again next quarter.",
                "<strong>Internal equity</strong> — an offer that lands above existing people at the same level creates a problem that outlives your hire. This is why base is so much stickier than sign-on.",
                "<strong>Speed</strong> — an open role is a cost. Deadlines are usually about pipeline management, not pressure tactics.",
                "<strong>Not being surprised</strong> — a counter they saw coming is easy to handle; one that arrives after they told their manager you were closed is not."
              ] },
              { t: "h", text: "Three tiers of approval" },
              { t: "table",
                headers: ["Your ask", "Who typically has to sign off", "How to pitch it"],
                rows: [
                  ["Move within the band for your level", "Often the recruiter alone", "Ask directly and specifically. This is the fastest yes available to you"],
                  ["A sign-on, or an increase to one", "Recruiter, sometimes with a manager nod", "Frame it as one-time and band-neutral — that is exactly why it is easy for them"],
                  ["A larger equity grant", "Usually a manager or a comp partner", "Tie it to scope. Grants are commonly sized to level and impact, so give them the impact"],
                  ["Base above the band", "An exception, above the recruiter", "Expect friction and a real chance of no. Say out loud that you know it's an exception"],
                  ["A level change", "Hiring manager plus whoever calibrates levels", "Only lands on loop evidence. Ask what evidence would move it"],
                  ["Benefits, leave, bonus target", "Nobody — these are policy", "Don't spend capital here. Ask once for information, then drop it"],
                  ["Start date, first review timing", "Usually the hiring manager, cheaply", "Ask plainly. This is the most underused row in the table"]
                ]
              },
              { t: "p", html: "The practical consequence is that the order you ask in matters as much as what you ask for. Opening with the hardest row spends your credibility on the least likely yes, and by the time you get to the easy rows the conversation already feels adversarial." },
              { t: "h", text: "Give them a sentence they can repeat" },
              { t: "p", html: "This is the highest-leverage idea in the lesson. The recruiter frequently is not the decision-maker on your ask — they are the person who has to <em>retell your case</em> to someone who never met you, probably in one line, probably over chat. So write that line for them." },
              { t: "code", lang: "text", code:
                "what they have to say upward, in one line:\n" +
                "\n" +
                "  bad   \"the candidate says the offer is too low\"\n" +
                "        -> approver has nothing to act on. easy no.\n" +
                "\n" +
                "  good  \"candidate is asking for the band midpoint\"\n" +
                "        -> actionable, but no reason attached.\n" +
                "\n" +
                "  great \"candidate already owns the surface this role\n" +
                "         covers, has a competing offer at X, and will\n" +
                "         sign today at the midpoint\"\n" +
                "        -> a reason, a number, and a close. this one\n" +
                "           survives being retold."
              },
              { t: "p", html: "Notice what the third version does: it supplies the justification, the specific figure, and the outcome. An approver reading it does not have to reconstruct anything or come back with questions. You have converted your ask from a complaint into a decision someone can make in ten seconds." },
              { t: "compare",
                bad: { title: "A demand", items: ["\u201cThis isn't enough\u201d", "No number, so they have to guess low", "No reason, so there's nothing to escalate with", "Pressure with no path to yes", "Makes the recruiter defend, not advocate"] },
                good: { title: "A reason they can repeat", items: ["One specific number", "One reason tied to scope or band position", "An explicit close: \u201cthis gets it signed\u201d", "Flexibility on mechanism — base or sign-on, either works", "Makes the recruiter your co-author"] }
              },
              { t: "note", variant: "tip", html: "Ask, early and neutrally: \u201cwhat's in your control here, and what needs approval above you?\u201d Most recruiters answer this honestly, because it makes their job easier. It also hands you the entire map of where to spend your one real ask." },
              { t: "note", variant: "trap", html: "Do not treat a first no as a negotiating position by default. Sometimes it is, but sometimes it is a policy wall and pushing a second time on the same component tells them you were not listening — which makes the next, softer ask much harder to grant." },
              { t: "note", variant: "key", html: "<strong>Ask \u201cwho has to say yes?\u201d before you ask for anything.</strong> Then hand the recruiter one number and one reason they can repeat upward verbatim, offer flexibility on which component delivers it, and attach a close. You are not persuading them; you are equipping them." }
            ]
          },

          /* ---------- 2.2 counter-scripts ---------- */
          {
            id: "counter-scripts",
            title: "Counter framing, with actual words",
            summary: "Six situations, six scripts you can say out loud, and a Naive / Solid / Standout ladder for the framings that decide how each one lands.",
            minutes: 11,
            tags: ["offer", "scripts", "framing"],
            blocks: [
              { t: "p", html: "Knowing what to ask for and being able to say it are different skills, and the second one fails under pressure far more often. So here are the words. Adapt the wording to sound like you — but keep the <em>structure</em>, because the structure is what makes each one work." },
              { t: "note", variant: "tip", html: "Four rules that apply to every script below: <strong>one number</strong> (a range invites the bottom of it), <strong>one reason</strong> the recruiter can repeat upward, <strong>warm tone</strong> because you are about to work with these people, and <strong>an explicit close</strong> so they know what a yes buys them." },

              { t: "h", text: "Before you name anything" },
              { t: "code", lang: "text", code:
                "(a) DEFLECTING THE EXPECTATIONS QUESTION\n" +
                "\n" +
                "Them: \"What are you looking for, compensation-wise?\"\n" +
                "\n" +
                "You:  \"I'd rather get the level and scope right first --\n" +
                "       that's what sets the range anyway. Could you tell me\n" +
                "       the band you're hiring this role into?\n" +
                "\n" +
                "       Once we've agreed the level I'll be completely\n" +
                "       straightforward about numbers, and I don't expect\n" +
                "       that part to be difficult.\""
              },
              { t: "p", html: "<strong>Why it works:</strong> it declines to anchor without sounding evasive, because it gives a reason that is actually true — you cannot sensibly name a number before you know the level. Asking for the band puts the burden of first disclosure where it belongs. The last sentence is load-bearing: it promises you will be easy to deal with, which removes the recruiter's real fear that you are going to be a difficult close." },

              { t: "h", text: "Two first counters" },
              { t: "code", lang: "text", code:
                "(b) FIRST COUNTER, WITH A COMPETING OFFER\n" +
                "\n" +
                "\"Thanks for putting this together -- I want to make this\n" +
                " work, so let me be direct about where I am.\n" +
                "\n" +
                " Two things on my side. First, scope: this role owns\n" +
                " [surface], which is the surface I've been running for\n" +
                " the last [N] years, including [the hard part]. Second,\n" +
                " I have a written offer elsewhere at [number] for year one.\n" +
                "\n" +
                " If you can get to [number] -- on base, or the equivalent\n" +
                " through sign-on if base is capped -- I'll sign today and\n" +
                " close the other process.\""
              },
              { t: "p", html: "<strong>Why it works:</strong> it supplies the reason (scope) and the constraint (the competing figure) in the order an approver needs them, names exactly one number, and stays flexible about <em>which component</em> delivers it — which is what lets the recruiter route around a capped base instead of coming back with a no. The final clause converts an ask into a transaction: they now know precisely what a yes buys." },
              { t: "code", lang: "text", code:
                "(c) FIRST COUNTER, NO COMPETING OFFER\n" +
                "\n" +
                "\"I'm not shopping this around, so I'd rather be direct\n" +
                " than play games with you.\n" +
                "\n" +
                " The role is a real step up in scope from what I do now --\n" +
                " I'd be owning [surface] end to end rather than [narrower\n" +
                " thing]. From what I can see of the band for this level,\n" +
                " the offer sits near the floor of it.\n" +
                "\n" +
                " Could you get me to the midpoint? If that lands, I'm\n" +
                " done looking and we can wrap this up this week.\""
              },
              { t: "p", html: "<strong>Why it works:</strong> it trades the leverage you do not have for credibility you do — saying plainly that you are not shopping it is disarming, and it makes the rest of the ask read as sincere rather than tactical. Anchoring on band position instead of a number out of the air gives the recruiter something defensible to repeat. The ask is specific, modest, and closable, which is the profile most likely to be granted without an exception." },

              { t: "h", text: "Three smaller asks" },
              { t: "code", lang: "text", code:
                "(d) ASKING FOR AN EXTENSION\n" +
                "\n" +
                "\"I want to give you a real answer rather than a rushed\n" +
                " one. I have one more process finishing on Thursday --\n" +
                " could I come back to you Friday morning with a decision?\n" +
                "\n" +
                " To be clear about where I stand: on the work itself\n" +
                " you're my first choice. I'm not using this to shop the\n" +
                " offer, I just don't want to accept something I haven't\n" +
                " finished thinking about.\""
              },
              { t: "p", html: "<strong>Why it works:</strong> a date, a reason, and a reconfirmation of interest, in that order. The date makes it a plan rather than a stall; the reason makes it legible; and the last paragraph pre-empts the only real objection, which is the suspicion that you are running an auction. Open-ended extension requests fail on exactly that suspicion." },
              { t: "code", lang: "text", code:
                "(e) WHEN BASE IS CAPPED\n" +
                "\n" +
                "\"Understood on base -- if that's the ceiling for the\n" +
                " level, I'm not going to keep pushing on it.\n" +
                "\n" +
                " Two things that would close the gap for me: a sign-on\n" +
                " of [number], which is one-time and doesn't touch your\n" +
                " band, or [number] more in the equity grant. Either one\n" +
                " works for me.\n" +
                "\n" +
                " Which is easier for you to get approved?\""
              },
              { t: "p", html: "<strong>Why it works:</strong> conceding the immovable component out loud buys real credibility, and it costs you nothing because it was never going to move. Naming the sign-on as band-neutral shows you understand their constraint, which changes how the ask is received. And ending on \u201cwhich is easier for you\u201d recruits them as a collaborator on your side of the problem rather than a gatekeeper on the other side of it." },
              { t: "code", lang: "text", code:
                "(f) THE CLOSE\n" +
                "\n" +
                "\"That works -- I accept.\n" +
                "\n" +
                " Could you send the written offer with base, bonus target,\n" +
                " sign-on, grant value and the vesting schedule spelled\n" +
                " out? I'll sign it the same day.\""
              },
              { t: "p", html: "<strong>Why it works:</strong> it is unambiguous, so nothing is left dangling that either side could reopen later. And it uses the single moment of maximum goodwill to convert a verbal agreement into a document that enumerates what was agreed — which is the cheapest insurance available against the honest misremembering that happens across four calls and three components." },

              { t: "h", text: "Grading the framings" },
              { t: "table",
                headers: ["Situation", "Naive", "Solid", "Standout"],
                rows: [
                  ["Asked for your number early", "\u201cI'm looking for X\u201d — anchors you before you know the level", "\u201cWhat's the band for this level?\u201d — redirects, but a little bare", "\u201cLet's settle level first; then I'll be straightforward, and I don't expect numbers to be hard\u201d"],
                  ["First counter", "\u201cI need more\u201d — no number, no reason, nothing to escalate", "\u201cThe band midpoint for this scope is X — can we get there?\u201d — actionable and defensible", "\u201cHere's the scope I'm stepping into and the competing number; X closes it today\u201d"],
                  ["Base is capped", "\u201cIs that really the best you can do?\u201d — pressure with no path", "\u201cCan we look at sign-on instead?\u201d — right component, no size", "\u201cSign-on of X, or X in equity — either works. Which is easier to approve?\u201d"],
                  ["You need more time", "Silence past the deadline — reads as shopping it", "\u201cCould I have a bit longer?\u201d — open-ended, so it invites suspicion", "\u201cFriday morning, after one process finishes — and you're my first choice on the work\u201d"],
                  ["Closing", "\u201cThat sounds workable\u2026\u201d — ambiguous, so nothing is actually settled", "\u201cYes, I accept\u201d — clean but undocumented", "\u201cI accept — send it in writing with the vesting schedule spelled out and I'll sign today\u201d"]
                ]
              },
              { t: "note", variant: "trap", html: "The most common failure across all six scripts is the sentence people add out of nervousness: \u201cI know this probably isn't possible, but\u2026\u201d. It concedes the answer before the other side has spoken and it tells the recruiter they need not spend any effort on you. Delete the disclaimer and say the same thing." },
              { t: "note", variant: "key", html: "<strong>Every counter is one number, one reason, and one close, delivered warmly.</strong> The number stops them guessing low, the reason is what gets retold to whoever actually approves it, and the close tells them what a yes buys. Stay flexible on which component delivers the number and you turn most no-because-of-policy answers into a yes through a different door." }
            ]
          },

          /* ---------- 2.3 mistakes ---------- */
          {
            id: "mistakes",
            title: "The mistakes that cost the most",
            summary: "Most money left on the table isn't withheld by the company — it's given away by the candidate, usually in a single sentence.",
            minutes: 9,
            tags: ["offer", "mistakes", "self-sabotage"],
            blocks: [
              { t: "p", html: "The uncomfortable pattern in this topic is that <strong>most of the value lost in a negotiation is given away rather than refused</strong>. Companies say no to things; candidates hand things over. The five below account for the overwhelming majority of it, and four of the five happen in a single sentence." },
              { t: "p", html: "Read these as failure modes to catch in yourself under pressure, not as a list of things bad negotiators do. Every one of them is a normal, sympathetic human reaction to an uncomfortable conversation." },

              { t: "h", text: "1 · Naming a number first" },
              { t: "p", html: "Whoever names a figure first sets the ceiling of the conversation, and early in a process you are naming it against unknown information — you do not yet know the level, the band, or the shape of the equity. The number you invent will be anchored on your <em>current</em> pay, which is the one number that has nothing to do with what this role is worth. Redirect to the band; it is a real answer, not a dodge." },

              { t: "h", text: "2 · Negotiating against yourself" },
              { t: "p", html: "This is the expensive one, because it happens entirely inside your own sentences. You make an ask and then, in the silence afterwards, you soften it, discount it, apologise for it, or answer it yourself. The recruiter has not said a word yet and the ask has already shrunk." },
              { t: "ul", items: [
                "<strong>Pre-conceding:</strong> \u201cI know this probably isn't possible, but\u2026\u201d — you supplied the no.",
                "<strong>Volunteering a discount:</strong> \u201c\u2026or honestly, even half of that would be fine.\u201d Now half is the ceiling.",
                "<strong>Apologising:</strong> \u201csorry to be difficult about this\u201d — reframes a routine business conversation as an imposition you should feel bad about.",
                "<strong>Filling the silence:</strong> a pause after your ask is not a rejection. It is usually someone doing arithmetic. Let it sit.",
                "<strong>Justifying with need:</strong> rent, childcare, a mortgage. Sympathetic, and not an argument an approver can act on — it says nothing about the role.",
                "<strong>Asking for everything:</strong> five simultaneous asks force them to pick the cheapest one and call it a win."
              ] },

              { t: "h", text: "3 · Accepting before the paperwork" },
              { t: "p", html: "\u201cYes, that works\u201d is the single most expensive sentence available to you, because it takes your leverage to zero in four words. Everything you might still have wanted — the sign-on, the start date, the vesting detail, the level conversation — is now something you are reopening after the fact, which reads as moving the goalposts to the exact people you are about to work alongside." },
              { t: "note", variant: "trap", html: "There is a real difference between enthusiasm and agreement, and it is worth rehearsing out loud. \u201cI'm genuinely excited about this and I want to make it work\u201d costs you nothing. \u201cThat sounds good\u201d costs you the negotiation, and the ambiguity is on you rather than on them." },

              { t: "h", text: "4 · Treating it as a fight" },
              { t: "p", html: "The negotiation is a twenty-minute transaction with people you may work with for years, and one of them is often your future manager. Winning it in a way that makes you look extractive is a bad trade even when you win — first impressions formed in the offer call get carried into the team, and they are hard to correct later." },
              { t: "compare",
                bad: { title: "Adversarial", items: ["Hard deadlines you can't enforce", "Multiple escalating counters", "Implying they're negotiating in bad faith", "Treating a policy wall as an insult", "Winning the number and losing the relationship"] },
                good: { title: "Collaborative", items: ["\u201cI want to make this work\u201d, said and meant", "One ask, one number, one reason", "Asking which component is easiest to approve", "Taking a genuine no as information", "Closing warmly, with the number you wanted"] }
              },

              { t: "h", text: "5 · Pushing on what was never movable" },
              { t: "p", html: "Negotiating capital is finite: roughly one real ask, sometimes two. Spending it on a component fixed by policy means you get a no <em>and</em> you arrive at the soft component with less credibility than you started with. The fix is not subtle — find out what is movable before you decide what to ask for." },
              { t: "table",
                headers: ["Commonly pushed on", "Usually immovable because", "Push here instead"],
                rows: [
                  ["Bonus target percentage", "Set per level by policy, uniform across the cohort", "Sign-on — one-time and band-neutral"],
                  ["Leave, benefits, insurance", "Company-wide programmes, not per-offer", "Start date, and the timing of your first review"],
                  ["Base above the band", "Creates a permanent internal-equity problem", "Equity grant size, tied to the scope you'll own"],
                  ["Vesting schedule", "Usually one standard schedule for everyone", "The size of the grant, which the schedule then applies to"],
                  ["Level, after the loop closed", "Decided on loop evidence that is already recorded", "Level, during the loop — or ask what evidence would change it"]
                ]
              },
              { t: "note", variant: "warn", html: "One mistake with no upside at all: going silent. If you need time, ask for a date. If you're declining, decline. Disappearing on a recruiter mid-offer is remembered for years, costs you nothing to avoid, and closes a door you may want to walk back through." },
              { t: "note", variant: "key", html: "<strong>You are the most likely source of the loss.</strong> Don't name the first number, don't discount your own ask in the silence that follows it, don't say \u201cthat works\u201d before the terms are written down, don't win it adversarially, and don't spend your one real ask on something policy already decided. Get those five right and you have out-negotiated most candidates without saying anything clever." },
              { t: "quiz", id: "offer-execution" }
            ]
          }
        ]
      },

      /* ==================== MODULE 3 · CLOSE ==================== */
      {
        id: "close",
        name: "Closing Well",
        icon: "wrench",
        lessons: [

          /* ---------- 3.1 accept-decline ---------- */
          {
            id: "accept-decline",
            title: "Accepting or declining without damage",
            summary: "The last five minutes: confirming what you agreed, declining an offer you fought for, surviving a rescinded one — and the rehearsal that makes all of it easy.",
            minutes: 10,
            tags: ["offer", "closing", "relationships"],
            blocks: [
              { t: "p", html: "The negotiation ends, and then there is a small, boring, easy-to-fumble sequence that determines whether the whole thing was worth it. Two frames to carry through it: <strong>write down what you agreed</strong>, because memory across four calls is unreliable in both directions, and <strong>everyone in this conversation has a long memory</strong>, because you may be in front of them again in two years." },

              { t: "h", text: "Accepting cleanly" },
              { t: "ol", items: [
                "<strong>Say yes unambiguously.</strong> No conditions left hanging, no \u201cthat sounds workable\u201d. If you are accepting, accept.",
                "<strong>Ask for it in writing, itemised.</strong> Base, bonus target, sign-on and any clawback attached to it, grant value, vesting schedule, level, title, start date.",
                "<strong>Read it against your own notes</strong> before you sign, component by component. This is where honest gaps surface, and it is the cheapest moment to fix them.",
                "<strong>Raise any gap immediately and neutrally</strong> — \u201cwe discussed X, the letter says Y, can you check?\u201d Almost always an error, almost always fixed.",
                "<strong>Then stop your other processes</strong> — and only then. Withdrawing before the signed letter exists removes your only fallback at the worst possible moment.",
                "<strong>Resign only after you have signed.</strong> Not before, however confident the verbal felt."
              ] },
              { t: "code", lang: "text", code:
                "confirming what you agreed -- short, warm, itemised\n" +
                "\n" +
                "  Subject: Accepting -- confirming the details\n" +
                "\n" +
                "  \"Delighted to accept, and thank you for working through\n" +
                "   this with me.\n" +
                "\n" +
                "   Just so we're aligned before the paperwork, here's what\n" +
                "   I have:\n" +
                "     - level and title\n" +
                "     - base\n" +
                "     - bonus target (% of base)\n" +
                "     - sign-on, and any clawback period on it\n" +
                "     - equity grant value and vesting schedule\n" +
                "     - start date\n" +
                "\n" +
                "   If anything there doesn't match your notes, tell me and\n" +
                "   I'll correct my end.\""
              },
              { t: "p", html: "That last line is the whole trick. Framing it as \u201ccorrect <em>my</em> notes\u201d makes the message impossible to read as distrust, while still producing exactly the written record you wanted. It costs one message and it is the only protection you get against the honest misremembering that genuinely does happen." },
              { t: "note", variant: "tip", html: "Two things to check specifically, because they are the ones people discover later: whether the sign-on carries a clawback if you leave inside a fixed period, and when your first performance and compensation review actually falls. A start date a few weeks either side of a cycle boundary can be worth more than the sign-on you negotiated." },

              { t: "h", text: "Declining without burning it" },
              { t: "p", html: "You will sometimes decline an offer you worked weeks for, and the temptation is to over-explain, apologise at length, or quietly go silent. All three are worse than the simple version. The people you are declining spent real time on you, they will remember how you handled it, and the recruiting world is much smaller than it looks from inside a job search." },
              { t: "code", lang: "text", code:
                "declining -- prompt, specific, warm, short\n" +
                "\n" +
                "  \"Thank you for all of it -- and I'm sorry to be coming\n" +
                "   back with a no.\n" +
                "\n" +
                "   I've decided to take another role. It came down to\n" +
                "   [one real reason: scope / team / the problem itself],\n" +
                "   not to anything about how this process went. You were\n" +
                "   straight with me the whole way and I appreciated it.\n" +
                "\n" +
                "   I'd genuinely like to stay in touch, and if the timing\n" +
                "   is different in a couple of years I'd want to talk\n" +
                "   again.\"\n" +
                "\n" +
                "  do not include: an itemised critique of the offer,\n" +
                "  a comparison table, or a number you're not using\n" +
                "  as a counter."
              },
              { t: "p", html: "<strong>Why this shape:</strong> promptness is the part they actually care about, because it lets them move to their next candidate. One real reason is enough — it makes the no feel considered rather than transactional, without inviting a rebuttal the way an itemised critique does. And the door-open line is not a pleasantry; it is the single cheapest professional investment in this entire track." },

              { t: "h", text: "When an offer is rescinded" },
              { t: "p", html: "It happens, usually because a budget or a headcount changed rather than because of anything you did, and it is genuinely unfair when you have already resigned somewhere else. The instinct is to argue or to wait quietly. Neither helps. What you are short of is time, so spend the first hour on facts and the rest on your own options." },
              { t: "ul", items: [
                "<strong>Get it in writing</strong> — what changed, when it takes effect, and whether the role is gone or paused. You need this if you have already given notice.",
                "<strong>Ask directly what support exists.</strong> Sometimes there is something — a delayed start, a different team, a goodwill payment, a referral onward. Asking costs nothing and silence produces nothing.",
                "<strong>Restart your search the same day.</strong> Not after it resolves. Reopen the processes you closed; \u201cmy offer was rescinded, are you still hiring?\u201d is a completely normal message that recruiters receive regularly.",
                "<strong>Tell your current employer only once you know your position</strong>, if you have not yet resigned. If you have, ask about withdrawing the resignation before you assume it is impossible.",
                "<strong>Don't escalate publicly.</strong> It very rarely reverses the decision and it reliably shapes how the next set of people read you."
              ] },
              { t: "note", variant: "warn", html: "This is the strongest practical argument for the sequencing in the accept checklist. Do not resign, and do not close your other processes, until the signed written offer is in your hands. The gap between a warm verbal yes and a countersigned letter is the single most expensive window in a job search." },

              { t: "h", text: "The rehearsal checklist" },
              { t: "ol", items: [
                "<strong>Take the offer apart</strong> into base, bonus target, equity, sign-on, level, start date — and write down which of those you have actually been told.",
                "<strong>Model the vesting shape</strong> against how long you honestly expect to stay, not against four years by default.",
                "<strong>Decide whether this is a level conversation or a dollar one.</strong> If level, you needed to have started earlier — so ask what evidence would change it.",
                "<strong>Name your leverage honestly.</strong> Written offer, live process, scope step-up, or none. This sets your ceiling, and pretending otherwise is how people over-push.",
                "<strong>Pick one number and one reason</strong>, and decide which component you would accept it through. Write the sentence out.",
                "<strong>Say it out loud once.</strong> Genuinely — out loud. This is where the apologising and the pre-conceding surface, and it is much cheaper to hear them in your kitchen than on the call.",
                "<strong>Decide your walk-away and your close in advance</strong>, so that neither is a live decision while somebody is waiting on the phone.",
                "<strong>Know how you will say yes, and how you will say no.</strong> Both are short. Both are much easier when they are not being composed in real time."
              ] },
              { t: "p", html: "That checklist is the whole track compressed into eight lines. Step one is the anatomy of the bundle; step three is the level insight; step four is the honest accounting of leverage; step five is the counter framing; step six is the guard against the self-inflicted mistakes; and steps seven and eight are this lesson. If you only rehearse one thing, rehearse step six — hearing your own ask out loud catches more lost money than anything else here." },
              { t: "cue", html: "You are ready to have the conversation when you can say, without notes: <strong>the number</strong>, <strong>the reason an approver would repeat</strong>, <strong>which component you'd take it through</strong>, <strong>what closes it</strong>, and <strong>what you do if the answer is a flat no</strong>. If any of those five is fuzzy, you are not ready — and the ten minutes it takes to fix that is the highest-paid ten minutes in the whole process." },
              { t: "note", variant: "key", html: "<strong>Close the way you'd want to be closed on.</strong> Accept unambiguously and get it itemised in writing before you resign or withdraw anywhere else; decline promptly, warmly, with one real reason and the door left open; and if an offer is pulled, get the facts in writing and restart the same day. The negotiation is twenty minutes — the relationship and the reputation are the parts that keep paying." },
              { t: "quiz", id: "offer-close" }
            ]
          }
        ]
      }
    ]
  };
})();
