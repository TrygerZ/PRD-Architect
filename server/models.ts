import { log } from "./log";
import type { RemoteModelOption } from "../shared/types";

export type FetchModelsResult =
  | { ok: true; models: RemoteModelOption[] }
  | { ok: false; error: string };

export const MAX_REMOTE_MODELS = 500;
export const FETCH_MODELS_TIMEOUT_MS = 15_000;

async function readTruncatedBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.length > 500 ? `${text.slice(0, 500)}...[truncated]` : text;
  } catch {
    return "<unreadable>";
  }
}

function extractContextLength(record: Record<string, unknown>): number | undefined {
  const raw = record.context_length ?? record.max_context_length;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  return undefined;
}

export function parseModelsPayload(
  payload: unknown,
  limit: number = MAX_REMOTE_MODELS,
): RemoteModelOption[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }
  const obj = payload as Record<string, unknown>;
  const rawList = Array.isArray(obj.data)
    ? obj.data
    : Array.isArray(obj.models)
      ? obj.models
      : [];

  const unique = new Map<string, RemoteModelOption>();
  for (const item of rawList) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.id !== "string") continue;
    const id = rec.id.trim();
    if (!id) continue;
    if (unique.has(id)) continue;

    const contextLength = extractContextLength(rec);
    unique.set(id, contextLength !== undefined ? { id, contextLength } : { id });
  }

  const maxCount = Math.max(1, Math.floor(limit));
  return Array.from(unique.values())
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, maxCount);
}

function mapHttpError(status: number, language: "en" | "id"): string {
  if (status === 401 || status === 403) {
    return language === "en"
      ? "Authentication failed while fetching models. Check your API key."
      : "Autentikasi gagal saat memuat daftar model. Periksa API key Anda.";
  }
  if (status === 404) {
    return language === "en"
      ? "This endpoint does not expose a /models list. You can type a model ID manually."
      : "Endpoint ini tidak menyediakan daftar /models. Anda dapat mengetik ID model secara manual.";
  }
  if (status === 429) {
    return language === "en"
      ? "Rate limit exceeded while fetching models. Try again shortly."
      : "Batas permintaan tercapai saat memuat model. Coba lagi sebentar lagi.";
  }
  return language === "en"
    ? "Could not load models from this endpoint. Check your URL and credentials."
    : "Gagal memuat daftar model dari endpoint ini. Periksa URL dan kredensial Anda.";
}

export async function fetchUpstreamModels(args: {
  modelsUrl: string;
  apiKey?: string;
  language: "en" | "id";
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<FetchModelsResult> {
  const {
    modelsUrl,
    apiKey,
    language,
    fetchImpl = fetch,
    timeoutMs = FETCH_MODELS_TIMEOUT_MS,
  } = args;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (typeof apiKey === "string" && apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(modelsUrl, {
      method: "GET",
      headers,
      redirect: "manual",
      signal: controller.signal,
    });

    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      log("WARN", `Fetch models blocked HTTP redirect (status ${response.status}) url=${modelsUrl}`);
      return {
        ok: false,
        error:
          language === "en"
            ? "Endpoint attempted an HTTP redirect, which is blocked for security."
            : "Endpoint mencoba melakukan redirect HTTP, yang diblokir demi keamanan.",
      };
    }

    if (!response.ok) {
      const body = await readTruncatedBody(response);
      log(
        "ERROR",
        `Fetch models failed (status ${response.status} ${response.statusText}) url=${modelsUrl} body=${body}`,
      );
      return { ok: false, error: mapHttpError(response.status, language) };
    }

    let parsedJson: unknown;
    try {
      parsedJson = await response.json();
    } catch {
      log("ERROR", `Fetch models returned non-JSON response url=${modelsUrl}`);
      return {
        ok: false,
        error:
          language === "en"
            ? "Endpoint did not return a valid JSON model list. You can enter a model ID manually."
            : "Endpoint tidak mengembalikan daftar model JSON yang valid. Anda dapat mengetik ID model manual.",
      };
    }

    const models = parseModelsPayload(parsedJson);
    return { ok: true, models };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    log(
      "ERROR",
      `Fetch models error url=${modelsUrl}:`,
      err instanceof Error ? err.message : String(err),
    );
    return {
      ok: false,
      error: aborted
        ? language === "en"
          ? "Fetching models timed out after 15 seconds."
          : "Memuat daftar model habis waktu setelah 15 detik."
        : language === "en"
          ? "Could not reach the endpoint to fetch models. Check the Base URL."
          : "Tidak dapat menghubungi endpoint untuk memuat model. Periksa Base URL Anda.",
    };
  } finally {
    clearTimeout(timer);
  }
}
