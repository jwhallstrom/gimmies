import { describe, it, expect, vi } from 'vitest';

// Mock the game calculators to return deterministic values
vi.mock('../src/games/nassau', () => ({
  computeAllNassau: () => [
    { winningsByGolfer: { a: 5, b: -5 } },
  ]
}));

vi.mock('../src/games/skins', () => ({
  computeSkins: () => ({ winningsByGolfer: { a: 2 } })
}));

vi.mock('../src/games/pinky', () => ({
  computeAllPinky: () => [
    { owingsByGolfer: { a: -1, b: 1 } },
  ]
}));

vi.mock('../src/games/greenie', () => ({
  computeAllGreenie: () => [
    { owingsByGolfer: { b: 3 } },
  ]
}));

import { calculateEventPayouts } from '../src/games/payouts';

describe('calculateEventPayouts', () => {
  it('aggregates winnings/owings across games into totals', () => {
    const event: any = {
      id: 'e1',
      golfers: [ { profileId: 'a' }, { profileId: 'b' } ],
      games: { nassau: [ {} ], skins: [ {} ], pinky: [ {} ], greenie: [ {} ] },
      pinkyResults: {},
      greenieResults: {},
    };
    const profiles: any[] = [];
    const res = calculateEventPayouts(event, profiles);
    // from mocks: a: +5 (nassau) +2 (skins) -1 (pinky) = 6
    // b: -5 (nassau) +0 (skins) +1 (pinky) +3 (greenie) = -1
    expect(res.totalByGolfer).toEqual({ a: 6, b: -1 });
  });
});

