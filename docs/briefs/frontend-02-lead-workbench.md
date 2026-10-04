# Frontend Brief 02 — Lead Enrichment & Approval Workbench

## Tujuan

Membangun pengalaman end-to-end untuk memasukkan lead, melihat proses enrichment, meninjau bukti, mengedit draf email, dan memberi approval. Halaman ini adalah pusat demonstrasi nilai produk.

## Rute yang dimiliki

- `/leads/new` — form dan simulasi enrichment.
- `/leads/[id]` — lead intelligence detail dan approval workbench.

## Ruang lingkup

### 1. New enrichment

- Field: full name, work email, company website, dan optional role.
- Validasi inline untuk email serta URL.
- Penjelasan singkat bahwa data dipakai untuk demo enrichment.
- Submit ke `POST /api/leads`.
- Setelah berhasil, panggil `POST /api/leads/{id}/process` lalu arahkan ke detail lead.
- Loading state menjelaskan tahap yang sedang dikerjakan tanpa memberikan progress palsu.

### 2. Lead detail header

- Identitas contact dan company.
- ICP score besar dan qualification tier.
- Stage, source, created time, dan processing duration.
- Primary actions: `Approve draft`, `Request rewrite`, dan `Reject`.

### 3. Evidence-backed company intelligence

- Ringkasan perusahaan.
- Industry, estimated size, business model, location, dan detected technologies.
- Pain points yang ditemukan.
- Setiap insight penting menampilkan source URL atau label `AI inference`.
- Confidence ditampilkan sebagai High, Medium, atau Low; hindari angka presisi palsu.

### 4. ICP reasoning

- Breakdown kriteria: company fit, problem fit, buying signal, dan data confidence.
- Skor total dan alasan penentuan tier.
- Flag risiko seperti free email, website tidak dapat diakses, atau data tidak lengkap.

### 5. Draft composer

- Subject dan body dapat diedit.
- Personalization tokens terlihat tetapi tidak mengganggu.
- Preview desktop yang menyerupai email sebenarnya.
- Unsaved state terlihat.
- Approval memerlukan konfirmasi di dalam UI dan memanggil API.
- Jika demo mode aktif, status berubah menjadi `Approved` tanpa benar-benar mengirim email eksternal.

### 6. Workflow timeline

- Captured → Validated → Website researched → Scored → Drafted → Awaiting approval → Approved/Sent.
- Setiap step menampilkan status, timestamp, duration, serta error/retry bila ada.

## Kontrak API

- `POST /api/leads`
- `GET /api/leads/{id}`
- `POST /api/leads/{id}/process`
- `PATCH /api/leads/{id}` untuk menyimpan perubahan draft.
- `POST /api/leads/{id}/approve`

Response error menggunakan bentuk konsisten:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "fields": {}
  }
}
```

## Prinsip UX penting

- Jangan menyebut enrichment sebagai fakta apabila sumbernya hanya inferensi AI.
- Approval manusia adalah default sebelum email dikirim.
- Free-email lead tidak otomatis dibuang; tampilkan sebagai risk flag.
- Jika proses gagal sebagian, hasil yang sudah tersedia tetap ditampilkan dan user dapat retry.
- Jangan membuat progress bar berbasis persen jika backend tidak memberikan progress aktual.

## Batas kepemilikan implementasi

Agent frontend boleh mengubah:

- `src/app/(dashboard)/leads/new/**`
- `src/app/(dashboard)/leads/[id]/**`
- `src/components/leads/lead-form*`
- `src/components/leads/lead-workbench*`
- `src/components/leads/draft-composer*`
- `src/components/workflow/**`

Agent frontend tidak mengubah route handler di `src/app/api/**` atau implementasi server di `src/lib/server/**`.

## Acceptance criteria

- Lead baru dapat dibuat, diproses, lalu dibuka pada halaman detail.
- Detail menampilkan intelligence, evidence, scoring, draft, dan timeline.
- Draft dapat diedit dan disimpan.
- Approval memperbarui status dan memberikan feedback yang jelas.
- Error parsial dan retry state tidak merusak seluruh halaman.
- Seluruh flow dapat didemokan tanpa API key eksternal.

