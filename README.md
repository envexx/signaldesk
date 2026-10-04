# SignalDesk

**Autonomous B2B lead enrichment & hyper-personalized inbound nurturing engine.**

SignalDesk receives an inbound lead, normalizes it, researches the company, builds
evidence-backed company intelligence, scores ICP fit with a transparent rubric,
drafts a contextual inbound follow-up, and then **stops for human approval** before
anything is sent.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle-4169E1?logo=postgresql&logoColor=white)
![Inngest](https://img.shields.io/badge/Inngest-durable-000000)
![Vitest](https://img.shields.io/badge/tests-Vitest-6E9F18?logo=vitest&logoColor=white)
![License](https://img.shields.io/badge/license-portfolio-lightgrey)

---

## Table of contents

- [Overview](#overview)
- [Highlights](#highlights)
- [Architecture](#architecture)
- [Lead lifecycle](#lead-lifecycle)
- [Enrichment workflow & ICP scoring](#enrichment-workflow--icp-scoring)
- [Provider strategy (demo vs production)](#provider-strategy-demo-vs-production)
- [Reliability: idempotency, retries & rate limiting](#reliability-idempotency-retries--rate-limiting)
- [Settings, guardrails & prompt injection](#settings-guardrails--prompt-injection)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database & migrations](#database--migrations)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Frontend integration](#frontend-integration)
- [Observability & metrics](#observability--metrics)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Security](#security)
- [Deployment](#deployment)
- [Roadmap & known limitations](#roadmap--known-limitations)

---

## Overview

Most lead workflows fail in the same place: research is slow, qualification is
inconsistent, and follow-ups are generic. SignalDesk closes that loop without
removing human control.

The system is **event-driven** and **provider-agnostic**:

- Route Handlers own HTTP concerns only (validation, rate limiting, envelopes).
- Business rules live in the service/domain layer.
- External providers (research, AI, email, CRM) sit behind interfaces with a
  deterministic **demo** implementation and a **production** implementation.
- **Structured AI output is re-validated with Zod** before it is ever persisted.
- **Scores and tier are computed by the backend**, never trusted from the model.
- **No email is ever sent without explicit human approval.**

The repository ships with a complete demo path that runs with **zero external
credentials**, and degrades gracefully to it whenever a credential is missing.

---

## Highlights

- 🧠 **Evidence-backed enrichment** — every insight is labelled `source` or
  `inference`; nothing is presented as fact without evidence.
- 🎯 **Explainable ICP scoring** — a fixed 100-point rubric with per-criterion
  rationale, deterministic and auditable.
- ✍️ **Contextual drafting** — the draft is generated from your own
  *company context* (value proposition, offerings, proof, tone, CTA, signature).
- 🛡️ **Human-in-the-loop** — approval is required before delivery; delivery is a
  separate, explicit action.
- 🔁 **Durable orchestration** — Inngest runs enrichment asynchronously with
  per-lead concurrency and retries; a synchronous fallback keeps local dev usable.
- 📬 **Auditable outbox** — every send attempt (real or demo) is recorded with a
  status and provider message id.
- 🧩 **Provider abstraction** — Firecrawl, DeepSeek / AI Gateway, Resend and
  HubSpot are swappable behind interfaces.
- ⚙️ **Workspace settings** — ICP, company context, email and webhook signing are
  configured from the UI and injected into prompts.
- 🔒 **Safety first** — secrets stay server-side, are never returned by the API,
  PII is masked in logs, and webhooks can be HMAC/Svix verified.

---

## Architecture

```mermaid
flowchart LR
    subgraph Clients
        FORM["Landing / webinar form"]
        UI["SignalDesk web app\n(Dashboard · Pipeline · Workbench · Settings)"]
    end

    subgraph Edge["Next.js Route Handlers (Node runtime)"]
        R["/api/*"]
    end

    subgraph Core["Service & Domain layer"]
        LS["lead-service"]
        ES["enrichment-service"]
        SS["settings-service"]
        SC["domain · scoring"]
        WF["workflow · enrichment"]
    end

    subgraph Data["Persistence"]
        LR["LeadRepository"]
        SR["SettingsRepository"]
        DR["DeliveryRepository"]
        PG[("PostgreSQL\n(Drizzle · 12 tables)")]
        MEM[("In-memory demo")]
        REDIS[("Upstash Redis\nrate limit · idempotency")]
    end

    subgraph Providers["Providers"]
        RES["CompanyResearch\nFirecrawl / demo"]
        INT["LeadIntelligence\nDeepSeek / AI Gateway / demo"]
        EMAIL["EmailDelivery\nResend / demo"]
        CRM["CrmProvider\nHubSpot / webhook / demo"]
    end

    ING["Inngest\n(durable workflow)"]
    OBS["Observability\nJSON logs · metrics · Sentry"]

    FORM -->|POST webhook| R
    UI -->|REST JSON| R
    R --> LS
    R --> ES
    R --> SS
    LS --> LR
    ES --> WF
    ES --> SC
    SS --> SR
    ES --> DR
    LR --> PG
    LR --> MEM
    SR --> PG
    DR --> PG
    LS --> REDIS
    ES --> RES & INT & EMAIL & CRM
    ES -. "process (202)" .-> ING
    ING --> ES
    R --> OBS
    ES --> OBS
```

**Separation of concerns**

- **Route handlers** — parse/validate input, apply rate limits, wrap responses in
  the shared envelope, translate errors to safe HTTP responses.
- **Services** — orchestrate domain rules and persistence; no HTTP awareness.
- **Domain** — pure, deterministic logic (scoring, risk flags, workflow state).
- **Providers** — isolated integrations behind interfaces with demo fallbacks.
- **Repositories** — persistence abstraction; PostgreSQL in production, an
  in-memory store with a deterministic seed in demo mode.

---

## Lead lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant U as User / Form
    participant API as Route Handler
    participant SVC as enrichment-service
    participant ING as Inngest
    participant WF as Workflow
    participant P as Providers
    participant DB as PostgreSQL

    U->>API: POST /api/leads (or POST /api/webhooks/leads)
    API->>DB: INSERT lead (status = CAPTURED)
    API-->>U: 201 { data: Lead }  (webhook: 202)

    U->>API: POST /api/leads/{id}/process
    alt Inngest configured (production)
        API->>ING: send "signaldesk/lead.enrich" { leadId }
        API-->>U: 202 { meta.jobId, meta.completed: false }
        ING->>SVC: processLead(leadId)
    else Demo / Inngest unreachable
        API->>SVC: processLead(leadId) — synchronous
        API-->>U: 200 { meta.completed: true }
    end

    SVC->>WF: validate → research → extract → score → draft → review
    WF->>P: research (Firecrawl, multi-page)
    WF->>P: extract + draft (DeepSeek / AI Gateway)
    WF->>WF: deterministic ICP scoring
    WF->>DB: persist stage status, timeline, evidence
    WF-->>SVC: READY_FOR_REVIEW (or FAILED with partial results)

    loop UI polling (every ~1.5s)
        U->>API: GET /api/leads/{id}
        API-->>U: PROCESSING → ... → READY_FOR_REVIEW
    end

    U->>API: PATCH /api/leads/{id} (edit draft, draft.version++)
    U->>API: POST /api/leads/{id}/approve { confirm: true, version }
    SVC->>DB: status = APPROVED (demo: no external send)

    U->>API: POST /api/leads/{id}/send { confirm: true }
    alt Resend configured in Settings
        API->>P: Resend send
        SVC->>DB: status = SENT + outbox SENT
        P-->>API: Resend webhook (delivered / bounced) → activity
    else Demo delivery
        SVC->>DB: status = SENT + outbox SIMULATED (labelled)
    end
```

**Status machine**

```mermaid
stateDiagram-v2
    [*] --> CAPTURED: create / webhook
    CAPTURED --> PROCESSING: process
    PROCESSING --> READY_FOR_REVIEW: all stages succeeded
    PROCESSING --> FAILED: provider or validation error
    FAILED --> PROCESSING: retry (resumes failed stage)
    READY_FOR_REVIEW --> APPROVED: approve (confirm + version)
    READY_FOR_REVIEW --> READY_FOR_REVIEW: reject (draft = REJECTED)
    APPROVED --> READY_FOR_REVIEW: edit draft (re-approval required)
    APPROVED --> SENT: send
    SENT --> [*]
```

---

## Enrichment workflow & ICP scoring

Every stage records **status, attempt, start/completion time, duration and a
stable error code**. Retries only re-run the failed or pending stage; successful
stages are never recomputed unless `force` is requested.

```mermaid
flowchart LR
    C[captured] --> V[validate\nnormalize email / URL / domain]
    V --> R[research\nhomepage + about/services/product/pricing]
    R --> E[extract\nindustry · size · model · tech · pain · evidence]
    E --> S[score\nICP rubric, deterministic]
    S --> D[draft\ncontextual inbound follow-up]
    D --> RV[review\nawait human approval]
    RV --> A[approve]
    A --> SND[send\noutbox + provider]

    R -. "PROVIDER_FAILURE" .-> F[FAILED + stable code]
    E -.-> F
    D -.-> F
    F -. "retry only failed stage" .-> R
```

### ICP scoring rubric (total = 100)

| Criterion | Max | Weight | Notes |
|---|---:|---:|---|
| Company fit | 35 | 35% | Industry, size, region, business model. |
| Problem fit | 30 | 30% | Alignment with your documented pain points. |
| Buying signal | 20 | 20% | Hiring, funding, rebrand, tooling change, expansion. |
| Data confidence | 15 | 15% | Evidence quality; free-email lowers it. |

| Tier | Score range |
|---|---|
| `HIGH_PRIORITY` | 75 – 100 |
| `MEDIUM` | 45 – 74 |
| `DISQUALIFIED` | 0 – 44 |
| `UNASSESSED` | not yet scored |

> The LLM may **suggest** per-criterion values, but the backend clamps each
> value, sums the total, derives the tier, and stores a rubric version.

---

## Provider strategy (demo vs production)

Every provider has a deterministic **demo** adapter and a **production** adapter.
In `production` mode each provider is selected **independently**, so a single
missing credential only degrades that capability — it never breaks the app.

```mermaid
flowchart TD
    START["getProviderRegistry()"] --> MODE{"APP_MODE"}
    MODE -->|demo| DEMO["All demo providers\n(deterministic, no network)"]
    MODE -->|production| SEL["Select each provider independently"]

    SEL --> R{"FIRECRAWL_API_KEY?"}
    R -->|yes| R1["FirecrawlCompanyResearchProvider"]
    R -->|no| R2["DemoCompanyResearchProvider"]

    SEL --> I{"DEEPSEEK_API_KEY or AI_GATEWAY_API_KEY?"}
    I -->|yes| I1["AiGatewayIntelligenceProvider"]
    I -->|no| I2["DemoLeadIntelligenceProvider"]

    SEL --> E{"Resend enabled in Settings?"}
    E -->|yes| E1["ResendEmailDeliveryProvider"]
    E -->|no| E2["DemoEmailDeliveryProvider"]

    SEL --> C{"HUBSPOT_ACCESS_TOKEN?"}
    C -->|yes| C1["HubSpotCrmProvider"]
    C -->|no| C2["DemoCrmProvider"]
```

> **Graceful degradation is a feature.** The demo path needs no credentials, makes
> no external calls, produces deterministic output, and never sends real email.

---

## Reliability: idempotency, retries & rate limiting

```mermaid
flowchart TD
    WH["POST /api/webhooks/leads\nheader Idempotency-Key"] --> LOOK{"Key seen before?"}
    LOOK -->|Redis hit| DUP["Return the same lead\n200 duplicate:true"]
    LOOK -->|DB unique| DUP
    LOOK -->|new| CREATE["Create lead\n202 duplicate:false\nstore key in Redis + DB"]

    PROC["POST /process"] --> MODE{"Inngest configured?"}
    MODE -->|yes| ASYNC["202 async (durable)"]
    MODE -->|no / unreachable| SYNC["200 synchronous fallback"]
    ASYNC --> RUN["Workflow (per-lead concurrency = 1)"]
    SYNC --> RUN
    RUN --> STEP{"Stage result"}
    STEP -->|failed| FAIL["Status FAILED\npartial results kept"]
    FAIL --> RETRY["Retry / { force: true }"]
    STEP -->|succeeded| READY["READY_FOR_REVIEW"]

    RL["Every route"] --> LIMIT["Fixed-window rate limit\n(Upstash Redis or in-memory)"]
    LIMIT -->|exceeded| R429["429 RATE_LIMITED"]
```

- **Webhook idempotency** — `Idempotency-Key` is checked in Redis (cross-instance)
  and enforced by a unique constraint in the database.
- **Workflow idempotency** — succeeded stages are skipped; approved drafts are
  never regenerated; `force: true` re-runs explicitly.
- **Retries** — Inngest retries with per-lead concurrency (`limit = 1`), so a lead
  can never have two active runs.
- **Rate limiting** — fixed-window, per bucket, per client; backed by Upstash
  Redis with an in-memory fallback.

---

## Settings, guardrails & prompt injection

The **Settings** area has five tabs: *Target prospect*, *Company context*,
*Email*, *Webhooks* and *System*.

```mermaid
flowchart TD
    subgraph Settings["Workspace settings (PostgreSQL)"]
        TP["Target prospect (ICP):\nindustries · sizes · regions · roles\npain points · buying signals · disqualifiers"]
        CC["Company context:\nvalue prop · offerings · differentiators\nproof · tone · CTA · signature"]
        EM["Email: provider · from · reply-to · enabled · API key (write-only)"]
        WH["Webhooks: HMAC + Svix flags and secrets (write-only)"]
    end

    TP --> EXTRACT["Extraction prompt\nrelevance scoring + risk flags"]
    CC --> DRAFT["Drafting prompt\ncopywriting + signature"]
    EM --> SEND["Send pipeline\n(resolve provider at send time)"]
    WH --> VERIFY["Webhook verification\n(inbound + Resend)"]
```

**AI guardrails**

- Never invent funding, headcount, customers, technologies or news.
- Facts must come from the provided pages; otherwise label them `inference`.
- `estimatedSize` / `location` are `Unknown` unless stated; technologies are only
  included when explicitly evidenced or detected from page markup.
- Website content is treated as **untrusted data**; the model is instructed never
  to follow instructions found inside it.
- The draft is positioned as an inbound follow-up, keeps a light CTA, respects the
  configured tone, and signs with the configured signature.
- Structured output is validated with Zod before persistence (and re-validated at
  the boundary).

---

## Tech stack

| Concern | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Route Handlers, Turbopack) |
| Runtime | Node.js |
| Language | TypeScript (strict) |
| Validation | Zod |
| Database | PostgreSQL + Drizzle ORM / Drizzle Kit |
| Durable workflow | Inngest |
| Cache / rate limit | Upstash Redis (in-memory fallback) |
| Website research | Firecrawl (map + multi-page scrape) |
| AI | Vercel AI SDK · DeepSeek or Vercel AI Gateway (structured output) |
| Email | Resend (Svix-signed webhooks) |
| CRM | HubSpot (or a generic webhook) |
| Error monitoring | Sentry (optional) |
| Testing | Vitest |

---

## Getting started

### Prerequisites

- Node.js **20.9+**
- npm
- *(optional, production)* PostgreSQL, Upstash Redis, Inngest, Firecrawl,
  DeepSeek/AI Gateway, Resend, HubSpot.

### Demo mode (no credentials)

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The app uses deterministic demo providers, an
in-memory repository with a seed, and **never sends real email**.

### Production mode

```bash
cp .env.example .env.local   # then fill in the values you need
npm run db:generate          # generate SQL from the Drizzle schema
npm run db:migrate           # apply migrations to DATABASE_URL
npm run build
npm start
```

`APP_MODE=production` activates real adapters. Any missing credential degrades
only that provider back to demo. `GET /api/health` reports `status: degraded`
(with `missingConfiguration`) when a required credential is absent, and
`STRICT_STARTUP=true` turns that into a hard startup failure.

### Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server. |
| `npm run build` / `npm start` | Build and run production. |
| `npm run typecheck` | TypeScript strict check. |
| `npm run lint` | ESLint (flat config). |
| `npm test` | Unit, service and contract tests (Vitest). |
| `npm run db:generate` / `npm run db:migrate` | Drizzle migrations. |

---

## Environment variables

Copy `.env.example` to `.env.local`. Demo mode needs **none** of these.

| Variable | Mode | Purpose |
|---|---|---|
| `APP_MODE` | both | `demo` (default) or `production`. |
| `STRICT_STARTUP` | production | Fail startup when required credentials are missing. |
| `DATABASE_URL` | production | PostgreSQL connection string. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | production | Cross-instance idempotency & rate limiting. |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | production | Durable workflow dispatch & verification. |
| `INNGEST_DEV` | local | Route events to a local Inngest dev server. |
| `FIRECRAWL_API_KEY` | production | Website research. |
| `AI_GATEWAY_API_KEY` | production | Vercel AI Gateway model access. |
| `DEEPSEEK_API_KEY` | production | Direct DeepSeek access (alternative to the gateway). |
| `AI_MODEL` | production | Model id, e.g. `deepseek-chat` or `deepseek/deepseek-chat`. |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | production | Email delivery. |
| `RESEND_WEBHOOK_SECRET` | production | Svix signature for delivery webhooks. |
| `HUBSPOT_ACCESS_TOKEN` / `CRM_WEBHOOK_URL` | production | CRM sync. |
| `WEBHOOK_SIGNING_SECRET` | production | HMAC for inbound lead webhooks. |
| `SENTRY_DSN` | production | Error monitoring. |

> Email provider, from-address and webhook secrets can also be configured from
> **Settings** (stored in PostgreSQL). Database values take precedence over the
> environment. Secrets are **write-only** — the API returns `hasApiKey` /
> `hasInboundSecret` booleans, never the value.

---

## Database & migrations

The schema is defined with Drizzle in `src/lib/server/db/schema.ts` and lives in
`drizzle/`. Reveal the schema with:

```mermaid
erDiagram
    LEADS ||--o{ LEAD_EVIDENCE : has
    LEADS ||--o{ LEAD_PAIN_POINTS : has
    LEADS ||--o{ LEAD_TECHNOLOGIES : has
    LEADS ||--o{ LEAD_SCORES : has
    LEADS ||--o{ LEAD_RISK_FLAGS : has
    LEADS ||--|| OUTREACH_DRAFTS : has
    LEADS ||--o{ WORKFLOW_RUNS : has
    WORKFLOW_RUNS ||--o{ WORKFLOW_STEPS : has
    LEADS ||--o{ EMAIL_DELIVERIES : has
    LEADS ||--o{ ACTIVITY_EVENTS : logs

    LEADS {
      text id PK
      text work_email
      text domain
      text status
      text tier
      int score
      text idempotency_key
      timestamp created_at
    }
    LEAD_EVIDENCE {
      text id PK
      text lead_id FK
      text kind
      text confidence
      text source_url
    }
    LEAD_SCORES {
      text id PK
      text lead_id FK
      text criterion_key
      int score
      int max
    }
    OUTREACH_DRAFTS {
      text lead_id FK
      text status
      int version
    }
    WORKFLOW_STEPS {
      text workflow_run_id FK
      text step_key
      text status
      int attempt
      text error_code
    }
    EMAIL_DELIVERIES {
      text id PK
      text lead_id FK
      text status
      text provider_message_id
    }
    WORKSPACE_SETTINGS {
      text id PK
      jsonb target_prospect
      jsonb company_context
      jsonb email_config
      jsonb webhook_config
    }
```

Tables: `leads`, `lead_evidence`, `lead_pain_points`, `lead_technologies`,
`lead_scores`, `lead_risk_flags`, `outreach_drafts`, `workflow_runs`,
`workflow_steps`, `activity_events`, `workspace_settings`, `email_deliveries`.

---

## API reference

All endpoints share a single envelope and are served from the same origin (no
CORS configuration required).

**Success**

```json
{ "data": {}, "meta": {} }
```

**Error**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid",
    "fields": { "workEmail": ["Enter a valid email address"] }
  }
}
```

| Method & path | Description |
|---|---|
| `GET /api/health` | Mode, uptime, lead count, provider & infrastructure status (no secrets). |
| `GET /api/dashboard` | KPIs, priority queue, funnel, automation health, activity feed. |
| `GET /api/metrics` | Counters, latency (median / p95) and rate metrics. |
| `GET /api/leads?q=&tier=&status=&limit=&offset=` | List leads with filters + `meta`. |
| `POST /api/leads` | Create a lead (`201`, status `CAPTURED`). |
| `GET /api/leads/{id}` | Fetch one canonical lead. |
| `PATCH /api/leads/{id}` | Save draft/contact changes (`draft.version++`). |
| `POST /api/leads/{id}/process` | Run/retry enrichment (`{ "force": true }` optional). |
| `POST /api/leads/{id}/approve` | Explicit approval (`confirm`, optional `version`, `subject`, `body`). |
| `POST /api/leads/{id}/reject` | Reject the draft; the lead returns to review. |
| `POST /api/leads/{id}/send` | Send the approved draft (`{ "confirm": true }`). |
| `GET /api/outbox` | Delivery history (`SENT` / `SIMULATED` / `FAILED`). |
| `GET /api/settings` / `PUT /api/settings` | Read/update workspace settings (secrets write-only). |
| `POST /api/demo/seed` / `POST /api/demo/reset` | Load or clear the sample workspace. |
| `POST /api/webhooks/leads` | Inbound webhook (`Idempotency-Key`, optional HMAC). |
| `POST /api/webhooks/resend` | Resend delivery webhook (Svix-signed). |
| `GET`/`POST`/`PUT /api/inngest` | Inngest serve handler. |

**Status codes**

| Status | Meaning |
|---|---|
| `200` | Success (read / update / approval / synchronous workflow). |
| `201` | Lead created. |
| `202` | Asynchronous workflow / webhook accepted. |
| `400` | Invalid JSON or payload. |
| `401` | Invalid webhook signature. |
| `404` | Lead not found. |
| `409` | Invalid state transition or draft version conflict. |
| `422` | Valid shape but business rule not met (e.g. empty draft). |
| `429` | Rate limit exceeded. |
| `502` | External provider failed in a mapped way. |
| `503` | Required provider unavailable / not configured. |

**Rate limits (per client, per minute)**

| Bucket | Limit | Bucket | Limit |
|---|---:|---|---:|
| `leads:list` | 120 | `approve` | 60 |
| `leads:create` | 30 | `reject` | 60 |
| `leads:get` | 240 | `send` | 30 |
| `leads:update` | 60 | `webhook:leads` | 120 |
| `process` | 60 | `settings:update` | 30 |

---

## Data model

The canonical contract lives in `src/contracts/**` and is imported by both the
frontend and the backend. There is a single `Lead` type; no duplicate models.

- **Enums** — `Tier`, `LeadStatus`, `StepStatus`, `DraftStatus`, `DeliveryStatus`.
- **`Lead`** — `contact`, `company`, `qualification` (score, tier, reasoning,
  criteria, risk flags), `enrichment` (summary, pain points, technologies,
  evidence, confidence), `draft` (subject, body, status, version), `workflow`
  (current stage, steps, attempts, duration), `status`, timestamps,
  `idempotencyKey`.
- **Evidence** is explicitly typed as `kind: "source" | "inference"` with
  `confidence: high | medium | low` and an optional `sourceUrl`.

All values crossing the network are JSON-serializable; timestamps are always ISO
8601 strings (the PostgreSQL adapter normalizes driver output).

---

## Frontend integration

```mermaid
flowchart LR
    UI["Components"] --> STORE["ApiStoreProvider\n(state + polling + auto-refresh)"]
    STORE --> CLIENT["signaldesk-api.ts\n(one typed fetch client)"]
    CLIENT -->|envelope parsing| API["/api/*"]
    API --> VM["view-model.ts\n(canonical → UI shape)"]
    VM --> UI
```

- `src/lib/client/signaldesk-api.ts` — a single typed client. Components never
  build URLs or parse the envelope themselves.
- `src/lib/client/view-model.ts` — maps canonical contracts to the UI view-model.
- `src/components/providers/api-store.tsx` — loads `/api/leads` + `/api/dashboard`,
  handles create/process/save/approve/send/reject, polls `PROCESSING` leads and
  auto-refreshes every ~12s.
- A demo store remains available as an explicit fallback and is used automatically
  if the API is unreachable.

---

## Observability & metrics

- **Structured JSON logs** (one line per event) with a correlation id resolved
  from `x-request-id` / `x-correlation-id`, plus `leadId`, `workflowRunId`,
  `provider`, `durationMs`, `outcome` and `errorCode`.
- **PII masking** — emails are masked and secret-looking fields are redacted
  before logging.
- **Metrics** — `GET /api/metrics` exposes lead ingestion, enrichment success and
  failure counts, draft approvals, emails sent/failed, plus median/p95 enrichment
  latency and derived rates.
- **Sentry** — optional; initialized from `instrumentation.ts` only when
  `SENTRY_DSN` is set. Monitoring failures never break a request.

`GET /api/health` exposes per-provider mode/credential presence and infrastructure
flags (database, Redis, Inngest) without revealing any secret value.

---

## Testing

```bash
npm test
```

The suite (Vitest) covers:

- **Unit** — email/domain/website normalization, free-email risk flag, scoring
  boundaries (0 / 44 / 45 / 74 / 75 / 100), tier calculation, evidence
  source/inference invariants, timestamp ISO format.
- **Service** — create/list/get/update, case-insensitive filtering, workflow
  success and partial failure, retry of only the failed stage, duplicate webhook
  idempotency, approval idempotency and version conflict, reject, send guards.
- **Contract** — response envelope shape, error mapping (no leaks), and route
  handlers returning the shared envelope.
- **Production adapters (mocked)** — HubSpot upsert, provider failure → `502`,
  rate limiting → `429`, log redaction.

Tests run in demo mode with credentials cleared, so they never touch a real
database or a paid API.

---

## Project structure

```text
src/
├── app/
│   ├── (dashboard)/            # Overview, leads, workbench, analytics, outbox, settings
│   └── api/                    # Route handlers (Node runtime)
├── components/                 # UI (navigation, dashboard, leads, settings, outbox…)
├── contracts/                  # Shared types, enums, Zod schemas, API envelope
├── data/                       # Deterministic seed
└── lib/
    ├── client/                 # API client + view-model mapping
    └── server/
        ├── cache/              # Redis KV, rate limiting, idempotency
        ├── db/                 # Drizzle schema + client
        ├── domain/             # scoring, risk, workflow, errors, response helpers
        ├── inngest/            # client + durable function
        ├── observability/      # context, logger, metrics, Sentry
        ├── providers/          # demo/ + production/ + registry & health
        ├── repositories/       # lead / settings / delivery (Postgres + memory)
        ├── services/           # lead, enrichment, settings, email, demo, outbox
        └── workflows/          # enrichment orchestrator
drizzle/                        # SQL migrations
docs/                           # runbook + architecture notes
```

---

## Security

- Secrets live in environment variables or write-only Settings fields; the API
  never returns them.
- Webhooks can be verified: HMAC-SHA256 (`X-SignalDesk-Signature`, constant-time)
  for inbound leads, Svix for Resend delivery events.
- Logs mask PII and redact secret-looking fields; error responses never include
  stack traces, prompts or provider keys.
- Rate limiting protects create, process, approve, reject, send and webhooks.
- Raw website content is treated as untrusted input and is not persisted beyond
  the derived evidence.

---

## Deployment

1. Provision PostgreSQL (e.g. Neon) and Upstash Redis; run `npm run db:migrate`.
2. Set the production environment variables (see the table above).
3. Deploy to a Next.js-compatible host (e.g. Vercel) and register the Inngest app
   at `POST /api/inngest`.
4. Point the Resend delivery webhook at `POST /api/webhooks/resend`.
5. Verify `GET /api/health` returns `status: ok` with all providers green.

Operational procedures (incident playbooks, rollback, provider setup) are in
[`docs/runbook.md`](docs/runbook.md).

---

## Roadmap & known limitations

- **Authentication / multi-tenancy** is out of scope for the MVP (single demo
  workspace).
- The demo outbox records `SIMULATED` deliveries; configure Resend in Settings for
  real delivery.
- Metrics are in-process per instance; forward the endpoint to your APM for
  fleet-wide aggregation.
- Research focuses on the most relevant pages discovered by Firecrawl (homepage +
  about/services/product/pricing); deeper crawling can be enabled per need.
- A UI view-model layer still maps canonical contracts to the component shape.

---

<p align="center"><sub>SignalDesk — built as a portfolio-grade Automation &amp; Growth Engineering project.</sub></p>
