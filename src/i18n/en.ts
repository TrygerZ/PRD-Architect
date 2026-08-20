// Task 2.2 — Kamus terpusat (English). Single source of truth untuk teks UI.
export const en = {
  welcome: {
    title: "PRD Architect",
    tagline: "Describe your product. Get a comprehensive, enterprise-grade PRD.",
    modeGroupLabel: "PRD Mode",
    businessMode: "Business & Investor Mode",
    businessDesc: "Focus on business metrics, ROI, and GTM roadmap",
    simpleMode: "Simple PRD",
    simpleDesc: "Focus on problem, MVP features, and action plan",
    technicalMode: "AI Agent & Developer Mode",
    technicalDesc: "Focus on database schemas, API payloads, and architecture",
  },
  header: {
    copy: "Copy",
    copyTitle: "Copy as Text",
    export: "Export",
    exportMd: "Markdown (.md)",
    exportDocx: "Word (.docx)",
    exportPdf: "PDF (.pdf)",
    exportJson: "JSON (.json)",
    print: "Print",
    printTitle: "Print to PDF",
    settings: "Settings",
    toggleLanguage: "Toggle Language",
    toggleSidebar: "Toggle sidebar",
    switchToOther: "Switch to Indonesian",
  },
  wbs: {
    document: "Document",
    canvas: "WBS Canvas",
    canvasLabel: "View Work Breakdown Structure canvas",
  },
};

export type Dict = typeof en;

