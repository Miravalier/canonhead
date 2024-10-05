import { CharacterAbility, AbilityType, Ability } from "../../lib/Models.ts";
import { ErrorToast } from "../../lib/Notifications.ts";
import { ApiRequest } from "../../lib/Requests.ts";
import { BaseWindow } from "../../windows/Window.ts";
import { GetAbilityIcons } from "./Utils.ts";

// const playableClasses = ["Assassin", "Bard", "Berserker", "Cleric", "Druid", "Elementalist", "Guardian", "Necromancer"];


// const playableRaces = [
//     "Aarakocra", "Centaur", "Dragonborn", "Dwarf", "Elf",
//     "Gnome", "Goliath", "Halfling", "Human", "Orc", "Satyr",
//     "Tabaxi", "Tiefling", "Triton", "Warforged"
// ];


const classMaxHp = {
    "Assassin": 18,
    "Bard": 20,
    "Berserker": 22,
    "Cleric": 21,
    "Druid": 20,
    "Elementalist": 19,
    "Guardian": 25,
    "Necromancer": 21,
}


const classAttributes = {
    // Classes
    "Assassin": { "agility": 5, "perception": 2, "charisma": -2, "endurance": -2, "strength": -2 },
    "Bard": { "charisma": 5, "memory": 5, "perception": -2, "agility": -1, "endurance": -3, "strength": -3 },
    "Berserker": { "strength": 5, "endurance": 4, "agility": 3, "charisma": -5, "memory": -3, "perception": -3 },
    "Cleric": { "charisma": 4, "endurance": 3, "agility": -2, "perception": -2, "strength": -2 },
    "Druid": { "memory": 4, "perception": 2, "charisma": -2, "agility": -1, "strength": -1, "endurance": -1 },
    "Elementalist": { "memory": 5, "charisma": -1, "strength": -1, "endurance": -1, "agility": -1 },
    "Guardian": { "endurance": 6, "charisma": 1, "agility": -1, "memory": -1, "perception": -2, "strength": -2 },
    "Necromancer": { "memory": 6, "charisma": -5 },
    // Races
    "Aarakocra": { "agility": 3, "perception": 3, "endurance": -2, "memory": -2, "charisma": -1 },
    "Centaur": { "strength": 2, "endurance": 4, "agility": -3, "perception": -2 },
    "Dragonborn": { "strength": 4, "endurance": 2, "agility": -3, "memory": -1, "charisma": -1 },
    "Dwarf": { "endurance": 4, "agility": -2, "perception": -1 },
    "Elf": { "agility": 3, "perception": 2, "memory": 2, "strength": -3, "endurance": -3 },
    "Gnome": { "memory": 6, "charisma": 4, "agility": 1, "strength": -5, "endurance": -5 },
    "Goliath": { "endurance": 6, "strength": 6, "memory": -4, "charisma": -4, "agility": -3 },
    "Halfling": { "agility": 2, "charisma": 2, "strength": -2, "endurance": -1 },
    "Human": {},
    "Orc": { "strength": 2, "agility": 2, "endurance": 2, "memory": -2, "perception": -2, "charisma": -1 },
    "Satyr": { "memory": 4, "agility": 2, "strength": -2, "endurance": -2, "perception": -1 },
    "Tabaxi": { "agility": 6, "perception": 3, "strength": -2, "endurance": -4, "memory": -2 },
    "Tiefling": { "strength": 3, "memory": 3, "charisma": -4, "agility": -1 },
    "Triton": { "perception": 2, "agility": 2, "memory": 2, "strength": -3, "endurance": -2 },
    "Warforged": { "strength": 3, "endurance": 3, "memory": 3, "perception": -4, "charisma": -4 },
};

const classSkills = {
    // Classes
    "Assassin": ["stealth", "melee"],
    "Bard": ["spellwork"],
    "Berserker": ["melee"],
    "Cleric": ["spellwork"],
    "Druid": ["spellwork", "tracking"],
    "Elementalist": ["spellwork"],
    "Guardian": ["melee"],
    "Necromancer": ["spellwork"],
    // Races
    "Aarakocra": ["tracking"],
    "Centaur": ["ranged"],
    "Dragonborn": ["melee"],
    "Dwarf": ["artifice"],
    "Elf": ["ranged", "ranged"],
    "Gnome": ["artifice", "artifice"],
    "Goliath": ["melee"],
    "Halfling": ["stealth", "stealth"],
    "Human": ["artifice"],
    "Orc": ["melee", "melee"],
    "Satyr": ["spellwork"],
    "Tabaxi": ["stealth"],
    "Tiefling": ["spellwork", "spellwork"],
    "Triton": ["tracking"],
    "Warforged": ["melee"],
};

const classDescriptions = {
    // Classes
    "Assassin": "Stealthy, melee, single-target damage dealer",
    "Bard": "Team-oriented with large AoE buffs and debuffs",
    "Berserker": "Frontline brute with risky abilities",
    "Cleric": "Healer and ranged support",
    "Druid": "Shapeshifting jack of all trades",
    "Elementalist": "High-damage ranged powerhouse",
    "Guardian": "Melee tank that keeps allies out of danger",
    "Necromancer": "Undead-summoning ranged support",
    // Races
    "Aarakocra": "Agile and capable of flight",
    "Centaur": "Fast and tough",
    "Dragonborn": "Scaled and breathes fire",
    "Dwarf": "Short and sturdy",
    "Elf": "Agile and perceptive",
    "Gnome": "Small and weak, but intelligent",
    "Goliath": "Massive and strong",
    "Halfling": "Small and unassuming",
    "Human": "Adaptable",
    "Orc": "Athletic and resilient",
    "Satyr": "Intelligent and energetic",
    "Tabaxi": "Nimble feline humanoid",
    "Tiefling": "Cunning half-demon",
    "Triton": "Amphibious with natural electricity",
    "Warforged": "Automaton created by war mages",
};



