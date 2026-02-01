# Domain Setup Guide for Gimmies Golf

This guide walks through setting up the subdomain structure for the Gimmies Golf platform.

## Target Domain Structure

| Subdomain | Purpose | App |
|-----------|---------|-----|
| `golfwithgimmies.com` | Marketing/Landing | Static site or redirect |
| `app.golfwithgimmies.com` | Main Gimmies App | Current PWA (handicap tracking, rounds, events) |
| `play.golfwithgimmies.com` | Tournament Platform | Tournament PWA (create/join tournaments, live scoring) |
| `clubs.golfwithgimmies.com` | Club Management | Club PWA (future - course/org management) |

---

## Prerequisites

- Domain `golfwithgimmies.com` registered and DNS accessible
- AWS Account with Amplify Hosting configured
- SSL certificates (Amplify provides these automatically)

---

## Option A: Single Amplify App with Branch-Based Subdomains

**Best for:** Simpler setup, shared deployment pipeline

### Step 1: Create Git Branches

```bash
# Main app branch (already exists)
git checkout master

# Tournament app branch
git checkout -b tournaments
# Configure apps/tournaments as the build target

# Clubs app branch (future)
git checkout -b clubs
```

### Step 2: Configure Amplify Build Settings

Update `amplify.yml` to detect which branch is building:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - |
          if [ "$AWS_BRANCH" = "tournaments" ]; then
            echo "Building Tournament App"
            cd apps/tournaments
            cp ../../amplify_outputs.json ./
            npm ci
            npm run build
          elif [ "$AWS_BRANCH" = "clubs" ]; then
            echo "Building Clubs App"
            cd apps/clubs
            cp ../../amplify_outputs.json ./
            npm ci
            npm run build
          else
            echo "Building Main App"
            npm run build
          fi
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - apps/tournaments/node_modules/**/*
```

### Step 3: Configure Custom Domain in Amplify Console

1. **Open Amplify Console** → Select your app → **Domain management**

2. **Add domain:**
   - Click "Add domain"
   - Enter `golfwithgimmies.com`
   - Click "Configure domain"

3. **Configure subdomains:**

   | Subdomain | Branch | Description |
   |-----------|--------|-------------|
   | `app` | `master` | Main Gimmies app |
   | `play` | `tournaments` | Tournament platform |
   | `clubs` | `clubs` | Club management (future) |
   | *(root)* | `master` or redirect | Landing page |

4. **SSL Certificates:**
   - Amplify automatically provisions SSL via AWS Certificate Manager
   - Verify domain ownership via DNS (CNAME records)

### Step 4: Update DNS Records

Add these records at your domain registrar:

```
Type    Name                    Value
-----   ----------------------  ------------------------------------------
CNAME   app                     <amplify-app-id>.amplifyapp.com
CNAME   play                    <amplify-app-id>.amplifyapp.com
CNAME   clubs                   <amplify-app-id>.amplifyapp.com
CNAME   _<hash>.app             _<hash>.acm-validations.aws
CNAME   _<hash>.play            _<hash>.acm-validations.aws
```

Amplify Console provides the exact values to use.

---

## Option B: Separate Amplify Apps per Subdomain

**Best for:** Independent deployments, different teams, isolation

### Step 1: Create Separate Amplify Hosting Apps

**App 1: gimmies-main**
```
Source: GitHub repo (gimmies-golf)
Branch: master
App root: /
Build output: dist/
```

**App 2: gimmies-tournaments**
```
Source: GitHub repo (gimmies-golf)
Branch: master (or tournaments)
App root: /apps/tournaments
Build output: dist/
```

**App 3: gimmies-clubs** (future)
```
Source: GitHub repo (gimmies-golf)
Branch: master (or clubs)
App root: /apps/clubs
Build output: dist/
```

### Step 2: Configure Each App's amplify.yml

**For Tournament App (`apps/tournaments/amplify.yml`):**

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        # Copy shared Amplify config
        - cp ../../amplify_outputs.json ./
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

### Step 3: Add Custom Domains to Each App

**In Amplify Console for gimmies-main:**
- Add domain: `golfwithgimmies.com`
- Subdomain: `app` → `master` branch

**In Amplify Console for gimmies-tournaments:**
- Add domain: `golfwithgimmies.com`
- Subdomain: `play` → `master` branch

### Step 4: DNS Configuration

Same as Option A - Amplify provides the CNAME values for each app.

---

## Option C: Using AWS Route 53 (Full Control)

**Best for:** Complex routing, geo-based routing, failover

### Step 1: Transfer or Configure DNS in Route 53

1. Create a Hosted Zone for `golfwithgimmies.com`
2. Update nameservers at your registrar to Route 53's NS records

### Step 2: Create Alias Records

```
Type    Name                        Alias Target
-----   --------------------------  ----------------------------------
A       app.golfwithgimmies.com     Amplify app (main)
A       play.golfwithgimmies.com    Amplify app (tournaments)
A       clubs.golfwithgimmies.com   Amplify app (clubs)
A       golfwithgimmies.com         CloudFront or S3 (landing page)
```

### Benefits of Route 53:
- Health checks and failover
- Geo-location routing
- Weighted routing for A/B testing
- Faster DNS propagation within AWS

---

## Root Domain Options

### Option 1: Redirect to Main App
```
golfwithgimmies.com → app.golfwithgimmies.com (301 redirect)
```

Configure in Amplify:
- Add redirect rule: `https://golfwithgimmies.com` → `https://app.golfwithgimmies.com`

