/**
 * Course Data Hook
 * Loads courses from DynamoDB with search and favorites
 */

import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { setCoursesCache } from '../data/cloudCourses';
import { courses as localCourses, courseTeesMap } from '../data/courses';

function getLocalCourses(): CourseData[] {
  return (localCourses || []).map((course) => {
    const teesDef = courseTeesMap[course.id];
    const holes = (course.holes || []).map((h) => ({
      number: h.number,
      par: h.par,
      strokeIndex: h.strokeIndex,
    }));

    const tees: TeeData[] = (teesDef?.tees || []).map((t) => ({
      name: t.name,
      par: t.par,
      rating: t.courseRating,
      slope: t.slopeRating,
      yardage: t.yardage,
      gender: t.gender,
      courseRating: t.courseRating,
      slopeRating: t.slopeRating,
      holes,
    }));

    return {
      id: course.id,
      courseId: course.id,
      name: course.name || '',
      location: '',
      tees,
    };
  });
}

export interface CourseData {
  id: string;
  courseId: string;
  name: string;
  location: string;
  tees: TeeData[];
}

export interface TeeData {
  name: string;
  par: number;
  rating: number | null;
  slope: number | null;
  yardage?: number;
  gender?: string;
  courseRating?: number | null;
  slopeRating?: number | null;
  holes: Array<{
    number: number;
    par: number;
    strokeIndex: number;
  }>;
}

export function useCourses() {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    // Default: run fully locally unless cloud sync is explicitly enabled.
    if (import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'true') {
      const local = getLocalCourses();
      setCourses(local);
      setCoursesCache(local as any);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      console.log('📚 Loading courses from DynamoDB...');

      // Create client lazily so local mode doesn't crash when Amplify isn't configured.
      const client = generateClient<Schema>();

      // Page through the entire dataset to avoid default API limits
      const all: any[] = [];
      let nextToken: string | undefined = undefined;
      let page = 0;
      do {
        page += 1;
        const result: any = await client.models.Course.list({
          authMode: 'apiKey',
          limit: 1000,
          nextToken
        });
        const pageData = (result?.data ?? []) as any[];
        const pageToken = (result?.nextToken ?? (result as any)?.nextToken) as string | undefined;
        all.push(...pageData);
        nextToken = pageToken;
        console.log(`🔎 Loaded page ${page} (${pageData.length} items) nextToken=${!!nextToken}`);
      } while (nextToken);

      // Parse JSON fields and convert to our format
      const parsedCourses: CourseData[] = (all || []).map((course: any) => ({
        id: course.id,
        courseId: course.courseId,
        name: course.name || '',
        location: course.location || '',
        tees: course.teesJson ? JSON.parse(course.teesJson as string).map((tee: any) => ({
          ...tee,
          // Map rating/slope to courseRating/slopeRating for backward compatibility
          courseRating: tee.rating ?? tee.courseRating ?? null,
          slopeRating: tee.slope ?? tee.slopeRating ?? null,
        })) : []
      }));

      console.log(`✅ Loaded ${parsedCourses.length} total courses from DynamoDB`);
      setCourses(parsedCourses);
      // Populate global cache for non-React consumers (e.g., handicap utils)
      setCoursesCache(parsedCourses as any);
      setError(null);
    } catch (err) {
      console.error('❌ Exception loading courses:', err);

      // Fall back to local courses so the app remains usable without AWS.
      const local = getLocalCourses();
      setCourses(local);
      setCoursesCache(local as any);
      setError('Cloud courses unavailable; using local course list');
    } finally {
      setLoading(false);
    }
  };

  const searchCourses = (query: string): CourseData[] => {
    if (!query.trim()) return courses;

    const lowerQuery = query.toLowerCase();
    return courses.filter(course =>
      course.name.toLowerCase().includes(lowerQuery) ||
      course.location.toLowerCase().includes(lowerQuery)
    );
  };

  return {
    courses,
    loading,
    error,
    searchCourses,
    reload: loadCourses
  };
}
