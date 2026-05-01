# Changelog

## [1.13.4] – 2026-05-01

### ✨ Verbesserungen
- Statusleisten-Feedback für die Transcript-/Summary-Pipeline hinzugefügt.
- Status-Phasen sichtbar in Obsidian:
  - Transcript laden
  - Chunking (X/Y)
  - Final Merge
  - Done / Failed
- Request-ID-basierte Status-Steuerung ergänzt, um Race Conditions bei parallelen Läufen zu vermeiden.
- Auto-Reset der Statusleiste auf `YTranscript: Ready` nach 120 Sekunden.

## [1.13.3] – 2026-05-01

### ✨ Verbesserungen
- Optionales Developer-Debug-Logging für Transcript- und Summary-Pipeline hinzugefügt (`Enable debug logging`, default: aus).
- Konsistente Debug-Events für:
  - Pipeline-Start
  - Transcript geladen (Line Count)
  - Chunking aktiv + Chunk-Anzahl/-Größe
  - Chunk X/Y Start/OK/Fehler
  - Final Merge Start/OK
  - Provider + Modell + Streaming-Status

### 🔒 Sicherheit
- Debug-Logs enthalten nur sichere Metadaten.
- Keine API-Keys und keine vollständigen Transcript-Inhalte in Logs.

## [1.13.2] – 2026-04-30

### ✨ Verbesserungen
- Chunking für lange Transcripts robuster gemacht:
  - `CHUNK_MAX_CHARS` auf `10000` erhöht (weniger Map-Requests)
  - konfigurierbare `chunkConcurrency` (Default: `1`)
  - resilientere Map-Phase: einzelne Chunk-Fehler brechen den Lauf nicht sofort ab

### 🐛 Fixes
- Retry-Mechanismus für Ollama non-streaming Requests bei `503/504` (3 Versuche mit Backoff).
- Bessere Stabilität bei großen Transcripts und instabilen/proxy-basierten Ollama-Setups.

### ⚠️ Hinweis
- Chunking kann mit Ollama (insbesondere remote/proxy) zu langen Laufzeiten oder Timeouts führen.
- Empfehlung: `chunkConcurrency = 1` und nur vorsichtig erhöhen.

## [1.13.1] – 2026-04-30

### 🐛 Fixes
- Ollama non-streaming requests now use Obsidian `requestUrl` to avoid browser CORS issues in chunking map phase.
- Added defensive fallback in Ollama streaming: on network/CORS fetch failure before response, fallback to non-streaming summarization.
- Improved Ollama non-streaming error handling with status and response body details.

## [1.13.0] – 2026-04-30

### ✨ Verbesserungen
- Robuste Chunking-Architektur für lange Transcripts (Map-Reduce) integriert.
- Neue Chunking-Utility eingeführt (`splitIntoChunks`) mit bevorzugten Split-Grenzen:
  - Absatzgrenzen (`\n\n`)
  - Satzenden (`.`, `!`, `?`)
  - Zeilenumbrüche
  - Hard-Cut als Fallback
- Hard-coded Chunk-Prompt im Service ergänzt, unabhängig vom User-Prompt.
- Finale Zusammenfassung bleibt über bestehendes Prompt-Template steuerbar.

### ⚙️ Settings
- Neues Setting: `Enable Chunking for long transcripts`.
- Standardwert: `true`.
- Chunking kann pro Nutzer aktiviert/deaktiviert werden, ohne den restlichen Workflow zu ändern.

### 🧠 Streaming & Stabilität
- Chunk-Phase läuft non-streaming für stabile Verarbeitung.
- Finale Reduce-Phase nutzt bestehendes Streaming-Verhalten.
- Bestehender Output-Builder (YAML + Summary + Transcript) bleibt unverändert.

### 🧪 Tests
- Neue Unit-Tests für Chunking ergänzt (`tests/transcript-chunker.test.ts`).

## [1.12.0] – 2026-04-25

### ✨ Verbesserungen
- Verbesserte Fehlerbehandlung für Ollama:
  - Detaillierte Fehlermeldungen inkl. Server-Response
  - Besseres Debugging bei API-Problemen
- Automatischer Fallback von Streaming → Non-Streaming bei Fehlern (z. B. HTTP 400)
- Stabilere Zusammenfassungs-Pipeline bei instabilen oder restriktiven Ollama-Setups

### 🧠 UX & Stabilität
- Robustere Verarbeitung von API-Fehlern ohne Abbruch des gesamten Workflows
- Zusammenfassung wird auch bei Streaming-Fehlern zuverlässig erzeugt

