import { UploadedFile, AIProvider } from "../types";

export const generatePRD = async (
  prompt: string,
  customApiKey: string | undefined,
  provider: AIProvider,
  model: string,
  language: "id" | "en",
  productType: string,
  uploadedFiles: UploadedFile[],
  mode: string = "initial",
  onChunk: (chunk: string) => void,
) => {
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
    }),
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
  let flushTimeout: any = null;

  const flush = () => {
    if (batchedChunk) {
      onChunk(batchedChunk);
      batchedChunk = "";
    }
    if (flushTimeout) clearTimeout(flushTimeout);
  };

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

          let data;
          try {
            data = JSON.parse(dataStr);
          } catch (e: any) {
            console.error("Error parsing JSON from SSE", e, dataStr);
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
};
