/**
 * Course Data Import Script
 * 
 * Usage: npm run import-courses
 * 
 * Reads Courses.csv and tees.csv from project root and uploads to DynamoDB.
 * Can be re-run to update course data (upserts existing courses).
 */

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

// You'll need to configure Amplify first
import { Amplify } from 'aws-amplify';
import amplifyConfig from '../amplify_outputs.json';

// Configure Amplify for server-side operations
Amplify.configure(amplifyConfig);

const client = generateClient<Schema>({
  authMode: 'apiKey'
});

interface CourseRow {
  course_id: string;
  course_token: string;
  course_title: string;
  course_description: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  longitude: string;
  latitude: string;
}

interface TeeRow {
  tee_id: string;
  tee_token: string;
  course_token: string;
  tee_title: string;
  course_par: string;
  rating: string;
  slope: string;
  hole1_par: string;
  hole2_par: string;
  hole3_par: string;
  hole4_par: string;
  hole5_par: string;
  hole6_par: string;
  hole7_par: string;
  hole8_par: string;
  hole9_par: string;
  hole10_par: string;
  hole11_par: string;
  hole12_par: string;
  hole13_par: string;
  hole14_par: string;
  hole15_par: string;
  hole16_par: string;
  hole17_par: string;
  hole18_par: string;
  hole1_handicap: string;
  hole2_handicap: string;
  hole3_handicap: string;
  hole4_handicap: string;
  hole5_handicap: string;
  hole6_handicap: string;
  hole7_handicap: string;
  hole8_handicap: string;
  hole9_handicap: string;
  hole10_handicap: string;
  hole11_handicap: string;
  hole12_handicap: string;
  hole13_handicap: string;
  hole14_handicap: string;
  hole15_handicap: string;
  hole16_handicap: string;
  hole17_handicap: string;
  hole18_handicap: string;
}

async function importCourses() {
  console.log('📚 Starting course data import...');
  
  // Configuration
  const LIMIT = process.env.IMPORT_LIMIT ? parseInt(process.env.IMPORT_LIMIT) : 100; // Default to 100 for testing
  const IS_TEST = LIMIT < 1000;
  
  // Read CSV files
  const coursesData = readFileSync('Courses.csv', 'utf-8');
  const teesData = readFileSync('tees.csv', 'utf-8');
  
  const allCourses: CourseRow[] = parse(coursesData, { columns: true, skip_empty_lines: true });
  const allTees: TeeRow[] = parse(teesData, { columns: true, skip_empty_lines: true });
  
  // Limit courses for testing (can be overridden with IMPORT_LIMIT env var)
  const courses = IS_TEST ? allCourses.slice(0, LIMIT) : allCourses;
  const courseTokens = new Set(courses.map(c => c.course_token));
  const tees = allTees.filter(t => courseTokens.has(t.course_token));
  
  if (IS_TEST) {
    console.log(`🧪 TEST MODE: Importing first ${LIMIT} courses (set IMPORT_LIMIT=99999 for full import)`);
  }
  console.log(`📊 Found ${courses.length} courses and ${tees.length} tee sets`);
  
  // Group tees by course token
  const teesByCourse = new Map<string, TeeRow[]>();
  tees.forEach(tee => {
    if (!teesByCourse.has(tee.course_token)) {
      teesByCourse.set(tee.course_token, []);
    }
    teesByCourse.get(tee.course_token)!.push(tee);
  });
  
  // Import courses with their tees
  let imported = 0;
  let errors = 0;
  
  for (const course of courses) {
    try {
      const courseTees = teesByCourse.get(course.course_token) || [];
      
      // Convert tees to our format
      const teesJson = courseTees.map(tee => {
        // Parse holes (skip holes with ~ or N/D values)
        const holes = [];
        for (let i = 1; i <= 18; i++) {
          const par = (tee as any)[`hole${i}_par`];
          const handicap = (tee as any)[`hole${i}_handicap`];
          
          if (par && par !== '~' && par !== 'N/D') {
            holes.push({
              number: i,
              par: parseInt(par),
              strokeIndex: handicap && handicap !== '~' ? parseInt(handicap) : i
            });
          }
        }
        
        return {
          name: tee.tee_title,
          par: tee.course_par !== 'N/D' ? parseInt(tee.course_par) : holes.reduce((sum, h) => sum + h.par, 0),
          rating: tee.rating !== 'N/D' ? parseFloat(tee.rating) : null,
          slope: tee.slope !== 'N/D' ? parseInt(tee.slope) : null,
          holes
        };
      });
      
      // Create/update course in DynamoDB
      await client.models.Course.update({
        id: course.course_token, // Use course_token as the unique ID
        courseId: course.course_token,
        name: course.course_title,
        location: `${course.city}, ${course.state}, ${course.country}`,
        holesJson: JSON.stringify([]), // We'll store holes in tees
        teesJson: JSON.stringify(teesJson),
        isActive: true,
        lastUpdated: new Date().toISOString()
      });
      
      imported++;
      
      if (imported % 100 === 0) {
        console.log(`✅ Imported ${imported}/${courses.length} courses...`);
      }
    } catch (error) {
      console.error(`❌ Error importing course ${course.course_token}:`, error);
      errors++;
    }
  }
  
  console.log(`\n🎉 Import complete!`);
  console.log(`✅ Successfully imported: ${imported} courses`);
  console.log(`❌ Errors: ${errors} courses`);
}

// Run the import
importCourses().catch(console.error);
