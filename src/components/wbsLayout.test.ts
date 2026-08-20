// Verifikasi layout WBS: kolom selaras, band rata, root ter-center, jalur tidak menyilang.
// Fixture hier: 4 modul, 9 fitur, 21 sub-fitur (34 node non-root) — hasil redesign-1 "berantakan",
// target: pohon mengalir rapi kiri→kanan seperti WBS_Design.png.
import { describe, it, expect } from "vitest";
import { extractWbs, flattenWbs } from "../utils/wbs";
import { layout, H_STEP, Y_UNIT } from "./wbsLayout";

function fixture(): string {
  const module = (title: string, feats: [string, number][]): string =>
    [
      `- **${title}**`,
      ...feats.flatMap(([ft, subs]) => [
        `  - **${ft}**`,
        ...Array.from({ length: subs }, (_, i) => `    - Sub ${title} ${ft} #${i + 1}`),
      ]),
    ].join("\n");
  return [
    "## Feature Breakdown (WBS)",
    "",
    // 4 modul, 9 fitur, 21 sub-fitur (34 node non-root)
    module("Modul Alpha", [["Fitur A1", 3], ["Fitur A2", 2], ["Fitur A3", 2]]), // 3 f, 7 s
    module("Modul Beta", [["Fitur B1", 3], ["Fitur B2", 2]]), // 2 f, 5 s
    module("Modul Gamma", [["Fitur G1", 2], ["Fitur G2", 2]]), // 2 f, 4 s
    module("Modul Delta", [["Fitur D1", 3], ["Fitur D2", 2]]), // 2 f, 5 s
  ].join("\n");
}

describe("wbsLayout — kolom selaras & band rata", () => {
  const tree = extractWbs(fixture(), "business");
  const collapsed = new Set<string>(); // semua expand — kasus terpadat
  const { nodes, edges } = layout(tree, () => {}, () => {}, collapsed);

  it("jumlah node benar (4+9+21+root = 35; non-root 34)", () => {
    const all = flattenWbs(tree.root);
    expect(all.length).toBe(34 + 1);
    expect(nodes.length).toBe(all.length);
    const level = (n: (typeof nodes)[number]) => n.data.level;
    expect(nodes.filter((n) => level(n) === 1)).toHaveLength(4);
    expect(nodes.filter((n) => level(n) === 2)).toHaveLength(9);
    expect(nodes.filter((n) => level(n) === 3)).toHaveLength(21);
  });

  it("semua node sub-fitur (depth 3) punya x = 3×H_STEP yang SAMA", () => {
    const subs = nodes.filter((n) => n.data.level === 3);
    expect(subs.length).toBe(21);
    const xs = new Set(subs.map((n) => n.position.x));
    expect([...xs]).toEqual([3 * H_STEP]);
  });

  it("setiap depth memakai satu kolom x identik", () => {
    for (let d = 0; d <= 3; d++) {
      const xs = new Set(nodes.filter((n) => n.data.level === d).map((n) => n.position.x));
      expect([...xs]).toEqual([d * H_STEP]);
    }
  });

  it("sibling tidak tumpuk — selisih Y antar sibling berurutan ≥ Y_UNIT", () => {
    const byParent = new Map<string, (typeof nodes)[number][]>();
    for (const e of edges) {
      const list = byParent.get(e.source) ?? [];
      list.push(nodes.find((n) => n.id === e.target)!);
      byParent.set(e.source, list);
    }
    for (const [, sibs] of byParent) {
      const ys = sibs.map((n) => n.position.y).sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) {
        expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(Y_UNIT);
      }
    }
  });

  it("root ter-center vertikal: y = (modul pertama + modul terakhir)/2", () => {
    const root = nodes.find((n) => n.data.level === 0)!;
    const mods = nodes
      .filter((n) => n.data.level === 1)
      .map((n) => n.position.y)
      .sort((a, b) => a - b);
    expect(mods).toHaveLength(4);
    expect(root.position.y).toBe((mods[0] + mods[mods.length - 1]) / 2);
  });

  it("band antar modul rata — modul besar (7 leaf) vs kecil (4 leaf) tetap berjarak rapi", () => {
    const mods = nodes
      .filter((n) => n.data.level === 1)
      .sort((a, b) => a.position.y - b.position.y);
    // Modul Gamma (4 leaf) mengikuti Modul Alpha (7 leaf) → batas band kontigu, gap = 1 unit.
    expect(mods[0].position.x).toBe(H_STEP);
    for (let i = 1; i < mods.length; i++) {
      expect(mods[i].position.y - mods[i - 1].position.y).toBeGreaterThanOrEqual(Y_UNIT);
    }
  });

  it("jalur branch tidak menyilang — rentang Y subtree sibling saling disjoint", () => {
    // Setiap subtree menempati band kontigu; sibling berurutan → range Y terpisah
    // (tidak ada dua branch yang saling melintasi di kolom yang sama).
    const index = new Map<string, (typeof nodes)[number]>();
    for (const n of nodes) index.set(n.id, n);
    // range Y (min/max center) seluruh node dalam subtree sebuah node.
    const subtreeRange = (id: string): [number, number] => {
      const n = index.get(id)!;
      let lo = n.position.y;
      let hi = n.position.y;
      for (const e of edges) {
        if (e.source === id) {
          const [clo, chi] = subtreeRange(e.target);
          lo = Math.min(lo, clo);
          hi = Math.max(hi, chi);
        }
      }
      return [lo, hi];
    };
    const byParent = new Map<string, (typeof nodes)[number][]>();
    for (const e of edges) {
      const list = byParent.get(e.source) ?? [];
      list.push(index.get(e.target)!);
      byParent.set(e.source, list);
    }
    for (const [pid, kids] of byParent) {
      const ranges = kids.map((k) => subtreeRange(k.id)).sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < ranges.length; i++) {
        expect(ranges[i - 1][1]).toBeLessThan(ranges[i][0]); // disjoint & berurutan
      }
      void pid;
    }
  });

  it("collapsed state (awal buka tab) ringkas: root + 4 modul saja", () => {
    const c = new Set(nodes.filter((n) => n.data.level === 1).map((n) => n.id));
    const { nodes: cn } = layout(tree, () => {}, () => {}, c);
    expect(cn).toHaveLength(5);
    const ys = cn.map((n) => n.position.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(3 * Y_UNIT); // 4 modul, 3 interval
  });
});