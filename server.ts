import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

import mammoth from "mammoth";
import * as xlsx from "xlsx";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const uploadDir = path.join(os.tmpdir(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'application/pdf',
    'text/markdown',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype) || file.originalname.endsWith('.md') || file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilter
});

async function extractTextFromFile(filePath: string, mimeType: string, originalName: string): Promise<string> {
  const MAX_CHARS = 50000;
  let text = "";

  try {
    if (mimeType === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      text = data.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value;
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'text/csv' ||
      originalName.endsWith('.csv') ||
      originalName.endsWith('.xlsx')
    ) {
      const workbook = xlsx.readFile(filePath);
      const sheetNames = workbook.SheetNames;
      sheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        text += `\n--- Sheet: ${sheetName} ---\n`;
        text += xlsx.utils.sheet_to_csv(worksheet);
      });
    } else if (mimeType.startsWith('image/')) {
      text = `[IMAGE: ${originalName}]`;
    } else {
      // Handle text/plain, text/markdown
      text = fs.readFileSync(filePath, 'utf-8');
    }
  } catch (error) {
    console.error(`Error extracting text from ${originalName}:`, error);
    text = `[Error extracting text from ${originalName}]`;
  }

  return text.substring(0, MAX_CHARS);
}

app.post("/api/upload-files", (req, res) => {
  upload.array('files', 5)(req, res, async (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "One or more files exceed the 10MB limit." });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const uploadedResults = [];

      for (const file of files) {
        const content = await extractTextFromFile(file.path, file.mimetype, file.originalname);
        
        uploadedResults.push({
          id: crypto.randomUUID(),
          name: file.originalname,
          size: file.size,
          type: file.mimetype,
          content: content,
          charCount: content.length
        });

        // Cleanup temp file
        fs.unlink(file.path, (unlinkErr) => {
          if (unlinkErr) console.error(`Failed to delete temp file ${file.path}:`, unlinkErr);
        });
      }

      res.json(uploadedResults);
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message || "Failed to process files" });
    }
  });
});

function getIndustrySpecificPrompt(productType: string): string {
  if (!productType) return "";
  const pt = productType.toLowerCase();
  if (pt.includes('ecommerce') || pt.includes('e-commerce') || pt.includes('marketplace') || pt.includes('toko') || pt.includes('jual')) {
    return `\n\nFor E-Commerce/Marketplace:\n- Emphasize secure payment gateways, cart management, checkout flows, and inventory sync.\n- Success metrics must include Conversion Rate, Cart Abandonment Rate, and GMV.\n`;
  }
  if (pt.includes('saas') || pt.includes('b2b') || pt.includes('dashboard')) {
    return `\n\nFor SaaS/B2B:\n- Emphasize multi-tenancy, Role-Based Access Control (RBAC), subscription billing, and data exports.\n- Success metrics must include MRR/ARR, Churn Rate, and Active Users.`;
  }
  if (pt.includes('fintech') || pt.includes('keuangan') || pt.includes('bank')) {
    return `\n\nFor Fintech:\n- Emphasize extreme security, PCI-DSS compliance, audit trails, and transaction idempotency.\n- Compliance chapter MUST include OJK/BI regulations (if in Indonesia) or relevant financial standards.`;
  }
  if (pt.includes('edtech') || pt.includes('belajar') || pt.includes('kursus')) {
    return `\n\nFor EdTech:\n- Emphasize video streaming capabilities, progress tracking, gamification, and interactive assessments.\n- User roles usually split into Student, Instructor, and Admin.`;
  }
  if (pt.includes('healthtech') || pt.includes('kesehatan') || pt.includes('medis')) {
    return `\n\nFor HealthTech:\n- Emphasize HIPAA or local health data compliance (e.g. SATUSEHAT in Indonesia), data privacy, and secure teleconsultations.`;
  }
  return "";
}

