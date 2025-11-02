# Photo Storage Architecture - AWS Amplify

## 📸 Where Profile Photos Are Stored

### **Three Storage Options**

---

## **Option 1: Amazon S3 (Recommended for Production)**

### **How It Works:**
```
User uploads photo
    ↓
Uploaded to AWS S3 bucket
    ↓
S3 returns public URL
    ↓
URL saved in user profile
    ↓
Display photo from S3 URL
```

### **Architecture:**
```typescript
// AWS Amplify Storage (S3)
import { uploadData, getUrl } from 'aws-amplify/storage';

// Upload photo
const result = await uploadData({
  key: `profile-photos/${userId}/${Date.now()}.jpg`,
  data: photoFile,
  options: {
    accessLevel: 'public', // or 'private'
    contentType: 'image/jpeg'
  }
}).result;

// Get public URL
const photoUrl = await getUrl({ 
  key: result.key,
  options: { accessLevel: 'public' }
});

// Save URL in profile
await updateProfile({
  avatar: photoUrl.url.toString()
});
```

### **File Structure in S3:**
```
gimmies-golf-bucket/
  └── public/
      └── profile-photos/
          ├── user-abc-123/
          │   ├── 1696435200000.jpg  (original)
          │   └── 1696521600000.jpg  (updated photo)
          ├── user-def-456/
          │   └── 1696435200000.jpg
          └── user-ghi-789/
              └── 1696435200000.jpg
```

### **Profile Data Stored:**
```typescript
// In DynamoDB (from your schema)
{
  profileId: "xyz-789",
  userId: "abc-123-def",
  name: "John Smith",
  avatar: "https://gimmies-golf-bucket.s3.us-east-1.amazonaws.com/public/profile-photos/abc-123-def/1696435200000.jpg"
  //      ↑ S3 URL (permanent link)
}
```

### **Cost:**
- **Storage**: $0.023/GB/month (~$0.02 for 1000 users @ 1MB each)
- **Requests**: $0.005 per 1000 uploads
- **Data Transfer**: $0.09/GB (only when downloading)
- **Free Tier**: 5GB storage + 20,000 GET requests/month (first 12 months)

**Example cost for 100 users:**
- 100 photos × 1MB = 100MB storage = **$0.002/month**
- Essentially FREE!

---

## **Option 2: Base64 Encoding (Simple, No AWS Storage)**

### **How It Works:**
```
User uploads photo
    ↓
Convert to Base64 string
    ↓
Save Base64 string directly in DynamoDB
    ↓
Display using data URL
```

### **Code Example:**
```typescript
// Upload and convert to Base64
const handlePhotoUpload = async (file: File) => {
  const reader = new FileReader();
  reader.onloadend = () => {
    const base64String = reader.result as string;
    
    // Save directly in profile
    updateProfile({
      avatar: base64String // "data:image/jpeg;base64,/9j/4AAQ..."
    });
  };
  reader.readAsDataURL(file);
};

// Display
<img src={profile.avatar} alt="Profile" />
```

### **Profile Data:**
```typescript
{
  profileId: "xyz-789",
  userId: "abc-123-def",
  name: "John Smith",
  avatar: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQ..."
  //      ↑ Base64 string (stored in DynamoDB)
}
```

### **Pros:**
- ✅ Simple implementation
- ✅ No extra AWS service needed
- ✅ Works offline (local storage)
- ✅ No separate API calls

### **Cons:**
- ❌ Large database records (1MB photo = 1.3MB Base64)
- ❌ Slower queries (more data to transfer)
- ❌ DynamoDB charges for data size
- ❌ 400KB limit per item (need to resize photos)

### **Cost:**
- **DynamoDB Storage**: $0.25/GB/month
- **DynamoDB Read/Write**: $1.25/million writes, $0.25/million reads
- **Example**: 100 users × 100KB (resized) = 10MB = **$0.0025/month**

---

## **Option 3: Hybrid (Google Photo + Optional Upload)**

### **How It Works:**
```
User signs in with Google
    ↓
Use Google profile photo initially
    ↓
User can optionally upload custom photo to S3
    ↓
Custom photo overrides Google photo
```

### **Code Example:**
```typescript
// After Google OAuth
const profile = {
  userId: user.userId,
  name: "John Smith",
  avatar: user.picture, // Google photo URL initially
  //      "https://lh3.googleusercontent.com/..."
};

// If user uploads custom photo later
const customPhotoUrl = await uploadToS3(photoFile);
updateProfile({
  avatar: customPhotoUrl, // Now uses S3 URL
  googlePhotoBackup: user.picture // Keep Google photo as fallback
});
```

### **Pros:**
- ✅ Free initial photo (from Google)
- ✅ No upload needed for most users
- ✅ Can customize if wanted
- ✅ Fallback to Google photo if upload fails

---

## **📊 Comparison Table**

| Feature | S3 (Recommended) | Base64 (Simple) | Hybrid (Best UX) |
|---------|-----------------|----------------|------------------|
| **Setup Complexity** | Medium | Easy | Medium |
| **Storage Cost** | $0.02/1000 photos | $2.50/1000 photos | $0.02/1000 photos |
| **Speed** | Fast (CDN) | Slow (large data) | Fast (CDN) |
| **Offline Support** | ❌ Need download | ✅ In local DB | Partial |
| **Photo Size Limit** | 5MB+ | 100KB (DynamoDB limit) | 5MB+ |
| **Google Photo Support** | ❌ | ❌ | ✅ Free! |

