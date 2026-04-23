import {
	App,
	Editor,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { TranscriptView, TRANSCRIPT_TYPE_VIEW } from "src/transcript-view";
import { PromptModal, type PromptModalResult } from "src/prompt-modal";
import { EditorExtensions } from "../editor-extensions";
import { InsertTranscriptCommand } from "src/commands/insert-transcript";

interface YTranscriptSettings {
	timestampMod: number;
	lang: string;
	country: string;
	summaryLanguage: string;
	provider: "ollama" | "openrouter" | "openai";
	model: string;
	ollamaBaseUrl: string;
	openRouterApiKey: string;
	openAIApiKey: string;
	promptFilePath: string;
	leafUrls: string[];
}

const DEFAULT_SETTINGS: YTranscriptSettings = {
	timestampMod: 5,
	lang: "en",
	country: "EN",
	summaryLanguage: "de",
	provider: "ollama",
	model: "qwen2.5:3b",
	ollamaBaseUrl: "http://localhost:11434",
	openRouterApiKey: "",
	openAIApiKey: "",
	promptFilePath: "",
	leafUrls: [],
};

export default class YTranscriptPlugin extends Plugin {
	settings: YTranscriptSettings;
	private insertTranscriptCommand: InsertTranscriptCommand;

	async onload() {
		await this.loadSettings();

		// Initialize commands
		this.insertTranscriptCommand = new InsertTranscriptCommand(this);

		this.registerView(
			TRANSCRIPT_TYPE_VIEW,
			(leaf) => new TranscriptView(leaf, this),
		);

		this.addCommand({
			id: "transcript-from-text",
			name: "Get YouTube transcript from selected url",
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const url = EditorExtensions.getSelectedText(editor).trim();
				this.openView(url);
			},
		});

		this.addCommand({
			id: "transcript-from-prompt",
			name: "Get YouTube transcript from url prompt",
			callback: async () => {
				const prompt = new PromptModal();
				const result = await new Promise<PromptModalResult>((resolve) =>
					prompt.openAndGetValue(resolve, () => { }),
				);

				if (result?.url) {
					this.openView(result.url, result.summaryLanguage);
				}
			},
		});

		// New mobile-first command
		this.addCommand({
			id: "insert-youtube-transcript",
			name: "Insert YouTube transcript",
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				await this.insertTranscriptCommand.execute(editor);
			},
		});

		this.addSettingTab(new YTranslateSettingTab(this.app, this));
	}

	async openView(url: string, summaryLanguage?: string) {
		const leaf = this.app.workspace.getRightLeaf(false)!;
		await leaf.setViewState({
			type: TRANSCRIPT_TYPE_VIEW,
		});
		this.app.workspace.revealLeaf(leaf);
		leaf.setEphemeralState({
			url,
			summaryLanguage,
		});
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(TRANSCRIPT_TYPE_VIEW);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class YTranslateSettingTab extends PluginSettingTab {
	plugin: YTranscriptPlugin;
	values: Record<string, string>;

	constructor(app: App, plugin: YTranscriptPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Settings for YTranscript" });

		new Setting(containerEl)
			.setName("Timestamp interval")
			.setDesc(
				"Indicates how often timestamp should occur in text (1 - every line, 10 - every 10 lines)",
			)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.timestampMod.toFixed())
					.onChange(async (value) => {
						const v = Number.parseInt(value);
						this.plugin.settings.timestampMod = Number.isNaN(v)
							? 5
							: v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Language")
			.setDesc("Preferred transcript language")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.lang)
					.onChange(async (value) => {
						this.plugin.settings.lang = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Summary Language")
			.setDesc("Default language for summaries")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("de", "Deutsch")
					.addOption("en", "English")
					.addOption("es", "Español")
					.setValue(this.plugin.settings.summaryLanguage)
					.onChange(async (value) => {
						this.plugin.settings.summaryLanguage = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("LLM Provider")
			.setDesc("Select provider for summaries")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("ollama", "Ollama")
					.addOption("openrouter", "OpenRouter")
					.addOption("openai", "OpenAI")
					.setValue(this.plugin.settings.provider)
					.onChange(async (value) => {
						this.plugin.settings.provider = value as any;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Model")
			.setDesc("Model name (depends on provider)")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Ollama Base URL")
			.setDesc("e.g. http://localhost:11434")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.ollamaBaseUrl)
					.onChange(async (value) => {
						this.plugin.settings.ollamaBaseUrl = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("OpenRouter API Key")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.openRouterApiKey)
					.setPlaceholder("sk-...")
					.onChange(async (value) => {
						this.plugin.settings.openRouterApiKey = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("OpenAI API Key")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.openAIApiKey)
					.setPlaceholder("sk-...")
					.onChange(async (value) => {
						this.plugin.settings.openAIApiKey = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Prompt File Path")
			.setDesc("Vault path to a markdown/text prompt template")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.promptFilePath)
					.setPlaceholder("Prompts/youtube-summary.md")
					.onChange(async (value) => {
						this.plugin.settings.promptFilePath = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Country")
			.setDesc("Preferred transcript country code")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.country)
					.onChange(async (value) => {
						this.plugin.settings.country = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
