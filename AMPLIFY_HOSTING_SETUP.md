# 🚀 Amplify Hosting Deployment Guide

## ✅ MULTI-APP DEPLOYMENT COMPLETE (Feb 1, 2026)

### Production URLs (Custom Domain)
| App | URL | Branch |
|-----|-----|--------|
| **Main App** | https://app.golfwithgimmies.com | `master` |
| **Landing Page** | https://golfwithgimmies.com | `landing` |
| **Landing (www)** | https://www.golfwithgimmies.com | `landing` |
| **Tournaments** | https://play.golfwithgimmies.com | `tournaments` |

### Legacy Amplify URLs (still work)
- Main: https://master.dtsoc1sfk1bk8.amplifyapp.com
- Landing: https://landing.dtsoc1sfk1bk8.amplifyapp.com
- Tournaments: https://tournaments.dtsoc1sfk1bk8.amplifyapp.com

**App ID:** dtsoc1sfk1bk8  
**Service Role:** AmplifyGimmiesGolfServiceRole  
**CloudFront Distribution:** d3kbgj2v1dsd9d.cloudfront.net

### Current Status
- ✅ Amplify Gen 2 Backend deployed (Cognito, AppSync, DynamoDB)
- ✅ GitHub repository connected with 3 branches
- ✅ Custom domain golfwithgimmies.com configured
- ✅ All subdomains verified and SSL active
- ✅ Route 53 DNS configured with CloudFront CNAME
- ✅ Each branch auto-deploys to its subdomain

---

## Multi-App Architecture

```
golfwithgimmies.com/
├── master branch → app.golfwithgimmies.com (Main Gimmies App)
│   └── Build output: dist/
├── landing branch → golfwithgimmies.com + www (Marketing Landing Page)  
│   └── Build output: apps/landing/dist/
└── tournaments branch → play.golfwithgimmies.com (Tournaments PWA)
    └── Build output: apps/tournaments/dist/
```

### Branch-specific amplify.yml
Each branch has its own build configuration:
- `master`: Builds root app, outputs to `dist/`
- `landing`: Builds `apps/landing/`, outputs to `apps/landing/dist/`
- `tournaments`: Builds `apps/tournaments/`, outputs to `apps/tournaments/dist/`

---

## Critical Setup Requirements (Already Completed)

### 1. Required Dependencies in package.json
```json
{
  "devDependencies": {
    "@aws-amplify/backend-cli": "^1.2.1"  // REQUIRED for ampx pipeline-deploy
  }
}
```

### 2. IAM Service Role (AmplifyGimmiesGolfServiceRole)
**Attached Policy:** `AdministratorAccess-Amplify`

This role provides:
- ✅ SSM parameter access for CDK bootstrap
- ✅ CloudFormation stack deployment
- ✅ Cognito, AppSync, DynamoDB creation
- ✅ S3 and CloudFront management

**If recreating:** IAM Console → Create role → AWS service → Amplify → Attach `AdministratorAccess-Amplify`

