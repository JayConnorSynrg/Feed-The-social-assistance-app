# FEED Platform - Volunteer Deployment Guide

**Your Community, Your Data, Your Privacy**

**Version**: 1.0.0
**Last Updated**: 2026-02-05
**Target Audience**: Community organizers, non-profits, activists with minimal technical skills

---

## What is FEED?

FEED (Food, Education, Employment, and Development) is a mutual aid resource sharing platform that helps communities connect people to benefits, resources, and support services.

**What makes FEED special:**
- **Zero-knowledge encryption** - You host it, but you CAN'T see user data
- **Federation support** - Connect with other FEED instances to share resources
- **Community-first** - Designed for grassroots organizing, not big tech
- **100% free and open source** - No hidden costs, no vendor lock-in

---

## Table of Contents

1. [What You Need (Before You Start)](#1-what-you-need-before-you-start)
2. [Quick Start (5 Commands to Running Instance)](#2-quick-start-5-commands-to-running-instance)
3. [Configuration (Explained Simply)](#3-configuration-explained-simply)
4. [Federation Setup (Connect with Other Communities)](#4-federation-setup-connect-with-other-communities)
5. [Maintenance (Keep Things Running)](#5-maintenance-keep-things-running)
6. [Troubleshooting (When Things Go Wrong)](#6-troubleshooting-when-things-go-wrong)
7. [Understanding Zero-Knowledge (Why You Can't See Data)](#7-understanding-zero-knowledge-why-you-cant-see-data)

---

## 1. What You Need (Before You Start)

### Prerequisites Checklist

Print this list and check off items as you get them:

- [ ] **A computer or server** (Mac, Windows, Linux, or cloud server)
  - **Minimum**: 2 CPU cores, 4GB RAM, 20GB storage
  - **Recommended**: 4 CPU cores, 8GB RAM, 50GB storage
  - **Time to get**: 0 minutes (you already have this) or 10 minutes (rent cloud server)

- [ ] **A domain name** (like `yourtown.feed.social`)
  - **Cost**: $10-15/year
  - **Where to get**: Namecheap, Google Domains, Cloudflare
  - **Time to get**: 5 minutes

- [ ] **Docker installed** (a tool to run containers)
  - **Cost**: Free
  - **Where to get**: https://www.docker.com/get-started
  - **Time to install**: 10 minutes

- [ ] **Basic accounts** (optional but recommended):
  - [ ] Google OAuth (for "Sign in with Google")
    - **Cost**: Free
    - **Where**: https://console.cloud.google.com
    - **Time**: 15 minutes
  - [ ] Mapbox account (for maps)
    - **Cost**: Free up to 50,000 map loads/month
    - **Where**: https://www.mapbox.com
    - **Time**: 5 minutes

### Cost Breakdown

| Item | Cost | Frequency |
|------|------|-----------|
| **Domain name** | $10-15 | Per year |
| **Server hosting** | $5-20 | Per month |
| **SSL certificate** | $0 (free with Let's Encrypt) | - |
| **Google OAuth** | $0 | - |
| **Mapbox** | $0 (free tier) | - |
| **TOTAL (first year)** | **$70-255** | - |

**Budget-friendly option**: Use a free Oracle Cloud server (always free tier) + Cloudflare domain = **~$10/year total**

### Time Estimate

- **First-time setup**: 2-3 hours
- **Once you know what you're doing**: 30 minutes
- **Weekly maintenance**: 5-10 minutes

---

## 2. Quick Start (5 Commands to Running Instance)

**Don't worry if you've never used a "terminal" or "command line" before!** This section will guide you step-by-step.

### What is a Terminal?

A terminal (also called "command prompt" on Windows or "Terminal" on Mac) is a text-based way to talk to your computer. Instead of clicking buttons, you type commands.

**How to open a terminal:**
- **Mac**: Press `Cmd + Space`, type "Terminal", press Enter
- **Windows**: Press `Windows + R`, type "cmd", press Enter
- **Linux**: Press `Ctrl + Alt + T`

### Step 1: Download FEED

Open your terminal and type this command (then press Enter):

```bash
git clone https://github.com/feed-platform/feed.git
cd feed
```

**What this does**: Downloads the FEED code to your computer and moves into that folder.

**Time**: 1-2 minutes

### Step 2: Install Docker

If you don't have Docker yet, install it:
- **Mac/Windows**: Download from https://www.docker.com/get-started
- **Linux**: Run this command:
  ```bash
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  ```

**What Docker does**: Think of Docker as a "lunchbox" that contains everything FEED needs to run. You don't have to install a bunch of complicated software piece by piece - Docker packages it all together.

**Time**: 10 minutes

### Step 3: Generate Encryption Keys

```bash
npm run federation:generate-keys
```

**What this does**: Creates two special files:
- `private_key.pem` - A secret key (NEVER share this)
- `public_key.pem` - A public key (safe to share)

These keys ensure your instance can talk securely to other FEED instances.

**Time**: 10 seconds

### Step 4: Configure Your Instance

Create a file called `.env` (yes, the name starts with a dot):

```bash
cp .env.example .env
nano .env
```

**What this does**: Opens a text editor where you'll fill in your settings. Don't panic - we'll explain each setting in the next section.

**Time**: 10 minutes (see Section 3 for details)

### Step 5: Start FEED

```bash
docker-compose up -d
```

**What this does**: Starts FEED in the background. The `-d` means "detached" (runs without blocking your terminal).

**Time**: 2-5 minutes (first time is slower)

### Step 6: Verify It's Running

```bash
docker-compose ps
```

You should see something like:

```
NAME                STATUS
feed-web            Up 2 minutes
feed-postgres       Up 2 minutes
feed-redis          Up 2 minutes
```

**Congratulations!** Your FEED instance is running at http://localhost:3000

**Next**: Point your domain name to your server's IP address (ask your domain registrar how to do this).

---

## 3. Configuration (Explained Simply)

When you edit your `.env` file (from Step 4 above), you'll see lots of settings. Here's what each one means **in plain English**:

### Required Settings (You MUST set these)

```bash
# Your website address (replace with your domain)
NEXT_PUBLIC_APP_URL=https://yourtown.feed.social

# Your instance name (what people will see)
NEXT_PUBLIC_INSTANCE_NAME=Your Town FEED

# Your city/state/country
NEXT_PUBLIC_INSTANCE_CITY=Oakland
NEXT_PUBLIC_INSTANCE_STATE=CA
NEXT_PUBLIC_INSTANCE_COUNTRY=US

# Instance description
NEXT_PUBLIC_INSTANCE_DESCRIPTION=Mutual aid resource sharing for Oakland
```

**What these do**: These tell people what your FEED instance is called and where it serves.

### Database Settings (Auto-generated, don't change)

```bash
# Database password (automatically generated)
POSTGRES_PASSWORD=automatically-generated-secure-password

# Secret key for authentication (automatically generated)
JWT_SECRET=automatically-generated-secret
```

**What these do**: These are secret passwords that keep your database secure. The setup script creates these automatically - you don't need to change them.

### Optional Settings (Make FEED better, but not required)

```bash
# Google Sign-In (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Mapbox (for maps)
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token

# OpenRouter (for AI features)
OPENROUTER_API_KEY=your-openrouter-key
```

**What these do**:
- **Google Sign-In**: Let users log in with their Google account (easier than remembering another password)
- **Mapbox**: Show resources on a map
- **OpenRouter**: Enable AI chat assistant (helps users find resources)

**How to get these**:
- Google: https://console.cloud.google.com (see "Getting Google OAuth Credentials" below)
- Mapbox: https://www.mapbox.com (free tier available)
- OpenRouter: https://openrouter.ai (pay-as-you-go, ~$0.10 per 1000 messages)

### Getting Google OAuth Credentials

1. Go to https://console.cloud.google.com
2. Click "Create Project"
3. Name your project (e.g., "Oakland FEED")
4. Click "Credentials" in the left sidebar
5. Click "Create Credentials" > "OAuth Client ID"
6. Choose "Web application"
7. Add authorized redirect URI: `https://yourtown.feed.social/auth/callback/google`
8. Copy the "Client ID" and "Client Secret" into your `.env` file

**Time**: 15 minutes (first time)

---

## 4. Federation Setup (Connect with Other Communities)

**What is Federation?**

Think of federation like email:
- You can have Gmail and send emails to someone using Outlook
- Similarly, your FEED instance (Oakland) can share resources with another FEED instance (Seattle)

This means if someone in Oakland searches for food banks, they can also see food banks from Seattle if Seattle's FEED instance has federated with yours.

### Why Federate?

- **Bigger network**: More resources for your community
- **Mutual aid**: Help other communities and get help from them
- **Resilience**: If one instance goes down, others keep working
- **No central authority**: No single company or organization controls the network

### How to Add a Federation Partner

**Step 1: Generate Your Keys** (you did this in Step 3 of Quick Start)

**Step 2: Exchange Public Keys**

Contact the administrator of another FEED instance and:
1. Give them your **public key** (from `public_key.pem`)
2. Get their **public key**
3. Get their instance URL (e.g., `https://seattle.feed.social`)

**Step 3: Add the Partner**

```bash
npm run federation:add-instance -- \
  --domain seattle.feed.social \
  --name "Seattle FEED" \
  --contact admin@seattle.feed.social \
  --public-key "$(cat their-public-key.pem)"
```

**What this does**: Registers Seattle's FEED instance so your instance can pull resources from them.

**Step 4: Test the Connection**

```bash
npm run federation:test -- --instance seattle.feed.social
```

You should see:
```
✅ Connection successful
✅ Resources syncing: 247 resources found
✅ Trust score: 0.95 (excellent)
```

**Step 5: Set Up Automatic Sync**

Add this to your cron job (runs every 15 minutes):

```bash
# Edit your crontab
crontab -e

# Add this line:
*/15 * * * * cd /path/to/feed && npm run federation:sync
```

**What this does**: Every 15 minutes, your instance will check for new resources from federated instances.

**Time**: 30 minutes (first time), 5 minutes per additional instance

### Federation Trust System

FEED uses a **web of trust** to prevent spam and malicious content:

- **Trust score** ranges from 0.0 (untrustworthy) to 1.0 (fully trusted)
- New instances start at 0.5 (neutral)
- Trust score increases with:
  - Uptime (instance stays online)
  - Data quality (resources are accurate)
  - Community reports (users say resources are helpful)
  - Longevity (instance has been around longer)

**You can manually adjust trust scores:**

```bash
npm run federation:set-trust -- \
  --instance seattle.feed.social \
  --trust 0.8 \
  --reason "Verified by phone call with admin"
```

### Blocking an Instance

If an instance starts sending spam or bad data:

```bash
npm run federation:block -- \
  --domain spammy.feed.social \
  --reason "Spam resources" \
  --evidence "500+ fake food bank listings"
```

**What this does**: Your instance will stop syncing from that instance and warn other federated instances.

---

## 5. Maintenance (Keep Things Running)

### Daily Tasks (Automated - No Action Needed)

These happen automatically:
- Resource sync (every 15 minutes)
- Health checks (every 5 minutes)
- Database backups (daily at 2am)
- Log rotation (daily)

### Weekly Tasks (5-10 minutes)

**Check Instance Health**

```bash
npm run health-check
```

Expected output:
```
✅ Web server: Running
✅ Database: Healthy (disk 45% full)
✅ Redis: Healthy
✅ Federation sync: 3 instances, all healthy
⚠️  Warning: Disk usage above 80% - consider cleanup
```

**Review Logs**

```bash
npm run logs -- --tail 100
```

Look for errors (lines starting with `ERROR` or `WARN`).

**Update FEED**

```bash
git pull origin main
docker-compose down
docker-compose up -d
```

**What this does**: Downloads the latest version of FEED and restarts your instance.

**Time**: 5 minutes

### Monthly Tasks (30 minutes)

**Database Cleanup**

```bash
npm run db:vacuum
```

**What this does**: Optimizes your database (like defragmenting a hard drive).

**Security Updates**

```bash
docker-compose pull
docker-compose up -d
```

**What this does**: Updates Docker images to get security patches.

**Backup Verification**

Test that your backups actually work:

```bash
npm run backup:test
```

### Quarterly Tasks (1 hour)

**Review Trust Scores**

```bash
npm run federation:trust-scores
```

Adjust trust scores if needed.

**User Feedback**

Survey your users: "Is FEED helpful? What can we improve?"

**Capacity Planning**

Check if you need more server resources:

```bash
npm run capacity:report
```

Example output:
```
Current usage:
- CPU: 35% average
- RAM: 60% (4.8GB / 8GB)
- Disk: 45% (22GB / 50GB)

Forecast (3 months):
- Users: 150 → 300
- Resources: 1200 → 2400
- Recommendation: Upgrade to 16GB RAM by June
```

---

## 6. Troubleshooting (When Things Go Wrong)

### Common Issues

#### Issue 1: "Can't connect to FEED"

**Symptoms**: Website doesn't load, shows "connection refused"

**Possible causes**:
- Docker isn't running
- Firewall blocking port 3000
- Domain name not pointing to your server

**How to fix**:

1. Check if Docker is running:
   ```bash
   docker-compose ps
   ```
   If nothing appears, start Docker:
   ```bash
   docker-compose up -d
   ```

2. Check firewall:
   ```bash
   # On Linux
   sudo ufw allow 3000
   ```

3. Check domain name:
   ```bash
   ping yourtown.feed.social
   ```
   Should show your server's IP address.

**Time to fix**: 5-10 minutes

---

#### Issue 2: "Federation not syncing"

**Symptoms**: Resources from other instances don't appear

**Possible causes**:
- Network connectivity issue
- Wrong public key
- Other instance is offline

**How to fix**:

1. Test connection:
   ```bash
   npm run federation:test -- --instance seattle.feed.social
   ```

2. Check logs:
   ```bash
   npm run federation:logs -- --instance seattle.feed.social
   ```

3. Manually trigger sync:
   ```bash
   npm run federation:sync -- --instance seattle.feed.social
   ```

**Time to fix**: 10-15 minutes

---

#### Issue 3: "Running out of disk space"

**Symptoms**: Instance slows down, warning messages about disk space

**Possible causes**:
- Old logs taking up space
- Database growing too large
- Docker images not cleaned up

**How to fix**:

1. Clean up old logs:
   ```bash
   npm run logs:cleanup -- --older-than 30days
   ```

2. Vacuum database:
   ```bash
   npm run db:vacuum
   ```

3. Remove unused Docker images:
   ```bash
   docker system prune -a
   ```

**Time to fix**: 10 minutes

---

#### Issue 4: "Users can't log in"

**Symptoms**: Login button doesn't work, error messages on login

**Possible causes**:
- Google OAuth misconfigured
- JWT secret changed
- Session cookies blocked

**How to fix**:

1. Verify OAuth settings:
   ```bash
   npm run verify:oauth
   ```

2. Check redirect URI:
   - Go to Google Cloud Console
   - Verify redirect URI matches: `https://yourtown.feed.social/auth/callback/google`

3. Clear browser cookies and try again

**Time to fix**: 15 minutes

---

#### Issue 5: "High memory usage"

**Symptoms**: Instance slow, "out of memory" errors

**Possible causes**:
- Too many resources in database
- Memory leak in code
- Not enough RAM for number of users

**How to fix**:

1. Check memory usage:
   ```bash
   docker stats
   ```

2. Restart services:
   ```bash
   docker-compose restart
   ```

3. If problem persists, upgrade server RAM or reduce resource sync frequency.

**Time to fix**: 10 minutes (restart) or 1 hour (upgrade server)

---

### Getting Help

If you can't fix an issue:

1. **Check documentation**: https://docs.feed.social
2. **Ask community**: Discord: https://discord.gg/feed-platform
3. **GitHub issues**: https://github.com/feed-platform/feed/issues
4. **Email support**: support@feed.social (volunteers, please be patient)

**When asking for help, include**:
- What you were trying to do
- What actually happened
- Error messages (copy and paste)
- Your Docker version: `docker --version`
- Your FEED version: `git log -1 --oneline`

---

## 7. Understanding Zero-Knowledge (Why You Can't See Data)

### What is Zero-Knowledge Hosting?

**Simple explanation**: You're like a mailman who delivers locked boxes. You can see:
- How many boxes there are
- When boxes were delivered
- How big boxes are

But you **can't see inside the boxes** because users hold the only keys.

### Why This Matters

**Scenario**: The government or a lawyer asks you for user data.

**Your response**: "I don't have it. All data is encrypted, and only users have the keys."

This protects:
- **Users**: Their sensitive information (income, SSN, housing status) is private
- **You**: You can't be forced to hand over data you don't have
- **The movement**: Mutual aid organizing can't be disrupted by seizing servers

### What You CAN See

As a volunteer host, you can see:
- **Metadata**: Number of users, posts, resources
- **Timestamps**: When things were created
- **Relationships**: User X created Post Y (but not the content of Post Y)
- **Performance metrics**: CPU, memory, disk usage
- **Error logs**: Technical errors (no user data in logs)

**Example**: You can see "User 12345 created a post at 2pm" but NOT "User 12345 posted 'I need help with rent'".

### What You CAN'T See

- Post content (encrypted)
- Form submissions (encrypted)
- Chat messages (encrypted)
- Documents (encrypted)
- Personal info in profiles (encrypted)

### How Encryption Works (Non-Technical Explanation)

**Step 1: User creates account**
- User sets password
- Browser generates a secret key (never leaves the browser)
- Key stored in browser's secure storage

**Step 2: User creates a post**
- Post typed in browser: "I need help with rent"
- Browser encrypts it: "a9f4h28x..." (gibberish)
- Encrypted post sent to your server
- Your database stores: "a9f4h28x..." (still gibberish to you)

**Step 3: User reads their post**
- Browser requests encrypted post: "a9f4h28x..."
- Browser decrypts with secret key: "I need help with rent"
- User sees their original post

**Your server never has the secret key**, so it can never decrypt the post.

### Trust But Verify

**Question**: "How do I know you're actually using zero-knowledge encryption?"

**Answer**: The code is open source. Security researchers have audited it. You can:
1. Look at the code: https://github.com/feed-platform/feed
2. Check the database: All sensitive fields are encrypted ciphertext
3. Try to decrypt data: You won't be able to (no keys)

### Tradeoffs of Zero-Knowledge

**Benefits**:
- Maximum user privacy
- Legal protection for hosts
- Can't be forced to censor content (you can't read it)

**Limitations**:
- You can't search encrypted content (only users can)
- No "forgot password" recovery (if user loses password, data is lost)
- Slight performance overhead (encryption takes time)

### Transparency Report

FEED publishes a transparency report showing:
- Number of government requests for data (answer: always zero useful data)
- Number of instances suspended (and why)
- Security audits and findings

See: https://feed.social/transparency

---

## Appendix A: Helpful Commands Reference

### Instance Management

```bash
# Start FEED
docker-compose up -d

# Stop FEED
docker-compose down

# Restart FEED
docker-compose restart

# View logs
docker-compose logs -f

# Update FEED
git pull && docker-compose up -d
```

### Database

```bash
# Backup database
npm run db:backup

# Restore database
npm run db:restore -- --file backup-2026-02-05.sql

# Vacuum (optimize)
npm run db:vacuum

# Check size
npm run db:size
```

### Federation

```bash
# Add instance
npm run federation:add-instance -- --domain example.com --name "Example"

# Sync now
npm run federation:sync

# Check trust scores
npm run federation:trust-scores

# Block instance
npm run federation:block -- --domain spammy.com --reason "Spam"
```

### Monitoring

```bash
# Health check
npm run health-check

# Disk usage
df -h

# Memory usage
free -h

# Docker stats
docker stats

# Active users (last 24h)
npm run stats:users -- --last 24h
```

---

## Appendix B: Resources and Support

### Official Resources

- **Documentation**: https://docs.feed.social
- **GitHub**: https://github.com/feed-platform/feed
- **Discord**: https://discord.gg/feed-platform
- **Twitter**: @feed_platform

### Community

- **Forum**: https://forum.feed.social
- **Monthly community call**: First Tuesday of each month, 6pm Pacific
- **Volunteer Slack**: (invitation required, ask in Discord)

### Learning Resources

- **Docker basics**: https://docker-curriculum.com
- **Linux command line**: https://linuxjourney.com
- **SSL certificates**: https://letsencrypt.org/getting-started

### Professional Support

Need help setting up? Paid support available:
- **One-time setup**: $200 (includes domain, SSL, configuration)
- **Monthly maintenance**: $50/month (monitoring, updates, backups)
- **Enterprise support**: Custom pricing

Contact: support@feed.social

---

## Appendix C: FAQ

### General Questions

**Q: How is FEED different from Facebook Groups or Discord?**

A: FEED is specifically designed for mutual aid and resource sharing. It includes:
- Map-based resource discovery
- Integration with 211 databases
- Form generation for benefit applications
- AI-powered assistance
- Zero-knowledge encryption
- Federation (no single company controls it)

**Q: Can I customize FEED for my community?**

A: Yes! The code is open source. You can:
- Change the logo and colors
- Add custom resource categories
- Integrate with local databases
- Translate to other languages

**Q: What if my community is too small?**

A: That's fine! Even a small FEED instance (10-20 users) provides value. You can federate with larger instances to access more resources.

**Q: How do I get more people to use it?**

A: Best practices:
- Partner with local organizations (food banks, libraries, churches)
- Do in-person onboarding (help people create accounts)
- Share success stories
- Print QR codes linking to your instance

### Technical Questions

**Q: Do I need to know how to code?**

A: No! This guide is designed for non-technical people. However, basic command line skills are helpful. If you can follow a recipe, you can deploy FEED.

**Q: Can I run FEED on my laptop?**

A: Yes for testing, but not recommended for production. Users expect 24/7 availability. Use a cloud server or dedicated computer.

**Q: What happens if my server crashes?**

A:
1. User data is NOT lost (it's encrypted in their browsers)
2. You restore from backups (run daily)
3. Federated instances continue working
4. Users can temporarily use another instance

**Q: How do I upgrade FEED to a new version?**

A:
```bash
git pull origin main
docker-compose down
docker-compose up -d
```

We announce breaking changes in advance and provide migration guides.

**Q: Can I host multiple communities on one server?**

A: Yes, but each needs its own domain name and configuration. Use Docker networks to isolate them.

### Privacy and Security Questions

**Q: Is FEED really private?**

A: Yes, with caveats:
- **Content**: Encrypted, you can't see it
- **Metadata**: Not encrypted (who posted, when, relationships)
- **Network traffic**: Use HTTPS to prevent eavesdropping
- **Browser security**: If user's device is compromised, attacker can steal keys

**Q: What if law enforcement asks for data?**

A: You can provide:
- Metadata (timestamps, user IDs)
- Encrypted data (useless without keys)

You **cannot** provide:
- Decrypted content (you don't have keys)
- User passwords (hashed)

Consult a lawyer in your jurisdiction.

**Q: Can you add a "backdoor" to access data?**

A: No. The encryption happens on the client side (user's browser), before data reaches your server. Even if someone compromised your server, they couldn't decrypt data.

**Q: What about AI content moderation?**

A: Since content is encrypted, automated moderation isn't possible. FEED relies on:
- User reports
- Community guidelines
- Manual review by instance admins (when users report content, they temporarily decrypt it for you)

### Federation Questions

**Q: How do I find other instances to federate with?**

A:
- Check the public instance directory: https://feed.social/instances
- Ask in Discord #federation channel
- Attend monthly community calls
- Contact local mutual aid networks

**Q: What if a federated instance shuts down?**

A: Your instance continues working. Resources from that instance become "stale" and eventually hidden. Your users aren't affected.

**Q: Can I federate with ActivityPub (Mastodon, etc.)?**

A: Not yet, but it's on the roadmap for 2026. FEED currently uses a custom federation protocol optimized for resource sharing.

**Q: How do I stop federating with an instance?**

A:
```bash
npm run federation:remove -- --instance example.com
```

---

## Appendix D: Deployment Checklist

Use this checklist to ensure you haven't missed anything:

### Pre-Deployment

- [ ] Server or computer ready (4GB+ RAM, 20GB+ storage)
- [ ] Domain name purchased and DNS configured
- [ ] Docker installed and running
- [ ] Git installed
- [ ] `.env` file configured
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] Firewall configured (allow ports 80, 443, 3000)

### Initial Setup

- [ ] FEED code downloaded (`git clone`)
- [ ] Federation keys generated
- [ ] Database initialized
- [ ] First admin account created
- [ ] Test post created
- [ ] Google OAuth configured (optional)
- [ ] Mapbox token added (optional)

### Going Live

- [ ] Domain name points to server IP
- [ ] HTTPS working (green lock in browser)
- [ ] Health check passing (`npm run health-check`)
- [ ] Test user signup flow
- [ ] Test resource creation
- [ ] Test search functionality
- [ ] Test map display (if Mapbox configured)

### Post-Deployment

- [ ] Automated backups configured
- [ ] Monitoring set up (uptime alerts)
- [ ] Federation cron job running
- [ ] Community guidelines published
- [ ] Contact information updated
- [ ] Instance registered in public directory
- [ ] First federation partner added

### Ongoing

- [ ] Weekly health checks
- [ ] Monthly updates
- [ ] Quarterly user surveys
- [ ] Annual security audit

---

## Appendix E: Cost Calculator

Use this to estimate your costs:

### Cloud Server Options

| Provider | Plan | CPU | RAM | Storage | Cost/month |
|----------|------|-----|-----|---------|------------|
| **Oracle Cloud** | Free tier | 1 | 1GB | 50GB | $0 |
| **DigitalOcean** | Droplet | 1 | 1GB | 25GB | $6 |
| **Linode** | Nanode | 1 | 1GB | 25GB | $5 |
| **Hetzner** | CX11 | 1 | 2GB | 20GB | $4 |
| **DigitalOcean** | Droplet | 2 | 2GB | 50GB | $12 |
| **Linode** | Linode 2GB | 1 | 2GB | 50GB | $12 |
| **Hetzner** | CX21 | 2 | 4GB | 40GB | $6 |
| **AWS Lightsail** | $3.50 | 1 | 512MB | 20GB | $3.50 |

**Recommendation for small communities (< 100 users)**: Hetzner CX21 ($6/month)
**Recommendation for medium communities (100-500 users)**: DigitalOcean $18/month (2 CPU, 4GB RAM)

### Annual Cost Example (Small Community)

| Item | Cost |
|------|------|
| Domain name (Namecheap) | $12 |
| Server (Hetzner CX21 × 12 months) | $72 |
| SSL certificate (Let's Encrypt) | $0 |
| Google OAuth | $0 |
| Mapbox (free tier) | $0 |
| OpenRouter AI (~1000 messages/month) | $1.20 |
| **TOTAL** | **$85.20/year** |

**Per user per year** (100 users): **$0.85**

Compare to:
- Slack: $8/user/month = $960/year
- Discord Nitro: $10/month = $120/year
- Facebook Groups: "Free" (but you're the product)

---

## Conclusion

You've made it to the end! You're now equipped to:
- Deploy your own FEED instance
- Configure it for your community
- Understand zero-knowledge encryption
- Federate with other instances
- Maintain and troubleshoot your instance

**Remember**: You're not alone. Thousands of volunteers run FEED instances worldwide. Join the Discord, attend community calls, and help each other out.

**Your community deserves privacy, dignity, and mutual aid.** Thank you for hosting FEED.

---

**Questions?** support@feed.social | https://discord.gg/feed-platform

**Want to contribute?** https://github.com/feed-platform/feed

**Donate?** https://opencollective.com/feed-platform

---

**Document version**: 1.0.0
**Last updated**: 2026-02-05
**License**: CC BY-SA 4.0 (share and adapt freely, with attribution)
