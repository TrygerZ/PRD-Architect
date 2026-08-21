import { describe, it, expect } from "vitest";
import { normalizeBrTags } from "./format";

describe("normalizeBrTags", () => {
  it("<br>, <br/>, <br /> → spasi", () => {
    expect(normalizeBrTags("Given X<br>When Y")).toBe("Given X When Y");
    expect(normalizeBrTags("Given X<br/>When Y")).toBe("Given X When Y");
    expect(normalizeBrTags("Given X<br />When Y")).toBe("Given X When Y");
  });

  it("case-insensitive & multiple tags", () => {
    expect(normalizeBrTags("A<BR>B<br>c<Br/>d")).toBe("A B c d");
  });

  it("rapatkan spasi ganda hasil penggantian + trim", () => {
    expect(normalizeBrTags("A <br> <br> B")).toBe("A B");
    expect(normalizeBrTags("  A  ")).toBe("A");
  });

  it("teks tanpa tag tidak berubah", () => {
    expect(normalizeBrTags("Given X, When Y, then Z")).toBe("Given X, When Y, then Z");
  });

  it("indentasi leading bullet WBS bersarang dipertahankan", () => {
    expect(normalizeBrTags("- Fitur\n  - Sub\n    - Sub-sub")).toBe("- Fitur\n  - Sub\n    - Sub-sub");
  });

  it("<br><br> di tengah sel tabel tetap collapse jadi satu spasi", () => {
    expect(normalizeBrTags("| A<br><br>B |")).toBe("| A B |");
  });
});
