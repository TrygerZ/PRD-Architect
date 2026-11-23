// @vitest-environment jsdom
import React, { act } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { Header } from "./Header";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

describe("Header Convert Mode menu", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

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

  const noop = () => {};

  it("shows Custom as active and allows converting to Business, Simple, or Technical", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const onConvertMode = vi.fn();

    act(() => {
      root?.render(
        <Header
          onOpenSettings={noop}
          onExportMd={noop}
          onExportDocx={noop}
          onExportPdf={noop}
          onExportJson={noop}
          onCopy={noop}
          onPrint={noop}
          hasData={true}
          language="id"
          onToggleLanguage={noop}
          theme="dark"
          onToggleTheme={noop}
          minimal={false}
          activeMode="custom"
          customChapterCount={15}
          onConvertMode={onConvertMode}
        />,
      );
    });

    const trigger = container.querySelector('button[aria-label="Ubah Mode"]') as HTMLButtonElement | null;
    expect(trigger).toBeTruthy();
    act(() => {
      trigger?.click();
    });

    expect(container.textContent).toContain("Kustom (15)");

    const businessBtn = Array.from(container.querySelectorAll('button[role="menuitem"]')).find((el) =>
      el.textContent?.includes("Mode Bisnis & Investor"),
    ) as HTMLButtonElement | undefined;
    expect(businessBtn).toBeTruthy();
    expect(businessBtn?.disabled).toBe(false);

    act(() => {
      businessBtn?.click();
    });
    expect(onConvertMode).toHaveBeenCalledWith("business");
  });

  it("marks Business as current and disabled when activeMode is business", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const onConvertMode = vi.fn();

    act(() => {
      root?.render(
        <Header
          onOpenSettings={noop}
          onExportMd={noop}
          onExportDocx={noop}
          onExportPdf={noop}
          onExportJson={noop}
          onCopy={noop}
          onPrint={noop}
          hasData={true}
          language="en"
          onToggleLanguage={noop}
          theme="dark"
          onToggleTheme={noop}
          minimal={false}
          activeMode="business"
          onConvertMode={onConvertMode}
        />,
      );
    });

    const trigger = container.querySelector('button[aria-label="Convert Mode"]') as HTMLButtonElement | null;
    act(() => {
      trigger?.click();
    });

    expect(container.textContent).not.toContain("Custom (");
    const businessBtn = Array.from(container.querySelectorAll('button[role="menuitem"]')).find((el) =>
      el.textContent?.includes("Business & Investor Mode"),
    ) as HTMLButtonElement | undefined;
    expect(businessBtn?.disabled).toBe(true);
  });
});
