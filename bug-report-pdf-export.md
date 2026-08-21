# Root Cause Analysis — PDF Export Bugs

**File:** `src/utils/export.ts` (1246 lines)  
**Stack:** jsPDF + jspdf-autotable, custom markdown→PDF renderer  
**Date:** 2026-08-21

---

## Bug 1: Table Content Overflows Beyond Table Borders

**Severity:** High  
**Category:** Logical Error — measurement/drawing divergence + column width mismatch

### Root Cause Summary

Terdapat **3 akar penyebab independen** yang masing-masing bisa menyebabkan overflow. Kombinasi ketiganya memperparah masalah.

---

### Root Cause 1A: `didDrawCell` Re-join Menghancurkan Informasi Style

**Lokasi:** Line 1093  
**Evidence:**

```typescript
// Line 1093 — didDrawCell
const joined = segs.map((s) => s.text).join("");
writeRichText(joined, 9, { bounds: { ... } });
```

`segs` adalah `InlineSeg[]` hasil `parseInline()` yang sudah diparsing 1x di line 1048. Setiap segment membawa metadata `bold`, `italic`, `code`. Tetapi line 1093 **meng-join teks tanpa marker**, lalu `writeRichText` mem-parsing ulang via `parseInline()` internal (line 953).

**Reproduksi divergensi:**

| Cell text mentah | Original segs (didParseCell) | Joined → re-parsed (didDrawCell) |
|---|---|---|
| `**Status**: Active` | `[{text:"Status", bold:true}, {text:": Active"}]` | `"Status: Active"` → `[{text:"Status: Active"}]` — bold hilang |
| `Use *npm* here` | `[{text:"Use "}, {text:"npm", italic:true}, {text:" here"}]` | `"Use npm here"` → `[{text:"Use npm here"}]` — italic hilang |

**Dampak pada overflow:**
- `didParseCell` (line 1078) mengukur dengan font **bold** (lebih lebar per karakter) → menghitung N baris
- `didDrawCell` menggambar dengan font **normal** (lebih sempit) → menghasilkan M baris (M ≠ N)
- Jika M < N: sel terlalu tinggi (visual glitch tapi tidak overflow)
- Jika konten yang di-join **secara tidak sengaja membentuk pola markdown baru** (contoh: segment `"data "` + `"*penting*"` → joined `"data *penting*"` → re-parsed dengan italic `"penting"` yang tidak ada di original), maka drawing bisa **lebih lebar** dari measurement → **overflow**

**Kode tersangka:**
```
Line 1093: const joined = segs.map((s) => s.text).join("");
Line 1094: writeRichText(joined, 9, { ... });
```

### Root Cause 1B: Asymmetric Head vs Body Normalization

**Lokasi:** Line 1044-1045

```typescript
// Line 1044 — header: normalizePdfText TANPA stripInline
const head = [header.map(normalizePdfText)];
// Line 1045 — body: normalizePdfText + stripInline
const body = bodyRows.map((r) => r.map((c) => normalizePdfText(stripInline(c))));
```

**Dampak:**
- Header cell `**Status**` → autoTable melihat `**Status**` (8 karakter dengan marker)
- Body cell `**Active**` → autoTable melihat `Active` (6 karakter tanpa marker)
- autoTable menghitung column width berdasarkan teks terlebar antara head dan body
- Header yang masih punya marker `**...**` membuat kolom tampak lebih lebar dari seharusnya DI FASE ALOKASI WIDTH
- Tetapi saat **menggambar** header, autoTable merender `**Status**` sebagai teks literal (marker `**` terlihat) — ini bukan overflow, tapi **syntax leak** di header

**Komplikasi untuk body:** autoTable mengalokasikan column width berdasarkan teks stripped (body) vs teks unstripped (header). Ketika `didParseCell` mengukur body cell dengan bold font (dari original segs), teks bold bisa lebih lebar dari column width yang dialokasikan berdasarkan teks stripped. autoTable tidak re-layout kolom setelah `didParseCell` mengubah cell height.

### Root Cause 1C: `measureSeg` Memakai `baseBold=false` tapi Drawing Bisa Memakai `baseBold=true`

