# Root Cause Analysis — Table Content Overflows Cell Borders in PDF Export

**File:** `src/utils/export.ts`  
**Severity:** High  
**Status:** 4 confirmed root causes, 2 dismissed, 1 partially confirmed

---

## Executive Summary

The `data.cell.height` set in `didParseCell` (line 1101) is **completely ignored** by jspdf-autotable. The library overwrites `cell.height` with `row.height` at its `applyRowSpans` stage (autotable source line 1268). All height reservation logic in the current code is dead code. The actual cell height is determined by autoTable's own `fitContent()` which wraps the **stripped** text using its own line-height factor (1.15×) — while the custom rich-text drawing uses 1.4× line height. This line-height mismatch, combined with font-width divergence between stripped and styled text, causes systematic overflow.

---

## Confirmed Root Causes (Ranked by Impact)

### ROOT CAUSE #1 — `cell.height` assignment in `didParseCell` is dead code *(Issue D, Critical)*

**Evidence from jspdf-autotable source (`dist/jspdf.plugin.autotable.mjs`):**

```
Line 1124: function calculate(doc, table) {
Line 1134:     var hooks = table.hooks.didParseCell;
Line 1135:     table.callCellHooks(doc, hooks, cell, row, column, null);
            // ↑ our hook sets cell.height here
Line 1137:     cell.contentWidth = getStringWidth(cell.text, ...) + padding;
            // ↑ autoTable immediately recalculates from STRIPPED text
```

Then later in the pipeline:

```
Line 1315: function fitContent(table, doc) {
Line 1345:     cell.contentHeight = cell.getContentHeight(doc.scaleFactor(), doc.getLineHeightFactor());
Line 1357:     if (realContentHeight > row.height) row.height = realContentHeight;
            // ↑ row.height set from autoTable's OWN contentHeight, ignoring our cell.height
```

And finally:

```
Line 1268:     cell.height = row.height;
            // ↑ OVERWRITES whatever we set in didParseCell
```

**Impact:** Our entire height reservation mechanism (`richCellHeight`, `layoutInline` in `didParseCell`) is a no-op. autoTable decides height from stripped text using its own metrics. This is the architectural root cause.

**Fix:** Don't set `cell.height`. Instead, set `cell.styles.minCellHeight` which autoTable respects in `getContentHeight()` (autotable line 1038: `return Math.max(height, this.styles.minCellHeight)`).

```typescript
// Line 1101 — REPLACE:
data.cell.height = richCellHeight(Math.max(1, laid.length), 9, padV);

// WITH:
data.cell.styles.minCellHeight = richCellHeight(Math.max(1, laid.length), 9, padV);
```

---

### ROOT CAUSE #2 — Line-height mismatch: autoTable 1.15× vs custom drawing 1.4× *(New finding, Critical)*

**Evidence:**

autoTable `getContentHeight` (autotable line 1033–1036):
```javascript
Cell.prototype.getContentHeight = function (scaleFactor, lineHeightFactor) {
    if (lineHeightFactor === void 0) { lineHeightFactor = 1.15; }
    var lineHeight = (this.styles.fontSize / scaleFactor) * lineHeightFactor;
    var height = lineCount * lineHeight + this.padding('vertical');
```

Custom drawing (`writeRichText`, export.ts line 945):
```typescript
const lineHeight = fontSize * 1.4;
```

For fontSize=9, 5 lines:
- autoTable allocates: `pad + 5 × 9 × 1.15 = pad + 51.75pt`
- Custom drawing needs: `padTop + 9.45 + 4×12.6 + 2.25 + padBottom = pad + 62.1pt`
- **Deficit: 10.35pt** — text overflows border by >10pt on a 5-line cell

Even with Root Cause #1 fixed (via `minCellHeight`), this mismatch means `richCellHeight` must use the correct formula. Currently `richCellHeight` uses `nLines × fontSize × 1.4` which is consistent with the drawing code but NOT with autoTable's own height calculation.

