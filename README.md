# YTranscript

Fetch YouTube transcripts and generate AI summary notes directly in Obsidian.

## Main command

Run:
- **YouTube → AI Summary Note**

Flow:
1. URL wird aus Auswahl/Clipboard erkannt oder manuell eingegeben.
2. Transcript wird geladen.
3. LLM-Summary wird erzeugt (Ollama / OpenRouter / OpenAI).
4. Note wird mit Frontmatter + Summary + Transcript geschrieben.
5. Statusleiste zeigt Pipeline-Status (Loading, Chunking, Merge, Done).

## Output

Jede generierte Note enthält:
- YAML frontmatter (plugin-kontrolliert)
- Markdown summary (LLM output)
- extrahierte Tags im YAML
- vollständiges Transcript

## Settings

- `Language` / `Country` für Transcript-Auswahl
- `LLM Provider` (`ollama`, `openrouter`, `openai`)
- `Model`
- `Ollama Base URL`
- `OpenRouter API Key`
- `OpenAI API Key`
- `Prompt File Path` (optional)
- `Output Folder` (optional)
- `Enable Chunking for long transcripts` (neu, Standard: aktiviert)
- `Chunk map concurrency` (Standard: `1`, vorsichtig erhöhen)
- `Enable debug logging` (Standard: aus, sichere Pipeline-Metadaten in der Developer Console)

## Chunking für lange Transcripts

Bei langen Texten nutzt der Service einen Map-Reduce-Flow:
- Transcript wird in Chunks geteilt
- Pro Chunk wird eine Teilzusammenfassung erzeugt
- Teilzusammenfassungen werden zu einer finalen Summary zusammengeführt

Vorteile:
- stabiler bei Token-Limits
- bessere Verarbeitung großer Videos
- bestehender Note-Output bleibt unverändert

Wichtiger Hinweis (Ollama):
- Chunking ist insbesondere mit Ollama (lokal oder remote über Proxy) mit Vorsicht zu verwenden.
- Höhere `Chunk map concurrency` kann Laufzeit, Last und Timeout-Risiko (z. B. 429/503/504) deutlich erhöhen.
- Empfohlener Startwert: `Chunk map concurrency = 1`.
- Der Service nutzt Retry/Backoff für 429/503/504 und versucht beim Final Merge einen non-streaming Fallback.

## Statusleiste

Während der Ausführung zeigt die Obsidian-Statusleiste den Fortschritt:
- `YT: Fetching transcript...`
- `YT: Chunking X/Y...` (bei aktivem Chunking, live fortlaufend)
- `YT: Final merge...`
- `YT: Done` oder `YT: Failed`

Hinweis: Bei langen Läufen wird der Chunk-Fortschritt kontinuierlich aktualisiert, damit kein vorzeitiges `Ready` erscheint.

Reset erfolgt automatisch nach 120 Sekunden auf `YTranscript: Ready`.

## Verhalten ohne offene Note

Wenn kein Editor offen ist, erstellt das Plugin automatisch eine neue Note
(im optional konfigurierten `Output Folder`) und schreibt dort den Inhalt.

Bei Reading Mode versucht das Plugin vor dem Einfügen auf Source/Edit Mode zu wechseln.
Falls kein Editor verfügbar ist, wird der finale Output sicher direkt in die Datei geschrieben (Hybrid-Fallback).