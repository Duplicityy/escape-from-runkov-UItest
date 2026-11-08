import { COINS, getItem, price } from "../content/items";
import type { ItemStack } from "./save";

// A run's collected loot, independent of what is still in the pack. Food
// eaten and gear equipped still belong in the log; carried-in supplies,
// purchases and recovered graves do not. A new Run gets a fresh tracker.
export class LootTracker {
    private readonly collected = new Map<number, number>();
    revision = 0;
    totalCount = 0;
    value = 0;

    get entries(): readonly Readonly<ItemStack>[] {
        return [...this.collected].map(([id, count]) => ({ id, count }));
    }

    record(id: number, count: number): void {
        if (!Number.isSafeInteger(count) || count <= 0) {
            return;
        }
        this.collected.set(id, (this.collected.get(id) ?? 0) + count);
        this.totalCount += count;
        this.value += (id === COINS ? 1 : price(getItem(id))) * count;
        this.revision++;
    }
}
