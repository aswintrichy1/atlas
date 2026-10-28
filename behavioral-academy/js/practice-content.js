/* Compass practice reference — scenario packs, interview prompts, rubrics,
   cheat sheets, and glossary for the practice hub. Every `route` here must
   resolve to a real lesson in window.TRACKS.beh / .story / .loops / .offer. */
window.CompassPractice = {
  nav: [
    {
      id: "scenarios",
      route: "#/scenarios",
      title: "Scenario packs",
      label: "Model-answer outlines",
      color: "#fb7185",
      icon: "map",
      summary: "Outlines for the rounds you will actually sit, from the recruiter screen to the offer call."
    },
    {
      id: "interview",
      route: "#/interview",
      title: "Interview prompts",
      label: "Timed practice",
      color: "#a78bfa",
      icon: "quiz",
      summary: "Timed prompts with the signal each one probes and the follow-ups that break a shallow story."
    },
    {
      id: "rubrics",
      route: "#/rubrics",
      title: "Rubrics",
      label: "Score yourself",
      color: "#34d399",
      icon: "star",
      summary: "The signal areas a behavioral round is scored on, and what each band sounds like out loud."
    },
    {
      id: "cheatsheets",
      route: "#/cheatsheets",
      title: "Cheat sheets",
      label: "Fast recall",
      color: "#fbbf24",
      icon: "md",
      summary: "The structures and scripts worth having in memory before the call starts."
    },
    {
      id: "glossary",
      route: "#/glossary",
      title: "Glossary",
      label: "Say it precisely",
      color: "#38bdf8",
      icon: "lesson",
      summary: "The vocabulary of loops, rubrics, and offers, with the sentence that shows you understand it."
    }
  ],

  scenarios: [
    {
      id: "full-loop-prep",
      title: "Preparing a full onsite loop",
      subtitle: "Working backwards from the round list to a story bank that covers it without collisions.",
      timebox: "2 weeks",
      prompt: "You have a five-round onsite in two weeks. Build the preparation plan.",
      related: [
        { label: "Coverage matrix", route: "#/story/catalog/coverage-matrix" },
        { label: "Adapting to big tech", route: "#/story/playbooks/big-tech" },
        { label: "How you are evaluated", route: "#/beh/foundation/how-evaluated" }
      ],
      outline: [
        {
          title: "Map the loop before writing anything",
          items: [
            "Ask the recruiter for the round list, the format of each, and who conducts them.",
            "Identify which round carries the behavioral weight — it is often the one led by the person who aggregates feedback.",
            "Note whether the design round is infrastructure-flavoured or product-flavoured; it changes what you rehearse."
          ]
        },
        {
          title: "Audit the bank against the signals",
          items: [
            "Lay your existing stories against the eight signal areas and find the empty cells.",
            "Fill gaps by mining old design docs, incident write-ups, and reviews rather than inventing new material.",
            "Check for collisions: interviewers compare notes, so the same story told three times reads as a thin career."
          ]
        },
        {
          title: "Deepen rather than broaden",
          items: [
            "Take your three strongest stories to twenty minutes of depth each, not ten stories to two minutes.",
            "For each, prepare the contribution probe, the rejected-alternative probe, and the measurement probe.",
            "Write the Takeaway beat explicitly — it is the beat candidates skip and the one that separates bands."
          ]
        },
        {
          title: "Rehearse under the real constraint",
          items: [
            "Practise out loud and timed; a story that reads well silently often runs four minutes spoken.",
            "Record one session and watch it. The filler and the drift are invisible from the inside.",
            "Finish with a peer or professional mock so someone else supplies the follow-ups you did not anticipate."
          ]
        }
      ]
    },
    {
      id: "bar-raiser-depth",
      title: "Surviving a depth-first behavioral round",
      subtitle: "One story, twenty minutes of follow-ups, and nowhere to hide.",
      timebox: "60 min",
      prompt: "An interviewer from outside the team will spend most of an hour on principles, drilling three or four of them exhaustively.",
      related: [
        { label: "Amazon L5 playbook", route: "#/loops/amazon/amazon-l5" },
        { label: "Principle-based loops", route: "#/story/playbooks/principle-based" },
        { label: "Proving scope", route: "#/story/catalog/scope-signal" }
      ],
      outline: [
        {
          title: "Prepare for depth, not coverage",
          items: [
            "Carry two or more detailed stories per principle; the drill will exhaust one of them.",
            "Know the numbers. 'It improved things' collapses on the second follow-up.",
            "Rehearse the boundary between what the team did and what you personally decided."
          ]
        },
        {
          title: "Expect the escalation pattern",
          items: [
            "First probe: what exactly was your contribution, as distinct from the team's?",
            "Second probe: what alternative did you reject, and what would have happened if you had chosen it?",
            "Third probe: how did you measure the result, and how do you know the change caused it?",
            "Fourth probe: what would you do differently, and what did you actually change afterwards?"
          ]
        },
        {
          title: "Handle the pressure honestly",
          items: [
            "If you do not know a number, say so and give the order of magnitude and how you would find it.",
            "Do not inflate scope — inflated scope is exactly what twenty minutes of follow-ups is designed to detect.",
            "Answering 'I got that wrong, and here is what I learned' scores better than defending a weak decision."
          ]
        }
      ]
    },
    {
      id: "offer-negotiation",
      title: "Negotiating the offer you just received",
      subtitle: "Level sets the band, so most of the value is decided before the number is discussed.",
      timebox: "1 week",
      prompt: "You have a verbal offer and a week to respond. Plan the conversation.",
      related: [
        { label: "Level determines the band", route: "#/offer/anatomy/level-bands" },
        { label: "Counter scripts", route: "#/offer/execution/counter-scripts" },
        { label: "Common mistakes", route: "#/offer/execution/mistakes" }
      ],
      outline: [
        {
          title: "Understand what is actually movable",
          items: [
            "Separate base, equity, bonus, and sign-on, and learn which the recruiter can approve alone.",
            "Compare offers on vesting shape, not on the headline total — the shapes are often not comparable.",
            "Establish the level first; moving up a level dominates moving within a band."
          ]
        },
        {
          title: "Do not negotiate against yourself",
          items: [
            "Avoid naming a number first; deflect the expectations question with a prepared sentence.",
            "Do not accept verbally before you are ready — it removes your leverage in one sentence.",
            "Give the recruiter a reason they can repeat upward rather than a demand they must defend."
          ]
        },
        {
          title: "Close cleanly either way",
          items: [
            "Confirm the agreed terms in writing before you resign anywhere.",
            "If you decline, do it warmly and specifically; you may interview there again.",
            "Keep the relationship intact — these are the people you are about to work with."
          ]
        }
      ]
    }
  ],

  interview: [
    {
      id: "tell-me-about-yourself",
      title: "Tell me about yourself",
      timebox: "90 sec",
      prompt: "Open the round with a 90-second answer that sets up everything you want asked about next.",
      expected: [
        "An arc, not a resume recital — where you started, what you moved toward, why you are here.",
        "One concrete anchor of scope so the interviewer calibrates your level early.",
        "A deliberate hook that invites the follow-up you are best prepared for.",
        "Ends cleanly instead of trailing off, and stays under two minutes."
      ],
      followups: [
        "Tell me more about that project you mentioned.",
        "Why did you leave that role?",
        "What are you looking for that you do not have now?"
      ],
      links: [
        { label: "The big three", route: "#/beh/delivery/big-three" },
        { label: "SALT", route: "#/beh/delivery/deliver-salt" }
      ]
    },
    {
      id: "conflict-story",
      title: "A time you disagreed with someone",
      timebox: "3 min",
      prompt: "Tell a conflict story where the outcome includes the relationship, not just the technical result.",
      expected: [
        "A real disagreement with something at stake, not a trivial preference.",
        "The other person's position stated fairly, which is the actual signal being probed.",
        "A resolution mechanism — data, a trial, an escalation — rather than simply prevailing.",
        "A result that covers both the decision and the working relationship afterwards.",
        "A Takeaway beat that changed how you handle disagreement now."
      ],
      followups: [
        "What would they say if I asked them about this?",
        "What would you do differently?",
        "Have you had a disagreement you lost? Tell me about that one."
      ],
      links: [
        { label: "Conflict and growth stories", route: "#/story/catalog/conflict-growth" },
        { label: "Pitfalls", route: "#/beh/delivery/pitfalls" }
      ]
    },
    {
      id: "ambiguity-story",
      title: "A time you acted without clear direction",
      timebox: "3 min",
      prompt: "Tell a story that proves you can operate when the problem is not yet defined.",
      expected: [
        "Genuine ambiguity — no owner, no spec, or conflicting stakeholders.",
        "The framing step you personally performed to make the problem tractable.",
        "A decision made with incomplete information, and the risk you knowingly accepted.",
        "Evidence you knew when to decide versus when to escalate."
      ],
      followups: [
        "Who else could have picked this up, and why did you?",
        "What information did you most wish you had had?",
        "How did you know it was working?"
      ],
      links: [
        { label: "Ownership and ambiguity", route: "#/story/catalog/ownership-ambiguity" },
        { label: "Naming the signal", route: "#/beh/foundation/decode" }
      ]
    },
    {
      id: "ai-working-style",
      title: "How do you work with AI tools?",
      timebox: "3 min",
      prompt: "Answer the round's newest question honestly and specifically.",
      expected: [
        "A concrete description of daily use rather than a general endorsement.",
        "An explicit account of where you do not rely on it, and the rule you use to decide.",
        "A real example of correcting a wrong output rather than accepting it.",
        "Something about keeping your own skills sharp when generation is cheap.",
        "Ideally, how you would raise a whole team's effective use, not just your own."
      ],
      followups: [
        "Tell me about a time it was confidently wrong.",
        "How do you review code you did not write?",
        "What would you not use it for at all?"
      ],
      links: [
        { label: "AI questions", route: "#/beh/advanced/ai-questions" },
        { label: "Practising", route: "#/beh/advanced/practicing" }
      ]
    }
  ],

  rubrics: {
    dimensions: [
      "Ownership — taking responsibility beyond what was assigned",
      "Scope and impact — the size of the thing you actually moved",
      "Dealing with ambiguity — operating before the problem is defined",
      "Conflict and collaboration — including the state of the relationship afterwards",
      "Communication — structure, concision, and being followable",
      "Judgement and trade-offs — the alternative you rejected and why",
      "Growth and self-awareness — a real failure and a real change",
      "Bias for action — deciding and moving when waiting was an option"
    ],
    bands: [
      {
        id: "beginner",
        title: "Beginner",
        summary: "Tells what happened but leaves the interviewer unable to score the candidate specifically.",
        signals: [
          "Says 'we' throughout, so no individual contribution is visible.",
          "No measurable result, or a result asserted without evidence.",
          "The story contains no real difficulty, so nothing is being demonstrated.",
          "Runs long, doubles back, and ends without a conclusion.",
          "The failure story is chosen to be so minor it signals no real risk was ever taken."
        ]
      },
      {
        id: "competent",
        title: "Competent",
        summary: "Structured, specific, and scoreable, with a clear personal contribution and a measured outcome.",
        signals: [
          "Opens with the outcome so the interviewer knows where the story is going.",
          "Separates 'I' from 'we' without disowning the team.",
          "Quantifies the result and can say how it was measured.",
          "Survives the first two follow-ups without changing the story.",
          "Includes a Takeaway beat that is specific rather than a platitude."
        ]
      },
      {
        id: "strong",
        title: "Strong",
        summary: "Demonstrates judgement at scope, holds up under sustained probing, and generalizes the lesson.",
        signals: [
          "Names the alternative that was rejected and what it would have cost.",
          "Handles twenty minutes of escalating follow-ups without thinning out.",
          "Frames scope accurately rather than inflating it, including what was outside their control.",
          "Treats the relationship as part of the result in conflict stories.",
          "Volunteers what they got wrong before being asked, and what changed afterwards."
        ]
      }
    ]
  },

  cheatsheets: [
    {
      id: "salt",
      title: "SALT, with time budgets",
      summary: "The four beats of a two-minute answer and how long each gets.",
      items: [
        "Setup (~25%) — enough situation to make the stakes legible, and no more. Overrunning here is the classic failure.",
        "Actions (~40%) — what you personally did, the decision points, and the alternative you rejected.",
        "Landing (~25%) — measured, and including the effect on people where relevant.",
        "Takeaway (~10%) — what changed in how you work. This is the beat most candidates skip.",
        "Open with the outcome in one sentence so the listener knows where you are heading."
      ]
    },
    {
      id: "select-fast",
      title: "Selecting a story in ten seconds",
      summary: "The four criteria, in the order to apply them.",
      items: [
        "Scope — is this at the level I am interviewing for, or below it?",
        "Relevance — does it prove the signal actually being probed, not an adjacent one?",
        "Uniqueness — have I already used this story in an earlier round today?",
        "Recency — is it recent enough that I still remember the numbers?",
        "Keep a short mental shortlist indexed by signal so selection is retrieval, not invention."
      ]
    },
    {
      id: "followup-drill",
      title: "The four probes to pre-answer",
      summary: "Every strong story should already survive these.",
      items: [
        "What exactly was your contribution, as distinct from the team's?",
        "What alternative did you reject, and what would it have cost?",
        "How did you measure the result, and how do you know your change caused it?",
        "What would you do differently, and what did you actually change afterwards?"
      ]
    },
    {
      id: "offer-checklist",
      title: "Before you respond to an offer",
      summary: "The sequence that protects the most value.",
      items: [
        "Confirm the level first — it sets the band, and the band dominates the number.",
        "Get every component in writing: base, equity and its vesting shape, bonus target, sign-on.",
        "Do not name a number first, and do not accept verbally before you are ready.",
        "Give the recruiter a reason they can repeat upward, not a demand.",
        "Ask for the extension you need rather than rushing a decision you cannot reverse.",
        "Whichever way you go, close warmly — the industry is smaller than it looks."
      ]
    }
  ],

  glossary: [
    {
      id: "salt-term",
      term: "SALT",
      definition: "Setup, Actions, Landing, Takeaway — a four-beat answer structure whose explicit Takeaway beat is what demonstrates growth.",
      useIt: "Use it as a pacing device, not a script; the beats should be invisible to the listener.",
      links: [{ label: "Deliver with SALT", route: "#/beh/delivery/deliver-salt" }]
    },
    {
      id: "signal-area",
      term: "Signal area",
      definition: "One of the competencies a behavioral round is scored against, such as ownership, scope, or dealing with ambiguity.",
      useIt: "Identify which signal a question probes before choosing a story; the literal words are rarely the question.",
      links: [{ label: "How you are evaluated", route: "#/beh/foundation/how-evaluated" }]
    },
    {
      id: "missing-i",
      term: "The missing “I”",
      definition: "The habit of narrating a story entirely in the first-person plural, leaving the interviewer unable to score your individual contribution.",
      useIt: "Credit the team once, then speak in the first person singular about your own decisions.",
      links: [{ label: "Pitfalls", route: "#/beh/delivery/pitfalls" }]
    },
    {
      id: "story-shortlist",
      term: "Story shortlist",
      definition: "Keeping a small pre-indexed set of stories mapped to signal areas so that choosing one under pressure is retrieval rather than invention.",
      useIt: "Build the shortlist before the loop; ten seconds of silence choosing a story is ten seconds you needed for the answer.",
      links: [{ label: "Selecting a story", route: "#/beh/foundation/select" }]
    },
    {
      id: "coverage-matrix",
      term: "Coverage matrix",
      definition: "A grid of your stories against the signal areas, used to find the cells no story currently fills.",
      useIt: "Treat an empty cell as a preparation task, or with enough runway, as work worth going and doing.",
      links: [{ label: "Coverage matrix", route: "#/story/catalog/coverage-matrix" }]
    },
    {
      id: "loop-lead",
      term: "Loop lead",
      definition: "The interviewer who aggregates feedback from the whole loop and carries the hiring recommendation, frequently the behavioral interviewer.",
      useIt: "Explains why the behavioral round often carries more weight than candidates expect.",
      links: [{ label: "Meta E5 playbook", route: "#/loops/meta/meta-e5" }]
    },
    {
      id: "bar-raiser",
      term: "Bar raiser",
      definition: "An interviewer from outside the hiring team whose role is to hold the hiring standard, commonly running a long principle-focused round.",
      useIt: "Prepare depth per story rather than breadth; this round exhausts a shallow answer quickly.",
      links: [{ label: "Amazon L5 playbook", route: "#/loops/amazon/amazon-l5" }]
    },
    {
      id: "hiring-committee",
      term: "Hiring committee",
      definition: "A post-loop review by people who never met you, deciding from the written packet your interviewers produced.",
      useIt: "Means being quotable and concrete matters as much as being likeable in the room.",
      links: [{ label: "Google manager playbook", route: "#/loops/google/google-manager" }]
    },
    {
      id: "down-level",
      term: "Down-level",
      definition: "Being offered a role one level below the one you interviewed for, sometimes on behavioral evidence alone.",
      useIt: "Cite it as the reason scope evidence belongs in your stories, not only in your resume.",
      links: [{ label: "Proving scope", route: "#/story/catalog/scope-signal" }]
    },
    {
      id: "vesting-shape",
      term: "Vesting shape",
      definition: "The schedule on which equity actually becomes yours — even, cliffed, or back-loaded — which changes what a headline number is worth.",
      useIt: "Compare competing offers on year-one and four-year value, never on the headline alone.",
      links: [{ label: "Offer components", route: "#/offer/anatomy/components" }]
    },
    {
      id: "compensation-band",
      term: "Compensation band",
      definition: "The approved range attached to a level, within which a recruiter has discretion and outside which they generally do not.",
      useIt: "Explains why negotiating level beats negotiating dollars, and why a flat refusal may be a policy limit rather than a tactic.",
      links: [{ label: "Level determines the band", route: "#/offer/anatomy/level-bands" }]
    },
    {
      id: "leverage",
      term: "Leverage",
      definition: "Anything that makes it costlier for the employer to lose you than to pay you more — most reliably a competing offer, sometimes just timing.",
      useIt: "Be honest with yourself about whether you have any; leverage-free negotiation has a real but smaller ceiling.",
      links: [{ label: "Leverage", route: "#/offer/anatomy/leverage" }]
    }
  ]
};
