// Tasks: things to do across runs, each paid once in coins when a run ends
// with it done. They read the save's record (main.ts keeps it up to date
// before checking them) and the run that just ended.
import { gearStats } from "../game/inventory";
import { RunResult } from "../game/run";
import { SaveData, UPGRADES, packSize } from "../game/save";
import { SLOTS, getItem, isPrize } from "./items";
import { WORLDS } from "./worlds";

export type Task = {
    id: string;
    name: string;
    reward: number;
    done: (save: SaveData, result: RunResult) => boolean;
};

const escapedTier = (save: SaveData, tier: number) =>
    WORLDS.some((w) => w.tier === tier && save.stats.mapsEscaped.includes(w.id));

// Everything worn and packed as a run ended
const carried = (r: RunResult): number[] => [
    ...Object.values(r.carry.equipment).filter((id): id is number => id !== undefined),
    ...r.carry.inventory.map((s) => s.id),
];
const escaped = (r: RunResult) => r.kind === "extracted";
// Out by a way out, on foot: the genie's wish (version 78) doesn't count for
// the tasks about how a run went, which it would make free
const walkedOut = (r: RunResult) => escaped(r) && !r.report.genie;

export const TASKS: Task[] = [
    { id: "first_escape", name: "Out alive: escape from any map", reward: 100, done: (s) => s.stats.extractions >= 1 },
    {
        id: "wise_old_man",
        name: "Lumbridge's own: kill the Wise Old Man",
        reward: 200,
        done: (s) => s.stats.bossesBeaten.includes("lumbridge"),
    },
    { id: "hundred", name: "A hundred down: kill 100 enemies", reward: 250, done: (s) => s.stats.kills >= 100 },
    { id: "champion", name: "Giant killer: kill a champion", reward: 150, done: (s) => s.stats.championKills >= 1 },
    {
        id: "quick",
        name: "Light feet: escape within six minutes",
        reward: 150,
        done: (s) => s.stats.fastestEscape > 0 && s.stats.fastestEscape <= 360,
    },
    {
        id: "unfed",
        name: "Iron stomach: escape without eating",
        reward: 200,
        done: (_, r) => walkedOut(r) && r.report.ate === 0,
    },
    {
        id: "hoarder",
        name: "Hoarder: escape with ten or more things in the pack",
        reward: 300,
        done: (_, r) => r.kind === "extracted" && r.report.packItems >= 10,
    },
    { id: "sharpshooter", name: "Sharpshooter: kill 20 enemies with a bow or staff", reward: 200, done: (s) => s.stats.rangedKills >= 20 },
    { id: "tier2", name: "Two stars: escape from a two star map", reward: 300, done: (s) => escapedTier(s, 2) },
    { id: "tier3", name: "Three stars: escape from a three star map", reward: 600, done: (s) => escapedTier(s, 3) },
    { id: "tier4", name: "Four stars: escape from a four star map", reward: 1200, done: (s) => escapedTier(s, 4) },
    { id: "tier5", name: "Five stars: escape from a five star map", reward: 2500, done: (s) => escapedTier(s, 5) },
    { id: "bosses", name: "Boss slayer: kill five bosses", reward: 500, done: (s) => s.stats.bossKills >= 5 },
    { id: "rich", name: "Well off: have 5,000 coins banked", reward: 300, done: (s) => s.coins >= 5000 },
    { id: "tour", name: "World tour: escape from six different maps", reward: 1500, done: (s) => s.stats.mapsEscaped.length >= 6 },
    { id: "clue", name: "Treasure hunter: dig up a clue scroll's casket", reward: 250, done: (s) => s.stats.clues >= 1 },
    { id: "grave", name: "Second chances: take back what you left at a gravestone", reward: 200, done: (s) => s.stats.graves >= 1 },
    { id: "pet", name: "Best friend: a boss drops a pet", reward: 400, done: (s) => s.pets.length >= 1 },
    { id: "night", name: "Night owl: escape from a map at night", reward: 300, done: (_, r) => r.kind === "extracted" && r.report.night },
    { id: "vault", name: "Vault breaker: unlock a map's vault", reward: 350, done: (s) => s.stats.vaults >= 1 },
    // Forty more (version 75): longer roads, and things a single run can do
    { id: "five_hundred", name: "Five hundred down: kill 500 enemies", reward: 800, done: (s) => s.stats.kills >= 500 },
    { id: "thousand", name: "A thousand down: kill 1,000 enemies", reward: 2000, done: (s) => s.stats.kills >= 1000 },
    { id: "marksman", name: "Marksman: kill 100 enemies with a bow or staff", reward: 600, done: (s) => s.stats.rangedKills >= 100 },
    { id: "bosses10", name: "Boss hunter: kill ten bosses", reward: 1200, done: (s) => s.stats.bossKills >= 10 },
    { id: "bosses25", name: "Boss bane: kill twenty-five bosses", reward: 3000, done: (s) => s.stats.bossKills >= 25 },
    { id: "champions10", name: "Champion hunter: kill ten champions", reward: 600, done: (s) => s.stats.championKills >= 10 },
    { id: "escapes5", name: "Getting the hang of it: escape five times", reward: 200, done: (s) => s.stats.extractions >= 5 },
    { id: "escapes20", name: "Old hand: escape twenty times", reward: 800, done: (s) => s.stats.extractions >= 20 },
    { id: "escapes50", name: "Escape artist: escape fifty times", reward: 2500, done: (s) => s.stats.extractions >= 50 },
    { id: "runs100", name: "Veteran: go on a hundred runs", reward: 1500, done: (s) => s.stats.runs >= 100 },
    { id: "deaths5", name: "Learning the hard way: die five times", reward: 150, done: (s) => s.stats.deaths >= 5 },
    {
        id: "quicker",
        name: "Lightning feet: escape within four minutes",
        reward: 400,
        done: (s) => s.stats.fastestEscape > 0 && s.stats.fastestEscape <= 240,
    },
    { id: "haul1k", name: "Good haul: carry 1,000 coins out of a run", reward: 300, done: (s) => s.stats.bestHaul >= 1000 },
    { id: "haul10k", name: "Fortune: carry 10,000 coins out of a run", reward: 2000, done: (s) => s.stats.bestHaul >= 10000 },
    { id: "rich50k", name: "Moneybags: have 50,000 coins banked", reward: 1500, done: (s) => s.coins >= 50000 },
    { id: "rich250k", name: "Tycoon: have 250,000 coins banked", reward: 5000, done: (s) => s.coins >= 250000 },
    { id: "clues5", name: "Detective: dig up five clue caskets", reward: 800, done: (s) => s.stats.clues >= 5 },
    { id: "vaults5", name: "Vault regular: unlock five vaults", reward: 1200, done: (s) => s.stats.vaults >= 5 },
    { id: "pets3", name: "Menagerie: find three pets", reward: 1200, done: (s) => s.pets.length >= 3 },
    { id: "pets_all", name: "Zookeeper: find every boss's pet", reward: 6000, done: (s) => s.pets.length >= WORLDS.length },
    { id: "tour_all", name: "Globetrotter: escape from every map", reward: 5000, done: (s) => s.stats.mapsEscaped.length >= WORLDS.length },
    { id: "conqueror", name: "Conqueror: beat every map", reward: 8000, done: (s) => s.stats.mapsBeaten.length >= WORLDS.length },
    {
        id: "upgrade",
        name: "Guild patron: buy a guild upgrade",
        reward: 300,
        done: (s) => Object.values(s.upgrades).some((level) => level > 0),
    },
    {
        id: "upgrades_all",
        name: "Guild master: buy every guild upgrade to the top",
        reward: 4000,
        done: (s) => (Object.keys(UPGRADES) as (keyof typeof UPGRADES)[]).every((key) => s.upgrades[key] >= UPGRADES[key].costs.length),
    },
    {
        id: "full_pack",
        name: "Not a slot to spare: escape with the pack full",
        reward: 500,
        done: (s, r) => escaped(r) && r.report.packItems >= packSize(s),
    },
    {
        id: "dressed",
        name: "Dressed for it: escape wearing something in every slot but the shield",
        reward: 400,
        done: (_, r) => escaped(r) && SLOTS.every((slot) => slot === "shield" || r.carry.equipment[slot] !== undefined),
    },
    {
        id: "barrows",
        name: "Brother in arms: escape wearing a full Barrows set",
        reward: 1500,
        done: (_, r) => escaped(r) && gearStats(r.carry.equipment).set !== undefined,
    },
    {
        id: "prize",
        name: "Prize fighter: escape with a tier's prize piece worn or packed",
        reward: 800,
        done: (_, r) => escaped(r) && carried(r).some((id) => isPrize(id)),
    },
    {
        id: "five_star_gear",
        name: "Top shelf: escape wearing a five star piece",
        reward: 1000,
        done: (_, r) => escaped(r) && Object.values(r.carry.equipment).some((id) => id !== undefined && getItem(id).tier >= 5),
    },
    { id: "pacifist", name: "Pacifist: escape without killing anything", reward: 400, done: (_, r) => walkedOut(r) && r.report.kills === 0 },
    { id: "untouched", name: "Untouchable: escape without taking a single hit", reward: 1000, done: (_, r) => walkedOut(r) && r.report.hitsTaken === 0 },
    { id: "night_boss", name: "Things that go bump: kill a boss at night", reward: 500, done: (_, r) => r.report.night && r.report.bossKills > 0 },
    { id: "raider", name: "Chest raider: open ten chests in one run", reward: 400, done: (_, r) => r.report.chestsOpened >= 10 },
    { id: "golden", name: "Golden touch: open the boss's golden chest", reward: 600, done: (_, r) => r.report.goldenOpened },
    { id: "specials", name: "Special delivery: use a special attack five times in one run", reward: 300, done: (_, r) => r.report.specials >= 5 },
    { id: "trader", name: "Regular customer: buy something from the wandering trader", reward: 150, done: (_, r) => r.report.traderBuys >= 1 },
    { id: "genie", name: "Three wishes: pay the genie for the way out", reward: 300, done: (_, r) => escaped(r) && r.report.genie },
    {
        id: "last_orders",
        name: "Last orders: escape with under a minute before the ways out close",
        reward: 600,
        done: (_, r) => walkedOut(r) && r.report.secondsLeft < 60,
    },
    { id: "team", name: "Team player: escape from a co-op run", reward: 300, done: (_, r) => escaped(r) && r.report.party >= 2 },
    { id: "full_party", name: "Full house: escape with a party of four", reward: 1000, done: (_, r) => escaped(r) && r.report.party >= 4 },
];