**Lokasi:** Line 914-918 vs Line 936-937, 948-952

```typescript
// Line 914-918 — measureSeg (dipakai didParseCell)
const measureSeg = (text: string, seg: InlineSeg): number => {
  const [family, style] = fontStyleFor(seg, false, false); // baseBold=false, baseItalic=false
  doc.setFont(family, style);
  return doc.getTextWidth(normalizePdfText(text));
};

// Line 936-937 — writeRichText (dipakai didDrawCell)
const baseBold = opts.bold ?? false;   // opts.bold TIDAK di-pass dari didDrawCell
const baseItalic = opts.italic ?? false; // opts.italic TIDAK di-pass dari didDrawCell
```

Dalam konteks tabel body cells, **keduanya memang sama** (`baseBold=false`). Ini BUKAN akar penyebab untuk body cells. Tetapi untuk header cells, `didDrawCell` tidak dipanggil (karena `data.section !== "body"` di line 1068 skip header) — header dirender oleh autoTable sendiri dengan `fontStyle: "bold"` (line 1063). Jadi header measurement vs drawing konsisten. **Ini bukan root cause langsung.**

### Root Cause 1D: `data.cell.width` di `didParseCell` — Preliminary vs Final

**Lokasi:** Line 1078

```typescript
const laid = layoutInline(segs, data.cell.width - padL - padR, measureSeg, true);
```

`didParseCell` dipanggil **sebelum** autoTable finalisasi column widths. Menurut dokumentasi jspdf-autotable, `didParseCell` menerima cell dimensions yang bisa berubah setelah hook selesai. Artinya:

- `data.cell.width` bisa berupa **estimasi awal** berdasarkan content width
- autoTable kemudian re-distributes column widths berdasarkan available table width
- Jika final width **lebih kecil** dari estimasi di `didParseCell`, maka cell height yang di-reserve terlalu pendek untuk final width → **content overflow**

**Ini adalah root cause yang paling likely menyebabkan overflow.** autoTable menghitung column widths SETELAH `didParseCell`, tetapi cell height sudah di-lock oleh hook.

### Rekomendasi Fix Bug 1

**Fix 1A — Hapus re-join/re-parse, pakai original segs langsung:**

```typescript
// didDrawCell — SEBELUM (line 1092-1094)
const joined = segs.map((s) => s.text).join("");
writeRichText(joined, 9, { bounds: { ... } });

// SESUDAH — buat overload writeRichText yang terima segs langsung
drawRichSegs(segs, 9, {
  bounds: {
    left: data.cell.x + pad,
    right: data.cell.x + data.cell.width - data.cell.padding("right"),
  },
});
```

