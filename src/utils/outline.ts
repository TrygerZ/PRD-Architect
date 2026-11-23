import { getSections } from "./sections";

export type OutlineStatus = "done" | "streaming" | "idle";

export interface OutlineItem {
  id: string;
  indexLabel: string;
  title: string;
  status: OutlineStatus;
  hasComment: boolean;
}

/**
 * Generates the deterministic section anchor ID matching BlueprintSheet and useGeneration.
 */
export function getSectionId(heading: string, index: number): string {
  return `sec_${heading.substring(0, 30).replace(/[^a-zA-Z0-9]/g, "_")}_${index}`;
}

/**
 * Maps markdown PRD content, staged comments, and streaming state into sidebar outline items.
 */
export function buildChapterOutline(
  content: string,
  comments: Record<string, string>,
  isGenerating: boolean,
): OutlineItem[] {
  if (!content.trim()) return [];
  const sections = getSections(content);
  const lastIndex = sections.length - 1;

  return sections.map((section, index) => {
    const id = getSectionId(section.heading, index);
    const status: OutlineStatus = isGenerating
      ? index === lastIndex
        ? "streaming"
        : "done"
      : "idle";

    return {
      id,
      indexLabel: String(index + 1).padStart(2, "0"),
      title: section.heading.trim(),
      status,
      hasComment: Boolean(comments[id]?.trim()),
    };
  });
}
