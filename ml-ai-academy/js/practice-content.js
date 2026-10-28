/* Synapse practice reference — scenario packs, interview prompts, rubrics,
   cheat sheets, and glossary for the practice hub. Every `route` here must
   resolve to a real lesson in one of the window.TRACKS registered by js/track-*.js. */
window.SynapsePractice = {
  nav: [
    {
      id: "scenarios",
      route: "#/scenarios",
      title: "Scenario packs",
      label: "Model-answer outlines",
      color: "#a78bfa",
      icon: "map",
      summary: "Compact outlines you can talk through end to end for the ML design problems that come up most."
    },
    {
      id: "interview",
      route: "#/interview",
      title: "Interview prompts",
      label: "Timed practice",
      color: "#38bdf8",
      icon: "quiz",
      summary: "Timed prompts with the points an interviewer is listening for and the follow-ups they will push on."
    },
    {
      id: "rubrics",
      route: "#/rubrics",
      title: "Rubrics",
      label: "Score yourself",
      color: "#34d399",
      icon: "star",
      summary: "The dimensions an ML design round is scored on, and what each band actually sounds like."
    },
    {
      id: "cheatsheets",
      route: "#/cheatsheets",
      title: "Cheat sheets",
      label: "Fast recall",
      color: "#fbbf24",
      icon: "md",
      summary: "The sequences and numbers worth having in memory before you walk in."
    },
    {
      id: "glossary",
      route: "#/glossary",
      title: "Glossary",
      label: "Say it precisely",
      color: "#f472b6",
      icon: "lesson",
      summary: "The terms you will be expected to use correctly, with the sentence that shows you mean it."
    }
  ],

  scenarios: [
    {
      id: "recommendation-surface",
      title: "A recommendation surface, end to end",
      subtitle: "The most common ML design prompt, and the one where objective framing decides your score.",
      timebox: "45 min",
      prompt: "Design the system that decides what to show on a content home surface for tens of millions of daily users.",
      related: [
        { label: "Objective framing", route: "#/mlsd/framework/problem-framing" },
        { label: "Retrieval and ranking", route: "#/mlsd/serving/retrieval-ranking" },
        { label: "Video recommendations", route: "#/mlcase/recsys/video-recommendations" }
      ],
      outline: [
        {
          title: "Frame the objective before anything else",
          items: [
            "Say out loud that clicks are a proxy, and a bad one: optimizing them selects for misleading thumbnails.",
            "Walk the ladder deliberately — clicks, then watch time, then a satisfaction-weighted objective with quality guardrails.",
            "Name the guardrail metrics you would refuse to regress, so the objective is falsifiable."
          ]
        },
        {
          title: "Split retrieval from ranking",
          items: [
            "Cheap high-recall candidate generation narrows millions of items to a few hundred; an expensive ranker orders those.",
            "Justify the candidate-set size as a latency budget decision, not a round number.",
            "Cover multiple retrieval sources — recent, personalized, and popular — and why a single source under-serves new users."
          ]
        },
        {
          title: "Be concrete about features and labels",
          items: [
            "Name the five signal sources and which ones you would ship first given cold-start risk.",
            "Define the positive label precisely, including the dwell threshold that separates a real view from a bounce.",
            "Call out position bias in the logs and say how you would keep the training data honest."
          ]
        },
        {
          title: "Close with operations",
          items: [
            "State the offline metric, the online guardrails, and why an offline win often fails to replicate.",
            "Describe the feedback loop and the exploration budget that stops it degenerating.",
            "Give the monitoring signal that would fire before the business metric moved."
          ]
        }
      ]
    },
    {
      id: "moderation-pipeline",
      title: "A content moderation pipeline",
      subtitle: "Where the graded objective ladder matters most, and where the threshold is a policy decision.",
      timebox: "45 min",
      prompt: "Design a system that detects and acts on harmful content across a large user-generated platform.",
      related: [
        { label: "Harmful content breakdown", route: "#/mlcase/trust/harmful-content" },
        { label: "Evaluation metrics", route: "#/mlsd/concepts/evaluation" },
        { label: "Feature pitfalls", route: "#/mlsd/concepts/feature-pitfalls" }
      ],
      outline: [
        {
          title: "Get the objective right",
          items: [
            "Reject 'maximize accuracy' explicitly — with severe class imbalance a do-nothing model scores well.",
            "Move to removal subject to a precision floor, then to minimizing harmful views subject to that floor.",
            "Explain why exposure is the right target: a post removed after a million views is a failure the earlier framings score as success."
          ]
        },
        {
          title: "Design for two decisions, not one",
          items: [
            "Auto-action above a high threshold, human review in a band, ignore below — three regions, two thresholds.",
            "Treat the review queue as part of the system, with a capacity you must design against.",
            "State plainly that threshold selection is a policy call informed by cost, not an ML optimum."
          ]
        },
        {
          title: "Handle the label problem",
          items: [
            "Labels arrive late, disagree between reviewers, and shift as policy changes — say so.",
            "Describe how you would measure inter-reviewer agreement and treat it as a ceiling on model quality.",
            "Cover appeals as a labelled data source and as a fairness requirement."
          ]
        },
        {
          title: "Anticipate the deep dives",
          items: [
            "Multimodal signals, and why text alone under-performs on the hardest cases.",
            "Adversarial adaptation, and the retraining cadence it forces.",
            "What you would do when a single viral item is being missed right now."
          ]
        }
      ]
    },
    {
      id: "retrieval-assistant",
      title: "A grounded assistant over a document corpus",
      subtitle: "Retrieval quality dominates, and hallucination is an evaluation problem you must actually measure.",
      timebox: "45 min",
      prompt: "Design an assistant that answers questions over a large private document corpus with citations.",
      related: [
        { label: "RAG assistant breakdown", route: "#/mlcase/retrieval/rag-assistant" },
        { label: "Approximate nearest neighbour", route: "#/mlsd/concepts/ann-serving" },
        { label: "Inference architecture", route: "#/mlsd/serving/inference-architecture" }
      ],
      outline: [
        {
          title: "Start with retrieval, not generation",
          items: [
            "Say early that most answer-quality failures are retrieval failures, so that is where the design effort goes.",
            "Cover chunking as a real design decision with a measurable effect on recall.",
            "Argue for hybrid lexical plus dense retrieval, then a reranker over a small candidate set."
          ]
        },
        {
          title: "Make grounding checkable",
          items: [
            "Require citations back to retrieved spans so an answer can be audited.",
            "Define an evaluation set with known answers, and measure groundedness rather than asserting it.",
            "Describe the behaviour when retrieval returns nothing relevant — refusing is a feature."
          ]
        },
        {
          title: "Budget latency and cost explicitly",
          items: [
            "Decompose the request budget across retrieval, reranking, and generation.",
            "Stream tokens so perceived latency is the time to first token, not the total.",
            "Name the levers when cost is too high: smaller candidate sets, caching, a cheaper reranker."
          ]
        }
      ]
    },
    {
      id: "found-ranker-launch",
      title: "Launching a new search ranker",
      subtitle: "From offline win to a decision you can defend",
      timebox: "45 min",
      prompt: "Your team's new search ranker improves offline NDCG@10 by 3 points on rater-labelled queries. The site has 200,000 daily searchers and conversion from search is 4%. Leadership wants to know within a month whether to ship it. Plan the evaluation path from offline checks to a launch decision.",
      related: [
        { label: "Ranking metrics: precision@k to NDCG", route: "#/found/metrics/ranking-metrics" },
        { label: "Why offline wins do not always ship", route: "#/found/experiments/offline-online" },
        { label: "Interleaving: a sharper test for rankers", route: "#/found/experiments/interleaving" },
        { label: "Online testing", route: "#/mlsd/concepts/ab-testing" }
      ],
      outline: [
        {
          title: "Offline gate",
          items: [
            "Out-of-time query sample, sliced by head, torso and tail queries",
            "Report unjudged rate in the top 10 and fill gaps with rater labels",
            "Check recall at the retrieval stage did not regress"
          ]
        },
        {
          title: "Fast online screen",
          items: [
            "Team-draft interleaving against production for a few days",
            "Win rate with a confidence interval; discard if not clearly ahead",
            "Watch latency so the new ranker fits the budget"
          ]
        },
        {
          title: "Confirming A/B test",
          items: [
            "User-level randomization; primary metric search conversion",
            "Size it: 4% baseline, 3% relative MDE gives roughly 420,000 users per arm, so about 5 days at 100,000 per arm per day — run two full weeks anyway",
            "Guardrails: zero-result rate, latency, revenue per search; SRM check first; CUPED on pre-period conversion"
          ]
        },
        {
          title: "Decision and follow-through",
          items: [
            "Ship only if the primary metric wins and no guardrail regresses",
            "Keep a small long-term holdout to measure cumulative effects",
            "Record offline and online deltas so future offline wins can be trusted or discounted"
          ]
        }
      ]
    },
    {
      id: "data-fraud-feature-platform",
      title: "Feature platform for real-time fraud scoring",
      subtitle: "Delayed labels, streaming velocity features and a point-in-time training set",
      timebox: "45 min",
      prompt: "A payments company scores every card transaction in under 50 ms. Confirmed fraud arrives as chargebacks up to 90 days later. Design the labels, the features (including velocity features fresh within seconds), the feature storage and retrieval, and the validation gates, so the model can be retrained weekly without leakage or training/serving skew.",
      related: [
        { label: "Designing a feature store", route: "#/data/features/feature-store-design" },
        { label: "Point-in-time correctness and as-of joins", route: "#/data/correctness/point-in-time" },
        { label: "Fraud detection breakdown", route: "#/mlcase/trust/fraud-detection" }
      ],
      outline: [
        {
          title: "Labels",
          items: [
            "Chargeback within 90 days as the true label, a 14-day dispute as an early proxy",
            "Exclude transactions younger than the label window from negatives",
            "Reviewer decisions logged as labels with their routing reason"
          ]
        },
        {
          title: "Features",
          items: [
            "Streaming velocity counts on event time with watermarks",
            "Merchant and device aggregates with smoothed, point-in-time target encoding",
            "Missing indicators and versioned transform parameters"
          ]
        },
        {
          title: "Storage and retrieval",
          items: [
            "Online key-value store with single-digit-millisecond reads and per-feature TTL",
            "Offline append-only history with as-of retrieval on availability time",
            "Online feature vectors logged with every prediction"
          ]
        },
        {
          title: "Validation and imbalance",
          items: [
            "Ingestion and pre-training gates; quarantine on shifts",
            "Negative downsampling for training cost with the probability correction",
            "Evaluation at the natural fraud rate, precision at the review team's capacity"
          ]
        }
      ]
    },
    {
      id: "train-slow-expensive-job",
      title: "The training job that got slow and expensive",
      subtitle: "Diagnose, re-architect and cost a training run that has outgrown one box",
      timebox: "45 min",
      prompt: "An image-and-metadata classifier used to train overnight on one GPU. The dataset has tripled, the run now takes four days, someone added 8 more GPUs and it got only 30% faster, and finance wants the monthly training bill halved. Walk through how you would find the bottleneck, restructure the job, and cut the cost without losing the ability to reproduce results.",
      related: [
        { label: "Why training goes distributed — and when it should not", route: "#/train/parallel/why-distributed" },
        { label: "Data parallelism and gradient synchronisation", route: "#/train/parallel/data-parallel" },
        { label: "Training efficiency: the levers that pay", route: "#/train/compute/training-efficiency" },
        { label: "Reproducibility you can actually achieve", route: "#/train/experiments/reproducibility" }
      ],
      outline: [
        {
          title: "Find the wall",
          items: [
            "Profile one step: data wait, forward/backward, communication, optimizer.",
            "A 30% speed-up from 9× the GPUs points at the input pipeline or sync, not compute.",
            "Check loader CPU, decode throughput and storage read rate against the required images per second."
          ]
        },
        {
          title: "Restructure the job",
          items: [
            "Pre-decode and cache the dataset as sharded binary files near the GPUs.",
            "Keep data parallelism on one node first; retune learning rate with warmup for the larger effective batch.",
            "Overlap gradient all-reduce with backward; accumulate gradients if going cross-node."
          ]
        },
        {
          title: "Cut the bill",
          items: [
            "Turn on mixed precision; estimate GPU-hours from FLOPs and measured utilisation.",
            "Move to preemptible capacity with full-state, atomic checkpoints and a tested resume.",
            "Use early stopping and warm starts; run tuning sweeps with successive halving."
          ]
        },
        {
          title: "Keep it reproducible",
          items: [
            "Pin data snapshot, commit, config and container digest in every run record.",
            "Measure a seed noise band before and after the change so speed-ups are not paid for in accuracy."
          ]
        }
      ]
    },
    {
      id: "ops-fraud-model-incident",
      title: "The fraud model that doubled its block rate",
      subtitle: "Running a model incident from first alert to postmortem",
      timebox: "45 min",
      prompt: "At 02:40 the payments fraud model's block rate jumps from 0.8% to 1.7% within an hour. Support tickets about declined cards are starting to arrive. An upstream team shipped a change to the merchant-enrichment job at 01:55, and a new model version went to 25% canary yesterday afternoon. Walk through detection, triage, mitigation, fix and review.",
      related: [
        { label: "The drift playbook: running a model incident", route: "#/ops/monitoring/drift-playbook" },
        { label: "Drift and skew: telling the kinds of change apart", route: "#/ops/monitoring/drift-and-skew" },
        { label: "Monitoring a system that fails quietly", route: "#/mlsd/serving/drift-monitoring" }
      ],
      outline: [
        {
          title: "Detect and size",
          items: [
            "Confirm the alert against the concurrent control and per slice: is it the canary cohort, all traffic, or one merchant category?",
            "Declare severity from impact: legitimate payments blocked at scale is SEV1."
          ]
        },
        {
          title: "Triage bug versus world",
          items: [
            "Step change aligned with the 01:55 upstream deploy points at a pipeline bug; check merchant feature null rates and single-bin spikes.",
            "If only the canary cohort moved, the new model version is the suspect, not the world."
          ]
        },
        {
          title: "Mitigate fast and reversibly",
          items: [
            "Canary suspect: move traffic back to the production alias and halt the rollout.",
            "Upstream suspect: kill or impute the broken feature, or drop to the fallback model; freeze automated retraining."
          ]
        },
        {
          title: "Fix and review",
          items: [
            "Repair the enrichment job or the model, re-validate data, and re-run gates and rollout before restoring.",
            "Postmortem: detection delay, which monitor should have fired first, and one concrete change such as a null-rate alarm on that feature."
          ]
        }
      ]
    },
    {
      id: "rank-new-creator-exposure",
      title: "New creators can't break through",
      subtitle: "A short-video feed whose exposure is concentrating on the head",
      timebox: "45 min",
      prompt: "Over six model releases, a short-video feed raised watch time each time, but the share of impressions going to creators who joined in the last 90 days fell from 18% to 6% and catalogue coverage halved. Creator sign-ups are now declining. Diagnose the cause and design a fix that does not give back most of the watch-time gains.",
      related: [
        { label: "Feedback loops, bias and exposure fairness", route: "#/rank/dynamics/feedback-fairness" },
        { label: "Bandits: exploring on purpose", route: "#/rank/dynamics/bandits" },
        { label: "Cold start for users and items", route: "#/rank/dynamics/cold-start" },
        { label: "Video recommendations", route: "#/mlcase/recsys/video-recommendations" }
      ],
      outline: [
        {
          title: "Diagnose the loop",
          items: [
            "Check whether new items are even retrieved: do they have content embeddings at publish time, or only id embeddings?",
            "Measure each release's change in coverage and exposure Gini, not just watch time.",
            "Look for position bias in training: is the ranker learning the previous ranker's ordering?"
          ]
        },
        {
          title: "Give new items a fair first impression",
          items: [
            "Add content-based retrieval and creator priors so new items reach the candidate set.",
            "Reserve an exploration slot run by Thompson sampling over under-exposed items, and log propensities.",
            "Stream early engagement counters so the first few hundred impressions update features within minutes."
          ]
        },
        {
          title: "Constrain the page",
          items: [
            "Enforce an amortized exposure floor for new creators in the re-ranking layer.",
            "Apply per-creator caps after de-duplication and before ad insertion."
          ]
        },
        {
          title: "Measure the trade",
          items: [
            "Run an online test with watch time as the primary metric and coverage, exposure Gini and creator retention as guardrails.",
            "Judge the result on a longer horizon, since exposure changes cost a little day-one engagement by design."
          ]
        }
      ]
    },
    {
      id: "resp-fraud-hold-review",
      title: "Fraud holds that hit one group harder",
      subtitle: "A payment-fraud model is placing account holds at twice the rate on one customer group.",
      timebox: "45 min",
      prompt: "Support escalations show that customers in one region-and-age segment get fraud holds at roughly twice the rate of everyone else, and most of their appeals are overturned. Overall precision of the model looks unchanged. Investigate, mitigate, and redesign the controls so this is caught earlier next time.",
      related: [
        { label: "Where bias enters and what each fix moves", route: "#/resp/fairness/bias-mitigation" },
        { label: "Human oversight, appeals and incident response", route: "#/resp/governance/human-oversight" },
        { label: "Bot detection breakdown", route: "#/mlcase/trust/bot-detection" },
        { label: "Confusion matrix", route: "#/found/metrics/confusion-matrix" }
      ],
      outline: [
        {
          title: "Contain and scope",
          items: [
            "Decide whether to route the affected segment to human review or a conservative fallback while you investigate.",
            "Use decision-time logs to list affected holds by model version and reverse wrongful ones.",
            "Measure the false positive rate per segment and intersection, with sample sizes, rather than overall precision."
          ]
        },
        {
          title: "Diagnose the source",
          items: [
            "Check sampling: is the segment thin in training data or new to the product?",
            "Check measurement and proxies: device, location or transaction features that behave differently for this segment.",
            "Check labels and feedback: are past holds and chargebacks labelled consistently, and did enforcement shape the data?"
          ]
        },
        {
          title: "Mitigate with a stated trade",
          items: [
            "Pick the criterion that matches the harm — equal false positive rates for wrongful punitive action — and a tolerance.",
            "Choose pre-, in- or post-processing based on the source, and quantify the fraud-loss cost of each option.",
            "Clear group-specific thresholds with legal and policy partners before using them."
          ]
        },
        {
          title: "Make it observable",
          items: [
            "Alert on per-segment FPR and appeal-overturn rate, with minimum counts and sustained windows.",
            "Feed overturned appeals back as labelled false positives into evaluation and fairness slices.",
            "Update the model card's limitations and record the incident and decisions in the decision log."
          ]
        }
      ]
    },
    {
      id: "mlcase-fraud-authorization",
      title: "Payment fraud at authorization time",
      subtitle: "Tens of milliseconds, labels weeks late, and a cost measured in currency",
      timebox: "45 min",
      prompt: "You run risk for an online payments platform. Every card-not-present purchase must get an approve, step-up, review, or decline decision within tens of milliseconds. Fraud is about one transaction in a thousand, chargebacks arrive weeks to months later, and finance estimates that false declines cost more in total than fraud does. Design the fraud system.",
      related: [
        { label: "Catching payment fraud at authorization time", route: "#/mlcase/trust/fraud-detection" },
        { label: "Confusion matrix", route: "#/found/metrics/confusion-matrix" },
        { label: "Class imbalance", route: "#/data/labels/class-imbalance" },
        { label: "Point-in-time correctness", route: "#/data/correctness/point-in-time" }
      ],
      outline: [
        {
          title: "Frame the objective in money",
          items: [
            "Reject accuracy and raw fraud rate; minimise total expected cost: fraud losses and fees, false declines, step-up friction, and review cost.",
            "Choose the action per transaction by expected cost, so the break-even probability falls as the amount rises.",
            "Require a calibrated probability, checked per amount band and region."
          ]
        },
        {
          title: "Features and serving inside the budget",
          items: [
            "Velocity counters per card, device, IP, and email from a stream aggregator, reconstructed point-in-time for training.",
            "Entity resolution off the request path, producing precomputed risk scores for linked devices, cards, and addresses.",
            "Tiers: rules for hard blocks and live attacks, GBDT model, expected-cost decision layer, capacity-bound manual review."
          ]
        },
        {
          title: "Labels that are late and selected",
          items: [
            "Train on matured windows; use reports, issuer alerts, and review outcomes as faster partial labels.",
            "Budget a small, amount-capped random-approve slice to label what the old model would have declined.",
            "Treat reject inference as a weak, circular signal; use step-up abandonment as partial evidence."
          ]
        },
        {
          title: "Evaluate, monitor, adapt",
          items: [
            "Time-forward backtests reporting value-weighted recall and expected cost against the incumbent policy.",
            "Online: fraud basis points, approval rate, step-up completion, review queue depth, false-decline slices by region and account age.",
            "Expect adversarial adaptation after each deploy: fast rules, frequent retraining, and drift monitors per attack pattern."
          ]
        }
      ]
    }
  ],

  interview: [
    {
      id: "video-recs-45",
      title: "Video recommendations in 45 minutes",
      timebox: "45 min",
      prompt: "Design the ranking system for a video home feed serving 50 million daily users.",
      expected: [
        "Walks the objective ladder from clicks to watch time to a satisfaction-weighted target with guardrails.",
        "Separates candidate generation from ranking and justifies the candidate-set size against a latency budget.",
        "Defines the positive label precisely, including a dwell threshold.",
        "Names position bias in the logs and a concrete way to mitigate it.",
        "Closes with online guardrails and an exploration budget for the feedback loop."
      ],
      followups: [
        "A new creator uploads their first video. How does it ever get shown?",
        "Your offline metric improved but the online test was flat. What do you check first?",
        "Halve your serving budget. What comes out of the design?"
      ],
      links: [
        { label: "Video recommendations lesson", route: "#/mlcase/recsys/video-recommendations" },
        { label: "Objective framing", route: "#/mlsd/framework/problem-framing" }
      ]
    },
    {
      id: "ad-click-45",
      title: "Ad click prediction in 45 minutes",
      timebox: "45 min",
      prompt: "Design click-through prediction for an ad auction with a strict per-request latency budget.",
      expected: [
        "Recognizes that an auction needs calibrated probabilities, not just correct ordering.",
        "Handles extreme class imbalance and explains why ROC-AUC alone is misleading here.",
        "Covers very high-cardinality categorical features and a hashing or embedding strategy.",
        "Decomposes the latency budget and states what that rules out.",
        "Distinguishes the business metric from the ML metric and keeps both on the table."
      ],
      followups: [
        "Your model ranks well but the auction is over-charging. What is wrong?",
        "How would you detect that your calibration has drifted?",
        "Which feature would you remove first if it doubled your serving cost?"
      ],
      links: [
        { label: "Ad click breakdown", route: "#/mlcase/recsys/ad-click-prediction" },
        { label: "Evaluation metrics", route: "#/mlsd/concepts/evaluation" }
      ]
    },
    {
      id: "bot-detection-40",
      title: "Bot detection in 40 minutes",
      timebox: "40 min",
      prompt: "Design a system that identifies automated accounts on a large social platform.",
      expected: [
        "Treats the problem as adversarial and states that a static model decays by design.",
        "Uses graph and behavioural features, not just per-account attributes.",
        "Reasons about the asymmetric cost of false positives against real users.",
        "Includes an appeals path as part of the system design.",
        "Gives a retraining and monitoring cadence tied to the adversary's adaptation."
      ],
      followups: [
        "Your precision looks excellent. Why might that be misleading here?",
        "An attacker learns your main feature. What breaks and what do you do?",
        "How do you evaluate when your labels are themselves produced by an earlier version of the model?"
      ],
      links: [
        { label: "Bot detection breakdown", route: "#/mlcase/trust/bot-detection" },
        { label: "Feature pitfalls", route: "#/mlsd/concepts/feature-pitfalls" }
      ]
    },
    {
      id: "search-ranking-45",
      title: "Search ranking in 45 minutes",
      timebox: "45 min",
      prompt: "Design ranking for text search over a very large and frequently updated corpus.",
      expected: [
        "Compares lexical and dense retrieval and argues for a hybrid rather than picking one.",
        "Uses learning-to-rank over a candidate set rather than scoring the whole corpus.",
        "Identifies click logs as biased training data and names a debiasing approach.",
        "Handles the freshness-versus-relevance tension explicitly.",
        "Discusses tail latency from the slowest shard in a scatter-gather design."
      ],
      followups: [
        "A query with no clicks in your logs performs badly. How do you improve it?",
        "How would you keep the index near-real-time without wrecking query latency?",
        "Your ranker is great on head queries and poor on tail queries. Why, and what now?"
      ],
      links: [
        { label: "Search ranking breakdown", route: "#/mlcase/retrieval/search-ranking" },
        { label: "Retrieval and ranking", route: "#/mlsd/serving/retrieval-ranking" }
      ]
    },
    {
      id: "found-fraud-metrics-45",
      title: "Choose the metrics and the launch test for a payment fraud model",
      timebox: "45 min",
      prompt: "A payments team has a rules-based fraud screen and wants to replace it with a model. Fraud is about 0.2% of transactions, analysts can review 2,000 flags a day, and a missed fraud costs roughly 100 times an unnecessary review. Decide whether ML is justified, which offline metrics you would report, how you would pick the operating threshold, and how you would prove the model is better in production.",
      expected: [
        "Treats the existing rules as the baseline and states the lift needed to justify a model's running cost",
        "Rejects accuracy and ROC-AUC alone because of the 0.2% base rate; reports PR-AUC and precision at the recall the review capacity allows",
        "Derives a threshold from cost asymmetry and review capacity, and notes the cost formula needs calibrated probabilities",
        "Checks calibration with a reliability diagram and corrects for any negative downsampling",
        "Designs the online test: unit of randomization, primary metric (fraud losses), guardrails (approval rate, review load), sample size and duration given label delay",
        "Mentions SRM checks, no peeking, and a long-term holdout or shadow period because chargeback labels arrive weeks later"
      ],
      followups: [
        "Chargebacks arrive 45 days after the transaction. How does that change your offline split and your online test duration?",
        "The model is better offline but approval rate drops 0.5% online. What do you do?",
        "Analysts only label what the model flags. How does that bias next month's training data?"
      ],
      links: [
        { label: "Should this be ML at all?", route: "#/found/framing/ml-or-not" },
        { label: "ROC vs PR curves, and the base-rate trap", route: "#/found/metrics/roc-pr-curves" },
        { label: "Designing an A/B test that can answer the question", route: "#/found/experiments/ab-test-design" }
      ]
    },
    {
      id: "data-churn-training-set-45",
      title: "Build the training set for a churn model",
      timebox: "45 min",
      prompt: "A subscription business wants to predict which subscribers will cancel in the next 30 days so a retention team can intervene. You have an events log, a CRM table that is updated in place, a billing table, and support tickets. Design the labels, the training set, and the validation that makes the offline metric trustworthy.",
      expected: [
        "Defines the decision time (e.g. a daily or monthly scoring instant) and a 30-day label window that starts at it, excluding unfinished windows",
        "Identifies target leaks such as cancellation-reason fields and temporal leaks from the update-in-place CRM table",
        "Builds features with as-of joins on availability time against append-only history, and proposes snapshotting the CRM table",
        "Splits by subscriber and by time, and drops raw ids as features",
        "Handles imbalance by evaluating on the natural base rate with precision at the retention team's capacity",
        "Puts validation gates at ingestion and pre-training, with quarantine for distribution shifts",
        "Notes the feedback loop: retention offers change outcomes, so treated subscribers need logging or a holdout"
      ],
      followups: [
        "The offline AUC is 0.97. What do you check first?",
        "The CRM table has no history. How do you get point-in-time values for the last two years?",
        "The retention team can only call 2,000 people a week. How does that change your metric?",
        "How would you keep the model honest once retention offers start being driven by its scores?"
      ],
      links: [
        { label: "A field guide to leakage", route: "#/data/correctness/leakage-taxonomy" },
        { label: "Point-in-time correctness and as-of joins", route: "#/data/correctness/point-in-time" },
        { label: "Class imbalance without breaking your probabilities", route: "#/data/labels/class-imbalance" }
      ]
    },
    {
      id: "train-daily-ranker-45",
      title: "Retrain a large ranking model every day",
      timebox: "45 min",
      prompt: "A feed-ranking model has a 1-billion-row user embedding table and a modest dense network, trained on the last 30 days of impressions. The business wants it retrained daily, on a fixed budget, with the ability to trace any production model back to its data. Design the training infrastructure.",
      expected: [
        "Diagnoses the walls first: the embedding tables are the memory problem, the input pipeline is the likely throughput problem.",
        "Shards embedding tables across GPUs with an all-to-all exchange and keeps the dense network data-parallel.",
        "Estimates memory per component and compute per run, then multiplies by a daily cadence to check the budget.",
        "Uses warm starts on the newest window with a periodic from-scratch retrain as a reference.",
        "Checkpoints full training state atomically so preemptible capacity is safe.",
        "Records code, config, data snapshot and environment for every run and links them from the registry."
      ],
      followups: [
        "Popular items overload one embedding shard — what do you change?",
        "A new run is 0.1% better offline. How do you decide whether that is real?",
        "The job is moved to spot capacity and dies every few hours. How often do you checkpoint?",
        "Why might the daily warm-started model drift from a from-scratch retrain, and how would you detect it?"
      ],
      links: [
        { label: "Tensor, pipeline and embedding-table sharding", route: "#/train/parallel/model-pipeline-parallel" },
        { label: "GPU economics: memory, throughput and cost", route: "#/train/compute/gpu-economics" },
        { label: "Training efficiency: the levers that pay", route: "#/train/compute/training-efficiency" },
        { label: "Experiment tracking and lineage", route: "#/train/experiments/experiment-tracking" }
      ]
    },
    {
      id: "ops-churn-model-ops-45",
      title: "Operate a churn-prediction model in production",
      timebox: "45 min",
      prompt: "A subscription business has a churn model that scores 20 million accounts and feeds a retention-offer system. Leadership wants it retrained regularly and wants confidence that a bad retrain or upstream data change cannot quietly burn the offer budget. Design the delivery, rollout and monitoring around the model.",
      expected: [
        "Chooses batch scoring nightly with a freshness alarm and a default for new accounts, and justifies it from input cardinality and staleness tolerance.",
        "Registry with immutable versions, data snapshot lineage, and serving through a production alias for one-step rollback.",
        "CI gates as config: data validation, tolerance gate vs production on a frozen eval set, slice gates by tenure and plan, behavioural tests.",
        "Rollout by holding out a concurrent control for offers, with halt criteria on offer rate and guardrails such as offer cost per retained user.",
        "Monitoring in layers: null rates and PSI per slice immediately, score distribution and offer rate daily, churn labels after the billing cycle.",
        "Retraining cadence from a decay curve; drift opens an investigation rather than launching a retrain; triage bug vs world before acting."
      ],
      followups: [
        "Churn labels take 30 days. What do you watch in the first week after a new version ships?",
        "The offer rate doubles overnight with every input monitor green. Walk through your triage.",
        "Finance wants the model retrained daily. How do you decide whether that is worth it?",
        "How would you make rolling back safe if the feature schema changed between versions?"
      ],
      links: [
        { label: "The model registry: versions, lineage, and rollback by pointer", route: "#/ops/delivery/model-registry" },
        { label: "Safe rollouts: shadow, canary, and the kill switch", route: "#/ops/inference/safe-rollouts" },
        { label: "When to retrain: schedules, triggers, and the decay curve", route: "#/ops/monitoring/retraining-triggers" }
      ]
    },
    {
      id: "rank-marketplace-search-45",
      title: "Design product search ranking for a marketplace",
      timebox: "45 min",
      prompt: "A marketplace with 200 million listings from 5 million sellers wants to improve search results. Queries must return ten ranked listings in under 150 ms at p99. Listings come and go constantly, availability and shipping region are hard constraints, and leadership is worried that a handful of large sellers dominate results.",
      expected: [
        "A funnel with explicit counts and latency slices: lexical plus embedding retrieval, a light ranker, a heavy ranker, and a re-ranking layer.",
        "A two-tower query and listing model with content features so new listings are retrievable on day zero, trained with in-batch negatives and logQ correction.",
        "An ANN strategy that handles selective availability and region filters, with an index refresh plan for constant listing churn.",
        "A ranker with calibrated heads for click, add-to-cart and purchase, combined in a value model, with position bias handled in training.",
        "A re-ranking layer with seller caps or an exposure floor, and coverage and exposure Gini tracked as guardrails next to conversion."
      ],
      followups: [
        "End-to-end recall dropped after you widened the filters. Which stage do you inspect first, and how do you measure its recall?",
        "How would you give a brand-new seller's listings a fair first set of impressions without hurting conversion much?",
        "Your offline NDCG improved by four percent but the online test is flat. What are the likely explanations?"
      ],
      links: [
        { label: "The ranking funnel, stage by stage", route: "#/rank/retrieval/ranking-funnel" },
        { label: "ANN indexes: IVF, graphs and quantization", route: "#/rank/retrieval/ann-indexes" },
        { label: "Search ranking", route: "#/mlcase/retrieval/search-ranking" }
      ]
    },
    {
      id: "resp-credit-limit-45",
      title: "Design a fair credit-limit model",
      timebox: "45 min",
      prompt: "A bank wants a model that sets initial credit limits for new card customers. Leadership asks that it be fair across demographic groups, explainable to customers who are unhappy with their limit, and compliant with internal model-risk policy. Design the system and its responsible-ML controls.",
      expected: [
        "Frames the harm of each error (limits too low deny a benefit; too high cause over-indebtedness) and picks a fairness metric with a tolerance from that analysis.",
        "Notes that repayment labels exist only for approved customers (selective labels) and proposes how to evaluate and partially correct for it.",
        "Keeps protected attributes for evaluation, reports slice and intersection metrics with sample sizes, and discusses proxies.",
        "Chooses a mitigation stage tied to the bias source and states its accuracy cost and policy constraints on using the attribute.",
        "Provides reason codes and an actionable counterfactual for customers, and distinguishes them from global importance.",
        "Places the model in the high-risk tier with independent validation, registry gates, decision-time audit logs, appeals and a fallback switch."
      ],
      followups: [
        "Base rates of repayment differ between two groups. A stakeholder wants equal average limits. What do you say?",
        "Six months in, the fairness gap has doubled while overall AUC is flat. Walk me through your investigation.",
        "A customer requests deletion of their data. What happens to the model?",
        "Reviewers approve 99% of model-proposed limits. Is that good news?"
      ],
      links: [
        { label: "Fairness definitions and why they collide", route: "#/resp/fairness/fairness-definitions" },
        { label: "Explaining a model without fooling yourself", route: "#/resp/explain/explainability" },
        { label: "Model governance that people actually follow", route: "#/resp/governance/model-governance" }
      ]
    },
    {
      id: "mlcase-eta-45",
      title: "Design delivery ETA prediction",
      timebox: "45 min",
      prompt: "A food-delivery app shows an estimated delivery time on every restaurant listing and updates it live after the order is placed. Customers complain about late orders, and the business says a late minute costs about three times an early one. Design the ETA system.",
      expected: [
        "Clarifies which ETA (end to end: preparation, travel to merchant, waiting, travel to customer, handoff), where it is shown, the late/early cost ratio, and scale.",
        "Predicts quantiles with pinball loss and promises the quantile implied by the cost ratio (0.75 for three-to-one), showing a range.",
        "Models the residual on top of the routing engine estimate, ideally decomposed by leg, and versions the model with the routing engine.",
        "Uses point-in-time traffic, merchant load, and weather features, and cleans leg timestamps from multiple actors.",
        "Evaluates with MAE, bias, and quantile coverage per city and hour, and explains why MAPE misleads on short trips.",
        "Recognises the shown ETA as an intervention on conversion and dispatch, and designs experiments that weigh conversion against lateness."
      ],
      followups: [
        "Your P90 covers only 78% of orders in one city. How do you find out why and fix it?",
        "The routing team ships a better engine. What happens to your residual model?",
        "How do you keep the live estimate from jumping around after the order is placed?",
        "Product wants to shave a minute off every ETA to lift conversion. How do you evaluate that?"
      ],
      links: [
        { label: "Predicting arrival times for rides and deliveries", route: "#/mlcase/forecast/eta-prediction" },
        { label: "Calibration", route: "#/found/metrics/calibration" },
        { label: "Point-in-time correctness", route: "#/data/correctness/point-in-time" },
        { label: "Drift and skew", route: "#/ops/monitoring/drift-and-skew" }
      ]
    }
  ],

  rubrics: {
    dimensions: [
      "Problem navigation and objective framing",
      "ML fundamentals — features, models, and their trade-offs",
      "System design sense — retrieval, serving, and latency budgets",
      "Evaluation rigour, offline and online",
      "Operational thinking — drift, feedback loops, and failure",
      "Communication and structured pacing"
    ],
    bands: [
      {
        id: "beginner",
        title: "Beginner",
        summary: "Names plausible models but leaves the objective vague and the evaluation story unspecified.",
        signals: [
          "Jumps to a model choice before defining what success means.",
          "Uses accuracy as the metric on a heavily imbalanced problem.",
          "Draws a training pipeline with no serving path, or the reverse.",
          "Does not mention how the system is monitored after launch."
        ]
      },
      {
        id: "competent",
        title: "Competent",
        summary: "Frames a measurable objective, designs a workable two-stage system, and evaluates it honestly.",
        signals: [
          "States a business metric, a product metric, and an ML metric, and connects them.",
          "Separates retrieval from ranking and justifies the split.",
          "Picks metrics appropriate to the task family and explains why.",
          "Identifies at least one real failure mode such as cold start or leakage."
        ]
      },
      {
        id: "strong",
        title: "Strong",
        summary: "Reaches the objective that actually captures the goal, and treats the feedback loop as part of the design.",
        signals: [
          "Walks the graded ladder out loud and explains why each earlier framing fails.",
          "Anticipates that offline gains may not replicate online, and plans for it.",
          "Designs exploration into the loop rather than bolting it on.",
          "Names the monitoring signal that fires before the business metric moves.",
          "Volunteers the trade-off they are least comfortable with instead of hiding it."
        ]
      }
    ]
  },

  cheatsheets: [
    {
      id: "mlsd-flow",
      title: "The 45-minute sequence",
      summary: "Phase order and time budget for an ML design round.",
      items: [
        "1. Requirements and scope — who uses it, what decision it makes, what scale (~5 min).",
        "2. Objective framing — business goal to ML objective, graded out loud (~3 min).",
        "3. High-level design — offline path and online path, including the logging arrow back (~10 min).",
        "4. Data and features — sources, label definition, leakage and bias risks (~10 min).",
        "5. Training and evaluation — splits, offline metrics, online guardrails (~7 min).",
        "6. Deep dives — follow the interviewer, and volunteer the weakest part of your own design."
      ]
    },
    {
      id: "metric-picker",
      title: "Which metric, and when",
      summary: "Task family to metric, with the trap attached to each.",
      items: [
        "Binary classification, balanced — accuracy is acceptable; state the base rate anyway.",
        "Binary classification, imbalanced — precision, recall, and PR-AUC. ROC-AUC flatters a weak model here.",
        "Ranking — recall@k for the retrieval stage, NDCG or MRR for the ordering stage.",
        "Probability estimation for auctions or thresholds — calibration, not just ordering.",
        "Regression — mean absolute error when outliers are noise, squared error when they are costly.",
        "Always pair the ML metric with the product metric it is a proxy for, and name the gap."
      ]
    },
    {
      id: "objective-ladder",
      title: "Grading an objective",
      summary: "The four rungs, and the question that moves you up each one.",
      items: [
        "Bad — optimizes a raw proxy. Ask: what does gaming this look like?",
        "Bad — optimizes an aggregate that imbalance makes meaningless. Ask: what does doing nothing score?",
        "Good — optimizes the goal subject to a stated guardrail. Ask: who bears the cost of the guardrail?",
        "Great — optimizes the quantity that actually causes the outcome, subject to the same guardrail.",
        "Sanity check: if a lazy system scores well on your objective, the objective is wrong."
      ]
    },
    {
      id: "failure-checklist",
      title: "Failure modes to volunteer",
      summary: "Say these before the interviewer has to ask.",
      items: [
        "Leakage — a feature that encodes the label, usually via timing.",
        "Cold start — new users and new items, and the fallback path for both.",
        "Training/serving skew — the same feature computed two different ways.",
        "Feedback loop — the model shapes the data that trains its successor.",
        "Position and presentation bias — logged clicks reflect what you showed, not what was best.",
        "Drift — inputs move, labels arrive late, and the business metric notices last."
      ]
    },
    {
      id: "found-eval-numbers",
      title: "Evaluation numbers worth memorizing",
      summary: "The handful of formulas and rules of thumb that come up in almost every ML design answer about metrics and experiments.",
      items: [
        "Precision = TP / (TP + FP); recall = TP / (TP + FN); F1 = 2PR / (P + R).",
        "Cost-optimal threshold with calibrated scores: flag if p > C_FP / (C_FP + C_FN).",
        "ROC-AUC ignores base rate; precision = TPR·π / (TPR·π + FPR·(1 − π)) does not.",
        "NDCG = DCG / IDCG with gain 2^rel − 1 and discount 1 / log2(rank + 1).",
        "ECE = Σ (n_b / N) · |observed_b − predicted_b|; fix with Platt, isotonic or temperature scaling.",
        "A/B users per arm ≈ 16·p(1 − p) / δ² at 80% power, α = 0.05; halve δ and you need 4x the users.",
        "CUPED multiplies variance by 1 − ρ²; check SRM before reading any metric; interleave to screen rankers."
      ]
    },
    {
      id: "data-leak-audit",
      title: "Leakage and data-correctness audit",
      summary: "The checks to run, in order, before trusting any offline metric.",
      items: [
        "For every feature, ask: could serving read exactly this value at the decision instant, for an entity the model has never seen?",
        "Write down each feature's availability time and compare it with the decision time; join with an inequality, never the current-state table.",
        "Split by entity and by time, and dedupe near-identical rows before splitting.",
        "Fit every transform — scaler, imputer, vocabulary, target encoder — on training data only, inside the fold.",
        "Treat a near-perfect metric or a single dominant feature as a bug report: drop the top feature and retrain.",
        "Exclude rows whose label window has not finished instead of counting them as negatives.",
        "Gate data at ingestion, before training and at serving: fail on schema breaks, quarantine on distribution shifts, clamp and count online."
      ]
    },
    {
      id: "train-napkin-math",
      title: "Training napkin math",
      summary: "The handful of numbers that size a training job before anyone provisions a cluster.",
      items: [
        "Memory: about 16 bytes per parameter for Adam in mixed precision, plus activations that grow with batch × width × depth.",
        "Compute: about 6 × parameters × tokens FLOPs; GPU-hours = FLOPs / (peak × utilisation) / 3600.",
        "Sync: ring all-reduce sends about 2(N-1)/N × gradient bytes per GPU per step — nearly constant in N.",
        "Pipeline bubble: about (p-1)/(m+p-1); raise micro-batches m until activation memory stops you.",
        "Effective batch = micro-batch × GPUs × accumulation steps; retune learning rate with warmup when it changes.",
        "Checkpoint interval ≈ sqrt(2 × checkpoint write time × mean time between interruptions).",
        "Successive halving with η = 3 over 81 configs costs about 405 epochs versus 6,561 for training all to the end."
      ]
    },
    {
      id: "ops-launch-checklist",
      title: "Model launch checklist",
      summary: "What must be true before a model version takes production traffic, and what must already exist for the day it misbehaves.",
      items: [
        "Registered as an immutable version with data snapshot id, code commit, lockfile, eval results per slice and a named owner.",
        "Passed gates as code: validated data, tolerance vs the production alias on a frozen eval set, slice gates with min rows, behavioural tests, latency and size budgets.",
        "Packaged with its preprocessing inside the artifact and a signature checked at deploy and at request time.",
        "Rollout plan written first: shadow, canary vs a concurrent control, progressive steps with bake time and sample size, halt criteria.",
        "Kill switch and fallback (previous alias, simpler model or heuristic) tested by someone who did not build the model.",
        "Monitors live: per-feature null rate and range, PSI per slice, prediction distribution, proxy labels, freshness or consumer lag.",
        "Retraining cadence set from a measured decay curve, with data validation able to veto any automated run."
      ]
    },
    {
      id: "rank-funnel-checklist",
      title: "Ranking funnel checklist",
      summary: "The questions to answer, in order, for any search or recommendation design.",
      items: [
        "Give each stage a candidate count, a latency slice and a recall budget; remember recall multiplies across stages.",
        "Union several retrieval sources with quotas, keep which sources found each item as a feature, and re-score the union with a light ranker.",
        "Train two-tower retrieval with in-batch negatives plus logQ correction, and version towers and index together.",
        "Quote ANN recall at a latency and memory budget, and pick a strategy for selective filters before they empty your candidate set.",
        "Rank with separate calibrated heads combined in a value model whose weights are tuned online; handle position bias explicitly.",
        "Build the page in a re-ranking layer: policy filters, de-duplication, diversity, boosts, then ads — and measure each rule's cost.",
        "Plan cold start, an exploration slot with logged propensities, and coverage plus exposure-Gini guardrails from day one."
      ]
    },
    {
      id: "resp-launch-checklist",
      title: "Responsible launch checklist",
      summary: "The questions to answer before a model that decides things about people goes live.",
      items: [
        "Name the harm of each error type, then pick the one fairness metric that counts it and a tolerance.",
        "Keep the protected attribute for evaluation; report every group metric by slice and intersection, with sample sizes.",
        "Locate where bias entered (sampling, labels, measurement, feedback) and intervene at that stage; state the accuracy cost.",
        "Match explanations to the audience: held-out permutation importance for reviewers, reason codes plus actionable counterfactuals for affected people.",
        "Ship a model card with out-of-scope uses and slice metrics, a datasheet for the data, and a decision log.",
        "Minimize and time-limit the data, treat hashed IDs as personal, and know how a deletion reaches the weights.",
        "Tier the model by impact, gate promotion in the registry, size human review to capacity, and test the kill switch."
      ]
    },
    {
      id: "mlcase-asymmetric-costs",
      title: "When errors cost different amounts",
      summary: "Six cases where the right threshold, quantile, or objective comes straight from what each kind of mistake costs.",
      items: [
        "Fraud: approve if p x (amount + fee) is below (1 - p) x false-decline cost; the break-even p falls as the amount rises, so thresholds vary by amount band.",
        "ETA: promise the quantile tau = c_late / (c_late + c_early); a three-to-one late penalty means the 0.75 quantile.",
        "Inventory: order to the newsvendor quantile tau = c_short / (c_short + c_over); a lost sale worth four overstocked units means the P80.",
        "Notifications: send only if uplift minus lambda x p(disable) is positive, because a disabled channel never comes back.",
        "Connection suggestions: score p(send) x p(accept) x E[interaction] minus a harm term, so the recipient's cost is priced in.",
        "Every one of these multiplies a probability or quantile by money, so calibration or quantile coverage becomes a requirement, not a nicety."
      ]
    }
  ],

  glossary: [
    {
      id: "calibration",
      term: "Calibration",
      definition: "The property that a predicted probability matches the observed frequency — among items scored 0.3, roughly 30% are positive.",
      useIt: "Insist on it whenever the score feeds arithmetic, such as an auction bid or an expected-value threshold. A ranker only needs order; a price needs truth.",
      links: [
        { label: "Ad click prediction", route: "#/mlcase/recsys/ad-click-prediction" },
        { label: "Evaluation", route: "#/mlsd/concepts/evaluation" }
      ]
    },
    {
      id: "leakage",
      term: "Leakage",
      definition: "When a feature carries information about the label that would not be available at prediction time, usually because it was computed after the fact.",
      useIt: "Name it as the first thing you would audit when an offline metric looks implausibly good.",
      links: [{ label: "Feature pitfalls", route: "#/mlsd/concepts/feature-pitfalls" }]
    },
    {
      id: "training-serving-skew",
      term: "Training/serving skew",
      definition: "A mismatch between how a feature is computed during training and how it is computed at serving time, which silently degrades a model that tested well.",
      useIt: "Cite it as the concrete failure a feature store exists to prevent.",
      links: [{ label: "Feature stores", route: "#/mlsd/concepts/feature-stores" }]
    },
    {
      id: "two-stage-retrieval",
      term: "Two-stage retrieval",
      definition: "Cheap high-recall candidate generation followed by expensive high-precision ranking over the surviving candidates.",
      useIt: "Reach for it whenever the item catalogue is far larger than what you can afford to score per request.",
      links: [{ label: "Retrieval and ranking", route: "#/mlsd/serving/retrieval-ranking" }]
    },
    {
      id: "embedding",
      term: "Embedding",
      definition: "A dense vector representation learned so that geometric closeness corresponds to task-relevant similarity.",
      useIt: "Use it to explain how retrieval over millions of items becomes a nearest-neighbour lookup.",
      links: [{ label: "Embeddings", route: "#/mlsd/concepts/embeddings" }]
    },
    {
      id: "ann",
      term: "Approximate nearest neighbour",
      definition: "An index that trades a small amount of recall for a large reduction in search latency over high-dimensional vectors.",
      useIt: "State the recall/latency knob explicitly rather than treating the index as exact.",
      links: [{ label: "ANN serving", route: "#/mlsd/concepts/ann-serving" }]
    },
    {
      id: "cold-start",
      term: "Cold start",
      definition: "The absence of interaction history for a new user or a new item, which disables exactly the features that carry the most signal.",
      useIt: "Pair every interaction-history feature with the fallback you would use before that history exists.",
      links: [{ label: "Feature engineering", route: "#/mlsd/concepts/feature-engineering" }]
    },
    {
      id: "position-bias",
      term: "Position bias",
      definition: "The tendency of items shown higher in a list to be clicked more regardless of relevance, which corrupts click logs used as labels.",
      useIt: "Raise it whenever you propose training on logged clicks, and name a debiasing approach.",
      links: [{ label: "Search ranking", route: "#/mlcase/retrieval/search-ranking" }]
    },
    {
      id: "feedback-loop",
      term: "Feedback loop",
      definition: "The cycle in which a model's own outputs determine the data that trains its successor, narrowing what the system can ever learn.",
      useIt: "Propose an exploration budget as the standard mitigation, and say what it costs.",
      links: [{ label: "Feedback loops", route: "#/mlsd/serving/feedback-loops" }]
    },
    {
      id: "drift",
      term: "Drift",
      definition: "Change over time in input distributions, prediction distributions, or the relationship between them, degrading a model that was correct at launch.",
      useIt: "Distinguish input drift, which you can detect immediately, from label drift, which you cannot until ground truth arrives.",
      links: [{ label: "Drift monitoring", route: "#/mlsd/serving/drift-monitoring" }]
    },
    {
      id: "guardrail-metric",
      term: "Guardrail metric",
      definition: "A metric you commit not to regress, used to constrain an objective so that optimizing it cannot cause an unacceptable side effect.",
      useIt: "Attach one to every objective you propose; an unconstrained objective is how systems get gamed.",
      links: [{ label: "Problem framing", route: "#/mlsd/framework/problem-framing" }]
    },
    {
      id: "pr-auc",
      term: "PR-AUC",
      definition: "Area under the precision-recall curve, which unlike ROC-AUC stays sensitive to performance on the rare positive class.",
      useIt: "Prefer it whenever positives are a small fraction of the data, and say why ROC-AUC would mislead.",
      links: [{ label: "Evaluation", route: "#/mlsd/concepts/evaluation" }]
    },
    {
      id: "found-confusion-matrix",
      term: "Confusion matrix",
      definition: "The 2x2 count of true positives, false positives, false negatives and true negatives at a given threshold. Precision, recall, specificity, F1 and accuracy are all ratios of these four counts.",
      useIt: "At this threshold we have 80 true positives and 220 false alarms, so precision is 27% — I would rather pick the threshold from the cost of each error than leave it at 0.5.",
      links: [
        { label: "The confusion matrix and choosing a threshold", route: "#/found/metrics/confusion-matrix" }
      ]
    },
    {
      id: "found-ndcg",
      term: "NDCG",
      definition: "Normalized discounted cumulative gain: a ranking metric that rewards placing highly relevant items near the top using graded relevance, normalized by the score of the ideal ordering.",
      useIt: "I would measure the ranking stage with NDCG@10 because only ten results are visible, and report recall@500 separately for retrieval.",
      links: [
        { label: "Ranking metrics: precision@k to NDCG", route: "#/found/metrics/ranking-metrics" }
      ]
    },
    {
      id: "found-mde",
      term: "Minimum detectable effect",
      definition: "The smallest true effect an experiment is designed to detect with the chosen power and significance level. Required sample size scales with one over its square.",
      useIt: "With a 5% baseline and a 5% relative MDE we need about 120,000 users per arm, which is twelve days at our traffic — so we fix the test at two weeks.",
      links: [
        { label: "Designing an A/B test that can answer the question", route: "#/found/experiments/ab-test-design" }
      ]
    },
    {
      id: "found-interleaving",
      term: "Interleaving",
      definition: "An online evaluation method that merges results from two rankers into one list per user and credits clicks to the ranker that contributed each result, measuring relative preference with much less traffic than an A/B test.",
      useIt: "I would interleave the three candidate rankers to find the winner in a few days, then confirm its revenue impact with a normal A/B test.",
      links: [
        { label: "Interleaving: a sharper test for rankers", route: "#/found/experiments/interleaving" }
      ]
    },
    {
      id: "data-point-in-time-join",
      term: "Point-in-time join",
      definition: "A join that gives each historical training row the feature values that serving could have read at that row's decision time, using an inequality on availability timestamps rather than the current value.",
      useIt: "Every training row is built with a point-in-time join on availability time, so the model never sees a value from its own future.",
      links: [
        { label: "Point-in-time correctness and as-of joins", route: "#/data/correctness/point-in-time" },
        { label: "Designing a feature store", route: "#/data/features/feature-store-design" }
      ]
    },
    {
      id: "data-label-delay",
      term: "Label delay",
      definition: "The wait between a prediction and the moment its true outcome is known. It caps how fresh fully-labelled training data can be and is why delayed-outcome systems add proxy labels.",
      useIt: "Chargebacks take up to 90 days, so label delay means our freshest clean labels are three months old — I'd train on a 14-day dispute proxy and evaluate on the real outcome.",
      links: [
        { label: "Where labels come from and how they lie", route: "#/data/labels/label-sources" }
      ]
    },
    {
      id: "data-weak-supervision",
      term: "Weak supervision",
      definition: "Producing training labels from many noisy sources — rules, heuristics, existing models, knowledge bases — combined by a label model into probabilistic labels, instead of hand-labelling every example.",
      useIt: "With one afternoon of expert time, weak supervision gets us millions of approximate labels; a small hand-labelled gold set tells us how good they are.",
      links: [
        { label: "Buying labels cheaply", route: "#/data/labels/weak-active-labeling" }
      ]
    },
    {
      id: "data-target-encoding",
      term: "Target encoding",
      definition: "Replacing a categorical value with a statistic of the label for that category, such as its mean fraud rate. It must be computed out-of-fold or from strictly earlier data and smoothed toward the global mean, or it leaks the label.",
      useIt: "Merchant id gets a smoothed, out-of-fold target encoding so rare merchants are pulled toward the global rate and no row sees its own label.",
      links: [
        { label: "Encodings and transforms that survive production", route: "#/data/features/encoding-transforms" },
        { label: "A field guide to leakage", route: "#/data/correctness/leakage-taxonomy" }
      ]
    },
    {
      id: "train-all-reduce",
      term: "All-reduce",
      definition: "A collective operation in which every worker contributes a tensor and every worker receives the elementwise sum (or mean). Data-parallel training uses it to average gradients so all model replicas apply the same update.",
      useIt: "With eight replicas on one node the gradient all-reduce overlaps the backward pass, so sync costs us almost nothing until we go cross-node.",
      links: [
        { label: "Data parallelism and gradient synchronisation", route: "#/train/parallel/data-parallel" }
      ]
    },
    {
      id: "train-pipeline-bubble",
      term: "Pipeline bubble",
      definition: "The time pipeline stages sit idle while the first micro-batches fill the pipeline and the last ones drain it, roughly (p-1)/(m+p-1) of device time for p stages and m micro-batches.",
      useIt: "Four stages with only four micro-batches wastes about 43% to the bubble, so I would push to thirty-two micro-batches if activation memory allows.",
      links: [
        { label: "Tensor, pipeline and embedding-table sharding", route: "#/train/parallel/model-pipeline-parallel" }
      ]
    },
    {
      id: "train-mfu",
      term: "Utilisation (achieved versus peak FLOPs)",
      definition: "The fraction of an accelerator's peak arithmetic throughput a training job actually delivers. It folds in input stalls, communication, memory-bound kernels and idle time, and it is the factor that turns a FLOP count into GPU-hours.",
      useIt: "I am assuming 45% utilisation, so the estimate doubles if the input pipeline keeps the GPUs half idle.",
      links: [
        { label: "GPU economics: memory, throughput and cost", route: "#/train/compute/gpu-economics" }
      ]
    },
    {
      id: "train-data-snapshot",
      term: "Data snapshot",
      definition: "An immutable, identifiable copy or version of the training data as of a point in time, recorded in the run so the exact rows can be re-read later.",
      useIt: "The registry points at the run, and the run points at snapshot impressions_v412, so we can diff exactly what the regressed model trained on.",
      links: [
        { label: "Experiment tracking and lineage", route: "#/train/experiments/experiment-tracking" },
        { label: "Reproducibility you can actually achieve", route: "#/train/experiments/reproducibility" }
      ]
    },
    {
      id: "ops-psi",
      term: "Population Stability Index (PSI)",
      definition: "A binned measure of how far a feature's current distribution has moved from a reference distribution, computed as the sum over bins of (a - e) times ln(a / e) with bin edges fixed from the reference.",
      useIt: "Order value has a PSI of 0.31 this week, almost all of it from the lowest bin, so I'd check for nulls coerced to zero before calling it a real shift.",
      links: [
        { label: "Drift and skew: telling the kinds of change apart", route: "#/ops/monitoring/drift-and-skew" }
      ]
    },
    {
      id: "ops-shadow-deployment",
      term: "Shadow deployment",
      definition: "Running a candidate model on a mirrored copy of production traffic without using its outputs, to measure latency, errors and disagreement with the current model before any user is exposed.",
      useIt: "Shadow tells me the challenger is fast enough and disagrees on 4% of requests, but it can't tell me how users react, so a canary comes next.",
      links: [
        { label: "Safe rollouts: shadow, canary, and the kill switch", route: "#/ops/inference/safe-rollouts" }
      ]
    },
    {
      id: "ops-model-alias",
      term: "Model alias",
      definition: "A named, movable pointer in a model registry, such as production, challenger or fallback, that serving resolves at load time instead of a hard-coded version number.",
      useIt: "Serving resolves the production alias, so rolling back v42 is just pointing production at v41 again.",
      links: [
        { label: "The model registry: versions, lineage, and rollback by pointer", route: "#/ops/delivery/model-registry" }
      ]
    },
    {
      id: "ops-concept-drift",
      term: "Concept drift",
      definition: "A change in how inputs relate to the outcome, so the same feature values now imply a different label; distinct from covariate drift, where only the input distribution moves.",
      useIt: "The inputs look identical to last quarter but review overturns are climbing, which smells like concept drift, so input PSI alone won't catch it.",
      links: [
        { label: "Drift and skew: telling the kinds of change apart", route: "#/ops/monitoring/drift-and-skew" },
        { label: "The drift playbook: running a model incident", route: "#/ops/monitoring/drift-playbook" }
      ]
    },
    {
      id: "rank-recall-budget",
      term: "Recall budget",
      definition: "The share of truly relevant items each funnel stage is allowed to lose, chosen so that the product of stage recalls still meets the end-to-end target.",
      useIt: "We need 0.85 end to end and the heavy ranker gets about 0.95, so retrieval and the light ranker together can lose at most about ten percent.",
      links: [
        { label: "The ranking funnel, stage by stage", route: "#/rank/retrieval/ranking-funnel" }
      ]
    },
    {
      id: "rank-logq-correction",
      term: "logQ correction",
      definition: "A training adjustment for sampled-softmax retrieval models that subtracts each item's log sampling probability from its logit, removing the popularity bias that in-batch negatives introduce.",
      useIt: "In-batch negatives over-sample hit items, so I subtract log q of each item from its logit before the softmax.",
      links: [
        { label: "Two-tower retrieval models", route: "#/rank/retrieval/two-tower" }
      ]
    },
    {
      id: "rank-value-model",
      term: "Value model",
      definition: "The explicit formula that combines separate calibrated outcome predictions into one ranking score, with weights that express how much each outcome is worth relative to the others.",
      useIt: "Each head is calibrated, so a weight of twenty on hides genuinely means one hide costs as much as twenty clicks.",
      links: [
        { label: "Multi-objective ranking and value models", route: "#/rank/ranking/multi-objective" }
      ]
    },
    {
      id: "rank-propensity-logging",
      term: "Propensity logging",
      definition: "Recording, for every served action, the probability the serving policy assigned to it, so new policies can later be evaluated offline with inverse propensity weighting.",
      useIt: "The exploration slot logs its propensity per impression, which lets us score a candidate policy on last week's traffic before any online test.",
      links: [
        { label: "Bandits: exploring on purpose", route: "#/rank/dynamics/bandits" }
      ]
    },
    {
      id: "resp-equal-opportunity",
      term: "Equal opportunity",
      definition: "A group fairness criterion requiring equal true positive rates across groups, so that people who truly qualify are approved at the same rate whichever group they belong to.",
      useIt: "Wrongly declining creditworthy applicants is the harm here, so I'd hold the equal-opportunity gap within two points and report the selection-rate and precision gaps alongside it.",
      links: [
        { label: "Fairness definitions and why they collide", route: "#/resp/fairness/fairness-definitions" },
        { label: "Where bias enters and what each fix moves", route: "#/resp/fairness/bias-mitigation" }
      ]
    },
    {
      id: "resp-shapley-value",
      term: "Shapley value",
      definition: "A feature's average marginal contribution to a prediction over every order in which features could be added, filled in from a background dataset. Contributions plus the base value sum exactly to the prediction.",
      useIt: "For debugging this one bad score I'd pull the Shapley values against last month's background set — they add up to the prediction, so I can see exactly which feature moved it.",
      links: [
        { label: "Explaining a model without fooling yourself", route: "#/resp/explain/explainability" }
      ]
    },
    {
      id: "resp-differential-privacy",
      term: "Differential privacy",
      definition: "A guarantee about a data-processing mechanism: its output distribution changes by at most a factor governed by epsilon whether or not any one person's data is included, usually achieved with calibrated noise.",
      useIt: "These cohort counts are in the tens of thousands, so differential privacy at a modest epsilon costs us almost nothing; the small-cohort breakdowns are where the noise would swamp the signal.",
      links: [
        { label: "Privacy in ML systems", route: "#/resp/governance/privacy-ml" }
      ]
    },
    {
      id: "resp-model-card",
      term: "Model card",
      definition: "A short document versioned with a model that states its intended and out-of-scope uses, training data, metrics broken down by slice, known limitations and owner.",
      useIt: "Before another team reuses this score, the model card's out-of-scope section and slice table tell them whether their population was ever evaluated — and promotion is blocked without a card.",
      links: [
        { label: "Model cards, datasheets and decision logs", route: "#/resp/explain/model-documentation" },
        { label: "Model governance that people actually follow", route: "#/resp/governance/model-governance" }
      ]
    },
    {
      id: "mlcase-uplift-modelling",
      term: "Uplift modelling",
      definition: "Estimating the causal effect of an action on an individual: the expected outcome if treated minus the expected outcome if not treated. It is trained on data where treatment was randomised, and evaluated with uplift or Qini curves rather than plain AUC.",
      useIt: "I'd rank notifications by uplift rather than open probability, because the users most likely to open are the ones who were coming back anyway.",
      links: [
        { label: "Choosing which notifications to send, and when", route: "#/mlcase/recsys/notification-ranking" },
        { label: "A/B test design", route: "#/found/experiments/ab-test-design" }
      ]
    },
    {
      id: "mlcase-random-approve-holdout",
      term: "Random-approve holdout",
      definition: "A small, deliberately budgeted share of transactions that the fraud system would have declined but approves anyway, usually capped by amount, so their outcomes produce labels not selected by the current model.",
      useIt: "Labels only exist where we said yes, so I'd budget a capped random-approve slice to learn what the old model was blocking.",
      links: [
        { label: "Catching payment fraud at authorization time", route: "#/mlcase/trust/fraud-detection" },
        { label: "Class imbalance", route: "#/data/labels/class-imbalance" }
      ]
    },
    {
      id: "mlcase-pinball-loss",
      term: "Pinball loss",
      definition: "The quantile loss: tau times the error when the actual exceeds the prediction, and (1 minus tau) times the error otherwise. Minimising it yields the tau quantile, which is how asymmetric costs are encoded in a forecast or ETA.",
      useIt: "Late minutes cost three times early ones, so I'd train with pinball loss and promise the 0.75 quantile.",
      links: [
        { label: "Predicting arrival times for rides and deliveries", route: "#/mlcase/forecast/eta-prediction" },
        { label: "Calibration", route: "#/found/metrics/calibration" }
      ]
    },
    {
      id: "mlcase-rolling-origin-backtest",
      term: "Rolling-origin backtest",
      definition: "An evaluation that repeatedly trains on data up to a cutoff, forecasts the next horizon, and moves the cutoff forward, building every feature only from data available before each cutoff.",
      useIt: "I'd only ship the model if it beats seasonal naive across a rolling-origin backtest that includes holidays and a past shock.",
      links: [
        { label: "Forecasting demand for supply, staffing, and inventory", route: "#/mlcase/forecast/demand-forecasting" },
        { label: "Point-in-time correctness", route: "#/data/correctness/point-in-time" }
      ]
    }
  ]
};