Atau minimal, reconstruct teks dengan marker:
```typescript
// Quick fix: reconstruct text with markers instead of stripping them
const joined = segs.map((s) => {
  if (s.bold) return `**${s.text}**`;
  if (s.italic) return `*${s.text}*`;
  if (s.code) return `\`${s.text}\``;
  return s.text;
}).join("");
```

**Fix 1B — Strip header juga:**

```typescript
// Line 1044 — SESUDAH
const head = [header.map((c) => normalizePdfText(stripInline(c)))];
```

(Header tetap bold via `headStyles.fontStyle: "bold"` di line 1063.)

**Fix 1D — Pakai `didDrawPage` atau kalkulasi ulang di `willDrawCell`:**

Karena `didParseCell` mungkin menerima preliminary width, pindahkan height calculation ke hook yang lebih late-stage, atau gunakan `columnStyles` dengan `cellWidth` tetap untuk mencegah column width berubah setelah measurement.

Alternatif: tambahkan safety margin di `richCellHeight`:
```typescript
// Line 348 — tambah 1 baris buffer
return padVertical + (nLines + 0.5) * fontSize * 1.4;
```

---

## Bug 2: Markdown `---` Syntax Leaks Into PDF

**Severity:** Medium  
**Category:** Boundary/Edge Case — regex terlalu ketat + missing coverage

### Root Cause Summary

`isThematicBreak()` regex (line 212) **hanya match exact 3 karakter** untuk `---`, `***`, `___` dan gagal menangani varian valid lainnya. Selain itu, beberapa konteks markdown tidak dihandle.

### Root Cause 2A: Regex Terlalu Ketat

**Lokasi:** Line 211-213

```typescript
export function isThematicBreak(line: string): boolean {
  return /^(---|\*\*\*|___|={3,})\s*$/.test(line.trim());
}
```

**Varian CommonMark yang TIDAK ter-match:**

| Input | Seharusnya | Aktual | Alasan |
|---|---|---|---|
| `----` (4 dashes) | thematic break | ❌ LEAK | Regex hanya match exact `---` (3) |
| `-----` (5 dashes) | thematic break | ❌ LEAK | Same |
| `- - -` (spaced dashes) | thematic break | ❌ LEAK | Regex tidak handle spasi antar karakter |
| `* * *` (spaced asterisks) | thematic break | ❌ LEAK | Same |
| `_ _ _` (spaced underscores) | thematic break | ❌ LEAK | Same |
| `****` (4 asterisks) | thematic break | ❌ LEAK | Regex hanya match exact `***` (3) |
| `____` (4 underscores) | thematic break | ❌ LEAK | Regex hanya match exact `___` (3) |

**Verifikasi:**
```
node -e "const r = /^(---|[*][*][*]|___|={3,})\s*$/; 
         console.log('----:', r.test('----'))   // false — SHOULD be true
         console.log('- - -:', r.test('- - -')) // false — SHOULD be true"
```

### Root Cause 2B: `---` di Dalam Table Cell Tidak Dihandle

**Lokasi:** Line 1031-1107

Ketika `---` muncul sebagai **konten sel tabel** (bukan sebagai baris standalone), path-nya berbeda:
1. Line 1032: `trimmed.startsWith("|")` — TRUE, masuk table parsing
2. Table body cell berisi `---` → di-pass ke `parseTableRow` → menjadi cell text biasa
3. `didDrawCell` merender `---` sebagai teks literal → **muncul di PDF**

Ini **bukan bug** — `---` di dalam cell memang seharusnya teks literal. Tetapi jika user menulis tabel dengan cell yang HANYA berisi `---` (sebagai visual separator), itu akan muncul verbatim.

### Root Cause 2C: YAML Frontmatter `---` Tidak Difilter

**Lokasi:** Line 981-984

```typescript
const lines = content.split("\n");
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
```

Tidak ada deteksi YAML frontmatter (`---\nkey: value\n---` di awal dokumen). Jika PRD content dimulai dengan frontmatter:
- Baris pertama `---` → `isThematicBreak` → horizontal rule (visual noise, bukan leak)
- Baris `key: value` → paragraf biasa → **metadata leaks ke PDF**
- Baris penutup `---` → horizontal rule lagi

### Root Cause 2D: Setext Heading Underline `===` / `---` Tidak Dihandle

**Lokasi:** Line 1112-1114

CommonMark setext headings:
```
Heading Level 1
===============

Heading Level 2
---------------
```

Baris `===============` ter-match `isThematicBreak` → digambar sebagai horizontal rule (benar secara visual tapi salah secara semantik — seharusnya membuat heading dari baris sebelumnya).

Baris `---------------` (15 dashes) **TIDAK** ter-match `isThematicBreak` (regex hanya match 3 exact) → **muncul sebagai teks literal `---------------` di PDF** → syntax leak.

### Root Cause 2E: Syntax Lain yang Bocor

| Syntax | Status | Penjelasan |
|---|---|---|
| `***` sebagai bold+italic marker | ✅ Handled | `parseInline` line 122 menangkap `**` dulu, sisa `*` ditangkap line 131 |
| `***` sebagai thematic break | ✅ Handled | `isThematicBreak` match exact `***` |
| `___` thematic break | ✅ Handled | Regex match |
| `#` tanpa heading | ⚠️ Partial | Line 1118 regex `^(#{1,6})\s+(.*)` memerlukan spasi setelah `#`. Baris `#tag` atau `#hashtag` jatuh ke paragraf biasa — rendered as-is termasuk `#`. Ini correct behavior. |
| HTML tags | ❌ NOT handled | `<div>`, `<br>`, `<table>` dll dari AI output akan muncul verbatim di PDF |
| Double newlines | ✅ Handled | Line 1221-1223: baris kosong → `y += 4` spacing |
| `~~strikethrough~~` | ❌ NOT handled | Akan muncul dengan marker `~~` di PDF |
| `> > nested blockquote` | ⚠️ Partial | Hanya 1 level `>` dihandle (line 1206) |

