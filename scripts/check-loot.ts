import assert from "node:assert/strict";
import { COINS, getItem, price } from "../src/content/items";
import { LootTracker } from "../src/game/loot";

const loot = new LootTracker();
assert.deepEqual(loot.entries, []);
assert.equal(loot.value, 0);
loot.record(COINS, 81);
loot.record(315, 2);
loot.record(315, 1);
assert.deepEqual(loot.entries, [{ id: COINS, count: 81 }, { id: 315, count: 3 }]);
assert.equal(loot.totalCount, 84);
assert.equal(loot.value, 81 + price(getItem(315)) * 3);
assert.equal(loot.revision, 3);

// Invalid awards must not corrupt a run's totals.
for (const count of [0, -1, NaN, Infinity, 1.5]) loot.record(315, count);
assert.equal(loot.totalCount, 84);
assert.equal(loot.revision, 3);

// Rendering and sorting the rows must not mutate the underlying log.
const rows = loot.entries as { id: number; count: number }[];
rows[0].count = 0;
rows.reverse();
assert.equal(loot.entries[0].count, 81);
assert.deepEqual(new LootTracker().entries, []);
console.log("Loot tracker checks passed.");
