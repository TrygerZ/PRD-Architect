import { UploadedFile, AIProvider } from "../types";

interface SSEChunk {
  text?: string;
  reasoning?: string;
  error?: string;
}

export const generatePRD = async (
  prompt: string,
  customApiKey: string | undefined,
  provider: AIProvider,
  model: string,
  language: "id" | "en",
  productType: string,
  uploadedFiles: UploadedFile[],
  mode: string = "initial",
  prdMode: "business" | "technical" = "business",
  signal: AbortSignal | undefined,
  onChunk: (chunk: string) => void,
) => {
  const response = await fetch("/api/generate-prd", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
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
    throw new Error(errorData.error || `Server responded with ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder("utf-8");
  let done = false;

  if (!reader) {
    throw new Error("ReadableStream not supported.");
  }

  let buffer = "";
  let batchedChunk = "";
  let lastFlush = Date.now();
  let flushTimeout: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (batchedChunk) {
      onChunk(batchedChunk);
      batchedChunk = "";
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

            if (data.text) {
              batchedChunk += data.text;
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
            if (data.text) onChunk(data.text);
          }
        }
      } catch {
        // Partial/incomplete data — silently ignore
      }
    }
  }
};
