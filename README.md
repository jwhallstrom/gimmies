# Gimmies Golf

A comprehensive Progressive Web App (PWA) for golf event management, scoring, and social gambling games. Built for golfers who want to track scores, manage events, and enjoy friendly competition.

## ✨ Features

### Core Features
- **Event Management**: Create and join golf events with custom settings and share codes
- **Real-time Scoring**: Live scorecard updates with mobile-optimized interface
- **Handicap Tracking**: Full World Handicap System (WHS) implementation with score differentials
- **Analytics Dashboard**: Performance tracking, trends, and detailed statistics
- **Social Features**: In-event chat, event sharing, and group management

### Gambling Games
- **Nassau**: Front 9, Back 9, and Total with automatic press handling
- **Skins**: Individual hole competitions with carryover options
- **Greenies**: Par-3 closest-to-pin tracking
- **Wallet System**: Settlement tracking and payout calculations

### Technical Features
- **Offline-First PWA**: Full service worker caching for offline play
- **Cloud Sync**: AWS Amplify backend with real-time sync across devices
- **Code Splitting**: Lazy-loaded routes for fast initial load (~238KB)
- **Mobile Optimized**: Responsive design with touch-friendly navigation

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS with custom design system |
| **State** | Zustand with IndexedDB persistence |
| **Backend** | AWS Amplify Gen 2 (AppSync + DynamoDB) |
| **Auth** | AWS Cognito with Google OAuth |
| **PWA** | vite-plugin-pwa with Workbox |
| **Testing** | Vitest + Playwright (E2E) |
| **Hosting** | AWS Amplify Hosting (CI/CD) |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm

### Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd gimmies-golf

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production
```bash
npm run build      # Build the app
npm run preview    # Preview production build locally
```

## 📱 App Structure

### Pages
| Page | Description |
|------|-------------|
| **Dashboard** | Overview of recent events, stats, and quick actions |
| **Events** | Browse, create, and join golf events |
| **Analytics** | Performance charts, scoring trends, best rounds |
| **Handicap** | WHS handicap tracking with round history |
| **Profile** | User settings and preferences |
| **Event Details** | Full event management with multiple tabs |

### Event Detail Tabs
- **Overview**: Event summary, golfers, and status
- **Setup**: Course selection, tees, game configuration
- **Score**: Live scorecard with hole-by-hole entry
- **Leaders**: Live leaderboard with gross/net rankings
- **Games**: Nassau/Skins game status and standings
- **Payout**: Settlement calculations and wallet integration
- **Chat**: Real-time event communication

## 🏗️ Development

### Available Scripts
```bash
npm run dev          # Start dev server (hot reload)
npm run build        # Production build
npm run preview      # Serve production build
npm run test         # Run unit tests (Vitest)
npm run e2e          # E2E tests against dev server
npm run e2e:preview  # E2E tests against production build
npm run lint         # ESLint
```

### Project Structure
```
src/
├── components/       # Reusable UI components
│   ├── tabs/        # Event detail tab components
│   ├── wallet/      # Wallet/settlement components
│   └── ui/          # Base UI components
├── pages/           # Route page components (lazy-loaded)
├── state/           # Zustand store with slices
│   └── slices/      # Modular state slices
├── utils/           # Utilities (handicap, sync, storage)
├── games/           # Game logic (Nassau, Skins, etc.)
└── data/            # Static data (courses, tees)

amplify/
├── auth/            # Cognito configuration
├── data/            # GraphQL schema & resolvers
└── backend.ts       # Amplify backend definition
```

### Key Utilities
- `src/utils/handicap.ts` — WHS calculations, ESC adjustment
- `src/utils/idbStorage.ts` — IndexedDB persistence layer
- `src/utils/eventSync.ts` — Cloud sync for events
- `src/utils/roundSync.ts` — Cloud sync for rounds
- `src/utils/profileSync.ts` — Cloud sync for profiles

## 🚀 Deployment

### Amplify Hosting (Primary)
The app auto-deploys via GitHub integration:

1. Push to `master` branch
2. Amplify builds and deploys automatically
3. Monitor in AWS Amplify Console

See [AMPLIFY_HOSTING_SETUP.md](AMPLIFY_HOSTING_SETUP.md) for details.

### Manual Deployment
```bash
npm run build
# Deploy dist/ to your static host
```

## 🧪 Testing

### Unit Tests
```bash
npm run test           # Run once
npm run test -- --watch  # Watch mode
```

### E2E Tests (Playwright)
```bash
# Against dev server
npm run e2e

# Against production build (recommended for CI)
npm run build && npm run e2e:preview
```

## 📊 Data Model

### Core Entities
| Entity | Description | Storage |
|--------|-------------|---------|
| **Profile** | User profile with handicap data | Cloud + Local |
| **Event** | Golf event with golfers and games | Cloud + Local |
| **IndividualRound** | Handicap-tracked round | Cloud + Local |
| **CompletedRound** | Event round with stats | Cloud + Local |

### Sync Strategy
- **Local-first**: All data persisted to IndexedDB
- **Cloud sync**: Amplify DataStore for cross-device sync
- **Offline support**: Full functionality without network

## 📋 Roadmap

### ✅ Implemented
- Event creation and management
- Real-time scoring interface
- WHS handicap tracking
- Nassau and Skins games
- Wallet/settlement system
- Cross-device cloud sync
- PWA with offline support
- Analytics dashboard
- Code splitting (lazy routes)

### 🚧 Planned
- Tournament bracket mode
- Push notifications
- Photo sharing in events
- Advanced statistics
- Leaderboard history
- Multi-round events

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## 📄 License

This project is private and proprietary.

---

**Built with ❤️ for the golf community**
