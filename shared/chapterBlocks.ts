// Canonical registry of PRD chapter blocks — single source of truth shared by FE & BE.
// Holds the 21 deduplicated chapter blocks merged across all PRD modes
// (business / simple / technical), consumed by the Custom PRD Builder to render
// selectable chapter cards and to validate user-composed structures.
//
// NOTE: Standard modes still generate documents through the legacy prose prompts in
// server/prompts.ts. STANDARD_TEMPLATES below is best-effort metadata approximating
// which blocks map to each legacy mode's structure; it does NOT drive prompt generation.

import type { PRDMode } from "./types";

export interface ChapterBlock {
  /** Unique kebab-case slug identifying the block. */
  id: string;
  /** Chapter title in English. */
  titleEn: string;
  /** Chapter title in Indonesian. */
  titleId: string;
  /** One-sentence description of the chapter contents, English (UI card). */
  descEn: string;
  /** One-sentence description of the chapter contents, Indonesian (UI card). */
  descId: string;
  /** Valid lucide-react icon name rendered next to the block title. */
  icon: string;
  /** Coarse grouping used to filter and sort blocks in the builder UI. */
  category: "product" | "technical";
}

// Order matters: it defines the default display order of blocks in the builder UI
// and must match the canonical deduplicated sequence.
export const CHAPTER_BLOCKS: ChapterBlock[] = [
  {
    id: "overview",
    titleEn: "Executive Summary & Value Proposition",
    titleId: "Ringkasan Eksekutif & Proposisi Nilai",
    descEn:
      "Summarizes the product vision, core objectives, target users, and unique value proposition in an executive-ready format.",
    descId:
      "Merangkum visi produk, tujuan inti, pengguna target, dan proposisi nilai unik dalam format siap-eksekutif.",
    icon: "FileText",
    category: "product",
  },
  {
    id: "problem-market",
    titleEn: "Problem Definition & Market Analysis",
    titleId: "Definisi Masalah & Analisis Pasar",
    descEn:
      "Defines the core user problems and analyzes market size (TAM/SAM/SOM) along with the competitive landscape.",
    descId:
      "Mendefinisikan masalah inti pengguna dan menganalisis ukuran pasar (TAM/SAM/SOM) beserta lanskap kompetitif.",
    icon: "AlertTriangle",
    category: "product",
  },
  {
    id: "feature-scope",
    titleEn: "Solution Overview & Scope (MoSCoW)",
    titleId: "Ringkasan Solusi & Cakupan (MoSCoW)",
    descEn:
      "Outlines the solution approach and groups all features into MoSCoW priority tiers (Must, Should, Could, Won't).",
    descId:
      "Menjelaskan pendekatan solusi dan mengelompokkan seluruh fitur ke dalam tingkat prioritas MoSCoW (Must, Should, Could, Won't).",
    icon: "Layers",
    category: "product",
  },
  {
    id: "out-of-scope",
    titleEn: "Out of Scope Rules & Boundaries",
    titleId: "Aturan Batas di Luar Cakupan",
    descEn:
      "Explicitly lists what will not be built, with boundary rules and revisit conditions for each exclusion.",
    descId:
      "Memuat daftar eksplisit hal yang tidak dibangun, lengkap dengan aturan batas dan kondisi peninjauan ulang untuk setiap pengecualian.",
    icon: "Ban",
    category: "product",
  },
  {
    id: "feature-spec",
    titleEn: "Feature Specification & Logic",
    titleId: "Spesifikasi Fitur & Logika",
    descEn:
      "Details each feature down to input fields, flows, business logic, error states, loading states, and integrations.",
    descId:
      "Merinci setiap fitur hingga level field input, alur, logika bisnis, state error, state loading, dan integrasi.",
    icon: "ListChecks",
    category: "product",
  },
  {
    id: "user-stories",
    titleEn: "User Stories & Acceptance Criteria",
    titleId: "User Story & Kriteria Penerimaan",
    descEn:
      "Captures personas, prioritized user stories, and Given/When/Then acceptance criteria in a structured backlog table.",
    descId:
      "Menangkap persona, user story berprioritas, dan kriteria penerimaan Given/When/Then dalam tabel backlog terstruktur.",
    icon: "Users",
    category: "product",
  },
  {
    id: "ux-journey",
    titleEn: "UX Design, User Journey & Wireframe Flow",
    titleId: "Desain UX, Perjalanan Pengguna & Alur Wireframe",
    descEn:
      "Describes UX principles, complete end-to-end user journeys, wireframe flows, and key screen layouts including Mermaid diagrams.",
    descId:
      "Menjelaskan prinsip UX, perjalanan pengguna menyeluruh, alur wireframe, dan tata letak layar utama termasuk diagram Mermaid.",
    icon: "Palette",
    category: "product",
  },
  {
    id: "architecture",
    titleEn: "High-Level Technical Architecture",
    titleId: "Arsitektur Teknis Tingkat Tinggi",
    descEn:
      "Presents the high-level system architecture, tech stack decisions, alternatives considered, and a Mermaid system context diagram.",
    descId:
      "Menyajikan arsitektur sistem tingkat tinggi, keputusan tech stack, alternatif yang dipertimbangkan, dan diagram konteks sistem Mermaid.",
    icon: "Server",
    category: "technical",
  },
  {
    id: "data-models",
    titleEn: "Data Models & Database Schema",
    titleId: "Model Data & Skema Basis Data",
    descEn:
      "Specifies database entities, column-level schemas, relations, constraints, indexes, and an ERD in Mermaid syntax.",
    descId:
      "Menentukan entitas basis data, skema tingkat kolom, relasi, constraint, indeks, serta ERD dalam sintaks Mermaid.",
    icon: "Database",
    category: "technical",
  },
  {
    id: "api-contracts",
    titleEn: "API Contracts & Interfaces",
    titleId: "Kontrak API & Antarmuka",
    descEn:
      "Documents REST endpoints with literal JSON request/response payloads, error responses, and per-endpoint authentication requirements.",
    descId:
      "Mendokumentasikan endpoint REST dengan contoh literal payload JSON request/response, respons error, dan kebutuhan autentikasi per endpoint.",
    icon: "Webhook",
    category: "technical",
  },
  {
    id: "frontend-arch",
    titleEn: "Frontend Component Architecture & State Management",
    titleId: "Arsitektur Komponen Frontend & Manajemen State",
    descEn:
      "Maps the UI component hierarchy, routing paths, state management strategy, lazy loading plan, and client-side data flow diagrams.",
    descId:
      "Memetakan hierarki komponen UI, path routing, strategi manajemen state, rencana lazy loading, dan diagram alur data sisi klien.",
    icon: "LayoutTemplate",
    category: "technical",
  },
  {
    id: "nfr",
    titleEn: "Non-Functional Requirements",
    titleId: "Persyaratan Non-Fungsional",
    descEn:
      "Defines measurable performance, scalability, security, usability, and availability targets together with their measurement methods.",
    descId:
      "Mendefinisikan target terukur untuk performa, skalabilitas, keamanan, usability, dan availability beserta metode pengukurannya.",
    icon: "ShieldCheck",
    category: "technical",
  },
  {
    id: "success-metrics",
    titleEn: "Success Metrics & Business KPIs",
    titleId: "Metrik Keberhasilan & KPI Bisnis",
    descEn:
      "Sets business KPIs such as MRR, churn, and conversion rate with baselines, targets, and tracking plans.",
    descId:
      "Menetapkan KPI bisnis seperti MRR, churn, dan conversion rate dengan baseline, target, dan rencana pelacakan.",
    icon: "Gauge",
    category: "product",
  },
  {
    id: "gtm",
    titleEn: "Go-to-Market Strategy & Monetization",
    titleId: "Strategi Go-to-Market & Monetisasi",
    descEn:
      "Covers launch strategy, pricing, monetization model, channel plan, and projected ROI estimates.",
    descId:
      "Mencakup strategi peluncuran, pricing, model monetisasi, rencana kanal, serta estimasi proyeksi ROI.",
    icon: "Rocket",
    category: "product",
  },
  {
    id: "risks",
    titleEn: "Risk Register & Mitigation",
    titleId: "Register Risiko & Mitigasi",
    descEn:
      "Maintains a risk register scoring probability, impact, and mitigation ownership for every identified risk.",
    descId:
      "Menyimpan register risiko dengan skor probabilitas, dampak, dan penanggung jawab mitigasi untuk setiap risiko yang teridentifikasi.",
    icon: "ShieldAlert",
    category: "product",
  },
  {
    id: "timeline",
    titleEn: "Project Timeline & Roadmap",
    titleId: "Linimasa Proyek & Roadmap",
    descEn:
      "Breaks the roadmap into weekly sprints or phased milestones visualized with a Mermaid Gantt chart.",
    descId:
      "Memecah roadmap menjadi sprint mingguan atau milestone bertahap yang divisualisasikan dengan diagram Gantt Mermaid.",
    icon: "CalendarRange",
    category: "product",
  },
  {
    id: "compliance",
    titleEn: "Regulatory & Compliance",
    titleId: "Regulasi & Kepatuhan",
    descEn:
      "Identifies applicable regulations (e.g., GDPR, OJK, HIPAA), data privacy duties, and audit requirements.",
    descId:
      "Mengidentifikasi regulasi yang berlaku (mis. GDPR, OJK, HIPAA), kewajiban privasi data, dan kebutuhan audit.",
    icon: "Scale",
    category: "product",
  },
  {
    id: "testing",
    titleEn: "Edge Case & Integration Testing Criteria",
    titleId: "Kriteria Pengujian Edge Case & Integrasi",
    descEn:
      "Enumerates critical edge cases around race conditions, concurrency, and API failures plus the testing pyramid strategy.",
    descId:
      "Menjabarkan edge case kritis seputar race condition, konkurensi, dan kegagalan API beserta strategi testing pyramid.",
    icon: "FlaskConical",
    category: "technical",
  },
  {
    id: "error-handling",
    titleEn: "Error Handling, Fallbacks & Retry Strategies",
    titleId: "Penanganan Error, Fallback & Strategi Retry",
    descEn:
      "Defines HTTP status mappings, global error boundaries, retry with exponential backoff, circuit breakers, and graceful degradation.",
    descId:
      "Mendefinisikan pemetaan status HTTP, global error boundary, retry dengan exponential backoff, circuit breaker, dan graceful degradation.",
    icon: "RefreshCcw",
    category: "technical",
  },
  {
    id: "ai-agent-guidelines",
    titleEn: "AI Agent Implementation Guidelines",
    titleId: "Panduan Implementasi AI Agent",
    descEn:
      "Provides step-by-step setup commands, file creation order, environment templates, and run instructions for AI coders like Cursor or Copilot.",
    descId:
      "Menyediakan perintah setup langkah demi langkah, urutan pembuatan file, template environment, dan instruksi run untuk AI coder seperti Cursor atau Copilot.",
    icon: "Bot",
    category: "technical",
  },
  {
    id: "open-questions",
    titleEn: "Open Questions",
    titleId: "Pertanyaan Terbuka",
    descEn:
      "Lists unresolved questions with decision owners, impact if left unanswered, and decision deadlines.",
    descId:
      "Mendaftar pertanyaan yang belum terjawab beserta pemilik keputusan, dampak jika tak dijawab, dan tenggat pengambilan keputusan.",
    icon: "HelpCircle",
    category: "product",
  },
];

