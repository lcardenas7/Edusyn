import { stableTextHash } from './canonical.js';

export interface DeterministicPrng {
  nextUint32(): number;
  nextFloat(): number;
  nextInt(maxExclusive: number): number;
}

/** xorshift32 with a UTF-16 FNV-1a seed. Algorithm is pinned by engineVersion. */
export function createDeterministicPrng(seed: string): DeterministicPrng {
  let state = Number.parseInt(stableTextHash(seed), 16) >>> 0;
  if (state === 0) state = 0x6d2b79f5;

  const nextUint32 = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };

  return {
    nextUint32,
    nextFloat: () => nextUint32() / 0x1_0000_0000,
    nextInt: (maxExclusive: number) => {
      if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
        throw new Error('maxExclusive must be a positive safe integer.');
      }
      return Math.floor((nextUint32() / 0x1_0000_0000) * maxExclusive);
    },
  };
}
