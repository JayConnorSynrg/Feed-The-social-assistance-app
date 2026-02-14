# FEED - Mutual Aid Resource Sharing Platform

**FEED** is a federated, community-operated platform for discovering local resources, connecting with your community, and accessing benefits assistance. Built for mutual aid networks, designed for privacy and resilience.

## 🌟 Key Features

- **Resource Discovery**: Find food banks, housing assistance, healthcare, legal aid, and more near you
- **Community Feed**: Share updates, requests, and offers with your local community
- **AI Assistant**: Get help finding resources and understanding benefit eligibility
- **Application Support**: Guided benefit applications with document management
- **Privacy-First**: Zero-knowledge architecture (coming soon) ensures hosts can't see user data
- **Federated**: Run your own instance, share resources with trusted partners
- **Mobile & Web**: Progressive web app with iOS/Android support via Capacitor

## 🏗️ Architecture

FEED is designed as a **federated platform** where:
- Communities can run their own instances
- Instances share public resources (food banks, services) with each other
- User data stays local to their chosen instance
- No single point of failure - if one instance goes down, others keep working

### Tech Stack

- **Frontend**: Next.js 16 (React 19), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Mobile**: Capacitor (iOS/Android)
- **Maps**: Mapbox GL JS
- **AI**: OpenRouter (multi-provider LLM proxy)
- **Deployment**: Vercel (web) + Docker (self-hosted)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker Desktop (for local Supabase)
- Supabase account (or run locally)
- Mapbox account (free tier)
- OpenRouter API key (optional, for AI features)

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-org/feed.git
cd feed

# Install dependencies
npm install

# Copy environment template
cp apps/web/.env.local.example apps/web/.env.local

# Start local Supabase
npx supabase start

# Run database migrations
npx supabase db push

# Generate TypeScript types
npx supabase gen types typescript --local > packages/database/types.ts

# Start development server
npm run dev
```

Visit http://localhost:3000

### Environment Configuration

Edit `apps/web/.env.local` with your credentials:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Mapbox (required for maps)
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token

# OpenRouter (optional, for AI chat)
OPENROUTER_API_KEY=your-openrouter-key

# 211 API (optional, for resource sync)
API_211_KEY=your-211-api-key
```

See [SETUP.md](./docs/SETUP.md) for detailed setup instructions.

## 📖 Documentation

- **[Setup Guide](./docs/SETUP.md)** - Complete local development setup
- **[Deployment Guide](./specs/001-feed-platform/VOLUNTEER_DEPLOYMENT_GUIDE.md)** - Self-hosting instructions for volunteers
- **[Federation Protocol](./specs/001-feed-platform/FEDERATION_PROTOCOL.md)** - Technical specification for federated resource sharing
- **[Architecture](./specs/001-feed-platform/FEDERATION_ARCHITECTURE_SUMMARY.md)** - System design and architecture decisions
- **[Contributing](./CONTRIBUTING.md)** - How to contribute to FEED

## 🤝 Running Your Own Instance

FEED is designed for community hosting. See the [Volunteer Deployment Guide](./specs/001-feed-platform/VOLUNTEER_DEPLOYMENT_GUIDE.md) for step-by-step instructions on running your own FEED instance.

**Cost**: $0-$255/year depending on hosting provider and user count
**Time**: 30 minutes for experienced users, 2-3 hours for first-timers
**Skills**: Basic command-line knowledge helpful but not required

## 🔐 Privacy & Security

- **Row-Level Security**: Supabase RLS policies isolate user data
- **Encrypted Profiles**: Sensitive data (SSN, income) encrypted at rest
- **Zero-Knowledge (Coming Soon)**: Client-side encryption ensures hosts can't see user data
- **Federation Privacy**: Only public resources (food banks, services) are shared between instances
- **No Tracking**: User activity is not tracked across instances

See [SECURITY.md](./SECURITY.md) for our security practices and vulnerability reporting.

## 🗺️ Roadmap

### Current Status (v1.0-beta)
- ✅ Resource discovery with map view
- ✅ Community feed (posts, likes, comments)
- ✅ AI-assisted benefit eligibility chat
- ✅ Application forms with document upload
- ✅ Mobile app (iOS/Android)

### Phase 1: Federation (Weeks 1-24) 🚧 IN PROGRESS
- 🚧 Instance-to-instance resource sharing
- 🚧 Trust scoring and reputation system
- 🚧 Federated search across instances
- 🚧 WebFinger discovery protocol

### Phase 2: Zero-Knowledge Encryption (Weeks 25-34)
- ⏳ Client-side encryption for user data
- ⏳ OPAQUE password authentication
- ⏳ Encrypted form submissions
- ⏳ Key management in browser

### Phase 3: Advanced Features (Months 9-12)
- ⏳ Real-time chat between users
- ⏳ Event coordination
- ⏳ Volunteer matching
- ⏳ Impact tracking dashboard

## 🤝 Contributing

We welcome contributions from developers, designers, community organizers, and mutual aid practitioners!

**Ways to contribute**:
- 🐛 **Bug reports**: Open an issue describing the problem
- 💡 **Feature requests**: Share your ideas in discussions
- 🔧 **Code contributions**: Submit a pull request
- 📖 **Documentation**: Improve guides and tutorials
- 🌐 **Translation**: Help make FEED multilingual
- 🏃 **Host an instance**: Run FEED for your community

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## 📜 License

FEED is open-source software licensed under the [MIT License](./LICENSE).

This means you can:
- ✅ Use it for any purpose (personal, commercial, nonprofit)
- ✅ Modify it to fit your needs
- ✅ Distribute it to others
- ✅ Use it in proprietary software

No warranty is provided. See LICENSE file for full terms.

## 🙏 Acknowledgments

FEED is built with love by mutual aid organizers and technologists who believe in community self-sufficiency and data sovereignty.

**Core Technologies**:
- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Open-source Firebase alternative
- [Mapbox](https://www.mapbox.com/) - Mapping and location data
- [OpenRouter](https://openrouter.ai/) - Multi-provider LLM access

**Inspiration**:
- [Mastodon](https://joinmastodon.org/) - Federated social network model
- [211](https://www.211.org/) - Community resource database
- Mutual aid networks worldwide

## 📬 Contact

- **Discord**: [Join our community](https://discord.gg/feed-platform)
- **Email**: hello@feedplatform.org
- **GitHub**: [github.com/your-org/feed](https://github.com/your-org/feed)
- **Website**: [feedplatform.org](https://feedplatform.org)

## 🌍 Community Instances

Interested in federating with other FEED instances? Here are some community-run instances:

- **Oakland FEED**: oakland.feed.org (pilot instance)
- **Seattle FEED**: seattle.feed.org (pilot instance)
- **Chicago FEED**: chicago.feed.org (coming soon)

Want to add your instance to this list? Submit a PR updating this README!

---

**Built with ❤️ for communities, by communities**
