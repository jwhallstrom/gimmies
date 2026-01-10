// Cloud Courses Access Layer
// Lightweight, non-hook cache so non-React modules (e.g., games/handicap) can read course/tee/holes from DynamoDB data.

export interface CloudHole {
  number: number;
  par: number;
  strokeIndex: number;
}

export interface CloudTee {
  name: string;
  par: number; // total par for 18
  rating?: number | null;
  slope?: number | null;
  courseRating?: number | null; // normalized alias
  slopeRating?: number | null;  // normalized alias
  yardage?: number;
  gender?: string;
  holes: CloudHole[];
}

export interface CloudCourse {
  id: string;
  courseId: string; // stable token used by events
  name: string;
  location: string;
  tees: CloudTee[];
}

let coursesById: Map<string, CloudCourse> = new Map();

export function setCoursesCache(courses: CloudCourse[]): void {
  const next = new Map<string, CloudCourse>();
  for (const c of courses) {
    next.set(c.courseId || c.id, c);
  }
  coursesById = next;
}

export function upsertCoursesCache(courses: CloudCourse[]): void {
  const next = new Map(coursesById);
  for (const c of courses) {
    next.set(c.courseId || c.id, c);
  }
  coursesById = next;
}

export function getCourseById(courseId?: string | null): CloudCourse | undefined {
  if (!courseId) return undefined;
  return coursesById.get(courseId);
}

export function getTee(courseId: string | undefined, teeName: string | undefined): CloudTee | undefined {
  const course = getCourseById(courseId);
  if (!course) return undefined;
  if (!course.tees?.length) return undefined;
  if (teeName) {
    const match = course.tees.find(t => t.name === teeName);
    if (match) return match;
  }
  return course.tees[0];
}

export function getHole(courseId: string | undefined, holeNumber: number, teeName?: string): CloudHole | undefined {
  const tee = getTee(courseId, teeName);
  return tee?.holes?.find(h => h.number === holeNumber);
}
