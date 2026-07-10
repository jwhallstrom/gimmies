import { useMemo } from 'react';
import useStore from '../state/store';
import { useCourse } from './useCourse';
import type { CourseStatsPlayer } from '../components/event/CourseStatsPanel';

export function useEventCourseStats(eventId: string) {
  const event = useStore((s) =>
    s.events.find((e) => e.id === eventId) || s.completedEvents.find((e) => e.id === eventId)
  );
  const profiles = useStore((s) => s.profiles);

  const { course: selectedCourse } = useCourse(event?.course?.courseId);
  const selectedTeeName = event?.course?.teeName;
  const selectedTee = selectedCourse?.tees?.find((t: { name: string }) => t.name === selectedTeeName);
  const teeWithHoles = selectedTee || selectedCourse?.tees?.[0];

  const holes = useMemo(() => {
    if (!event) return [];
    return teeWithHoles?.holes?.length
      ? teeWithHoles.holes
      : Array.from({ length: 18 }).map((_, i) => ({
          number: i + 1,
          par: event.course.courseId ? undefined : 4,
        }));
  }, [event?.course?.courseId, teeWithHoles?.holes]);

  const parsKnown = holes.every((h: { par?: number }) => typeof h.par === 'number');

  const holeParByNumber = useMemo(() => {
    const map: Record<number, number> = {};
    if (parsKnown) {
      holes.forEach((h: { number: number; par?: number }) => {
        map[h.number] = h.par as number;
      });
    }
    return map;
  }, [holes, parsKnown]);

  const totalPar = parsKnown
    ? holes.reduce((sum: number, hole: { par?: number }) => sum + (hole.par as number), 0)
    : null;

  const playersWithScores = useMemo((): CourseStatsPlayer[] => {
    if (!event) return [];
    return (event.golfers || [])
      .map((eventGolfer: { profileId?: string; customName?: string; displayName?: string }) => {
        const profile = eventGolfer.profileId
          ? profiles.find((p: { id: string }) => p.id === eventGolfer.profileId)
          : null;
        const name = profile
          ? profile.name
          : eventGolfer.displayName || eventGolfer.customName || 'Unknown';
        const golferId = eventGolfer.profileId || eventGolfer.customName;
        const scorecard = event.scorecards.find(
          (sc: { golferId: string }) => sc.golferId === golferId
        );
        if (!scorecard) return null;

        let totalStrokes = 0;
        let holesPlayed = 0;
        (scorecard.scores || []).forEach((s: { strokes?: number | null }) => {
          if (s.strokes != null) {
            totalStrokes += s.strokes;
            holesPlayed++;
          }
        });
        if (holesPlayed === 0) return null;
        return { name, totalStrokes, holesPlayed };
      })
      .filter(Boolean) as CourseStatsPlayer[];
  }, [event, profiles]);

  const showStatsChip = parsKnown && playersWithScores.length > 0;

  return {
    event,
    holes,
    holeParByNumber,
    totalPar,
    playersWithScores,
    showStatsChip,
    parsKnown,
  };
}
