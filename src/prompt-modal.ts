import {
	Modal,
	ButtonComponent,
	TextComponent,
	Setting,
} from "obsidian";

export type PromptModalResult = {
	url: string;
	summaryLanguage: string;
};

export class PromptModal extends Modal {
	private resolve: (value: PromptModalResult) => void;
	private reject: () => void;
	private submitted = false;
	private value: string;
	private initialValue?: string;
	private summaryLanguage = "de";

	constructor(initialValue?: string) {
		super(app);
		this.initialValue = initialValue;
		this.value = initialValue || "";
	}

	onOpen(): void {
		this.titleEl.setText("YouTube URL");
		this.createForm();
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.submitted) {
			this.reject();
		}
	}

	createForm(): void {
		new Setting(this.contentEl)
			.setName("YouTube URL")
			.addText((text) => {
				text.inputEl.style.width = "100%";
				text.setValue(this.value);
				text.onChange((value) => (this.value = value));
				text.inputEl.addEventListener("keydown", (evt: KeyboardEvent) =>
					this.enterCallback(evt),
				);

				if (this.initialValue) {
					text.inputEl.select();
				}

				text.inputEl.focus();
			});

		new Setting(this.contentEl)
			.setName("Summary Language")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("de", "Deutsch")
					.addOption("en", "English")
					.addOption("es", "Español")
					.setValue(this.summaryLanguage)
					.onChange((value) => {
						this.summaryLanguage = value;
					});
			});

		const buttonDiv = this.modalEl.createDiv();
		buttonDiv.addClass("modal-button-container");

		const submitButton = new ButtonComponent(buttonDiv);
		submitButton.buttonEl.addClass("mod-cta");
		submitButton.setButtonText("Submit").onClick((evt: Event) => {
			this.resolveAndClose(evt);
		});
	}

	private enterCallback(evt: KeyboardEvent) {
		if (evt.key === "Enter") {
			this.resolveAndClose(evt);
		}
	}

	private resolveAndClose(evt: Event | KeyboardEvent) {
		this.submitted = true;
		evt.preventDefault();
		this.resolve({
			url: this.value,
			summaryLanguage: this.summaryLanguage,
		});
		this.close();
	}

	async openAndGetValue(
		resolve: (value: PromptModalResult) => void,
		reject: () => void,
	): Promise<void> {
		this.resolve = resolve;
		this.reject = reject;
		this.open();
	}
}