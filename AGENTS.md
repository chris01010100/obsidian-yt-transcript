---
description: Project guide for obsidian-ytranscript
globs:
  - "**/*"
alwaysApply: true
---

# CONTINUE.md

## 1) Project Overview

**Project:** `obsidian-ytranscript` (Obsidian plugin)

**Purpose:**
- Fetch YouTube transcripts from video URLs
- Generate AI summaries from transcript text
- Insert a complete note into Obsidian (frontmatter + summary + transcript)

**Core technologies:**
- TypeScript (plugin + logic)
- Obsidian Plugin API
- esbuild (bundling)
- Jest + ts-jest (tests)
- node-html-parser / protobufjs (parsing/encoding helpers)

**High-level architecture:**
- `src/main.ts` = plugin bootstrap, settings UI, command registration
- `src/commands/insert-transcript.ts` = end-to-end workflow command
- `src/youtube-transcript.ts` + `src/api-parser.ts` = transcript retrieval/parsing
- `src/services/SummarizationService.ts` = LLM providers + streaming + chunking map-reduce
- `src/transcript-chunker.ts` = long-text chunk splitting utility
- `src/transcript-view.ts` = side view rendering in Obsidian

---

## 2) Getting Started

### Prerequisites
- Node.js + npm
- Obsidian desktop app (for runtime validation)
- Optional for summaries:
  - Ollama running locally (`http://localhost:11434`) or
  - OpenRouter API key or
  - OpenAI API key

### Install
```bash
npm install
```

### Build / Dev
```bash
npm run dev
npm run build
```

### Tests
```bash
npm test
```

### Format check
```bash
npm run check-format
```

### Basic usage in Obsidian
1. Enable plugin.
2. Run command: **YouTube → AI Summary Note**.
3. Confirm or paste YouTube URL in prompt.
4. Plugin fetches transcript and generates summary.
5. Result is inserted into current note (or a new note if no editor is open).

---

## 3) Project Structure

### Main directories
- `src/` — plugin source code
- `src/commands/` — command handlers (currently insert workflow)
- `src/services/` — external integration logic (LLM summarization)
- `tests/` — unit tests and fixture files
- `.github/` — CI/workflow metadata

### Key files
- `src/main.ts`
  - plugin class, settings model, provider/model loading, command registration
- `src/commands/insert-transcript.ts`
  - main user flow: URL detection, transcript fetch, streaming summary, output assembly
- `src/youtube-transcript.ts`
  - transcript retrieval using YouTube InnerTube Player API (IOS client)
- `src/api-parser.ts`
  - transcript XML parsing (`<text>` / `<p>`), extraction helpers
- `src/services/SummarizationService.ts`
  - provider-specific requests (Ollama/OpenRouter/OpenAI), streaming handlers, chunking + retries
- `src/transcript-view.ts`
  - dedicated transcript side panel with search and copy helpers
- `src/transcript-formatter.ts`
  - transcript formatting templates
- `src/url-detection.ts`, `src/url-utils.ts`
  - URL detection/parsing helpers

### Important config files
- `package.json` — scripts + dependencies
- `tsconfig.json` — TypeScript config
- `esbuild.config.mjs` — bundling config
- `jest.config.js` — test config
- `manifest.json` — Obsidian plugin metadata
- `.eslintrc`, `.prettierrc`, `.editorconfig` — code style tooling

### Test files (examples)
- `tests/api-parser.test.ts` — parser behavior
- `tests/caption-parser.test.ts` — caption parsing
- `tests/params-generation.test.ts` — API parameter generation
- `tests/timestampt-utils.test.ts` — timestamp formatting
- `tests/url-utils.test.ts` — URL parsing
- `tests/transcript-chunker.test.ts` — chunk splitting behavior

---

## 4) Development Workflow

### Coding conventions
- TypeScript-first
- Feature logic split by responsibility (`commands`, `services`, parsing utilities)
- Small utility modules for parsing/formatting
- Existing code style is mixed (tabs/spaces in some files) → keep changes local/minimal

### Testing approach
- Jest unit tests in `tests/*.test.ts`
- Focused tests for parsing and formatting logic:
  - URL detection
  - timestamp utils
  - transcript formatter
  - API parsing

### Build and deployment
- Local build: `npm run build`
- Obsidian release metadata managed via `manifest.json` + `versions.json`
- Version bump script: `npm run version`

### Contribution guidelines (inferred, verify)
- Keep PRs focused and minimal
- Add/adjust tests for parser/formatter behavior changes
- Validate plugin behavior in Obsidian UI for command/view changes
- Run build + tests before merge

> **Needs verification:** No explicit `CONTRIBUTING.md` found.

---

## 5) Key Concepts

### Transcript retrieval pipeline
1. Extract video ID from URL
2. Request YouTube InnerTube player endpoint (IOS client context)
3. Select best caption track based on language
4. Fetch caption XML from `baseUrl`
5. Parse lines into `{ text, offset, duration }`

### Summary generation pipeline
1. Concatenate transcript lines into full text
2. Build prompt (default instructions or custom prompt template)
3. For long input and enabled chunking: run map-reduce (chunk summaries -> final reduce summary)
4. Send to selected provider (`ollama`, `openrouter`, `openai`)
5. Stream final summary chunks (when available)
6. Build final note with frontmatter + summary + transcript

Chunking details:
- `CHUNK_MAX_CHARS`: 10000
- `chunkConcurrency`: configurable (default `1`)
- map-phase chunk failures are handled defensively (skip failed chunks, fail only if all chunks fail)
- Ollama non-streaming requests use `requestUrl` with retry on `503/504`

