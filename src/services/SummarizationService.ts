export interface SummarizationOptions {
    language?: string;
    provider?: "ollama" | "openrouter" | "openai";
    model?: string;
    ollamaBaseUrl?: string;
    openRouterApiKey?: string;
    promptTemplate?: string;
    videoTitle?: string;
    sourceUrl?: string;
    videoId?: string;
    llmProvider?: string;
    modelName?: string;
    createdAt?: string;
}

interface OllamaGenerateResponse {
    response?: string;
    done?: boolean;
    error?: string;
}

interface OpenRouterChatResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
    error?: {
        message?: string;
    };
}

interface PromptMetadata {
    promptTemplate?: string;
    videoTitle?: string;
    sourceUrl?: string;
    videoId?: string;
    llmProvider?: string;
    modelName?: string;
    createdAt?: string;
}

export class SummarizationService {
    async summarize(text: string, options?: SummarizationOptions): Promise<string> {
        const language = options?.language || "de";
        const provider = options?.provider || "ollama";

        const metadata: PromptMetadata = {
            promptTemplate: options?.promptTemplate,
            videoTitle: options?.videoTitle,
            sourceUrl: options?.sourceUrl,
            videoId: options?.videoId,
            llmProvider: options?.llmProvider,
            modelName: options?.modelName,
            createdAt: options?.createdAt,
        };

        if (provider === "ollama") {
            return this.summarizeWithOllama(text, {
                language,
                model: options?.model || "qwen2.5:3b",
                baseUrl: options?.ollamaBaseUrl || "http://localhost:11434",
                ...metadata,
            });
        }

        if (provider === "openrouter") {
            return this.summarizeWithOpenRouter(text, {
                language,
                model: options?.model || "openai/gpt-4o-mini",
                apiKey: options?.openRouterApiKey || "",
                ...metadata,
            });
        }

        return `[Provider ${provider} not implemented yet]`;
    }

    private async summarizeWithOllama(
        text: string,
        options: {
            language: string;
            model: string;
            baseUrl: string;
            promptTemplate?: string;
            videoTitle?: string;
            sourceUrl?: string;
            videoId?: string;
            llmProvider?: string;
            modelName?: string;
            createdAt?: string;
        },
    ): Promise<string> {
        const prompt = this.buildPrompt(text, options.language, options);
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

    private async summarizeWithOpenRouter(
        text: string,
        options: {
            language: string;
            model: string;
            apiKey: string;
            promptTemplate?: string;
            videoTitle?: string;
            sourceUrl?: string;
            videoId?: string;
            llmProvider?: string;
            modelName?: string;
            createdAt?: string;
        },
    ): Promise<string> {
        if (!options.apiKey.trim()) {
            throw new Error("OpenRouter API key is missing.");
        }

        const prompt = this.buildPrompt(text, options.language, options);

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${options.apiKey}`,
                "HTTP-Referer": "https://obsidian.md",
                "X-Title": "Obsidian YTranscript",
            },
            body: JSON.stringify({
                model: options.model,
                messages: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenRouter request failed: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as OpenRouterChatResponse;

        if (data.error?.message) {
            throw new Error(`OpenRouter error: ${data.error.message}`);
        }

        return data.choices?.[0]?.message?.content?.trim() || "[Empty summary returned by OpenRouter]";
    }

    private buildPrompt(
        text: string,
        language: string,
        metadata: PromptMetadata,
    ): string {
        const promptTemplate = metadata.promptTemplate;
        if (promptTemplate?.trim()) {
            return promptTemplate
                .split("{{language}}").join(language)
                .split("{{LANGUAGE}}").join(language)
                .split("{{transcript}}").join(text)
                .split("{{TRANSCRIPT}}").join(text)
                .split("{{video_title}}").join(metadata.videoTitle || "")
                .split("{{source_url}}").join(metadata.sourceUrl || "")
                .split("{{video_id}}").join(metadata.videoId || "")
                .split("{{llm_provider}}").join(metadata.llmProvider || "")
                .split("{{model_name}}").join(metadata.modelName || "")
                .split("{{created_at}}").join(metadata.createdAt || "")
                .split("{{VIDEO_TITLE}}").join(metadata.videoTitle || "")
                .split("{{SOURCE_URL}}").join(metadata.sourceUrl || "")
                .split("{{VIDEO_ID}}").join(metadata.videoId || "")
                .split("{{LLM_PROVIDER}}").join(metadata.llmProvider || "")
                .split("{{MODEL_NAME}}").join(metadata.modelName || "")
                .split("{{CREATED_AT}}").join(metadata.createdAt || "");
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