### 🐛 Fixes
- Fix: Unklare "400 Bad Request" Fehler bei Ollama werden jetzt korrekt abgefangen und verarbeitet
- Fix: Streaming-Abbrüche führen nicht mehr zum kompletten Fehlschlag der Zusammenfassung

## [1.11.0] – 2026-04-25

### ✨ Improvements
- Prompt-System vereinfacht:
  - Frontmatter-Regeln entfernt (wird jetzt vollständig im Code erzeugt)
  - Prompt enthält nur noch Summary-Logik → deutlich verständlicher für Nutzer
- Summary-Sprache vollständig über Prompt steuerbar (keine UI-Abhängigkeit mehr)
- Settings UX verbessert:
  - "Summary Language" aus Settings entfernt
  - Fokus jetzt nur auf Transcript Language (Language + Country)
- Model Handling verbessert:
  - Kein automatischer Model-Fallback beim Provider-Wechsel
  - Sauberer Zustand ohne "falsches Modell"

### 🧠 UX Enhancements
- Klarere Trennung zwischen:
  - Prompt (Inhalt / Struktur)
  - Plugin (Technik / Output / YAML)
- Weniger Fehleranfälligkeit bei Custom Prompts

### 🏷️ Tag Handling (Fix + Upgrade)
- Tags werden jetzt zuverlässig aus dem LLM-Output extrahiert
- Unterstützung für mehrere Formate:
  - `Tags: a, b, c`
  - Markdown-Listen
  - Inline-Code (`tag1, tag2`)
- Backticks in Tags werden korrekt entfernt
- Tags werden jetzt:
  - ❌ nicht mehr im Body angezeigt
  - ✅ korrekt im YAML-Header gespeichert

### 🧹 Cleanup
- Entfernt:
  - Kategorie-Block im Body
  - doppelte Tags
  - Artefakte aus LLM-Output

---

### 🐛 Fixes
- Fix: Tags wurden teilweise im Body statt im YAML gespeichert
- Fix: Inline-Code Tags (`\`tag\``) wurden falsch übernommen
- Fix: Kategorie wurde im falschen Bereich angezeigt
- Fix: Prompt konnte Plugin-Output brechen (jetzt entkoppelt)

---

### 💡 Developer Notes
- Output-Generierung jetzt vollständig im Plugin (robuster)
- Prompt ist jetzt optional + austauschbar ohne Breaking Changes

## [1.10.0] - 2026-04-25

### Added

- Automatic extraction of generated tags from the LLM summary body.
- Generated tags are now written into the YAML frontmatter.
- Optional `video_type` extraction from generated category metadata.

### Changed

- User prompt files no longer need to include YAML frontmatter, technical metadata or `{{TRANSCRIPT}}`.
- Plugin now builds Obsidian Properties independently from LLM output.
- Prompt handling is more publish-friendly and easier for users to customize.

### Fixed

- Fixed generated tags appearing in the summary body instead of frontmatter.
- Fixed fragile YAML/frontmatter handling when using streaming output.
- Reduced risk of broken Obsidian Properties caused by LLM formatting.

## [1.9.0] - 2026-04-24

### Added

- Streaming summary generation for Ollama, OpenRouter and OpenAI.
- Live note updates while the LLM summary is being generated.
- Remember last selected model per provider.
- Automatically opens plugin settings when no model is selected.

### Changed

- Provider switching now clears invalid model selections.
- Model dropdown no longer carries models across providers.
- Models are auto-loaded in the background when switching providers.
- Final output is re-rendered after streaming completes.

### Fixed

- Fixed broken YAML frontmatter during streaming.
- Fixed API errors caused by stale model selections from another provider.
- Fixed missing model guard before starting summary generation.

## [1.8.0] - 2026-04-24

### Added

- "Insert YouTube transcript" command now works without an active note.
- Automatically creates a new note when no Markdown editor is active.
- Added `Output Folder` setting for newly created YouTube summary notes.

### Changed

- Removed the sidebar-based URL prompt workflow from the command palette.
- "Insert YouTube transcript" is now the main workflow for transcript + summary generation.
- New notes are created in the configured output folder instead of always using the vault root.

### Fixed

- Fixed issue where only the sidebar command was available when no note was open.

## [1.7.0] - 2026-04-24

### Added

- Full OpenAI integration for LLM summarization
- Support for OpenAI API key authentication
- Chat-based completions via `/v1/chat/completions`
- Dynamic model selection using OpenAI model list
- Metadata injection into OpenAI prompts:
  - `{{VIDEO_TITLE}}`
  - `{{SOURCE_URL}}`
  - `{{VIDEO_ID}}`
  - `{{LLM_PROVIDER}}`
  - `{{MODEL_NAME}}`
  - `{{CREATED_AT}}`

