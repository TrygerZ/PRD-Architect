// Canonical registry of PRD chapter blocks — single source of truth shared by FE & BE.
// Holds the 29 deduplicated chapter blocks merged across all PRD modes
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
      "Product vision, goals, target users, and value in one page.",
    descId:
      "Visi produk, tujuan, pengguna target, dan nilai jual dalam satu halaman.",
    icon: "FileText",
    category: "product",
  },
  {
    id: "glossary-references",
    titleEn: "Glossary & References",
    titleId: "Glosarium & Referensi",
    descEn: "Shared terms and sources used across the document.",
    descId: "Istilah bersama dan sumber yang dipakai di dokumen.",
    icon: "BookOpen",
    category: "product",
  },
  {
    id: "problem-market",
    titleEn: "Problem Definition & Market Analysis",
    titleId: "Definisi Masalah & Analisis Pasar",
    descEn:
      "User problems, market size, and competitors.",
    descId:
      "Masalah pengguna, ukuran pasar, dan kompetitor.",
    icon: "AlertTriangle",
    category: "product",
  },
  {
    id: "personas",
    titleEn: "User Personas",
    titleId: "Persona Pengguna",
    descEn: "Who your users are: goals, pain points, scenarios.",
    descId: "Siapa penggunamu: tujuan, kendala, dan skenario.",
    icon: "UserRound",
    category: "product",
  },
  {
    id: "feature-scope",
    titleEn: "Solution Overview & Scope (MoSCoW)",
    titleId: "Ringkasan Solusi & Cakupan (MoSCoW)",
    descEn:
      "Features ranked by priority (MoSCoW) plus a work breakdown.",
    descId:
      "Fitur diurutkan per prioritas (MoSCoW) beserta rincian pekerjaan.",
    icon: "Layers",
    category: "product",
  },
  {
    id: "out-of-scope",
    titleEn: "Out of Scope Rules & Boundaries",
    titleId: "Aturan Batas di Luar Cakupan",
    descEn:
      "What you will not build, why, and when to revisit.",
    descId:
      "Yang tidak akan dibuat, alasannya, dan kapan ditinjau ulang.",
    icon: "Ban",
    category: "product",
  },
  {
    id: "feature-spec",
    titleEn: "Feature Specification & Logic",
    titleId: "Spesifikasi Fitur & Logika",
    descEn:
      "Each key feature: inputs, steps, rules, and error states.",
    descId:
      "Tiap fitur utama: input, langkah, aturan, dan kondisi error.",
    icon: "ListChecks",
    category: "product",
  },
  {
    id: "user-stories",
    titleEn: "User Stories & Acceptance Criteria",
    titleId: "User Story & Kriteria Penerimaan",
    descEn:
      "User stories with acceptance criteria per persona.",
    descId:
      "User story dan kriteria penerimaan per persona.",
    icon: "Users",
    category: "product",
  },
  {
    id: "ux-journey",
    titleEn: "UX Design, User Journey & Wireframe Flow",
    titleId: "Desain UX, Perjalanan Pengguna & Alur Wireframe",
    descEn:
      "User journey, key screens, and UX principles with a diagram.",
    descId:
      "Perjalanan pengguna, layar utama, dan prinsip UX dengan diagram.",
    icon: "Palette",
    category: "product",
  },
  {
    id: "constraints-dependencies",
    titleEn: "Constraints, Assumptions & Dependencies",
    titleId: "Batasan, Asumsi & Dependensi",
    descEn: "Limits, assumptions, and third-party dependencies.",
    descId: "Batasan, asumsi, dan dependensi pihak ketiga.",
    icon: "Link2",
    category: "product",
  },
  {
    id: "architecture",
    titleEn: "High-Level Technical Architecture",
    titleId: "Arsitektur Teknis Tingkat Tinggi",
    descEn:
      "System overview, tech stack choices, and a context diagram.",
    descId:
      "Gambaran sistem, pilihan tech stack, dan diagram konteks.",
    icon: "Server",
    category: "technical",
  },
  {
    id: "data-models",
    titleEn: "Data Models & Database Schema",
    titleId: "Model Data & Skema Basis Data",
    descEn:
      "Database tables, relations, and an ER diagram.",
    descId:
      "Tabel database, relasi, dan diagram ER.",
    icon: "Database",
    category: "technical",
  },
  {
    id: "api-contracts",
    titleEn: "API Contracts & Interfaces",
    titleId: "Kontrak API & Antarmuka",
    descEn:
      "API endpoints with JSON examples, errors, and auth.",
    descId:
      "Endpoint API dengan contoh JSON, error, dan autentikasi.",
    icon: "Webhook",
    category: "technical",
  },
  {
    id: "frontend-arch",
    titleEn: "Frontend Component Architecture & State Management",
    titleId: "Arsitektur Komponen Frontend & Manajemen State",
    descEn:
      "UI components, routes, state management, and data flow.",
    descId:
      "Komponen UI, routing, manajemen state, dan alur data.",
    icon: "LayoutTemplate",
    category: "technical",
  },
  {
    id: "security-privacy",
    titleEn: "Security & Privacy Requirements",
    titleId: "Persyaratan Keamanan & Privasi",
    descEn: "Data classes, roles and permissions, and threat model.",
    descId: "Klasifikasi data, peran dan izin, serta threat model.",
    icon: "Lock",
    category: "technical",
  },
  {
    id: "nfr",
    titleEn: "Non-Functional Requirements",
    titleId: "Persyaratan Non-Fungsional",
    descEn:
      "Measurable targets for speed, scale, security, and uptime.",
    descId:
      "Target terukur untuk kecepatan, skala, keamanan, dan uptime.",
    icon: "ShieldCheck",
    category: "technical",
  },
  {
    id: "success-metrics",
    titleEn: "Success Metrics & Business KPIs",
    titleId: "Metrik Keberhasilan & KPI Bisnis",
    descEn:
      "KPIs with baseline, target, and how to measure them.",
    descId:
      "KPI dengan baseline, target, dan cara mengukurnya.",
    icon: "Gauge",
    category: "product",
  },
  {
    id: "analytics-tracking",
    titleEn: "Analytics & Event Tracking Plan",
    titleId: "Rencana Analitik & Pelacakan Event",
    descEn: "Which events to track and which KPI each one feeds.",
    descId: "Event apa yang dilacak dan KPI mana yang diisinya.",
    icon: "BarChart3",
    category: "product",
  },
  {
    id: "gtm",
    titleEn: "Go-to-Market Strategy & Monetization",
    titleId: "Strategi Go-to-Market & Monetisasi",
    descEn:
      "Launch plan, pricing, channels, and expected return.",
    descId:
      "Rencana peluncuran, harga, kanal, dan proyeksi hasil.",
    icon: "Rocket",
    category: "product",
  },
  {
    id: "risks",
    titleEn: "Risk Register & Mitigation",
    titleId: "Register Risiko & Mitigasi",
    descEn:
      "Risks scored by likelihood and impact, each with an owner.",
    descId:
      "Risiko dinilai dari kemungkinan dan dampak, masing-masing ada pemilik.",
    icon: "ShieldAlert",
    category: "product",
  },
  {
    id: "timeline",
    titleEn: "Project Timeline & Roadmap",
    titleId: "Linimasa Proyek & Roadmap",
    descEn:
      "Roadmap by sprint or milestone with a Gantt chart.",
    descId:
      "Roadmap per sprint atau milestone dengan diagram Gantt.",
    icon: "CalendarRange",
    category: "product",
  },
  {
    id: "compliance",
    titleEn: "Regulatory & Compliance",
    titleId: "Regulasi & Kepatuhan",
    descEn:
      "Laws that apply (GDPR, HIPAA) and what you must do.",
    descId:
      "Regulasi yang berlaku (GDPR, HIPAA) dan yang harus dilakukan.",
    icon: "Scale",
    category: "product",
  },
  {
    id: "platform-accessibility",
    titleEn: "Platform, Accessibility & Localization",
    titleId: "Platform, Aksesibilitas & Lokalisasi",
    descEn: "Supported devices, accessibility, and languages.",
    descId: "Perangkat didukung, aksesibilitas, dan bahasa.",
    icon: "Smartphone",
    category: "technical",
  },
  {
    id: "testing",
    titleEn: "Edge Case & Integration Testing Criteria",
    titleId: "Kriteria Pengujian Edge Case & Integrasi",
    descEn:
      "Critical edge cases and the testing strategy.",
    descId:
      "Edge case kritis dan strategi pengujian.",
    icon: "FlaskConical",
    category: "technical",
  },
  {
    id: "error-handling",
    titleEn: "Error Handling, Fallbacks & Retry Strategies",
    titleId: "Penanganan Error, Fallback & Strategi Retry",
    descEn:
      "How failures are shown, retried, and recovered.",
    descId:
      "Cara error ditampilkan, dicoba ulang, dan dipulihkan.",
    icon: "RefreshCcw",
    category: "technical",
  },
  {
    id: "release-operations",
    titleEn: "Release, Operations & Monitoring",
    titleId: "Rilis, Operasional & Monitoring",
    descEn: "Rollout, rollback, monitoring, and launch checklist.",
    descId: "Rollout, rollback, monitoring, dan checklist peluncuran.",
    icon: "ServerCog",
    category: "technical",
  },
  {
    id: "ai-agent-guidelines",
    titleEn: "AI Agent Implementation Guidelines",
    titleId: "Panduan Implementasi AI Agent",
    descEn:
      "Setup steps and file order so an AI coder can build it.",
    descId:
      "Langkah setup dan urutan file agar AI coder bisa membangunnya.",
    icon: "Bot",
    category: "technical",
  },
  {
    id: "traceability",
    titleEn: "Requirements Traceability Matrix",
    titleId: "Matriks Keterlacakan Kebutuhan",
    descEn: "Links features to stories, APIs, tests, and risks.",
    descId: "Menghubungkan fitur ke story, API, test, dan risiko.",
    icon: "GitMerge",
    category: "technical",
  },
  {
    id: "open-questions",
    titleEn: "Open Questions",
    titleId: "Pertanyaan Terbuka",
    descEn:
      "Unresolved questions with owners and deadlines.",
    descId:
      "Pertanyaan belum terjawab beserta pemilik dan tenggat.",
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

export interface BlockLink {
  /** ID prefix this block mints (e.g. "FEAT"); later chapters cite "FEAT-01" verbatim. */
  produces?: string;
  /** Block ids whose content this block must stay consistent with. */
  consumes?: string[];
}

// Cross-chapter wiring. Canonical block order must never consume a later block
// (asserted in chapterBlocks.test.ts), so the default layout has no forward refs.
export const BLOCK_LINKS: Record<string, BlockLink> = {
  personas: { produces: "PERS", consumes: ["overview", "problem-market"] },
  "feature-scope": { consumes: ["overview", "problem-market", "personas"] },
  "out-of-scope": { consumes: ["feature-scope"] },
  "feature-spec": { produces: "FEAT", consumes: ["feature-scope"] },
  "user-stories": {
    produces: "US",
    consumes: ["personas", "feature-spec", "feature-scope"],
  },
  "ux-journey": { consumes: ["personas", "user-stories", "feature-spec", "feature-scope"] },
  "constraints-dependencies": { produces: "DEP", consumes: ["overview", "feature-scope"] },
  architecture: { consumes: ["constraints-dependencies", "feature-spec", "feature-scope"] },
  "data-models": { produces: "ENT", consumes: ["feature-spec", "feature-scope", "architecture"] },
  "api-contracts": {
    produces: "API",
    consumes: ["data-models", "feature-spec", "feature-scope", "architecture"],
  },
  "frontend-arch": { consumes: ["api-contracts", "ux-journey", "feature-spec"] },
  "security-privacy": {
    consumes: ["personas", "data-models", "api-contracts", "architecture"],
  },
  nfr: { produces: "NFR", consumes: ["architecture", "security-privacy"] },
  "success-metrics": { produces: "KPI", consumes: ["overview", "feature-scope"] },
  "analytics-tracking": {
    produces: "EVT",
    consumes: ["success-metrics", "feature-spec", "feature-scope"],
  },
  gtm: { consumes: ["success-metrics", "personas", "overview", "problem-market"] },
  risks: {
    produces: "RISK",
    consumes: [
      "constraints-dependencies",
      "security-privacy",
      "feature-scope",
      "architecture",
      "problem-market",
    ],
  },
  timeline: { produces: "MS", consumes: ["feature-spec", "feature-scope", "risks"] },
  compliance: { consumes: ["security-privacy", "data-models", "feature-scope"] },
  "platform-accessibility": { consumes: ["personas", "ux-journey", "frontend-arch"] },
  testing: {
    produces: "TC",
    consumes: [
      "feature-spec",
      "user-stories",
      "nfr",
      "api-contracts",
      "security-privacy",
      "platform-accessibility",
      "risks",
    ],
  },
  "error-handling": {
    consumes: ["api-contracts", "nfr", "constraints-dependencies", "feature-spec"],
  },
  "release-operations": {
    consumes: ["architecture", "nfr", "risks", "constraints-dependencies", "testing"],
  },
  "ai-agent-guidelines": {
    consumes: ["architecture", "data-models", "api-contracts", "frontend-arch"],
  },
  traceability: {
    consumes: [
      "feature-spec",
      "personas",
      "user-stories",
      "data-models",
      "api-contracts",
      "nfr",
      "testing",
      "risks",
      "success-metrics",
      "analytics-tracking",
    ],
  },
  "open-questions": { consumes: ["risks", "constraints-dependencies"] },
};

export interface OrderIssue {
  blockId: string;
  /** Selected source blocks that currently sit after `blockId`. */
  sourceIds: string[];
}

/**
 * Blocks placed before a selected source they depend on. The prompt composer
 * skips such references, so the chapters would lose their cross-links.
 * Unselected sources are fine: the block defines a minimal version itself.
 */
export function findOrderIssues(selectedIds: string[]): OrderIssue[] {
  const issues: OrderIssue[] = [];
  selectedIds.forEach((id, index) => {
    const sourceIds = (BLOCK_LINKS[id]?.consumes ?? []).filter(
      (src) => selectedIds.indexOf(src) > index,
    );
    if (sourceIds.length > 0) issues.push({ blockId: id, sourceIds });
  });
  return issues;
}

/** Look up a block by its slug id. Returns undefined for unknown ids. */
export function getChapterBlock(id: string): ChapterBlock | undefined {
  return CHAPTER_BLOCKS.find((block) => block.id === id);
}

/** Hard cap on how many extra blocks a user may compose in the Custom PRD Builder. */
export const MAX_CUSTOM_BLOCKS = 20;
