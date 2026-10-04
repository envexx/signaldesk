# SignalDesk — Alur Sistem (Mermaid)

Dokumen ini menjelaskan alur backend SignalDesk sesuai implementasi saat ini
(Phase 1–4). Cocok dilihat di viewer Markdown yang mendukung Mermaid.

## 1. Arsitektur keseluruhan

```mermaid
flowchart LR
    subgraph Client["Frontend (Next.js)"]
        UI["Dashboard / Pipeline / Workbench"]
        STORE["ApiStoreProvider\nsrc/components/providers/api-store.tsx"]
        API_CLIENT["SignalDesk API client\nsrc/lib/client/signaldesk-api.ts"]
        UI --> STORE --> API_CLIENT
    end

    subgraph Edge["Inbound eksternal"]
        FORM["Landing / webinar form"]
    end

    subgraph Next["Next Route Handlers (Node runtime)"]
        R_DASH["GET /api/dashboard"]
        R_LEADS["GET|POST /api/leads"]
        R_LEAD["GET|PATCH /api/leads/{id}"]
        R_PROC["POST /api/leads/{id}/process"]
        R_APPROVE["POST /api/leads/{id}/approve"]
        R_REJECT["POST /api/leads/{id}/reject"]
        R_SEND["POST /api/leads/{id}/send"]
        R_WH["POST /api/webhooks/leads"]
        R_WH_R["POST /api/webhooks/resend"]
        R_HEALTH["GET /api/health"]
        R_METRICS["GET /api/metrics"]
        R_INNGEST["GET|POST|PUT /api/inngest"]
    end

    subgraph Core["Service & Domain layer"]
        LEAD_SVC["lead-service\n(CRUD, dashboard, idempotency)"]
        ENRICH_SVC["enrichment-service\n(process / approve / reject / send)"]
        SCORE["domain/scoring\n(ICP deterministik)"]
        RISK["domain/risk\n(risk flags)"]
    end

    subgraph Persist["Persistence"]
        REPO["LeadRepository"]
        PG[("PostgreSQL\n(Drizzle, 10 tabel)")]
        MEM[("In-memory demo\n(deterministic seed)")]
        KV[("Upstash Redis\nidempotency + rate limit")]
        REPO --> PG
        REPO --> MEM
    end

    subgraph Providers["Provider (demo ↔ production)"]
        RESEARCH["CompanyResearch\nFirecrawl / demo"]
        INTELL["LeadIntelligence\nDeepSeek / AI Gateway / demo"]
        EMAIL["EmailDelivery\nResend / demo"]
        CRM["CrmProvider\nHubSpot / webhook / demo"]
    end

    subgraph Durable["Inngest (durable workflow)"]
        FN["enrich-lead function"]
    end

    subgraph Obs["Observability"]
        LOG["Structured logs\n(correlation id, PII masking)"]
        SENTRY["Sentry (opsional)"]
    end

    API_CLIENT --> R_DASH & R_LEADS & R_LEAD & R_PROC & R_APPROVE & R_REJECT
    FORM --> R_WH
    R_WH_R --> LEAD_SVC

    R_DASH --> LEAD_SVC
    R_LEADS --> LEAD_SVC
    R_LEAD --> LEAD_SVC
    R_WH --> LEAD_SVC
    R_PROC --> ENRICH_SVC
    R_APPROVE --> ENRICH_SVC
    R_REJECT --> ENRICH_SVC
    R_SEND --> ENRICH_SVC
    R_HEALTH --> LEAD_SVC

    LEAD_SVC --> REPO
    LEAD_SVC --> KV
    ENRICH_SVC --> REPO
    ENRICH_SVC --> SCORE
    ENRICH_SVC --> RISK
    ENRICH_SVC --> RESEARCH & INTELL & EMAIL & CRM

    R_PROC -. "production" .-> FN
    FN --> ENRICH_SVC
    R_INNGEST --> FN

    LEAD_SVC --> LOG
    ENRICH_SVC --> LOG
    LOG --> SENTRY
```

## 2. Alur end-to-end sebuah lead

