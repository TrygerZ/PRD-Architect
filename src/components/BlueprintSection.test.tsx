// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Section } from "../utils/sections";
import type { ThemeMode } from "../utils/theme";

const mermaidLifecycle = vi.hoisted(() => ({
  mounts: 0,
  unmounts: 0,
  renders: [] as Array<{ chart: string; theme?: ThemeMode; language?: "id" | "en"; isGenerating?: boolean }>,
}));

vi.mock("./MermaidRenderer", () => ({
  MermaidRenderer: function MockMermaidRenderer(props: {
    chart: string;
    theme?: ThemeMode;
    language?: "id" | "en";
    isGenerating?: boolean;
  }) {
    mermaidLifecycle.renders.push({
      chart: props.chart,
      theme: props.theme,
      language: props.language,
      isGenerating: props.isGenerating,
    });
    useEffect(() => {
      mermaidLifecycle.mounts += 1;
      return () => {
        mermaidLifecycle.unmounts += 1;
      };
    }, []);
    return <div data-testid="mock-mermaid">{props.theme}</div>;
  },
}));

import { SheetSection } from "./BlueprintSection";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SheetSection MermaidRenderer mount stability", () => {
  let container: HTMLDivElement;
  let root: Root;

  const section: Section = {
    index: 0,
    level: 2,
    heading: "System Architecture",
    content: "## System Architecture\n\n```mermaid\nflowchart LR\n  A --> B\n```\n",
  };

  beforeEach(() => {
    mermaidLifecycle.mounts = 0;
    mermaidLifecycle.unmounts = 0;
    mermaidLifecycle.renders = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps MermaidRenderer mounted across theme, language, and isGenerating updates", async () => {
    const renderSection = (props: {
      theme: ThemeMode;
      language: "id" | "en";
      isGenerating: boolean;
    }) => (
      <SheetSection
        section={section}
        sectionId="sec_System_Architecture_0"
        index={0}
        total={1}
        isCollapsed={false}
        onToggleCollapse={() => {}}
        isGenerating={props.isGenerating}
        language={props.language}
        theme={props.theme}
        comment=""
      />
    );

    await act(async () => {
      root.render(renderSection({ theme: "dark", language: "en", isGenerating: true }));
    });
    expect(mermaidLifecycle.mounts).toBe(1);
    expect(mermaidLifecycle.unmounts).toBe(0);

    await act(async () => {
      root.render(renderSection({ theme: "light", language: "en", isGenerating: true }));
    });
    await act(async () => {
      root.render(renderSection({ theme: "dark", language: "id", isGenerating: false }));
    });

    expect(mermaidLifecycle.mounts).toBe(1);
    expect(mermaidLifecycle.unmounts).toBe(0);

    const latest = mermaidLifecycle.renders[mermaidLifecycle.renders.length - 1];
    expect(latest).toEqual({
      chart: "flowchart LR\n  A --> B",
      theme: "dark",
      language: "id",
      isGenerating: false,
    });
  });

  it("skips re-rendering a finished SheetSection when a fresh Section object has identical heading and content", async () => {
    const onToggle = vi.fn();
    const onComment = vi.fn();

    await act(async () => {
      root.render(
        <SheetSection
          section={{ ...section }}
          sectionId="sec_System_Architecture_0"
          index={0}
          total={5}
          isCollapsed={false}
          onToggleCollapse={onToggle}
          onCommentChange={onComment}
          isGenerating={true}
          isStreamingSection={false}
          language="en"
          theme="dark"
          comment=""
        />,
      );
    });
    expect(mermaidLifecycle.renders).toHaveLength(1);

    // Simulate another chapter receiving a streaming chunk: getSections() produces a brand-new Section object for chapter 0
    await act(async () => {
      root.render(
        <SheetSection
          section={{ ...section }}
          sectionId="sec_System_Architecture_0"
          index={0}
          total={5}
          isCollapsed={false}
          onToggleCollapse={onToggle}
          onCommentChange={onComment}
          isGenerating={true}
          isStreamingSection={false}
          language="en"
          theme="dark"
          comment=""
        />,
      );
    });

    // Memo comparator must skip re-rendering the finished chapter completely
    expect(mermaidLifecycle.renders).toHaveLength(1);
  });

  it("opens inline top revision editor from sticky header Add note button without collapsing the chapter", async () => {
    const onToggle = vi.fn();
    const onComment = vi.fn();

    await act(async () => {
      root.render(
        <SheetSection
          section={section}
          sectionId="sec_System_Architecture_0"
          index={0}
          total={5}
          isCollapsed={false}
          onToggleCollapse={onToggle}
          onCommentChange={onComment}
          isGenerating={false}
          language="en"
          theme="dark"
          comment=""
        />,
      );
    });

    const addNoteBtn = container.querySelector(
      'button[aria-label="Add note"]',
    ) as HTMLButtonElement | null;
    expect(addNoteBtn).toBeTruthy();

    await act(async () => {
      addNoteBtn?.click();
    });

    // Clicking top-right Add note must NOT trigger header collapse
    expect(onToggle).not.toHaveBeenCalled();

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement | null;
    expect(textarea).toBeTruthy();
    expect(container.textContent).toContain("Revision note / Ch. 01");

    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      nativeSetter?.call(textarea, "Split microservice diagram by domain");
      textarea?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Save note"),
    );
    expect(saveBtn).toBeTruthy();

    await act(async () => {
      saveBtn?.click();
    });

    expect(onComment).toHaveBeenCalledWith(
      "sec_System_Architecture_0",
      "Split microservice diagram by domain",
    );
  });

  it("shows 1 active note pill in sticky header and top saved note strip when a comment exists", async () => {
    const onComment = vi.fn();

    await act(async () => {
      root.render(
        <SheetSection
          section={section}
          sectionId="sec_System_Architecture_0"
          index={0}
          total={5}
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
          onCommentChange={onComment}
          isGenerating={false}
          language="en"
          theme="dark"
          comment="Add latency SLA for Redis cache"
        />,
      );
    });

    const pillBtn = container.querySelector(
      'button[aria-label="1 active note"]',
    ) as HTMLButtonElement | null;
    expect(pillBtn).toBeTruthy();
    expect(container.textContent).toContain("Add latency SLA for Redis cache");

    // Inline strip sits directly before section content (no bottom card footer)
    const contentEl = container.querySelector("#sec_System_Architecture_0-content");
    const stripEl = Array.from(container.querySelectorAll("p")).find(
      (p) => p.textContent === "Add latency SLA for Redis cache",
    );
    expect(stripEl && contentEl).toBeTruthy();
    expect(
      Boolean(stripEl!.compareDocumentPosition(contentEl!) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });

  it("auto-expands a collapsed section and opens inline top editor when openNoteNonce increments", async () => {
    const onToggle = vi.fn();

    await act(async () => {
      root.render(
        <SheetSection
          section={section}
          sectionId="sec_System_Architecture_0"
          index={0}
          total={5}
          isCollapsed={true}
          onToggleCollapse={onToggle}
          onCommentChange={vi.fn()}
          isGenerating={false}
          language="en"
          theme="dark"
          comment=""
          openNoteNonce={0}
        />,
      );
    });

    expect(container.querySelector("textarea")).toBeNull();

    await act(async () => {
      root.render(
        <SheetSection
          section={section}
          sectionId="sec_System_Architecture_0"
          index={0}
          total={5}
          isCollapsed={true}
          onToggleCollapse={onToggle}
          onCommentChange={vi.fn()}
          isGenerating={false}
          language="en"
          theme="dark"
          comment=""
          openNoteNonce={1}
        />,
      );
    });

    expect(onToggle).toHaveBeenCalledWith("sec_System_Architecture_0");
    expect(container.querySelector("textarea")).toBeTruthy();
  });
});
