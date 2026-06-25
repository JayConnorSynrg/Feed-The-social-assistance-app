# FEED Platform - Production Launch Checklist

## Pre-Launch Verification (P6-T8)

### Build Verification
- [x] `npm run build` passes without errors
- [x] `npm run type-check` has 0 errors (if configured)
- [x] All TypeScript compilation successful
- [x] No console errors in production build

### Performance Verification
- [ ] Lighthouse Performance score > 90
- [ ] First Contentful Paint < 1.8s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Time to Interactive < 3.8s
- [ ] Cumulative Layout Shift < 0.1

### Security Verification
- [x] HTTPS configured (via hosting provider)
- [x] Security headers configured in next.config.ts
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: configured
- [x] No API keys exposed in client code
- [x] RLS policies on all Supabase tables
- [x] Environment variables properly configured

### Supabase Production Setup
- [ ] Production Supabase project created
- [ ] Production environment variables configured:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY (server only)
- [ ] Database migrations applied
- [ ] Storage buckets configured
- [ ] Edge Functions deployed
- [ ] RLS policies verified

### Fireworks/AI Setup
- [ ] FIREWORKS_API_KEY configured in Edge Function
- [ ] Rate limiting verified (20 req/min/user)
- [ ] Model cascade tested (qwen3p7-plus primary → gpt-oss-120b secondary)

### Feature Verification

#### Authentication
- [ ] Email signup works
- [ ] Email login works
- [ ] Google OAuth works (if configured)
- [ ] Password reset works
- [ ] Session persistence works
- [ ] Logout works

#### Feed
- [ ] Posts display correctly
- [ ] Post creation works
- [ ] Image uploads work
- [ ] Realtime updates work

#### Resources/Map
- [ ] Map renders
- [ ] Markers display
- [ ] Search works
- [ ] Directions open Maps app
- [ ] Resource submission works

#### Forms
- [ ] Form templates load
- [ ] Form filling works
- [ ] Autofill populates correctly
- [ ] Signature capture works
- [ ] Form submission saves
- [ ] Status tracking works

#### AI Chat
- [ ] Chat interface loads
- [ ] Messages send/receive
- [ ] Streaming works
- [ ] Guided flows work
- [ ] Crisis detection works

#### Dashboard
- [ ] Dashboard loads
- [ ] Applications list
- [ ] Application details
- [ ] Status updates work
- [ ] Document upload works
- [ ] Notifications work

### Mobile Verification
- [ ] iOS app builds successfully
- [ ] Android app builds successfully
- [ ] Deep linking works
- [ ] Push notifications work (if configured)
- [ ] Geolocation works
- [ ] Offline handling graceful

### User Dev Test Session (MANDATORY Before Submission)
Conduct a live test session with real users before any app store submission:

#### Test Session Setup
- [ ] Recruit 3-5 test users (ideally from target demographic)
- [ ] Prepare test devices (mix of iOS/Android, different screen sizes)
- [ ] Set up screen recording for each session
- [ ] Prepare feedback collection form

#### Core User Flows to Test
1. **Onboarding Flow** (10 min)
   - [ ] User can sign up successfully
   - [ ] Email verification works
   - [ ] Profile setup is intuitive
   - [ ] First-time user guidance is clear

2. **Resource Discovery Flow** (10 min)
   - [ ] User can find local resources
   - [ ] Map navigation is intuitive
   - [ ] Search/filter works as expected
   - [ ] Resource details are helpful

3. **Benefits Application Flow** (15 min)
   - [ ] User can find correct form
   - [ ] Autofill works correctly
   - [ ] Form sections are clear
   - [ ] Signature capture works
   - [ ] Submission confirms successfully

4. **AI Chat Flow** (10 min)
   - [ ] User can start a conversation
   - [ ] Responses are helpful
   - [ ] Guided flows make sense
   - [ ] Crisis resources display appropriately

5. **Dashboard/Case Management Flow** (10 min)
   - [ ] User can view their applications
   - [ ] Status updates are clear
   - [ ] Document upload works
   - [ ] Reminders can be set

#### Session Documentation
- [ ] Record all issues/bugs found
- [ ] Note confusion points and UX friction
- [ ] Collect Net Promoter Score (NPS)
- [ ] Gather open-ended feedback

#### Post-Session Actions
- [ ] Prioritize critical bugs for fixing
- [ ] Create tickets for UX improvements
- [ ] Update documentation based on confusion points
- [ ] Schedule follow-up session if major issues found

#### Acceptance Criteria
- [ ] All critical flows complete without errors
- [ ] No blockers that prevent core functionality
- [ ] Average user satisfaction score > 7/10
- [ ] Users can complete key tasks without assistance

### Monitoring Setup
- [ ] Error tracking (Sentry/LogRocket) configured
- [ ] Analytics configured
- [ ] Uptime monitoring configured
- [ ] Log aggregation configured

---

## Launch Day Procedures

### Pre-Launch (T-24 hours)
1. Final database backup
2. Verify all environment variables
3. Test critical user flows one more time
4. Prepare rollback plan

### Launch (T-0)
1. Deploy to production
2. Verify deployment successful
3. Test critical paths immediately
4. Monitor error rates

### Post-Launch (T+1 hour)
1. Check error monitoring
2. Review initial user feedback
3. Monitor server metrics
4. Verify email delivery

### Post-Launch (T+24 hours)
1. Comprehensive error review
2. Performance metrics review
3. User feedback analysis
4. Plan first patch if needed

---

## Rollback Plan

### If Critical Issues Found
1. **Immediate**: Revert to previous deployment
2. **Database**: Restore from pre-launch backup if needed
3. **Communication**: Update status page
4. **Analysis**: Document issues found

### Rollback Commands
```bash
# Vercel rollback
vercel rollback

# Database restore (if needed)
npx supabase db reset --db-url=$PRODUCTION_DATABASE_URL
```

---

## Success Metrics

### Week 1 Targets
- [ ] 0 critical bugs in production
- [ ] < 1% error rate
- [ ] > 50 user signups
- [ ] App Store reviews positive (4+ stars)

### Month 1 Targets
- [ ] > 500 active users
- [ ] > 100 form submissions
- [ ] > 50 resources added
- [ ] < 5% churn rate

---

## Support Channels

- **Email**: support@feedapp.example.com
- **Twitter**: @feedapp
- **Discord**: discord.gg/feedapp
- **Status Page**: status.feedapp.example.com

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| Tech Lead | [phone/email] |
| DevOps | [phone/email] |
| Product | [phone/email] |

---

## Version Information

- **App Version**: 1.0.0
- **Build Date**: 2026-01-22
- **Next.js Version**: 16.1.4
- **Supabase Version**: 2.90.1
- **Capacitor Version**: 6.x
