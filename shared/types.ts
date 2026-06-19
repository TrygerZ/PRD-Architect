// Shared types used by both the frontend (src/) and backend (server.ts).
// Single source of truth to avoid duplicate, drifting definitions.

export type AIProvider = "deepseek" | "gemini" | "opencode";

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