// Best-effort mapping from each legacy PRD mode to its canonical block ids.
// Order mirrors the legacy chapter sequences in server/prompts.ts (business: 12,
// simple: 6, technical: 9 chapters). Standard modes keep generating via legacy
// prompts; this metadata powers defaults and comparisons in the builder UI.
export const STANDARD_TEMPLATES: Record<PRDMode, string[]> = {
  business: [
    "overview",
    "problem-market",
    "feature-scope",
    "user-stories",
    "ux-journey",
    "architecture",
    "nfr",
    "success-metrics",
    "gtm",
    "risks",
    "timeline",
    "compliance",
  ],
  simple: [
    "problem-market",
    "feature-scope",
    "out-of-scope",
    "user-stories",
    "feature-spec",
    "open-questions",
  ],
  technical: [
    "overview",
    "feature-scope",
    "data-models",
    "api-contracts",
    "frontend-arch",
    "testing",
    "nfr",
    "error-handling",
    "ai-agent-guidelines",
  ],
};

/** Look up a block by its slug id. Returns undefined for unknown ids. */
export function getChapterBlock(id: string): ChapterBlock | undefined {
  return CHAPTER_BLOCKS.find((block) => block.id === id);
}

/** Hard cap on how many extra blocks a user may compose in the Custom PRD Builder. */
export const MAX_CUSTOM_BLOCKS = 15;
