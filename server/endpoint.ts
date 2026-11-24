// Resolusi endpoint + API key untuk provider AI — dipakai bersama oleh
// /api/generate-prd, /api/test-connection, dan /api/models (hindari duplikasi logika SSRF/key).
//
// SSRF guard: tolak custom endpoint yang menunjuk ke alamat privat/loopback/metadata.
// Cek IP literal via range; untuk nama domain, resolve DNS dan tolak bila ADA hasil privat
// (mitigasi DNS rebinding sederhana). Stdlib saja (net + dns), tanpa dependency baru.
import net from "net";
import dns from "dns";

import { log } from "./log";
import { normalizeChatEndpoint, PROVIDER_MODELS } from "../shared/models";
import type { AIProvider } from "../shared/types";

// Alamat privat/loopback hanya diizinkan di luar production, atau bila
// ALLOW_PRIVATE_ENDPOINTS=true di-set secara eksplisit (mis. proxy LLM lokal).
// Dibaca per-panggilan agar bisa diuji tanpa reload modul.
export function allowPrivateEndpoints(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_PRIVATE_ENDPOINTS === "true";
}

// Fallback ke server API key dari .env dinonaktifkan secara default untuk
// mencegah open-proxy / exfil kredit owner oleh pengguna anonim di production.
// Hanya aktif bila ALLOW_SERVER_KEY_FALLBACK=true di-set secara eksplisit.
export function allowServerKeyFallback(): boolean {
  return process.env.ALLOW_SERVER_KEY_FALLBACK === "true";
}

export function isPrivateAddress(ip: string): boolean {
  const type = net.isIP(ip);
  if (type === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 0) return true;                          // 0.0.0.0/8
    if (a === 127) return true;                        // 127.0.0.0/8 loopback
    if (a === 10) return true;                         // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
    if (a === 192 && b === 168) return true;           // 192.168.0.0/16
    if (a === 169 && b === 254) return true;           // 169.254.0.0/16 link-local + metadata
    return false;
  }
  if (type === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;       // loopback / unspecified
    if (lower.startsWith("fe8") || lower.startsWith("fe9") ||
        lower.startsWith("fea") || lower.startsWith("feb")) return true; // fe80::/10 link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;   // fc00::/7 unique-local
    // IPv4-mapped (::ffff:a.b.c.d)
    const v4 = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4) return isPrivateAddress(v4[1]);
    return false;
  }
  return false;
}

// true = endpoint boleh dipakai. `allowPrivate` di-inject agar mudah diuji.
export async function assertPublicEndpoint(
  urlStr: string,
  allowPrivate: boolean = allowPrivateEndpoints(),
): Promise<boolean> {
  let hostname: string;
  try {
    hostname = new URL(urlStr).hostname;
  } catch {
    return false; // URL invalid selalu ditolak
  }
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return allowPrivate;
  // IP literal — cek langsung
  if (net.isIP(h)) return allowPrivate || !isPrivateAddress(h);
  // Nama domain — resolve, tolak bila ada hasil di range privat
  try {
    const results = await dns.promises.lookup(h, { all: true });
    if (results.length === 0) return false;
    if (results.some((r) => isPrivateAddress(r.address))) return allowPrivate;
    return true;
  } catch {
    return false; // resolve gagal -> jangan izinkan (juga saat flag aktif)
  }
}

// Host privat/loopback yang bisa dinilai tanpa DNS (untuk logging & deteksi lokal).
function isPrivateHostLiteral(urlStr: string): boolean {
  try {
    const h = new URL(urlStr).hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".localhost")) return true;
    return net.isIP(h) ? isPrivateAddress(h) : false;
  } catch {
    return false;
  }
}

async function isPrivateEndpoint(urlStr: string): Promise<boolean> {
  if (isPrivateHostLiteral(urlStr)) return true;
  try {
    const h = new URL(urlStr).hostname.toLowerCase();
    if (net.isIP(h)) return isPrivateAddress(h);
    const results = await dns.promises.lookup(h, { all: true });
    return results.some((r) => isPrivateAddress(r.address));
  } catch {
    return false;
  }
}

export type EndpointResolution =
  | { ok: true; endpoint: string; isPrivate: boolean; usingCustomEndpoint: boolean }
  | { ok: false; reason: "missing_endpoint" | "invalid_url" | "private_blocked"; url: string };

