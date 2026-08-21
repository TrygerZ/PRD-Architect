// Helper murni untuk render section "Feature Breakdown (WBS)" sebagai tabel
// 3 kolom (Modul/Fitur/Sub-fitur). Dipakai live view (BlueprintSection),
// export PDF/DOCX (utils/export), dan print view (BlueprintSheet).
// Pure move dari BlueprintSection.tsx — zero logic change.
import type { WbsBulletItem } from "./wbs";

// Section "Feature Breakdown (WBS)" — bullet bersarang dirender sebagai TABEL.
// Section lain tetap markdown biasa.
export const WBS_SECTION_RE = /(feature\s+breakdown|work\s+breakdown|wbs|pohon\s+fitur|rincian\s+fitur)/i;
// WBS breakdown digenerate sbg `###` DI DALAM chapter (getSections hanya split
// `##`), jadi deteksi juga baris heading di konten, bukan hanya judul chapter.
export const WBS_HEADER_RE = /^#{1,4}[^\n]*(?:feature\s+breakdown|work\s+breakdown|\bwbs\b|pohon\s+fitur|rincian\s+fitur)[^\n]*$/im;
export const WBS_HEADING_STRIP_RE = /^#{1,4}\s*/;
export const WBS_LINE_RE = /^\s*[-*•]\s+/;

// Pisahkan konten section sebelum heading WBS (tabel MoSCoW/prosa — render
// markdown biasa) vs bagian WBS (heading + bullet — render tabel).
export function splitWbsSection(content: string): { before: string; heading: string; after: string } | null {
  const m = content.match(WBS_HEADER_RE);
  if (!m || typeof m.index !== "number") return null;
  return {
    before: content.slice(0, m.index),
    heading: m[0],
    after: content.slice(m.index + m[0].length),
  };
}

// Flatten pohon bullet → baris tabel. Satu baris per (module, feature, sub):
// - module = root depth 0, feature = depth 1, sub = gabungan seluruh turunan
//   depth 2+ (satu baris per sub); fitur tanpa sub → kolom sub kosong.
// - Breakdown flat tanpa module (root = fitur): kolom module = nama root,
//   feature = anaknya; root tanpa anak → module & feature = root itu sendiri.
export interface WbsRow {
  module: string;
  feature: string;
  sub: string;
}

export function wbsRows(items: WbsBulletItem[]): WbsRow[] {
  const rows: WbsRow[] = [];
  const collectDescendants = (node: WbsBulletItem, out: WbsBulletItem[]): void => {
    for (const c of node.children) {
      out.push(c);
      collectDescendants(c, out);
    }
  };
  for (const root of items) {
    if (root.children.length === 0) {
      // root = fitur tanpa anak → module & feature diisi root itu sendiri
      rows.push({ module: root.title, feature: root.title, sub: "" });
      continue;
    }
    for (const feature of root.children) {
      const subs: WbsBulletItem[] = [];
      collectDescendants(feature, subs);
      if (subs.length === 0) rows.push({ module: root.title, feature: feature.title, sub: "" });
      else for (const s of subs) rows.push({ module: root.title, feature: feature.title, sub: s.title });
    }
  }
  return rows;
}

// Flatten lanjutan untuk render tabel: grup berurutan (module / module+feature)
// di-merge vertikal via rowSpan. `null` pada module/feature = jangan render
// sel sama sekali (sudah tertutup rowSpan baris pertama grup).
export interface WbsTableRow {
  module: string | null;
  moduleSpan?: number;
  feature: string | null;
  featureSpan?: number;
  sub: string;
}

export function wbsTableRows(rows: WbsRow[]): WbsTableRow[] {
  const out: WbsTableRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const module = rows[i].module;
    let moduleEnd = i + 1;
    while (moduleEnd < rows.length && rows[moduleEnd].module === module) moduleEnd++;
    for (let k = i; k < moduleEnd; ) {
      const feature = rows[k].feature;
      let featureEnd = k + 1;
      while (featureEnd < moduleEnd && rows[featureEnd].feature === feature) featureEnd++;
      // Satu baris per sub-row; feature hanya di baris pertama run-nya.
      for (let j = k; j < featureEnd; j++) {
        out.push({
          module: j === i ? module : null,
          moduleSpan: j === i ? moduleEnd - i : undefined,
          feature: j === k ? feature : null,
          featureSpan: j === k ? featureEnd - k : undefined,
          sub: rows[j].sub,
        });
      }
      k = featureEnd;
    }
    i = moduleEnd;
  }
  return out;
}

// Prosa/catatan non-bullet SETELAH blok bullet — tidak boleh hilang; dirender
// sebagai markdown di bawah tabel.
export function wbsTailNote(content: string): string {
  let lastBullet = -1;
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (WBS_LINE_RE.test(lines[i])) lastBullet = i;
  }
  if (lastBullet < 0) return "";
  return lines
    .slice(lastBullet + 1)
    .filter((l) => l.trim())
    .join("\n");
}
