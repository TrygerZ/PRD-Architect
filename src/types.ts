// Re-export shared types (single source of truth in /shared/types.ts).
export type {
  AIProvider,
  PRDMode,
  ProductType,
  UploadedFile,
} from "../shared/types";

import type { PRDMode, ProductType } from "../shared/types";

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
