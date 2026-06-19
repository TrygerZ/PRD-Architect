export type Section = {
  index: number;
  level: number;
  heading: string;
  content: string;
};

/**
 * Parse a Markdown PRD document into sections, splitting strictly on
 * level-2 headings (`## `). Content before the first heading becomes an
 * "Overview" section so no text is lost.
 */
export const getSections = (content: string): Section[] => {
  if (!content) return [];
  const lines = content.split("\n");
  const sections: Section[] = [];
  let currentContent: string[] = [];
  let currentLevel = 2; // Default level
  let currentHeading = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Regex diperketat agar HANYA membaca Heading 2 (## )
    const match = line.match(/^##\s+(.*)/);
    if (match) {
      if (currentContent.length > 0) {
        sections.push({
          index: sections.length,
          level: currentLevel,
          heading: currentHeading || "Overview", // Cegah hilangnya teks awal
          content: currentContent.join("\n"),
        });
      }
      currentLevel = 2;
      currentHeading = match[1];
      currentContent = [line];
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.length > 0) {
    sections.push({
      index: sections.length,
      level: currentLevel,
      heading: currentHeading || "Overview",
      content: currentContent.join("\n"),
    });
  }
  // JANGAN PERNAH menghapus section jika ada isinya, meskipun tanpa judul
  return sections.filter((s) => s.content.trim().length > 0);
};
