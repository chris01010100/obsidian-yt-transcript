import { Editor, Notice, TFile } from "obsidian";
import { URLDetector } from "../url-detection";
import {
	TranscriptFormatter,
	FormatTemplate,
	FormatOptions,
} from "../transcript-formatter";
import { YoutubeTranscript } from "../youtube-transcript";
import { PromptModal, type PromptModalResult } from "../prompt-modal";
import { EditorExtensions } from "../../editor-extensions";
import { TranscriptConfig } from "../types";
import { SummarizationService } from "../services/SummarizationService";

export interface InsertTranscriptOptions {
	template?: FormatTemplate;
	timestampMod?: number;
}

interface PromptInputResult {
	url: string;
	summaryLanguage: string;
}

interface VideoMetadata {
	videoTitle: string;
	sourceUrl: string;
	videoId: string;
	summaryLanguage: string;
	llmProvider: string;
	modelName: string;
	createdAt: string;
}

export class InsertTranscriptCommand {
	constructor(private plugin: any) { }

	private summarizationService = new SummarizationService();

	/**
	 * Executes the insert transcript command with default settings
	 */
	async execute(editor: Editor): Promise<void> {
		await this.executeWithOptions(editor, {});
	}

	/**
	 * Executes the insert transcript command with custom options
	 */
	async executeWithOptions(
		editor: Editor,
		options: InsertTranscriptOptions,
	): Promise<void> {
		try {
			// Get YouTube URL with user confirmation
			const promptInput = await this.getYouTubeUrlWithConfirmation(editor);
			if (!promptInput?.url) {
				return; // User cancelled or no URL found
			}

			const { url, summaryLanguage } = promptInput;
			new Notice("Generating YouTube summary…");
			const insertionStart = editor.getCursor();
			const loadingText = [
				`## Summary (${summaryLanguage})`,
				"Generating summary…",
				"",
				"## Transcript",
				"Loading transcript…",
				"",
			].join("\n");
			editor.replaceRange(loadingText, insertionStart);
			console.log("Insert transcript summary language:", summaryLanguage);

			// Validate URL
			if (!URLDetector.isValidYouTubeUrl(url)) {
				return; // Invalid YouTube URL
			}

			// Fetch transcript
			const transcriptConfig = this.createTranscriptConfig();
			const transcript = await YoutubeTranscript.getTranscript(
				url,
				transcriptConfig,
			);

			// Validate transcript
			if (
				!transcript ||
				!transcript.lines ||
				transcript.lines.length === 0
			) {
				return; // No transcript available
			}

			// Build full text for LLM
			const fullText = transcript.lines.map((l) => l.text).join(" ");

			// Load optional prompt template from settings
			const promptTemplate = await this.loadPromptTemplate();

			const metadata: VideoMetadata = {
				videoTitle: transcript.title || "Untitled YouTube Video",
				sourceUrl: url,
				videoId: this.extractVideoId(url),
				summaryLanguage,
				llmProvider: this.plugin.settings?.provider || "ollama",
				modelName: this.plugin.settings?.model || "",
				createdAt: new Date().toISOString().slice(0, 10),
			};

			// Format transcript before streaming so live output can include it.
			const formatOptions = this.mergeFormatOptions(options);
			const formattedTranscript = TranscriptFormatter.format(
				transcript,
				url,
				formatOptions,
			);

			let currentOutputEnd = editor.offsetToPos(
				editor.posToOffset(insertionStart) + loadingText.length,
			);
			let lastStreamUpdate = 0;
			let streamedSummaryText = "";

			// Guard: ensure a model is selected
			const selectedModel = this.plugin.settings?.model;
			if (!selectedModel) {
				new Notice("Please select a model in Settings before generating a summary.");
				this.openPluginSettings();

				const errorText = [
					"## Summary",
					"No model selected. Please choose a model in plugin settings.",
					"",
					"## Transcript",
					formattedTranscript,
					"",
				].join("\n");

				editor.replaceRange(errorText, insertionStart, currentOutputEnd);
				return;
			}

			// Generate summary via LLM stream.
			const summaryText = await this.summarizationService.summarizeStream(
				fullText,
				{
					language: summaryLanguage,
					provider: this.plugin.settings?.provider,
					model: this.plugin.settings?.model,
					ollamaBaseUrl: this.plugin.settings?.ollamaBaseUrl,
					openRouterApiKey: this.plugin.settings?.openRouterApiKey,
					openAIApiKey: this.plugin.settings?.openAIApiKey,
					promptTemplate,
					videoTitle: metadata.videoTitle,
					sourceUrl: metadata.sourceUrl,
					videoId: metadata.videoId,
					llmProvider: metadata.llmProvider,
					modelName: metadata.modelName,
					createdAt: metadata.createdAt,
				},
				async (_chunk, fullSummary) => {
					streamedSummaryText = fullSummary;
					const now = Date.now();

					if (now - lastStreamUpdate < 250) {
						return;
					}

					lastStreamUpdate = now;
					const liveOutput = this.buildOutput(
						streamedSummaryText || "Generating summary…",
						formattedTranscript,
						metadata,
					);
					editor.replaceRange(liveOutput, insertionStart, currentOutputEnd);
					currentOutputEnd = editor.offsetToPos(
						editor.posToOffset(insertionStart) + liveOutput.length,
					);
				},
			);

			// Combine properties, summary and transcript
			const output = this.buildOutput(
				summaryText,
				formattedTranscript,
				metadata,
			);

			if (!output.trim()) return;

			editor.replaceRange(output, insertionStart, currentOutputEnd);
			await this.renameActiveNote(metadata.videoTitle);
			new Notice("YouTube summary inserted.");
		} catch (error) {
			// Silently fail - errors are expected (network issues, no transcript, etc.)
			new Notice("Failed to generate YouTube summary. Check developer console.");
			console.error("Insert transcript failed:", error);
		}
	}

