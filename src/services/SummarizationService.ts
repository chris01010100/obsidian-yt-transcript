export interface SummarizationOptions {
    language?: string;
    provider?: "ollama" | "openrouter" | "openai";
    model?: string;
    ollamaBaseUrl?: string;
    promptTemplate?: string;
}

interface OllamaGenerateResponse {
    response?: string;
    done?: boolean;
    error?: string;
}

export class SummarizationService {
    async summarize(text: string, options?: SummarizationOptions): Promise<string> {
        const language = options?.language || "de";
        const provider = options?.provider || "ollama";

        if (provider !== "ollama") {
            return `[Provider ${provider} not implemented yet]`;
        }

        return this.summarizeWithOllama(text, {
            language,
            model: options?.model || "qwen2.5:3b",
            baseUrl: options?.ollamaBaseUrl || "http://localhost:11434",
            promptTemplate: options?.promptTemplate,
        });
    }

    private async summarizeWithOllama(
        text: string,
        options: {
            language: string;
            model: string;
            baseUrl: string;
            promptTemplate?: string;
        },
    ): Promise<string> {
        const prompt = this.buildPrompt(text, options.language, options.promptTemplate);
        const baseUrl = options.baseUrl.replace(/\/$/, "");

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: options.model,
                prompt,
                stream: false,
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as OllamaGenerateResponse;

        if (data.error) {
            throw new Error(`Ollama error: ${data.error}`);
        }

        return data.response?.trim() || "[Empty summary returned by Ollama]";
    }

    private buildPrompt(
        text: string,
        language: string,
        promptTemplate?: string,
    ): string {
        if (promptTemplate?.trim()) {
            return promptTemplate
                .split("{{language}}").join(language)
                .split("{{transcript}}").join(text);
        }

        return [
            `Summarize the following YouTube transcript in ${language}.`,
            "Write a concise but useful summary.",
            "Focus on the key points and main events.",
            "Do not mention that this is a transcript unless necessary.",
            "",
            "Transcript:",
            text,
        ].join("\n");
    }
}