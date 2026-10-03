// Modular prompt composer for custom PRD generation.
// Pure, deterministic, side-effect free.
// Each block has a single canonical instruction merged across modes; split into per-mode variants when granularity needed.

import { BLOCK_LINKS, getChapterBlock, MAX_CUSTOM_BLOCKS } from "../shared/chapterBlocks";

// ---------------------------------------------------------------------------
// Per-block canonical instructions (adapted from server/prompts.ts)
// ---------------------------------------------------------------------------

type Lang = "en" | "id";

interface BlockInstruction {
  en: string;
  id: string;
}

// Each entry adapts prose from business/simple/technical variants into a single
// canonical rich instruction per block. Heading numbering is NOT included here.
const BLOCK_INSTRUCTIONS: Record<string, BlockInstruction> = {
  overview: {
    en: `**Executive Summary & Value Proposition**
- Open with a concise product vision paragraph (2-3 sentences) and core objectives (3-5 bullet points).
- Define target users clearly (primary / secondary) and the unique value proposition.
- Include a Stakeholder Analysis table with columns: Stakeholder | Role | Interest | Influence (High/Medium/Low) | Engagement Strategy — minimum 4 stakeholders.`,
    id: `**Ringkasan Eksekutif & Proposisi Nilai**
- Buka dengan paragraf visi produk ringkas (2-3 kalimat) dan tujuan inti (3-5 poin bullet).
- Definisikan pengguna target dengan jelas (primer / sekunder) dan proposisi nilai unik.
- Sertakan tabel Analisis Stakeholder dengan kolom: Stakeholder | Peran | Kepentingan | Pengaruh (Tinggi/Sedang/Rendah) | Strategi Pelibatan — minimal 4 stakeholder.`,
  },
  "problem-market": {
    en: `**Problem Definition & Market Analysis**
- Start with a formal Problem Statement in one sentence: "[Target user] needs [need] because [insight]."
- List exactly 5 specific, concrete user problems.
- Provide a Competitor analysis with minimum 3 real or hypothetical competitors (name, strengths, weaknesses, positioning).
- Include an estimated TAM/SAM/SOM breakdown with concrete figures and assumptions.
- Include an Assumptions & Constraints table with columns: Assumption | Impact if Wrong | Validation Plan — covering technology assumptions, business assumptions, and user behavior assumptions.`,
    id: `**Definisi Masalah & Analisis Pasar**
- Mulai dengan Pernyataan Masalah formal satu kalimat: "[Pengguna target] membutuhkan [kebutuhan] karena [insight]."
- Daftar tepat 5 masalah pengguna yang spesifik dan konkret.
- Sediakan analisis Kompetitor minimal 3 kompetitor nyata atau hipotetis (nama, kekuatan, kelemahan, positioning).
- Sertakan rincian estimasi TAM/SAM/SOM dengan angka konkret dan asumsi.
- Sertakan tabel Asumsi & Batasan dengan kolom: Asumsi | Dampak Jika Salah | Rencana Validasi — mencakup asumsi teknologi, bisnis, dan perilaku pengguna.`,
  },
  "feature-scope": {
    en: `**Solution Overview & Scope (MoSCoW)**
- Group features clearly by Must-have, Should-have, Could-have, Won't-have (MoSCoW).
- For MoSCoW, use EXACTLY this structure: a category heading line **Must-have**, then **Should-have**, **Could-have**, **Won't-have** (in that order), each followed IMMEDIATELY by a Markdown table with header \`| Feature | Description |\` and one table row per feature.
- Each table row = EXACTLY ONE feature. The Feature cell contains a short, specific feature name (e.g. "User Registration"), NOT a long description and NOT multiple features.
- STRICTLY FORBIDDEN: merging two features into a single cell, mixing multiple categories inside one table, or using a single MoSCoW table with a Priority column.
- Right after the MoSCoW grouping, add a Heading 3 section named exactly "### Feature Breakdown (WBS)" containing nested Markdown bullet levels:
    - Level 1 (no indent or "- "): Feature Module / Epic — bold name, e.g. "- **Customer Account**"
    - Level 2 (indent 2 spaces): Feature — e.g. "  - User Registration"
    - Level 3 (indent 4 spaces): Sub-feature — e.g. "    - Email verification"
- EVERY feature listed in the MoSCoW tables MUST appear exactly once as a Level-2 item in this breakdown (same name, verbatim). No extra features outside the MoSCoW lists.
- Recommend 2-5 sub-features per feature.
- STRICTLY FORBIDDEN: mixing sub-features at Level 2, nesting deeper than Level 3, or omitting a MoSCoW feature from the breakdown.`,
    id: `**Ringkasan Solusi & Cakupan (MoSCoW)**
- Kelompokkan fitur dengan jelas berdasarkan Must-have, Should-have, Could-have, Won't-have (MoSCoW).
- Untuk MoSCoW, gunakan TEPAT struktur ini: baris judul kategori **Must-have**, lalu **Should-have**, **Could-have**, **Won't-have** (sesuai urutan), masing-masing langsung diikuti tabel Markdown dengan header \`| Feature | Description |\` dan satu baris tabel per fitur.
- Setiap baris tabel = TEPAT SATU fitur. Sel Feature berisi nama fitur singkat dan spesifik (mis. "Registrasi Pengguna"), BUKAN deskripsi panjang dan BUKAN beberapa fitur sekaligus.
- DILARANG: menggabungkan dua fitur dalam satu sel, mencampur beberapa kategori dalam satu tabel, atau menggunakan satu tabel MoSCoW dengan kolom Priority.
- Tepat SETELAH pengelompokan MoSCoW, tambahkan section Heading 3 dengan nama persis "### Feature Breakdown (WBS)" yang berisi level bullet Markdown bersarang:
    - Level 1 (tanpa indent atau "- "): Modul Fitur / Epic — nama tebal, mis. "- **Akun Pelanggan**"
    - Level 2 (indent 2 spasi): Fitur — mis. "  - Registrasi Pengguna"
    - Level 3 (indent 4 spasi): Sub-fitur — mis. "    - Verifikasi email"
- SETIAP fitur yang tercantum di tabel MoSCoW HARUS muncul tepat satu kali sebagai item Level 2 di breakdown ini (nama sama, verbatim). Tidak ada fitur tambahan di luar daftar MoSCoW.
- Rekomendasikan 2-5 sub-fitur per fitur.
- DILARANG KERAS: mencampur sub-fitur di Level 2, nesting lebih dalam dari Level 3, atau menghilangkan fitur MoSCoW dari breakdown.`,
  },
  "out-of-scope": {
    en: `**Out of Scope Rules & Boundaries**
- Create a table with columns: Item | Reason Excluded | Boundary Rule | Revisit Condition — minimum 4 items that are intentionally NOT being built in this phase.
- Each item MUST have: (1) a clear boundary rule specifying the condition under which it would be reconsidered, (2) a brief rationale for why it is excluded now, (3) a revisit condition (e.g. "after 1000 active users" or "after Phase 2 funding").
- This is a standalone chapter — give it the attention it deserves; be explicit and actionable.`,
    id: `**Aturan Batas di Luar Cakupan**
- Buat tabel dengan kolom: Item | Alasan Dikeluarkan | Boundary Rule | Kondisi Revisit — minimal 4 item yang sengaja TIDAK dibangun pada fase ini.
- Setiap item HARUS memiliki: (1) aturan batas yang jelas menentukan kondisi kapan akan dipertimbangkan kembali, (2) alasan singkat mengapa dikecualikan sekarang, (3) kondisi revisit (mis. "setelah 1000 pengguna aktif" atau "setelah pendanaan Fase 2").
- Ini adalah chapter mandiri — berikan perhatian penuh; bersikap eksplisit dan actionable.`,
  },
  "feature-spec": {
    en: `**Feature Specification & Logic**
- For EACH Must-have feature (or each key feature if MoSCoW not present), provide a thorough feature specification with these sub-sections:
  * Feature ID (FEAT-01, FEAT-02, etc.) as Heading 3: \`### FEAT-01. <Feature Name>\` — number sequentially with NO gaps.
  * Purpose — why this feature exists (1-2 sentences)
  * Display Condition — when this feature appears in the UI
  * Input Fields — table with columns: Field | Type | Required? | Validation | Additional Logic
  * Flow / Steps — numbered steps from user action to completion (minimum 4 steps)
  * Business Logic — business rules, state machines, calculations, edge cases
  * Error States — table with columns: Scenario | Error Message | Frontend Action (minimum 3 scenarios)
  * Loading States — table with columns: Scenario | Display / Feedback
  * Integration — table with columns: Related Feature | Integration Type`,
    id: `**Spesifikasi Fitur & Logika**
- Untuk SETIAP fitur Must-have (atau setiap fitur kunci jika MoSCoW tidak ada), sediakan spesifikasi fitur menyeluruh dengan sub-bagian berikut:
  * Feature ID (FEAT-01, FEAT-02, dst.) sebagai Heading 3: \`### FEAT-01. <Nama Fitur>\` — penomoran berurutan tanpa celah.
  * Tujuan — mengapa fitur ini ada (1-2 kalimat)
  * Kondisi Tampil — kapan fitur ini muncul di UI
  * Input Fields — tabel dengan kolom: Field | Tipe | Wajib? | Validasi | Logic Tambahan
  * Flow / Alur — langkah bernomor dari aksi pengguna hingga selesai (minimal 4 langkah)
  * Logika Bisnis — aturan bisnis, state machine, kalkulasi, edge case
  * Error States — tabel dengan kolom: Skenario | Pesan Error | Aksi Frontend (minimal 3 skenario)
  * Loading States — tabel dengan kolom: Skenario | Tampilan / Feedback
  * Integrasi — tabel dengan kolom: Fitur Terkait | Bentuk Integrasi`,
  },
  "user-stories": {
    en: `**User Stories & Acceptance Criteria**
- Include an Epic hierarchy overview before the stories (group stories by epic/theme).
- Use a structured table format with columns: ID | Persona | User Story | Priority (Must/Should/Could) | Acceptance Criteria (in Given/When/Then format) | Effort Estimate.
- Create EXACTLY 3 personas, each with 2 stories (6 total).
- Separate stories only with ordinary table rows — do NOT insert any separator line (---, ***, ___) inside the table.
- In Acceptance Criteria cells, separate Given/When/Then clauses with spaces or punctuation (e.g. "Given X, When Y, then Z") — STRICTLY FORBIDDEN: any HTML tags including <br> in any table cell; output pure Markdown only.`,
    id: `**User Story & Kriteria Penerimaan**
- Sertakan gambaran hierarki Epic sebelum story (kelompokkan story berdasarkan epic/tema).
- Gunakan format tabel terstruktur dengan kolom: ID | Persona | User Story | Priority (Must/Should/Could) | Acceptance Criteria (format Given/When/Then) | Effort Estimate.
- Buat TEPAT 3 persona, masing-masing dengan 2 story (total 6).
- Pisahkan story hanya dengan baris tabel biasa — JANGAN menyisipkan garis pemisah (---, ***, ___) di dalam tabel.
- Di sel Acceptance Criteria, pisahkan klausa Given/When/Then dengan spasi atau tanda baca (mis. "Given X, When Y, then Z") — DILARANG KERAS: tag HTML apa pun termasuk <br> di sel tabel; output hanya Markdown murni.`,
  },
  "ux-journey": {
    en: `**UX Design, User Journey & Wireframe Flow**
- Describe UX principles (2-3 paragraphs) and key design decisions.
- Include a User Journey diagram using Mermaid journey syntax (\`\`\`mermaid journey) mapping the user's complete flow from discovery to retention, highlighting pain points and opportunities.
- Describe wireframe flows and key screen layouts (list 4-6 key screens with purpose and key elements).
- Mermaid rules: use "Title: Task" format for journey; never use parentheses in edge labels; wrap node labels containing special characters in double quotes.`,
    id: `**Desain UX, Perjalanan Pengguna & Alur Wireframe**
- Jelaskan prinsip UX (2-3 paragraf) dan keputusan desain kunci.
- Sertakan diagram User Journey menggunakan sintaks Mermaid journey (\`\`\`mermaid journey) yang memetakan alur lengkap pengguna dari discovery hingga retention, soroti pain point dan peluang.
- Jelaskan alur wireframe dan tata letak layar kunci (daftar 4-6 layar kunci beserta tujuan dan elemen utamanya).
- Aturan Mermaid: gunakan format "Title: Task" untuk journey; jangan gunakan tanda kurung di edge label; bungkus label node yang mengandung karakter khusus dengan tanda kutip ganda.`,
  },
  architecture: {
    en: `**High-Level Technical Architecture**
- Present the high-level system architecture, tech stack decisions, and alternatives considered for key architectural choices.
- Include a System Context Diagram using Mermaid graph syntax (\`\`\`mermaid graph TD) showing how the system fits into the broader landscape: users, external services, and integrations.
- Describe the main external interfaces (clients, third-party services) in prose only; do NOT list endpoints or payloads here, API Contracts owns that detail.
- Mermaid graph rules: wrap node labels containing parentheses, commas, or special characters in double quotes; never use parentheses in edge labels (|...|).`,
    id: `**Arsitektur Teknis Tingkat Tinggi**
- Sajikan arsitektur sistem tingkat tinggi, keputusan tech stack, dan alternatif yang dipertimbangkan untuk pilihan arsitektur kunci.
- Sertakan Diagram Konteks Sistem menggunakan sintaks Mermaid graph (\`\`\`mermaid graph TD) yang menunjukkan bagaimana sistem cocok dalam lanskap yang lebih luas: pengguna, layanan eksternal, dan integrasi.
- Jelaskan antarmuka eksternal utama (klien, layanan pihak ketiga) hanya dalam prosa; JANGAN daftar endpoint atau payload di sini, detailnya milik Kontrak API.
- Aturan Mermaid graph: bungkus label node yang mengandung tanda kurung, koma, atau karakter khusus dengan tanda kutip ganda; jangan gunakan tanda kurung di edge label (|...|).`,
  },
  "data-models": {
    en: `**Data Models & Database Schema**
- Specify database entities with detailed tables indicating Column Name, Data Type (ORM specific), Relations (1:N, M:N), Constraints (Nullable, Unique), and Indexes.
- Include relations, constraints, and indexes for each entity.
- Include an Entity Relationship Diagram (ERD) using Mermaid erDiagram syntax (\`\`\`mermaid erDiagram) showing relationships between all tables (use "Entity" ||--|| "Entity" syntax, keep entity names simple without special characters).`,
    id: `**Model Data & Skema Basis Data**
- Tentukan entitas basis data dengan tabel rinci yang menunjukkan Column Name, Data Type (spesifik ORM), Relations (1:N, M:N), Constraints (Nullable, Unique), dan Indexes.
- Sertakan relasi, constraint, dan indeks untuk setiap entitas.
- Sertakan Entity Relationship Diagram (ERD) menggunakan sintaks Mermaid erDiagram (\`\`\`mermaid erDiagram) yang menunjukkan relasi antar semua tabel (gunakan sintaks "Entity" ||--|| "Entity", jaga nama entitas sederhana tanpa karakter khusus).`,
  },
  "api-contracts": {
    en: `**API Contracts & Interfaces**
- Document REST endpoints with literal JSON request/response payloads.
- For at least 5 core endpoints, include literal JSON block examples for Request and Response payloads (\`\`\`json).
- For EACH endpoint, also include error responses with example JSON payloads: 400 (Validation Error), 401/403 (Auth Error), 404 (Not Found), 409 (Conflict), 500 (Server Error) — use JSON code blocks.
- Include a per-endpoint table or inline note documenting authentication requirements (e.g. Bearer JWT, API key, public).
- Use Markdown tables to summarize endpoints where helpful.`,
    id: `**Kontrak API & Antarmuka**
- Dokumentasikan endpoint REST dengan contoh literal payload JSON request/response.
- Untuk minimal 5 endpoint inti, sertakan contoh literal blok JSON untuk payload Request dan Response (\`\`\`json).
- Untuk SETIAP endpoint, sertakan juga respons error dengan contoh payload JSON: 400 (Validation Error), 401/403 (Auth Error), 404 (Not Found), 409 (Conflict), 500 (Server Error) — gunakan blok kode JSON.
- Sertakan tabel per-endpoint atau catatan inline yang mendokumentasikan kebutuhan autentikasi (mis. Bearer JWT, API key, public).
- Gunakan tabel Markdown untuk merangkum endpoint jika membantu.`,
  },
  "frontend-arch": {
    en: `**Frontend Component Architecture & State Management**
- Define UI component hierarchies (tree/bullet list), URL Routing paths (table: Path | Component | Auth Required), and State Management logic (e.g. Redux, Zustand, Contexts).
- Include a data flow diagram using Mermaid sequenceDiagram syntax (\`\`\`mermaid sequenceDiagram) showing interactions between components, state, and API.
- Include lazy loading strategy for route-based code splitting (which routes are lazy-loaded, fallback UI).
- Keep component names simple identifiers; wrap message text with quotes if it contains special characters.`,
    id: `**Arsitektur Komponen Frontend & Manajemen State**
- Definisikan hierarki komponen UI (tree/bullet), path URL Routing (tabel: Path | Komponen | Butuh Auth), dan logika State Management (mis. Redux, Zustand, Context).
- Sertakan diagram alur data menggunakan sintaks Mermaid sequenceDiagram (\`\`\`mermaid sequenceDiagram) yang menunjukkan interaksi antar komponen, state, dan API.
- Sertakan strategi lazy loading untuk code splitting berbasis route (route mana yang di-lazy-load, fallback UI).
- Jaga nama komponen tetap identifier sederhana; bungkus teks pesan dengan tanda kutip jika mengandung karakter khusus.`,
  },
  nfr: {
    en: `**Non-Functional Requirements**
- Provide exact numbers (e.g. "99.99% Uptime", "< 200ms Latency").
- Classify NFRs into clear sub-categories: Performance, Scalability, Security, Usability, Availability.
- For each NFR, include the Measurement Method and Target Value in a table with columns: Category | Requirement | Target Value | Measurement Method.
- Cover at least one requirement per sub-category.`,
    id: `**Persyaratan Non-Fungsional**
- Berikan angka eksak (mis. "99.99% Uptime", "< 200ms Latency").
- Klasifikasikan NFR ke dalam sub-kategori yang jelas: Performance, Scalability, Security, Usability, Availability.
- Untuk setiap NFR, sertakan Measurement Method dan Target Value dalam tabel dengan kolom: Kategori | Requirement | Target Value | Measurement Method.
- Cakup minimal satu requirement per sub-kategori.`,
  },
  "success-metrics": {
    en: `**Success Metrics & Business KPIs**
- Define business KPIs such as MRR, churn, conversion rate, active users, retention.
- Use a Markdown Table with columns: Metric | Baseline | Target | How to Measure / Tracking Plan — minimum 4 metrics.
- Include financial KPIs where relevant and specify measurement cadence.`,
    id: `**Metrik Keberhasilan & KPI Bisnis**
- Definisikan KPI bisnis seperti MRR, churn, conversion rate, active users, retention.
- Gunakan Tabel Markdown dengan kolom: Metric | Baseline | Target | How to Measure / Tracking Plan — minimal 4 metrik.
- Sertakan KPI finansial jika relevan dan tentukan cadence pengukuran.`,
  },
  gtm: {
    en: `**Go-to-Market Strategy & Monetization**
- Cover launch strategy, pricing model, monetization, channel plan, and projected ROI estimates.
- Use Markdown Tables to structure GTM ROI estimates and channel plans.
- Include at least pricing tiers and go-to-market phases.`,
    id: `**Strategi Go-to-Market & Monetisasi**
- Cakup strategi peluncuran, model pricing, monetisasi, rencana kanal, dan estimasi proyeksi ROI.
- Gunakan Tabel Markdown untuk menyusun estimasi ROI GTM dan rencana kanal.
- Sertakan minimal tier pricing dan fase go-to-market.`,
  },
  risks: {
    en: `**Risk Register & Mitigation**
- Maintain a risk register with columns: Risk | Probability (High/Medium/Low) | Impact (High/Medium/Low) | Risk Score | Mitigation Strategy | Owner — minimum 4 risks.
- Score probability and impact explicitly; include ownership for each mitigation.`,
    id: `**Register Risiko & Mitigasi**
- Simpan register risiko dengan kolom: Risk | Probability (High/Medium/Low) | Impact (High/Medium/Low) | Risk Score | Strategi Mitigasi | Owner — minimal 4 risiko.
- Beri skor probabilitas dan dampak secara eksplisit; sertakan ownership untuk setiap mitigasi.`,
  },
  timeline: {
    en: `**Project Timeline & Roadmap**
- Break the roadmap into weekly sprints or phased milestones.
- Include a Gantt chart using Mermaid gantt syntax (\`\`\`mermaid gantt) showing the roadmap with weekly sprints, milestones, dependencies, and key deliverables.
- Use date format YYYY-MM-DD and plain text section titles; ensure dependencies are visualized.
- Also provide a summary table of milestones (Milestone | Timeline | Key Deliverables).`,
    id: `**Linimasa Proyek & Roadmap**
- Pecah roadmap menjadi sprint mingguan atau milestone bertahap.
- Sertakan diagram Gantt menggunakan sintaks Mermaid gantt (\`\`\`mermaid gantt) yang menunjukkan roadmap dengan sprint mingguan, milestone, dependensi, dan deliverable kunci.
- Gunakan format tanggal YYYY-MM-DD dan judul section teks polos; pastikan dependensi divisualisasikan.
- Sertakan juga tabel ringkasan milestone (Milestone | Timeline | Key Deliverables).`,
  },
  compliance: {
    en: `**Regulatory & Compliance**
- Identify applicable regulations (e.g. GDPR, OJK, HIPAA, SOC2) based on product type and region.
- Cover data privacy duties, audit requirements, consent management, data retention, and breach notification.
- Use a table with columns: Regulation | Applicability | Requirement | Action Required — minimum 3 regulations.`,
    id: `**Regulasi & Kepatuhan**
- Identifikasi regulasi yang berlaku (mis. GDPR, OJK, HIPAA, SOC2) berdasarkan jenis produk dan wilayah.
- Cakup kewajiban privasi data, kebutuhan audit, manajemen consent, retensi data, dan notifikasi breach.
- Gunakan tabel dengan kolom: Regulasi | Applicability | Requirement | Action Required — minimal 3 regulasi.`,
  },
  testing: {
    en: `**Edge Case & Integration Testing Criteria**
- List at least 6 critical edge cases focusing on race conditions, concurrent requests, and API failures.
- Add a markdown separator (---) between cases.
- Each case should include: Scenario, Precondition, Steps, Expected Result, Severity.
- Include a brief testing pyramid strategy (Unit vs Integration vs E2E) and test data setup approach.`,
    id: `**Kriteria Pengujian Edge Case & Integrasi**
- Daftar minimal 6 edge case kritis yang fokus pada race condition, concurrent request, dan kegagalan API.
- Tambahkan separator markdown (---) antar kasus.
- Setiap kasus harus mencakup: Skenario, Precondition, Steps, Expected Result, Severity.
- Sertakan strategi testing pyramid singkat (Unit vs Integration vs E2E) dan pendekatan setup data uji.`,
  },
  "error-handling": {
    en: `**Error Handling, Fallbacks & Retry Strategies**
- Define HTTP Status Code mappings (table: Status Code | Scenario | Response Payload | Frontend Action).
- Detail global error boundary strategies and offline/fallback states.
- Include retry strategy details: exponential backoff policy, max retries, circuit breaker thresholds, and a graceful degradation plan.
- Cover user-facing error messages and logging.`,
    id: `**Penanganan Error, Fallback & Strategi Retry**
- Definisikan pemetaan HTTP Status Code (tabel: Status Code | Skenario | Response Payload | Aksi Frontend).
- Rincikan strategi global error boundary dan state offline/fallback.
- Sertakan detail strategi retry: kebijakan exponential backoff, max retries, threshold circuit breaker, dan rencana graceful degradation.
- Cakup pesan error yang menghadap pengguna dan logging.`,
  },
  "ai-agent-guidelines": {
    en: `**AI Agent Implementation Guidelines**
- Provide exact step-by-step CLI commands and structural instructions for an AI coder (Cursor/Copilot) to initialize and build the project from this spec.
- Use a structured template:
  * Prerequisites (Node version, package manager)
  * Step-by-step Setup Commands (code blocks)
  * File Creation Order
  * Environment Variables (with .env template code block)
  * Build & Run Commands
  * Test Commands`,
    id: `**Panduan Implementasi AI Agent**
- Sediakan perintah CLI langkah demi langkah yang eksak dan instruksi struktural untuk AI coder (Cursor/Copilot) agar dapat menginisialisasi dan membangun proyek dari spec ini.
- Gunakan template terstruktur:
  * Prerequisites (versi Node, package manager)
  * Step-by-step Setup Commands (blok kode)
  * File Creation Order
  * Environment Variables (dengan template .env blok kode)
  * Build & Run Commands
  * Test Commands`,
  },
  "open-questions": {
    en: `**Open Questions**
- List unresolved questions with decision owners, impact if left unanswered, and decision deadlines.
- Use a table with columns: Question | Impact if Not Answered | Decision Deadline | Decision Maker — minimum 4 questions.
- Each question must identify WHO decides and WHEN.`,
    id: `**Pertanyaan Terbuka**
- Daftar pertanyaan yang belum terjawab beserta pemilik keputusan, dampak jika tak dijawab, dan tenggat pengambilan keputusan.
- Gunakan tabel dengan kolom: Pertanyaan | Dampak Jika Tidak Dijawab | Deadline Keputusan | Decision Maker — minimal 4 pertanyaan.
- Setiap pertanyaan harus mengidentifikasi WHO decides dan WHEN.`,
  },
  "glossary-references": {
    en: `**Glossary & References**
- Define 8-15 domain terms, acronyms, and product-specific names used in this document, in a table: Term | Definition | Avoid Synonyms.
- Pick ONE canonical name per concept and use exactly that spelling in every later chapter.
- Add a References list: source documents, standards, research, and tools cited (title, owner, location). Mark anything you cannot verify as "to be confirmed" instead of inventing links.`,
    id: `**Glosarium & Referensi**
- Definisikan 8-15 istilah domain, akronim, dan nama khusus produk yang dipakai di dokumen ini, dalam tabel: Istilah | Definisi | Hindari Sinonim.
- Pilih SATU nama kanonik per konsep dan pakai ejaan persis itu di semua chapter berikutnya.
- Tambahkan daftar Referensi: dokumen sumber, standar, riset, dan tool yang dikutip (judul, pemilik, lokasi). Tandai yang tidak bisa diverifikasi sebagai "perlu dikonfirmasi", jangan mengarang tautan.`,
  },
  personas: {
    en: `**User Personas**
- Create 3-5 personas, each as a Heading 3: \`### PERS-01. <Name> — <Role>\`, numbered sequentially with NO gaps.
- For each persona give: Context (who, where, tech comfort), Goals (2-3), Pain Points (2-3), Current Workaround, Key Scenarios (2 situations where they use the product), and Success Signal (what "it works" means to them).
- Mark exactly one persona as Primary and the rest as Secondary. End with a summary table: ID | Persona | Type (Primary/Secondary) | Core Need.
- Use concrete, realistic details, not generic archetypes.`,
    id: `**Persona Pengguna**
- Buat 3-5 persona, masing-masing sebagai Heading 3: \`### PERS-01. <Nama> — <Peran>\`, bernomor berurutan TANPA celah.
- Untuk tiap persona sertakan: Konteks (siapa, di mana, kenyamanan teknologi), Tujuan (2-3), Pain Point (2-3), Workaround Saat Ini, Skenario Utama (2 situasi pemakaian produk), dan Sinyal Sukses (arti "berhasil" baginya).
- Tandai tepat satu persona sebagai Primer dan sisanya Sekunder. Tutup dengan tabel ringkasan: ID | Persona | Tipe (Primer/Sekunder) | Kebutuhan Inti.
- Gunakan detail konkret dan realistis, bukan arketipe generik.`,
  },
  "constraints-dependencies": {
    en: `**Constraints, Assumptions & Dependencies**
- Use one continuous DEP-xx sequence across both tables below.
- Table 1 (Constraints & Assumptions): ID | Type (Constraint/Assumption) | Description | Impact if Wrong | Owner — minimum 5 rows covering budget, time, technology, legal, and team limits.
- Table 2 (External Dependencies): ID | Provider | Purpose | Limits / SLA | Fallback if Unavailable — minimum 3 rows (third-party APIs, vendors, internal teams).
- State which scope items are blocked by each dependency.`,
    id: `**Batasan, Asumsi & Dependensi**
- Pakai satu urutan DEP-xx berkelanjutan di kedua tabel di bawah.
- Tabel 1 (Batasan & Asumsi): ID | Tipe (Batasan/Asumsi) | Deskripsi | Dampak Jika Salah | Owner — minimal 5 baris mencakup batas anggaran, waktu, teknologi, hukum, dan tim.
- Tabel 2 (Dependensi Eksternal): ID | Penyedia | Tujuan | Batas / SLA | Fallback Jika Tidak Tersedia — minimal 3 baris (API pihak ketiga, vendor, tim internal).
- Sebutkan item cakupan yang terblokir oleh tiap dependensi.`,
  },
  "security-privacy": {
    en: `**Security & Privacy Requirements**
- Data Classification table: Data Type | Classification (Public/Internal/Confidential/Restricted) | Storage | Retention | Encryption (at rest / in transit).
- Roles & Permissions matrix: rows = roles, columns = key actions or resources, cells = Allow / Deny / Own-only.
- Authentication & Session: method, token lifetime, MFA, password and recovery rules.
- Threat Model table: ID | Threat (STRIDE category) | Asset | Mitigation | Residual Risk — minimum 5 threats.- Privacy by design: consent, data minimization, deletion and export requests, audit logging.`,
    id: `**Persyaratan Keamanan & Privasi**
- Tabel Klasifikasi Data: Jenis Data | Klasifikasi (Publik/Internal/Rahasia/Terbatas) | Penyimpanan | Retensi | Enkripsi (at rest / in transit).
- Matriks Peran & Izin: baris = peran, kolom = aksi atau resource kunci, sel = Boleh / Tolak / Hanya milik sendiri.
- Autentikasi & Sesi: metode, masa berlaku token, MFA, aturan password dan pemulihan.
- Tabel Threat Model: ID | Ancaman (kategori STRIDE) | Aset | Mitigasi | Risiko Residual — minimal 5 ancaman.- Privacy by design: consent, minimisasi data, permintaan hapus dan ekspor data, audit logging.`,
  },
  "analytics-tracking": {
    en: `**Analytics & Event Tracking Plan**
- Event Taxonomy table: ID | Event Name (snake_case) | Trigger | Properties | Related Feature | Feeds KPI — minimum 8 events.
- Name events as object_action and keep property names consistent across events.
- Map every KPI from the Success Metrics chapter (when present) to at least one event; list any KPI with no event under "Tracking Gaps".
- Cover tooling (analytics provider, data warehouse), consent-gated tracking, and PII rules for event properties.`,
    id: `**Rencana Analitik & Pelacakan Event**
- Tabel Taksonomi Event: ID | Nama Event (snake_case) | Pemicu | Properti | Fitur Terkait | Mengisi KPI — minimal 8 event.
- Beri nama event dengan pola object_action dan jaga nama properti konsisten antar event.
- Petakan setiap KPI dari chapter Metrik Keberhasilan (jika ada) ke minimal satu event; daftarkan KPI tanpa event di "Celah Pelacakan".
- Cakup tooling (penyedia analitik, data warehouse), pelacakan berbasis consent, dan aturan PII untuk properti event.`,
  },
  "release-operations": {
    en: `**Release, Operations & Monitoring**
- Environments table: Environment | Purpose | Data | Deploy Trigger.
- Release strategy: CI/CD pipeline stages, feature flags, canary or staged rollout percentages, and explicit rollback criteria and steps.
- Observability: table of SLIs with SLO targets and alert thresholds (Metric | SLO | Alert Threshold | Owner), plus logging and tracing approach.
- Capacity and resilience: expected load, scaling triggers, backup frequency, RPO and RTO.
- Launch readiness checklist (8-10 checkbox items) and a support/on-call plan.`,
    id: `**Rilis, Operasional & Monitoring**
- Tabel Environment: Environment | Tujuan | Data | Pemicu Deploy.
- Strategi rilis: tahap pipeline CI/CD, feature flag, persentase canary atau staged rollout, serta kriteria dan langkah rollback yang eksplisit.
- Observability: tabel SLI dengan target SLO dan threshold alert (Metrik | SLO | Threshold Alert | Owner), plus pendekatan logging dan tracing.
- Kapasitas dan ketahanan: beban yang diharapkan, pemicu scaling, frekuensi backup, RPO dan RTO.
- Checklist kesiapan peluncuran (8-10 item checkbox) dan rencana dukungan/on-call.`,
  },
  "platform-accessibility": {
    en: `**Platform, Accessibility & Localization**
- Supported Platforms table: Platform | Minimum Version | Support Level (Full/Best-effort/None). Cover browsers, OS, devices, and screen-size breakpoints.
- Accessibility: target standard (WCAG 2.2 AA), keyboard navigation, screen-reader behavior, color contrast, focus management, and reduced-motion handling. Note that full compliance needs manual testing with assistive technologies.
- Localization: launch languages, text expansion, date/number/currency formats, right-to-left needs, and translation workflow.
- Offline and low-bandwidth behavior where relevant.`,
    id: `**Platform, Aksesibilitas & Lokalisasi**
- Tabel Platform yang Didukung: Platform | Versi Minimum | Level Dukungan (Penuh/Sebisanya/Tidak). Cakup browser, OS, perangkat, dan breakpoint ukuran layar.
- Aksesibilitas: standar target (WCAG 2.2 AA), navigasi keyboard, perilaku screen reader, kontras warna, manajemen fokus, dan penanganan reduced-motion. Catat bahwa kepatuhan penuh butuh pengujian manual dengan teknologi bantu.
- Lokalisasi: bahasa peluncuran, ekspansi teks, format tanggal/angka/mata uang, kebutuhan right-to-left, dan alur terjemahan.
- Perilaku offline dan bandwidth rendah jika relevan.`,
  },
  traceability: {
    en: `**Requirements Traceability Matrix**
- Build ONE matrix tying earlier chapters together: Feature (FEAT) | Persona (PERS) | User Story (US) | Entity (ENT) | API | NFR | Test Case (TC) | Risk (RISK) | KPI.
- Use ONLY IDs that were defined in earlier chapters, verbatim. Never invent an ID. Write "—" for a cell with no link and leave out columns whose chapter is not in this document.
- One row per Must-have feature (or per FEAT when available).
- After the matrix add "Coverage Gaps": a bullet list of features with no story, no test, or no API, and tests or stories that map to no feature. Write "None" only if truly none.
- Keep this the last data chapter; no new requirements here.`,
    id: `**Matriks Keterlacakan Kebutuhan**
- Bangun SATU matriks yang mengikat chapter-chapter sebelumnya: Fitur (FEAT) | Persona (PERS) | User Story (US) | Entitas (ENT) | API | NFR | Test Case (TC) | Risiko (RISK) | KPI.
- Pakai HANYA ID yang sudah didefinisikan di chapter sebelumnya, persis. Jangan mengarang ID. Tulis "—" untuk sel tanpa tautan dan buang kolom yang chapter-nya tidak ada di dokumen ini.
- Satu baris per fitur Must-have (atau per FEAT jika tersedia).
- Setelah matriks tambahkan "Celah Cakupan": daftar bullet fitur tanpa story, tanpa test, atau tanpa API, serta test atau story yang tidak terhubung ke fitur. Tulis "Tidak ada" hanya jika memang tidak ada.
- Pertahankan sebagai chapter data terakhir; jangan menambah kebutuhan baru di sini.`,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the generation instruction for a single chapter block in the requested
 * language. Returns null for unknown block ids.
 */
export function getBlockInstructions(
  blockId: string,
  language: "en" | "id",
): string | null {
  const entry = BLOCK_INSTRUCTIONS[blockId];
  if (!entry) return null;
  return language === "en" ? entry.en : entry.id;
}

/**
 * Validate an unknown input as a customChapterIds array.
 * Returns { ok: true, ids } on success, or { ok: false, reason } with an
 * actionable English message on failure.
 */
export function validateCustomChapterIds(
  input: unknown,
): { ok: true; ids: string[] } | { ok: false; reason: string } {
  if (!Array.isArray(input)) {
    return { ok: false, reason: "customChapterIds must be an array of strings." };
  }
  if (input.length === 0) {
    return { ok: false, reason: "customChapterIds must contain at least 1 block id." };
  }
  if (input.length > MAX_CUSTOM_BLOCKS) {
    return {
      ok: false,
      reason: `customChapterIds must contain at most ${MAX_CUSTOM_BLOCKS} block ids (got ${input.length}).`,
    };
  }
  for (const item of input) {
    if (typeof item !== "string" || item.trim() === "") {
      return { ok: false, reason: "Each customChapterIds entry must be a non-empty string." };
    }
  }
  const ids = input as string[];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      return { ok: false, reason: `Duplicate block id: "${id}".` };
    }
    seen.add(id);
  }
  for (const id of ids) {
    if (!getChapterBlock(id)) {
      return { ok: false, reason: `Unknown block id: "${id}".` };
    }
  }
  return { ok: true, ids };
}

