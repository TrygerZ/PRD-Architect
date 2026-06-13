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

**PRD Architect** is a modern, full-stack application designed to dramatically accelerate the product planning phase. By taking a simple product idea as input, it automatically generates a highly structured, enterprise-grade Product Requirements Document (PRD) or Technical Specification Document.

It features a **Dual-Mode** generation engine, each with comprehensively enhanced chapters:
- **💼 Business & Investor Mode (12 Chapters)**: Covers Stakeholder Analysis, Problem Statement, Assumptions & Constraints, Non-Goals, TAM/SAM/SOM, MoSCoW scoping, Enhanced User Stories (Given/When/Then format + Epic hierarchy), Classified NFRs (Performance/Scalability/Security/Usability/Availability), Baseline-backed KPIs, GTM Strategy, Risk Register with scoring, 12-week roadmap, and Regulatory Compliance.
- **💻 Technical & AI Agent Mode (9 Chapters)**: Covers System Context Diagram, Alternatives Considered, Non-Goals, Data Models with ERD, API Contracts with full Error Responses (400/401/403/404/409/500), Frontend Architecture with Data Flow Diagrams, Testing Pyramid Strategy, Classified NFRs, Retry Strategy with exponential backoff, and AI Agent Implementation Guidelines with structured templates.

## ✨ Features

- 🌓 **Dual-Mode Generation**: Clean toggle between high-level Business/Investor strategies and deep Technical specifications.
- 🧠 **Bring Your Own Model (BYOM)**: Seamlessly switch between AI providers (DeepSeek, Gemini, **OpenCode Zen**) and select specific models via the in-app Settings UI.
- 🆓 **Free AI Models**: OpenCode Zen provides 5 free models (deepseek-v4-flash-free, nemotron-3-ultra-free, mimo-v2.5-free, north-mini-code-free, big-pickle) — no credit card required.
- 📊 **Live Mermaid Diagrams**: Generated PRDs include rich, interactive diagrams rendered in real-time — System Context (graph), Entity Relationships (ERD), User Journeys (journey), Gantt Roadmaps (gantt), and Data Flows (sequenceDiagram).
- 🛡️ **Auto-Sanitized Mermaid Syntax**: AI-generated diagram syntax is automatically fixed (parentheses in labels, commas, edge labels) ensuring diagrams always render without errors.
- ⚡ **Highly Stable Real-time Streaming**: Built with robust connection handling that supports infinite generation times—perfect for deep reasoning models (R1) without arbitrary timeouts.
- 📏 **Precision Markdown Parsing**: Accurately segregates and renders complex Markdown documents in the UI purely based on primary chapter headings.
- 💬 **Interactive Revisions**: Leave feedback on the generated document to incrementally refine and polish the PRD, complete with a version control system to switch between generation attempts.
- 📄 **Advanced File Context Support**: Upload reference files (PDF, DOCX, XLSX, Excel, CSV, text, and Images) to provide robust additional context and enrich the generated document.
- 🌏 **Bilingual Support & Quick Prompts**: Full generation, system prompts, and pre-built quick prompt starters supported seamlessly in both English and Indonesian.
- 🎨 **Minimalist UI**: A sleek, dark-themed interface built for focus, speed, and aesthetics with Lucide React icons replacing standard emojis.
- 📤 **Export Ready**: Instantly copy to clipboard, download as Markdown (`.md`), or print directly to PDF.

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