function getSystemPrompt(language: string, extraPrompt: string, productType: string = "") {
  const isEn = language === 'en';
  
  return `You are a highly skilled Senior Product Manager and Architect. Your job is to generate a comprehensive, enterprise-grade Product Requirements Document (PRD) mapped exactly into 12 structured chapters, using Markdown format.

CRITICAL RULES:
1. Output adalah Markdown murni — tanpa kata pengantar, tanpa penutup
2. Setiap chapter adalah heading level 2 (##)
3. TIDAK ADA placeholder — semua konten harus konkret

The chapters MUST be exactly these 12:
${isEn ? 
`1. Executive Summary
2. Problem Definition & Market Analysis
3. Solution Overview & Scope (MoSCoW)
4. User Stories & Acceptance Criteria
5. UX Design & Flow
6. Technical Specs & Architecture
7. Non-Functional Requirements
8. Success Metrics & KPIs
9. Risk Register & Mitigation
10. Regulatory & Compliance
11. Project Timeline & Roadmap
12. AI Agent Implementation Guidelines` : 
`1. Executive Summary (Ringkasan Eksekutif)
2. Problem Definition & Market Analysis (Definisi Masalah & Analisis Pasar)
3. Solution Overview & Scope (MoSCoW)
4. User Stories & Acceptance Criteria
5. UX Design & Flow (Desain & Alur UX)
6. Technical Specs & Architecture (Spesifikasi Teknis & Arsitektur)
7. Non-Functional Requirements (Kebutuhan Non-Fungsional)
8. Success Metrics & KPIs (Metrik Keberhasilan & KPI)
9. Risk Register & Mitigation (Daftar Risiko & Mitigasi)
10. Regulatory & Compliance (Kepatuhan & Regulasi)
11. Project Timeline & Roadmap (Linimasa Proyek & Peta Jalan)
12. AI Agent Implementation Guidelines (Instruksi Khusus untuk AI Coder)`}

Ensure to include the following content constraints for each chapter:

**Chapter 1: Executive Summary**
Includes product goals, problems solved, target users, and value proposition.

**Chapter 2: Problem Definition & Market Analysis**
- Exactly 5 specific problems.
- Competitor analysis (minimum 3 competitors).
- TAM/SAM/SOM analysis.

**Chapter 3: Solution Overview & Scope (MoSCoW)**
Feature classification (Must/Should/Could/Won't) with reasons.

**Chapter 4: User Stories & Acceptance Criteria**
Use list format. Provide EXACTLY 3 personas, 2 stories each (6 total). MUST use horizontal separator (\`---\`) after each story.

**Chapter 5: UX Design & Flow**
Happy Path, Alternative/Error Flow, UI States (Loading, Empty, Error, Success).

**Chapter 6: Technical Specs & Architecture**
- API Design Table (Endpoint, Method, Description, Request, Response) — minimal 5 endpoint
- Tech stack, architecture design, database design

**Chapter 7: Non-Functional Requirements**
Performance, Security, Scalability, Availability, Usability, SEO (use specific numbers).

**Chapter 8: Success Metrics & KPIs**
Business (3), Technical (2), User Satisfaction (1). Table format.

**Chapter 9: Risk Register & Mitigation**
Minimum 5 risks. Table format.

**Chapter 10: Regulatory & Compliance**
List regulations or state "No specific regulation".

**Chapter 11: Project Timeline & Roadmap**
MVP phase, 12-week sprint plan, milestones.

**Chapter 12: AI Agent Implementation Guidelines**
Tech stack recommendation, directory structure, core data types, AI agent roadmap (phases).
${getIndustrySpecificPrompt(productType)}

**FORMATTING RULES:**
- Heading level 2 (##) untuk judul chapter
- Tabel hanya untuk API Design, Risk Register, Success Metrics
- User Stories pakai list format dengan field: Role, Problem, Pain Point, Habit, User Story, Acceptance Criteria, Edge Cases
- 3 personas × 2 stories = 6 total user stories
- TIDAK ADA placeholder. Semua konten harus spesifik dan konkret
- Bahasa mengikuti pengaturan: Indonesia atau English
- Konsisten: gunakan gaya, format, dan tone yang sama di seluruh dokumen

**OUTPUT TEMPLATE:**
Setiap chapter dimulai dengan \`## [nomor]. [Judul Chapter]\` (heading level 2).
User Stories menggunakan list format (bukan tabel) dengan field: Role, Problem, Pain Point, Habit, User Story, Acceptance Criteria, Edge Cases.
Tabel hanya untuk: API Design, Risk Register, Success Metrics.
Jangan gunakan placeholder — semua konten harus konkret dan spesifik.
${extraPrompt ? '\n\n' + extraPrompt : ''}`;
}

function getRevisionPrompt(language: string) {
  const isEn = language === 'en';
  return `You are an editor revising an existing Product Requirements Document.

CRITICAL INSTRUCTIONS:
1. OUTPUT THE COMPLETE, FULL MARKDOWN DOCUMENT with ONLY the requested revisions
2. Focus ONLY on the sections mentioned in the feedback below
3. Keep ALL unchanged sections EXACTLY word-for-word — do not rewrite them
4. Only modify content specifically related to the provided feedback
5. Maintain the SAME writing style, tone, and format
6. Output pure Markdown — no preamble, no notes, no explanations
7. Do NOT add new sections unless explicitly requested
8. Do NOT remove existing content unless feedback specifically says to
9. Your output will REPLACE the entire existing document, so you MUST include EVERYTHING`;
}

