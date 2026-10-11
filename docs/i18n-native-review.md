# Native-speaker review list

FEED ships its interface in 14 languages. Four of them were drafted by machine and still need a
native speaker to read them: Haitian Creole (`ht`), Somali (`so`), Amharic (`am`) and Hmong (`hmn`).
This file is the one list of what awaits that review.

## How to use it

- **Reviewing.** Read the `Text` column beside its `English` source. If the text is right, change
  the row's `Status` to `reviewed YYYY-MM-DD, <name>`. If it needs a change, edit the string in the
  file named by the section heading, then run the update command below; the row comes back as a new
  draft with today's date.
- **Adding or changing a string.** Every new or changed `ht`, `so`, `am` or `hmn` string needs a row.
  The generated part is kept equal to the dictionaries by
  `apps/web/src/lib/i18n-native-review.test.ts`, which fails when a string has no matching row.
  Update it from `apps/web`:

  ```bash
  UPDATE_I18N_REVIEW=1 npx vitest run src/lib/i18n-native-review.test.ts
  ```

  An unchanged row keeps its date and status. A new dictionary joins the list by adding one line to
  `expectedRows()` in that test.
- **Status values.** `machine-drafted, needs native review` (the default), `reviewed <date>, <name>`,
  or a note saying why no review is needed (for example data taken from CLDR).

## Strings awaiting review, by file and key

<!-- BEGIN GENERATED: lib/i18n-native-review.test.ts -->

### `lib/i18n-intl.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `TIME_WORDS.months` | ht | Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec | jan, fev, mas, avr, me, jen, jiy, out, sep, okt, nov, des | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.date` | ht | {month} {day}, {year} | {day} {month} {year} | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.clock` | ht | {hour}:{minute} {period} | {hour}:{minute} {period} | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.am` | ht | AM | AM | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.pm` | ht | PM | PM | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.past.minute.other` | ht | {n} minutes ago | Sa gen {n} minit | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.past.hour.other` | ht | {n} hours ago | Sa gen {n} èdtan | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.past.day.other` | ht | {n} days ago | Sa gen {n} jou | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.months` | hmn | Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec | Ib Hlis, Ob Hlis, Peb Hlis, Plaub Hlis, Tsib Hlis, Rau Hli, Xya Hli, Yim Hli, Cuaj Hli, Kaum Hli, Kaum Ib Hlis, Kaum Ob Hlis | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.date` | hmn | {month} {day}, {year} | Lub {month} {day}, {year} | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.clock` | hmn | {hour}:{minute} {period} | {hour}:{minute} {period} | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.am` | hmn | AM | AM | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.pm` | hmn | PM | PM | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.past.minute.other` | hmn | {n} minutes ago | {n} feeb dhau los | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.past.hour.other` | hmn | {n} hours ago | {n} teev dhau los | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.past.day.other` | hmn | {n} days ago | {n} hnub dhau los | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.months` | so | Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec | Jan, Feb, Mar, Abr, May, Jun, Lul, Ogs, Seb, Okt, Nof, Dis | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.date` | so | {month} {day}, {year} | {month} {day}, {year} | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.clock` | so | {hour}:{minute} {period} | {hour}:{minute} {period} | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.am` | so | AM | GH | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.pm` | so | PM | GD | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.past.minute.one` | so | {n} minutes ago | {n} daqiiqad kahor | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.past.minute.other` | so | {n} minutes ago | {n} daqiiqadood kahor | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.past.hour.one` | so | {n} hours ago | {n} saacad kahor | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.past.hour.other` | so | {n} hours ago | {n} saacadood kahor | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.past.day.one` | so | {n} days ago | {n} maalin kahor | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.past.day.other` | so | {n} days ago | {n} maalmood kahor | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |

<!-- END GENERATED -->

## Dictionaries written before this list existed

These carry the same note in their file header and are not yet itemised here. All four locales of
each are machine-drafted, needs native review. Itemise one by adding it to `expectedRows()`.

| Dictionary | Keys | Locales | Status |
|---|---|---|---|
| `lib/i18n.ts` | 19 | ht, so, am, hmn | machine-drafted, needs native review |
| `lib/i18n-feed-chrome.ts` | 26 | ht, so, am, hmn | machine-drafted, needs native review |
| `lib/i18n-feed-card.ts` | 88 | ht, so, am, hmn | machine-drafted, needs native review |
| `lib/i18n-feed-composer.ts` | 98 | ht, so, am, hmn | machine-drafted, needs native review |
| `lib/i18n-feed-comments.ts` | 40 | ht, so, am, hmn | machine-drafted, needs native review |
| `lib/i18n-feed-edit.ts` | 124 | ht, so, am, hmn | machine-drafted, needs native review |
| `lib/i18n-resource-categories.ts` | 25 | ht, so, am, hmn | machine-drafted, needs native review |
| `lib/i18n-event-forms.ts` | 201 | ht, so, am, hmn | machine-drafted, needs native review |
| `lib/i18n-event-member.ts` | 33 | ht, so, am, hmn | machine-drafted, needs native review |
| `lib/i18n-map-member.ts` | 1 | ht, so, am, hmn | machine-drafted, needs native review |
| `lib/i18n-admin-nav.ts` | 17 | ht, so, am, hmn | machine-drafted, needs native review |
| `lib/i18n-admin-focus.ts` | 2 | ht, so, am, hmn | machine-drafted, needs native review |
| `lib/i18n-org-forms.ts` | 203 | ht, so, am, hmn | machine-drafted, needs native review |
| `lib/event-recurrence-format.ts` (weekday names, repeat phrases) | grammar table | ht, so, am, hmn | machine-drafted, needs native review |
