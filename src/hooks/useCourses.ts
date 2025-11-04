/**
 * Course Data Hook
 * Loads courses from DynamoDB with search and favorites
 */

import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { setCoursesCache } from '../data/cloudCourses';

const client = generateClient<Schema>();

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
    try {
      setLoading(true);
      console.log('📚 Loading courses from DynamoDB...');

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
      setError('Failed to load courses');
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