### 3. amplify.yml Configuration
```yaml
version: 1
backend:
  phases:
    build:
      commands:
        - npm ci
        - npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

**Key points:**
- Uses standard `npm ci` (no custom cache flags)
- Backend deployment via `ampx pipeline-deploy`
- Frontend builds to `dist/` directory

---

## Step-by-Step: Connect GitHub to Amplify Hosting (Reference)

### 1. Open AWS Amplify Console
**URL:** https://console.aws.amazon.com/amplify/home?region=us-east-1

### 2. Create New Hosting App
1. Click **"New app"** (orange button, top right)
2. Select **"Host web app"**
3. Choose **"GitHub"** as the repository provider
4. Click **"Continue"**

### 3. Authorize GitHub Access
1. Click **"Authorize AWS Amplify"**
2. Sign in to GitHub if prompted
3. Grant Amplify access to your repositories

### 4. Select Repository & Branch
1. **Repository:** `Talbot24/gimmies-golf-pwa`
2. **Branch:** `master`
3. Click **"Next"**

### 5. Configure Build Settings
Amplify should auto-detect your `amplify.yml`. Verify:

```yaml
Build command: npm run build
Output directory: dist
```

**IMPORTANT:** Check **"Connecting to an existing backend"**
- This links your frontend to the existing Amplify Gen 2 backend (sandbox)

### 6. Add Environment Variables (CRITICAL)
Click **"Advanced settings"** and add:

| Key | Value |
|-----|-------|
| `VITE_ENABLE_CLOUD_SYNC` | `true` |

**Note:** `amplify_outputs.json` is auto-generated during build from your backend

### 7. Review and Deploy
1. Review all settings
2. Click **"Save and deploy"**
3. Wait for build to complete (~3-5 minutes)

---

## What Happens During Deployment

### Phase 1: Provision (30 sec)
- Creates CloudFront distribution
- Sets up build environment
- Configures SSL/TLS certificate

### Phase 2: Build (2-3 min)
```bash
npm ci                    # Install dependencies
npm run build             # Build production bundle
```

### Phase 3: Deploy (1-2 min)
- Uploads dist/ to CloudFront
- Invalidates cache
- Activates new version

### Phase 4: Verify (30 sec)
- Runs post-deployment checks
- Generates deployment URL

---

## Expected Deployment URL

Your app will be available at:
```
https://master.<app-id>.amplifyapp.com
```

Example:
```
https://master.d3abc123xyz.amplifyapp.com
```

**CloudFront Features Included:**
- ✅ HTTPS automatically enabled
- ✅ Global CDN (fast worldwide)
- ✅ Automatic certificate management
- ✅ Custom domain support (if needed)

---

## Post-Deployment: Verify Features

### 1. Authentication Flow
- [ ] Login page loads correctly
- [ ] Google OAuth redirects work
- [ ] Email/password sign-in functional
- [ ] Sign-up flow completes
- [ ] Password reset works
- [ ] Cognito user pool receives users

### 2. Data Sync (DynamoDB)
- [ ] Create new event
- [ ] Event saves to cloud
- [ ] Event appears on second device
- [ ] Scorecard data syncs
- [ ] Profile data persists

### 3. Real-time Features
- [ ] Live score updates
- [ ] Chat messages sync instantly
- [ ] Event completion triggers alerts
- [ ] Leaderboard updates in real-time

### 4. Analytics
- [ ] CompletedRounds display correctly
- [ ] 18 holes shown (not 36) ✅ (fixed Oct 14)
- [ ] Stats calculate properly
- [ ] Cross-device consistency

### 5. PWA Features
- [ ] Service worker registers
- [ ] Offline mode works
- [ ] Add to home screen prompt
- [ ] Push notifications (if enabled)

---

## Auto-Deployment (CI/CD)

After setup, every git push triggers automatic deployment:

```bash
git add .
git commit -m "Update feature"
git push origin master
# ↓ Amplify auto-detects push
# ↓ Starts new build
# ↓ Deploys to production
# ↓ Live in ~5 minutes
```

**Build Status:**
- View in Amplify Console → "Build history"
- Email notifications on build success/failure

---

## Monitoring & Logs

### Build Logs
- Amplify Console → App → Build history → Click build
- Shows npm install, build, deploy steps
- Debug build failures here

### Runtime Logs (CloudWatch)
- Console → Monitoring → Logs
- View CloudFront access logs
- Track API requests to AppSync

### Performance Metrics
- Console → Monitoring → Performance
- Page load times
- CloudFront cache hit rates

---

## Connecting Backend (Sandbox → Production)

**CURRENT:** Using sandbox backend (`victo-sandbox`)
**PRODUCTION:** You may want a dedicated production backend

### Option A: Keep Sandbox for Now
- ✅ Already working
- ✅ Same backend for dev and prod
- ⚠️ Single environment

### Option B: Create Production Backend (Recommended Later)
```bash
npx ampx generate outputs --branch main --app-id <your-amplify-app-id>
```
This creates a production backend stack separate from sandbox.

**For now, stick with Option A** until you validate everything works.

---

## Troubleshooting

### Build Fails: "Module not found"
**Fix:** Check `package.json` dependencies are complete
```bash
npm install
git add package-lock.json
git commit -m "Update dependencies"
git push
```

### amplify_outputs.json Not Found
**Fix:** In Amplify Console → App settings → Build settings:
- Ensure "Connect existing backend" is checked
- Backend environment should be `victo-sandbox`

### Authentication Redirects Fail
**Fix:** Update Cognito redirect URLs:
1. Go to Cognito Console
2. User Pools → `us-east-1_IpbwW1NCP`
3. App integration → App client settings
4. Add: `https://master.<app-id>.amplifyapp.com`

### Service Worker Issues
**Fix:** Hard refresh after deployment
- Chrome: Ctrl+Shift+R
- Application → Service Workers → Unregister

---

## Cost Estimate (Amplify Hosting)

### Free Tier (First 12 months)
- **Build minutes:** 1,000/month FREE
- **Data served:** 15 GB/month FREE
- **Data stored:** 5 GB FREE

### After Free Tier (Small App)
- **Builds:** ~10 builds/month × $0.01 = **$0.10**
- **Serving:** ~5 GB/month × $0.15/GB = **$0.75**
- **Storage:** 100 MB × $0.023/GB = **$0.002**

**Total:** ~$0.85-1/month for small golf app

### Backend Costs (Separate)
- Cognito: Free for <50k users
- AppSync: Free tier covers small usage
- DynamoDB: Free tier covers small apps

**Combined estimated monthly cost: $0-5**

---

## Next Steps After Deployment

1. ✅ Verify URL is live
2. ✅ Test all auth flows
3. ✅ Create test event
4. ✅ Verify cross-device sync
5. ✅ Check analytics (18 holes, not 36)
6. ✅ Test on mobile devices
7. ⏳ Add custom domain (optional)
8. ⏳ Set up email notifications
9. ⏳ Configure monitoring alerts

---

## Quick Commands Reference

```bash
# View deployment status
aws amplify list-apps --region us-east-1

# Get app URL
aws amplify get-app --app-id <app-id> --region us-east-1

# Trigger manual deployment (if needed)
# (Use Console → Redeploy this version)

# View recent builds
aws amplify list-jobs --app-id <app-id> --branch-name master --region us-east-1
```

---

## Support

- **Amplify Docs:** https://docs.amplify.aws/
- **Console:** https://console.aws.amazon.com/amplify
- **Status:** https://status.aws.amazon.com/

---

**🎯 Goal: Full production deployment with:**
- ✅ CloudFront CDN + HTTPS
- ✅ Auto CI/CD from GitHub
- ✅ Cognito authentication
- ✅ DynamoDB cloud sync
- ✅ Real-time features
- ✅ Analytics working correctly

**Ready to go! Follow the steps above in the AWS Amplify Console.**
