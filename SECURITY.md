# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

FEED takes security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to: [security@feed-platform.org] (configure this)
3. Include detailed steps to reproduce the vulnerability
4. Allow up to 48 hours for initial response

### What to Include

- Type of vulnerability (XSS, SQL injection, authentication bypass, etc.)
- Steps to reproduce
- Potential impact assessment
- Any suggested fixes (optional)

## Security Practices

### Environment Variables

**NEVER commit secrets to the repository.**

Required secrets (configure in deployment environment):
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side only
- `FIREWORKS_API_KEY` - AI features
- `API_211_KEY` - Resource discovery
- `NEXT_PUBLIC_MAPBOX_TOKEN` - Maps (public but rate-limited)

### Authentication

- All authentication handled by Supabase Auth
- Row Level Security (RLS) enforced on all tables
- Session tokens expire after 1 hour
- Refresh tokens expire after 7 days

### Data Protection

- PII encrypted at rest using AES-256
- All API calls over HTTPS
- CORS restricted to authorized domains
- CSP headers enforced

### API Security

- Rate limiting on all endpoints
- Input validation on all user inputs
- SQL injection prevention via parameterized queries
- XSS prevention via output encoding

## Development Guidelines

### Before Committing

1. Run `git diff` to review changes
2. Ensure no `.env` files are staged
3. Check for hardcoded credentials: `grep -r "sk-\|password\|secret" --include="*.ts"`
4. Run security linter if available

### Code Review Checklist

- [ ] No hardcoded credentials
- [ ] Input validation present
- [ ] Output encoding for user content
- [ ] Parameterized queries only
- [ ] Proper error handling (no stack traces to users)
- [ ] Authentication checks on protected routes
- [ ] Authorization checks (RLS policies)

## Compliance Considerations

FEED handles sensitive user data for benefit applications. Consider:

- **HIPAA**: If handling health information
- **PCI-DSS**: If handling payment data
- **State Privacy Laws**: California CCPA, etc.
- **ADA/Section 508**: Accessibility requirements

## Infrastructure Security (Production)

Recommended production setup:
- Vercel/Railway with automatic HTTPS
- Supabase with enforced SSL connections
- WAF (Web Application Firewall) enabled
- DDoS protection
- Regular automated backups
- Audit logging enabled

## Incident Response

1. **Identify** - Confirm and scope the incident
2. **Contain** - Limit damage and prevent spread
3. **Eradicate** - Remove the threat
4. **Recover** - Restore normal operations
5. **Document** - Record lessons learned

---

Last updated: 2026-01-31
