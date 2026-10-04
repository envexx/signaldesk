# SignalDesk Production Runbook

Panduan operasi backend untuk mode produksi (Phase 3 & 4). Demo mode tidak
membutuhkan apa pun di dokumen ini.

## 1. Arsitektur runtime

```
Webhook form ─┐
Frontend ─────┼─> Route Handler (Node runtime)
              │        │
              │        ├─ Lead Service ──> Repository (Postgres / in-memory)
              │        ├─ Rate limit + idempotency (Upstash Redis)
              │        └─ Inngest event ──> enrich-lead function
              │                                   │
              │                                   ├─ Firecrawl research
              │                                   ├─ AI Gateway extraction + draft
              │                                   └─ Deterministic ICP scoring
              └─ Approval ─> Send ─> Resend ─> Resend webhook
```

Provider dipilih otomatis dari environment. Bila credential hilang, pipeline
turun ke adapter demo yang deterministik dan tidak mengirim email.

## 2. Environment produksi

| Variable | Wajib | Fungsi |
|---|---|---|
| `APP_MODE=production` | ya | Mengaktifkan adapter produksi. |
| `DATABASE_URL` | ya | PostgreSQL (Neon). Tanpa ini → repository in-memory. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | disarankan | Idempotency lintas-instance + rate limit. |
| `INNGEST_EVENT_KEY` | disarankan | Mengaktifkan workflow durable (endpoint process → 202). |
| `INNGEST_SIGNING_KEY` | disarankan | Verifikasi serve endpoint `/api/inngest`. |
| `FIRECRAWL_API_KEY` | ya* | Company research. |
| `AI_GATEWAY_API_KEY` | ya* | Vercel AI Gateway untuk structured extraction + drafting. |
| `AI_MODEL` | disarankan | Model id, mis. `openai/gpt-4o-mini`. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | ya* | Email delivery. |
| `RESEND_WEBHOOK_SECRET` | ya* | Verifikasi webhook Resend (Svix). |
| `HUBSPOT_ACCESS_TOKEN` | opsional | CRM sync (fallback: `CRM_WEBHOOK_URL`). |
| `WEBHOOK_SIGNING_SECRET` | disarankan | HMAC `X-SignalDesk-Signature` untuk webhook inbound. |
| `SENTRY_DSN` | opsional | Error monitoring. |

\* Jika hilang, provider terkait memakai adapter demo (tidak ada call eksternal).

## 3. Migrasi database

```bash
# menghasilkan SQL dari schema
npm run db:generate

# menerapkan ke DATABASE_URL
DATABASE_URL=postgres://... npm run db:migrate
```

Migrasi awal ada di `drizzle/0000_white_magma.sql` (10 tabel). Jalankan
migrasi sebelum deploy pertama dan setiap kali schema berubah.

## 4. Inngest

1. Daftarkan aplikasi `signaldesk` di Inngest.
2. Set `INNGEST_EVENT_KEY` dan `INNGEST_SIGNING_KEY`.
3. Sync endpoint `POST /api/inngest` (Inngest serve handler).
4. Saat aktif, `POST /api/leads/{id}/process` merespons `202` dengan `meta.jobId`
   dan `meta.completed=false`; frontend melakukan polling `GET /api/leads/{id}`.

Function: `enrich-lead` (`signaldesk/lead.enrich`), concurrency 5, retries 2.

## 5. Webhook

- **Inbound lead** `POST /api/webhooks/leads`: header `Idempotency-Key`; bila
  `WEBHOOK_SIGNING_SECRET` diisi, wajib `X-SignalDesk-Signature` (HMAC-SHA256,
  constant-time). Balasan `202` (baru) / `200` (duplikat).
- **Resend delivery** `POST /api/webhooks/resend`: diverifikasi via Svix
  (`RESEND_WEBHOOK_SECRET`). Event `email.delivered` / `email.bounced` /
  `email.complained` dicatat sebagai activity; leadId diambil dari tag `leadId`
  yang dikirim saat send.

## 6. Rate limit

Fixed-window per IP per bucket (Redis bila dikonfigurasi, in-memory bila tidak):

| Bucket | Limit |
|---|---|
| `leads:create` | 30 / menit |
| `leads:list` | 120 / menit |
| `leads:get` | 240 / menit |
| `leads:update` | 60 / menit |
| `process` | 60 / menit |
| `approve` | 60 / menit |
| `send` | 30 / menit |
| `webhook:leads` | 120 / menit |

Melampaui limit → `429 RATE_LIMITED`.

## 7. Observability

- Log terstruktur JSON satu baris dengan `requestId`, `leadId`, `workflowRunId`,
  `stepKey`, `provider`, `durationMs`, `outcome`, `errorCode`.
- Email dimasking, field rahasia di-`[redacted]`.
- Correlation id diambil dari header `x-request-id` / `x-correlation-id` atau
  dibuat otomatis.
- `SENTRY_DSN` mengaktifkan `@sentry/node` (diinisialisasi via
  `instrumentation.ts`); kegagalan monitoring tidak pernah menggagalkan request.

## 8. Playbook insiden

**Enrichment gagal (`status=FAILED`)**
1. Lihat `workflow.steps` untuk `errorCode` (mis. `RESEARCH_FAILED`,
   `EXTRACTION_INVALID`, `DRAFT_INVALID`).
2. Cek provider di `/api/health` (`providers[].mode`, `credentialsPresent`).
3. Retry: `POST /api/leads/{id}/process` (resume dari step gagal) atau
   `{ "force": true }` untuk mengulang semua step.

**Webhook duplikat**
Pastikan pengirim mengirim `Idempotency-Key` stabil. Redis menyimpan idempotency
selama 7 hari; DB `leads.idempotency_key` adalah sumber kebenaran.

**Email tidak terkirim**
Demo mode selalu menolak (`503 DELIVERY_UNAVAILABLE`). Di produksi, pastikan
`RESEND_API_KEY` + `RESEND_FROM_EMAIL` terisi dan lead berstatus `APPROVED`.

**Database down**
Health `leadCount` gagal → repository error. Perbaiki `DATABASE_URL`. Jangan
fallback diam-diam ke in-memory untuk data produksi.

## 9. Rollback

1. Set `APP_MODE=demo` untuk menghentikan call eksternal segera.
2. Rollback deploy sebelumnya.
3. Migrasi bersifat aditif; hindari drop kolom tanpa backup.
