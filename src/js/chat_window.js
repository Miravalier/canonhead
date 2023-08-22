import * as Database from "./database.js";
import * as ContextMenu from "./contextmenu.js";
import { Vector2 } from "./vector.js";
import { ContentWindow, InputDialog } from "./window.js";
import { ApiRequest, Session, HandleWsMessage } from "./requests.js";
import { Parameter, DerivePcgEngine, RandomText, GenerateId } from "./utils.js";
import { ErrorToast } from "./notifications.js";
import { Language } from "./enums.js";


const LANGUAGES = [
    "common",
];


export const COMMANDS = {
    "r": rollCommand,
    "roll": rollCommand,
    "e": emoteCommand,
    "em": emoteCommand,
    "emote": emoteCommand,
    "me": memoteCommand,
    "memote": memoteCommand,
    "o": oocCommand,
    "oc": oocCommand,
    "oo": oocCommand,
    "ooc": oocCommand,
    "n": narrateCommand,
    "na": narrateCommand,
    "nar": narrateCommand,
    "narrate": narrateCommand,
    "narration": narrateCommand,
    "narate": narrateCommand,
    "naratte": narrateCommand,
    "desc": storyCommand,
    "d": storyCommand,
    "story": storyCommand,
    "s": storyCommand,
    "?": helpCommand,
    "help": helpCommand,
    "h": helpCommand,
};


function spongebobCase(s) {
    let capital = true;
    return s.replace(/[a-z]/gi, letter => {
        capital = !capital;
        if (capital) return letter.toUpperCase();
        else return letter.toLowerCase();
    });
}


function getSpeaker() {
    const user = Database.users[Session.id];
    if (user.character) {
        return user.character;
    }
    else {
        return user;
    }
}


function escapeHtml(message) {
    const div = document.createElement("div");
    div.textContent = message;
    return div.innerHTML;
}


function sendSystemMessage(message) {
    HandleWsMessage({
        pool: "messages",
        type: "send",
        id: GenerateId(),
        sender_id: Session.id,
        character_id: null,
        timestamp: parseInt(new Date().getTime() / 1000),
        language: Language.COMMON,
        speaker: "System",
        content: `<div class="system">${message}</div>`,
    });
}


async function helpCommand() {
    sendSystemMessage(`
        <p><b>/?</b> display this help message</p>
        <p><b>/e</b> describe what your character is doing</p>
        <p><b>/o</b> speak out of character</p>
        <p><b>/n</b> like /e, but doesn't put your name at the front</p>
        <p><b>/r</b> roll dice</p>
        <br>
        <p><b>Examples:</b></p>
        <p>/e opens the door</p>
        <p>/n The door opens by itself</p>
        <p>/r 2d6</p>
    `);
}


async function rollCommand(formula) {
    let characterId = null;
    const speaker = getSpeaker();
    if (speaker.type == "character") {
        characterId = speaker.id;
    }
    await ApiRequest("/messages/roll", {
        speaker: speaker.name,
        character_id: characterId,
        formula: formula,
        silent: false,
    });
}


async function memoteCommand(message) {
    const speaker = getSpeaker();
    await ApiRequest("/messages/speak", {
        speaker: Session.username,
        content: `
            <div class="emote">
                <img class="inline-img" src="/spongebob.png" width=36 height=36/>
                ${spongebobCase(speaker.name)} ${spongebobCase(escapeHtml(message))}
            </div>
        `,
    });
}


async function oocCommand(message) {
    await ApiRequest("/messages/speak", {
        speaker: Session.username,
        content: `<div class="ooc">${escapeHtml(message)}</div>`,
    });
}


async function emoteCommand(message) {
    const speaker = getSpeaker();
    await ApiRequest("/messages/speak", {
        speaker: Session.username,
        content: `<div class="emote">${speaker.name} ${escapeHtml(message)}</div>`
    });
}


async function storyCommand(message) {
    await ApiRequest("/messages/speak", {
        speaker: Session.username,
        content: `<div class="story">${escapeHtml(message)}</div>`
    });
}


async function narrateCommand(message) {
    await ApiRequest("/messages/speak", {
        speaker: Session.username,
        content: `<div class="narrate">${escapeHtml(message)}</div>`
    });
}


async function speakCommand(message) {
    let characterId = null;
    const speaker = getSpeaker();
    if (speaker.type == "character") {
        characterId = speaker.id;
    }
    await ApiRequest("/messages/speak", {
        speaker: speaker.name,
        character_id: characterId,
        content: `<div class="speak">${escapeHtml(message)}</div>`,
    });
}