function getAppendPrompt(language: string) {
  const isEn = language === 'en';
  return `You are enhancing an existing Product Requirements Document.

CRITICAL INSTRUCTIONS:
1. OUTPUT THE COMPLETE, FULL MARKDOWN DOCUMENT with the requested information ADDED
2. Do NOT change or regenerate existing content — keep it EXACTLY word-for-word
3. Insert new content in the most relevant existing section
4. Maintain the SAME writing style, tone, and format — do not reformat anything
5. Output pure Markdown — no preamble, no notes, no explanations
6. PRESERVE ALL existing content exactly as-is — reproduce it faithfully
7. Your output will REPLACE the entire existing document, so you MUST include EVERYTHING`;
}

app.post("/api/generate-prd", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const { prompt, customApiKey, provider = 'deepseek', model = 'deepseek-chat', language = 'id', productType, uploadedFiles, mode = 'initial' } = req.body;
    
    if (!prompt) {
      res.write(`data: ${JSON.stringify({ error: language === 'en' ? "Prompt is required" : "Prompt diperlukan" })}\n\n`);
      return res.end();
    }

    let fileContext = '';
    if (Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
      fileContext += `\n\n### REFERENSI FILE PENDUKUNG ###\n`;
      fileContext += `Gunakan referensi dari file-file berikut untuk memperkaya konteks dan akurasi dokumen yang akan di-generate:\n\n`;
      uploadedFiles.forEach(file => {
        const truncatedContent = file.content.length > 8000 ? file.content.substring(0, 8000) + "... [TRUNCATED]" : file.content;
        fileContext += `--- FILE START: ${file.name} (Type: ${file.type}) ---\n`;
        fileContext += `${truncatedContent}\n`;
        fileContext += `--- FILE END: ${file.name} ---\n\n`;
      });
    }

    const finalUserPrompt = prompt + fileContext;

    let apiKeyEnvName = "";
    let endpoint = "";
    let modelName = model;

    if (provider === "gpt") {
      apiKeyEnvName = "OPENAI_API_KEY";
      endpoint = "https://api.openai.com/v1/chat/completions";
      if (!modelName) modelName = "gpt-4o";
    } else if (provider === "gemini") {
      apiKeyEnvName = "GEMINI_API_KEY";
      endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      if (!modelName) modelName = "gemini-2.5-flash";
    } else if (provider === "claude") {
      apiKeyEnvName = "ANTHROPIC_API_KEY";
      endpoint = "https://api.anthropic.com/v1/messages";
      if (!modelName) modelName = "claude-3-7-sonnet-20250219";
    } else {
      apiKeyEnvName = "DEEPSEEK_API_KEY";
      endpoint = "https://api.deepseek.com/chat/completions";
      if (!modelName) modelName = "deepseek-v4-flash";
    }

    const customKey = customApiKey;
    
    if (!customKey) {
      res.write(`data: ${JSON.stringify({ error: language === 'en' ? "API KEY not found. Please provide a custom key in Settings." : "API KEY tidak ditemukan. Silakan masukkan API Key di Pengaturan." })}\n\n`);
      res.end();
      return;
    }

    let modeInstructions = '';
    if (mode === 'revision') {
      modeInstructions = getRevisionPrompt(language);
    } else if (mode === 'append') {
      modeInstructions = getAppendPrompt(language);
    }

    let finalPrompt;
    if (mode === 'initial') {
      finalPrompt = getSystemPrompt(language, "", productType);
    } else {
      // Gabungkan: full system prompt + mode instructions di akhir
      finalPrompt = getSystemPrompt(language, "", productType) + '\n\n' + modeInstructions;
    }

    let fetchHeaders: any = {
      "Content-Type": "application/json",
    };
    let fetchBody: any = {};

    if (provider === "claude") {
      fetchHeaders["x-api-key"] = customKey;
      fetchHeaders["anthropic-version"] = "2023-06-01";
      fetchBody = {
        model: modelName,
        system: finalPrompt,
        messages: [
          { role: "user", content: finalUserPrompt }
        ],
        max_tokens: 16384,
        temperature: 0.2,
        stream: true,
      };
    } else {
      fetchHeaders["Authorization"] = "Bearer " + customKey;
      fetchBody = {
        model: modelName,
        messages: [
          { role: "system", content: finalPrompt },
          { role: "user", content: finalUserPrompt }
        ],
        stream: true,
        max_tokens: 16384,
        temperature: 0.1,
        top_p: 0.1,
        seed: 42,
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: fetchHeaders,
      body: JSON.stringify(fetchBody)
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Provider Error (${response.status}): ${body}`);
      throw new Error(language === 'en'
        ? 'AI provider returned an error. Please check your API key and model settings.'
        : 'Penyedia AI mengembalikan error. Periksa API key dan pengaturan model Anda.');
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
            if (provider === 'claude') {
              if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
                res.write(`data: ${JSON.stringify({ text: data.delta.text })}\n\n`);
              }
            } else {
              const chunkText = data.choices?.[0]?.delta?.content;
              if (chunkText) {
                res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
              }
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
