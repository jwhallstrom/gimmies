import { describe, it, expect, beforeEach } from 'vitest';
import { setCoursesCache } from '../src/data/cloudCourses';
import {
  calculateCourseHandicap,
  calculateScoreDifferential,
  applyESCAdjustment,
  distributeHandicapStrokes,
  processScores,
  calculateWHSHandicapIndex
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
    // Should average the two lowest (8.2 and 9.9) => 9.05 => 9.1
    expect(calc.handicapIndex).toBeCloseTo(9.1, 1);
  });
});