### Option 2: Landing/Marketing Page
Create a simple static site:
- `apps/landing/` with marketing content
- Deploy to root domain
- Links to `app.`, `play.`, `clubs.` subdomains

### Option 3: App Selector Page
Simple page with links:
```html
<a href="https://app.golfwithgimmies.com">Track Your Handicap</a>
<a href="https://play.golfwithgimmies.com">Join a Tournament</a>
<a href="https://clubs.golfwithgimmies.com">Manage Your Club</a>
```

---

## Cross-Subdomain Authentication

Since all apps share the same Amplify backend (Cognito User Pool):

### Cookie Configuration
Cognito tokens are stored in localStorage by default. For seamless SSO:

1. **Configure Amplify Auth** to use cookies with domain scope:

```typescript
// In each app's Amplify config
Amplify.configure(amplifyOutputs, {
  Auth: {
    cookieStorage: {
      domain: '.golfwithgimmies.com',  // Note the leading dot
      path: '/',
      expires: 365,
      secure: true,
      sameSite: 'lax'
    }
  }
});
```

2. **User Flow:**
   - User signs in on `app.golfwithgimmies.com`
   - Cookie set for `.golfwithgimmies.com`
   - User visits `play.golfwithgimmies.com`
   - Cookie is sent, user is already authenticated

### CORS Configuration (if using API Gateway)

Add all subdomains to allowed origins:
```
https://app.golfwithgimmies.com
https://play.golfwithgimmies.com
https://clubs.golfwithgimmies.com
```

---

## Verification Checklist

After setup, verify:

- [ ] `https://app.golfwithgimmies.com` loads main app
- [ ] `https://play.golfwithgimmies.com` loads tournament app
- [ ] SSL certificates are valid (green padlock)
- [ ] Sign in on one subdomain
- [ ] Navigate to another subdomain - should still be signed in
- [ ] PWA install works on each subdomain
- [ ] Data syncs correctly (same tournaments visible on both apps)

---

## Troubleshooting

### DNS Not Propagating
- Use `nslookup app.golfwithgimmies.com` to check
- DNS can take up to 48 hours (usually faster)
- Try clearing DNS cache: `ipconfig /flushdns` (Windows)

### SSL Certificate Pending
- Ensure CNAME validation records are added
- Check Amplify Console → Domain management for status
- Certificates usually provision within 30 minutes

### "Not Authenticated" on Subdomain
- Check cookie domain is set to `.golfwithgimmies.com` (with leading dot)
- Verify same Cognito User Pool ID in all `amplify_outputs.json`
- Check browser DevTools → Application → Cookies

### Different Data on Different Apps
- Verify all apps use the same `amplify_outputs.json`
- Check API endpoint matches across apps
- Ensure same AWS region configured

---

## Cost Considerations

| Service | Cost |
|---------|------|
| Amplify Hosting | $0.01/build minute + $0.15/GB served |
| Custom Domain | Free (you own the domain) |
| SSL Certificates | Free (AWS Certificate Manager) |
| Route 53 | $0.50/hosted zone/month + $0.40/million queries |

For typical usage, expect ~$5-15/month for hosting all subdomains.

---

## Recommended Setup for Gimmies Golf

**For your current stage, I recommend Option A (Branch-Based):**

1. Keep main app on `master` branch
2. Create `tournaments` branch for tournament app
3. Configure Amplify to deploy both from same app
4. Add custom domain with `app.` and `play.` subdomains

This keeps everything in one Amplify app, simplifies billing, and allows independent deployments per branch.

When ready to add clubs app, create a `clubs` branch and add the subdomain.

---

## Next Steps

1. **Configure domain in Amplify Console**
   - Add `golfwithgimmies.com` 
   - Set up `app` and `play` subdomains

2. **Update DNS at your registrar**
   - Add CNAME records Amplify provides

3. **Wait for SSL provisioning** (~30 minutes)

4. **Test cross-subdomain auth**
   - Sign in on one app
   - Verify authenticated on the other

5. **Update main app links** (already done)
   - Tournament links point to `play.golfwithgimmies.com`