	private openPluginSettings(): void {
		const app = this.plugin.app as any;
		app.setting?.open?.();
		app.setting?.openTabById?.(this.plugin.manifest.id);
	}

	/**
	 * Gets YouTube URL with user confirmation via prompt
	 * Always shows prompt, but pre-populates with detected URL
	 */
	private async getYouTubeUrlWithConfirmation(
		editor: Editor,
	): Promise<PromptInputResult | null> {
		// Try to detect URL from selection first, then clipboard
		const detectedUrl = await this.detectYouTubeUrl(editor);

		// Always show prompt, but pre-populate with detected URL
		try {
			const prompt = new PromptModal(detectedUrl || undefined);
			const result = await new Promise<PromptModalResult>((resolve, reject) => {
				prompt.openAndGetValue(resolve, reject);
			});

			if (!result?.url?.trim()) {
				return null;
			}

			return {
				url: result.url.trim(),
				summaryLanguage: result.summaryLanguage,
			};
		} catch (error) {
			// User cancelled
			return null;
		}
	}

	/**
	 * Detects YouTube URL from selection or clipboard (for pre-populating prompt)
	 */
	private async detectYouTubeUrl(editor: Editor): Promise<string | null> {
		// 1. Try to get URL from selection
		const selectionUrl = this.getUrlFromSelection(editor);
		if (selectionUrl) {
			return selectionUrl;
		}

		// 2. Try to get URL from clipboard
		const clipboardUrl = await this.getUrlFromClipboard();
		if (clipboardUrl) {
			return clipboardUrl;
		}

		// 3. No URL detected
		return null;
	}

