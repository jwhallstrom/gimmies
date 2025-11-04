import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import amplifyConfig from '../amplify_outputs.json';

// Configure Amplify
Amplify.configure(amplifyConfig);

// Create client with API Key auth (same as import script)
const client = generateClient<Schema>({
  authMode: 'apiKey'
});

async function checkCourses() {
  console.log('🔍 Checking courses in DynamoDB...\n');
  
  try {
    const { data: courses, errors } = await client.models.Course.list({
      authMode: 'apiKey'
    });
    
    if (errors) {
      console.error('❌ Errors fetching courses:', errors);
      return;
    }
    
    console.log(`✅ Found ${courses.length} courses in DynamoDB\n`);
    
    if (courses.length > 0) {
      console.log('📋 First 5 courses:');
      courses.slice(0, 5).forEach((course, i) => {
        console.log(`  ${i + 1}. ${course.name} (${course.location})`);
        console.log(`     ID: ${course.id}`);
        console.log(`     teesJson type: ${typeof course.teesJson}`);
        console.log(`     teesJson value:`, course.teesJson);
        
        // Try to parse if it's a string
        let teesCount = 0;
        if (typeof course.teesJson === 'string') {
          try {
            const tees = JSON.parse(course.teesJson);
            teesCount = Array.isArray(tees) ? tees.length : 0;
          } catch (e) {
            console.log(`     ⚠️ Error parsing teesJson:`, e);
          }
        } else if (Array.isArray(course.teesJson)) {
          teesCount = course.teesJson.length;
        }
        
        console.log(`     Tees: ${teesCount}\n`);
      });
    } else {
      console.log('⚠️  No courses found in DynamoDB!');
      console.log('   Run: npm run import-courses');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCourses().catch(console.error);
