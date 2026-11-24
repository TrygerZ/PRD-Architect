import { describe, it, expect } from "vitest";
import {
  escapeXml,
  computeRasterDimensions,
  buildSmoothStepPath,
  buildWbsSvg,
  exportWbsImage,
  MAX_RASTER_EDGE,
  MAX_RASTER_PIXELS,
  type WbsExportOptions,
} from "./exportWbsImage";

const SAMPLE_PRD = [
  "# Kestrel Treasury OS",
  "",
  "## 4. Feature Scope & MoSCoW",
  "",
  "| ID | Feature | Priority | Description |",
  "| --- | --- | --- | --- |",
  "| FEAT-01 | Dual-Sign Approval | Must-have | Hardware key quorum for wires > $50k |",
  "| FEAT-02 | FX Sweep Routing | Should-have | Automated cross-currency settlement |",
  "| FEAT-03 | CSV & Audit <Export> | Could-have | Scheduled regulator ledger export |",
  "",
  "## 5. Feature Breakdown (WBS)",
  "",
  "- **Core Ledger & Auth**",
  "  - **Dual-Sign Approval**",
  "    - Hardware key verification",
  "    - Quorum 2/3 policy",
  "  - **FX Sweep Routing**",
  "    - Spot quote aggregation",
  "- **Audit & Reporting**",
  "  - **CSV & Audit <Export>**",
  "    - Scheduled CSV snapshot",
].join("\n");

const BASE_OPTS: WbsExportOptions = {
  format: "png",
  scale: 3,
  theme: "obsidian",
  expandAll: true,
  includeHeader: true,
  versionLabel: "v2",
};

describe("escapeXml", () => {
  it("escapes all XML special characters safely", () => {
    expect(escapeXml(`Auth & RBAC <"v2"> 'strict'`)).toBe(
      "Auth &amp; RBAC &lt;&quot;v2&quot;&gt; &apos;strict&apos;",
    );
  });
});

describe("computeRasterDimensions", () => {
  it("returns exact scaled dimensions for normal WBS canvases", () => {
    expect(computeRasterDimensions(1200, 800, 2)).toEqual({
      width: 2400,
      height: 1600,
      effectiveScale: 2,
      clamped: false,
    });
    expect(computeRasterDimensions(1200, 800, 3)).toEqual({
      width: 3600,
      height: 2400,
      effectiveScale: 3,
      clamped: false,
    });
  });

  it("clamps oversized dimensions safely within browser edge and pixel area limits", () => {
    const res = computeRasterDimensions(8000, 6000, 3);
    expect(res.clamped).toBe(true);
    expect(res.width).toBeLessThanOrEqual(MAX_RASTER_EDGE);
    expect(res.height).toBeLessThanOrEqual(MAX_RASTER_EDGE);
    expect(res.width * res.height).toBeLessThanOrEqual(MAX_RASTER_PIXELS);
    expect(res.effectiveScale).toBeLessThan(3);
    expect(res.effectiveScale).toBeGreaterThan(0);
    // Preserves aspect ratio (~4:3)
    expect(res.width / res.height).toBeCloseTo(8000 / 6000, 2);
  });
});

describe("buildSmoothStepPath", () => {
  it("renders a straight horizontal segment when endpoints align vertically", () => {
    expect(buildSmoothStepPath(100, 50, 200, 50)).toBe("M 100 50 H 200");
  });

  it("renders a rounded orthogonal path when endpoints differ vertically", () => {
    const d = buildSmoothStepPath(100, 50, 220, 140, 12);
    expect(d).toMatch(/^M 100 50 H /);
    expect(d).toContain(" Q ");
    expect(d).toContain(" V ");
    expect(d).toMatch(/ H 220$/);
  });
});

describe("buildWbsSvg", () => {
  it("returns null when document contains no WBS features", () => {
    expect(buildWbsSvg("Just plain prose with no features.", "SaaS", "en", BASE_OPTS)).toBeNull();
    expect(buildWbsSvg("", "SaaS", "en", BASE_OPTS)).toBeNull();
  });

  it("generates a valid standalone SVG with escaped XML, dot grid, header, MoSCoW badges, and connectors", () => {
    const res = buildWbsSvg(SAMPLE_PRD, "SaaS", "en", BASE_OPTS, "business");
    expect(res).not.toBeNull();
    if (!res) return;

    expect(res.width).toBeGreaterThan(600);
    expect(res.height).toBeGreaterThan(250);
    expect(res.nodeCount).toBe(10); // root + 2 modules + 3 features + 4 subfeatures
    expect(res.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(res.svg).toContain('<pattern id="wbs-dot-grid"');
    expect(res.svg).toContain("Kestrel Treasury OS");
    expect(res.svg).toContain("MUST");
    expect(res.svg).toContain("SHOULD");
    expect(res.svg).toContain("COULD");
    // XML-escaped characters must appear escaped, never raw unescaped tags
    expect(res.svg).toContain("CSV &amp; Audit &lt;Export&gt;");
    expect(res.svg).not.toContain("<Export>");
    expect(res.svg).toContain("<path ");
  });

  it("omits canvas background and dot grid in transparent theme", () => {
    const res = buildWbsSvg(SAMPLE_PRD, "SaaS", "en", {
      ...BASE_OPTS,
      theme: "transparent",
    });
    expect(res).not.toBeNull();
    expect(res?.svg).not.toContain('<pattern id="wbs-dot-grid"');
    expect(res?.svg).not.toContain('data-wbs-bg="solid"');
  });

  it("omits header bar when includeHeader is false", () => {
    const withHeader = buildWbsSvg(SAMPLE_PRD, "SaaS", "en", { ...BASE_OPTS, includeHeader: true });
    const withoutHeader = buildWbsSvg(SAMPLE_PRD, "SaaS", "en", { ...BASE_OPTS, includeHeader: false });
    expect(withHeader).not.toBeNull();
    expect(withoutHeader).not.toBeNull();
    expect(withoutHeader!.height).toBeLessThan(withHeader!.height);
    expect(withoutHeader!.svg).not.toContain('data-wbs-header="true"');
  });

  it("respects collapsedIds and renders +N badge when expandAll is false, while expandAll=true shows every node", () => {
    const collapsed = new Set(["f-1"]);
    const collapsedRes = buildWbsSvg(SAMPLE_PRD, "SaaS", "en", {
      ...BASE_OPTS,
      expandAll: false,
      collapsedIds: collapsed,
    });
    const expandedRes = buildWbsSvg(SAMPLE_PRD, "SaaS", "en", {
      ...BASE_OPTS,
      expandAll: true,
      collapsedIds: collapsed,
    });

    expect(collapsedRes).not.toBeNull();
    expect(expandedRes).not.toBeNull();
    expect(collapsedRes!.nodeCount).toBeLessThan(expandedRes!.nodeCount);
    expect(collapsedRes!.svg).toContain("+5");
    expect(collapsedRes!.svg).not.toContain("Hardware key");
    expect(expandedRes!.svg).toContain("Hardware key");
    expect(expandedRes!.svg).toContain("verification");
  });
});

describe("exportWbsImage", () => {
  it("returns { ok: false, reason: 'empty' } when document has no WBS features", async () => {
    const outcome = await exportWbsImage("", "SaaS", "en", BASE_OPTS);
    expect(outcome).toEqual({ ok: false, reason: "empty" });
  });
});
