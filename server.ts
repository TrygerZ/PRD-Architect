import express from "express";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import dotenv from "dotenv";

import multer from "multer";
import mammoth from "mammoth";
import * as xlsx from "xlsx";
import crypto from "crypto";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

dotenv.config();

// Lacak semua AbortController upstream yang sedang aktif untuk graceful shutdown (BUG L6)
const activeGenerations = new Set<AbortController>();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// CORS: development merefleksikan semua origin, production dibatasi ke origin yang diizinkan
app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' 
    ? ['http://localhost:3000'] // TODO: tambahkan domain production di sini
    : true, 
  credentials: true 
}));
// CSP: aktifkan Content-Security-Policy dasar untuk mitigasi XSS
// 'unsafe-inline' diperlukan untuk Vite HMR (development) dan Tailwind CSS
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],       // 'unsafe-inline' untuk Vite HMR di dev
      styleSrc: ["'self'", "'unsafe-inline'"],         // 'unsafe-inline' untuk Tailwind CSS
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://api.deepseek.com",
        "https://generativelanguage.googleapis.com",
      ],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: "Too many requests. Please slow down. / Terlalu banyak permintaan. Harap pelan-pelan." }
});
app.use("/api/", apiLimiter);

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
      const dataBuffer = await fsp.readFile(filePath);
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: dataBuffer });
      const result = await parser.getText({ first: 10 }); // Limit to 10 pages
      text = result.text;
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
      const buffer = await fsp.readFile(filePath, { encoding: 'utf-8' });
      text = buffer.substring(0, MAX_CHARS);
    }
  } catch (error) {
    console.error(`Error extracting text from ${originalName}:`, error);
    text = `[Error extracting text from ${originalName}]`;
  }

  return text.substring(0, MAX_CHARS);
}

