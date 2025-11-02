export type Gender = 'men' | 'women' | 'unisex';

export interface Tee {
  name: string;
  gender: Gender;
  courseRating: number;
  slopeRating: number;
  yardage: number;
  par: number;
}

export interface CourseHole {
  number: number;
  par: number;
  strokeIndex: number; // 1 = hardest
}

export interface CourseDef {
  id: string;
  name: string;
  holes: CourseHole[]; // always 18 for now
}

export interface CourseTees {
  courseId: string;
  courseName: string;
  tees: Tee[];
}

export const davenportCCTees: CourseTees = {
  courseId: 'dcc',
  courseName: 'Davenport Country Club',
  tees: [
    { name: 'Black', gender: 'men', courseRating: 73.3, slopeRating: 133, yardage: 6755, par: 70 },
    { name: 'Blue', gender: 'men', courseRating: 71.7, slopeRating: 130, yardage: 6422, par: 70 },
    { name: 'White', gender: 'men', courseRating: 70.4, slopeRating: 126, yardage: 6136, par: 70 },
    { name: 'White/Silver', gender: 'men', courseRating: 67.8, slopeRating: 121, yardage: 5646, par: 70 },
    { name: 'Silver', gender: 'men', courseRating: 65.8, slopeRating: 116, yardage: 5292, par: 70 },
    { name: 'Silver/Gold (W)', gender: 'women', courseRating: 69.4, slopeRating: 118, yardage: 5087, par: 70 },
    { name: 'Gold (W)', gender: 'women', courseRating: 68.2, slopeRating: 117, yardage: 4867, par: 70 }
  ]
};

export const shortHillsCCTees: CourseTees = {
  courseId: 'shcc',
  courseName: 'Short Hills Country Club',
  tees: [
    { name: 'Blue', gender: 'men', courseRating: 72.5, slopeRating: 125, yardage: 6710, par: 72 },
    { name: 'Blue/White', gender: 'men', courseRating: 70.8, slopeRating: 121, yardage: 6389, par: 72 },
    { name: 'White', gender: 'men', courseRating: 69.7, slopeRating: 116, yardage: 6156, par: 72 },
    { name: 'White/Gold', gender: 'men', courseRating: 67.1, slopeRating: 115, yardage: 5647, par: 72 },
    { name: 'Gold', gender: 'men', courseRating: 65.5, slopeRating: 113, yardage: 5281, par: 72 },
    { name: 'White (W)', gender: 'women', courseRating: 76.1, slopeRating: 134, yardage: 6156, par: 72 },
    { name: 'White/Gold (W)', gender: 'women', courseRating: 73.0, slopeRating: 126, yardage: 5647, par: 72 },
    { name: 'Gold (W)', gender: 'women', courseRating: 70.7, slopeRating: 123, yardage: 5281, par: 72 }
  ]
};

export const courses: CourseDef[] = [
  {
    id: 'dcc',
    name: 'Davenport Country Club',
    holes: [
      { number: 1, par: 4, strokeIndex: 11 },
      { number: 2, par: 5, strokeIndex: 5 },
      { number: 3, par: 4, strokeIndex: 9 },
      { number: 4, par: 4, strokeIndex: 3 },
      { number: 5, par: 3, strokeIndex: 13 },
      { number: 6, par: 4, strokeIndex: 15 },
      { number: 7, par: 4, strokeIndex: 1 },
      { number: 8, par: 3, strokeIndex: 17 },
      { number: 9, par: 5, strokeIndex: 7 },
      { number: 10, par: 3, strokeIndex: 10 },
      { number: 11, par: 4, strokeIndex: 14 },
      { number: 12, par: 4, strokeIndex: 6 },
      { number: 13, par: 5, strokeIndex: 16 },
      { number: 14, par: 4, strokeIndex: 12 },
      { number: 15, par: 3, strokeIndex: 4 },
      { number: 16, par: 4, strokeIndex: 18 },
      { number: 17, par: 3, strokeIndex: 2 },
      { number: 18, par: 4, strokeIndex: 8 }
    ]
  },
  {
    id: 'shcc',
    name: 'Short Hills Country Club',
    holes: [
      { number: 1, par: 4, strokeIndex: 15 },
      { number: 2, par: 4, strokeIndex: 1 },
      { number: 3, par: 4, strokeIndex: 7 },
      { number: 4, par: 5, strokeIndex: 9 },
      { number: 5, par: 3, strokeIndex: 17 },
      { number: 6, par: 4, strokeIndex: 11 },
      { number: 7, par: 3, strokeIndex: 13 },
      { number: 8, par: 4, strokeIndex: 5 },
      { number: 9, par: 5, strokeIndex: 3 },
      { number: 10, par: 4, strokeIndex: 8 },
      { number: 11, par: 3, strokeIndex: 14 },
      { number: 12, par: 4, strokeIndex: 12 },
      { number: 13, par: 5, strokeIndex: 6 },
      { number: 14, par: 3, strokeIndex: 18 },
      { number: 15, par: 4, strokeIndex: 16 },
      { number: 16, par: 4, strokeIndex: 10 },
      { number: 17, par: 5, strokeIndex: 2 },
      { number: 18, par: 4, strokeIndex: 4 }
    ]
  }
];

export const allCourseTees: CourseTees[] = [davenportCCTees, shortHillsCCTees];

export const courseMap: Record<string, CourseDef> = Object.fromEntries(
  courses.map(c => [c.id, c])
);

export const courseTeesMap: Record<string, CourseTees> = Object.fromEntries(
  allCourseTees.map(ct => [ct.courseId, ct])
);