export class ChatWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["chat"];
        options.size = Parameter(options.size, new Vector2(400, 600));
        super(options);
        this.messages = {};
        this.messageContainer = this.content.appendChild(document.createElement("div"));
        this.messageContainer.className = "messages";
        this.inputSection = this.content.appendChild(document.createElement("div"));
        this.inputSection.className = "input-section";
        this.textarea = this.inputSection.appendChild(document.createElement("textarea"));
        this.textarea.maxLength = 10000;

        this.textarea.addEventListener("keypress", async ev => {
            if (ev.key == "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                const content = this.textarea.value.trim();
                this.textarea.value = "";
                if (content) {
                    // Check for a command pattern
                    const CMD_PATTERN = /^\s*\/([a-z0-9?_-]+)\s*/i;
                    let command = null;
                    const message = content.replace(CMD_PATTERN, (_, m) => {
                        command = m;
                        return "";
                    });
                    if (command) {
                        // Dispatch command
                        const commandFunction = COMMANDS[command];
                        if (commandFunction) {
                            await commandFunction(message);
                        }
                        else {
                            ErrorToast(`Unknown command '${command}'`);
                        }
                    }
                    else {
                        await speakCommand(content);
                    }
                }
            }
        });

        if (Session.gm) {
            ContextMenu.set(this.viewPort, {
                "Edit Chat": {
                    "Save": async ev => {
                        const selection = await InputDialog("Save Chat", { "Filename": "text" }, "Save");
                        if (!selection || !selection.Filename) {
                            return;
                        }
                        await ApiRequest("/messages/save", { filename: selection.Filename });
                    },
                    "Clear": async ev => {
                        await ApiRequest("/messages/clear");
                    },
                },
            });
        }
    }

    async load() {
        await super.load();

        await this.subscribe("messages", async data => {
            if (data.type == "send") {
                this.addMessage(data);
            }
            else if (data.type == "edit") {
                const message = this.messages[data.id];
                if (!message) {
                    console.warn(`Received edit for non-existing message id ${data.id}`);
                    return;
                }
                const contentElement = message.querySelector(".text");
                contentElement.innerHTML = data.content;
            }
            else if (data.type == "delete") {
                const message = this.messages[data.id];
                if (!message) {
                    console.error(`Received delete for non-existing message id ${data.id}`);
                    return;
                }
                message.remove();
                delete this.messages[data.id];
            }
            else if (data.type == "clear") {
                this.messages = {};
                this.messageContainer.innerHTML = "";
            }
        });

        const response = await ApiRequest("/messages/recent");
        if (response.status != "success") {
            this.messageContainer.className = "messages-error";
            this.messageContainer.appendChild(document.createTextNode(`Error: Failed to chat messages`));
            return;
        }

        this.setTitle(`Chat`);
        for (const message of response.messages) {
            this.addMessage(message);
        }
    }

    addMessage(message) {
        if (this.messages[message.id]) {
            return null;
        }

        const element = this.messageContainer.appendChild(document.createElement("div"));
        element.className = "message";
        element.dataset.id = message.id;

        if (Session.gm) {
            ContextMenu.set(element, {
                "Edit Message": {
                    "Edit": async ev => {
                        const selection = await InputDialog("Edit Message", { "Content": ["paragraph", message.content] }, "Save");
                        if (!selection || !selection.Content) {
                            return;
                        }

                        message.content = selection.Content;
                        await ApiRequest("/messages/edit", { id: message.id, content: selection.Content });
                    },
                    "Delete": async ev => {
                        await ApiRequest("/messages/delete", { id: message.id });
                    },
                },
            });
        }

        const header = element.appendChild(document.createElement("div"));
        header.className = "header"

        const speaker = header.appendChild(document.createElement("div"));
        speaker.className = "speaker";
        if (message.character_id) {
            speaker.classList.add("character");
        }
        speaker.appendChild(document.createTextNode(message.speaker));

        const messageDate = new Date(message.timestamp * 1000);
        const timestamp = header.appendChild(document.createElement("div"));
        timestamp.className = "timestamp";
        timestamp.appendChild(document.createTextNode(messageDate.toLocaleString()));

        const content = element.appendChild(document.createElement("div"));
        if (message.character_id) {
            content.classList.add("character");
        }
        content.classList.add("text");
        content.classList.add(LANGUAGES[message.language]);
        if (message.content) {
            content.classList.add("spoken");
            content.innerHTML = message.content;
        }
        else {
            const engine = DerivePcgEngine(message.id);
            content.classList.add("foreign");
            content.appendChild(document.createTextNode(
                RandomText(engine, message.length)
            ));
        }

        this.viewPort.scrollTop = this.viewPort.scrollHeight;

        this.messages[message.id] = element;
        return element;
    }
}