app.post("/api/upload-files", (req, res) => {
  upload.array('files', 5)(req, res, async (err: any) => {
    // Ekstrak bahasa dari form field (BUG L5 — kirim 'language' dari frontend via FormData)
    const language = (req.body?.language === 'en' || req.body?.language === 'id') ? req.body.language : 'en';

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: language === 'en'
            ? "One or more files exceed the 10MB limit."
            : "Satu atau lebih file melebihi batas 10MB."
        });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({
          error: language === 'en' ? "No files uploaded" : "Tidak ada file yang diunggah"
        });
      }

      const uploadedResults = [];

      // Pre-validate all files before processing
      for (const file of files) {
        if (!file.mimetype.startsWith('image/') && file.size > 5 * 1024 * 1024) {
          // Clean up temp files
          files.forEach(f => { fs.unlink(f.path, () => {}); });
          return res.status(400).json({
            error: language === 'en'
              ? `File "${file.originalname}" exceeds the 5MB limit for documents.`
              : `File "${file.originalname}" melebihi batas 5MB untuk dokumen.`
          });
        }
      }

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
      }

      res.json(uploadedResults);
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({
        error: error.message || (language === 'en' ? "Failed to process files" : "Gagal memproses file")
      });
    } finally {
      // Ensure all temp files are cleaned up even if an error occurs mid-processing
      const files = req.files as Express.Multer.File[];
      if (files) {
        for (const file of files) {
          fs.unlink(file.path, (unlinkErr) => {
            if (unlinkErr && unlinkErr.code !== 'ENOENT') {
              console.error(`Failed to delete temp file ${file.path}:`, unlinkErr);
            }
          });
        }
      }
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

function getSystemPrompt(language: string, extraPrompt: string, productType: string = "", prdMode: string = "business") {
  const isEn = language === 'en';
  
  if (prdMode === 'business') {
    return `You are a highly skilled Senior Product Manager and Architect. Your job is to generate a comprehensive, enterprise-grade Product Requirements Document (PRD) mapped EXACTLY into 12 structured chapters using strictly Markdown format.
CRITICAL INSTRUCTIONS (FAILURE IS NOT AN OPTION):
1. NO INTRODUCTIONS OR OUTROS. Start immediately with "## 1."
2. EVERY chapter MUST start with a Markdown Heading 2 (##). Example: "## 1. Executive Summary & Value Proposition"
3. DO NOT output a main title like "# PRD" or "Here is your PRD".
4. NO PLACEHOLDERS like "[Insert Here]". Generate specific, concrete, realistic examples and metrics based on the product type.
5. NO OUTLINES OR PLANS. You must generate the ENTIRE document right now in one go.
The 12 Chapters MUST be exactly:
${isEn ? 
"## 1. Executive Summary & Value Proposition\n## 2. Problem Definition & Market Analysis (TAM/SAM/SOM, Competitors)\n## 3. Solution Overview & Scope (MoSCoW)\n## 4. User Stories & Acceptance Criteria\n## 5. UX Design, User Journey & Wireframe Flow\n## 6. High-Level Technical Architecture\n## 7. Non-Functional Requirements\n## 8. Success Metrics, Business KPIs (MRR, Churn)\n## 9. Go-to-Market (GTM) Strategy & Monetization\n## 10. Risk Register & Mitigation\n## 11. Project Timeline & 12-Week Roadmap\n## 12. Regulatory & Compliance" : 
"## 1. Executive Summary & Value Proposition (Ringkasan Eksekutif & Proposisi Nilai)\n## 2. Problem Definition & Market Analysis (TAM/SAM/SOM, Kompetitor)\n## 3. Solution Overview & Scope (MoSCoW)\n## 4. User Stories & Acceptance Criteria\n## 5. UX Design, User Journey & Wireframe Flow (Desain UX & Alur)\n## 6. High-Level Technical Architecture (Arsitektur Teknis Level Atas)\n## 7. Non-Functional Requirements (Kebutuhan Non-Fungsional)\n## 8. Success Metrics, Business KPIs (Metrik Keberhasilan & KPI Bisnis)\n## 9. Go-to-Market (GTM) Strategy & Monetization (Strategi GTM & Monetisasi)\n## 10. Risk Register & Mitigation (Daftar Risiko & Mitigasi)\n## 11. Project Timeline & 12-Week Roadmap (Linimasa Proyek & Peta Jalan 12 Minggu)\n## 12. Regulatory & Compliance (Kepatuhan & Regulasi)"}
CHAPTER CONSTRAINTS:
- Ch 2: Provide exactly 5 specific problems, a concrete Competitor analysis (min 3 real/hypothetical competitors), and an estimated TAM/SAM/SOM breakdown.
- Ch 3: Group features clearly by Must-have, Should-have, Could-have, Won't-have (MoSCoW).
- Ch 4: Use a bulleted list format. Create EXACTLY 3 personas, each with 2 stories (6 total). Add a markdown separator (---) between stories.
- Ch 6: Include an API Design Table (Endpoint, Method, Description, Request, Response). Minimum 5 endpoints.
- Ch 7: Provide exact numbers (e.g. "99.99% Uptime", "< 200ms Latency").
- Ch 8 & Ch 9 & Ch 10: MUST use Markdown Tables to structure the financial KPIs, GTM ROI estimates, and Risk Mitigation.
LANGUAGE REQUIREMENT:
Generate the entire document strictly in ${isEn ? 'English' : 'Indonesian'}.
${extraPrompt ? '\nAdditional Context from User:\n' + extraPrompt : ''}`;
  } else {
    // TECHNICAL MODE
    return `You are a highly skilled Senior Software Architect. Your job is to generate a comprehensive, purely technical architecture and engineering specification document mapped EXACTLY into 9 structured chapters using strictly Markdown format.
CRITICAL INSTRUCTIONS (FAILURE IS NOT AN OPTION):
1. NO INTRODUCTIONS OR OUTROS. Start immediately with "## 1."
2. EVERY chapter MUST start with a Markdown Heading 2 (##). Example: "## 1. Project Technical Overview & Core Objective"
3. DO NOT output a main title like "# Architecture Doc" or "Here is your spec".
4. STRICTLY TECHNICAL: ABSOLUTELY NO business text, marketing analysis, or ROI metrics. Focus 100% on raw data structures, database schemas, API specs, and engineering guidelines.
5. NO OUTLINES OR PLANS. You must generate the ENTIRE document right now in one go.
The 9 Chapters MUST be exactly:
${isEn ? 
"## 1. Project Technical Overview & Core Objective\n## 2. Feature Scope & MVP Definition (Strict MoSCoW)\n## 3. Data Models & Database Schema\n## 4. API Contracts & Interfaces\n## 5. Frontend Component Architecture & State Management\n## 6. Edge Case & Integration Testing Criteria\n## 7. Security, Auth & Non-Functional Requirements\n## 8. Error Handling, Fallbacks & Retry Strategies\n## 9. AI Agent Implementation Guidelines" : 
"## 1. Project Technical Overview & Core Objective (Ringkasan Teknis & Obyektif Inti)\n## 2. Feature Scope & MVP Definition (Cakupan Fitur & Definisi MVP - Strict MoSCoW)\n## 3. Data Models & Database Schema (Model Data & Skema Database)\n## 4. API Contracts & Interfaces (Kontrak API & Antarmuka)\n## 5. Frontend Component Architecture & State Management (Arsitektur Komponen & Manajemen State)\n## 6. Edge Case & Integration Testing Criteria (Kriteria Pengujian Edge Case)\n## 7. Security, Auth & Non-Functional Requirements (Keamanan, Auth & Kebutuhan Non-Fungsional)\n## 8. Error Handling, Fallbacks & Retry Strategies (Penanganan Error & Strategi Retry)\n## 9. AI Agent Implementation Guidelines (Instruksi Khusus untuk AI Coder)"}
CHAPTER CONSTRAINTS:
- Ch 3 (Data Models): MUST include detailed tables indicating Column Name, Data Type (ORM specific), Relations (1:N, M:N), Constraints (Nullable, Unique), and Indexes.
- Ch 4 (API Contracts): MUST include literal JSON block examples for Payload Requests and Responses for at least 5 core endpoints.
- Ch 5 (Frontend): MUST define UI component hierarchies, URL Routing paths, and State Management logic (e.g. Redux, Zustand contexts).
- Ch 6 (Testing): List at least 6 critical edge cases focusing on race conditions, concurrent requests, and API failures. Add a markdown separator (---) between cases.
- Ch 7 (Security): Detail Auth flows (e.g., JWT, OAuth2), RBAC policies, Rate Limiting logic, and exact performance thresholds.
- Ch 8 (Errors): Define HTTP Status Code mappings, global error boundary strategies, and offline/fallback states.
- Ch 9 (AI Guidelines): Provide exact step-by-step CLI commands or structural instructions for an AI coder (Cursor/Copilot) to initialize and build the project from this spec.
LANGUAGE REQUIREMENT:
Generate the entire document strictly in ${isEn ? 'English' : 'Indonesian'}. 
${extraPrompt ? '\nAdditional Context from User:\n' + extraPrompt : ''}`;
  }
}

function getRevisionPrompt(language: string) {
  if (language === 'id') {
    return `Anda adalah editor yang merevisi Product Requirements Document yang sudah ada.

INSTRUKSI KRITIS:
1. OUTPUT DOKUMEN MARKDOWN LENGKAP dengan HANYA revisi yang diminta
2. Fokus HANYA pada bagian yang disebutkan dalam feedback di bawah
3. Biarkan SEMUA bagian yang tidak diubah PERSIS kata-per-kata — jangan menulis ulang
4. Hanya modifikasi konten yang secara spesifik terkait feedback yang diberikan
5. Pertahankan gaya penulisan, nada, dan format yang SAMA
6. Output murni Markdown — tanpa pembukaan, tanpa catatan, tanpa penjelasan
7. JANGAN menambahkan bagian baru kecuali diminta secara eksplisit
8. JANGAN menghapus konten yang ada kecuali feedback secara spesifik meminta
9. Output Anda akan MENGGANTIKAN seluruh dokumen yang ada, jadi Anda HARUS menyertakan SEMUANYA`;
  }
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
  if (language === 'id') {
    return `Anda sedang melengkapi Product Requirements Document yang sudah ada.

INSTRUKSI KRITIS:
1. OUTPUT DOKUMEN MARKDOWN LENGKAP dengan informasi yang diminta DITAMBAHKAN
2. JANGAN mengubah atau me-regenerasi konten yang sudah ada — biarkan PERSIS kata-per-kata
3. Sisipkan konten baru di bagian yang paling relevan
4. Pertahankan gaya penulisan, nada, dan format yang SAMA — jangan memformat ulang apa pun
5. Output murni Markdown — tanpa pembukaan, tanpa catatan, tanpa penjelasan
6. PERTAHANKAN SEMUA konten yang ada persis seperti aslinya — reproduksi dengan setia
7. Output Anda akan MENGGANTIKAN seluruh dokumen yang ada, jadi Anda HARUS menyertakan SEMUANYA`;
  }
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
  res.flushHeaders();

  let abortController: AbortController | null = null;
  // Ekstrak language di luar try agar accessible di catch block (BUG L5)
  const language: "id" | "en" = (req.body?.language === 'en' || req.body?.language === 'id') ? req.body.language : 'id';
  try {
    const { prompt, customApiKey, provider = 'deepseek', model = 'deepseek-v4-flash', productType, uploadedFiles, mode = 'initial', prdMode = 'business' } = req.body;

    // Validate provider
    const VALID_PROVIDERS = ["deepseek", "gemini"];
    if (!VALID_PROVIDERS.includes(provider)) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: language === 'en' ? `Invalid provider "${provider}". Must be one of: ${VALID_PROVIDERS.join(", ")}` : `Provider "${provider}" tidak valid. Harus salah satu dari: ${VALID_PROVIDERS.join(", ")}` })}\n\n`);
        res.end();
      }
      return;
    }

    if (!prompt) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: language === 'en' ? "Prompt is required" : "Prompt diperlukan" })}\n\n`);
        res.end();
      }
      return;
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

    let finalUserPrompt = prompt + fileContext;
    // --- FORCED EXECUTION DIRECTIVE (SOLUSI BASA-BASI) ---
    // Berlaku secara universal untuk Business maupun Technical
    if (mode === 'initial') {
      const firstHeading = prdMode === 'business' 
        ? "## 1. Executive Summary" 
        : "## 1. Project Technical Overview";
      const forcedDirectiveEn = `\n\nCRITICAL REMINDER: Do NOT give me an outline, plan, or introduction. You MUST generate the ENTIRE comprehensive document right now. Start your response immediately with "${firstHeading}" and NOTHING ELSE. Output the full raw Markdown.`;
      const forcedDirectiveId = `\n\nPENGINGAT KRITIS: JANGAN berikan saya outline, rencana, atau kata pengantar. Anda HARUS menghasilkan KESELURUHAN dokumen secara utuh sekarang juga. Mulai respons Anda langsung dengan "${firstHeading}" dan TANPA BASA-BASI APA PUN. Output harus berupa Markdown murni.`;
      
      finalUserPrompt += language === 'en' ? forcedDirectiveEn : forcedDirectiveId;
    }

    let apiKeyEnvName = "";
    let endpoint = "";
    let modelName = model;

    if (provider === "gemini") {
      apiKeyEnvName = "GEMINI_API_KEY";
      // OpenAI-compatible endpoint (stable as of 2025 — Google Generative Language API)
      endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      if (!modelName) modelName = "gemini-2.5-flash";
    } else {
      apiKeyEnvName = "DEEPSEEK_API_KEY";
      endpoint = "https://api.deepseek.com/chat/completions";
      if (!modelName) modelName = "deepseek-v4-flash";
    }

    // Server-side API key fallback
    const serverKey = process.env[apiKeyEnvName];
    const apiKey = customApiKey || serverKey;

    if (!apiKey) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: language === 'en' ? "API KEY not found. Please provide a custom key in Settings or set " + apiKeyEnvName + " in .env file." : "API KEY tidak ditemukan. Silakan masukkan API Key di Pengaturan atau set " + apiKeyEnvName + " di file .env." })}\n\n`);
        res.end();
      }
      return;
    }

    let modeInstructions = '';
    if (mode === 'revision') {
      modeInstructions = getRevisionPrompt(language);
    } else if (mode === 'append') {
      modeInstructions = getAppendPrompt(language);
    }

    // Dapatkan prompt spesifik industri (E-Commerce, SaaS, Fintech, dll.)
    const industryPrompt = getIndustrySpecificPrompt(productType);

    let finalPrompt;
    if (mode === 'initial') {
      finalPrompt = getSystemPrompt(language, industryPrompt, productType, prdMode);
    } else {
      // Gabungkan: full system prompt + mode instructions di akhir
      finalPrompt = getSystemPrompt(language, industryPrompt, productType, prdMode) + '\n\n' + modeInstructions;
    }

    abortController = new AbortController();
    activeGenerations.add(abortController); // Lacak untuk graceful shutdown (BUG L6)
    
    // Handle client disconnect (Gunakan res, BUKAN req)
    res.on("close", () => {
      console.log("CLIENT DISCONNECTED. Aborting fetch...");
      abortController.abort();
    });

    // 1. Konfigurasi semua header terlebih dahulu
    let fetchHeaders: any = {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey,
    };

    // 2. Siapkan body request
    let fetchBody: any = {};

    if (provider === "gemini") {
      fetchBody = {
        model: modelName,
        messages: [
          { role: "system", content: finalPrompt },
          { role: "user", content: finalUserPrompt }
        ],
        stream: true,
        max_tokens: 8192,
        temperature: 0.1,
      };
    } else {
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

    // 3. Buat fetchOptions SETELAH semua header dan body selesai dikonfigurasi
    let fetchOptions: RequestInit = {
      method: "POST",
      headers: fetchHeaders,
      signal: abortController.signal,
      body: JSON.stringify(fetchBody),
    };

    const response = await fetch(endpoint, fetchOptions);

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
            const contentText = data.choices?.[0]?.delta?.content || data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const reasoningText = data.choices?.[0]?.delta?.reasoning_content || "";

            if (contentText || reasoningText) {
              res.write(`data: ${JSON.stringify({ text: contentText, reasoning: reasoningText })}\n\n`);
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
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Request aborted.');
      if (!res.writableEnded) {
        res.write(`data: [DONE]\n\n`);
        res.end();
      }
      return;
    }
    console.error("Error generating PRD:", error);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : (language === 'en' ? "Internal server error" : "Kesalahan server internal") })}\n\n`);
      res.end();
    }
  } finally {
    // Bersihkan AbortController dari tracking (BUG L6)
    if (abortController) {
      activeGenerations.delete(abortController);
    }
  }
});

async function main() {
  await startServer();

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown — batalkan semua koneksi upstream yang masih aktif (BUG L6)
  const gracefulShutdown = () => {
    console.log(`Shutting down... ${activeGenerations.size} active upstream connection(s) will be aborted.`);
    // Abort semua koneksi upstream ke AI provider yang masih aktif
    for (const controller of activeGenerations) {
      controller.abort();
    }
    activeGenerations.clear();

    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });

    // Force exit setelah 10 detik jika server masih belum tertutup (menghindari hanging)
    setTimeout(() => {
      console.error('Forced shutdown after timeout — some connections may still be hanging.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => {
    console.log('SIGTERM received.');
    gracefulShutdown();
  });
  process.on('SIGINT', () => {
    console.log('SIGINT received.');
    gracefulShutdown();
  });
}

main();

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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
}
