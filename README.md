# The Atlas Collection

Twenty-one interactive, **fully-offline** learning atlases behind a single hub, grouped into seven tracks. Read a concept, then *poke* it — every idea has an interactive lab, quiz, or visualization. Progress is saved locally in your browser; nothing is ever sent to a server.

| Track | Atlas | Topic | Highlights |
| --- | --- | --- | --- |
| Interview & Certification Prep | **Codex** | Coding interviews | Data structures · algorithms · problem-solving patterns · SQL coding rounds · concurrency problems · weighted graphs & DP shapes · AI-enabled coding |
| Interview & Certification Prep | **Compass** | Behavioral & offers | Signal decoding · story-bank engineering · Staff & Principal loops · company playbooks (incl. Snowflake, Databricks, Stripe, Netflix) · salary negotiation |
| Interview & Certification Prep | **Summit** | Certification prep (unofficial) | AWS SAA · SnowPro Core · CKA · Security+ · exam strategy · timed exam simulator · study plans · readiness dashboard |
| Design & Architecture | **Blueprint** | System & software design | HLD · clocks & ordering · technology deep dives · design patterns · 34 problem breakdowns (incl. CDC, clickstream & feature-store platforms) · production case studies · LLD & concurrency |
| Design & Architecture | **Ledger** | Database internals | Pages, B+trees, LSM & WAL · indexing · optimizer & joins · isolation, MVCC & SSI · replication & Raft · Postgres ops · columnar & MPP · SQL |
| Design & Architecture | **TechLead** | Techno managerial interviews | Architecture drivers · reviews that decide · re-platforming & multi-region trade-offs · LLD credibility · data trust & platform strategy · leading people · strategy to delivery |
| AI & ML | **Synapse** | ML system design | Foundations & metrics · labels, leakage & feature stores · distributed training & GPU cost · MLOps & drift · search, ranking & recs · responsible ML · 13 graded breakdowns |
| AI & ML | **Lumen** | LLMs & GenAI | Tokens & transformers · history from n-grams to reasoning models · training & alignment · prompt engineering · RAG · agents, skills & MCP · local LLMs with Ollama · evals & LLM security · production LLM serving & RAG ops · local LLM playground |
| Data Engineering | **Cascade** | Data engineering | Storage · modeling · batch & Spark · Databricks & Delta · streaming · orchestration · SQL · Python for DE · DataOps |
| Data Engineering | **Pulse** | Streaming systems | Kafka internals & ops · event time, windows & state · Flink · exactly-once · CDC & Kafka Connect · engine trade-offs · production cases |
| Data Engineering | **Glacier** | Snowflake platform | Architecture & micro-partitions · warehouses & performance · pipelines · governance · FinOps · Snowpark & Cortex AI · CI/CD & continuity |
| Infrastructure & Operations | **Kernel** | Linux & networking | Shell & text tools · processes & systemd · filesystems · performance triage · TCP/IP, DNS & TLS · tcpdump & firewalls · containers · SSH · terminal lab |
| Infrastructure & Operations | **Nimbus** | Cloud platforms | AWS mapped to Azure & GCP · landing zones · IAM & workload identity · networking · compute & storage · Terraform · Well-Architected · labs |
| Infrastructure & Operations | **Beacon** | Observability & SRE | SLIs, SLOs & error budgets · OpenTelemetry · Prometheus, PromQL & Grafana · on-call · incidents & postmortems · chaos · incident simulator |
| Security & Delivery | **Citadel** | Cybersecurity | 8 tracks · crypto · AppSec · OAuth/OIDC/SAML · AD & Kerberos · detection-as-code · cloud IAM paths · threats & forensics · reverse engineering · Attack Lab |
| Security & Delivery | **Forge** | DevSecOps | SDLC & secure SDLC · Git, Jenkins & GitHub Actions · pipeline hardening · progressive delivery & feature flags · Snowflake & dbt CI/CD · Docker & Kubernetes · SonarQube & Snyk · vuln management · deep Wiz track · governance · pipeline simulator |
| Engineering Craft & Stacks | **Chisel** | Software craft | Clean code · refactoring legacy · testing strategy · code review · advanced Git · API & dependency design · docs & estimation · AI coding agents |
| Engineering Craft & Stacks | **Pyxis** | Python engineering | Data model & idioms · typing & Protocols · uv & Ruff · pytest to mutation testing · GIL & asyncio · profiling · FastAPI · pandas, Polars, DuckDB & Snowpark · production CI |
| Engineering Craft & Stacks | **Pixel** | Frontend engineering | Web platform · React core · state & data · composition · Next.js rendering · performance · accessibility · testing · frontend system design |
| Engineering Craft & Stacks | **Anvil** | Java backend | Java 21 · JVM internals · virtual threads · Spring Boot · REST · JPA & transactions · Resilience4j & Kafka · Spring Security · observability |
| Engineering Craft & Stacks | **Orbit** | Salesforce platform | Multitenancy & limits · sharing model & Shield · Flow vs Apex · bulk-safe Apex · LWC · integration · Agentforce · DevOps · CRM Analytics |

