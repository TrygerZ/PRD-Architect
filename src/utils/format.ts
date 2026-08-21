// AI kadang menyelipkan tag <br>/<br/> di dalam sel tabel Markdown padahal
// Markdown tidak mendukung HTML — tag mentah akan bocor ke PDF/DOCX/print.
// Normalisasi: ganti jadi spasi + rapatkan spasi ganda hasil penggantian.
// Lookbehind (?<=\S): hanya collapse spasi ganda SETELAH karakter non-spasi,
// agar indentasi leading baris bullet WBS bersarang tidak ikut terhapus.
export function normalizeBrTags(text: string): string {
  return text.replace(/<br\s*\/?>/gi, " ").replace(/(?<=\S) {2,}/g, " ").trim();
}

export function formatDate(ts: number, language: "en" | "id"): string {
  return new Date(ts).toLocaleString(language === "en" ? "en-US" : "id-ID", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}
