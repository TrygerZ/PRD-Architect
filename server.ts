import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { AI_CONFIG } from "./ai-config";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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

The document has TWO primary audiences:
1. HUMAN READERS: Product managers, developers, stakeholders.
2. AI CODER: Must be clear enough for an AI coding agent to implement directly.

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
- Feature classification: Must-have, Should-have, Could-have, Won't-have.
- MUST include reasons for every categorization.

**Chapter 4: User Stories & Acceptance Criteria**
Use EXACTLY this structure for EVERY user story (use list format, NO TABLES):
- **Role:** [${isEn ? 'specific role' : 'peran spesifik'}]
- **Problem:** [${isEn ? 'specific problem' : 'masalah spesifik'}]
- **Pain Point:** [${isEn ? 'specific pain point' : 'pain point spesifik'}]
- **Habit:** [${isEn ? 'specific habit' : 'kebiasaan spesifik'}]
- **User Story:** ${isEn ? 'As a [role], I want to [action] so that [benefit]' : 'Sebagai [role], saya ingin [tindakan] sehingga [manfaat]'}
- **Acceptance Criteria:**
  - [ ] [${isEn ? 'testable condition 1' : 'kondisi yang dapat diuji 1'}]
  - [ ] [${isEn ? 'testable condition 2' : 'kondisi yang dapat diuji 2'}]
  - [ ] [${isEn ? 'testable condition 3' : 'kondisi yang dapat diuji 3'}]
- **Edge Cases:**
  - [${isEn ? 'error/boundary scenario 1' : 'skenario error 1'}]
  - [${isEn ? 'error/boundary scenario 2' : 'skenario error 2'}]
Provide minimum 3 different personas, each with at least 2 user stories.

**Chapter 5: UX Design & Flow**
MUST include:
- Happy Path (5-10 detailed steps).
- Alternative/Error Flow (minimum 1 scenario per flow).
- UI States: Loading, Empty, Error, Success.

**Chapter 6: Technical Specs & Architecture**
- API Design Table (Columns: Endpoint, Method, Description, Request, Response). Minimum 5 endpoints.
- Tech stack, architecture design, and database design.

**Chapter 7: Non-Functional Requirements**
MUST cover these 6 dimensions with SPECIFIC NUMBERS: 
- Performance (e.g. LCP < 2.5s, API p95 < 500ms)
- Security (e.g. JWT, RBAC, rate limiting)
- Scalability (e.g. horizontal scaling, CDN)
- Availability (e.g. 99.9% uptime)
- Usability (e.g. responsive, WCAG 2.1 AA)
- SEO (e.g. SSR, semantic HTML).

**Chapter 8: Success Metrics & KPIs**
Table: KPI | Specific Target | How to Measure.
Minimum 3 business metrics, 2 technical metrics, and 1 user satisfaction metric.

**Chapter 9: Risk Register & Mitigation**
Table: Risk | Category | Impact | Probability | Mitigation | Contingency Plan.
Minimum 5 risks.

**Chapter 10: Regulatory & Compliance**
If the industry is regulated, list regulations. If not, state "No specific regulation".

**Chapter 11: Project Timeline & Roadmap**
MVP phase, 12-week sprint plan, and milestones.

**Chapter 12: AI Agent Implementation Guidelines**
VERY IMPORTANT. Instructions specifically for the AI Coder:
A. STRICT TECH STACK:
- Frontend: React 19, Next.js 14, TypeScript, Tailwind CSS v4, Shadcn/ui, Lucide React, React Hook Form, Zod
- Backend: Node.js, Express, TypeScript, Prisma ORM
- Database: PostgreSQL
- Auth: NextAuth.js or JWT
- Storage: AWS S3 or Cloudinary
- Deployment: Vercel (frontend), Railway/Render (backend)
B. EXPECTED DIRECTORY STRUCTURE:
(e.g., /src/app, /src/components, /src/lib, /src/services, /src/types, /src/hooks, /src/store)
C. CORE DATA TYPES (TypeScript interfaces):
Create interfaces for the core product entities (e.g. User, Product, Order).
D. AI AGENT ROADMAP (Step-by-step implementation):
Phase 1: Project setup, routing, auth
Phase 2: Core feature (Main CRUD)
Phase 3: Advanced features (search, filters, payment, etc.)
Phase 4: Polish, testing, deployment
Explicitly state that the AI should NOT write all code in a single prompt, but execute phase by phase.

**GENERAL RULES:**
- Numbers must be SPECIFIC (e.g., "< 2 seconds", not "fast").
- NO placeholders like "[Isi disini]". Generate the actual content.
- Use ${isEn ? 'English' : 'Indonesian for narrative, but keep standard technical terms in English (e.g., Role, User Story, Endpoint, etc.)'}.
- Use Tables ONLY for: API Design, Risk Register, Budget, and Success Metrics.
- User Stories must use the list format specified.
- Keep table rows concise. You MUST write the table separator with exactly 3 dashes per column like this: \`|---|---|---|---|\`. NEVER use more than 3 dashes in the table separator.
- BE CONCISE. Avoid repeating words unnecessarily.${extraPrompt ? '\n\n' + extraPrompt : ''}${getIndustrySpecificPrompt(productType)}
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
