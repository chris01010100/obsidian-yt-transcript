export interface SummarizationOptions {
    language?: string;
}

export class SummarizationService {
    async summarize(text: string, options?: SummarizationOptions): Promise<string> {
        const language = options?.language || "de";

        // TODO: Replace with real LLM call (Ollama / OpenRouter / OpenAI)
        const preview = text.trim().slice(0, 300);

        return `[Service summary ${language}] ${preview}${text.length > 300 ? "..." : ""}`;
    }
}
