# Contributing to Gimmies Golf

Thank you for your interest in contributing to Gimmies Golf! We welcome contributions from the community.

## Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/gimmies-golf-pwa.git
   cd gimmies-golf-pwa
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

## Development Workflow

1. **Create a feature branch** from `master`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Test your changes**:
   ```bash
   npm run test          # Unit tests
   npm run test:e2e      # E2E tests
   npm run lint          # Code linting
   npm run build         # Production build
   ```

4. **Commit your changes** with clear, descriptive messages:
   ```bash
   git add .
   git commit -m "Add: Brief description of your changes"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub

## Coding Standards

- **TypeScript**: Strict type checking enabled
- **ESLint**: Follow the configured linting rules
- **Prettier**: Code formatting will be enforced
- **Testing**: Write tests for new features
- **Commits**: Use conventional commit format

### Commit Message Format
```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Pull Request Guidelines

- **Title**: Clear, descriptive title
- **Description**: Explain what changes and why
- **Tests**: Include tests for new features
- **Screenshots**: For UI changes
- **Breaking Changes**: Clearly mark any breaking changes

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Main application pages
├── state/         # Zustand store and state management
├── games/         # Game logic and calculations
├── data/          # Static data and configurations
└── lib/           # Utility functions
```

## Testing

- **Unit Tests**: Located in `tests/` directory
- **E2E Tests**: Located in `e2e/` directory using Playwright
- **Test Coverage**: Aim for good coverage on critical paths

## Deployment

The app is deployed to AWS S3. See `agents.md` for deployment details.

## Questions?

Feel free to open an issue for questions or discussions!