/**
 * Cross-chapter notes for the block at `index`: the ID scheme it mints and a
 * reference line to selected sources that appear EARLIER in the user's order.
 * Sources that are unselected or come later are skipped, so the model never
 * cites a chapter that does not exist yet.
 */
function buildLinkNotes(blockIds: string[], index: number, language: Lang): string {
  const isEn = language === "en";
  const link = BLOCK_LINKS[blockIds[index]];
  const notes: string[] = [];

  if (link?.produces) {
    const p = link.produces;
    notes.push(
      isEn
        ? `- ID rule: label every item in this chapter with a sequential ID \`${p}-01\`, \`${p}-02\`, ... (no gaps). Later chapters cite these IDs verbatim.`
        : `- Aturan ID: beri setiap item di chapter ini ID berurutan \`${p}-01\`, \`${p}-02\`, ... (tanpa celah). Chapter berikutnya mengutip ID ini persis.`,
    );
  }

  const refs: string[] = [];
  for (const src of link?.consumes ?? []) {
    const srcIndex = blockIds.indexOf(src);
    if (srcIndex === -1 || srcIndex > index) continue;
    const srcBlock = getChapterBlock(src)!;
    const title = isEn ? srcBlock.titleEn : srcBlock.titleId;
    const prefix = BLOCK_LINKS[src]?.produces;
    refs.push(`Chapter ${srcIndex + 1} (${title}${prefix ? `; ${prefix}-xx` : ""})`);
  }
  if (refs.length > 0) {
    notes.push(
      isEn
        ? `- Stay consistent with earlier chapters: ${refs.join(", ")}. Reuse their names and IDs verbatim; never invent or rename them.`
        : `- Konsisten dengan chapter sebelumnya: ${refs.join(", ")}. Pakai nama dan ID-nya persis; jangan mengarang atau mengganti nama.`,
    );
  }

  return notes.join("\n");
}