---

## **🎯 Recommended Architecture**

### **Best Approach: Hybrid S3 + Google Photos**

```typescript
// amplify/storage/resource.ts
import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'gimmiesGolfPhotos',
  access: (allow) => ({
    'profile-photos/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read'])
    ],
  })
});
```

### **Profile Photo Priority:**
```typescript
const getProfilePhoto = (profile: Profile) => {
  // 1. Custom uploaded photo (S3)
  if (profile.avatar?.startsWith('https://')) {
    return profile.avatar;
  }
  
  // 2. Google profile photo (free)
  if (profile.googlePhotoUrl) {
    return profile.googlePhotoUrl;
  }
  
  // 3. Default placeholder
  return '/default-avatar.png';
};
```

---

## **💾 Complete Data Flow**

### **Scenario 1: Google Sign-In (No Upload)**
```
1. User signs in with Google
   ↓
2. Google provides photo URL:
   "https://lh3.googleusercontent.com/a/..."
   ↓
3. Save in profile:
   {
     avatar: null,
     googlePhotoUrl: "https://lh3.googleusercontent.com/..."
   }
   ↓
4. Display Google photo (FREE!)
```

### **Scenario 2: User Uploads Custom Photo**
```
1. User clicks "Upload Photo"
   ↓
2. Select file from device
   ↓
3. Upload to S3:
   uploadData({
     key: 'profile-photos/abc-123/photo.jpg',
     data: file
   })
   ↓
4. S3 returns URL:
   "https://gimmies-golf.s3.amazonaws.com/..."
   ↓
5. Update profile:
   {
     avatar: "https://gimmies-golf.s3.amazonaws.com/...",
     googlePhotoUrl: "https://lh3.googleusercontent.com/..." // backup
   }
   ↓
6. Display S3 photo (custom)
```

### **Scenario 3: Delete Custom Photo**
```
1. User deletes custom photo
   ↓
2. Remove from S3:
   remove({ key: 'profile-photos/abc-123/photo.jpg' })
   ↓
3. Update profile:
   {
     avatar: null,
     googlePhotoUrl: "https://lh3.googleusercontent.com/..."
   }
   ↓
4. Fall back to Google photo
```

---

## **🔐 Security & Permissions**

### **S3 Access Levels:**

**Public Access (Recommended for Profile Photos):**
```typescript
// Anyone can view, only owner can write
uploadData({
  key: `profile-photos/${userId}/photo.jpg`,
  data: file,
  options: { accessLevel: 'public' }
});
```

**Private Access (For Sensitive Photos):**
```typescript
// Only authenticated user can view/write
uploadData({
  key: `private-photos/${userId}/photo.jpg`,
  data: file,
  options: { accessLevel: 'private' }
});
```

### **File Validation:**
```typescript
const validatePhoto = (file: File) => {
  // Check file type
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images allowed');
  }
  
  // Check file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Photo must be less than 5MB');
  }
  
  return true;
};
```

---

## **🎨 Image Optimization**

### **Client-Side Resize Before Upload:**
```typescript
import imageCompression from 'browser-image-compression';

const optimizePhoto = async (file: File) => {
  const options = {
    maxSizeMB: 0.5,          // 500KB max
    maxWidthOrHeight: 400,   // 400px max dimension
    useWebWorker: true
  };
  
  const compressedFile = await imageCompression(file, options);
  return compressedFile;
};

// Then upload
const optimized = await optimizePhoto(originalFile);
await uploadToS3(optimized);
```

**Benefits:**
- ✅ Faster uploads
- ✅ Lower storage costs
- ✅ Faster page loads
- ✅ Better mobile experience

---

## **💰 Cost Breakdown (100 Active Users)**

### **Hybrid Approach:**
```
Google Photos (70% of users):
  70 users × $0 = $0

S3 Custom Photos (30% of users):
  30 photos × 500KB × $0.023/GB = $0.0003/month
  30 uploads × $0.005/1000 = $0.0002/month
  
Total: ~$0.0005/month = FREE (within free tier)
```

### **Pure S3 Approach:**
```
100 photos × 500KB × $0.023/GB = $0.0012/month
100 uploads × $0.005/1000 = $0.0005/month

Total: ~$0.002/month = Nearly FREE
```

---

## **🚀 My Recommendation**

**Use Hybrid S3 + Google Photos:**

1. ✅ **Default**: Use Google profile photo (free, instant)
2. ✅ **Option**: Allow users to upload custom photo to S3
3. ✅ **Fallback**: Keep Google photo as backup
4. ✅ **Optimize**: Resize photos to 400px before upload
5. ✅ **Storage**: Use S3 public access for profile photos

**This gives you:**
- 💰 Lowest cost (most users use free Google photos)
- ⚡ Fastest signup (no upload needed)
- 🎨 Customization (can upload custom photo)
- 🔒 Secure (AWS S3 + CloudFront CDN)
- 📱 Mobile-friendly (small file sizes)

---

**Want me to set up the S3 storage configuration in your Amplify backend?** 📸⛳
