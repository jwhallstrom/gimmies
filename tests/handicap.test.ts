import { describe, it, expect, beforeEach } from 'vitest';
import { setCoursesCache } from '../src/data/cloudCourses';
import {
  calculateCourseHandicap,
  calculateScoreDifferential,
  applyESCAdjustment,
  distributeHandicapStrokes,
  processScores,
  calculateWHSHandicapIndex,
  recomputeRoundDifferential,
} from '../src/utils/handicap';

const courseId = 'test-course';

beforeEach(() => {
  // Seed a simple course with 18 holes, par 4, strokeIndex 1..18
  setCoursesCache([
    {
      id: courseId,
      courseId,
      name: 'Test Course',
      location: 'Nowhere',
      tees: [
        {
          name: 'White',
          par: 72,
          rating: 72,
          slope: 113,
          holes: Array.from({ length: 18 }).map((_, i) => ({
            number: i + 1,
            par: 4,
            strokeIndex: i + 1
          }))
        }
      ]
    }
  ] as any);
});

describe('handicap utils', () => {
  it('calculates course handicap (non-negative)', () => {
    expect(calculateCourseHandicap(12.3, 113, 72, 72)).toBe(12);
    expect(calculateCourseHandicap(0.1, 113, 68, 72)).toBe(0);
  });

  it('calculates score differential (1 decimal)', () => {
    const diff = calculateScoreDifferential(90, 72, 113);
    expect(diff).toBeCloseTo(18.0, 1);
  });

  it('applies ESC adjustment (net double bogey)', () => {
    // par 4, 1 handicap stroke => max 4 + 2 + 1 = 7
    expect(applyESCAdjustment(9, 4, 1)).toBe(7);
    // no handicap strokes => max 6
    expect(applyESCAdjustment(7, 4, 0)).toBe(6);
  });

  it('distributes handicap strokes across holes', () => {
    const dist = distributeHandicapStrokes(20, courseId, 'White');
    // 20 strokes => 1 per hole, +1 on SI 1..2 (remaining 2)
    expect(Object.keys(dist).length).toBe(18);
    expect(dist[1]).toBe(2); // stroke index 1 gets the extra
    expect(dist[2]).toBe(2);
    expect(dist[3]).toBe(1);
    expect(dist[18]).toBe(1);
  });

  it('processes hole scores with net strokes', () => {
    const scores = Array.from({ length: 18 }).map((_, i) => ({ hole: i + 1, strokes: 5 }));
    const out = processScores(scores, courseId, 18, 'White');
    expect(out.length).toBe(18);
    // 18 handicap => 1 stroke per hole => net 4 when gross 5 on par 4
    expect(out[0]).toMatchObject({ hole: 1, par: 4, strokes: 5, handicapStrokes: 1, netStrokes: 4 });
  });

  it('calculates WHS index with varying round counts', () => {
    const diffs = [10.1, 12.4, 11.0, 13.5, 9.9, 8.2, 10.0, 12.0];
    const calc = calculateWHSHandicapIndex(diffs);
    expect(calc.roundsUsed).toBe(2);
    expect(calc.handicapIndex).toBeCloseTo(9.1, 1);
  });

  it('recomputes missing score differentials from hole scores', () => {
    const scores = Array.from({ length: 18 }).map((_, i) => ({
      hole: i + 1,
      par: 4,
      strokes: 5,
      handicapStrokes: 0,
    }));
    const round = recomputeRoundDifferential({
      id: 'r1',
      profileId: 'p1',
      courseId,
      teeName: 'White',
      date: '2026-01-01',
      scores,
      grossScore: 90,
      netScore: 90,
      scoreDifferential: 0,
      courseRating: 0,
      slopeRating: 0,
      courseHandicap: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(round.scoreDifferential).toBeGreaterThan(0);
    expect(round.courseRating).toBe(72);
    expect(round.slopeRating).toBe(113);
  });

  it('uses most recent 20 differentials when 20+ rounds are provided oldest-first', () => {
    // 25 rounds oldest→newest: first 5 are terrible, last 20 are solid ~10
    const entries = [
      ...Array.from({ length: 5 }).map((_, i) => ({ id: `old-${i}`, differential: 40 })),
      ...Array.from({ length: 20 }).map((_, i) => ({ id: `new-${i}`, differential: 10 + (i % 3) * 0.1 })),
    ];
    const calc = calculateWHSHandicapIndex(entries);
    expect(calc.roundsUsed).toBe(8);
    expect(calc.handicapIndex).toBeLessThan(15);
    expect(calc.usedRoundIds.every((id) => id.startsWith('new-'))).toBe(true);
  });
});

describe('mergeIndividualRoundLists', () => {
  it('keeps local-only rounds when cloud list is incomplete', async () => {
    const { mergeIndividualRoundLists } = await import('../src/state/slices/handicapSlice');
    const local = [
      {
        id: 'ir-local-1',
        profileId: 'p1',
        eventId: 'evt-1',
        date: '2026-07-01',
        courseId,
        teeName: 'White',
        grossScore: 88,
        netScore: 80,
        courseHandicap: 8,
        scoreDifferential: 12.1,
        courseRating: 72,
        slopeRating: 113,
        scores: [],
        createdAt: '2026-07-01T12:00:00.000Z',
      },
    ] as any;
    const cloud = [
      {
        id: 'ir-cloud-2',
        profileId: 'p1',
        eventId: 'evt-2',
        date: '2026-06-01',
        courseId,
        teeName: 'White',
        grossScore: 90,
        netScore: 82,
        courseHandicap: 8,
        scoreDifferential: 14.2,
        courseRating: 72,
        slopeRating: 113,
        scores: [],
        createdAt: '2026-06-01T12:00:00.000Z',
      },
    ] as any;

    const merged = mergeIndividualRoundLists(local, cloud);
    expect(merged).toHaveLength(2);
    expect(merged.some((r: any) => r.eventId === 'evt-1')).toBe(true);
    expect(merged.some((r: any) => r.eventId === 'evt-2')).toBe(true);
  });
});

