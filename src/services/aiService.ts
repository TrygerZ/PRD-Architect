import type { SSEChunk } from "../../shared/types";
import type { UploadedFile, AIProvider, ContinuationStatus, TruncationInfo } from "../types";

class NonRetryableError extends Error {}

export interface GeneratePRDOptions {
  existingContent?: string;
  maxTokens?: number;
  onContinuing?: (status: ContinuationStatus) => void;
  onTruncated?: (info: TruncationInfo) => void;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB buffer limit
const FLUSH_INTERVAL_MS = 80;

export const generatePRD = async (
  prompt: string,
  _customApiKey: string | undefined,
  provider: AIProvider,
  model: string,
  language: "id" | "en",
  productType: string,
  uploadedFiles: UploadedFile[],
  mode: string = "initial",
  prdMode: "business" | "technical" | "simple" = "business",
  signal: AbortSignal | undefined,
  onChunk: (chunk: { text?: string; reasoning?: string }) => void,
  customEndpoint?: string,
  customChapterIds?: string[],
  options?: GeneratePRDOptions,
) => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let streamEstablished = false;
    try {
      const response = await fetch("/api/generate-prd", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          provider,
          model,
          customEndpoint,
          language,
          productType,
          uploadedFiles,
          mode,
          prdMode,
          ...(customChapterIds && customChapterIds.length > 0 ? { customChapterIds } : {}),
          ...(options?.existingContent ? { existingContent: options.existingContent } : {}),
          ...(options?.maxTokens ? { maxTokens: options.maxTokens } : {}),
        }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || `Server responded with ${response.status}`);

        // Don't retry client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw new NonRetryableError(error.message);
        }

        // Retry server errors (5xx)
        lastError = error;
        if (attempt < MAX_RETRIES) {
          console.warn(`Attempt ${attempt + 1} failed, retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }
        throw error;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;

      if (!reader) {
        throw new Error("ReadableStream not supported.");
      }

      streamEstablished = true;

      let buffer = "";
      let batchedChunk = "";
      let batchedReasoning = "";
      let lastFlush = Date.now();
      let flushTimeout: ReturnType<typeof setTimeout> | null = null;
      let flushRaf: number | null = null;

      const cancelScheduledFlush = () => {
        if (flushTimeout) {
          clearTimeout(flushTimeout);
          flushTimeout = null;
        }
        if (flushRaf !== null && typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(flushRaf);
          flushRaf = null;
        }
      };

      const flush = () => {
        cancelScheduledFlush();
        if (batchedChunk || batchedReasoning) {
          onChunk({ text: batchedChunk, reasoning: batchedReasoning });
          batchedChunk = "";
          batchedReasoning = "";
          lastFlush = Date.now();
        }
      };

      const scheduleFlush = () => {
        const elapsed = Date.now() - lastFlush;
        if (elapsed >= FLUSH_INTERVAL_MS) {
          if (typeof requestAnimationFrame === "function") {
            if (flushRaf === null) {
              flushRaf = requestAnimationFrame(() => {
                flushRaf = null;
                flush();
              });
            }
          } else {
            flush();
          }
          return;
        }
        if (!flushTimeout && flushRaf === null) {
          flushTimeout = setTimeout(() => {
            flushTimeout = null;
            if (typeof requestAnimationFrame === "function") {
              flushRaf = requestAnimationFrame(() => {
                flushRaf = null;
                flush();
              });
            } else {
              flush();
            }
          }, FLUSH_INTERVAL_MS - elapsed);
        }
      };

      try {
        let consecutiveParseErrors = 0;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;

          if (value) {
            buffer += decoder.decode(value, { stream: true });

            // Safety check — prevent unbounded buffer growth
            if (buffer.length > MAX_BUFFER_SIZE) {
              console.warn(`Buffer exceeded ${MAX_BUFFER_SIZE} bytes, flushing residual`);
              buffer = buffer.substring(0, MAX_BUFFER_SIZE);
            }

            let newlineIdx;

            while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, newlineIdx);
              buffer = buffer.slice(newlineIdx + 1);

              if (line.startsWith("data:")) {
                const dataStr = line.slice(5).trim();
                if (!dataStr) continue;
                if (dataStr === "[DONE]") {
                  done = true;
                  flush();
                  break;
                }

                let data: SSEChunk;
                try {
                  data = JSON.parse(dataStr);
                  consecutiveParseErrors = 0;
                } catch (e: unknown) {
                  console.warn("Error parsing JSON from SSE", e instanceof Error ? e.message : e);
                  consecutiveParseErrors++;
                  if (consecutiveParseErrors > 5) {
                    throw new Error("Too many malformed chunks from server. Stream aborted.");
                  }
                  continue;
                }

                if (data.error) {
                  throw new NonRetryableError(data.error);
                }

                if (data.continuing) {
                  options?.onContinuing?.(data.continuing);
                }

                if (data.truncated) {
                  options?.onTruncated?.(data.truncated);
                }

                if (data.text || data.reasoning) {
                  if (data.text) batchedChunk += data.text;
                  if (data.reasoning) batchedReasoning += data.reasoning;
                  // Coalesce flushes to ~80ms + animation frames so heavy Markdown chapters stay responsive
                  scheduleFlush();
                }
              }
            }
          }
        }

        flush();
      } finally {
        reader.cancel().catch(() => {});
        flush();
        // Flush residual buffer content — partial line (BUG B4)
        if (buffer.trim()) {
          try {
            const trimmed = buffer.trim();
            if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.slice(5).trim();
              if (dataStr && dataStr !== '[DONE]') {
                const data: SSEChunk = JSON.parse(dataStr);
                if (data.continuing) options?.onContinuing?.(data.continuing);
                if (data.truncated) options?.onTruncated?.(data.truncated);
                if (data.text || data.reasoning) onChunk({ text: data.text, reasoning: data.reasoning });
              }
            }
          } catch {
            // Partial/incomplete data — silently ignore
          }
        }
      }

      // Success — exit after successful streaming completion
      return;

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry non-retryable errors (e.g. 4xx client errors, explicit stream error events)
      if (lastError instanceof NonRetryableError) {
        throw lastError;
      }

      // Don't retry abort errors
      if (lastError.name === 'AbortError') {
        throw lastError;
      }

      // Don't retry errors occurring after stream establishment (e.g. stream errors, SSE data.error)
      if (streamEstablished) {
        throw lastError;
      }

      // Don't retry if max retries reached
      if (attempt >= MAX_RETRIES) {
        throw lastError;
      }

      // Retry on network errors
      console.warn(`Attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${RETRY_DELAY_MS}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  // Should not reach here, but just in case
  throw lastError || new Error('Generation failed after retries');
};
