import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	requestUrl,
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
	provider: "ollama" | "openrouter" | "openai";
	model: string;
	availableModels: string[];
	lastModelsByProvider: Record<string, string>;
	ollamaBaseUrl: string;
	openRouterApiKey: string;
	openAIApiKey: string;
	promptFilePath: string;
	outputFolder: string;
	leafUrls: string[];
}

const DEFAULT_SETTINGS: YTranscriptSettings = {
	timestampMod: 5,
	lang: "en",
	country: "EN",
	provider: "ollama",
	model: "qwen2.5:3b",
	availableModels: [],
	lastModelsByProvider: {},
	ollamaBaseUrl: "http://localhost:11434",
	openRouterApiKey: "",
	openAIApiKey: "",
	promptFilePath: "",
	outputFolder: "",
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


		// New mobile-first command
		this.addCommand({
			id: "insert-youtube-transcript",
			name: "YouTube → AI Summary Note",
			callback: async () => {
				let view = this.app.workspace.getActiveViewOfType(MarkdownView);

				// If no active markdown view → create a new note
				if (!view) {
					const outputFolder = this.settings.outputFolder.trim();
					const folderPrefix = outputFolder ? `${outputFolder.replace(/\/$/, "")}/` : "";
					const file = await this.app.vault.create(
						`${folderPrefix}YouTube Transcript ${Date.now()}.md`,
						""
					);

					await this.app.workspace.getLeaf(true).openFile(file);
					view = this.app.workspace.getActiveViewOfType(MarkdownView);
				}

				if (!view) {
					new Notice("No editor available.");
					return;
				}

				await this.insertTranscriptCommand.execute(view.editor);
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
						const previousProvider = this.plugin.settings.provider;
						if (this.plugin.settings.model) {
							this.plugin.settings.lastModelsByProvider[previousProvider] = this.plugin.settings.model;
						}

						this.plugin.settings.provider = value as any;
						this.plugin.settings.availableModels = [];
						this.plugin.settings.model = this.plugin.settings.lastModelsByProvider[value] || "";
						await this.plugin.saveSettings();
						this.display();

						await this.loadAndStoreModels({ silent: true });
						this.display();
					}),
			);

		new Setting(containerEl)
			.setName("Load Models")
			.setDesc("Fetch available models from the selected provider")
			.addButton((button) =>
				button.setButtonText("Load Models").onClick(async () => {
					try {
						await this.loadAndStoreModels({ silent: false });
						this.display();
					} catch (error) {
						console.error("Failed to load models:", error);
						new Notice("Failed to load models. Check developer console.");
					}
				}),
			);

		new Setting(containerEl)
			.setName("Model")
			.setDesc("Select a model. No default is set when provider changes.")
			.addDropdown((dropdown) => {
				// Placeholder option (no model selected)
				dropdown.addOption("", "— Select model —");

				const modelSet = new Set<string>();

				this.plugin.settings.availableModels.forEach((model) => {
					modelSet.add(model);
				});

				Array.from(modelSet)
					.sort((a, b) => a.localeCompare(b))
					.forEach((model) => {
						dropdown.addOption(model, model);
					});

				dropdown
					.setValue(this.plugin.settings.model || "")
					.onChange(async (value) => {
						this.plugin.settings.model = value; // can be empty

						if (value) {
							this.plugin.settings.lastModelsByProvider[this.plugin.settings.provider] = value;
						} else {
							delete this.plugin.settings.lastModelsByProvider[this.plugin.settings.provider];
						}

						await this.plugin.saveSettings();
					});
			});

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
			.setName("Output Folder")
			.setDesc("Vault folder for newly created YouTube summary notes. Leave empty for vault root.")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.outputFolder)
					.setPlaceholder("04_Resources/YouTube")
					.onChange(async (value) => {
						this.plugin.settings.outputFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			);
	}

	private async loadAndStoreModels(options: { silent: boolean }): Promise<void> {
		try {
			if (!options.silent) {
				new Notice("Loading models…");
			}

			const models = await this.loadModelsForCurrentProvider();
			this.plugin.settings.availableModels = models;
			await this.plugin.saveSettings();

			if (!options.silent) {
				new Notice(`Loaded ${models.length} models.`);
			}
		} catch (error) {
			if (!options.silent) {
				throw error;
			}

			console.warn("Auto-loading models failed:", error);
		}
	}

	private async loadModelsForCurrentProvider(): Promise<string[]> {
		switch (this.plugin.settings.provider) {
			case "ollama":
				return this.loadOllamaModels();
			case "openrouter":
				return this.loadOpenRouterModels();
			case "openai":
				return this.loadOpenAIModels();
			default:
				return [];
		}
	}

	private async loadOllamaModels(): Promise<string[]> {
		const baseUrl = this.plugin.settings.ollamaBaseUrl.replace(/\/$/, "");
		const response = await requestUrl({
			url: `${baseUrl}/api/tags`,
			method: "GET",
		});

		const models = response.json?.models || [];
		return models
			.map((model: { name?: string }) => model.name)
			.filter((name: string | undefined): name is string => Boolean(name))
			.sort((a: string, b: string) => a.localeCompare(b));
	}

	private async loadOpenRouterModels(): Promise<string[]> {
		const apiKey = this.plugin.settings.openRouterApiKey.trim();
		if (!apiKey) {
			throw new Error("OpenRouter API key is missing.");
		}

		const response = await requestUrl({
			url: "https://openrouter.ai/api/v1/models",
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		});

		const models = response.json?.data || [];
		return models
			.map((model: { id?: string }) => model.id)
			.filter((id: string | undefined): id is string => Boolean(id))
			.sort((a: string, b: string) => a.localeCompare(b));
	}

	private async loadOpenAIModels(): Promise<string[]> {
		const apiKey = this.plugin.settings.openAIApiKey.trim();
		if (!apiKey) {
			throw new Error("OpenAI API key is missing.");
		}

		const response = await requestUrl({
			url: "https://api.openai.com/v1/models",
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		});

		const models = response.json?.data || [];
		return models
			.map((model: { id?: string }) => model.id)
			.filter((id: string | undefined): id is string => Boolean(id))
			.sort((a: string, b: string) => a.localeCompare(b));
	}
}
