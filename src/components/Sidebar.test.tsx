// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Sidebar } from "./Sidebar";
import type { OutlineItem } from "../utils/outline";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Sidebar chapter outline quick-note triggers", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
  });

  const outlineItems: OutlineItem[] = [
    {
      id: "sec_1_Exec_0",
      indexLabel: "01",
      title: "1. Executive Summary",
      hasComment: true,
      status: "idle",
    },
    {
      id: "sec_2_Problem_1",
      indexLabel: "02",
      title: "2. Problem Definition",
      hasComment: false,
      status: "idle",
    },
  ];

  it("renders sibling chapter jump and quick-note buttons and reports staged note count", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const onSelectSection = vi.fn();
    const onQuickNoteSection = vi.fn();

    act(() => {
      root?.render(
        <Sidebar
          versions={[]}
          activeVersionId={null}
          onSwitchVersion={vi.fn()}
          onNewPRD={vi.fn()}
          language="en"
          isOpen={true}
          onClose={vi.fn()}
          outlineItems={outlineItems}
          activeSectionId="sec_1_Exec_0"
          onSelectSection={onSelectSection}
          onQuickNoteSection={onQuickNoteSection}
          providerLabel="DeepSeek"
          modelName="deepseek-chat"
          isGenerating={false}
          onOpenSettings={vi.fn()}
        />,
      );
    });

    // Header badge shows staged revision notes count
    expect(container.textContent).toContain("1 note");

    // Ensure zero nested <button> inside <button>
    const nestedButtons = container.querySelectorAll("button button");
    expect(nestedButtons.length).toBe(0);

    // Clicking chapter 02 quick-note button invokes onQuickNoteSection without invoking onSelectSection
    const quickNoteBtn = container.querySelector(
      'button[aria-label="Add revision note for chapter 02"]',
    ) as HTMLButtonElement | null;
    expect(quickNoteBtn).toBeTruthy();

    act(() => {
      quickNoteBtn?.click();
    });
    expect(onQuickNoteSection).toHaveBeenCalledWith("sec_2_Problem_1");
    expect(onSelectSection).not.toHaveBeenCalled();

    // Clicking chapter 01 active note badge also invokes onQuickNoteSection
    const activeNoteBtn = container.querySelector(
      'button[aria-label="Add revision note for chapter 01"]',
    ) as HTMLButtonElement | null;
    expect(activeNoteBtn?.textContent).toBe("1");

    act(() => {
      activeNoteBtn?.click();
    });
    expect(onQuickNoteSection).toHaveBeenCalledWith("sec_1_Exec_0");
  });
});