// Resolusi endpoint universal OpenAI-compatible dengan auto-normalize Base URL + SSRF guard.
// TIDAK PERNAH fallback diam-diam — endpoint yang ditolak mengembalikan ok:false.
export async function resolveEndpoint(
  provider: AIProvider,
  customEndpoint: unknown,
): Promise<EndpointResolution> {
  const rawServerEndpoint = process.env.AI_ENDPOINT?.trim() || "";
  const serverDefaultEndpoint = rawServerEndpoint ? normalizeChatEndpoint(rawServerEndpoint) : null;
  const hasCustom = typeof customEndpoint === "string" && customEndpoint.trim().length > 0;

  if (hasCustom) {
    const trimmed = customEndpoint.trim();
    const normalized = normalizeChatEndpoint(trimmed);
    if (!normalized) {
      log("WARN", `Rejected custom endpoint (invalid URL or non-http protocol): ${trimmed}`);
      return { ok: false, reason: "invalid_url", url: trimmed };
    }

    if (!(await assertPublicEndpoint(normalized))) {
      log("WARN", `Rejected custom endpoint (SSRF guard, private/loopback address): ${normalized}`);
      return { ok: false, reason: "private_blocked", url: normalized };
    }

    const isPrivate = await isPrivateEndpoint(normalized);
    if (isPrivate) {
      log("WARN", `Private/loopback endpoint allowed (non-production or ALLOW_PRIVATE_ENDPOINTS=true): ${normalized}`);
    }

    const defaultForCompare =
      provider === "openai_compatible"
        ? serverDefaultEndpoint
        : (PROVIDER_MODELS[provider]?.endpoint ?? null);

    return {
      ok: true,
      endpoint: normalized,
      isPrivate,
      usingCustomEndpoint: normalized !== defaultForCompare,
    };
  }

  if (provider === "openai_compatible") {
    if (!rawServerEndpoint) {
      return { ok: false, reason: "missing_endpoint", url: "" };
    }
    if (!serverDefaultEndpoint) {
      log("WARN", `Rejected AI_ENDPOINT env (invalid URL or non-http protocol): ${rawServerEndpoint}`);
      return { ok: false, reason: "invalid_url", url: rawServerEndpoint };
    }
    if (!(await assertPublicEndpoint(serverDefaultEndpoint))) {
      log("WARN", `Rejected AI_ENDPOINT env (SSRF guard, private/loopback address): ${serverDefaultEndpoint}`);
      return { ok: false, reason: "private_blocked", url: serverDefaultEndpoint };
    }
    const isPrivate = await isPrivateEndpoint(serverDefaultEndpoint);
    return {
      ok: true,
      endpoint: serverDefaultEndpoint,
      isPrivate,
      usingCustomEndpoint: false,
    };
  }

  // Legacy provider alias fallback when customEndpoint is omitted.
  const providerConfig = PROVIDER_MODELS[provider] ?? PROVIDER_MODELS.deepseek;
  return {
    ok: true,
    endpoint: providerConfig.endpoint,
    isPrivate: false,
    usingCustomEndpoint: false,
  };
}

export function endpointErrorMessage(
  res: Extract<EndpointResolution, { ok: false }>,
  language: "id" | "en",
): string {
  if (res.reason === "missing_endpoint") {
    return language === "en"
      ? "Endpoint URL is required. Configure your OpenAI-compatible Base URL in Settings."
      : "URL Endpoint wajib diisi. Atur Base URL OpenAI-compatible Anda di Pengaturan.";
  }
  if (res.reason === "invalid_url") {
    return language === "en"
      ? `Endpoint rejected: ${res.url}. Must be a valid http:// or https:// URL.`
      : `Endpoint ditolak: ${res.url}. Harus berupa URL http:// atau https:// yang valid.`;
  }
  return language === "en"
    ? `Endpoint rejected: ${res.url}. Private/loopback addresses are blocked in production. Set ALLOW_PRIVATE_ENDPOINTS=true to allow.`
    : `Endpoint ditolak: ${res.url}. Alamat privat/loopback diblokir di mode produksi. Set ALLOW_PRIVATE_ENDPOINTS=true untuk mengizinkan.`;
}

// Prioritas: cookie > .env (hanya jika allowFallback=true dan bukan custom endpoint).
// Untuk custom endpoint HANYA cookieKey milik user — jangan pernah forward server .env key
// ke endpoint pihak ketiga. Untuk endpoint lokal yang diizinkan SSRF guard, API key opsional.
export function resolveApiKey(
  provider: AIProvider,
  usingCustomEndpoint: boolean,
  cookieKey: string | undefined,
  allowFallback: boolean = allowServerKeyFallback(),
  isPrivate: boolean = false,
): { apiKey: string | undefined; optional: boolean; apiKeyEnvName: string } {
  const apiKeyEnvName =
    provider === "openai_compatible"
      ? "AI_API_KEY"
      : (PROVIDER_MODELS[provider]?.apiKeyEnvName ?? "AI_API_KEY");
  const serverKey = process.env[apiKeyEnvName]?.trim() || undefined;
  const trimmedCookie = typeof cookieKey === "string" && cookieKey.trim() ? cookieKey.trim() : undefined;
  const optional = Boolean(isPrivate && allowPrivateEndpoints());

  let apiKey: string | undefined;
  if (usingCustomEndpoint) {
    apiKey = trimmedCookie;
  } else if (trimmedCookie) {
    apiKey = trimmedCookie;
  } else if (allowFallback) {
    apiKey = serverKey;
  } else {
    apiKey = undefined;
  }

  return {
    apiKey,
    optional,
    apiKeyEnvName,
  };
}
