# AGENTS.md

> Operating guide for AI coding agents working on **PRD Architect**.
> Read this file at the start of every session, before touching any code.
> It is the source of truth for how work is planned, written, verified, and committed here.

---

## 0. Non-negotiable rules (TL;DR)

1. **Never `git push`. Never `git merge`. Never force-push.** Commits are autonomous; push and merge require the user's explicit approval, every time, no exceptions.
2. **Commit granularly**: one logical change = one commit. Never bundle unrelated changes.
3. **Verify before you commit**: a commit is only allowed after `npm run typecheck` and `npm test` pass. No verified evidence -> no commit.
4. **Branch for anything major** (feature, refactor, logic fix). Only truly minor things (docs, comments, typos, non-behavioral config) may go straight to `main`.
5. **Ask CodeGraph first**, not grep. See section 3.
6. **Never commit secrets.** Never weaken security defaults.
7. **Never claim something works without showing the command output that proves it.**

---

## 1. Project snapshot

**What it is**: a full-stack AI PRD generator. The user types a product idea, the app streams a structured PRD back (3 modes: `simple` 6 chapters, `business` 12 chapters, `technical` 9 chapters), with live Mermaid diagrams, a WBS canvas, revisions/version history, file-context upload, and export to Markdown/PDF/DOCX.

**Stack**: React 19 + Vite + Tailwind v4 (frontend) - Express + TypeScript (backend) - Vitest (tests) - Node 22 (pinned in `.node-version` and `render.yaml`).

**Layout**:

| Path | Role |
| --- | --- |
| `server.ts` | Express entry point: middleware, security, SSE `/api/generate-prd` route |
| `server/` | Backend modules: `auth.ts`, `endpoint.ts` (SSRF guard + provider resolution), `prompts.ts`, `blockPrompts.ts`, `fileExtraction.ts`, `log.ts` |
| `shared/` | Types + constants used by BOTH frontend and backend. Single source of truth |
| `src/App.tsx` | Thin orchestrator; owns top-level state |
| `src/components/` | UI components (presentational, kept thin) |
| `src/hooks/` | Stateful logic: `useGeneration`, `useVersion`, `useSettings`, `useT`, `useToast`, `useScroll` |
| `src/services/aiService.ts` | Frontend SSE client with retry/backoff |
| `src/utils/` | Pure logic: `persistence.ts`, `export.ts`, `wbs.ts`, `mermaid.ts`, `sections.ts`, `storage.ts`, `format.ts` |
| `src/i18n/` | `en.ts` + `id.ts` dictionaries |
| `bugs/` | RCA / bug investigation write-ups (tracked) |
| `docs/` | Local-only docs - **gitignored**, see section 8 |

**Key data flow**: `App.tsx` -> `useGeneration.executeGeneration` -> `aiService.generatePRD` -> POST `/api/generate-prd` -> `server.ts` resolves endpoint + builds prompt -> upstream AI streams SSE -> chunks append to the active version -> `useVersion` autosaves to IndexedDB (`src/utils/persistence.ts`) and syncs across tabs via `BroadcastChannel`.

---

## 2. Session start protocol

Run these before writing anything:

1. `git status --short` and `git branch --show-current` - know the current branch and whether the tree is dirty.
2. `codegraph status` - confirm the index is fresh (`codegraph sync` if stale).
3. `codegraph explore "<your task in a few words>"` - build the mental model of the area you are about to touch. One call usually replaces a whole grep/read loop.
4. Decide the branch (section 6.1) and the verification plan (section 5).
5. State the plan briefly to the user: scope, files, branch, how you will verify. Then start.

**Session end protocol**: leave the repo with a green gate, commits created but **not pushed**, and report: current branch, list of new commits, what is verified, what is still unverified, and whether a push/merge approval is needed.

---

## 3. CodeGraph - use it first (token efficiency)

This repo is indexed by CodeGraph (`.codegraph/` at the root). It is a symbol/call graph, so it answers "where is X", "how does X work", "what breaks if I change X" in **one** call, with the relevant source included. Use it **before** grep, glob, or reading files.

### 3.1 Command map

