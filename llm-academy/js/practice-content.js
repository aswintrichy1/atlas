/* Lumen practice reference — scenario packs, interview prompts, rubrics,
   cheat sheets, and glossary for the practice hub. Every `route` here must
   resolve to a real lesson in window.TRACKS or to #/playground. */
window.LumenPractice = {
  nav: [
    {
      id: "scenarios",
      route: "#/scenarios",
      title: "Scenario packs",
      label: "Build walkthroughs",
      color: "#f97316",
      icon: "map",
      summary: "End-to-end outlines for the GenAI design and incident problems that come up most: RAG, agents, local models, evals, cost and safety."
    },
    {
      id: "interview",
      route: "#/interview",
      title: "Interview prompts",
      label: "Timed practice",
      color: "#38bdf8",
      icon: "quiz",
      summary: "Timed LLM-engineering prompts with what an interviewer listens for and the follow-ups they push on."
    },
    {
      id: "rubrics",
      route: "#/rubrics",
      title: "Rubrics",
      label: "Score yourself",
      color: "#34d399",
      icon: "star",
      summary: "The dimensions an applied-LLM or AI-engineering round is scored on, and what each band sounds like."
    },
    {
      id: "cheatsheets",
      route: "#/cheatsheets",
      title: "Cheat sheets",
      label: "Fast recall",
      color: "#fbbf24",
      icon: "md",
      summary: "Sampling knobs, prompt and agent checklists, sizing arithmetic and eval types worth having in memory."
    },
    {
      id: "glossary",
      route: "#/glossary",
      title: "Glossary",
      label: "Say it precisely",
      color: "#818cf8",
      icon: "lesson",
      summary: "The LLM vocabulary you will be expected to use correctly, with the sentence that shows you mean it."
    }
  ],

  scenarios: [
    {
      id: "rag-internal-docs",
      title: "Design a RAG assistant over internal docs",
      subtitle: "The most common GenAI design prompt: answers grounded in your own documents, with citations and access control.",
      timebox: "40 min",
      prompt: "Employees want a chat assistant that answers questions from roughly 200,000 internal pages (wikis, runbooks, PDFs, tickets). Answers must cite sources and must never reveal a page the asker cannot already open. Design it.",
      related: [
        { label: "Why RAG", route: "#/rag/retrieval/why-rag" },
        { label: "Chunking strategies", route: "#/rag/retrieval/chunking" },
        { label: "Hybrid search", route: "#/rag/quality/hybrid-search" },
        { label: "Grounding and citations", route: "#/rag/quality/grounding" },
        { label: "Production RAG failure modes", route: "#/ops/systems/rag-in-production" }
      ],
      outline: [
        {
          title: "Clarify before drawing boxes",
          items: [
            "Who asks, how often, and what does a good answer look like? Collect 50 to 100 real questions up front; they become the first golden set.",
            "Ask how permissions are modelled at the source (groups, spaces, per-document ACLs) and how fresh answers must be.",
            "Agree success criteria: answer correctness, citation precision, refusal when unsupported, latency budget for the first token."
          ]
        },
        {
          title: "Ingestion pipeline",
          items: [
            "Connectors pull documents plus their ACLs and timestamps; parse to clean text, keep headings and table structure.",
            "Chunk by structure (section or heading) with modest overlap; attach metadata: source id, title, url path, ACL groups, updated date.",
            "Embed chunks with one pinned embedding model; store vectors and metadata together (pgvector or a dedicated vector DB). Re-embed on model change, never mix models in one index."
          ]
        },
        {
          title: "Retrieval and generation",
          items: [
            "Filter by the asker's groups BEFORE similarity search, never after generation — access control lives in retrieval, not in the prompt.",
            "Hybrid search (BM25 plus vectors, fused with reciprocal rank fusion) to catch exact terms like error codes; rerank the top 50 down to 5 to 8.",
            "System prompt: answer only from the provided passages, cite passage ids, say 'I could not find this' when unsupported."
          ]
        },
        {
          title: "Evaluate and operate",
          items: [
            "Measure retrieval (recall at k on the golden set) separately from generation (faithfulness, citation accuracy) so you know which half to fix.",
            "Trace every request: query, retrieved ids, prompt version, model, tokens, latency, user feedback.",
            "Incremental re-index on change events; nightly reconcile to catch deletes and permission changes."
          ]
        },
        {
          title: "Close with trade-offs",
          items: [
            "Long context could replace retrieval for small corpora, but 200,000 pages, ACLs and cost make RAG the right default here.",
            "Mention that the Blueprint atlas covers production RAG at system-design depth and the Synapse atlas has a full case study."
          ]
        }
      ]
    },
    {
      id: "model-under-budget",
      title: "Pick and deploy a model under a budget",
      subtitle: "A model-selection scenario: quality, latency, cost and data constraints, decided with evidence.",
      timebox: "30 min",
      prompt: "A support team needs ticket summarisation and reply drafting for about 40,000 tickets a day. The monthly budget is fixed and modest, p95 latency must stay under 3 seconds, and customer data may not leave approved regions. Choose a model and deployment.",
      related: [
        { label: "Choosing a model", route: "#/api/choose/choosing-model" },
        { label: "Token cost and latency", route: "#/api/choose/cost-latency" },
        { label: "Evals and golden sets", route: "#/ops/evals/evals" },
        { label: "Serving, scaling and cost", route: "#/ops/systems/llm-system-design" }
      ],
      outline: [
        {
          title: "Turn the budget into tokens",
          items: [
            "Estimate tokens per ticket (input plus output), multiply by volume and days: that number divided into the budget gives your ceiling price per million tokens.",
            "Output tokens usually cost several times input tokens and dominate latency — cap max output length deliberately."
          ]
        },
        {
          title: "Shortlist across tiers",
          items: [
            "One frontier API model as the quality ceiling, one smaller API model, one open-weight model you could host in-region.",
            "Check region and data-retention terms first; a model that fails the data constraint is out regardless of quality."
          ]
        },
        {
          title: "Decide with an eval, not a leaderboard",
          items: [
            "Build 200 real tickets with reference summaries and a rubric; score each candidate with an LLM judge plus human spot checks.",
            "Plot quality against cost per ticket and p95 latency; pick the cheapest model inside the quality bar."
          ]
        },
        {
          title: "Deploy and hedge",
          items: [
            "Route easy tickets to the small model and escalate low-confidence or long ones to the larger model (a model cascade).",
            "Put the model behind a thin gateway so you can swap providers; cache repeated prompt prefixes; stream drafts to cut perceived latency.",
            "Re-run the eval whenever a provider updates a model version — pin versions in config."
          ]
        }
      ]
    },
    {
      id: "ticket-filing-agent",
      title: "Ship an agent that can file tickets safely",
      subtitle: "An agent design with real side effects: tool scope, approval, idempotency and audit.",
      timebox: "35 min",
      prompt: "Engineers want an agent in chat that reads alerts and logs, diagnoses, and files or updates issues in the tracker on their behalf. Security worries about it creating spam, leaking data into tickets, or being steered by text inside logs. Design it.",
      related: [
        { label: "Tool use", route: "#/agent/loop/tool-use" },
        { label: "The ReAct loop", route: "#/agent/loop/react" },
        { label: "Guardrails and human-in-the-loop", route: "#/agent/orchestration/guardrails-hitl" },
        { label: "Prompt injection", route: "#/ops/security/prompt-injection" }
      ],
      outline: [
        {
          title: "Scope the tools narrowly",
          items: [
            "Separate read tools (search_logs, get_alert) from write tools (create_issue, add_comment); no generic 'call any API' tool.",
            "Write tools run with the requesting user's identity and scopes, not a shared admin token.",
            "Strict JSON schemas on every tool; validate arguments server-side and reject unknown fields."
          ]
        },
        {
          title: "Gate side effects",
          items: [
            "Two-step commit: the agent drafts the issue, the human sees a preview and approves; only then does create_issue execute.",
            "Idempotency key per alert so retries and loops update one issue instead of creating ten.",
            "Rate limits and a step budget per session; stop and ask when the budget runs out."
          ]
        },
        {
          title: "Treat retrieved text as data",
          items: [
            "Logs and alert payloads are untrusted; wrap them in delimiters and tell the model they never contain instructions.",
            "Redact secrets and personal data from tool output before it reaches the model and before it lands in a ticket.",
            "Allow-list ticket projects and fields; the model cannot choose arbitrary destinations or add external links."
          ]
        },
        {
          title: "Observe and improve",
          items: [
            "Log every tool call with arguments, the originating prompt and the approval decision.",
            "Track approval rate, edit distance between draft and filed ticket, and duplicate rate as quality metrics."
          ]
        }
      ]
    },
    {
      id: "local-privacy-team",
      title: "Run an LLM locally for a privacy-sensitive team",
      subtitle: "A local-deployment scenario: hardware, quantization, runtime and integration without data leaving the building.",
      timebox: "30 min",
      prompt: "A legal team of 25 wants an assistant for drafting and summarising contracts, but no document may leave the company network. They have a budget for a couple of workstations or one small server. Plan it.",
      related: [
        { label: "Why run locally", route: "#/local/why/why-local" },
        { label: "Hardware and memory", route: "#/local/why/hardware" },
        { label: "Quantization", route: "#/local/why/quantization" },
        { label: "Runtimes", route: "#/local/runtimes/runtimes" },
        { label: "Local sizing calculator", route: "#/playground" }
      ],
      outline: [
        {
          title: "Size the model to the hardware",
          items: [
            "Weights memory is roughly parameters times bytes per weight: a 7 to 8B model at 4-bit is about 4 to 5 GB; a 70B at 4-bit is around 40 GB.",
            "Add KV cache for context length and concurrent users, plus runtime overhead; leave headroom rather than filling memory to the brim.",
            "Unified-memory Macs fit larger models per dollar; discrete GPUs give higher throughput for many concurrent users."
          ]
        },
        {
          title: "Pick a runtime by use pattern",
          items: [
            "Individuals: Ollama or LM Studio on each workstation for simplicity.",
            "Shared team server: vLLM or a llama.cpp server for batching and an OpenAI-compatible endpoint.",
            "Pin model files by hash; record the licence of every open-weight model you deploy."
          ]
        },
        {
          title: "Integrate and keep it private",
          items: [
            "Point the chat UI and any RAG pipeline at the internal endpoint; disable telemetry and outbound network on the host.",
            "Local embeddings and a local vector store keep contract text inside the network end to end.",
            "Authenticate the endpoint; a local model server with no auth on the LAN is still an exposed service."
          ]
        },
        {
          title: "Set expectations",
          items: [
            "Local models trail frontier models on hard reasoning; scope tasks (summaries, clause extraction, first drafts) where they do well.",
            "Run a small eval on real (sanitised) contracts before rollout, and keep a lawyer in the loop for every output."
          ]
        }
      ]
    },
    {
      id: "eval-regression-gate",
      title: "Build an eval harness and regression gate",
      subtitle: "LLMOps scenario: make prompt and model changes as safe as code changes.",
      timebox: "35 min",
      prompt: "Your team ships prompt tweaks weekly and has twice broken production answers without noticing for days. Design an evaluation harness and a CI gate that would have caught both.",
      related: [
        { label: "Evals and regression testing", route: "#/ops/evals/evals" },
        { label: "LLM-as-judge", route: "#/ops/evals/llm-judge" },
        { label: "Observability and prompt versioning", route: "#/ops/evals/observability" },
        { label: "Prompt templates and versioning", route: "#/prompt/systems/templates" }
      ],
      outline: [
        {
          title: "Build the dataset first",
          items: [
            "Start from real traffic: 100 to 300 cases covering common intents, known edge cases and past incidents (each incident adds a case).",
            "Store input, context, reference answer or rubric, and tags (intent, difficulty, risk) in version control."
          ]
        },
        {
          title: "Layer the checks",
          items: [
            "Deterministic checks first: schema validity, required fields, forbidden strings, citation ids that exist.",
            "Reference-based scores where answers are short and checkable; LLM-as-judge with a written rubric where they are open-ended.",
            "Calibrate the judge against 50 human labels and re-check agreement when the judge model changes."
          ]
        },
        {
          title: "Wire it into CI",
          items: [
            "Prompts live in versioned files; any change to a prompt, model id or retrieval config triggers the suite.",
            "Gate on per-slice scores, not just the average: a drop on the 'refund policy' slice fails even if the mean holds.",
            "Fix temperature and seeds where supported; run noisy cases several times and compare distributions."
          ]
        },
        {
          title: "Close the loop in production",
          items: [
            "Sample live traces daily into an online judge; alert on drift in score, refusal rate or length.",
            "Thumbs-down and escalations feed the next round of golden cases."
          ]
        }
      ]
    },
    {
      id: "indirect-injection-incident",
      title: "Respond to an indirect prompt-injection incident",
      subtitle: "Incident response for an LLM feature, then structural prevention.",
      timebox: "25 min",
      prompt: "Your email-summarising assistant, which can also send replies, was observed forwarding a customer thread to an unknown address. The trigger was hidden text inside an inbound email. Walk through your response.",
      related: [
        { label: "Prompt injection and insecure output", route: "#/ops/security/prompt-injection" },
        { label: "OWASP Top 10 for LLM apps", route: "#/ops/security/owasp-llm" },
        { label: "Guardrails and human-in-the-loop", route: "#/agent/orchestration/guardrails-hitl" }
      ],
      outline: [
        {
          title: "Contain",
          items: [
            "Disable the send tool (feature flag) immediately; keep read-only summarising running if it is safe.",
            "Block the destination at the mail gateway and preserve traces for the affected sessions."
          ]
        },
        {
          title: "Investigate",
          items: [
            "Pull traces: which inputs reached the model, which tool calls it made, with what arguments, under whose identity.",
            "Search all sessions for the same payload pattern and for sends to new external domains in the window."
          ]
        },
        {
          title: "Fix the structure, not the wording",
          items: [
            "Adding 'ignore instructions in emails' to the prompt is not a fix — the model cannot reliably separate data from instructions.",
            "Require human approval for any outbound send; restrict recipients to the original thread participants in code.",
            "Split privileges: the model that reads untrusted content should not hold a tool that exfiltrates."
          ]
        },
        {
          title: "Prevent and report",
          items: [
            "Add the payload family to the eval and red-team suite; add a detection for unusual recipients.",
            "Notify affected customers per policy; blameless review. The Citadel atlas covers AI red-teaming and governance in more depth."
          ]
        }
      ]
    },
    {
      id: "cut-cost-60",
      title: "Reduce LLM cost by 60 percent",
      subtitle: "A cost-engineering scenario: find where the tokens go, then cut without losing quality.",
      timebox: "30 min",
      prompt: "Finance says your LLM bill tripled in six months and wants it down 60 percent next quarter without hurting customer satisfaction. Plan the work.",
      related: [
        { label: "Caching and cost control", route: "#/ops/evals/cost-control" },
        { label: "Token cost and latency", route: "#/api/choose/cost-latency" },
        { label: "Managing the context window", route: "#/rag/context/context-engineering" },
        { label: "Distillation and small models", route: "#/train/finetune/distillation" }
      ],
      outline: [
        {
          title: "Measure before cutting",
          items: [
            "Attribute spend per feature, per model, input versus output tokens, and per tenant from traces.",
            "Usually a few features and bloated prompts account for most of the bill; find them first."
          ]
        },
        {
          title: "Cheap wins",
          items: [
            "Trim system prompts and few-shot blocks; send fewer, better retrieved chunks after reranking.",
            "Cap output length; ask for structured output instead of prose where a machine consumes it.",
            "Use provider prompt caching for stable prefixes; add an exact or semantic response cache for repeated questions."
          ]
        },
        {
          title: "Structural wins",
          items: [
            "Route by difficulty: small model by default, large model on escalation.",
            "Batch offline jobs through cheaper batch endpoints; move high-volume narrow tasks to a fine-tuned or distilled small model.",
            "Stop agent loops early with step budgets; many agent costs are retries."
          ]
        },
        {
          title: "Guard quality",
          items: [
            "Every change runs through the eval gate; report cost per successful task, not just total spend.",
            "Track satisfaction and escalation rate weekly during the rollout."
          ]
        }
      ]
    },
    {
      id: "structured-output-migration",
      title: "Migrate free-text prompts to structured output",
      subtitle: "A reliability scenario: replace regex-parsed prose with schemas the system can trust.",
      timebox: "25 min",
      prompt: "An extraction pipeline parses model prose with regular expressions and fails on about 3 percent of documents, which then need manual handling. Migrate it to structured output.",
      related: [
        { label: "Structured outputs and JSON mode", route: "#/api/structured/structured-output" },
        { label: "Delimiters and output schemas", route: "#/prompt/craft/delimiters-schemas" },
        { label: "Function and tool calling", route: "#/api/structured/tool-calling" }
      ],
      outline: [
        {
          title: "Define the contract",
          items: [
            "Write a JSON Schema for the target: required fields, enums for categories, nullable fields for 'not present'.",
            "Give the model an explicit way to say 'unknown' so it does not invent values to satisfy the schema."
          ]
        },
        {
          title: "Use the strongest enforcement available",
          items: [
            "Prefer native structured-output or constrained decoding over plain JSON mode; JSON mode guarantees syntax, not your schema.",
            "Validate every response server-side anyway; on failure, retry once with the validation error, then route to review."
          ]
        },
        {
          title: "Migrate safely",
          items: [
            "Run old and new paths side by side on a sample; diff field by field against human-labelled truth.",
            "Version the schema with the prompt; downstream consumers read the version field."
          ]
        },
        {
          title: "Report",
          items: [
            "Parse failure rate, field-level accuracy, and manual-handling volume before and after."
          ]
        }
      ]
    }
  ],

  interview: [
    {
      id: "llm-serving-design-35",
      title: "Design the serving layer for an LLM feature in 35 minutes",
      timebox: "35 min",
      prompt: "A chat assistant is launching to 2 million users. Expect about 20 requests per second at peak, long streamed answers, and a mix of interactive chat and nightly summarisation jobs. Design the serving layer and say how many replicas you need.",
      expected: [
        "Puts one gateway in front of every model call for routing, per-tenant token budgets, retries, fallbacks and tracing.",
        "Converts traffic to concurrent streams with Little's law and sizes replicas from KV-cache memory, then confirms throughput with a load test.",
        "Writes the latency budget as a time-to-first-token ceiling plus a tokens-per-second floor, and accounts for retrieval and agent steps before the first token.",
        "Separates interactive and batch traffic and autoscales on queue depth or KV-cache utilisation rather than CPU.",
        "Describes a tested fallback chain and compares hosted and self-hosted cost at the expected utilisation."
      ],
      followups: [
        "The provider starts returning 429s during a launch spike. What happens, request by request?",
        "Context length doubles after a product change. What breaks first in your capacity plan?",
        "Finance asks whether self-hosting would be cheaper. How do you answer with numbers?"
      ],
      links: [
        { label: "Serving, scaling and cost", route: "#/ops/systems/llm-system-design" },
        { label: "Context windows and the KV cache", route: "#/core/generation/context-kv" },
        { label: "Caching and cost control", route: "#/ops/evals/cost-control" }
      ]
    },
    {
      id: "rag-design-40",
      title: "RAG system design in 40 minutes",
      timebox: "40 min",
      prompt: "Design a question-answering assistant over a company's documentation. Walk through ingestion, retrieval, generation and how you would know it works.",
      expected: [
        "Clarifies corpus size, freshness, permissions and success metrics before drawing anything.",
        "Explains chunking choices and metadata, and pins one embedding model per index.",
        "Uses hybrid search plus reranking and enforces access control at retrieval time.",
        "Grounds answers with citations and an explicit 'not found' path.",
        "Evaluates retrieval and generation separately with a golden set, and traces production traffic."
      ],
      followups: [
        "Users complain answers cite the right page but quote the wrong paragraph. Where do you look first?",
        "A new embedding model is better. How do you migrate without downtime?",
        "Why not just put every document into a long-context model?"
      ],
      links: [
        { label: "Why RAG", route: "#/rag/retrieval/why-rag" },
        { label: "Reranking", route: "#/rag/quality/reranking" },
        { label: "Long context vs RAG", route: "#/rag/context/long-context-vs-rag" }
      ]
    },
    {
      id: "transformer-explain-15",
      title: "Explain how an LLM generates text in 15 minutes",
      timebox: "15 min",
      prompt: "Explain to a senior engineer who is new to ML how a decoder-only LLM turns a prompt into a response.",
      expected: [
        "Tokenization into subword ids, then embeddings with positional information.",
        "Stacked attention and feed-forward blocks; causal masking so each position sees only the past.",
        "A probability distribution over the vocabulary at each step, then sampling with temperature and top-p.",
        "The KV cache makes each new token cheap relative to re-reading the whole prompt; context length bounds memory.",
        "Connects the mechanism to hallucination: the model optimises plausibility, not truth."
      ],
      followups: [
        "Why is the first token slower than the rest?",
        "What happens to output when temperature goes to zero? Is it fully deterministic?",
        "Why does doubling the context window cost more than double in some setups?"
      ],
      links: [
        { label: "Decoder-only transformer", route: "#/core/transformer/decoder-only" },
        { label: "Sampling", route: "#/core/generation/sampling" },
        { label: "Context windows and KV cache", route: "#/core/generation/context-kv" }
      ]
    },
    {
      id: "agent-safety-30",
      title: "Agent design and safety in 30 minutes",
      timebox: "30 min",
      prompt: "Design an agent that can take actions in your company's systems (tickets, calendars, deployments). How do you stop it doing damage?",
      expected: [
        "Describes the loop: model proposes a tool call, the runtime executes, the observation returns, repeat until done or budget hit.",
        "Least-privilege, single-purpose tools with schemas; actions run as the user, not a super-user.",
        "Human approval for irreversible or external actions; idempotency and rate limits.",
        "Treats tool output and retrieved content as untrusted (indirect prompt injection).",
        "Full tracing of tool calls and approvals; evals on task success and on refusal of unsafe requests."
      ],
      followups: [
        "Approval fatigue sets in and users click approve on everything. Now what?",
        "When would you split this into multiple agents, and when is that over-engineering?",
        "How would you expose these tools to several different agent clients?"
      ],
      links: [
        { label: "The ReAct loop", route: "#/agent/loop/react" },
        { label: "Guardrails and human-in-the-loop", route: "#/agent/orchestration/guardrails-hitl" },
        { label: "Model Context Protocol", route: "#/agent/ecosystem/mcp" }
      ]
    },
    {
      id: "fine-tune-or-not-20",
      title: "Fine-tune, RAG or prompt? 20 minutes",
      timebox: "20 min",
      prompt: "A product manager asks you to fine-tune a model on the company wiki so it 'knows our stuff'. How do you respond?",
      expected: [
        "Separates knowledge (changes often, needs citations: RAG) from behaviour or format (stable: fine-tuning or prompting).",
        "Starts with prompting plus retrieval, measured by an eval, before training anything.",
        "Explains parameter-efficient fine-tuning (LoRA, QLoRA) and when it pays: consistent style, narrow tasks, smaller cheaper models.",
        "Names the costs: data curation, eval, retraining when the base model changes, and no source attribution."
      ],
      followups: [
        "The wiki changes daily. What breaks with the fine-tuning approach?",
        "When would distilling a large model into a small one be worth it?"
      ],
      links: [
        { label: "Supervised fine-tuning", route: "#/train/finetune/sft" },
        { label: "LoRA, QLoRA and PEFT", route: "#/train/finetune/lora-peft" },
        { label: "Why RAG", route: "#/rag/retrieval/why-rag" }
      ]
    },
    {
      id: "evals-25",
      title: "Evaluating an LLM feature in 25 minutes",
      timebox: "25 min",
      prompt: "You are about to change the model behind a customer-facing summarisation feature. How do you prove the change is safe to ship?",
      expected: [
        "A versioned golden set drawn from real traffic, sliced by intent and risk.",
        "Deterministic checks, reference metrics and LLM-as-judge with a rubric, chosen per output type.",
        "Judge calibration against human labels and awareness of judge biases (position, length, self-preference).",
        "A CI gate on per-slice scores plus a staged rollout with online monitoring.",
        "Cost and latency reported alongside quality."
      ],
      followups: [
        "The judge prefers the new model, humans prefer the old one. What do you trust and why?",
        "How big must the golden set be before a two-point difference means anything?"
      ],
      links: [
        { label: "Evals", route: "#/ops/evals/evals" },
        { label: "LLM-as-judge", route: "#/ops/evals/llm-judge" }
      ]
    },
    {
      id: "local-sizing-15",
      title: "Local model sizing in 15 minutes",
      timebox: "15 min",
      prompt: "You have a laptop with 32 GB of unified memory. Which open-weight models can you run, at what quantization, and what limits context length?",
      expected: [
        "Weights memory approximately equals parameters times bits per weight divided by 8.",
        "Adds KV cache, which grows with layers, hidden size, context length and concurrent sequences.",
        "Explains quantization formats (GGUF Q4/Q8, AWQ, GPTQ) and the quality versus memory trade-off.",
        "Leaves headroom for the OS and runtime; picks a runtime (Ollama, llama.cpp, LM Studio, MLX) to match."
      ],
      followups: [
        "Why does the model load but slow to a crawl at long context?",
        "When would you choose a smaller model at 8-bit over a larger one at 4-bit?"
      ],
      links: [
        { label: "Hardware", route: "#/local/why/hardware" },
        { label: "Quantization", route: "#/local/why/quantization" },
        { label: "Sizing calculator", route: "#/playground" }
      ]
    },
    {
      id: "llm-security-25",
      title: "LLM application security in 25 minutes",
      timebox: "25 min",
      prompt: "Walk through the main security risks of an LLM application that reads user documents and can call tools, and what you would put in place first.",
      expected: [
        "Names direct and indirect prompt injection and explains why prompt wording alone cannot fix it.",
        "Insecure output handling: model output rendered as HTML, run as SQL or code, or passed to a shell.",
        "Sensitive data disclosure and excessive agency; least-privilege tools and approval for side effects.",
        "Supply chain for models and plugins; denial of wallet through unbounded consumption.",
        "Maps defences to layers: input, retrieval, model, tool runtime, output, monitoring."
      ],
      followups: [
        "Your detector flags 1 percent of benign traffic as injection. Do you block or log?",
        "How do you stop the model leaking one tenant's documents to another tenant?"
      ],
      links: [
        { label: "OWASP Top 10 for LLM apps", route: "#/ops/security/owasp-llm" },
        { label: "Prompt injection", route: "#/ops/security/prompt-injection" },
        { label: "PII and data leakage", route: "#/ops/security/jailbreaks-pii" }
      ]
    },
    {
      id: "prompt-debug-20",
      title: "Debug a flaky prompt in 20 minutes",
      timebox: "20 min",
      prompt: "A classification prompt is right about 85 percent of the time and the errors look random. Walk through how you would improve it.",
      expected: [
        "Collects the failures and clusters them before editing anything.",
        "Tightens instructions and label definitions; adds diverse few-shot examples including hard negatives.",
        "Uses delimiters and an output schema with an enum of labels; lowers temperature.",
        "Considers decomposition or a reasoning step only where it measurably helps.",
        "Measures every change against a fixed eval set instead of eyeballing a few outputs."
      ],
      followups: [
        "Adding chain-of-thought improved accuracy but doubled latency. Ship it?",
        "How do you stop the prompt regressing when someone edits it next month?"
      ],
      links: [
        { label: "Clear instructions", route: "#/prompt/craft/clear-instructions" },
        { label: "Few-shot examples", route: "#/prompt/craft/few-shot" },
        { label: "Evaluating prompts", route: "#/prompt/systems/evaluating-prompts" },
        { label: "Prompt lab", route: "#/playground" }
      ]
    }
  ],

  rubrics: {
    dimensions: [
      "Problem framing — users, constraints, data, and a measurable definition of success",
      "Model and mechanism understanding — tokens, context, sampling and why models fail",
      "Retrieval and context design — chunking, search, reranking, grounding and access control",
      "Agent and tool safety — scoped tools, approvals, untrusted input and side effects",
      "Evaluation discipline — golden sets, judges, regression gates and online monitoring",
      "Cost, latency and operations — token economics, routing, caching, versioning and deployment choice",
      "Communication and trade-off reasoning"
    ],
    bands: [
      {
        id: "demo-grade",
        title: "Demo-grade",
        summary: "Can make something work in a notebook but cannot say why it works or how it will fail.",
        signals: [
          "Jumps to a framework or vendor before clarifying the problem.",
          "Treats the prompt as the whole system and fixes failures by adding more instructions.",
          "Judges quality by reading a handful of outputs.",
          "Has no answer for permissions, prompt injection or cost at scale."
        ]
      },
      {
        id: "production-ready",
        title: "Production-ready",
        summary: "Designs a sound pipeline with retrieval, structured output and basic evals, but treats safety and cost as afterthoughts.",
        signals: [
          "Chooses sensible chunking, hybrid search and citations.",
          "Builds a golden set and runs it before releases.",
          "Uses schemas and validation for machine-consumed output.",
          "Mentions guardrails but leaves tools broadly scoped or approval undefined."
        ]
      },
      {
        id: "trusted-builder",
        title: "Trusted builder",
        summary: "Explains mechanisms, layers defences, measures everything and trades quality, cost and risk explicitly.",
        signals: [
          "Separates retrieval quality from generation quality and fixes the right half.",
          "Enforces access control and side-effect limits in code, never in the prompt.",
          "Gates changes on per-slice eval scores with a calibrated judge and online drift alerts.",
          "Quantifies cost per successful task and uses routing, caching and smaller models deliberately."
        ]
      },
      {
        id: "platform-shaper",
        title: "Platform shaper",
        summary: "Turns one good system into reusable patterns other teams adopt safely.",
        signals: [
          "Proposes shared gateways, prompt registries, eval harnesses and tool servers with clear ownership.",
          "Plans model migrations and provider swaps as routine, tested events.",
          "Sets org-wide defaults for data handling, licensing and human oversight.",
          "Explains when not to use an LLM at all."
        ]
      }
    ]
  },

  cheatsheets: [
    {
      id: "sampling-params",
      title: "Sampling parameters",
      summary: "What each knob does to the next-token distribution, and sensible starting points.",
      items: [
        "temperature — divides logits before softmax; 0 to 0.3 for extraction and classification, around 0.7 for drafting, higher for brainstorming.",
        "top_p (nucleus) — keep the smallest set of tokens whose probabilities sum to p; 0.9 to 0.95 is a common default.",
        "top_k — keep only the k most likely tokens; a blunter cap than top_p.",
        "Tune temperature or top_p, not both at once, so you can tell which change mattered.",
        "max_tokens — hard cap on output length; also a cost and latency cap.",
        "stop sequences — end generation at a delimiter you control.",
        "frequency and presence penalties — discourage repeating tokens or topics; small values only.",
        "seed — improves repeatability where supported; still not a guarantee of identical output."
      ]
    },
    {
      id: "prompt-checklist",
      title: "Prompt checklist",
      summary: "Run through this before blaming the model.",
      items: [
        "Role and goal in one or two sentences; who the output is for.",
        "Explicit constraints: length, tone, what to do when information is missing.",
        "Inputs wrapped in clear delimiters and labelled as data, not instructions.",
        "Output format specified as a schema or template, with an example.",
        "Two to five diverse few-shot examples, including an edge case.",
        "Reasoning step only where it measurably helps; keep it out of user-visible output if not needed.",
        "Prompt stored in a versioned file and tested against an eval set on every change."
      ]
    },
    {
      id: "rag-knobs",
      title: "RAG tuning knobs",
      summary: "Change one at a time and measure recall at k and faithfulness.",
      items: [
        "Chunk size — smaller chunks are precise but lose context; start around a few hundred tokens and split on structure.",
        "Overlap — 10 to 20 percent keeps sentences from being cut at boundaries.",
        "Metadata filters — tenant, ACL, date and doc type applied before similarity search.",
        "Hybrid weight — blend keyword and vector results; reciprocal rank fusion is a robust default.",
        "Candidate k and rerank n — retrieve wide (for example 50), rerank narrow (for example 5 to 8).",
        "Query rewriting — expand acronyms or split multi-part questions before searching.",
        "Context order and budget — most relevant passages first; leave room for the answer.",
        "Grounding prompt — answer only from sources, cite ids, refuse when unsupported."
      ]
    },
    {
      id: "agent-safety",
      title: "Agent safety checklist",
      summary: "Before an agent touches a real system.",
      items: [
        "Single-purpose tools with strict schemas; no generic shell or HTTP tool in production.",
        "Tools run with the end user's identity and least privilege.",
        "Draft-then-commit with human approval for irreversible or external actions.",
        "Idempotency keys, rate limits, step and token budgets per run.",
        "All tool output, files and web content treated as untrusted input.",
        "Secrets never placed in the prompt; redact sensitive data from observations.",
        "Every tool call logged with arguments, originating request and approval.",
        "A kill switch per tool, tested before launch."
      ]
    },
    {
      id: "local-sizing",
      title: "Local model sizing formula",
      summary: "Back-of-envelope memory arithmetic; verify with the runtime's own report.",
      items: [
        "Weights (GB) approximately equal parameters (billions) times bits per weight divided by 8.",
        "Examples: 8B at 4-bit is about 4 GB; 8B at 8-bit about 8 GB; 70B at 4-bit about 35 to 40 GB.",
        "KV cache (bytes) approximately equal 2 times layers times KV heads times head dimension times context length times bytes per value, per sequence.",
        "Grouped-query attention shrinks the KV cache by sharing key and value heads.",
        "Add roughly 10 to 20 percent for runtime overhead and activations; leave memory for the OS.",
        "Throughput on a single machine is mostly bounded by memory bandwidth, not raw compute.",
        "Try the numbers in the playground sizing calculator."
      ]
    },
    {
      id: "owasp-llm-top10",
      title: "OWASP Top 10 for LLM apps, one line each",
      summary: "Category names paraphrased; check the current edition for exact wording and order.",
      items: [
        "Prompt injection — untrusted text steers the model, directly or via retrieved content.",
        "Sensitive information disclosure — the model or its context leaks secrets or personal data.",
        "Supply chain — compromised models, datasets, plugins or dependencies.",
        "Data and model poisoning — tampered training, fine-tuning or retrieval data changes behaviour.",
        "Improper output handling — model output used unsafely downstream (HTML, SQL, shell, code).",
        "Excessive agency — tools or permissions broader than the task needs.",
        "System prompt leakage — relying on a hidden prompt to hold secrets or enforce security.",
        "Vector and embedding weaknesses — cross-tenant retrieval, poisoned or inverted embeddings.",
        "Misinformation — confident, wrong output trusted without verification.",
        "Unbounded consumption — runaway tokens, loops or abuse driving cost and denial of service."
      ]
    },
    {
      id: "eval-types",
      title: "Eval types",
      summary: "Pick the cheapest check that actually measures what matters.",
      items: [
        "Deterministic checks — schema validity, regex, required fields, citation ids exist.",
        "Reference-based — exact match, F1 or similarity against a known answer.",
        "LLM-as-judge — rubric scoring or pairwise comparison; calibrate against humans.",
        "Human review — gold standard for nuance; expensive, so sample.",
        "Retrieval metrics — recall at k, precision, MRR on labelled query-document pairs.",
        "Faithfulness and groundedness — is every claim supported by the provided context?",
        "Safety and red-team suites — injection, jailbreak-awareness and data-leak probes.",
        "Online signals — feedback, escalation, edit distance, task completion, cost and latency."
      ]
    }
  ],

  glossary: [
    {
      id: "llm-gateway",
      term: "LLM gateway",
      definition: "A shared service in front of every model call that owns routing, quotas, retries, fallbacks, redaction and tracing.",
      useIt: "Name it as the first box in any LLM design so a provider swap or a new budget is configuration, not a code change in every feature.",
      links: [{ label: "Serving, scaling and cost", route: "#/ops/systems/llm-system-design" }]
    },
    {
      id: "index-lag",
      term: "Index lag",
      definition: "The age of the newest searchable version of a source in a RAG index, measured against a freshness target.",
      useIt: "Check it first when an assistant ignores a recently published document.",
      links: [{ label: "Production RAG failure modes", route: "#/ops/systems/rag-in-production" }]
    },
    {
      id: "token",
      term: "Token",
      definition: "The unit an LLM reads and writes: a word, part of a word, or punctuation mapped to an integer id in the model's vocabulary.",
      useIt: "Quote cost, latency and context limits in tokens, not words or characters.",
      links: [{ label: "Tokenization", route: "#/found/tokens/tokenization" }]
    },
    {
      id: "bpe",
      term: "BPE (byte-pair encoding)",
      definition: "A tokenizer training method that starts from bytes or characters and repeatedly merges the most frequent adjacent pair into a new token.",
      useIt: "Use it to explain why common words are one token while rare names, code and some languages split into many.",
      links: [{ label: "Tokenization", route: "#/found/tokens/tokenization" }, { label: "Tokenizer pane", route: "#/playground" }]
    },
    {
      id: "embedding",
      term: "Embedding",
      definition: "A dense vector representing a token, sentence or document so that similar meanings sit close together in the vector space.",
      useIt: "Say which embedding model produced an index; vectors from different models are not comparable.",
      links: [{ label: "Embeddings", route: "#/found/tokens/embeddings" }, { label: "Vector-space intuition", route: "#/found/tokens/vector-space" }]
    },
    {
      id: "attention",
      term: "Attention",
      definition: "The mechanism that lets each position build its representation as a weighted mix of other positions, with weights from query-key similarity.",
      useIt: "Use it to explain why models handle long-range references and why cost grows with sequence length.",
      links: [{ label: "Attention", route: "#/core/transformer/attention" }, { label: "Attention pane", route: "#/playground" }]
    },
    {
      id: "kv-cache",
      term: "KV cache",
      definition: "Stored key and value tensors for tokens already processed, so each new token attends to them without recomputing the whole prefix.",
      useIt: "Bring it up when explaining memory limits at long context or with many concurrent users.",
      links: [{ label: "Context windows and KV cache", route: "#/core/generation/context-kv" }]
    },
    {
      id: "temperature",
      term: "Temperature",
      definition: "A scalar that divides logits before softmax: lower values sharpen the distribution toward the top token, higher values flatten it.",
      useIt: "Pair a low temperature with extraction tasks and say it reduces variance, not error.",
      links: [{ label: "Sampling", route: "#/core/generation/sampling" }, { label: "Sampler pane", route: "#/playground" }]
    },
    {
      id: "top-p",
      term: "Top-p (nucleus sampling)",
      definition: "Sampling only from the smallest set of tokens whose cumulative probability reaches p, renormalised.",
      useIt: "Explain that it adapts the candidate set to how confident the model is, unlike a fixed top-k.",
      links: [{ label: "Sampling", route: "#/core/generation/sampling" }]
    },
    {
      id: "context-window",
      term: "Context window",
      definition: "The maximum number of tokens (prompt plus output) a model can attend to in one request.",
      useIt: "Treat it as a budget to spend deliberately, not a bucket to fill — quality can drop for details buried in the middle.",
      links: [{ label: "Context windows", route: "#/core/generation/context-kv" }, { label: "Managing the context window", route: "#/rag/context/context-engineering" }]
    },
    {
      id: "hallucination",
      term: "Hallucination",
      definition: "Fluent output that is unsupported by the input or false, produced because the model optimises plausible continuation rather than truth.",
      useIt: "Name the mitigations: grounding with retrieval, citations, refusal paths and verification — not just a lower temperature.",
      links: [{ label: "Why hallucinations happen", route: "#/core/generation/hallucinations" }]
    },
    {
      id: "rlhf",
      term: "RLHF",
      definition: "Reinforcement learning from human feedback: train a reward model on human preference comparisons, then optimise the LLM against it.",
      useIt: "Use it to explain how a base model became a helpful assistant, and why it can also become over-agreeable.",
      links: [{ label: "RLHF, step by step", route: "#/train/align/rlhf" }, { label: "InstructGPT and ChatGPT", route: "#/hist/modern/rlhf-chatgpt" }]
    },
    {
      id: "dpo",
      term: "DPO",
      definition: "Direct preference optimisation: tunes the model directly on preferred versus rejected response pairs, without a separate reward model or RL loop.",
      useIt: "Mention it as the simpler, cheaper alternative to RLHF when you have preference pairs.",
      links: [{ label: "DPO", route: "#/train/align/dpo" }]
    },
    {
      id: "lora",
      term: "LoRA",
      definition: "Low-rank adaptation: freeze the base weights and train small low-rank matrices added to selected layers.",
      useIt: "Say it lets you fine-tune on modest hardware and swap adapters per task on one base model.",
      links: [{ label: "LoRA, QLoRA and PEFT", route: "#/train/finetune/lora-peft" }]
    },
    {
      id: "qlora",
      term: "QLoRA",
      definition: "LoRA training on top of a base model whose frozen weights are quantized (typically to 4-bit) to cut memory further.",
      useIt: "Use it when asked how to fine-tune a large model on a single GPU.",
      links: [{ label: "LoRA, QLoRA and PEFT", route: "#/train/finetune/lora-peft" }]
    },
    {
      id: "moe",
      term: "Mixture of experts (MoE)",
      definition: "An architecture where a router sends each token to a few of many expert feed-forward blocks, so only a fraction of parameters run per token.",
      useIt: "Distinguish total parameters (memory) from active parameters (compute per token).",
      links: [{ label: "Mixture of experts", route: "#/train/pretrain/moe" }]
    },
    {
      id: "distillation",
      term: "Distillation",
      definition: "Training a smaller student model to imitate a larger teacher's outputs or probabilities.",
      useIt: "Propose it for a high-volume narrow task where a big model sets the bar and a small one must hit it cheaply.",
      links: [{ label: "Distillation and small models", route: "#/train/finetune/distillation" }]
    },
    {
      id: "rag",
      term: "RAG",
      definition: "Retrieval-augmented generation: fetch relevant passages at query time and include them in the prompt so the model answers from them.",
      useIt: "Pick it for knowledge that changes or needs citations; pick fine-tuning for behaviour and format.",
      links: [{ label: "Why RAG", route: "#/rag/retrieval/why-rag" }, { label: "RAG simulator", route: "#/playground" }]
    },
    {
      id: "chunking",
      term: "Chunking",
      definition: "Splitting documents into retrievable pieces, by fixed size, by structure such as headings, or by semantic boundaries.",
      useIt: "Say chunking is usually the first thing to fix when retrieval finds the right document but the wrong passage.",
      links: [{ label: "Chunking strategies", route: "#/rag/retrieval/chunking" }]
    },
    {
      id: "reranking",
      term: "Reranking",
      definition: "A second, more expensive scoring pass (often a cross-encoder) over the top retrieved candidates to reorder them by relevance.",
      useIt: "Describe it as retrieve wide, rerank narrow — it lifts precision without hurting recall.",
      links: [{ label: "Reranking", route: "#/rag/quality/reranking" }]
    },
    {
      id: "hybrid-search",
      term: "Hybrid search",
      definition: "Combining keyword search (such as BM25) with vector search and fusing the ranked lists.",
      useIt: "Use it to justify catching exact identifiers like error codes that embeddings blur.",
      links: [{ label: "Hybrid search", route: "#/rag/quality/hybrid-search" }]
    },
    {
      id: "vector-db",
      term: "Vector database",
      definition: "A store that indexes embeddings for fast approximate nearest-neighbour search, usually with metadata filtering.",
      useIt: "Say an existing database with a vector extension is often enough before adopting a dedicated service.",
      links: [{ label: "Embeddings and vector databases", route: "#/rag/retrieval/vector-dbs" }]
    },
    {
      id: "tool-calling",
      term: "Tool calling",
      definition: "The model emits a structured request naming a function and its arguments; your code runs it and returns the result.",
      useIt: "Stress that the model only proposes calls — your runtime decides whether to execute them.",
      links: [{ label: "Function and tool calling", route: "#/api/structured/tool-calling" }, { label: "Tool use", route: "#/agent/loop/tool-use" }]
    },
    {
      id: "react",
      term: "ReAct",
      definition: "An agent pattern that interleaves reasoning, an action (tool call) and the resulting observation in a loop until the task is done.",
      useIt: "Draw the loop and add the stop conditions: success, step budget, or a request for human help.",
      links: [{ label: "The ReAct loop", route: "#/agent/loop/react" }, { label: "Agent loop simulator", route: "#/playground" }]
    },
    {
      id: "mcp",
      term: "MCP (Model Context Protocol)",
      definition: "An open protocol for exposing tools, resources and prompts from servers to any compatible AI client in a standard way.",
      useIt: "Say it decouples tool builders from agent clients — write the integration once, use it from many hosts.",
      links: [{ label: "Model Context Protocol", route: "#/agent/ecosystem/mcp" }]
    },
    {
      id: "agent-skill",
      term: "Agent skill",
      definition: "A reusable, packaged set of instructions and optional scripts an agent loads on demand for a specific kind of task.",
      useIt: "Contrast it with a tool: a skill teaches the agent how to do something; a tool is a function it can call.",
      links: [{ label: "Agent skills", route: "#/agent/ecosystem/skills" }]
    },
    {
      id: "agents-md",
      term: "AGENTS.md",
      definition: "A convention for a repository-level markdown file that tells coding agents the project's commands, conventions and rules.",
      useIt: "Mention it when asked how to make coding agents follow team standards consistently across tools.",
      links: [{ label: "Coding agents and rules files", route: "#/agent/ecosystem/rules-files" }]
    },
    {
      id: "guardrail",
      term: "Guardrail",
      definition: "A check outside the model — on input, retrieved content, tool calls or output — that blocks, rewrites or escalates unsafe behaviour.",
      useIt: "Say guardrails belong in code with clear failure behaviour, not as extra sentences in the system prompt.",
      links: [{ label: "Guardrails and human-in-the-loop", route: "#/agent/orchestration/guardrails-hitl" }]
    },
    {
      id: "prompt-injection",
      term: "Prompt injection",
      definition: "Untrusted text that the model follows as instructions — directly from the user, or indirectly via documents, web pages, emails or tool output.",
      useIt: "Explain why it is structural: limit what the model can do, require approval for side effects, and treat all content as data.",
      links: [{ label: "Prompt injection", route: "#/ops/security/prompt-injection" }, { label: "OWASP Top 10 for LLM apps", route: "#/ops/security/owasp-llm" }]
    },
    {
      id: "llm-as-judge",
      term: "LLM-as-judge",
      definition: "Using a model with a written rubric to score or compare outputs at scale.",
      useIt: "Always add: calibrated against human labels, with known biases such as position, verbosity and self-preference controlled.",
      links: [{ label: "LLM-as-judge", route: "#/ops/evals/llm-judge" }]
    },
    {
      id: "quantization",
      term: "Quantization",
      definition: "Storing model weights (and sometimes activations or the KV cache) at lower precision, such as 8-bit or 4-bit, to save memory and bandwidth.",
      useIt: "Frame it as a quality versus memory trade-off and say you measured the quality loss on your own task.",
      links: [{ label: "Quantization", route: "#/local/why/quantization" }]
    },
    {
      id: "gguf",
      term: "GGUF",
      definition: "A single-file model format used by llama.cpp and tools built on it, bundling quantized weights, tokenizer and metadata.",
      useIt: "Read names like Q4_K_M as the quantization scheme; pick by available memory first, quality second.",
      links: [{ label: "Quantization", route: "#/local/why/quantization" }, { label: "Runtimes", route: "#/local/runtimes/runtimes" }]
    },
    {
      id: "structured-output",
      term: "Structured output",
      definition: "Constraining generation so the response matches a given JSON Schema, rather than merely asking for JSON.",
      useIt: "Distinguish it from JSON mode, which guarantees valid syntax but not your fields and types.",
      links: [{ label: "Structured outputs", route: "#/api/structured/structured-output" }]
    },
    {
      id: "golden-set",
      term: "Golden set",
      definition: "A versioned collection of representative inputs with reference answers or rubrics used to evaluate every change.",
      useIt: "Say every production incident becomes a new golden case so the same failure cannot ship twice.",
      links: [{ label: "Evals", route: "#/ops/evals/evals" }]
    }
  ]
};