	/**
	 * Gets URL from current editor selection
	 */
	private getUrlFromSelection(editor: Editor): string | null {
		try {
			const selectedText = editor.somethingSelected()
				? editor.getSelection()
				: EditorExtensions.getSelectedText(editor);

			return URLDetector.extractYouTubeUrlFromText(selectedText);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Gets URL from system clipboard
	 */
	private async getUrlFromClipboard(): Promise<string | null> {
		try {
			const clipboardText = await navigator.clipboard.readText();
			return URLDetector.extractYouTubeUrlFromText(clipboardText);
		} catch (error) {
			// Clipboard access might be denied
			return null;
		}
	}

	/**
	 * Creates transcript config from plugin settings
	 */
	private createTranscriptConfig(): TranscriptConfig {
		return {
			lang: this.plugin.settings?.lang,
			country: this.plugin.settings?.country,
		};
	}

	private extractVideoId(url: string): string {
		try {
			const parsedUrl = new URL(url);
			const videoId = parsedUrl.searchParams.get("v");
			if (videoId) return videoId;

			const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
			return pathParts[pathParts.length - 1] || "";
		} catch (error) {
			return "";
		}
	}

	private async loadPromptTemplate(): Promise<string | undefined> {
		const path = this.plugin.settings?.promptFilePath?.trim();
		if (!path) return undefined;

		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (!file || file.extension !== "md" && file.extension !== "txt") return undefined;

		return this.plugin.app.vault.cachedRead(file);
	}

	private buildOutput(
		summaryText: string,
		formattedTranscript: string,
		metadata: VideoMetadata,
	): string {
		const hydratedSummary = this.replaceMetadataPlaceholders(
			summaryText.trim(),
			metadata,
		);

		// 👉 Finde erste Markdown-Überschrift (# ...)
		const summaryStartIndex = this.findFirstMarkdownHeadingIndex(hydratedSummary);

		const rawFrontmatter =
			summaryStartIndex > 0
				? hydratedSummary.slice(0, summaryStartIndex).trim()
				: undefined;

		const rawSummaryBody =
			summaryStartIndex >= 0
				? hydratedSummary.slice(summaryStartIndex).trim()
				: hydratedSummary.replace(/^---[\s\S]*?---\s*/, "").trim();

		const frontmatter = this.buildFrontmatter(rawFrontmatter, metadata);

		const parts: string[] = [frontmatter, ""];

		parts.push(
			rawSummaryBody || "Generating summary…",
			"",
			"## Transcript",
			formattedTranscript,
			"",
		);

		return parts.join("\n");
	}

	private findFirstMarkdownHeadingIndex(content: string): number {
		const match = content.match(/(^|\n)#{1,6}\s/);
		if (!match || match.index === undefined) return -1;

		return content[match.index] === "\n"
			? match.index + 1
			: match.index;
	}

	private replaceMetadataPlaceholders(
		content: string,
		metadata: VideoMetadata,
	): string {
		return content
			.split("{{video_title}}").join(metadata.videoTitle)
			.split("{{source_url}}").join(metadata.sourceUrl)
			.split("{{video_id}}").join(metadata.videoId)
			.split("{{language}}").join(metadata.summaryLanguage)
			.split("{{llm_provider}}").join(metadata.llmProvider)
			.split("{{model_name}}").join(metadata.modelName)
			.split("{{created_at}}").join(metadata.createdAt)
			.split("{{VIDEO_TITLE}}").join(metadata.videoTitle)
			.split("{{SOURCE_URL}}").join(metadata.sourceUrl)
			.split("{{VIDEO_ID}}").join(metadata.videoId)
			.split("{{LANGUAGE}}").join(metadata.summaryLanguage)
			.split("{{LLM_PROVIDER}}").join(metadata.llmProvider)
			.split("{{MODEL_NAME}}").join(metadata.modelName)
			.split("{{CREATED_AT}}").join(metadata.createdAt);
	}

	private buildFrontmatter(
		rawFrontmatter: string | undefined,
		metadata: VideoMetadata,
	): string {
		let frontmatterBody = rawFrontmatter
			? rawFrontmatter.replace(/^---\n?/, "").replace(/\n?---$/, "")
			: "";

		frontmatterBody = this.upsertFrontmatterField(
			frontmatterBody,
			"title",
			this.quoteYaml(metadata.videoTitle),
		);
		frontmatterBody = this.upsertFrontmatterField(
			frontmatterBody,
			"source_url",
			this.quoteYaml(metadata.sourceUrl),
		);
		frontmatterBody = this.upsertFrontmatterField(
			frontmatterBody,
			"video_id",
			this.quoteYaml(metadata.videoId),
		);
		frontmatterBody = this.upsertFrontmatterField(
			frontmatterBody,
			"language",
			metadata.summaryLanguage,
		);
		frontmatterBody = this.upsertFrontmatterField(
			frontmatterBody,
			"llm_provider",
			metadata.llmProvider,
		);
		frontmatterBody = this.upsertFrontmatterField(
			frontmatterBody,
			"llm_model",
			this.quoteYaml(metadata.modelName),
		);
		frontmatterBody = this.upsertFrontmatterField(
			frontmatterBody,
			"created_at",
			metadata.createdAt,
		);

		return `---\n${frontmatterBody.trim()}\n---`;
	}

	private upsertFrontmatterField(
		frontmatterBody: string,
		key: string,
		value: string,
	): string {
		const fieldPattern = new RegExp(`^${key}:.*$`, "m");
		const line = `${key}: ${value}`;

		if (fieldPattern.test(frontmatterBody)) {
			return frontmatterBody.replace(fieldPattern, line);
		}

		return `${frontmatterBody.trim()}\n${line}`.trim();
	}

	private quoteYaml(value: string): string {
		return JSON.stringify(value || "");
	}

	private async renameActiveNote(videoTitle: string): Promise<void> {
		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (!(activeFile instanceof TFile)) return;

		const safeFileName = this.sanitizeFileName(videoTitle);
		if (!safeFileName) return;

		const currentFolder = activeFile.parent?.path || "";
		const targetPath = await this.getAvailableFilePath(
			currentFolder,
			safeFileName,
			activeFile.path,
		);

		if (targetPath === activeFile.path) return;

		await this.plugin.app.fileManager.renameFile(activeFile, targetPath);
	}

	private sanitizeFileName(title: string): string {
		return title
			.replace(/[\\/:*?"<>|]/g, " ")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 120)
			.trim();
	}

	private async getAvailableFilePath(
		folderPath: string,
		baseName: string,
		currentPath: string,
	): Promise<string> {
		const normalizedFolder = folderPath && folderPath !== "/" ? `${folderPath}/` : "";
		let candidatePath = `${normalizedFolder}${baseName}.md`;

		if (candidatePath === currentPath) {
			return candidatePath;
		}

		let counter = 2;
		while (this.plugin.app.vault.getAbstractFileByPath(candidatePath)) {
			candidatePath = `${normalizedFolder}${baseName} ${counter}.md`;
			counter += 1;
		}

		return candidatePath;
	}

	/**
	 * Merges user options with plugin settings
	 */
	private mergeFormatOptions(
		options: InsertTranscriptOptions,
	): FormatOptions {
		return {
			template: options.template || FormatTemplate.STANDARD,
			timestampMod:
				options.timestampMod || this.plugin.settings?.timestampMod || 5,
		};
	}
}