| Goal | Command |
| --- | --- |
| Understand an area / locate code before editing | `codegraph explore "useGeneration persistence autosave"` |
| Same thing via MCP tool | `codegraph_explore` (query = symbol names or a question) |
| One symbol's source + caller/callee trail | `codegraph node <symbol>` |
| Who calls this | `codegraph callers <symbol>` |
| What this calls | `codegraph callees <symbol>` |
| Blast radius of changing this | `codegraph impact <symbol>` |
| Which tests cover changed files | `codegraph affected <file...>` |
| Build context for a task | `codegraph context "<task description>"` |
| Project file tree with symbol counts | `codegraph files` |
| Search symbols by name | `codegraph query <name>` |
| Index health / refresh | `codegraph status` / `codegraph sync` |

### 3.2 How to query well

- Pass a **bag of symbol names** or a short natural-language question, e.g. `"useVersion saveState persistence quota"` - not one vague word like `"state"`.
- Name the file or symbol you care about and CodeGraph returns its **current line-numbered source**.
- The response starts with a **Blast radius** section (what depends on these symbols, and which tests exist). Read it - it tells you exactly what to verify and which test files to run.
- Treat returned source as **already read**. Do not re-`Read` those files; scroll back instead.
- If a symbol you need was trimmed from the output, fetch just it with `codegraph node <symbol>` - cheaper and more complete than reading the whole file.

### 3.3 When CodeGraph is the wrong tool

Fall back to grep / Read for things outside the code graph:

- Markdown, docs, `AGENTS.md`, `README.md`
- JSON / config: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `render.yaml`, `.env.example`
- CSS (`src/index.css`), i18n string values, exact literal text searches
- Anything where you need the literal bytes rather than the structure

### 3.4 Efficiency rules

- Do not open a session with a broad grep sweep. Start with one `codegraph explore`.
- Do not read a 50KB file (`src/utils/export.ts` is the worst offender) to find one function. Ask for the symbol.
- Use `codegraph affected` before running the full suite - it tells you the minimal set of test files to run while iterating.
- If the graph looks stale or you edited files from outside the session, run `codegraph sync` (the watcher normally auto-syncs).

---

## 4. Clean code standards

These are enforced, not aspirational. Match the existing patterns in the file you touch.

**Types**
- `strict` and `noImplicitAny` are on. **No `any`.** Use `unknown` + narrowing (`Record<string, unknown>`, `typeof` guards) as `server/endpoint.ts` does.
- Types shared between frontend and backend live in `shared/types.ts` only. Never duplicate a boundary type.
- Prefer **discriminated unions** for outcomes over `null` / boolean / throw. Follow `EndpointResolution` and `SaveResult` (`{ ok: true } | { ok: false; reason: ... }`).
- Prefer explicit union literals over `string` when the value set is known (`"id" | "en"`, `"simple" | "business" | "technical"`).

**Structure**
- Keep components thin. Business logic belongs in `src/hooks/` or `src/utils/` so it is testable. `App.tsx` is an orchestrator, not a logic dump.
- Pure, dependency-free logic goes in `src/utils/` (frontend) or `server/` (backend). That is where the test coverage lives.
- Small functions, single responsibility, early returns over nested `if`s.
- Don't add a dependency for something the repo already does. Check `package.json` first.

**Correctness & safety**
- Validate untrusted input at the boundary and narrow before use. Never trust `req.body` (see `validateCustomChapterIds` in `server/blockPrompts.ts`).
- No silent failures. Return a typed failure and surface it to the UI - see `saveState` returning `{ ok: false, reason: "quota" }` which `App.tsx` turns into a toast.
- Never leak upstream/internal error bodies to the client. Log server-side only (see `readUpstreamErrorBody` in `server.ts`).
- React: guard against stale closures with refs / `useCallback` as `useGeneration` and `useVersion` already do. Respect abort signals on long-running work.
- Handle the states that exist: loading, empty, error, and success.

**i18n**
- Never hardcode user-facing strings. Add the key to **both** `src/i18n/en.ts` and `src/i18n/id.ts`, then read via `useT(language)`.
- Server-side user-facing messages are also bilingual (`language === "en" ? ... : ...`).

**Comments**
- Explain **why**, not **what**. Code should say what it does.
- Existing convention: a short Indonesian or English line, optionally prefixed with a task/bug ID, e.g. `D-01c - surface kegagalan autosave ke UI.` or `CRIT-05 fix - guard: reject duplicate calls.` Match the language already used in that file.
- No commented-out code, no dead code, no leftover debug logging. The backend uses `log()` from `server/log.ts`.