export function LightbearerCreatorRender(container: HTMLDivElement, data: { window: BaseWindow }) {
    const classSelect = container.querySelector<HTMLSelectElement>(".class");
    const raceSelect = container.querySelector<HTMLSelectElement>(".race");
    const classDescription = container.querySelector<HTMLDivElement>(".class-description");
    const raceDescription = container.querySelector<HTMLDivElement>(".race-description");
    const abilityContainer = container.querySelector<HTMLDivElement>(".abilities");
    const nameInput = container.querySelector<HTMLInputElement>(".characterName");
    const finishButton = container.querySelector<HTMLButtonElement>(".finish");

    let selectedAbilities: CharacterAbility[] = [];
    let racialAbilities: CharacterAbility[] = [];

    const SelectClass = async (className: string) => {
        abilityContainer.innerHTML = "";
        selectedAbilities = [];
        classDescription.innerText = classDescriptions[className];

        const response: {
            status: string,
            name: string,
            parent_id: string,
            subfolders: [string, string][],
            entries: Ability[],
        } = await ApiRequest("/ability/list", { folder_id: className });

        if (response.status !== "success") {
            ErrorToast(`Failed to load class: ${className}`);
            return;
        }

        for (const ability of response.entries) {
            if (ability.name.endsWith("+")) {
                continue;
            }
            const abilityElement = abilityContainer.appendChild(document.createElement("div"));
            abilityElement.className = "ability";
            abilityElement.innerHTML = `
                <div class="bar">
                    <div class="row">
                        <div class="icons">
                            <!-- Rendered by script -->
                        </div>
                        <div class="name">${ability.name}</div>
                    </div>
                </div>
                <div class="details">
                    <div class="description">${ability.description}</div>
                </div>
            `;
            if (ability.type == AbilityType.Passive) {
                abilityElement.querySelector(".name").classList.add("passive");
            }
            abilityElement.querySelector(".icons").innerHTML = GetAbilityIcons(ability);
            abilityElement.addEventListener("click", () => {
                if (abilityElement.classList.contains("selected")) {
                    selectedAbilities.splice(selectedAbilities.indexOf(ability), 1);
                }
                else {
                    if (selectedAbilities.length >= 3) {
                        return;
                    }
                    selectedAbilities.push(ability);
                }
                abilityElement.classList.toggle("selected");
            });
        }
    };

    const SelectRace = async (race: string) => {
        raceDescription.innerText = classDescriptions[race];

        const response: {
            status: string,
            name: string,
            parent_id: string,
            subfolders: [string, string][],
            entries: Ability[],
        } = await ApiRequest("/ability/list", { folder_id: race });

        if (response.status !== "success") {
            ErrorToast(`Failed to load race: ${race}`);
            return;
        }

        racialAbilities = response.entries;
    };

    SelectClass(classSelect.value);
    classSelect?.addEventListener("change", () => {
        SelectClass(classSelect.value);
    });

    SelectRace(raceSelect.value);
    raceSelect?.addEventListener("change", () => {
        SelectRace(raceSelect.value);
    });

    finishButton.addEventListener("click", async () => {
        if (selectedAbilities.length < 3) {
            ErrorToast("You must select 3 abilities");
            return;
        }

        if (!nameInput.value) {
            ErrorToast("You must input a name");
            return;
        }

        selectedAbilities.push(...racialAbilities);

        const abilityMap: { [id: string]: CharacterAbility } = {};
        for (const ability of selectedAbilities) {
            abilityMap[ability.id] = ability;
        }
        const characterInfo = {
            image: `/files/Lightbearer/${classSelect.value}.png`,
            hp: classMaxHp[classSelect.value],
            max_hp: classMaxHp[classSelect.value],
            data: {
                agility: 12,
                charisma: 12,
                endurance: 12,
                memory: 12,
                strength: 12,
                perception: 12,
                artifice: 12,
                spellwork: 12,
                tracking: 12,
                stealth: 12,
                melee: 12,
                ranged: 12,
            },
            ability_order: Object.keys(abilityMap),
            ability_map: abilityMap,
            description: `Race: ${raceSelect.value}\nClass: ${classSelect.value}`,
        };
        for (const [statName, value] of Object.entries(classAttributes[classSelect.value])) {
            characterInfo.data[statName] += value;
        }
        for (const [statName, value] of Object.entries(classAttributes[raceSelect.value])) {
            characterInfo.data[statName] += value;
        }
        for (const skill of classSkills[classSelect.value]) {
            characterInfo.data[skill] += 3;
        }
        for (const skill of classSkills[raceSelect.value]) {
            characterInfo.data[skill] += 3;
        }
        const response: {
            status: string;
            id: string;
        } = await ApiRequest("/character/create", { name: nameInput.value });
        await ApiRequest("/character/update", {
            id: response.id, changes: {
                "$set": characterInfo,
            }
        });

        data.window.close();
    });
}