/**
 * Compose a deterministic system prompt for custom PRD generation.
 * Throws with a clear message if validation fails.
 */
export function composeCustomSystemPrompt(
  blockIds: string[],
  language: "en" | "id",
): string {
  // Reuse validator for consistency — throw on violation
  const validated = validateCustomChapterIds(blockIds);
  if (!validated.ok) {
    throw new Error(validated.reason);
  }
  // Extra safety: getBlockInstructions must exist for every id (unknown → null)
  for (const id of blockIds) {
    if (!getChapterBlock(id) || !getBlockInstructions(id, language)) {
      throw new Error(`Unknown block id: "${id}".`);
    }
  }

  const isEn = language === "en";
  const n = blockIds.length;

  // Preamble — legacy style: role, critical instructions, chapter list
  const chapterList = blockIds
    .map((id, idx) => {
      const block = getChapterBlock(id)!;
      const title = isEn ? block.titleEn : block.titleId;
      return `## ${idx + 1}. ${title}`;
    })
    .join("\n");

  const preamble = isEn
    ? `You are a highly skilled Senior Product Manager and Architect. Your job is to generate a comprehensive, enterprise-grade Product Requirements Document (PRD) mapped EXACTLY into ${n} structured chapters using strictly Markdown format.
CRITICAL INSTRUCTIONS (FAILURE IS NOT AN OPTION):
1. NO INTRODUCTIONS OR OUTROS. Start immediately with "## 1."
2. EVERY chapter MUST start with a Markdown Heading 2 (##). Example: "## 1. ${getChapterBlock(blockIds[0])!.titleEn}"
3. DO NOT output a main title like "# PRD" or "Here is your PRD".
4. NO PLACEHOLDERS like "[Insert Here]". Generate specific, concrete, realistic examples and metrics based on the product type.
5. NO OUTLINES OR PLANS. You must generate the ENTIRE document right now in one go.
The ${n} Chapters MUST be exactly:
${chapterList}`
    : `You are a highly skilled Senior Product Manager and Architect. Your job is to generate a comprehensive, enterprise-grade Product Requirements Document (PRD) mapped EXACTLY into ${n} structured chapters using strictly Markdown format.
CRITICAL INSTRUCTIONS (FAILURE IS NOT AN OPTION):
1. NO INTRODUCTIONS OR OUTROS. Start immediately with "## 1."
2. EVERY chapter MUST start with a Markdown Heading 2 (##). Example: "## 1. ${getChapterBlock(blockIds[0])!.titleId}"
3. DO NOT output a main title like "# PRD" or "Here is your PRD".
4. NO PLACEHOLDERS like "[Insert Here]". Generate specific, concrete, realistic examples and metrics based on the product type.
5. NO OUTLINES OR PLANS. You must generate the ENTIRE document right now in one go.
The ${n} Chapters MUST be exactly:
${chapterList}`;

  // Per-block sections: heading + instructions
  const blocksSection = blockIds
    .map((id, idx) => {
      const block = getChapterBlock(id)!;
      const title = isEn ? block.titleEn : block.titleId;
      const instruction = getBlockInstructions(id, language)!;
      const linkNotes = buildLinkNotes(blockIds, idx, language);
      return `Chapter ${idx + 1} — ${title}:\n${instruction}${linkNotes ? `\n${linkNotes}` : ""}`;
    })
    .join("\n\n");

  const languageRequirement = isEn
    ? `LANGUAGE REQUIREMENT:\nGenerate the entire document strictly in English.`
    : `LANGUAGE REQUIREMENT:\nGenerate the entire document strictly in Indonesian.`;

  const mermaidRules = `MERMAID DIAGRAM RULES (CRITICAL - READ ALL):
- NEVER use parentheses () in EDGE LABELS (text between pipes |...|). Parentheses inside |...| will crash the parser. Example: WRONG → |Mengirim Data (REST/GraphQL)|. Instead write: |Mengirim Data REST- GraphQL| (remove parens or use dashes/brackets).
- For NODE LABELS in graph/flowchart: ALWAYS wrap labels containing parentheses, commas, or special characters in double quotes. Example: A["User (Logged In)"] instead of A[User (Logged In)].
- For journey: use "Title: Task" format as required by Mermaid journey syntax.
- For gantt: ensure date formats use YYYY-MM-DD and section titles are plain text.
- For erDiagram: use "Entity" ||--|| "Entity" for relationships, keep entity names as simple identifiers without special characters.
- For sequenceDiagram: use participant names as simple identifiers, and wrap message text with "quotes" if it contains special characters.
- Always test mentally: if a label contains any character other than letters, numbers, spaces, and dashes, wrap it in double quotes.`;

  const closingDirective = isEn
    ? `FINAL DIRECTIVE: Generate ALL ${n} chapters in the exact order listed above. Do NOT add, remove, or reorder chapters. Each chapter heading must appear verbatim as specified.`
    : `FINAL DIRECTIVE: Hasilkan SEMUA ${n} chapter dalam urutan persis seperti di atas. JANGAN menambah, mengurangi, atau mengubah urutan chapter. Setiap heading chapter harus muncul verbatim sesuai spesifikasi.`;

  return `${preamble}\n\nPER-CHAPTER CONSTRAINTS (apply each list below to its matching numbered chapter above; do NOT emit these as headings):\n${blocksSection}\n\n${languageRequirement}\n${mermaidRules}\n${closingDirective}`;
}