**Style**
- Preserve the file's existing style: 2-space indent, double quotes, semicolons, trailing commas. Don't reformat files you are not changing.
---

## 5. Verification gate (before EVERY commit)

A change is **done** only when it is verified. "It should work" is not verification. Run the gate and read the output.

**The gate** (minimum for any code change):

```bash
npm run typecheck   # tsc --noEmit - must exit 0, zero errors
npm test            # vitest run - must be all green, no skips you added
```

**Add to the gate when relevant**:

| Change touches | Also run |
| --- | --- |
| UI / anything the user sees | `npm run dev` and exercise the flow in the browser (or Playwright MCP). Describe what you clicked and what you saw. |
| Build config, imports, deps, `server.ts` | `npm run build` - must succeed |
| Export / print / WBS / persistence | the specific suite, e.g. `npx vitest run src/utils/export.test.ts`, plus the manual UI check |
| A bug fix | reproduce the bug **first** (show the failure), then show it fixed. Keep the repro command in the report. |

**Rules**:

- **Failing tests are never committed.** If a pre-existing test fails and it is unrelated to your change, stop and report it - do not "fix" it by loosening the assertion without saying so.
- **New behavior needs a test.** Any new pure function in `src/utils/` or `server/` should ship with a `*.test.ts` alongside it, following the existing file layout (tests sit next to the source).
- **Don't delete or skip a test to get green.** If a test is genuinely obsolete, say so explicitly and explain why in the commit body.
- **Report the evidence.** In your message to the user, paste the actual result line, e.g. `Test Files 16 passed (16) / Tests 232 passed (232)`. Never summarize as "tests pass" without the number.
- If a step cannot be run (missing API key, no network), say so plainly and mark the change **unverified** - do not commit it as if it were verified, or commit it clearly labeled `wip:` and tell the user it is unverified.

---

## 6. Git workflow

### 6.1 Branch policy

**Default: work on a branch.** Create one for anything non-trivial.

```bash
git checkout main
git pull --ff-only origin main        # only if the user approved network access; otherwise skip
git checkout -b <type>/<short-slug>
```

Branch naming (mirrors the existing history):

| Prefix | Use for | Example |
| --- | --- | --- |
| `feat/` | New feature | `feat/wbs-export-docx` |
| `fix/` | Bug fix | `fix/persistence-quota-toast` |
| `refactor/` | Behavior-preserving restructure | `refactor/split-export-module` |
| `perf/` | Performance | `perf/chunk-splitting` |
| `docs/` | Documentation-only | `docs/codegraph-guide` |
| `chore/` | Tooling, deps, config | `chore/pin-node-22` |

**Branch is required for**: new features, refactors, any behavior change, anything touching `server.ts` security/middleware, anything that needs a test written or updated, and anything you would want reviewed before it lands. Multiple files alone does not make something major (a doc sweep across five files is still minor); **changing runtime behavior always does**.

**May go directly to `main`** (only these): documentation and comments (`*.md`, code comments), typo fixes, i18n **string text** changes with no logic impact, non-behavioral config tweaks (`.gitignore`, `render.yaml` comments), and formatting-only changes scoped to one file.

**Judgment rule**: if the change alters runtime behavior, requires a test to be written or updated, or you would want to review it before it lands - **it is major, use a branch**. If you are unsure, use a branch. Ask the user when it is genuinely borderline.

### 6.2 Commit granularity - the core rule

**One logical change = one commit.** Commit as soon as a small, self-contained piece of progress is **verified**. Do not accumulate a big blob of work and commit it at the end.

The required loop:

```
1. Pick the smallest coherent unit of work
2. Implement it
3. Verify it (section 5 gate)
4. Commit it (section 6.3 format)
5. Repeat for the next unit
```

This is the point: the commit history should be a readable development journal - each commit a verified step, in order, so anyone can follow the reasoning.

**Granularity examples**

Good - a 4-step feature becomes 4 commits:

```
feat(export): add docx renderer for WBS table
test(export): cover docx WBS table rowspan cases
feat(export): wire docx option into export menu
docs(export): document docx export in README
```

