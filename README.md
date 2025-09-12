# Gimmies Golf

A comprehensive Progressive Web App (PWA) for golf event management, scoring, and social gambling games. Built for golfers who want to track scores, manage events, and enjoy friendly competition.

## ✨ Features

- **Event Management**: Create and join golf events with custom settings
- **Real-time Scoring**: Live scorecard updates with mobile-optimized interface
- **Social Features**: Chat, event sharing, and group management
- **Gambling Games**: Nassau and Skins game configurations with automatic payout calculations
- **Offline-First**: Full PWA with service worker caching for offline play
- **Mobile Optimized**: Responsive design with touch-friendly navigation
- **AWS Deployment**: Production-ready with optimized caching strategy

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand with persistence
- **Database**: IndexedDB via Dexie (planned upgrade from localStorage)
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
npm run test:e2e     # Run end-to-end tests
npm run lint         # Code linting
```

### Project Structure
```
src/
├── components/       # Reusable UI components
│   ├── tabs/        # Event detail tabs
│   └── ...
├── pages/           # Main application pages
├── state/           # Zustand store and state management
├── lib/             # Utility functions and helpers
├── games/           # Game logic and calculations
├── data/            # Static data and configurations
└── db/              # Database layer (Dexie)
```

### State Management
- **Zustand Store**: Centralized state with persistence
- **Event State**: Event creation, management, and real-time updates
- **User State**: Profile management and authentication
- **Game State**: Scoring and game calculations

## 🚀 Deployment

### AWS S3 Deployment
The app is optimized for AWS S3 static hosting with intelligent caching:

```bash
# Build and deploy
npm run build
aws s3 sync dist/ s3://your-bucket-name --delete --exclude "index.html" --cache-control "public,max-age=31536000,immutable"
aws s3 cp dist/index.html s3://your-bucket-name/index.html --cache-control "public,max-age=60" --content-type "text/html"
```

See `agents.md` for detailed deployment instructions.

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
