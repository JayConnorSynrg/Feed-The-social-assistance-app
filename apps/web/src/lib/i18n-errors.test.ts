// apps/web/src/lib/i18n-errors.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The error screens' own words (lib/i18n-errors.ts) keep the parity rules in the 14 FEED locales.

import { vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { describeDictionaryParity } from '@/test/dictionary-parity'
import { errorsMessages, errorsT } from './i18n-errors'

describeDictionaryParity('error screens', errorsMessages, errorsT)
