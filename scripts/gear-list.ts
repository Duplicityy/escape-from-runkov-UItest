// Writes GEAR-LIST.md: every weapon and piece of armour in the game, by
// tier and slot, with the numbers that matter.
//   npx tsx scripts/gear-list.ts GEAR-LIST.md
import { writeFileSync } from "node:fs";
import { AMMO, ITEMS, ItemDef, MATCH_POWER, SLOTS, Slot } from "../src/content/items";

const out = process.argv[2];
const STARS = [0, 1, 2, 3, 4, 5].map((n) => "★".repeat(n));
const SLOT_NAME: Record<Slot, string> = {
    weapon: "Weapons",
    shield: "Shields and off-hands",
    head: "Head",
    body: "Body",
    legs: "Legs",
    feet: "Feet",
    hands: "Hands",
    cape: "Capes",
    neck: "Necklaces and amulets",
    ring: "Rings",
};

const gear = ITEMS.filter((i) => i.slot !== undefined && !i.exclusive);
const kind = (i: ItemDef) => (i.uses === "runes" ? "Magic" : i.ranged || i.uses === "arrows" ? "Ranged" : "Melee");
const ammoWord = (i: ItemDef) => (i.uses ? `Shoots ${i.uses}` : i.ranged ? "Thrown" : "");
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const lines: string[] = [];
lines.push("# Escape from Runkov: every weapon and piece of armour, by tier", "");
lines.push(
    `${gear.length} pieces. A tier is the map stars a piece comes from (and roughly OSRS's wear level: bronze to black is one star, mithril and adamant two, rune three, dragon four, Barrows and beyond five). ` +
        "A weapon's hit is its most; a swing lands 60 to 100% of it. Defence soaks a share of every hit (30 defence a third, 60 half, never more than three quarters). " +
        "Prayer is the OSRS prayer bonus: each point makes the bar drain a thirtieth slower and refill a thirtieth faster. " +
        "A bow or staff hits what its max hit says with the best arrows or runes of its own tier (the ammunition table at the end), more with better and less with worse; a thrown weapon needs no ammunition.",
    "",
);
for (let tier = 1; tier <= 5; tier++) {
    const ofTier = gear.filter((i) => i.tier === tier);
    lines.push(`## Tier ${tier} ${STARS[tier]} (${ofTier.length} pieces)`, "");
    for (const slot of SLOTS) {
        const items = ofTier.filter((i) => i.slot === slot);
        if (items.length === 0) {
            continue;
        }
        lines.push(`### ${SLOT_NAME[slot]} (${items.length})`, "");
        if (slot === "weapon") {
            items.sort((a, b) => (b.damage ?? 0) / (b.speed ?? 1) - (a.damage ?? 0) / (a.speed ?? 1));
            lines.push("| Weapon | Kind | Max hit | Swing (s) | Hit a second | Hands | Ammunition | Prayer |", "|---|---|---:|---:|---:|---|---|---:|");
            for (const i of items) {
                const dps = (i.damage ?? 0) / (i.speed ?? 1);
                lines.push(
                    `| ${i.name} | ${kind(i)} | ${i.damage ?? 0} | ${i.speed ?? 0} | ${dps.toFixed(1)} | ${i.twoHanded ? "Two" : "One"} | ${ammoWord(i)} | ${i.prayer ? "+" + i.prayer : ""} |`,
                );
            }
        } else {
            items.sort((a, b) => (b.defence ?? 0) - (a.defence ?? 0) || (b.hp ?? 0) - (a.hp ?? 0));
            lines.push("| Piece | Defence | Hitpoints | Kind | Prayer |", "|---|---:|---:|---|---:|");
            for (const i of items) {
                lines.push(`| ${i.name} | ${i.defence ?? 0} | ${i.hp ? "+" + i.hp : ""} | ${i.style ? cap(i.style) : ""} | ${i.prayer ? "+" + i.prayer : ""} |`);
            }
        }
        lines.push("");
    }
}
// The ammunition: what each kind does to a shot, by the bow's or staff's tier
lines.push("## Ammunition", "");
lines.push(
    "Each kind has a tier (the maps whose enemies drop it; the shop sells it once a map of that tier is open) and a power. " +
        "A shot hits the weapon's max hit times the kind's power over its own tier's: a ★★★ bow hits its full number with rune arrows, " +
        `${Math.round((0.7 / MATCH_POWER[3]) * 100)}% of it with bronze and ${Math.round((1.45 / MATCH_POWER[3]) * 100)}% with dragon. A bow or staff shoots the best kind in the pack.`,
    "",
);
for (const kindName of ["arrows", "runes"] as const) {
    lines.push(`### ${cap(kindName)}`, "");
    lines.push("| Kind | Tier | Power | On a ★ weapon | On ★★ | On ★★★ | On ★★★★ | On ★★★★★ | Price each |", "|---|---|---:|---:|---:|---:|---:|---:|---:|");
    for (const a of AMMO.filter((i) => i.ammo === kindName)) {
        const on = [1, 2, 3, 4, 5].map((t) => `${Math.round(((a.power ?? 1) / MATCH_POWER[t]) * 100)}%`);
        lines.push(`| ${a.name} | ${STARS[a.tier]} | ${a.power} | ${on.join(" | ")} | ${a.value} |`);
    }
    lines.push("");
}
writeFileSync(out, lines.join("\n"), "utf8");
console.log(`${gear.length} pieces written to ${out}`);

