# Native-speaker review list

FEED ships its interface in 14 languages. Four of them were drafted by machine and still need a
native speaker to read them: Haitian Creole (`ht`), Somali (`so`), Amharic (`am`) and Hmong (`hmn`).

## What this list covers

This list starts with Release 3.5. It itemises, string by string:

- the four Community sub-tab dictionaries: `lib/i18n-feed-organizations.ts`,
  `lib/i18n-feed-petitions.ts`, `lib/i18n-feed-messages.ts`, `lib/i18n-feed-businesses.ts`;
- the hand-written time words in `lib/i18n-intl.ts` (months, weekdays, day periods, "5 minutes
  ago", "In 3 days") for `ht`, `hmn` and `so`;
- the Arabic petition strings that say "confirmed signature of support" (`مؤكَّد`), listed as a
  wording choice so an Arabic speaker can confirm it carries no sense of legal certification.

It does **not** yet itemise the dictionaries written before it. They are just as machine-drafted;
they are named in [Older dictionaries](#older-dictionaries-not-itemised-here) below, with whether
each still carries its review note inline in the file.

Every dictionary module `apps/web/src/lib/i18n-*.ts` is read automatically by
`apps/web/src/lib/i18n-native-review.test.ts`. A new dictionary joins this list with no extra
step in that test, and the test fails until the list below is regenerated.

## How to use it

- **Reviewing.** Read the `Text` column beside its `English` source. If the text is right, change
  the row's `Status` to `reviewed YYYY-MM-DD, <name>`. If it needs a change, edit the string in the
  file named by the section heading, then run the update command below; the row comes back as a new
  draft with today's date.
- **Adding or changing a string.** Every new or changed `ht`, `so`, `am` or `hmn` string needs a row.
  The test above fails when a string has no matching row. Update the list from `apps/web`:

  ```bash
  UPDATE_I18N_REVIEW=1 npx vitest run src/lib/i18n-native-review.test.ts
  ```

  An unchanged row keeps its date and status.
- **Status values.** `machine-drafted, needs native review` (the default), `wording choice, review
  welcome`, `reviewed <date>, <name>`, or a note saying why no review is needed (for example data
  taken from CLDR).

## Strings awaiting review, by file and key

<!-- BEGIN GENERATED: lib/i18n-native-review.test.ts -->

### `lib/i18n-intl.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `TIME_WORDS.months` | ht | Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec | jan, fev, mas, avr, me, jen, jiy, out, sep, okt, nov, des | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.monthsLong` | ht | January, February, March, April, May, June, July, August, September, October, November, December | janvye, fevriye, mas, avril, me, jen, jiyè, out, septanm, oktòb, novanm, desanm | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.weekdays` | ht | Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday | dimanch, lendi, madi, mèkredi, jedi, vandredi, samdi | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.weekdaysShort` | ht | Sun, Mon, Tue, Wed, Thu, Fri, Sat | dim, len, mad, mèk, jed, van, sam | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.am` | ht | AM | AM | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.pm` | ht | PM | PM | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.past.minute.other` | ht | {n} minutes ago | Sa gen {n} minit | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.past.hour.other` | ht | {n} hours ago | Sa gen {n} èdtan | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.past.day.other` | ht | {n} days ago | Sa gen {n} jou | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.future.minute.other` | ht | In {n} minutes | Nan {n} minit | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.future.hour.other` | ht | In {n} hours | Nan {n} èdtan | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.future.day.other` | ht | In {n} days | Nan {n} jou | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.months` | hmn | Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec | Lub Ib Hlis, Lub Ob Hlis, Lub Peb Hlis, Lub Plaub Hlis, Lub Tsib Hlis, Lub Rau Hli, Lub Xya Hli, Lub Yim Hli, Lub Cuaj Hli, Lub Kaum Hli, Lub Kaum Ib Hlis, Lub Kaum Ob Hlis | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.monthsLong` | hmn | January, February, March, April, May, June, July, August, September, October, November, December | Lub Ib Hlis, Lub Ob Hlis, Lub Peb Hlis, Lub Plaub Hlis, Lub Tsib Hlis, Lub Rau Hli, Lub Xya Hli, Lub Yim Hli, Lub Cuaj Hli, Lub Kaum Hli, Lub Kaum Ib Hlis, Lub Kaum Ob Hlis | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.weekdays` | hmn | Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday | Hnub Xya, Hnub Ib, Hnub Ob, Hnub Peb, Hnub Plaub, Hnub Tsib, Hnub Rau | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.weekdaysShort` | hmn | Sun, Mon, Tue, Wed, Thu, Fri, Sat | Hnub Xya, Hnub Ib, Hnub Ob, Hnub Peb, Hnub Plaub, Hnub Tsib, Hnub Rau | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.am` | hmn | AM | AM | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.pm` | hmn | PM | PM | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.past.minute.other` | hmn | {n} minutes ago | {n} feeb dhau los | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.past.hour.other` | hmn | {n} hours ago | {n} teev dhau los | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.past.day.other` | hmn | {n} days ago | {n} hnub dhau los | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.future.minute.other` | hmn | In {n} minutes | Hauv {n} feeb | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.future.hour.other` | hmn | In {n} hours | Hauv {n} teev | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.future.day.other` | hmn | In {n} days | Hauv {n} hnub | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.months` | so | Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec | Jan, Feb, Mar, Abr, May, Jun, Lul, Ogs, Seb, Okt, Nof, Dis | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.monthsLong` | so | January, February, March, April, May, June, July, August, September, October, November, December | Janaayo, Febraayo, Maarso, Abriil, Maayo, Juun, Luulyo, Agosto, Sebtembar, Oktoobar, Noofeembar, Diseembar | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.weekdays` | so | Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday | Axad, Isniin, Talaado, Arbaco, Khamiis, Jimco, Sabti | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.weekdaysShort` | so | Sun, Mon, Tue, Wed, Thu, Fri, Sat | Axd, Isn, Tldo, Arbc, Khms, Jmc, Sbti | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.am` | so | AM | GH | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.pm` | so | PM | GD | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.past.minute.one` | so | {n} minutes ago | {n} daqiiqad kahor | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.past.minute.other` | so | {n} minutes ago | {n} daqiiqadood kahor | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.past.hour.one` | so | {n} hours ago | {n} saacad kahor | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.past.hour.other` | so | {n} hours ago | {n} saacadood kahor | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.past.day.one` | so | {n} days ago | {n} maalin kahor | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.past.day.other` | so | {n} days ago | {n} maalmood kahor | 2026-10-11 | CLDR 48 data; equals Intl where the runtime has Somali |
| `TIME_WORDS.future.minute.one` | so | In {n} minutes | {n} daqiiqad kadib | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.future.minute.other` | so | In {n} minutes | {n} daqiiqadood kadib | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.future.hour.one` | so | In {n} hours | {n} saacad kadib | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.future.hour.other` | so | In {n} hours | {n} saacadood kadib | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.future.day.one` | so | In {n} days | {n} maalin kadib | 2026-10-11 | machine-drafted, needs native review |
| `TIME_WORDS.future.day.other` | so | In {n} days | {n} maalmood kadib | 2026-10-11 | machine-drafted, needs native review |

### `lib/i18n-feed-alerts.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `typeWeather` | ht | Weather Hazard | Danje move tan | 2026-10-11 | machine-drafted, needs native review |
| `typeRoadClosure` | ht | Road Closure | Wout fèmen | 2026-10-11 | machine-drafted, needs native review |
| `typeSpeeding` | ht | Speeding Area | Zòn kote machin kouri twòp | 2026-10-11 | machine-drafted, needs native review |
| `typeGeneral` | ht | Safety Alert | Alèt sekirite | 2026-10-11 | machine-drafted, needs native review |
| `sevLow` | ht | Low | Ba | 2026-10-11 | machine-drafted, needs native review |
| `sevModerate` | ht | Moderate | Mwayen | 2026-10-11 | machine-drafted, needs native review |
| `sevHigh` | ht | High | Wo | 2026-10-11 | machine-drafted, needs native review |
| `sevCritical` | ht | Critical | Kritik | 2026-10-11 | machine-drafted, needs native review |
| `sevLowHint` | ht | Low — heads-up | Ba — yon ti avètisman | 2026-10-11 | machine-drafted, needs native review |
| `sevModerateHint` | ht | Moderate — use caution | Mwayen — fè atansyon | 2026-10-11 | machine-drafted, needs native review |
| `sevHighHint` | ht | High — significant risk | Wo — gwo risk | 2026-10-11 | machine-drafted, needs native review |
| `sevCriticalHint` | ht | Critical — avoid area | Kritik — evite zòn nan | 2026-10-11 | machine-drafted, needs native review |
| `typeAndSeverity` | ht | {type}, {severity} | {type}, {severity} | 2026-10-11 | machine-drafted, needs native review |
| `stateVerified` | ht | Verified | Verifye | 2026-10-11 | machine-drafted, needs native review |
| `stateUnverified` | ht | Unverified — neighbor report | Poko verifye — rapò yon vwazen | 2026-10-11 | machine-drafted, needs native review |
| `stateResolved` | ht | Resolved | Rezoud | 2026-10-11 | machine-drafted, needs native review |
| `stateEnded` | ht | No longer listed | Li pa nan lis la ankò | 2026-10-11 | machine-drafted, needs native review |
| `endedBody` | ht | This alert is no longer listed. It may have ended or been withdrawn. | Alèt sa a pa nan lis la ankò. Petèt li fini oswa yo retire li. | 2026-10-11 | machine-drafted, needs native review |
| `reportedAt` | ht | Reported {when} | Rapòte {when} | 2026-10-11 | machine-drafted, needs native review |
| `updatedAgo` | ht | Updated {age} | Mete ajou {age} | 2026-10-11 | machine-drafted, needs native review |
| `expiresAt` | ht | Expires {when} | Ap fini {when} | 2026-10-11 | machine-drafted, needs native review |
| `resolvedAt` | ht | Marked resolved {when} | Make kòm rezoud {when} | 2026-10-11 | machine-drafted, needs native review |
| `shownUntil` | ht | Shown as resolved until {when} | Ap parèt kòm rezoud jiska {when} | 2026-10-11 | machine-drafted, needs native review |
| `stripTitle` | ht | Safety alerts | Alèt sekirite | 2026-10-11 | machine-drafted, needs native review |
| `viewOnMap` | ht | View on map | Gade sou kat la | 2026-10-11 | machine-drafted, needs native review |
| `actionUpdate` | ht | Update | Mete ajou | 2026-10-11 | machine-drafted, needs native review |
| `actionResolve` | ht | Mark resolved | Make kòm rezoud | 2026-10-11 | machine-drafted, needs native review |
| `actionWithdraw` | ht | Withdraw | Retire | 2026-10-11 | machine-drafted, needs native review |
| `actionHistory` | ht | History | Istwa | 2026-10-11 | machine-drafted, needs native review |
| `ownerActions` | ht | Your alert | Alèt ou a | 2026-10-11 | machine-drafted, needs native review |
| `close` | ht | Close | Fèmen | 2026-10-11 | machine-drafted, needs native review |
| `countConfirmed` | ht | {n} confirmed still here | {n} konfime li toujou la | 2026-10-11 | machine-drafted, needs native review |
| `countGone` | ht | {n} reported gone | {n} di li pa la ankò | 2026-10-11 | machine-drafted, needs native review |
| `voteStillHere` | ht | Still here | Li toujou la | 2026-10-11 | machine-drafted, needs native review |
| `voteGone` | ht | Gone now | Li pa la ankò | 2026-10-11 | machine-drafted, needs native review |
| `voteSending` | ht | Sending… | Ap voye… | 2026-10-11 | machine-drafted, needs native review |
| `voteFailed` | ht | Your vote was not counted. Try again. | Vòt ou a pa konte. Eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `voteCleared` | ht | Neighbors reported this hazard gone, so the alert was cleared. | Vwazen yo di danje a pa la ankò, kidonk yo efase alèt la. | 2026-10-11 | machine-drafted, needs native review |
| `guestHint` | ht | Create a free account to confirm or clear alerts. | Kreye yon kont gratis pou konfime oswa efase alèt. | 2026-10-11 | machine-drafted, needs native review |
| `annNew` | ht | New safety alert: {type}, {severity}. | Nouvo alèt sekirite: {type}, {severity}. | 2026-10-11 | machine-drafted, needs native review |
| `annRaised` | ht | Safety alert raised to {severity}: {type}. | Alèt sekirite a monte nan nivo {severity}: {type}. | 2026-10-11 | machine-drafted, needs native review |
| `annUpdated` | ht | Safety alert updated: {type}. | Alèt sekirite mete ajou: {type}. | 2026-10-11 | machine-drafted, needs native review |
| `annResolved` | ht | Safety alert resolved: {type}. | Alèt sekirite rezoud: {type}. | 2026-10-11 | machine-drafted, needs native review |
| `annEnded` | ht | Safety alert no longer listed: {type}. | Alèt sekirite a pa nan lis la ankò: {type}. | 2026-10-11 | machine-drafted, needs native review |
| `editTitle` | ht | Update alert | Mete alèt la ajou | 2026-10-11 | machine-drafted, needs native review |
| `resolveTitle` | ht | Mark alert resolved | Make alèt la kòm rezoud | 2026-10-11 | machine-drafted, needs native review |
| `withdrawTitle` | ht | Withdraw alert | Retire alèt la | 2026-10-11 | machine-drafted, needs native review |
| `loadingAlert` | ht | Loading the alert… | Ap chaje alèt la… | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | ht | Couldn’t load the alert. | Nou pa t kapab chaje alèt la. | 2026-10-11 | machine-drafted, needs native review |
| `retry` | ht | Try again | Eseye ankò | 2026-10-11 | machine-drafted, needs native review |
| `fieldType` | ht | Type of hazard | Kalite danje | 2026-10-11 | machine-drafted, needs native review |
| `fieldSeverity` | ht | Severity | Gravite | 2026-10-11 | machine-drafted, needs native review |
| `fieldDescription` | ht | Description (optional) | Deskripsyon (si ou vle) | 2026-10-11 | machine-drafted, needs native review |
| `descriptionPlaceholder` | ht | Add details neighbors should know… | Ajoute detay vwazen yo dwe konnen… | 2026-10-11 | machine-drafted, needs native review |
| `verifiedNotice` | ht | This alert is verified. Any change you save returns it to unverified until a moderator checks it again. | Alèt sa a verifye. Nenpòt chanjman ou anrejistre ap fè li tounen "poko verifye" jiskaske yon moderatè tcheke li ankò. | 2026-10-11 | machine-drafted, needs native review |
| `expiryHint` | ht | Raising the severity restarts the alert’s clock. Lowering it can shorten the time left. | Lè ou monte gravite a, revèy alèt la rekòmanse. Lè ou bese li, tan ki rete a ka vin pi kout. | 2026-10-11 | machine-drafted, needs native review |
| `save` | ht | Save changes | Anrejistre chanjman yo | 2026-10-11 | machine-drafted, needs native review |
| `saving` | ht | Saving… | Ap anrejistre… | 2026-10-11 | machine-drafted, needs native review |
| `cancel` | ht | Cancel | Anile | 2026-10-11 | machine-drafted, needs native review |
| `savedNotice` | ht | Alert updated. | Alèt la mete ajou. | 2026-10-11 | machine-drafted, needs native review |
| `savedExpiryNotice` | ht | Alert updated. It now expires {when}. | Alèt la mete ajou. Kounye a li ap fini {when}. | 2026-10-11 | machine-drafted, needs native review |
| `unverifiedNotice` | ht | It is unverified until a moderator checks it again. | Li poko verifye jiskaske yon moderatè tcheke li ankò. | 2026-10-11 | machine-drafted, needs native review |
| `nothingChanged` | ht | Nothing was changed. | Anyen pa chanje. | 2026-10-11 | machine-drafted, needs native review |
| `resolveBody` | ht | Neighbors will see this alert as resolved for 6 hours. After that it leaves the map and the feed. A resolved alert cannot be reopened: if the hazard returns, report a new alert. | Vwazen yo ap wè alèt sa a kòm rezoud pandan 6 èdtan. Apre sa, li soti sou kat la ak nan paj piblikasyon yo. Ou pa ka relouvri yon alèt ki rezoud: si danje a tounen, rapòte yon nouvo alèt. | 2026-10-11 | machine-drafted, needs native review |
| `resolveConfirm` | ht | Mark resolved | Make kòm rezoud | 2026-10-11 | machine-drafted, needs native review |
| `resolvedNotice` | ht | Alert marked resolved. It stays visible as resolved until {when}. | Alèt la make kòm rezoud. L ap rete vizib kòm rezoud jiska {when}. | 2026-10-11 | machine-drafted, needs native review |
| `withdrawBody` | ht | This takes the alert off the map and the feed for everyone right away. The withdrawal is recorded. | Sa retire alèt la sou kat la ak nan paj piblikasyon yo pou tout moun touswit. Yo anrejistre retrè a. | 2026-10-11 | machine-drafted, needs native review |
| `withdrawConfirm` | ht | Withdraw alert | Retire alèt la | 2026-10-11 | machine-drafted, needs native review |
| `withdrawnNotice` | ht | Alert withdrawn. | Alèt la retire. | 2026-10-11 | machine-drafted, needs native review |
| `conflictTitle` | ht | This alert changed while you had it open | Alèt sa a chanje pandan ou te gen li ouvè | 2026-10-11 | machine-drafted, needs native review |
| `conflictBody` | ht | A newer version was saved since you opened it. Check it below, then choose what to do. | Yo anrejistre yon vèsyon ki pi nouvo depi ou te ouvri li. Gade li anba a, epi chwazi sa pou fè. | 2026-10-11 | machine-drafted, needs native review |
| `yourVersion` | ht | Your changes | Chanjman ou yo | 2026-10-11 | machine-drafted, needs native review |
| `currentVersion` | ht | Current version | Vèsyon aktyèl la | 2026-10-11 | machine-drafted, needs native review |
| `noDescription` | ht | No description | Pa gen deskripsyon | 2026-10-11 | machine-drafted, needs native review |
| `conflictChoose` | ht | Choose what to do | Chwazi sa pou fè | 2026-10-11 | machine-drafted, needs native review |
| `keepMine` | ht | Keep my changes | Kenbe chanjman mwen yo | 2026-10-11 | machine-drafted, needs native review |
| `keepMineHint` | ht | Save my changes over the current version. | Anrejistre chanjman mwen yo sou vèsyon aktyèl la. | 2026-10-11 | machine-drafted, needs native review |
| `useCurrent` | ht | Use the current version | Sèvi ak vèsyon aktyèl la | 2026-10-11 | machine-drafted, needs native review |
| `useCurrentHint` | ht | Discard my changes. | Jete chanjman mwen yo. | 2026-10-11 | machine-drafted, needs native review |
| `resolveAnyway` | ht | Mark it resolved anyway | Make li kòm rezoud kanmenm | 2026-10-11 | machine-drafted, needs native review |
| `leaveAsIs` | ht | Leave it as it is | Kite li jan li ye a | 2026-10-11 | machine-drafted, needs native review |
| `continueLabel` | ht | Continue | Kontinye | 2026-10-11 | machine-drafted, needs native review |
| `notSavedNotice` | ht | Your changes were not saved. The alert shows its current version. | Chanjman ou yo pa anrejistre. Alèt la montre vèsyon aktyèl li. | 2026-10-11 | machine-drafted, needs native review |
| `notResolvedNotice` | ht | The alert was left as it is. | Yo kite alèt la jan li ye a. | 2026-10-11 | machine-drafted, needs native review |
| `notLiveNotice` | ht | This alert is no longer active, so nothing was changed. | Alèt sa a pa aktif ankò, kidonk anyen pa chanje. | 2026-10-11 | machine-drafted, needs native review |
| `nowResolvedNotice` | ht | This alert was already marked resolved, so nothing was changed. | Alèt sa a te deja make kòm rezoud, kidonk anyen pa chanje. | 2026-10-11 | machine-drafted, needs native review |
| `failGuest` | ht | Create a free account to report or change safety alerts. | Kreye yon kont gratis pou rapòte oswa chanje alèt sekirite. | 2026-10-11 | machine-drafted, needs native review |
| `failNotOwner` | ht | Only the member who reported this alert can change it. | Se sèlman manm ki te rapòte alèt sa a ki ka chanje li. | 2026-10-11 | machine-drafted, needs native review |
| `failInvalid` | ht | Check the alert details and try again. | Tcheke detay alèt la epi eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `failNetwork` | ht | Couldn’t reach FEED. Check your connection and try again. | Nou pa t kapab konekte ak FEED. Tcheke koneksyon ou epi eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `failUnknown` | ht | Something went wrong. Try again. | Gen yon bagay ki pa mache. Eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `historyTitle` | ht | Alert history | Istwa alèt la | 2026-10-11 | machine-drafted, needs native review |
| `historyLoading` | ht | Loading the history… | Ap chaje istwa a… | 2026-10-11 | machine-drafted, needs native review |
| `historyLoadFailed` | ht | Couldn’t load the history. | Nou pa t kapab chaje istwa a. | 2026-10-11 | machine-drafted, needs native review |
| `historyEmpty` | ht | There is no history to show. The alert may have ended. | Pa gen istwa pou montre. Petèt alèt la fini. | 2026-10-11 | machine-drafted, needs native review |
| `histReported` | ht | Reported | Rapòte | 2026-10-11 | machine-drafted, needs native review |
| `histUpdated` | ht | Updated | Mete ajou | 2026-10-11 | machine-drafted, needs native review |
| `histResolved` | ht | Marked resolved | Make kòm rezoud | 2026-10-11 | machine-drafted, needs native review |
| `histSeverityRaised` | ht | Severity raised to {severity} | Gravite a monte nan {severity} | 2026-10-11 | machine-drafted, needs native review |
| `histSeverityLowered` | ht | Severity lowered to {severity} | Gravite a desann nan {severity} | 2026-10-11 | machine-drafted, needs native review |
| `histTextChanged` | ht | Description changed | Deskripsyon an chanje | 2026-10-11 | machine-drafted, needs native review |
| `histTextRemoved` | ht | Description removed | Yo retire deskripsyon an | 2026-10-11 | machine-drafted, needs native review |
| `histTypeChanged` | ht | Type changed to {type} | Kalite a chanje an {type} | 2026-10-11 | machine-drafted, needs native review |
| `histLocationMoved` | ht | Location moved | Kote a deplase | 2026-10-11 | machine-drafted, needs native review |
| `hazardOpen` | ht | Report a hazard or add a resource | Rapòte yon danje oswa ajoute yon resous | 2026-10-11 | machine-drafted, needs native review |
| `hazardClose` | ht | Close safety menu | Fèmen meni sekirite a | 2026-10-11 | machine-drafted, needs native review |
| `panelTitle` | ht | Safety & Resources | Sekirite ak resous | 2026-10-11 | machine-drafted, needs native review |
| `entryWeather` | ht | Report weather hazard | Rapòte yon danje move tan | 2026-10-11 | machine-drafted, needs native review |
| `entryWeatherBody` | ht | Ice, flooding, high winds, downed branches, etc. | Glas, inondasyon, gwo van, branch ki tonbe, elatriye. | 2026-10-11 | machine-drafted, needs native review |
| `entryRoad` | ht | Report road closure | Rapòte yon wout ki fèmen | 2026-10-11 | machine-drafted, needs native review |
| `entryRoadBody` | ht | Blocked road, bridge out, construction, accident. | Wout bloke, pon kraze, travay sou wout, aksidan. | 2026-10-11 | machine-drafted, needs native review |
| `entrySpeeding` | ht | Report speeding area | Rapòte yon zòn kote machin kouri twòp | 2026-10-11 | machine-drafted, needs native review |
| `entrySpeedingBody` | ht | Vehicles exceeding safe speed near pedestrians. | Machin k ap kouri twò vit toupre moun k ap mache. | 2026-10-11 | machine-drafted, needs native review |
| `entryGeneral` | ht | Report general safety issue | Rapòte yon pwoblèm sekirite jeneral | 2026-10-11 | machine-drafted, needs native review |
| `entryGeneralBody` | ht | Other safety concern in this area. | Yon lòt pwoblèm sekirite nan zòn sa a. | 2026-10-11 | machine-drafted, needs native review |
| `suggestEntry` | ht | Suggest a Resource | Pwopoze yon resous | 2026-10-11 | machine-drafted, needs native review |
| `suggestEntryBody` | ht | Know a resource that’s missing? Let us know. | Ou konnen yon resous ki manke? Fè nou konnen. | 2026-10-11 | machine-drafted, needs native review |
| `addSelfEntry` | ht | Add yourself as a resource | Ajoute tèt ou kòm resous | 2026-10-11 | machine-drafted, needs native review |
| `addSelfEntryBody` | ht | Share what you can offer with neighbors. | Pataje sa ou ka ofri ak vwazen ou yo. | 2026-10-11 | machine-drafted, needs native review |
| `pinLocation` | ht | Pin location | Kote makè a ye | 2026-10-11 | machine-drafted, needs native review |
| `pinSetting` | ht | Setting location… | Ap fikse kote a… | 2026-10-11 | machine-drafted, needs native review |
| `pinHint` | ht | Drag the orange pin on the map or search below | Trennen makè zoranj lan sou kat la oswa chèche anba a | 2026-10-11 | machine-drafted, needs native review |
| `addressLabel` | ht | Search for an address | Chèche yon adrès | 2026-10-11 | machine-drafted, needs native review |
| `addressPlaceholder` | ht | Enter address… | Antre adrès la… | 2026-10-11 | machine-drafted, needs native review |
| `addressFind` | ht | Find | Chèche | 2026-10-11 | machine-drafted, needs native review |
| `addressFinding` | ht | Searching… | Ap chèche… | 2026-10-11 | machine-drafted, needs native review |
| `addressMoved` | ht | Pin moved to address | Makè a deplase sou adrès la | 2026-10-11 | machine-drafted, needs native review |
| `addressNotFound` | ht | Address not found — drag the pin to set location | Nou pa jwenn adrès la. Trennen makè a pou fikse kote a. | 2026-10-11 | machine-drafted, needs native review |
| `addressFailed` | ht | Could not search — drag the pin to set location | Rechèch la pa mache. Trennen makè a pou fikse kote a. | 2026-10-11 | machine-drafted, needs native review |
| `placeConfirm` | ht | Confirm & Report | Konfime epi rapòte | 2026-10-11 | machine-drafted, needs native review |
| `placing` | ht | Placing… | Ap mete… | 2026-10-11 | machine-drafted, needs native review |
| `placeFailed` | ht | Couldn’t place the alert. Try again. | Nou pa t kapab mete alèt la. Eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `suggestThanks` | ht | Thanks — your suggestion is pending review. | Mèsi. Pwopozisyon ou an ap tann revizyon. | 2026-10-11 | machine-drafted, needs native review |
| `suggestThanksBody` | ht | Our team will verify and publish it if it meets community guidelines. | Ekip nou an ap verifye li epi pibliye li si li respekte règ kominote a. | 2026-10-11 | machine-drafted, needs native review |
| `suggestIntro` | ht | Know of a resource that’s not on the map? Suggest it and our community team will review it. | Ou konnen yon resous ki pa sou kat la? Pwopoze li epi ekip kominote nou an ap revize li. | 2026-10-11 | machine-drafted, needs native review |
| `suggestCategory` | ht | Category | Kategori | 2026-10-11 | machine-drafted, needs native review |
| `suggestName` | ht | Resource name | Non resous la | 2026-10-11 | machine-drafted, needs native review |
| `suggestDescription` | ht | Description | Deskripsyon | 2026-10-11 | machine-drafted, needs native review |
| `suggestDescriptionPlaceholder` | ht | Who does it serve? What do they offer? Hours? | Ki moun li sèvi? Kisa li ofri? Ki lè li louvri? | 2026-10-11 | machine-drafted, needs native review |
| `suggestCount` | ht | {n}/500 characters (minimum 10) | {n}/500 karaktè (omwen 10) | 2026-10-11 | machine-drafted, needs native review |
| `suggestCity` | ht | City | Vil | 2026-10-11 | machine-drafted, needs native review |
| `suggestState` | ht | State | Eta | 2026-10-11 | machine-drafted, needs native review |
| `suggestPhone` | ht | Phone | Telefòn | 2026-10-11 | machine-drafted, needs native review |
| `suggestWebsite` | ht | Website | Sit entènèt | 2026-10-11 | machine-drafted, needs native review |
| `optional` | ht | (optional) | (si ou vle) | 2026-10-11 | machine-drafted, needs native review |
| `exampleValue` | ht | e.g. {example} | pa egzanp {example} | 2026-10-11 | machine-drafted, needs native review |
| `suggestSubmit` | ht | Submit suggestion | Voye pwopozisyon an | 2026-10-11 | machine-drafted, needs native review |
| `suggestSubmitting` | ht | Submitting… | Ap voye… | 2026-10-11 | machine-drafted, needs native review |
| `suggestFailed` | ht | Couldn’t send the suggestion. Try again. | Nou pa t kapab voye pwopozisyon an. Eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `typeWeather` | so | Weather Hazard | Khatar cimilo | 2026-10-11 | machine-drafted, needs native review |
| `typeRoadClosure` | so | Road Closure | Waddo xiran | 2026-10-11 | machine-drafted, needs native review |
| `typeSpeeding` | so | Speeding Area | Goob xawaare dheeraad ah | 2026-10-11 | machine-drafted, needs native review |
| `typeGeneral` | so | Safety Alert | Digniin badbaado | 2026-10-11 | machine-drafted, needs native review |
| `sevLow` | so | Low | Hoose | 2026-10-11 | machine-drafted, needs native review |
| `sevModerate` | so | Moderate | Dhexdhexaad | 2026-10-11 | machine-drafted, needs native review |
| `sevHigh` | so | High | Sare | 2026-10-11 | machine-drafted, needs native review |
| `sevCritical` | so | Critical | Aad u daran | 2026-10-11 | machine-drafted, needs native review |
| `sevLowHint` | so | Low — heads-up | Hoose — ogeysiis | 2026-10-11 | machine-drafted, needs native review |
| `sevModerateHint` | so | Moderate — use caution | Dhexdhexaad — taxaddar | 2026-10-11 | machine-drafted, needs native review |
| `sevHighHint` | so | High — significant risk | Sare — khatar weyn | 2026-10-11 | machine-drafted, needs native review |
| `sevCriticalHint` | so | Critical — avoid area | Aad u daran — ka fogow goobta | 2026-10-11 | machine-drafted, needs native review |
| `typeAndSeverity` | so | {type}, {severity} | {type}, {severity} | 2026-10-11 | machine-drafted, needs native review |
| `stateVerified` | so | Verified | La xaqiijiyay | 2026-10-11 | machine-drafted, needs native review |
| `stateUnverified` | so | Unverified — neighbor report | Aan la xaqiijin — warbixin deris | 2026-10-11 | machine-drafted, needs native review |
| `stateResolved` | so | Resolved | La xalliyay | 2026-10-11 | machine-drafted, needs native review |
| `stateEnded` | so | No longer listed | Kuma jirto liiska hadda | 2026-10-11 | machine-drafted, needs native review |
| `endedBody` | so | This alert is no longer listed. It may have ended or been withdrawn. | Digniintani kuma jirto liiska hadda. Waxaa laga yaabaa inay dhammaatay ama dib loola noqday. | 2026-10-11 | machine-drafted, needs native review |
| `reportedAt` | so | Reported {when} | La soo sheegay {when} | 2026-10-11 | machine-drafted, needs native review |
| `updatedAgo` | so | Updated {age} | La cusboonaysiiyay {age} | 2026-10-11 | machine-drafted, needs native review |
| `expiresAt` | so | Expires {when} | Waxay dhacaysaa {when} | 2026-10-11 | machine-drafted, needs native review |
| `resolvedAt` | so | Marked resolved {when} | Loo calaamadeeyay inay xallisantay {when} | 2026-10-11 | machine-drafted, needs native review |
| `shownUntil` | so | Shown as resolved until {when} | Waxaa loo muujinayaa inay xallisantay ilaa {when} | 2026-10-11 | machine-drafted, needs native review |
| `stripTitle` | so | Safety alerts | Digniinaha badbaadada | 2026-10-11 | machine-drafted, needs native review |
| `viewOnMap` | so | View on map | Ka eeg khariidadda | 2026-10-11 | machine-drafted, needs native review |
| `actionUpdate` | so | Update | Cusboonaysii | 2026-10-11 | machine-drafted, needs native review |
| `actionResolve` | so | Mark resolved | U calaamadee inay xallisantay | 2026-10-11 | machine-drafted, needs native review |
| `actionWithdraw` | so | Withdraw | Dib ula noqo | 2026-10-11 | machine-drafted, needs native review |
| `actionHistory` | so | History | Taariikhda | 2026-10-11 | machine-drafted, needs native review |
| `ownerActions` | so | Your alert | Digniintaada | 2026-10-11 | machine-drafted, needs native review |
| `close` | so | Close | Xir | 2026-10-11 | machine-drafted, needs native review |
| `countConfirmed` | so | {n} confirmed still here | {n} ayaa xaqiijiyay inay weli jirto | 2026-10-11 | machine-drafted, needs native review |
| `countGone` | so | {n} reported gone | {n} ayaa sheegay inay tagtay | 2026-10-11 | machine-drafted, needs native review |
| `voteStillHere` | so | Still here | Weli way jirtaa | 2026-10-11 | machine-drafted, needs native review |
| `voteGone` | so | Gone now | Way tagtay | 2026-10-11 | machine-drafted, needs native review |
| `voteSending` | so | Sending… | Waa la dirayaa… | 2026-10-11 | machine-drafted, needs native review |
| `voteFailed` | so | Your vote was not counted. Try again. | Codkaaga lama tirin. Mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `voteCleared` | so | Neighbors reported this hazard gone, so the alert was cleared. | Deriska ayaa sheegay in khatartani tagtay, sidaas darteed digniinta waa la saaray. | 2026-10-11 | machine-drafted, needs native review |
| `guestHint` | so | Create a free account to confirm or clear alerts. | Samee akoon bilaash ah si aad u xaqiijiso ama u saarto digniinaha. | 2026-10-11 | machine-drafted, needs native review |
| `annNew` | so | New safety alert: {type}, {severity}. | Digniin badbaado oo cusub: {type}, {severity}. | 2026-10-11 | machine-drafted, needs native review |
| `annRaised` | so | Safety alert raised to {severity}: {type}. | Digniinta badbaadada waxaa kor loogu qaaday {severity}: {type}. | 2026-10-11 | machine-drafted, needs native review |
| `annUpdated` | so | Safety alert updated: {type}. | Digniinta badbaadada waa la cusboonaysiiyay: {type}. | 2026-10-11 | machine-drafted, needs native review |
| `annResolved` | so | Safety alert resolved: {type}. | Digniinta badbaadada waa la xalliyay: {type}. | 2026-10-11 | machine-drafted, needs native review |
| `annEnded` | so | Safety alert no longer listed: {type}. | Digniinta badbaadadu kuma jirto liiska hadda: {type}. | 2026-10-11 | machine-drafted, needs native review |
| `editTitle` | so | Update alert | Cusboonaysii digniinta | 2026-10-11 | machine-drafted, needs native review |
| `resolveTitle` | so | Mark alert resolved | U calaamadee digniinta inay xallisantay | 2026-10-11 | machine-drafted, needs native review |
| `withdrawTitle` | so | Withdraw alert | Dib ula noqo digniinta | 2026-10-11 | machine-drafted, needs native review |
| `loadingAlert` | so | Loading the alert… | Digniinta waa la soo rarayaa… | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | so | Couldn’t load the alert. | Digniinta lama soo rari karin. | 2026-10-11 | machine-drafted, needs native review |
| `retry` | so | Try again | Mar kale isku day | 2026-10-11 | machine-drafted, needs native review |
| `fieldType` | so | Type of hazard | Nooca khatarta | 2026-10-11 | machine-drafted, needs native review |
| `fieldSeverity` | so | Severity | Heerka khatarta | 2026-10-11 | machine-drafted, needs native review |
| `fieldDescription` | so | Description (optional) | Sharraxaad (ikhtiyaari) | 2026-10-11 | machine-drafted, needs native review |
| `descriptionPlaceholder` | so | Add details neighbors should know… | Ku dar faahfaahin ay deriska u baahan yihiin inay ogaadaan… | 2026-10-11 | machine-drafted, needs native review |
| `verifiedNotice` | so | This alert is verified. Any change you save returns it to unverified until a moderator checks it again. | Digniintan waa la xaqiijiyay. Isbeddel kasta oo aad kaydiso wuxuu ku celinayaa "aan la xaqiijin" ilaa uu maamule mar kale hubiyo. | 2026-10-11 | machine-drafted, needs native review |
| `expiryHint` | so | Raising the severity restarts the alert’s clock. Lowering it can shorten the time left. | Kor u qaadista heerka waxay dib u bilaabaysaa wakhtiga digniinta. Hoos u dhigiddu waxay gaabin kartaa wakhtiga haray. | 2026-10-11 | machine-drafted, needs native review |
| `save` | so | Save changes | Kaydi isbeddellada | 2026-10-11 | machine-drafted, needs native review |
| `saving` | so | Saving… | Waa la kaydinayaa… | 2026-10-11 | machine-drafted, needs native review |
| `cancel` | so | Cancel | Jooji | 2026-10-11 | machine-drafted, needs native review |
| `savedNotice` | so | Alert updated. | Digniinta waa la cusboonaysiiyay. | 2026-10-11 | machine-drafted, needs native review |
| `savedExpiryNotice` | so | Alert updated. It now expires {when}. | Digniinta waa la cusboonaysiiyay. Hadda waxay dhacaysaa {when}. | 2026-10-11 | machine-drafted, needs native review |
| `unverifiedNotice` | so | It is unverified until a moderator checks it again. | Waxay ahaanaysaa aan la xaqiijin ilaa uu maamule mar kale hubiyo. | 2026-10-11 | machine-drafted, needs native review |
| `nothingChanged` | so | Nothing was changed. | Waxba lama beddelin. | 2026-10-11 | machine-drafted, needs native review |
| `resolveBody` | so | Neighbors will see this alert as resolved for 6 hours. After that it leaves the map and the feed. A resolved alert cannot be reopened: if the hazard returns, report a new alert. | Derisku waxay digniintan u arki doonaan mid xallisantay muddo 6 saacadood ah. Intaas ka dib waxay ka baxaysaa khariidadda iyo qoraallada. Digniin xallisantay dib looma furi karo: haddii khatartu soo noqoto, soo sheeg digniin cusub. | 2026-10-11 | machine-drafted, needs native review |
| `resolveConfirm` | so | Mark resolved | U calaamadee inay xallisantay | 2026-10-11 | machine-drafted, needs native review |
| `resolvedNotice` | so | Alert marked resolved. It stays visible as resolved until {when}. | Digniinta waxaa loo calaamadeeyay inay xallisantay. Waxay sidaas u muuqan doontaa ilaa {when}. | 2026-10-11 | machine-drafted, needs native review |
| `withdrawBody` | so | This takes the alert off the map and the feed for everyone right away. The withdrawal is recorded. | Tani waxay digniinta isla markiiba ka saaraysaa khariidadda iyo qoraallada qof walba. Dib-u-la-noqoshada waa la diiwaangelinayaa. | 2026-10-11 | machine-drafted, needs native review |
| `withdrawConfirm` | so | Withdraw alert | Dib ula noqo digniinta | 2026-10-11 | machine-drafted, needs native review |
| `withdrawnNotice` | so | Alert withdrawn. | Digniinta dib baa loola noqday. | 2026-10-11 | machine-drafted, needs native review |
| `conflictTitle` | so | This alert changed while you had it open | Digniintani way isbeddeshay intii ay kuu furnayd | 2026-10-11 | machine-drafted, needs native review |
| `conflictBody` | so | A newer version was saved since you opened it. Check it below, then choose what to do. | Nooc ka cusub ayaa la kaydiyay ka dib markii aad furtay. Hoos ka eeg, ka dibna dooro waxa la sameeyo. | 2026-10-11 | machine-drafted, needs native review |
| `yourVersion` | so | Your changes | Isbeddelladaada | 2026-10-11 | machine-drafted, needs native review |
| `currentVersion` | so | Current version | Nooca hadda | 2026-10-11 | machine-drafted, needs native review |
| `noDescription` | so | No description | Sharraxaad ma jirto | 2026-10-11 | machine-drafted, needs native review |
| `conflictChoose` | so | Choose what to do | Dooro waxa la sameeyo | 2026-10-11 | machine-drafted, needs native review |
| `keepMine` | so | Keep my changes | Hay isbeddelladayda | 2026-10-11 | machine-drafted, needs native review |
| `keepMineHint` | so | Save my changes over the current version. | Ku kaydi isbeddelladayda nooca hadda dushiisa. | 2026-10-11 | machine-drafted, needs native review |
| `useCurrent` | so | Use the current version | Isticmaal nooca hadda | 2026-10-11 | machine-drafted, needs native review |
| `useCurrentHint` | so | Discard my changes. | Tuur isbeddelladayda. | 2026-10-11 | machine-drafted, needs native review |
| `resolveAnyway` | so | Mark it resolved anyway | Si kastaba u calaamadee inay xallisantay | 2026-10-11 | machine-drafted, needs native review |
| `leaveAsIs` | so | Leave it as it is | Sida ay tahay u daa | 2026-10-11 | machine-drafted, needs native review |
| `continueLabel` | so | Continue | Sii wad | 2026-10-11 | machine-drafted, needs native review |
| `notSavedNotice` | so | Your changes were not saved. The alert shows its current version. | Isbeddelladaada lama kaydin. Digniintu waxay muujinaysaa nooceeda hadda. | 2026-10-11 | machine-drafted, needs native review |
| `notResolvedNotice` | so | The alert was left as it is. | Digniinta sideedii baa loo daayay. | 2026-10-11 | machine-drafted, needs native review |
| `notLiveNotice` | so | This alert is no longer active, so nothing was changed. | Digniintani hadda ma shaqaynayso, sidaas darteed waxba lama beddelin. | 2026-10-11 | machine-drafted, needs native review |
| `nowResolvedNotice` | so | This alert was already marked resolved, so nothing was changed. | Digniintan hore ayaa loogu calaamadeeyay inay xallisantay, sidaas darteed waxba lama beddelin. | 2026-10-11 | machine-drafted, needs native review |
| `failGuest` | so | Create a free account to report or change safety alerts. | Samee akoon bilaash ah si aad u soo sheegto ama u beddesho digniinaha badbaadada. | 2026-10-11 | machine-drafted, needs native review |
| `failNotOwner` | so | Only the member who reported this alert can change it. | Kaliya xubinta soo sheegtay digniintan ayaa beddeli karta. | 2026-10-11 | machine-drafted, needs native review |
| `failInvalid` | so | Check the alert details and try again. | Hubi faahfaahinta digniinta oo mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `failNetwork` | so | Couldn’t reach FEED. Check your connection and try again. | Lama xiriiri karin FEED. Hubi xiriirkaaga oo mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `failUnknown` | so | Something went wrong. Try again. | Wax baa khaldamay. Mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `historyTitle` | so | Alert history | Taariikhda digniinta | 2026-10-11 | machine-drafted, needs native review |
| `historyLoading` | so | Loading the history… | Taariikhda waa la soo rarayaa… | 2026-10-11 | machine-drafted, needs native review |
| `historyLoadFailed` | so | Couldn’t load the history. | Taariikhda lama soo rari karin. | 2026-10-11 | machine-drafted, needs native review |
| `historyEmpty` | so | There is no history to show. The alert may have ended. | Ma jirto taariikh la muujiyo. Waxaa laga yaabaa in digniintu dhammaatay. | 2026-10-11 | machine-drafted, needs native review |
| `histReported` | so | Reported | La soo sheegay | 2026-10-11 | machine-drafted, needs native review |
| `histUpdated` | so | Updated | La cusboonaysiiyay | 2026-10-11 | machine-drafted, needs native review |
| `histResolved` | so | Marked resolved | Loo calaamadeeyay inay xallisantay | 2026-10-11 | machine-drafted, needs native review |
| `histSeverityRaised` | so | Severity raised to {severity} | Heerka khatarta waxaa kor loogu qaaday {severity} | 2026-10-11 | machine-drafted, needs native review |
| `histSeverityLowered` | so | Severity lowered to {severity} | Heerka khatarta waxaa hoos loogu dhigay {severity} | 2026-10-11 | machine-drafted, needs native review |
| `histTextChanged` | so | Description changed | Sharraxaadda waa la beddelay | 2026-10-11 | machine-drafted, needs native review |
| `histTextRemoved` | so | Description removed | Sharraxaadda waa la saaray | 2026-10-11 | machine-drafted, needs native review |
| `histTypeChanged` | so | Type changed to {type} | Nooca waxaa loo beddelay {type} | 2026-10-11 | machine-drafted, needs native review |
| `histLocationMoved` | so | Location moved | Goobta waa la raray | 2026-10-11 | machine-drafted, needs native review |
| `hazardOpen` | so | Report a hazard or add a resource | Soo sheeg khatar ama ku dar adeeg | 2026-10-11 | machine-drafted, needs native review |
| `hazardClose` | so | Close safety menu | Xir liiska badbaadada | 2026-10-11 | machine-drafted, needs native review |
| `panelTitle` | so | Safety & Resources | Badbaado iyo adeegyo | 2026-10-11 | machine-drafted, needs native review |
| `entryWeather` | so | Report weather hazard | Soo sheeg khatar cimilo | 2026-10-11 | machine-drafted, needs native review |
| `entryWeatherBody` | so | Ice, flooding, high winds, downed branches, etc. | Baraf, daad, dabayl xooggan, laamo dhacay, iwm. | 2026-10-11 | machine-drafted, needs native review |
| `entryRoad` | so | Report road closure | Soo sheeg waddo xiran | 2026-10-11 | machine-drafted, needs native review |
| `entryRoadBody` | so | Blocked road, bridge out, construction, accident. | Waddo xannibantay, buundo go’day, dhisme, shil. | 2026-10-11 | machine-drafted, needs native review |
| `entrySpeeding` | so | Report speeding area | Soo sheeg goob xawaare dheeraad ah | 2026-10-11 | machine-drafted, needs native review |
| `entrySpeedingBody` | so | Vehicles exceeding safe speed near pedestrians. | Gaadiid aad u dheereeya oo u dhow dadka lugaynaya. | 2026-10-11 | machine-drafted, needs native review |
| `entryGeneral` | so | Report general safety issue | Soo sheeg arrin badbaado oo guud | 2026-10-11 | machine-drafted, needs native review |
| `entryGeneralBody` | so | Other safety concern in this area. | Walaac kale oo badbaado oo ka jira goobtan. | 2026-10-11 | machine-drafted, needs native review |
| `suggestEntry` | so | Suggest a Resource | Soo jeedi adeeg | 2026-10-11 | machine-drafted, needs native review |
| `suggestEntryBody` | so | Know a resource that’s missing? Let us know. | Ma taqaan adeeg maqan? Noo sheeg. | 2026-10-11 | machine-drafted, needs native review |
| `addSelfEntry` | so | Add yourself as a resource | Isku dar adeeg ahaan | 2026-10-11 | machine-drafted, needs native review |
| `addSelfEntryBody` | so | Share what you can offer with neighbors. | La wadaag deriskaaga waxa aad bixin karto. | 2026-10-11 | machine-drafted, needs native review |
| `pinLocation` | so | Pin location | Goobta calaamadda | 2026-10-11 | machine-drafted, needs native review |
| `pinSetting` | so | Setting location… | Goobta waa la dejinayaa… | 2026-10-11 | machine-drafted, needs native review |
| `pinHint` | so | Drag the orange pin on the map or search below | Jiid calaamadda liinta ah ee khariidadda ama hoos ka raadi | 2026-10-11 | machine-drafted, needs native review |
| `addressLabel` | so | Search for an address | Raadi cinwaan | 2026-10-11 | machine-drafted, needs native review |
| `addressPlaceholder` | so | Enter address… | Geli cinwaanka… | 2026-10-11 | machine-drafted, needs native review |
| `addressFind` | so | Find | Raadi | 2026-10-11 | machine-drafted, needs native review |
| `addressFinding` | so | Searching… | Waa la raadinayaa… | 2026-10-11 | machine-drafted, needs native review |
| `addressMoved` | so | Pin moved to address | Calaamadda waxaa loo raray cinwaanka | 2026-10-11 | machine-drafted, needs native review |
| `addressNotFound` | so | Address not found — drag the pin to set location | Cinwaanka lama helin. Jiid calaamadda si aad goobta u dejiso. | 2026-10-11 | machine-drafted, needs native review |
| `addressFailed` | so | Could not search — drag the pin to set location | Raadintu ma shaqayn. Jiid calaamadda si aad goobta u dejiso. | 2026-10-11 | machine-drafted, needs native review |
| `placeConfirm` | so | Confirm & Report | Xaqiiji oo soo sheeg | 2026-10-11 | machine-drafted, needs native review |
| `placing` | so | Placing… | Waa la dhigayaa… | 2026-10-11 | machine-drafted, needs native review |
| `placeFailed` | so | Couldn’t place the alert. Try again. | Digniinta lama dhigi karin. Mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `suggestThanks` | so | Thanks — your suggestion is pending review. | Mahadsanid. Soo jeedintaadu waxay sugaysaa dib-u-eegis. | 2026-10-11 | machine-drafted, needs native review |
| `suggestThanksBody` | so | Our team will verify and publish it if it meets community guidelines. | Kooxdayadu way xaqiijin doontaa oo way daabici doontaa haddii ay waafaqsan tahay xeerarka bulshada. | 2026-10-11 | machine-drafted, needs native review |
| `suggestIntro` | so | Know of a resource that’s not on the map? Suggest it and our community team will review it. | Ma taqaan adeeg aan khariidadda ku jirin? Soo jeedi, kooxdayada bulshada ayaa dib u eegi doonta. | 2026-10-11 | machine-drafted, needs native review |
| `suggestCategory` | so | Category | Qaybta | 2026-10-11 | machine-drafted, needs native review |
| `suggestName` | so | Resource name | Magaca adeegga | 2026-10-11 | machine-drafted, needs native review |
| `suggestDescription` | so | Description | Sharraxaad | 2026-10-11 | machine-drafted, needs native review |
| `suggestDescriptionPlaceholder` | so | Who does it serve? What do they offer? Hours? | Yaa loo adeegaa? Maxay bixiyaan? Saacadaha? | 2026-10-11 | machine-drafted, needs native review |
| `suggestCount` | so | {n}/500 characters (minimum 10) | {n}/500 xaraf (ugu yaraan 10) | 2026-10-11 | machine-drafted, needs native review |
| `suggestCity` | so | City | Magaalada | 2026-10-11 | machine-drafted, needs native review |
| `suggestState` | so | State | Gobolka | 2026-10-11 | machine-drafted, needs native review |
| `suggestPhone` | so | Phone | Telefoon | 2026-10-11 | machine-drafted, needs native review |
| `suggestWebsite` | so | Website | Bogga internetka | 2026-10-11 | machine-drafted, needs native review |
| `optional` | so | (optional) | (ikhtiyaari) | 2026-10-11 | machine-drafted, needs native review |
| `exampleValue` | so | e.g. {example} | tusaale: {example} | 2026-10-11 | machine-drafted, needs native review |
| `suggestSubmit` | so | Submit suggestion | Dir soo jeedinta | 2026-10-11 | machine-drafted, needs native review |
| `suggestSubmitting` | so | Submitting… | Waa la dirayaa… | 2026-10-11 | machine-drafted, needs native review |
| `suggestFailed` | so | Couldn’t send the suggestion. Try again. | Soo jeedinta lama diri karin. Mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `typeWeather` | am | Weather Hazard | የአየር ሁኔታ አደጋ | 2026-10-11 | machine-drafted, needs native review |
| `typeRoadClosure` | am | Road Closure | የተዘጋ መንገድ | 2026-10-11 | machine-drafted, needs native review |
| `typeSpeeding` | am | Speeding Area | ከፍጥነት በላይ የሚነዳበት ቦታ | 2026-10-11 | machine-drafted, needs native review |
| `typeGeneral` | am | Safety Alert | የደህንነት ማስጠንቀቂያ | 2026-10-11 | machine-drafted, needs native review |
| `sevLow` | am | Low | ዝቅተኛ | 2026-10-11 | machine-drafted, needs native review |
| `sevModerate` | am | Moderate | መካከለኛ | 2026-10-11 | machine-drafted, needs native review |
| `sevHigh` | am | High | ከፍተኛ | 2026-10-11 | machine-drafted, needs native review |
| `sevCritical` | am | Critical | አሳሳቢ | 2026-10-11 | machine-drafted, needs native review |
| `sevLowHint` | am | Low — heads-up | ዝቅተኛ — ለማሳወቅ | 2026-10-11 | machine-drafted, needs native review |
| `sevModerateHint` | am | Moderate — use caution | መካከለኛ — ይጠንቀቁ | 2026-10-11 | machine-drafted, needs native review |
| `sevHighHint` | am | High — significant risk | ከፍተኛ — ከባድ ስጋት | 2026-10-11 | machine-drafted, needs native review |
| `sevCriticalHint` | am | Critical — avoid area | አሳሳቢ — ከአካባቢው ይራቁ | 2026-10-11 | machine-drafted, needs native review |
| `typeAndSeverity` | am | {type}, {severity} | {type}፣ {severity} | 2026-10-11 | machine-drafted, needs native review |
| `stateVerified` | am | Verified | የተረጋገጠ | 2026-10-11 | machine-drafted, needs native review |
| `stateUnverified` | am | Unverified — neighbor report | ያልተረጋገጠ — የጎረቤት ሪፖርት | 2026-10-11 | machine-drafted, needs native review |
| `stateResolved` | am | Resolved | ተፈትቷል | 2026-10-11 | machine-drafted, needs native review |
| `stateEnded` | am | No longer listed | ከዝርዝሩ ወጥቷል | 2026-10-11 | machine-drafted, needs native review |
| `endedBody` | am | This alert is no longer listed. It may have ended or been withdrawn. | ይህ ማስጠንቀቂያ ከዝርዝሩ ወጥቷል። አብቅቶ ወይም ተነስቶ ሊሆን ይችላል። | 2026-10-11 | machine-drafted, needs native review |
| `reportedAt` | am | Reported {when} | ሪፖርት የተደረገው {when} | 2026-10-11 | machine-drafted, needs native review |
| `updatedAgo` | am | Updated {age} | የተዘመነው {age} | 2026-10-11 | machine-drafted, needs native review |
| `expiresAt` | am | Expires {when} | የሚያበቃው {when} | 2026-10-11 | machine-drafted, needs native review |
| `resolvedAt` | am | Marked resolved {when} | ተፈትቷል ተብሎ የተመለከተው {when} | 2026-10-11 | machine-drafted, needs native review |
| `shownUntil` | am | Shown as resolved until {when} | እስከ {when} ድረስ ተፈትቷል ተብሎ ይታያል | 2026-10-11 | machine-drafted, needs native review |
| `stripTitle` | am | Safety alerts | የደህንነት ማስጠንቀቂያዎች | 2026-10-11 | machine-drafted, needs native review |
| `viewOnMap` | am | View on map | በካርታ ላይ ይመልከቱ | 2026-10-11 | machine-drafted, needs native review |
| `actionUpdate` | am | Update | አዘምን | 2026-10-11 | machine-drafted, needs native review |
| `actionResolve` | am | Mark resolved | ተፈትቷል ብለው ያመልክቱ | 2026-10-11 | machine-drafted, needs native review |
| `actionWithdraw` | am | Withdraw | አንሳ | 2026-10-11 | machine-drafted, needs native review |
| `actionHistory` | am | History | ታሪክ | 2026-10-11 | machine-drafted, needs native review |
| `ownerActions` | am | Your alert | የእርስዎ ማስጠንቀቂያ | 2026-10-11 | machine-drafted, needs native review |
| `close` | am | Close | ዝጋ | 2026-10-11 | machine-drafted, needs native review |
| `countConfirmed` | am | {n} confirmed still here | {n} አሁንም እንዳለ አረጋግጠዋል | 2026-10-11 | machine-drafted, needs native review |
| `countGone` | am | {n} reported gone | {n} እንደሌለ አሳውቀዋል | 2026-10-11 | machine-drafted, needs native review |
| `voteStillHere` | am | Still here | አሁንም አለ | 2026-10-11 | machine-drafted, needs native review |
| `voteGone` | am | Gone now | አሁን የለም | 2026-10-11 | machine-drafted, needs native review |
| `voteSending` | am | Sending… | በመላክ ላይ… | 2026-10-11 | machine-drafted, needs native review |
| `voteFailed` | am | Your vote was not counted. Try again. | ድምጽዎ አልተቆጠረም። እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `voteCleared` | am | Neighbors reported this hazard gone, so the alert was cleared. | ጎረቤቶች ይህ አደጋ እንደሌለ ስላሳወቁ ማስጠንቀቂያው ተነስቷል። | 2026-10-11 | machine-drafted, needs native review |
| `guestHint` | am | Create a free account to confirm or clear alerts. | ማስጠንቀቂያዎችን ለማረጋገጥ ወይም ለማንሳት ነፃ መለያ ይፍጠሩ። | 2026-10-11 | machine-drafted, needs native review |
| `annNew` | am | New safety alert: {type}, {severity}. | አዲስ የደህንነት ማስጠንቀቂያ፦ {type}፣ {severity}። | 2026-10-11 | machine-drafted, needs native review |
| `annRaised` | am | Safety alert raised to {severity}: {type}. | የደህንነት ማስጠንቀቂያው ወደ {severity} ከፍ ብሏል፦ {type}። | 2026-10-11 | machine-drafted, needs native review |
| `annUpdated` | am | Safety alert updated: {type}. | የደህንነት ማስጠንቀቂያ ተዘምኗል፦ {type}። | 2026-10-11 | machine-drafted, needs native review |
| `annResolved` | am | Safety alert resolved: {type}. | የደህንነት ማስጠንቀቂያ ተፈትቷል፦ {type}። | 2026-10-11 | machine-drafted, needs native review |
| `annEnded` | am | Safety alert no longer listed: {type}. | የደህንነት ማስጠንቀቂያው ከዝርዝሩ ወጥቷል፦ {type}። | 2026-10-11 | machine-drafted, needs native review |
| `editTitle` | am | Update alert | ማስጠንቀቂያውን አዘምን | 2026-10-11 | machine-drafted, needs native review |
| `resolveTitle` | am | Mark alert resolved | ማስጠንቀቂያውን ተፈትቷል ብለው ያመልክቱ | 2026-10-11 | machine-drafted, needs native review |
| `withdrawTitle` | am | Withdraw alert | ማስጠንቀቂያውን አንሳ | 2026-10-11 | machine-drafted, needs native review |
| `loadingAlert` | am | Loading the alert… | ማስጠንቀቂያው በመጫን ላይ… | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | am | Couldn’t load the alert. | ማስጠንቀቂያውን መጫን አልተቻለም። | 2026-10-11 | machine-drafted, needs native review |
| `retry` | am | Try again | እንደገና ይሞክሩ | 2026-10-11 | machine-drafted, needs native review |
| `fieldType` | am | Type of hazard | የአደጋው ዓይነት | 2026-10-11 | machine-drafted, needs native review |
| `fieldSeverity` | am | Severity | የክብደት ደረጃ | 2026-10-11 | machine-drafted, needs native review |
| `fieldDescription` | am | Description (optional) | መግለጫ (አማራጭ) | 2026-10-11 | machine-drafted, needs native review |
| `descriptionPlaceholder` | am | Add details neighbors should know… | ጎረቤቶች ማወቅ ያለባቸውን ዝርዝር ያክሉ… | 2026-10-11 | machine-drafted, needs native review |
| `verifiedNotice` | am | This alert is verified. Any change you save returns it to unverified until a moderator checks it again. | ይህ ማስጠንቀቂያ የተረጋገጠ ነው። የሚያስቀምጡት ማንኛውም ለውጥ አወያይ እንደገና እስኪያጣራው ድረስ ወደ ያልተረጋገጠ ይመልሰዋል። | 2026-10-11 | machine-drafted, needs native review |
| `expiryHint` | am | Raising the severity restarts the alert’s clock. Lowering it can shorten the time left. | የክብደት ደረጃውን ከፍ ማድረግ የማስጠንቀቂያውን ሰዓት እንደገና ያስጀምራል። ዝቅ ማድረግ የቀረውን ጊዜ ሊያሳጥር ይችላል። | 2026-10-11 | machine-drafted, needs native review |
| `save` | am | Save changes | ለውጦቹን አስቀምጥ | 2026-10-11 | machine-drafted, needs native review |
| `saving` | am | Saving… | በማስቀመጥ ላይ… | 2026-10-11 | machine-drafted, needs native review |
| `cancel` | am | Cancel | ሰርዝ | 2026-10-11 | machine-drafted, needs native review |
| `savedNotice` | am | Alert updated. | ማስጠንቀቂያው ተዘምኗል። | 2026-10-11 | machine-drafted, needs native review |
| `savedExpiryNotice` | am | Alert updated. It now expires {when}. | ማስጠንቀቂያው ተዘምኗል። አሁን የሚያበቃው {when} ነው። | 2026-10-11 | machine-drafted, needs native review |
| `unverifiedNotice` | am | It is unverified until a moderator checks it again. | አወያይ እንደገና እስኪያጣራው ድረስ ያልተረጋገጠ ሆኖ ይቆያል። | 2026-10-11 | machine-drafted, needs native review |
| `nothingChanged` | am | Nothing was changed. | ምንም አልተቀየረም። | 2026-10-11 | machine-drafted, needs native review |
| `resolveBody` | am | Neighbors will see this alert as resolved for 6 hours. After that it leaves the map and the feed. A resolved alert cannot be reopened: if the hazard returns, report a new alert. | ጎረቤቶች ይህን ማስጠንቀቂያ ለ6 ሰዓታት ተፈትቷል ተብሎ ያዩታል። ከዚያ በኋላ ከካርታው እና ከምግቡ ይወጣል። የተፈታ ማስጠንቀቂያ እንደገና ሊከፈት አይችልም፦ አደጋው ከተመለሰ አዲስ ማስጠንቀቂያ ሪፖርት ያድርጉ። | 2026-10-11 | machine-drafted, needs native review |
| `resolveConfirm` | am | Mark resolved | ተፈትቷል ብለው ያመልክቱ | 2026-10-11 | machine-drafted, needs native review |
| `resolvedNotice` | am | Alert marked resolved. It stays visible as resolved until {when}. | ማስጠንቀቂያው ተፈትቷል ተብሎ ተመልክቷል። እስከ {when} ድረስ ተፈትቷል ተብሎ ይታያል። | 2026-10-11 | machine-drafted, needs native review |
| `withdrawBody` | am | This takes the alert off the map and the feed for everyone right away. The withdrawal is recorded. | ይህ ማስጠንቀቂያውን ከሁሉም ሰው ካርታ እና ምግብ ላይ ወዲያውኑ ያነሳል። መነሳቱ ይመዘገባል። | 2026-10-11 | machine-drafted, needs native review |
| `withdrawConfirm` | am | Withdraw alert | ማስጠንቀቂያውን አንሳ | 2026-10-11 | machine-drafted, needs native review |
| `withdrawnNotice` | am | Alert withdrawn. | ማስጠንቀቂያው ተነስቷል። | 2026-10-11 | machine-drafted, needs native review |
| `conflictTitle` | am | This alert changed while you had it open | ይህ ማስጠንቀቂያ ከፍተውት ሳለ ተቀይሯል | 2026-10-11 | machine-drafted, needs native review |
| `conflictBody` | am | A newer version was saved since you opened it. Check it below, then choose what to do. | ከከፈቱት በኋላ አዲስ ስሪት ተቀምጧል። ከታች ይመልከቱት፣ ከዚያ ምን እንደሚደረግ ይምረጡ። | 2026-10-11 | machine-drafted, needs native review |
| `yourVersion` | am | Your changes | የእርስዎ ለውጦች | 2026-10-11 | machine-drafted, needs native review |
| `currentVersion` | am | Current version | የአሁኑ ስሪት | 2026-10-11 | machine-drafted, needs native review |
| `noDescription` | am | No description | መግለጫ የለም | 2026-10-11 | machine-drafted, needs native review |
| `conflictChoose` | am | Choose what to do | ምን እንደሚደረግ ይምረጡ | 2026-10-11 | machine-drafted, needs native review |
| `keepMine` | am | Keep my changes | የእኔን ለውጦች አቆይ | 2026-10-11 | machine-drafted, needs native review |
| `keepMineHint` | am | Save my changes over the current version. | የእኔን ለውጦች በአሁኑ ስሪት ላይ አስቀምጥ። | 2026-10-11 | machine-drafted, needs native review |
| `useCurrent` | am | Use the current version | የአሁኑን ስሪት ተጠቀም | 2026-10-11 | machine-drafted, needs native review |
| `useCurrentHint` | am | Discard my changes. | የእኔን ለውጦች ተው። | 2026-10-11 | machine-drafted, needs native review |
| `resolveAnyway` | am | Mark it resolved anyway | ቢሆንም ተፈትቷል ብለው ያመልክቱ | 2026-10-11 | machine-drafted, needs native review |
| `leaveAsIs` | am | Leave it as it is | እንዳለ ተወው | 2026-10-11 | machine-drafted, needs native review |
| `continueLabel` | am | Continue | ቀጥል | 2026-10-11 | machine-drafted, needs native review |
| `notSavedNotice` | am | Your changes were not saved. The alert shows its current version. | ለውጦችዎ አልተቀመጡም። ማስጠንቀቂያው የአሁኑን ስሪት ያሳያል። | 2026-10-11 | machine-drafted, needs native review |
| `notResolvedNotice` | am | The alert was left as it is. | ማስጠንቀቂያው እንዳለ ተትቷል። | 2026-10-11 | machine-drafted, needs native review |
| `notLiveNotice` | am | This alert is no longer active, so nothing was changed. | ይህ ማስጠንቀቂያ አሁን ንቁ አይደለም፣ ስለዚህ ምንም አልተቀየረም። | 2026-10-11 | machine-drafted, needs native review |
| `nowResolvedNotice` | am | This alert was already marked resolved, so nothing was changed. | ይህ ማስጠንቀቂያ ቀደም ብሎ ተፈትቷል ተብሎ ተመልክቷል፣ ስለዚህ ምንም አልተቀየረም። | 2026-10-11 | machine-drafted, needs native review |
| `failGuest` | am | Create a free account to report or change safety alerts. | የደህንነት ማስጠንቀቂያዎችን ሪፖርት ለማድረግ ወይም ለመቀየር ነፃ መለያ ይፍጠሩ። | 2026-10-11 | machine-drafted, needs native review |
| `failNotOwner` | am | Only the member who reported this alert can change it. | ይህን ማስጠንቀቂያ መቀየር የሚችለው ሪፖርት ያደረገው አባል ብቻ ነው። | 2026-10-11 | machine-drafted, needs native review |
| `failInvalid` | am | Check the alert details and try again. | የማስጠንቀቂያውን ዝርዝር ያረጋግጡ እና እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `failNetwork` | am | Couldn’t reach FEED. Check your connection and try again. | ከ FEED ጋር መገናኘት አልተቻለም። ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `failUnknown` | am | Something went wrong. Try again. | የሆነ ችግር ተፈጥሯል። እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `historyTitle` | am | Alert history | የማስጠንቀቂያው ታሪክ | 2026-10-11 | machine-drafted, needs native review |
| `historyLoading` | am | Loading the history… | ታሪኩ በመጫን ላይ… | 2026-10-11 | machine-drafted, needs native review |
| `historyLoadFailed` | am | Couldn’t load the history. | ታሪኩን መጫን አልተቻለም። | 2026-10-11 | machine-drafted, needs native review |
| `historyEmpty` | am | There is no history to show. The alert may have ended. | የሚታይ ታሪክ የለም። ማስጠንቀቂያው አብቅቶ ሊሆን ይችላል። | 2026-10-11 | machine-drafted, needs native review |
| `histReported` | am | Reported | ሪፖርት ተደርጓል | 2026-10-11 | machine-drafted, needs native review |
| `histUpdated` | am | Updated | ተዘምኗል | 2026-10-11 | machine-drafted, needs native review |
| `histResolved` | am | Marked resolved | ተፈትቷል ተብሎ ተመልክቷል | 2026-10-11 | machine-drafted, needs native review |
| `histSeverityRaised` | am | Severity raised to {severity} | የክብደት ደረጃው ወደ {severity} ከፍ ብሏል | 2026-10-11 | machine-drafted, needs native review |
| `histSeverityLowered` | am | Severity lowered to {severity} | የክብደት ደረጃው ወደ {severity} ዝቅ ብሏል | 2026-10-11 | machine-drafted, needs native review |
| `histTextChanged` | am | Description changed | መግለጫው ተቀይሯል | 2026-10-11 | machine-drafted, needs native review |
| `histTextRemoved` | am | Description removed | መግለጫው ተወግዷል | 2026-10-11 | machine-drafted, needs native review |
| `histTypeChanged` | am | Type changed to {type} | ዓይነቱ ወደ {type} ተቀይሯል | 2026-10-11 | machine-drafted, needs native review |
| `histLocationMoved` | am | Location moved | ቦታው ተቀይሯል | 2026-10-11 | machine-drafted, needs native review |
| `hazardOpen` | am | Report a hazard or add a resource | አደጋ ሪፖርት ያድርጉ ወይም ግብዓት ያክሉ | 2026-10-11 | machine-drafted, needs native review |
| `hazardClose` | am | Close safety menu | የደህንነት ምናሌውን ዝጋ | 2026-10-11 | machine-drafted, needs native review |
| `panelTitle` | am | Safety & Resources | ደህንነት እና ግብዓቶች | 2026-10-11 | machine-drafted, needs native review |
| `entryWeather` | am | Report weather hazard | የአየር ሁኔታ አደጋ ሪፖርት ያድርጉ | 2026-10-11 | machine-drafted, needs native review |
| `entryWeatherBody` | am | Ice, flooding, high winds, downed branches, etc. | በረዶ፣ ጎርፍ፣ ኃይለኛ ነፋስ፣ የወደቁ ቅርንጫፎች፣ ወዘተ። | 2026-10-11 | machine-drafted, needs native review |
| `entryRoad` | am | Report road closure | የተዘጋ መንገድ ሪፖርት ያድርጉ | 2026-10-11 | machine-drafted, needs native review |
| `entryRoadBody` | am | Blocked road, bridge out, construction, accident. | የተዘጋ መንገድ፣ የተበላሸ ድልድይ፣ ግንባታ፣ አደጋ። | 2026-10-11 | machine-drafted, needs native review |
| `entrySpeeding` | am | Report speeding area | ከፍጥነት በላይ የሚነዳበትን ቦታ ሪፖርት ያድርጉ | 2026-10-11 | machine-drafted, needs native review |
| `entrySpeedingBody` | am | Vehicles exceeding safe speed near pedestrians. | በእግረኞች አቅራቢያ በጣም በፍጥነት የሚሄዱ ተሽከርካሪዎች። | 2026-10-11 | machine-drafted, needs native review |
| `entryGeneral` | am | Report general safety issue | አጠቃላይ የደህንነት ችግር ሪፖርት ያድርጉ | 2026-10-11 | machine-drafted, needs native review |
| `entryGeneralBody` | am | Other safety concern in this area. | በዚህ አካባቢ ያለ ሌላ የደህንነት ስጋት። | 2026-10-11 | machine-drafted, needs native review |
| `suggestEntry` | am | Suggest a Resource | ግብዓት ይጠቁሙ | 2026-10-11 | machine-drafted, needs native review |
| `suggestEntryBody` | am | Know a resource that’s missing? Let us know. | የጎደለ ግብዓት ያውቃሉ? ያሳውቁን። | 2026-10-11 | machine-drafted, needs native review |
| `addSelfEntry` | am | Add yourself as a resource | ራስዎን እንደ ግብዓት ያክሉ | 2026-10-11 | machine-drafted, needs native review |
| `addSelfEntryBody` | am | Share what you can offer with neighbors. | ማቅረብ የሚችሉትን ለጎረቤቶችዎ ያጋሩ። | 2026-10-11 | machine-drafted, needs native review |
| `pinLocation` | am | Pin location | የምልክቱ ቦታ | 2026-10-11 | machine-drafted, needs native review |
| `pinSetting` | am | Setting location… | ቦታው በመወሰን ላይ… | 2026-10-11 | machine-drafted, needs native review |
| `pinHint` | am | Drag the orange pin on the map or search below | በካርታው ላይ ያለውን ብርቱካናማ ምልክት ይጎትቱ ወይም ከታች ይፈልጉ | 2026-10-11 | machine-drafted, needs native review |
| `addressLabel` | am | Search for an address | አድራሻ ይፈልጉ | 2026-10-11 | machine-drafted, needs native review |
| `addressPlaceholder` | am | Enter address… | አድራሻ ያስገቡ… | 2026-10-11 | machine-drafted, needs native review |
| `addressFind` | am | Find | ፈልግ | 2026-10-11 | machine-drafted, needs native review |
| `addressFinding` | am | Searching… | በመፈለግ ላይ… | 2026-10-11 | machine-drafted, needs native review |
| `addressMoved` | am | Pin moved to address | ምልክቱ ወደ አድራሻው ተዛውሯል | 2026-10-11 | machine-drafted, needs native review |
| `addressNotFound` | am | Address not found — drag the pin to set location | አድራሻው አልተገኘም። ቦታውን ለመወሰን ምልክቱን ይጎትቱ። | 2026-10-11 | machine-drafted, needs native review |
| `addressFailed` | am | Could not search — drag the pin to set location | ፍለጋው አልሰራም። ቦታውን ለመወሰን ምልክቱን ይጎትቱ። | 2026-10-11 | machine-drafted, needs native review |
| `placeConfirm` | am | Confirm & Report | አረጋግጥ እና ሪፖርት አድርግ | 2026-10-11 | machine-drafted, needs native review |
| `placing` | am | Placing… | በማስቀመጥ ላይ… | 2026-10-11 | machine-drafted, needs native review |
| `placeFailed` | am | Couldn’t place the alert. Try again. | ማስጠንቀቂያውን ማስቀመጥ አልተቻለም። እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `suggestThanks` | am | Thanks — your suggestion is pending review. | እናመሰግናለን። ጥቆማዎ ግምገማ እየጠበቀ ነው። | 2026-10-11 | machine-drafted, needs native review |
| `suggestThanksBody` | am | Our team will verify and publish it if it meets community guidelines. | የማህበረሰቡን መመሪያዎች የሚያሟላ ከሆነ ቡድናችን አረጋግጦ ያትመዋል። | 2026-10-11 | machine-drafted, needs native review |
| `suggestIntro` | am | Know of a resource that’s not on the map? Suggest it and our community team will review it. | በካርታው ላይ የሌለ ግብዓት ያውቃሉ? ይጠቁሙ፣ የማህበረሰብ ቡድናችን ይገመግመዋል። | 2026-10-11 | machine-drafted, needs native review |
| `suggestCategory` | am | Category | ምድብ | 2026-10-11 | machine-drafted, needs native review |
| `suggestName` | am | Resource name | የግብዓቱ ስም | 2026-10-11 | machine-drafted, needs native review |
| `suggestDescription` | am | Description | መግለጫ | 2026-10-11 | machine-drafted, needs native review |
| `suggestDescriptionPlaceholder` | am | Who does it serve? What do they offer? Hours? | ማንን ያገለግላል? ምን ያቀርባል? የሥራ ሰዓት? | 2026-10-11 | machine-drafted, needs native review |
| `suggestCount` | am | {n}/500 characters (minimum 10) | {n}/500 ፊደላት (ቢያንስ 10) | 2026-10-11 | machine-drafted, needs native review |
| `suggestCity` | am | City | ከተማ | 2026-10-11 | machine-drafted, needs native review |
| `suggestState` | am | State | ግዛት | 2026-10-11 | machine-drafted, needs native review |
| `suggestPhone` | am | Phone | ስልክ | 2026-10-11 | machine-drafted, needs native review |
| `suggestWebsite` | am | Website | ድር ጣቢያ | 2026-10-11 | machine-drafted, needs native review |
| `optional` | am | (optional) | (አማራጭ) | 2026-10-11 | machine-drafted, needs native review |
| `exampleValue` | am | e.g. {example} | ለምሳሌ፦ {example} | 2026-10-11 | machine-drafted, needs native review |
| `suggestSubmit` | am | Submit suggestion | ጥቆማውን ላክ | 2026-10-11 | machine-drafted, needs native review |
| `suggestSubmitting` | am | Submitting… | በመላክ ላይ… | 2026-10-11 | machine-drafted, needs native review |
| `suggestFailed` | am | Couldn’t send the suggestion. Try again. | ጥቆማውን መላክ አልተቻለም። እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `typeWeather` | hmn | Weather Hazard | Kev phom sij vim huab cua | 2026-10-11 | machine-drafted, needs native review |
| `typeRoadClosure` | hmn | Road Closure | Kev raug kaw | 2026-10-11 | machine-drafted, needs native review |
| `typeSpeeding` | hmn | Speeding Area | Thaj chaw tsav tsheb ceev dhau | 2026-10-11 | machine-drafted, needs native review |
| `typeGeneral` | hmn | Safety Alert | Lus ceeb toom kev nyab xeeb | 2026-10-11 | machine-drafted, needs native review |
| `sevLow` | hmn | Low | Qis | 2026-10-11 | machine-drafted, needs native review |
| `sevModerate` | hmn | Moderate | Nruab nrab | 2026-10-11 | machine-drafted, needs native review |
| `sevHigh` | hmn | High | Siab | 2026-10-11 | machine-drafted, needs native review |
| `sevCritical` | hmn | Critical | Loj heev | 2026-10-11 | machine-drafted, needs native review |
| `sevLowHint` | hmn | Low — heads-up | Qis — qhia kom paub | 2026-10-11 | machine-drafted, needs native review |
| `sevModerateHint` | hmn | Moderate — use caution | Nruab nrab — ceev faj | 2026-10-11 | machine-drafted, needs native review |
| `sevHighHint` | hmn | High — significant risk | Siab — muaj kev phom sij loj | 2026-10-11 | machine-drafted, needs native review |
| `sevCriticalHint` | hmn | Critical — avoid area | Loj heev — zam thaj chaw no | 2026-10-11 | machine-drafted, needs native review |
| `typeAndSeverity` | hmn | {type}, {severity} | {type}, {severity} | 2026-10-11 | machine-drafted, needs native review |
| `stateVerified` | hmn | Verified | Tau txheeb xyuas lawm | 2026-10-11 | machine-drafted, needs native review |
| `stateUnverified` | hmn | Unverified — neighbor report | Tsis tau txheeb xyuas — ib tug neeg zej zog qhia | 2026-10-11 | machine-drafted, needs native review |
| `stateResolved` | hmn | Resolved | Daws tau lawm | 2026-10-11 | machine-drafted, needs native review |
| `stateEnded` | hmn | No longer listed | Tsis nyob hauv daim ntawv teev lawm | 2026-10-11 | machine-drafted, needs native review |
| `endedBody` | hmn | This alert is no longer listed. It may have ended or been withdrawn. | Lo lus ceeb toom no tsis nyob hauv daim ntawv teev lawm. Tej zaum nws tas lawm los yog raug rho tawm. | 2026-10-11 | machine-drafted, needs native review |
| `reportedAt` | hmn | Reported {when} | Tau qhia {when} | 2026-10-11 | machine-drafted, needs native review |
| `updatedAgo` | hmn | Updated {age} | Hloov tshiab {age} | 2026-10-11 | machine-drafted, needs native review |
| `expiresAt` | hmn | Expires {when} | Yuav tas {when} | 2026-10-11 | machine-drafted, needs native review |
| `resolvedAt` | hmn | Marked resolved {when} | Cim tias daws tau lawm {when} | 2026-10-11 | machine-drafted, needs native review |
| `shownUntil` | hmn | Shown as resolved until {when} | Yuav qhia tias daws tau lawm mus txog {when} | 2026-10-11 | machine-drafted, needs native review |
| `stripTitle` | hmn | Safety alerts | Cov lus ceeb toom kev nyab xeeb | 2026-10-11 | machine-drafted, needs native review |
| `viewOnMap` | hmn | View on map | Saib hauv daim ntawv qhia chaw | 2026-10-11 | machine-drafted, needs native review |
| `actionUpdate` | hmn | Update | Hloov tshiab | 2026-10-11 | machine-drafted, needs native review |
| `actionResolve` | hmn | Mark resolved | Cim tias daws tau lawm | 2026-10-11 | machine-drafted, needs native review |
| `actionWithdraw` | hmn | Withdraw | Rho tawm | 2026-10-11 | machine-drafted, needs native review |
| `actionHistory` | hmn | History | Keeb kwm | 2026-10-11 | machine-drafted, needs native review |
| `ownerActions` | hmn | Your alert | Koj lo lus ceeb toom | 2026-10-11 | machine-drafted, needs native review |
| `close` | hmn | Close | Kaw | 2026-10-11 | machine-drafted, needs native review |
| `countConfirmed` | hmn | {n} confirmed still here | {n} tus lees tias tseem muaj | 2026-10-11 | machine-drafted, needs native review |
| `countGone` | hmn | {n} reported gone | {n} tus qhia tias tsis muaj lawm | 2026-10-11 | machine-drafted, needs native review |
| `voteStillHere` | hmn | Still here | Tseem muaj | 2026-10-11 | machine-drafted, needs native review |
| `voteGone` | hmn | Gone now | Tsis muaj lawm | 2026-10-11 | machine-drafted, needs native review |
| `voteSending` | hmn | Sending… | Tab tom xa… | 2026-10-11 | machine-drafted, needs native review |
| `voteFailed` | hmn | Your vote was not counted. Try again. | Koj lub suab tsis tau raug suav. Sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `voteCleared` | hmn | Neighbors reported this hazard gone, so the alert was cleared. | Cov neeg zej zog qhia tias qhov kev phom sij no tsis muaj lawm, yog li lo lus ceeb toom raug tshem lawm. | 2026-10-11 | machine-drafted, needs native review |
| `guestHint` | hmn | Create a free account to confirm or clear alerts. | Tsim ib tus as khauj dawb kom lees los yog tshem tau cov lus ceeb toom. | 2026-10-11 | machine-drafted, needs native review |
| `annNew` | hmn | New safety alert: {type}, {severity}. | Lus ceeb toom kev nyab xeeb tshiab: {type}, {severity}. | 2026-10-11 | machine-drafted, needs native review |
| `annRaised` | hmn | Safety alert raised to {severity}: {type}. | Lo lus ceeb toom kev nyab xeeb nce mus rau theem {severity}: {type}. | 2026-10-11 | machine-drafted, needs native review |
| `annUpdated` | hmn | Safety alert updated: {type}. | Lo lus ceeb toom kev nyab xeeb tau hloov tshiab: {type}. | 2026-10-11 | machine-drafted, needs native review |
| `annResolved` | hmn | Safety alert resolved: {type}. | Lo lus ceeb toom kev nyab xeeb daws tau lawm: {type}. | 2026-10-11 | machine-drafted, needs native review |
| `annEnded` | hmn | Safety alert no longer listed: {type}. | Lo lus ceeb toom kev nyab xeeb tsis nyob hauv daim ntawv teev lawm: {type}. | 2026-10-11 | machine-drafted, needs native review |
| `editTitle` | hmn | Update alert | Hloov lo lus ceeb toom tshiab | 2026-10-11 | machine-drafted, needs native review |
| `resolveTitle` | hmn | Mark alert resolved | Cim lo lus ceeb toom tias daws tau lawm | 2026-10-11 | machine-drafted, needs native review |
| `withdrawTitle` | hmn | Withdraw alert | Rho lo lus ceeb toom tawm | 2026-10-11 | machine-drafted, needs native review |
| `loadingAlert` | hmn | Loading the alert… | Tab tom thauj lo lus ceeb toom… | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | hmn | Couldn’t load the alert. | Thauj tsis tau lo lus ceeb toom. | 2026-10-11 | machine-drafted, needs native review |
| `retry` | hmn | Try again | Sim dua | 2026-10-11 | machine-drafted, needs native review |
| `fieldType` | hmn | Type of hazard | Hom kev phom sij | 2026-10-11 | machine-drafted, needs native review |
| `fieldSeverity` | hmn | Severity | Theem loj npaum li cas | 2026-10-11 | machine-drafted, needs native review |
| `fieldDescription` | hmn | Description (optional) | Lus piav qhia (tsis yuam) | 2026-10-11 | machine-drafted, needs native review |
| `descriptionPlaceholder` | hmn | Add details neighbors should know… | Ntxiv tej yam uas cov neeg zej zog yuav tsum paub… | 2026-10-11 | machine-drafted, needs native review |
| `verifiedNotice` | hmn | This alert is verified. Any change you save returns it to unverified until a moderator checks it again. | Lo lus ceeb toom no tau txheeb xyuas lawm. Txhua yam kev hloov uas koj khaws yuav ua rau nws rov qab mus ua tsis tau txheeb xyuas mus txog thaum ib tug neeg saib xyuas rov kuaj dua. | 2026-10-11 | machine-drafted, needs native review |
| `expiryHint` | hmn | Raising the severity restarts the alert’s clock. Lowering it can shorten the time left. | Tsa theem siab dua yuav pib suav lub sij hawm dua tshiab. Txo qis yuav ua tau rau lub sij hawm seem luv dua. | 2026-10-11 | machine-drafted, needs native review |
| `save` | hmn | Save changes | Khaws cov kev hloov | 2026-10-11 | machine-drafted, needs native review |
| `saving` | hmn | Saving… | Tab tom khaws… | 2026-10-11 | machine-drafted, needs native review |
| `cancel` | hmn | Cancel | Tso tseg | 2026-10-11 | machine-drafted, needs native review |
| `savedNotice` | hmn | Alert updated. | Lo lus ceeb toom tau hloov tshiab lawm. | 2026-10-11 | machine-drafted, needs native review |
| `savedExpiryNotice` | hmn | Alert updated. It now expires {when}. | Lo lus ceeb toom tau hloov tshiab lawm. Tam sim no nws yuav tas {when}. | 2026-10-11 | machine-drafted, needs native review |
| `unverifiedNotice` | hmn | It is unverified until a moderator checks it again. | Nws tsis tau txheeb xyuas mus txog thaum ib tug neeg saib xyuas rov kuaj dua. | 2026-10-11 | machine-drafted, needs native review |
| `nothingChanged` | hmn | Nothing was changed. | Tsis muaj dab tsi hloov. | 2026-10-11 | machine-drafted, needs native review |
| `resolveBody` | hmn | Neighbors will see this alert as resolved for 6 hours. After that it leaves the map and the feed. A resolved alert cannot be reopened: if the hazard returns, report a new alert. | Cov neeg zej zog yuav pom lo lus ceeb toom no tias daws tau lawm tau 6 teev. Tom qab ntawd nws yuav ploj ntawm daim ntawv qhia chaw thiab ntawm cov ntawv tshaj tawm. Lo lus ceeb toom uas daws tau lawm rov qhib tsis tau: yog qhov kev phom sij rov qab los, qhia ib lo lus ceeb toom tshiab. | 2026-10-11 | machine-drafted, needs native review |
| `resolveConfirm` | hmn | Mark resolved | Cim tias daws tau lawm | 2026-10-11 | machine-drafted, needs native review |
| `resolvedNotice` | hmn | Alert marked resolved. It stays visible as resolved until {when}. | Lo lus ceeb toom raug cim tias daws tau lawm. Nws yuav pom tias daws tau lawm mus txog {when}. | 2026-10-11 | machine-drafted, needs native review |
| `withdrawBody` | hmn | This takes the alert off the map and the feed for everyone right away. The withdrawal is recorded. | Qhov no tshem lo lus ceeb toom ntawm txhua tus daim ntawv qhia chaw thiab cov ntawv tshaj tawm tam sim ntawd. Kev rho tawm raug sau cia. | 2026-10-11 | machine-drafted, needs native review |
| `withdrawConfirm` | hmn | Withdraw alert | Rho lo lus ceeb toom tawm | 2026-10-11 | machine-drafted, needs native review |
| `withdrawnNotice` | hmn | Alert withdrawn. | Lo lus ceeb toom raug rho tawm lawm. | 2026-10-11 | machine-drafted, needs native review |
| `conflictTitle` | hmn | This alert changed while you had it open | Lo lus ceeb toom no hloov thaum koj tseem qhib nws | 2026-10-11 | machine-drafted, needs native review |
| `conflictBody` | hmn | A newer version was saved since you opened it. Check it below, then choose what to do. | Muaj ib tsab tshiab dua raug khaws txij thaum koj qhib nws. Saib nws hauv qab no, ces xaiv seb yuav ua li cas. | 2026-10-11 | machine-drafted, needs native review |
| `yourVersion` | hmn | Your changes | Koj cov kev hloov | 2026-10-11 | machine-drafted, needs native review |
| `currentVersion` | hmn | Current version | Tsab tam sim no | 2026-10-11 | machine-drafted, needs native review |
| `noDescription` | hmn | No description | Tsis muaj lus piav qhia | 2026-10-11 | machine-drafted, needs native review |
| `conflictChoose` | hmn | Choose what to do | Xaiv seb yuav ua li cas | 2026-10-11 | machine-drafted, needs native review |
| `keepMine` | hmn | Keep my changes | Khaws kuv cov kev hloov | 2026-10-11 | machine-drafted, needs native review |
| `keepMineHint` | hmn | Save my changes over the current version. | Khaws kuv cov kev hloov tso rau saum tsab tam sim no. | 2026-10-11 | machine-drafted, needs native review |
| `useCurrent` | hmn | Use the current version | Siv tsab tam sim no | 2026-10-11 | machine-drafted, needs native review |
| `useCurrentHint` | hmn | Discard my changes. | Muab kuv cov kev hloov pov tseg. | 2026-10-11 | machine-drafted, needs native review |
| `resolveAnyway` | hmn | Mark it resolved anyway | Cia li cim tias daws tau lawm | 2026-10-11 | machine-drafted, needs native review |
| `leaveAsIs` | hmn | Leave it as it is | Cia nws nyob li qub | 2026-10-11 | machine-drafted, needs native review |
| `continueLabel` | hmn | Continue | Mus ntxiv | 2026-10-11 | machine-drafted, needs native review |
| `notSavedNotice` | hmn | Your changes were not saved. The alert shows its current version. | Koj cov kev hloov tsis tau raug khaws. Lo lus ceeb toom qhia nws tsab tam sim no. | 2026-10-11 | machine-drafted, needs native review |
| `notResolvedNotice` | hmn | The alert was left as it is. | Lo lus ceeb toom raug cia nyob li qub. | 2026-10-11 | machine-drafted, needs native review |
| `notLiveNotice` | hmn | This alert is no longer active, so nothing was changed. | Lo lus ceeb toom no tsis siv lawm, yog li tsis muaj dab tsi hloov. | 2026-10-11 | machine-drafted, needs native review |
| `nowResolvedNotice` | hmn | This alert was already marked resolved, so nothing was changed. | Lo lus ceeb toom no twb raug cim tias daws tau lawm, yog li tsis muaj dab tsi hloov. | 2026-10-11 | machine-drafted, needs native review |
| `failGuest` | hmn | Create a free account to report or change safety alerts. | Tsim ib tus as khauj dawb kom qhia los yog hloov tau cov lus ceeb toom kev nyab xeeb. | 2026-10-11 | machine-drafted, needs native review |
| `failNotOwner` | hmn | Only the member who reported this alert can change it. | Tsuas yog tus tswv cuab uas qhia lo lus ceeb toom no thiaj hloov tau nws. | 2026-10-11 | machine-drafted, needs native review |
| `failInvalid` | hmn | Check the alert details and try again. | Kuaj cov ntsiab lus ntawm lo lus ceeb toom thiab sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `failNetwork` | hmn | Couldn’t reach FEED. Check your connection and try again. | Txuas tsis tau rau FEED. Kuaj koj txoj kev txuas thiab sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `failUnknown` | hmn | Something went wrong. Try again. | Muaj ib yam tsis raug. Sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `historyTitle` | hmn | Alert history | Keeb kwm ntawm lo lus ceeb toom | 2026-10-11 | machine-drafted, needs native review |
| `historyLoading` | hmn | Loading the history… | Tab tom thauj keeb kwm… | 2026-10-11 | machine-drafted, needs native review |
| `historyLoadFailed` | hmn | Couldn’t load the history. | Thauj tsis tau keeb kwm. | 2026-10-11 | machine-drafted, needs native review |
| `historyEmpty` | hmn | There is no history to show. The alert may have ended. | Tsis muaj keeb kwm los qhia. Tej zaum lo lus ceeb toom tas lawm. | 2026-10-11 | machine-drafted, needs native review |
| `histReported` | hmn | Reported | Tau qhia | 2026-10-11 | machine-drafted, needs native review |
| `histUpdated` | hmn | Updated | Tau hloov tshiab | 2026-10-11 | machine-drafted, needs native review |
| `histResolved` | hmn | Marked resolved | Cim tias daws tau lawm | 2026-10-11 | machine-drafted, needs native review |
| `histSeverityRaised` | hmn | Severity raised to {severity} | Theem nce mus rau {severity} | 2026-10-11 | machine-drafted, needs native review |
| `histSeverityLowered` | hmn | Severity lowered to {severity} | Theem nqis mus rau {severity} | 2026-10-11 | machine-drafted, needs native review |
| `histTextChanged` | hmn | Description changed | Lus piav qhia tau hloov | 2026-10-11 | machine-drafted, needs native review |
| `histTextRemoved` | hmn | Description removed | Lus piav qhia raug tshem | 2026-10-11 | machine-drafted, needs native review |
| `histTypeChanged` | hmn | Type changed to {type} | Hom hloov mus ua {type} | 2026-10-11 | machine-drafted, needs native review |
| `histLocationMoved` | hmn | Location moved | Qhov chaw tau tsiv | 2026-10-11 | machine-drafted, needs native review |
| `hazardOpen` | hmn | Report a hazard or add a resource | Qhia ib qho kev phom sij los yog ntxiv ib qho chaw pab | 2026-10-11 | machine-drafted, needs native review |
| `hazardClose` | hmn | Close safety menu | Kaw daim ntawv xaiv kev nyab xeeb | 2026-10-11 | machine-drafted, needs native review |
| `panelTitle` | hmn | Safety & Resources | Kev nyab xeeb thiab chaw pab | 2026-10-11 | machine-drafted, needs native review |
| `entryWeather` | hmn | Report weather hazard | Qhia kev phom sij vim huab cua | 2026-10-11 | machine-drafted, needs native review |
| `entryWeatherBody` | hmn | Ice, flooding, high winds, downed branches, etc. | Dej khov, dej nyab, cua hlob, ceg ntoo poob, thiab lwm yam. | 2026-10-11 | machine-drafted, needs native review |
| `entryRoad` | hmn | Report road closure | Qhia kev raug kaw | 2026-10-11 | machine-drafted, needs native review |
| `entryRoadBody` | hmn | Blocked road, bridge out, construction, accident. | Kev raug thaiv, choj puas, kho kev, tsheb sib tsoo. | 2026-10-11 | machine-drafted, needs native review |
| `entrySpeeding` | hmn | Report speeding area | Qhia thaj chaw tsav tsheb ceev dhau | 2026-10-11 | machine-drafted, needs native review |
| `entrySpeedingBody` | hmn | Vehicles exceeding safe speed near pedestrians. | Tsheb khiav ceev dhau ze cov neeg taug kev. | 2026-10-11 | machine-drafted, needs native review |
| `entryGeneral` | hmn | Report general safety issue | Qhia teeb meem kev nyab xeeb dav dav | 2026-10-11 | machine-drafted, needs native review |
| `entryGeneralBody` | hmn | Other safety concern in this area. | Lwm yam kev txhawj txog kev nyab xeeb hauv thaj chaw no. | 2026-10-11 | machine-drafted, needs native review |
| `suggestEntry` | hmn | Suggest a Resource | Pom zoo ib qho chaw pab | 2026-10-11 | machine-drafted, needs native review |
| `suggestEntryBody` | hmn | Know a resource that’s missing? Let us know. | Koj puas paub ib qho chaw pab uas tseem tsis muaj? Qhia rau peb. | 2026-10-11 | machine-drafted, needs native review |
| `addSelfEntry` | hmn | Add yourself as a resource | Ntxiv koj tus kheej ua ib qho chaw pab | 2026-10-11 | machine-drafted, needs native review |
| `addSelfEntryBody` | hmn | Share what you can offer with neighbors. | Qhia rau cov neeg zej zog seb koj pab tau dab tsi. | 2026-10-11 | machine-drafted, needs native review |
| `pinLocation` | hmn | Pin location | Qhov chaw ntawm tus pin | 2026-10-11 | machine-drafted, needs native review |
| `pinSetting` | hmn | Setting location… | Tab tom teem qhov chaw… | 2026-10-11 | machine-drafted, needs native review |
| `pinHint` | hmn | Drag the orange pin on the map or search below | Rub tus pin txiv kab ntxwv hauv daim ntawv qhia chaw los yog nrhiav hauv qab no | 2026-10-11 | machine-drafted, needs native review |
| `addressLabel` | hmn | Search for an address | Nrhiav ib qho chaw nyob | 2026-10-11 | machine-drafted, needs native review |
| `addressPlaceholder` | hmn | Enter address… | Sau qhov chaw nyob… | 2026-10-11 | machine-drafted, needs native review |
| `addressFind` | hmn | Find | Nrhiav | 2026-10-11 | machine-drafted, needs native review |
| `addressFinding` | hmn | Searching… | Tab tom nrhiav… | 2026-10-11 | machine-drafted, needs native review |
| `addressMoved` | hmn | Pin moved to address | Tus pin tsiv mus rau qhov chaw nyob lawm | 2026-10-11 | machine-drafted, needs native review |
| `addressNotFound` | hmn | Address not found — drag the pin to set location | Nrhiav tsis pom qhov chaw nyob. Rub tus pin los teem qhov chaw. | 2026-10-11 | machine-drafted, needs native review |
| `addressFailed` | hmn | Could not search — drag the pin to set location | Kev nrhiav tsis ua hauj lwm. Rub tus pin los teem qhov chaw. | 2026-10-11 | machine-drafted, needs native review |
| `placeConfirm` | hmn | Confirm & Report | Lees thiab qhia | 2026-10-11 | machine-drafted, needs native review |
| `placing` | hmn | Placing… | Tab tom tso… | 2026-10-11 | machine-drafted, needs native review |
| `placeFailed` | hmn | Couldn’t place the alert. Try again. | Tso tsis tau lo lus ceeb toom. Sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `suggestThanks` | hmn | Thanks — your suggestion is pending review. | Ua tsaug. Koj cov lus pom zoo tab tom tos kev tshuaj xyuas. | 2026-10-11 | machine-drafted, needs native review |
| `suggestThanksBody` | hmn | Our team will verify and publish it if it meets community guidelines. | Peb pab neeg yuav txheeb xyuas thiab tshaj tawm yog nws raws li cov cai ntawm zej zog. | 2026-10-11 | machine-drafted, needs native review |
| `suggestIntro` | hmn | Know of a resource that’s not on the map? Suggest it and our community team will review it. | Koj puas paub ib qho chaw pab uas tsis nyob hauv daim ntawv qhia chaw? Pom zoo nws thiab peb pab neeg zej zog yuav tshuaj xyuas. | 2026-10-11 | machine-drafted, needs native review |
| `suggestCategory` | hmn | Category | Pawg | 2026-10-11 | machine-drafted, needs native review |
| `suggestName` | hmn | Resource name | Lub npe ntawm qhov chaw pab | 2026-10-11 | machine-drafted, needs native review |
| `suggestDescription` | hmn | Description | Lus piav qhia | 2026-10-11 | machine-drafted, needs native review |
| `suggestDescriptionPlaceholder` | hmn | Who does it serve? What do they offer? Hours? | Nws pab leej twg? Nws muab dab tsi? Lub sij hawm qhib? | 2026-10-11 | machine-drafted, needs native review |
| `suggestCount` | hmn | {n}/500 characters (minimum 10) | {n}/500 tus ntawv (tsawg kawg 10) | 2026-10-11 | machine-drafted, needs native review |
| `suggestCity` | hmn | City | Lub nroog | 2026-10-11 | machine-drafted, needs native review |
| `suggestState` | hmn | State | Lub xeev | 2026-10-11 | machine-drafted, needs native review |
| `suggestPhone` | hmn | Phone | Xov tooj | 2026-10-11 | machine-drafted, needs native review |
| `suggestWebsite` | hmn | Website | Lub vev xaib | 2026-10-11 | machine-drafted, needs native review |
| `optional` | hmn | (optional) | (tsis yuam) | 2026-10-11 | machine-drafted, needs native review |
| `exampleValue` | hmn | e.g. {example} | piv txwv: {example} | 2026-10-11 | machine-drafted, needs native review |
| `suggestSubmit` | hmn | Submit suggestion | Xa cov lus pom zoo | 2026-10-11 | machine-drafted, needs native review |
| `suggestSubmitting` | hmn | Submitting… | Tab tom xa… | 2026-10-11 | machine-drafted, needs native review |
| `suggestFailed` | hmn | Couldn’t send the suggestion. Try again. | Xa tsis tau cov lus pom zoo. Sim dua. | 2026-10-11 | machine-drafted, needs native review |

### `lib/i18n-feed-businesses.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `title` | ht | Local Businesses | Biznis lokal yo | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | ht | Community-submitted local businesses near you | Biznis lokal toupre w, kominote a ajoute | 2026-10-11 | machine-drafted, needs native review |
| `addBusiness` | ht | Add a local business | Ajoute yon biznis lokal | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | ht | Create a free account to add a local business to the map | Kreye yon kont gratis pou w ajoute yon biznis lokal sou kat la | 2026-10-11 | machine-drafted, needs native review |
| `formLabel` | ht | Submit a local business | Soumèt yon biznis lokal | 2026-10-11 | machine-drafted, needs native review |
| `submitError` | ht | Could not submit: {message}. Please try again. | Nou pa t kapab soumèt li: {message}. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `submitFailed` | ht | Could not submit. Please try again. | Nou pa t kapab soumèt li. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `submittedTitle` | ht | Submitted for review | Soumèt pou revizyon | 2026-10-11 | machine-drafted, needs native review |
| `submittedBody` | ht | Your business is pending review. A resource admin will approve it before it appears on the map. | Biznis ou an ap tann revizyon. Yon administratè resous ap apwouve l anvan li parèt sou kat la. | 2026-10-11 | machine-drafted, needs native review |
| `done` | ht | Done | Fini | 2026-10-11 | machine-drafted, needs native review |
| `fieldName` | ht | Business name | Non biznis la | 2026-10-11 | machine-drafted, needs native review |
| `phName` | ht | Corner Cafe | Kafe Kwen an | 2026-10-11 | machine-drafted, needs native review |
| `fieldDescription` | ht | Description | Deskripsyon | 2026-10-11 | machine-drafted, needs native review |
| `phDescription` | ht | What does this business offer the community? | Kisa biznis sa a ofri kominote a? | 2026-10-11 | machine-drafted, needs native review |
| `fieldAddress` | ht | Street address | Adrès | 2026-10-11 | machine-drafted, needs native review |
| `fieldCity` | ht | City | Vil | 2026-10-11 | machine-drafted, needs native review |
| `fieldState` | ht | State | Eta | 2026-10-11 | machine-drafted, needs native review |
| `fieldPhone` | ht | Phone | Telefòn | 2026-10-11 | machine-drafted, needs native review |
| `fieldWebsite` | ht | Website | Sit entènèt | 2026-10-11 | machine-drafted, needs native review |
| `sectionDetails` | ht | Details | Detay | 2026-10-11 | machine-drafted, needs native review |
| `fieldCategory` | ht | Category | Kategori | 2026-10-11 | machine-drafted, needs native review |
| `selectPlaceholder` | ht | Select… | Chwazi… | 2026-10-11 | machine-drafted, needs native review |
| `fieldEmail` | ht | Email | Imèl | 2026-10-11 | machine-drafted, needs native review |
| `fieldCostModel` | ht | Cost model | Kalite pri | 2026-10-11 | machine-drafted, needs native review |
| `costFree` | ht | Free | Gratis | 2026-10-11 | machine-drafted, needs native review |
| `costSlidingScale` | ht | Sliding scale | Pri selon mwayen | 2026-10-11 | machine-drafted, needs native review |
| `costPaid` | ht | Paid | Peyan | 2026-10-11 | machine-drafted, needs native review |
| `fieldZip` | ht | ZIP code | Kòd postal | 2026-10-11 | machine-drafted, needs native review |
| `fieldRadius` | ht | Service radius (miles) | Reyon sèvis (mil) | 2026-10-11 | machine-drafted, needs native review |
| `catFood` | ht | Food | Manje | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | ht | Housing | Lojman | 2026-10-11 | machine-drafted, needs native review |
| `catHealth` | ht | Health | Sante | 2026-10-11 | machine-drafted, needs native review |
| `catLegal` | ht | Legal | Legal | 2026-10-11 | machine-drafted, needs native review |
| `catEmployment` | ht | Employment | Travay | 2026-10-11 | machine-drafted, needs native review |
| `catChildcare` | ht | Childcare | Gadri timoun | 2026-10-11 | machine-drafted, needs native review |
| `catTransportation` | ht | Transportation | Transpò | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | ht | Education | Edikasyon | 2026-10-11 | machine-drafted, needs native review |
| `catFinancial` | ht | Financial | Finans | 2026-10-11 | machine-drafted, needs native review |
| `catRetail` | ht | Retail | Komès | 2026-10-11 | machine-drafted, needs native review |
| `catOther` | ht | Other | Lòt | 2026-10-11 | machine-drafted, needs native review |
| `sectionHours` | ht | Hours | Orè | 2026-10-11 | machine-drafted, needs native review |
| `copyMonday` | ht | Copy Monday to weekdays | Kopye lendi sou jou travay yo | 2026-10-11 | machine-drafted, needs native review |
| `hoursOpen` | ht | Open | Ouvri | 2026-10-11 | machine-drafted, needs native review |
| `hoursClosed` | ht | Closed | Fèmen | 2026-10-11 | machine-drafted, needs native review |
| `openTimeAria` | ht | {day} opening time | Lè ouvèti, {day} | 2026-10-11 | machine-drafted, needs native review |
| `closeTimeAria` | ht | {day} closing time | Lè fèmti, {day} | 2026-10-11 | machine-drafted, needs native review |
| `hoursTo` | ht | to | rive | 2026-10-11 | machine-drafted, needs native review |
| `removeInterval` | ht | Remove interval | Retire entèval la | 2026-10-11 | machine-drafted, needs native review |
| `addInterval` | ht | Add interval | Ajoute yon entèval | 2026-10-11 | machine-drafted, needs native review |
| `sectionPhotos` | ht | Photos | Foto | 2026-10-11 | machine-drafted, needs native review |
| `photoLogo` | ht | Logo | Logo | 2026-10-11 | machine-drafted, needs native review |
| `photoCover` | ht | Cover | Kouvèti | 2026-10-11 | machine-drafted, needs native review |
| `photoGallery` | ht | Gallery | Galri | 2026-10-11 | machine-drafted, needs native review |
| `removeGalleryPhoto` | ht | Remove gallery photo | Retire foto galri a | 2026-10-11 | machine-drafted, needs native review |
| `photoAdd` | ht | Add | Ajoute | 2026-10-11 | machine-drafted, needs native review |
| `addLogo` | ht | Add logo | Ajoute logo | 2026-10-11 | machine-drafted, needs native review |
| `addCover` | ht | Add cover | Ajoute kouvèti | 2026-10-11 | machine-drafted, needs native review |
| `removeLogo` | ht | Remove logo | Retire logo a | 2026-10-11 | machine-drafted, needs native review |
| `removeCover` | ht | Remove cover | Retire kouvèti a | 2026-10-11 | machine-drafted, needs native review |
| `sectionServices` | ht | Services | Sèvis | 2026-10-11 | machine-drafted, needs native review |
| `serviceNameAria` | ht | Service {n} name | Non sèvis {n} | 2026-10-11 | machine-drafted, needs native review |
| `phServiceName` | ht | Service name | Non sèvis la | 2026-10-11 | machine-drafted, needs native review |
| `removeService` | ht | Remove service | Retire sèvis la | 2026-10-11 | machine-drafted, needs native review |
| `serviceDescriptionAria` | ht | Service {n} description | Deskripsyon sèvis {n} | 2026-10-11 | machine-drafted, needs native review |
| `phServiceDescription` | ht | Short description (optional) | Ti deskripsyon (si ou vle) | 2026-10-11 | machine-drafted, needs native review |
| `addService` | ht | Add service | Ajoute yon sèvis | 2026-10-11 | machine-drafted, needs native review |
| `sectionAttributes` | ht | Attributes | Karakteristik | 2026-10-11 | machine-drafted, needs native review |
| `attrWheelchairAccessible` | ht | Wheelchair accessible | Aksesib pou chèz woulant | 2026-10-11 | machine-drafted, needs native review |
| `attrWifi` | ht | Free Wi-Fi | Wi-Fi gratis | 2026-10-11 | machine-drafted, needs native review |
| `attrParking` | ht | Parking available | Gen pakin | 2026-10-11 | machine-drafted, needs native review |
| `attrAcceptsEbt` | ht | Accepts EBT | Aksepte EBT | 2026-10-11 | machine-drafted, needs native review |
| `attrMultilingual` | ht | Multilingual staff | Anplwaye ki pale plizyè lang | 2026-10-11 | machine-drafted, needs native review |
| `attrWomanOwned` | ht | Woman-owned | Pwopriyetè a se yon fanm | 2026-10-11 | machine-drafted, needs native review |
| `attrVeteranOwned` | ht | Veteran-owned | Pwopriyetè a se yon veteran | 2026-10-11 | machine-drafted, needs native review |
| `attrLgbtqFriendly` | ht | LGBTQ+ friendly | Akeyan pou moun LGBTQ+ | 2026-10-11 | machine-drafted, needs native review |
| `attrBlackOwned` | ht | Black-owned | Pwopriyetè a se yon moun nwa | 2026-10-11 | machine-drafted, needs native review |
| `sectionSocial` | ht | Social links | Rezo sosyal | 2026-10-11 | machine-drafted, needs native review |
| `submitting` | ht | Submitting… | N ap soumèt… | 2026-10-11 | machine-drafted, needs native review |
| `submitForReview` | ht | Submit for review | Soumèt pou revizyon | 2026-10-11 | machine-drafted, needs native review |
| `cancel` | ht | Cancel | Anile | 2026-10-11 | machine-drafted, needs native review |
| `empty` | ht | No local businesses yet. | Poko gen biznis lokal. | 2026-10-11 | machine-drafted, needs native review |
| `emptyAddFirst` | ht | Be the first to add one. | Se ou ki ka premye ajoute youn. | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | ht | Failed to load businesses | Nou pa t kapab chaje biznis yo | 2026-10-11 | machine-drafted, needs native review |
| `uploadFailed` | ht | Upload failed. Please try again. | Foto a pa t rive monte. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `title` | so | Local Businesses | Ganacsiyada deegaanka | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | so | Community-submitted local businesses near you | Ganacsiyo deegaanka ah oo kuu dhow oo ay bulshadu soo gudbisay | 2026-10-11 | machine-drafted, needs native review |
| `addBusiness` | so | Add a local business | Ku dar ganacsi deegaanka ah | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | so | Create a free account to add a local business to the map | Samee akoon bilaash ah si aad khariidadda ugu darto ganacsi deegaanka ah | 2026-10-11 | machine-drafted, needs native review |
| `formLabel` | so | Submit a local business | Soo gudbi ganacsi deegaanka ah | 2026-10-11 | machine-drafted, needs native review |
| `submitError` | so | Could not submit: {message}. Please try again. | Lama gudbin karin: {message}. Fadlan isku day mar kale. | 2026-10-11 | machine-drafted, needs native review |
| `submitFailed` | so | Could not submit. Please try again. | Lama gudbin karin. Fadlan isku day mar kale. | 2026-10-11 | machine-drafted, needs native review |
| `submittedTitle` | so | Submitted for review | Waxaa loo gudbiyay dib-u-eegis | 2026-10-11 | machine-drafted, needs native review |
| `submittedBody` | so | Your business is pending review. A resource admin will approve it before it appears on the map. | Ganacsigaagu wuxuu sugayaa dib-u-eegis. Maamule agabka ayaa ansixin doona ka hor inta uusan khariidadda ka soo muuqan. | 2026-10-11 | machine-drafted, needs native review |
| `done` | so | Done | Dhammaad | 2026-10-11 | machine-drafted, needs native review |
| `fieldName` | so | Business name | Magaca ganacsiga | 2026-10-11 | machine-drafted, needs native review |
| `phName` | so | Corner Cafe | Maqaaxida Geeska | 2026-10-11 | machine-drafted, needs native review |
| `fieldDescription` | so | Description | Sharaxaad | 2026-10-11 | machine-drafted, needs native review |
| `phDescription` | so | What does this business offer the community? | Maxuu ganacsigani bulshada u hayaa? | 2026-10-11 | machine-drafted, needs native review |
| `fieldAddress` | so | Street address | Cinwaanka waddada | 2026-10-11 | machine-drafted, needs native review |
| `fieldCity` | so | City | Magaalo | 2026-10-11 | machine-drafted, needs native review |
| `fieldState` | so | State | Gobol | 2026-10-11 | machine-drafted, needs native review |
| `fieldPhone` | so | Phone | Telefoon | 2026-10-11 | machine-drafted, needs native review |
| `fieldWebsite` | so | Website | Bogga internetka | 2026-10-11 | machine-drafted, needs native review |
| `sectionDetails` | so | Details | Faahfaahin | 2026-10-11 | machine-drafted, needs native review |
| `fieldCategory` | so | Category | Qaybta | 2026-10-11 | machine-drafted, needs native review |
| `selectPlaceholder` | so | Select… | Dooro… | 2026-10-11 | machine-drafted, needs native review |
| `fieldEmail` | so | Email | Iimayl | 2026-10-11 | machine-drafted, needs native review |
| `fieldCostModel` | so | Cost model | Nooca kharashka | 2026-10-11 | machine-drafted, needs native review |
| `costFree` | so | Free | Bilaash | 2026-10-11 | machine-drafted, needs native review |
| `costSlidingScale` | so | Sliding scale | Qiimo ku xiran awoodda | 2026-10-11 | machine-drafted, needs native review |
| `costPaid` | so | Paid | Lacag leh | 2026-10-11 | machine-drafted, needs native review |
| `fieldZip` | so | ZIP code | Koodhka boostada | 2026-10-11 | machine-drafted, needs native review |
| `fieldRadius` | so | Service radius (miles) | Baaxadda adeegga (mayl) | 2026-10-11 | machine-drafted, needs native review |
| `catFood` | so | Food | Cunto | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | so | Housing | Guriyeyn | 2026-10-11 | machine-drafted, needs native review |
| `catHealth` | so | Health | Caafimaad | 2026-10-11 | machine-drafted, needs native review |
| `catLegal` | so | Legal | Sharci | 2026-10-11 | machine-drafted, needs native review |
| `catEmployment` | so | Employment | Shaqo | 2026-10-11 | machine-drafted, needs native review |
| `catChildcare` | so | Childcare | Daryeelka carruurta | 2026-10-11 | machine-drafted, needs native review |
| `catTransportation` | so | Transportation | Gaadiid | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | so | Education | Waxbarasho | 2026-10-11 | machine-drafted, needs native review |
| `catFinancial` | so | Financial | Maaliyad | 2026-10-11 | machine-drafted, needs native review |
| `catRetail` | so | Retail | Tafaariiq | 2026-10-11 | machine-drafted, needs native review |
| `catOther` | so | Other | Kale | 2026-10-11 | machine-drafted, needs native review |
| `sectionHours` | so | Hours | Saacadaha | 2026-10-11 | machine-drafted, needs native review |
| `copyMonday` | so | Copy Monday to weekdays | U koobiyee Isniinta maalmaha shaqada | 2026-10-11 | machine-drafted, needs native review |
| `hoursOpen` | so | Open | Furan | 2026-10-11 | machine-drafted, needs native review |
| `hoursClosed` | so | Closed | Xiran | 2026-10-11 | machine-drafted, needs native review |
| `openTimeAria` | so | {day} opening time | Waqtiga furitaanka, {day} | 2026-10-11 | machine-drafted, needs native review |
| `closeTimeAria` | so | {day} closing time | Waqtiga xiritaanka, {day} | 2026-10-11 | machine-drafted, needs native review |
| `hoursTo` | so | to | ilaa | 2026-10-11 | machine-drafted, needs native review |
| `removeInterval` | so | Remove interval | Ka saar muddada | 2026-10-11 | machine-drafted, needs native review |
| `addInterval` | so | Add interval | Ku dar muddo | 2026-10-11 | machine-drafted, needs native review |
| `sectionPhotos` | so | Photos | Sawirro | 2026-10-11 | machine-drafted, needs native review |
| `photoLogo` | so | Logo | Astaan | 2026-10-11 | machine-drafted, needs native review |
| `photoCover` | so | Cover | Sawirka daboolka | 2026-10-11 | machine-drafted, needs native review |
| `photoGallery` | so | Gallery | Sawir-qaadaha | 2026-10-11 | machine-drafted, needs native review |
| `removeGalleryPhoto` | so | Remove gallery photo | Ka saar sawirka sawir-qaadaha | 2026-10-11 | machine-drafted, needs native review |
| `photoAdd` | so | Add | Ku dar | 2026-10-11 | machine-drafted, needs native review |
| `addLogo` | so | Add logo | Ku dar astaan | 2026-10-11 | machine-drafted, needs native review |
| `addCover` | so | Add cover | Ku dar sawirka daboolka | 2026-10-11 | machine-drafted, needs native review |
| `removeLogo` | so | Remove logo | Ka saar astaanta | 2026-10-11 | machine-drafted, needs native review |
| `removeCover` | so | Remove cover | Ka saar sawirka daboolka | 2026-10-11 | machine-drafted, needs native review |
| `sectionServices` | so | Services | Adeegyo | 2026-10-11 | machine-drafted, needs native review |
| `serviceNameAria` | so | Service {n} name | Magaca adeegga {n} | 2026-10-11 | machine-drafted, needs native review |
| `phServiceName` | so | Service name | Magaca adeegga | 2026-10-11 | machine-drafted, needs native review |
| `removeService` | so | Remove service | Ka saar adeegga | 2026-10-11 | machine-drafted, needs native review |
| `serviceDescriptionAria` | so | Service {n} description | Sharaxaadda adeegga {n} | 2026-10-11 | machine-drafted, needs native review |
| `phServiceDescription` | so | Short description (optional) | Sharaxaad gaaban (ikhtiyaari) | 2026-10-11 | machine-drafted, needs native review |
| `addService` | so | Add service | Ku dar adeeg | 2026-10-11 | machine-drafted, needs native review |
| `sectionAttributes` | so | Attributes | Astaamaha | 2026-10-11 | machine-drafted, needs native review |
| `attrWheelchairAccessible` | so | Wheelchair accessible | Kursiga curyaanka waa lagu geli karaa | 2026-10-11 | machine-drafted, needs native review |
| `attrWifi` | so | Free Wi-Fi | Wi-Fi bilaash ah | 2026-10-11 | machine-drafted, needs native review |
| `attrParking` | so | Parking available | Baarkin waa la heli karaa | 2026-10-11 | machine-drafted, needs native review |
| `attrAcceptsEbt` | so | Accepts EBT | Wuxuu aqbalaa EBT | 2026-10-11 | machine-drafted, needs native review |
| `attrMultilingual` | so | Multilingual staff | Shaqaale ku hadla luqado badan | 2026-10-11 | machine-drafted, needs native review |
| `attrWomanOwned` | so | Woman-owned | Waxaa leh haweeney | 2026-10-11 | machine-drafted, needs native review |
| `attrVeteranOwned` | so | Veteran-owned | Waxaa leh halyeey ciidan | 2026-10-11 | machine-drafted, needs native review |
| `attrLgbtqFriendly` | so | LGBTQ+ friendly | Soo dhaweeya dadka LGBTQ+ | 2026-10-11 | machine-drafted, needs native review |
| `attrBlackOwned` | so | Black-owned | Waxaa leh qof madow | 2026-10-11 | machine-drafted, needs native review |
| `sectionSocial` | so | Social links | Xiriiriyeyaasha baraha bulshada | 2026-10-11 | machine-drafted, needs native review |
| `submitting` | so | Submitting… | Waa la gudbinayaa… | 2026-10-11 | machine-drafted, needs native review |
| `submitForReview` | so | Submit for review | U gudbi dib-u-eegis | 2026-10-11 | machine-drafted, needs native review |
| `cancel` | so | Cancel | Jooji | 2026-10-11 | machine-drafted, needs native review |
| `empty` | so | No local businesses yet. | Weli ma jiraan ganacsiyo deegaanka ah. | 2026-10-11 | machine-drafted, needs native review |
| `emptyAddFirst` | so | Be the first to add one. | Noqo qofka ugu horreeya ee mid ku dara. | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | so | Failed to load businesses | Lama soo shubi karin ganacsiyada | 2026-10-11 | machine-drafted, needs native review |
| `uploadFailed` | so | Upload failed. Please try again. | Sawirka lama soo gelin karin. Fadlan isku day mar kale. | 2026-10-11 | machine-drafted, needs native review |
| `title` | am | Local Businesses | የአካባቢ ንግዶች | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | am | Community-submitted local businesses near you | ማኅበረሰቡ ያስገባቸው በአቅራቢያዎ ያሉ የአካባቢ ንግዶች | 2026-10-11 | machine-drafted, needs native review |
| `addBusiness` | am | Add a local business | የአካባቢ ንግድ አክል | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | am | Create a free account to add a local business to the map | የአካባቢ ንግድን በካርታው ላይ ለማከል ነፃ መለያ ይፍጠሩ | 2026-10-11 | machine-drafted, needs native review |
| `formLabel` | am | Submit a local business | የአካባቢ ንግድ አስገባ | 2026-10-11 | machine-drafted, needs native review |
| `submitError` | am | Could not submit: {message}. Please try again. | ማስገባት አልተቻለም፦ {message}። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `submitFailed` | am | Could not submit. Please try again. | ማስገባት አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `submittedTitle` | am | Submitted for review | ለግምገማ ገብቷል | 2026-10-11 | machine-drafted, needs native review |
| `submittedBody` | am | Your business is pending review. A resource admin will approve it before it appears on the map. | ንግድዎ ግምገማ በመጠባበቅ ላይ ነው። በካርታው ላይ ከመታየቱ በፊት የግብዓት አስተዳዳሪ ያጸድቀዋል። | 2026-10-11 | machine-drafted, needs native review |
| `done` | am | Done | ተከናውኗል | 2026-10-11 | machine-drafted, needs native review |
| `fieldName` | am | Business name | የንግዱ ስም | 2026-10-11 | machine-drafted, needs native review |
| `phName` | am | Corner Cafe | የማዕዘን ካፌ | 2026-10-11 | machine-drafted, needs native review |
| `fieldDescription` | am | Description | መግለጫ | 2026-10-11 | machine-drafted, needs native review |
| `phDescription` | am | What does this business offer the community? | ይህ ንግድ ለማኅበረሰቡ ምን ያቀርባል? | 2026-10-11 | machine-drafted, needs native review |
| `fieldAddress` | am | Street address | የመንገድ አድራሻ | 2026-10-11 | machine-drafted, needs native review |
| `fieldCity` | am | City | ከተማ | 2026-10-11 | machine-drafted, needs native review |
| `fieldState` | am | State | ግዛት | 2026-10-11 | machine-drafted, needs native review |
| `fieldPhone` | am | Phone | ስልክ | 2026-10-11 | machine-drafted, needs native review |
| `fieldWebsite` | am | Website | ድረ-ገጽ | 2026-10-11 | machine-drafted, needs native review |
| `sectionDetails` | am | Details | ዝርዝሮች | 2026-10-11 | machine-drafted, needs native review |
| `fieldCategory` | am | Category | ምድብ | 2026-10-11 | machine-drafted, needs native review |
| `selectPlaceholder` | am | Select… | ይምረጡ… | 2026-10-11 | machine-drafted, needs native review |
| `fieldEmail` | am | Email | ኢሜይል | 2026-10-11 | machine-drafted, needs native review |
| `fieldCostModel` | am | Cost model | የክፍያ ዓይነት | 2026-10-11 | machine-drafted, needs native review |
| `costFree` | am | Free | ነፃ | 2026-10-11 | machine-drafted, needs native review |
| `costSlidingScale` | am | Sliding scale | እንደ አቅም የሚከፈል | 2026-10-11 | machine-drafted, needs native review |
| `costPaid` | am | Paid | በክፍያ | 2026-10-11 | machine-drafted, needs native review |
| `fieldZip` | am | ZIP code | የፖስታ ኮድ | 2026-10-11 | machine-drafted, needs native review |
| `fieldRadius` | am | Service radius (miles) | የአገልግሎት ክልል (ማይል) | 2026-10-11 | machine-drafted, needs native review |
| `catFood` | am | Food | ምግብ | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | am | Housing | መኖሪያ ቤት | 2026-10-11 | machine-drafted, needs native review |
| `catHealth` | am | Health | ጤና | 2026-10-11 | machine-drafted, needs native review |
| `catLegal` | am | Legal | ሕግ | 2026-10-11 | machine-drafted, needs native review |
| `catEmployment` | am | Employment | ሥራ | 2026-10-11 | machine-drafted, needs native review |
| `catChildcare` | am | Childcare | የሕፃናት እንክብካቤ | 2026-10-11 | machine-drafted, needs native review |
| `catTransportation` | am | Transportation | መጓጓዣ | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | am | Education | ትምህርት | 2026-10-11 | machine-drafted, needs native review |
| `catFinancial` | am | Financial | ፋይናንስ | 2026-10-11 | machine-drafted, needs native review |
| `catRetail` | am | Retail | ችርቻሮ | 2026-10-11 | machine-drafted, needs native review |
| `catOther` | am | Other | ሌላ | 2026-10-11 | machine-drafted, needs native review |
| `sectionHours` | am | Hours | የሥራ ሰዓታት | 2026-10-11 | machine-drafted, needs native review |
| `copyMonday` | am | Copy Monday to weekdays | ሰኞን ወደ የሥራ ቀናት ቅዳ | 2026-10-11 | machine-drafted, needs native review |
| `hoursOpen` | am | Open | ክፍት | 2026-10-11 | machine-drafted, needs native review |
| `hoursClosed` | am | Closed | ዝግ | 2026-10-11 | machine-drafted, needs native review |
| `openTimeAria` | am | {day} opening time | የመክፈቻ ሰዓት፣ {day} | 2026-10-11 | machine-drafted, needs native review |
| `closeTimeAria` | am | {day} closing time | የመዝጊያ ሰዓት፣ {day} | 2026-10-11 | machine-drafted, needs native review |
| `hoursTo` | am | to | እስከ | 2026-10-11 | machine-drafted, needs native review |
| `removeInterval` | am | Remove interval | የጊዜ ክፍተቱን አስወግድ | 2026-10-11 | machine-drafted, needs native review |
| `addInterval` | am | Add interval | የጊዜ ክፍተት አክል | 2026-10-11 | machine-drafted, needs native review |
| `sectionPhotos` | am | Photos | ፎቶዎች | 2026-10-11 | machine-drafted, needs native review |
| `photoLogo` | am | Logo | አርማ | 2026-10-11 | machine-drafted, needs native review |
| `photoCover` | am | Cover | የሽፋን ፎቶ | 2026-10-11 | machine-drafted, needs native review |
| `photoGallery` | am | Gallery | የፎቶ ስብስብ | 2026-10-11 | machine-drafted, needs native review |
| `removeGalleryPhoto` | am | Remove gallery photo | የስብስቡን ፎቶ አስወግድ | 2026-10-11 | machine-drafted, needs native review |
| `photoAdd` | am | Add | አክል | 2026-10-11 | machine-drafted, needs native review |
| `addLogo` | am | Add logo | አርማ አክል | 2026-10-11 | machine-drafted, needs native review |
| `addCover` | am | Add cover | የሽፋን ፎቶ አክል | 2026-10-11 | machine-drafted, needs native review |
| `removeLogo` | am | Remove logo | አርማውን አስወግድ | 2026-10-11 | machine-drafted, needs native review |
| `removeCover` | am | Remove cover | የሽፋን ፎቶውን አስወግድ | 2026-10-11 | machine-drafted, needs native review |
| `sectionServices` | am | Services | አገልግሎቶች | 2026-10-11 | machine-drafted, needs native review |
| `serviceNameAria` | am | Service {n} name | የአገልግሎት {n} ስም | 2026-10-11 | machine-drafted, needs native review |
| `phServiceName` | am | Service name | የአገልግሎት ስም | 2026-10-11 | machine-drafted, needs native review |
| `removeService` | am | Remove service | አገልግሎቱን አስወግድ | 2026-10-11 | machine-drafted, needs native review |
| `serviceDescriptionAria` | am | Service {n} description | የአገልግሎት {n} መግለጫ | 2026-10-11 | machine-drafted, needs native review |
| `phServiceDescription` | am | Short description (optional) | አጭር መግለጫ (አማራጭ) | 2026-10-11 | machine-drafted, needs native review |
| `addService` | am | Add service | አገልግሎት አክል | 2026-10-11 | machine-drafted, needs native review |
| `sectionAttributes` | am | Attributes | መለያ ባህሪያት | 2026-10-11 | machine-drafted, needs native review |
| `attrWheelchairAccessible` | am | Wheelchair accessible | ለዊልቸር ተደራሽ | 2026-10-11 | machine-drafted, needs native review |
| `attrWifi` | am | Free Wi-Fi | ነፃ Wi-Fi | 2026-10-11 | machine-drafted, needs native review |
| `attrParking` | am | Parking available | የመኪና ማቆሚያ አለ | 2026-10-11 | machine-drafted, needs native review |
| `attrAcceptsEbt` | am | Accepts EBT | EBT ይቀበላል | 2026-10-11 | machine-drafted, needs native review |
| `attrMultilingual` | am | Multilingual staff | ብዙ ቋንቋ የሚናገሩ ሠራተኞች | 2026-10-11 | machine-drafted, needs native review |
| `attrWomanOwned` | am | Woman-owned | የሴት ባለቤትነት | 2026-10-11 | machine-drafted, needs native review |
| `attrVeteranOwned` | am | Veteran-owned | የአርበኛ ባለቤትነት | 2026-10-11 | machine-drafted, needs native review |
| `attrLgbtqFriendly` | am | LGBTQ+ friendly | ለLGBTQ+ ምቹ | 2026-10-11 | machine-drafted, needs native review |
| `attrBlackOwned` | am | Black-owned | የጥቁር ባለቤትነት | 2026-10-11 | machine-drafted, needs native review |
| `sectionSocial` | am | Social links | የማኅበራዊ ሚዲያ አገናኞች | 2026-10-11 | machine-drafted, needs native review |
| `submitting` | am | Submitting… | በማስገባት ላይ… | 2026-10-11 | machine-drafted, needs native review |
| `submitForReview` | am | Submit for review | ለግምገማ አስገባ | 2026-10-11 | machine-drafted, needs native review |
| `cancel` | am | Cancel | ሰርዝ | 2026-10-11 | machine-drafted, needs native review |
| `empty` | am | No local businesses yet. | እስካሁን ምንም የአካባቢ ንግድ የለም። | 2026-10-11 | machine-drafted, needs native review |
| `emptyAddFirst` | am | Be the first to add one. | የመጀመሪያውን ለማከል ቀዳሚ ይሁኑ። | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | am | Failed to load businesses | ንግዶችን መጫን አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `uploadFailed` | am | Upload failed. Please try again. | መስቀል አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `title` | hmn | Local Businesses | Cov lag luam hauv zos | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | hmn | Community-submitted local businesses near you | Cov lag luam hauv zos nyob ze koj uas zej zog tau xa tuaj | 2026-10-11 | machine-drafted, needs native review |
| `addBusiness` | hmn | Add a local business | Ntxiv ib lub lag luam hauv zos | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | hmn | Create a free account to add a local business to the map | Tsim ib tus account dawb los ntxiv ib lub lag luam hauv zos rau daim ntawv qhia chaw | 2026-10-11 | machine-drafted, needs native review |
| `formLabel` | hmn | Submit a local business | Xa ib lub lag luam hauv zos | 2026-10-11 | machine-drafted, needs native review |
| `submitError` | hmn | Could not submit: {message}. Please try again. | Xa tsis tau: {message}. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `submitFailed` | hmn | Could not submit. Please try again. | Xa tsis tau. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `submittedTitle` | hmn | Submitted for review | Xa mus tshuaj xyuas lawm | 2026-10-11 | machine-drafted, needs native review |
| `submittedBody` | hmn | Your business is pending review. A resource admin will approve it before it appears on the map. | Koj lub lag luam tab tom tos kev tshuaj xyuas. Ib tug thawj tswj kev pab yuav pom zoo ua ntej nws tshwm rau ntawm daim ntawv qhia chaw. | 2026-10-11 | machine-drafted, needs native review |
| `done` | hmn | Done | Tiav lawm | 2026-10-11 | machine-drafted, needs native review |
| `fieldName` | hmn | Business name | Lub lag luam lub npe | 2026-10-11 | machine-drafted, needs native review |
| `phName` | hmn | Corner Cafe | Tsev Kas Fes Ntawm Ces Kaum | 2026-10-11 | machine-drafted, needs native review |
| `fieldDescription` | hmn | Description | Lus piav qhia | 2026-10-11 | machine-drafted, needs native review |
| `phDescription` | hmn | What does this business offer the community? | Lub lag luam no muab dab tsi rau zej zog? | 2026-10-11 | machine-drafted, needs native review |
| `fieldAddress` | hmn | Street address | Chaw nyob ntawm txoj kev | 2026-10-11 | machine-drafted, needs native review |
| `fieldCity` | hmn | City | Nroog | 2026-10-11 | machine-drafted, needs native review |
| `fieldState` | hmn | State | Xeev | 2026-10-11 | machine-drafted, needs native review |
| `fieldPhone` | hmn | Phone | Xov tooj | 2026-10-11 | machine-drafted, needs native review |
| `fieldWebsite` | hmn | Website | Lub vev xaib | 2026-10-11 | machine-drafted, needs native review |
| `sectionDetails` | hmn | Details | Cov ntsiab lus | 2026-10-11 | machine-drafted, needs native review |
| `fieldCategory` | hmn | Category | Pawg | 2026-10-11 | machine-drafted, needs native review |
| `selectPlaceholder` | hmn | Select… | Xaiv… | 2026-10-11 | machine-drafted, needs native review |
| `fieldEmail` | hmn | Email | Email | 2026-10-11 | machine-drafted, needs native review |
| `fieldCostModel` | hmn | Cost model | Hom nqi | 2026-10-11 | machine-drafted, needs native review |
| `costFree` | hmn | Free | Dawb | 2026-10-11 | machine-drafted, needs native review |
| `costSlidingScale` | hmn | Sliding scale | Nqi raws li them taus | 2026-10-11 | machine-drafted, needs native review |
| `costPaid` | hmn | Paid | Them nqi | 2026-10-11 | machine-drafted, needs native review |
| `fieldZip` | hmn | ZIP code | Tus lej ZIP | 2026-10-11 | machine-drafted, needs native review |
| `fieldRadius` | hmn | Service radius (miles) | Thaj tsam pab (mais) | 2026-10-11 | machine-drafted, needs native review |
| `catFood` | hmn | Food | Zaub mov | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | hmn | Housing | Vaj tse | 2026-10-11 | machine-drafted, needs native review |
| `catHealth` | hmn | Health | Kev noj qab haus huv | 2026-10-11 | machine-drafted, needs native review |
| `catLegal` | hmn | Legal | Kev cai lij choj | 2026-10-11 | machine-drafted, needs native review |
| `catEmployment` | hmn | Employment | Hauj lwm | 2026-10-11 | machine-drafted, needs native review |
| `catChildcare` | hmn | Childcare | Kev zov me nyuam | 2026-10-11 | machine-drafted, needs native review |
| `catTransportation` | hmn | Transportation | Kev thauj mus los | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | hmn | Education | Kev kawm | 2026-10-11 | machine-drafted, needs native review |
| `catFinancial` | hmn | Financial | Nyiaj txiag | 2026-10-11 | machine-drafted, needs native review |
| `catRetail` | hmn | Retail | Khw muag khoom | 2026-10-11 | machine-drafted, needs native review |
| `catOther` | hmn | Other | Lwm yam | 2026-10-11 | machine-drafted, needs native review |
| `sectionHours` | hmn | Hours | Sij hawm qhib | 2026-10-11 | machine-drafted, needs native review |
| `copyMonday` | hmn | Copy Monday to weekdays | Luam Hnub Ib rau cov hnub ua hauj lwm | 2026-10-11 | machine-drafted, needs native review |
| `hoursOpen` | hmn | Open | Qhib | 2026-10-11 | machine-drafted, needs native review |
| `hoursClosed` | hmn | Closed | Kaw | 2026-10-11 | machine-drafted, needs native review |
| `openTimeAria` | hmn | {day} opening time | Sij hawm qhib, {day} | 2026-10-11 | machine-drafted, needs native review |
| `closeTimeAria` | hmn | {day} closing time | Sij hawm kaw, {day} | 2026-10-11 | machine-drafted, needs native review |
| `hoursTo` | hmn | to | txog | 2026-10-11 | machine-drafted, needs native review |
| `removeInterval` | hmn | Remove interval | Tshem lub sij hawm no | 2026-10-11 | machine-drafted, needs native review |
| `addInterval` | hmn | Add interval | Ntxiv lub sij hawm | 2026-10-11 | machine-drafted, needs native review |
| `sectionPhotos` | hmn | Photos | Cov duab | 2026-10-11 | machine-drafted, needs native review |
| `photoLogo` | hmn | Logo | Lub cim | 2026-10-11 | machine-drafted, needs native review |
| `photoCover` | hmn | Cover | Daim duab npog | 2026-10-11 | machine-drafted, needs native review |
| `photoGallery` | hmn | Gallery | Chav duab | 2026-10-11 | machine-drafted, needs native review |
| `removeGalleryPhoto` | hmn | Remove gallery photo | Tshem daim duab hauv chav duab | 2026-10-11 | machine-drafted, needs native review |
| `photoAdd` | hmn | Add | Ntxiv | 2026-10-11 | machine-drafted, needs native review |
| `addLogo` | hmn | Add logo | Ntxiv lub cim | 2026-10-11 | machine-drafted, needs native review |
| `addCover` | hmn | Add cover | Ntxiv daim duab npog | 2026-10-11 | machine-drafted, needs native review |
| `removeLogo` | hmn | Remove logo | Tshem lub cim | 2026-10-11 | machine-drafted, needs native review |
| `removeCover` | hmn | Remove cover | Tshem daim duab npog | 2026-10-11 | machine-drafted, needs native review |
| `sectionServices` | hmn | Services | Cov kev pab | 2026-10-11 | machine-drafted, needs native review |
| `serviceNameAria` | hmn | Service {n} name | Kev pab {n} lub npe | 2026-10-11 | machine-drafted, needs native review |
| `phServiceName` | hmn | Service name | Kev pab lub npe | 2026-10-11 | machine-drafted, needs native review |
| `removeService` | hmn | Remove service | Tshem kev pab | 2026-10-11 | machine-drafted, needs native review |
| `serviceDescriptionAria` | hmn | Service {n} description | Lus piav qhia txog kev pab {n} | 2026-10-11 | machine-drafted, needs native review |
| `phServiceDescription` | hmn | Short description (optional) | Lus piav qhia luv (tsis yuam) | 2026-10-11 | machine-drafted, needs native review |
| `addService` | hmn | Add service | Ntxiv kev pab | 2026-10-11 | machine-drafted, needs native review |
| `sectionAttributes` | hmn | Attributes | Cov yam ntxwv | 2026-10-11 | machine-drafted, needs native review |
| `attrWheelchairAccessible` | hmn | Wheelchair accessible | Lub rooj zaum muaj log nkag tau | 2026-10-11 | machine-drafted, needs native review |
| `attrWifi` | hmn | Free Wi-Fi | Wi-Fi dawb | 2026-10-11 | machine-drafted, needs native review |
| `attrParking` | hmn | Parking available | Muaj chaw nres tsheb | 2026-10-11 | machine-drafted, needs native review |
| `attrAcceptsEbt` | hmn | Accepts EBT | Txais EBT | 2026-10-11 | machine-drafted, needs native review |
| `attrMultilingual` | hmn | Multilingual staff | Cov neeg ua hauj lwm hais tau ntau hom lus | 2026-10-11 | machine-drafted, needs native review |
| `attrWomanOwned` | hmn | Woman-owned | Poj niam yog tus tswv | 2026-10-11 | machine-drafted, needs native review |
| `attrVeteranOwned` | hmn | Veteran-owned | Qub tub rog yog tus tswv | 2026-10-11 | machine-drafted, needs native review |
| `attrLgbtqFriendly` | hmn | LGBTQ+ friendly | Txais tos cov neeg LGBTQ+ | 2026-10-11 | machine-drafted, needs native review |
| `attrBlackOwned` | hmn | Black-owned | Neeg tawv dub yog tus tswv | 2026-10-11 | machine-drafted, needs native review |
| `sectionSocial` | hmn | Social links | Cov txuas rau social media | 2026-10-11 | machine-drafted, needs native review |
| `submitting` | hmn | Submitting… | Tab tom xa… | 2026-10-11 | machine-drafted, needs native review |
| `submitForReview` | hmn | Submit for review | Xa mus tshuaj xyuas | 2026-10-11 | machine-drafted, needs native review |
| `cancel` | hmn | Cancel | Thim | 2026-10-11 | machine-drafted, needs native review |
| `empty` | hmn | No local businesses yet. | Tseem tsis tau muaj lag luam hauv zos. | 2026-10-11 | machine-drafted, needs native review |
| `emptyAddFirst` | hmn | Be the first to add one. | Koj ua thawj tus ntxiv ib lub. | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | hmn | Failed to load businesses | Thauj tsis tau cov lag luam | 2026-10-11 | machine-drafted, needs native review |
| `uploadFailed` | hmn | Upload failed. Please try again. | Xa daim duab tsis tau. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |

### `lib/i18n-feed-messages.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `guestPrompt` | ht | Create a free account to message volunteers and connect with your community | Kreye yon kont gratis pou w voye mesaj bay volontè yo epi konekte ak kominote w la | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | ht | No messages yet | Poko gen mesaj | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | ht | Volunteer resources on the map have a Message button. Send a request to start a conversation. | Resous volontè yo sou kat la gen yon bouton Mesaj. Voye yon demann pou kòmanse yon konvèsasyon. | 2026-10-11 | machine-drafted, needs native review |
| `title` | ht | Messages | Mesaj | 2026-10-11 | machine-drafted, needs native review |
| `sectionPending` | ht | Pending Requests ({n}) | Demann k ap tann ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionActive` | ht | Active ({n}) | Aktif ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionCompleted` | ht | Completed ({n}) | Fini ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionHistory` | ht | History ({n}) | Istwa ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `backToList` | ht | Back to conversations | Tounen nan konvèsasyon yo | 2026-10-11 | machine-drafted, needs native review |
| `unknownUser` | ht | User | Itilizatè | 2026-10-11 | machine-drafted, needs native review |
| `statusPending` | ht | pending | ap tann | 2026-10-11 | machine-drafted, needs native review |
| `statusActive` | ht | active | aktif | 2026-10-11 | machine-drafted, needs native review |
| `statusCompleted` | ht | completed | fini | 2026-10-11 | machine-drafted, needs native review |
| `statusDeclined` | ht | declined | refize | 2026-10-11 | machine-drafted, needs native review |
| `statusCancelled` | ht | cancelled | anile | 2026-10-11 | machine-drafted, needs native review |
| `accept` | ht | Accept | Aksepte | 2026-10-11 | machine-drafted, needs native review |
| `decline` | ht | Decline | Refize | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | ht | Withdraw | Retire | 2026-10-11 | machine-drafted, needs native review |
| `endAndReview` | ht | End & review | Fini epi evalye | 2026-10-11 | machine-drafted, needs native review |
| `waitingForAccept` | ht | Waiting for {name} to accept your request... | N ap tann {name} aksepte demann ou an... | 2026-10-11 | machine-drafted, needs native review |
| `inputPlaceholder` | ht | Type a message... | Ekri yon mesaj... | 2026-10-11 | machine-drafted, needs native review |
| `send` | ht | Send message | Voye mesaj | 2026-10-11 | machine-drafted, needs native review |
| `reviewSubmitted` | ht | Your review was submitted | Evalyasyon ou an voye | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptTitle` | ht | How did it go? | Kijan sa te pase? | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptBody` | ht | Leave a review for {name} | Kite yon evalyasyon pou {name} | 2026-10-11 | machine-drafted, needs native review |
| `rateExperience` | ht | Rate your experience | Evalye eksperyans ou | 2026-10-11 | machine-drafted, needs native review |
| `selectConversation` | ht | Select a conversation to view messages | Chwazi yon konvèsasyon pou w wè mesaj yo | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineTitle` | ht | Decline this request? | Refize demann sa a? | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawTitle` | ht | Withdraw your request? | Retire demann ou an? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelTitle` | ht | End this conversation? | Fini konvèsasyon sa a? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteTitle` | ht | End conversation? | Fini konvèsasyon an? | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineBody` | ht | The requester will be notified that their request was declined. | Moun ki fè demann lan ap resevwa yon avi ke demann li an refize. | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawBody` | ht | Your request will be cancelled and cannot be recovered. | Demann ou an ap anile epi ou pa p ka jwenn li ankò. | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelBody` | ht | This conversation will be closed and cannot be reopened. | Konvèsasyon sa a ap fèmen epi li pa p ka relouvri. | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteBody` | ht | Both of you will be able to leave a review once the conversation is marked complete. | Nou toulède ap ka kite yon evalyasyon lè konvèsasyon an make kòm fini. | 2026-10-11 | machine-drafted, needs native review |
| `keepChatting` | ht | Keep chatting | Kontinye pale | 2026-10-11 | machine-drafted, needs native review |
| `confirmDecline` | ht | Decline Request | Refize demann lan | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdraw` | ht | Withdraw Request | Retire demann lan | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancel` | ht | End Conversation | Fini konvèsasyon an | 2026-10-11 | machine-drafted, needs native review |
| `errTimeout` | ht | Messages timed out — please check your connection and retry. | Mesaj yo pran twòp tan. Tanpri tcheke koneksyon ou epi eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errLoadConversations` | ht | Failed to fetch conversations | Nou pa t kapab chaje konvèsasyon yo | 2026-10-11 | machine-drafted, needs native review |
| `errLoadMessages` | ht | Failed to fetch messages | Nou pa t kapab chaje mesaj yo | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToRequest` | ht | Please sign in to send a request | Tanpri konekte pou w voye yon demann | 2026-10-11 | machine-drafted, needs native review |
| `errPendingExists` | ht | This volunteer already has a pending request. Please try again later. | Volontè sa a gen yon demann k ap tann deja. Tanpri eseye pita. | 2026-10-11 | machine-drafted, needs native review |
| `errNotAccepting` | ht | This member isn't accepting new messages right now. | Manm sa a pa aksepte nouvo mesaj kounye a. | 2026-10-11 | machine-drafted, needs native review |
| `errSendRequest` | ht | Failed to send request | Nou pa t kapab voye demann lan | 2026-10-11 | machine-drafted, needs native review |
| `errAccept` | ht | Failed to accept request | Nou pa t kapab aksepte demann lan | 2026-10-11 | machine-drafted, needs native review |
| `errDecline` | ht | Failed to decline request | Nou pa t kapab refize demann lan | 2026-10-11 | machine-drafted, needs native review |
| `errCancel` | ht | Failed to cancel conversation | Nou pa t kapab anile konvèsasyon an | 2026-10-11 | machine-drafted, needs native review |
| `errComplete` | ht | Failed to complete conversation | Nou pa t kapab fini konvèsasyon an | 2026-10-11 | machine-drafted, needs native review |
| `errWithdraw` | ht | Failed to withdraw request | Nou pa t kapab retire demann lan | 2026-10-11 | machine-drafted, needs native review |
| `errNoConversation` | ht | No conversation selected | Pa gen konvèsasyon ki chwazi | 2026-10-11 | machine-drafted, needs native review |
| `errSendMessage` | ht | Failed to send message | Nou pa t kapab voye mesaj la | 2026-10-11 | machine-drafted, needs native review |
| `errMarkRead` | ht | Failed to mark messages as read | Nou pa t kapab make mesaj yo kòm li | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | so | Create a free account to message volunteers and connect with your community | Samee akoon bilaash ah si aad fariin ugu dirto tabaruceyaasha oo aad ula xiriirto bulshadaada | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | so | No messages yet | Weli fariimo ma jiraan | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | so | Volunteer resources on the map have a Message button. Send a request to start a conversation. | Agabka tabaruceyaasha ee khariidadda ku yaal waxay leeyihiin badhan Fariin ah. Dir codsi si aad wada hadal u bilowdo. | 2026-10-11 | machine-drafted, needs native review |
| `title` | so | Messages | Fariimo | 2026-10-11 | machine-drafted, needs native review |
| `sectionPending` | so | Pending Requests ({n}) | Codsiyo sugaya ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionActive` | so | Active ({n}) | Firfircoon ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionCompleted` | so | Completed ({n}) | La dhammeeyay ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionHistory` | so | History ({n}) | Taariikh ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `backToList` | so | Back to conversations | Ku noqo wada hadallada | 2026-10-11 | machine-drafted, needs native review |
| `unknownUser` | so | User | Isticmaale | 2026-10-11 | machine-drafted, needs native review |
| `statusPending` | so | pending | sugaya | 2026-10-11 | machine-drafted, needs native review |
| `statusActive` | so | active | firfircoon | 2026-10-11 | machine-drafted, needs native review |
| `statusCompleted` | so | completed | la dhammeeyay | 2026-10-11 | machine-drafted, needs native review |
| `statusDeclined` | so | declined | la diiday | 2026-10-11 | machine-drafted, needs native review |
| `statusCancelled` | so | cancelled | la joojiyay | 2026-10-11 | machine-drafted, needs native review |
| `accept` | so | Accept | Aqbal | 2026-10-11 | machine-drafted, needs native review |
| `decline` | so | Decline | Diid | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | so | Withdraw | Ka noqo | 2026-10-11 | machine-drafted, needs native review |
| `endAndReview` | so | End & review | Dhammee oo qiimee | 2026-10-11 | machine-drafted, needs native review |
| `waitingForAccept` | so | Waiting for {name} to accept your request... | Waxaa la sugayaa in {name} aqbalo codsigaaga... | 2026-10-11 | machine-drafted, needs native review |
| `inputPlaceholder` | so | Type a message... | Qor fariin... | 2026-10-11 | machine-drafted, needs native review |
| `send` | so | Send message | Dir fariinta | 2026-10-11 | machine-drafted, needs native review |
| `reviewSubmitted` | so | Your review was submitted | Qiimayntaada waa la diray | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptTitle` | so | How did it go? | Sidee bay u dhacday? | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptBody` | so | Leave a review for {name} | U reeb qiimayn {name} | 2026-10-11 | machine-drafted, needs native review |
| `rateExperience` | so | Rate your experience | Qiimee waayo-aragnimadaada | 2026-10-11 | machine-drafted, needs native review |
| `selectConversation` | so | Select a conversation to view messages | Dooro wada hadal si aad u aragto fariimaha | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineTitle` | so | Decline this request? | Ma diidaysaa codsigan? | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawTitle` | so | Withdraw your request? | Ma ka noqonaysaa codsigaaga? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelTitle` | so | End this conversation? | Ma dhammaynaysaa wada hadalkan? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteTitle` | so | End conversation? | Ma dhammaynaysaa wada hadalka? | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineBody` | so | The requester will be notified that their request was declined. | Qofka codsaday waxaa lagu wargelin doonaa in codsigiisa la diiday. | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawBody` | so | Your request will be cancelled and cannot be recovered. | Codsigaaga waa la joojin doonaa lamana soo celin karo. | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelBody` | so | This conversation will be closed and cannot be reopened. | Wada hadalkan waa la xiri doonaa dibna looma furi karo. | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteBody` | so | Both of you will be able to leave a review once the conversation is marked complete. | Labadiinuba waxaad reebi kartaan qiimayn marka wada hadalka lagu calaamadiyo inuu dhammaaday. | 2026-10-11 | machine-drafted, needs native review |
| `keepChatting` | so | Keep chatting | Sii wad wada hadalka | 2026-10-11 | machine-drafted, needs native review |
| `confirmDecline` | so | Decline Request | Diid codsiga | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdraw` | so | Withdraw Request | Ka noqo codsiga | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancel` | so | End Conversation | Dhammee wada hadalka | 2026-10-11 | machine-drafted, needs native review |
| `errTimeout` | so | Messages timed out — please check your connection and retry. | Fariimuhu waqti badan bay qaateen. Fadlan hubi xiriirkaaga oo isku day mar kale. | 2026-10-11 | machine-drafted, needs native review |
| `errLoadConversations` | so | Failed to fetch conversations | Lama soo shubi karin wada hadallada | 2026-10-11 | machine-drafted, needs native review |
| `errLoadMessages` | so | Failed to fetch messages | Lama soo shubi karin fariimaha | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToRequest` | so | Please sign in to send a request | Fadlan soo gal si aad codsi u dirto | 2026-10-11 | machine-drafted, needs native review |
| `errPendingExists` | so | This volunteer already has a pending request. Please try again later. | Tabaruc-hahan mar hore ayuu leeyahay codsi sugaya. Fadlan isku day goor dambe. | 2026-10-11 | machine-drafted, needs native review |
| `errNotAccepting` | so | This member isn't accepting new messages right now. | Xubintani hadda ma aqbalayso fariimo cusub. | 2026-10-11 | machine-drafted, needs native review |
| `errSendRequest` | so | Failed to send request | Lama diri karin codsiga | 2026-10-11 | machine-drafted, needs native review |
| `errAccept` | so | Failed to accept request | Lama aqbali karin codsiga | 2026-10-11 | machine-drafted, needs native review |
| `errDecline` | so | Failed to decline request | Lama diidi karin codsiga | 2026-10-11 | machine-drafted, needs native review |
| `errCancel` | so | Failed to cancel conversation | Lama joojin karin wada hadalka | 2026-10-11 | machine-drafted, needs native review |
| `errComplete` | so | Failed to complete conversation | Lama dhammayn karin wada hadalka | 2026-10-11 | machine-drafted, needs native review |
| `errWithdraw` | so | Failed to withdraw request | Lagama noqon karin codsiga | 2026-10-11 | machine-drafted, needs native review |
| `errNoConversation` | so | No conversation selected | Wada hadal lama dooran | 2026-10-11 | machine-drafted, needs native review |
| `errSendMessage` | so | Failed to send message | Lama diri karin fariinta | 2026-10-11 | machine-drafted, needs native review |
| `errMarkRead` | so | Failed to mark messages as read | Fariimaha laguma calaamadin karin in la akhriyay | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | am | Create a free account to message volunteers and connect with your community | ለበጎ ፈቃደኞች መልዕክት ለመላክ እና ከማኅበረሰብዎ ጋር ለመገናኘት ነፃ መለያ ይፍጠሩ | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | am | No messages yet | እስካሁን ምንም መልዕክት የለም | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | am | Volunteer resources on the map have a Message button. Send a request to start a conversation. | በካርታው ላይ ያሉ የበጎ ፈቃደኞች ግብዓቶች የመልዕክት አዝራር አላቸው። ውይይት ለመጀመር ጥያቄ ይላኩ። | 2026-10-11 | machine-drafted, needs native review |
| `title` | am | Messages | መልዕክቶች | 2026-10-11 | machine-drafted, needs native review |
| `sectionPending` | am | Pending Requests ({n}) | በመጠባበቅ ላይ ያሉ ጥያቄዎች ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionActive` | am | Active ({n}) | ንቁ ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionCompleted` | am | Completed ({n}) | የተጠናቀቁ ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionHistory` | am | History ({n}) | ታሪክ ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `backToList` | am | Back to conversations | ወደ ውይይቶች ተመለስ | 2026-10-11 | machine-drafted, needs native review |
| `unknownUser` | am | User | ተጠቃሚ | 2026-10-11 | machine-drafted, needs native review |
| `statusPending` | am | pending | በመጠባበቅ ላይ | 2026-10-11 | machine-drafted, needs native review |
| `statusActive` | am | active | ንቁ | 2026-10-11 | machine-drafted, needs native review |
| `statusCompleted` | am | completed | ተጠናቋል | 2026-10-11 | machine-drafted, needs native review |
| `statusDeclined` | am | declined | ተቀባይነት አላገኘም | 2026-10-11 | machine-drafted, needs native review |
| `statusCancelled` | am | cancelled | ተሰርዟል | 2026-10-11 | machine-drafted, needs native review |
| `accept` | am | Accept | ተቀበል | 2026-10-11 | machine-drafted, needs native review |
| `decline` | am | Decline | አትቀበል | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | am | Withdraw | አንሳ | 2026-10-11 | machine-drafted, needs native review |
| `endAndReview` | am | End & review | ጨርስ እና ገምግም | 2026-10-11 | machine-drafted, needs native review |
| `waitingForAccept` | am | Waiting for {name} to accept your request... | {name} ጥያቄዎን እስኪቀበሉ በመጠባበቅ ላይ... | 2026-10-11 | machine-drafted, needs native review |
| `inputPlaceholder` | am | Type a message... | መልዕክት ይጻፉ... | 2026-10-11 | machine-drafted, needs native review |
| `send` | am | Send message | መልዕክት ላክ | 2026-10-11 | machine-drafted, needs native review |
| `reviewSubmitted` | am | Your review was submitted | ግምገማዎ ተልኳል | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptTitle` | am | How did it go? | እንዴት ነበር? | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptBody` | am | Leave a review for {name} | ለ{name} ግምገማ ይተዉ | 2026-10-11 | machine-drafted, needs native review |
| `rateExperience` | am | Rate your experience | ተሞክሮዎን ይገምግሙ | 2026-10-11 | machine-drafted, needs native review |
| `selectConversation` | am | Select a conversation to view messages | መልዕክቶችን ለማየት ውይይት ይምረጡ | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineTitle` | am | Decline this request? | ይህን ጥያቄ አይቀበሉም? | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawTitle` | am | Withdraw your request? | ጥያቄዎን ያነሳሉ? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelTitle` | am | End this conversation? | ይህን ውይይት ያቆማሉ? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteTitle` | am | End conversation? | ውይይቱን ይጨርሳሉ? | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineBody` | am | The requester will be notified that their request was declined. | ጠያቂው ጥያቄው ተቀባይነት እንዳላገኘ ማሳወቂያ ይደርሰዋል። | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawBody` | am | Your request will be cancelled and cannot be recovered. | ጥያቄዎ ይሰረዛል፤ መልሶ ማግኘትም አይቻልም። | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelBody` | am | This conversation will be closed and cannot be reopened. | ይህ ውይይት ይዘጋል፤ እንደገና መክፈትም አይቻልም። | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteBody` | am | Both of you will be able to leave a review once the conversation is marked complete. | ውይይቱ እንደተጠናቀቀ ከተመዘገበ በኋላ ሁለታችሁም ግምገማ መተው ትችላላችሁ። | 2026-10-11 | machine-drafted, needs native review |
| `keepChatting` | am | Keep chatting | ውይይቱን ቀጥል | 2026-10-11 | machine-drafted, needs native review |
| `confirmDecline` | am | Decline Request | ጥያቄውን አትቀበል | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdraw` | am | Withdraw Request | ጥያቄውን አንሳ | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancel` | am | End Conversation | ውይይቱን አቁም | 2026-10-11 | machine-drafted, needs native review |
| `errTimeout` | am | Messages timed out — please check your connection and retry. | መልዕክቶቹ በጣም ዘግይተዋል። እባክዎ ግንኙነትዎን ያረጋግጡና እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errLoadConversations` | am | Failed to fetch conversations | ውይይቶችን መጫን አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errLoadMessages` | am | Failed to fetch messages | መልዕክቶችን መጫን አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToRequest` | am | Please sign in to send a request | ጥያቄ ለመላክ እባክዎ ይግቡ | 2026-10-11 | machine-drafted, needs native review |
| `errPendingExists` | am | This volunteer already has a pending request. Please try again later. | ይህ በጎ ፈቃደኛ አስቀድሞ በመጠባበቅ ላይ ያለ ጥያቄ አለው። እባክዎ ቆይተው እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errNotAccepting` | am | This member isn't accepting new messages right now. | ይህ አባል አሁን አዲስ መልዕክቶችን አይቀበልም። | 2026-10-11 | machine-drafted, needs native review |
| `errSendRequest` | am | Failed to send request | ጥያቄውን መላክ አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errAccept` | am | Failed to accept request | ጥያቄውን መቀበል አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errDecline` | am | Failed to decline request | ጥያቄውን አለመቀበል አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errCancel` | am | Failed to cancel conversation | ውይይቱን መሰረዝ አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errComplete` | am | Failed to complete conversation | ውይይቱን ማጠናቀቅ አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errWithdraw` | am | Failed to withdraw request | ጥያቄውን ማንሳት አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errNoConversation` | am | No conversation selected | ምንም ውይይት አልተመረጠም | 2026-10-11 | machine-drafted, needs native review |
| `errSendMessage` | am | Failed to send message | መልዕክቱን መላክ አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errMarkRead` | am | Failed to mark messages as read | መልዕክቶቹን እንደተነበቡ ምልክት ማድረግ አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | hmn | Create a free account to message volunteers and connect with your community | Tsim ib tus account dawb los xa lus rau cov neeg pab dawb thiab txuas nrog koj lub zej zog | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | hmn | No messages yet | Tseem tsis tau muaj lus | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | hmn | Volunteer resources on the map have a Message button. Send a request to start a conversation. | Cov neeg pab dawb li kev pab hauv daim ntawv qhia chaw muaj ib lub khawm Xa Lus. Xa ib qho kev thov los pib sib tham. | 2026-10-11 | machine-drafted, needs native review |
| `title` | hmn | Messages | Cov lus | 2026-10-11 | machine-drafted, needs native review |
| `sectionPending` | hmn | Pending Requests ({n}) | Cov kev thov uas tos ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionActive` | hmn | Active ({n}) | Tab tom sib tham ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionCompleted` | hmn | Completed ({n}) | Tiav lawm ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionHistory` | hmn | History ({n}) | Keeb kwm ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `backToList` | hmn | Back to conversations | Rov qab mus rau cov kev sib tham | 2026-10-11 | machine-drafted, needs native review |
| `unknownUser` | hmn | User | Tus neeg siv | 2026-10-11 | machine-drafted, needs native review |
| `statusPending` | hmn | pending | tos | 2026-10-11 | machine-drafted, needs native review |
| `statusActive` | hmn | active | tab tom sib tham | 2026-10-11 | machine-drafted, needs native review |
| `statusCompleted` | hmn | completed | tiav lawm | 2026-10-11 | machine-drafted, needs native review |
| `statusDeclined` | hmn | declined | tsis kam txais | 2026-10-11 | machine-drafted, needs native review |
| `statusCancelled` | hmn | cancelled | raug tshem | 2026-10-11 | machine-drafted, needs native review |
| `accept` | hmn | Accept | Txais | 2026-10-11 | machine-drafted, needs native review |
| `decline` | hmn | Decline | Tsis kam | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | hmn | Withdraw | Thim | 2026-10-11 | machine-drafted, needs native review |
| `endAndReview` | hmn | End & review | Xaus thiab ntsuam xyuas | 2026-10-11 | machine-drafted, needs native review |
| `waitingForAccept` | hmn | Waiting for {name} to accept your request... | Tab tom tos {name} txais koj qhov kev thov... | 2026-10-11 | machine-drafted, needs native review |
| `inputPlaceholder` | hmn | Type a message... | Ntaus ib cov lus... | 2026-10-11 | machine-drafted, needs native review |
| `send` | hmn | Send message | Xa cov lus | 2026-10-11 | machine-drafted, needs native review |
| `reviewSubmitted` | hmn | Your review was submitted | Koj qhov kev ntsuam xyuas raug xa lawm | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptTitle` | hmn | How did it go? | Nws mus li cas? | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptBody` | hmn | Leave a review for {name} | Tso ib qho kev ntsuam xyuas rau {name} | 2026-10-11 | machine-drafted, needs native review |
| `rateExperience` | hmn | Rate your experience | Ntsuam xyuas koj qhov kev paub dhau los | 2026-10-11 | machine-drafted, needs native review |
| `selectConversation` | hmn | Select a conversation to view messages | Xaiv ib qho kev sib tham los saib cov lus | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineTitle` | hmn | Decline this request? | Tsis kam txais qhov kev thov no? | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawTitle` | hmn | Withdraw your request? | Thim koj qhov kev thov? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelTitle` | hmn | End this conversation? | Xaus qhov kev sib tham no? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteTitle` | hmn | End conversation? | Xaus kev sib tham? | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineBody` | hmn | The requester will be notified that their request was declined. | Tus neeg thov yuav tau txais kev ceeb toom tias nws qhov kev thov tsis raug txais. | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawBody` | hmn | Your request will be cancelled and cannot be recovered. | Koj qhov kev thov yuav raug tshem thiab muab rov qab tsis tau. | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelBody` | hmn | This conversation will be closed and cannot be reopened. | Qhov kev sib tham no yuav raug kaw thiab qhib dua tsis tau. | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteBody` | hmn | Both of you will be able to leave a review once the conversation is marked complete. | Neb ob leeg puav leej tso tau kev ntsuam xyuas thaum qhov kev sib tham raug cim tias tiav lawm. | 2026-10-11 | machine-drafted, needs native review |
| `keepChatting` | hmn | Keep chatting | Sib tham ntxiv | 2026-10-11 | machine-drafted, needs native review |
| `confirmDecline` | hmn | Decline Request | Tsis kam txais kev thov | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdraw` | hmn | Withdraw Request | Thim kev thov | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancel` | hmn | End Conversation | Xaus kev sib tham | 2026-10-11 | machine-drafted, needs native review |
| `errTimeout` | hmn | Messages timed out — please check your connection and retry. | Cov lus siv sij hawm ntev dhau. Thov xyuas koj txoj kev sib txuas thiab sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errLoadConversations` | hmn | Failed to fetch conversations | Thauj tsis tau cov kev sib tham | 2026-10-11 | machine-drafted, needs native review |
| `errLoadMessages` | hmn | Failed to fetch messages | Thauj tsis tau cov lus | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToRequest` | hmn | Please sign in to send a request | Thov nkag mus los xa ib qho kev thov | 2026-10-11 | machine-drafted, needs native review |
| `errPendingExists` | hmn | This volunteer already has a pending request. Please try again later. | Tus neeg pab dawb no twb muaj ib qho kev thov uas tos lawm. Thov sim dua tom qab. | 2026-10-11 | machine-drafted, needs native review |
| `errNotAccepting` | hmn | This member isn't accepting new messages right now. | Tus tswv cuab no tsis txais lus tshiab tam sim no. | 2026-10-11 | machine-drafted, needs native review |
| `errSendRequest` | hmn | Failed to send request | Xa tsis tau qhov kev thov | 2026-10-11 | machine-drafted, needs native review |
| `errAccept` | hmn | Failed to accept request | Txais tsis tau qhov kev thov | 2026-10-11 | machine-drafted, needs native review |
| `errDecline` | hmn | Failed to decline request | Tsis kam tsis tau qhov kev thov | 2026-10-11 | machine-drafted, needs native review |
| `errCancel` | hmn | Failed to cancel conversation | Tshem tsis tau qhov kev sib tham | 2026-10-11 | machine-drafted, needs native review |
| `errComplete` | hmn | Failed to complete conversation | Ua tsis tau kom qhov kev sib tham tiav | 2026-10-11 | machine-drafted, needs native review |
| `errWithdraw` | hmn | Failed to withdraw request | Thim tsis tau qhov kev thov | 2026-10-11 | machine-drafted, needs native review |
| `errNoConversation` | hmn | No conversation selected | Tsis tau xaiv kev sib tham | 2026-10-11 | machine-drafted, needs native review |
| `errSendMessage` | hmn | Failed to send message | Xa tsis tau cov lus | 2026-10-11 | machine-drafted, needs native review |
| `errMarkRead` | hmn | Failed to mark messages as read | Cim tsis tau tias cov lus raug nyeem lawm | 2026-10-11 | machine-drafted, needs native review |

### `lib/i18n-feed-organizations.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `title` | ht | Local Organizations | Òganizasyon lokal yo | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | ht | Food banks, shelters, clinics, and community organizations near you | Bank manje, abri, klinik ak òganizasyon kominotè ki toupre w | 2026-10-11 | machine-drafted, needs native review |
| `empty` | ht | No organizations yet. | Poko gen òganizasyon. | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | ht | We couldn't load organizations right now. | Nou pa t kapab chaje òganizasyon yo kounye a. | 2026-10-11 | machine-drafted, needs native review |
| `title` | so | Local Organizations | Ururrada deegaanka | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | so | Food banks, shelters, clinics, and community organizations near you | Bangiyada cuntada, hoyga, rugaha caafimaadka iyo ururrada bulshada ee kuu dhow | 2026-10-11 | machine-drafted, needs native review |
| `empty` | so | No organizations yet. | Weli ma jiraan ururro. | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | so | We couldn't load organizations right now. | Hadda lama soo shubi karo ururrada. | 2026-10-11 | machine-drafted, needs native review |
| `title` | am | Local Organizations | የአካባቢ ድርጅቶች | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | am | Food banks, shelters, clinics, and community organizations near you | በአቅራቢያዎ ያሉ የምግብ ባንኮች፣ መጠለያዎች፣ ክሊኒኮች እና የማኅበረሰብ ድርጅቶች | 2026-10-11 | machine-drafted, needs native review |
| `empty` | am | No organizations yet. | እስካሁን ምንም ድርጅት የለም። | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | am | We couldn't load organizations right now. | ድርጅቶቹን አሁን መጫን አልተቻለም። | 2026-10-11 | machine-drafted, needs native review |
| `title` | hmn | Local Organizations | Cov koom haum hauv zos | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | hmn | Food banks, shelters, clinics, and community organizations near you | Cov txhab nyiaj zaub mov, chaw nyob ib ntus, tsev kho mob thiab cov koom haum zej zog nyob ze koj | 2026-10-11 | machine-drafted, needs native review |
| `empty` | hmn | No organizations yet. | Tseem tsis tau muaj koom haum. | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | hmn | We couldn't load organizations right now. | Tam sim no thauj tsis tau cov koom haum. | 2026-10-11 | machine-drafted, needs native review |

### `lib/i18n-feed-petitions.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `catLandRights` | ht | Land Rights | Dwa sou tè | 2026-10-11 | machine-drafted, needs native review |
| `catInfrastructure` | ht | Infrastructure | Enfrastrikti | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | ht | Housing | Lojman | 2026-10-11 | machine-drafted, needs native review |
| `catFoodAccess` | ht | Food Access | Aksè a manje | 2026-10-11 | machine-drafted, needs native review |
| `catHealthcare` | ht | Healthcare | Swen sante | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | ht | Education | Edikasyon | 2026-10-11 | machine-drafted, needs native review |
| `catEnvironment` | ht | Environment | Anviwònman | 2026-10-11 | machine-drafted, needs native review |
| `catCivilRights` | ht | Civil Rights | Dwa sivil | 2026-10-11 | machine-drafted, needs native review |
| `catCommunity` | ht | Community | Kominote | 2026-10-11 | machine-drafted, needs native review |
| `title` | ht | Community Petitions | Petisyon kominote a | 2026-10-11 | machine-drafted, needs native review |
| `tabsLabel` | ht | Petitions view | Fason pou wè petisyon yo | 2026-10-11 | machine-drafted, needs native review |
| `tabAll` | ht | All petitions | Tout petisyon yo | 2026-10-11 | machine-drafted, needs native review |
| `tabSigned` | ht | Signed | Sa m siyen yo | 2026-10-11 | machine-drafted, needs native review |
| `progressLabel` | ht | Signature progress | Pwogrè siyati yo | 2026-10-11 | machine-drafted, needs native review |
| `signed` | ht | Signed | Siyen | 2026-10-11 | machine-drafted, needs native review |
| `signaturesFinal` | ht | Signatures are final (the list has been exported). | Siyati yo definitif (lis la deja ekspòte). | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | ht | Withdraw my signature | Retire siyati mwen | 2026-10-11 | machine-drafted, needs native review |
| `sign` | ht | Add your verified signature of support | Ajoute siyati verifye pou sipò ou | 2026-10-11 | machine-drafted, needs native review |
| `actionForPetitionAria` | ht | {action}: {title} | {action}: {title} | 2026-10-11 | machine-drafted, needs native review |
| `signingAs` | ht | Signing as {name} | W ap siyen kòm {name} | 2026-10-11 | machine-drafted, needs native review |
| `retentionNotice` | ht | Your name, the date, and a record of this petition version are kept as your verified signature of support. | Non ou, dat la ak yon dosye sou vèsyon petisyon sa a rete kòm siyati verifye pou sipò ou. | 2026-10-11 | machine-drafted, needs native review |
| `loading` | ht | Loading petitions… | N ap chaje petisyon yo… | 2026-10-11 | machine-drafted, needs native review |
| `tryAgain` | ht | Try again | Eseye ankò | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | ht | No active petitions | Pa gen petisyon aktif | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | ht | Community petitions will appear here when published. | Petisyon kominote a ap parèt isit la lè yo pibliye. | 2026-10-11 | machine-drafted, needs native review |
| `faqToggle` | ht | About petition signatures | Konsènan siyati petisyon yo | 2026-10-11 | machine-drafted, needs native review |
| `faqPrivacy` | ht | Only administrators can see signers’ names; the public count never reveals who signed. | Se administratè yo sèlman ki ka wè non moun ki siyen yo; kantite piblik la pa janm montre kiyès ki siyen. | 2026-10-11 | machine-drafted, needs native review |
| `faqWithdraw` | ht | You can withdraw your signature anytime — until the organizer exports the signed list, after which signatures become final. | Ou ka retire siyati ou nenpòt lè, jiskaske òganizatè a ekspòte lis siyati yo; apre sa, siyati yo vin definitif. | 2026-10-11 | machine-drafted, needs native review |
| `faqVerified` | ht | “Verified signature of support” means your signature is recorded with a secure timestamp. | « Siyati verifye pou sipò » vle di siyati ou anrejistre ak yon mak tan ki an sekirite. | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | ht | Create a free account to add your verified signature of support to petitions | Kreye yon kont gratis pou w ajoute siyati verifye pou sipò ou nan petisyon yo | 2026-10-11 | machine-drafted, needs native review |
| `signInPrompt` | ht | Sign in to add your verified signature of support to any petition. | Konekte pou w ajoute siyati verifye pou sipò ou nan nenpòt petisyon. | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyTitle` | ht | No signed petitions yet | Ou poko siyen okenn petisyon | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyBody` | ht | Petitions you sign will appear here. | Petisyon ou siyen yo ap parèt isit la. | 2026-10-11 | machine-drafted, needs native review |
| `errLoadFailed` | ht | Unable to load petitions. Please try again. | Nou pa kapab chaje petisyon yo. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errSignFailed` | ht | Unable to add your signature. Please try again. | Nou pa kapab ajoute siyati ou. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | ht | Sign in with an account to add your verified signature of support. | Konekte ak yon kont pou w ajoute siyati verifye pou sipò ou. | 2026-10-11 | machine-drafted, needs native review |
| `errAffirmationRequired` | ht | You must affirm to add your verified signature of support. | Ou dwe konfime pou w ajoute siyati verifye pou sipò ou. | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawLocked` | ht | Signatures are final — the organizer has exported this list. | Siyati yo definitif: òganizatè a deja ekspòte lis sa a. | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawFailed` | ht | Unable to withdraw your signature. Please try again. | Nou pa kapab retire siyati ou. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `catLandRights` | so | Land Rights | Xuquuqda dhulka | 2026-10-11 | machine-drafted, needs native review |
| `catInfrastructure` | so | Infrastructure | Kaabayaasha | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | so | Housing | Guriyeyn | 2026-10-11 | machine-drafted, needs native review |
| `catFoodAccess` | so | Food Access | Helitaanka cuntada | 2026-10-11 | machine-drafted, needs native review |
| `catHealthcare` | so | Healthcare | Daryeel caafimaad | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | so | Education | Waxbarasho | 2026-10-11 | machine-drafted, needs native review |
| `catEnvironment` | so | Environment | Deegaanka | 2026-10-11 | machine-drafted, needs native review |
| `catCivilRights` | so | Civil Rights | Xuquuqda madaniga | 2026-10-11 | machine-drafted, needs native review |
| `catCommunity` | so | Community | Bulsho | 2026-10-11 | machine-drafted, needs native review |
| `title` | so | Community Petitions | Codsiyada bulshada | 2026-10-11 | machine-drafted, needs native review |
| `tabsLabel` | so | Petitions view | Muuqaalka codsiyada | 2026-10-11 | machine-drafted, needs native review |
| `tabAll` | so | All petitions | Dhammaan codsiyada | 2026-10-11 | machine-drafted, needs native review |
| `tabSigned` | so | Signed | Kuwa la saxiixay | 2026-10-11 | machine-drafted, needs native review |
| `progressLabel` | so | Signature progress | Horumarka saxiixyada | 2026-10-11 | machine-drafted, needs native review |
| `signed` | so | Signed | Waa la saxiixay | 2026-10-11 | machine-drafted, needs native review |
| `signaturesFinal` | so | Signatures are final (the list has been exported). | Saxiixyadu waa kama dambays (liiska waa la soo dejiyay). | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | so | Withdraw my signature | Ka noqo saxiixayga | 2026-10-11 | machine-drafted, needs native review |
| `sign` | so | Add your verified signature of support | Ku dar saxiixaaga taageerada ee la xaqiijiyay | 2026-10-11 | machine-drafted, needs native review |
| `actionForPetitionAria` | so | {action}: {title} | {action}: {title} | 2026-10-11 | machine-drafted, needs native review |
| `signingAs` | so | Signing as {name} | Waxaad u saxiixaysaa magaca {name} | 2026-10-11 | machine-drafted, needs native review |
| `retentionNotice` | so | Your name, the date, and a record of this petition version are kept as your verified signature of support. | Magacaaga, taariikhda iyo diiwaanka nuqulkan codsiga waxaa loo kaydiyaa sidii saxiixaaga taageerada ee la xaqiijiyay. | 2026-10-11 | machine-drafted, needs native review |
| `loading` | so | Loading petitions… | Codsiyada waa la soo shubayaa… | 2026-10-11 | machine-drafted, needs native review |
| `tryAgain` | so | Try again | Isku day mar kale | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | so | No active petitions | Ma jiraan codsiyo firfircoon | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | so | Community petitions will appear here when published. | Codsiyada bulshadu halkan ayay ka soo muuqan doonaan marka la daabaco. | 2026-10-11 | machine-drafted, needs native review |
| `faqToggle` | so | About petition signatures | Ku saabsan saxiixyada codsiyada | 2026-10-11 | machine-drafted, needs native review |
| `faqPrivacy` | so | Only administrators can see signers’ names; the public count never reveals who signed. | Maamulayaasha oo keliya ayaa arki kara magacyada dadka saxiixay; tirada dadweynaha u muuqata weligeed ma muujiso cidda saxiixday. | 2026-10-11 | machine-drafted, needs native review |
| `faqWithdraw` | so | You can withdraw your signature anytime — until the organizer exports the signed list, after which signatures become final. | Waad ka noqon kartaa saxiixaaga wakhti kasta, ilaa qabanqaabiyuhu soo dejiyo liiska saxiixyada; intaas ka dib saxiixyadu waa kama dambays. | 2026-10-11 | machine-drafted, needs native review |
| `faqVerified` | so | “Verified signature of support” means your signature is recorded with a secure timestamp. | “Saxiix taageero oo la xaqiijiyay” waxay ka dhigan tahay in saxiixaaga lagu diiwaangeliyo shaabad waqti oo ammaan ah. | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | so | Create a free account to add your verified signature of support to petitions | Samee akoon bilaash ah si aad codsiyada ugu darto saxiixaaga taageerada ee la xaqiijiyay | 2026-10-11 | machine-drafted, needs native review |
| `signInPrompt` | so | Sign in to add your verified signature of support to any petition. | Soo gal si aad codsi kasta ugu darto saxiixaaga taageerada ee la xaqiijiyay. | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyTitle` | so | No signed petitions yet | Weli ma saxiixin wax codsi ah | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyBody` | so | Petitions you sign will appear here. | Codsiyada aad saxiixdo halkan ayay ka soo muuqan doonaan. | 2026-10-11 | machine-drafted, needs native review |
| `errLoadFailed` | so | Unable to load petitions. Please try again. | Lama soo shubi karo codsiyada. Fadlan isku day mar kale. | 2026-10-11 | machine-drafted, needs native review |
| `errSignFailed` | so | Unable to add your signature. Please try again. | Lama dari karo saxiixaaga. Fadlan isku day mar kale. | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | so | Sign in with an account to add your verified signature of support. | Ku soo gal akoon si aad ugu darto saxiixaaga taageerada ee la xaqiijiyay. | 2026-10-11 | machine-drafted, needs native review |
| `errAffirmationRequired` | so | You must affirm to add your verified signature of support. | Waa inaad xaqiijisaa si aad ugu darto saxiixaaga taageerada ee la xaqiijiyay. | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawLocked` | so | Signatures are final — the organizer has exported this list. | Saxiixyadu waa kama dambays: qabanqaabiyuhu wuu soo dejiyay liiskan. | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawFailed` | so | Unable to withdraw your signature. Please try again. | Lagama noqon karo saxiixaaga. Fadlan isku day mar kale. | 2026-10-11 | machine-drafted, needs native review |
| `catLandRights` | am | Land Rights | የመሬት መብቶች | 2026-10-11 | machine-drafted, needs native review |
| `catInfrastructure` | am | Infrastructure | መሠረተ ልማት | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | am | Housing | መኖሪያ ቤት | 2026-10-11 | machine-drafted, needs native review |
| `catFoodAccess` | am | Food Access | የምግብ አቅርቦት | 2026-10-11 | machine-drafted, needs native review |
| `catHealthcare` | am | Healthcare | የጤና እንክብካቤ | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | am | Education | ትምህርት | 2026-10-11 | machine-drafted, needs native review |
| `catEnvironment` | am | Environment | አካባቢ | 2026-10-11 | machine-drafted, needs native review |
| `catCivilRights` | am | Civil Rights | የዜጎች መብቶች | 2026-10-11 | machine-drafted, needs native review |
| `catCommunity` | am | Community | ማኅበረሰብ | 2026-10-11 | machine-drafted, needs native review |
| `title` | am | Community Petitions | የማኅበረሰብ አቤቱታዎች | 2026-10-11 | machine-drafted, needs native review |
| `tabsLabel` | am | Petitions view | የአቤቱታዎች እይታ | 2026-10-11 | machine-drafted, needs native review |
| `tabAll` | am | All petitions | ሁሉም አቤቱታዎች | 2026-10-11 | machine-drafted, needs native review |
| `tabSigned` | am | Signed | የተፈረሙ | 2026-10-11 | machine-drafted, needs native review |
| `progressLabel` | am | Signature progress | የፊርማዎች ሂደት | 2026-10-11 | machine-drafted, needs native review |
| `signed` | am | Signed | ተፈርሟል | 2026-10-11 | machine-drafted, needs native review |
| `signaturesFinal` | am | Signatures are final (the list has been exported). | ፊርማዎቹ የመጨረሻ ናቸው (ዝርዝሩ ወጥቷል)። | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | am | Withdraw my signature | ፊርማዬን አንሳ | 2026-10-11 | machine-drafted, needs native review |
| `sign` | am | Add your verified signature of support | የተረጋገጠ የድጋፍ ፊርማዎን ያክሉ | 2026-10-11 | machine-drafted, needs native review |
| `actionForPetitionAria` | am | {action}: {title} | {action}፦ {title} | 2026-10-11 | machine-drafted, needs native review |
| `signingAs` | am | Signing as {name} | በ{name} ስም እየፈረሙ ነው | 2026-10-11 | machine-drafted, needs native review |
| `retentionNotice` | am | Your name, the date, and a record of this petition version are kept as your verified signature of support. | ስምዎ፣ ቀኑ እና የዚህ አቤቱታ እትም መዝገብ እንደ የተረጋገጠ የድጋፍ ፊርማዎ ይቀመጣሉ። | 2026-10-11 | machine-drafted, needs native review |
| `loading` | am | Loading petitions… | አቤቱታዎች በመጫን ላይ… | 2026-10-11 | machine-drafted, needs native review |
| `tryAgain` | am | Try again | እንደገና ይሞክሩ | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | am | No active petitions | ንቁ አቤቱታዎች የሉም | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | am | Community petitions will appear here when published. | የማኅበረሰብ አቤቱታዎች ሲታተሙ እዚህ ይታያሉ። | 2026-10-11 | machine-drafted, needs native review |
| `faqToggle` | am | About petition signatures | ስለ አቤቱታ ፊርማዎች | 2026-10-11 | machine-drafted, needs native review |
| `faqPrivacy` | am | Only administrators can see signers’ names; the public count never reveals who signed. | የፈራሚዎችን ስም ማየት የሚችሉት አስተዳዳሪዎች ብቻ ናቸው፤ ለሕዝብ የሚታየው ቁጥር ማን እንደፈረመ ፈጽሞ አያሳይም። | 2026-10-11 | machine-drafted, needs native review |
| `faqWithdraw` | am | You can withdraw your signature anytime — until the organizer exports the signed list, after which signatures become final. | አዘጋጁ የፊርማዎችን ዝርዝር እስኪያወጣ ድረስ ፊርማዎን በማንኛውም ጊዜ ማንሳት ይችላሉ፤ ከዚያ በኋላ ፊርማዎች የመጨረሻ ይሆናሉ። | 2026-10-11 | machine-drafted, needs native review |
| `faqVerified` | am | “Verified signature of support” means your signature is recorded with a secure timestamp. | “የተረጋገጠ የድጋፍ ፊርማ” ማለት ፊርማዎ ከአስተማማኝ የጊዜ ማህተም ጋር ተመዝግቧል ማለት ነው። | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | am | Create a free account to add your verified signature of support to petitions | የተረጋገጠ የድጋፍ ፊርማዎን በአቤቱታዎች ላይ ለማከል ነፃ መለያ ይፍጠሩ | 2026-10-11 | machine-drafted, needs native review |
| `signInPrompt` | am | Sign in to add your verified signature of support to any petition. | የተረጋገጠ የድጋፍ ፊርማዎን በማንኛውም አቤቱታ ላይ ለማከል ይግቡ። | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyTitle` | am | No signed petitions yet | እስካሁን የፈረሙት አቤቱታ የለም | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyBody` | am | Petitions you sign will appear here. | የሚፈርሟቸው አቤቱታዎች እዚህ ይታያሉ። | 2026-10-11 | machine-drafted, needs native review |
| `errLoadFailed` | am | Unable to load petitions. Please try again. | አቤቱታዎችን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errSignFailed` | am | Unable to add your signature. Please try again. | ፊርማዎን ማከል አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | am | Sign in with an account to add your verified signature of support. | የተረጋገጠ የድጋፍ ፊርማዎን ለማከል በመለያ ይግቡ። | 2026-10-11 | machine-drafted, needs native review |
| `errAffirmationRequired` | am | You must affirm to add your verified signature of support. | የተረጋገጠ የድጋፍ ፊርማዎን ለማከል ማረጋገጥ አለብዎት። | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawLocked` | am | Signatures are final — the organizer has exported this list. | ፊርማዎቹ የመጨረሻ ናቸው፦ አዘጋጁ ይህን ዝርዝር አውጥቷል። | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawFailed` | am | Unable to withdraw your signature. Please try again. | ፊርማዎን ማንሳት አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `catLandRights` | hmn | Land Rights | Cai txog av | 2026-10-11 | machine-drafted, needs native review |
| `catInfrastructure` | hmn | Infrastructure | Kev tsim kho vaj tse thiab kev | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | hmn | Housing | Vaj tse | 2026-10-11 | machine-drafted, needs native review |
| `catFoodAccess` | hmn | Food Access | Kev tau txais zaub mov | 2026-10-11 | machine-drafted, needs native review |
| `catHealthcare` | hmn | Healthcare | Kev kho mob | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | hmn | Education | Kev kawm | 2026-10-11 | machine-drafted, needs native review |
| `catEnvironment` | hmn | Environment | Ib puag ncig | 2026-10-11 | machine-drafted, needs native review |
| `catCivilRights` | hmn | Civil Rights | Pej xeem txoj cai | 2026-10-11 | machine-drafted, needs native review |
| `catCommunity` | hmn | Community | Zej zog | 2026-10-11 | machine-drafted, needs native review |
| `title` | hmn | Community Petitions | Zej zog cov ntawv thov | 2026-10-11 | machine-drafted, needs native review |
| `tabsLabel` | hmn | Petitions view | Saib cov ntawv thov | 2026-10-11 | machine-drafted, needs native review |
| `tabAll` | hmn | All petitions | Tag nrho cov ntawv thov | 2026-10-11 | machine-drafted, needs native review |
| `tabSigned` | hmn | Signed | Cov uas tau kos npe | 2026-10-11 | machine-drafted, needs native review |
| `progressLabel` | hmn | Signature progress | Kev nce qib ntawm cov kos npe | 2026-10-11 | machine-drafted, needs native review |
| `signed` | hmn | Signed | Tau kos npe lawm | 2026-10-11 | machine-drafted, needs native review |
| `signaturesFinal` | hmn | Signatures are final (the list has been exported). | Cov kos npe hloov tsis tau lawm (daim npe twb raug rho tawm lawm). | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | hmn | Withdraw my signature | Thim kuv qhov kos npe | 2026-10-11 | machine-drafted, needs native review |
| `sign` | hmn | Add your verified signature of support | Ntxiv koj qhov kos npe txhawb nqa uas tau txheeb xyuas | 2026-10-11 | machine-drafted, needs native review |
| `actionForPetitionAria` | hmn | {action}: {title} | {action}: {title} | 2026-10-11 | machine-drafted, needs native review |
| `signingAs` | hmn | Signing as {name} | Koj kos npe ua {name} | 2026-10-11 | machine-drafted, needs native review |
| `retentionNotice` | hmn | Your name, the date, and a record of this petition version are kept as your verified signature of support. | Koj lub npe, hnub tim thiab ib daim ntawv teev txog tsab ntawv thov no raug khaws ua koj qhov kos npe txhawb nqa uas tau txheeb xyuas. | 2026-10-11 | machine-drafted, needs native review |
| `loading` | hmn | Loading petitions… | Tab tom thauj cov ntawv thov… | 2026-10-11 | machine-drafted, needs native review |
| `tryAgain` | hmn | Try again | Sim dua | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | hmn | No active petitions | Tsis muaj ntawv thov uas tseem qhib | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | hmn | Community petitions will appear here when published. | Zej zog cov ntawv thov yuav tshwm ntawm no thaum muab tshaj tawm. | 2026-10-11 | machine-drafted, needs native review |
| `faqToggle` | hmn | About petition signatures | Hais txog cov kos npe rau ntawv thov | 2026-10-11 | machine-drafted, needs native review |
| `faqPrivacy` | hmn | Only administrators can see signers’ names; the public count never reveals who signed. | Tsuas yog cov thawj tswj thiaj pom cov neeg kos npe lub npe; tus lej uas pej xeem pom yeej tsis qhia tias leej twg tau kos npe. | 2026-10-11 | machine-drafted, needs native review |
| `faqWithdraw` | hmn | You can withdraw your signature anytime — until the organizer exports the signed list, after which signatures become final. | Koj thim tau koj qhov kos npe txhua lub sij hawm, mus txog thaum tus neeg npaj rho daim npe kos npe tawm; tom qab ntawd cov kos npe hloov tsis tau lawm. | 2026-10-11 | machine-drafted, needs native review |
| `faqVerified` | hmn | “Verified signature of support” means your signature is recorded with a secure timestamp. | “Kos npe txhawb nqa uas tau txheeb xyuas” txhais tias koj qhov kos npe raug sau tseg nrog lub sij hawm uas ruaj ntseg. | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | hmn | Create a free account to add your verified signature of support to petitions | Tsim ib tus account dawb los ntxiv koj qhov kos npe txhawb nqa uas tau txheeb xyuas rau cov ntawv thov | 2026-10-11 | machine-drafted, needs native review |
| `signInPrompt` | hmn | Sign in to add your verified signature of support to any petition. | Nkag mus los ntxiv koj qhov kos npe txhawb nqa uas tau txheeb xyuas rau txhua daim ntawv thov. | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyTitle` | hmn | No signed petitions yet | Koj tseem tsis tau kos npe rau ib daim ntawv thov | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyBody` | hmn | Petitions you sign will appear here. | Cov ntawv thov uas koj kos npe yuav tshwm ntawm no. | 2026-10-11 | machine-drafted, needs native review |
| `errLoadFailed` | hmn | Unable to load petitions. Please try again. | Thauj tsis tau cov ntawv thov. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errSignFailed` | hmn | Unable to add your signature. Please try again. | Ntxiv tsis tau koj qhov kos npe. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | hmn | Sign in with an account to add your verified signature of support. | Nkag mus nrog ib tus account los ntxiv koj qhov kos npe txhawb nqa uas tau txheeb xyuas. | 2026-10-11 | machine-drafted, needs native review |
| `errAffirmationRequired` | hmn | You must affirm to add your verified signature of support. | Koj yuav tsum lees paub thiaj ntxiv tau koj qhov kos npe txhawb nqa uas tau txheeb xyuas. | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawLocked` | hmn | Signatures are final — the organizer has exported this list. | Cov kos npe hloov tsis tau lawm: tus neeg npaj twb rho daim npe no tawm lawm. | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawFailed` | hmn | Unable to withdraw your signature. Please try again. | Thim tsis tau koj qhov kos npe. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `SIGNATURES_OF_TARGET.other` | ht | {count} of {target} signatures | {count} sou {target} siyati | 2026-10-11 | machine-drafted, needs native review |
| `SIGNATURES_OF_TARGET.other` | so | {count} of {target} signatures | {count} ka mid ah {target} saxiix | 2026-10-11 | machine-drafted, needs native review |
| `SIGNATURES_OF_TARGET.one` | am | {count} of {target} signature | {count} ከ{target} ፊርማ | 2026-10-11 | machine-drafted, needs native review |
| `SIGNATURES_OF_TARGET.other` | am | {count} of {target} signatures | {count} ከ{target} ፊርማዎች | 2026-10-11 | machine-drafted, needs native review |
| `SIGNATURES_OF_TARGET.other` | hmn | {count} of {target} signatures | {count} ntawm {target} tus kos npe | 2026-10-11 | machine-drafted, needs native review |
| `VERIFIED_SIGNATURES.other` | ht | {count} verified signatures | {count} siyati verifye | 2026-10-11 | machine-drafted, needs native review |
| `VERIFIED_SIGNATURES.other` | so | {count} verified signatures | {count} saxiix oo la xaqiijiyay | 2026-10-11 | machine-drafted, needs native review |
| `VERIFIED_SIGNATURES.one` | am | {count} verified signature | {count} የተረጋገጠ ፊርማ | 2026-10-11 | machine-drafted, needs native review |
| `VERIFIED_SIGNATURES.other` | am | {count} verified signatures | {count} የተረጋገጡ ፊርማዎች | 2026-10-11 | machine-drafted, needs native review |
| `VERIFIED_SIGNATURES.other` | hmn | {count} verified signatures | {count} tus kos npe uas tau txheeb xyuas | 2026-10-11 | machine-drafted, needs native review |
| `sign` | ar | Add your verified signature of support | أضف توقيع الدعم المؤكَّد الخاص بك | 2026-10-11 | wording choice, review welcome |
| `retentionNotice` | ar | Your name, the date, and a record of this petition version are kept as your verified signature of support. | يُحفظ اسمك والتاريخ وسجل لهذه النسخة من العريضة بوصفها توقيع الدعم المؤكَّد الخاص بك. | 2026-10-11 | wording choice, review welcome |
| `faqVerified` | ar | “Verified signature of support” means your signature is recorded with a secure timestamp. | «توقيع الدعم المؤكَّد» يعني أن توقيعك يُسجَّل مع طابع زمني آمن. | 2026-10-11 | wording choice, review welcome |
| `guestPrompt` | ar | Create a free account to add your verified signature of support to petitions | أنشئ حسابًا مجانيًا لتضيف توقيع الدعم المؤكَّد الخاص بك إلى العرائض | 2026-10-11 | wording choice, review welcome |
| `signInPrompt` | ar | Sign in to add your verified signature of support to any petition. | سجِّل الدخول لتضيف توقيع الدعم المؤكَّد الخاص بك إلى أي عريضة. | 2026-10-11 | wording choice, review welcome |
| `errAccountRequired` | ar | Sign in with an account to add your verified signature of support. | سجِّل الدخول بحساب لتضيف توقيع الدعم المؤكَّد الخاص بك. | 2026-10-11 | wording choice, review welcome |
| `errAffirmationRequired` | ar | You must affirm to add your verified signature of support. | عليك التأكيد لتضيف توقيع الدعم المؤكَّد الخاص بك. | 2026-10-11 | wording choice, review welcome |
| `VERIFIED_SIGNATURES.zero` | ar | {count} verified signatures | {count} توقيع مؤكَّد | 2026-10-11 | wording choice, review welcome |
| `VERIFIED_SIGNATURES.one` | ar | {count} verified signature | {count} توقيع مؤكَّد | 2026-10-11 | wording choice, review welcome |
| `VERIFIED_SIGNATURES.two` | ar | {count} verified signatures | {count} توقيعان مؤكَّدان | 2026-10-11 | wording choice, review welcome |
| `VERIFIED_SIGNATURES.few` | ar | {count} verified signatures | {count} توقيعات مؤكَّدة | 2026-10-11 | wording choice, review welcome |
| `VERIFIED_SIGNATURES.many` | ar | {count} verified signatures | {count} توقيعًا مؤكَّدًا | 2026-10-11 | wording choice, review welcome |
| `VERIFIED_SIGNATURES.other` | ar | {count} verified signatures | {count} توقيع مؤكَّد | 2026-10-11 | wording choice, review welcome |

<!-- END GENERATED -->

## Older dictionaries, not itemised here

Written before this list existed. All four locales of each are machine-drafted and need native
review. `Inline note` says whether the file itself still says so (a header line such as "ht, so, am
and hmn need native-speaker review", or `// TODO: native-speaker review` beside the entries in
`lib/i18n.ts`). To itemise one, delete its row here and in `OLDER` in the test, then regenerate.

| Dictionary | Keys | Inline note |
|---|---|---|
| `lib/i18n.ts` | 19 | yes |
| `lib/i18n-feed-chrome.ts` | 26 | yes |
| `lib/i18n-feed-card.ts` | 88 | yes |
| `lib/i18n-feed-composer.ts` | 98 | yes |
| `lib/i18n-feed-comments.ts` | 40 | yes |
| `lib/i18n-feed-edit.ts` | 124 | yes |
| `lib/i18n-resource-categories.ts` | 25 | yes |
| `lib/i18n-event-forms.ts` | 201 | yes |
| `lib/i18n-event-member.ts` | 33 | yes |
| `lib/i18n-map-member.ts` | 1 | yes |
| `lib/i18n-admin-nav.ts` | 17 | no |
| `lib/i18n-admin-focus.ts` | 2 | yes |
| `lib/i18n-org-forms.ts` | 203 | yes |
| `lib/event-recurrence-format.ts` | weekday names and repeat phrases | yes |
