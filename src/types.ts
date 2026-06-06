export type AIProvider = "deepseek" | "gemini";
export type PRDMode = "business" | "technical";

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

export interface PRDVersion {
  id: string;
  timestamp: number;
  content: string;
  prompt: string;
  productType: ProductType;
  referencedFilesCount?: number;
  userDisplayPrompt?: string;
  prdMode?: PRDMode;
}