Bad - one giant commit:

```
feat(export): add docx export, fix wbs layout, update readme, bump deps
```

Bad - too granular (noise, each commit meaningless alone):

```
fix(export): add semicolon
fix(export): fix typo in variable
```

**Never mix concerns in one commit.** A formatting change and a logic change are two commits. A refactor and a feature are two commits. If you already staged too much, unstage and split.

**Every commit must be a coherent state**: the repo should typecheck and pass tests at that commit. Never commit a broken intermediate state to "save progress" on a shared branch - if you truly need a checkpoint, use `wip:` prefix and say so.

### 6.3 Commit message format

Conventional Commits, matching the existing history:

```
<type>(<scope>): <imperative summary>

<optional body - why, not what. Wrap at ~72 chars.>

<optional footer>
```

**Types**: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `style`.
**Scope**: the area touched, lowercase, one word - `export`, `wbs`, `persistence`, `server`, `security`, `ui`, `a11y`, `i18n`, `deps`, `deploy`, `prd`, `settings`, `provider`.

**Rules**:
- Subject in imperative mood, lowercase after the colon, no trailing period, <= 72 chars.
- Body explains **why** the change exists and any non-obvious tradeoff. Skip it when the subject says it all.
- Reference the RCA file or bug ID when there is one, e.g. `Ref: bugs/table-overflow-rca.md`.
- **No AI attribution.** No `Co-authored-by:`, no "Generated with ...", no robot emoji. The existing history has none - keep it that way.
- One language per commit message; the existing history is English - keep using English.

### 6.4 Hard boundaries - NEVER do these autonomously

| Action | Rule |
| --- | --- |
| `git push` | **NEVER.** Always stop and ask the user for approval first. |
| `git merge` | **NEVER.** Propose the merge and wait for the user to approve or do it. |
| `git push --force` / `--force-with-lease` | **NEVER**, under any circumstance. |
| Rewriting shared history (`rebase`, `reset --hard` on pushed commits, `commit --amend` on pushed commits) | **NEVER** without explicit approval. |
| Deleting branches | Ask first. Never delete `main` or a branch with unpushed commits. |
| `git config` changes | Ask first. Never change user identity, hooks, or remotes. |
| Installing global packages, changing remotes, editing CI/deploy secrets | Ask first. |
| Creating a PR | Allowed to prepare the branch and commits; **ask before opening the PR** (it is a push). |

**Allowed autonomously**: `git status`, `git diff`, `git log`, `git add` (of files you changed), `git commit` (after the gate passes), `git checkout -b`, `git stash`/`stash pop`, `git restore` of your own uncommitted work.

**`git add` discipline**: stage the files you actually changed, by path. Avoid `git add -A` / `git add .` - the working tree may hold unrelated in-progress work. Always `git status --short` and `git diff --staged` before committing.

**When the user asks you to push**: verify first (`git log origin/main..HEAD --oneline`, `git status`), confirm the branch, confirm the gate is green, then push and report the result. Never push a red tree.

**Never commit**: `.env*` (except `.env.example`), API keys, tokens, cookies, `.codegraph/`, `node_modules/`, `dist/`, `docs/`, `.playwright-mcp/`, personal screenshots, editor config. When in doubt, check `.gitignore` and ask.

---

## 7. Working agreement with the user

- **Language**: the user writes in Indonesian; reply in Indonesian. Code, comments, commit messages, and docs stay in English (matching the repo), unless the user asks otherwise.
- **Report format after a work session**: current branch - commits created (hashes + subjects) - what was verified (with the actual command output) - what is unverified - whether push/merge approval is needed.
- **Ask, don't guess**: on ambiguous requirements, risky refactors, dependency additions, schema/API changes, or anything touching auth/security, state your assumption and ask before proceeding.
- **Scope discipline**: implement what was asked. Do not opportunistically refactor neighboring code, rename things, or "improve" unrelated files. If you spot a real problem, report it and offer to fix it in a separate branch - do not sneak it in.
- **Preserve behavior**: refactors must be behavior-preserving. If behavior must change, that is a separate, clearly labeled commit.
- **Security defaults are load-bearing**: never relax the SSRF guard in `server/endpoint.ts`, the httpOnly cookie settings in `server/auth.ts`, CSP/helmet config, or rate limiting to make something "just work". Flag it and ask.
- **Never invent API keys or fabricate a successful run.** If a provider key is missing, say the step is untested.

