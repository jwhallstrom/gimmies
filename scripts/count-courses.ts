import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

interface CourseRow {
  course_token: string;
  course_title: string;
  city: string;
  state: string;
  country: string;
}

// Read and parse CSV
const coursesData = readFileSync('Courses.csv', 'utf-8');
const allCourses: CourseRow[] = parse(coursesData, { columns: true, skip_empty_lines: true });

// Count by state
const FILTER_STATES = process.env.FILTER_STATES?.split(',') || ['Iowa', 'Illinois'];
const filteredCourses = allCourses.filter(c => FILTER_STATES.includes(c.state));

console.log(`\n📊 Course Count:`);
console.log(`   Total courses: ${allCourses.length}`);
console.log(`   ${FILTER_STATES.join(' + ')} courses: ${filteredCourses.length}`);

// Count per state
FILTER_STATES.forEach(state => {
  const count = allCourses.filter(c => c.state === state).length;
  console.log(`   - ${state}: ${count}`);
});

console.log(`\n✅ Ready to import ${filteredCourses.length} courses\n`);
