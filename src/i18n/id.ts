import type { Dict } from "./en";

// Task 2.2 — Kamus terpusat (Indonesia). Harus selaras dengan struktur `en`.
export const id: Dict = {
  welcome: {
    title: "PRD Architect",
    tagline: "Jelaskan produk Anda. Dapatkan PRD komprehensif tingkat enterprise.",
    modeGroupLabel: "Mode PRD",
    businessMode: "Mode Bisnis & Investor",
    businessDesc: "Fokus pada metrik bisnis, ROI, dan GTM roadmap",
    simpleMode: "PRD Sederhana",
    simpleDesc: "Fokus pada masalah, fitur MVP, dan rencana aksi",
    technicalMode: "Mode AI Agent & Developer",
    technicalDesc: "Fokus pada skema database, payload API, dan arsitektur",
  },
  header: {
    copy: "Salin",
    copyTitle: "Salin Text",
    export: "Ekspor",
    exportMd: "Markdown (.md)",
    exportDocx: "Word (.docx)",
    exportPdf: "PDF (.pdf)",
    exportJson: "JSON (.json)",
    print: "Cetak",
    printTitle: "Cetak PDF",
    settings: "Pengaturan",
    toggleLanguage: "Ganti Bahasa",
    toggleSidebar: "Buka/Tutup sidebar",
    switchToOther: "Ganti ke Bahasa Inggris",
  },
  wbs: {
    document: "Dokumen",
    canvas: "WBS Canvas",
    canvasLabel: "Lihat canvas Work Breakdown Structure",
  },
};