```mermaid
sequenceDiagram
    autonumber
    participant U as User (UI)
    participant API as Route Handler
    participant SVC as enrichment-service
    participant ING as Inngest
    participant WF as Workflow
    participant P as Providers
    participant DB as PostgreSQL

    U->>API: POST /api/leads (fullName, workEmail, companyWebsite)
    API->>DB: insert lead (status CAPTURED)
    API-->>U: 201 { data: Lead }

    U->>API: POST /api/leads/{id}/process
    alt Inngest aktif (production)
        API->>ING: send "signaldesk/lead.enrich" { leadId }
        API-->>U: 202 { jobId, completed:false }
        ING->>SVC: processLead(leadId)
    else Demo / dev server off (fallback)
        API->>SVC: processLead(leadId) sinkron
        API-->>U: 200 { ran, completed:true }
    end

    SVC->>WF: validate → research → extract → score → draft → review
    WF->>P: research (Firecrawl)
    WF->>P: extract + draft (DeepSeek / AI Gateway)
    WF->>WF: scoring deterministik (35/30/20/15)
    WF->>DB: simpan tiap tahap + timeline + evidence
    WF-->>SVC: status READY_FOR_REVIEW (atau FAILED + partial)

    loop Polling (frontend)
        U->>API: GET /api/leads/{id}
        API-->>U: status PROCESSING → ... → READY_FOR_REVIEW
    end

    U->>API: PATCH /api/leads/{id} (edit draft) → draft.version++
    U->>API: POST /api/leads/{id}/approve { confirm:true, version }
    API->>SVC: approveLead (guard: READY/APPROVED, version cocok, draft non-empty)
    SVC->>DB: status APPROVED, draft APPROVED (demo: tanpa kirim email)
    API-->>U: 200 { alreadyApproved:false }

    U->>API: POST /api/leads/{id}/send { confirm:true }
    alt Resend dikonfigurasi
        API->>P: send via Resend
        SVC->>DB: status SENT
        P-->>API: webhook Resend (delivered/bounced) → activity
    else Demo
        API-->>U: 503 DELIVERY_UNAVAILABLE
    end
```

## 3. State machine status lead

```mermaid
stateDiagram-v2
    [*] --> CAPTURED: POST /api/leads atau webhook
    CAPTURED --> PROCESSING: POST /process
    PROCESSING --> READY_FOR_REVIEW: semua tahap sukses
    PROCESSING --> FAILED: provider/validasi gagal (partial disimpan)
    FAILED --> PROCESSING: retry (resume tahap gagal)
    READY_FOR_REVIEW --> APPROVED: POST /approve (confirm + version)
    READY_FOR_REVIEW --> READY_FOR_REVIEW: reject → draft REJECTED
    APPROVED --> READY_FOR_REVIEW: edit draft pasca-approve
    APPROVED --> SENT: POST /send (production)
    SENT --> [*]
```

## 4. Tahapan workflow enrichment

```mermaid
flowchart LR
    C[captured] --> V[validate\nnormalisasi email/URL/domain]
    V --> R[research\nwebsite + about/product/pricing]
    R --> E[extract\nindustry, size, tech, pain, evidence]
    E --> S[score\nICP 35/30/20/15 → tier]
    S --> D[draft\ninbound-nurturing email]
    D --> RV[review\nmenunggu approval manusia]
    RV --> A[approve]
    A --> SND[send]

    R -. "gagal" .-> F[FAILED + error code stabil]
    E -. "gagal" .-> F
    D -. "gagal" .-> F
    F -. "retry hanya tahap gagal" .-> R
```

## 5. Idempotency, retry, dan mode

```mermaid
flowchart TD
    WH["POST /api/webhooks/leads\n+ Idempotency-Key"] --> LOOK{"Key sudah ada?"}
    LOOK -->|Redis| DUP["kembalikan lead yang sama\n200 duplicate:true"]
    LOOK -->|DB unique| DUP
    LOOK -->|baru| CREATE["create lead\n202 duplicate:false"]

    PROC["POST /process"] --> MODE{"APP_MODE"}
    MODE -->|production + Inngest| ASYNC["202 async (durable)"]
    MODE -->|demo / fallback| SYNC["200 sinkron"]
    ASYNC --> RUN["workflow"]
    SYNC --> RUN
    RUN --> STEP{"tahap sukses?"}
    STEP -->|gagal| FAIL["status FAILED\npartial disimpan"]
    FAIL --> RETRY["retry / {force:true}"]
    STEP -->|sukses| READY["READY_FOR_REVIEW"]

    DEMO["APP_MODE=demo"] --> DEMOP["provider deterministik"]
    PROD["APP_MODE=production"] --> PRODP["provider nyata bila credential ada\nelse fallback per-provider ke demo"]
```
