// apps/web/src/lib/official-english.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The language mark of text that mirrors an official English form: the SNAP and Medicaid
// templates' names, section headings, field labels, hints, option labels, required documents and
// certification text (lib/form-templates/*, lib/form-schemas.ts commonFields), and a government
// form's program name and form number (lib/government-forms.ts). They stay exactly as written, in
// English, by owner decision (pending: whether to show translations beside them), so a screen
// reader reads them with an English voice inside a translated surface.
//
// This is not an island awaiting translation (lib/i18n-feed-chrome.test.ts keeps that ledger):
// it is FEED's chrome around official text. Spread it on the element: <span {...OFFICIAL_ENGLISH}>.
// lib/official-english.test.ts lists every file that uses it.

export const OFFICIAL_ENGLISH = { lang: 'en', dir: 'ltr' } as const
