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

/**
 * Structural equality helper so streaming body updates do not force Sidebar or
 * SmartRevisionDock to re-render when chapter headings, statuses, and comment
 * indicators are unchanged.
 */
export function areOutlineItemsEqual(a: OutlineItem[], b: OutlineItem[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.indexLabel !== y.indexLabel ||
      x.title !== y.title ||
      x.status !== y.status ||
      x.hasComment !== y.hasComment
    ) {
      return false;
    }
  }
  return true;
}
