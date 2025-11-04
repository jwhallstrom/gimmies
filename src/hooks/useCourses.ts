/**
 * Course Data Hook
 * Loads courses from DynamoDB with search and favorites
 */

import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

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
  courseRating?: number;
  slopeRating?: number;
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
      
      const { data: coursesData, errors } = await client.models.Course.list({
        authMode: 'apiKey'
      });

      if (errors) {
        console.error('❌ Error loading courses:', errors);
        setError('Failed to load courses');
        return;
      }

      // Parse JSON fields and convert to our format
      const parsedCourses: CourseData[] = (coursesData || []).map(course => ({
        id: course.id,
        courseId: course.courseId,
        name: course.name || '',
        location: course.location || '',
        tees: course.teesJson ? JSON.parse(course.teesJson as string).map((tee: any) => ({
          ...tee,
          // Map rating/slope to courseRating/slopeRating for backward compatibility
          courseRating: tee.rating ?? tee.courseRating,
          slopeRating: tee.slope ?? tee.slopeRating,
        })) : []
      }));

      console.log(`✅ Loaded ${parsedCourses.length} courses from DynamoDB`);
      setCourses(parsedCourses);
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