### Prompt template placeholders
Supported placeholders include (case variants supported):
- `{{language}}`
- `{{video_title}}`
- `{{source_url}}`
- `{{video_id}}`
- `{{llm_provider}}`
- `{{model_name}}`
- `{{created_at}}`

### Core abstractions
- `YTranscriptSettings` — persisted plugin settings (`enableChunking`, `chunkConcurrency` included)
- `TranscriptResponse` / `TranscriptLine` — transcript domain model
- `SummarizationService` — provider abstraction + streaming + chunked map-reduce behavior
- `InsertTranscriptCommand` — orchestrator for full user flow

---

## 6) Common Tasks

### A) Add a new command
1. Create command class in `src/commands/`.
2. Register command in `src/main.ts` inside `onload()`.
3. Reuse utilities/services instead of duplicating logic.
4. Add tests if logic is non-UI.

### B) Add or change LLM provider behavior
1. Extend `SummarizationService` provider switch.
2. Implement request + error handling + optional streaming parser.
3. Add settings fields in `YTranscriptSettings` and settings tab UI.
4. Verify fallback behavior and missing-key errors.

### C) Change transcript parsing
1. Update parsing in `src/api-parser.ts` and/or retrieval in `src/youtube-transcript.ts`.
2. Add/update tests with realistic fixtures from `tests/`.
3. Validate transcript output formatting in command flow.

### D) Customize note output structure
1. Update `buildOutput()` and metadata extraction in `insert-transcript.ts`.
2. Keep YAML frontmatter valid.
3. Validate replacement of metadata placeholders.

---

## 7) Troubleshooting

### "No transcript found" or caption errors
- Video may not have captions
- Requested language may be unavailable
- YouTube response structures can change over time
- Check fallback language behavior in caption track selection

### Summary fails
- Missing model selection in plugin settings
- Missing/invalid API key (OpenRouter/OpenAI)
- Ollama not running or wrong base URL
- Rate limits/provider outages

### Streaming issues
- Provider stream format mismatch can break chunk parsing
- Service has non-stream fallback in some paths (Ollama)

### Chunking / Ollama issues
- Chunking with Ollama (especially remote/proxy) can increase latency/timeouts
- Start with `chunkConcurrency = 1` and increase cautiously
- 503/504 can still happen under high load; retries are implemented for Ollama non-streaming path

### Build/test issues
- Run clean install: `npm install`
- Re-run type/build checks: `npm run build`
- Re-run tests: `npm test`

### Debugging tips
- Check Obsidian developer console logs
- Validate request payloads and endpoint responses
- Use existing fixture tests for parser regressions

---

## 8) References

- Obsidian Plugin Docs: https://docs.obsidian.md/
- Obsidian Sample Plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- Jest Docs: https://jestjs.io/docs/getting-started
- TypeScript Docs: https://www.typescriptlang.org/docs/
- Ollama API Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
- OpenAI API Docs: https://platform.openai.com/docs/api-reference
- OpenRouter API Docs: https://openrouter.ai/docs

---

## 9) Coding Rules (Strict)

- Do NOT rewrite unrelated code.
- Prefer minimal, targeted changes.
- Keep existing architecture intact.
- Do NOT introduce breaking changes unless explicitly requested.
- Do NOT refactor large parts of the codebase without instruction.

- Always respect existing file structure:
  - commands = orchestration
  - services = logic
  - parsing utils = isolated helpers

- Never mix responsibilities:
  - No UI logic inside services
  - No API logic inside commands

- Keep InsertTranscriptCommand readable and lightweight.

---

## 10) Output & Prompt Rules (Critical)

- The plugin ALWAYS controls:
  - YAML frontmatter
  - metadata fields
  - note structure

- LLM output MUST:
  - contain only Markdown body content
  - NOT include YAML
  - NOT include metadata fields

- Prompt templates are ONLY responsible for:
  - summary content
  - structure of the summary

- Never rely on LLM output for:
  - tags placement
  - frontmatter correctness
  - metadata integrity

- All metadata must be extracted and normalized in code.

---

## 11) LLM & Provider Rules

- All providers must behave consistently:
  - Ollama
  - OpenRouter
  - OpenAI

- Always implement:
  - proper error handling
  - clear error messages
  - fallback strategies

- Streaming is optional:
  - Must gracefully fallback to non-streaming

- For Ollama:
  - prefer `requestUrl` for non-streaming requests (CORS-safe in Obsidian)
  - keep chunk concurrency conservative by default (`1`)
  - retry transient `503/504` responses with backoff

- Never assume provider-specific response formats are stable.

---

## 12) Mobile Compatibility

- Code must work in Obsidian Mobile (iOS/Android).
- Avoid Node.js-only APIs:
  - fs
  - Buffer
  - process

- Prefer browser-compatible APIs:
  - fetch
  - TextEncoder / TextDecoder

- Keep memory usage reasonable (important for large transcripts).

---

## 13) Scalability Rules

- The system must support large transcripts.
- Current strategy uses chunked map-reduce summarization.
- `chunkConcurrency` must stay configurable and conservative by default.
- Future implementations should consider:
  - adaptive chunk sizing per provider/model
  - multi-step summarization
  - progressive processing

- Avoid designs that assume the entire transcript fits into a single LLM request.
- Avoid aggressive parallel chunking defaults for Ollama.

---

## Verification Notes

The following points were inferred from code and should be reviewed by maintainers:
- Exact release/deployment workflow beyond local build/version scripts
- Team contribution process (branching/review policy)
- Whether side view (`transcript-view.ts`) is still primary UX or secondary to note-insertion flow
- Any required minimum Node.js version (not explicitly pinned in `package.json`)
