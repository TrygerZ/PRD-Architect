import { UploadedFile, AIProvider } from "../types";

interface SSEChunk {
  text?: string;
  reasoning?: string;
  error?: string;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB buffer limit

export const generatePRD = async (
  prompt: string,
  customApiKey: string | undefined,
  provider: AIProvider,
  model: string,
  language: "id" | "en",
  productType: string,
  uploadedFiles: UploadedFile[],
  mode: string = "initial",
  prdMode: "business" | "technical" | "simple" = "business",
  signal: AbortSignal | undefined,
  onChunk: (chunk: { text?: string; reasoning?: string }) => void,
) => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch("/api/generate-prd", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          customApiKey,
          provider,
          model,
          language,
          productType,
          uploadedFiles,
          mode,
          prdMode,
        }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || `Server responded with ${response.status}`);

        // Don't retry client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw error;
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

      let buffer = "";
      let batchedChunk = "";
      let batchedReasoning = "";
      let lastFlush = Date.now();
      let flushTimeout: ReturnType<typeof setTimeout> | null = null;

      const flush = () => {
        if (batchedChunk || batchedReasoning) {
          onChunk({ text: batchedChunk, reasoning: batchedReasoning });
          batchedChunk = "";
          batchedReasoning = "";
        }
        if (flushTimeout) clearTimeout(flushTimeout);
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

              if (line.startsWith("data: ")) {
                const dataStr = line.substring(6);
                if (dataStr === "[DONE]") {
                  done = true;
                  flush();
                  break;
                }

                let data: SSEChunk;
                try {
                  data = JSON.parse(dataStr);
                  consecutiveParseErrors = 0;
                } catch (e: any) {
                  console.warn("Error parsing JSON from SSE", e instanceof Error ? e.message : e);
                  consecutiveParseErrors++;
                  if (consecutiveParseErrors > 5) {
                    throw new Error("Too many malformed chunks from server. Stream aborted.");
                  }
                  continue;
                }

                if (data.error) {
                  throw new Error(data.error);
                }

                if (data.text || data.reasoning) {
                  if (data.text) batchedChunk += data.text;
                  if (data.reasoning) batchedReasoning += data.reasoning;
                  // Throttle flush to avoid blocking UI thread with continuous heavy markdown parsing
                  if (Date.now() - lastFlush > 50) {
                    flush();
                    lastFlush = Date.now();
                  } else {
                    if (flushTimeout) clearTimeout(flushTimeout);
                    flushTimeout = setTimeout(() => {
                      flush();
                      lastFlush = Date.now();
                    }, 50);
                  }
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
            if (buffer.startsWith('data: ')) {
              const dataStr = buffer.substring(6);
              if (dataStr !== '[DONE]') {
                const data: SSEChunk = JSON.parse(dataStr);
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

      // Don't retry abort errors
      if (lastError.name === 'AbortError') {
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