**Impact:** Every multi-line cell overflows by approximately `nLines × fontSize × 0.25` points. 5 lines = 10+ pt overflow.

**Fix:** Already addressed by Root Cause #1 fix — `minCellHeight` forces autoTable to use our calculated height. But the `richCellHeight` formula must also account for the first-line baseline offset:

```typescript
// Line 352 — current:
export function richCellHeight(nLines: number, fontSize: number, padVertical: number): number {
  return padVertical + nLines * fontSize * 1.4;
}

// This is CORRECT for the drawing layout:
// First baseline: padTop + fontSize*1.05
// Subsequent: +fontSize*1.4 each
// Last descender: ~fontSize*0.25
// Total = padTop + fontSize*1.05 + (nLines-1)*fontSize*1.4 + fontSize*0.25 + padBottom
//       ≈ padVertical + fontSize*(1.3 + (nLines-1)*1.4)
//       = padVertical + fontSize*(1.4*nLines - 0.1)
// Current formula: padVertical + nLines*fontSize*1.4
// Margin: fontSize*0.1 = 0.9pt — tight but sufficient.
// NO CHANGE NEEDED in richCellHeight itself. Just ensure it's used via minCellHeight.
```

---

### ROOT CAUSE #3 — Font-width divergence: stripped text vs styled text *(Issue A extended, High)*

**Evidence:**

`body` (line 1066) = `normalizePdfText(stripInline(c))`:
- `"**Performance** via `Redis`"` → `"Performance via Redis"` — all in helvetica normal

`richSegs` (line 1069) = `parseInline(c)`:
- `"Performance"` in **bold** (helvetica-bold — wider glyphs)
- `"Redis"` in `code` (courier — fixed-width, typically wider)

autoTable's `fitContent` wraps the stripped text in helvetica-normal. Our `layoutInline` wraps the parsed segments with their actual fonts (bold, courier). Bold text is ~5-8% wider; courier is ~10-20% wider than helvetica for the same text.

**Impact:** Rich text wraps to MORE lines than stripped text → autoTable allocates too few lines → vertical overflow. This compounds with Root Cause #2.

**Fix:** Already solved by Root Cause #1 fix. Once `minCellHeight` is set from `layoutInline`'s accurate line count (which uses correct fonts), autoTable will respect the taller height.

