// Template HTML untuk print/download PRD + helper download Markdown.
// Dipisah dari App.tsx agar monolit tidak membengkak (pure move, zero logic change).

/**
 * Susun dokumen HTML lengkap untuk window.print() — template CSS putih
 * konsisten untuk output cetak. bodyHtml HARUS sudah di-sanitize oleh caller.
 */
export function buildPrintHtml(productType: string, bodyHtml: string): string {
  return `
          <html>
            <head>
              <title>${productType} - PRD</title>
              <style>
                :root {
                  --color-bg: #ffffff;
                  --color-surface: #fafafa;
                  --color-text-primary: #111111;
                  --color-text-secondary: #555555;
                  --color-text-muted: #767676;
                  --color-border: #dddddd;
                }
                body { 
                  font-family: 'Geist Sans', -apple-system, sans-serif; 
                  line-height: 1.6; 
                  color: #333;
                  padding: 40px;
                  max-width: 800px;
                  margin: 0 auto;
                }
                h1 { 
                  font-family: 'Geist Sans', -apple-system, sans-serif; 
                  font-weight: 700; 
                  color: #111; 
                  margin-top: 24px; 
                  margin-bottom: 16px; 
                }
                h2, h3, h4 { color: #111; margin-top: 32px; margin-bottom: 16px; font-weight: 600; }
                p { margin-bottom: 16px; }
                ul, ol { margin-bottom: 16px; padding-left: 24px; }
                li { margin-bottom: 8px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #f9f9f9; font-weight: 600; }
                code { 
                  background-color: #f4f4f5; 
                  padding: 2px 6px; 
                  border-radius: 4px; 
                  font-family: 'Geist Mono', ui-monospace, sans-serif;
                  font-size: 0.9em;
                }
                blockquote {
                  border-left: 4px solid #ddd;
                  padding-left: 16px;
                  color: #666;
                  margin-left: 0;
                  margin-right: 0;
                }
                @media print {
                  body { padding: 0; }
                  @page { margin: 2cm; }
                }
              </style>
            </head>
            <body>
              ${bodyHtml}
            </body>
          </html>
        `;
}

/**
 * Unduh konten PRD sebagai file .md — membangun Blob & trigger download.
 */
export function downloadMarkdown(content: string, productType: string): void {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PRD_${productType.replace(/ /g, "_")}_${new Date().getTime()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}