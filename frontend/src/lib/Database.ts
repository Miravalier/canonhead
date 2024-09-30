import { Character, User } from "./Models.ts";
import { ApiRequest, Session, Subscribe } from "./Requests.ts";
import { Bound, RecursiveAssign } from "./Utils.ts";
import { ErrorToast } from "./Notifications.ts";
import { Sleep } from "./Async.ts";

export const users: { [id: string]: User } = {};
export const characters: { [id: string]: Character } = {};


export async function init() {
    const userListResponse = await ApiRequest("/user/list");
    for (let user of userListResponse.users) {
        users[user.id] = user;
    }
    await Subscribe("users", update => {
        if (update.type == "create") {
            users[update.user.id] = update.user;
        }
        else if (update.type == "delete") {
            delete users[update.id];
        }
        else if (update.type == "update") {
            users[update.user.id] = update.user;
        }
    });
}


export async function ResolveCharacter(id: string, cache: boolean = undefined): Promise<Character> {
    if (id === null || typeof id === "undefined") {
        throw Error("null or undefined character id");
    }
    const cachedCharacter = characters[id];
    if (cachedCharacter) {
        return cachedCharacter;
    }

    const response: {
        status: string;
        reason: string;
        character: Character;
    } = await ApiRequest("/character/get", { id });
    if (response.status !== "success") {
        throw Error(response.reason);
    }

    if (cache) {
        characters[id] = response.character;
        await Subscribe(id, update => {
            if (update.type == "update") {
                RecursiveAssign(characters[id], update.changes["$set"]);
            }
            if (update.type == "delete") {
                delete characters[id];
            }
        });
    }

    return response.character;
}


export async function GetSpeaker() {
    const user = users[Session.id];
    if (user.character_id) {
        try {
            return await ResolveCharacter(user.character_id, true);
        } catch {
            return user;
        }
    }
    else {
        return user;
    }
}


export async function ApplyHealing(amount: number) {
    TakeDamage(-amount);
}


export async function TakeDamage(amount: number) {
    let character: Character = null;
    try {
        character = await ResolveCharacter(Session.user.character_id);
    } catch {
        ErrorToast("You are not controlling a character.");
        return;
    }


    await ApiRequest("/character/update", {
        id: character.id,
        changes: {
            "$set": {
                "hp": Bound(0, character.hp - amount, character.max_hp),
            }
        },
    });

    const notifications = document.getElementById("notifications") as HTMLDivElement;
    if (amount > 0) {
        notifications.classList.add("damage");
        await Sleep(500);
        notifications.classList.remove("damage");
    }
    else if (amount < 0) {
        notifications.classList.add("healing");
        await Sleep(500);
        notifications.classList.remove("healing");
    }
}
