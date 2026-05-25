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

The generated document strictly adheres to an 11-chapter industry-standard structure, ensuring that everything from user personas and technical specifications to risk analysis and budget estimates is covered comprehensively.

## ✨ Features

- 🧠 **Bring Your Own Model (BYOM)**: Seamlessly switch between AI providers (Gemini, DeepSeek, OpenAI, Groq, or local models via Ollama) by adjusting a single configuration file.
- 📐 **Enterprise Structure**: Enforces a strict 11-chapter format, generating consistent and high-quality PRDs out of the box.
- ⚡ **Real-time Streaming Output**: Watch your document take shape in real-time with responsive Markdown rendering.
- 💬 **Interactive Revisions**: Leave feedback on the generated document to incrementally refine and polish the PRD.
- 🎨 **Cyberpunk Minimalist UI**: A sleek, dark-themed interface built for focus, speed, and aesthetics.
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

You can fully customize the AI provider in the `ai-config.ts` file located in the root directory. By default, it accesses Google's `gemini-2.5-flash` model, but you can configure it for **any OpenAI-compatible API** (DeepSeek, Groq, Ollama, OpenAI).

```typescript
export const AI_CONFIG = {
  // Example for Gemini (Default)
  ENDPOINT_URL: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  MODEL_NAME: "gemini-2.5-flash",
  API_KEY_ENV_NAME: "GEMINI_API_KEY", 
  
  // Example for DeepSeek
  // ENDPOINT_URL: "https://api.deepseek.com/chat/completions",
  // MODEL_NAME: "deepseek-chat",
  // API_KEY_ENV_NAME: "DEEPSEEK_API_KEY",

  // Example for OpenAI
  // ENDPOINT_URL: "https://api.openai.com/v1/chat/completions",
  // MODEL_NAME: "gpt-4o",
  // API_KEY_ENV_NAME: "OPENAI_API_KEY",
  
  // ... other configs
};
```

#### API Key Setup
Provide your API key through one of two methods:

**Method A: Environment Variables (.env)** *(Recommended for local dev)*
Create a `.env` file in the root of the project:
```env
GEMINI_API_KEY=your_api_key_here
```

**Method B: In-App UI**
Click the **Settings (gear icon)** inside the app to paste your API Key. This overrides environment variables and stores the key securely in your browser's local storage.

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