### Rekomendasi Fix Bug 2

**Fix 2A — Perbaiki regex CommonMark-compliant:**

```typescript
export function isThematicBreak(line: string): boolean {
  const t = line.trim();
  // CommonMark spec: 3+ of same char (-, *, _), optionally with spaces between
  return /^[-]{3,}$/.test(t.replace(/ /g, ""))
      || /^[*]{3,}$/.test(t.replace(/ /g, ""))
      || /^[_]{3,}$/.test(t.replace(/ /g, ""))
      || /^={3,}\s*$/.test(t);
}
```

Atau lebih ringkas:
```typescript
export function isThematicBreak(line: string): boolean {
  const t = line.trim();
  const collapsed = t.replace(/ /g, "");
  return /^(-{3,}|\*{3,}|_{3,}|={3,})$/.test(collapsed);
}
```

**Fix 2C — Deteksi dan skip YAML frontmatter:**

```typescript
// Sebelum loop utama (setelah line 981)
let startLine = 0;
if (lines[0]?.trim() === "---") {
  for (let j = 1; j < lines.length; j++) {
    if (lines[j].trim() === "---") {
      startLine = j + 1;
      break;
    }
  }
}
for (let i = startLine; i < lines.length; i++) { ...
```

**Fix 2E — Strip HTML tags:**

```typescript
// Tambahkan di normalizePdfText atau sebagai step terpisah
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "");
```

---

## Ringkasan Prioritas

| # | Root Cause | Severity | Effort | Prioritas |
|---|---|---|---|---|
| 1A | `didDrawCell` re-join destroys style info | High | Medium | **P1** |
| 1D | `didParseCell` uses preliminary cell width | High | High | **P1** |
| 1B | Header cells keep `**` markers | Medium | Low | **P2** |
| 2A | Regex too strict for thematic breaks | Medium | Low | **P2** |
| 2D | Setext heading underlines leak | Medium | Low | **P2** |
| 2C | YAML frontmatter not filtered | Low | Low | **P3** |
| 2E | HTML tags / strikethrough not stripped | Low | Low | **P3** |
| 1C | measureSeg baseBold consistency | None | N/A | Not a bug |

### Edge Cases to Watch

1. **Cell dengan backtick:** Teks `` `code` `` di-join menjadi `code` → re-parse tidak menemukan backtick → code font (courier) di measurement tapi helvetica di drawing. Courier lebih lebar → measurement > drawing → over-reserved height (tidak overflow, tapi wasted space).

2. **Cell dengan link:** `[text](url)` → segs `[{text:"text"}]` → joined `"text"` → re-parsed `[{text:"text"}]`. Konsisten, tapi jika URL panjang ada di stripped body text (autoTable column calc) vs drawing, bisa diverge.

3. **Nested bold+italic:** `***text***` → `parseInline` menangkap `**` first → `{text:"", bold:true}` kosong + sisa `*text***` → cascading parse error. Ini sudah ada sebagai existing bug terpisah dari overflow.

4. **Table header `---` false positive:** Header cell `| --- |` diikuti separator `| --- |` → baris pertama jadi header, baris kedua jadi separator. Tetapi jika header cell literally berisi `---`, itu benar (bukan thematic break karena di dalam `|...|`). Sudah handled correctly.

5. **`===` sebagai thematic break di tabel:** `collectTableBodyRows` memanggil `isThematicBreak` untuk baris yang bukan `|...|` (line 235). `===` ter-match → dikonsumsi. Benar untuk standalone, tapi `====` (4 chars) TIDAK ter-match → memotong tabel. Apply fix 2A untuk konsistensi.
