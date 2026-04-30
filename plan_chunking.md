# Plan: Robuste Chunking-Architektur für große Transcripts

## Ziel
Token-Limits bei langen YouTube-Transcripts umgehen, ohne bestehenden Plugin-Flow oder Output-Builder zu brechen.

- Plugin steuert weiterhin YAML + Note-Struktur
- LLM liefert weiterhin nur Markdown-Content
- Chunk-Prompt ist fest im Code (hard-coded)
- Finaler Prompt bleibt wie bisher optional aus Datei (`promptTemplate`)

---

## Architektur-Vorschlag

### 1) Neue/erweiterte Bausteine

#### A) Neues Utility: `src/transcript-chunker.ts`
Verantwortung: Transcript in sinnvolle Chunks zerlegen.

Geplante Funktion:
- `splitIntoChunks(text: string, maxChars: number): string[]`

Verhalten:
- Primär zeichenbasiert (flexibel über `maxChars`)
- Trennt bevorzugt an Absatz-/Satzgrenzen (`\n\n`, `.`, `!`, `?`)
- Verhindert harte Zerstückelung von Sätzen
- Fallback auf harten Cut, wenn keine sinnvolle Grenze gefunden wird

#### B) Erweiterung `src/services/SummarizationService.ts`
Neue Verantwortlichkeiten:
- Hard-coded Chunk-Prompt als interne Konstante
- Chunk-spezifische Zusammenfassung pro Teiltext
- Map-Reduce-Pfad für lange Texte

Geplante Ergänzungen:
- `private static readonly CHUNK_PROMPT = ...`
- `summarizeChunk(...)` (non-stream)
- In `summarize(...)`: Entscheidung zwischen Single-Pass und Chunking
- Optional auch in `summarizeStream(...)`: finale Phase streamen, Chunk-Phase non-stream

### 2) Settings-Erweiterung (Chunking ein/aus)

Datei: `src/main.ts`

Änderungen:
- `YTranscriptSettings` erweitern um: `enableChunking: boolean`
- `DEFAULT_SETTINGS`: `enableChunking: true`
- Settings UI (`YTranslateSettingTab.display()`): neues Toggle
  - Name: `Enable Chunking for long transcripts`
  - Beschreibung: Hinweis auf Token-Limits / Empfehlung für lange Videos

---

## Datenfluss (Schritt für Schritt)

1. `InsertTranscriptCommand` bleibt Orchestrator wie bisher.
2. Transcript wird geladen und zu `fullText` zusammengeführt.
3. Aufruf an `SummarizationService` wie bisher.
4. Im Service:
   - Wenn `enableChunking === false` oder Text kurz: **Single-Pass** (bestehendes Verhalten)
   - Wenn `enableChunking === true` und Text lang:
     1. **Chunking (Map):** `fullText -> chunks[]`
     2. Für jeden Chunk separater LLM-Call mit hard-coded Chunk-Prompt
     3. Teilzusammenfassungen sammeln
     4. **Final Merge (Reduce):** Teilzusammenfassungen kombinieren
     5. Ein finaler LLM-Call mit bestehendem User-Prompt (`promptTemplate`)
5. Ergebnis geht zurück an `InsertTranscriptCommand`.
6. Bestehender Output-Builder erzeugt Frontmatter + Summary + Transcript unverändert.

---

## Prompt-Regeln

### Chunk-Prompt (hard-coded, stabil)
- fest im Code
- unabhängig von User-Prompt
- keine YAML
- keine Metadaten
- nur inhaltliche Teilzusammenfassung

### Final-Prompt (bestehend)
- weiterhin optional aus Datei (`promptTemplate`)
- steuert die finale Struktur/Ton der Gesamtzusammenfassung

---

## Streaming-Konzept (optional)

- Chunk-Phase: **non-streaming** (robuster, einfacher Aggregationsfluss)
- Finale Reduce-Phase: kann über bestehendes `summarizeStream(...)` gestreamt werden
- Vorteil: User sieht Live-Output bei der finalen Summary, ohne instabile Parallel-Streams pro Chunk

---

## Stabilität / Rückwärtskompatibilität

- Kein Umbau des `InsertTranscriptCommand`-Flows
- Kein Umbau des Output-Builders
- Additive Änderungen in Service + neues Utility + Settings-Toggle
- Bei deaktiviertem Chunking bleibt altes Verhalten vollständig erhalten

---

## Konkrete Code-Bausteine (Konzept, kein vollständiger Code)

1. `src/transcript-chunker.ts`
   - `splitIntoChunks(text, maxChars)`
   - optionale interne Helper:
     - `findBestSplitIndex(...)`
     - `normalizeChunk(...)`

2. `src/services/SummarizationService.ts`
   - `CHUNK_PROMPT` Konstante
   - `summarizeChunk(...)`
   - `summarizeLargeTextMapReduce(...)`
   - Integration in `summarize(...)` (+ ggf. `summarizeStream(...)`)

3. `src/main.ts`
   - Settings-Interface + Default-Wert
   - Toggle im Settings-Tab

---

## Risiken / Edge Cases

1. **Final Merge zu lang**
   - Wenn viele Chunk-Summaries entstehen, kann auch der finale Call zu groß werden.
   - Gegenmaßnahme: Chunk-Summaries knapp halten, ggf. zweite Reduktionsstufe (optional später).

2. **Schwache Satzstruktur im Transcript**
   - Auto-generierte Captions enthalten teils fehlende Satzzeichen.
   - Gegenmaßnahme: Fallback auf harte Split-Grenze.

3. **Provider-Last / Rate Limits**
   - Viele Calls hintereinander bei langen Videos.
   - Gegenmaßnahme: sequenzielle Verarbeitung statt ungebremster Parallelisierung.

4. **Deaktiviertes Chunking bei langen Texten**
   - User kann weiterhin ins Token-Limit laufen.
   - Gegenmaßnahme: klare Setting-Beschreibung + aussagekräftige Fehlermeldung.

---

## Ergebnis
Mit dieser Architektur bleibt die bestehende Plugin-Logik intakt, große Transcripts werden robust verarbeitet, und der User behält über ein Setting die volle Kontrolle über Chunking ein/aus.