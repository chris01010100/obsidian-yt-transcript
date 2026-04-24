# Changelog

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
