import { describe, it, expect } from 'vitest';

import { computeNassauForConfig } from '../src/games/nassau';
import { computeSkins } from '../src/games/skins';

describe('gamePreference eligibility', () => {
  it('excludes skins-only golfers from Nassau pot', () => {
    const event: any = {
      id: 'e1',
      course: { courseId: undefined, teeName: undefined },
      golfers: [
        { profileId: 'a', gamePreference: 'all' },
        { profileId: 'b', gamePreference: 'skins' },
      ],
      groups: [{ id: 'g1', golferIds: ['a', 'b'] }],
      scorecards: [
        { golferId: 'a', scores: Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, strokes: 4 })) },
        { golferId: 'b', scores: Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, strokes: 4 })) },
      ],
      games: { nassau: [], skins: [], pinky: [], greenie: [] },
    };

    const cfg: any = {
      id: 'n1',
      groupId: 'g1',
      fee: 5,
      fees: { out: 5, in: 5, total: 5 },
      net: false,
    };

    const res = computeNassauForConfig(event, cfg, []);
    // Only golfer 'a' is eligible => not enough players => no Nassau result.
    expect(res).toBeNull();
  });

  it('includes nassau-only golfers in Nassau but excludes them from Skins', () => {
    const event: any = {
      id: 'e1',
      course: { courseId: undefined, teeName: undefined },
      golfers: [
        { profileId: 'a', gamePreference: 'nassau' },
        { profileId: 'b', gamePreference: 'all' },
      ],
      groups: [{ id: 'g1', golferIds: ['a', 'b'] }],
      scorecards: [
        { golferId: 'a', scores: Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, strokes: 4 })) },
        { golferId: 'b', scores: Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, strokes: 5 })) },
      ],
      games: { nassau: [], skins: [], pinky: [], greenie: [] },
    };

    const nassauCfg: any = {
      id: 'n1',
      groupId: 'g1',
      fee: 1,
      fees: { out: 1, in: 1, total: 1 },
      net: false,
    };
    const nassau = computeNassauForConfig(event, nassauCfg, []);
    // Both 'a' (nassau-only) and 'b' (all) participate => pot = 2 players * (1+1+1) = 6
    expect(nassau?.pot).toBe(6);

    const skinsCfg: any = { id: 's1', fee: 10, net: false, carryovers: false };
    const skins = computeSkins(event, skinsCfg, []);
    // 'a' is nassau-only => excluded from skins => not enough players => null
    expect(skins).toBeNull();
  });
});

