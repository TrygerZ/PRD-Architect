export function formatDate(ts: number, language: "en" | "id"): string {
  return new Date(ts).toLocaleString(language === "en" ? "en-US" : "id-ID", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}
