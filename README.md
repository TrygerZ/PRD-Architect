<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/terminal.svg" width="60" height="60" alt="Terminal Icon">
  <h1 align="center">PRD Architect </h1>
  
  <p align="center">
    <strong>An intelligent, AI-powered generator for creating comprehensive Product Requirements Documents.</strong>
    <br />
    <br />
    <a href="#-features">Explore Features</a>
    ·
    <a href="#-getting-started">Get Started</a>
    ·
    <a href="#-configuration">Configuration</a>
  </p>
  
  <p align="center">
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
    <img src="https://img.shields.io/badge/Express.js-404D59?style=for-the-badge" alt="Express" />
  </p>
</div>

---

## ⚡ Overview

**PRD Architect** is a modern, full-stack application designed to dramatically accelerate the product planning phase. By taking a simple product idea as input, it automatically generates a highly structured, enterprise-grade Product Requirements Document (PRD), Technical Specification Document, or a streamlined Simple PRD for early-stage projects.

It features a **Tri-Mode** generation engine, each with comprehensively enhanced chapters:
- **⚡ Simple PRD Mode (6 Chapters)**: Designed for early-stage MVPs and solo developers. Covers Problem Statement, Feature Scope (MoSCoW), Out of Scope Rules & Boundaries, User Stories & Core Workflows, detailed Feature Specifications (input fields, business logic, error states, integrations), and Open Questions with Success Metrics & Timeline. No market analysis, no technical architecture — pure MVP focus.
- **💼 Business & Investor Mode (12 Chapters)**: Covers Stakeholder Analysis, Problem Statement, Assumptions & Constraints, Non-Goals, TAM/SAM/SOM, MoSCoW scoping, Enhanced User Stories (Given/When/Then format + Epic hierarchy), Classified NFRs (Performance/Scalability/Security/Usability/Availability), Baseline-backed KPIs, GTM Strategy, Risk Register with scoring, 12-week roadmap, and Regulatory Compliance.
- **💻 Technical & AI Agent Mode (9 Chapters)**: Covers System Context Diagram, Alternatives Considered, Non-Goals, Data Models with ERD, API Contracts with full Error Responses (400/401/403/404/409/500), Frontend Architecture with Data Flow Diagrams, Testing Pyramid Strategy, Classified NFRs, Retry Strategy with exponential backoff, and AI Agent Implementation Guidelines with structured templates.

## ✨ Features

- 🌓 **Tri-Mode Generation**: Clean toggle between ⚡ Simple PRD (early-stage MVP), 💼 Business/Investor strategies, and 💻 deep Technical specifications.
- 🧠 **Bring Your Own Model (BYOM)**: Seamlessly switch between AI providers (DeepSeek, Gemini, OpenCode Zen, **9router / Custom Proxy**) and select specific models via the in-app Settings UI.
- 🌐 **Custom Endpoint Support**: 9router option allows entering custom endpoint URLs, API keys, and custom model names.
- 🆓 **Free AI Models**: OpenCode Zen provides 5 free models (deepseek-v4-flash-free, nemotron-3-ultra-free, mimo-v2.5-free, north-mini-code-free, big-pickle) — no credit card required.
- 📊 **Live Mermaid Diagrams**: Generated PRDs include rich, interactive diagrams rendered in real-time — System Context (graph), Entity Relationships (ERD), User Journeys (journey), Gantt Roadmaps (gantt), and Data Flows (sequenceDiagram).
- 🛡️ **Auto-Sanitized Mermaid Syntax**: AI-generated diagram syntax is automatically fixed (parentheses in labels, commas, edge labels) ensuring diagrams always render without errors.
- ⚡ **Highly Stable Real-time Streaming**: Built with robust connection handling that supports infinite generation times—perfect for deep reasoning models (R1) without arbitrary timeouts.
- 📏 **Precision Markdown Parsing**: Accurately segregates and renders complex Markdown documents in the UI purely based on primary chapter headings.
- 🕸️ **WBS Canvas View**: Visualize any generated PRD as an interactive Work Breakdown Structure (React Flow) — features and sub-features parsed straight from the markdown, color-coded by MoSCoW priority, with zoom/pan and click-to-inspect detail panels.
- 💬 **Interactive Revisions**: Leave feedback on the generated document to incrementally refine and polish the PRD, complete with a version control system to switch between generation attempts.
- 📄 **Advanced File Context Support**: Upload reference files (PDF, DOCX, XLSX, Excel, CSV, text, and Images) to provide robust additional context and enrich the generated document.
- 🌏 **Bilingual Support & Quick Prompts**: Full generation, system prompts, and pre-built quick prompt starters supported seamlessly in both English and Indonesian.
- 🎨 **Minimalist UI**: A sleek, dark-themed interface built for focus, speed, and aesthetics with Lucide React icons replacing standard emojis.
- 📤 **Export Ready**: Instantly copy to clipboard, download as Markdown (`.md`), or print directly to PDF.

