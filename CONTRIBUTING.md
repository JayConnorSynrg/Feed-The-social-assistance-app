# Contributing to FEED

Thank you for your interest in contributing to FEED! This guide will help you get started.

## 🌟 Ways to Contribute

We welcome all kinds of contributions:

- **🐛 Bug Reports**: Found a problem? Let us know!
- **💡 Feature Requests**: Have an idea? Share it!
- **🔧 Code Contributions**: Fix bugs, add features, improve performance
- **📖 Documentation**: Improve guides, add examples, fix typos
- **🎨 Design**: UI/UX improvements, accessibility enhancements
- **🌐 Translation**: Help make FEED available in more languages
- **🏃 Community**: Run an instance, help others, share your experience

## 🚀 Getting Started

### 1. Set Up Development Environment

Follow the [Setup Guide](./docs/SETUP.md) to get FEED running locally:

```bash
# Clone and install
git clone https://github.com/your-org/feed.git
cd feed
npm install

# Start local services
npx supabase start
npm run dev
```

### 2. Find Something to Work On

**Good First Issues**: Look for issues labeled `good-first-issue` on GitHub
**Help Wanted**: Issues labeled `help-wanted` need community support
**Your Ideas**: Have something in mind? Open an issue to discuss it first!

### 3. Create a Branch

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Or a bugfix branch
git checkout -b fix/issue-description
```

### 4. Make Your Changes

- Write clear, commented code
- Follow the existing code style
- Add tests for new features
- Update documentation as needed

### 5. Test Your Changes

```bash
# Run type checking
npm run type-check

# Run build
npm run build

# Run tests (when available)
npm test

# Test on mobile simulators (if mobile changes)
npx cap run ios
npx cap run android
```

### 6. Submit a Pull Request

```bash
# Commit your changes
git add .
git commit -m "feat: Add federated search UI"

# Push to your fork
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub with:
- Clear title describing the change
- Description of what changed and why
- Screenshots (if UI changes)
- Reference to related issue (if applicable)

## 📝 Code Style Guide

### TypeScript

- Use TypeScript for all new code
- Enable strict mode (`strict: true`)
- Avoid `any` types - use proper typing
- Use functional components with hooks (React)

```typescript
// ✅ Good
interface ResourceProps {
  name: string
  category: string
}

export function ResourceCard({ name, category }: ResourceProps) {
  return <div>{name}</div>
}

// ❌ Avoid
export function ResourceCard(props: any) {
  return <div>{props.name}</div>
}
```

### React Components

- One component per file
- Use named exports (not default exports)
- Keep components small and focused
- Use composition over inheritance

```typescript
// ✅ Good
export function FeedPanel() {
  return (
    <div>
      <FeedHeader />
      <FeedContent />
      <FeedFooter />
    </div>
  )
}

// ❌ Avoid
export default function Component() {
  // 500 lines of mixed concerns
}
```

### Naming Conventions

- **Components**: PascalCase (`ResourceCard`, `FeedPanel`)
- **Functions**: camelCase (`fetchResources`, `handleSubmit`)
- **Files**: kebab-case (`resource-card.tsx`, `feed-panel.tsx`)
- **Types/Interfaces**: PascalCase (`ResourceType`, `FeedItem`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RESULTS`, `API_TIMEOUT`)

### Git Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: Add federated search
fix: Resolve map marker clustering issue
docs: Update deployment guide
style: Format code with Prettier
refactor: Extract resource sync to service
test: Add unit tests for federation
chore: Update dependencies
```

## 🗃️ Project Structure

```
feed/
├── apps/
│   ├── web/              # Next.js web app
│   │   ├── src/
│   │   │   ├── app/      # App router pages
│   │   │   ├── components/  # React components
│   │   │   ├── hooks/    # Custom React hooks
│   │   │   └── lib/      # Utilities and helpers
│   │   └── public/       # Static assets
│   └── mobile/           # Capacitor mobile app config
├── packages/
│   └── database/         # Supabase types and schemas
├── supabase/
│   ├── migrations/       # Database migrations
│   └── functions/        # Edge Functions
├── specs/                # Technical specifications
└── docs/                 # Documentation
```

## 🔐 Security

**CRITICAL**: Never commit secrets, API keys, or credentials!

- Use `.env.local` for local secrets (already in .gitignore)
- Use Supabase Vault for production secrets
- Report security vulnerabilities to security@feedplatform.org (not GitHub issues)

See [SECURITY.md](./SECURITY.md) for our security policy.

## 📊 Database Changes

All database changes must go through migrations:

```bash
# Create a new migration
npx supabase migration new your_migration_name

# Edit the migration file in supabase/migrations/

# Apply migration locally
npx supabase db push

# Generate updated TypeScript types
npx supabase gen types typescript --local > packages/database/types.ts

# Commit both the migration AND the types file
git add supabase/migrations/*.sql packages/database/types.ts
git commit -m "feat: Add federation tables"
```

**Migration Rules**:
1. Never modify existing migrations
2. Always include RLS policies
3. Test migrations on a clean database
4. Document breaking changes

## 🧪 Testing

We're building our test suite! Help us by:

- Adding unit tests for new functions
- Adding integration tests for API endpoints
- Testing mobile features on real devices
- Documenting test scenarios

```typescript
// Example unit test
import { deduplicateResources } from './deduplicate'

describe('deduplicateResources', () => {
  it('should merge duplicate resources by name and address', () => {
    const resources = [
      { id: '1', name: 'Food Bank', address: '123 Main St' },
      { id: '2', name: 'Food Bank', address: '123 Main Street' }
    ]
    const result = deduplicateResources(resources)
    expect(result).toHaveLength(1)
  })
})
```

## 📖 Documentation

Good documentation is essential:

- **Code Comments**: Explain WHY, not just what
- **JSDoc**: Document public functions and components
- **README Updates**: Keep setup instructions current
- **Guides**: Add examples for complex features

```typescript
/**
 * Fetches resources from federated instances and deduplicates results
 *
 * @param query - Search query string
 * @param federationPartners - Array of federated instance URLs
 * @param options - Search options (timeout, maxResults, etc.)
 * @returns Deduplicated resources with source attribution
 *
 * @example
 * const resources = await federatedSearch('food bank', [
 *   'https://seattle.feed.org',
 *   'https://oakland.feed.org'
 * ])
 */
export async function federatedSearch(
  query: string,
  federationPartners: string[],
  options?: SearchOptions
): Promise<Resource[]> {
  // Implementation
}
```

## 🤝 Community Guidelines

- **Be Respectful**: Treat everyone with kindness and respect
- **Be Patient**: We're all volunteers here
- **Be Constructive**: Criticism should be helpful and actionable
- **Be Inclusive**: FEED is for everyone, regardless of background
- **Be Collaborative**: Work together, help each other

## 📬 Getting Help

Stuck? Have questions?

- **Discord**: Join our [Discord server](https://discord.gg/feed-platform)
- **GitHub Discussions**: Ask questions in [Discussions](https://github.com/your-org/feed/discussions)
- **Email**: developer@feedplatform.org

## 🎉 Recognition

Contributors are recognized in:
- GitHub contributors page
- Project README
- Release notes

Thank you for helping make FEED better for mutual aid communities everywhere! 💚

---

**Questions about this guide?** Open an issue or ask in Discord!