/**
 * Build a structure guard for revision/append modes when using custom chapters.
 * Analog to simpleGuard in server/prompts.ts — prevents adding/removing chapters.
 */
export function getCustomGuard(
  blockIds: string[],
  language: "en" | "id",
  mode: "revision" | "append",
): string {
  const n = blockIds.length;
  const titles = blockIds.map((id) => {
    const b = getChapterBlock(id)!;
    return language === "en" ? b.titleEn : b.titleId;
  });
  const chapterList = titles.map((t, i) => `## ${i + 1}. ${t}`).join(", ");
  if (mode === "revision") {
    return language === "en"
      ? `CUSTOM STRUCTURE LOCK (REVISION): THIS IS A CUSTOM PRD (${n} chapters). Do NOT change the ${n}-chapter structure. Do NOT add or remove chapters — you MUST preserve EXACTLY these ${n} chapters in exact order: ${chapterList}. Only the content within chapters may change.`
      : `CUSTOM STRUCTURE LOCK (REVISION): INI ADALAH CUSTOM PRD (${n} chapter). JANGAN mengubah struktur ${n} chapter. JANGAN menambah atau menghapus chapter — Anda HARUS mempertahankan TEPAT ${n} chapter dalam urutan persis: ${chapterList}. Hanya isi di dalam chapter yang boleh diubah.`;
  }
  // append
  return language === "en"
    ? `CUSTOM STRUCTURE LOCK (APPEND): THIS IS A CUSTOM PRD (${n} chapters). Do NOT change the ${n}-chapter structure. New content must be inserted into the existing ${n} chapters — do NOT create an extra chapter. Preserve exactly: ${chapterList}.`
    : `CUSTOM STRUCTURE LOCK (APPEND): INI ADALAH CUSTOM PRD (${n} chapter). JANGAN mengubah struktur ${n} chapter. Konten baru harus disisipkan ke dalam ${n} chapter yang ada — jangan membuat chapter tambahan. Pertahankan persis: ${chapterList}.`;
}
