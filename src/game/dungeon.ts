// A small seeded random number generator, so a run can be replayed from its
// seed. (The generated dungeons this file once held gave way to real OSRS
// regions: see region.ts.)
export type Rng = () => number;

// xorshift32, on a hashed seed: seeds a run apart (a timestamp, say) share
// their high bits, and the raw generator's first draws would share them
// too, so a roll made from the first draw came out the same run after run
export function makeRng(seed: number): Rng {
    let s = seed >>> 0;
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
    s ^= s >>> 16;
    s = s >>> 0 || 1;
    const next = () => {
        s ^= s << 13;
        s >>>= 0;
        s ^= s >> 17;
        s ^= s << 5;
        s >>>= 0;
        return s / 4294967296;
    };
    for (let i = 0; i < 4; i++) {
        next();
    }
    return next;
}
