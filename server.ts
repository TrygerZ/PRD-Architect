import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { AI_CONFIG } from "./ai-config";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

function getSystemPrompt(language: string, extraPrompt: string) {
  const isEn = language === 'en';
  return `You are a highly skilled Senior Product Manager and Architect. Your job is to generate a comprehensive, enterprise-grade Product Requirements Document (PRD) mapped exactly into 11 structured chapters, using Markdown format.

The chapters MUST be exactly these 11:
${isEn ? 
`1. Executive Summary
2. Problem Definition & Market Analysis
3. Solution Overview & Scope
4. User Stories & Detailed Requirements
5. UX Design & Flow
6. Technical Specs & Architecture
7. GTM Strategy & Pricing
8. Risk Analysis & Mitigation
9. Project Timeline & Roadmap
10. Team Requirements & Budget
11. AI Agent Implementation Guidelines` : 
`1. Ringkasan Eksekutif (Executive Summary)
2. Definisi Masalah & Analisis Pasar (Problem Definition & Market Analysis)
3. Tinjauan Solusi & Ruang Lingkup (Solution Overview & Scope)
4. User Story & Kebutuhan Detail (User Stories & Detailed Requirements)
5. Desain & Alur UX (UX Design & Flow)
6. Spesifikasi Teknis & Arsitektur (Technical Specs & Architecture)
7. Strategi GTM & Skema Harga (GTM Strategy & Pricing)
8. Analisis Risiko & Mitigasi (Risk Analysis & Mitigation)
9. Linimasa Proyek & Roadmap (Project Timeline & Roadmap)
10. Kebutuhan Tim & Anggaran (Team Requirements & Budget)
11. AI Agent Implementation Guidelines (Instruksi Khusus untuk AI Coder)`}

Ensure to include:
- MANDATORY FORMATTING FOR SPECIFIC CHAPTERS:
  - Chapter 4: User Story & Kebutuhan Detail (DO NOT USE TABLES. ${isEn ? `Separate each persona using Heading 3 (###) and use this list format:` : `Pisahkan setiap persona menggunakan Heading 3 (###) dan gunakan format list berikut (tetap pertahankan istilah bahasa inggris yang natural seperti Role, Pain Point, User Story):`}
    ### Persona 1: [${isEn ? 'Name/Persona' : 'Nama/Persona'}]
    - **Role:** [${isEn ? 'Role' : 'Peran'}]
    - **${isEn ? 'Problem' : 'Masalah'}:** [${isEn ? 'Problem faced' : 'Masalah yang dihadapi'}]
    - **Pain Point:** [${isEn ? 'Main pain point' : 'Pain point utama'}]
    - **${isEn ? 'Habit' : 'Kebiasaan'}:** [${isEn ? 'Relevant habit' : 'Kebiasaan relevan'}]
    
    ${isEn ? `**(Provide a short User Story in the format: "As a [Role], I want to [Goal] so that [Benefit]")**` : `**(Berikan deskripsi singkat User Story dalam format: "Sebagai [Role], saya ingin [Tujuan] agar [Manfaat]")**`}
  - Use clean, well-structured Markdown tables ONLY for the following sections:
    - Chapter 6: Spesifikasi Teknis & Arsitektur - API Design (Columns: Endpoint, Method, Description, Request, Response). Wrap HTTP methods in inline code (e.g. \`GET\`, \`POST\`).
    - Chapter 8: Analisis Risiko & Mitigasi (Columns: ${isEn ? 'Risk, Impact, Likelihood, Mitigation Strategy' : 'Risiko, Dampak, Kemungkinan, Strategi Mitigasi'}). Wrap Impact and Likelihood levels in inline code (${isEn ? 'High, Medium' : 'Tinggi, Sedang'}).
    - Chapter 10: Kebutuhan Tim & Anggaran (Columns: ${isEn ? 'Role/Component, Description, Duration Estimate, Budget Estimate' : 'Peran/Komponen, Deskripsi, Estimasi Durasi, Estimasi Anggaran'})
  - Chapter 11 MUST explicitly contain:
    - Strict Tech Stack & Libraries rules (e.g. Tailwind, Lucide, Shadcn).
    - Expected Directory Structure (e.g. \`/src/pages\`, \`/src/components\`).
    - Core Data Types (Provide TypeScript interfaces or JSON schema for main entities).
    - AI Agent Step-by-Step Implementation Roadmap (Phase 1, Phase 2, etc.) to ensure the agent doesn't write all the code in a single prompt.
- CRITICAL TABLE GUIDELINES:
  - Keep items in tables extremely concise (max 5-7 rows per table).
  - You MUST write the table separator with exactly 3 dashes per column like this: \`|---|---|---|---|\`.
  - NEVER use more than 3 dashes in the table separator.
  - NEVER put multiple table rows on the same line.
- BE CONCISE. Avoid repeating words or characters unnecessarily.
- Markdown formatting exclusively.
- ${isEn ? 'Write entirely in English.' : 'Write mainly in Indonesian, but keep standard industry terms in English (e.g., User Story, Role, Pain Point, GTM, API, Endpoint, etc.) to maintain a natural tone.'}${extraPrompt ? '\n\n' + extraPrompt : ''}
`;
}

app.post("/api/generate-prd", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const { prompt, customApiKey, language = 'id' } = req.body;
    
    if (!prompt) {
      res.write(`data: ${JSON.stringify({ error: language === 'en' ? "Prompt is required" : "Prompt diperlukan" })}\n\n`);
      return res.end();
    }

    const apiKeyEnvName = AI_CONFIG.API_KEY_ENV_NAME;
    const customKey = customApiKey || process.env[apiKeyEnvName] || Object.entries(process.env).find(([k]) => k.toUpperCase().includes(apiKeyEnvName.split('_')[0]))?.[1];
    
    if (!customKey) {
      res.write(`data: ${JSON.stringify({ error: (language === 'en' ? "API KEY not found. Please provide a custom key or set " : "API KEY tidak ditemukan. Pastikan ada custom key atau ") + apiKeyEnvName + " in .env/Settings" })}\n\n`);
      res.end();
      return;
    }

    const endpoint = AI_CONFIG.ENDPOINT_URL;
    const modelName = AI_CONFIG.MODEL_NAME;
    const finalPrompt = getSystemPrompt(language, AI_CONFIG.SYSTEM_PROMPT_ADDITIONS);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + customKey
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: finalPrompt },
          { role: "user", content: prompt }
        ],
        stream: true,
        max_tokens: AI_CONFIG.MAX_OUTPUT_TOKENS,
        temperature: AI_CONFIG.TEMPERATURE
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Provider Error (${response.status}): ${body}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body from provider");

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') {
            continue;
          }
          try {
            const data = JSON.parse(dataStr);
            const chunkText = data.choices?.[0]?.delta?.content;
            if (chunkText) {
              res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
            }
            const finishReason = data.choices?.[0]?.finish_reason;
            if (finishReason && finishReason !== "stop" && finishReason !== null) {
                res.write(`data: ${JSON.stringify({ text: "\n\n> **Note:** Generation stopped. Reason: `" + finishReason + "`\n\n" })}\n\n`);
            }
          } catch (e) {
            console.error("Custom provider parse error", e, dataStr);
          }
        }
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();

  } catch (error) {
    console.error("Error generating PRD:", error);
    res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" })}\n\n`);
    res.end();
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
