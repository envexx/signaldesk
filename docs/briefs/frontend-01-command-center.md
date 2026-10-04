# Frontend Brief 01 — Lead Intelligence Command Center

## Tujuan

Membangun fondasi visual aplikasi dan dua layar operasional utama: dashboard ringkasan dan pipeline lead. Hasilnya harus langsung menjelaskan nilai produk kepada recruiter atau calon klien tanpa perlu membaca dokumentasi panjang.

## Pengguna utama

- Growth Lead yang memantau kualitas dan kecepatan penanganan lead.
- SDR/Sales yang menentukan lead mana yang harus ditindaklanjuti terlebih dahulu.
- Hiring manager yang sedang menilai kualitas portfolio Automation & Growth Engineer.

## Rute yang dimiliki

- `/` — dashboard overview.
- `/leads` — daftar dan filter seluruh lead.

## Ruang lingkup

### 1. Application shell

- Sidebar desktop dan navigation drawer pada mobile.
- Brand produk: **SignalDesk**.
- Navigasi: Overview, Leads, New enrichment, Automations, Analytics, Settings.
- Tombol utama `Enrich new lead` mengarah ke `/leads/new`.
- Status environment `Demo workspace` terlihat tetapi tidak dominan.

### 2. Dashboard overview

- Greeting dan ringkasan aktivitas hari ini.
- KPI cards:
  - Total inbound leads.
  - High-priority leads.
  - Median enrichment time.
  - Drafts awaiting approval.
- Panel `Priority queue` berisi lead terpenting dengan skor, tier, company, contact, dan age.
- Visual funnel sederhana dari Captured → Enriched → Qualified → Approved.
- Panel `Automation health` berisi status webhook, enrichment, AI drafting, dan email delivery.
- Activity feed yang menampilkan event pipeline terbaru.

### 3. Leads pipeline

- Search berdasarkan nama, company, atau email.
- Filter tier dan status.
- Tabel responsif dengan kolom Lead, Company, ICP score, Tier, Stage, Last activity, dan CTA.
- Klik row atau CTA membuka `/leads/[id]`.
- Empty state dan loading skeleton.

## Arah visual

- Tampilan SaaS operasional yang matang, bukan template admin generik.
- Palet: warm off-white, ink/navy, aksen lime, serta warna status amber/red/green.
- Tipografi: sans-serif bersih untuk UI dengan display serif secukupnya pada heading besar.
- Kartu memakai border tipis, radius medium, bayangan sangat halus, dan whitespace yang lega.
- Data density cukup tinggi di desktop tetapi tetap terbaca pada mobile.
- Hindari gradient berlebihan, glassmorphism, dan dekorasi yang tidak memiliki fungsi.

## Kontrak data yang dikonsumsi

- `GET /api/dashboard`
- `GET /api/leads?q=&tier=&status=`

Semua waktu diterima sebagai ISO string. Frontend tidak mengasumsikan `Date`, class instance, atau struktur non-serializable.

## State wajib

- Loading.
- Loaded.
- Empty result.
- Recoverable error dengan tombol `Try again`.
- Filter aktif harus terlihat dan mudah di-reset.

## Accessibility dan responsivitas

- Semua kontrol memiliki accessible name dan focus state yang jelas.
- Warna bukan satu-satunya pembeda status.
- Target klik minimum 40px.
- Layout diuji minimal pada 390px, 768px, 1280px, dan 1440px.
- Tabel berubah menjadi card list yang tetap informatif pada layar kecil.

## Batas kepemilikan implementasi

Agent frontend boleh mengubah:

- `src/app/(dashboard)/page.tsx`
- `src/app/(dashboard)/leads/page.tsx`
- `src/components/navigation/**`
- `src/components/dashboard/**`
- `src/components/leads/lead-list*`
- `src/components/ui/**`
- `src/app/globals.css`

Agent frontend tidak mengubah route handler di `src/app/api/**` atau implementasi server di `src/lib/server/**`.

## Acceptance criteria

- Dashboard dan pipeline dapat digunakan dengan data API yang tersedia.
- Navigasi aktif, search, filter, reset, dan tautan detail bekerja.
- Tidak ada horizontal overflow pada viewport mobile.
- Terdapat loading, empty, dan error state.
- UI terasa konsisten dan siap dipresentasikan sebagai portfolio.

