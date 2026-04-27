export interface SummarizationOptions {
    language?: string;
    provider?: "ollama" | "openrouter" | "openai";
    model?: string;
    ollamaBaseUrl?: string;
    openRouterApiKey?: string;
    openAIApiKey?: string;
    promptTemplate?: string;
    videoTitle?: string;
    sourceUrl?: string;
    videoId?: string;
    llmProvider?: string;
    modelName?: string;
    createdAt?: string;
}

export type SummaryChunkHandler = (chunk: string, fullText: string) => void | Promise<void>;

interface OllamaGenerateResponse {
    response?: string;
    done?: boolean;
    error?: string;
}

interface ChatCompletionResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
    error?: {
        message?: string;
    };
}

interface ChatCompletionStreamChunk {
    choices?: Array<{
        delta?: {
            content?: string;
        };
    }>;
    error?: {
        message?: string;
    };
}

interface OllamaStreamChunk {
    response?: string;
    done?: boolean;
    error?: string;
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
        const language = "";
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

        if (provider === "openai") {
            return this.summarizeWithOpenAI(text, {
                language,
                model: options?.model || "gpt-4o-mini",
                apiKey: options?.openAIApiKey || "",
                ...metadata,
            });
        }

        return `[Provider ${provider} not implemented yet]`;
    }

    async summarizeStream(
        text: string,
        options: SummarizationOptions | undefined,
        onChunk: SummaryChunkHandler,
    ): Promise<string> {
        const language = "";
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
            return this.summarizeWithOllamaStream(text, {
                language,
                model: options?.model || "qwen2.5:3b",
                baseUrl: options?.ollamaBaseUrl || "http://localhost:11434",
                ...metadata,
            }, onChunk);
        }

        if (provider === "openrouter") {
            return this.summarizeWithChatCompletionsStream(
                text,
                {
                    language,
                    model: options?.model || "openai/gpt-4o-mini",
                    apiKey: options?.openRouterApiKey || "",
                    url: "https://openrouter.ai/api/v1/chat/completions",
                    headers: {
                        "HTTP-Referer": "https://obsidian.md",
                        "X-Title": "Obsidian YTranscript",
                    },
                    ...metadata,
                },
                onChunk,
            );
        }

        if (provider === "openai") {
            return this.summarizeWithChatCompletionsStream(
                text,
                {
                    language,
                    model: options?.model || "gpt-4o-mini",
                    apiKey: options?.openAIApiKey || "",
                    url: "https://api.openai.com/v1/chat/completions",
                    ...metadata,
                },
                onChunk,
            );
        }

        const fallback = `[Provider ${provider} not implemented yet]`;
        await onChunk(fallback, fallback);
        return fallback;
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

    private async summarizeWithOllamaStream(
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
        onChunk: SummaryChunkHandler,
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
                stream: true,
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama stream request failed: ${response.status} ${response.statusText}`);
        }

        return this.readJsonLineStream<OllamaStreamChunk>(response, async (chunk, fullText) => {
            if (chunk.error) {
                throw new Error(`Ollama stream error: ${chunk.error}`);
            }

            if (chunk.response) {
                await onChunk(chunk.response, fullText + chunk.response);
            }

            return chunk.response || "";
        });
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

        const data = (await response.json()) as ChatCompletionResponse;

        if (data.error?.message) {
            throw new Error(`OpenRouter error: ${data.error.message}`);
        }

        return data.choices?.[0]?.message?.content?.trim() || "[Empty summary returned by OpenRouter]";
    }

    private async summarizeWithOpenAI(
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
            throw new Error("OpenAI API key is missing.");
        }

        const prompt = this.buildPrompt(text, options.language, options);

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${options.apiKey}`,
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
            throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as ChatCompletionResponse;

        if (data.error?.message) {
            throw new Error(`OpenAI error: ${data.error.message}`);
        }

        return data.choices?.[0]?.message?.content?.trim() || "[Empty summary returned by OpenAI]";
    }

    private async summarizeWithChatCompletionsStream(
        text: string,
        options: {
            language: string;
            model: string;
            apiKey: string;
            url: string;
            headers?: Record<string, string>;
            promptTemplate?: string;
            videoTitle?: string;
            sourceUrl?: string;
            videoId?: string;
            llmProvider?: string;
            modelName?: string;
            createdAt?: string;
        },
        onChunk: SummaryChunkHandler,
    ): Promise<string> {
        if (!options.apiKey.trim()) {
            throw new Error("API key is missing.");
        }

        const prompt = this.buildPrompt(text, options.language, options);

        const response = await fetch(options.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${options.apiKey}`,
                ...(options.headers || {}),
            },
            body: JSON.stringify({
                model: options.model,
                stream: true,
                messages: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
            }),
        });

        if (!response.ok) {
            throw new Error(`Chat completions stream request failed: ${response.status} ${response.statusText}`);
        }

        return this.readServerSentEventsStream(response, async (chunk, fullText) => {
            if (chunk.error?.message) {
                throw new Error(`Chat completions stream error: ${chunk.error.message}`);
            }

            const delta = chunk.choices?.[0]?.delta?.content || "";
            if (delta) {
                await onChunk(delta, fullText + delta);
            }

            return delta;
        });
    }

    private async readJsonLineStream<T>(
        response: Response,
        handleChunk: (chunk: T, fullText: string) => Promise<string>,
    ): Promise<string> {
        if (!response.body) {
            throw new Error("Streaming response body is empty.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                const chunk = JSON.parse(trimmedLine) as T;
                const delta = await handleChunk(chunk, fullText);
                fullText += delta;
            }
        }

        return fullText.trim();
    }

    private async readServerSentEventsStream(
        response: Response,
        handleChunk: (chunk: ChatCompletionStreamChunk, fullText: string) => Promise<string>,
    ): Promise<string> {
        if (!response.body) {
            throw new Error("Streaming response body is empty.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";

            for (const event of events) {
                const dataLines = event
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line.startsWith("data:"));

                for (const dataLine of dataLines) {
                    const data = dataLine.replace(/^data:\s*/, "");
                    if (!data || data === "[DONE]") continue;

                    const chunk = JSON.parse(data) as ChatCompletionStreamChunk;
                    const delta = await handleChunk(chunk, fullText);
                    fullText += delta;
                }
            }
        }

        return fullText.trim();
    }

    private buildPrompt(
        text: string,
        language: string,
        metadata: PromptMetadata,
    ): string {
        const userInstructions = metadata.promptTemplate?.trim()
            ? this.replaceMetadataPlaceholders(metadata.promptTemplate.trim(), language, metadata)
            : [
                "Create a clear, structured Markdown summary of the following YouTube transcript.",
                "Focus on the key ideas, important details, named entities, practical steps and open questions.",
            ].join("\n");

        return [
            "You are a precise YouTube transcript summarization assistant.",
            "Return only Markdown body content.",
            "Do not include YAML frontmatter.",
            "Do not include Obsidian Properties.",
            "Do not include metadata fields like title, source_url, video_id, llm_provider or created_at.",
            "Do not explain what you are doing.",
            "",
            "User summary instructions:",
            userInstructions,
            "",
            "Transcript:",
            text,
        ].join("\n");
    }

    private replaceMetadataPlaceholders(
        content: string,
        language: string,
        metadata: PromptMetadata,
    ): string {
        return content
            .split("{{language}}").join(language)
            .split("{{LANGUAGE}}").join(language)
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
}