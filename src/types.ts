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
  reasoning?: string;
}

// WBS (Work Breakdown Structure) — produced by src/utils/wbs.ts from PRD markdown.
export type WbsPriority = "Must-have" | "Should-have" | "Could-have" | "Won't-have";

export type WbsNodeType = "root" | "feature" | "subfeature";

export interface WbsNode {
  id: string; // "root" | "f-1" | "sf-1-1" — stabil & unik
  type: WbsNodeType;
  title: string; // nama fitur/sub-fitur
  detail: string; // snippet markdown detail dari PRD (raw)
  priority?: WbsPriority;
  code?: string; // e.g. "FEAT-01" bila ada
  children: WbsNode[];
}

export interface WbsTree {
  root: WbsNode; // root.children = features
  source: "markdown";
  warnings: string[]; // chapter/table yang gagal diparse
}
