# Gimmies Golf

A comprehensive Progressive Web App (PWA) for golf event management, scoring, and social gambling games. Built for golfers who want to track scores, manage events, and enjoy friendly competition.

## ✨ Features

- **Event Management**: Create and join golf events with custom settings
- **Real-time Scoring**: Live scorecard updates with mobile-optimized interface
- **Social Features**: Chat, event sharing, and group management
- **Gambling Games**: Nassau and Skins game configurations with automatic payout calculations
- **Offline-First**: Full PWA with service worker caching for offline play
- **Mobile Optimized**: Responsive design with touch-friendly navigation
- **AWS Deployment**: Amplify Hosting with CI/CD from GitHub

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand with persistence
- **Data**: AWS Amplify (AppSync + DynamoDB) with local cache (Zustand + IndexedDB/Dexie)
- **PWA**: Vite PWA plugin with Workbox
- **Testing**: Vitest + React Testing Library, Playwright (E2E)
- **Deployment**: AWS S3 with CloudFront (optional)
- **Icons**: Custom SVG icons with Heroicons integration

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

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
# Build the app
npm run build

# Preview production build
npm run preview
```

## 📱 App Structure

### Core Pages
- **Dashboard**: Overview of events and quick actions
- **Events**: Browse and manage golf events
- **Analytics**: Performance tracking and statistics
- **Event Details**: Comprehensive event management with tabs:
  - Setup: Event configuration
  - Score: Live scorecard
  - Leaders: Rankings and podium
  - Games: Nassau/Skins configurations
  - Payout: Financial calculations
  - Chat: Event communication

### Key Components
- **Event Management**: Full CRUD operations for golf events
- **Player Profiles**: User management with profiles and settings
- **Scoring System**: Real-time score tracking with validation
- **Game Engine**: Automated calculations for gambling games
- **PWA Features**: Offline support, install prompts, push notifications

## 🏗️ Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Production build
npm run preview      # Preview production build
npm run test         # Run unit tests
npm run e2e          # Run end-to-end tests (dev server)
npm run e2e:preview  # Run end-to-end tests against built preview
npm run lint         # Code linting
```

### Project Structure
```
src/
├── components/       # Reusable UI components
│   ├── tabs/        # Event detail tabs
│   └── ...
├── pages/           # Main application pages
├── state/           # Zustand store (persisted to IndexedDB)
├── lib/             # Utility functions and helpers
├── games/           # Game logic and calculations
├── data/            # Static data and configurations
└── utils/           # Shared utilities (e.g., idb storage)
```

### State Management
- **Zustand Store**: Centralized state with persistence
- **Event State**: Event creation, management, and real-time updates
- **User State**: Profile management and authentication
- **Game State**: Scoring and game calculations

## 🚀 Deployment

### Amplify Hosting (Recommended)
- Connected GitHub repo triggers build + deploy on push to your configured branch.
- Build spec: `amplify.yml` (backend via `ampx pipeline-deploy`, frontend publishes `dist/`).
- To deploy: commit and push; monitor in Amplify Console.

See `AMPLIFY_HOSTING_SETUP.md` and `agents.md` for CI/CD details.

### Optional: Static Hosting via S3
If you need manual/static hosting for staging or special cases, see the “AWS S3 Deployment (Static Hosting)” section in `agents.md`.

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### End-to-End Tests
```bash
npm run test:e2e
```

## 📋 Roadmap

### Current Features ✅
- Event creation and management
- Real-time scoring interface
- Mobile-responsive design
- PWA with offline support
- Social features (chat, sharing)
- Game calculations (Nassau, Skins)
- AWS deployment pipeline

### Planned Features 🚧
- Advanced handicap system
- Tournament bracket support
- Push notifications
- Advanced analytics
- Wallet integration for buy-ins
- Multi-course support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## 📄 License

This project is private and proprietary.

## 🆘 Support

For support or questions, please contact the development team.

---

**Built with ❤️ for the golf community**
### E2E Against Production Bundle
```bash
# Build the app, then run Playwright against vite preview
npm run build
npm run e2e:preview
```
