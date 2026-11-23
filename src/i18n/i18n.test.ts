import { describe, it, expect } from "vitest";
import { en } from "./en";
import { id } from "./id";

function flattenStrings(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[path] = value;
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flattenStrings(value as Record<string, unknown>, path));
    }
  }
  return out;
}

const EM_OR_EN_DASH_RE = /[\u2013\u2014]/;
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

const REQUIRED_KEYS = [
  "theme.dark",
  "theme.light",
  "theme.toggleLabel",
  "theme.switchToLight",
  "theme.switchToDark",
  "outline.liveTitle",
  "outline.chapterTitle",
  "outline.empty",
  "outline.streaming",
  "outline.noteCount",
  "revisionDock.stagedLabel",
  "revisionDock.clearAll",
  "revisionDock.reviseCta",
  "revisionDock.chapterPrefix",
  "mermaid.title",
  "mermaid.zoom",
  "mermaid.copy",
  "mermaid.copied",
  "mermaid.source",
  "mermaid.preview",
  "mermaid.closeZoom",
  "builder.filterAll",
  "builder.confirmReset",
  "builder.cancel",
  "builder.chaptersUnit",
  "builder.movingBadge",
  "builder.orderBadge",
  "composer.placeholder",
  "composer.generate",
  "composer.generating",
  "composer.stopGenerating",
  "composer.followLive",
  "composer.attachFiles",
  "composer.filesCount",
  "composer.tokensSuffix",
  "composer.keyboardHint",
  "settings.title",
  "settings.subtitle",
  "settings.httpOnlyNotice",
  "settings.testConnection",
  "settings.save",
  "settings.saved",
  "settings.cancel",
  "settings.clearKey",
  "sidebar.newPrd",
  "sidebar.recentWorkspaces",
  "sidebar.noWorkspaces",
  "sidebar.activeModel",
  "sidebar.ready",
  "sidebar.streaming",
  "sidebar.storageSync",
  "sidebar.collapse",
  "sidebar.expand",
  "header.workspaceBreadcrumb",
  "header.newSpecBreadcrumb",
  "header.diff",
  "header.convertMode",
  "welcome.greeting",
  "welcome.subtitle",
  "welcome.quickStarters",
  "sheet.addNote",
  "sheet.editNote",
  "sheet.noteSaved",
  "sheet.clearNote",
  "sheet.streamingChapter",
  "sheet.copySection",
  "sheet.continuingBadge",
  "sheet.incompleteTitle",
  "sheet.incompleteLengthDesc",
  "sheet.incompleteChaptersDesc",
  "sheet.continueCta",
  "wbs.specification",
  "wbs.deliverables",
  "wbs.criteria",
  "wbs.openChapter",
  "wbs.openDocument",
  "wbs.moduleSummary",
  "wbs.subfeatureSummary",
];

describe("i18n dictionary parity and copy hygiene", () => {
  const flatEn = flattenStrings(en as unknown as Record<string, unknown>);
  const flatId = flattenStrings(id as unknown as Record<string, unknown>);

  it("has identical leaf key trees in en and id", () => {
    expect(Object.keys(flatId).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it("includes all required Obsidian Atelier UI keys in both locales", () => {
    for (const key of REQUIRED_KEYS) {
      expect(flatEn[key], `Missing en key: ${key}`).toBeDefined();
      expect(flatId[key], `Missing id key: ${key}`).toBeDefined();
    }
  });

  it("contains only non-empty trimmed strings", () => {
    for (const [key, value] of Object.entries(flatEn)) {
      expect(value.trim().length, `Empty en value at ${key}`).toBeGreaterThan(0);
    }
    for (const [key, value] of Object.entries(flatId)) {
      expect(value.trim().length, `Empty id value at ${key}`).toBeGreaterThan(0);
    }
  });

  it("contains zero em-dashes, en-dashes, or emojis in en and id", () => {
    for (const [key, value] of Object.entries(flatEn)) {
      expect(EM_OR_EN_DASH_RE.test(value), `Dash found in en.${key}: ${value}`).toBe(false);
      expect(EMOJI_RE.test(value), `Emoji found in en.${key}: ${value}`).toBe(false);
    }
    for (const [key, value] of Object.entries(flatId)) {
      expect(EM_OR_EN_DASH_RE.test(value), `Dash found in id.${key}: ${value}`).toBe(false);
      expect(EMOJI_RE.test(value), `Emoji found in id.${key}: ${value}`).toBe(false);
    }
  });
});
