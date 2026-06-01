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

**PRD Architect** is a modern, full-stack application designed to dramatically accelerate the product planning phase. By taking a simple product idea as input, it automatically generates a highly structured, enterprise-grade **Product Requirements Document (PRD)**.

The generated document strictly adheres to a 12-chapter industry-standard structure, ensuring that everything from user personas and technical specifications to risk analysis, budget estimates, and AI coding guidelines is covered comprehensively.

## ✨ Features

- 🧠 **Bring Your Own Model (BYOM)**: Seamlessly switch between AI providers (DeepSeek, Claude, Gemini, OpenAI) and select specific models via the in-app Settings UI. Tuned for output up to `16,384` max tokens for DeepSeek V4 and Claude 3.7.
- 📐 **Enterprise Structure**: Enforces a strict 12-chapter format (including dedicated AI Agent Implementation Guidelines), generating consistent and high-quality PRDs out of the box.
- ⚡ **Real-time Streaming Output**: Watch your document take shape in real-time with responsive Markdown rendering.
- 💬 **Interactive Revisions**: Leave feedback on the generated document to incrementally refine and polish the PRD, complete with a version control system to switch between generation attempts.
- 📄 **Advanced File Context Support**: Upload reference files (PDF, DOCX, XLSX, Excel, CSV, text, and Images) to provide robust additional context and enrich the generated document.
- 🌏 **Bilingual Support & Quick Prompts**: Full generation, system prompts, and pre-built quick prompt starters supported seamlessly in both English and Indonesian.
- 🎨 **Cyberpunk Minimalist UI**: A sleek, dark-themed interface built for focus, speed, and aesthetics (now featuring sleek loading skeletons).
- 📤 **Export Ready**: Instantly copy to clipboard, download as Markdown (`.md`), or print directly to PDF.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide React (Icons), React Markdown
- **Backend**: Node.js, Express.js
- **Tooling**: TypeScript, esbuild
- **Integration**: `@google/genai` (For Gemini streaming) or generic OpenAI-compatible streaming clients.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- API Key from your preferred AI provider (e.g., Gemini, DeepSeek, OpenAI)

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

You can fully customize the AI provider and model directly from the application's **Settings (gear icon)** within the UI. You can choose from **DeepSeek, Claude, Gemini, and GPT** and specify exact models (e.g., `deepseek-v4-flash`, `claude-4.5-sonnet`, `gpt-5.5`, `gemini-3.5-flash`).

#### API Key Setup

Provide your API keys through one of two methods:

**Method A: Environment Variables (.env)** _(Recommended for local dev)_
Create a `.env` file in the root of the project to set default values for the backend proxy:

```env
DEEPSEEK_API_KEY=your_deepseek_key
ANTHROPIC_API_KEY=your_claude_key
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
```

**Method B: In-App UI**
Click the **Settings (gear icon)** inside the app to paste your Custom API Key. This overrides environment variables and stores the key securely in your browser's local storage to be passed with your requests.

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
