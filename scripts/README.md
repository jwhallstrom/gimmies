# Course Data Import

## Overview
This script imports golf course data from CSV files into DynamoDB for use in the Gimmies Golf app.

## Prerequisites
- AWS Amplify backend deployed (production or sandbox)
- `Courses.csv` and `tees.csv` files in project root

## Usage

### Step 1: Get Updated Course Data
1. Place your updated `Courses.csv` in the project root
2. Place your updated `tees.csv` in the project root

### Step 2: Run Import

**Test Mode (First 100 courses - Recommended for initial testing):**
```bash
npm run import-courses
```

**Full Import (All 17K+ courses):**
```bash
IMPORT_LIMIT=99999 npm run import-courses
```

**Custom limit:**
```bash
IMPORT_LIMIT=500 npm run import-courses
```

The script will:
- Read both CSV files
- Parse course and tee data
- Upload/update courses in DynamoDB
- Show progress every 100 courses
- Display final statistics

### Expected Output (Test Mode)
```
📚 Starting course data import...
🧪 TEST MODE: Importing first 100 courses (set IMPORT_LIMIT=99999 for full import)
📊 Found 100 courses and 428 tee sets
✅ Imported 100/100 courses...
🎉 Import complete!
✅ Successfully imported: 100 courses
❌ Errors: 0 courses
```

### Expected Output (Full Import)
```
📚 Starting course data import...
📊 Found 17750 courses and 75894 tee sets
✅ Imported 100/17750 courses...
✅ Imported 200/17750 courses...
...
🎉 Import complete!
✅ Successfully imported: 17750 courses
❌ Errors: 0 courses
```

## Data Format

### Courses.csv
Required columns:
- `course_token` - Unique identifier
- `course_title` - Display name
- `city`, `state`, `country` - Location info

### tees.csv
Required columns:
- `course_token` - Links to course
- `tee_title` - Tee name (Blue, White, etc.)
- `course_par` - Total par
- `rating` - Course rating
- `slope` - Slope rating
- `hole1_par` through `hole18_par` - Par for each hole
- `hole1_handicap` through `hole18_handicap` - Stroke index

## Notes
- **Default: First 100 courses** - Safe for testing, won't overwhelm DynamoDB
- **Full import** - Use `IMPORT_LIMIT=99999` when ready for production
- The script can be re-run safely - it will update existing courses (no duplicates)
- Courses with invalid data will be skipped and logged
- Full import may take 10-15 minutes for 17K+ courses due to DynamoDB rate limits

## Troubleshooting

### "Cannot find module" error
Make sure dependencies are installed:
```bash
npm install
```

### "Amplify not configured" error
Ensure `amplify_outputs.json` exists and backend is deployed:
```bash
npx ampx sandbox  # for development
# or
npx ampx deploy   # for production
```

### Import is slow
This is normal! DynamoDB has rate limits. The script shows progress every 100 courses.