## 🕸️ WBS Canvas

Once a PRD has been generated, switch from **Document** to **WBS Canvas** using the tabs in the header. The canvas renders the PRD as an interactive Work Breakdown Structure tree — modules → features → sub-features parsed from the markdown, color-coded by MoSCoW priority, laid out as a hierarchical tree.

**Interactions:**

- **Zoom / Pan** — mouse wheel to zoom, drag to pan (or use the controls at the bottom-left); the minimap gives an overview and supports navigation. The canvas is clamped (min zoom 0.3, initial fit max 1.2) so it never shrinks to unreadable.
- **Modules start collapsed** — the canvas opens showing the root + module cards, each with a `+N` badge; click the **chevron** on any node to expand/collapse its subtree (collapse state resets when you leave the tab).
- **Click or press Enter/Space on a node** → opens a slide-in detail panel with the node's title, priority badge, the raw markdown detail snippet from the PRD, and its sub-items.
- **Close the detail panel** — click the backdrop, the close button, or press `Esc`.

**Parsing:** features are extracted automatically from the PRD markdown:

- **`### Feature Breakdown (WBS)` section** → hierarchical modules → features → sub-features (all modes); merged with MoSCoW priorities via title matching.
- **MoSCoW tables** → priority/feature source (business & technical modes).
- **`### FEAT-XX` spec blocks** → features with feature codes (simple mode fallback).
- **Any `###` heading** → last-resort fallback.

Note that parse quality depends on how closely the LLM follows the strict output format enforced in `server.ts` (FORMATTING REQUIREMENT, which now mandates the breakdown section in every mode). When a source is missing or malformed, the canvas shows an info banner with warnings instead of failing.

**Legacy PRDs** (generated before the breakdown contract) still work via the flat fallbacks, but the canvas renders wide — every feature is a top-level sibling. Regenerating the PRD produces the breakdown section and a compact, module-collapsed canvas.

**Limitations:**

- **Read-only view** — node positions are computed deterministically per render and are **not** persisted; dragging a node does not survive a re-render.
- Parsing is heuristic and tolerant: undocumented or non-conforming PRD markdown degrades to fallback strategies with warnings.

See **[docs/WBS-CANVAS.md](docs/WBS-CANVAS.md)** for the full technical reference: parser architecture, API contracts, layout algorithm, and maintenance instructions.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide React (Icons), React Markdown, **Mermaid.js** (diagram rendering)
- **Backend**: Node.js, Express.js
- **Tooling**: TypeScript, esbuild
- **Integration**: Native fetch API for OpenAI-compatible streaming — supports **DeepSeek**, **Gemini**, and **OpenCode Zen** (including 5 free models).

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- API Key from your preferred AI provider (e.g., Gemini, DeepSeek)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/TrygerZ/PRD-Architect.git
   cd PRD-Architect
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

### ⚙️ Configuration

You can fully customize the AI provider and model directly from the application's **Settings (gear icon)** within the UI. You can choose from **DeepSeek**, **Gemini**, or **OpenCode Zen** (5 free models) and specify exact models (e.g., `deepseek-v4-flash`, `gemini-2.5-pro`, `deepseek-v4-flash-free`).

#### API Key Setup

Provide your API keys through one of two methods:

**Method A: Environment Variables (.env)** _(Recommended for local dev)_
Create a `.env` file in the root of the project to set default values for the backend proxy:

```env
DEEPSEEK_API_KEY=your_deepseek_key
GEMINI_API_KEY=your_gemini_key
OPENCODE_API_KEY=your_opencode_key
```

**Method B: In-App UI**
Click the **Settings (gear icon)** inside the app to paste your Custom API Key. This stores the key in a secure httpOnly cookie via the backend, which will be used for subsequent API requests.

### 🏃‍♂️ Running the App

Start the development server:

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## 🏗️ Building for Production

Create a production build spanning the React SPA and Express backend:

```bash
npm run build
npm run start
```

The server will bind to `0.0.0.0:3000` and serve the optimized static frontend alongside the API.

## 📝 License

This project is licensed under the [MIT License](LICENSE).
