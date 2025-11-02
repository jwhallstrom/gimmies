# 🚀 AWS Amplify Setup Guide for Gimmies Golf

## ✅ What We've Built So Far

Your app now has:
- ✅ AWS Amplify backend configuration (auth + data)
- ✅ Multi-provider authentication (Email, Google, Apple, Facebook)
- ✅ Beautiful custom login UI with all auth flows
- ✅ GraphQL schema matching your current Dexie structure
- ✅ Auth context for managing user state
- ✅ Demo page to preview the login UI

## 🎨 Preview the Login UI Right Now!

**You can see the login screens immediately without AWS setup:**

1. Make sure your dev server is running:
   ```powershell
   npm run dev
   ```

2. Open your browser to:
   ```
   http://localhost:5173/auth-demo
   ```

3. You'll see the beautiful login UI with:
   - Google Sign-In button (styled)
   - Email/Password form
   - Sign Up flow
   - Password reset
   - Confirmation code entry
   - Guest mode option

**Note**: The buttons won't actually work yet (no AWS backend), but you can see all the UI designs and flows!

---

## 🔧 Next Steps to Connect AWS

### Step 1: Install Amplify CLI Globally

```powershell
npm install -g @aws-amplify/cli
```

### Step 2: Configure AWS Credentials

```powershell
amplify configure
```

This will:
1. Open AWS Console in your browser
2. Prompt you to create an IAM user
3. Save AWS credentials locally

**Detailed steps**:
- Sign in to your AWS account
- Create a new IAM user with `AdministratorAccess-Amplify` permission
- Download the access key CSV
- Enter the access key ID and secret when prompted

### Step 3: Start Amplify Sandbox (Local Development Backend)

```powershell
npm run amplify:sandbox
```

This command:
- Creates all AWS resources (Cognito, AppSync, DynamoDB)
- Sets up a local development environment
- Watches for changes to your backend code
- Generates `amplify_outputs.json` with connection details

**First run takes ~3-5 minutes** as it provisions AWS resources.

### Step 4: Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID
3. Set authorized redirect URIs:
   ```
   http://localhost:5173/
   https://YOUR-COGNITO-DOMAIN.auth.YOUR-REGION.amazoncognito.com/oauth2/idpresponse
   ```
4. Copy the Client ID and Secret
5. Add to `.env.local`:
   ```
   GOOGLE_CLIENT_ID=your-id-here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-secret-here
   ```

**Note**: The Cognito domain will be shown in the Amplify sandbox output.

### Step 5: Enable Cloud Sync

In `.env.local`:
```
VITE_ENABLE_CLOUD_SYNC=true
```

### Step 6: Restart Dev Server

```powershell
# Stop current dev server (Ctrl+C)
npm run dev
```

Now your app is fully connected to AWS! 🎉

---

## 📱 Testing the Full Auth Flow

1. Visit `http://localhost:5173/auth-demo`
2. Click "Continue with Google"
3. Sign in with your Google account
4. You'll be redirected back to the app
5. Your profile is automatically created in AWS Cognito!

---

## 💰 Cost Breakdown (Pay-As-You-Go)

### Free Tier (First 12 months):
- **Cognito**: 50,000 monthly active users - FREE
- **AppSync**: 250,000 queries/month - FREE
- **DynamoDB**: 25GB storage + 25 read/write units - FREE
- **Lambda**: 1 million requests - FREE

### After Free Tier:
- **10 users/month**: ~$0.06
- **100 users/month**: ~$0.55
- **1,000 users/month**: ~$5.50

**Total estimated cost for small golf groups: $0-5/month**

---

## 🗂️ Project Structure

```
gimmies-golf/
├── amplify/
│   ├── auth/
│   │   └── resource.ts          # Auth configuration (Cognito)
│   ├── data/
│   │   └── resource.ts          # GraphQL schema (AppSync + DynamoDB)
│   └── backend.ts               # Main backend config
├── src/
│   ├── components/
│   │   └── auth/
│   │       └── LoginPage.tsx    # Custom login UI
│   ├── contexts/
│   │   └── AuthContext.tsx      # Auth state management
│   └── pages/
│       └── AuthDemoPage.tsx     # Preview page
├── .env.local                   # Your secrets (DO NOT COMMIT)
├── .env.template                # Template for .env.local
└── amplify_outputs.json         # Auto-generated AWS config
```

---

## 🔐 Security Best Practices

1. ✅ Never commit `.env.local` (already in .gitignore)
2. ✅ Never commit `amplify_outputs.json` (already in .gitignore)
3. ✅ Use environment variables for all secrets
4. ✅ Enable MFA on your AWS account
5. ✅ Rotate OAuth credentials periodically

---

## 🐛 Troubleshooting

### "Module not found: aws-amplify"
**Solution**: Run `npm install` to ensure all dependencies are installed.

### "Amplify sandbox failed to start"
**Solution**: 
1. Check AWS credentials: `aws configure list`
2. Ensure IAM user has correct permissions
3. Check AWS region is set

### "Google OAuth redirect mismatch"
**Solution**:
1. Check Cognito domain in Amplify output
2. Update Google Console redirect URIs
3. Restart Amplify sandbox

### "Login button does nothing"
**Solution**: This is expected if Amplify sandbox isn't running. The demo page shows UI only.

---

## 📚 Next Implementation Steps

After AWS is connected, we'll build:

1. **Data Sync Layer**
   - Sync Dexie ↔ Amplify DataStore
   - Offline-first with automatic sync
   - Conflict resolution

2. **Real-Time Features**
   - Live score updates (GraphQL subscriptions)
   - Real-time chat messages
   - Presence detection ("Who's online")

3. **Cloud Features**
   - Cross-device event access
   - Profile synchronization
   - Push notifications
   - Course data management

4. **Migration Tools**
   - One-click import of local data to cloud
   - Export cloud data to local backup

---

## 🎯 Quick Commands Reference

```powershell
# Preview login UI (no AWS needed)
npm run dev
# Then visit: http://localhost:5173/auth-demo

# Start Amplify backend (requires AWS setup)
npm run amplify:sandbox

# Deploy to production (when ready)
npm run amplify:deploy

# View Amplify console
npx ampx console
```

---

## 🤝 Support

If you encounter issues:
1. Check the Amplify documentation: https://docs.amplify.aws
2. Review AWS Amplify Gen 2 examples: https://github.com/aws-samples/amplify-next-template
3. AWS Support (if you have a support plan)

---

## ✨ What's Different from Before?

| Feature | Before (Local Only) | After (AWS Amplify) |
|---------|-------------------|-------------------|
| **Authentication** | Browser localStorage | AWS Cognito (Google, Email) |
| **Data Storage** | IndexedDB (Dexie) | DynamoDB + local sync |
| **Real-time** | None | AppSync subscriptions |
| **Cross-device** | ❌ No | ✅ Yes |
| **Collaboration** | Share codes (local) | Real-time cloud sync |
| **Backup** | Manual export/import | Automatic cloud backup |
| **Cost** | $0 | $0-5/month |

---

**Ready to see the beautiful login UI? Run `npm run dev` and visit `/auth-demo`!** 🚀
