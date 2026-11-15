// apps/web/src/lib/i18n-onboarding.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The onboarding words (lib/i18n-onboarding.ts) in the 14 FEED locales keep the parity rules. The
// page itself — its language marks, focus, alerts and the values it saves — is tested in a real DOM
// by app/(auth)/onboarding/onboarding.i18n.dom.test.ts.

import { vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { describeDictionaryParity } from '@/test/dictionary-parity'
import { onboardingMessages, onboardingT } from './i18n-onboarding'

// A city name several languages write as English does.
describeDictionaryParity('onboarding', onboardingMessages, onboardingT, new Set(['Los Angeles']))