### Changed

- SummarizationService now supports three providers:
  - Ollama (local)
  - OpenRouter (multi-model cloud)
  - OpenAI (direct API)
- Unified provider architecture with shared prompt pipeline
- Consistent response parsing across all providers

### Fixed

- Fixed missing API key handling for OpenAI provider
- Fixed inconsistent provider switching behavior

## [1.6.0] - 2026-04-24

### Added

- Full OpenRouter integration for LLM summarization
- Support for OpenRouter API key authentication
- Dynamic model loading from OpenRouter API
- Chat-based completion support via `/v1/chat/completions`
- Metadata injection into OpenRouter prompts:
  - `{{VIDEO_TITLE}}`
  - `{{SOURCE_URL}}`
  - `{{VIDEO_ID}}`
  - `{{LLM_PROVIDER}}`
  - `{{MODEL_NAME}}`
  - `{{CREATED_AT}}`

### Changed

- SummarizationService now supports multiple providers:
  - Ollama
  - OpenRouter
- Unified prompt handling across providers
- Improved provider-based architecture for future extensions

### Fixed

- Prevented missing summaries when switching providers
- Fixed provider fallback behavior

## [1.5.0] - 2026-04-24

### Added

- Automatically renames the active note to the original YouTube video title after inserting summary and transcript
- Safe filename generation:
  - Keeps emojis and Unicode characters
  - Removes invalid file path characters (`/ \\ : * ? " < > |`)
  - Collapses duplicate whitespace
  - Limits filenames to 120 characters
  - Prevents overwriting existing notes by appending numeric suffixes (` 2`, ` 3`, ...)
- Injects real video metadata into LLM prompt:
  - `{{VIDEO_TITLE}}`
  - `{{SOURCE_URL}}`
  - `{{VIDEO_ID}}`
  - `{{LLM_PROVIDER}}`
  - `{{MODEL_NAME}}`
  - `{{CREATED_AT}}`

### Changed

- Frontmatter (Obsidian Properties) is now controlled and corrected by the plugin instead of relying on LLM output
- `title` property now always uses the original YouTube video title
- Summary output now fully respects the structure defined in the prompt (no forced `## Summary (de)` wrapper)
- Improved prompt handling:
  - Supports both uppercase and lowercase placeholders (`{{TRANSCRIPT}}`, `{{transcript}}`, etc.)

### Fixed

- Fixed unresolved placeholder variables in generated frontmatter
- Fixed duplicated or misplaced YAML properties inside the summary body
- Fixed missing summaries when using uppercase placeholders like `{{TRANSCRIPT}}`

## [1.4.0] - 2026-04-24

### Added

- LLM-based summarization for YouTube transcripts
- "Insert YouTube transcript" command now:
  - Fetches transcript
  - Generates summary via LLM
  - Inserts summary + transcript directly into active note
- Support for external prompt templates via file path (`promptFilePath`)
- Support for multiple LLM providers:
  - Ollama
  - OpenRouter
  - OpenAI
- Configurable model and provider in plugin settings
- New settings:
  - Summary language
  - LLM provider
  - Model name
  - Ollama base URL
  - OpenRouter API key
  - OpenAI API key
  - Prompt file path

### Changed

- Integrated `SummarizationService` into main workflow
- Prompt is now loaded from a vault file instead of being hardcoded
- Transcript is passed as full text to LLM
- Improved output formatting:
  - Automatic extraction of YAML frontmatter from LLM response
  - Frontmatter is inserted at top of note (Obsidian-compatible)
  - Summary appears below frontmatter (`## Summary (language)`)
  - Transcript appears below summary (`## Transcript`)
- Improved UX:
  - Added loading feedback via Obsidian Notice
  - Temporary placeholder inserted into note during processing
  - Placeholder replaced after completion
  - Success and error notices added
- Refactored InsertTranscriptCommand to handle full pipeline:
  - URL detection
  - Transcript fetching
  - Summarization
  - Output building
- Added helper methods:
  - `buildOutput()` for structured output
  - `loadPromptTemplate()` for dynamic prompt loading

### Fixed

- Summary is now correctly generated in "Insert transcript" command
- Fixed issue where summary was only shown in sidebar
- Fixed incorrect placement of YAML frontmatter (now always at top)
- Fixed placeholder handling during async processing
- Replaced `replaceAll` for compatibility with older TypeScript target

## [1.3.1]

- Original plugin version
