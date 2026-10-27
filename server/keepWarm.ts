// Self keep-warm ping — Render free tier spin-down setelah 15 menit tanpa traffic.
// Request dari instance ke hostname publiknya sendiri keluar lewat internet lalu
// masuk lagi lewat load balancer Render, jadi dihitung sebagai inbound traffic.
import { log } from "./log";

export function startKeepWarm(
  baseUrl: string,
  opts?: {
    intervalMs?: number;
    fetchImpl?: typeof fetch;
    onError?: (err: unknown) => void;
  },
): () => void {
  // Local dev / tanpa env var: tidak ada yang perlu dijaga tetap hidup.
  if (!baseUrl) return () => {};

  const intervalMs = opts?.intervalMs ?? 5 * 60 * 1000;
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const onError = opts?.onError ?? ((err: unknown) => log("WARN", "Keep-warm ping failed.", err));

  // Ping pertama baru setelah satu interval — boot itu sendiri sudah traffic.
  const timer = setInterval(() => {
    fetchImpl(`${baseUrl}/health`, { signal: AbortSignal.timeout(30_000) }).catch(onError);
  }, intervalMs);

  // Jangan biarkan timer ini menahan process tetap hidup.
  timer.unref?.();

  return () => clearInterval(timer);
}
