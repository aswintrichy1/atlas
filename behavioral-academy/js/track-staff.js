/* =====================================================================
   COMPASS · Staff & Principal Loops track  (curriculum + quizzes)
   Level expectations differ by company; lessons teach the signals that
   recur across published career ladders and candidate accounts, and say
   so where detail is company-specific.
   ===================================================================== */
(function () {
  "use strict";

  window.QUIZZES = window.QUIZZES || {};
  Object.assign(window.QUIZZES, {
    "staff-signals": {
      title: "Staff signals checkpoint",
      sub: "Level signals, ambiguity and technical strategy.",
      questions: [
        {
          q: "Which story most clearly signals staff rather than senior scope?",
          options: [
            "You delivered the hardest component of a large project ahead of schedule",
            "You noticed three teams solving the same problem differently, wrote the proposal that unified them, and the approach outlived your involvement",
            "You mentored two junior engineers through their first launch",
            "You worked longer hours than anyone during an incident"
          ],
          answer: 1,
          explain: "Senior stories show excellent execution of a well-defined problem. Staff stories show you found or framed the problem, changed what several teams did, and left something durable. Mentoring and heroics are good signals, but neither is the level-distinguishing one."
        },
        {
          q: "An interviewer asks about a time you worked with ambiguity. What makes a staff-level answer?",
          options: [
            "Explaining that you waited until requirements were clear before starting",
            "Listing every open question you had",
            "Showing how you turned an unclear goal into a framed problem with options, a recommendation and an explicit bet you would revisit",
            "Describing how you escalated to your manager immediately"
          ],
          answer: 2,
          explain: "At staff level, ambiguity is the job: the signal is that you reduced it for others — framing, options, a decision and a review point — rather than waiting for someone to remove it for you."
        },
        {
          q: "What separates a technical strategy from a technical plan in an interview story?",
          options: [
            "A strategy explains the diagnosis, the guiding choice and what you deliberately chose not to do; a plan lists the work",
            "A strategy is longer",
            "A plan has dates and a strategy does not",
            "There is no difference at staff level"
          ],
          answer: 0,
          explain: "A strategy starts from a diagnosis of the real problem, commits to a guiding approach and makes trade-offs visible — including what was declined. A list of projects with dates is a plan, and describing one as strategy is a common miss."
        },
        {
          q: "You are asked \"what would you have done differently?\" about your biggest strategic bet. Which answer reads strongest?",
          options: [
            "\"Nothing — it worked out well.\"",
            "\"I would have worked harder.\"",
            "\"My team should have communicated better.\"",
            "\"I would have set an earlier checkpoint: we kept investing for a quarter after the leading indicator turned, and I now define the kill criteria up front.\""
          ],
          answer: 3,
          explain: "Staff candidates are expected to evaluate their own bets with the same rigour they apply to others'. A specific, owned change in how you decide is far stronger than a claim of perfection or a diffuse team lesson."
        },
        {
          q: "Why do many staff loops weight the behavioral or leadership round heavily?",
          options: [
            "Coding matters less for staff engineers",
            "Behavioral rounds are easier to score",
            "The difference between senior and staff is largely about scope, influence and judgement, which is evidenced through stories rather than through a coding exercise",
            "Companies want shorter loops"
          ],
          answer: 2,
          explain: "Technical rounds establish that you are strong; they rarely distinguish senior from staff on their own. Scope, cross-team influence and judgement under ambiguity are what separate the levels, and those are evidenced by what you have done."
        }
      ]
    },
    "staff-influence": {
      title: "Influence & portfolio checkpoint",
      sub: "Cross-org influence, executive communication and story mapping.",
      questions: [
        {
          q: "A cross-org story is strongest when it shows\u2026",
          options: [
            "That you had authority over the other teams",
            "How you aligned teams you did not manage \u2014 understanding their incentives, making the shared cost visible and earning a commitment",
            "That you completed the work yourself when they would not",
            "That leadership told everyone to cooperate"
          ],
          answer: 1,
          explain: "Influence without authority is the core staff skill. The story should show you understood why the other teams resisted, changed the conversation with evidence, and secured a decision they owned \u2014 not that you went around them."
        },
        {
          q: "You have two minutes with a VP to get a decision. What should come first?",
          options: [
            "The decision you need and your recommendation",
            "The full technical background",
            "The history of how the problem arose",
            "A list of every option you considered"
          ],
          answer: 0,
          explain: "Executive communication leads with the ask and the recommendation, then the one or two facts that justify it, then the risk. Detail is available on request; a decision-maker who has to wait for the point often never reaches it."
        },
        {
          q: "What is a story portfolio for a staff loop?",
          options: [
            "A single polished story told in every round",
            "A list of every project you have worked on",
            "A deliberate set of stories mapped to the level signals, with at least two per key signal and different stories planned for different interviewers",
            "Your résumé in a different format"
          ],
          answer: 2,
          explain: "Staff loops probe the same signals from several angles across interviewers. Mapping stories to signals \u2014 with backups \u2014 prevents repeating yourself and leaves no key signal resting on a single story."
        },
        {
          q: "An interviewer says \"what was your specific contribution?\" after a story about a large initiative. What should you do?",
          options: [
            "Repeat the outcome more forcefully",
            "Describe the team\u2019s work in more detail",
            "Say it was a team effort and move on",
            "Name the decisions, documents and conversations that were yours, and what would have happened without them"
          ],
          answer: 3,
          explain: "Large initiatives blur individual contribution. A staff answer isolates the specific leverage you provided \u2014 the framing, the design decision, the alignment meeting \u2014 and its counterfactual effect."
        },
        {
          q: "Which written artifact best evidences staff-level communication?",
          options: [
            "A status update listing completed tickets",
            "A decision document that framed options and trade-offs, was circulated across teams, and changed what was built",
            "A chat thread with many messages",
            "A personal to-do list"
          ],
          answer: 1,
          explain: "Writing that changes decisions across teams is one of the clearest staff signals. A design or strategy doc with a named outcome is concrete evidence; ticket lists and chat volume are activity, not influence."
        }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.staff = {
    id: "staff",
    name: "Staff & Principal Loops",
    short: "STAFF",
    tagline: "Evidence for scope you cannot fake",
    color: "#38bdf8",
    blurb: "Staff and principal interviews are scope exams. This track names the level signals that recur across published career ladders, shows how ambiguity, technical strategy and cross-organisation influence are evidenced in stories, teaches the executive-communication shape senior leaders score, and ends with a portfolio method that maps a small set of stories onto every signal a staff loop will probe.",
    modules: [
      /* ==================== MODULE 1 · SIGNALS ==================== */
      {
        id: "signals",
        name: "Level Signals & Strategy",
        icon: "compass",
        lessons: [
          {
            id: "level-signals",
            title: "What changes at staff and principal",
            summary: "The level jump is not more of the same work — it is a change in who defines the work and how far your decisions travel.",
            minutes: 9,
            tags: ["staff", "principal", "levels", "scope"],
            blocks: [
              { t: "p", html: "Career ladders at large engineering organisations are written in <strong>scope language</strong>: the size of the problem you are trusted with, how ambiguous it is when it reaches you, and how far your decisions travel. Senior engineers are expected to execute well-defined, significant problems excellently. Staff and principal engineers are expected to <em>find and define</em> the problems, and to change what several teams do." },
              {
                t: "table",
                headers: ["Signal", "Senior", "Staff", "Principal"],
                rows: [
                  ["Problem source", "Given a hard problem, solves it well", "Finds or frames the problem for a group of teams", "Shapes which problems an organisation works on"],
                  ["Blast radius", "A team or service", "Several teams or a platform", "An organisation or a company-wide technical direction"],
                  ["Time horizon", "This quarter to this half", "One to two years", "Multi-year bets"],
                  ["Influence", "Within the team", "Across teams without authority", "Across organisations and with executives"],
                  ["Durability", "Shipped and maintained", "Outlives the author: standards, platforms, decisions others adopt", "Changes how the company builds"]
                ]
              },
              { t: "note", variant: "warn", html: "These bands are a synthesis of patterns common to published ladders and candidate accounts, not any single company\u2019s definition. Titles and expectations vary: one company\u2019s staff engineer is another\u2019s senior. Ask your recruiter which level the loop is calibrated for and read that company\u2019s public ladder if it has one." },
              { t: "h", text: "The archetypes" },
              { t: "p", html: "Staff engineers do not all do the same job. Interviewers often probe for which shape you fit, and your stories should make it obvious." },
              {
                t: "ul", items: [
                  "<strong>Tech lead</strong> \u2014 guides the approach and execution of one team or a tightly related group.",
                  "<strong>Architect</strong> \u2014 owns technical direction and quality for a critical area across teams.",
                  "<strong>Solver</strong> \u2014 is pointed at the hardest, most ambiguous problems and moves between them.",
                  "<strong>Right hand</strong> \u2014 extends an engineering leader\u2019s reach across an organisation."
                ]
              },
              { t: "cue", html: "<strong>Tell the interviewer which shape you are.</strong> \"Most of my staff work has been architect-shaped: I owned the data platform direction across four teams\" frames every story that follows and stops a solver-shaped interviewer from scoring you against the wrong bar." },
              { t: "h", text: "Why the behavioral round decides the level" },
              { t: "p", html: "Technical rounds establish that you are strong. They rarely distinguish senior from staff on their own, because a strong senior engineer can pass a hard design round. What separates the levels \u2014 scope, influence, judgement under ambiguity \u2014 lives in what you have already done, and the behavioral and project rounds are where that evidence is collected. That is why <a href=\"#/story/catalog/scope-signal\">proving scope</a> matters more here than anywhere else." },
              { t: "note", variant: "key", html: "<strong>Down-levelling is usually an evidence problem, not a skill problem.</strong> Candidates who are doing staff work often tell senior stories \u2014 the hard thing they built \u2014 instead of staff stories \u2014 the problem they found, the teams they aligned, the decision that outlived them. Re-cut the same projects around those signals before you prepare anything new." }
            ]
          },
          {
            id: "ambiguity",
            title: "Ambiguity: framing the problem for others",
            summary: "At staff level ambiguity is not a hazard you survive; it is the raw material you are paid to turn into decisions.",
            minutes: 8,
            tags: ["staff", "ambiguity", "framing"],
            blocks: [
              { t: "p", html: "Senior ambiguity stories are about coping: requirements changed and you adapted. Staff ambiguity stories are about <strong>reducing ambiguity for other people</strong> \u2014 taking a goal like \"our data platform is too slow and too expensive\" and turning it into a framed problem that teams can act on." },
              { t: "h", text: "The framing sequence" },
              {
                t: "ol", items: [
                  "<strong>Diagnose</strong> \u2014 what is actually wrong, with evidence? (\"Seventy percent of compute goes to three nightly jobs that rebuild history from scratch.\")",
                  "<strong>Bound</strong> \u2014 what is in and out of scope, and what you are deliberately not solving.",
                  "<strong>Options</strong> \u2014 two or three real alternatives, including the boring one.",
                  "<strong>Recommend</strong> \u2014 the choice, the reason, and the cost you are accepting.",
                  "<strong>Checkpoint</strong> \u2014 the signal that would tell you the bet is wrong, and when you will look."
                ]
              },
              { t: "p", html: "Each step is something an interviewer can probe. The checkpoint is the one most candidates forget, and it is the clearest evidence that you treat a decision under uncertainty as a bet rather than a certainty." },
              { t: "note", variant: "tip", html: "Narrate what you did not know at the time. \"We did not know whether the cost was in compute or in storage, so the first two weeks were spent finding out\" is precisely the uncertainty a reviewer wants to see you navigate \u2014 and it is the detail your <a href=\"#/story/catalog/journaling\">work journal</a> exists to preserve." },
              { t: "note", variant: "warn", html: "Asking clarifying questions forever is not a staff answer. At some point you have to state an assumption, act on it and name what would change your mind; the ambiguity lesson in the <a href=\"#/story/catalog/ownership-ambiguity\">story bank</a> covers the shapes that prove it." },
              { t: "note", variant: "key", html: "<strong>The deliverable of a staff ambiguity story is clarity other people used.</strong> If your framing document, your options memo or your problem statement became the thing several teams planned against, say so \u2014 that adoption is the evidence, not the effort you spent producing it." }
            ]
          },
          {
            id: "strategy",
            title: "Technical strategy stories",
            summary: "Diagnosis, guiding choice, coherent actions \u2014 and the things you decided not to do.",
            minutes: 9,
            tags: ["staff", "principal", "strategy"],
            blocks: [
              { t: "p", html: "Staff and principal loops frequently include some version of \"tell me about a technical strategy you set\" or \"how did you decide the direction for your area?\" The common miss is answering with a roadmap \u2014 a list of projects and dates. A <strong>strategy</strong> is different: it explains why <em>these</em> projects and not others." },
              {
                t: "table",
                headers: ["Part", "Question it answers", "Example (data platform)"],
                rows: [
                  ["Diagnosis", "What is really going on?", "Teams copy data into five stores because no shared table layer meets their latency needs"],
                  ["Guiding choice", "What approach will we take, and what will we stop doing?", "One open table format and catalog for all batch data; no new bespoke stores; streaming stays separate for now"],
                  ["Coherent actions", "What concrete steps follow from the choice?", "Migrate the top three consumers first, publish a contract template, retire two stores within a year"],
                  ["Trade-offs", "What did we give up?", "Some teams lose a tool they liked; streaming unification is deferred"],
                  ["Measures", "How will we know?", "Copies per dataset, cost per query, time to onboard a new consumer"]
                ]
              },
              { t: "p", html: "Principal-level versions widen the horizon and the audience: multi-year bets, several organisations, explicit links to business strategy, and how you kept the strategy alive when priorities shifted." },
              { t: "cue", html: "<strong>Say what you said no to.</strong> \"We decided not to build a real-time layer that year, and here is why\" is more convincing than any list of what you did build, because it shows the trade-off was a choice." },
              { t: "note", variant: "tip", html: "Expect a follow-up on how the strategy changed. Strong answers describe a specific moment you revised it and what evidence caused the revision." },
              { t: "note", variant: "key", html: "<strong>A strategy is judged by the decisions it made easier.</strong> If teams used your diagnosis and guiding choice to settle their own design arguments without you in the room, the strategy worked. Tell that part of the story." },
              { t: "quiz", id: "staff-signals" }
            ]
          }
        ]
      },
      /* ==================== MODULE 2 · INFLUENCE ==================== */
      {
        id: "influence",
        name: "Influence, Communication & Portfolio",
        icon: "globe",
        lessons: [
          {
            id: "cross-org",
            title: "Cross-organisation influence without authority",
            summary: "Align teams you do not manage by understanding their incentives and making the shared cost visible.",
            minutes: 8,
            tags: ["staff", "influence", "cross-team"],
            blocks: [
              { t: "p", html: "Most staff work needs other teams to change what they do, and you manage none of them. Interviewers probe this directly: \"tell me about a time you needed another organisation to change direction.\" The strongest answers show you treated the other team as rational actors with different incentives, not as obstacles." },
              {
                t: "ol", items: [
                  "<strong>Understand their incentives</strong> \u2014 what is the other team measured on, and why does your proposal cost them?",
                  "<strong>Make the shared cost visible</strong> \u2014 data that both sides accept: incidents, duplicated spend, customer impact.",
                  "<strong>Shrink the ask</strong> \u2014 a pilot, a migration you staff, an interface instead of a rewrite.",
                  "<strong>Find the decision-maker</strong> \u2014 and give them a framed choice, not a complaint.",
                  "<strong>Secure a commitment they own</strong> \u2014 the change is theirs, with their name on it."
                ]
              },
              { t: "note", variant: "warn", html: "Two story shapes backfire. \"I escalated and leadership made them do it\" shows you could not influence. \"They would not help, so I built it myself\" shows you could not align \u2014 and often that you created a second system to maintain." },
              { t: "note", variant: "tip", html: "Include a disagreement you lost or a compromise you accepted. Influence stories where you won every point read as either untrue or unambitious." },
              { t: "note", variant: "key", html: "<strong>Influence is proved by what other people decided.</strong> Frame the outcome as the other team\u2019s decision \u2014 \"the payments team adopted the contract and ran the migration\" \u2014 because that is exactly what influence without authority means." }
            ]
          },
          {
            id: "exec-comms",
            title: "Executive communication",
            summary: "Lead with the ask, give the two facts that justify it, name the risk \u2014 then stop.",
            minutes: 7,
            tags: ["staff", "principal", "communication", "executives"],
            blocks: [
              { t: "p", html: "Staff and principal engineers routinely brief directors and executives, and many loops test it \u2014 sometimes explicitly (\"explain this design to a VP\"), more often implicitly through how you summarise a story. The shape executives reward is consistent." },
              {
                t: "table",
                headers: ["Beat", "What you say", "Time"],
                rows: [
                  ["Ask", "The decision you need, or the one you made", "First sentence"],
                  ["Recommendation", "Your choice and the main reason", "Second sentence"],
                  ["Evidence", "One or two facts that make it credible", "Thirty seconds"],
                  ["Risk", "What could go wrong and how you will know", "Fifteen seconds"],
                  ["Detail on request", "Everything else", "Only if asked"]
                ]
              },
              { t: "p", html: "In an interview this shape doubles as a test of your stories. If you cannot open a story with the decision and its outcome in one sentence, an executive could not either \u2014 and neither can the interviewer writing your feedback." },
              { t: "cue", html: "<strong>Practise the ten-second version.</strong> For each major story, write one sentence that a VP could repeat accurately to their boss. If it needs a second sentence, it is not yet clear to you." },
              { t: "note", variant: "trap", html: "Technical depth is not the enemy; unrequested depth is. When an executive asks a detailed question, answer it precisely and then return to the decision." },
              { t: "note", variant: "key", html: "<strong>Executives are scored on decisions, so they listen for decisions.</strong> Every briefing \u2014 and every interview summary \u2014 should leave the listener knowing what was decided, why, and what it costs. Clarity about those three is the staff communication signal." }
            ]
          },
          {
            id: "portfolio",
            title: "Your staff story portfolio",
            summary: "Map a handful of deep stories onto every signal the loop will probe, with backups and distinct stories per interviewer.",
            minutes: 9,
            tags: ["staff", "portfolio", "story-mapping"],
            blocks: [
              { t: "p", html: "A staff loop asks about the same signals from several directions: a hiring manager, a peer staff engineer, a cross-functional partner and sometimes a director may each probe ambiguity or influence. A <strong>portfolio</strong> is a deliberate plan that maps your stories onto those signals so you never repeat yourself and never rest a key signal on a single story." },
              {
                t: "table",
                headers: ["Signal", "Primary story", "Backup story", "Proof point"],
                rows: [
                  ["Problem framing / ambiguity", "Platform cost diagnosis", "On-call redesign", "Framing doc adopted by four teams"],
                  ["Technical strategy", "Single table format decision", "Deprecation of legacy queue", "Two stores retired; cost per query down"],
                  ["Cross-org influence", "Contract adoption by payments", "Shared incident process", "Other team owned the migration"],
                  ["Execution at scale", "Year-long migration", "Major incident recovery", "Zero-downtime cutover"],
                  ["Growing others", "Tech-lead rotation programme", "Mentoring a new staff engineer", "Two promotions; process kept after you left"],
                  ["Judgement / failure", "Bet you killed at the checkpoint", "Design you got wrong", "What you now do differently"]
                ]
              },
              {
                t: "ol", items: [
                  "<strong>Choose four to six deep stories</strong> \u2014 projects with real forks you owned. Breadth comes from re-cutting them, not from more stories.",
                  "<strong>Map each to two or three signals</strong>, using the <a href=\"#/story/catalog/coverage-matrix\">coverage matrix</a> method.",
                  "<strong>Ensure two stories per key signal</strong> so a signal survives one story being used up.",
                  "<strong>Plan by interviewer</strong> \u2014 if you know the panel, assign primary stories so each person hears different evidence.",
                  "<strong>Prepare the numbers</strong> \u2014 every proof point needs a before, an after and a window, as in <a href=\"#/story/catalog/resume-evidence\">r\u00e9sum\u00e9 lines that survive the deep-dive</a>."
                ]
              },
              { t: "note", variant: "tip", html: "Keep one recent story (under a year old). Staff interviewers often ask \"what are you working on now?\" to check that the level evidence is current." },
              { t: "note", variant: "warn", html: "Everything in your portfolio must be true and yours. Inflated scope collapses under the third follow-up, and at staff level the follow-ups come from people who have done the job." },
              { t: "note", variant: "key", html: "<strong>The portfolio turns a loop into coverage, not luck.</strong> Without it, a strong candidate tells their best story three times and leaves two signals unevidenced. With it, every interviewer gets a different, specific, defensible piece of proof." },
              { t: "quiz", id: "staff-influence" }
            ]
          }
        ]
      }
    ]
  };
})();
