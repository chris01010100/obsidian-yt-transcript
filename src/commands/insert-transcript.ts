import { Editor, Notice } from "obsidian";
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

			// Generate summary via LLM
			const summaryText = await this.summarizationService.summarize(fullText, {
				language: summaryLanguage,
				provider: this.plugin.settings?.provider,
				model: this.plugin.settings?.model,
				ollamaBaseUrl: this.plugin.settings?.ollamaBaseUrl,
				promptTemplate,
			});

			// Format transcript
			const formatOptions = this.mergeFormatOptions(options);
			const formattedTranscript = TranscriptFormatter.format(
				transcript,
				url,
				formatOptions,
			);

			// Combine properties, summary and transcript
			const output = this.buildOutput(
				summaryText,
				formattedTranscript,
				summaryLanguage,
			);

			if (!output.trim()) return;

			const insertionEnd = editor.offsetToPos(
				editor.posToOffset(insertionStart) + loadingText.length,
			);
			editor.replaceRange(output, insertionStart, insertionEnd);
			new Notice("YouTube summary inserted.");
		} catch (error) {
			// Silently fail - errors are expected (network issues, no transcript, etc.)
			new Notice("Failed to generate YouTube summary. Check developer console.");
			console.error("Insert transcript failed:", error);
		}
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
		summaryLanguage: string,
	): string {
		const trimmedSummary = summaryText.trim();
		const frontmatterMatch = trimmedSummary.match(/^---\n[\s\S]*?\n---\n?/);
		const frontmatter = frontmatterMatch?.[0]?.trim();
		const summaryBody = frontmatter
			? trimmedSummary.slice(frontmatter.length).trim()
			: trimmedSummary;

		const parts: string[] = [];

		if (frontmatter) {
			parts.push(frontmatter, "");
		}

		parts.push(
			`## Summary (${summaryLanguage})`,
			summaryBody,
			"",
			"## Transcript",
			formattedTranscript,
			"",
		);

		return parts.join("\n");
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
