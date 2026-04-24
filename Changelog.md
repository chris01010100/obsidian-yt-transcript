# Changelog

## [1.4.0] - 2026-04-24

### ✨ Features

- Added LLM-based summarization for YouTube transcripts
- "Insert YouTube transcript" command now:
  - Fetches transcript
  - Generates summary via LLM
  - Inserts summary + transcript directly into active note
- Support for external prompt templates via file path
- Added support for multiple LLM providers:
  - Ollama
  - OpenRouter
  - OpenAI
- Configurable model and provider in plugin settings

### 🧠 AI / Summarization

- Integrated `SummarizationService`
- Prompt is now loaded from a vault file (`promptFilePath`)
- Transcript is passed as full text to LLM
- Dynamic placeholder support in prompt:
  - `{{TRANSCRIPT}}`
  - `{{SOURCE_URL}}`
  - `{{VIDEO_ID}}`
  - `{{LLM_PROVIDER}}`
  - `{{MODEL_NAME}}`

### 🧾 Output Formatting

- Automatic extraction of YAML frontmatter from LLM response
- Frontmatter is inserted at top of note (Obsidian-compatible)
- Summary appears below frontmatter:
  - `## Summary (language)`
- Transcript appears below summary:
  - `## Transcript`

### 🎨 UX Improvements

- Added loading feedback:
  - Obsidian Notice: "Generating YouTube summary…"
  - Temporary placeholder inserted into note:
    - "Generating summary…"
    - "Loading transcript…"
- Placeholder is replaced once processing is complete
- Success notice after insertion
- Error notice if summarization fails

### ⚙️ Settings

- Added new settings:
  - Summary language
  - LLM provider
  - Model name
  - Ollama base URL
  - OpenRouter API key
  - OpenAI API key
  - Prompt file path

### 🐛 Fixes

- Fixed issue where summary was only shown in sidebar
- Fixed missing summary in "Insert transcript" command
- Fixed incorrect placement of YAML frontmatter (now at top)
- Fixed placeholder handling during async processing
- Replaced `replaceAll` for compatibility with older TS target

### 🧱 Internal

- Refactored InsertTranscriptCommand to handle full pipeline:
  - URL detection
  - Transcript fetching
  - Summarization
  - Output building
- Added `buildOutput()` helper for structured output
- Added `loadPromptTemplate()` for dynamic prompt loading

## [1.3.1]

- Original plugin version
