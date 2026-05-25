<div align="center">
  <h1>🚀 AI PRD Generator</h1>
  <p>An enterprise-grade Product Requirements Document (PRD) generator powered by AI.</p>

  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Express.js-404D59?style=for-the-badge" alt="Express" />
</div>

<br />

AI PRD Generator is a modern, full-stack application designed to automatically draft comprehensive Product Requirements Documents based on simple prompts. It enforces a strict 11-chapter enterprise structure, ensuring consistency and quality out of the box.

## ✨ Features

- **Bring Your Own Model (BYOM)**: Easily switch between AI providers (DeepSeek, OpenAI, Groq, Ollama, etc.) by changing a single configuration file.
- **Enterprise Structure**: Generates PRDs mapped exactly into 11 industry-standard chapters.
- **Real-time Streaming**: Watch your document generate in real-time with continuous Markdown rendering.
- **Cyberpunk UI**: A sleek, minimal, dark-themed interface built for focus and speed.
- **Export Ready**: Copy or download the generated markdown easily.

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS v4, Lucide React
- **Backend**: Node.js, Express.js
- **Tooling**: TypeScript, esbuild

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm
- API Key from your preferred AI provider (e.g., DeepSeek, OpenAI)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ai-prd-generator.git
   cd ai-prd-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

### Configuration

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
Provide your API key through one of the following methods:

**Method A: Environment Variables (.env)**
Create a `.env` file in the root of the project:
```env
GEMINI_API_KEY=your_api_key_here
```

**Method B: In-App UI**
Click the **Key icon** inside the app to paste your API Key. This overrides environment variables and stores the key securely in your browser's local storage.

### Running the App

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
The server will bind to `0.0.0.0:3000` and serve the static frontend alongside the API.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/yourusername/ai-prd-generator/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