---

## 8. Repo gotchas

- **Agent / MCP tooling is local-only and gitignored.** `.codegraph/`, `.claude/`, `.codex/`, `.mcp.json`, and `opencode.jsonc` are all machine-specific and must **never** be committed - `.gitignore` already covers them. Do not "helpfully" stage them, and never add a CodeGraph or MCP config file to a commit. The two committed entry points are `AGENTS.md` (this file, the real guide) and `CLAUDE.md` (a thin pointer to it). Gemini CLI is not used in this project - do not add `GEMINI.md` or `.gemini/`.
- **`docs/` is gitignored**, so audit reports, QA reports, RCAs, and the WBS reference doc are **local-only**. `bugs/` **is** tracked. When you write an RCA, put it in `bugs/` if it should be versioned; if it lands in `docs/`, tell the user it will not be committed.
- **`shared/` is imported by both sides.** A change there affects the frontend bundle and the server. Check `codegraph impact` before editing, and run the full gate.
- **`server.ts` is a monolith by design** (~400+ lines: middleware, security, routes). Extracted modules live in `server/`. When adding logic, prefer a new/extended module in `server/` over growing `server.ts`, and keep the "pure move, zero logic change" separation the existing comments describe.
- **Streaming is SSE**, not JSON: `/api/generate-prd` writes `data:` chunks. Errors after the stream starts cannot change the HTTP status - they must be delivered as an SSE `error` chunk. Validation that needs a real `400` must happen **before** the SSE headers are written (see the `customChapterIds` validation).
- **Generation is long-running and abortable.** Respect `AbortSignal`; never add an arbitrary timeout - infinite generation time is an intentional feature for deep-reasoning models.
- **Persistence is IndexedDB + `BroadcastChannel`**, multi-tab aware, last-writer-wins by `savedAt`. Any change to `src/utils/persistence.ts` must preserve: quota handling, schema versioning, per-version validation, and the cross-tab race guard.
- **`src/utils/export.ts` is huge (~50KB)** and covers Markdown/PDF/DOCX/print. Never read it whole; use `codegraph node <symbol>` to get just the function you need.
- **Two i18n dictionaries must stay in sync** (`en.ts` / `id.ts`). A missing key falls back to English silently - so a missing `id` key is a real bug, not a crash.
- **`vitest` runs in the `node` environment** (`vitest.config.ts`), even for `.tsx` component tests. Don't assume DOM APIs are available; check how the existing tests stub them.
- **Coverage is scoped** to `src/utils/**`, `server/**`, `src/services/**` - that is the intentional test surface. UI components are verified manually/in-browser.
- **Node 22 is pinned** (`.node-version`, `render.yaml`, `engines.node >= 18`). Don't use APIs newer than the pin, and don't casually change the pin.
- **`ALLOWED_ORIGINS` is required in production** for CORS. Local dev works without it - do not "fix" a local CORS error by allowing all origins.
- **`ALLOW_SERVER_KEY_FALLBACK` must stay `false` for public instances** (it is commented out in `render.yaml` on purpose). Never enable it to make a test pass.

---

## 9. Definition of done

A task is complete when **all** of these hold:

- [ ] The change is scoped to exactly what was asked, nothing opportunistic
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` is fully green (report the counts)
- [ ] `npm run build` passes if build config / server / deps were touched
- [ ] UI-affecting changes were exercised in the browser and described
- [ ] New logic has tests; no test was weakened or deleted to get green
- [ ] i18n keys added to **both** `en.ts` and `id.ts`
- [ ] No `any`, no dead code, no commented-out code, no leftover debug logs
- [ ] No secrets staged (`git diff --staged` reviewed), and no MCP/CodeGraph config staged (`.codegraph/`, `.claude/`, `.codex/`, `.mcp.json`, `opencode.jsonc` are gitignored on purpose)
- [ ] Work is committed **granularly**, each commit a coherent verified step
- [ ] Nothing was pushed or merged
- [ ] The user has a clear report: branch, commits, verification evidence, open questions, and the pending push/merge decision

---

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->