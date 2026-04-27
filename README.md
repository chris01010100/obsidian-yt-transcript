# 🚀 Usage

## 🧠 AI Summary + Transcript (Main Command)

1. Run command:  
   **"Insert YouTube transcript"** *(current name)*

2. The plugin will:
   - Detect YouTube URL from:
     - selected text
     - clipboard
     - or manual input
   - Ask for confirmation

3. Then automatically:
   - Fetch transcript
   - Send it to your selected LLM (Ollama / OpenRouter / OpenAI)
   - Generate a structured summary
   - Extract tags
   - Build a complete Obsidian note

---

## 📄 Where does the note go?

### If an editor is open:
→ Content is inserted at cursor position

### If NO note is open:
→ Plugin will:
- create a new note
- save it in your configured target folder
- open the note automatically
- insert summary + transcript

👉 Works fully without manual note creation

---

## 🧾 Output

Each generated note contains:

- YAML frontmatter (auto-generated)
- structured summary (from LLM)
- extracted tags (stored in YAML)
- transcript with timestamps

👉 Fully Obsidian-ready

---

## ⚠️ Command Naming (Important)

Currently:
- The command is still called:  
  **"Insert YouTube transcript"**

But it now:
- generates summaries
- creates full notes
- uses LLMs

👉 Renaming is planned (e.g. "Create YouTube summary note")