BUT — `data.cell.width` is `0` during `didParseCell` (see Root Cause #4), so the `layoutInline` call in `didParseCell` gets the wrong available width.

---

### ROOT CAUSE #4 — `data.cell.width` is 0 during `didParseCell` *(Issue C, High)*

**Evidence from autotable source:**

```javascript
// Cell constructor (line 982):
this.width = 0;

// calculate() calls didParseCell FIRST (line 1134-1135)
// THEN column widths are assigned (calculateWidths lines 1085-1096)
// THEN cell.width = column.width (during fitContent/applyRowSpans)
```

So `data.cell.width` = 0 when our `didParseCell` runs (line 1096-1099):
```typescript
const padL = data.cell.padding("left");  // 4
const padR = data.cell.padding("right"); // 4
const laid = layoutInline(segs, data.cell.width - padL - padR, measureSeg, true);
// availWidth = 0 - 4 - 4 = -8
```

With `availWidth = -8`, every word exceeds the width → each word gets its own line → `breakLongWords` breaks every word character by character. The line count is MASSIVELY overestimated.

**Impact:** If Root Cause #1 is fixed (using `minCellHeight`), this bug would cause cells to be ENORMOUSLY tall (hundreds of points for typical text). The height reservation would be based on a fictitious width of -8pt.

**Fix:** Move the height calculation from `didParseCell` to `willDrawCell` (where `cell.width` IS finalized), or use a different hook. But `willDrawCell` is too late for height reservation. 

The correct approach: set `minCellHeight` in the **`didDrawCell`** hook is too late. Instead, we can pre-calculate using the available page width divided by number of columns as an estimate, or better — move to using autoTable's `columnStyles` with `cellWidth` to control column widths explicitly.

**Best fix:** Calculate layout in `didDrawCell` and let `writeRichText` handle clipping. For height: set `minCellHeight` based on estimated column width. Better yet — use a two-pass approach or hook into a later stage.

**Practical fix:** Since we can't get reliable width in `didParseCell`, we should:
1. Remove the `layoutInline` call from `didParseCell` entirely
2. In `didDrawCell`, after `writeRichText` draws the content, check if it overflowed and log a warning
3. Use `minCellHeight` with a generous estimate (e.g., based on text length heuristic)

**OR** the simplest correct fix: Calculate the available width manually:

```typescript
didParseCell(data) {
    if (data.section !== "body") return;
    const segs = richSegs[data.row.index]?.[data.column.index];
    if (!segs) return;
    (data.cell as unknown as RichCell).richSegs = segs;
    const padL = data.cell.padding("left");
    const padR = data.cell.padding("right");
    doc.setFontSize(9);

    // data.cell.width is 0 here — autoTable hasn't assigned column widths yet.
    // Estimate: total table width / number of columns.
    const tableWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const nCols = head[0].length;
    const cellW = tableWidth / nCols;

    const laid = layoutInline(segs, cellW - padL - padR, measureSeg, true);
    const padV = data.cell.padding("top") + data.cell.padding("bottom");
    data.cell.styles.minCellHeight = richCellHeight(Math.max(1, laid.length), 9, padV);
},
```

**Even better fix — recalculate in `willDrawCell`:**

`willDrawCell` fires during drawing, AFTER column widths are finalized. We can set the height there — but autoTable may have already committed row heights. Let me verify:

Looking at autotable line 1870: `willDrawCell` is called in `printRow`, which is AFTER all layout is done. Too late for height.

**Correct architectural fix:**

```typescript
// 1. In didParseCell: store segs, estimate height with approximate width
// 2. In didDrawCell: draw with actual width (already works)
// The height from didParseCell is an estimate — use generous cellWidth estimate
```

---

## Dismissed Issues

### Issue A — `measureSeg` vs `writeRichText` measurement divergence: **NOT A BUG**

Both call `fontStyleFor(seg, false, false)` with `baseBold=false, baseItalic=false`. The `didDrawCell` call to `writeRichText` passes no `bold`/`italic` opts, so `baseBold = opts.bold ?? false = false`. Both use identical `normalizePdfText` in their measure functions. The measurements match.

### Issue B — `normalizePdfText` applied inconsistently: **NOT A BUG (for overflow)**

Both `measureSeg` and `writeRichText`'s `measure` closure normalize INSIDE the measure function. `layoutInline` tokenizes on RAW text but measures NORMALIZED widths. The wrapping decisions are based on normalized widths. The tokens store RAW text but rendering normalizes them again. The widths are consistent.

However, `breakLongWords` character iteration (line 325: `for (const ch of tok.text)`) iterates RAW characters. If a RAW char normalizes to multiple chars (e.g., `→` → `->`, `…` → `...`), the chunk boundaries are incorrect. But this only affects character-level breaking of extremely long words in narrow columns — a minor edge case, not the main overflow cause.

### Issue G — HTML tags in table cells: **MITIGATED**

Line 1004-1007 already strips HTML tags from lines before table detection. `parseTableRow` calls `normalizeBrTags(c.trim())`. Other tags (`<b>`, `<i>`) would survive into cell text but `parseInline` doesn't parse HTML — they'd be literal text. `stripInline` also doesn't strip HTML. So both paths see the same HTML literals → no divergence → no overflow from this.

---

## Partially Confirmed Issues

### Issue E — `richCellHeight` formula: **MARGINALLY CORRECT but with wrong padding axis**

The formula itself is sufficient (0.9pt margin). BUT:

**Line 1111:** `const pad = data.cell.padding("left")` — uses LEFT padding for vertical Y positioning (line 1113: `y = data.cell.y + pad + 9 * 1.05`). Should be `data.cell.padding("top")`. With uniform `cellPadding: 4`, both return 4 — works by coincidence. Would break with non-uniform padding.

```typescript
// Line 1111 — FIX:
const pad = data.cell.padding("top");
// Also line 1116 needs separate left padding:
const padL = data.cell.padding("left");
// ...
bounds: {
    left: data.cell.x + padL,
```

### Issue F — `parseInline` vs `stripInline` divergence: **REAL but helps, not hurts**

When `parseInline` fails to match markers (unclosed `**`), it produces different text than `stripInline`. But:
- If `parseInline` strips MORE markers → rich text narrower → fewer lines → fits in autoTable height → no overflow
- If `parseInline` strips FEWER markers → rich text wider → more lines → overflow

In practice, `parseInline` is MORE aggressive at consuming markers (it parses `*x*` as italic even without strict word boundaries, while `stripInline` uses `(.+?)` which is less greedy). So `parseInline` usually produces text ≤ stripped text width. Not a significant overflow cause.

---

## Complete Fix Implementation

```typescript
// === FIX 1: Line 1088-1102 — didParseCell ===
// Replace entire didParseCell body:

didParseCell(data) {
    if (data.section !== "body") return;
    const segs = richSegs[data.row.index]?.[data.column.index];
    if (!segs) return;
    (data.cell as unknown as RichCell).richSegs = segs;

    // cell.width is 0 here (autoTable hasn't assigned column widths yet).
    // Estimate available width from page width / column count.
    const tableWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const nCols = head[0].length;
    const estCellW = tableWidth / nCols;
    const padL = data.cell.padding("left");
    const padR = data.cell.padding("right");
    doc.setFontSize(9);
    const laid = layoutInline(segs, estCellW - padL - padR, measureSeg, true);
    const padV = data.cell.padding("top") + data.cell.padding("bottom");

    // Use minCellHeight — autoTable respects this in getContentHeight().
    // Setting cell.height is useless (autoTable overwrites it in applyRowSpans).
    data.cell.styles.minCellHeight = richCellHeight(Math.max(1, laid.length), 9, padV);
},


// === FIX 2: Line 1108-1121 — didDrawCell ===
// Fix padding axis and recalculate with actual width:

didDrawCell(data) {
    const segs = (data.cell as unknown as RichCell).richSegs;
    if (!segs || segs.length === 0) return;
    const padTop = data.cell.padding("top");
    const padL = data.cell.padding("left");
    const yRestore = y;
    y = data.cell.y + padTop + 9 * 1.05; // baseline baris pertama
    writeRichText(segs, 9, {
        bounds: {
            left: data.cell.x + padL,
            right: data.cell.x + data.cell.width - data.cell.padding("right"),
        },
    });
    y = yRestore;
},
```

---

## Risk Assessment

| Fix | Risk | Mitigation |
|-----|------|------------|
| `minCellHeight` instead of `cell.height` | Low — uses documented autoTable API | Test with varied table sizes |
| Estimated column width in `didParseCell` | Medium — estimate may differ from final width | If columns are unequal width, some cells get too much/too little height. Over-estimation is safe (extra whitespace). Under-estimation causes overflow. Consider adding 10% margin. |
| Padding axis fix (`"left"` → `"top"`) | Zero risk with uniform padding | Only matters if non-uniform padding is introduced later |

## Recommended Testing

1. Table with **bold** and `code` in cells — verify no overflow
2. Table with 5+ columns (narrow cells) — verify estimated width is sufficient
3. Table with mixed short/long cells — verify row height accommodates tallest cell
4. Table with unicode characters (→, •, —) — verify normalization doesn't break layout
5. Table spanning page break — verify split rows render correctly
