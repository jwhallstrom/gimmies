/**
 * Single Course Data Hook
 * Loads a specific course from DynamoDB by courseId (event-selected).
 */

import { useEffect, useMemo, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { getCourseById, upsertCoursesCache } from '../data/cloudCourses';
import type { CourseData } from './useCourses';

const client = generateClient<Schema>();

export function useCourse(courseId?: string | null) {
  const cached = useMemo(() => getCourseById(courseId), [courseId]);
  const [course, setCourse] = useState<CourseData | undefined>(cached as any);
  const [loading, setLoading] = useState<boolean>(!!courseId && !cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!courseId) {
        setCourse(undefined);
        setLoading(false);
        setError(null);
        return;
      }

      const fromCache = getCourseById(courseId);
      if (fromCache) {
        setCourse(fromCache as any);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        const result: any = await client.models.Course.list({
          authMode: 'apiKey',
          limit: 1,
          filter: {
            courseId: { eq: courseId },
          },
        });

        const item = (result?.data ?? [])[0] as any | undefined;
        if (!item) {
          if (!cancelled) {
            setCourse(undefined);
            setError('Course not found');
          }
          return;
        }

        const parsed: CourseData = {
          id: item.id,
          courseId: item.courseId,
          name: item.name || '',
          location: item.location || '',
          tees: item.teesJson
            ? JSON.parse(item.teesJson as string).map((tee: any) => ({
                ...tee,
                courseRating: tee.rating ?? tee.courseRating ?? null,
                slopeRating: tee.slope ?? tee.slopeRating ?? null,
              }))
            : [],
        };

        upsertCoursesCache([parsed as any]);
        if (!cancelled) {
          setCourse(parsed);
          setError(null);
        }
      } catch (err) {
        console.error('❌ Exception loading course:', err);
        if (!cancelled) {
          setError('Failed to load course');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return {
    course,
    loading,
    error,
  };
}