Each atlas includes exam mode, flashcards, interactive widgets, light/dark themes, keyboard shortcuts, a command palette, progress export/import, and installable-PWA support — all with **zero external requests**.

## Run locally

A service worker (offline support) needs `http://`, so serve the folder rather than opening the file directly:

```bash
cd atlas-main
python3 -m http.server 8800
```

Then open <http://localhost:8800/>. (Opening `index.html` via `file://` still works, just without offline caching.)

## QA

All twenty-one apps are covered by the five gates in `tools/`. Run them together:

```bash
tools/verify_all.sh                             # everything
tools/verify_all.sh --app=techno-managerial-academy   # scope to one app
```

The gates are the content contract (`validate_content.mjs`), static guardrails (`lint_static.mjs`), link and route integrity (`check_links.mjs`), and an end-to-end crawl in headless Chrome (`crawl_e2e.mjs`) that visits every route, plays every quiz, drives every widget, and fails on any console output, and a UI sweep (`crawl_ui.mjs`) for light-theme contrast and keyboard/palette keys. `tools/smoke.mjs` is a quicker boot check of the hub plus every academy home.

## Deploy to GitHub Pages

This folder is self-contained and Pages-ready — real files (no symlinks), a `.nojekyll` marker, and only relative paths, so it works whether the repo is served from a subpath (`https://USER.github.io/REPO/`) or a user site (`https://USER.github.io/`).

1. Create a new GitHub repository and push this folder as the repo root:
   ```bash
   git remote add origin https://github.com/USER/REPO.git
   git branch -M main
   git push -u origin main
   ```
2. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, then choose **`main`** and **`/ (root)`**, and save.
3. Wait for the Pages build, then visit the URL shown there. The hub loads, and each card opens its atlas.

No build step runs on GitHub — the deployable copies are already in the app folders (`dsa-patterns-academy/`, `behavioral-academy/`, `certification-academy/`, `hld-lld-academy/`, `db-internals-academy/`, `techno-managerial-academy/`, `ml-ai-academy/`, `llm-academy/`, `data-eng-academy/`, `streaming-academy/`, `snowflake-academy/`, `linux-net-academy/`, `cloud-academy/`, `sre-academy/`, `cyber-academy/`, `devsecops-academy/`, `software-craft-academy/`, `python-academy/`, `frontend-academy/`, `java-backend-academy/`, `salesforce-academy/`).

## Structure

```
atlas-main/
├── index.html              hub launcher (7 tracks, filter, theme toggle, PWA, combined progress)
├── manifest.webmanifest    hub PWA manifest
├── icon.svg                hub icon
├── sw.js                   hub service worker (caches only the hub's own files)
├── assemble.sh             local-only: rebuild the externally-authored app copies
├── docs/ENGINE_SPEC.md     content authoring contract (data shapes, voice, gates)
├── tools/                  validator, linters, link checker, crawlers, SW generator
│
├── dsa-patterns-academy/   Codex      ┐
├── behavioral-academy/     Compass    │ Interview & Certification Prep
├── certification-academy/  Summit     ┘
├── hld-lld-academy/        Blueprint  ┐
├── db-internals-academy/   Ledger     │ Design & Architecture
├── techno-managerial-academy/ TechLead┘
├── ml-ai-academy/          Synapse    ┐ AI & ML
├── llm-academy/            Lumen      ┘
├── data-eng-academy/       Cascade    ┐
├── streaming-academy/      Pulse      │ Data Engineering
├── snowflake-academy/      Glacier    ┘
├── linux-net-academy/      Kernel     ┐
├── cloud-academy/          Nimbus     │ Infrastructure & Operations
├── sre-academy/            Beacon     ┘
├── cyber-academy/          Citadel    ┐ Security & Delivery
├── devsecops-academy/      Forge      ┘
├── software-craft-academy/ Chisel     ┐
├── python-academy/         Pyxis      │ Engineering Craft & Stacks
├── frontend-academy/       Pixel      │
├── java-backend-academy/   Anvil      │
└── salesforce-academy/     Orbit      ┘
```

## Updating an app

Blueprint, Codex, Citadel, Cascade and TechLead are **built copies** of sources kept elsewhere; the other sixteen academies are authored directly in this repo. To change an app, edit its source elsewhere and re-run `./assemble.sh` (it rebuilds each app via its own `build.sh`, strips dev artifacts and symlinks, and refreshes the copies here), then commit. `assemble.sh` only works on the machine that has the source apps; it is not needed to deploy.

## License

Released under the MIT License — see [LICENSE](LICENSE).
