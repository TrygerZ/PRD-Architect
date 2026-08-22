// Shared types used by both the frontend (src/) and backend (server.ts).
// Single source of truth to avoid duplicate, drifting definitions.

export type AIProvider = "deepseek" | "gemini" | "opencode" | "nine_router";

export type PRDMode = "business" | "technical" | "simple";

export type ProductType =
  | "e-commerce"
  | "SaaS"
  | "IoT"
  | "Mobile App"
  | "Internal Tool"
  | "Unknown";

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
  charCount: number;
}

// Streaming chunk shape exchanged over SSE (subset shared between FE/BE).
export interface SSEChunk {
  text?: string;
  reasoning?: string;
  error?: string;
}

// Generate PRD request payload (shared between FE & BE).
// customChapterIds is optional; when absent legacy modes apply unchanged.
export interface GeneratePRDRequest {
  prompt: string;
  language?: "en" | "id";
  provider?: AIProvider;
  model?: string;
  customEndpoint?: string;
  productType?: string;
  uploadedFiles?: UploadedFile[];
  mode?: "initial" | "revision" | "append";
  prdMode?: PRDMode;
  customChapterIds?: string[];
}
