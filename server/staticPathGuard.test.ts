import { describe, it, expect } from "vitest";
import { isBlockedStaticPath } from "./staticPathGuard";

describe("isBlockedStaticPath", () => {
  it.each([
    // QA round 2 - normalization bypasses
    "//server.js",
    "/./server.js",
    "///server.js",
    "/%2e/server.js",
    "/%2e%2fserver.js",
    "/././server.js",
    "/server.js/.",
    "/server.js//",
    "/server.js%2f%2e",
    "/SERVER.JS/",
    "/server.js.map/.",
    "/server.js.map::$DATA",
    // QA round 3 - Windows backslash (express.static treats `\` as a separator)
    "/%5cserver.js",
    "/%5Cserver.js",
    "/%5c%5cserver.js",
    "/.%5cserver.js",
    "/%2e%5cserver.js",
    "/server.js%5c",
    "/SERVER.JS%5c",
    "/server.js%5c.",
    "/%5cserver.js%5c.",
    "/server.js%5c%5c",
    "/server.js.map%5c",
    "/server.js.map%5c.",
    "/server.js.map%5c%5c",
    "/%5cserver.js.map%5c",
    // QA round 1 - encoding bypasses
    "/server.js%2emap",
    "/assets/..%2fserver.js",
    "/x/..%2fserver.js",
    "/assets/..%2findex.html",
    "/server.js",
    "/assets/%2e%2e/server.js",
    "/assets/index-x.js.map",
  ])("blocks %s", (p) => {
    expect(isBlockedStaticPath(p)).toBe(true);
  });

  it.each(["/%zz", "/%"])("blocks malformed escape %s instead of throwing", (p) => {
    expect(isBlockedStaticPath(p)).toBe(true);
  });

  it.each([
    "/",
    "/index.html",
    "/a/b/c",
    "/health",
    "/api/health",
    "/assets/index-D3x9kQp1.js",
    "/assets/index-D3x9kQp1.css",
  ])("allows %s", (p) => {
    expect(isBlockedStaticPath(p)).toBe(false);
  });
});
