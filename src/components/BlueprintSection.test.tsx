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
});
