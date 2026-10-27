import path from "path";

// Guard against exposing the server bundle and source maps through express.static.
// Extracted from server.ts so it can be unit-tested without booting a server.
//
// express.static/send decodes AND normalizes before touching disk, so a raw
// string compare is bypassable: `//server.js`, `/./server.js`, `/server.js/.`
// and `%2e`/`%2f` spellings all resolve to the same file. This predicate does
// the same decode+normalize before deciding.
export function isBlockedStaticPath(rawPath: string): boolean {
  let p: string;
  try {
    p = decodeURIComponent(rawPath).toLowerCase();
  } catch {
    // Malformed escape (`%zz`, bare `%`) - never throw, treat as blocked.
    return true;
  }

  // Windows treats `\` as a separator, so express.static resolves `/server.js\`
  // to `dist/server.js` while the checks below only understand `/`. Normalize
  // first so every later step sees the same string.
  p = p.replace(/\\/g, "/");

  // Checked before normalize: normalize collapses `/assets/../index.html` to
  // `/index.html`, which would otherwise look like a normal SPA route.
  if (p.split(/[\\/]/).includes("..")) return true;

  // Strip trailing slashes (normalize keeps them); keep `/` itself intact.
  if (p.length > 1) p = p.replace(/\/+$/, "");
  p = path.posix.normalize(p);

  // Windows NTFS alternate data stream: `/server.js.map::$DATA` serves the map,
  // and extname() reports `.map::$DATA`. Compare the stream-less name.
  const streamless = p.split(":")[0];

  return streamless === "/server.js" || path.posix.extname(streamless) === ".map";
}
