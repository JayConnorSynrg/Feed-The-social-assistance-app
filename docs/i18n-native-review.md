# Native-speaker review list

FEED ships its interface in 14 languages. Four of them were drafted by machine and still need a
native speaker to read them: Haitian Creole (`ht`), Somali (`so`), Amharic (`am`) and Hmong (`hmn`).

## What this list covers

This list starts with Release 3.5. It itemises, string by string:

- the four Community sub-tab dictionaries: `lib/i18n-feed-organizations.ts`,
  `lib/i18n-feed-petitions.ts`, `lib/i18n-feed-messages.ts`, `lib/i18n-feed-businesses.ts`;
- the feed card dictionaries written after them, each as it lands: `lib/i18n-feed-photo.ts`
  (photo picker), `lib/i18n-feed-follows.ts` (follow errors), `lib/i18n-friendly-error.ts` (the
  two general failure sentences), `lib/i18n-feed-optins.ts` (the sign-up controls of a post
  card), `lib/i18n-feed-badges.ts` (author badges, the author sheet and its appreciation picker,
  the gifts shelf, the review dialog);
- the Language section of Settings: `lib/i18n-settings-language.ts`;
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

### `lib/i18n-admin-moderation.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `subtabReports` | ht | Reports | Rapò | 2026-11-15 | machine-drafted, needs native review |
| `subtabSafety` | ht | Safety Alerts | Alèt sekirite | 2026-11-15 | machine-drafted, needs native review |
| `loadingReports` | ht | Loading reports… | N ap chaje rapò yo… | 2026-11-15 | machine-drafted, needs native review |
| `loadFailed` | ht | The reports couldn't be loaded. Please try again. | Nou pa t ka chaje rapò yo. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `errorGeneric` | ht | An error occurred | Gen yon erè ki fèt | 2026-11-15 | machine-drafted, needs native review |
| `emptyTitle` | ht | No open reports | Pa gen rapò ki louvri | 2026-11-15 | machine-drafted, needs native review |
| `emptyBody` | ht | There are no content reports awaiting review. | Pa gen okenn rapò sou kontni k ap tann revizyon. | 2026-11-15 | machine-drafted, needs native review |
| `reportDetails` | ht | Report details | Detay rapò yo | 2026-11-15 | machine-drafted, needs native review |
| `authorLabel` | ht | Author: | Otè: | 2026-11-15 | machine-drafted, needs native review |
| `viewPost` | ht | View post | Gade piblikasyon an | 2026-11-15 | machine-drafted, needs native review |
| `actionRemove` | ht | Remove Post | Retire piblikasyon an | 2026-11-15 | machine-drafted, needs native review |
| `actionHold` | ht | Hold for Review | Kenbe pou revizyon | 2026-11-15 | machine-drafted, needs native review |
| `actionAuthorize` | ht | Authorize Post | Otorize piblikasyon an | 2026-11-15 | machine-drafted, needs native review |
| `actionDismiss` | ht | Dismiss | Ignore | 2026-11-15 | machine-drafted, needs native review |
| `ownPostNote` | ht | This is your own post: another moderator reviews its reports. | Sa a se pwòp piblikasyon pa w: yon lòt moderatè ap revize rapò li yo. | 2026-11-15 | machine-drafted, needs native review |
| `heldTitle` | ht | Removed & Held Posts | Piblikasyon ki retire ak ki kenbe | 2026-11-15 | machine-drafted, needs native review |
| `heldEmpty` | ht | No removed or held posts. | Pa gen piblikasyon ki retire oswa ki kenbe. | 2026-11-15 | machine-drafted, needs native review |
| `statusVisible` | ht | Visible to members | Manm yo ka wè l | 2026-11-15 | machine-drafted, needs native review |
| `statusRemoved` | ht | Removed | Retire | 2026-11-15 | machine-drafted, needs native review |
| `statusHeld` | ht | Held for review | Yo kenbe l pou revizyon | 2026-11-15 | machine-drafted, needs native review |
| `statusHidden` | ht | Hidden from members | Kache pou manm yo | 2026-11-15 | machine-drafted, needs native review |
| `statusLine` | ht | Status: {status}. | Estati: {status}. | 2026-11-15 | machine-drafted, needs native review |
| `doneRemove` | ht | Post removed. | Piblikasyon an retire. | 2026-11-15 | machine-drafted, needs native review |
| `doneHold` | ht | Post held for review. | Piblikasyon an kenbe pou revizyon. | 2026-11-15 | machine-drafted, needs native review |
| `doneAuthorize` | ht | Post authorized. | Piblikasyon an otorize. | 2026-11-15 | machine-drafted, needs native review |
| `doneDismiss` | ht | Report dismissed. | Rapò a ignore. | 2026-11-15 | machine-drafted, needs native review |
| `focusTitle` | ht | Linked post | Piblikasyon ki lye a | 2026-11-15 | machine-drafted, needs native review |
| `focusClose` | ht | Close linked post | Fèmen piblikasyon ki lye a | 2026-11-15 | machine-drafted, needs native review |
| `focusLoading` | ht | Loading the linked post… | N ap chaje piblikasyon ki lye a… | 2026-11-15 | machine-drafted, needs native review |
| `focusNotFound` | ht | This post was not found. It may have been deleted. | Nou pa jwenn piblikasyon sa a. Petèt yo efase l. | 2026-11-15 | machine-drafted, needs native review |
| `focusError` | ht | The linked post could not be loaded. The reports queue below still works. | Nou pa t ka chaje piblikasyon ki lye a. Lis rapò ki anba a toujou mache. | 2026-11-15 | machine-drafted, needs native review |
| `failConflict` | ht | The author changed this post since you opened it. The latest version is shown — review it and choose again. | Otè a chanje piblikasyon sa a depi ou te louvri l. Nou montre dènye vèsyon an — revize l epi chwazi ankò. | 2026-11-15 | machine-drafted, needs native review |
| `failSelf` | ht | You can't moderate your own content — another moderator needs to review it. | Ou pa ka modere pwòp kontni pa w — yon lòt moderatè dwe revize l. | 2026-11-15 | machine-drafted, needs native review |
| `failGone` | ht | This post is gone — its author deleted it. Nothing was changed. | Piblikasyon sa a pa egziste ankò — otè l efase l. Anyen pa chanje. | 2026-11-15 | machine-drafted, needs native review |
| `insightsTitle` | ht | Community Insights | Enfòmasyon sou kominote a | 2026-11-15 | machine-drafted, needs native review |
| `insightsAnalyzing` | ht | Analyzing… | N ap analize… | 2026-11-15 | machine-drafted, needs native review |
| `insightsRefresh` | ht | Refresh | Rafrechi | 2026-11-15 | machine-drafted, needs native review |
| `insightsGenerate` | ht | Generate Insights | Jenere enfòmasyon | 2026-11-15 | machine-drafted, needs native review |
| `insightsSuppressed` | ht | AI insights available once community reaches sufficient volume (k≥20 per category). | Enfòmasyon IA ap disponib lè kominote a rive nan yon volim ase (k≥20 pa kategori). | 2026-11-15 | machine-drafted, needs native review |
| `insightsHint` | ht | Click "{button}" to analyze community posts from the last 30 days. | Klike sou "{button}" pou analize piblikasyon kominote a nan dènye 30 jou yo. | 2026-11-15 | machine-drafted, needs native review |
| `insightsUpdated` | ht | Last updated: {time} | Dènye mizajou: {time} | 2026-11-15 | machine-drafted, needs native review |
| `insightsFailed` | ht | The insights couldn't be generated. Please try again. | Nou pa t ka jenere enfòmasyon yo. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `errorTitle` | ht | Something went wrong | Gen yon bagay ki mal pase | 2026-11-15 | machine-drafted, needs native review |
| `errorBody` | ht | This admin page hit an unexpected error. Please try again, or use the link at the top of the page to return to the feed. | Paj administrasyon sa a rankontre yon erè inatandi. Tanpri eseye ankò, oswa sèvi ak lyen ki anlè paj la pou retounen nan fil la. | 2026-11-15 | machine-drafted, needs native review |
| `errorRef` | ht | ref: {digest} | referans: {digest} | 2026-11-15 | machine-drafted, needs native review |
| `notFoundTitle` | ht | Page not found | Nou pa jwenn paj la | 2026-11-15 | machine-drafted, needs native review |
| `notFoundBody` | ht | This admin page doesn’t exist, or you don’t have access to it. Use the link at the top of the page to return to the feed. | Paj administrasyon sa a pa egziste, oswa ou pa gen aksè ladan l. Sèvi ak lyen ki anlè paj la pou retounen nan fil la. | 2026-11-15 | machine-drafted, needs native review |
| `subtabReports` | so | Reports | Warbixinno | 2026-11-15 | machine-drafted, needs native review |
| `subtabSafety` | so | Safety Alerts | Digniinaha badbaadada | 2026-11-15 | machine-drafted, needs native review |
| `loadingReports` | so | Loading reports… | Warbixinnada waa la soo rarayaa… | 2026-11-15 | machine-drafted, needs native review |
| `loadFailed` | so | The reports couldn't be loaded. Please try again. | Warbixinnada lama soo rari karin. Fadlan mar kale isku day. | 2026-11-15 | machine-drafted, needs native review |
| `errorGeneric` | so | An error occurred | Khalad ayaa dhacay | 2026-11-15 | machine-drafted, needs native review |
| `emptyTitle` | so | No open reports | Ma jiraan warbixino furan | 2026-11-15 | machine-drafted, needs native review |
| `emptyBody` | so | There are no content reports awaiting review. | Ma jiraan warbixino ku saabsan nuxur oo sugaya dib-u-eegis. | 2026-11-15 | machine-drafted, needs native review |
| `reportDetails` | so | Report details | Faahfaahinta warbixinnada | 2026-11-15 | machine-drafted, needs native review |
| `authorLabel` | so | Author: | Qoraaga: | 2026-11-15 | machine-drafted, needs native review |
| `viewPost` | so | View post | Eeg qoraalka | 2026-11-15 | machine-drafted, needs native review |
| `actionRemove` | so | Remove Post | Ka saar qoraalka | 2026-11-15 | machine-drafted, needs native review |
| `actionHold` | so | Hold for Review | Hay si dib loo eego | 2026-11-15 | machine-drafted, needs native review |
| `actionAuthorize` | so | Authorize Post | Oggolow qoraalka | 2026-11-15 | machine-drafted, needs native review |
| `actionDismiss` | so | Dismiss | Iska dhaaf | 2026-11-15 | machine-drafted, needs native review |
| `ownPostNote` | so | This is your own post: another moderator reviews its reports. | Kani waa qoraalkaaga: maamule kale ayaa eegaya warbixinnadiisa. | 2026-11-15 | machine-drafted, needs native review |
| `heldTitle` | so | Removed & Held Posts | Qoraallada la saaray iyo kuwa la hayo | 2026-11-15 | machine-drafted, needs native review |
| `heldEmpty` | so | No removed or held posts. | Ma jiraan qoraallo la saaray ama la hayo. | 2026-11-15 | machine-drafted, needs native review |
| `statusVisible` | so | Visible to members | Xubnuhu way arki karaan | 2026-11-15 | machine-drafted, needs native review |
| `statusRemoved` | so | Removed | La saaray | 2026-11-15 | machine-drafted, needs native review |
| `statusHeld` | so | Held for review | Loo hayo dib-u-eegis | 2026-11-15 | machine-drafted, needs native review |
| `statusHidden` | so | Hidden from members | Xubnaha laga qariyay | 2026-11-15 | machine-drafted, needs native review |
| `statusLine` | so | Status: {status}. | Xaaladda: {status}. | 2026-11-15 | machine-drafted, needs native review |
| `doneRemove` | so | Post removed. | Qoraalka waa la saaray. | 2026-11-15 | machine-drafted, needs native review |
| `doneHold` | so | Post held for review. | Qoraalka waa la hayaa si dib loo eego. | 2026-11-15 | machine-drafted, needs native review |
| `doneAuthorize` | so | Post authorized. | Qoraalka waa la oggolaaday. | 2026-11-15 | machine-drafted, needs native review |
| `doneDismiss` | so | Report dismissed. | Warbixinta waa la iska dhaafay. | 2026-11-15 | machine-drafted, needs native review |
| `focusTitle` | so | Linked post | Qoraalka la xiriiriyay | 2026-11-15 | machine-drafted, needs native review |
| `focusClose` | so | Close linked post | Xir qoraalka la xiriiriyay | 2026-11-15 | machine-drafted, needs native review |
| `focusLoading` | so | Loading the linked post… | Qoraalka la xiriiriyay waa la soo rarayaa… | 2026-11-15 | machine-drafted, needs native review |
| `focusNotFound` | so | This post was not found. It may have been deleted. | Qoraalkan lama helin. Waxaa laga yaabaa in la tirtiray. | 2026-11-15 | machine-drafted, needs native review |
| `focusError` | so | The linked post could not be loaded. The reports queue below still works. | Qoraalka la xiriiriyay lama soo rari karin. Safka warbixinnada ee hoose wali wuu shaqeynayaa. | 2026-11-15 | machine-drafted, needs native review |
| `failConflict` | so | The author changed this post since you opened it. The latest version is shown — review it and choose again. | Qoraaguhu wuu beddelay qoraalkan tan iyo markii aad furtay. Nuqulka ugu dambeeyay ayaa la muujiyay — dib u eeg oo mar kale dooro. | 2026-11-15 | machine-drafted, needs native review |
| `failSelf` | so | You can't moderate your own content — another moderator needs to review it. | Ma maamuli kartid nuxurkaaga — maamule kale ayaa dib u eegi doona. | 2026-11-15 | machine-drafted, needs native review |
| `failGone` | so | This post is gone — its author deleted it. Nothing was changed. | Qoraalkan ma jiro — qoraagiisa ayaa tirtiray. Waxba lama beddelin. | 2026-11-15 | machine-drafted, needs native review |
| `insightsTitle` | so | Community Insights | Aragtiyada bulshada | 2026-11-15 | machine-drafted, needs native review |
| `insightsAnalyzing` | so | Analyzing… | Waa la falanqeynayaa… | 2026-11-15 | machine-drafted, needs native review |
| `insightsRefresh` | so | Refresh | Cusboonaysii | 2026-11-15 | machine-drafted, needs native review |
| `insightsGenerate` | so | Generate Insights | Samee aragtiyo | 2026-11-15 | machine-drafted, needs native review |
| `insightsSuppressed` | so | AI insights available once community reaches sufficient volume (k≥20 per category). | Aragtiyada AI waxay diyaar noqonayaan marka bulshadu gaarto tiro ku filan (k≥20 qayb kasta). | 2026-11-15 | machine-drafted, needs native review |
| `insightsHint` | so | Click "{button}" to analyze community posts from the last 30 days. | Guji "{button}" si aad u falanqeyso qoraallada bulshada 30-kii maalmood ee la soo dhaafay. | 2026-11-15 | machine-drafted, needs native review |
| `insightsUpdated` | so | Last updated: {time} | Markii ugu dambaysay ee la cusboonaysiiyay: {time} | 2026-11-15 | machine-drafted, needs native review |
| `insightsFailed` | so | The insights couldn't be generated. Please try again. | Aragtiyada lama samayn karin. Fadlan mar kale isku day. | 2026-11-15 | machine-drafted, needs native review |
| `errorTitle` | so | Something went wrong | Wax ayaa qaldamay | 2026-11-15 | machine-drafted, needs native review |
| `errorBody` | so | This admin page hit an unexpected error. Please try again, or use the link at the top of the page to return to the feed. | Boggan maamulka wuxuu la kulmay khalad lama filaan ah. Fadlan mar kale isku day, ama isticmaal xiriirka sare ee bogga si aad ugu laabato quudinta. | 2026-11-15 | machine-drafted, needs native review |
| `errorRef` | so | ref: {digest} | tixraac: {digest} | 2026-11-15 | machine-drafted, needs native review |
| `notFoundTitle` | so | Page not found | Bogga lama helin | 2026-11-15 | machine-drafted, needs native review |
| `notFoundBody` | so | This admin page doesn’t exist, or you don’t have access to it. Use the link at the top of the page to return to the feed. | Boggan maamulka ma jiro, ama ma haysatid gelitaan. Isticmaal xiriirka sare ee bogga si aad ugu laabato quudinta. | 2026-11-15 | machine-drafted, needs native review |
| `subtabReports` | am | Reports | ሪፖርቶች | 2026-11-15 | machine-drafted, needs native review |
| `subtabSafety` | am | Safety Alerts | የደህንነት ማንቂያዎች | 2026-11-15 | machine-drafted, needs native review |
| `loadingReports` | am | Loading reports… | ሪፖርቶች በመጫን ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `loadFailed` | am | The reports couldn't be loaded. Please try again. | ሪፖርቶቹን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `errorGeneric` | am | An error occurred | ስህተት ተከስቷል | 2026-11-15 | machine-drafted, needs native review |
| `emptyTitle` | am | No open reports | ክፍት ሪፖርቶች የሉም | 2026-11-15 | machine-drafted, needs native review |
| `emptyBody` | am | There are no content reports awaiting review. | ግምገማ የሚጠብቁ የይዘት ሪፖርቶች የሉም። | 2026-11-15 | machine-drafted, needs native review |
| `reportDetails` | am | Report details | የሪፖርት ዝርዝሮች | 2026-11-15 | machine-drafted, needs native review |
| `authorLabel` | am | Author: | ጸሐፊ፦ | 2026-11-15 | machine-drafted, needs native review |
| `viewPost` | am | View post | ልጥፉን ይመልከቱ | 2026-11-15 | machine-drafted, needs native review |
| `actionRemove` | am | Remove Post | ልጥፉን አስወግድ | 2026-11-15 | machine-drafted, needs native review |
| `actionHold` | am | Hold for Review | ለግምገማ ያዝ | 2026-11-15 | machine-drafted, needs native review |
| `actionAuthorize` | am | Authorize Post | ልጥፉን ፍቀድ | 2026-11-15 | machine-drafted, needs native review |
| `actionDismiss` | am | Dismiss | አሰናብት | 2026-11-15 | machine-drafted, needs native review |
| `ownPostNote` | am | This is your own post: another moderator reviews its reports. | ይህ የራስዎ ልጥፍ ነው፦ ሪፖርቶቹን ሌላ አወያይ ይገመግማል። | 2026-11-15 | machine-drafted, needs native review |
| `heldTitle` | am | Removed & Held Posts | የተወገዱ እና የተያዙ ልጥፎች | 2026-11-15 | machine-drafted, needs native review |
| `heldEmpty` | am | No removed or held posts. | የተወገዱ ወይም የተያዙ ልጥፎች የሉም። | 2026-11-15 | machine-drafted, needs native review |
| `statusVisible` | am | Visible to members | ለአባላት ይታያል | 2026-11-15 | machine-drafted, needs native review |
| `statusRemoved` | am | Removed | ተወግዷል | 2026-11-15 | machine-drafted, needs native review |
| `statusHeld` | am | Held for review | ለግምገማ ተይዟል | 2026-11-15 | machine-drafted, needs native review |
| `statusHidden` | am | Hidden from members | ከአባላት ተደብቋል | 2026-11-15 | machine-drafted, needs native review |
| `statusLine` | am | Status: {status}. | ሁኔታ፦ {status}። | 2026-11-15 | machine-drafted, needs native review |
| `doneRemove` | am | Post removed. | ልጥፉ ተወግዷል። | 2026-11-15 | machine-drafted, needs native review |
| `doneHold` | am | Post held for review. | ልጥፉ ለግምገማ ተይዟል። | 2026-11-15 | machine-drafted, needs native review |
| `doneAuthorize` | am | Post authorized. | ልጥፉ ተፈቅዷል። | 2026-11-15 | machine-drafted, needs native review |
| `doneDismiss` | am | Report dismissed. | ሪፖርቱ ተሰናብቷል። | 2026-11-15 | machine-drafted, needs native review |
| `focusTitle` | am | Linked post | የተገናኘ ልጥፍ | 2026-11-15 | machine-drafted, needs native review |
| `focusClose` | am | Close linked post | የተገናኘውን ልጥፍ ዝጋ | 2026-11-15 | machine-drafted, needs native review |
| `focusLoading` | am | Loading the linked post… | የተገናኘው ልጥፍ በመጫን ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `focusNotFound` | am | This post was not found. It may have been deleted. | ይህ ልጥፍ አልተገኘም። ተሰርዞ ሊሆን ይችላል። | 2026-11-15 | machine-drafted, needs native review |
| `focusError` | am | The linked post could not be loaded. The reports queue below still works. | የተገናኘውን ልጥፍ መጫን አልተቻለም። ከታች ያለው የሪፖርቶች ዝርዝር አሁንም ይሰራል። | 2026-11-15 | machine-drafted, needs native review |
| `failConflict` | am | The author changed this post since you opened it. The latest version is shown — review it and choose again. | ከከፈቱት በኋላ ጸሐፊው ይህን ልጥፍ ቀይሮታል። የቅርብ ጊዜው ስሪት ይታያል — ይገምግሙት እና እንደገና ይምረጡ። | 2026-11-15 | machine-drafted, needs native review |
| `failSelf` | am | You can't moderate your own content — another moderator needs to review it. | የራስዎን ይዘት ማወያየት አይችሉም — ሌላ አወያይ ሊገመግመው ይገባል። | 2026-11-15 | machine-drafted, needs native review |
| `failGone` | am | This post is gone — its author deleted it. Nothing was changed. | ይህ ልጥፍ የለም — ጸሐፊው ሰርዞታል። ምንም አልተቀየረም። | 2026-11-15 | machine-drafted, needs native review |
| `insightsTitle` | am | Community Insights | የማህበረሰብ ግንዛቤዎች | 2026-11-15 | machine-drafted, needs native review |
| `insightsAnalyzing` | am | Analyzing… | በመተንተን ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `insightsRefresh` | am | Refresh | አድስ | 2026-11-15 | machine-drafted, needs native review |
| `insightsGenerate` | am | Generate Insights | ግንዛቤዎችን ፍጠር | 2026-11-15 | machine-drafted, needs native review |
| `insightsSuppressed` | am | AI insights available once community reaches sufficient volume (k≥20 per category). | ማህበረሰቡ በቂ መጠን ሲደርስ (በእያንዳንዱ ምድብ k≥20) የAI ግንዛቤዎች ይገኛሉ። | 2026-11-15 | machine-drafted, needs native review |
| `insightsHint` | am | Click "{button}" to analyze community posts from the last 30 days. | ያለፉትን 30 ቀናት የማህበረሰብ ልጥፎች ለመተንተን "{button}"ን ጠቅ ያድርጉ። | 2026-11-15 | machine-drafted, needs native review |
| `insightsUpdated` | am | Last updated: {time} | ለመጨረሻ ጊዜ የተዘመነው፦ {time} | 2026-11-15 | machine-drafted, needs native review |
| `insightsFailed` | am | The insights couldn't be generated. Please try again. | ግንዛቤዎቹን መፍጠር አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `errorTitle` | am | Something went wrong | የሆነ ችግር ተፈጥሯል | 2026-11-15 | machine-drafted, needs native review |
| `errorBody` | am | This admin page hit an unexpected error. Please try again, or use the link at the top of the page to return to the feed. | ይህ የአስተዳዳሪ ገጽ ያልተጠበቀ ስህተት አጋጥሞታል። እባክዎ እንደገና ይሞክሩ፣ ወይም ወደ ምግቡ ለመመለስ በገጹ አናት ያለውን አገናኝ ይጠቀሙ። | 2026-11-15 | machine-drafted, needs native review |
| `errorRef` | am | ref: {digest} | ማጣቀሻ፦ {digest} | 2026-11-15 | machine-drafted, needs native review |
| `notFoundTitle` | am | Page not found | ገጹ አልተገኘም | 2026-11-15 | machine-drafted, needs native review |
| `notFoundBody` | am | This admin page doesn’t exist, or you don’t have access to it. Use the link at the top of the page to return to the feed. | ይህ የአስተዳዳሪ ገጽ የለም፣ ወይም የመድረስ ፈቃድ የለዎትም። ወደ ምግቡ ለመመለስ በገጹ አናት ያለውን አገናኝ ይጠቀሙ። | 2026-11-15 | machine-drafted, needs native review |
| `subtabReports` | hmn | Reports | Cov kev tshaj qhia | 2026-11-15 | machine-drafted, needs native review |
| `subtabSafety` | hmn | Safety Alerts | Cov lus ceeb toom kev nyab xeeb | 2026-11-15 | machine-drafted, needs native review |
| `loadingReports` | hmn | Loading reports… | Tab tom thauj cov kev tshaj qhia… | 2026-11-15 | machine-drafted, needs native review |
| `loadFailed` | hmn | The reports couldn't be loaded. Please try again. | Thauj tsis tau cov kev tshaj qhia. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `errorGeneric` | hmn | An error occurred | Muaj ib qho yuam kev tshwm sim | 2026-11-15 | machine-drafted, needs native review |
| `emptyTitle` | hmn | No open reports | Tsis muaj kev tshaj qhia qhib | 2026-11-15 | machine-drafted, needs native review |
| `emptyBody` | hmn | There are no content reports awaiting review. | Tsis muaj kev tshaj qhia txog cov ntsiab lus tos kev tshuaj xyuas. | 2026-11-15 | machine-drafted, needs native review |
| `reportDetails` | hmn | Report details | Cov ntsiab lus ntawm kev tshaj qhia | 2026-11-15 | machine-drafted, needs native review |
| `authorLabel` | hmn | Author: | Tus sau: | 2026-11-15 | machine-drafted, needs native review |
| `viewPost` | hmn | View post | Saib qhov tshaj tawm | 2026-11-15 | machine-drafted, needs native review |
| `actionRemove` | hmn | Remove Post | Tshem qhov tshaj tawm | 2026-11-15 | machine-drafted, needs native review |
| `actionHold` | hmn | Hold for Review | Tuav cia tos tshuaj xyuas | 2026-11-15 | machine-drafted, needs native review |
| `actionAuthorize` | hmn | Authorize Post | Tso cai rau qhov tshaj tawm | 2026-11-15 | machine-drafted, needs native review |
| `actionDismiss` | hmn | Dismiss | Tsis quav ntsej | 2026-11-15 | machine-drafted, needs native review |
| `ownPostNote` | hmn | This is your own post: another moderator reviews its reports. | No yog koj qhov tshaj tawm: lwm tus neeg saib xyuas yuav tshuaj xyuas nws cov kev tshaj qhia. | 2026-11-15 | machine-drafted, needs native review |
| `heldTitle` | hmn | Removed & Held Posts | Cov tshaj tawm raug tshem thiab raug tuav cia | 2026-11-15 | machine-drafted, needs native review |
| `heldEmpty` | hmn | No removed or held posts. | Tsis muaj tshaj tawm raug tshem lossis raug tuav cia. | 2026-11-15 | machine-drafted, needs native review |
| `statusVisible` | hmn | Visible to members | Cov tswv cuab pom tau | 2026-11-15 | machine-drafted, needs native review |
| `statusRemoved` | hmn | Removed | Raug tshem | 2026-11-15 | machine-drafted, needs native review |
| `statusHeld` | hmn | Held for review | Raug tuav cia tos tshuaj xyuas | 2026-11-15 | machine-drafted, needs native review |
| `statusHidden` | hmn | Hidden from members | Zais ntawm cov tswv cuab | 2026-11-15 | machine-drafted, needs native review |
| `statusLine` | hmn | Status: {status}. | Xwm txheej: {status}. | 2026-11-15 | machine-drafted, needs native review |
| `doneRemove` | hmn | Post removed. | Tshem qhov tshaj tawm lawm. | 2026-11-15 | machine-drafted, needs native review |
| `doneHold` | hmn | Post held for review. | Tuav qhov tshaj tawm cia tos tshuaj xyuas lawm. | 2026-11-15 | machine-drafted, needs native review |
| `doneAuthorize` | hmn | Post authorized. | Tso cai rau qhov tshaj tawm lawm. | 2026-11-15 | machine-drafted, needs native review |
| `doneDismiss` | hmn | Report dismissed. | Tsis quav ntsej qhov kev tshaj qhia lawm. | 2026-11-15 | machine-drafted, needs native review |
| `focusTitle` | hmn | Linked post | Qhov tshaj tawm uas txuas los | 2026-11-15 | machine-drafted, needs native review |
| `focusClose` | hmn | Close linked post | Kaw qhov tshaj tawm uas txuas los | 2026-11-15 | machine-drafted, needs native review |
| `focusLoading` | hmn | Loading the linked post… | Tab tom thauj qhov tshaj tawm uas txuas los… | 2026-11-15 | machine-drafted, needs native review |
| `focusNotFound` | hmn | This post was not found. It may have been deleted. | Nrhiav tsis tau qhov tshaj tawm no. Tej zaum nws raug rho tawm lawm. | 2026-11-15 | machine-drafted, needs native review |
| `focusError` | hmn | The linked post could not be loaded. The reports queue below still works. | Thauj tsis tau qhov tshaj tawm uas txuas los. Daim ntawv kev tshaj qhia hauv qab no tseem siv tau. | 2026-11-15 | machine-drafted, needs native review |
| `failConflict` | hmn | The author changed this post since you opened it. The latest version is shown — review it and choose again. | Tus sau tau hloov qhov tshaj tawm no txij thaum koj qhib nws. Pom qhov tshiab tshaj lawm — tshuaj xyuas thiab xaiv dua. | 2026-11-15 | machine-drafted, needs native review |
| `failSelf` | hmn | You can't moderate your own content — another moderator needs to review it. | Koj saib xyuas tsis tau koj cov ntsiab lus — yuav tsum yog lwm tus neeg saib xyuas tshuaj xyuas. | 2026-11-15 | machine-drafted, needs native review |
| `failGone` | hmn | This post is gone — its author deleted it. Nothing was changed. | Qhov tshaj tawm no tsis muaj lawm — tus sau tau rho tawm. Tsis tau hloov dab tsi. | 2026-11-15 | machine-drafted, needs native review |
| `insightsTitle` | hmn | Community Insights | Kev nkag siab txog zej zog | 2026-11-15 | machine-drafted, needs native review |
| `insightsAnalyzing` | hmn | Analyzing… | Tab tom tshuaj xyuas… | 2026-11-15 | machine-drafted, needs native review |
| `insightsRefresh` | hmn | Refresh | Rov thauj dua | 2026-11-15 | machine-drafted, needs native review |
| `insightsGenerate` | hmn | Generate Insights | Tsim kev nkag siab | 2026-11-15 | machine-drafted, needs native review |
| `insightsSuppressed` | hmn | AI insights available once community reaches sufficient volume (k≥20 per category). | Kev nkag siab los ntawm AI yuav muaj thaum zej zog muaj txaus (k≥20 rau txhua pawg). | 2026-11-15 | machine-drafted, needs native review |
| `insightsHint` | hmn | Click "{button}" to analyze community posts from the last 30 days. | Nias "{button}" los tshuaj xyuas cov tshaj tawm hauv zej zog hauv 30 hnub dhau los. | 2026-11-15 | machine-drafted, needs native review |
| `insightsUpdated` | hmn | Last updated: {time} | Hloov kawg: {time} | 2026-11-15 | machine-drafted, needs native review |
| `insightsFailed` | hmn | The insights couldn't be generated. Please try again. | Tsim tsis tau kev nkag siab. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `errorTitle` | hmn | Something went wrong | Muaj teeb meem tshwm sim | 2026-11-15 | machine-drafted, needs native review |
| `errorBody` | hmn | This admin page hit an unexpected error. Please try again, or use the link at the top of the page to return to the feed. | Nplooj ntawv tswj hwm no muaj ib qho yuam kev tsis tau xav txog. Thov sim dua, lossis siv qhov txuas saum nplooj ntawv rov qab mus rau feed. | 2026-11-15 | machine-drafted, needs native review |
| `errorRef` | hmn | ref: {digest} | tus lej siv: {digest} | 2026-11-15 | machine-drafted, needs native review |
| `notFoundTitle` | hmn | Page not found | Nrhiav tsis tau nplooj ntawv | 2026-11-15 | machine-drafted, needs native review |
| `notFoundBody` | hmn | This admin page doesn’t exist, or you don’t have access to it. Use the link at the top of the page to return to the feed. | Nplooj ntawv tswj hwm no tsis muaj, lossis koj tsis muaj cai nkag. Siv qhov txuas saum nplooj ntawv rov qab mus rau feed. | 2026-11-15 | machine-drafted, needs native review |
| `POSTS_WITH_REPORTS.other` | ht | {n} posts with open reports | {n} piblikasyon ki gen rapò louvri | 2026-11-15 | machine-drafted, needs native review |
| `POSTS_WITH_REPORTS.other` | so | {n} posts with open reports | {n} qoraal oo leh warbixino furan | 2026-11-15 | machine-drafted, needs native review |
| `POSTS_WITH_REPORTS.one` | am | {n} post with open reports | {n} ክፍት ሪፖርት ያለው ልጥፍ | 2026-11-15 | machine-drafted, needs native review |
| `POSTS_WITH_REPORTS.other` | am | {n} posts with open reports | {n} ክፍት ሪፖርቶች ያሏቸው ልጥፎች | 2026-11-15 | machine-drafted, needs native review |
| `POSTS_WITH_REPORTS.other` | hmn | {n} posts with open reports | {n} qhov tshaj tawm uas muaj kev tshaj qhia qhib | 2026-11-15 | machine-drafted, needs native review |
| `REPORT_COUNT.other` | ht | {n} reports | {n} rapò | 2026-11-15 | machine-drafted, needs native review |
| `REPORT_COUNT.other` | so | {n} reports | {n} warbixin | 2026-11-15 | machine-drafted, needs native review |
| `REPORT_COUNT.one` | am | {n} report | {n} ሪፖርት | 2026-11-15 | machine-drafted, needs native review |
| `REPORT_COUNT.other` | am | {n} reports | {n} ሪፖርቶች | 2026-11-15 | machine-drafted, needs native review |
| `REPORT_COUNT.other` | hmn | {n} reports | {n} qhov kev tshaj qhia | 2026-11-15 | machine-drafted, needs native review |
| `THEME_POSTS.other` | ht | {n} posts | {n} piblikasyon | 2026-11-15 | machine-drafted, needs native review |
| `THEME_POSTS.other` | so | {n} posts | {n} qoraal | 2026-11-15 | machine-drafted, needs native review |
| `THEME_POSTS.one` | am | {n} post | {n} ልጥፍ | 2026-11-15 | machine-drafted, needs native review |
| `THEME_POSTS.other` | am | {n} posts | {n} ልጥፎች | 2026-11-15 | machine-drafted, needs native review |
| `THEME_POSTS.other` | hmn | {n} posts | {n} qhov tshaj tawm | 2026-11-15 | machine-drafted, needs native review |

### `lib/i18n-admin-people.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `loadFailed` | ht | Couldn't load people — please retry. | Nou pa t ka chaje moun yo — tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `tierUpdated` | ht | Tier updated. | Nivo a mete ajou. | 2026-11-15 | machine-drafted, needs native review |
| `changeFailed` | ht | The tier change failed — please retry. | Chanjman nivo a echwe — tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `deniedCode` | ht | Denied ({code}). | Refize ({code}). | 2026-11-15 | machine-drafted, needs native review |
| `denySelf` | ht | You cannot change your own tier. | Ou pa ka chanje pwòp nivo pa w. | 2026-11-15 | machine-drafted, needs native review |
| `denyFounderOnly` | ht | Only the founder can grant or revoke the Admin tier. | Se sèlman fondatè a ki ka bay oswa retire nivo Admin an. | 2026-11-15 | machine-drafted, needs native review |
| `denyInsufficientTier` | ht | Your tier cannot grant that tier. | Nivo pa w la pa ka bay nivo sa a. | 2026-11-15 | machine-drafted, needs native review |
| `denyNoChange` | ht | That person already holds this tier. | Moun sa a gen nivo sa a deja. | 2026-11-15 | machine-drafted, needs native review |
| `denyTargetInvalid` | ht | That account cannot receive a tier. | Kont sa a pa ka resevwa yon nivo. | 2026-11-15 | machine-drafted, needs native review |
| `denyAuth` | ht | Sign in to manage tiers. | Konekte pou jere nivo yo. | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | ht | Search name or username | Chèche non oswa non itilizatè | 2026-11-15 | machine-drafted, needs native review |
| `search` | ht | Search | Chèche | 2026-11-15 | machine-drafted, needs native review |
| `loading` | ht | Loading people… | N ap chaje moun yo… | 2026-11-15 | machine-drafted, needs native review |
| `empty` | ht | No people found. | Nou pa jwenn okenn moun. | 2026-11-15 | machine-drafted, needs native review |
| `colPerson` | ht | Person | Moun | 2026-11-15 | machine-drafted, needs native review |
| `colTier` | ht | Tier | Nivo | 2026-11-15 | machine-drafted, needs native review |
| `colSetTier` | ht | Set tier | Mete nivo | 2026-11-15 | machine-drafted, needs native review |
| `noName` | ht | No name | Pa gen non | 2026-11-15 | machine-drafted, needs native review |
| `noActions` | ht | No actions | Pa gen aksyon | 2026-11-15 | machine-drafted, needs native review |
| `setTierFor` | ht | Set tier: {name} | Mete nivo: {name} | 2026-11-15 | machine-drafted, needs native review |
| `change` | ht | Change… | Chanje… | 2026-11-15 | machine-drafted, needs native review |
| `makeTier` | ht | Make {tier} | Fè l {tier} | 2026-11-15 | machine-drafted, needs native review |
| `revokeTier` | ht | Revoke tier | Retire nivo a | 2026-11-15 | machine-drafted, needs native review |
| `grantTo` | ht | Grant {tier} to {name}. | Bay {name} nivo {tier}. | 2026-11-15 | machine-drafted, needs native review |
| `revokeFrom` | ht | Revoke the tier from {name}. | Retire nivo a nan men {name}. | 2026-11-15 | machine-drafted, needs native review |
| `reasonRequired` | ht | A reason is required and is recorded in the admin action log. | Yon rezon obligatwa, epi li anrejistre nan jounal aksyon administrasyon an. | 2026-11-15 | machine-drafted, needs native review |
| `thisPerson` | ht | this person | moun sa a | 2026-11-15 | machine-drafted, needs native review |
| `reasonLabel` | ht | Reason (required) | Rezon (obligatwa) | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | ht | Cancel | Anile | 2026-11-15 | machine-drafted, needs native review |
| `apply` | ht | Apply | Aplike | 2026-11-15 | machine-drafted, needs native review |
| `applying` | ht | Applying… | N ap aplike… | 2026-11-15 | machine-drafted, needs native review |
| `close` | ht | Close | Fèmen | 2026-11-15 | machine-drafted, needs native review |
| `loadFailed` | so | Couldn't load people — please retry. | Dadka lama soo rari karin — fadlan mar kale isku day. | 2026-11-15 | machine-drafted, needs native review |
| `tierUpdated` | so | Tier updated. | Heerka waa la cusboonaysiiyay. | 2026-11-15 | machine-drafted, needs native review |
| `changeFailed` | so | The tier change failed — please retry. | Beddelka heerka wuu fashilmay — fadlan mar kale isku day. | 2026-11-15 | machine-drafted, needs native review |
| `deniedCode` | so | Denied ({code}). | Waa la diiday ({code}). | 2026-11-15 | machine-drafted, needs native review |
| `denySelf` | so | You cannot change your own tier. | Ma beddeli kartid heerkaaga. | 2026-11-15 | machine-drafted, needs native review |
| `denyFounderOnly` | so | Only the founder can grant or revoke the Admin tier. | Aasaasaha oo keliya ayaa bixin kara ama ka qaadi kara heerka Maamule sare. | 2026-11-15 | machine-drafted, needs native review |
| `denyInsufficientTier` | so | Your tier cannot grant that tier. | Heerkaagu ma bixin karo heerkaas. | 2026-11-15 | machine-drafted, needs native review |
| `denyNoChange` | so | That person already holds this tier. | Qofkaasi horey ayuu u haystaa heerkan. | 2026-11-15 | machine-drafted, needs native review |
| `denyTargetInvalid` | so | That account cannot receive a tier. | Akoonkaas ma heli karo heer. | 2026-11-15 | machine-drafted, needs native review |
| `denyAuth` | so | Sign in to manage tiers. | Gal si aad u maamusho heerarka. | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | so | Search name or username | Raadi magac ama magaca isticmaalaha | 2026-11-15 | machine-drafted, needs native review |
| `search` | so | Search | Raadi | 2026-11-15 | machine-drafted, needs native review |
| `loading` | so | Loading people… | Dadka waa la soo rarayaa… | 2026-11-15 | machine-drafted, needs native review |
| `empty` | so | No people found. | Dad lama helin. | 2026-11-15 | machine-drafted, needs native review |
| `colPerson` | so | Person | Qofka | 2026-11-15 | machine-drafted, needs native review |
| `colTier` | so | Tier | Heerka | 2026-11-15 | machine-drafted, needs native review |
| `colSetTier` | so | Set tier | Deji heerka | 2026-11-15 | machine-drafted, needs native review |
| `noName` | so | No name | Magac ma leh | 2026-11-15 | machine-drafted, needs native review |
| `noActions` | so | No actions | Fal ma jiro | 2026-11-15 | machine-drafted, needs native review |
| `setTierFor` | so | Set tier: {name} | Deji heerka: {name} | 2026-11-15 | machine-drafted, needs native review |
| `change` | so | Change… | Beddel… | 2026-11-15 | machine-drafted, needs native review |
| `makeTier` | so | Make {tier} | Ka dhig {tier} | 2026-11-15 | machine-drafted, needs native review |
| `revokeTier` | so | Revoke tier | Ka qaad heerka | 2026-11-15 | machine-drafted, needs native review |
| `grantTo` | so | Grant {tier} to {name}. | Sii {name} heerka {tier}. | 2026-11-15 | machine-drafted, needs native review |
| `revokeFrom` | so | Revoke the tier from {name}. | Ka qaad heerka {name}. | 2026-11-15 | machine-drafted, needs native review |
| `reasonRequired` | so | A reason is required and is recorded in the admin action log. | Sabab waa lagama maarmaan, waxaana lagu diiwaangeliyaa diiwaanka falalka maamulka. | 2026-11-15 | machine-drafted, needs native review |
| `thisPerson` | so | this person | qofkan | 2026-11-15 | machine-drafted, needs native review |
| `reasonLabel` | so | Reason (required) | Sababta (waa qasab) | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | so | Cancel | Jooji | 2026-11-15 | machine-drafted, needs native review |
| `apply` | so | Apply | Codso | 2026-11-15 | machine-drafted, needs native review |
| `applying` | so | Applying… | Waa la codsanayaa… | 2026-11-15 | machine-drafted, needs native review |
| `close` | so | Close | Xir | 2026-11-15 | machine-drafted, needs native review |
| `loadFailed` | am | Couldn't load people — please retry. | ሰዎችን መጫን አልተቻለም — እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `tierUpdated` | am | Tier updated. | ደረጃው ተዘምኗል። | 2026-11-15 | machine-drafted, needs native review |
| `changeFailed` | am | The tier change failed — please retry. | የደረጃ ለውጡ አልተሳካም — እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `deniedCode` | am | Denied ({code}). | ተከልክሏል ({code})። | 2026-11-15 | machine-drafted, needs native review |
| `denySelf` | am | You cannot change your own tier. | የራስዎን ደረጃ መቀየር አይችሉም። | 2026-11-15 | machine-drafted, needs native review |
| `denyFounderOnly` | am | Only the founder can grant or revoke the Admin tier. | የአስተዳዳሪ ደረጃን መስጠት ወይም መሻር የሚችለው መስራቹ ብቻ ነው። | 2026-11-15 | machine-drafted, needs native review |
| `denyInsufficientTier` | am | Your tier cannot grant that tier. | ደረጃዎ ያንን ደረጃ መስጠት አይችልም። | 2026-11-15 | machine-drafted, needs native review |
| `denyNoChange` | am | That person already holds this tier. | ያ ሰው ይህ ደረጃ አለው። | 2026-11-15 | machine-drafted, needs native review |
| `denyTargetInvalid` | am | That account cannot receive a tier. | ያ መለያ ደረጃ መቀበል አይችልም። | 2026-11-15 | machine-drafted, needs native review |
| `denyAuth` | am | Sign in to manage tiers. | ደረጃዎችን ለማስተዳደር ይግቡ። | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | am | Search name or username | ስም ወይም የተጠቃሚ ስም ይፈልጉ | 2026-11-15 | machine-drafted, needs native review |
| `search` | am | Search | ፈልግ | 2026-11-15 | machine-drafted, needs native review |
| `loading` | am | Loading people… | ሰዎች በመጫን ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `empty` | am | No people found. | ምንም ሰው አልተገኘም። | 2026-11-15 | machine-drafted, needs native review |
| `colPerson` | am | Person | ሰው | 2026-11-15 | machine-drafted, needs native review |
| `colTier` | am | Tier | ደረጃ | 2026-11-15 | machine-drafted, needs native review |
| `colSetTier` | am | Set tier | ደረጃ አዘጋጅ | 2026-11-15 | machine-drafted, needs native review |
| `noName` | am | No name | ስም የለም | 2026-11-15 | machine-drafted, needs native review |
| `noActions` | am | No actions | ምንም እርምጃ የለም | 2026-11-15 | machine-drafted, needs native review |
| `setTierFor` | am | Set tier: {name} | ደረጃ አዘጋጅ፦ {name} | 2026-11-15 | machine-drafted, needs native review |
| `change` | am | Change… | ቀይር… | 2026-11-15 | machine-drafted, needs native review |
| `makeTier` | am | Make {tier} | {tier} አድርግ | 2026-11-15 | machine-drafted, needs native review |
| `revokeTier` | am | Revoke tier | ደረጃውን ሻር | 2026-11-15 | machine-drafted, needs native review |
| `grantTo` | am | Grant {tier} to {name}. | ለ{name} {tier} ስጥ። | 2026-11-15 | machine-drafted, needs native review |
| `revokeFrom` | am | Revoke the tier from {name}. | የ{name}ን ደረጃ ሻር። | 2026-11-15 | machine-drafted, needs native review |
| `reasonRequired` | am | A reason is required and is recorded in the admin action log. | ምክንያት ያስፈልጋል፣ በአስተዳዳሪ እርምጃዎች መዝገብ ውስጥም ይመዘገባል። | 2026-11-15 | machine-drafted, needs native review |
| `thisPerson` | am | this person | ይህ ሰው | 2026-11-15 | machine-drafted, needs native review |
| `reasonLabel` | am | Reason (required) | ምክንያት (ያስፈልጋል) | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | am | Cancel | ሰርዝ | 2026-11-15 | machine-drafted, needs native review |
| `apply` | am | Apply | ተግብር | 2026-11-15 | machine-drafted, needs native review |
| `applying` | am | Applying… | በመተግበር ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `close` | am | Close | ዝጋ | 2026-11-15 | machine-drafted, needs native review |
| `loadFailed` | hmn | Couldn't load people — please retry. | Thauj tsis tau cov neeg — thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `tierUpdated` | hmn | Tier updated. | Hloov qib lawm. | 2026-11-15 | machine-drafted, needs native review |
| `changeFailed` | hmn | The tier change failed — please retry. | Hloov qib tsis tau — thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `deniedCode` | hmn | Denied ({code}). | Raug tsis kam ({code}). | 2026-11-15 | machine-drafted, needs native review |
| `denySelf` | hmn | You cannot change your own tier. | Koj hloov tsis tau koj tus kheej qib. | 2026-11-15 | machine-drafted, needs native review |
| `denyFounderOnly` | hmn | Only the founder can grant or revoke the Admin tier. | Tsuas yog tus tsim thiaj muab lossis tshem tau qib Tus thawj saib xyuas. | 2026-11-15 | machine-drafted, needs native review |
| `denyInsufficientTier` | hmn | Your tier cannot grant that tier. | Koj qib muab tsis tau qib ntawd. | 2026-11-15 | machine-drafted, needs native review |
| `denyNoChange` | hmn | That person already holds this tier. | Tus neeg ntawd twb muaj qib no lawm. | 2026-11-15 | machine-drafted, needs native review |
| `denyTargetInvalid` | hmn | That account cannot receive a tier. | Tus account ntawd txais tsis tau qib. | 2026-11-15 | machine-drafted, needs native review |
| `denyAuth` | hmn | Sign in to manage tiers. | Nkag mus thiaj tswj tau cov qib. | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | hmn | Search name or username | Nrhiav lub npe lossis lub npe siv | 2026-11-15 | machine-drafted, needs native review |
| `search` | hmn | Search | Nrhiav | 2026-11-15 | machine-drafted, needs native review |
| `loading` | hmn | Loading people… | Tab tom thauj cov neeg… | 2026-11-15 | machine-drafted, needs native review |
| `empty` | hmn | No people found. | Nrhiav tsis tau leej twg. | 2026-11-15 | machine-drafted, needs native review |
| `colPerson` | hmn | Person | Tus neeg | 2026-11-15 | machine-drafted, needs native review |
| `colTier` | hmn | Tier | Qib | 2026-11-15 | machine-drafted, needs native review |
| `colSetTier` | hmn | Set tier | Teem qib | 2026-11-15 | machine-drafted, needs native review |
| `noName` | hmn | No name | Tsis muaj npe | 2026-11-15 | machine-drafted, needs native review |
| `noActions` | hmn | No actions | Tsis muaj kev ua | 2026-11-15 | machine-drafted, needs native review |
| `setTierFor` | hmn | Set tier: {name} | Teem qib: {name} | 2026-11-15 | machine-drafted, needs native review |
| `change` | hmn | Change… | Hloov… | 2026-11-15 | machine-drafted, needs native review |
| `makeTier` | hmn | Make {tier} | Ua {tier} | 2026-11-15 | machine-drafted, needs native review |
| `revokeTier` | hmn | Revoke tier | Tshem qib | 2026-11-15 | machine-drafted, needs native review |
| `grantTo` | hmn | Grant {tier} to {name}. | Muab {tier} rau {name}. | 2026-11-15 | machine-drafted, needs native review |
| `revokeFrom` | hmn | Revoke the tier from {name}. | Tshem qib ntawm {name}. | 2026-11-15 | machine-drafted, needs native review |
| `reasonRequired` | hmn | A reason is required and is recorded in the admin action log. | Yuav tsum muaj laj thawj, thiab nws raug sau tseg rau hauv cov ntaub ntawv kev ua ntawm tus tswj. | 2026-11-15 | machine-drafted, needs native review |
| `thisPerson` | hmn | this person | tus neeg no | 2026-11-15 | machine-drafted, needs native review |
| `reasonLabel` | hmn | Reason (required) | Laj thawj (yuav tsum muaj) | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | hmn | Cancel | Tso tseg | 2026-11-15 | machine-drafted, needs native review |
| `apply` | hmn | Apply | Siv | 2026-11-15 | machine-drafted, needs native review |
| `applying` | hmn | Applying… | Tab tom siv… | 2026-11-15 | machine-drafted, needs native review |
| `close` | hmn | Close | Kaw | 2026-11-15 | machine-drafted, needs native review |

### `lib/i18n-admin-petitions.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `heading` | ht | Petition signatures | Siyati petisyon yo | 2026-11-14 | machine-drafted, needs native review |
| `intro` | ht | Download the signatures of a petition as a CSV file for its organizer. | Telechaje siyati yon petisyon nan yon fichye CSV pou moun ki òganize li a. | 2026-11-14 | machine-drafted, needs native review |
| `columnsNote` | ht | The file lists each signer’s name, when they signed, the statement they agreed to and the petition version they signed. IP addresses and device details are left out. | Fichye a montre non chak moun ki siyen, ki lè yo siyen, deklarasyon yo te dakò a ak vèsyon petisyon yo te siyen an. Adrès IP ak detay aparèy yo pa ladan l. | 2026-11-14 | machine-drafted, needs native review |
| `lockNote` | ht | The first download locks the list: signers can no longer withdraw their signature from that petition. | Premye telechajman an bloke lis la: moun ki siyen yo pa ka retire siyati yo sou petisyon sa a ankò. | 2026-11-14 | machine-drafted, needs native review |
| `petitionLabel` | ht | Petition | Petisyon | 2026-11-14 | machine-drafted, needs native review |
| `alreadyLocked` | ht | Downloaded before — withdrawals are locked. | Yo te telechaje l deja — retrè yo bloke. | 2026-11-14 | machine-drafted, needs native review |
| `download` | ht | Download CSV | Telechaje CSV | 2026-11-14 | machine-drafted, needs native review |
| `downloading` | ht | Preparing CSV… | N ap prepare CSV a… | 2026-11-14 | machine-drafted, needs native review |
| `downloaded` | ht | Downloaded. Signatures in the file: {count} | Telechaje. Siyati nan fichye a: {count} | 2026-11-14 | machine-drafted, needs native review |
| `loading` | ht | Loading petitions… | N ap chaje petisyon yo… | 2026-11-14 | machine-drafted, needs native review |
| `none` | ht | No approved petitions yet. | Poko gen petisyon ki apwouve. | 2026-11-14 | machine-drafted, needs native review |
| `loadFailed` | ht | Petitions could not be loaded. Try again later. | Nou pa t ka chaje petisyon yo. Eseye ankò pita. | 2026-11-14 | machine-drafted, needs native review |
| `errForbidden` | ht | Only platform admins can download petition signatures. | Se sèlman administratè platfòm nan ki ka telechaje siyati petisyon yo. | 2026-11-14 | machine-drafted, needs native review |
| `errNotFound` | ht | This petition no longer exists or is not approved. | Petisyon sa a pa egziste ankò oswa li pa apwouve. | 2026-11-14 | machine-drafted, needs native review |
| `errIncomplete` | ht | Not every signature could be read, so no file was made. Try again. | Nou pa t ka li tout siyati yo, kidonk pa gen fichye ki fèt. Eseye ankò. | 2026-11-14 | machine-drafted, needs native review |
| `errGeneric` | ht | The download failed and no file was made. Try again. | Telechajman an echwe e pa gen fichye ki fèt. Eseye ankò. | 2026-11-14 | machine-drafted, needs native review |
| `heading` | so | Petition signatures | Saxiixyada codsiyada | 2026-11-14 | machine-drafted, needs native review |
| `intro` | so | Download the signatures of a petition as a CSV file for its organizer. | Soo deji saxiixyada codsi ahaan fayl CSV ah oo loogu talagalay qofka abaabulay. | 2026-11-14 | machine-drafted, needs native review |
| `columnsNote` | so | The file lists each signer’s name, when they signed, the statement they agreed to and the petition version they signed. IP addresses and device details are left out. | Faylku wuxuu taxayaa magaca qof kasta oo saxiixay, goorta uu saxiixay, bayaanka uu ku raacay iyo nooca codsiga uu saxiixay. Cinwaannada IP iyo faahfaahinta qalabka laguma darin. | 2026-11-14 | machine-drafted, needs native review |
| `lockNote` | so | The first download locks the list: signers can no longer withdraw their signature from that petition. | Soo dejinta ugu horreysa waxay xiraysaa liiska: saxiixayaashu mar dambe kama noqon karaan saxiixooda codsigaas. | 2026-11-14 | machine-drafted, needs native review |
| `petitionLabel` | so | Petition | Codsi | 2026-11-14 | machine-drafted, needs native review |
| `alreadyLocked` | so | Downloaded before — withdrawals are locked. | Hore ayaa loo soo dejiyay — ka noqoshada waa la xiray. | 2026-11-14 | machine-drafted, needs native review |
| `download` | so | Download CSV | Soo deji CSV | 2026-11-14 | machine-drafted, needs native review |
| `downloading` | so | Preparing CSV… | CSV waa la diyaarinayaa… | 2026-11-14 | machine-drafted, needs native review |
| `downloaded` | so | Downloaded. Signatures in the file: {count} | Waa la soo dejiyay. Saxiixyada faylka ku jira: {count} | 2026-11-14 | machine-drafted, needs native review |
| `loading` | so | Loading petitions… | Codsiyada waa la soo rarayaa… | 2026-11-14 | machine-drafted, needs native review |
| `none` | so | No approved petitions yet. | Weli ma jiraan codsiyo la ansixiyay. | 2026-11-14 | machine-drafted, needs native review |
| `loadFailed` | so | Petitions could not be loaded. Try again later. | Codsiyada lama soo rari karin. Mar dambe isku day. | 2026-11-14 | machine-drafted, needs native review |
| `errForbidden` | so | Only platform admins can download petition signatures. | Maamulayaasha madasha oo keliya ayaa soo dejin kara saxiixyada codsiyada. | 2026-11-14 | machine-drafted, needs native review |
| `errNotFound` | so | This petition no longer exists or is not approved. | Codsigan hadda ma jiro ama lama ansixin. | 2026-11-14 | machine-drafted, needs native review |
| `errIncomplete` | so | Not every signature could be read, so no file was made. Try again. | Dhammaan saxiixyada lama akhrin karin, sidaas darteed fayl lama samayn. Mar kale isku day. | 2026-11-14 | machine-drafted, needs native review |
| `errGeneric` | so | The download failed and no file was made. Try again. | Soo dejintu way guuldareysatay, fayl lama samayn. Mar kale isku day. | 2026-11-14 | machine-drafted, needs native review |
| `heading` | am | Petition signatures | የአቤቱታ ፊርማዎች | 2026-11-14 | machine-drafted, needs native review |
| `intro` | am | Download the signatures of a petition as a CSV file for its organizer. | የአንድን አቤቱታ ፊርማዎች ለአዘጋጁ በCSV ፋይል ያውርዱ። | 2026-11-14 | machine-drafted, needs native review |
| `columnsNote` | am | The file lists each signer’s name, when they signed, the statement they agreed to and the petition version they signed. IP addresses and device details are left out. | ፋይሉ የእያንዳንዱን ፈራሚ ስም፣ የፈረሙበትን ጊዜ፣ የተስማሙበትን መግለጫ እና የፈረሙትን የአቤቱታ ስሪት ይዘረዝራል። የIP አድራሻዎችና የመሣሪያ ዝርዝሮች አልተካተቱም። | 2026-11-14 | machine-drafted, needs native review |
| `lockNote` | am | The first download locks the list: signers can no longer withdraw their signature from that petition. | የመጀመሪያው ማውረድ ዝርዝሩን ይቆልፋል፤ ፈራሚዎች ከዚያ አቤቱታ ፊርማቸውን ማንሳት አይችሉም። | 2026-11-14 | machine-drafted, needs native review |
| `petitionLabel` | am | Petition | አቤቱታ | 2026-11-14 | machine-drafted, needs native review |
| `alreadyLocked` | am | Downloaded before — withdrawals are locked. | ቀደም ብሎ ወርዷል — ፊርማ ማንሳት ተቆልፏል። | 2026-11-14 | machine-drafted, needs native review |
| `download` | am | Download CSV | CSV አውርድ | 2026-11-14 | machine-drafted, needs native review |
| `downloading` | am | Preparing CSV… | CSV በመዘጋጀት ላይ… | 2026-11-14 | machine-drafted, needs native review |
| `downloaded` | am | Downloaded. Signatures in the file: {count} | ወርዷል። በፋይሉ ውስጥ ያሉ ፊርማዎች፦ {count} | 2026-11-14 | machine-drafted, needs native review |
| `loading` | am | Loading petitions… | አቤቱታዎች በመጫን ላይ… | 2026-11-14 | machine-drafted, needs native review |
| `none` | am | No approved petitions yet. | እስካሁን የጸደቀ አቤቱታ የለም። | 2026-11-14 | machine-drafted, needs native review |
| `loadFailed` | am | Petitions could not be loaded. Try again later. | አቤቱታዎቹን መጫን አልተቻለም። ቆይተው እንደገና ይሞክሩ። | 2026-11-14 | machine-drafted, needs native review |
| `errForbidden` | am | Only platform admins can download petition signatures. | የአቤቱታ ፊርማዎችን ማውረድ የሚችሉት የመድረኩ አስተዳዳሪዎች ብቻ ናቸው። | 2026-11-14 | machine-drafted, needs native review |
| `errNotFound` | am | This petition no longer exists or is not approved. | ይህ አቤቱታ ከእንግዲህ የለም ወይም አልጸደቀም። | 2026-11-14 | machine-drafted, needs native review |
| `errIncomplete` | am | Not every signature could be read, so no file was made. Try again. | ሁሉንም ፊርማዎች ማንበብ ስላልተቻለ ምንም ፋይል አልተሠራም። እንደገና ይሞክሩ። | 2026-11-14 | machine-drafted, needs native review |
| `errGeneric` | am | The download failed and no file was made. Try again. | ማውረዱ አልተሳካም፤ ምንም ፋይል አልተሠራም። እንደገና ይሞክሩ። | 2026-11-14 | machine-drafted, needs native review |
| `heading` | hmn | Petition signatures | Cov kos npe rau daim ntawv thov | 2026-11-14 | machine-drafted, needs native review |
| `intro` | hmn | Download the signatures of a petition as a CSV file for its organizer. | Rub cov kos npe ntawm ib daim ntawv thov los ua ib daim ntawv CSV rau tus neeg npaj. | 2026-11-14 | machine-drafted, needs native review |
| `columnsNote` | hmn | The file lists each signer’s name, when they signed, the statement they agreed to and the petition version they signed. IP addresses and device details are left out. | Daim ntawv no teev txhua tus neeg kos npe lub npe, lub sijhawm lawv kos npe, cov lus lawv pom zoo thiab daim ntawv thov version uas lawv kos npe. Tsis muaj IP address thiab cov ntsiab lus ntawm lub cuab yeej. | 2026-11-14 | machine-drafted, needs native review |
| `lockNote` | hmn | The first download locks the list: signers can no longer withdraw their signature from that petition. | Thawj zaug rub yuav xauv daim ntawv teev npe: cov neeg kos npe yuav rho tsis tau lawv kos npe ntawm daim ntawv thov ntawd lawm. | 2026-11-14 | machine-drafted, needs native review |
| `petitionLabel` | hmn | Petition | Daim ntawv thov | 2026-11-14 | machine-drafted, needs native review |
| `alreadyLocked` | hmn | Downloaded before — withdrawals are locked. | Tau rub dua lawm — kev rho kos npe raug xauv lawm. | 2026-11-14 | machine-drafted, needs native review |
| `download` | hmn | Download CSV | Rub CSV | 2026-11-14 | machine-drafted, needs native review |
| `downloading` | hmn | Preparing CSV… | Tab tom npaj CSV… | 2026-11-14 | machine-drafted, needs native review |
| `downloaded` | hmn | Downloaded. Signatures in the file: {count} | Rub tau lawm. Cov kos npe hauv daim ntawv: {count} | 2026-11-14 | machine-drafted, needs native review |
| `loading` | hmn | Loading petitions… | Tab tom thauj cov ntawv thov… | 2026-11-14 | machine-drafted, needs native review |
| `none` | hmn | No approved petitions yet. | Tseem tsis tau muaj daim ntawv thov uas tau pom zoo. | 2026-11-14 | machine-drafted, needs native review |
| `loadFailed` | hmn | Petitions could not be loaded. Try again later. | Thauj tsis tau cov ntawv thov. Thov rov sim dua tom qab. | 2026-11-14 | machine-drafted, needs native review |
| `errForbidden` | hmn | Only platform admins can download petition signatures. | Tsuas yog cov thawj tswj platform thiaj rub tau cov kos npe. | 2026-11-14 | machine-drafted, needs native review |
| `errNotFound` | hmn | This petition no longer exists or is not approved. | Daim ntawv thov no tsis muaj lawm los yog tsis tau pom zoo. | 2026-11-14 | machine-drafted, needs native review |
| `errIncomplete` | hmn | Not every signature could be read, so no file was made. Try again. | Nyeem tsis tau txhua tus kos npe, yog li tsis tau ua daim ntawv. Thov rov sim dua. | 2026-11-14 | machine-drafted, needs native review |
| `errGeneric` | hmn | The download failed and no file was made. Try again. | Rub tsis tau thiab tsis tau ua daim ntawv. Thov rov sim dua. | 2026-11-14 | machine-drafted, needs native review |

### `lib/i18n-admin-resources.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `discoverTitle` | ht | Discover Resources | Dekouvri resous | 2026-11-15 | machine-drafted, needs native review |
| `discoverIntro` | ht | Enter a natural-language query to source and stage new resources for review. | Ekri yon rechèch nan lang natirèl pou jwenn nouvo resous epi prepare yo pou revizyon. | 2026-11-15 | machine-drafted, needs native review |
| `nearLabel` | ht | Searching near | Ap chèche toupre | 2026-11-15 | machine-drafted, needs native review |
| `nearPlaceholder` | ht | e.g. Burlington, VT (defaults to your location) | egz. Burlington, VT (pa defo, kote ou ye a) | 2026-11-15 | machine-drafted, needs native review |
| `useMyLocation` | ht | Use my location | Sèvi ak kote m ye a | 2026-11-15 | machine-drafted, needs native review |
| `queryLabel` | ht | What to look for | Sa pou chèche | 2026-11-15 | machine-drafted, needs native review |
| `queryPlaceholder` | ht | e.g. "food banks in Burlington VT" or "SNAP application forms" | egz. "bank manje nan Burlington VT" oswa "fòm demann SNAP" | 2026-11-15 | machine-drafted, needs native review |
| `discover` | ht | Discover | Dekouvri | 2026-11-15 | machine-drafted, needs native review |
| `discovering` | ht | Discovering… | Ap dekouvri… | 2026-11-15 | machine-drafted, needs native review |
| `discoverTimeout` | ht | Discovery request timed out — check the queue for any staged items. | Rechèch la pran twòp tan — gade nan lis la si gen eleman ki prepare. | 2026-11-15 | machine-drafted, needs native review |
| `discoverFailed` | ht | Discovery failed. Try again. | Rechèch la echwe. Eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `discoverSummary` | ht | {staged} ({rejected}) | {staged} ({rejected}) | 2026-11-15 | machine-drafted, needs native review |
| `progressSearching` | ht | Searching sources… | Ap chèche sous… | 2026-11-15 | machine-drafted, needs native review |
| `progressVerifying` | ht | Verifying provenance… | Ap verifye orijin… | 2026-11-15 | machine-drafted, needs native review |
| `progressGeocoding` | ht | Geocoding addresses… | Ap jeokode adrès… | 2026-11-15 | machine-drafted, needs native review |
| `pendingTitle` | ht | Pending review | Ap tann revizyon | 2026-11-15 | machine-drafted, needs native review |
| `pendingTitleCount` | ht | Pending review ({count}) | Ap tann revizyon ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `filterLabel` | ht | Show | Montre | 2026-11-15 | machine-drafted, needs native review |
| `filterAll` | ht | All | Tout | 2026-11-15 | machine-drafted, needs native review |
| `typeResource` | ht | Resource | Resous | 2026-11-15 | machine-drafted, needs native review |
| `typeLink` | ht | Link | Lyen | 2026-11-15 | machine-drafted, needs native review |
| `typeForm` | ht | Form | Fòm | 2026-11-15 | machine-drafted, needs native review |
| `viewLabel` | ht | View | Afichaj | 2026-11-15 | machine-drafted, needs native review |
| `viewList` | ht | List | Lis | 2026-11-15 | machine-drafted, needs native review |
| `viewMap` | ht | Map | Kat | 2026-11-15 | machine-drafted, needs native review |
| `bulkApprove` | ht | Bulk approve high-confidence ({count}) | Apwouve tout sa ki gen gwo konfyans ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `confirm` | ht | Confirm | Konfime | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | ht | Cancel | Anile | 2026-11-15 | machine-drafted, needs native review |
| `tryAgain` | ht | Try again | Eseye ankò | 2026-11-15 | machine-drafted, needs native review |
| `queueLoadFailed` | ht | Could not load the review queue. | Nou pa t kapab chaje lis revizyon an. | 2026-11-15 | machine-drafted, needs native review |
| `approveFailed` | ht | Could not approve {name}. It is still in the queue. | Nou pa t kapab apwouve {name}. Li toujou nan lis la. | 2026-11-15 | machine-drafted, needs native review |
| `rejectFailed` | ht | Could not reject {name}. It is still in the queue. | Nou pa t kapab rejte {name}. Li toujou nan lis la. | 2026-11-15 | machine-drafted, needs native review |
| `emptyTitle` | ht | No pending items | Pa gen anyen k ap tann | 2026-11-15 | machine-drafted, needs native review |
| `emptyBody` | ht | Use the discovery input above to source new resources. | Sèvi ak rechèch anwo a pou jwenn nouvo resous. | 2026-11-15 | machine-drafted, needs native review |
| `confidenceHigh` | ht | High confidence | Gwo konfyans | 2026-11-15 | machine-drafted, needs native review |
| `confidenceMedium` | ht | Medium confidence | Konfyans mwayen | 2026-11-15 | machine-drafted, needs native review |
| `needsLocation` | ht | Needs location | Bezwen adrès | 2026-11-15 | machine-drafted, needs native review |
| `itemDetails` | ht | Details | Detay | 2026-11-15 | machine-drafted, needs native review |
| `provenanceVerified` | ht | .gov/.org verified | Verifye .gov/.org | 2026-11-15 | machine-drafted, needs native review |
| `phoneLine` | ht | Phone: {phone} | Telefòn: {phone} | 2026-11-15 | machine-drafted, needs native review |
| `categoryLine` | ht | Category: {category} | Kategori: {category} | 2026-11-15 | machine-drafted, needs native review |
| `approve` | ht | Approve | Apwouve | 2026-11-15 | machine-drafted, needs native review |
| `reject` | ht | Reject | Rejte | 2026-11-15 | machine-drafted, needs native review |
| `paRequired` | ht | Platform admin approval required | Fòk yon administratè platfòm apwouve l | 2026-11-15 | machine-drafted, needs native review |
| `approvedStatus` | ht | {name} was approved. | {name} apwouve. | 2026-11-15 | machine-drafted, needs native review |
| `rejectedStatus` | ht | {name} was rejected. | {name} rejte. | 2026-11-15 | machine-drafted, needs native review |
| `dialogTitleApprove` | ht | Review and confirm resource | Revize epi konfime resous la | 2026-11-15 | machine-drafted, needs native review |
| `dialogTitleEdit` | ht | Edit resource | Modifye resous la | 2026-11-15 | machine-drafted, needs native review |
| `dialogDescApprove` | ht | Edit any field before approving. Confirm saves your changes and publishes this resource in one step. | Modifye nenpòt chan anvan ou apwouve. Konfime anrejistre chanjman ou yo epi pibliye resous sa a an yon sèl etap. | 2026-11-15 | machine-drafted, needs native review |
| `dialogDescEdit` | ht | Changes persist to the resources table and are recorded with your admin identity. | Chanjman yo anrejistre nan tab resous yo ak idantite administratè ou. | 2026-11-15 | machine-drafted, needs native review |
| `fieldName` | ht | Name | Non | 2026-11-15 | machine-drafted, needs native review |
| `fieldDescription` | ht | Description | Deskripsyon | 2026-11-15 | machine-drafted, needs native review |
| `fieldCategory` | ht | Category | Kategori | 2026-11-15 | machine-drafted, needs native review |
| `fieldStatus` | ht | Status | Estati | 2026-11-15 | machine-drafted, needs native review |
| `fieldServiceMode` | ht | Service mode | Fason sèvis la bay | 2026-11-15 | machine-drafted, needs native review |
| `fieldAddress` | ht | Address | Adrès | 2026-11-15 | machine-drafted, needs native review |
| `fieldCity` | ht | City | Vil | 2026-11-15 | machine-drafted, needs native review |
| `fieldState` | ht | State | Eta | 2026-11-15 | machine-drafted, needs native review |
| `fieldZip` | ht | ZIP | Kòd postal | 2026-11-15 | machine-drafted, needs native review |
| `fieldPhone` | ht | Phone | Telefòn | 2026-11-15 | machine-drafted, needs native review |
| `fieldEmail` | ht | Email | Imèl | 2026-11-15 | machine-drafted, needs native review |
| `fieldWebsite` | ht | Website | Sit entènèt | 2026-11-15 | machine-drafted, needs native review |
| `required` | ht | required | obligatwa | 2026-11-15 | machine-drafted, needs native review |
| `statusApproved` | ht | Approved | Apwouve | 2026-11-15 | machine-drafted, needs native review |
| `statusPending` | ht | Pending | Ap tann | 2026-11-15 | machine-drafted, needs native review |
| `statusRejected` | ht | Rejected | Rejte | 2026-11-15 | machine-drafted, needs native review |
| `statusArchived` | ht | Archived | Achive | 2026-11-15 | machine-drafted, needs native review |
| `modePhysical` | ht | Physical location | Kote fizik | 2026-11-15 | machine-drafted, needs native review |
| `modeOnline` | ht | Online only | Sou entènèt sèlman | 2026-11-15 | machine-drafted, needs native review |
| `modeHybrid` | ht | Hybrid (physical + online) | Melanje (fizik + sou entènèt) | 2026-11-15 | machine-drafted, needs native review |
| `onlineHint` | ht | Online resources are not geocoded or placed on the map. | Resous sou entènèt pa jeokode epi yo pa mete yo sou kat la. | 2026-11-15 | machine-drafted, needs native review |
| `needsLocationLong` | ht | Needs location — not shown on the map. Enter an address and pick a suggestion to place it. | Bezwen adrès — li pa parèt sou kat la. Antre yon adrès epi chwazi yon sijesyon pou mete l. | 2026-11-15 | machine-drafted, needs native review |
| `addressPlaceholder` | ht | Start typing an address… | Kòmanse tape yon adrès… | 2026-11-15 | machine-drafted, needs native review |
| `addressSuggestions` | ht | Address suggestions | Sijesyon adrès | 2026-11-15 | machine-drafted, needs native review |
| `nameRequired` | ht | Name is required. | Non an obligatwa. | 2026-11-15 | machine-drafted, needs native review |
| `categoryRequired` | ht | Category is required. | Kategori a obligatwa. | 2026-11-15 | machine-drafted, needs native review |
| `statusRequired` | ht | Status is required. | Estati a obligatwa. | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | ht | Could not save the resource. Your changes are still in the form. | Nou pa t kapab anrejistre resous la. Chanjman ou yo toujou nan fòm nan. | 2026-11-15 | machine-drafted, needs native review |
| `confirmFailed` | ht | Could not save and approve the resource. Your changes are still in the form. | Nou pa t kapab anrejistre epi apwouve resous la. Chanjman ou yo toujou nan fòm nan. | 2026-11-15 | machine-drafted, needs native review |
| `saving` | ht | Saving… | Ap anrejistre… | 2026-11-15 | machine-drafted, needs native review |
| `confirming` | ht | Confirming… | Ap konfime… | 2026-11-15 | machine-drafted, needs native review |
| `saveChanges` | ht | Save changes | Anrejistre chanjman yo | 2026-11-15 | machine-drafted, needs native review |
| `close` | ht | Close | Fèmen | 2026-11-15 | machine-drafted, needs native review |
| `stateAll` | ht | All states | Tout eta yo | 2026-11-15 | machine-drafted, needs native review |
| `cityPlaceholder` | ht | e.g. Burlington | egz. Burlington | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | ht | Search name / description | Chèche non oswa deskripsyon | 2026-11-15 | machine-drafted, needs native review |
| `searchPlaceholder` | ht | e.g. food bank | egz. bank manje | 2026-11-15 | machine-drafted, needs native review |
| `applyFilters` | ht | Apply filters | Aplike filt yo | 2026-11-15 | machine-drafted, needs native review |
| `loading` | ht | Loading… | Ap chaje… | 2026-11-15 | machine-drafted, needs native review |
| `approvedTitle` | ht | Approved resources | Resous ki apwouve | 2026-11-15 | machine-drafted, needs native review |
| `showing` | ht | — showing {count} | — {count} ap parèt | 2026-11-15 | machine-drafted, needs native review |
| `moreAvailable` | ht | (more available) | (gen plis) | 2026-11-15 | machine-drafted, needs native review |
| `showMap` | ht | Show map | Montre kat la | 2026-11-15 | machine-drafted, needs native review |
| `hideMap` | ht | Hide map | Kache kat la | 2026-11-15 | machine-drafted, needs native review |
| `listLoadFailed` | ht | Could not load resources. | Nou pa t kapab chaje resous yo. | 2026-11-15 | machine-drafted, needs native review |
| `moreLoadFailed` | ht | Could not load more resources. | Nou pa t kapab chaje plis resous. | 2026-11-15 | machine-drafted, needs native review |
| `noMatchTitle` | ht | No resources match these filters | Pa gen resous ki koresponn ak filt sa yo | 2026-11-15 | machine-drafted, needs native review |
| `noMatchBody` | ht | Adjust the state, city, or search and apply again. | Chanje eta a, vil la oswa rechèch la epi aplike ankò. | 2026-11-15 | machine-drafted, needs native review |
| `saved` | ht | Saved | Anrejistre | 2026-11-15 | machine-drafted, needs native review |
| `savedStatus` | ht | Changes to {name} were saved. | Chanjman pou {name} anrejistre. | 2026-11-15 | machine-drafted, needs native review |
| `editResource` | ht | Edit resource | Modifye resous | 2026-11-15 | machine-drafted, needs native review |
| `loadMore` | ht | Load more | Chaje plis | 2026-11-15 | machine-drafted, needs native review |
| `noticeResourceNotFound` | ht | That resource couldn't be found, or it isn't editable here (only approved resources are listed in Manage). | Nou pa jwenn resous sa a, oswa ou pa ka modifye l isit la (se sèlman resous ki apwouve ki nan Jere). | 2026-11-15 | machine-drafted, needs native review |
| `noticeBusinessNotFound` | ht | That business couldn't be found, or it isn't editable here (only approved businesses can be edited). | Nou pa jwenn biznis sa a, oswa ou pa ka modifye l isit la (se sèlman biznis ki apwouve ou ka modifye). | 2026-11-15 | machine-drafted, needs native review |
| `noticeResourceNotEditable` | ht | Your admin role can't edit resources. | Wòl administratè ou pa ka modifye resous. | 2026-11-15 | machine-drafted, needs native review |
| `noticeBusinessNotEditable` | ht | Only platform admins can edit businesses. | Se sèlman administratè platfòm ki ka modifye biznis. | 2026-11-15 | machine-drafted, needs native review |
| `dismiss` | ht | Dismiss | Fèmen mesaj la | 2026-11-15 | machine-drafted, needs native review |
| `awaitingTitle` | ht | Awaiting review | Ap tann revizyon | 2026-11-15 | machine-drafted, needs native review |
| `noPending` | ht | No businesses awaiting review. | Pa gen biznis k ap tann revizyon. | 2026-11-15 | machine-drafted, needs native review |
| `rejectReasonLabel` | ht | Reason if you reject (optional, shown to the submitter) | Rezon si ou rejte l (opsyonèl, moun ki voye l la ap wè l) | 2026-11-15 | machine-drafted, needs native review |
| `approvedBusinessesTitle` | ht | Approved businesses | Biznis ki apwouve | 2026-11-15 | machine-drafted, needs native review |
| `approvedBusinessesCount` | ht | Approved businesses ({count}) | Biznis ki apwouve ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `noApproved` | ht | No approved businesses yet. | Poko gen biznis ki apwouve. | 2026-11-15 | machine-drafted, needs native review |
| `save` | ht | Save | Anrejistre | 2026-11-15 | machine-drafted, needs native review |
| `pendingLoadFailed` | ht | Could not load the businesses awaiting review. | Nou pa t kapab chaje biznis k ap tann revizyon yo. | 2026-11-15 | machine-drafted, needs native review |
| `approvedLoadFailed` | ht | Could not load the approved businesses. | Nou pa t kapab chaje biznis ki apwouve yo. | 2026-11-15 | machine-drafted, needs native review |
| `businessApproveFailed` | ht | Could not approve {name}. | Nou pa t kapab apwouve {name}. | 2026-11-15 | machine-drafted, needs native review |
| `businessRejectFailed` | ht | Could not reject {name}. | Nou pa t kapab rejte {name}. | 2026-11-15 | machine-drafted, needs native review |
| `businessSaveFailed` | ht | Could not save {name}. Your changes are still in the form. | Nou pa t kapab anrejistre {name}. Chanjman ou yo toujou nan fòm nan. | 2026-11-15 | machine-drafted, needs native review |
| `businessNotSaved` | ht | Nothing was saved: this business was not changed. Only platform admins can edit businesses, or it no longer exists. | Anyen pa t anrejistre: biznis sa a pa chanje. Se sèlman administratè platfòm ki ka modifye biznis, oswa li pa egziste ankò. | 2026-11-15 | machine-drafted, needs native review |
| `discoverTitle` | so | Discover Resources | Hel kheyraadyo | 2026-11-15 | machine-drafted, needs native review |
| `discoverIntro` | so | Enter a natural-language query to source and stage new resources for review. | Qor codsi luqad caadi ah si aad u hesho kheyraadyo cusub oo loogu diyaariyo dib-u-eegis. | 2026-11-15 | machine-drafted, needs native review |
| `nearLabel` | so | Searching near | Raadinta u dhow | 2026-11-15 | machine-drafted, needs native review |
| `nearPlaceholder` | so | e.g. Burlington, VT (defaults to your location) | tusaale: Burlington, VT (asal ahaan goobtaada) | 2026-11-15 | machine-drafted, needs native review |
| `useMyLocation` | so | Use my location | Isticmaal goobtayda | 2026-11-15 | machine-drafted, needs native review |
| `queryLabel` | so | What to look for | Waxa la raadinayo | 2026-11-15 | machine-drafted, needs native review |
| `queryPlaceholder` | so | e.g. "food banks in Burlington VT" or "SNAP application forms" | tusaale: "bangiyada cuntada ee Burlington VT" ama "foomamka codsiga SNAP" | 2026-11-15 | machine-drafted, needs native review |
| `discover` | so | Discover | Hel | 2026-11-15 | machine-drafted, needs native review |
| `discovering` | so | Discovering… | Waa la raadinayaa… | 2026-11-15 | machine-drafted, needs native review |
| `discoverTimeout` | so | Discovery request timed out — check the queue for any staged items. | Codsiga raadinta waqtigii wuu dhammaaday — ka eeg safka wixii la diyaariyey. | 2026-11-15 | machine-drafted, needs native review |
| `discoverFailed` | so | Discovery failed. Try again. | Raadintu way guuldarraysatay. Isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `discoverSummary` | so | {staged} ({rejected}) | {staged} ({rejected}) | 2026-11-15 | machine-drafted, needs native review |
| `progressSearching` | so | Searching sources… | Ilaha waa la raadinayaa… | 2026-11-15 | machine-drafted, needs native review |
| `progressVerifying` | so | Verifying provenance… | Asalka waa la xaqiijinayaa… | 2026-11-15 | machine-drafted, needs native review |
| `progressGeocoding` | so | Geocoding addresses… | Cinwaannada waa la calaamaynayaa… | 2026-11-15 | machine-drafted, needs native review |
| `pendingTitle` | so | Pending review | Sugaya dib-u-eegis | 2026-11-15 | machine-drafted, needs native review |
| `pendingTitleCount` | so | Pending review ({count}) | Sugaya dib-u-eegis ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `filterLabel` | so | Show | Muuji | 2026-11-15 | machine-drafted, needs native review |
| `filterAll` | so | All | Dhammaan | 2026-11-15 | machine-drafted, needs native review |
| `typeResource` | so | Resource | Kheyraad | 2026-11-15 | machine-drafted, needs native review |
| `typeLink` | so | Link | Xiriiriye | 2026-11-15 | machine-drafted, needs native review |
| `typeForm` | so | Form | Foom | 2026-11-15 | machine-drafted, needs native review |
| `viewLabel` | so | View | Muuqaal | 2026-11-15 | machine-drafted, needs native review |
| `viewList` | so | List | Liis | 2026-11-15 | machine-drafted, needs native review |
| `viewMap` | so | Map | Khariidad | 2026-11-15 | machine-drafted, needs native review |
| `bulkApprove` | so | Bulk approve high-confidence ({count}) | Ansixi dhammaan kuwa kalsoonida sare leh ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `confirm` | so | Confirm | Xaqiiji | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | so | Cancel | Jooji | 2026-11-15 | machine-drafted, needs native review |
| `tryAgain` | so | Try again | Isku day mar kale | 2026-11-15 | machine-drafted, needs native review |
| `queueLoadFailed` | so | Could not load the review queue. | Lama soo rari karin safka dib-u-eegista. | 2026-11-15 | machine-drafted, needs native review |
| `approveFailed` | so | Could not approve {name}. It is still in the queue. | Lama ansixin karin {name}. Wali waa safka ku jiraa. | 2026-11-15 | machine-drafted, needs native review |
| `rejectFailed` | so | Could not reject {name}. It is still in the queue. | Lama diidi karin {name}. Wali waa safka ku jiraa. | 2026-11-15 | machine-drafted, needs native review |
| `emptyTitle` | so | No pending items | Ma jiraan waxyaabo sugaya | 2026-11-15 | machine-drafted, needs native review |
| `emptyBody` | so | Use the discovery input above to source new resources. | Isticmaal sanduuqa raadinta ee kore si aad u hesho kheyraadyo cusub. | 2026-11-15 | machine-drafted, needs native review |
| `confidenceHigh` | so | High confidence | Kalsooni sare | 2026-11-15 | machine-drafted, needs native review |
| `confidenceMedium` | so | Medium confidence | Kalsooni dhexe | 2026-11-15 | machine-drafted, needs native review |
| `needsLocation` | so | Needs location | Wuxuu u baahan yahay goob | 2026-11-15 | machine-drafted, needs native review |
| `itemDetails` | so | Details | Faahfaahin | 2026-11-15 | machine-drafted, needs native review |
| `provenanceVerified` | so | .gov/.org verified | La xaqiijiyey .gov/.org | 2026-11-15 | machine-drafted, needs native review |
| `phoneLine` | so | Phone: {phone} | Telefoon: {phone} | 2026-11-15 | machine-drafted, needs native review |
| `categoryLine` | so | Category: {category} | Qayb: {category} | 2026-11-15 | machine-drafted, needs native review |
| `approve` | so | Approve | Ansixi | 2026-11-15 | machine-drafted, needs native review |
| `reject` | so | Reject | Diid | 2026-11-15 | machine-drafted, needs native review |
| `paRequired` | so | Platform admin approval required | Waxa loo baahan yahay ansixinta maamulaha madal | 2026-11-15 | machine-drafted, needs native review |
| `approvedStatus` | so | {name} was approved. | {name} waa la ansixiyey. | 2026-11-15 | machine-drafted, needs native review |
| `rejectedStatus` | so | {name} was rejected. | {name} waa la diiday. | 2026-11-15 | machine-drafted, needs native review |
| `dialogTitleApprove` | so | Review and confirm resource | Dib u eeg oo xaqiiji kheyraadka | 2026-11-15 | machine-drafted, needs native review |
| `dialogTitleEdit` | so | Edit resource | Wax ka beddel kheyraadka | 2026-11-15 | machine-drafted, needs native review |
| `dialogDescApprove` | so | Edit any field before approving. Confirm saves your changes and publishes this resource in one step. | Wax ka beddel goob kasta ka hor intaadan ansixin. Xaqiijintu waxay kaydisaa isbeddelladaada waxayna daabacdaa kheyraadkan hal tallaabo. | 2026-11-15 | machine-drafted, needs native review |
| `dialogDescEdit` | so | Changes persist to the resources table and are recorded with your admin identity. | Isbeddelladu waxay ku kaydsamaan shaxda kheyraadka waxaana lagu diiwaangeliyaa aqoonsigaaga maamule. | 2026-11-15 | machine-drafted, needs native review |
| `fieldName` | so | Name | Magac | 2026-11-15 | machine-drafted, needs native review |
| `fieldDescription` | so | Description | Sharaxaad | 2026-11-15 | machine-drafted, needs native review |
| `fieldCategory` | so | Category | Qayb | 2026-11-15 | machine-drafted, needs native review |
| `fieldStatus` | so | Status | Xaalad | 2026-11-15 | machine-drafted, needs native review |
| `fieldServiceMode` | so | Service mode | Habka adeegga | 2026-11-15 | machine-drafted, needs native review |
| `fieldAddress` | so | Address | Cinwaan | 2026-11-15 | machine-drafted, needs native review |
| `fieldCity` | so | City | Magaalo | 2026-11-15 | machine-drafted, needs native review |
| `fieldState` | so | State | Gobol | 2026-11-15 | machine-drafted, needs native review |
| `fieldZip` | so | ZIP | Koodhka boosta | 2026-11-15 | machine-drafted, needs native review |
| `fieldPhone` | so | Phone | Telefoon | 2026-11-15 | machine-drafted, needs native review |
| `fieldEmail` | so | Email | Iimayl | 2026-11-15 | machine-drafted, needs native review |
| `fieldWebsite` | so | Website | Bogga internetka | 2026-11-15 | machine-drafted, needs native review |
| `required` | so | required | waajib | 2026-11-15 | machine-drafted, needs native review |
| `statusApproved` | so | Approved | La ansixiyey | 2026-11-15 | machine-drafted, needs native review |
| `statusPending` | so | Pending | Sugaya | 2026-11-15 | machine-drafted, needs native review |
| `statusRejected` | so | Rejected | La diiday | 2026-11-15 | machine-drafted, needs native review |
| `statusArchived` | so | Archived | La kaydiyey | 2026-11-15 | machine-drafted, needs native review |
| `modePhysical` | so | Physical location | Goob muuqata | 2026-11-15 | machine-drafted, needs native review |
| `modeOnline` | so | Online only | Online keliya | 2026-11-15 | machine-drafted, needs native review |
| `modeHybrid` | so | Hybrid (physical + online) | Isku-dhaf (goob + online) | 2026-11-15 | machine-drafted, needs native review |
| `onlineHint` | so | Online resources are not geocoded or placed on the map. | Kheyraadka online-ka ah lama calaameeyo lagumana dhigo khariidadda. | 2026-11-15 | machine-drafted, needs native review |
| `needsLocationLong` | so | Needs location — not shown on the map. Enter an address and pick a suggestion to place it. | Wuxuu u baahan yahay goob — khariidadda kuma muuqdo. Geli cinwaan oo dooro soo-jeedin si aad u dhigto. | 2026-11-15 | machine-drafted, needs native review |
| `addressPlaceholder` | so | Start typing an address… | Bilow qorista cinwaan… | 2026-11-15 | machine-drafted, needs native review |
| `addressSuggestions` | so | Address suggestions | Soo-jeedinta cinwaanka | 2026-11-15 | machine-drafted, needs native review |
| `nameRequired` | so | Name is required. | Magacu waa waajib. | 2026-11-15 | machine-drafted, needs native review |
| `categoryRequired` | so | Category is required. | Qaybtu waa waajib. | 2026-11-15 | machine-drafted, needs native review |
| `statusRequired` | so | Status is required. | Xaaladdu waa waajib. | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | so | Could not save the resource. Your changes are still in the form. | Lama kaydin karin kheyraadka. Isbeddelladaadu wali foomka ayay ku jiraan. | 2026-11-15 | machine-drafted, needs native review |
| `confirmFailed` | so | Could not save and approve the resource. Your changes are still in the form. | Lama kaydin lamana ansixin karin kheyraadka. Isbeddelladaadu wali foomka ayay ku jiraan. | 2026-11-15 | machine-drafted, needs native review |
| `saving` | so | Saving… | Waa la kaydinayaa… | 2026-11-15 | machine-drafted, needs native review |
| `confirming` | so | Confirming… | Waa la xaqiijinayaa… | 2026-11-15 | machine-drafted, needs native review |
| `saveChanges` | so | Save changes | Kaydi isbeddellada | 2026-11-15 | machine-drafted, needs native review |
| `close` | so | Close | Xir | 2026-11-15 | machine-drafted, needs native review |
| `stateAll` | so | All states | Dhammaan gobollada | 2026-11-15 | machine-drafted, needs native review |
| `cityPlaceholder` | so | e.g. Burlington | tusaale: Burlington | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | so | Search name / description | Ka raadi magaca / sharaxaadda | 2026-11-15 | machine-drafted, needs native review |
| `searchPlaceholder` | so | e.g. food bank | tusaale: bangiga cuntada | 2026-11-15 | machine-drafted, needs native review |
| `applyFilters` | so | Apply filters | Dabaq shaandhaynta | 2026-11-15 | machine-drafted, needs native review |
| `loading` | so | Loading… | Waa la soo rarayaa… | 2026-11-15 | machine-drafted, needs native review |
| `approvedTitle` | so | Approved resources | Kheyraadka la ansixiyey | 2026-11-15 | machine-drafted, needs native review |
| `showing` | so | — showing {count} | — waxa la muujinayaa {count} | 2026-11-15 | machine-drafted, needs native review |
| `moreAvailable` | so | (more available) | (waxa jira kuwo kale) | 2026-11-15 | machine-drafted, needs native review |
| `showMap` | so | Show map | Muuji khariidadda | 2026-11-15 | machine-drafted, needs native review |
| `hideMap` | so | Hide map | Qari khariidadda | 2026-11-15 | machine-drafted, needs native review |
| `listLoadFailed` | so | Could not load resources. | Lama soo rari karin kheyraadka. | 2026-11-15 | machine-drafted, needs native review |
| `moreLoadFailed` | so | Could not load more resources. | Lama soo rari karin kheyraad dheeraad ah. | 2026-11-15 | machine-drafted, needs native review |
| `noMatchTitle` | so | No resources match these filters | Ma jiro kheyraad u dhigma shaandhaynta | 2026-11-15 | machine-drafted, needs native review |
| `noMatchBody` | so | Adjust the state, city, or search and apply again. | Beddel gobolka, magaalada ama raadinta oo mar kale dabaq. | 2026-11-15 | machine-drafted, needs native review |
| `saved` | so | Saved | Waa la kaydiyey | 2026-11-15 | machine-drafted, needs native review |
| `savedStatus` | so | Changes to {name} were saved. | Isbeddellada {name} waa la kaydiyey. | 2026-11-15 | machine-drafted, needs native review |
| `editResource` | so | Edit resource | Wax ka beddel kheyraad | 2026-11-15 | machine-drafted, needs native review |
| `loadMore` | so | Load more | Soo rar wax dheeraad ah | 2026-11-15 | machine-drafted, needs native review |
| `noticeResourceNotFound` | so | That resource couldn't be found, or it isn't editable here (only approved resources are listed in Manage). | Kheyraadkaas lama helin, ama halkan lagama beddeli karo (Maaraynta waxa ku jira kheyraadka la ansixiyey oo keliya). | 2026-11-15 | machine-drafted, needs native review |
| `noticeBusinessNotFound` | so | That business couldn't be found, or it isn't editable here (only approved businesses can be edited). | Ganacsigaas lama helin, ama halkan lagama beddeli karo (ganacsiyada la ansixiyey oo keliya ayaa wax laga beddeli karaa). | 2026-11-15 | machine-drafted, needs native review |
| `noticeResourceNotEditable` | so | Your admin role can't edit resources. | Doorkaaga maamule wax kama beddeli karo kheyraadka. | 2026-11-15 | machine-drafted, needs native review |
| `noticeBusinessNotEditable` | so | Only platform admins can edit businesses. | Maamulayaasha madasha oo keliya ayaa wax ka beddeli kara ganacsiyada. | 2026-11-15 | machine-drafted, needs native review |
| `dismiss` | so | Dismiss | Iska dhaaf | 2026-11-15 | machine-drafted, needs native review |
| `awaitingTitle` | so | Awaiting review | Sugaya dib-u-eegis | 2026-11-15 | machine-drafted, needs native review |
| `noPending` | so | No businesses awaiting review. | Ma jiraan ganacsiyo sugaya dib-u-eegis. | 2026-11-15 | machine-drafted, needs native review |
| `rejectReasonLabel` | so | Reason if you reject (optional, shown to the submitter) | Sababta haddii aad diiddo (ikhtiyaari, waxa arkaya qofka soo gudbiyey) | 2026-11-15 | machine-drafted, needs native review |
| `approvedBusinessesTitle` | so | Approved businesses | Ganacsiyada la ansixiyey | 2026-11-15 | machine-drafted, needs native review |
| `approvedBusinessesCount` | so | Approved businesses ({count}) | Ganacsiyada la ansixiyey ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `noApproved` | so | No approved businesses yet. | Wali ma jiraan ganacsiyo la ansixiyey. | 2026-11-15 | machine-drafted, needs native review |
| `save` | so | Save | Kaydi | 2026-11-15 | machine-drafted, needs native review |
| `pendingLoadFailed` | so | Could not load the businesses awaiting review. | Lama soo rari karin ganacsiyada sugaya dib-u-eegis. | 2026-11-15 | machine-drafted, needs native review |
| `approvedLoadFailed` | so | Could not load the approved businesses. | Lama soo rari karin ganacsiyada la ansixiyey. | 2026-11-15 | machine-drafted, needs native review |
| `businessApproveFailed` | so | Could not approve {name}. | Lama ansixin karin {name}. | 2026-11-15 | machine-drafted, needs native review |
| `businessRejectFailed` | so | Could not reject {name}. | Lama diidi karin {name}. | 2026-11-15 | machine-drafted, needs native review |
| `businessSaveFailed` | so | Could not save {name}. Your changes are still in the form. | Lama kaydin karin {name}. Isbeddelladaadu wali foomka ayay ku jiraan. | 2026-11-15 | machine-drafted, needs native review |
| `businessNotSaved` | so | Nothing was saved: this business was not changed. Only platform admins can edit businesses, or it no longer exists. | Waxba lama kaydin: ganacsigan isma beddelin. Maamulayaasha madasha oo keliya ayaa wax ka beddeli kara ganacsiyada, ama hadda ma jiro. | 2026-11-15 | machine-drafted, needs native review |
| `discoverTitle` | am | Discover Resources | ሀብቶችን ያግኙ | 2026-11-15 | machine-drafted, needs native review |
| `discoverIntro` | am | Enter a natural-language query to source and stage new resources for review. | አዳዲስ ሀብቶችን ለማግኘትና ለግምገማ ለማዘጋጀት በተራ ቋንቋ ጥያቄ ያስገቡ። | 2026-11-15 | machine-drafted, needs native review |
| `nearLabel` | am | Searching near | በአቅራቢያ መፈለጊያ | 2026-11-15 | machine-drafted, needs native review |
| `nearPlaceholder` | am | e.g. Burlington, VT (defaults to your location) | ለምሳሌ Burlington, VT (በነባሪ የእርስዎ አካባቢ) | 2026-11-15 | machine-drafted, needs native review |
| `useMyLocation` | am | Use my location | አካባቢዬን ተጠቀም | 2026-11-15 | machine-drafted, needs native review |
| `queryLabel` | am | What to look for | የሚፈለገው | 2026-11-15 | machine-drafted, needs native review |
| `queryPlaceholder` | am | e.g. "food banks in Burlington VT" or "SNAP application forms" | ለምሳሌ "በBurlington VT ያሉ የምግብ ባንኮች" ወይም "የSNAP ማመልከቻ ቅጾች" | 2026-11-15 | machine-drafted, needs native review |
| `discover` | am | Discover | ፈልግ | 2026-11-15 | machine-drafted, needs native review |
| `discovering` | am | Discovering… | በመፈለግ ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `discoverTimeout` | am | Discovery request timed out — check the queue for any staged items. | የፍለጋ ጥያቄው ጊዜው አልፏል — የተዘጋጁ ነገሮች ካሉ ወረፋውን ይመልከቱ። | 2026-11-15 | machine-drafted, needs native review |
| `discoverFailed` | am | Discovery failed. Try again. | ፍለጋው አልተሳካም። እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `discoverSummary` | am | {staged} ({rejected}) | {staged} ({rejected}) | 2026-11-15 | machine-drafted, needs native review |
| `progressSearching` | am | Searching sources… | ምንጮችን በመፈለግ ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `progressVerifying` | am | Verifying provenance… | ምንጩን በማረጋገጥ ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `progressGeocoding` | am | Geocoding addresses… | አድራሻዎችን ጂኦኮድ በማድረግ ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `pendingTitle` | am | Pending review | ግምገማ በመጠባበቅ ላይ | 2026-11-15 | machine-drafted, needs native review |
| `pendingTitleCount` | am | Pending review ({count}) | ግምገማ በመጠባበቅ ላይ ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `filterLabel` | am | Show | አሳይ | 2026-11-15 | machine-drafted, needs native review |
| `filterAll` | am | All | ሁሉም | 2026-11-15 | machine-drafted, needs native review |
| `typeResource` | am | Resource | ሀብት | 2026-11-15 | machine-drafted, needs native review |
| `typeLink` | am | Link | አገናኝ | 2026-11-15 | machine-drafted, needs native review |
| `typeForm` | am | Form | ቅጽ | 2026-11-15 | machine-drafted, needs native review |
| `viewLabel` | am | View | እይታ | 2026-11-15 | machine-drafted, needs native review |
| `viewList` | am | List | ዝርዝር | 2026-11-15 | machine-drafted, needs native review |
| `viewMap` | am | Map | ካርታ | 2026-11-15 | machine-drafted, needs native review |
| `bulkApprove` | am | Bulk approve high-confidence ({count}) | ከፍተኛ እምነት ያላቸውን በአንድ ላይ አጽድቅ ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `confirm` | am | Confirm | አረጋግጥ | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | am | Cancel | ሰርዝ | 2026-11-15 | machine-drafted, needs native review |
| `tryAgain` | am | Try again | እንደገና ሞክር | 2026-11-15 | machine-drafted, needs native review |
| `queueLoadFailed` | am | Could not load the review queue. | የግምገማ ወረፋውን መጫን አልተቻለም። | 2026-11-15 | machine-drafted, needs native review |
| `approveFailed` | am | Could not approve {name}. It is still in the queue. | {name}ን ማጽደቅ አልተቻለም። አሁንም በወረፋው ውስጥ ነው። | 2026-11-15 | machine-drafted, needs native review |
| `rejectFailed` | am | Could not reject {name}. It is still in the queue. | {name}ን አለመቀበል አልተቻለም። አሁንም በወረፋው ውስጥ ነው። | 2026-11-15 | machine-drafted, needs native review |
| `emptyTitle` | am | No pending items | በመጠባበቅ ላይ ያለ ነገር የለም | 2026-11-15 | machine-drafted, needs native review |
| `emptyBody` | am | Use the discovery input above to source new resources. | አዳዲስ ሀብቶችን ለማግኘት ከላይ ያለውን የፍለጋ ሳጥን ይጠቀሙ። | 2026-11-15 | machine-drafted, needs native review |
| `confidenceHigh` | am | High confidence | ከፍተኛ እምነት | 2026-11-15 | machine-drafted, needs native review |
| `confidenceMedium` | am | Medium confidence | መካከለኛ እምነት | 2026-11-15 | machine-drafted, needs native review |
| `needsLocation` | am | Needs location | አካባቢ ያስፈልገዋል | 2026-11-15 | machine-drafted, needs native review |
| `itemDetails` | am | Details | ዝርዝሮች | 2026-11-15 | machine-drafted, needs native review |
| `provenanceVerified` | am | .gov/.org verified | በ.gov/.org የተረጋገጠ | 2026-11-15 | machine-drafted, needs native review |
| `phoneLine` | am | Phone: {phone} | ስልክ፦ {phone} | 2026-11-15 | machine-drafted, needs native review |
| `categoryLine` | am | Category: {category} | ምድብ፦ {category} | 2026-11-15 | machine-drafted, needs native review |
| `approve` | am | Approve | አጽድቅ | 2026-11-15 | machine-drafted, needs native review |
| `reject` | am | Reject | አትቀበል | 2026-11-15 | machine-drafted, needs native review |
| `paRequired` | am | Platform admin approval required | የመድረክ አስተዳዳሪ ማጽደቅ ያስፈልጋል | 2026-11-15 | machine-drafted, needs native review |
| `approvedStatus` | am | {name} was approved. | {name} ጸድቋል። | 2026-11-15 | machine-drafted, needs native review |
| `rejectedStatus` | am | {name} was rejected. | {name} ውድቅ ተደርጓል። | 2026-11-15 | machine-drafted, needs native review |
| `dialogTitleApprove` | am | Review and confirm resource | ሀብቱን ይገምግሙና ያረጋግጡ | 2026-11-15 | machine-drafted, needs native review |
| `dialogTitleEdit` | am | Edit resource | ሀብቱን ያርትዑ | 2026-11-15 | machine-drafted, needs native review |
| `dialogDescApprove` | am | Edit any field before approving. Confirm saves your changes and publishes this resource in one step. | ከማጽደቅዎ በፊት ማንኛውንም መስክ ያርትዑ። ማረጋገጥ ለውጦችዎን ያስቀምጣል እና ይህን ሀብት በአንድ እርምጃ ያትማል። | 2026-11-15 | machine-drafted, needs native review |
| `dialogDescEdit` | am | Changes persist to the resources table and are recorded with your admin identity. | ለውጦቹ በሀብቶች ሰንጠረዥ ውስጥ ይቀመጣሉ እና ከአስተዳዳሪ ማንነትዎ ጋር ይመዘገባሉ። | 2026-11-15 | machine-drafted, needs native review |
| `fieldName` | am | Name | ስም | 2026-11-15 | machine-drafted, needs native review |
| `fieldDescription` | am | Description | መግለጫ | 2026-11-15 | machine-drafted, needs native review |
| `fieldCategory` | am | Category | ምድብ | 2026-11-15 | machine-drafted, needs native review |
| `fieldStatus` | am | Status | ሁኔታ | 2026-11-15 | machine-drafted, needs native review |
| `fieldServiceMode` | am | Service mode | የአገልግሎት ዓይነት | 2026-11-15 | machine-drafted, needs native review |
| `fieldAddress` | am | Address | አድራሻ | 2026-11-15 | machine-drafted, needs native review |
| `fieldCity` | am | City | ከተማ | 2026-11-15 | machine-drafted, needs native review |
| `fieldState` | am | State | ግዛት | 2026-11-15 | machine-drafted, needs native review |
| `fieldZip` | am | ZIP | የፖስታ ኮድ | 2026-11-15 | machine-drafted, needs native review |
| `fieldPhone` | am | Phone | ስልክ | 2026-11-15 | machine-drafted, needs native review |
| `fieldEmail` | am | Email | ኢሜይል | 2026-11-15 | machine-drafted, needs native review |
| `fieldWebsite` | am | Website | ድረ-ገጽ | 2026-11-15 | machine-drafted, needs native review |
| `required` | am | required | ግዴታ | 2026-11-15 | machine-drafted, needs native review |
| `statusApproved` | am | Approved | የጸደቀ | 2026-11-15 | machine-drafted, needs native review |
| `statusPending` | am | Pending | በመጠባበቅ ላይ | 2026-11-15 | machine-drafted, needs native review |
| `statusRejected` | am | Rejected | ውድቅ የተደረገ | 2026-11-15 | machine-drafted, needs native review |
| `statusArchived` | am | Archived | በማህደር የተቀመጠ | 2026-11-15 | machine-drafted, needs native review |
| `modePhysical` | am | Physical location | አካላዊ ቦታ | 2026-11-15 | machine-drafted, needs native review |
| `modeOnline` | am | Online only | በመስመር ላይ ብቻ | 2026-11-15 | machine-drafted, needs native review |
| `modeHybrid` | am | Hybrid (physical + online) | ድብልቅ (በአካል + በመስመር ላይ) | 2026-11-15 | machine-drafted, needs native review |
| `onlineHint` | am | Online resources are not geocoded or placed on the map. | የመስመር ላይ ሀብቶች ጂኦኮድ አይደረጉም፤ በካርታው ላይም አይቀመጡም። | 2026-11-15 | machine-drafted, needs native review |
| `needsLocationLong` | am | Needs location — not shown on the map. Enter an address and pick a suggestion to place it. | አካባቢ ያስፈልገዋል — በካርታው ላይ አይታይም። ለማስቀመጥ አድራሻ ያስገቡና ጥቆማ ይምረጡ። | 2026-11-15 | machine-drafted, needs native review |
| `addressPlaceholder` | am | Start typing an address… | አድራሻ መተየብ ይጀምሩ… | 2026-11-15 | machine-drafted, needs native review |
| `addressSuggestions` | am | Address suggestions | የአድራሻ ጥቆማዎች | 2026-11-15 | machine-drafted, needs native review |
| `nameRequired` | am | Name is required. | ስም ግዴታ ነው። | 2026-11-15 | machine-drafted, needs native review |
| `categoryRequired` | am | Category is required. | ምድብ ግዴታ ነው። | 2026-11-15 | machine-drafted, needs native review |
| `statusRequired` | am | Status is required. | ሁኔታ ግዴታ ነው። | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | am | Could not save the resource. Your changes are still in the form. | ሀብቱን ማስቀመጥ አልተቻለም። ለውጦችዎ አሁንም በቅጹ ውስጥ አሉ። | 2026-11-15 | machine-drafted, needs native review |
| `confirmFailed` | am | Could not save and approve the resource. Your changes are still in the form. | ሀብቱን ማስቀመጥና ማጽደቅ አልተቻለም። ለውጦችዎ አሁንም በቅጹ ውስጥ አሉ። | 2026-11-15 | machine-drafted, needs native review |
| `saving` | am | Saving… | በማስቀመጥ ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `confirming` | am | Confirming… | በማረጋገጥ ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `saveChanges` | am | Save changes | ለውጦቹን አስቀምጥ | 2026-11-15 | machine-drafted, needs native review |
| `close` | am | Close | ዝጋ | 2026-11-15 | machine-drafted, needs native review |
| `stateAll` | am | All states | ሁሉም ግዛቶች | 2026-11-15 | machine-drafted, needs native review |
| `cityPlaceholder` | am | e.g. Burlington | ለምሳሌ Burlington | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | am | Search name / description | በስም / በመግለጫ ፈልግ | 2026-11-15 | machine-drafted, needs native review |
| `searchPlaceholder` | am | e.g. food bank | ለምሳሌ የምግብ ባንክ | 2026-11-15 | machine-drafted, needs native review |
| `applyFilters` | am | Apply filters | ማጣሪያዎችን ተግብር | 2026-11-15 | machine-drafted, needs native review |
| `loading` | am | Loading… | በመጫን ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `approvedTitle` | am | Approved resources | የጸደቁ ሀብቶች | 2026-11-15 | machine-drafted, needs native review |
| `showing` | am | — showing {count} | — {count} እየታዩ ነው | 2026-11-15 | machine-drafted, needs native review |
| `moreAvailable` | am | (more available) | (ተጨማሪ አለ) | 2026-11-15 | machine-drafted, needs native review |
| `showMap` | am | Show map | ካርታውን አሳይ | 2026-11-15 | machine-drafted, needs native review |
| `hideMap` | am | Hide map | ካርታውን ደብቅ | 2026-11-15 | machine-drafted, needs native review |
| `listLoadFailed` | am | Could not load resources. | ሀብቶቹን መጫን አልተቻለም። | 2026-11-15 | machine-drafted, needs native review |
| `moreLoadFailed` | am | Could not load more resources. | ተጨማሪ ሀብቶችን መጫን አልተቻለም። | 2026-11-15 | machine-drafted, needs native review |
| `noMatchTitle` | am | No resources match these filters | ከእነዚህ ማጣሪያዎች ጋር የሚዛመድ ሀብት የለም | 2026-11-15 | machine-drafted, needs native review |
| `noMatchBody` | am | Adjust the state, city, or search and apply again. | ግዛቱን፣ ከተማውን ወይም ፍለጋውን ይቀይሩና እንደገና ይተግብሩ። | 2026-11-15 | machine-drafted, needs native review |
| `saved` | am | Saved | ተቀምጧል | 2026-11-15 | machine-drafted, needs native review |
| `savedStatus` | am | Changes to {name} were saved. | በ{name} ላይ የተደረጉ ለውጦች ተቀምጠዋል። | 2026-11-15 | machine-drafted, needs native review |
| `editResource` | am | Edit resource | ሀብቱን አርትዕ | 2026-11-15 | machine-drafted, needs native review |
| `loadMore` | am | Load more | ተጨማሪ ጫን | 2026-11-15 | machine-drafted, needs native review |
| `noticeResourceNotFound` | am | That resource couldn't be found, or it isn't editable here (only approved resources are listed in Manage). | ያ ሀብት አልተገኘም፣ ወይም እዚህ ሊስተካከል አይችልም (በአስተዳደር ውስጥ የጸደቁ ሀብቶች ብቻ ይዘረዘራሉ)። | 2026-11-15 | machine-drafted, needs native review |
| `noticeBusinessNotFound` | am | That business couldn't be found, or it isn't editable here (only approved businesses can be edited). | ያ ንግድ አልተገኘም፣ ወይም እዚህ ሊስተካከል አይችልም (የጸደቁ ንግዶች ብቻ ሊስተካከሉ ይችላሉ)። | 2026-11-15 | machine-drafted, needs native review |
| `noticeResourceNotEditable` | am | Your admin role can't edit resources. | የእርስዎ የአስተዳዳሪ ሚና ሀብቶችን ማርትዕ አይችልም። | 2026-11-15 | machine-drafted, needs native review |
| `noticeBusinessNotEditable` | am | Only platform admins can edit businesses. | ንግዶችን ማርትዕ የሚችሉት የመድረክ አስተዳዳሪዎች ብቻ ናቸው። | 2026-11-15 | machine-drafted, needs native review |
| `dismiss` | am | Dismiss | አሰናብት | 2026-11-15 | machine-drafted, needs native review |
| `awaitingTitle` | am | Awaiting review | ግምገማ በመጠባበቅ ላይ | 2026-11-15 | machine-drafted, needs native review |
| `noPending` | am | No businesses awaiting review. | ግምገማ የሚጠብቅ ንግድ የለም። | 2026-11-15 | machine-drafted, needs native review |
| `rejectReasonLabel` | am | Reason if you reject (optional, shown to the submitter) | ውድቅ ካደረጉ ምክንያቱ (አማራጭ፣ ለአስገቢው ይታያል) | 2026-11-15 | machine-drafted, needs native review |
| `approvedBusinessesTitle` | am | Approved businesses | የጸደቁ ንግዶች | 2026-11-15 | machine-drafted, needs native review |
| `approvedBusinessesCount` | am | Approved businesses ({count}) | የጸደቁ ንግዶች ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `noApproved` | am | No approved businesses yet. | እስካሁን የጸደቀ ንግድ የለም። | 2026-11-15 | machine-drafted, needs native review |
| `save` | am | Save | አስቀምጥ | 2026-11-15 | machine-drafted, needs native review |
| `pendingLoadFailed` | am | Could not load the businesses awaiting review. | ግምገማ የሚጠብቁትን ንግዶች መጫን አልተቻለም። | 2026-11-15 | machine-drafted, needs native review |
| `approvedLoadFailed` | am | Could not load the approved businesses. | የጸደቁትን ንግዶች መጫን አልተቻለም። | 2026-11-15 | machine-drafted, needs native review |
| `businessApproveFailed` | am | Could not approve {name}. | {name}ን ማጽደቅ አልተቻለም። | 2026-11-15 | machine-drafted, needs native review |
| `businessRejectFailed` | am | Could not reject {name}. | {name}ን ውድቅ ማድረግ አልተቻለም። | 2026-11-15 | machine-drafted, needs native review |
| `businessSaveFailed` | am | Could not save {name}. Your changes are still in the form. | {name}ን ማስቀመጥ አልተቻለም። ለውጦችዎ አሁንም በቅጹ ውስጥ አሉ። | 2026-11-15 | machine-drafted, needs native review |
| `businessNotSaved` | am | Nothing was saved: this business was not changed. Only platform admins can edit businesses, or it no longer exists. | ምንም አልተቀመጠም፦ ይህ ንግድ አልተለወጠም። ንግዶችን ማርትዕ የሚችሉት የመድረክ አስተዳዳሪዎች ብቻ ናቸው፣ ወይም ንግዱ ከእንግዲህ የለም። | 2026-11-15 | machine-drafted, needs native review |
| `discoverTitle` | hmn | Discover Resources | Nrhiav cov kev pab | 2026-11-15 | machine-drafted, needs native review |
| `discoverIntro` | hmn | Enter a natural-language query to source and stage new resources for review. | Sau ib lo lus nug ib txwm hais los nrhiav cov kev pab tshiab thiab muab tso cia tos tshuaj xyuas. | 2026-11-15 | machine-drafted, needs native review |
| `nearLabel` | hmn | Searching near | Nrhiav ze ntawm | 2026-11-15 | machine-drafted, needs native review |
| `nearPlaceholder` | hmn | e.g. Burlington, VT (defaults to your location) | piv txwv Burlington, VT (ib txwm yog koj qhov chaw) | 2026-11-15 | machine-drafted, needs native review |
| `useMyLocation` | hmn | Use my location | Siv kuv qhov chaw | 2026-11-15 | machine-drafted, needs native review |
| `queryLabel` | hmn | What to look for | Yuav nrhiav dab tsi | 2026-11-15 | machine-drafted, needs native review |
| `queryPlaceholder` | hmn | e.g. "food banks in Burlington VT" or "SNAP application forms" | piv txwv "cov chaw pub zaub mov hauv Burlington VT" lossis "cov ntawv thov SNAP" | 2026-11-15 | machine-drafted, needs native review |
| `discover` | hmn | Discover | Nrhiav | 2026-11-15 | machine-drafted, needs native review |
| `discovering` | hmn | Discovering… | Tab tom nrhiav… | 2026-11-15 | machine-drafted, needs native review |
| `discoverTimeout` | hmn | Discovery request timed out — check the queue for any staged items. | Kev nrhiav siv sij hawm ntev dhau lawm — saib hauv kab tos seb puas muaj yam twg npaj lawm. | 2026-11-15 | machine-drafted, needs native review |
| `discoverFailed` | hmn | Discovery failed. Try again. | Kev nrhiav tsis tiav. Sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `discoverSummary` | hmn | {staged} ({rejected}) | {staged} ({rejected}) | 2026-11-15 | machine-drafted, needs native review |
| `progressSearching` | hmn | Searching sources… | Tab tom nrhiav qhov chaw los… | 2026-11-15 | machine-drafted, needs native review |
| `progressVerifying` | hmn | Verifying provenance… | Tab tom kuaj keeb kwm… | 2026-11-15 | machine-drafted, needs native review |
| `progressGeocoding` | hmn | Geocoding addresses… | Tab tom muab cim chaw nyob… | 2026-11-15 | machine-drafted, needs native review |
| `pendingTitle` | hmn | Pending review | Tos tshuaj xyuas | 2026-11-15 | machine-drafted, needs native review |
| `pendingTitleCount` | hmn | Pending review ({count}) | Tos tshuaj xyuas ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `filterLabel` | hmn | Show | Qhia | 2026-11-15 | machine-drafted, needs native review |
| `filterAll` | hmn | All | Txhua yam | 2026-11-15 | machine-drafted, needs native review |
| `typeResource` | hmn | Resource | Kev pab | 2026-11-15 | machine-drafted, needs native review |
| `typeLink` | hmn | Link | Txuas | 2026-11-15 | machine-drafted, needs native review |
| `typeForm` | hmn | Form | Daim ntawv | 2026-11-15 | machine-drafted, needs native review |
| `viewLabel` | hmn | View | Saib li | 2026-11-15 | machine-drafted, needs native review |
| `viewList` | hmn | List | Daim ntawv teev | 2026-11-15 | machine-drafted, needs native review |
| `viewMap` | hmn | Map | Daim ntawv qhia chaw | 2026-11-15 | machine-drafted, needs native review |
| `bulkApprove` | hmn | Bulk approve high-confidence ({count}) | Pom zoo ib zaug rau cov ntseeg tau siab ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `confirm` | hmn | Confirm | Paub meej | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | hmn | Cancel | Tso tseg | 2026-11-15 | machine-drafted, needs native review |
| `tryAgain` | hmn | Try again | Sim dua | 2026-11-15 | machine-drafted, needs native review |
| `queueLoadFailed` | hmn | Could not load the review queue. | Rub tsis tau kab tos tshuaj xyuas. | 2026-11-15 | machine-drafted, needs native review |
| `approveFailed` | hmn | Could not approve {name}. It is still in the queue. | Pom zoo tsis tau rau {name}. Nws tseem nyob hauv kab tos. | 2026-11-15 | machine-drafted, needs native review |
| `rejectFailed` | hmn | Could not reject {name}. It is still in the queue. | Tsis lees tsis tau rau {name}. Nws tseem nyob hauv kab tos. | 2026-11-15 | machine-drafted, needs native review |
| `emptyTitle` | hmn | No pending items | Tsis muaj dab tsi tos | 2026-11-15 | machine-drafted, needs native review |
| `emptyBody` | hmn | Use the discovery input above to source new resources. | Siv lub thawv nrhiav saum toj no los nrhiav cov kev pab tshiab. | 2026-11-15 | machine-drafted, needs native review |
| `confidenceHigh` | hmn | High confidence | Ntseeg tau siab | 2026-11-15 | machine-drafted, needs native review |
| `confidenceMedium` | hmn | Medium confidence | Ntseeg tau nruab nrab | 2026-11-15 | machine-drafted, needs native review |
| `needsLocation` | hmn | Needs location | Xav tau qhov chaw | 2026-11-15 | machine-drafted, needs native review |
| `itemDetails` | hmn | Details | Ntxiv ntxaws | 2026-11-15 | machine-drafted, needs native review |
| `provenanceVerified` | hmn | .gov/.org verified | Kuaj xyuas lawm .gov/.org | 2026-11-15 | machine-drafted, needs native review |
| `phoneLine` | hmn | Phone: {phone} | Xov tooj: {phone} | 2026-11-15 | machine-drafted, needs native review |
| `categoryLine` | hmn | Category: {category} | Pawg: {category} | 2026-11-15 | machine-drafted, needs native review |
| `approve` | hmn | Approve | Pom zoo | 2026-11-15 | machine-drafted, needs native review |
| `reject` | hmn | Reject | Tsis lees | 2026-11-15 | machine-drafted, needs native review |
| `paRequired` | hmn | Platform admin approval required | Yuav tsum tau tus thawj tswj platform pom zoo | 2026-11-15 | machine-drafted, needs native review |
| `approvedStatus` | hmn | {name} was approved. | Pom zoo rau {name} lawm. | 2026-11-15 | machine-drafted, needs native review |
| `rejectedStatus` | hmn | {name} was rejected. | Tsis lees {name} lawm. | 2026-11-15 | machine-drafted, needs native review |
| `dialogTitleApprove` | hmn | Review and confirm resource | Tshuaj xyuas thiab lees paub qhov kev pab | 2026-11-15 | machine-drafted, needs native review |
| `dialogTitleEdit` | hmn | Edit resource | Kho qhov kev pab | 2026-11-15 | machine-drafted, needs native review |
| `dialogDescApprove` | hmn | Edit any field before approving. Confirm saves your changes and publishes this resource in one step. | Kho txhua qhov chaw ua ntej pom zoo. Paub meej yuav khaws koj cov kev hloov thiab tshaj tawm qhov kev pab no ib zaug. | 2026-11-15 | machine-drafted, needs native review |
| `dialogDescEdit` | hmn | Changes persist to the resources table and are recorded with your admin identity. | Cov kev hloov raug khaws rau hauv lub rooj kev pab thiab sau npe nrog koj tus kheej tus thawj tswj. | 2026-11-15 | machine-drafted, needs native review |
| `fieldName` | hmn | Name | Npe | 2026-11-15 | machine-drafted, needs native review |
| `fieldDescription` | hmn | Description | Piav qhia | 2026-11-15 | machine-drafted, needs native review |
| `fieldCategory` | hmn | Category | Pawg | 2026-11-15 | machine-drafted, needs native review |
| `fieldStatus` | hmn | Status | Xwm txheej | 2026-11-15 | machine-drafted, needs native review |
| `fieldServiceMode` | hmn | Service mode | Hom kev pab cuam | 2026-11-15 | machine-drafted, needs native review |
| `fieldAddress` | hmn | Address | Chaw nyob | 2026-11-15 | machine-drafted, needs native review |
| `fieldCity` | hmn | City | Nroog | 2026-11-15 | machine-drafted, needs native review |
| `fieldState` | hmn | State | Xeev | 2026-11-15 | machine-drafted, needs native review |
| `fieldZip` | hmn | ZIP | Tus lej xa ntawv | 2026-11-15 | machine-drafted, needs native review |
| `fieldPhone` | hmn | Phone | Xov tooj | 2026-11-15 | machine-drafted, needs native review |
| `fieldEmail` | hmn | Email | Email | 2026-11-15 | machine-drafted, needs native review |
| `fieldWebsite` | hmn | Website | Lub vev xaib | 2026-11-15 | machine-drafted, needs native review |
| `required` | hmn | required | yuav tsum muaj | 2026-11-15 | machine-drafted, needs native review |
| `statusApproved` | hmn | Approved | Pom zoo lawm | 2026-11-15 | machine-drafted, needs native review |
| `statusPending` | hmn | Pending | Tab tom tos | 2026-11-15 | machine-drafted, needs native review |
| `statusRejected` | hmn | Rejected | Tsis lees lawm | 2026-11-15 | machine-drafted, needs native review |
| `statusArchived` | hmn | Archived | Muab khaws cia | 2026-11-15 | machine-drafted, needs native review |
| `modePhysical` | hmn | Physical location | Qhov chaw tiag | 2026-11-15 | machine-drafted, needs native review |
| `modeOnline` | hmn | Online only | Hauv online xwb | 2026-11-15 | machine-drafted, needs native review |
| `modeHybrid` | hmn | Hybrid (physical + online) | Sib xyaw (tuaj ntsib + online) | 2026-11-15 | machine-drafted, needs native review |
| `onlineHint` | hmn | Online resources are not geocoded or placed on the map. | Cov kev pab online tsis muab cim qhov chaw thiab tsis muab tso rau daim ntawv qhia chaw. | 2026-11-15 | machine-drafted, needs native review |
| `needsLocationLong` | hmn | Needs location — not shown on the map. Enter an address and pick a suggestion to place it. | Xav tau qhov chaw — tsis pom rau daim ntawv qhia chaw. Sau ib qho chaw nyob thiab xaiv ib qho lus qhia los muab tso. | 2026-11-15 | machine-drafted, needs native review |
| `addressPlaceholder` | hmn | Start typing an address… | Pib ntaus qhov chaw nyob… | 2026-11-15 | machine-drafted, needs native review |
| `addressSuggestions` | hmn | Address suggestions | Cov chaw nyob uas qhia | 2026-11-15 | machine-drafted, needs native review |
| `nameRequired` | hmn | Name is required. | Yuav tsum muaj npe. | 2026-11-15 | machine-drafted, needs native review |
| `categoryRequired` | hmn | Category is required. | Yuav tsum muaj pawg. | 2026-11-15 | machine-drafted, needs native review |
| `statusRequired` | hmn | Status is required. | Yuav tsum muaj xwm txheej. | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | hmn | Could not save the resource. Your changes are still in the form. | Khaws tsis tau qhov kev pab. Koj cov kev hloov tseem nyob hauv daim ntawv. | 2026-11-15 | machine-drafted, needs native review |
| `confirmFailed` | hmn | Could not save and approve the resource. Your changes are still in the form. | Khaws thiab pom zoo tsis tau qhov kev pab. Koj cov kev hloov tseem nyob hauv daim ntawv. | 2026-11-15 | machine-drafted, needs native review |
| `saving` | hmn | Saving… | Tab tom khaws… | 2026-11-15 | machine-drafted, needs native review |
| `confirming` | hmn | Confirming… | Tab tom lees paub… | 2026-11-15 | machine-drafted, needs native review |
| `saveChanges` | hmn | Save changes | Khaws cov kev hloov | 2026-11-15 | machine-drafted, needs native review |
| `close` | hmn | Close | Kaw | 2026-11-15 | machine-drafted, needs native review |
| `stateAll` | hmn | All states | Txhua lub xeev | 2026-11-15 | machine-drafted, needs native review |
| `cityPlaceholder` | hmn | e.g. Burlington | piv txwv Burlington | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | hmn | Search name / description | Nrhiav npe / piav qhia | 2026-11-15 | machine-drafted, needs native review |
| `searchPlaceholder` | hmn | e.g. food bank | piv txwv chaw pub zaub mov | 2026-11-15 | machine-drafted, needs native review |
| `applyFilters` | hmn | Apply filters | Siv cov lim | 2026-11-15 | machine-drafted, needs native review |
| `loading` | hmn | Loading… | Tab tom rub… | 2026-11-15 | machine-drafted, needs native review |
| `approvedTitle` | hmn | Approved resources | Cov kev pab pom zoo lawm | 2026-11-15 | machine-drafted, needs native review |
| `showing` | hmn | — showing {count} | — qhia {count} | 2026-11-15 | machine-drafted, needs native review |
| `moreAvailable` | hmn | (more available) | (tseem muaj ntxiv) | 2026-11-15 | machine-drafted, needs native review |
| `showMap` | hmn | Show map | Qhia daim ntawv qhia chaw | 2026-11-15 | machine-drafted, needs native review |
| `hideMap` | hmn | Hide map | Zais daim ntawv qhia chaw | 2026-11-15 | machine-drafted, needs native review |
| `listLoadFailed` | hmn | Could not load resources. | Rub tsis tau cov kev pab. | 2026-11-15 | machine-drafted, needs native review |
| `moreLoadFailed` | hmn | Could not load more resources. | Rub tsis tau cov kev pab ntxiv. | 2026-11-15 | machine-drafted, needs native review |
| `noMatchTitle` | hmn | No resources match these filters | Tsis muaj kev pab twg haum cov lim no | 2026-11-15 | machine-drafted, needs native review |
| `noMatchBody` | hmn | Adjust the state, city, or search and apply again. | Hloov lub xeev, lub nroog, lossis kev nrhiav thiab siv dua. | 2026-11-15 | machine-drafted, needs native review |
| `saved` | hmn | Saved | Khaws lawm | 2026-11-15 | machine-drafted, needs native review |
| `savedStatus` | hmn | Changes to {name} were saved. | Khaws cov kev hloov rau {name} lawm. | 2026-11-15 | machine-drafted, needs native review |
| `editResource` | hmn | Edit resource | Kho qhov kev pab | 2026-11-15 | machine-drafted, needs native review |
| `loadMore` | hmn | Load more | Rub ntxiv | 2026-11-15 | machine-drafted, needs native review |
| `noticeResourceNotFound` | hmn | That resource couldn't be found, or it isn't editable here (only approved resources are listed in Manage). | Nrhiav tsis tau qhov kev pab ntawd, lossis kho tsis tau ntawm no (Kev Tswj tsuas teev cov kev pab pom zoo lawm xwb). | 2026-11-15 | machine-drafted, needs native review |
| `noticeBusinessNotFound` | hmn | That business couldn't be found, or it isn't editable here (only approved businesses can be edited). | Nrhiav tsis tau lub lag luam ntawd, lossis kho tsis tau ntawm no (tsuas kho tau cov lag luam pom zoo lawm xwb). | 2026-11-15 | machine-drafted, needs native review |
| `noticeResourceNotEditable` | hmn | Your admin role can't edit resources. | Koj lub luag haujlwm thawj tswj kho tsis tau cov kev pab. | 2026-11-15 | machine-drafted, needs native review |
| `noticeBusinessNotEditable` | hmn | Only platform admins can edit businesses. | Tsuas yog cov thawj tswj platform thiaj kho tau cov lag luam. | 2026-11-15 | machine-drafted, needs native review |
| `dismiss` | hmn | Dismiss | Muab tshem | 2026-11-15 | machine-drafted, needs native review |
| `awaitingTitle` | hmn | Awaiting review | Tos tshuaj xyuas | 2026-11-15 | machine-drafted, needs native review |
| `noPending` | hmn | No businesses awaiting review. | Tsis muaj lag luam twg tos tshuaj xyuas. | 2026-11-15 | machine-drafted, needs native review |
| `rejectReasonLabel` | hmn | Reason if you reject (optional, shown to the submitter) | Vim li cas yog tias koj tsis lees (xaiv tau, tus xa yuav pom) | 2026-11-15 | machine-drafted, needs native review |
| `approvedBusinessesTitle` | hmn | Approved businesses | Cov lag luam pom zoo lawm | 2026-11-15 | machine-drafted, needs native review |
| `approvedBusinessesCount` | hmn | Approved businesses ({count}) | Cov lag luam pom zoo lawm ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `noApproved` | hmn | No approved businesses yet. | Tseem tsis tau muaj lag luam pom zoo. | 2026-11-15 | machine-drafted, needs native review |
| `save` | hmn | Save | Khaws | 2026-11-15 | machine-drafted, needs native review |
| `pendingLoadFailed` | hmn | Could not load the businesses awaiting review. | Rub tsis tau cov lag luam tos tshuaj xyuas. | 2026-11-15 | machine-drafted, needs native review |
| `approvedLoadFailed` | hmn | Could not load the approved businesses. | Rub tsis tau cov lag luam pom zoo lawm. | 2026-11-15 | machine-drafted, needs native review |
| `businessApproveFailed` | hmn | Could not approve {name}. | Pom zoo tsis tau rau {name}. | 2026-11-15 | machine-drafted, needs native review |
| `businessRejectFailed` | hmn | Could not reject {name}. | Tsis lees tsis tau rau {name}. | 2026-11-15 | machine-drafted, needs native review |
| `businessSaveFailed` | hmn | Could not save {name}. Your changes are still in the form. | Khaws tsis tau {name}. Koj cov kev hloov tseem nyob hauv daim ntawv. | 2026-11-15 | machine-drafted, needs native review |
| `businessNotSaved` | hmn | Nothing was saved: this business was not changed. Only platform admins can edit businesses, or it no longer exists. | Tsis tau khaws dab tsi: lub lag luam no tsis hloov. Tsuas yog cov thawj tswj platform thiaj kho tau cov lag luam, lossis nws tsis muaj lawm. | 2026-11-15 | machine-drafted, needs native review |
| `STAGED_CANDIDATES.other` | ht | Staged {n} candidates for review | {n} kandida prepare pou revizyon | 2026-11-15 | machine-drafted, needs native review |
| `STAGED_CANDIDATES.one` | so | Staged {n} candidate for review | {n} musharax ayaa loo diyaariyey dib-u-eegis | 2026-11-15 | machine-drafted, needs native review |
| `STAGED_CANDIDATES.other` | so | Staged {n} candidates for review | {n} musharax ayaa loo diyaariyey dib-u-eegis | 2026-11-15 | machine-drafted, needs native review |
| `STAGED_CANDIDATES.one` | am | Staged {n} candidate for review | {n} እጩ ለግምገማ ተዘጋጅቷል | 2026-11-15 | machine-drafted, needs native review |
| `STAGED_CANDIDATES.other` | am | Staged {n} candidates for review | {n} እጩዎች ለግምገማ ተዘጋጅተዋል | 2026-11-15 | machine-drafted, needs native review |
| `STAGED_CANDIDATES.other` | hmn | Staged {n} candidates for review | Npaj {n} yam tos tshuaj xyuas lawm | 2026-11-15 | machine-drafted, needs native review |
| `REJECTED_BY_FILTER.other` | ht | {n} rejected by provenance filter | {n} rejte pa filt orijin nan | 2026-11-15 | machine-drafted, needs native review |
| `REJECTED_BY_FILTER.other` | so | {n} rejected by provenance filter | {n} waxa diiday shaandhada isha | 2026-11-15 | machine-drafted, needs native review |
| `REJECTED_BY_FILTER.other` | am | {n} rejected by provenance filter | {n} በምንጭ ማጣሪያ ውድቅ ተደርገዋል | 2026-11-15 | machine-drafted, needs native review |
| `REJECTED_BY_FILTER.other` | hmn | {n} rejected by provenance filter | {n} raug lub lim keeb kwm tsis lees | 2026-11-15 | machine-drafted, needs native review |
| `SOURCE_COUNT.other` | ht | {n} sources | {n} sous | 2026-11-15 | machine-drafted, needs native review |
| `SOURCE_COUNT.one` | so | {n} source | {n} il | 2026-11-15 | machine-drafted, needs native review |
| `SOURCE_COUNT.other` | so | {n} sources | {n} ilo | 2026-11-15 | machine-drafted, needs native review |
| `SOURCE_COUNT.one` | am | {n} source | {n} ምንጭ | 2026-11-15 | machine-drafted, needs native review |
| `SOURCE_COUNT.other` | am | {n} sources | {n} ምንጮች | 2026-11-15 | machine-drafted, needs native review |
| `SOURCE_COUNT.other` | hmn | {n} sources | {n} qhov chaw los | 2026-11-15 | machine-drafted, needs native review |
| `BULK_CONFIRM.other` | ht | Approve {n} high-confidence items? | Apwouve {n} eleman ki gen gwo konfyans? | 2026-11-15 | machine-drafted, needs native review |
| `BULK_CONFIRM.other` | so | Approve {n} high-confidence items? | Ma ansixinaysaa {n} shay oo kalsooni sare leh? | 2026-11-15 | machine-drafted, needs native review |
| `BULK_CONFIRM.one` | am | Approve {n} high-confidence item? | {n} ከፍተኛ እምነት ያለው ነገር ይጽደቅ? | 2026-11-15 | machine-drafted, needs native review |
| `BULK_CONFIRM.other` | am | Approve {n} high-confidence items? | {n} ከፍተኛ እምነት ያላቸው ነገሮች ይጽደቁ? | 2026-11-15 | machine-drafted, needs native review |
| `BULK_CONFIRM.other` | hmn | Approve {n} high-confidence items? | Pom zoo rau {n} yam uas ntseeg tau siab? | 2026-11-15 | machine-drafted, needs native review |
| `BULK_DONE.other` | ht | {n} items approved. | {n} eleman apwouve. | 2026-11-15 | machine-drafted, needs native review |
| `BULK_DONE.other` | so | {n} items approved. | {n} shay ayaa la ansixiyey. | 2026-11-15 | machine-drafted, needs native review |
| `BULK_DONE.one` | am | {n} item approved. | {n} ነገር ጸድቋል። | 2026-11-15 | machine-drafted, needs native review |
| `BULK_DONE.other` | am | {n} items approved. | {n} ነገሮች ጸድቀዋል። | 2026-11-15 | machine-drafted, needs native review |
| `BULK_DONE.other` | hmn | {n} items approved. | Pom zoo {n} yam lawm. | 2026-11-15 | machine-drafted, needs native review |

### `lib/i18n-admin-shell.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `organizer` | ht | Organizer | Òganizatè | 2026-11-15 | machine-drafted, needs native review |
| `organization` | ht | Organization | Òganizasyon | 2026-11-15 | machine-drafted, needs native review |
| `allOrganizations` | ht | All Organizations | Tout òganizasyon yo | 2026-11-15 | machine-drafted, needs native review |
| `sections` | ht | Admin sections | Seksyon administrasyon | 2026-11-15 | machine-drafted, needs native review |
| `tabOverview` | ht | Overview | Apèsi | 2026-11-15 | machine-drafted, needs native review |
| `tabEvents` | ht | Events | Evènman | 2026-11-15 | machine-drafted, needs native review |
| `tabModeration` | ht | Moderation | Moderasyon | 2026-11-15 | machine-drafted, needs native review |
| `tabCommunity` | ht | Community | Kominote | 2026-11-15 | machine-drafted, needs native review |
| `tabOrganizations` | ht | Organizations | Òganizasyon yo | 2026-11-15 | machine-drafted, needs native review |
| `tabResources` | ht | Resources | Resous | 2026-11-15 | machine-drafted, needs native review |
| `tabBusinesses` | ht | Businesses | Biznis | 2026-11-15 | machine-drafted, needs native review |
| `tabManage` | ht | Manage | Jere | 2026-11-15 | machine-drafted, needs native review |
| `tabPeople` | ht | People | Moun | 2026-11-15 | machine-drafted, needs native review |
| `organizer` | so | Organizer | Abaabule | 2026-11-15 | machine-drafted, needs native review |
| `organization` | so | Organization | Urur | 2026-11-15 | machine-drafted, needs native review |
| `allOrganizations` | so | All Organizations | Dhammaan ururada | 2026-11-15 | machine-drafted, needs native review |
| `sections` | so | Admin sections | Qaybaha maamulka | 2026-11-15 | machine-drafted, needs native review |
| `tabOverview` | so | Overview | Guudmar | 2026-11-15 | machine-drafted, needs native review |
| `tabEvents` | so | Events | Dhacdooyin | 2026-11-15 | machine-drafted, needs native review |
| `tabModeration` | so | Moderation | Dib-u-eegis | 2026-11-15 | machine-drafted, needs native review |
| `tabCommunity` | so | Community | Bulshada | 2026-11-15 | machine-drafted, needs native review |
| `tabOrganizations` | so | Organizations | Ururada | 2026-11-15 | machine-drafted, needs native review |
| `tabResources` | so | Resources | Kheyraadka | 2026-11-15 | machine-drafted, needs native review |
| `tabBusinesses` | so | Businesses | Ganacsiyada | 2026-11-15 | machine-drafted, needs native review |
| `tabManage` | so | Manage | Maamul | 2026-11-15 | machine-drafted, needs native review |
| `tabPeople` | so | People | Dadka | 2026-11-15 | machine-drafted, needs native review |
| `organizer` | am | Organizer | አደራጅ | 2026-11-15 | machine-drafted, needs native review |
| `organization` | am | Organization | ድርጅት | 2026-11-15 | machine-drafted, needs native review |
| `allOrganizations` | am | All Organizations | ሁሉም ድርጅቶች | 2026-11-15 | machine-drafted, needs native review |
| `sections` | am | Admin sections | የአስተዳደር ክፍሎች | 2026-11-15 | machine-drafted, needs native review |
| `tabOverview` | am | Overview | አጠቃላይ እይታ | 2026-11-15 | machine-drafted, needs native review |
| `tabEvents` | am | Events | ዝግጅቶች | 2026-11-15 | machine-drafted, needs native review |
| `tabModeration` | am | Moderation | ቁጥጥር | 2026-11-15 | machine-drafted, needs native review |
| `tabCommunity` | am | Community | ማህበረሰብ | 2026-11-15 | machine-drafted, needs native review |
| `tabOrganizations` | am | Organizations | ድርጅቶች | 2026-11-15 | machine-drafted, needs native review |
| `tabResources` | am | Resources | ሀብቶች | 2026-11-15 | machine-drafted, needs native review |
| `tabBusinesses` | am | Businesses | ንግዶች | 2026-11-15 | machine-drafted, needs native review |
| `tabManage` | am | Manage | አስተዳድር | 2026-11-15 | machine-drafted, needs native review |
| `tabPeople` | am | People | ሰዎች | 2026-11-15 | machine-drafted, needs native review |
| `organizer` | hmn | Organizer | Tus npaj | 2026-11-15 | machine-drafted, needs native review |
| `organization` | hmn | Organization | Koom haum | 2026-11-15 | machine-drafted, needs native review |
| `allOrganizations` | hmn | All Organizations | Txhua lub koom haum | 2026-11-15 | machine-drafted, needs native review |
| `sections` | hmn | Admin sections | Cov ntu tswj | 2026-11-15 | machine-drafted, needs native review |
| `tabOverview` | hmn | Overview | Saib tag nrho | 2026-11-15 | machine-drafted, needs native review |
| `tabEvents` | hmn | Events | Cov kev tshwm sim | 2026-11-15 | machine-drafted, needs native review |
| `tabModeration` | hmn | Moderation | Kev tswj xyuas | 2026-11-15 | machine-drafted, needs native review |
| `tabCommunity` | hmn | Community | Zej zog | 2026-11-15 | machine-drafted, needs native review |
| `tabOrganizations` | hmn | Organizations | Cov koom haum | 2026-11-15 | machine-drafted, needs native review |
| `tabResources` | hmn | Resources | Cov peev txheej | 2026-11-15 | machine-drafted, needs native review |
| `tabBusinesses` | hmn | Businesses | Cov lag luam | 2026-11-15 | machine-drafted, needs native review |
| `tabManage` | hmn | Manage | Tswj | 2026-11-15 | machine-drafted, needs native review |
| `tabPeople` | hmn | People | Neeg | 2026-11-15 | machine-drafted, needs native review |

### `lib/i18n-assistant.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `greetingTitle` | ht | Hi, This is Feed. | Bonjou, se Feed. | 2026-11-15 | machine-drafted, needs native review |
| `greetingSubtitle` | ht | What can we help you gather today? | Kisa nou ka ede w rasanble jodi a? | 2026-11-15 | machine-drafted, needs native review |
| `cardResourcesTitle` | ht | Find Resources | Jwenn resous | 2026-11-15 | machine-drafted, needs native review |
| `cardResourcesBody` | ht | Discover local food banks, housing assistance, healthcare, and more near you. | Dekouvri bank manje, èd pou lojman, swen sante ak plis toupre w. | 2026-11-15 | machine-drafted, needs native review |
| `cardEligibilityTitle` | ht | Check Eligibility | Verifye kalifikasyon | 2026-11-15 | machine-drafted, needs native review |
| `cardEligibilityBody` | ht | See what benefits programs you may qualify for based on your situation. | Gade ki pwogram benefis ou ka kalifye pou yo selon sitiyasyon w. | 2026-11-15 | machine-drafted, needs native review |
| `cardFormsTitle` | ht | Get Help with Forms | Jwenn èd ak fòm | 2026-11-15 | machine-drafted, needs native review |
| `cardFormsBody` | ht | Get guided help understanding and completing benefit applications. | Jwenn èd gide pou konprann epi ranpli aplikasyon pou benefis. | 2026-11-15 | machine-drafted, needs native review |
| `signInPrompt` | ht | Please {link} to chat with FEED Assistant. | Tanpri {link} pou w pale ak Asistan FEED. | 2026-11-15 | machine-drafted, needs native review |
| `signInLink` | ht | sign in | konekte | 2026-11-15 | machine-drafted, needs native review |
| `reconnecting` | ht | Reconnecting… | Ap rekonekte… | 2026-11-15 | machine-drafted, needs native review |
| `retrying` | ht | Retrying… | Ap eseye ankò… | 2026-11-15 | machine-drafted, needs native review |
| `inputPlaceholder` | ht | Ask me anything about benefits, resources, or assistance... | Mande m nenpòt bagay sou benefis, resous oswa èd... | 2026-11-15 | machine-drafted, needs native review |
| `inputPlaceholderGuest` | ht | Sign in to start chatting... | Konekte pou kòmanse pale... | 2026-11-15 | machine-drafted, needs native review |
| `replyPlaceholder` | ht | Type your message... | Ekri mesaj ou... | 2026-11-15 | machine-drafted, needs native review |
| `sendMessage` | ht | Send message | Voye mesaj | 2026-11-15 | machine-drafted, needs native review |
| `stopResponse` | ht | Stop response | Kanpe repons lan | 2026-11-15 | machine-drafted, needs native review |
| `tagFindResources` | ht | Find resources | Jwenn resous | 2026-11-15 | machine-drafted, needs native review |
| `tagEligibility` | ht | Program Eligibility | Kalifikasyon pou pwogram | 2026-11-15 | machine-drafted, needs native review |
| `tagFood` | ht | Food | Manje | 2026-11-15 | machine-drafted, needs native review |
| `tagSocialServices` | ht | Social Services | Sèvis sosyal | 2026-11-15 | machine-drafted, needs native review |
| `tagHealthcare` | ht | Healthcare | Swen sante | 2026-11-15 | machine-drafted, needs native review |
| `replyFindMore` | ht | Find more resources | Jwenn plis resous | 2026-11-15 | machine-drafted, needs native review |
| `replyDirections` | ht | Get directions | Jwenn direksyon | 2026-11-15 | machine-drafted, needs native review |
| `replyEligibility` | ht | Check my eligibility | Verifye kalifikasyon mwen | 2026-11-15 | machine-drafted, needs native review |
| `replyTalk` | ht | Talk to someone | Pale ak yon moun | 2026-11-15 | machine-drafted, needs native review |
| `resourceApply` | ht | Apply | Aplike | 2026-11-15 | machine-drafted, needs native review |
| `resourceVisit` | ht | Visit | Vizite | 2026-11-15 | machine-drafted, needs native review |
| `resourceDirections` | ht | Directions | Direksyon | 2026-11-15 | machine-drafted, needs native review |
| `resourceSave` | ht | Save | Anrejistre | 2026-11-15 | machine-drafted, needs native review |
| `resourceSaving` | ht | Saving… | Ap anrejistre… | 2026-11-15 | machine-drafted, needs native review |
| `resourceSaved` | ht | Saved | Li anrejistre | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | ht | Could not save {name}. Please try again. | Nou pa t ka anrejistre {name}. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `viaModel` | ht | via {model} | pa {model} | 2026-11-15 | machine-drafted, needs native review |
| `flowCancel` | ht | Cancel | Anile | 2026-11-15 | machine-drafted, needs native review |
| `flowContinue` | ht | Continue | Kontinye | 2026-11-15 | machine-drafted, needs native review |
| `flowProcessing` | ht | Processing… | Ap trete… | 2026-11-15 | machine-drafted, needs native review |
| `flowDone` | ht | Done | Fini | 2026-11-15 | machine-drafted, needs native review |
| `flowBack` | ht | Back | Retounen | 2026-11-15 | machine-drafted, needs native review |
| `flowStep` | ht | Step {current} of {total} | Etap {current} sou {total} | 2026-11-15 | machine-drafted, needs native review |
| `rfName` | ht | Find Resources | Jwenn resous | 2026-11-15 | machine-drafted, needs native review |
| `rfDescription` | ht | Find food, housing, healthcare, and other resources near you | Jwenn manje, lojman, swen sante ak lòt resous toupre w | 2026-11-15 | machine-drafted, needs native review |
| `rfCategoryQ` | ht | What type of help are you looking for? | Ki kalite èd w ap chèche? | 2026-11-15 | machine-drafted, needs native review |
| `rfFood` | ht | Food Assistance | Èd pou manje | 2026-11-15 | machine-drafted, needs native review |
| `rfHousing` | ht | Housing & Shelter | Lojman ak abri | 2026-11-15 | machine-drafted, needs native review |
| `rfHealthcare` | ht | Healthcare | Swen sante | 2026-11-15 | machine-drafted, needs native review |
| `rfUtilities` | ht | Utilities (Electric, Gas, Water) | Sèvis piblik (kouran, gaz, dlo) | 2026-11-15 | machine-drafted, needs native review |
| `rfEmployment` | ht | Employment & Job Training | Travay ak fòmasyon pou travay | 2026-11-15 | machine-drafted, needs native review |
| `rfFamily` | ht | Childcare & Family Services | Gadri ak sèvis pou fanmi | 2026-11-15 | machine-drafted, needs native review |
| `rfLegal` | ht | Legal Aid | Èd legal | 2026-11-15 | machine-drafted, needs native review |
| `rfMentalHealth` | ht | Mental Health | Sante mantal | 2026-11-15 | machine-drafted, needs native review |
| `rfOther` | ht | Other | Lòt | 2026-11-15 | machine-drafted, needs native review |
| `rfUrgencyQ` | ht | How urgent is your need? | Ki jan bezwen ou ijan? | 2026-11-15 | machine-drafted, needs native review |
| `rfImmediate` | ht | Immediate (today) | Touswit (jodi a) | 2026-11-15 | machine-drafted, needs native review |
| `rfThisWeek` | ht | This week | Semèn sa a | 2026-11-15 | machine-drafted, needs native review |
| `rfMonth` | ht | Within a month | Nan yon mwa | 2026-11-15 | machine-drafted, needs native review |
| `rfExploring` | ht | Just exploring options | M ap gade opsyon yo sèlman | 2026-11-15 | machine-drafted, needs native review |
| `rfLocationQ` | ht | What is your zip code or city? | Ki kòd postal oswa vil ou? | 2026-11-15 | machine-drafted, needs native review |
| `rfLocationPh` | ht | Enter zip code or city name | Antre kòd postal la oswa non vil la | 2026-11-15 | machine-drafted, needs native review |
| `rfAdditionalQ` | ht | Anything else we should know? (optional) | Èske gen lòt bagay nou ta dwe konnen? (si ou vle) | 2026-11-15 | machine-drafted, needs native review |
| `rfAdditionalPh` | ht | E.g., family size, specific requirements, accessibility needs | Pa egzanp: kantite moun nan fanmi an, egzijans espesyal, bezwen aksè | 2026-11-15 | machine-drafted, needs native review |
| `ecName` | ht | Check Eligibility | Verifye kalifikasyon | 2026-11-15 | machine-drafted, needs native review |
| `ecDescription` | ht | See what benefits programs you may qualify for | Gade ki pwogram benefis ou ka kalifye pou yo | 2026-11-15 | machine-drafted, needs native review |
| `ecHouseholdQ` | ht | How many people live in your household (including yourself)? | Konbyen moun ki rete lakay ou (avè w ladan l)? | 2026-11-15 | machine-drafted, needs native review |
| `ecJustMe` | ht | 1 (just me) | 1 (se mwen sèlman) | 2026-11-15 | machine-drafted, needs native review |
| `ecChildrenQ` | ht | Are there any children under 18 in your household? | Èske gen timoun ki poko gen 18 an lakay ou? | 2026-11-15 | machine-drafted, needs native review |
| `optYes` | ht | Yes | Wi | 2026-11-15 | machine-drafted, needs native review |
| `optNo` | ht | No | Non | 2026-11-15 | machine-drafted, needs native review |
| `ecAgesQ` | ht | What are the ages of the children? | Ki laj timoun yo? | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeInfant` | ht | Under 1 year | Mwens pase 1 an | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeToddler` | ht | 1-5 years | 1 a 5 an | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeChild` | ht | 6-12 years | 6 a 12 an | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeTeen` | ht | 13-17 years | 13 a 17 an | 2026-11-15 | machine-drafted, needs native review |
| `ecPregnantQ` | ht | Is anyone in the household currently pregnant? | Èske gen yon moun lakay ou ki ansent kounye a? | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeQ` | ht | What is your approximate monthly household income (before taxes)? | Konbyen kòb fanmi an fè pa mwa apeprè (anvan taks)? | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeNone` | ht | No income | Pa gen revni | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeUnder` | ht | Under {amount} | Mwens pase {amount} | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeRange` | ht | {from} - {to} | Ant {from} ak {to} | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeOver` | ht | Over {amount} | Plis pase {amount} | 2026-11-15 | machine-drafted, needs native review |
| `ecEmploymentQ` | ht | What is your current employment status? | Ki sitiyasyon travay ou kounye a? | 2026-11-15 | machine-drafted, needs native review |
| `ecFullTime` | ht | Employed full-time | Travay aplentan | 2026-11-15 | machine-drafted, needs native review |
| `ecPartTime` | ht | Employed part-time | Travay a tan pasyèl | 2026-11-15 | machine-drafted, needs native review |
| `ecSelfEmployed` | ht | Self-employed | Travay pou tèt mwen | 2026-11-15 | machine-drafted, needs native review |
| `ecUnemployedLooking` | ht | Unemployed - looking for work | San travay - m ap chèche | 2026-11-15 | machine-drafted, needs native review |
| `ecUnemployedNotLooking` | ht | Unemployed - not looking | San travay - m pa ap chèche | 2026-11-15 | machine-drafted, needs native review |
| `ecDisability` | ht | Unable to work (disability) | Mwen pa ka travay (andikap) | 2026-11-15 | machine-drafted, needs native review |
| `ecRetired` | ht | Retired | Pran retrèt | 2026-11-15 | machine-drafted, needs native review |
| `ecStudent` | ht | Student | Elèv oswa etidyan | 2026-11-15 | machine-drafted, needs native review |
| `ecBenefitsQ` | ht | Are you currently receiving any benefits? (select all that apply) | Èske w ap resevwa benefis kounye a? (chwazi tout sa ki aplike) | 2026-11-15 | machine-drafted, needs native review |
| `ecSnap` | ht | SNAP (Food Stamps) | SNAP (koupon manje) | 2026-11-15 | machine-drafted, needs native review |
| `ecMedicaid` | ht | Medicaid | Medicaid | 2026-11-15 | machine-drafted, needs native review |
| `ecMedicare` | ht | Medicare | Medicare | 2026-11-15 | machine-drafted, needs native review |
| `ecSsi` | ht | SSI/SSDI | SSI/SSDI | 2026-11-15 | machine-drafted, needs native review |
| `ecTanf` | ht | TANF | TANF | 2026-11-15 | machine-drafted, needs native review |
| `ecWic` | ht | WIC | WIC | 2026-11-15 | machine-drafted, needs native review |
| `ecHousingAssistance` | ht | Housing assistance | Èd pou lojman | 2026-11-15 | machine-drafted, needs native review |
| `ecNone` | ht | None of these | Okenn nan yo | 2026-11-15 | machine-drafted, needs native review |
| `ecStateQ` | ht | What state do you live in? Use its 2-letter code. | Nan ki eta ou rete? Sèvi ak kòd 2 lèt li. | 2026-11-15 | machine-drafted, needs native review |
| `ecStatePh` | ht | For example: CA, NY, VT | Pa egzanp: CA, NY, VT | 2026-11-15 | machine-drafted, needs native review |
| `stateNotRecognised` | ht | We couldn’t recognise the state {state}, so nothing was checked. Start Check Eligibility again and enter the 2-letter state code, for example CA, NY or VT. | Nou pa t rekonèt eta {state} la, kidonk nou pa t verifye anyen. Rekòmanse Verifye kalifikasyon epi antre kòd 2 lèt eta a, pa egzanp CA, NY oswa VT. | 2026-11-15 | machine-drafted, needs native review |
| `conversation` | ht | Conversation | Konvèsasyon | 2026-11-15 | machine-drafted, needs native review |
| `fhName` | ht | Form Help | Èd ak fòm | 2026-11-15 | machine-drafted, needs native review |
| `fhDescription` | ht | Get help understanding and completing benefit applications | Jwenn èd pou konprann epi ranpli aplikasyon pou benefis | 2026-11-15 | machine-drafted, needs native review |
| `fhFormQ` | ht | Which form or application do you need help with? | Ak ki fòm oswa aplikasyon ou bezwen èd? | 2026-11-15 | machine-drafted, needs native review |
| `fhSnap` | ht | SNAP (Food Stamps) Application | Aplikasyon SNAP (koupon manje) | 2026-11-15 | machine-drafted, needs native review |
| `fhMedicaid` | ht | Medicaid Application | Aplikasyon Medicaid | 2026-11-15 | machine-drafted, needs native review |
| `fhTanf` | ht | TANF Application | Aplikasyon TANF | 2026-11-15 | machine-drafted, needs native review |
| `fhHousing` | ht | Housing Assistance Application | Aplikasyon pou èd lojman | 2026-11-15 | machine-drafted, needs native review |
| `fhUnemployment` | ht | Unemployment Application | Aplikasyon pou chomaj | 2026-11-15 | machine-drafted, needs native review |
| `fhSsi` | ht | SSI/SSDI Application | Aplikasyon SSI/SSDI | 2026-11-15 | machine-drafted, needs native review |
| `fhOther` | ht | Other form | Lòt fòm | 2026-11-15 | machine-drafted, needs native review |
| `fhHelpQ` | ht | What kind of help do you need? | Ki kalite èd ou bezwen? | 2026-11-15 | machine-drafted, needs native review |
| `fhDocuments` | ht | Understand what documents I need | Konprann ki dokiman m bezwen | 2026-11-15 | machine-drafted, needs native review |
| `fhExplain` | ht | Explain what questions mean | Eksplike sa kesyon yo vle di | 2026-11-15 | machine-drafted, needs native review |
| `fhSection` | ht | Help with a specific section | Èd ak yon seksyon presi | 2026-11-15 | machine-drafted, needs native review |
| `fhReview` | ht | Review before I submit | Revize anvan m voye l | 2026-11-15 | machine-drafted, needs native review |
| `fhGeneral` | ht | General guidance through the form | Konsèy jeneral pou tout fòm nan | 2026-11-15 | machine-drafted, needs native review |
| `fhSectionQ` | ht | Which section are you working on? | Sou ki seksyon w ap travay? | 2026-11-15 | machine-drafted, needs native review |
| `fhSectionPh` | ht | E.g., "Income", "Household Members", "Assets" | Pa egzanp: "Revni", "Moun lakay la", "Byen" | 2026-11-15 | machine-drafted, needs native review |
| `fhQuestionQ` | ht | What is the question you need help understanding? | Ki kesyon ou bezwen èd pou konprann? | 2026-11-15 | machine-drafted, needs native review |
| `fhQuestionPh` | ht | Type or paste the question from the form | Ekri oswa kole kesyon ki nan fòm nan | 2026-11-15 | machine-drafted, needs native review |
| `fhSpecificQ` | ht | What specific question do you have about this section? | Ki kesyon presi ou genyen sou seksyon sa a? | 2026-11-15 | machine-drafted, needs native review |
| `fhSpecificPh` | ht | Describe what you're confused about | Esplike sa ki pa klè pou ou | 2026-11-15 | machine-drafted, needs native review |
| `fhStatusQ` | ht | Have you already started the application? | Èske ou deja kòmanse aplikasyon an? | 2026-11-15 | machine-drafted, needs native review |
| `fhNotStarted` | ht | No, haven't started yet | Non, m poko kòmanse | 2026-11-15 | machine-drafted, needs native review |
| `fhInProgress` | ht | Yes, partway through | Wi, m nan mitan l | 2026-11-15 | machine-drafted, needs native review |
| `fhAlmostDone` | ht | Yes, almost done | Wi, m prèske fini | 2026-11-15 | machine-drafted, needs native review |
| `greetingTitle` | so | Hi, This is Feed. | Salaan, kani waa Feed. | 2026-11-15 | machine-drafted, needs native review |
| `greetingSubtitle` | so | What can we help you gather today? | Maxaan maanta kaa caawin karnaa inaad hesho? | 2026-11-15 | machine-drafted, needs native review |
| `cardResourcesTitle` | so | Find Resources | Hel kheyraad | 2026-11-15 | machine-drafted, needs native review |
| `cardResourcesBody` | so | Discover local food banks, housing assistance, healthcare, and more near you. | Ogow bangiyada cuntada, kaalmada guryaha, daryeelka caafimaadka iyo wax kale oo kuu dhow. | 2026-11-15 | machine-drafted, needs native review |
| `cardEligibilityTitle` | so | Check Eligibility | Hubi u-qalmitaanka | 2026-11-15 | machine-drafted, needs native review |
| `cardEligibilityBody` | so | See what benefits programs you may qualify for based on your situation. | Arag barnaamijyada gargaarka ee aad u qalmi karto iyadoo lagu salaynayo xaaladdaada. | 2026-11-15 | machine-drafted, needs native review |
| `cardFormsTitle` | so | Get Help with Forms | Caawimaad foomamka | 2026-11-15 | machine-drafted, needs native review |
| `cardFormsBody` | so | Get guided help understanding and completing benefit applications. | Hel caawimaad la hagayo si aad u fahanto oo u buuxiso codsiyada gargaarka. | 2026-11-15 | machine-drafted, needs native review |
| `signInPrompt` | so | Please {link} to chat with FEED Assistant. | Fadlan {link} si aad ula sheekaysato Kaaliyaha FEED. | 2026-11-15 | machine-drafted, needs native review |
| `signInLink` | so | sign in | gal | 2026-11-15 | machine-drafted, needs native review |
| `reconnecting` | so | Reconnecting… | Dib ayaa loo xiriirayaa… | 2026-11-15 | machine-drafted, needs native review |
| `retrying` | so | Retrying… | Mar kale ayaa la isku dayayaa… | 2026-11-15 | machine-drafted, needs native review |
| `inputPlaceholder` | so | Ask me anything about benefits, resources, or assistance... | I weydii wax kasta oo ku saabsan gargaarka, kheyraadka ama caawimaadda... | 2026-11-15 | machine-drafted, needs native review |
| `inputPlaceholderGuest` | so | Sign in to start chatting... | Gal si aad u bilowdo sheekaysiga... | 2026-11-15 | machine-drafted, needs native review |
| `replyPlaceholder` | so | Type your message... | Qor fariintaada... | 2026-11-15 | machine-drafted, needs native review |
| `sendMessage` | so | Send message | Dir fariinta | 2026-11-15 | machine-drafted, needs native review |
| `stopResponse` | so | Stop response | Jooji jawaabta | 2026-11-15 | machine-drafted, needs native review |
| `tagFindResources` | so | Find resources | Hel kheyraad | 2026-11-15 | machine-drafted, needs native review |
| `tagEligibility` | so | Program Eligibility | U-qalmitaanka barnaamijka | 2026-11-15 | machine-drafted, needs native review |
| `tagFood` | so | Food | Cunto | 2026-11-15 | machine-drafted, needs native review |
| `tagSocialServices` | so | Social Services | Adeegyada bulshada | 2026-11-15 | machine-drafted, needs native review |
| `tagHealthcare` | so | Healthcare | Daryeel caafimaad | 2026-11-15 | machine-drafted, needs native review |
| `replyFindMore` | so | Find more resources | Hel kheyraad kale | 2026-11-15 | machine-drafted, needs native review |
| `replyDirections` | so | Get directions | Hel tilmaamaha jidka | 2026-11-15 | machine-drafted, needs native review |
| `replyEligibility` | so | Check my eligibility | Hubi u-qalmitaankayga | 2026-11-15 | machine-drafted, needs native review |
| `replyTalk` | so | Talk to someone | La hadal qof | 2026-11-15 | machine-drafted, needs native review |
| `resourceApply` | so | Apply | Codso | 2026-11-15 | machine-drafted, needs native review |
| `resourceVisit` | so | Visit | Booqo | 2026-11-15 | machine-drafted, needs native review |
| `resourceDirections` | so | Directions | Tilmaamaha jidka | 2026-11-15 | machine-drafted, needs native review |
| `resourceSave` | so | Save | Kaydi | 2026-11-15 | machine-drafted, needs native review |
| `resourceSaving` | so | Saving… | Waa la kaydinayaa… | 2026-11-15 | machine-drafted, needs native review |
| `resourceSaved` | so | Saved | Waa la kaydiyay | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | so | Could not save {name}. Please try again. | {name} lama kaydin karin. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `viaModel` | so | via {model} | iyadoo loo marayo {model} | 2026-11-15 | machine-drafted, needs native review |
| `flowCancel` | so | Cancel | Jooji | 2026-11-15 | machine-drafted, needs native review |
| `flowContinue` | so | Continue | Sii wad | 2026-11-15 | machine-drafted, needs native review |
| `flowProcessing` | so | Processing… | Waa la habaynayaa… | 2026-11-15 | machine-drafted, needs native review |
| `flowDone` | so | Done | Dhammaatay | 2026-11-15 | machine-drafted, needs native review |
| `flowBack` | so | Back | Dib u noqo | 2026-11-15 | machine-drafted, needs native review |
| `flowStep` | so | Step {current} of {total} | Tallaabada {current} ee {total} | 2026-11-15 | machine-drafted, needs native review |
| `rfName` | so | Find Resources | Hel kheyraad | 2026-11-15 | machine-drafted, needs native review |
| `rfDescription` | so | Find food, housing, healthcare, and other resources near you | Hel cunto, guri, daryeel caafimaad iyo kheyraad kale oo kuu dhow | 2026-11-15 | machine-drafted, needs native review |
| `rfCategoryQ` | so | What type of help are you looking for? | Caawimaad noocee ah ayaad raadinaysaa? | 2026-11-15 | machine-drafted, needs native review |
| `rfFood` | so | Food Assistance | Kaalmada cuntada | 2026-11-15 | machine-drafted, needs native review |
| `rfHousing` | so | Housing & Shelter | Guri iyo hoy | 2026-11-15 | machine-drafted, needs native review |
| `rfHealthcare` | so | Healthcare | Daryeel caafimaad | 2026-11-15 | machine-drafted, needs native review |
| `rfUtilities` | so | Utilities (Electric, Gas, Water) | Adeegyada (koronto, gaas, biyo) | 2026-11-15 | machine-drafted, needs native review |
| `rfEmployment` | so | Employment & Job Training | Shaqo iyo tababar shaqo | 2026-11-15 | machine-drafted, needs native review |
| `rfFamily` | so | Childcare & Family Services | Xannaanada carruurta iyo adeegyada qoyska | 2026-11-15 | machine-drafted, needs native review |
| `rfLegal` | so | Legal Aid | Kaalmo sharci | 2026-11-15 | machine-drafted, needs native review |
| `rfMentalHealth` | so | Mental Health | Caafimaadka maskaxda | 2026-11-15 | machine-drafted, needs native review |
| `rfOther` | so | Other | Kale | 2026-11-15 | machine-drafted, needs native review |
| `rfUrgencyQ` | so | How urgent is your need? | Baahidaadu intee bay degdeg tahay? | 2026-11-15 | machine-drafted, needs native review |
| `rfImmediate` | so | Immediate (today) | Isla markiiba (maanta) | 2026-11-15 | machine-drafted, needs native review |
| `rfThisWeek` | so | This week | Toddobaadkan | 2026-11-15 | machine-drafted, needs native review |
| `rfMonth` | so | Within a month | Bil gudaheed | 2026-11-15 | machine-drafted, needs native review |
| `rfExploring` | so | Just exploring options | Kaliya waan eegayaa doorashooyinka | 2026-11-15 | machine-drafted, needs native review |
| `rfLocationQ` | so | What is your zip code or city? | Waa maxay koodhka boostada ama magaaladaada? | 2026-11-15 | machine-drafted, needs native review |
| `rfLocationPh` | so | Enter zip code or city name | Geli koodhka boostada ama magaca magaalada | 2026-11-15 | machine-drafted, needs native review |
| `rfAdditionalQ` | so | Anything else we should know? (optional) | Ma jiraan wax kale oo ay tahay inaan ogaano? (ikhtiyaari) | 2026-11-15 | machine-drafted, needs native review |
| `rfAdditionalPh` | so | E.g., family size, specific requirements, accessibility needs | Tusaale: tirada qoyska, shuruudo gaar ah, baahiyaha gelitaanka | 2026-11-15 | machine-drafted, needs native review |
| `ecName` | so | Check Eligibility | Hubi u-qalmitaanka | 2026-11-15 | machine-drafted, needs native review |
| `ecDescription` | so | See what benefits programs you may qualify for | Arag barnaamijyada gargaarka ee aad u qalmi karto | 2026-11-15 | machine-drafted, needs native review |
| `ecHouseholdQ` | so | How many people live in your household (including yourself)? | Immisa qof ayaa ku nool qoyskaaga (adiga oo ku jira)? | 2026-11-15 | machine-drafted, needs native review |
| `ecJustMe` | so | 1 (just me) | 1 (aniga oo keliya) | 2026-11-15 | machine-drafted, needs native review |
| `ecChildrenQ` | so | Are there any children under 18 in your household? | Qoyskaaga ma ku jiraan carruur ka yar 18 sano? | 2026-11-15 | machine-drafted, needs native review |
| `optYes` | so | Yes | Haa | 2026-11-15 | machine-drafted, needs native review |
| `optNo` | so | No | Maya | 2026-11-15 | machine-drafted, needs native review |
| `ecAgesQ` | so | What are the ages of the children? | Carruurtu immisa jir bay yihiin? | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeInfant` | so | Under 1 year | Ka yar 1 sano | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeToddler` | so | 1-5 years | 1-5 sano | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeChild` | so | 6-12 years | 6-12 sano | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeTeen` | so | 13-17 years | 13-17 sano | 2026-11-15 | machine-drafted, needs native review |
| `ecPregnantQ` | so | Is anyone in the household currently pregnant? | Qoyska qof ma uur leeyahay hadda? | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeQ` | so | What is your approximate monthly household income (before taxes)? | Waa imisa qiyaas ahaan dakhliga bishii ee qoyskaaga (ka hor canshuurta)? | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeNone` | so | No income | Dakhli ma jiro | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeUnder` | so | Under {amount} | Ka yar {amount} | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeRange` | so | {from} - {to} | {from} ilaa {to} | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeOver` | so | Over {amount} | Ka badan {amount} | 2026-11-15 | machine-drafted, needs native review |
| `ecEmploymentQ` | so | What is your current employment status? | Waa maxay xaaladdaada shaqo ee hadda? | 2026-11-15 | machine-drafted, needs native review |
| `ecFullTime` | so | Employed full-time | Shaqo waqti buuxa | 2026-11-15 | machine-drafted, needs native review |
| `ecPartTime` | so | Employed part-time | Shaqo waqti dhiman | 2026-11-15 | machine-drafted, needs native review |
| `ecSelfEmployed` | so | Self-employed | Iska shaqeysta | 2026-11-15 | machine-drafted, needs native review |
| `ecUnemployedLooking` | so | Unemployed - looking for work | Shaqo la’aan - shaqo raadinaya | 2026-11-15 | machine-drafted, needs native review |
| `ecUnemployedNotLooking` | so | Unemployed - not looking | Shaqo la’aan - aan raadin | 2026-11-15 | machine-drafted, needs native review |
| `ecDisability` | so | Unable to work (disability) | Aan shaqeyn karin (naafo) | 2026-11-15 | machine-drafted, needs native review |
| `ecRetired` | so | Retired | Hawlgab | 2026-11-15 | machine-drafted, needs native review |
| `ecStudent` | so | Student | Arday | 2026-11-15 | machine-drafted, needs native review |
| `ecBenefitsQ` | so | Are you currently receiving any benefits? (select all that apply) | Hadda ma helaysaa wax gargaar ah? (dooro dhammaan kuwa khuseeya) | 2026-11-15 | machine-drafted, needs native review |
| `ecSnap` | so | SNAP (Food Stamps) | SNAP (kaararka cuntada) | 2026-11-15 | machine-drafted, needs native review |
| `ecMedicaid` | so | Medicaid | Medicaid | 2026-11-15 | machine-drafted, needs native review |
| `ecMedicare` | so | Medicare | Medicare | 2026-11-15 | machine-drafted, needs native review |
| `ecSsi` | so | SSI/SSDI | SSI/SSDI | 2026-11-15 | machine-drafted, needs native review |
| `ecTanf` | so | TANF | TANF | 2026-11-15 | machine-drafted, needs native review |
| `ecWic` | so | WIC | WIC | 2026-11-15 | machine-drafted, needs native review |
| `ecHousingAssistance` | so | Housing assistance | Kaalmada guryaha | 2026-11-15 | machine-drafted, needs native review |
| `ecNone` | so | None of these | Midna kuma jiro | 2026-11-15 | machine-drafted, needs native review |
| `ecStateQ` | so | What state do you live in? Use its 2-letter code. | Gobolkee ayaad ku nooshahay? Isticmaal koodhkiisa 2-xaraf ah. | 2026-11-15 | machine-drafted, needs native review |
| `ecStatePh` | so | For example: CA, NY, VT | Tusaale: CA, NY, VT | 2026-11-15 | machine-drafted, needs native review |
| `stateNotRecognised` | so | We couldn’t recognise the state {state}, so nothing was checked. Start Check Eligibility again and enter the 2-letter state code, for example CA, NY or VT. | Ma aqoonsan karin gobolka {state}, sidaas darteed waxba lama hubin. Dib u bilow Hubi u-qalmitaanka oo geli koodhka gobolka ee 2-xaraf ah, tusaale CA, NY ama VT. | 2026-11-15 | machine-drafted, needs native review |
| `conversation` | so | Conversation | Wada-hadal | 2026-11-15 | machine-drafted, needs native review |
| `fhName` | so | Form Help | Caawimaad foom | 2026-11-15 | machine-drafted, needs native review |
| `fhDescription` | so | Get help understanding and completing benefit applications | Hel caawimaad aad ku fahanto oo aad ku buuxiso codsiyada gargaarka | 2026-11-15 | machine-drafted, needs native review |
| `fhFormQ` | so | Which form or application do you need help with? | Foomkee ama codsigee ayaad caawimaad uga baahan tahay? | 2026-11-15 | machine-drafted, needs native review |
| `fhSnap` | so | SNAP (Food Stamps) Application | Codsiga SNAP (kaararka cuntada) | 2026-11-15 | machine-drafted, needs native review |
| `fhMedicaid` | so | Medicaid Application | Codsiga Medicaid | 2026-11-15 | machine-drafted, needs native review |
| `fhTanf` | so | TANF Application | Codsiga TANF | 2026-11-15 | machine-drafted, needs native review |
| `fhHousing` | so | Housing Assistance Application | Codsiga kaalmada guryaha | 2026-11-15 | machine-drafted, needs native review |
| `fhUnemployment` | so | Unemployment Application | Codsiga shaqo la’aanta | 2026-11-15 | machine-drafted, needs native review |
| `fhSsi` | so | SSI/SSDI Application | Codsiga SSI/SSDI | 2026-11-15 | machine-drafted, needs native review |
| `fhOther` | so | Other form | Foom kale | 2026-11-15 | machine-drafted, needs native review |
| `fhHelpQ` | so | What kind of help do you need? | Caawimaad noocee ah ayaad u baahan tahay? | 2026-11-15 | machine-drafted, needs native review |
| `fhDocuments` | so | Understand what documents I need | Fahan dukumentiyada aan u baahanahay | 2026-11-15 | machine-drafted, needs native review |
| `fhExplain` | so | Explain what questions mean | Sharax waxa su’aaluhu ka dhigan yihiin | 2026-11-15 | machine-drafted, needs native review |
| `fhSection` | so | Help with a specific section | Caawimaad qayb gaar ah | 2026-11-15 | machine-drafted, needs native review |
| `fhReview` | so | Review before I submit | Dib u eeg ka hor intaanan dirin | 2026-11-15 | machine-drafted, needs native review |
| `fhGeneral` | so | General guidance through the form | Hagid guud oo foomka oo dhan ah | 2026-11-15 | machine-drafted, needs native review |
| `fhSectionQ` | so | Which section are you working on? | Qaybtee ayaad ka shaqaynaysaa? | 2026-11-15 | machine-drafted, needs native review |
| `fhSectionPh` | so | E.g., "Income", "Household Members", "Assets" | Tusaale: "Dakhliga", "Xubnaha qoyska", "Hantida" | 2026-11-15 | machine-drafted, needs native review |
| `fhQuestionQ` | so | What is the question you need help understanding? | Waa maxay su’aasha aad u baahan tahay inaad fahanto? | 2026-11-15 | machine-drafted, needs native review |
| `fhQuestionPh` | so | Type or paste the question from the form | Qor ama ku dheji su’aasha foomka | 2026-11-15 | machine-drafted, needs native review |
| `fhSpecificQ` | so | What specific question do you have about this section? | Su’aal gaar ah oo noocee ah ayaad ka qabtaa qaybtan? | 2026-11-15 | machine-drafted, needs native review |
| `fhSpecificPh` | so | Describe what you're confused about | Sharax waxa kugu adag | 2026-11-15 | machine-drafted, needs native review |
| `fhStatusQ` | so | Have you already started the application? | Ma horay u bilowday codsiga? | 2026-11-15 | machine-drafted, needs native review |
| `fhNotStarted` | so | No, haven't started yet | Maya, weli ma bilaabin | 2026-11-15 | machine-drafted, needs native review |
| `fhInProgress` | so | Yes, partway through | Haa, waan bar maray | 2026-11-15 | machine-drafted, needs native review |
| `fhAlmostDone` | so | Yes, almost done | Haa, waan ku dhowahay inaan dhammeeyo | 2026-11-15 | machine-drafted, needs native review |
| `greetingTitle` | am | Hi, This is Feed. | ሰላም፣ ይህ Feed ነው። | 2026-11-15 | machine-drafted, needs native review |
| `greetingSubtitle` | am | What can we help you gather today? | ዛሬ ምን እንዲያገኙ ልንረዳዎ እንችላለን? | 2026-11-15 | machine-drafted, needs native review |
| `cardResourcesTitle` | am | Find Resources | ሀብቶችን ያግኙ | 2026-11-15 | machine-drafted, needs native review |
| `cardResourcesBody` | am | Discover local food banks, housing assistance, healthcare, and more near you. | በአቅራቢያዎ ያሉ የምግብ ባንኮችን፣ የመኖሪያ ቤት ድጋፍን፣ የጤና እንክብካቤን እና ሌሎችንም ያግኙ። | 2026-11-15 | machine-drafted, needs native review |
| `cardEligibilityTitle` | am | Check Eligibility | ብቁነትን ያረጋግጡ | 2026-11-15 | machine-drafted, needs native review |
| `cardEligibilityBody` | am | See what benefits programs you may qualify for based on your situation. | እንደ ሁኔታዎ ብቁ ሊሆኑባቸው የሚችሉ የጥቅማ ጥቅም ፕሮግራሞችን ይመልከቱ። | 2026-11-15 | machine-drafted, needs native review |
| `cardFormsTitle` | am | Get Help with Forms | በቅጾች እገዛ | 2026-11-15 | machine-drafted, needs native review |
| `cardFormsBody` | am | Get guided help understanding and completing benefit applications. | የጥቅማ ጥቅም ማመልከቻዎችን ለመረዳት እና ለመሙላት የሚመራ እገዛ ያግኙ። | 2026-11-15 | machine-drafted, needs native review |
| `signInPrompt` | am | Please {link} to chat with FEED Assistant. | ከFEED ረዳት ጋር ለመወያየት እባክዎ {link}። | 2026-11-15 | machine-drafted, needs native review |
| `signInLink` | am | sign in | ይግቡ | 2026-11-15 | machine-drafted, needs native review |
| `reconnecting` | am | Reconnecting… | እንደገና በመገናኘት ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `retrying` | am | Retrying… | እንደገና በመሞከር ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `inputPlaceholder` | am | Ask me anything about benefits, resources, or assistance... | ስለ ጥቅማ ጥቅሞች፣ ሀብቶች ወይም እገዛ ማንኛውንም ነገር ይጠይቁኝ... | 2026-11-15 | machine-drafted, needs native review |
| `inputPlaceholderGuest` | am | Sign in to start chatting... | መወያየት ለመጀመር ይግቡ... | 2026-11-15 | machine-drafted, needs native review |
| `replyPlaceholder` | am | Type your message... | መልእክትዎን ይጻፉ... | 2026-11-15 | machine-drafted, needs native review |
| `sendMessage` | am | Send message | መልእክት ላክ | 2026-11-15 | machine-drafted, needs native review |
| `stopResponse` | am | Stop response | መልሱን አቁም | 2026-11-15 | machine-drafted, needs native review |
| `tagFindResources` | am | Find resources | ሀብቶችን ያግኙ | 2026-11-15 | machine-drafted, needs native review |
| `tagEligibility` | am | Program Eligibility | የፕሮግራም ብቁነት | 2026-11-15 | machine-drafted, needs native review |
| `tagFood` | am | Food | ምግብ | 2026-11-15 | machine-drafted, needs native review |
| `tagSocialServices` | am | Social Services | ማህበራዊ አገልግሎቶች | 2026-11-15 | machine-drafted, needs native review |
| `tagHealthcare` | am | Healthcare | የጤና እንክብካቤ | 2026-11-15 | machine-drafted, needs native review |
| `replyFindMore` | am | Find more resources | ተጨማሪ ሀብቶችን ያግኙ | 2026-11-15 | machine-drafted, needs native review |
| `replyDirections` | am | Get directions | አቅጣጫ ያግኙ | 2026-11-15 | machine-drafted, needs native review |
| `replyEligibility` | am | Check my eligibility | ብቁነቴን አረጋግጥ | 2026-11-15 | machine-drafted, needs native review |
| `replyTalk` | am | Talk to someone | ከሰው ጋር ይነጋገሩ | 2026-11-15 | machine-drafted, needs native review |
| `resourceApply` | am | Apply | ያመልክቱ | 2026-11-15 | machine-drafted, needs native review |
| `resourceVisit` | am | Visit | ይጎብኙ | 2026-11-15 | machine-drafted, needs native review |
| `resourceDirections` | am | Directions | አቅጣጫ | 2026-11-15 | machine-drafted, needs native review |
| `resourceSave` | am | Save | አስቀምጥ | 2026-11-15 | machine-drafted, needs native review |
| `resourceSaving` | am | Saving… | በማስቀመጥ ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `resourceSaved` | am | Saved | ተቀምጧል | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | am | Could not save {name}. Please try again. | {name}ን ማስቀመጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `viaModel` | am | via {model} | በ{model} | 2026-11-15 | machine-drafted, needs native review |
| `flowCancel` | am | Cancel | ሰርዝ | 2026-11-15 | machine-drafted, needs native review |
| `flowContinue` | am | Continue | ቀጥል | 2026-11-15 | machine-drafted, needs native review |
| `flowProcessing` | am | Processing… | በሂደት ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `flowDone` | am | Done | ተጠናቋል | 2026-11-15 | machine-drafted, needs native review |
| `flowBack` | am | Back | ተመለስ | 2026-11-15 | machine-drafted, needs native review |
| `flowStep` | am | Step {current} of {total} | ደረጃ {current} ከ{total} | 2026-11-15 | machine-drafted, needs native review |
| `rfName` | am | Find Resources | ሀብቶችን ያግኙ | 2026-11-15 | machine-drafted, needs native review |
| `rfDescription` | am | Find food, housing, healthcare, and other resources near you | በአቅራቢያዎ ምግብ፣ መኖሪያ፣ የጤና እንክብካቤ እና ሌሎች ሀብቶችን ያግኙ | 2026-11-15 | machine-drafted, needs native review |
| `rfCategoryQ` | am | What type of help are you looking for? | ምን ዓይነት እገዛ እየፈለጉ ነው? | 2026-11-15 | machine-drafted, needs native review |
| `rfFood` | am | Food Assistance | የምግብ ድጋፍ | 2026-11-15 | machine-drafted, needs native review |
| `rfHousing` | am | Housing & Shelter | መኖሪያ እና መጠለያ | 2026-11-15 | machine-drafted, needs native review |
| `rfHealthcare` | am | Healthcare | የጤና እንክብካቤ | 2026-11-15 | machine-drafted, needs native review |
| `rfUtilities` | am | Utilities (Electric, Gas, Water) | መገልገያዎች (መብራት፣ ጋዝ፣ ውሃ) | 2026-11-15 | machine-drafted, needs native review |
| `rfEmployment` | am | Employment & Job Training | ሥራ እና የሥራ ሥልጠና | 2026-11-15 | machine-drafted, needs native review |
| `rfFamily` | am | Childcare & Family Services | የሕፃናት እንክብካቤ እና የቤተሰብ አገልግሎቶች | 2026-11-15 | machine-drafted, needs native review |
| `rfLegal` | am | Legal Aid | የሕግ ድጋፍ | 2026-11-15 | machine-drafted, needs native review |
| `rfMentalHealth` | am | Mental Health | የአእምሮ ጤና | 2026-11-15 | machine-drafted, needs native review |
| `rfOther` | am | Other | ሌላ | 2026-11-15 | machine-drafted, needs native review |
| `rfUrgencyQ` | am | How urgent is your need? | ፍላጎትዎ ምን ያህል አስቸኳይ ነው? | 2026-11-15 | machine-drafted, needs native review |
| `rfImmediate` | am | Immediate (today) | ወዲያውኑ (ዛሬ) | 2026-11-15 | machine-drafted, needs native review |
| `rfThisWeek` | am | This week | በዚህ ሳምንት | 2026-11-15 | machine-drafted, needs native review |
| `rfMonth` | am | Within a month | በአንድ ወር ውስጥ | 2026-11-15 | machine-drafted, needs native review |
| `rfExploring` | am | Just exploring options | አማራጮችን ብቻ እያየሁ ነው | 2026-11-15 | machine-drafted, needs native review |
| `rfLocationQ` | am | What is your zip code or city? | የፖስታ ኮድዎ ወይም ከተማዎ ምንድን ነው? | 2026-11-15 | machine-drafted, needs native review |
| `rfLocationPh` | am | Enter zip code or city name | የፖስታ ኮድ ወይም የከተማ ስም ያስገቡ | 2026-11-15 | machine-drafted, needs native review |
| `rfAdditionalQ` | am | Anything else we should know? (optional) | ማወቅ ያለብን ሌላ ነገር አለ? (አማራጭ) | 2026-11-15 | machine-drafted, needs native review |
| `rfAdditionalPh` | am | E.g., family size, specific requirements, accessibility needs | ለምሳሌ፦ የቤተሰብ ብዛት፣ ልዩ መስፈርቶች፣ የተደራሽነት ፍላጎቶች | 2026-11-15 | machine-drafted, needs native review |
| `ecName` | am | Check Eligibility | ብቁነትን ያረጋግጡ | 2026-11-15 | machine-drafted, needs native review |
| `ecDescription` | am | See what benefits programs you may qualify for | ብቁ ሊሆኑባቸው የሚችሉ የጥቅማ ጥቅም ፕሮግራሞችን ይመልከቱ | 2026-11-15 | machine-drafted, needs native review |
| `ecHouseholdQ` | am | How many people live in your household (including yourself)? | በቤተሰብዎ ውስጥ ስንት ሰዎች ይኖራሉ (እርስዎን ጨምሮ)? | 2026-11-15 | machine-drafted, needs native review |
| `ecJustMe` | am | 1 (just me) | 1 (እኔ ብቻ) | 2026-11-15 | machine-drafted, needs native review |
| `ecChildrenQ` | am | Are there any children under 18 in your household? | በቤተሰብዎ ውስጥ ከ18 ዓመት በታች የሆኑ ልጆች አሉ? | 2026-11-15 | machine-drafted, needs native review |
| `optYes` | am | Yes | አዎ | 2026-11-15 | machine-drafted, needs native review |
| `optNo` | am | No | አይ | 2026-11-15 | machine-drafted, needs native review |
| `ecAgesQ` | am | What are the ages of the children? | የልጆቹ ዕድሜ ስንት ነው? | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeInfant` | am | Under 1 year | ከ1 ዓመት በታች | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeToddler` | am | 1-5 years | 1-5 ዓመት | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeChild` | am | 6-12 years | 6-12 ዓመት | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeTeen` | am | 13-17 years | 13-17 ዓመት | 2026-11-15 | machine-drafted, needs native review |
| `ecPregnantQ` | am | Is anyone in the household currently pregnant? | በአሁኑ ጊዜ በቤተሰቡ ውስጥ ነፍሰ ጡር አለ? | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeQ` | am | What is your approximate monthly household income (before taxes)? | የቤተሰብዎ ግምታዊ ወርሃዊ ገቢ (ከግብር በፊት) ምን ያህል ነው? | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeNone` | am | No income | ገቢ የለም | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeUnder` | am | Under {amount} | ከ{amount} በታች | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeRange` | am | {from} - {to} | ከ{from} እስከ {to} | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeOver` | am | Over {amount} | ከ{amount} በላይ | 2026-11-15 | machine-drafted, needs native review |
| `ecEmploymentQ` | am | What is your current employment status? | የአሁኑ የሥራ ሁኔታዎ ምንድን ነው? | 2026-11-15 | machine-drafted, needs native review |
| `ecFullTime` | am | Employed full-time | የሙሉ ጊዜ ሠራተኛ | 2026-11-15 | machine-drafted, needs native review |
| `ecPartTime` | am | Employed part-time | የትርፍ ጊዜ ሠራተኛ | 2026-11-15 | machine-drafted, needs native review |
| `ecSelfEmployed` | am | Self-employed | የግል ሥራ | 2026-11-15 | machine-drafted, needs native review |
| `ecUnemployedLooking` | am | Unemployed - looking for work | ሥራ አጥ - ሥራ እየፈለግሁ | 2026-11-15 | machine-drafted, needs native review |
| `ecUnemployedNotLooking` | am | Unemployed - not looking | ሥራ አጥ - እየፈለግሁ አይደለም | 2026-11-15 | machine-drafted, needs native review |
| `ecDisability` | am | Unable to work (disability) | መሥራት አልችልም (አካል ጉዳት) | 2026-11-15 | machine-drafted, needs native review |
| `ecRetired` | am | Retired | ጡረተኛ | 2026-11-15 | machine-drafted, needs native review |
| `ecStudent` | am | Student | ተማሪ | 2026-11-15 | machine-drafted, needs native review |
| `ecBenefitsQ` | am | Are you currently receiving any benefits? (select all that apply) | በአሁኑ ጊዜ ማንኛውንም ጥቅማ ጥቅም እያገኙ ነው? (የሚመለከቱትን ሁሉ ይምረጡ) | 2026-11-15 | machine-drafted, needs native review |
| `ecSnap` | am | SNAP (Food Stamps) | SNAP (የምግብ ኩፖን) | 2026-11-15 | machine-drafted, needs native review |
| `ecMedicaid` | am | Medicaid | Medicaid | 2026-11-15 | machine-drafted, needs native review |
| `ecMedicare` | am | Medicare | Medicare | 2026-11-15 | machine-drafted, needs native review |
| `ecSsi` | am | SSI/SSDI | SSI/SSDI | 2026-11-15 | machine-drafted, needs native review |
| `ecTanf` | am | TANF | TANF | 2026-11-15 | machine-drafted, needs native review |
| `ecWic` | am | WIC | WIC | 2026-11-15 | machine-drafted, needs native review |
| `ecHousingAssistance` | am | Housing assistance | የመኖሪያ ቤት ድጋፍ | 2026-11-15 | machine-drafted, needs native review |
| `ecNone` | am | None of these | ከእነዚህ ውስጥ የለም | 2026-11-15 | machine-drafted, needs native review |
| `ecStateQ` | am | What state do you live in? Use its 2-letter code. | በየትኛው ግዛት ይኖራሉ? ባለ 2 ፊደል ኮዱን ይጠቀሙ። | 2026-11-15 | machine-drafted, needs native review |
| `ecStatePh` | am | For example: CA, NY, VT | ለምሳሌ፦ CA፣ NY፣ VT | 2026-11-15 | machine-drafted, needs native review |
| `stateNotRecognised` | am | We couldn’t recognise the state {state}, so nothing was checked. Start Check Eligibility again and enter the 2-letter state code, for example CA, NY or VT. | ግዛቱን {state} ልናውቀው አልቻልንም፣ ስለዚህ ምንም አልተረጋገጠም። ብቁነትን ያረጋግጡ የሚለውን እንደገና ይጀምሩ እና ባለ 2 ፊደል የግዛት ኮድ ያስገቡ፣ ለምሳሌ CA፣ NY ወይም VT። | 2026-11-15 | machine-drafted, needs native review |
| `conversation` | am | Conversation | ውይይት | 2026-11-15 | machine-drafted, needs native review |
| `fhName` | am | Form Help | የቅጽ እገዛ | 2026-11-15 | machine-drafted, needs native review |
| `fhDescription` | am | Get help understanding and completing benefit applications | የጥቅማ ጥቅም ማመልከቻዎችን ለመረዳት እና ለመሙላት እገዛ ያግኙ | 2026-11-15 | machine-drafted, needs native review |
| `fhFormQ` | am | Which form or application do you need help with? | በየትኛው ቅጽ ወይም ማመልከቻ እገዛ ይፈልጋሉ? | 2026-11-15 | machine-drafted, needs native review |
| `fhSnap` | am | SNAP (Food Stamps) Application | የSNAP (የምግብ ኩፖን) ማመልከቻ | 2026-11-15 | machine-drafted, needs native review |
| `fhMedicaid` | am | Medicaid Application | የMedicaid ማመልከቻ | 2026-11-15 | machine-drafted, needs native review |
| `fhTanf` | am | TANF Application | የTANF ማመልከቻ | 2026-11-15 | machine-drafted, needs native review |
| `fhHousing` | am | Housing Assistance Application | የመኖሪያ ቤት ድጋፍ ማመልከቻ | 2026-11-15 | machine-drafted, needs native review |
| `fhUnemployment` | am | Unemployment Application | የሥራ አጥነት ማመልከቻ | 2026-11-15 | machine-drafted, needs native review |
| `fhSsi` | am | SSI/SSDI Application | የSSI/SSDI ማመልከቻ | 2026-11-15 | machine-drafted, needs native review |
| `fhOther` | am | Other form | ሌላ ቅጽ | 2026-11-15 | machine-drafted, needs native review |
| `fhHelpQ` | am | What kind of help do you need? | ምን ዓይነት እገዛ ይፈልጋሉ? | 2026-11-15 | machine-drafted, needs native review |
| `fhDocuments` | am | Understand what documents I need | የሚያስፈልጉኝን ሰነዶች ማወቅ | 2026-11-15 | machine-drafted, needs native review |
| `fhExplain` | am | Explain what questions mean | ጥያቄዎቹ ምን ማለት እንደሆኑ ማብራራት | 2026-11-15 | machine-drafted, needs native review |
| `fhSection` | am | Help with a specific section | በአንድ የተወሰነ ክፍል እገዛ | 2026-11-15 | machine-drafted, needs native review |
| `fhReview` | am | Review before I submit | ከማስገባቴ በፊት መገምገም | 2026-11-15 | machine-drafted, needs native review |
| `fhGeneral` | am | General guidance through the form | በቅጹ በሙሉ አጠቃላይ መመሪያ | 2026-11-15 | machine-drafted, needs native review |
| `fhSectionQ` | am | Which section are you working on? | በየትኛው ክፍል ላይ እየሠሩ ነው? | 2026-11-15 | machine-drafted, needs native review |
| `fhSectionPh` | am | E.g., "Income", "Household Members", "Assets" | ለምሳሌ፦ "ገቢ"፣ "የቤተሰብ አባላት"፣ "ንብረቶች" | 2026-11-15 | machine-drafted, needs native review |
| `fhQuestionQ` | am | What is the question you need help understanding? | ለመረዳት እገዛ የሚፈልጉት ጥያቄ ምንድን ነው? | 2026-11-15 | machine-drafted, needs native review |
| `fhQuestionPh` | am | Type or paste the question from the form | ከቅጹ ላይ ያለውን ጥያቄ ይጻፉ ወይም ይለጥፉ | 2026-11-15 | machine-drafted, needs native review |
| `fhSpecificQ` | am | What specific question do you have about this section? | ስለዚህ ክፍል ምን የተለየ ጥያቄ አለዎት? | 2026-11-15 | machine-drafted, needs native review |
| `fhSpecificPh` | am | Describe what you're confused about | ግራ ያጋባዎትን ይግለጹ | 2026-11-15 | machine-drafted, needs native review |
| `fhStatusQ` | am | Have you already started the application? | ማመልከቻውን አስቀድመው ጀምረዋል? | 2026-11-15 | machine-drafted, needs native review |
| `fhNotStarted` | am | No, haven't started yet | አይ፣ ገና አልጀመርኩም | 2026-11-15 | machine-drafted, needs native review |
| `fhInProgress` | am | Yes, partway through | አዎ፣ በከፊል ጨርሻለሁ | 2026-11-15 | machine-drafted, needs native review |
| `fhAlmostDone` | am | Yes, almost done | አዎ፣ ልጨርስ ነው | 2026-11-15 | machine-drafted, needs native review |
| `greetingTitle` | hmn | Hi, This is Feed. | Nyob zoo, no yog Feed. | 2026-11-15 | machine-drafted, needs native review |
| `greetingSubtitle` | hmn | What can we help you gather today? | Hnub no peb pab tau koj nrhiav dab tsi? | 2026-11-15 | machine-drafted, needs native review |
| `cardResourcesTitle` | hmn | Find Resources | Nrhiav kev pab | 2026-11-15 | machine-drafted, needs native review |
| `cardResourcesBody` | hmn | Discover local food banks, housing assistance, healthcare, and more near you. | Nrhiav cov chaw muab zaub mov, kev pab vaj tse, kev kho mob thiab lwm yam nyob ze koj. | 2026-11-15 | machine-drafted, needs native review |
| `cardEligibilityTitle` | hmn | Check Eligibility | Kuaj seb koj tsim nyog | 2026-11-15 | machine-drafted, needs native review |
| `cardEligibilityBody` | hmn | See what benefits programs you may qualify for based on your situation. | Saib seb koj yuav tsim nyog tau cov kev pab cuam txiaj ntsig twg raws li koj qhov xwm txheej. | 2026-11-15 | machine-drafted, needs native review |
| `cardFormsTitle` | hmn | Get Help with Forms | Kev pab sau ntawv | 2026-11-15 | machine-drafted, needs native review |
| `cardFormsBody` | hmn | Get guided help understanding and completing benefit applications. | Tau kev pab coj kom nkag siab thiab sau cov ntawv thov txiaj ntsig. | 2026-11-15 | machine-drafted, needs native review |
| `signInPrompt` | hmn | Please {link} to chat with FEED Assistant. | Thov {link} los tham nrog Tus Pab FEED. | 2026-11-15 | machine-drafted, needs native review |
| `signInLink` | hmn | sign in | nkag mus | 2026-11-15 | machine-drafted, needs native review |
| `reconnecting` | hmn | Reconnecting… | Tab tom rov txuas… | 2026-11-15 | machine-drafted, needs native review |
| `retrying` | hmn | Retrying… | Tab tom sim dua… | 2026-11-15 | machine-drafted, needs native review |
| `inputPlaceholder` | hmn | Ask me anything about benefits, resources, or assistance... | Nug kuv txhua yam txog txiaj ntsig, kev pab lossis kev txhawb nqa... | 2026-11-15 | machine-drafted, needs native review |
| `inputPlaceholderGuest` | hmn | Sign in to start chatting... | Nkag mus los pib tham... | 2026-11-15 | machine-drafted, needs native review |
| `replyPlaceholder` | hmn | Type your message... | Ntaus koj cov lus... | 2026-11-15 | machine-drafted, needs native review |
| `sendMessage` | hmn | Send message | Xa lus | 2026-11-15 | machine-drafted, needs native review |
| `stopResponse` | hmn | Stop response | Nres cov lus teb | 2026-11-15 | machine-drafted, needs native review |
| `tagFindResources` | hmn | Find resources | Nrhiav kev pab | 2026-11-15 | machine-drafted, needs native review |
| `tagEligibility` | hmn | Program Eligibility | Kev tsim nyog rau kev pab cuam | 2026-11-15 | machine-drafted, needs native review |
| `tagFood` | hmn | Food | Zaub mov | 2026-11-15 | machine-drafted, needs native review |
| `tagSocialServices` | hmn | Social Services | Kev pab hauv zej zog | 2026-11-15 | machine-drafted, needs native review |
| `tagHealthcare` | hmn | Healthcare | Kev kho mob | 2026-11-15 | machine-drafted, needs native review |
| `replyFindMore` | hmn | Find more resources | Nrhiav kev pab ntxiv | 2026-11-15 | machine-drafted, needs native review |
| `replyDirections` | hmn | Get directions | Tau txoj kev mus | 2026-11-15 | machine-drafted, needs native review |
| `replyEligibility` | hmn | Check my eligibility | Kuaj seb kuv tsim nyog | 2026-11-15 | machine-drafted, needs native review |
| `replyTalk` | hmn | Talk to someone | Tham nrog ib tug neeg | 2026-11-15 | machine-drafted, needs native review |
| `resourceApply` | hmn | Apply | Thov | 2026-11-15 | machine-drafted, needs native review |
| `resourceVisit` | hmn | Visit | Mus saib | 2026-11-15 | machine-drafted, needs native review |
| `resourceDirections` | hmn | Directions | Txoj kev mus | 2026-11-15 | machine-drafted, needs native review |
| `resourceSave` | hmn | Save | Khaws | 2026-11-15 | machine-drafted, needs native review |
| `resourceSaving` | hmn | Saving… | Tab tom khaws… | 2026-11-15 | machine-drafted, needs native review |
| `resourceSaved` | hmn | Saved | Khaws lawm | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | hmn | Could not save {name}. Please try again. | Khaws tsis tau {name}. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `viaModel` | hmn | via {model} | los ntawm {model} | 2026-11-15 | machine-drafted, needs native review |
| `flowCancel` | hmn | Cancel | Tso tseg | 2026-11-15 | machine-drafted, needs native review |
| `flowContinue` | hmn | Continue | Mus ntxiv | 2026-11-15 | machine-drafted, needs native review |
| `flowProcessing` | hmn | Processing… | Tab tom ua… | 2026-11-15 | machine-drafted, needs native review |
| `flowDone` | hmn | Done | Tiav lawm | 2026-11-15 | machine-drafted, needs native review |
| `flowBack` | hmn | Back | Rov qab | 2026-11-15 | machine-drafted, needs native review |
| `flowStep` | hmn | Step {current} of {total} | Kauj ruam {current} ntawm {total} | 2026-11-15 | machine-drafted, needs native review |
| `rfName` | hmn | Find Resources | Nrhiav kev pab | 2026-11-15 | machine-drafted, needs native review |
| `rfDescription` | hmn | Find food, housing, healthcare, and other resources near you | Nrhiav zaub mov, vaj tse, kev kho mob thiab lwm yam kev pab nyob ze koj | 2026-11-15 | machine-drafted, needs native review |
| `rfCategoryQ` | hmn | What type of help are you looking for? | Koj tab tom nrhiav kev pab hom twg? | 2026-11-15 | machine-drafted, needs native review |
| `rfFood` | hmn | Food Assistance | Kev pab zaub mov | 2026-11-15 | machine-drafted, needs native review |
| `rfHousing` | hmn | Housing & Shelter | Vaj tse thiab chaw nyob | 2026-11-15 | machine-drafted, needs native review |
| `rfHealthcare` | hmn | Healthcare | Kev kho mob | 2026-11-15 | machine-drafted, needs native review |
| `rfUtilities` | hmn | Utilities (Electric, Gas, Water) | Hluav taws, roj thiab dej | 2026-11-15 | machine-drafted, needs native review |
| `rfEmployment` | hmn | Employment & Job Training | Hauj lwm thiab kev cob qhia ua hauj lwm | 2026-11-15 | machine-drafted, needs native review |
| `rfFamily` | hmn | Childcare & Family Services | Kev zov me nyuam thiab kev pab tsev neeg | 2026-11-15 | machine-drafted, needs native review |
| `rfLegal` | hmn | Legal Aid | Kev pab txog kev cai lij choj | 2026-11-15 | machine-drafted, needs native review |
| `rfMentalHealth` | hmn | Mental Health | Kev noj qab haus huv ntawm lub siab | 2026-11-15 | machine-drafted, needs native review |
| `rfOther` | hmn | Other | Lwm yam | 2026-11-15 | machine-drafted, needs native review |
| `rfUrgencyQ` | hmn | How urgent is your need? | Koj qhov kev xav tau ceev npaum li cas? | 2026-11-15 | machine-drafted, needs native review |
| `rfImmediate` | hmn | Immediate (today) | Tam sim no (hnub no) | 2026-11-15 | machine-drafted, needs native review |
| `rfThisWeek` | hmn | This week | Lub lim tiam no | 2026-11-15 | machine-drafted, needs native review |
| `rfMonth` | hmn | Within a month | Hauv ib hlis | 2026-11-15 | machine-drafted, needs native review |
| `rfExploring` | hmn | Just exploring options | Tsuas yog saib xaiv xwb | 2026-11-15 | machine-drafted, needs native review |
| `rfLocationQ` | hmn | What is your zip code or city? | Koj tus zip code lossis lub nroog yog dab tsi? | 2026-11-15 | machine-drafted, needs native review |
| `rfLocationPh` | hmn | Enter zip code or city name | Sau tus zip code lossis lub npe nroog | 2026-11-15 | machine-drafted, needs native review |
| `rfAdditionalQ` | hmn | Anything else we should know? (optional) | Puas muaj lwm yam peb yuav tsum paub? (xaiv tau) | 2026-11-15 | machine-drafted, needs native review |
| `rfAdditionalPh` | hmn | E.g., family size, specific requirements, accessibility needs | Piv txwv: tsev neeg muaj pes tsawg tus, tej yam tshwj xeeb, kev xav tau kom yooj yim siv | 2026-11-15 | machine-drafted, needs native review |
| `ecName` | hmn | Check Eligibility | Kuaj seb koj tsim nyog | 2026-11-15 | machine-drafted, needs native review |
| `ecDescription` | hmn | See what benefits programs you may qualify for | Saib seb koj yuav tsim nyog tau cov kev pab cuam txiaj ntsig twg | 2026-11-15 | machine-drafted, needs native review |
| `ecHouseholdQ` | hmn | How many people live in your household (including yourself)? | Muaj pes tsawg tus neeg nyob hauv koj tsev (suav koj thiab)? | 2026-11-15 | machine-drafted, needs native review |
| `ecJustMe` | hmn | 1 (just me) | 1 (kuv ib leeg) | 2026-11-15 | machine-drafted, needs native review |
| `ecChildrenQ` | hmn | Are there any children under 18 in your household? | Puas muaj me nyuam hnub nyoog qis dua 18 xyoo nyob hauv koj tsev? | 2026-11-15 | machine-drafted, needs native review |
| `optYes` | hmn | Yes | Muaj | 2026-11-15 | machine-drafted, needs native review |
| `optNo` | hmn | No | Tsis muaj | 2026-11-15 | machine-drafted, needs native review |
| `ecAgesQ` | hmn | What are the ages of the children? | Cov me nyuam muaj pes tsawg xyoo? | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeInfant` | hmn | Under 1 year | Qis dua 1 xyoos | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeToddler` | hmn | 1-5 years | 1-5 xyoos | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeChild` | hmn | 6-12 years | 6-12 xyoos | 2026-11-15 | machine-drafted, needs native review |
| `ecAgeTeen` | hmn | 13-17 years | 13-17 xyoos | 2026-11-15 | machine-drafted, needs native review |
| `ecPregnantQ` | hmn | Is anyone in the household currently pregnant? | Puas muaj leej twg hauv tsev tab tom cev xeeb tub? | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeQ` | hmn | What is your approximate monthly household income (before taxes)? | Koj tsev neeg tau nyiaj txiag ib hlis kwv yees li cas (ua ntej them se)? | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeNone` | hmn | No income | Tsis muaj nyiaj tau | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeUnder` | hmn | Under {amount} | Qis dua {amount} | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeRange` | hmn | {from} - {to} | {from} txog {to} | 2026-11-15 | machine-drafted, needs native review |
| `ecIncomeOver` | hmn | Over {amount} | Ntau tshaj {amount} | 2026-11-15 | machine-drafted, needs native review |
| `ecEmploymentQ` | hmn | What is your current employment status? | Koj txoj hauj lwm tam sim no zoo li cas? | 2026-11-15 | machine-drafted, needs native review |
| `ecFullTime` | hmn | Employed full-time | Ua hauj lwm puv sij hawm | 2026-11-15 | machine-drafted, needs native review |
| `ecPartTime` | hmn | Employed part-time | Ua hauj lwm ib nrab sij hawm | 2026-11-15 | machine-drafted, needs native review |
| `ecSelfEmployed` | hmn | Self-employed | Ua lag luam rau kuv tus kheej | 2026-11-15 | machine-drafted, needs native review |
| `ecUnemployedLooking` | hmn | Unemployed - looking for work | Tsis muaj hauj lwm - tab tom nrhiav | 2026-11-15 | machine-drafted, needs native review |
| `ecUnemployedNotLooking` | hmn | Unemployed - not looking | Tsis muaj hauj lwm - tsis nrhiav | 2026-11-15 | machine-drafted, needs native review |
| `ecDisability` | hmn | Unable to work (disability) | Ua tsis tau hauj lwm (xiam oob qhab) | 2026-11-15 | machine-drafted, needs native review |
| `ecRetired` | hmn | Retired | So hauj lwm lawm | 2026-11-15 | machine-drafted, needs native review |
| `ecStudent` | hmn | Student | Tub ntxhais kawm ntawv | 2026-11-15 | machine-drafted, needs native review |
| `ecBenefitsQ` | hmn | Are you currently receiving any benefits? (select all that apply) | Koj puas tab tom tau txais txiaj ntsig dab tsi? (xaiv txhua yam uas muaj) | 2026-11-15 | machine-drafted, needs native review |
| `ecSnap` | hmn | SNAP (Food Stamps) | SNAP (daim pib yuav zaub mov) | 2026-11-15 | machine-drafted, needs native review |
| `ecMedicaid` | hmn | Medicaid | Medicaid | 2026-11-15 | machine-drafted, needs native review |
| `ecMedicare` | hmn | Medicare | Medicare | 2026-11-15 | machine-drafted, needs native review |
| `ecSsi` | hmn | SSI/SSDI | SSI/SSDI | 2026-11-15 | machine-drafted, needs native review |
| `ecTanf` | hmn | TANF | TANF | 2026-11-15 | machine-drafted, needs native review |
| `ecWic` | hmn | WIC | WIC | 2026-11-15 | machine-drafted, needs native review |
| `ecHousingAssistance` | hmn | Housing assistance | Kev pab vaj tse | 2026-11-15 | machine-drafted, needs native review |
| `ecNone` | hmn | None of these | Tsis muaj ib yam | 2026-11-15 | machine-drafted, needs native review |
| `ecStateQ` | hmn | What state do you live in? Use its 2-letter code. | Koj nyob lub xeev twg? Siv nws tus lej 2 tsab ntawv. | 2026-11-15 | machine-drafted, needs native review |
| `ecStatePh` | hmn | For example: CA, NY, VT | Piv txwv: CA, NY, VT | 2026-11-15 | machine-drafted, needs native review |
| `stateNotRecognised` | hmn | We couldn’t recognise the state {state}, so nothing was checked. Start Check Eligibility again and enter the 2-letter state code, for example CA, NY or VT. | Peb tsis paub lub xeev {state}, yog li tsis tau kuaj dab tsi. Pib Kuaj seb koj tsim nyog dua thiab sau lub xeev tus lej 2 tsab ntawv, piv txwv CA, NY lossis VT. | 2026-11-15 | machine-drafted, needs native review |
| `conversation` | hmn | Conversation | Kev sib tham | 2026-11-15 | machine-drafted, needs native review |
| `fhName` | hmn | Form Help | Kev pab sau ntawv | 2026-11-15 | machine-drafted, needs native review |
| `fhDescription` | hmn | Get help understanding and completing benefit applications | Tau kev pab kom nkag siab thiab sau cov ntawv thov txiaj ntsig | 2026-11-15 | machine-drafted, needs native review |
| `fhFormQ` | hmn | Which form or application do you need help with? | Koj xav tau kev pab nrog daim ntawv twg? | 2026-11-15 | machine-drafted, needs native review |
| `fhSnap` | hmn | SNAP (Food Stamps) Application | Daim ntawv thov SNAP (daim pib yuav zaub mov) | 2026-11-15 | machine-drafted, needs native review |
| `fhMedicaid` | hmn | Medicaid Application | Daim ntawv thov Medicaid | 2026-11-15 | machine-drafted, needs native review |
| `fhTanf` | hmn | TANF Application | Daim ntawv thov TANF | 2026-11-15 | machine-drafted, needs native review |
| `fhHousing` | hmn | Housing Assistance Application | Daim ntawv thov kev pab vaj tse | 2026-11-15 | machine-drafted, needs native review |
| `fhUnemployment` | hmn | Unemployment Application | Daim ntawv thov nyiaj poob hauj lwm | 2026-11-15 | machine-drafted, needs native review |
| `fhSsi` | hmn | SSI/SSDI Application | Daim ntawv thov SSI/SSDI | 2026-11-15 | machine-drafted, needs native review |
| `fhOther` | hmn | Other form | Lwm daim ntawv | 2026-11-15 | machine-drafted, needs native review |
| `fhHelpQ` | hmn | What kind of help do you need? | Koj xav tau kev pab hom twg? | 2026-11-15 | machine-drafted, needs native review |
| `fhDocuments` | hmn | Understand what documents I need | Paub tias kuv xav tau cov ntaub ntawv twg | 2026-11-15 | machine-drafted, needs native review |
| `fhExplain` | hmn | Explain what questions mean | Piav qhia cov lus nug txhais li cas | 2026-11-15 | machine-drafted, needs native review |
| `fhSection` | hmn | Help with a specific section | Pab ib ntu tshwj xeeb | 2026-11-15 | machine-drafted, needs native review |
| `fhReview` | hmn | Review before I submit | Saib dua ua ntej kuv xa | 2026-11-15 | machine-drafted, needs native review |
| `fhGeneral` | hmn | General guidance through the form | Kev qhia dav dav rau tag nrho daim ntawv | 2026-11-15 | machine-drafted, needs native review |
| `fhSectionQ` | hmn | Which section are you working on? | Koj tab tom sau ntu twg? | 2026-11-15 | machine-drafted, needs native review |
| `fhSectionPh` | hmn | E.g., "Income", "Household Members", "Assets" | Piv txwv: "Nyiaj tau", "Cov neeg hauv tsev", "Khoom muaj nqis" | 2026-11-15 | machine-drafted, needs native review |
| `fhQuestionQ` | hmn | What is the question you need help understanding? | Lo lus nug twg koj xav kom pab kom nkag siab? | 2026-11-15 | machine-drafted, needs native review |
| `fhQuestionPh` | hmn | Type or paste the question from the form | Ntaus lossis muab lo lus nug ntawm daim ntawv tso rau ntawm no | 2026-11-15 | machine-drafted, needs native review |
| `fhSpecificQ` | hmn | What specific question do you have about this section? | Koj muaj lus nug dab tsi tshwj xeeb txog ntu no? | 2026-11-15 | machine-drafted, needs native review |
| `fhSpecificPh` | hmn | Describe what you're confused about | Piav seb yam twg ua rau koj tsis meej | 2026-11-15 | machine-drafted, needs native review |
| `fhStatusQ` | hmn | Have you already started the application? | Koj puas tau pib sau daim ntawv thov lawm? | 2026-11-15 | machine-drafted, needs native review |
| `fhNotStarted` | hmn | No, haven't started yet | Tsis tau, kuv tseem tsis tau pib | 2026-11-15 | machine-drafted, needs native review |
| `fhInProgress` | hmn | Yes, partway through | Tau, kuv sau tau ib nrab | 2026-11-15 | machine-drafted, needs native review |
| `fhAlmostDone` | hmn | Yes, almost done | Tau, kuv yuav luag tiav | 2026-11-15 | machine-drafted, needs native review |

### `lib/i18n-auth.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `securityCheckFailed` | ht | Security validation failed. Please refresh the page and try again. | Verifikasyon sekirite a echwe. Tanpri rafrechi paj la epi eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `orContinueWith` | ht | Or continue with | Oswa kontinye avèk | 2026-11-15 | machine-drafted, needs native review |
| `opening` | ht | Opening… | N ap louvri… | 2026-11-15 | machine-drafted, needs native review |
| `guestHint` | ht | Browse map, programs, and community resources instantly | Gade kat la, pwogram yo ak resous kominote a touswit | 2026-11-15 | machine-drafted, needs native review |
| `guestFailed` | ht | We couldn't start a guest session. Please try again. | Nou pa t ka kòmanse yon sesyon envite. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `oauthStartFailed` | ht | We couldn't reach the sign-in provider. Please try again. | Nou pa t ka jwenn founisè koneksyon an. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `lockedWait` | ht | Locked — wait 15 minutes | Bloke — tann 15 minit | 2026-11-15 | machine-drafted, needs native review |
| `captchaFailed` | ht | The security check didn't complete. Please try again. | Verifikasyon sekirite a pa t fini. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `loading` | ht | Loading… | N ap chaje… | 2026-11-15 | machine-drafted, needs native review |
| `emailInvalid` | ht | Enter a valid email address. | Antre yon adrès imèl ki valab. | 2026-11-15 | machine-drafted, needs native review |
| `emailRateLimited` | ht | Too many emails were sent. Please wait a few minutes and try again. | Twòp imèl voye. Tanpri tann kèk minit epi eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `backToSignIn` | ht | Back to sign in | Retounen nan koneksyon | 2026-11-15 | machine-drafted, needs native review |
| `haveAccount` | ht | Already have an account? | Ou gen yon kont deja? | 2026-11-15 | machine-drafted, needs native review |
| `loginRateLimited` | ht | Too many login attempts. Please wait 15 minutes before trying again. | Twòp tantativ koneksyon. Tanpri tann 15 minit anvan ou eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `invalidCredentials` | ht | That email and password don't match. Please try again. | Imèl la ak modpas la pa koresponn. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `emailNotConfirmed` | ht | Please confirm your email first. Check your inbox for the link. | Tanpri konfime imèl ou an premye. Gade lyen an nan bwat resepsyon w. | 2026-11-15 | machine-drafted, needs native review |
| `signInFailed` | ht | We couldn't sign you in. Please try again. | Nou pa t ka konekte w. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `mfaCodeNeeded` | ht | Enter the 6-digit code from your authenticator app to continue. | Antre kòd 6 chif ki nan aplikasyon otantifikasyon w lan pou kontinye. | 2026-11-15 | machine-drafted, needs native review |
| `oauthProvider` | ht | Sign-in failed: the provider rejected the request. | Koneksyon an echwe: founisè a refize demann lan. | 2026-11-15 | machine-drafted, needs native review |
| `oauthExchange` | ht | Sign-in failed: the session could not be started. | Koneksyon an echwe: sesyon an pa t ka kòmanse. | 2026-11-15 | machine-drafted, needs native review |
| `oauthNoCode` | ht | Sign-in failed: no authorization code was received. | Koneksyon an echwe: pa gen kòd otorizasyon ki rive. | 2026-11-15 | machine-drafted, needs native review |
| `oauthNoSession` | ht | Sign-in failed: the session was not created. | Koneksyon an echwe: sesyon an pa t kreye. | 2026-11-15 | machine-drafted, needs native review |
| `confirmationFailed` | ht | That confirmation link didn't work. It may have expired — sign in or request a new link. | Lyen konfimasyon sa a pa t mache. Li ka ekspire — konekte oswa mande yon nouvo lyen. | 2026-11-15 | machine-drafted, needs native review |
| `oauthFailed` | ht | Sign-in failed. Please try again. | Koneksyon an echwe. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `signingIn` | ht | Signing in… | N ap konekte… | 2026-11-15 | machine-drafted, needs native review |
| `orSignIn` | ht | or sign in | oswa konekte | 2026-11-15 | machine-drafted, needs native review |
| `signupRateLimited` | ht | Too many signup attempts. Please wait 15 minutes before trying again. | Twòp tantativ enskripsyon. Tanpri tann 15 minit anvan ou eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `passwordsMismatch` | ht | Passwords do not match. | Modpas yo pa menm. | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooWeak` | ht | Password does not meet security requirements. | Modpas la pa satisfè kondisyon sekirite yo. | 2026-11-15 | machine-drafted, needs native review |
| `acceptTermsRequired` | ht | You must accept the terms of service. | Ou dwe aksepte kondisyon sèvis yo. | 2026-11-15 | machine-drafted, needs native review |
| `accountExists` | ht | An account with this email already exists. Please sign in instead. | Gen yon kont ak imèl sa a deja. Tanpri konekte pito. | 2026-11-15 | machine-drafted, needs native review |
| `signupFailed` | ht | We couldn't create your account. Please try again. | Nou pa t ka kreye kont ou. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `signupUnavailable` | ht | New accounts can't be created right now. Please try again later. | Nou pa ka kreye nouvo kont kounye a. Tanpri eseye pita. | 2026-11-15 | machine-drafted, needs native review |
| `resendFailed` | ht | We couldn't resend the confirmation email. Please try again. | Nou pa t ka voye imèl konfimasyon an ankò. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `checkEmailTitle` | ht | Check your email | Gade imèl ou | 2026-11-15 | machine-drafted, needs native review |
| `checkEmailSent` | ht | We've sent a confirmation link to {email}. Click the link to verify your account. | Nou voye yon lyen konfimasyon bay {email}. Klike sou lyen an pou verifye kont ou. | 2026-11-15 | machine-drafted, needs native review |
| `checkSpam` | ht | Didn't receive it? Check your spam or junk folder. | Ou pa resevwa l? Gade nan dosye spam oswa jonk ou. | 2026-11-15 | machine-drafted, needs native review |
| `confirmEmailCorrect` | ht | Make sure {email} is correct. | Asire w ke {email} kòrèk. | 2026-11-15 | machine-drafted, needs native review |
| `sending` | ht | Sending… | N ap voye… | 2026-11-15 | machine-drafted, needs native review |
| `resendEmail` | ht | Resend email | Voye imèl la ankò | 2026-11-15 | machine-drafted, needs native review |
| `useDifferentEmail` | ht | Use a different email | Sèvi ak yon lòt imèl | 2026-11-15 | machine-drafted, needs native review |
| `joinTitle` | ht | Join FEED | Antre nan FEED | 2026-11-15 | machine-drafted, needs native review |
| `joinSubtitle` | ht | Create an account to access community resources and support | Kreye yon kont pou jwenn resous ak sipò kominote a | 2026-11-15 | machine-drafted, needs native review |
| `firstName` | ht | First name | Prenon | 2026-11-15 | machine-drafted, needs native review |
| `firstNameHint` | ht | Public — shown to the community | Piblik — kominote a ap wè l | 2026-11-15 | machine-drafted, needs native review |
| `lastName` | ht | Last name | Non fanmi | 2026-11-15 | machine-drafted, needs native review |
| `lastNameHint` | ht | Private — shared only with a helper you message | Prive — se sèlman yon moun k ap ede w ou ekri ki wè l | 2026-11-15 | machine-drafted, needs native review |
| `passwordHint` | ht | At least 12 characters | Omwen 12 karaktè | 2026-11-15 | machine-drafted, needs native review |
| `signupPasswordHint` | ht | At least 12 characters, with at least three of: lowercase letters, uppercase letters, numbers, symbols (with 16 or more characters, two are enough). Avoid common patterns such as "password" or "123456". | Omwen 12 karaktè, ak omwen twa nan sa yo: lèt miniskil, lèt majiskil, chif, senbòl (avèk 16 karaktè oswa plis, de ase). Evite modèl komen tankou "password" oswa "123456". | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooLong` | ht | This password is too long. The limit is 72 bytes: 72 plain letters and numbers, fewer if you use accented letters, other alphabets or emoji. | Modpas sa a twò long. Limit la se 72 bytes: 72 lèt ak chif senp, mwens si w itilize lèt ak aksan, lòt alfabè oswa emoji. | 2026-11-15 | machine-drafted, needs native review |
| `passwordStrength` | ht | Password strength: {strength} | Fòs modpas la: {strength} | 2026-11-15 | machine-drafted, needs native review |
| `resendSent` | ht | We sent another confirmation email. | Nou voye yon lòt imèl konfimasyon. | 2026-11-15 | machine-drafted, needs native review |
| `confirmPassword` | ht | Confirm password | Konfime modpas la | 2026-11-15 | machine-drafted, needs native review |
| `strengthWeak` | ht | Weak | Fèb | 2026-11-15 | machine-drafted, needs native review |
| `strengthFair` | ht | Fair | Pasab | 2026-11-15 | machine-drafted, needs native review |
| `strengthGood` | ht | Good | Bon | 2026-11-15 | machine-drafted, needs native review |
| `strengthStrong` | ht | Strong | Fò | 2026-11-15 | machine-drafted, needs native review |
| `pwMinLength` | ht | Use at least 12 characters | Sèvi ak omwen 12 karaktè | 2026-11-15 | machine-drafted, needs native review |
| `pwLowercase` | ht | Add lowercase letters | Ajoute lèt miniskil | 2026-11-15 | machine-drafted, needs native review |
| `pwUppercase` | ht | Add uppercase letters | Ajoute lèt majiskil | 2026-11-15 | machine-drafted, needs native review |
| `pwNumbers` | ht | Add numbers | Ajoute chif | 2026-11-15 | machine-drafted, needs native review |
| `pwSpecial` | ht | Add special characters (!@#$%^&*) | Ajoute karaktè espesyal (!@#$%^&*) | 2026-11-15 | machine-drafted, needs native review |
| `pwCommon` | ht | Avoid common password patterns | Evite modèl modpas moun konn itilize | 2026-11-15 | machine-drafted, needs native review |
| `creatingAccount` | ht | Creating account… | N ap kreye kont lan… | 2026-11-15 | machine-drafted, needs native review |
| `createAccount` | ht | Create account | Kreye kont | 2026-11-15 | machine-drafted, needs native review |
| `orCreateAccount` | ht | or create an account | oswa kreye yon kont | 2026-11-15 | machine-drafted, needs native review |
| `forgotTitle` | ht | Reset your password | Chanje modpas ou | 2026-11-15 | machine-drafted, needs native review |
| `forgotSubtitle` | ht | Enter your email and we'll send you a reset link | Antre imèl ou epi n ap voye yon lyen pou chanje l | 2026-11-15 | machine-drafted, needs native review |
| `forgotSent` | ht | Check your email for a password reset link. | Gade imèl ou pou lyen pou chanje modpas la. | 2026-11-15 | machine-drafted, needs native review |
| `forgotSpam` | ht | If you don't see it, check your spam folder. | Si ou pa wè l, gade nan dosye spam ou. | 2026-11-15 | machine-drafted, needs native review |
| `emailAddress` | ht | Email address | Adrès imèl | 2026-11-15 | machine-drafted, needs native review |
| `sendResetLink` | ht | Send reset link | Voye lyen an | 2026-11-15 | machine-drafted, needs native review |
| `forgotFailed` | ht | We couldn't send the reset link. Please try again. | Nou pa t ka voye lyen an. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `resetTitle` | ht | Set new password | Mete yon nouvo modpas | 2026-11-15 | machine-drafted, needs native review |
| `resetSubtitle` | ht | Choose a strong password of at least 12 characters | Chwazi yon modpas solid ki gen omwen 12 karaktè | 2026-11-15 | machine-drafted, needs native review |
| `resetDone` | ht | Password updated successfully. | Modpas la chanje. | 2026-11-15 | machine-drafted, needs native review |
| `resetRedirecting` | ht | Redirecting you to sign in… | N ap mennen w nan koneksyon… | 2026-11-15 | machine-drafted, needs native review |
| `resetHelp` | ht | If your new password doesn't work, please request another reset link. | Si nouvo modpas ou pa mache, tanpri mande yon lòt lyen. | 2026-11-15 | machine-drafted, needs native review |
| `newPassword` | ht | New password | Nouvo modpas | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooShort` | ht | Password must be at least 12 characters. | Modpas la dwe gen omwen 12 karaktè. | 2026-11-15 | machine-drafted, needs native review |
| `updating` | ht | Updating… | N ap mete ajou… | 2026-11-15 | machine-drafted, needs native review |
| `updatePassword` | ht | Update password | Mete modpas la ajou | 2026-11-15 | machine-drafted, needs native review |
| `samePassword` | ht | Choose a password different from your current one. | Chwazi yon modpas ki diferan de sa w genyen an. | 2026-11-15 | machine-drafted, needs native review |
| `resetFailed` | ht | We couldn't update your password. Please request a new reset link and try again. | Nou pa t ka chanje modpas ou. Tanpri mande yon nouvo lyen epi eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `mfaTitle` | ht | Two-Factor Authentication | Verifikasyon de etap | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackupPrompt` | ht | Enter a backup code to sign in | Antre yon kòd sekou pou konekte | 2026-11-15 | machine-drafted, needs native review |
| `mfaAppPrompt` | ht | Enter the code from your authenticator app | Antre kòd ki nan aplikasyon otantifikasyon w lan | 2026-11-15 | machine-drafted, needs native review |
| `mfaInitFailed` | ht | Failed to initialize MFA verification | Nou pa t ka kòmanse verifikasyon de etap la | 2026-11-15 | machine-drafted, needs native review |
| `mfaInvalidFormat` | ht | Please enter a valid 6-digit code | Tanpri antre yon kòd 6 chif ki valab | 2026-11-15 | machine-drafted, needs native review |
| `mfaInvalidCode` | ht | Invalid verification code | Kòd verifikasyon an pa valab | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerifyFailed` | ht | Verification failed | Verifikasyon an echwe | 2026-11-15 | machine-drafted, needs native review |
| `mfaEnterBackup` | ht | Please enter a backup code | Tanpri antre yon kòd sekou | 2026-11-15 | machine-drafted, needs native review |
| `mfaInvalidBackup` | ht | Invalid backup code | Kòd sekou a pa valab | 2026-11-15 | machine-drafted, needs native review |
| `mfaCodeLabel` | ht | 6-digit code | Kòd 6 chif | 2026-11-15 | machine-drafted, needs native review |
| `mfaCodeHint` | ht | The code is checked when you enter the 6th digit. It changes every 30 seconds. | Nou verifye kòd la lè ou antre 6yèm chif la. Li chanje chak 30 segonn. | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerifying` | ht | Verifying... | N ap verifye… | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerify` | ht | Verify | Verifye | 2026-11-15 | machine-drafted, needs native review |
| `mfaOr` | ht | Or | Oswa | 2026-11-15 | machine-drafted, needs native review |
| `mfaUseBackup` | ht | Use Backup Code | Sèvi ak yon kòd sekou | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackupLabel` | ht | Backup code | Kòd sekou | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackupHint` | ht | Each backup code can only be used once | Ou ka sèvi ak chak kòd sekou yon sèl fwa | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerifyBackup` | ht | Verify Backup Code | Verifye kòd sekou a | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackToApp` | ht | Back to Authenticator Code | Retounen nan kòd aplikasyon an | 2026-11-15 | machine-drafted, needs native review |
| `mfaDifferentUser` | ht | Sign in as different user | Konekte ak yon lòt kont | 2026-11-15 | machine-drafted, needs native review |
| `securityCheckFailed` | so | Security validation failed. Please refresh the page and try again. | Hubinta amniga way fashilantay. Fadlan dib u cusboonaysii bogga oo isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `orContinueWith` | so | Or continue with | Ama ku sii wad | 2026-11-15 | machine-drafted, needs native review |
| `opening` | so | Opening… | Waa la furayaa… | 2026-11-15 | machine-drafted, needs native review |
| `guestHint` | so | Browse map, programs, and community resources instantly | Isla markiiba daalaco khariidadda, barnaamijyada iyo kheyraadka bulshada | 2026-11-15 | machine-drafted, needs native review |
| `guestFailed` | so | We couldn't start a guest session. Please try again. | Lama bilaabi karin fadhi marti. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `oauthStartFailed` | so | We couldn't reach the sign-in provider. Please try again. | Lama gaari karin bixiyaha galitaanka. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `lockedWait` | so | Locked — wait 15 minutes | Waa la xiray — sug 15 daqiiqo | 2026-11-15 | machine-drafted, needs native review |
| `captchaFailed` | so | The security check didn't complete. Please try again. | Hubinta amniga ma dhammaystirmin. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `loading` | so | Loading… | Waa la soo rarayaa… | 2026-11-15 | machine-drafted, needs native review |
| `emailInvalid` | so | Enter a valid email address. | Geli ciwaan iimayl oo sax ah. | 2026-11-15 | machine-drafted, needs native review |
| `emailRateLimited` | so | Too many emails were sent. Please wait a few minutes and try again. | Iimayllo aad u badan ayaa la diray. Fadlan sug dhowr daqiiqo oo isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `backToSignIn` | so | Back to sign in | Ku noqo galitaanka | 2026-11-15 | machine-drafted, needs native review |
| `haveAccount` | so | Already have an account? | Horay ma u leedahay akoon? | 2026-11-15 | machine-drafted, needs native review |
| `loginRateLimited` | so | Too many login attempts. Please wait 15 minutes before trying again. | Isku dayo galitaan oo aad u badan. Fadlan sug 15 daqiiqo ka hor intaadan mar kale isku dayin. | 2026-11-15 | machine-drafted, needs native review |
| `invalidCredentials` | so | That email and password don't match. Please try again. | Iimaylka iyo furaha sirta ah isma waafaqaan. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `emailNotConfirmed` | so | Please confirm your email first. Check your inbox for the link. | Fadlan marka hore xaqiiji iimaylkaaga. Ka eeg xiriirka sanduuqa fariimahaaga. | 2026-11-15 | machine-drafted, needs native review |
| `signInFailed` | so | We couldn't sign you in. Please try again. | Kuma gelin karin. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `mfaCodeNeeded` | so | Enter the 6-digit code from your authenticator app to continue. | Geli koodhka 6-da god ah ee abka xaqiijinta si aad u sii wadato. | 2026-11-15 | machine-drafted, needs native review |
| `oauthProvider` | so | Sign-in failed: the provider rejected the request. | Galitaanku wuu fashilmay: bixiyuhu wuu diiday codsiga. | 2026-11-15 | machine-drafted, needs native review |
| `oauthExchange` | so | Sign-in failed: the session could not be started. | Galitaanku wuu fashilmay: fadhiga lama bilaabi karin. | 2026-11-15 | machine-drafted, needs native review |
| `oauthNoCode` | so | Sign-in failed: no authorization code was received. | Galitaanku wuu fashilmay: lama helin koodh oggolaansho. | 2026-11-15 | machine-drafted, needs native review |
| `oauthNoSession` | so | Sign-in failed: the session was not created. | Galitaanku wuu fashilmay: fadhiga lama abuurin. | 2026-11-15 | machine-drafted, needs native review |
| `confirmationFailed` | so | That confirmation link didn't work. It may have expired — sign in or request a new link. | Xiriirka xaqiijintu ma shaqayn. Waxaa laga yaabaa inuu dhacay — gal ama codso xiriir cusub. | 2026-11-15 | machine-drafted, needs native review |
| `oauthFailed` | so | Sign-in failed. Please try again. | Galitaanku wuu fashilmay. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `signingIn` | so | Signing in… | Waa la galayaa… | 2026-11-15 | machine-drafted, needs native review |
| `orSignIn` | so | or sign in | ama gal | 2026-11-15 | machine-drafted, needs native review |
| `signupRateLimited` | so | Too many signup attempts. Please wait 15 minutes before trying again. | Isku dayo diiwaangelin oo aad u badan. Fadlan sug 15 daqiiqo ka hor intaadan mar kale isku dayin. | 2026-11-15 | machine-drafted, needs native review |
| `passwordsMismatch` | so | Passwords do not match. | Furayaasha sirta ahi isma waafaqaan. | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooWeak` | so | Password does not meet security requirements. | Furaha sirta ahi ma buuxinayo shuruudaha amniga. | 2026-11-15 | machine-drafted, needs native review |
| `acceptTermsRequired` | so | You must accept the terms of service. | Waa inaad aqbashaa shuruudaha adeegga. | 2026-11-15 | machine-drafted, needs native review |
| `accountExists` | so | An account with this email already exists. Please sign in instead. | Akoon leh iimaylkan horay ayuu u jiray. Fadlan gal halkii. | 2026-11-15 | machine-drafted, needs native review |
| `signupFailed` | so | We couldn't create your account. Please try again. | Lama abuuri karin akoonkaaga. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `signupUnavailable` | so | New accounts can't be created right now. Please try again later. | Hadda lama abuuri karo akoono cusub. Fadlan isku day mar dambe. | 2026-11-15 | machine-drafted, needs native review |
| `resendFailed` | so | We couldn't resend the confirmation email. Please try again. | Lama dib u diri karin iimaylka xaqiijinta. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `checkEmailTitle` | so | Check your email | Eeg iimaylkaaga | 2026-11-15 | machine-drafted, needs native review |
| `checkEmailSent` | so | We've sent a confirmation link to {email}. Click the link to verify your account. | Waxaan xiriir xaqiijin u dirnay {email}. Guji xiriirka si aad u xaqiijiso akoonkaaga. | 2026-11-15 | machine-drafted, needs native review |
| `checkSpam` | so | Didn't receive it? Check your spam or junk folder. | Ma helin? Eeg galka spam-ka ama qashinka. | 2026-11-15 | machine-drafted, needs native review |
| `confirmEmailCorrect` | so | Make sure {email} is correct. | Hubi in {email} uu sax yahay. | 2026-11-15 | machine-drafted, needs native review |
| `sending` | so | Sending… | Waa la dirayaa… | 2026-11-15 | machine-drafted, needs native review |
| `resendEmail` | so | Resend email | Dib u dir iimaylka | 2026-11-15 | machine-drafted, needs native review |
| `useDifferentEmail` | so | Use a different email | Isticmaal iimayl kale | 2026-11-15 | machine-drafted, needs native review |
| `joinTitle` | so | Join FEED | Ku biir FEED | 2026-11-15 | machine-drafted, needs native review |
| `joinSubtitle` | so | Create an account to access community resources and support | Samee akoon si aad u hesho kheyraadka iyo taageerada bulshada | 2026-11-15 | machine-drafted, needs native review |
| `firstName` | so | First name | Magaca koowaad | 2026-11-15 | machine-drafted, needs native review |
| `firstNameHint` | so | Public — shown to the community | Guud — bulshada ayaa arka | 2026-11-15 | machine-drafted, needs native review |
| `lastName` | so | Last name | Magaca qoyska | 2026-11-15 | machine-drafted, needs native review |
| `lastNameHint` | so | Private — shared only with a helper you message | Gaar — waxaa arka oo keliya caawiye aad fariin u dirto | 2026-11-15 | machine-drafted, needs native review |
| `passwordHint` | so | At least 12 characters | Ugu yaraan 12 xaraf | 2026-11-15 | machine-drafted, needs native review |
| `signupPasswordHint` | so | At least 12 characters, with at least three of: lowercase letters, uppercase letters, numbers, symbols (with 16 or more characters, two are enough). Avoid common patterns such as "password" or "123456". | Ugu yaraan 12 xaraf, oo leh ugu yaraan saddex ka mid ah: xarfo yaryar, xarfo waaweyn, tirooyin, calaamado (haddii ay yihiin 16 xaraf ama ka badan, laba ayaa ku filan). Iska ilaali qaababka caadiga ah sida "password" ama "123456". | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooLong` | so | This password is too long. The limit is 72 bytes: 72 plain letters and numbers, fewer if you use accented letters, other alphabets or emoji. | Furahan sirta ah aad buu u dheer yahay. Xadku waa 72 bytes: 72 xaraf iyo tiro caadi ah, ka yar haddii aad isticmaasho xarfo calaamado leh, alifbeetooyin kale ama emoji. | 2026-11-15 | machine-drafted, needs native review |
| `passwordStrength` | so | Password strength: {strength} | Xoogga furaha sirta ah: {strength} | 2026-11-15 | machine-drafted, needs native review |
| `resendSent` | so | We sent another confirmation email. | Waxaan kuu dirnay iimayl xaqiijin kale. | 2026-11-15 | machine-drafted, needs native review |
| `confirmPassword` | so | Confirm password | Xaqiiji furaha sirta ah | 2026-11-15 | machine-drafted, needs native review |
| `strengthWeak` | so | Weak | Daciif | 2026-11-15 | machine-drafted, needs native review |
| `strengthFair` | so | Fair | Dhexdhexaad | 2026-11-15 | machine-drafted, needs native review |
| `strengthGood` | so | Good | Wanaagsan | 2026-11-15 | machine-drafted, needs native review |
| `strengthStrong` | so | Strong | Xoog leh | 2026-11-15 | machine-drafted, needs native review |
| `pwMinLength` | so | Use at least 12 characters | Isticmaal ugu yaraan 12 xaraf | 2026-11-15 | machine-drafted, needs native review |
| `pwLowercase` | so | Add lowercase letters | Ku dar xarfo yaryar | 2026-11-15 | machine-drafted, needs native review |
| `pwUppercase` | so | Add uppercase letters | Ku dar xarfo waaweyn | 2026-11-15 | machine-drafted, needs native review |
| `pwNumbers` | so | Add numbers | Ku dar tirooyin | 2026-11-15 | machine-drafted, needs native review |
| `pwSpecial` | so | Add special characters (!@#$%^&*) | Ku dar calaamado gaar ah (!@#$%^&*) | 2026-11-15 | machine-drafted, needs native review |
| `pwCommon` | so | Avoid common password patterns | Iska ilaali qaababka furaha sirta ah ee caadiga ah | 2026-11-15 | machine-drafted, needs native review |
| `creatingAccount` | so | Creating account… | Akoonka waa la abuurayaa… | 2026-11-15 | machine-drafted, needs native review |
| `createAccount` | so | Create account | Samee akoon | 2026-11-15 | machine-drafted, needs native review |
| `orCreateAccount` | so | or create an account | ama samee akoon | 2026-11-15 | machine-drafted, needs native review |
| `forgotTitle` | so | Reset your password | Dib u deji furahaaga sirta ah | 2026-11-15 | machine-drafted, needs native review |
| `forgotSubtitle` | so | Enter your email and we'll send you a reset link | Geli iimaylkaaga waxaanan kuu soo diri doonnaa xiriir dib-u-dejin | 2026-11-15 | machine-drafted, needs native review |
| `forgotSent` | so | Check your email for a password reset link. | Ka eeg iimaylkaaga xiriirka dib-u-dejinta furaha sirta ah. | 2026-11-15 | machine-drafted, needs native review |
| `forgotSpam` | so | If you don't see it, check your spam folder. | Haddii aadan arkin, eeg galka spam-ka. | 2026-11-15 | machine-drafted, needs native review |
| `emailAddress` | so | Email address | Ciwaanka iimaylka | 2026-11-15 | machine-drafted, needs native review |
| `sendResetLink` | so | Send reset link | Dir xiriirka dib-u-dejinta | 2026-11-15 | machine-drafted, needs native review |
| `forgotFailed` | so | We couldn't send the reset link. Please try again. | Lama diri karin xiriirka dib-u-dejinta. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `resetTitle` | so | Set new password | Deji fure sir ah oo cusub | 2026-11-15 | machine-drafted, needs native review |
| `resetSubtitle` | so | Choose a strong password of at least 12 characters | Dooro fure sir ah oo adag oo ugu yaraan 12 xaraf ah | 2026-11-15 | machine-drafted, needs native review |
| `resetDone` | so | Password updated successfully. | Furaha sirta ah si guul leh ayaa loo cusboonaysiiyay. | 2026-11-15 | machine-drafted, needs native review |
| `resetRedirecting` | so | Redirecting you to sign in… | Waxaa laguu wareejinayaa galitaanka… | 2026-11-15 | machine-drafted, needs native review |
| `resetHelp` | so | If your new password doesn't work, please request another reset link. | Haddii furaha cusubi uusan shaqayn, fadlan codso xiriir kale. | 2026-11-15 | machine-drafted, needs native review |
| `newPassword` | so | New password | Fure sir ah oo cusub | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooShort` | so | Password must be at least 12 characters. | Furaha sirta ahi waa inuu ahaadaa ugu yaraan 12 xaraf. | 2026-11-15 | machine-drafted, needs native review |
| `updating` | so | Updating… | Waa la cusboonaysiinayaa… | 2026-11-15 | machine-drafted, needs native review |
| `updatePassword` | so | Update password | Cusboonaysii furaha sirta ah | 2026-11-15 | machine-drafted, needs native review |
| `samePassword` | so | Choose a password different from your current one. | Dooro fure sir ah oo ka duwan kan aad hadda haysato. | 2026-11-15 | machine-drafted, needs native review |
| `resetFailed` | so | We couldn't update your password. Please request a new reset link and try again. | Lama cusboonaysiin karin furahaaga sirta ah. Fadlan codso xiriir cusub oo isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `mfaTitle` | so | Two-Factor Authentication | Xaqiijinta laba-tallaabo | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackupPrompt` | so | Enter a backup code to sign in | Geli koodh kayd ah si aad u gasho | 2026-11-15 | machine-drafted, needs native review |
| `mfaAppPrompt` | so | Enter the code from your authenticator app | Geli koodhka ka yimid abka xaqiijinta | 2026-11-15 | machine-drafted, needs native review |
| `mfaInitFailed` | so | Failed to initialize MFA verification | Lama bilaabi karin xaqiijinta laba-tallaabo | 2026-11-15 | machine-drafted, needs native review |
| `mfaInvalidFormat` | so | Please enter a valid 6-digit code | Fadlan geli koodh sax ah oo 6 god ah | 2026-11-15 | machine-drafted, needs native review |
| `mfaInvalidCode` | so | Invalid verification code | Koodhka xaqiijintu ma saxna | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerifyFailed` | so | Verification failed | Xaqiijintu way fashilantay | 2026-11-15 | machine-drafted, needs native review |
| `mfaEnterBackup` | so | Please enter a backup code | Fadlan geli koodh kayd ah | 2026-11-15 | machine-drafted, needs native review |
| `mfaInvalidBackup` | so | Invalid backup code | Koodhka kaydku ma saxna | 2026-11-15 | machine-drafted, needs native review |
| `mfaCodeLabel` | so | 6-digit code | Koodh 6 god ah | 2026-11-15 | machine-drafted, needs native review |
| `mfaCodeHint` | so | The code is checked when you enter the 6th digit. It changes every 30 seconds. | Koodhka waa la hubiyaa marka aad geliso godka 6aad. Wuxuu is beddelaa 30-kii ilbiriqsi kasta. | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerifying` | so | Verifying... | Waa la xaqiijinayaa… | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerify` | so | Verify | Xaqiiji | 2026-11-15 | machine-drafted, needs native review |
| `mfaOr` | so | Or | Ama | 2026-11-15 | machine-drafted, needs native review |
| `mfaUseBackup` | so | Use Backup Code | Isticmaal koodh kayd ah | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackupLabel` | so | Backup code | Koodh kayd ah | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackupHint` | so | Each backup code can only be used once | Koodh kayd kasta mar keliya ayaa la isticmaali karaa | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerifyBackup` | so | Verify Backup Code | Xaqiiji koodhka kaydka | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackToApp` | so | Back to Authenticator Code | Ku noqo koodhka abka | 2026-11-15 | machine-drafted, needs native review |
| `mfaDifferentUser` | so | Sign in as different user | Ku gal akoon kale | 2026-11-15 | machine-drafted, needs native review |
| `securityCheckFailed` | am | Security validation failed. Please refresh the page and try again. | የደህንነት ማረጋገጫው አልተሳካም። እባክዎ ገጹን ያድሱና እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `orContinueWith` | am | Or continue with | ወይም በዚህ ይቀጥሉ | 2026-11-15 | machine-drafted, needs native review |
| `opening` | am | Opening… | በመክፈት ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `guestHint` | am | Browse map, programs, and community resources instantly | ካርታውን፣ ፕሮግራሞችንና የማህበረሰብ ሀብቶችን ወዲያውኑ ያስሱ | 2026-11-15 | machine-drafted, needs native review |
| `guestFailed` | am | We couldn't start a guest session. Please try again. | የእንግዳ ክፍለ ጊዜ መጀመር አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `oauthStartFailed` | am | We couldn't reach the sign-in provider. Please try again. | የመግቢያ አገልግሎት ሰጪውን ማግኘት አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `lockedWait` | am | Locked — wait 15 minutes | ተቆልፏል — 15 ደቂቃ ይጠብቁ | 2026-11-15 | machine-drafted, needs native review |
| `captchaFailed` | am | The security check didn't complete. Please try again. | የደህንነት ፍተሻው አልተጠናቀቀም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `loading` | am | Loading… | በመጫን ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `emailInvalid` | am | Enter a valid email address. | ትክክለኛ የኢሜይል አድራሻ ያስገቡ። | 2026-11-15 | machine-drafted, needs native review |
| `emailRateLimited` | am | Too many emails were sent. Please wait a few minutes and try again. | በጣም ብዙ ኢሜይሎች ተልከዋል። እባክዎ ጥቂት ደቂቃዎች ጠብቀው እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `backToSignIn` | am | Back to sign in | ወደ መግቢያ ተመለስ | 2026-11-15 | machine-drafted, needs native review |
| `haveAccount` | am | Already have an account? | መለያ አለዎት? | 2026-11-15 | machine-drafted, needs native review |
| `loginRateLimited` | am | Too many login attempts. Please wait 15 minutes before trying again. | በጣም ብዙ የመግቢያ ሙከራዎች። እባክዎ እንደገና ከመሞከርዎ በፊት 15 ደቂቃ ይጠብቁ። | 2026-11-15 | machine-drafted, needs native review |
| `invalidCredentials` | am | That email and password don't match. Please try again. | ኢሜይሉና የይለፍ ቃሉ አይዛመዱም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `emailNotConfirmed` | am | Please confirm your email first. Check your inbox for the link. | እባክዎ መጀመሪያ ኢሜይልዎን ያረጋግጡ። ሊንኩን በገቢ መልእክት ሳጥንዎ ይፈልጉ። | 2026-11-15 | machine-drafted, needs native review |
| `signInFailed` | am | We couldn't sign you in. Please try again. | ልናስገባዎ አልቻልንም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `mfaCodeNeeded` | am | Enter the 6-digit code from your authenticator app to continue. | ለመቀጠል ከማረጋገጫ መተግበሪያዎ ባለ 6 አሃዝ ኮዱን ያስገቡ። | 2026-11-15 | machine-drafted, needs native review |
| `oauthProvider` | am | Sign-in failed: the provider rejected the request. | መግባት አልተሳካም፦ አገልግሎት ሰጪው ጥያቄውን አልተቀበለም። | 2026-11-15 | machine-drafted, needs native review |
| `oauthExchange` | am | Sign-in failed: the session could not be started. | መግባት አልተሳካም፦ ክፍለ ጊዜውን መጀመር አልተቻለም። | 2026-11-15 | machine-drafted, needs native review |
| `oauthNoCode` | am | Sign-in failed: no authorization code was received. | መግባት አልተሳካም፦ የፈቃድ ኮድ አልደረሰም። | 2026-11-15 | machine-drafted, needs native review |
| `oauthNoSession` | am | Sign-in failed: the session was not created. | መግባት አልተሳካም፦ ክፍለ ጊዜው አልተፈጠረም። | 2026-11-15 | machine-drafted, needs native review |
| `confirmationFailed` | am | That confirmation link didn't work. It may have expired — sign in or request a new link. | ያ የማረጋገጫ ሊንክ አልሰራም። ጊዜው አልፎበት ሊሆን ይችላል — ይግቡ ወይም አዲስ ሊንክ ይጠይቁ። | 2026-11-15 | machine-drafted, needs native review |
| `oauthFailed` | am | Sign-in failed. Please try again. | መግባት አልተሳካም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `signingIn` | am | Signing in… | በመግባት ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `orSignIn` | am | or sign in | ወይም ይግቡ | 2026-11-15 | machine-drafted, needs native review |
| `signupRateLimited` | am | Too many signup attempts. Please wait 15 minutes before trying again. | በጣም ብዙ የምዝገባ ሙከራዎች። እባክዎ እንደገና ከመሞከርዎ በፊት 15 ደቂቃ ይጠብቁ። | 2026-11-15 | machine-drafted, needs native review |
| `passwordsMismatch` | am | Passwords do not match. | የይለፍ ቃሎቹ አይዛመዱም። | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooWeak` | am | Password does not meet security requirements. | የይለፍ ቃሉ የደህንነት መስፈርቶችን አያሟላም። | 2026-11-15 | machine-drafted, needs native review |
| `acceptTermsRequired` | am | You must accept the terms of service. | የአገልግሎት ውሉን መቀበል አለብዎት። | 2026-11-15 | machine-drafted, needs native review |
| `accountExists` | am | An account with this email already exists. Please sign in instead. | በዚህ ኢሜይል መለያ አስቀድሞ አለ። እባክዎ በምትኩ ይግቡ። | 2026-11-15 | machine-drafted, needs native review |
| `signupFailed` | am | We couldn't create your account. Please try again. | መለያዎን መፍጠር አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `signupUnavailable` | am | New accounts can't be created right now. Please try again later. | አሁን አዲስ መለያ መፍጠር አይቻልም። እባክዎ ቆይተው ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `resendFailed` | am | We couldn't resend the confirmation email. Please try again. | የማረጋገጫ ኢሜይሉን እንደገና መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `checkEmailTitle` | am | Check your email | ኢሜይልዎን ይመልከቱ | 2026-11-15 | machine-drafted, needs native review |
| `checkEmailSent` | am | We've sent a confirmation link to {email}. Click the link to verify your account. | ወደ {email} የማረጋገጫ ሊንክ ልከናል። መለያዎን ለማረጋገጥ ሊንኩን ይጫኑ። | 2026-11-15 | machine-drafted, needs native review |
| `checkSpam` | am | Didn't receive it? Check your spam or junk folder. | አልደረሰዎትም? የአይፈለጌ መልእክት ማህደሩን ይመልከቱ። | 2026-11-15 | machine-drafted, needs native review |
| `confirmEmailCorrect` | am | Make sure {email} is correct. | {email} ትክክል መሆኑን ያረጋግጡ። | 2026-11-15 | machine-drafted, needs native review |
| `sending` | am | Sending… | በመላክ ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `resendEmail` | am | Resend email | ኢሜይሉን እንደገና ላክ | 2026-11-15 | machine-drafted, needs native review |
| `useDifferentEmail` | am | Use a different email | ሌላ ኢሜይል ተጠቀም | 2026-11-15 | machine-drafted, needs native review |
| `joinTitle` | am | Join FEED | FEEDን ይቀላቀሉ | 2026-11-15 | machine-drafted, needs native review |
| `joinSubtitle` | am | Create an account to access community resources and support | የማህበረሰብ ሀብቶችንና ድጋፍን ለማግኘት መለያ ይፍጠሩ | 2026-11-15 | machine-drafted, needs native review |
| `firstName` | am | First name | የመጀመሪያ ስም | 2026-11-15 | machine-drafted, needs native review |
| `firstNameHint` | am | Public — shown to the community | ይፋዊ — ለማህበረሰቡ ይታያል | 2026-11-15 | machine-drafted, needs native review |
| `lastName` | am | Last name | የአባት ስም | 2026-11-15 | machine-drafted, needs native review |
| `lastNameHint` | am | Private — shared only with a helper you message | የግል — መልእክት ለሚልኩለት ረዳት ብቻ ይታያል | 2026-11-15 | machine-drafted, needs native review |
| `passwordHint` | am | At least 12 characters | ቢያንስ 12 ቁምፊዎች | 2026-11-15 | machine-drafted, needs native review |
| `signupPasswordHint` | am | At least 12 characters, with at least three of: lowercase letters, uppercase letters, numbers, symbols (with 16 or more characters, two are enough). Avoid common patterns such as "password" or "123456". | ቢያንስ 12 ቁምፊዎች፣ ከሚከተሉት ቢያንስ ሶስቱን ያካተተ፦ ትናንሽ ፊደላት፣ ትላልቅ ፊደላት፣ ቁጥሮች፣ ምልክቶች (16 ወይም ከዚያ በላይ ቁምፊዎች ከሆኑ ሁለቱ ይበቃሉ)። እንደ "password" ወይም "123456" ያሉ የተለመዱ ቅጦችን ያስወግዱ። | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooLong` | am | This password is too long. The limit is 72 bytes: 72 plain letters and numbers, fewer if you use accented letters, other alphabets or emoji. | ይህ የይለፍ ቃል በጣም ረጅም ነው። ገደቡ 72 ባይት ነው፦ 72 ቀላል የእንግሊዝኛ ፊደላትና ቁጥሮች፤ የአማርኛ ፊደላትን ወይም ኢሞጂ ከተጠቀሙ ያነሰ። | 2026-11-15 | machine-drafted, needs native review |
| `passwordStrength` | am | Password strength: {strength} | የይለፍ ቃል ጥንካሬ፦ {strength} | 2026-11-15 | machine-drafted, needs native review |
| `resendSent` | am | We sent another confirmation email. | ሌላ የማረጋገጫ ኢሜይል ልከናል። | 2026-11-15 | machine-drafted, needs native review |
| `confirmPassword` | am | Confirm password | የይለፍ ቃሉን ያረጋግጡ | 2026-11-15 | machine-drafted, needs native review |
| `strengthWeak` | am | Weak | ደካማ | 2026-11-15 | machine-drafted, needs native review |
| `strengthFair` | am | Fair | መካከለኛ | 2026-11-15 | machine-drafted, needs native review |
| `strengthGood` | am | Good | ጥሩ | 2026-11-15 | machine-drafted, needs native review |
| `strengthStrong` | am | Strong | ጠንካራ | 2026-11-15 | machine-drafted, needs native review |
| `pwMinLength` | am | Use at least 12 characters | ቢያንስ 12 ቁምፊዎችን ይጠቀሙ | 2026-11-15 | machine-drafted, needs native review |
| `pwLowercase` | am | Add lowercase letters | ትናንሽ ፊደላትን ያክሉ | 2026-11-15 | machine-drafted, needs native review |
| `pwUppercase` | am | Add uppercase letters | ትላልቅ ፊደላትን ያክሉ | 2026-11-15 | machine-drafted, needs native review |
| `pwNumbers` | am | Add numbers | ቁጥሮችን ያክሉ | 2026-11-15 | machine-drafted, needs native review |
| `pwSpecial` | am | Add special characters (!@#$%^&*) | ልዩ ምልክቶችን ያክሉ (!@#$%^&*) | 2026-11-15 | machine-drafted, needs native review |
| `pwCommon` | am | Avoid common password patterns | የተለመዱ የይለፍ ቃል ቅጦችን ያስወግዱ | 2026-11-15 | machine-drafted, needs native review |
| `creatingAccount` | am | Creating account… | መለያ በመፍጠር ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `createAccount` | am | Create account | መለያ ፍጠር | 2026-11-15 | machine-drafted, needs native review |
| `orCreateAccount` | am | or create an account | ወይም መለያ ይፍጠሩ | 2026-11-15 | machine-drafted, needs native review |
| `forgotTitle` | am | Reset your password | የይለፍ ቃልዎን ዳግም ያስጀምሩ | 2026-11-15 | machine-drafted, needs native review |
| `forgotSubtitle` | am | Enter your email and we'll send you a reset link | ኢሜይልዎን ያስገቡና የዳግም ማስጀመሪያ ሊንክ እንልክልዎታለን | 2026-11-15 | machine-drafted, needs native review |
| `forgotSent` | am | Check your email for a password reset link. | የይለፍ ቃል ዳግም ማስጀመሪያ ሊንኩን በኢሜይልዎ ይፈልጉ። | 2026-11-15 | machine-drafted, needs native review |
| `forgotSpam` | am | If you don't see it, check your spam folder. | ካላዩት የአይፈለጌ መልእክት ማህደሩን ይመልከቱ። | 2026-11-15 | machine-drafted, needs native review |
| `emailAddress` | am | Email address | የኢሜይል አድራሻ | 2026-11-15 | machine-drafted, needs native review |
| `sendResetLink` | am | Send reset link | የዳግም ማስጀመሪያ ሊንክ ላክ | 2026-11-15 | machine-drafted, needs native review |
| `forgotFailed` | am | We couldn't send the reset link. Please try again. | የዳግም ማስጀመሪያ ሊንኩን መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `resetTitle` | am | Set new password | አዲስ የይለፍ ቃል ያዘጋጁ | 2026-11-15 | machine-drafted, needs native review |
| `resetSubtitle` | am | Choose a strong password of at least 12 characters | ቢያንስ 12 ቁምፊዎች ያሉት ጠንካራ የይለፍ ቃል ይምረጡ | 2026-11-15 | machine-drafted, needs native review |
| `resetDone` | am | Password updated successfully. | የይለፍ ቃሉ በተሳካ ሁኔታ ተዘምኗል። | 2026-11-15 | machine-drafted, needs native review |
| `resetRedirecting` | am | Redirecting you to sign in… | ወደ መግቢያ በማዛወር ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `resetHelp` | am | If your new password doesn't work, please request another reset link. | አዲሱ የይለፍ ቃልዎ ካልሰራ እባክዎ ሌላ የዳግም ማስጀመሪያ ሊንክ ይጠይቁ። | 2026-11-15 | machine-drafted, needs native review |
| `newPassword` | am | New password | አዲስ የይለፍ ቃል | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooShort` | am | Password must be at least 12 characters. | የይለፍ ቃሉ ቢያንስ 12 ቁምፊዎች ሊኖሩት ይገባል። | 2026-11-15 | machine-drafted, needs native review |
| `updating` | am | Updating… | በማዘመን ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `updatePassword` | am | Update password | የይለፍ ቃሉን አዘምን | 2026-11-15 | machine-drafted, needs native review |
| `samePassword` | am | Choose a password different from your current one. | ከአሁኑ የተለየ የይለፍ ቃል ይምረጡ። | 2026-11-15 | machine-drafted, needs native review |
| `resetFailed` | am | We couldn't update your password. Please request a new reset link and try again. | የይለፍ ቃልዎን ማዘመን አልተቻለም። እባክዎ አዲስ ሊንክ ጠይቀው እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `mfaTitle` | am | Two-Factor Authentication | ባለሁለት ደረጃ ማረጋገጫ | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackupPrompt` | am | Enter a backup code to sign in | ለመግባት የመጠባበቂያ ኮድ ያስገቡ | 2026-11-15 | machine-drafted, needs native review |
| `mfaAppPrompt` | am | Enter the code from your authenticator app | ከማረጋገጫ መተግበሪያዎ ኮዱን ያስገቡ | 2026-11-15 | machine-drafted, needs native review |
| `mfaInitFailed` | am | Failed to initialize MFA verification | ባለሁለት ደረጃ ማረጋገጫውን መጀመር አልተቻለም | 2026-11-15 | machine-drafted, needs native review |
| `mfaInvalidFormat` | am | Please enter a valid 6-digit code | እባክዎ ትክክለኛ ባለ 6 አሃዝ ኮድ ያስገቡ | 2026-11-15 | machine-drafted, needs native review |
| `mfaInvalidCode` | am | Invalid verification code | የማረጋገጫ ኮዱ ልክ አይደለም | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerifyFailed` | am | Verification failed | ማረጋገጫው አልተሳካም | 2026-11-15 | machine-drafted, needs native review |
| `mfaEnterBackup` | am | Please enter a backup code | እባክዎ የመጠባበቂያ ኮድ ያስገቡ | 2026-11-15 | machine-drafted, needs native review |
| `mfaInvalidBackup` | am | Invalid backup code | የመጠባበቂያ ኮዱ ልክ አይደለም | 2026-11-15 | machine-drafted, needs native review |
| `mfaCodeLabel` | am | 6-digit code | ባለ 6 አሃዝ ኮድ | 2026-11-15 | machine-drafted, needs native review |
| `mfaCodeHint` | am | The code is checked when you enter the 6th digit. It changes every 30 seconds. | ኮዱ 6ኛውን አሃዝ ሲያስገቡ ይፈተሻል። በየ30 ሰከንዱ ይቀየራል። | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerifying` | am | Verifying... | በማረጋገጥ ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerify` | am | Verify | አረጋግጥ | 2026-11-15 | machine-drafted, needs native review |
| `mfaOr` | am | Or | ወይም | 2026-11-15 | machine-drafted, needs native review |
| `mfaUseBackup` | am | Use Backup Code | የመጠባበቂያ ኮድ ተጠቀም | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackupLabel` | am | Backup code | የመጠባበቂያ ኮድ | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackupHint` | am | Each backup code can only be used once | እያንዳንዱ የመጠባበቂያ ኮድ አንድ ጊዜ ብቻ ነው የሚያገለግለው | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerifyBackup` | am | Verify Backup Code | የመጠባበቂያ ኮዱን አረጋግጥ | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackToApp` | am | Back to Authenticator Code | ወደ መተግበሪያ ኮድ ተመለስ | 2026-11-15 | machine-drafted, needs native review |
| `mfaDifferentUser` | am | Sign in as different user | በሌላ መለያ ይግቡ | 2026-11-15 | machine-drafted, needs native review |
| `securityCheckFailed` | hmn | Security validation failed. Please refresh the page and try again. | Kev kuaj xyuas kev nyab xeeb tsis tiav. Thov rov thauj nplooj ntawv thiab sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `orContinueWith` | hmn | Or continue with | Lossis txuas ntxiv nrog | 2026-11-15 | machine-drafted, needs native review |
| `opening` | hmn | Opening… | Tab tom qhib… | 2026-11-15 | machine-drafted, needs native review |
| `guestHint` | hmn | Browse map, programs, and community resources instantly | Saib daim ntawv qhia, cov kev pab cuam thiab cov kev pab hauv zej zog tam sim ntawd | 2026-11-15 | machine-drafted, needs native review |
| `guestFailed` | hmn | We couldn't start a guest session. Please try again. | Pib tsis tau qhov kev siv ua qhua. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `oauthStartFailed` | hmn | We couldn't reach the sign-in provider. Please try again. | Mus tsis txog tus muab kev nkag. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `lockedWait` | hmn | Locked — wait 15 minutes | Xauv lawm — tos 15 feeb | 2026-11-15 | machine-drafted, needs native review |
| `captchaFailed` | hmn | The security check didn't complete. Please try again. | Kev kuaj xyuas kev nyab xeeb tsis tiav. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `loading` | hmn | Loading… | Tab tom thauj… | 2026-11-15 | machine-drafted, needs native review |
| `emailInvalid` | hmn | Enter a valid email address. | Sau ib qho email siv tau. | 2026-11-15 | machine-drafted, needs native review |
| `emailRateLimited` | hmn | Too many emails were sent. Please wait a few minutes and try again. | Xa email ntau dhau lawm. Thov tos ob peb feeb thiab sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `backToSignIn` | hmn | Back to sign in | Rov qab mus nkag | 2026-11-15 | machine-drafted, needs native review |
| `haveAccount` | hmn | Already have an account? | Twb muaj account lawm? | 2026-11-15 | machine-drafted, needs native review |
| `loginRateLimited` | hmn | Too many login attempts. Please wait 15 minutes before trying again. | Sim nkag ntau zaus dhau lawm. Thov tos 15 feeb ua ntej koj sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `invalidCredentials` | hmn | That email and password don't match. Please try again. | Email thiab lo lus zais tsis sib xws. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `emailNotConfirmed` | hmn | Please confirm your email first. Check your inbox for the link. | Thov lees paub koj email ua ntej. Nrhiav txoj kab txuas hauv koj lub thawv email. | 2026-11-15 | machine-drafted, needs native review |
| `signInFailed` | hmn | We couldn't sign you in. Please try again. | Peb nkag tsis tau rau koj. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `mfaCodeNeeded` | hmn | Enter the 6-digit code from your authenticator app to continue. | Sau tus lej 6 tus ntawm koj lub app lees paub kom txuas ntxiv. | 2026-11-15 | machine-drafted, needs native review |
| `oauthProvider` | hmn | Sign-in failed: the provider rejected the request. | Nkag tsis tau: tus muab kev pab tsis kam txais qhov kev thov. | 2026-11-15 | machine-drafted, needs native review |
| `oauthExchange` | hmn | Sign-in failed: the session could not be started. | Nkag tsis tau: pib tsis tau qhov kev siv. | 2026-11-15 | machine-drafted, needs native review |
| `oauthNoCode` | hmn | Sign-in failed: no authorization code was received. | Nkag tsis tau: tsis tau txais tus lej tso cai. | 2026-11-15 | machine-drafted, needs native review |
| `oauthNoSession` | hmn | Sign-in failed: the session was not created. | Nkag tsis tau: tsis tau tsim qhov kev siv. | 2026-11-15 | machine-drafted, needs native review |
| `confirmationFailed` | hmn | That confirmation link didn't work. It may have expired — sign in or request a new link. | Txoj kab txuas lees paub ntawd siv tsis tau. Tej zaum nws tas sijhawm lawm — nkag lossis thov ib txoj tshiab. | 2026-11-15 | machine-drafted, needs native review |
| `oauthFailed` | hmn | Sign-in failed. Please try again. | Nkag tsis tau. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `signingIn` | hmn | Signing in… | Tab tom nkag… | 2026-11-15 | machine-drafted, needs native review |
| `orSignIn` | hmn | or sign in | lossis nkag | 2026-11-15 | machine-drafted, needs native review |
| `signupRateLimited` | hmn | Too many signup attempts. Please wait 15 minutes before trying again. | Sim sau npe ntau zaus dhau lawm. Thov tos 15 feeb ua ntej koj sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `passwordsMismatch` | hmn | Passwords do not match. | Cov lo lus zais tsis sib xws. | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooWeak` | hmn | Password does not meet security requirements. | Lo lus zais tsis raws li cov cai kev nyab xeeb. | 2026-11-15 | machine-drafted, needs native review |
| `acceptTermsRequired` | hmn | You must accept the terms of service. | Koj yuav tsum pom zoo rau cov cai kev pabcuam. | 2026-11-15 | machine-drafted, needs native review |
| `accountExists` | hmn | An account with this email already exists. Please sign in instead. | Twb muaj ib tug account siv email no lawm. Thov nkag hloov. | 2026-11-15 | machine-drafted, needs native review |
| `signupFailed` | hmn | We couldn't create your account. Please try again. | Tsim tsis tau koj tus account. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `signupUnavailable` | hmn | New accounts can't be created right now. Please try again later. | Tam sim no tsim tsis tau account tshiab. Thov sim dua tom qab. | 2026-11-15 | machine-drafted, needs native review |
| `resendFailed` | hmn | We couldn't resend the confirmation email. Please try again. | Xa tsis tau email lees paub dua. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `checkEmailTitle` | hmn | Check your email | Saib koj email | 2026-11-15 | machine-drafted, needs native review |
| `checkEmailSent` | hmn | We've sent a confirmation link to {email}. Click the link to verify your account. | Peb tau xa ib txoj kab txuas lees paub mus rau {email}. Nias txoj kab txuas kom lees paub koj tus account. | 2026-11-15 | machine-drafted, needs native review |
| `checkSpam` | hmn | Didn't receive it? Check your spam or junk folder. | Tsis tau txais? Saib hauv koj lub folder spam lossis junk. | 2026-11-15 | machine-drafted, needs native review |
| `confirmEmailCorrect` | hmn | Make sure {email} is correct. | Xyuas kom {email} yog lawm. | 2026-11-15 | machine-drafted, needs native review |
| `sending` | hmn | Sending… | Tab tom xa… | 2026-11-15 | machine-drafted, needs native review |
| `resendEmail` | hmn | Resend email | Xa email dua | 2026-11-15 | machine-drafted, needs native review |
| `useDifferentEmail` | hmn | Use a different email | Siv lwm email | 2026-11-15 | machine-drafted, needs native review |
| `joinTitle` | hmn | Join FEED | Koom nrog FEED | 2026-11-15 | machine-drafted, needs native review |
| `joinSubtitle` | hmn | Create an account to access community resources and support | Tsim ib tug account kom siv tau cov kev pab thiab kev txhawb nqa hauv zej zog | 2026-11-15 | machine-drafted, needs native review |
| `firstName` | hmn | First name | Lub npe | 2026-11-15 | machine-drafted, needs native review |
| `firstNameHint` | hmn | Public — shown to the community | Pej xeem — zej zog pom | 2026-11-15 | machine-drafted, needs native review |
| `lastName` | hmn | Last name | Lub xeem | 2026-11-15 | machine-drafted, needs native review |
| `lastNameHint` | hmn | Private — shared only with a helper you message | Ntiag tug — tsuas yog tus pab koj sib tham nrog pom | 2026-11-15 | machine-drafted, needs native review |
| `passwordHint` | hmn | At least 12 characters | Tsawg kawg 12 tus ntawv | 2026-11-15 | machine-drafted, needs native review |
| `signupPasswordHint` | hmn | At least 12 characters, with at least three of: lowercase letters, uppercase letters, numbers, symbols (with 16 or more characters, two are enough). Avoid common patterns such as "password" or "123456". | Tsawg kawg 12 tus ntawv, muaj tsawg kawg peb yam ntawm: ntawv me, ntawv loj, tus lej, cim (yog muaj 16 tus ntawv lossis ntau dua, ob yam txaus lawm). Zam cov qauv uas neeg siv ntau xws li "password" lossis "123456". | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooLong` | hmn | This password is too long. The limit is 72 bytes: 72 plain letters and numbers, fewer if you use accented letters, other alphabets or emoji. | Lo lus zais no ntev dhau. Qhov txwv yog 72 bytes: 72 tus ntawv thiab tus lej yooj yim, tsawg dua yog koj siv cov ntawv muaj cim, lwm hom ntawv lossis emoji. | 2026-11-15 | machine-drafted, needs native review |
| `passwordStrength` | hmn | Password strength: {strength} | Lo lus zais muaj zog li cas: {strength} | 2026-11-15 | machine-drafted, needs native review |
| `resendSent` | hmn | We sent another confirmation email. | Peb tau xa dua ib tsab email lees paub. | 2026-11-15 | machine-drafted, needs native review |
| `confirmPassword` | hmn | Confirm password | Lees paub lo lus zais | 2026-11-15 | machine-drafted, needs native review |
| `strengthWeak` | hmn | Weak | Tsis muaj zog | 2026-11-15 | machine-drafted, needs native review |
| `strengthFair` | hmn | Fair | Nruab nrab | 2026-11-15 | machine-drafted, needs native review |
| `strengthGood` | hmn | Good | Zoo | 2026-11-15 | machine-drafted, needs native review |
| `strengthStrong` | hmn | Strong | Muaj zog | 2026-11-15 | machine-drafted, needs native review |
| `pwMinLength` | hmn | Use at least 12 characters | Siv tsawg kawg 12 tus ntawv | 2026-11-15 | machine-drafted, needs native review |
| `pwLowercase` | hmn | Add lowercase letters | Ntxiv cov ntawv me | 2026-11-15 | machine-drafted, needs native review |
| `pwUppercase` | hmn | Add uppercase letters | Ntxiv cov ntawv loj | 2026-11-15 | machine-drafted, needs native review |
| `pwNumbers` | hmn | Add numbers | Ntxiv cov lej | 2026-11-15 | machine-drafted, needs native review |
| `pwSpecial` | hmn | Add special characters (!@#$%^&*) | Ntxiv cov cim tshwj xeeb (!@#$%^&*) | 2026-11-15 | machine-drafted, needs native review |
| `pwCommon` | hmn | Avoid common password patterns | Zam cov qauv lo lus zais uas neeg siv ntau | 2026-11-15 | machine-drafted, needs native review |
| `creatingAccount` | hmn | Creating account… | Tab tom tsim account… | 2026-11-15 | machine-drafted, needs native review |
| `createAccount` | hmn | Create account | Tsim account | 2026-11-15 | machine-drafted, needs native review |
| `orCreateAccount` | hmn | or create an account | lossis tsim ib tug account | 2026-11-15 | machine-drafted, needs native review |
| `forgotTitle` | hmn | Reset your password | Rov teeb koj lo lus zais | 2026-11-15 | machine-drafted, needs native review |
| `forgotSubtitle` | hmn | Enter your email and we'll send you a reset link | Sau koj email thiab peb yuav xa ib txoj kab txuas rov teeb | 2026-11-15 | machine-drafted, needs native review |
| `forgotSent` | hmn | Check your email for a password reset link. | Saib koj email rau txoj kab txuas rov teeb lo lus zais. | 2026-11-15 | machine-drafted, needs native review |
| `forgotSpam` | hmn | If you don't see it, check your spam folder. | Yog tias koj tsis pom, saib hauv koj lub folder spam. | 2026-11-15 | machine-drafted, needs native review |
| `emailAddress` | hmn | Email address | Chaw nyob email | 2026-11-15 | machine-drafted, needs native review |
| `sendResetLink` | hmn | Send reset link | Xa txoj kab txuas rov teeb | 2026-11-15 | machine-drafted, needs native review |
| `forgotFailed` | hmn | We couldn't send the reset link. Please try again. | Xa tsis tau txoj kab txuas rov teeb. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `resetTitle` | hmn | Set new password | Teeb lo lus zais tshiab | 2026-11-15 | machine-drafted, needs native review |
| `resetSubtitle` | hmn | Choose a strong password of at least 12 characters | Xaiv ib lo lus zais muaj zog uas muaj tsawg kawg 12 tus ntawv | 2026-11-15 | machine-drafted, needs native review |
| `resetDone` | hmn | Password updated successfully. | Hloov lo lus zais tiav lawm. | 2026-11-15 | machine-drafted, needs native review |
| `resetRedirecting` | hmn | Redirecting you to sign in… | Tab tom coj koj mus nkag… | 2026-11-15 | machine-drafted, needs native review |
| `resetHelp` | hmn | If your new password doesn't work, please request another reset link. | Yog tias koj lo lus zais tshiab siv tsis tau, thov ib txoj kab txuas rov teeb dua. | 2026-11-15 | machine-drafted, needs native review |
| `newPassword` | hmn | New password | Lo lus zais tshiab | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooShort` | hmn | Password must be at least 12 characters. | Lo lus zais yuav tsum muaj tsawg kawg 12 tus ntawv. | 2026-11-15 | machine-drafted, needs native review |
| `updating` | hmn | Updating… | Tab tom hloov… | 2026-11-15 | machine-drafted, needs native review |
| `updatePassword` | hmn | Update password | Hloov lo lus zais | 2026-11-15 | machine-drafted, needs native review |
| `samePassword` | hmn | Choose a password different from your current one. | Xaiv ib lo lus zais txawv ntawm qhov koj siv tam sim no. | 2026-11-15 | machine-drafted, needs native review |
| `resetFailed` | hmn | We couldn't update your password. Please request a new reset link and try again. | Hloov tsis tau koj lo lus zais. Thov ib txoj kab txuas tshiab thiab sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `mfaTitle` | hmn | Two-Factor Authentication | Kev lees paub ob kauj ruam | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackupPrompt` | hmn | Enter a backup code to sign in | Sau ib tus lej khaws cia kom nkag tau | 2026-11-15 | machine-drafted, needs native review |
| `mfaAppPrompt` | hmn | Enter the code from your authenticator app | Sau tus lej ntawm koj lub app lees paub | 2026-11-15 | machine-drafted, needs native review |
| `mfaInitFailed` | hmn | Failed to initialize MFA verification | Pib tsis tau kev lees paub ob kauj ruam | 2026-11-15 | machine-drafted, needs native review |
| `mfaInvalidFormat` | hmn | Please enter a valid 6-digit code | Thov sau ib tus lej 6 tus uas siv tau | 2026-11-15 | machine-drafted, needs native review |
| `mfaInvalidCode` | hmn | Invalid verification code | Tus lej lees paub siv tsis tau | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerifyFailed` | hmn | Verification failed | Lees paub tsis tau | 2026-11-15 | machine-drafted, needs native review |
| `mfaEnterBackup` | hmn | Please enter a backup code | Thov sau ib tus lej khaws cia | 2026-11-15 | machine-drafted, needs native review |
| `mfaInvalidBackup` | hmn | Invalid backup code | Tus lej khaws cia siv tsis tau | 2026-11-15 | machine-drafted, needs native review |
| `mfaCodeLabel` | hmn | 6-digit code | Tus lej 6 tus | 2026-11-15 | machine-drafted, needs native review |
| `mfaCodeHint` | hmn | The code is checked when you enter the 6th digit. It changes every 30 seconds. | Tus lej raug kuaj thaum koj sau tus lej thib 6. Nws hloov txhua 30 feeb thib ob. | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerifying` | hmn | Verifying... | Tab tom lees paub… | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerify` | hmn | Verify | Lees paub | 2026-11-15 | machine-drafted, needs native review |
| `mfaOr` | hmn | Or | Lossis | 2026-11-15 | machine-drafted, needs native review |
| `mfaUseBackup` | hmn | Use Backup Code | Siv tus lej khaws cia | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackupLabel` | hmn | Backup code | Tus lej khaws cia | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackupHint` | hmn | Each backup code can only be used once | Txhua tus lej khaws cia tsuas siv tau ib zaug xwb | 2026-11-15 | machine-drafted, needs native review |
| `mfaVerifyBackup` | hmn | Verify Backup Code | Lees paub tus lej khaws cia | 2026-11-15 | machine-drafted, needs native review |
| `mfaBackToApp` | hmn | Back to Authenticator Code | Rov qab mus rau tus lej ntawm app | 2026-11-15 | machine-drafted, needs native review |
| `mfaDifferentUser` | hmn | Sign in as different user | Nkag nrog lwm tus account | 2026-11-15 | machine-drafted, needs native review |
| `LOCKED_MINUTES.other` | ht | Account temporarily locked. Please try again in {n} minutes. | Kont lan bloke pou kounye a. Tanpri eseye ankò nan {n} minit. | 2026-11-15 | machine-drafted, needs native review |
| `LOCKED_MINUTES.other` | so | Account temporarily locked. Please try again in {n} minutes. | Akoonka si ku meel gaar ah ayaa loo xiray. Fadlan isku day mar kale {n} daqiiqo kadib. | 2026-11-15 | machine-drafted, needs native review |
| `LOCKED_MINUTES.one` | am | Account temporarily locked. Please try again in {n} minute. | መለያው ለጊዜው ተቆልፏል። እባክዎ በ{n} ደቂቃ ውስጥ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `LOCKED_MINUTES.other` | am | Account temporarily locked. Please try again in {n} minutes. | መለያው ለጊዜው ተቆልፏል። እባክዎ በ{n} ደቂቃዎች ውስጥ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `LOCKED_MINUTES.other` | hmn | Account temporarily locked. Please try again in {n} minutes. | Tus account raug xauv ib ntus. Thov sim dua hauv {n} feeb. | 2026-11-15 | machine-drafted, needs native review |
| `ATTEMPTS_REMAINING.other` | ht | Warning: {n} login attempts remaining before temporary lockout. | Atansyon: ou rete {n} tantativ anvan kont lan bloke pou yon ti tan. | 2026-11-15 | machine-drafted, needs native review |
| `ATTEMPTS_REMAINING.other` | so | Warning: {n} login attempts remaining before temporary lockout. | Digniin: waxaa kuu hadhay {n} isku day galitaan ka hor xiritaanka ku meel gaarka ah. | 2026-11-15 | machine-drafted, needs native review |
| `ATTEMPTS_REMAINING.one` | am | Warning: {n} login attempt remaining before temporary lockout. | ማስጠንቀቂያ፦ ጊዜያዊ መቆለፍ በፊት {n} የመግቢያ ሙከራ ቀርቷል። | 2026-11-15 | machine-drafted, needs native review |
| `ATTEMPTS_REMAINING.other` | am | Warning: {n} login attempts remaining before temporary lockout. | ማስጠንቀቂያ፦ ጊዜያዊ መቆለፍ በፊት {n} የመግቢያ ሙከራዎች ቀርተዋል። | 2026-11-15 | machine-drafted, needs native review |
| `ATTEMPTS_REMAINING.other` | hmn | Warning: {n} login attempts remaining before temporary lockout. | Ceeb toom: tseem tshuav {n} zaug sim nkag ua ntej raug xauv ib ntus. | 2026-11-15 | machine-drafted, needs native review |

### `lib/i18n-documents.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `sectionsLabel` | ht | Documents & Forms sections | Seksyon Dokiman ak fòmilè | 2026-11-15 | machine-drafted, needs native review |
| `tabDocuments` | ht | My Documents | Dokiman mwen yo | 2026-11-15 | machine-drafted, needs native review |
| `tabApplications` | ht | Applications | Demann | 2026-11-15 | machine-drafted, needs native review |
| `tabResources` | ht | My Resources | Resous mwen yo | 2026-11-15 | machine-drafted, needs native review |
| `guestPrompt` | ht | Create a free account to securely store and manage your documents | Kreye yon kont gratis pou sere epi jere dokiman ou yo an sekirite | 2026-11-15 | machine-drafted, needs native review |
| `subtitle` | ht | Securely store and manage your important documents | Sere epi jere dokiman enpòtan ou yo an sekirite | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | ht | Search documents | Chèche dokiman | 2026-11-15 | machine-drafted, needs native review |
| `searchPlaceholder` | ht | Search documents... | Chèche dokiman... | 2026-11-15 | machine-drafted, needs native review |
| `clearSearch` | ht | Clear search | Efase rechèch la | 2026-11-15 | machine-drafted, needs native review |
| `foldersLabel` | ht | Document folders | Dosye dokiman | 2026-11-15 | machine-drafted, needs native review |
| `catAll` | ht | All Documents | Tout dokiman yo | 2026-11-15 | machine-drafted, needs native review |
| `catId` | ht | ID Documents | Dokiman idantite | 2026-11-15 | machine-drafted, needs native review |
| `catIncome` | ht | Income Proof | Prèv revni | 2026-11-15 | machine-drafted, needs native review |
| `catResidence` | ht | Residence | Rezidans | 2026-11-15 | machine-drafted, needs native review |
| `catMedical` | ht | Medical | Medikal | 2026-11-15 | machine-drafted, needs native review |
| `catForms` | ht | Submitted Forms | Fòmilè voye | 2026-11-15 | machine-drafted, needs native review |
| `catOther` | ht | Other | Lòt | 2026-11-15 | machine-drafted, needs native review |
| `encrypted` | ht | Encrypted | Chifre | 2026-11-15 | machine-drafted, needs native review |
| `today` | ht | Today | Jodi a | 2026-11-15 | machine-drafted, needs native review |
| `yesterday` | ht | Yesterday | Yè | 2026-11-15 | machine-drafted, needs native review |
| `daysAgo` | ht | {n} days ago | Sa gen {n} jou | 2026-11-15 | machine-drafted, needs native review |
| `sizeBytes` | ht | {n} B | {n} B | 2026-11-15 | machine-drafted, needs native review |
| `sizeKb` | ht | {n} KB | {n} KB | 2026-11-15 | machine-drafted, needs native review |
| `sizeMb` | ht | {n} MB | {n} MB | 2026-11-15 | machine-drafted, needs native review |
| `view` | ht | View | Gade | 2026-11-15 | machine-drafted, needs native review |
| `editAnnotations` | ht | Edit PDF annotations | Modifye nòt PDF la | 2026-11-15 | machine-drafted, needs native review |
| `download` | ht | Download | Telechaje | 2026-11-15 | machine-drafted, needs native review |
| `moreOptions` | ht | More options: {name} | Plis opsyon: {name} | 2026-11-15 | machine-drafted, needs native review |
| `rename` | ht | Rename | Chanje non | 2026-11-15 | machine-drafted, needs native review |
| `moveTo` | ht | Move to {category} | Deplase nan {category} | 2026-11-15 | machine-drafted, needs native review |
| `delete` | ht | Delete | Efase | 2026-11-15 | machine-drafted, needs native review |
| `noResults` | ht | No results found | Pa jwenn anyen | 2026-11-15 | machine-drafted, needs native review |
| `noMatch` | ht | No documents match “{query}” | Pa gen dokiman ki koresponn ak “{query}” | 2026-11-15 | machine-drafted, needs native review |
| `emptyAll` | ht | No documents yet | Poko gen dokiman | 2026-11-15 | machine-drafted, needs native review |
| `emptyCategory` | ht | Nothing in {category} yet | Poko gen anyen nan {category} | 2026-11-15 | machine-drafted, needs native review |
| `emptyAllBody` | ht | Upload your first document to get started | Voye premye dokiman ou pou kòmanse | 2026-11-15 | machine-drafted, needs native review |
| `emptyCategoryBody` | ht | Upload documents to this folder for easy access | Voye dokiman nan dosye sa a pou jwenn yo fasil | 2026-11-15 | machine-drafted, needs native review |
| `uploadDocument` | ht | Upload Document | Voye yon dokiman | 2026-11-15 | machine-drafted, needs native review |
| `loading` | ht | Loading your documents… | N ap chaje dokiman ou yo… | 2026-11-15 | machine-drafted, needs native review |
| `dismiss` | ht | Dismiss | Fèmen | 2026-11-15 | machine-drafted, needs native review |
| `docTimedOut` | ht | Document timed out — please check your connection and retry. | Dokiman an pran twòp tan — tanpri verifye koneksyon ou epi eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `docFailed` | ht | We couldn’t open this document. Please try again. | Nou pa t ka louvri dokiman sa a. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `loadFailed` | ht | We couldn’t load your documents. Please try again. | Nou pa t ka chaje dokiman ou yo. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `renameTitle` | ht | Rename Document | Chanje non dokiman an | 2026-11-15 | machine-drafted, needs native review |
| `nameLabel` | ht | Document name | Non dokiman an | 2026-11-15 | machine-drafted, needs native review |
| `nameRequired` | ht | Enter a name for this document. | Ekri yon non pou dokiman sa a. | 2026-11-15 | machine-drafted, needs native review |
| `renameLocked` | ht | Unlock your vault to rename this document. | Debloke kòf ou pou chanje non dokiman sa a. | 2026-11-15 | machine-drafted, needs native review |
| `renameFailed` | ht | Failed to rename. Please try again. | Nou pa t ka chanje non an. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `renamed` | ht | Document renamed. | Non dokiman an chanje. | 2026-11-15 | machine-drafted, needs native review |
| `moved` | ht | Moved to {category}. | Deplase nan {category}. | 2026-11-15 | machine-drafted, needs native review |
| `moveFailed` | ht | We couldn’t move this document. Please try again. | Nou pa t ka deplase dokiman sa a. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `deleteTitle` | ht | Delete this document? | Efase dokiman sa a? | 2026-11-15 | machine-drafted, needs native review |
| `deleteBody` | ht | “{name}” will be permanently removed. This cannot be undone. | “{name}” pral efase pou tout tan. Ou pa ka defèt sa. | 2026-11-15 | machine-drafted, needs native review |
| `deleted` | ht | Document deleted. | Dokiman an efase. | 2026-11-15 | machine-drafted, needs native review |
| `deleteFailed` | ht | Failed to delete document. | Nou pa t ka efase dokiman an. | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | ht | Cancel | Anile | 2026-11-15 | machine-drafted, needs native review |
| `noSaved` | ht | No saved resources yet | Poko gen resous ki sere | 2026-11-15 | machine-drafted, needs native review |
| `noSavedBody` | ht | Save resources from the chat or map to access them here | Sere resous nan chat la oswa nan kat la pou jwenn yo isit la | 2026-11-15 | machine-drafted, needs native review |
| `visitWebsite` | ht | Visit website | Vizite sit entènèt la | 2026-11-15 | machine-drafted, needs native review |
| `getDirections` | ht | Get directions | Jwenn direksyon | 2026-11-15 | machine-drafted, needs native review |
| `removeSaved` | ht | Remove from saved | Retire nan sa ki sere yo | 2026-11-15 | machine-drafted, needs native review |
| `removedSaved` | ht | Removed from saved. | Retire nan sa ki sere yo. | 2026-11-15 | machine-drafted, needs native review |
| `removeSavedFailed` | ht | We couldn’t remove this resource. Please try again. | Nou pa t ka retire resous sa a. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `vaultLocked` | ht | Vault Locked | Kòf la fèmen | 2026-11-15 | machine-drafted, needs native review |
| `vaultLockedBody` | ht | Unlock your vault to upload encrypted documents | Debloke kòf ou pou voye dokiman chifre | 2026-11-15 | machine-drafted, needs native review |
| `unlockVault` | ht | Unlock Vault | Debloke kòf la | 2026-11-15 | machine-drafted, needs native review |
| `dropHere` | ht | Drop file here | Lage fichye a isit la | 2026-11-15 | machine-drafted, needs native review |
| `uploadTitle` | ht | Upload Encrypted Document | Voye yon dokiman chifre | 2026-11-15 | machine-drafted, needs native review |
| `uploadHint` | ht | Drag and drop or click to browse. Files are encrypted before upload. | Trennen epi lage oswa klike pou chèche. Fichye yo chifre anvan yo voye yo. | 2026-11-15 | machine-drafted, needs native review |
| `removeFile` | ht | Remove | Retire | 2026-11-15 | machine-drafted, needs native review |
| `uploadProgress` | ht | Encrypting and uploading... | N ap chifre epi voye... | 2026-11-15 | machine-drafted, needs native review |
| `stepEncrypting` | ht | Encrypting file... | N ap chifre fichye a... | 2026-11-15 | machine-drafted, needs native review |
| `stepUploading` | ht | Uploading... | N ap voye... | 2026-11-15 | machine-drafted, needs native review |
| `stepSaving` | ht | Saving metadata... | N ap sere enfòmasyon yo... | 2026-11-15 | machine-drafted, needs native review |
| `uploadFailed` | ht | Upload Failed | Voye a pa mache | 2026-11-15 | machine-drafted, needs native review |
| `uploadTimedOut` | ht | Upload timed out — please check your connection and retry. | Voye a pran twòp tan — tanpri verifye koneksyon ou epi eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `uploadFailedBody` | ht | Your document was not uploaded. Please try again. | Dokiman ou an pa t voye. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `uploaded` | ht | Document uploaded successfully! | Dokiman an voye avèk siksè! | 2026-11-15 | machine-drafted, needs native review |
| `encryptAndUpload` | ht | Encrypt and Upload | Chifre epi voye | 2026-11-15 | machine-drafted, needs native review |
| `securityNotice` | ht | Your documents are encrypted on your device before upload. Only you can decrypt them with your vault password. | Dokiman ou yo chifre sou aparèy ou anvan yo voye. Se sèlman ou ki ka dechifre yo avèk modpas kòf ou. | 2026-11-15 | machine-drafted, needs native review |
| `setupTitle` | ht | Set Up Your Vault | Mete kòf ou an plas | 2026-11-15 | machine-drafted, needs native review |
| `unlockTitle` | ht | Unlock Your Vault | Debloke kòf ou | 2026-11-15 | machine-drafted, needs native review |
| `setupDescription` | ht | Create a master password to encrypt your sensitive data. | Kreye yon modpas prensipal pou chifre done sansib ou yo. | 2026-11-15 | machine-drafted, needs native review |
| `unlockDescription` | ht | Enter your master password to access your encrypted data. | Antre modpas prensipal ou pou wè done chifre ou yo. | 2026-11-15 | machine-drafted, needs native review |
| `important` | ht | Important: | Enpòtan: | 2026-11-15 | machine-drafted, needs native review |
| `setupWarning` | ht | If you forget this password, your encrypted data cannot be recovered. Please store it in a secure password manager. | Si ou bliye modpas sa a, ou p ap ka rekipere done chifre ou yo. Tanpri sere l nan yon jesyonè modpas ki an sekirite. | 2026-11-15 | machine-drafted, needs native review |
| `masterPassword` | ht | Master Password | Modpas prensipal | 2026-11-15 | machine-drafted, needs native review |
| `createPasswordPlaceholder` | ht | Create a strong password | Kreye yon modpas solid | 2026-11-15 | machine-drafted, needs native review |
| `enterPasswordPlaceholder` | ht | Enter your master password | Antre modpas prensipal ou | 2026-11-15 | machine-drafted, needs native review |
| `passwordHint` | ht | Minimum 12 characters. Use a mix of letters, numbers, and symbols. | Omwen 12 karaktè. Melanje lèt, chif ak senbòl. | 2026-11-15 | machine-drafted, needs native review |
| `confirmPassword` | ht | Confirm Password | Konfime modpas la | 2026-11-15 | machine-drafted, needs native review |
| `confirmPasswordPlaceholder` | ht | Re-enter your password | Antre modpas ou ankò | 2026-11-15 | machine-drafted, needs native review |
| `passwordMismatch` | ht | Passwords do not match | Modpas yo pa menm | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooShort` | ht | Use at least 12 characters. | Sèvi ak omwen 12 karaktè. | 2026-11-15 | machine-drafted, needs native review |
| `passwordRequired` | ht | Enter your master password. | Antre modpas prensipal ou. | 2026-11-15 | machine-drafted, needs native review |
| `createVault` | ht | Create Vault | Kreye kòf la | 2026-11-15 | machine-drafted, needs native review |
| `unlock` | ht | Unlock | Debloke | 2026-11-15 | machine-drafted, needs native review |
| `incorrectPassword` | ht | Incorrect password | Modpas la pa bon | 2026-11-15 | machine-drafted, needs native review |
| `vaultTimedOut` | ht | Vault operation timed out. Please check your connection and try again. | Kòf la pran twòp tan. Tanpri verifye koneksyon ou epi eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `vaultFailed` | ht | We couldn’t open your vault. Please try again. | Nou pa t ka louvri kòf ou. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `setupFailed` | ht | We couldn’t set up your vault. Please try again. | Nou pa t ka mete kòf ou an plas. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `checkingVault` | ht | Checking your vault… | N ap verifye kòf ou… | 2026-11-15 | machine-drafted, needs native review |
| `guardUnlockToAccess` | ht | Unlock your vault to access encrypted data. | Debloke kòf ou pou wè done chifre yo. | 2026-11-15 | machine-drafted, needs native review |
| `guardSetUpToStore` | ht | Set up your vault to encrypt and store sensitive data. | Mete kòf ou an plas pou chifre epi sere done sansib. | 2026-11-15 | machine-drafted, needs native review |
| `guardLocked` | ht | Your vault is locked. Unlock it to view encrypted data. | Kòf ou fèmen. Debloke l pou wè done chifre yo. | 2026-11-15 | machine-drafted, needs native review |
| `guardSetUp` | ht | Set up your vault to access encrypted features. | Mete kòf ou an plas pou sèvi ak fonksyon chifre yo. | 2026-11-15 | machine-drafted, needs native review |
| `documentFallback` | ht | Document | Dokiman | 2026-11-15 | machine-drafted, needs native review |
| `close` | ht | Close | Fèmen | 2026-11-15 | machine-drafted, needs native review |
| `loadingDocument` | ht | Loading document… | N ap chaje dokiman an… | 2026-11-15 | machine-drafted, needs native review |
| `readFailed` | ht | We couldn’t open this file. Please try again. | Nou pa t ka louvri fichye sa a. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `renderFailed` | ht | We couldn’t display this PDF. | Nou pa t ka montre PDF sa a. | 2026-11-15 | machine-drafted, needs native review |
| `downloadInstead` | ht | Download instead | Telechaje l pito | 2026-11-15 | machine-drafted, needs native review |
| `noPreview` | ht | Preview not available for this file type. | Pa gen apèsi pou kalite fichye sa a. | 2026-11-15 | machine-drafted, needs native review |
| `downloadFile` | ht | Download File | Telechaje fichye a | 2026-11-15 | machine-drafted, needs native review |
| `previousPage` | ht | Previous page | Paj anvan | 2026-11-15 | machine-drafted, needs native review |
| `nextPage` | ht | Next page | Paj apre | 2026-11-15 | machine-drafted, needs native review |
| `pageOf` | ht | Page {page} of {total} | Paj {page} sou {total} | 2026-11-15 | machine-drafted, needs native review |
| `website` | ht | Website | Sit entènèt | 2026-11-15 | machine-drafted, needs native review |
| `tasksComplete` | ht | {done}/{total} tasks complete | {done}/{total} travay fini | 2026-11-15 | machine-drafted, needs native review |
| `communityPosts` | ht | Community Posts | Piblikasyon kominote a | 2026-11-15 | machine-drafted, needs native review |
| `tasks` | ht | Tasks | Travay | 2026-11-15 | machine-drafted, needs native review |
| `newTask` | ht | New task | Nouvo travay | 2026-11-15 | machine-drafted, needs native review |
| `addTaskPlaceholder` | ht | Add a task... | Ajoute yon travay... | 2026-11-15 | machine-drafted, needs native review |
| `addTask` | ht | Add task | Ajoute travay | 2026-11-15 | machine-drafted, needs native review |
| `noTasks` | ht | No tasks yet | Poko gen travay | 2026-11-15 | machine-drafted, needs native review |
| `deleteTask` | ht | Delete task | Efase travay | 2026-11-15 | machine-drafted, needs native review |
| `schedule` | ht | Schedule | Orè | 2026-11-15 | machine-drafted, needs native review |
| `eventTitle` | ht | Event title | Tit randevou a | 2026-11-15 | machine-drafted, needs native review |
| `eventTitlePlaceholder` | ht | Event title... | Tit randevou a... | 2026-11-15 | machine-drafted, needs native review |
| `eventDate` | ht | Date | Dat | 2026-11-15 | machine-drafted, needs native review |
| `eventTime` | ht | Time | Lè | 2026-11-15 | machine-drafted, needs native review |
| `addEvent` | ht | Add date | Ajoute dat | 2026-11-15 | machine-drafted, needs native review |
| `noEvents` | ht | No scheduled dates | Pa gen dat ki pwograme | 2026-11-15 | machine-drafted, needs native review |
| `deleteEvent` | ht | Delete date | Efase dat | 2026-11-15 | machine-drafted, needs native review |
| `files` | ht | Files | Fichye | 2026-11-15 | machine-drafted, needs native review |
| `uploadingFile` | ht | Uploading... | N ap voye... | 2026-11-15 | machine-drafted, needs native review |
| `chooseFileToUpload` | ht | Choose file to upload | Chwazi yon fichye pou voye | 2026-11-15 | machine-drafted, needs native review |
| `noFiles` | ht | No files attached | Pa gen fichye ki atache | 2026-11-15 | machine-drafted, needs native review |
| `downloadAttachment` | ht | Download | Telechaje | 2026-11-15 | machine-drafted, needs native review |
| `deleteAttachment` | ht | Delete file | Efase fichye | 2026-11-15 | machine-drafted, needs native review |
| `notes` | ht | Notes | Nòt | 2026-11-15 | machine-drafted, needs native review |
| `notesPlaceholder` | ht | Add notes about this resource... | Ajoute nòt sou resous sa a... | 2026-11-15 | machine-drafted, needs native review |
| `notesSaved` | ht | Saved | Sere | 2026-11-15 | machine-drafted, needs native review |
| `saveNotes` | ht | Save Notes | Sere nòt yo | 2026-11-15 | machine-drafted, needs native review |
| `loadingResource` | ht | Loading resource… | N ap chaje resous la… | 2026-11-15 | machine-drafted, needs native review |
| `resourceNotFound` | ht | Resource not found | Pa jwenn resous la | 2026-11-15 | machine-drafted, needs native review |
| `noPosts` | ht | No community posts about this resource yet. | Poko gen piblikasyon kominote a sou resous sa a. | 2026-11-15 | machine-drafted, needs native review |
| `postsTimedOut` | ht | Posts timed out — please retry. | Piblikasyon yo pran twòp tan. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `postsFailed` | ht | We couldn’t load community posts. | Nou pa t ka chaje piblikasyon kominote a. | 2026-11-15 | machine-drafted, needs native review |
| `communityMember` | ht | Community Member | Manm kominote a | 2026-11-15 | machine-drafted, needs native review |
| `detailFailed` | ht | Something went wrong. Please try again. | Gen yon bagay ki pa mache. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `annotationsSaved` | ht | Changes saved. | Chanjman yo sere. | 2026-11-15 | machine-drafted, needs native review |
| `pdfSaved` | ht | PDF saved to My Documents. | PDF la sere nan Dokiman mwen yo. | 2026-11-15 | machine-drafted, needs native review |
| `taskAdded` | ht | Task added. | Travay la ajoute. | 2026-11-15 | machine-drafted, needs native review |
| `taskDeleted` | ht | Task deleted. | Travay la efase. | 2026-11-15 | machine-drafted, needs native review |
| `eventAdded` | ht | Date added. | Dat la ajoute. | 2026-11-15 | machine-drafted, needs native review |
| `eventDeleted` | ht | Date deleted. | Dat la efase. | 2026-11-15 | machine-drafted, needs native review |
| `fileUploaded` | ht | File uploaded. | Fichye a voye. | 2026-11-15 | machine-drafted, needs native review |
| `fileDeleted` | ht | File deleted. | Fichye a efase. | 2026-11-15 | machine-drafted, needs native review |
| `sectionsLabel` | so | Documents & Forms sections | Qaybaha Dukumentiyada iyo foomamka | 2026-11-15 | machine-drafted, needs native review |
| `tabDocuments` | so | My Documents | Dukumentiyadayda | 2026-11-15 | machine-drafted, needs native review |
| `tabApplications` | so | Applications | Codsiyada | 2026-11-15 | machine-drafted, needs native review |
| `tabResources` | so | My Resources | Kheyraadkayga | 2026-11-15 | machine-drafted, needs native review |
| `guestPrompt` | so | Create a free account to securely store and manage your documents | Samee akoon bilaash ah si aad dukumentiyadaada si ammaan ah ugu kaydiso uguna maamusho | 2026-11-15 | machine-drafted, needs native review |
| `subtitle` | so | Securely store and manage your important documents | Si ammaan ah u kaydi oo u maamul dukumentiyadaada muhiimka ah | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | so | Search documents | Raadi dukumentiyo | 2026-11-15 | machine-drafted, needs native review |
| `searchPlaceholder` | so | Search documents... | Raadi dukumentiyo... | 2026-11-15 | machine-drafted, needs native review |
| `clearSearch` | so | Clear search | Tirtir raadinta | 2026-11-15 | machine-drafted, needs native review |
| `foldersLabel` | so | Document folders | Galalka dukumentiyada | 2026-11-15 | machine-drafted, needs native review |
| `catAll` | so | All Documents | Dhammaan dukumentiyada | 2026-11-15 | machine-drafted, needs native review |
| `catId` | so | ID Documents | Dukumentiyada aqoonsiga | 2026-11-15 | machine-drafted, needs native review |
| `catIncome` | so | Income Proof | Caddaynta dakhliga | 2026-11-15 | machine-drafted, needs native review |
| `catResidence` | so | Residence | Deegaanka | 2026-11-15 | machine-drafted, needs native review |
| `catMedical` | so | Medical | Caafimaad | 2026-11-15 | machine-drafted, needs native review |
| `catForms` | so | Submitted Forms | Foomamka la diray | 2026-11-15 | machine-drafted, needs native review |
| `catOther` | so | Other | Kale | 2026-11-15 | machine-drafted, needs native review |
| `encrypted` | so | Encrypted | La sireeyay | 2026-11-15 | machine-drafted, needs native review |
| `today` | so | Today | Maanta | 2026-11-15 | machine-drafted, needs native review |
| `yesterday` | so | Yesterday | Shalay | 2026-11-15 | machine-drafted, needs native review |
| `daysAgo` | so | {n} days ago | {n} maalmood ka hor | 2026-11-15 | machine-drafted, needs native review |
| `sizeBytes` | so | {n} B | {n} B | 2026-11-15 | machine-drafted, needs native review |
| `sizeKb` | so | {n} KB | {n} KB | 2026-11-15 | machine-drafted, needs native review |
| `sizeMb` | so | {n} MB | {n} MB | 2026-11-15 | machine-drafted, needs native review |
| `view` | so | View | Eeg | 2026-11-15 | machine-drafted, needs native review |
| `editAnnotations` | so | Edit PDF annotations | Wax ka beddel qoraallada PDF-ka | 2026-11-15 | machine-drafted, needs native review |
| `download` | so | Download | Soo deji | 2026-11-15 | machine-drafted, needs native review |
| `moreOptions` | so | More options: {name} | Doorashooyin kale: {name} | 2026-11-15 | machine-drafted, needs native review |
| `rename` | so | Rename | Magac beddel | 2026-11-15 | machine-drafted, needs native review |
| `moveTo` | so | Move to {category} | U guuri {category} | 2026-11-15 | machine-drafted, needs native review |
| `delete` | so | Delete | Tirtir | 2026-11-15 | machine-drafted, needs native review |
| `noResults` | so | No results found | Wax natiijo ah lama helin | 2026-11-15 | machine-drafted, needs native review |
| `noMatch` | so | No documents match “{query}” | Ma jiro dukumenti la mid ah “{query}” | 2026-11-15 | machine-drafted, needs native review |
| `emptyAll` | so | No documents yet | Weli dukumentiyo ma jiraan | 2026-11-15 | machine-drafted, needs native review |
| `emptyCategory` | so | Nothing in {category} yet | Weli waxba kuma jiraan {category} | 2026-11-15 | machine-drafted, needs native review |
| `emptyAllBody` | so | Upload your first document to get started | Soo geli dukumentigaaga ugu horreeya si aad u bilowdo | 2026-11-15 | machine-drafted, needs native review |
| `emptyCategoryBody` | so | Upload documents to this folder for easy access | Dukumentiyo ku soo geli galkan si aad si fudud u hesho | 2026-11-15 | machine-drafted, needs native review |
| `uploadDocument` | so | Upload Document | Soo geli dukumenti | 2026-11-15 | machine-drafted, needs native review |
| `loading` | so | Loading your documents… | Dukumentiyadaada ayaa la soo rarayaa… | 2026-11-15 | machine-drafted, needs native review |
| `dismiss` | so | Dismiss | Xir | 2026-11-15 | machine-drafted, needs native review |
| `docTimedOut` | so | Document timed out — please check your connection and retry. | Dukumentigu wuu daahay — fadlan hubi xiriirkaaga oo isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `docFailed` | so | We couldn’t open this document. Please try again. | Ma aanan furi karin dukumentigan. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `loadFailed` | so | We couldn’t load your documents. Please try again. | Ma aanan soo rari karin dukumentiyadaada. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `renameTitle` | so | Rename Document | Beddel magaca dukumentiga | 2026-11-15 | machine-drafted, needs native review |
| `nameLabel` | so | Document name | Magaca dukumentiga | 2026-11-15 | machine-drafted, needs native review |
| `nameRequired` | so | Enter a name for this document. | Geli magac dukumentigan. | 2026-11-15 | machine-drafted, needs native review |
| `renameLocked` | so | Unlock your vault to rename this document. | Fur khasnaddaada si aad magaca dukumentigan u beddesho. | 2026-11-15 | machine-drafted, needs native review |
| `renameFailed` | so | Failed to rename. Please try again. | Magaca lama beddeli karin. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `renamed` | so | Document renamed. | Magaca dukumentiga waa la beddelay. | 2026-11-15 | machine-drafted, needs native review |
| `moved` | so | Moved to {category}. | Waxaa loo guuriyay {category}. | 2026-11-15 | machine-drafted, needs native review |
| `moveFailed` | so | We couldn’t move this document. Please try again. | Ma aanan guurin karin dukumentigan. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `deleteTitle` | so | Delete this document? | Ma tirtirtaa dukumentigan? | 2026-11-15 | machine-drafted, needs native review |
| `deleteBody` | so | “{name}” will be permanently removed. This cannot be undone. | “{name}” si joogto ah ayaa loo tirtiri doonaa. Lama celin karo. | 2026-11-15 | machine-drafted, needs native review |
| `deleted` | so | Document deleted. | Dukumentiga waa la tirtiray. | 2026-11-15 | machine-drafted, needs native review |
| `deleteFailed` | so | Failed to delete document. | Dukumentiga lama tirtiri karin. | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | so | Cancel | Jooji | 2026-11-15 | machine-drafted, needs native review |
| `noSaved` | so | No saved resources yet | Weli kheyraad la kaydiyay ma jiro | 2026-11-15 | machine-drafted, needs native review |
| `noSavedBody` | so | Save resources from the chat or map to access them here | Ka kaydi kheyraadka sheekada ama khariidadda si aad halkan ugu hesho | 2026-11-15 | machine-drafted, needs native review |
| `visitWebsite` | so | Visit website | Booqo websaydka | 2026-11-15 | machine-drafted, needs native review |
| `getDirections` | so | Get directions | Hel tilmaamaha | 2026-11-15 | machine-drafted, needs native review |
| `removeSaved` | so | Remove from saved | Ka saar kuwa la kaydiyay | 2026-11-15 | machine-drafted, needs native review |
| `removedSaved` | so | Removed from saved. | Waa laga saaray kuwa la kaydiyay. | 2026-11-15 | machine-drafted, needs native review |
| `removeSavedFailed` | so | We couldn’t remove this resource. Please try again. | Ma aanan ka saari karin kheyraadkan. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `vaultLocked` | so | Vault Locked | Khasnadda waa xiran tahay | 2026-11-15 | machine-drafted, needs native review |
| `vaultLockedBody` | so | Unlock your vault to upload encrypted documents | Fur khasnaddaada si aad u soo geliso dukumentiyo la sireeyay | 2026-11-15 | machine-drafted, needs native review |
| `unlockVault` | so | Unlock Vault | Fur khasnadda | 2026-11-15 | machine-drafted, needs native review |
| `dropHere` | so | Drop file here | Halkan ku dhig faylka | 2026-11-15 | machine-drafted, needs native review |
| `uploadTitle` | so | Upload Encrypted Document | Soo geli dukumenti la sireeyay | 2026-11-15 | machine-drafted, needs native review |
| `uploadHint` | so | Drag and drop or click to browse. Files are encrypted before upload. | Jiid oo dhig ama guji si aad u raadiso. Faylasha waa la sireeyaa ka hor inta aan la soo gelin. | 2026-11-15 | machine-drafted, needs native review |
| `removeFile` | so | Remove | Ka saar | 2026-11-15 | machine-drafted, needs native review |
| `uploadProgress` | so | Encrypting and uploading... | Waa la sireynayaa oo la soo gelinayaa... | 2026-11-15 | machine-drafted, needs native review |
| `stepEncrypting` | so | Encrypting file... | Faylka ayaa la sireynayaa... | 2026-11-15 | machine-drafted, needs native review |
| `stepUploading` | so | Uploading... | Waa la soo gelinayaa... | 2026-11-15 | machine-drafted, needs native review |
| `stepSaving` | so | Saving metadata... | Xogta ayaa la kaydinayaa... | 2026-11-15 | machine-drafted, needs native review |
| `uploadFailed` | so | Upload Failed | Soo gelintu way guuldareysatay | 2026-11-15 | machine-drafted, needs native review |
| `uploadTimedOut` | so | Upload timed out — please check your connection and retry. | Soo gelintu way daahday — fadlan hubi xiriirkaaga oo isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `uploadFailedBody` | so | Your document was not uploaded. Please try again. | Dukumentigaaga lama soo gelin. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `uploaded` | so | Document uploaded successfully! | Dukumentiga si guul leh ayaa loo soo geliyay! | 2026-11-15 | machine-drafted, needs native review |
| `encryptAndUpload` | so | Encrypt and Upload | Sireey oo soo geli | 2026-11-15 | machine-drafted, needs native review |
| `securityNotice` | so | Your documents are encrypted on your device before upload. Only you can decrypt them with your vault password. | Dukumentiyadaada waxaa lagu sireeyaa qalabkaaga ka hor inta aan la soo gelin. Adiga oo keliya ayaa ku furi kara furaha sirta ee khasnaddaada. | 2026-11-15 | machine-drafted, needs native review |
| `setupTitle` | so | Set Up Your Vault | Diyaari khasnaddaada | 2026-11-15 | machine-drafted, needs native review |
| `unlockTitle` | so | Unlock Your Vault | Fur khasnaddaada | 2026-11-15 | machine-drafted, needs native review |
| `setupDescription` | so | Create a master password to encrypt your sensitive data. | Samee furaha sirta ee ugu muhiimsan si aad u sireyso xogtaada xasaasiga ah. | 2026-11-15 | machine-drafted, needs native review |
| `unlockDescription` | so | Enter your master password to access your encrypted data. | Geli furaha sirta ee ugu muhiimsan si aad u gasho xogtaada la sireeyay. | 2026-11-15 | machine-drafted, needs native review |
| `important` | so | Important: | Muhiim: | 2026-11-15 | machine-drafted, needs native review |
| `setupWarning` | so | If you forget this password, your encrypted data cannot be recovered. Please store it in a secure password manager. | Haddii aad illowdo furahan sirta ah, xogtaada la sireeyay lama soo celin karo. Fadlan ku kaydi maareeye furayaal sir ah oo ammaan ah. | 2026-11-15 | machine-drafted, needs native review |
| `masterPassword` | so | Master Password | Furaha sirta ee ugu muhiimsan | 2026-11-15 | machine-drafted, needs native review |
| `createPasswordPlaceholder` | so | Create a strong password | Samee fure sir ah oo adag | 2026-11-15 | machine-drafted, needs native review |
| `enterPasswordPlaceholder` | so | Enter your master password | Geli furahaaga sirta ee ugu muhiimsan | 2026-11-15 | machine-drafted, needs native review |
| `passwordHint` | so | Minimum 12 characters. Use a mix of letters, numbers, and symbols. | Ugu yaraan 12 xaraf. Isku dar xarfo, tirooyin iyo calaamado. | 2026-11-15 | machine-drafted, needs native review |
| `confirmPassword` | so | Confirm Password | Xaqiiji furaha sirta | 2026-11-15 | machine-drafted, needs native review |
| `confirmPasswordPlaceholder` | so | Re-enter your password | Mar kale geli furahaaga sirta | 2026-11-15 | machine-drafted, needs native review |
| `passwordMismatch` | so | Passwords do not match | Furayaasha sirta isma laha | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooShort` | so | Use at least 12 characters. | Isticmaal ugu yaraan 12 xaraf. | 2026-11-15 | machine-drafted, needs native review |
| `passwordRequired` | so | Enter your master password. | Geli furahaaga sirta ee ugu muhiimsan. | 2026-11-15 | machine-drafted, needs native review |
| `createVault` | so | Create Vault | Samee khasnadda | 2026-11-15 | machine-drafted, needs native review |
| `unlock` | so | Unlock | Fur | 2026-11-15 | machine-drafted, needs native review |
| `incorrectPassword` | so | Incorrect password | Furaha sirta waa khalad | 2026-11-15 | machine-drafted, needs native review |
| `vaultTimedOut` | so | Vault operation timed out. Please check your connection and try again. | Khasnaddu way daahday. Fadlan hubi xiriirkaaga oo isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `vaultFailed` | so | We couldn’t open your vault. Please try again. | Ma aanan furi karin khasnaddaada. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `setupFailed` | so | We couldn’t set up your vault. Please try again. | Ma aanan diyaarin karin khasnaddaada. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `checkingVault` | so | Checking your vault… | Khasnaddaada ayaa la hubinayaa… | 2026-11-15 | machine-drafted, needs native review |
| `guardUnlockToAccess` | so | Unlock your vault to access encrypted data. | Fur khasnaddaada si aad u gasho xogta la sireeyay. | 2026-11-15 | machine-drafted, needs native review |
| `guardSetUpToStore` | so | Set up your vault to encrypt and store sensitive data. | Diyaari khasnaddaada si aad u sireyso oo u kaydiso xog xasaasi ah. | 2026-11-15 | machine-drafted, needs native review |
| `guardLocked` | so | Your vault is locked. Unlock it to view encrypted data. | Khasnaddaadu waa xiran tahay. Fur si aad u aragto xogta la sireeyay. | 2026-11-15 | machine-drafted, needs native review |
| `guardSetUp` | so | Set up your vault to access encrypted features. | Diyaari khasnaddaada si aad u isticmaasho adeegyada la sireeyay. | 2026-11-15 | machine-drafted, needs native review |
| `documentFallback` | so | Document | Dukumenti | 2026-11-15 | machine-drafted, needs native review |
| `close` | so | Close | Xir | 2026-11-15 | machine-drafted, needs native review |
| `loadingDocument` | so | Loading document… | Dukumentiga ayaa la soo rarayaa… | 2026-11-15 | machine-drafted, needs native review |
| `readFailed` | so | We couldn’t open this file. Please try again. | Ma aanan furi karin faylkan. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `renderFailed` | so | We couldn’t display this PDF. | Ma aanan muujin karin PDF-kan. | 2026-11-15 | machine-drafted, needs native review |
| `downloadInstead` | so | Download instead | Beddelkeeda soo deji | 2026-11-15 | machine-drafted, needs native review |
| `noPreview` | so | Preview not available for this file type. | Hor-u-eegis looma heli karo nooca faylkan. | 2026-11-15 | machine-drafted, needs native review |
| `downloadFile` | so | Download File | Soo deji faylka | 2026-11-15 | machine-drafted, needs native review |
| `previousPage` | so | Previous page | Bogga hore | 2026-11-15 | machine-drafted, needs native review |
| `nextPage` | so | Next page | Bogga xiga | 2026-11-15 | machine-drafted, needs native review |
| `pageOf` | so | Page {page} of {total} | Bogga {page} ee {total} | 2026-11-15 | machine-drafted, needs native review |
| `website` | so | Website | Websayd | 2026-11-15 | machine-drafted, needs native review |
| `tasksComplete` | so | {done}/{total} tasks complete | {done}/{total} hawlood ayaa dhammaaday | 2026-11-15 | machine-drafted, needs native review |
| `communityPosts` | so | Community Posts | Qoraallada bulshada | 2026-11-15 | machine-drafted, needs native review |
| `tasks` | so | Tasks | Hawlaha | 2026-11-15 | machine-drafted, needs native review |
| `newTask` | so | New task | Hawl cusub | 2026-11-15 | machine-drafted, needs native review |
| `addTaskPlaceholder` | so | Add a task... | Ku dar hawl... | 2026-11-15 | machine-drafted, needs native review |
| `addTask` | so | Add task | Ku dar hawl | 2026-11-15 | machine-drafted, needs native review |
| `noTasks` | so | No tasks yet | Weli hawlo ma jiraan | 2026-11-15 | machine-drafted, needs native review |
| `deleteTask` | so | Delete task | Tirtir hawsha | 2026-11-15 | machine-drafted, needs native review |
| `schedule` | so | Schedule | Jadwalka | 2026-11-15 | machine-drafted, needs native review |
| `eventTitle` | so | Event title | Cinwaanka ballanta | 2026-11-15 | machine-drafted, needs native review |
| `eventTitlePlaceholder` | so | Event title... | Cinwaanka ballanta... | 2026-11-15 | machine-drafted, needs native review |
| `eventDate` | so | Date | Taariikhda | 2026-11-15 | machine-drafted, needs native review |
| `eventTime` | so | Time | Waqtiga | 2026-11-15 | machine-drafted, needs native review |
| `addEvent` | so | Add date | Ku dar taariikh | 2026-11-15 | machine-drafted, needs native review |
| `noEvents` | so | No scheduled dates | Taariikho la qorsheeyay ma jiraan | 2026-11-15 | machine-drafted, needs native review |
| `deleteEvent` | so | Delete date | Tirtir taariikhda | 2026-11-15 | machine-drafted, needs native review |
| `files` | so | Files | Faylasha | 2026-11-15 | machine-drafted, needs native review |
| `uploadingFile` | so | Uploading... | Waa la soo gelinayaa... | 2026-11-15 | machine-drafted, needs native review |
| `chooseFileToUpload` | so | Choose file to upload | Dooro fayl aad soo gelinayso | 2026-11-15 | machine-drafted, needs native review |
| `noFiles` | so | No files attached | Fayl lama lifaaqin | 2026-11-15 | machine-drafted, needs native review |
| `downloadAttachment` | so | Download | Soo deji | 2026-11-15 | machine-drafted, needs native review |
| `deleteAttachment` | so | Delete file | Tirtir faylka | 2026-11-15 | machine-drafted, needs native review |
| `notes` | so | Notes | Qoraallo | 2026-11-15 | machine-drafted, needs native review |
| `notesPlaceholder` | so | Add notes about this resource... | Ku dar qoraallo ku saabsan kheyraadkan... | 2026-11-15 | machine-drafted, needs native review |
| `notesSaved` | so | Saved | Waa la kaydiyay | 2026-11-15 | machine-drafted, needs native review |
| `saveNotes` | so | Save Notes | Kaydi qoraallada | 2026-11-15 | machine-drafted, needs native review |
| `loadingResource` | so | Loading resource… | Kheyraadka ayaa la soo rarayaa… | 2026-11-15 | machine-drafted, needs native review |
| `resourceNotFound` | so | Resource not found | Kheyraadka lama helin | 2026-11-15 | machine-drafted, needs native review |
| `noPosts` | so | No community posts about this resource yet. | Weli qoraallo bulsho oo ku saabsan kheyraadkan ma jiraan. | 2026-11-15 | machine-drafted, needs native review |
| `postsTimedOut` | so | Posts timed out — please retry. | Qoraalladu way daaheen. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `postsFailed` | so | We couldn’t load community posts. | Ma aanan soo rari karin qoraallada bulshada. | 2026-11-15 | machine-drafted, needs native review |
| `communityMember` | so | Community Member | Xubin bulshada ka mid ah | 2026-11-15 | machine-drafted, needs native review |
| `detailFailed` | so | Something went wrong. Please try again. | Wax ayaa qaldamay. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `annotationsSaved` | so | Changes saved. | Isbeddellada waa la kaydiyay. | 2026-11-15 | machine-drafted, needs native review |
| `pdfSaved` | so | PDF saved to My Documents. | PDF-ka waxaa lagu kaydiyay Dukumentiyadayda. | 2026-11-15 | machine-drafted, needs native review |
| `taskAdded` | so | Task added. | Hawsha waa la daray. | 2026-11-15 | machine-drafted, needs native review |
| `taskDeleted` | so | Task deleted. | Hawsha waa la tirtiray. | 2026-11-15 | machine-drafted, needs native review |
| `eventAdded` | so | Date added. | Taariikhda waa la daray. | 2026-11-15 | machine-drafted, needs native review |
| `eventDeleted` | so | Date deleted. | Taariikhda waa la tirtiray. | 2026-11-15 | machine-drafted, needs native review |
| `fileUploaded` | so | File uploaded. | Faylka waa la soo geliyay. | 2026-11-15 | machine-drafted, needs native review |
| `fileDeleted` | so | File deleted. | Faylka waa la tirtiray. | 2026-11-15 | machine-drafted, needs native review |
| `sectionsLabel` | am | Documents & Forms sections | የሰነዶች እና ቅጾች ክፍሎች | 2026-11-15 | machine-drafted, needs native review |
| `tabDocuments` | am | My Documents | ሰነዶቼ | 2026-11-15 | machine-drafted, needs native review |
| `tabApplications` | am | Applications | ማመልከቻዎች | 2026-11-15 | machine-drafted, needs native review |
| `tabResources` | am | My Resources | የእኔ ግብዓቶች | 2026-11-15 | machine-drafted, needs native review |
| `guestPrompt` | am | Create a free account to securely store and manage your documents | ሰነዶችዎን በደህንነት ለማስቀመጥ እና ለማስተዳደር ነፃ መለያ ይፍጠሩ | 2026-11-15 | machine-drafted, needs native review |
| `subtitle` | am | Securely store and manage your important documents | አስፈላጊ ሰነዶችዎን በደህንነት ያስቀምጡ እና ያስተዳድሩ | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | am | Search documents | ሰነዶችን ይፈልጉ | 2026-11-15 | machine-drafted, needs native review |
| `searchPlaceholder` | am | Search documents... | ሰነዶችን ይፈልጉ... | 2026-11-15 | machine-drafted, needs native review |
| `clearSearch` | am | Clear search | ፍለጋውን አጽዳ | 2026-11-15 | machine-drafted, needs native review |
| `foldersLabel` | am | Document folders | የሰነድ አቃፊዎች | 2026-11-15 | machine-drafted, needs native review |
| `catAll` | am | All Documents | ሁሉም ሰነዶች | 2026-11-15 | machine-drafted, needs native review |
| `catId` | am | ID Documents | የመታወቂያ ሰነዶች | 2026-11-15 | machine-drafted, needs native review |
| `catIncome` | am | Income Proof | የገቢ ማስረጃ | 2026-11-15 | machine-drafted, needs native review |
| `catResidence` | am | Residence | መኖሪያ | 2026-11-15 | machine-drafted, needs native review |
| `catMedical` | am | Medical | የሕክምና | 2026-11-15 | machine-drafted, needs native review |
| `catForms` | am | Submitted Forms | የተላኩ ቅጾች | 2026-11-15 | machine-drafted, needs native review |
| `catOther` | am | Other | ሌላ | 2026-11-15 | machine-drafted, needs native review |
| `encrypted` | am | Encrypted | የተመሰጠረ | 2026-11-15 | machine-drafted, needs native review |
| `today` | am | Today | ዛሬ | 2026-11-15 | machine-drafted, needs native review |
| `yesterday` | am | Yesterday | ትናንት | 2026-11-15 | machine-drafted, needs native review |
| `daysAgo` | am | {n} days ago | ከ{n} ቀናት በፊት | 2026-11-15 | machine-drafted, needs native review |
| `sizeBytes` | am | {n} B | {n} B | 2026-11-15 | machine-drafted, needs native review |
| `sizeKb` | am | {n} KB | {n} KB | 2026-11-15 | machine-drafted, needs native review |
| `sizeMb` | am | {n} MB | {n} MB | 2026-11-15 | machine-drafted, needs native review |
| `view` | am | View | ይመልከቱ | 2026-11-15 | machine-drafted, needs native review |
| `editAnnotations` | am | Edit PDF annotations | የPDF ማስታወሻዎችን ያርትዑ | 2026-11-15 | machine-drafted, needs native review |
| `download` | am | Download | አውርድ | 2026-11-15 | machine-drafted, needs native review |
| `moreOptions` | am | More options: {name} | ተጨማሪ አማራጮች፦ {name} | 2026-11-15 | machine-drafted, needs native review |
| `rename` | am | Rename | ስም ቀይር | 2026-11-15 | machine-drafted, needs native review |
| `moveTo` | am | Move to {category} | ወደ {category} አንቀሳቅስ | 2026-11-15 | machine-drafted, needs native review |
| `delete` | am | Delete | ሰርዝ | 2026-11-15 | machine-drafted, needs native review |
| `noResults` | am | No results found | ምንም ውጤት አልተገኘም | 2026-11-15 | machine-drafted, needs native review |
| `noMatch` | am | No documents match “{query}” | ከ“{query}” ጋር የሚዛመድ ሰነድ የለም | 2026-11-15 | machine-drafted, needs native review |
| `emptyAll` | am | No documents yet | እስካሁን ሰነዶች የሉም | 2026-11-15 | machine-drafted, needs native review |
| `emptyCategory` | am | Nothing in {category} yet | በ{category} ውስጥ እስካሁን ምንም የለም | 2026-11-15 | machine-drafted, needs native review |
| `emptyAllBody` | am | Upload your first document to get started | ለመጀመር የመጀመሪያ ሰነድዎን ይስቀሉ | 2026-11-15 | machine-drafted, needs native review |
| `emptyCategoryBody` | am | Upload documents to this folder for easy access | በቀላሉ ለማግኘት ሰነዶችን ወደዚህ አቃፊ ይስቀሉ | 2026-11-15 | machine-drafted, needs native review |
| `uploadDocument` | am | Upload Document | ሰነድ ስቀል | 2026-11-15 | machine-drafted, needs native review |
| `loading` | am | Loading your documents… | ሰነዶችዎ እየተጫኑ ነው… | 2026-11-15 | machine-drafted, needs native review |
| `dismiss` | am | Dismiss | ዝጋ | 2026-11-15 | machine-drafted, needs native review |
| `docTimedOut` | am | Document timed out — please check your connection and retry. | ሰነዱ በጣም ዘገየ — እባክዎ ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `docFailed` | am | We couldn’t open this document. Please try again. | ይህን ሰነድ መክፈት አልቻልንም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `loadFailed` | am | We couldn’t load your documents. Please try again. | ሰነዶችዎን መጫን አልቻልንም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `renameTitle` | am | Rename Document | የሰነዱን ስም ቀይር | 2026-11-15 | machine-drafted, needs native review |
| `nameLabel` | am | Document name | የሰነድ ስም | 2026-11-15 | machine-drafted, needs native review |
| `nameRequired` | am | Enter a name for this document. | ለዚህ ሰነድ ስም ያስገቡ። | 2026-11-15 | machine-drafted, needs native review |
| `renameLocked` | am | Unlock your vault to rename this document. | የዚህን ሰነድ ስም ለመቀየር ካዝናዎን ይክፈቱ። | 2026-11-15 | machine-drafted, needs native review |
| `renameFailed` | am | Failed to rename. Please try again. | ስሙን መቀየር አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `renamed` | am | Document renamed. | የሰነዱ ስም ተቀይሯል። | 2026-11-15 | machine-drafted, needs native review |
| `moved` | am | Moved to {category}. | ወደ {category} ተንቀሳቅሷል። | 2026-11-15 | machine-drafted, needs native review |
| `moveFailed` | am | We couldn’t move this document. Please try again. | ይህን ሰነድ ማንቀሳቀስ አልቻልንም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `deleteTitle` | am | Delete this document? | ይህ ሰነድ ይሰረዝ? | 2026-11-15 | machine-drafted, needs native review |
| `deleteBody` | am | “{name}” will be permanently removed. This cannot be undone. | “{name}” ለዘለቄታው ይሰረዛል። ይህ ሊቀለበስ አይችልም። | 2026-11-15 | machine-drafted, needs native review |
| `deleted` | am | Document deleted. | ሰነዱ ተሰርዟል። | 2026-11-15 | machine-drafted, needs native review |
| `deleteFailed` | am | Failed to delete document. | ሰነዱን መሰረዝ አልተቻለም። | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | am | Cancel | ይቅር | 2026-11-15 | machine-drafted, needs native review |
| `noSaved` | am | No saved resources yet | እስካሁን የተቀመጡ ግብዓቶች የሉም | 2026-11-15 | machine-drafted, needs native review |
| `noSavedBody` | am | Save resources from the chat or map to access them here | ግብዓቶችን ከውይይቱ ወይም ከካርታው በማስቀመጥ እዚህ ያግኟቸው | 2026-11-15 | machine-drafted, needs native review |
| `visitWebsite` | am | Visit website | ድረ-ገጹን ይጎብኙ | 2026-11-15 | machine-drafted, needs native review |
| `getDirections` | am | Get directions | አቅጣጫ ያግኙ | 2026-11-15 | machine-drafted, needs native review |
| `removeSaved` | am | Remove from saved | ከተቀመጡት አስወግድ | 2026-11-15 | machine-drafted, needs native review |
| `removedSaved` | am | Removed from saved. | ከተቀመጡት ተወግዷል። | 2026-11-15 | machine-drafted, needs native review |
| `removeSavedFailed` | am | We couldn’t remove this resource. Please try again. | ይህን ግብዓት ማስወገድ አልቻልንም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `vaultLocked` | am | Vault Locked | ካዝናው ተቆልፏል | 2026-11-15 | machine-drafted, needs native review |
| `vaultLockedBody` | am | Unlock your vault to upload encrypted documents | የተመሰጠሩ ሰነዶችን ለመስቀል ካዝናዎን ይክፈቱ | 2026-11-15 | machine-drafted, needs native review |
| `unlockVault` | am | Unlock Vault | ካዝናውን ክፈት | 2026-11-15 | machine-drafted, needs native review |
| `dropHere` | am | Drop file here | ፋይሉን እዚህ ይጣሉ | 2026-11-15 | machine-drafted, needs native review |
| `uploadTitle` | am | Upload Encrypted Document | የተመሰጠረ ሰነድ ስቀል | 2026-11-15 | machine-drafted, needs native review |
| `uploadHint` | am | Drag and drop or click to browse. Files are encrypted before upload. | ጎትተው ይጣሉ ወይም ለማሰስ ጠቅ ያድርጉ። ፋይሎች ከመሰቀላቸው በፊት ይመሰጠራሉ። | 2026-11-15 | machine-drafted, needs native review |
| `removeFile` | am | Remove | አስወግድ | 2026-11-15 | machine-drafted, needs native review |
| `uploadProgress` | am | Encrypting and uploading... | እየተመሰጠረ እና እየተሰቀለ ነው... | 2026-11-15 | machine-drafted, needs native review |
| `stepEncrypting` | am | Encrypting file... | ፋይሉ እየተመሰጠረ ነው... | 2026-11-15 | machine-drafted, needs native review |
| `stepUploading` | am | Uploading... | እየተሰቀለ ነው... | 2026-11-15 | machine-drafted, needs native review |
| `stepSaving` | am | Saving metadata... | መረጃው እየተቀመጠ ነው... | 2026-11-15 | machine-drafted, needs native review |
| `uploadFailed` | am | Upload Failed | መስቀል አልተሳካም | 2026-11-15 | machine-drafted, needs native review |
| `uploadTimedOut` | am | Upload timed out — please check your connection and retry. | መስቀሉ በጣም ዘገየ — እባክዎ ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `uploadFailedBody` | am | Your document was not uploaded. Please try again. | ሰነድዎ አልተሰቀለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `uploaded` | am | Document uploaded successfully! | ሰነዱ በተሳካ ሁኔታ ተሰቅሏል! | 2026-11-15 | machine-drafted, needs native review |
| `encryptAndUpload` | am | Encrypt and Upload | መስጥር እና ስቀል | 2026-11-15 | machine-drafted, needs native review |
| `securityNotice` | am | Your documents are encrypted on your device before upload. Only you can decrypt them with your vault password. | ሰነዶችዎ ከመሰቀላቸው በፊት በመሣሪያዎ ላይ ይመሰጠራሉ። በካዝናዎ የይለፍ ቃል ሊፈቷቸው የሚችሉት እርስዎ ብቻ ነዎት። | 2026-11-15 | machine-drafted, needs native review |
| `setupTitle` | am | Set Up Your Vault | ካዝናዎን ያዘጋጁ | 2026-11-15 | machine-drafted, needs native review |
| `unlockTitle` | am | Unlock Your Vault | ካዝናዎን ይክፈቱ | 2026-11-15 | machine-drafted, needs native review |
| `setupDescription` | am | Create a master password to encrypt your sensitive data. | ሚስጥራዊ መረጃዎን ለመመስጠር ዋና የይለፍ ቃል ይፍጠሩ። | 2026-11-15 | machine-drafted, needs native review |
| `unlockDescription` | am | Enter your master password to access your encrypted data. | የተመሰጠረ መረጃዎን ለማግኘት ዋና የይለፍ ቃልዎን ያስገቡ። | 2026-11-15 | machine-drafted, needs native review |
| `important` | am | Important: | አስፈላጊ፦ | 2026-11-15 | machine-drafted, needs native review |
| `setupWarning` | am | If you forget this password, your encrypted data cannot be recovered. Please store it in a secure password manager. | ይህን የይለፍ ቃል ከረሱ፣ የተመሰጠረ መረጃዎ ሊመለስ አይችልም። እባክዎ ደህንነቱ በተጠበቀ የይለፍ ቃል አስተዳዳሪ ውስጥ ያስቀምጡት። | 2026-11-15 | machine-drafted, needs native review |
| `masterPassword` | am | Master Password | ዋና የይለፍ ቃል | 2026-11-15 | machine-drafted, needs native review |
| `createPasswordPlaceholder` | am | Create a strong password | ጠንካራ የይለፍ ቃል ይፍጠሩ | 2026-11-15 | machine-drafted, needs native review |
| `enterPasswordPlaceholder` | am | Enter your master password | ዋና የይለፍ ቃልዎን ያስገቡ | 2026-11-15 | machine-drafted, needs native review |
| `passwordHint` | am | Minimum 12 characters. Use a mix of letters, numbers, and symbols. | ቢያንስ 12 ቁምፊዎች። ፊደሎችን፣ ቁጥሮችን እና ምልክቶችን ያቀላቅሉ። | 2026-11-15 | machine-drafted, needs native review |
| `confirmPassword` | am | Confirm Password | የይለፍ ቃሉን ያረጋግጡ | 2026-11-15 | machine-drafted, needs native review |
| `confirmPasswordPlaceholder` | am | Re-enter your password | የይለፍ ቃልዎን እንደገና ያስገቡ | 2026-11-15 | machine-drafted, needs native review |
| `passwordMismatch` | am | Passwords do not match | የይለፍ ቃሎቹ አይዛመዱም | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooShort` | am | Use at least 12 characters. | ቢያንስ 12 ቁምፊዎችን ይጠቀሙ። | 2026-11-15 | machine-drafted, needs native review |
| `passwordRequired` | am | Enter your master password. | ዋና የይለፍ ቃልዎን ያስገቡ። | 2026-11-15 | machine-drafted, needs native review |
| `createVault` | am | Create Vault | ካዝና ፍጠር | 2026-11-15 | machine-drafted, needs native review |
| `unlock` | am | Unlock | ክፈት | 2026-11-15 | machine-drafted, needs native review |
| `incorrectPassword` | am | Incorrect password | የይለፍ ቃሉ ትክክል አይደለም | 2026-11-15 | machine-drafted, needs native review |
| `vaultTimedOut` | am | Vault operation timed out. Please check your connection and try again. | ካዝናው በጣም ዘገየ። እባክዎ ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `vaultFailed` | am | We couldn’t open your vault. Please try again. | ካዝናዎን መክፈት አልቻልንም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `setupFailed` | am | We couldn’t set up your vault. Please try again. | ካዝናዎን ማዘጋጀት አልቻልንም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `checkingVault` | am | Checking your vault… | ካዝናዎ እየተረጋገጠ ነው… | 2026-11-15 | machine-drafted, needs native review |
| `guardUnlockToAccess` | am | Unlock your vault to access encrypted data. | የተመሰጠረ መረጃ ለማግኘት ካዝናዎን ይክፈቱ። | 2026-11-15 | machine-drafted, needs native review |
| `guardSetUpToStore` | am | Set up your vault to encrypt and store sensitive data. | ሚስጥራዊ መረጃን ለመመስጠር እና ለማስቀመጥ ካዝናዎን ያዘጋጁ። | 2026-11-15 | machine-drafted, needs native review |
| `guardLocked` | am | Your vault is locked. Unlock it to view encrypted data. | ካዝናዎ ተቆልፏል። የተመሰጠረ መረጃን ለማየት ይክፈቱት። | 2026-11-15 | machine-drafted, needs native review |
| `guardSetUp` | am | Set up your vault to access encrypted features. | የተመሰጠሩ ባህሪያትን ለመጠቀም ካዝናዎን ያዘጋጁ። | 2026-11-15 | machine-drafted, needs native review |
| `documentFallback` | am | Document | ሰነድ | 2026-11-15 | machine-drafted, needs native review |
| `close` | am | Close | ዝጋ | 2026-11-15 | machine-drafted, needs native review |
| `loadingDocument` | am | Loading document… | ሰነዱ እየተጫነ ነው… | 2026-11-15 | machine-drafted, needs native review |
| `readFailed` | am | We couldn’t open this file. Please try again. | ይህን ፋይል መክፈት አልቻልንም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `renderFailed` | am | We couldn’t display this PDF. | ይህን PDF ማሳየት አልቻልንም። | 2026-11-15 | machine-drafted, needs native review |
| `downloadInstead` | am | Download instead | በምትኩ አውርድ | 2026-11-15 | machine-drafted, needs native review |
| `noPreview` | am | Preview not available for this file type. | ለዚህ የፋይል አይነት ቅድመ እይታ የለም። | 2026-11-15 | machine-drafted, needs native review |
| `downloadFile` | am | Download File | ፋይሉን አውርድ | 2026-11-15 | machine-drafted, needs native review |
| `previousPage` | am | Previous page | ቀዳሚ ገጽ | 2026-11-15 | machine-drafted, needs native review |
| `nextPage` | am | Next page | ቀጣይ ገጽ | 2026-11-15 | machine-drafted, needs native review |
| `pageOf` | am | Page {page} of {total} | ገጽ {page} ከ{total} | 2026-11-15 | machine-drafted, needs native review |
| `website` | am | Website | ድረ-ገጽ | 2026-11-15 | machine-drafted, needs native review |
| `tasksComplete` | am | {done}/{total} tasks complete | {done}/{total} ተግባራት ተጠናቀዋል | 2026-11-15 | machine-drafted, needs native review |
| `communityPosts` | am | Community Posts | የማህበረሰብ ልጥፎች | 2026-11-15 | machine-drafted, needs native review |
| `tasks` | am | Tasks | ተግባራት | 2026-11-15 | machine-drafted, needs native review |
| `newTask` | am | New task | አዲስ ተግባር | 2026-11-15 | machine-drafted, needs native review |
| `addTaskPlaceholder` | am | Add a task... | ተግባር ያክሉ... | 2026-11-15 | machine-drafted, needs native review |
| `addTask` | am | Add task | ተግባር አክል | 2026-11-15 | machine-drafted, needs native review |
| `noTasks` | am | No tasks yet | እስካሁን ተግባራት የሉም | 2026-11-15 | machine-drafted, needs native review |
| `deleteTask` | am | Delete task | ተግባሩን ሰርዝ | 2026-11-15 | machine-drafted, needs native review |
| `schedule` | am | Schedule | መርሐግብር | 2026-11-15 | machine-drafted, needs native review |
| `eventTitle` | am | Event title | የቀጠሮው ርዕስ | 2026-11-15 | machine-drafted, needs native review |
| `eventTitlePlaceholder` | am | Event title... | የቀጠሮው ርዕስ... | 2026-11-15 | machine-drafted, needs native review |
| `eventDate` | am | Date | ቀን | 2026-11-15 | machine-drafted, needs native review |
| `eventTime` | am | Time | ሰዓት | 2026-11-15 | machine-drafted, needs native review |
| `addEvent` | am | Add date | ቀን አክል | 2026-11-15 | machine-drafted, needs native review |
| `noEvents` | am | No scheduled dates | የተያዘ ቀን የለም | 2026-11-15 | machine-drafted, needs native review |
| `deleteEvent` | am | Delete date | ቀኑን ሰርዝ | 2026-11-15 | machine-drafted, needs native review |
| `files` | am | Files | ፋይሎች | 2026-11-15 | machine-drafted, needs native review |
| `uploadingFile` | am | Uploading... | እየተሰቀለ ነው... | 2026-11-15 | machine-drafted, needs native review |
| `chooseFileToUpload` | am | Choose file to upload | የሚሰቀል ፋይል ይምረጡ | 2026-11-15 | machine-drafted, needs native review |
| `noFiles` | am | No files attached | የተያያዘ ፋይል የለም | 2026-11-15 | machine-drafted, needs native review |
| `downloadAttachment` | am | Download | አውርድ | 2026-11-15 | machine-drafted, needs native review |
| `deleteAttachment` | am | Delete file | ፋይሉን ሰርዝ | 2026-11-15 | machine-drafted, needs native review |
| `notes` | am | Notes | ማስታወሻዎች | 2026-11-15 | machine-drafted, needs native review |
| `notesPlaceholder` | am | Add notes about this resource... | ስለዚህ ግብዓት ማስታወሻ ያክሉ... | 2026-11-15 | machine-drafted, needs native review |
| `notesSaved` | am | Saved | ተቀምጧል | 2026-11-15 | machine-drafted, needs native review |
| `saveNotes` | am | Save Notes | ማስታወሻዎቹን አስቀምጥ | 2026-11-15 | machine-drafted, needs native review |
| `loadingResource` | am | Loading resource… | ግብዓቱ እየተጫነ ነው… | 2026-11-15 | machine-drafted, needs native review |
| `resourceNotFound` | am | Resource not found | ግብዓቱ አልተገኘም | 2026-11-15 | machine-drafted, needs native review |
| `noPosts` | am | No community posts about this resource yet. | ስለዚህ ግብዓት እስካሁን የማህበረሰብ ልጥፎች የሉም። | 2026-11-15 | machine-drafted, needs native review |
| `postsTimedOut` | am | Posts timed out — please retry. | ልጥፎቹ በጣም ዘገዩ። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `postsFailed` | am | We couldn’t load community posts. | የማህበረሰብ ልጥፎችን መጫን አልቻልንም። | 2026-11-15 | machine-drafted, needs native review |
| `communityMember` | am | Community Member | የማህበረሰብ አባል | 2026-11-15 | machine-drafted, needs native review |
| `detailFailed` | am | Something went wrong. Please try again. | የሆነ ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `annotationsSaved` | am | Changes saved. | ለውጦቹ ተቀምጠዋል። | 2026-11-15 | machine-drafted, needs native review |
| `pdfSaved` | am | PDF saved to My Documents. | PDF በሰነዶቼ ውስጥ ተቀምጧል። | 2026-11-15 | machine-drafted, needs native review |
| `taskAdded` | am | Task added. | ተግባሩ ታክሏል። | 2026-11-15 | machine-drafted, needs native review |
| `taskDeleted` | am | Task deleted. | ተግባሩ ተሰርዟል። | 2026-11-15 | machine-drafted, needs native review |
| `eventAdded` | am | Date added. | ቀኑ ታክሏል። | 2026-11-15 | machine-drafted, needs native review |
| `eventDeleted` | am | Date deleted. | ቀኑ ተሰርዟል። | 2026-11-15 | machine-drafted, needs native review |
| `fileUploaded` | am | File uploaded. | ፋይሉ ተሰቅሏል። | 2026-11-15 | machine-drafted, needs native review |
| `fileDeleted` | am | File deleted. | ፋይሉ ተሰርዟል። | 2026-11-15 | machine-drafted, needs native review |
| `sectionsLabel` | hmn | Documents & Forms sections | Cov ntu Ntaub ntawv thiab daim foos | 2026-11-15 | machine-drafted, needs native review |
| `tabDocuments` | hmn | My Documents | Kuv cov ntaub ntawv | 2026-11-15 | machine-drafted, needs native review |
| `tabApplications` | hmn | Applications | Cov ntawv thov | 2026-11-15 | machine-drafted, needs native review |
| `tabResources` | hmn | My Resources | Kuv cov kev pab | 2026-11-15 | machine-drafted, needs native review |
| `guestPrompt` | hmn | Create a free account to securely store and manage your documents | Tsim ib tus as khauj dawb kom khaws thiab tswj koj cov ntaub ntawv kom muaj kev nyab xeeb | 2026-11-15 | machine-drafted, needs native review |
| `subtitle` | hmn | Securely store and manage your important documents | Khaws thiab tswj koj cov ntaub ntawv tseem ceeb kom muaj kev nyab xeeb | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | hmn | Search documents | Nrhiav ntaub ntawv | 2026-11-15 | machine-drafted, needs native review |
| `searchPlaceholder` | hmn | Search documents... | Nrhiav ntaub ntawv... | 2026-11-15 | machine-drafted, needs native review |
| `clearSearch` | hmn | Clear search | Lwv qhov nrhiav | 2026-11-15 | machine-drafted, needs native review |
| `foldersLabel` | hmn | Document folders | Cov phau ntaub ntawv | 2026-11-15 | machine-drafted, needs native review |
| `catAll` | hmn | All Documents | Txhua cov ntaub ntawv | 2026-11-15 | machine-drafted, needs native review |
| `catId` | hmn | ID Documents | Ntaub ntawv qhia tus kheej | 2026-11-15 | machine-drafted, needs native review |
| `catIncome` | hmn | Income Proof | Pov thawj nyiaj tau los | 2026-11-15 | machine-drafted, needs native review |
| `catResidence` | hmn | Residence | Chaw nyob | 2026-11-15 | machine-drafted, needs native review |
| `catMedical` | hmn | Medical | Kev kho mob | 2026-11-15 | machine-drafted, needs native review |
| `catForms` | hmn | Submitted Forms | Cov foos xa lawm | 2026-11-15 | machine-drafted, needs native review |
| `catOther` | hmn | Other | Lwm yam | 2026-11-15 | machine-drafted, needs native review |
| `encrypted` | hmn | Encrypted | Muab zais lawm | 2026-11-15 | machine-drafted, needs native review |
| `today` | hmn | Today | Hnub no | 2026-11-15 | machine-drafted, needs native review |
| `yesterday` | hmn | Yesterday | Nag hmo | 2026-11-15 | machine-drafted, needs native review |
| `daysAgo` | hmn | {n} days ago | {n} hnub dhau los | 2026-11-15 | machine-drafted, needs native review |
| `sizeBytes` | hmn | {n} B | {n} B | 2026-11-15 | machine-drafted, needs native review |
| `sizeKb` | hmn | {n} KB | {n} KB | 2026-11-15 | machine-drafted, needs native review |
| `sizeMb` | hmn | {n} MB | {n} MB | 2026-11-15 | machine-drafted, needs native review |
| `view` | hmn | View | Saib | 2026-11-15 | machine-drafted, needs native review |
| `editAnnotations` | hmn | Edit PDF annotations | Kho cov lus sau hauv PDF | 2026-11-15 | machine-drafted, needs native review |
| `download` | hmn | Download | Rub tawm | 2026-11-15 | machine-drafted, needs native review |
| `moreOptions` | hmn | More options: {name} | Lwm yam xaiv: {name} | 2026-11-15 | machine-drafted, needs native review |
| `rename` | hmn | Rename | Hloov npe | 2026-11-15 | machine-drafted, needs native review |
| `moveTo` | hmn | Move to {category} | Tsiv mus rau {category} | 2026-11-15 | machine-drafted, needs native review |
| `delete` | hmn | Delete | Rho tawm | 2026-11-15 | machine-drafted, needs native review |
| `noResults` | hmn | No results found | Nrhiav tsis tau dab tsi | 2026-11-15 | machine-drafted, needs native review |
| `noMatch` | hmn | No documents match “{query}” | Tsis muaj ntaub ntawv twg zoo li “{query}” | 2026-11-15 | machine-drafted, needs native review |
| `emptyAll` | hmn | No documents yet | Tseem tsis tau muaj ntaub ntawv | 2026-11-15 | machine-drafted, needs native review |
| `emptyCategory` | hmn | Nothing in {category} yet | Tseem tsis tau muaj dab tsi hauv {category} | 2026-11-15 | machine-drafted, needs native review |
| `emptyAllBody` | hmn | Upload your first document to get started | Xa koj thawj daim ntaub ntawv los pib | 2026-11-15 | machine-drafted, needs native review |
| `emptyCategoryBody` | hmn | Upload documents to this folder for easy access | Xa ntaub ntawv rau hauv phau no kom nrhiav tau yooj yim | 2026-11-15 | machine-drafted, needs native review |
| `uploadDocument` | hmn | Upload Document | Xa ntaub ntawv | 2026-11-15 | machine-drafted, needs native review |
| `loading` | hmn | Loading your documents… | Tab tom thauj koj cov ntaub ntawv… | 2026-11-15 | machine-drafted, needs native review |
| `dismiss` | hmn | Dismiss | Kaw | 2026-11-15 | machine-drafted, needs native review |
| `docTimedOut` | hmn | Document timed out — please check your connection and retry. | Daim ntaub ntawv siv sij hawm ntev dhau — thov xyuas koj qhov kev sib txuas thiab sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `docFailed` | hmn | We couldn’t open this document. Please try again. | Peb qhib tsis tau daim ntaub ntawv no. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `loadFailed` | hmn | We couldn’t load your documents. Please try again. | Peb thauj tsis tau koj cov ntaub ntawv. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `renameTitle` | hmn | Rename Document | Hloov npe ntaub ntawv | 2026-11-15 | machine-drafted, needs native review |
| `nameLabel` | hmn | Document name | Npe ntaub ntawv | 2026-11-15 | machine-drafted, needs native review |
| `nameRequired` | hmn | Enter a name for this document. | Sau ib lub npe rau daim ntaub ntawv no. | 2026-11-15 | machine-drafted, needs native review |
| `renameLocked` | hmn | Unlock your vault to rename this document. | Qhib koj lub thawv xauv kom hloov tau npe daim ntaub ntawv no. | 2026-11-15 | machine-drafted, needs native review |
| `renameFailed` | hmn | Failed to rename. Please try again. | Hloov tsis tau npe. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `renamed` | hmn | Document renamed. | Hloov npe ntaub ntawv lawm. | 2026-11-15 | machine-drafted, needs native review |
| `moved` | hmn | Moved to {category}. | Tsiv mus rau {category} lawm. | 2026-11-15 | machine-drafted, needs native review |
| `moveFailed` | hmn | We couldn’t move this document. Please try again. | Peb tsiv tsis tau daim ntaub ntawv no. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `deleteTitle` | hmn | Delete this document? | Rho daim ntaub ntawv no tawm? | 2026-11-15 | machine-drafted, needs native review |
| `deleteBody` | hmn | “{name}” will be permanently removed. This cannot be undone. | “{name}” yuav raug rho tawm mus tas li. Rov qab tsis tau. | 2026-11-15 | machine-drafted, needs native review |
| `deleted` | hmn | Document deleted. | Rho daim ntaub ntawv tawm lawm. | 2026-11-15 | machine-drafted, needs native review |
| `deleteFailed` | hmn | Failed to delete document. | Rho tsis tau daim ntaub ntawv. | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | hmn | Cancel | Tso tseg | 2026-11-15 | machine-drafted, needs native review |
| `noSaved` | hmn | No saved resources yet | Tseem tsis tau muaj kev pab khaws cia | 2026-11-15 | machine-drafted, needs native review |
| `noSavedBody` | hmn | Save resources from the chat or map to access them here | Khaws kev pab ntawm kev sib tham lossis daim ntawv qhia chaw kom pom ntawm no | 2026-11-15 | machine-drafted, needs native review |
| `visitWebsite` | hmn | Visit website | Mus saib lub vev xaib | 2026-11-15 | machine-drafted, needs native review |
| `getDirections` | hmn | Get directions | Nrhiav kev mus | 2026-11-15 | machine-drafted, needs native review |
| `removeSaved` | hmn | Remove from saved | Muab tshem ntawm cov khaws cia | 2026-11-15 | machine-drafted, needs native review |
| `removedSaved` | hmn | Removed from saved. | Muab tshem ntawm cov khaws cia lawm. | 2026-11-15 | machine-drafted, needs native review |
| `removeSavedFailed` | hmn | We couldn’t remove this resource. Please try again. | Peb tshem tsis tau qhov kev pab no. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `vaultLocked` | hmn | Vault Locked | Lub thawv xauv kaw lawm | 2026-11-15 | machine-drafted, needs native review |
| `vaultLockedBody` | hmn | Unlock your vault to upload encrypted documents | Qhib koj lub thawv xauv kom xa tau ntaub ntawv uas muab zais | 2026-11-15 | machine-drafted, needs native review |
| `unlockVault` | hmn | Unlock Vault | Qhib lub thawv xauv | 2026-11-15 | machine-drafted, needs native review |
| `dropHere` | hmn | Drop file here | Muab cov ntaub ntawv tso rau ntawm no | 2026-11-15 | machine-drafted, needs native review |
| `uploadTitle` | hmn | Upload Encrypted Document | Xa ntaub ntawv uas muab zais | 2026-11-15 | machine-drafted, needs native review |
| `uploadHint` | hmn | Drag and drop or click to browse. Files are encrypted before upload. | Rub thiab tso lossis nias los nrhiav. Cov ntaub ntawv raug muab zais ua ntej xa. | 2026-11-15 | machine-drafted, needs native review |
| `removeFile` | hmn | Remove | Tshem | 2026-11-15 | machine-drafted, needs native review |
| `uploadProgress` | hmn | Encrypting and uploading... | Tab tom muab zais thiab xa... | 2026-11-15 | machine-drafted, needs native review |
| `stepEncrypting` | hmn | Encrypting file... | Tab tom muab zais cov ntaub ntawv... | 2026-11-15 | machine-drafted, needs native review |
| `stepUploading` | hmn | Uploading... | Tab tom xa... | 2026-11-15 | machine-drafted, needs native review |
| `stepSaving` | hmn | Saving metadata... | Tab tom khaws cov ntsiab lus... | 2026-11-15 | machine-drafted, needs native review |
| `uploadFailed` | hmn | Upload Failed | Xa tsis tau | 2026-11-15 | machine-drafted, needs native review |
| `uploadTimedOut` | hmn | Upload timed out — please check your connection and retry. | Kev xa siv sij hawm ntev dhau — thov xyuas koj qhov kev sib txuas thiab sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `uploadFailedBody` | hmn | Your document was not uploaded. Please try again. | Koj daim ntaub ntawv tsis tau xa. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `uploaded` | hmn | Document uploaded successfully! | Xa daim ntaub ntawv tau lawm! | 2026-11-15 | machine-drafted, needs native review |
| `encryptAndUpload` | hmn | Encrypt and Upload | Muab zais thiab xa | 2026-11-15 | machine-drafted, needs native review |
| `securityNotice` | hmn | Your documents are encrypted on your device before upload. Only you can decrypt them with your vault password. | Koj cov ntaub ntawv raug muab zais ntawm koj lub cuab yeej ua ntej xa. Tsuas yog koj thiaj qhib tau siv koj tus lej zais ntawm lub thawv xauv. | 2026-11-15 | machine-drafted, needs native review |
| `setupTitle` | hmn | Set Up Your Vault | Teeb koj lub thawv xauv | 2026-11-15 | machine-drafted, needs native review |
| `unlockTitle` | hmn | Unlock Your Vault | Qhib koj lub thawv xauv | 2026-11-15 | machine-drafted, needs native review |
| `setupDescription` | hmn | Create a master password to encrypt your sensitive data. | Tsim ib tus lej zais tseem ceeb los muab zais koj cov ntaub ntawv rhiab. | 2026-11-15 | machine-drafted, needs native review |
| `unlockDescription` | hmn | Enter your master password to access your encrypted data. | Sau koj tus lej zais tseem ceeb kom nkag tau koj cov ntaub ntawv uas muab zais. | 2026-11-15 | machine-drafted, needs native review |
| `important` | hmn | Important: | Tseem ceeb: | 2026-11-15 | machine-drafted, needs native review |
| `setupWarning` | hmn | If you forget this password, your encrypted data cannot be recovered. Please store it in a secure password manager. | Yog koj tsis nco qab tus lej zais no, koj cov ntaub ntawv uas muab zais yuav rov qab tsis tau. Thov khaws nws rau hauv ib qho kev tswj lej zais uas muaj kev nyab xeeb. | 2026-11-15 | machine-drafted, needs native review |
| `masterPassword` | hmn | Master Password | Tus lej zais tseem ceeb | 2026-11-15 | machine-drafted, needs native review |
| `createPasswordPlaceholder` | hmn | Create a strong password | Tsim ib tus lej zais uas ruaj khov | 2026-11-15 | machine-drafted, needs native review |
| `enterPasswordPlaceholder` | hmn | Enter your master password | Sau koj tus lej zais tseem ceeb | 2026-11-15 | machine-drafted, needs native review |
| `passwordHint` | hmn | Minimum 12 characters. Use a mix of letters, numbers, and symbols. | Tsawg kawg yog 12 tus ntawv. Sib xyaw tus ntawv, tus lej thiab cov cim. | 2026-11-15 | machine-drafted, needs native review |
| `confirmPassword` | hmn | Confirm Password | Lees paub tus lej zais | 2026-11-15 | machine-drafted, needs native review |
| `confirmPasswordPlaceholder` | hmn | Re-enter your password | Sau koj tus lej zais dua ib zaug | 2026-11-15 | machine-drafted, needs native review |
| `passwordMismatch` | hmn | Passwords do not match | Ob tus lej zais tsis zoo ib yam | 2026-11-15 | machine-drafted, needs native review |
| `passwordTooShort` | hmn | Use at least 12 characters. | Siv tsawg kawg yog 12 tus ntawv. | 2026-11-15 | machine-drafted, needs native review |
| `passwordRequired` | hmn | Enter your master password. | Sau koj tus lej zais tseem ceeb. | 2026-11-15 | machine-drafted, needs native review |
| `createVault` | hmn | Create Vault | Tsim lub thawv xauv | 2026-11-15 | machine-drafted, needs native review |
| `unlock` | hmn | Unlock | Qhib | 2026-11-15 | machine-drafted, needs native review |
| `incorrectPassword` | hmn | Incorrect password | Tus lej zais tsis yog | 2026-11-15 | machine-drafted, needs native review |
| `vaultTimedOut` | hmn | Vault operation timed out. Please check your connection and try again. | Lub thawv xauv siv sij hawm ntev dhau. Thov xyuas koj qhov kev sib txuas thiab sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `vaultFailed` | hmn | We couldn’t open your vault. Please try again. | Peb qhib tsis tau koj lub thawv xauv. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `setupFailed` | hmn | We couldn’t set up your vault. Please try again. | Peb teeb tsis tau koj lub thawv xauv. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `checkingVault` | hmn | Checking your vault… | Tab tom xyuas koj lub thawv xauv… | 2026-11-15 | machine-drafted, needs native review |
| `guardUnlockToAccess` | hmn | Unlock your vault to access encrypted data. | Qhib koj lub thawv xauv kom nkag tau cov ntaub ntawv uas muab zais. | 2026-11-15 | machine-drafted, needs native review |
| `guardSetUpToStore` | hmn | Set up your vault to encrypt and store sensitive data. | Teeb koj lub thawv xauv kom muab zais thiab khaws cov ntaub ntawv rhiab. | 2026-11-15 | machine-drafted, needs native review |
| `guardLocked` | hmn | Your vault is locked. Unlock it to view encrypted data. | Koj lub thawv xauv kaw lawm. Qhib nws kom pom cov ntaub ntawv uas muab zais. | 2026-11-15 | machine-drafted, needs native review |
| `guardSetUp` | hmn | Set up your vault to access encrypted features. | Teeb koj lub thawv xauv kom siv tau cov yam ntxwv uas muab zais. | 2026-11-15 | machine-drafted, needs native review |
| `documentFallback` | hmn | Document | Ntaub ntawv | 2026-11-15 | machine-drafted, needs native review |
| `close` | hmn | Close | Kaw | 2026-11-15 | machine-drafted, needs native review |
| `loadingDocument` | hmn | Loading document… | Tab tom thauj daim ntaub ntawv… | 2026-11-15 | machine-drafted, needs native review |
| `readFailed` | hmn | We couldn’t open this file. Please try again. | Peb qhib tsis tau daim ntaub ntawv no. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `renderFailed` | hmn | We couldn’t display this PDF. | Peb qhia tsis tau daim PDF no. | 2026-11-15 | machine-drafted, needs native review |
| `downloadInstead` | hmn | Download instead | Rub tawm hloov | 2026-11-15 | machine-drafted, needs native review |
| `noPreview` | hmn | Preview not available for this file type. | Tsis muaj kev saib ua ntej rau hom ntaub ntawv no. | 2026-11-15 | machine-drafted, needs native review |
| `downloadFile` | hmn | Download File | Rub tawm daim ntaub ntawv | 2026-11-15 | machine-drafted, needs native review |
| `previousPage` | hmn | Previous page | Nplooj dhau los | 2026-11-15 | machine-drafted, needs native review |
| `nextPage` | hmn | Next page | Nplooj tom ntej | 2026-11-15 | machine-drafted, needs native review |
| `pageOf` | hmn | Page {page} of {total} | Nplooj {page} ntawm {total} | 2026-11-15 | machine-drafted, needs native review |
| `website` | hmn | Website | Vev xaib | 2026-11-15 | machine-drafted, needs native review |
| `tasksComplete` | hmn | {done}/{total} tasks complete | {done}/{total} txoj hauj lwm ua tiav lawm | 2026-11-15 | machine-drafted, needs native review |
| `communityPosts` | hmn | Community Posts | Cov lus tshaj tawm ntawm zej zog | 2026-11-15 | machine-drafted, needs native review |
| `tasks` | hmn | Tasks | Cov hauj lwm | 2026-11-15 | machine-drafted, needs native review |
| `newTask` | hmn | New task | Txoj hauj lwm tshiab | 2026-11-15 | machine-drafted, needs native review |
| `addTaskPlaceholder` | hmn | Add a task... | Ntxiv ib txoj hauj lwm... | 2026-11-15 | machine-drafted, needs native review |
| `addTask` | hmn | Add task | Ntxiv txoj hauj lwm | 2026-11-15 | machine-drafted, needs native review |
| `noTasks` | hmn | No tasks yet | Tseem tsis tau muaj hauj lwm | 2026-11-15 | machine-drafted, needs native review |
| `deleteTask` | hmn | Delete task | Rho txoj hauj lwm tawm | 2026-11-15 | machine-drafted, needs native review |
| `schedule` | hmn | Schedule | Sij hawm teem | 2026-11-15 | machine-drafted, needs native review |
| `eventTitle` | hmn | Event title | Npe ntawm kev teem caij | 2026-11-15 | machine-drafted, needs native review |
| `eventTitlePlaceholder` | hmn | Event title... | Npe ntawm kev teem caij... | 2026-11-15 | machine-drafted, needs native review |
| `eventDate` | hmn | Date | Hnub | 2026-11-15 | machine-drafted, needs native review |
| `eventTime` | hmn | Time | Sij hawm | 2026-11-15 | machine-drafted, needs native review |
| `addEvent` | hmn | Add date | Ntxiv hnub | 2026-11-15 | machine-drafted, needs native review |
| `noEvents` | hmn | No scheduled dates | Tsis muaj hnub teem tseg | 2026-11-15 | machine-drafted, needs native review |
| `deleteEvent` | hmn | Delete date | Rho hnub tawm | 2026-11-15 | machine-drafted, needs native review |
| `files` | hmn | Files | Cov ntaub ntawv | 2026-11-15 | machine-drafted, needs native review |
| `uploadingFile` | hmn | Uploading... | Tab tom xa... | 2026-11-15 | machine-drafted, needs native review |
| `chooseFileToUpload` | hmn | Choose file to upload | Xaiv ib daim ntaub ntawv los xa | 2026-11-15 | machine-drafted, needs native review |
| `noFiles` | hmn | No files attached | Tsis muaj ntaub ntawv txuas | 2026-11-15 | machine-drafted, needs native review |
| `downloadAttachment` | hmn | Download | Rub tawm | 2026-11-15 | machine-drafted, needs native review |
| `deleteAttachment` | hmn | Delete file | Rho daim ntaub ntawv tawm | 2026-11-15 | machine-drafted, needs native review |
| `notes` | hmn | Notes | Cov lus sau tseg | 2026-11-15 | machine-drafted, needs native review |
| `notesPlaceholder` | hmn | Add notes about this resource... | Ntxiv lus sau tseg txog qhov kev pab no... | 2026-11-15 | machine-drafted, needs native review |
| `notesSaved` | hmn | Saved | Khaws lawm | 2026-11-15 | machine-drafted, needs native review |
| `saveNotes` | hmn | Save Notes | Khaws cov lus sau tseg | 2026-11-15 | machine-drafted, needs native review |
| `loadingResource` | hmn | Loading resource… | Tab tom thauj qhov kev pab… | 2026-11-15 | machine-drafted, needs native review |
| `resourceNotFound` | hmn | Resource not found | Nrhiav tsis tau qhov kev pab | 2026-11-15 | machine-drafted, needs native review |
| `noPosts` | hmn | No community posts about this resource yet. | Tseem tsis tau muaj lus tshaj tawm ntawm zej zog txog qhov kev pab no. | 2026-11-15 | machine-drafted, needs native review |
| `postsTimedOut` | hmn | Posts timed out — please retry. | Cov lus tshaj tawm siv sij hawm ntev dhau. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `postsFailed` | hmn | We couldn’t load community posts. | Peb thauj tsis tau cov lus tshaj tawm ntawm zej zog. | 2026-11-15 | machine-drafted, needs native review |
| `communityMember` | hmn | Community Member | Tswv cuab hauv zej zog | 2026-11-15 | machine-drafted, needs native review |
| `detailFailed` | hmn | Something went wrong. Please try again. | Muaj ib yam tsis raug. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `annotationsSaved` | hmn | Changes saved. | Khaws cov kev hloov lawm. | 2026-11-15 | machine-drafted, needs native review |
| `pdfSaved` | hmn | PDF saved to My Documents. | Khaws daim PDF rau hauv Kuv cov ntaub ntawv lawm. | 2026-11-15 | machine-drafted, needs native review |
| `taskAdded` | hmn | Task added. | Ntxiv txoj hauj lwm lawm. | 2026-11-15 | machine-drafted, needs native review |
| `taskDeleted` | hmn | Task deleted. | Rho txoj hauj lwm tawm lawm. | 2026-11-15 | machine-drafted, needs native review |
| `eventAdded` | hmn | Date added. | Ntxiv hnub lawm. | 2026-11-15 | machine-drafted, needs native review |
| `eventDeleted` | hmn | Date deleted. | Rho hnub tawm lawm. | 2026-11-15 | machine-drafted, needs native review |
| `fileUploaded` | hmn | File uploaded. | Xa daim ntaub ntawv lawm. | 2026-11-15 | machine-drafted, needs native review |
| `fileDeleted` | hmn | File deleted. | Rho daim ntaub ntawv tawm lawm. | 2026-11-15 | machine-drafted, needs native review |
| `DOCUMENTS_FILE_COUNT.other` | ht | {n} files | {n} fichye | 2026-11-15 | machine-drafted, needs native review |
| `DOCUMENTS_FILE_COUNT.one` | so | {n} file | {n} fayl | 2026-11-15 | machine-drafted, needs native review |
| `DOCUMENTS_FILE_COUNT.other` | so | {n} files | {n} fayl | 2026-11-15 | machine-drafted, needs native review |
| `DOCUMENTS_FILE_COUNT.one` | am | {n} file | {n} ፋይል | 2026-11-15 | machine-drafted, needs native review |
| `DOCUMENTS_FILE_COUNT.other` | am | {n} files | {n} ፋይሎች | 2026-11-15 | machine-drafted, needs native review |
| `DOCUMENTS_FILE_COUNT.other` | hmn | {n} files | {n} daim ntaub ntawv | 2026-11-15 | machine-drafted, needs native review |

### `lib/i18n-errors.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `panelError` | ht | This panel encountered an error. | Panno sa a rankontre yon erè. | 2026-11-15 | machine-drafted, needs native review |
| `errorRef` | ht | Reference: {digest} | Referans: {digest} | 2026-11-15 | machine-drafted, needs native review |
| `panelError` | so | This panel encountered an error. | Guddigan wuxuu la kulmay khalad. | 2026-11-15 | machine-drafted, needs native review |
| `errorRef` | so | Reference: {digest} | Tixraac: {digest} | 2026-11-15 | machine-drafted, needs native review |
| `panelError` | am | This panel encountered an error. | ይህ ፓነል ስህተት አጋጥሞታል። | 2026-11-15 | machine-drafted, needs native review |
| `errorRef` | am | Reference: {digest} | ማጣቀሻ፦ {digest} | 2026-11-15 | machine-drafted, needs native review |
| `panelError` | hmn | This panel encountered an error. | Lub vaj huam sib luag no muaj qhov yuam kev. | 2026-11-15 | machine-drafted, needs native review |
| `errorRef` | hmn | Reference: {digest} | Tus lej siv: {digest} | 2026-11-15 | machine-drafted, needs native review |

### `lib/i18n-feed-badges.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `harmonyNew` | ht | New | Nouvo | 2026-10-11 | machine-drafted, needs native review |
| `ratingOutOf` | ht | {value} out of {max} stalks | {value} sou {max} zepi | 2026-10-11 | machine-drafted, needs native review |
| `badgeHelper` | ht | Helper | Moun k ap ede | 2026-10-11 | machine-drafted, needs native review |
| `badgeConnector` | ht | Connector | Moun k ap konekte | 2026-10-11 | machine-drafted, needs native review |
| `badgeVoice` | ht | Voice | Vwa | 2026-10-11 | machine-drafted, needs native review |
| `badgeAdvocate` | ht | Advocate | Defansè | 2026-10-11 | machine-drafted, needs native review |
| `badgeWatcher` | ht | Watcher | Veyatif | 2026-10-11 | machine-drafted, needs native review |
| `badgeAppreciated` | ht | Appreciated | Yo apresye | 2026-10-11 | machine-drafted, needs native review |
| `badgeTitle` | ht | {label} · level {level} | {label} · nivo {level} | 2026-10-11 | machine-drafted, needs native review |
| `badgeCategoryAria` | ht | {label} category badge, level {level} | Badj kategori {label}, nivo {level} | 2026-10-11 | machine-drafted, needs native review |
| `badgeCommunityAria` | ht | {label} community badge, level {level} | Badj kominote {label}, nivo {level} | 2026-10-11 | machine-drafted, needs native review |
| `levelShort` | ht | Lv {level} | Nivo {level} | 2026-10-11 | machine-drafted, needs native review |
| `badgesHeading` | ht | Community Badges | Badj kominote | 2026-10-11 | machine-drafted, needs native review |
| `badgesEmpty` | ht | No badges yet — {name} earns badges by helping, connecting, and taking part. | Poko gen badj — {name} ap genyen badj lè li ede, konekte ak patisipe. | 2026-10-11 | machine-drafted, needs native review |
| `privateHeading` | ht | Private — only you can see this | Prive — se ou sèl ki ka wè sa | 2026-10-11 | machine-drafted, needs native review |
| `privateBody` | ht | Credit for the help you receive, and for what you save and bookmark. Not shown to anyone else. | Rekonesans pou èd ou resevwa, ak pou sa ou sove epi make. Pèsonn lòt pa wè li. | 2026-10-11 | machine-drafted, needs native review |
| `itemHeart` | ht | Heart | Kè | 2026-10-11 | machine-drafted, needs native review |
| `itemSmile` | ht | Smile | Souri | 2026-10-11 | machine-drafted, needs native review |
| `itemCheer` | ht | Cheer | Bravo | 2026-10-11 | machine-drafted, needs native review |
| `itemFlower` | ht | Flower | Flè | 2026-10-11 | machine-drafted, needs native review |
| `itemSunflower` | ht | Sunflower | Flè solèy | 2026-10-11 | machine-drafted, needs native review |
| `itemLeaf` | ht | Leaf | Fèy | 2026-10-11 | machine-drafted, needs native review |
| `itemBread` | ht | Bread | Pen | 2026-10-11 | machine-drafted, needs native review |
| `itemApple` | ht | Apple | Pòm | 2026-10-11 | machine-drafted, needs native review |
| `itemSoup` | ht | Soup | Bouyon | 2026-10-11 | machine-drafted, needs native review |
| `itemSun` | ht | Sun | Solèy | 2026-10-11 | machine-drafted, needs native review |
| `itemSeedling` | ht | Seedling | Ti plant | 2026-10-11 | machine-drafted, needs native review |
| `itemTree` | ht | Tree | Pyebwa | 2026-10-11 | machine-drafted, needs native review |
| `altHeart` | ht | A heart | Yon kè | 2026-10-11 | machine-drafted, needs native review |
| `altSmile` | ht | A smiling face | Yon figi k ap souri | 2026-10-11 | machine-drafted, needs native review |
| `altCheer` | ht | Cheering hands | Men k ap bat bravo | 2026-10-11 | machine-drafted, needs native review |
| `altFlower` | ht | A flower | Yon flè | 2026-10-11 | machine-drafted, needs native review |
| `altSunflower` | ht | A sunflower | Yon flè solèy | 2026-10-11 | machine-drafted, needs native review |
| `altLeaf` | ht | A leaf | Yon fèy | 2026-10-11 | machine-drafted, needs native review |
| `altBread` | ht | A loaf of bread | Yon pen | 2026-10-11 | machine-drafted, needs native review |
| `altApple` | ht | An apple | Yon pòm | 2026-10-11 | machine-drafted, needs native review |
| `altSoup` | ht | A bowl of soup | Yon bòl bouyon | 2026-10-11 | machine-drafted, needs native review |
| `altSun` | ht | The sun | Solèy la | 2026-10-11 | machine-drafted, needs native review |
| `altSeedling` | ht | A seedling | Yon ti plant | 2026-10-11 | machine-drafted, needs native review |
| `altTree` | ht | A tree | Yon pyebwa | 2026-10-11 | machine-drafted, needs native review |
| `itemSentAria` | ht | {item} — already sent | {item} — deja voye | 2026-10-11 | machine-drafted, needs native review |
| `itemSendAria` | ht | {item} — send | {item} — voye | 2026-10-11 | machine-drafted, needs native review |
| `itemSentNotice` | ht | {item} sent. | {item} voye. | 2026-10-11 | machine-drafted, needs native review |
| `guestFollowPrompt` | ht | Create a free account to follow {name} | Kreye yon kont gratis pou w swiv {name} | 2026-10-11 | machine-drafted, needs native review |
| `appreciateHeading` | ht | Appreciate {name} | Remèsye {name} | 2026-10-11 | machine-drafted, needs native review |
| `appreciateSelf` | ht | This is you — appreciation comes from the community. | Sa se ou menm — remèsiman an soti nan kominote a. | 2026-10-11 | machine-drafted, needs native review |
| `appreciateGuestPrompt` | ht | Create a free account to send appreciation | Kreye yon kont gratis pou w voye remèsiman | 2026-10-11 | machine-drafted, needs native review |
| `sendAppreciation` | ht | Send appreciation | Voye remèsiman | 2026-10-11 | machine-drafted, needs native review |
| `errItemUnavailable` | ht | That appreciation item is not available. | Kado remèsiman sa a pa disponib. | 2026-10-11 | machine-drafted, needs native review |
| `errSendTimeout` | ht | Sending appreciation timed out — please try again. | Voye remèsiman an pran twòp tan. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errSendFailed` | ht | Couldn't send appreciation. Please try again. | Nou pa kapab voye remèsiman an. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errSentTimeout` | ht | Loading sent gifts timed out — please try again. | Chajman kado ou voye yo pran twòp tan. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errSentFailed` | ht | Couldn't load sent gifts. | Nou pa kapab chaje kado ou voye yo. | 2026-10-11 | machine-drafted, needs native review |
| `errShelfTimeout` | ht | Loading your gifts timed out — please try again. | Chajman kado ou yo pran twòp tan. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errShelfFailed` | ht | Couldn't load your gifts. | Nou pa kapab chaje kado ou yo. | 2026-10-11 | machine-drafted, needs native review |
| `giftsHeading` | ht | Gifts received | Kado ou resevwa | 2026-10-11 | machine-drafted, needs native review |
| `giftsLoading` | ht | Loading your gifts… | N ap chaje kado ou yo… | 2026-10-11 | machine-drafted, needs native review |
| `giftsEmpty` | ht | No gifts yet — appreciation from the community shows up here. | Poko gen kado — remèsiman kominote a ap parèt isit la. | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromCommunity` | ht | from the community | nan men kominote a | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromOne` | ht | from {a} | nan men {a} | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromTwo` | ht | from {a} & {b} | nan men {a} ak {b} | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromThree` | ht | from {a}, {b} & {c} | nan men {a}, {b} ak {c} | 2026-10-11 | machine-drafted, needs native review |
| `someone` | ht | Someone | Yon moun | 2026-10-11 | machine-drafted, needs native review |
| `reviewTitle` | ht | Review {name} | Evalye {name} | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescSourcer` | ht | Share your experience with this sourcer. Your rating contributes to their Harmony Score. | Pataje eksperyans ou ak moun ki ofri èd sa a. Evalyasyon ou a konte nan Nòt Amoni li. | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescSeeker` | ht | Share your experience with this seeker. Your rating contributes to their Harmony Score. | Pataje eksperyans ou ak moun ki mande èd sa a. Evalyasyon ou a konte nan Nòt Amoni li. | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescRequester` | ht | Share your experience with this requester. Your rating contributes to their Harmony Score. | Pataje eksperyans ou ak moun ki fè demann lan. Evalyasyon ou a konte nan Nòt Amoni li. | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescVolunteer` | ht | Share your experience with this volunteer. Your rating contributes to their Harmony Score. | Pataje eksperyans ou ak volontè sa a. Evalyasyon ou a konte nan Nòt Amoni li. | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescPerson` | ht | Share your experience with this person. Your rating contributes to their Harmony Score. | Pataje eksperyans ou ak moun sa a. Evalyasyon ou a konte nan Nòt Amoni li. | 2026-10-11 | machine-drafted, needs native review |
| `ratingLabel` | ht | Rating | Evalyasyon | 2026-10-11 | machine-drafted, needs native review |
| `recommendQuestion` | ht | Would you recommend this person? | Èske ou ta rekòmande moun sa a? | 2026-10-11 | machine-drafted, needs native review |
| `commentLabel` | ht | Comment | Kòmantè | 2026-10-11 | machine-drafted, needs native review |
| `commentHint` | ht | (optional, max {max} chars) | (si ou vle, {max} karaktè maksimòm) | 2026-10-11 | machine-drafted, needs native review |
| `commentPlaceholder` | ht | Describe your experience... | Dekri eksperyans ou... | 2026-10-11 | machine-drafted, needs native review |
| `submitReview` | ht | Submit Review | Voye evalyasyon an | 2026-10-11 | machine-drafted, needs native review |
| `errRatingRequired` | ht | Please select a stalk rating before submitting. | Tanpri chwazi yon evalyasyon ak zepi anvan ou voye. | 2026-10-11 | machine-drafted, needs native review |
| `errSubmitFailed` | ht | Submission failed. Please try again. | Voye a echwe. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errReviewTimeout` | ht | Review submission timed out — please check your connection and retry. | Voye evalyasyon an pran twòp tan. Tanpri verifye koneksyon ou epi eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errReviewFailed` | ht | Couldn't submit review. Please try again. | Nou pa kapab voye evalyasyon an. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `harmonyNew` | so | New | Cusub | 2026-10-11 | machine-drafted, needs native review |
| `ratingOutOf` | so | {value} out of {max} stalks | {value} ka mid ah {max} sabuul | 2026-10-11 | machine-drafted, needs native review |
| `badgeHelper` | so | Helper | Caawiye | 2026-10-11 | machine-drafted, needs native review |
| `badgeConnector` | so | Connector | Isku-xire | 2026-10-11 | machine-drafted, needs native review |
| `badgeVoice` | so | Voice | Cod | 2026-10-11 | machine-drafted, needs native review |
| `badgeAdvocate` | so | Advocate | U-doode | 2026-10-11 | machine-drafted, needs native review |
| `badgeWatcher` | so | Watcher | Ilaaliye | 2026-10-11 | machine-drafted, needs native review |
| `badgeAppreciated` | so | Appreciated | La qaddariyo | 2026-10-11 | machine-drafted, needs native review |
| `badgeTitle` | so | {label} · level {level} | {label} · heerka {level} | 2026-10-11 | machine-drafted, needs native review |
| `badgeCategoryAria` | so | {label} category badge, level {level} | Calaamadda qaybta {label}, heerka {level} | 2026-10-11 | machine-drafted, needs native review |
| `badgeCommunityAria` | so | {label} community badge, level {level} | Calaamadda bulshada {label}, heerka {level} | 2026-10-11 | machine-drafted, needs native review |
| `levelShort` | so | Lv {level} | Heer {level} | 2026-10-11 | machine-drafted, needs native review |
| `badgesHeading` | so | Community Badges | Calaamadaha bulshada | 2026-10-11 | machine-drafted, needs native review |
| `badgesEmpty` | so | No badges yet — {name} earns badges by helping, connecting, and taking part. | Weli calaamado ma jiraan — {name} wuxuu calaamado ku helaa caawinta, isku xirka iyo ka qaybgalka. | 2026-10-11 | machine-drafted, needs native review |
| `privateHeading` | so | Private — only you can see this | Gaar ah — adiga oo keliya ayaa arki kara | 2026-10-11 | machine-drafted, needs native review |
| `privateBody` | so | Credit for the help you receive, and for what you save and bookmark. Not shown to anyone else. | Abaal-marin caawimaadda aad hesho iyo waxa aad kaydiso ama calaamadiso. Cid kale looma muujiyo. | 2026-10-11 | machine-drafted, needs native review |
| `itemHeart` | so | Heart | Wadne | 2026-10-11 | machine-drafted, needs native review |
| `itemSmile` | so | Smile | Dhoolla-caddayn | 2026-10-11 | machine-drafted, needs native review |
| `itemCheer` | so | Cheer | Sacab | 2026-10-11 | machine-drafted, needs native review |
| `itemFlower` | so | Flower | Ubax | 2026-10-11 | machine-drafted, needs native review |
| `itemSunflower` | so | Sunflower | Gabbaldaye | 2026-10-11 | machine-drafted, needs native review |
| `itemLeaf` | so | Leaf | Caleen | 2026-10-11 | machine-drafted, needs native review |
| `itemBread` | so | Bread | Rooti | 2026-10-11 | machine-drafted, needs native review |
| `itemApple` | so | Apple | Tufaax | 2026-10-11 | machine-drafted, needs native review |
| `itemSoup` | so | Soup | Maraq | 2026-10-11 | machine-drafted, needs native review |
| `itemSun` | so | Sun | Qorrax | 2026-10-11 | machine-drafted, needs native review |
| `itemSeedling` | so | Seedling | Geed yar | 2026-10-11 | machine-drafted, needs native review |
| `itemTree` | so | Tree | Geed | 2026-10-11 | machine-drafted, needs native review |
| `altHeart` | so | A heart | Wadne | 2026-10-11 | machine-drafted, needs native review |
| `altSmile` | so | A smiling face | Weji dhoolla-caddaynaya | 2026-10-11 | machine-drafted, needs native review |
| `altCheer` | so | Cheering hands | Gacmo sacbinaya | 2026-10-11 | machine-drafted, needs native review |
| `altFlower` | so | A flower | Ubax | 2026-10-11 | machine-drafted, needs native review |
| `altSunflower` | so | A sunflower | Gabbaldaye | 2026-10-11 | machine-drafted, needs native review |
| `altLeaf` | so | A leaf | Caleen | 2026-10-11 | machine-drafted, needs native review |
| `altBread` | so | A loaf of bread | Xabbad rooti ah | 2026-10-11 | machine-drafted, needs native review |
| `altApple` | so | An apple | Tufaax | 2026-10-11 | machine-drafted, needs native review |
| `altSoup` | so | A bowl of soup | Baaquli maraq ah | 2026-10-11 | machine-drafted, needs native review |
| `altSun` | so | The sun | Qorraxda | 2026-10-11 | machine-drafted, needs native review |
| `altSeedling` | so | A seedling | Geed yar | 2026-10-11 | machine-drafted, needs native review |
| `altTree` | so | A tree | Geed | 2026-10-11 | machine-drafted, needs native review |
| `itemSentAria` | so | {item} — already sent | {item} — hore loo diray | 2026-10-11 | machine-drafted, needs native review |
| `itemSendAria` | so | {item} — send | {item} — dir | 2026-10-11 | machine-drafted, needs native review |
| `itemSentNotice` | so | {item} sent. | {item} waa la diray. | 2026-10-11 | machine-drafted, needs native review |
| `guestFollowPrompt` | so | Create a free account to follow {name} | Samee akoon bilaash ah si aad u raacdo {name} | 2026-10-11 | machine-drafted, needs native review |
| `appreciateHeading` | so | Appreciate {name} | U mahadceli {name} | 2026-10-11 | machine-drafted, needs native review |
| `appreciateSelf` | so | This is you — appreciation comes from the community. | Kani waa adiga — mahadcelintu waxay ka timaaddaa bulshada. | 2026-10-11 | machine-drafted, needs native review |
| `appreciateGuestPrompt` | so | Create a free account to send appreciation | Samee akoon bilaash ah si aad mahadcelin u dirto | 2026-10-11 | machine-drafted, needs native review |
| `sendAppreciation` | so | Send appreciation | Dir mahadcelin | 2026-10-11 | machine-drafted, needs native review |
| `errItemUnavailable` | so | That appreciation item is not available. | Hadiyaddaas mahadcelinta lama heli karo. | 2026-10-11 | machine-drafted, needs native review |
| `errSendTimeout` | so | Sending appreciation timed out — please try again. | Dirista mahadcelintu way daahday. Fadlan mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `errSendFailed` | so | Couldn't send appreciation. Please try again. | Mahadcelinta lama diri karin. Fadlan mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `errSentTimeout` | so | Loading sent gifts timed out — please try again. | Soo dejinta hadiyadaha la diray way daahday. Fadlan mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `errSentFailed` | so | Couldn't load sent gifts. | Hadiyadaha la diray lama soo dejin karin. | 2026-10-11 | machine-drafted, needs native review |
| `errShelfTimeout` | so | Loading your gifts timed out — please try again. | Soo dejinta hadiyadahaaga way daahday. Fadlan mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `errShelfFailed` | so | Couldn't load your gifts. | Hadiyadahaaga lama soo dejin karin. | 2026-10-11 | machine-drafted, needs native review |
| `giftsHeading` | so | Gifts received | Hadiyadaha la helay | 2026-10-11 | machine-drafted, needs native review |
| `giftsLoading` | so | Loading your gifts… | Hadiyadahaaga waa la soo shubayaa… | 2026-10-11 | machine-drafted, needs native review |
| `giftsEmpty` | so | No gifts yet — appreciation from the community shows up here. | Weli hadiyado ma jiraan — mahadcelinta bulshada halkan ayay ka soo muuqataa. | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromCommunity` | so | from the community | ka timid bulshada | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromOne` | so | from {a} | ka timid {a} | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromTwo` | so | from {a} & {b} | ka timid {a} iyo {b} | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromThree` | so | from {a}, {b} & {c} | ka timid {a}, {b} iyo {c} | 2026-10-11 | machine-drafted, needs native review |
| `someone` | so | Someone | Qof | 2026-10-11 | machine-drafted, needs native review |
| `reviewTitle` | so | Review {name} | Qiimee {name} | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescSourcer` | so | Share your experience with this sourcer. Your rating contributes to their Harmony Score. | La wadaag waayo-aragnimadaada bixiyahan. Qiimayntaadu waxay qayb ka noqotaa Dhibcaha Wada-noolaanshaha ee qofkan. | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescSeeker` | so | Share your experience with this seeker. Your rating contributes to their Harmony Score. | La wadaag waayo-aragnimadaada codsadahan. Qiimayntaadu waxay qayb ka noqotaa Dhibcaha Wada-noolaanshaha ee qofkan. | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescRequester` | so | Share your experience with this requester. Your rating contributes to their Harmony Score. | La wadaag waayo-aragnimadaada qofka codsiga soo diray. Qiimayntaadu waxay qayb ka noqotaa Dhibcaha Wada-noolaanshaha ee qofkan. | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescVolunteer` | so | Share your experience with this volunteer. Your rating contributes to their Harmony Score. | La wadaag waayo-aragnimadaada tabaruc-hahan. Qiimayntaadu waxay qayb ka noqotaa Dhibcaha Wada-noolaanshaha ee qofkan. | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescPerson` | so | Share your experience with this person. Your rating contributes to their Harmony Score. | La wadaag waayo-aragnimadaada qofkan. Qiimayntaadu waxay qayb ka noqotaa Dhibcaha Wada-noolaanshaha ee qofkan. | 2026-10-11 | machine-drafted, needs native review |
| `ratingLabel` | so | Rating | Qiimayn | 2026-10-11 | machine-drafted, needs native review |
| `recommendQuestion` | so | Would you recommend this person? | Ma ku talin lahayd qofkan? | 2026-10-11 | machine-drafted, needs native review |
| `commentLabel` | so | Comment | Faallo | 2026-10-11 | machine-drafted, needs native review |
| `commentHint` | so | (optional, max {max} chars) | (ikhtiyaari, ugu badnaan {max} xaraf) | 2026-10-11 | machine-drafted, needs native review |
| `commentPlaceholder` | so | Describe your experience... | Sharax waayo-aragnimadaada... | 2026-10-11 | machine-drafted, needs native review |
| `submitReview` | so | Submit Review | Dir qiimaynta | 2026-10-11 | machine-drafted, needs native review |
| `errRatingRequired` | so | Please select a stalk rating before submitting. | Fadlan dooro qiimayn sabuul ka hor intaadan dirin. | 2026-10-11 | machine-drafted, needs native review |
| `errSubmitFailed` | so | Submission failed. Please try again. | Diristu way fashilantay. Fadlan mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `errReviewTimeout` | so | Review submission timed out — please check your connection and retry. | Dirista qiimayntu way daahday. Fadlan hubi xiriirkaaga oo mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `errReviewFailed` | so | Couldn't submit review. Please try again. | Qiimaynta lama diri karin. Fadlan mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `harmonyNew` | am | New | አዲስ | 2026-10-11 | machine-drafted, needs native review |
| `ratingOutOf` | am | {value} out of {max} stalks | {value} ከ{max} ዛላ | 2026-10-11 | machine-drafted, needs native review |
| `badgeHelper` | am | Helper | ረዳት | 2026-10-11 | machine-drafted, needs native review |
| `badgeConnector` | am | Connector | አገናኝ | 2026-10-11 | machine-drafted, needs native review |
| `badgeVoice` | am | Voice | ድምፅ | 2026-10-11 | machine-drafted, needs native review |
| `badgeAdvocate` | am | Advocate | ተሟጋች | 2026-10-11 | machine-drafted, needs native review |
| `badgeWatcher` | am | Watcher | ጠባቂ | 2026-10-11 | machine-drafted, needs native review |
| `badgeAppreciated` | am | Appreciated | የተመሰገነ | 2026-10-11 | machine-drafted, needs native review |
| `badgeTitle` | am | {label} · level {level} | {label} · ደረጃ {level} | 2026-10-11 | machine-drafted, needs native review |
| `badgeCategoryAria` | am | {label} category badge, level {level} | የ{label} ምድብ ባጅ፣ ደረጃ {level} | 2026-10-11 | machine-drafted, needs native review |
| `badgeCommunityAria` | am | {label} community badge, level {level} | የ{label} የማኅበረሰብ ባጅ፣ ደረጃ {level} | 2026-10-11 | machine-drafted, needs native review |
| `levelShort` | am | Lv {level} | ደረጃ {level} | 2026-10-11 | machine-drafted, needs native review |
| `badgesHeading` | am | Community Badges | የማኅበረሰብ ባጆች | 2026-10-11 | machine-drafted, needs native review |
| `badgesEmpty` | am | No badges yet — {name} earns badges by helping, connecting, and taking part. | እስካሁን ባጅ የለም — {name} በመርዳት፣ በማገናኘት እና በመሳተፍ ባጆችን ያገኛል። | 2026-10-11 | machine-drafted, needs native review |
| `privateHeading` | am | Private — only you can see this | የግል — እርስዎ ብቻ ነዎት የሚያዩት | 2026-10-11 | machine-drafted, needs native review |
| `privateBody` | am | Credit for the help you receive, and for what you save and bookmark. Not shown to anyone else. | ለሚያገኙት እርዳታ እና ለሚያስቀምጡትና ዕልባት ለሚያደርጉት ዕውቅና። ለሌላ ለማንም አይታይም። | 2026-10-11 | machine-drafted, needs native review |
| `itemHeart` | am | Heart | ልብ | 2026-10-11 | machine-drafted, needs native review |
| `itemSmile` | am | Smile | ፈገግታ | 2026-10-11 | machine-drafted, needs native review |
| `itemCheer` | am | Cheer | ማበረታቻ | 2026-10-11 | machine-drafted, needs native review |
| `itemFlower` | am | Flower | አበባ | 2026-10-11 | machine-drafted, needs native review |
| `itemSunflower` | am | Sunflower | የሱፍ አበባ | 2026-10-11 | machine-drafted, needs native review |
| `itemLeaf` | am | Leaf | ቅጠል | 2026-10-11 | machine-drafted, needs native review |
| `itemBread` | am | Bread | ዳቦ | 2026-10-11 | machine-drafted, needs native review |
| `itemApple` | am | Apple | ፖም | 2026-10-11 | machine-drafted, needs native review |
| `itemSoup` | am | Soup | ሾርባ | 2026-10-11 | machine-drafted, needs native review |
| `itemSun` | am | Sun | ፀሐይ | 2026-10-11 | machine-drafted, needs native review |
| `itemSeedling` | am | Seedling | ችግኝ | 2026-10-11 | machine-drafted, needs native review |
| `itemTree` | am | Tree | ዛፍ | 2026-10-11 | machine-drafted, needs native review |
| `altHeart` | am | A heart | አንድ ልብ | 2026-10-11 | machine-drafted, needs native review |
| `altSmile` | am | A smiling face | ፈገግ ያለ ፊት | 2026-10-11 | machine-drafted, needs native review |
| `altCheer` | am | Cheering hands | የሚያጨበጭቡ እጆች | 2026-10-11 | machine-drafted, needs native review |
| `altFlower` | am | A flower | አንድ አበባ | 2026-10-11 | machine-drafted, needs native review |
| `altSunflower` | am | A sunflower | አንድ የሱፍ አበባ | 2026-10-11 | machine-drafted, needs native review |
| `altLeaf` | am | A leaf | አንድ ቅጠል | 2026-10-11 | machine-drafted, needs native review |
| `altBread` | am | A loaf of bread | አንድ ዳቦ | 2026-10-11 | machine-drafted, needs native review |
| `altApple` | am | An apple | አንድ ፖም | 2026-10-11 | machine-drafted, needs native review |
| `altSoup` | am | A bowl of soup | አንድ ሳህን ሾርባ | 2026-10-11 | machine-drafted, needs native review |
| `altSun` | am | The sun | ፀሐይ | 2026-10-11 | machine-drafted, needs native review |
| `altSeedling` | am | A seedling | አንድ ችግኝ | 2026-10-11 | machine-drafted, needs native review |
| `altTree` | am | A tree | አንድ ዛፍ | 2026-10-11 | machine-drafted, needs native review |
| `itemSentAria` | am | {item} — already sent | {item} — አስቀድሞ ተልኳል | 2026-10-11 | machine-drafted, needs native review |
| `itemSendAria` | am | {item} — send | {item} — ላክ | 2026-10-11 | machine-drafted, needs native review |
| `itemSentNotice` | am | {item} sent. | {item} ተልኳል። | 2026-10-11 | machine-drafted, needs native review |
| `guestFollowPrompt` | am | Create a free account to follow {name} | {name}ን ለመከተል ነፃ መለያ ይፍጠሩ | 2026-10-11 | machine-drafted, needs native review |
| `appreciateHeading` | am | Appreciate {name} | {name}ን አመስግኑ | 2026-10-11 | machine-drafted, needs native review |
| `appreciateSelf` | am | This is you — appreciation comes from the community. | ይህ እርስዎ ነዎት — ምስጋና የሚመጣው ከማኅበረሰቡ ነው። | 2026-10-11 | machine-drafted, needs native review |
| `appreciateGuestPrompt` | am | Create a free account to send appreciation | ምስጋና ለመላክ ነፃ መለያ ይፍጠሩ | 2026-10-11 | machine-drafted, needs native review |
| `sendAppreciation` | am | Send appreciation | ምስጋና ላክ | 2026-10-11 | machine-drafted, needs native review |
| `errItemUnavailable` | am | That appreciation item is not available. | ያ የምስጋና ስጦታ አይገኝም። | 2026-10-11 | machine-drafted, needs native review |
| `errSendTimeout` | am | Sending appreciation timed out — please try again. | ምስጋና መላክ ጊዜ ወሰደ። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errSendFailed` | am | Couldn't send appreciation. Please try again. | ምስጋና መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errSentTimeout` | am | Loading sent gifts timed out — please try again. | የተላኩ ስጦታዎችን መጫን ጊዜ ወሰደ። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errSentFailed` | am | Couldn't load sent gifts. | የተላኩ ስጦታዎችን መጫን አልተቻለም። | 2026-10-11 | machine-drafted, needs native review |
| `errShelfTimeout` | am | Loading your gifts timed out — please try again. | ስጦታዎችዎን መጫን ጊዜ ወሰደ። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errShelfFailed` | am | Couldn't load your gifts. | ስጦታዎችዎን መጫን አልተቻለም። | 2026-10-11 | machine-drafted, needs native review |
| `giftsHeading` | am | Gifts received | የተቀበሏቸው ስጦታዎች | 2026-10-11 | machine-drafted, needs native review |
| `giftsLoading` | am | Loading your gifts… | ስጦታዎችዎን በመጫን ላይ… | 2026-10-11 | machine-drafted, needs native review |
| `giftsEmpty` | am | No gifts yet — appreciation from the community shows up here. | እስካሁን ስጦታ የለም — የማኅበረሰቡ ምስጋና እዚህ ይታያል። | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromCommunity` | am | from the community | ከማኅበረሰቡ | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromOne` | am | from {a} | ከ{a} | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromTwo` | am | from {a} & {b} | ከ{a} እና {b} | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromThree` | am | from {a}, {b} & {c} | ከ{a}፣ {b} እና {c} | 2026-10-11 | machine-drafted, needs native review |
| `someone` | am | Someone | አንድ ሰው | 2026-10-11 | machine-drafted, needs native review |
| `reviewTitle` | am | Review {name} | {name}ን ይገምግሙ | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescSourcer` | am | Share your experience with this sourcer. Your rating contributes to their Harmony Score. | ከዚህ አቅራቢ ጋር ያለዎትን ተሞክሮ ያካፍሉ። የእርስዎ ደረጃ ወደ ስምምነት ነጥባቸው ይታከላል። | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescSeeker` | am | Share your experience with this seeker. Your rating contributes to their Harmony Score. | ከዚህ ጠያቂ ጋር ያለዎትን ተሞክሮ ያካፍሉ። የእርስዎ ደረጃ ወደ ስምምነት ነጥባቸው ይታከላል። | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescRequester` | am | Share your experience with this requester. Your rating contributes to their Harmony Score. | ጥያቄውን ከላከው ሰው ጋር ያለዎትን ተሞክሮ ያካፍሉ። የእርስዎ ደረጃ ወደ ስምምነት ነጥባቸው ይታከላል። | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescVolunteer` | am | Share your experience with this volunteer. Your rating contributes to their Harmony Score. | ከዚህ በጎ ፈቃደኛ ጋር ያለዎትን ተሞክሮ ያካፍሉ። የእርስዎ ደረጃ ወደ ስምምነት ነጥባቸው ይታከላል። | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescPerson` | am | Share your experience with this person. Your rating contributes to their Harmony Score. | ከዚህ ሰው ጋር ያለዎትን ተሞክሮ ያካፍሉ። የእርስዎ ደረጃ ወደ ስምምነት ነጥባቸው ይታከላል። | 2026-10-11 | machine-drafted, needs native review |
| `ratingLabel` | am | Rating | ደረጃ | 2026-10-11 | machine-drafted, needs native review |
| `recommendQuestion` | am | Would you recommend this person? | ይህን ሰው ይመክራሉ? | 2026-10-11 | machine-drafted, needs native review |
| `commentLabel` | am | Comment | አስተያየት | 2026-10-11 | machine-drafted, needs native review |
| `commentHint` | am | (optional, max {max} chars) | (አማራጭ፣ ቢበዛ {max} ፊደላት) | 2026-10-11 | machine-drafted, needs native review |
| `commentPlaceholder` | am | Describe your experience... | ተሞክሮዎን ይግለጹ... | 2026-10-11 | machine-drafted, needs native review |
| `submitReview` | am | Submit Review | ግምገማ አስገባ | 2026-10-11 | machine-drafted, needs native review |
| `errRatingRequired` | am | Please select a stalk rating before submitting. | ከማስገባትዎ በፊት እባክዎ የዛላ ደረጃ ይምረጡ። | 2026-10-11 | machine-drafted, needs native review |
| `errSubmitFailed` | am | Submission failed. Please try again. | ማስገባት አልተሳካም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errReviewTimeout` | am | Review submission timed out — please check your connection and retry. | ግምገማ ማስገባት ጊዜ ወሰደ። እባክዎ ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errReviewFailed` | am | Couldn't submit review. Please try again. | ግምገማ ማስገባት አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `harmonyNew` | hmn | New | Tshiab | 2026-10-11 | machine-drafted, needs native review |
| `ratingOutOf` | hmn | {value} out of {max} stalks | {value} ntawm {max} tus nplej | 2026-10-11 | machine-drafted, needs native review |
| `badgeHelper` | hmn | Helper | Tus pab | 2026-10-11 | machine-drafted, needs native review |
| `badgeConnector` | hmn | Connector | Tus txuas | 2026-10-11 | machine-drafted, needs native review |
| `badgeVoice` | hmn | Voice | Lub suab | 2026-10-11 | machine-drafted, needs native review |
| `badgeAdvocate` | hmn | Advocate | Tus tawm tswv yim | 2026-10-11 | machine-drafted, needs native review |
| `badgeWatcher` | hmn | Watcher | Tus saib xyuas | 2026-10-11 | machine-drafted, needs native review |
| `badgeAppreciated` | hmn | Appreciated | Tau txais kev ris txiaj | 2026-10-11 | machine-drafted, needs native review |
| `badgeTitle` | hmn | {label} · level {level} | {label} · theem {level} | 2026-10-11 | machine-drafted, needs native review |
| `badgeCategoryAria` | hmn | {label} category badge, level {level} | Daim paib pawg {label}, theem {level} | 2026-10-11 | machine-drafted, needs native review |
| `badgeCommunityAria` | hmn | {label} community badge, level {level} | Daim paib zej zog {label}, theem {level} | 2026-10-11 | machine-drafted, needs native review |
| `levelShort` | hmn | Lv {level} | Theem {level} | 2026-10-11 | machine-drafted, needs native review |
| `badgesHeading` | hmn | Community Badges | Cov paib zej zog | 2026-10-11 | machine-drafted, needs native review |
| `badgesEmpty` | hmn | No badges yet — {name} earns badges by helping, connecting, and taking part. | Tseem tsis tau muaj paib — {name} tau paib los ntawm kev pab, kev txuas, thiab kev koom tes. | 2026-10-11 | machine-drafted, needs native review |
| `privateHeading` | hmn | Private — only you can see this | Ntiag tug — koj tib leeg thiaj pom tau | 2026-10-11 | machine-drafted, needs native review |
| `privateBody` | hmn | Credit for the help you receive, and for what you save and bookmark. Not shown to anyone else. | Kev lees paub rau kev pab uas koj tau txais, thiab rau yam koj khaws thiab cim tseg. Tsis qhia rau lwm tus. | 2026-10-11 | machine-drafted, needs native review |
| `itemHeart` | hmn | Heart | Lub plawv | 2026-10-11 | machine-drafted, needs native review |
| `itemSmile` | hmn | Smile | Luag ntxhi | 2026-10-11 | machine-drafted, needs native review |
| `itemCheer` | hmn | Cheer | Qhuas | 2026-10-11 | machine-drafted, needs native review |
| `itemFlower` | hmn | Flower | Paj | 2026-10-11 | machine-drafted, needs native review |
| `itemSunflower` | hmn | Sunflower | Paj noob hnub | 2026-10-11 | machine-drafted, needs native review |
| `itemLeaf` | hmn | Leaf | Nplooj | 2026-10-11 | machine-drafted, needs native review |
| `itemBread` | hmn | Bread | Ncuav | 2026-10-11 | machine-drafted, needs native review |
| `itemApple` | hmn | Apple | Txiv apple | 2026-10-11 | machine-drafted, needs native review |
| `itemSoup` | hmn | Soup | Kua zaub | 2026-10-11 | machine-drafted, needs native review |
| `itemSun` | hmn | Sun | Lub hnub | 2026-10-11 | machine-drafted, needs native review |
| `itemSeedling` | hmn | Seedling | Yub ntoo | 2026-10-11 | machine-drafted, needs native review |
| `itemTree` | hmn | Tree | Ntoo | 2026-10-11 | machine-drafted, needs native review |
| `altHeart` | hmn | A heart | Ib lub plawv | 2026-10-11 | machine-drafted, needs native review |
| `altSmile` | hmn | A smiling face | Ib lub ntsej muag luag ntxhi | 2026-10-11 | machine-drafted, needs native review |
| `altCheer` | hmn | Cheering hands | Ob txhais tes npuaj | 2026-10-11 | machine-drafted, needs native review |
| `altFlower` | hmn | A flower | Ib lub paj | 2026-10-11 | machine-drafted, needs native review |
| `altSunflower` | hmn | A sunflower | Ib lub paj noob hnub | 2026-10-11 | machine-drafted, needs native review |
| `altLeaf` | hmn | A leaf | Ib daim nplooj | 2026-10-11 | machine-drafted, needs native review |
| `altBread` | hmn | A loaf of bread | Ib lub ncuav | 2026-10-11 | machine-drafted, needs native review |
| `altApple` | hmn | An apple | Ib lub txiv apple | 2026-10-11 | machine-drafted, needs native review |
| `altSoup` | hmn | A bowl of soup | Ib tais kua zaub | 2026-10-11 | machine-drafted, needs native review |
| `altSun` | hmn | The sun | Lub hnub | 2026-10-11 | machine-drafted, needs native review |
| `altSeedling` | hmn | A seedling | Ib tsob yub ntoo | 2026-10-11 | machine-drafted, needs native review |
| `altTree` | hmn | A tree | Ib tsob ntoo | 2026-10-11 | machine-drafted, needs native review |
| `itemSentAria` | hmn | {item} — already sent | {item} — twb xa lawm | 2026-10-11 | machine-drafted, needs native review |
| `itemSendAria` | hmn | {item} — send | {item} — xa | 2026-10-11 | machine-drafted, needs native review |
| `itemSentNotice` | hmn | {item} sent. | Xa {item} lawm. | 2026-10-11 | machine-drafted, needs native review |
| `guestFollowPrompt` | hmn | Create a free account to follow {name} | Tsim ib tus account dawb los raws {name} | 2026-10-11 | machine-drafted, needs native review |
| `appreciateHeading` | hmn | Appreciate {name} | Ua tsaug rau {name} | 2026-10-11 | machine-drafted, needs native review |
| `appreciateSelf` | hmn | This is you — appreciation comes from the community. | Qhov no yog koj — kev ris txiaj los ntawm zej zog. | 2026-10-11 | machine-drafted, needs native review |
| `appreciateGuestPrompt` | hmn | Create a free account to send appreciation | Tsim ib tus account dawb los xa kev ris txiaj | 2026-10-11 | machine-drafted, needs native review |
| `sendAppreciation` | hmn | Send appreciation | Xa kev ris txiaj | 2026-10-11 | machine-drafted, needs native review |
| `errItemUnavailable` | hmn | That appreciation item is not available. | Qhov khoom plig ris txiaj ntawd tsis muaj. | 2026-10-11 | machine-drafted, needs native review |
| `errSendTimeout` | hmn | Sending appreciation timed out — please try again. | Kev xa kev ris txiaj siv sijhawm ntev dhau. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errSendFailed` | hmn | Couldn't send appreciation. Please try again. | Xa tsis tau kev ris txiaj. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errSentTimeout` | hmn | Loading sent gifts timed out — please try again. | Kev thauj cov khoom plig uas xa lawm siv sijhawm ntev dhau. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errSentFailed` | hmn | Couldn't load sent gifts. | Thauj tsis tau cov khoom plig uas xa lawm. | 2026-10-11 | machine-drafted, needs native review |
| `errShelfTimeout` | hmn | Loading your gifts timed out — please try again. | Kev thauj koj cov khoom plig siv sijhawm ntev dhau. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errShelfFailed` | hmn | Couldn't load your gifts. | Thauj tsis tau koj cov khoom plig. | 2026-10-11 | machine-drafted, needs native review |
| `giftsHeading` | hmn | Gifts received | Cov khoom plig tau txais | 2026-10-11 | machine-drafted, needs native review |
| `giftsLoading` | hmn | Loading your gifts… | Tab tom thauj koj cov khoom plig… | 2026-10-11 | machine-drafted, needs native review |
| `giftsEmpty` | hmn | No gifts yet — appreciation from the community shows up here. | Tseem tsis tau muaj khoom plig — kev ris txiaj los ntawm zej zog yuav tshwm ntawm no. | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromCommunity` | hmn | from the community | los ntawm zej zog | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromOne` | hmn | from {a} | los ntawm {a} | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromTwo` | hmn | from {a} & {b} | los ntawm {a} thiab {b} | 2026-10-11 | machine-drafted, needs native review |
| `giftsFromThree` | hmn | from {a}, {b} & {c} | los ntawm {a}, {b}, thiab {c} | 2026-10-11 | machine-drafted, needs native review |
| `someone` | hmn | Someone | Ib tug neeg | 2026-10-11 | machine-drafted, needs native review |
| `reviewTitle` | hmn | Review {name} | Ntsuam xyuas {name} | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescSourcer` | hmn | Share your experience with this sourcer. Your rating contributes to their Harmony Score. | Qhia koj qhov kev paub dhau los nrog tus neeg muab no. Koj qhov kev ntsuas yuav suav rau nws tus Qhab Nia Sib Haum. | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescSeeker` | hmn | Share your experience with this seeker. Your rating contributes to their Harmony Score. | Qhia koj qhov kev paub dhau los nrog tus neeg thov no. Koj qhov kev ntsuas yuav suav rau nws tus Qhab Nia Sib Haum. | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescRequester` | hmn | Share your experience with this requester. Your rating contributes to their Harmony Score. | Qhia koj qhov kev paub dhau los nrog tus neeg xa qhov kev thov no. Koj qhov kev ntsuas yuav suav rau nws tus Qhab Nia Sib Haum. | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescVolunteer` | hmn | Share your experience with this volunteer. Your rating contributes to their Harmony Score. | Qhia koj qhov kev paub dhau los nrog tus neeg pab dawb no. Koj qhov kev ntsuas yuav suav rau nws tus Qhab Nia Sib Haum. | 2026-10-11 | machine-drafted, needs native review |
| `reviewDescPerson` | hmn | Share your experience with this person. Your rating contributes to their Harmony Score. | Qhia koj qhov kev paub dhau los nrog tus neeg no. Koj qhov kev ntsuas yuav suav rau nws tus Qhab Nia Sib Haum. | 2026-10-11 | machine-drafted, needs native review |
| `ratingLabel` | hmn | Rating | Kev ntsuas | 2026-10-11 | machine-drafted, needs native review |
| `recommendQuestion` | hmn | Would you recommend this person? | Koj puas xav pom zoo tus neeg no? | 2026-10-11 | machine-drafted, needs native review |
| `commentLabel` | hmn | Comment | Lus tawm tswv yim | 2026-10-11 | machine-drafted, needs native review |
| `commentHint` | hmn | (optional, max {max} chars) | (xaiv tau, ntau tshaj {max} tus ntawv) | 2026-10-11 | machine-drafted, needs native review |
| `commentPlaceholder` | hmn | Describe your experience... | Piav koj qhov kev paub dhau los... | 2026-10-11 | machine-drafted, needs native review |
| `submitReview` | hmn | Submit Review | Xa kev ntsuam xyuas | 2026-10-11 | machine-drafted, needs native review |
| `errRatingRequired` | hmn | Please select a stalk rating before submitting. | Thov xaiv ib qho kev ntsuas ua ntej xa. | 2026-10-11 | machine-drafted, needs native review |
| `errSubmitFailed` | hmn | Submission failed. Please try again. | Xa tsis tau. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errReviewTimeout` | hmn | Review submission timed out — please check your connection and retry. | Kev xa kev ntsuam xyuas siv sijhawm ntev dhau. Thov xyuas koj txoj kev txuas thiab sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errReviewFailed` | hmn | Couldn't submit review. Please try again. | Xa tsis tau kev ntsuam xyuas. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `REVIEW_COUNT.other` | ht | {count} reviews | {count} evalyasyon | 2026-10-11 | machine-drafted, needs native review |
| `REVIEW_COUNT.other` | so | {count} reviews | {count} qiimayn | 2026-10-11 | machine-drafted, needs native review |
| `REVIEW_COUNT.one` | am | {count} review | {count} ግምገማ | 2026-10-11 | machine-drafted, needs native review |
| `REVIEW_COUNT.other` | am | {count} reviews | {count} ግምገማዎች | 2026-10-11 | machine-drafted, needs native review |
| `REVIEW_COUNT.other` | hmn | {count} reviews | {count} qhov kev ntsuam xyuas | 2026-10-11 | machine-drafted, needs native review |
| `STALKS.other` | ht | {n} stalks | {n} zepi | 2026-10-11 | machine-drafted, needs native review |
| `STALKS.other` | so | {n} stalks | {n} sabuul | 2026-10-11 | machine-drafted, needs native review |
| `STALKS.one` | am | {n} stalk | {n} ዛላ | 2026-10-11 | machine-drafted, needs native review |
| `STALKS.other` | am | {n} stalks | {n} ዛላዎች | 2026-10-11 | machine-drafted, needs native review |
| `STALKS.other` | hmn | {n} stalks | {n} tus nplej | 2026-10-11 | machine-drafted, needs native review |
| `BADGE_CATEGORY_POINTS.other` | ht | {label} category badge, level {level}, {count} points earned | Badj kategori {label}, nivo {level}, {count} pwen genyen | 2026-10-11 | machine-drafted, needs native review |
| `BADGE_CATEGORY_POINTS.other` | so | {label} category badge, level {level}, {count} points earned | Calaamadda qaybta {label}, heerka {level}, {count} dhibcood la helay | 2026-10-11 | machine-drafted, needs native review |
| `BADGE_CATEGORY_POINTS.one` | am | {label} category badge, level {level}, {count} point earned | የ{label} ምድብ ባጅ፣ ደረጃ {level}፣ {count} ነጥብ ተገኝቷል | 2026-10-11 | machine-drafted, needs native review |
| `BADGE_CATEGORY_POINTS.other` | am | {label} category badge, level {level}, {count} points earned | የ{label} ምድብ ባጅ፣ ደረጃ {level}፣ {count} ነጥቦች ተገኝተዋል | 2026-10-11 | machine-drafted, needs native review |
| `BADGE_CATEGORY_POINTS.other` | hmn | {label} category badge, level {level}, {count} points earned | Daim paib pawg {label}, theem {level}, tau {count} qhab nia | 2026-10-11 | machine-drafted, needs native review |
| `BADGE_COMMUNITY_POINTS.other` | ht | {label} community badge, level {level}, {count} points earned | Badj kominote {label}, nivo {level}, {count} pwen genyen | 2026-10-11 | machine-drafted, needs native review |
| `BADGE_COMMUNITY_POINTS.other` | so | {label} community badge, level {level}, {count} points earned | Calaamadda bulshada {label}, heerka {level}, {count} dhibcood la helay | 2026-10-11 | machine-drafted, needs native review |
| `BADGE_COMMUNITY_POINTS.one` | am | {label} community badge, level {level}, {count} point earned | የ{label} የማኅበረሰብ ባጅ፣ ደረጃ {level}፣ {count} ነጥብ ተገኝቷል | 2026-10-11 | machine-drafted, needs native review |
| `BADGE_COMMUNITY_POINTS.other` | am | {label} community badge, level {level}, {count} points earned | የ{label} የማኅበረሰብ ባጅ፣ ደረጃ {level}፣ {count} ነጥቦች ተገኝተዋል | 2026-10-11 | machine-drafted, needs native review |
| `BADGE_COMMUNITY_POINTS.other` | hmn | {label} community badge, level {level}, {count} points earned | Daim paib zej zog {label}, theem {level}, tau {count} qhab nia | 2026-10-11 | machine-drafted, needs native review |
| `GIFTS_FROM_MORE.other` | ht | from {a}, {b} & {n} others | nan men {a}, {b} ak {n} lòt moun | 2026-10-11 | machine-drafted, needs native review |
| `GIFTS_FROM_MORE.other` | so | from {a}, {b} & {n} others | ka timid {a}, {b} iyo {n} kale | 2026-10-11 | machine-drafted, needs native review |
| `GIFTS_FROM_MORE.one` | am | from {a}, {b} & {n} other | ከ{a}፣ {b} እና {n} ሌላ ሰው | 2026-10-11 | machine-drafted, needs native review |
| `GIFTS_FROM_MORE.other` | am | from {a}, {b} & {n} others | ከ{a}፣ {b} እና {n} ሌሎች ሰዎች | 2026-10-11 | machine-drafted, needs native review |
| `GIFTS_FROM_MORE.other` | hmn | from {a}, {b} & {n} others | los ntawm {a}, {b}, thiab {n} tus ntxiv | 2026-10-11 | machine-drafted, needs native review |

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

### `lib/i18n-feed-follows.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `errLoadTimeout` | ht | Follows data timed out — please check your connection and retry. | Chajman moun w ap swiv yo pran twòp tan. Tanpri verifye koneksyon ou epi eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errLoadFailed` | ht | Couldn't load follows. Please try again. | Nou pa kapab chaje moun w ap swiv yo. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToFollow` | ht | You must be signed in to follow someone. | Ou dwe konekte pou w swiv yon moun. | 2026-10-11 | machine-drafted, needs native review |
| `errFollowFailed` | ht | Couldn't follow. Please try again. | Nou pa kapab swiv moun sa a. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToUnfollow` | ht | You must be signed in to unfollow someone. | Ou dwe konekte pou w sispann swiv yon moun. | 2026-10-11 | machine-drafted, needs native review |
| `errUnfollowFailed` | ht | Couldn't unfollow. Please try again. | Nou pa kapab sispann swiv moun sa a. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errLoadTimeout` | so | Follows data timed out — please check your connection and retry. | Soo dejinta dadka aad raacdo way daahday. Fadlan hubi xiriirkaaga oo mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `errLoadFailed` | so | Couldn't load follows. Please try again. | Lama soo dejin karin dadka aad raacdo. Fadlan mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToFollow` | so | You must be signed in to follow someone. | Waa inaad soo gashaa si aad qof u raacdo. | 2026-10-11 | machine-drafted, needs native review |
| `errFollowFailed` | so | Couldn't follow. Please try again. | Lama raaci karin. Fadlan mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToUnfollow` | so | You must be signed in to unfollow someone. | Waa inaad soo gashaa si aad qof uga hartid raacitaankiisa. | 2026-10-11 | machine-drafted, needs native review |
| `errUnfollowFailed` | so | Couldn't unfollow. Please try again. | Raacitaanka lama joojin karin. Fadlan mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `errLoadTimeout` | am | Follows data timed out — please check your connection and retry. | የሚከተሏቸውን መጫን ጊዜ ወሰደ። እባክዎ ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errLoadFailed` | am | Couldn't load follows. Please try again. | የሚከተሏቸውን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToFollow` | am | You must be signed in to follow someone. | ሰውን ለመከተል መግባት አለብዎት። | 2026-10-11 | machine-drafted, needs native review |
| `errFollowFailed` | am | Couldn't follow. Please try again. | መከተል አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToUnfollow` | am | You must be signed in to unfollow someone. | መከተል ለማቆም መግባት አለብዎት። | 2026-10-11 | machine-drafted, needs native review |
| `errUnfollowFailed` | am | Couldn't unfollow. Please try again. | መከተል ማቆም አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errLoadTimeout` | hmn | Follows data timed out — please check your connection and retry. | Kev thauj cov neeg koj raws siv sijhawm ntev dhau. Thov xyuas koj txoj kev txuas thiab sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errLoadFailed` | hmn | Couldn't load follows. Please try again. | Thauj tsis tau cov neeg koj raws. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToFollow` | hmn | You must be signed in to follow someone. | Koj yuav tsum nkag mus ua ntej thiaj raws tau ib tug neeg. | 2026-10-11 | machine-drafted, needs native review |
| `errFollowFailed` | hmn | Couldn't follow. Please try again. | Raws tsis tau. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToUnfollow` | hmn | You must be signed in to unfollow someone. | Koj yuav tsum nkag mus ua ntej thiaj tso tseg raws tau ib tug neeg. | 2026-10-11 | machine-drafted, needs native review |
| `errUnfollowFailed` | hmn | Couldn't unfollow. Please try again. | Tso tseg raws tsis tau. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |

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
| `announceReviewSubmitted` | ht | Your review was submitted. | Evalyasyon ou an voye. | 2026-10-11 | machine-drafted, needs native review |
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
| `announceDeclined` | ht | Request declined. | Demann lan refize. | 2026-10-11 | machine-drafted, needs native review |
| `announceWithdrawn` | ht | Request withdrawn. | Demann lan retire. | 2026-10-11 | machine-drafted, needs native review |
| `announceEnded` | ht | Conversation ended. | Konvèsasyon an fini. | 2026-10-11 | machine-drafted, needs native review |
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
| `announceReviewSubmitted` | so | Your review was submitted. | Qiimayntaada waa la diray. | 2026-10-11 | machine-drafted, needs native review |
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
| `announceDeclined` | so | Request declined. | Codsiga waa la diiday. | 2026-10-11 | machine-drafted, needs native review |
| `announceWithdrawn` | so | Request withdrawn. | Codsiga waa laga noqday. | 2026-10-11 | machine-drafted, needs native review |
| `announceEnded` | so | Conversation ended. | Wada hadalka waa la dhammeeyay. | 2026-10-11 | machine-drafted, needs native review |
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
| `announceReviewSubmitted` | am | Your review was submitted. | ግምገማዎ ተልኳል። | 2026-10-11 | machine-drafted, needs native review |
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
| `announceDeclined` | am | Request declined. | ጥያቄው ተቀባይነት አላገኘም። | 2026-10-11 | machine-drafted, needs native review |
| `announceWithdrawn` | am | Request withdrawn. | ጥያቄው ተነስቷል። | 2026-10-11 | machine-drafted, needs native review |
| `announceEnded` | am | Conversation ended. | ውይይቱ ተጠናቋል። | 2026-10-11 | machine-drafted, needs native review |
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
| `announceReviewSubmitted` | hmn | Your review was submitted. | Koj qhov kev ntsuam xyuas raug xa lawm. | 2026-10-11 | machine-drafted, needs native review |
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
| `announceDeclined` | hmn | Request declined. | Tsis txais qhov kev thov lawm. | 2026-10-11 | machine-drafted, needs native review |
| `announceWithdrawn` | hmn | Request withdrawn. | Thim qhov kev thov lawm. | 2026-10-11 | machine-drafted, needs native review |
| `announceEnded` | hmn | Conversation ended. | Kev sib tham xaus lawm. | 2026-10-11 | machine-drafted, needs native review |

### `lib/i18n-feed-optins.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `optIn` | ht | Opt In | Enskri | 2026-10-11 | machine-drafted, needs native review |
| `optedIn` | ht | Opted In | Ou enskri | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | ht | Withdraw | Retire | 2026-10-11 | machine-drafted, needs native review |
| `full` | ht | Full | Plen | 2026-10-11 | machine-drafted, needs native review |
| `statusPending` | ht | pending | ann atant | 2026-10-11 | machine-drafted, needs native review |
| `statusAccepted` | ht | accepted | aksepte | 2026-10-11 | machine-drafted, needs native review |
| `statusDeclined` | ht | declined | refize | 2026-10-11 | machine-drafted, needs native review |
| `statusCompleted` | ht | completed | fini | 2026-10-11 | machine-drafted, needs native review |
| `declinedBefore` | ht | Declined before | Refize deja | 2026-10-11 | machine-drafted, needs native review |
| `declinedBeforeTitle` | ht | You have declined this person before | Ou te deja refize moun sa a | 2026-10-11 | machine-drafted, needs native review |
| `unblock` | ht | Unblock — they can request again | Debloke — li ka mande ankò | 2026-10-11 | machine-drafted, needs native review |
| `accept` | ht | Accept | Aksepte | 2026-10-11 | machine-drafted, needs native review |
| `decline` | ht | Decline | Refize | 2026-10-11 | machine-drafted, needs native review |
| `markCompleted` | ht | Mark Completed | Make kòm fini | 2026-10-11 | machine-drafted, needs native review |
| `reviewSeeker` | ht | Review seeker | Evalye moun ki mande a | 2026-10-11 | machine-drafted, needs native review |
| `reviewSourcer` | ht | Review sourcer | Evalye moun ki ofri a | 2026-10-11 | machine-drafted, needs native review |
| `actionForPersonAria` | ht | {action}: {name} | {action}: {name} | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | ht | Create a free account to opt in. | Kreye yon kont gratis pou w enskri. | 2026-10-11 | machine-drafted, needs native review |
| `errOptInFailed` | ht | Couldn't opt in. Please try again. | Nou pa kapab enskri w. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawFailed` | ht | Couldn't withdraw opt-in. Please try again. | Nou pa kapab retire enskripsyon ou. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errOfferFull` | ht | This offer is full | Òf sa a plen | 2026-10-11 | machine-drafted, needs native review |
| `errPostClosed` | ht | This post is closed | Piblikasyon sa a fèmen | 2026-10-11 | machine-drafted, needs native review |
| `errOwnPost` | ht | You cannot opt in to your own post | Ou pa ka enskri nan pwòp piblikasyon ou | 2026-10-11 | machine-drafted, needs native review |
| `errAlreadyOptedIn` | ht | Already opted in | Ou deja enskri | 2026-10-11 | machine-drafted, needs native review |
| `changedMeanwhile` | ht | This request had already changed. It now shows where it stands. | Demann sa a te deja chanje. Kounye a li montre kote li ye. | 2026-10-11 | machine-drafted, needs native review |
| `announceOptedIn` | ht | You are opted in. | Ou enskri. | 2026-10-11 | machine-drafted, needs native review |
| `announceWithdrawn` | ht | Your opt-in was withdrawn. | Ou retire enskripsyon ou. | 2026-10-11 | machine-drafted, needs native review |
| `announceAccepted` | ht | You accepted {name}. | Ou aksepte {name}. | 2026-10-11 | machine-drafted, needs native review |
| `announceDeclined` | ht | You declined {name}. | Ou refize {name}. | 2026-10-11 | machine-drafted, needs native review |
| `announceCompleted` | ht | Marked completed for {name}. | Make kòm fini pou {name}. | 2026-10-11 | machine-drafted, needs native review |
| `announceUnblocked` | ht | {name} unblocked. They can request again. | Ou debloke {name}. Li ka mande ankò. | 2026-10-11 | machine-drafted, needs native review |
| `announceListStale` | ht | The sign-up list could not be refreshed. | Nou pa t kapab mete lis moun ki enskri yo ajou. | 2026-10-11 | machine-drafted, needs native review |
| `optIn` | so | Opt In | Isu qor | 2026-10-11 | machine-drafted, needs native review |
| `optedIn` | so | Opted In | Waad is qortay | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | so | Withdraw | Ka noqo | 2026-10-11 | machine-drafted, needs native review |
| `full` | so | Full | Buuxa | 2026-10-11 | machine-drafted, needs native review |
| `statusPending` | so | pending | la sugayo | 2026-10-11 | machine-drafted, needs native review |
| `statusAccepted` | so | accepted | la aqbalay | 2026-10-11 | machine-drafted, needs native review |
| `statusDeclined` | so | declined | la diiday | 2026-10-11 | machine-drafted, needs native review |
| `statusCompleted` | so | completed | la dhammeeyay | 2026-10-11 | machine-drafted, needs native review |
| `declinedBefore` | so | Declined before | Hore loo diiday | 2026-10-11 | machine-drafted, needs native review |
| `declinedBeforeTitle` | so | You have declined this person before | Qofkan hore ayaad u diiday | 2026-10-11 | machine-drafted, needs native review |
| `unblock` | so | Unblock — they can request again | Ka qaad xannibaadda — mar kale ayuu codsan karaa | 2026-10-11 | machine-drafted, needs native review |
| `accept` | so | Accept | Aqbal | 2026-10-11 | machine-drafted, needs native review |
| `decline` | so | Decline | Diid | 2026-10-11 | machine-drafted, needs native review |
| `markCompleted` | so | Mark Completed | Calaamadee in la dhammeeyay | 2026-10-11 | machine-drafted, needs native review |
| `reviewSeeker` | so | Review seeker | Qiimee codsadaha | 2026-10-11 | machine-drafted, needs native review |
| `reviewSourcer` | so | Review sourcer | Qiimee bixiyaha | 2026-10-11 | machine-drafted, needs native review |
| `actionForPersonAria` | so | {action}: {name} | {action}: {name} | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | so | Create a free account to opt in. | Samee akoon bilaash ah si aad isu qorto. | 2026-10-11 | machine-drafted, needs native review |
| `errOptInFailed` | so | Couldn't opt in. Please try again. | Lama is qori karin. Fadlan mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawFailed` | so | Couldn't withdraw opt-in. Please try again. | Is-qoristaada lagama noqon karin. Fadlan mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `errOfferFull` | so | This offer is full | Deeqdani way buuxdaa | 2026-10-11 | machine-drafted, needs native review |
| `errPostClosed` | so | This post is closed | Qoraalkani wuu xiran yahay | 2026-10-11 | machine-drafted, needs native review |
| `errOwnPost` | so | You cannot opt in to your own post | Iskuma qori kartid qoraalkaaga | 2026-10-11 | machine-drafted, needs native review |
| `errAlreadyOptedIn` | so | Already opted in | Hore ayaad isu qortay | 2026-10-11 | machine-drafted, needs native review |
| `changedMeanwhile` | so | This request had already changed. It now shows where it stands. | Codsigan horey wuu isbeddelay. Hadda wuxuu muujinayaa xaaladdiisa. | 2026-10-11 | machine-drafted, needs native review |
| `announceOptedIn` | so | You are opted in. | Waad is qortay. | 2026-10-11 | machine-drafted, needs native review |
| `announceWithdrawn` | so | Your opt-in was withdrawn. | Is-qoristaadii waad ka noqotay. | 2026-10-11 | machine-drafted, needs native review |
| `announceAccepted` | so | You accepted {name}. | {name} waa la aqbalay. | 2026-10-11 | machine-drafted, needs native review |
| `announceDeclined` | so | You declined {name}. | {name} waa la diiday. | 2026-10-11 | machine-drafted, needs native review |
| `announceCompleted` | so | Marked completed for {name}. | Waxaa loo calaamadeeyay in la dhammeeyay: {name}. | 2026-10-11 | machine-drafted, needs native review |
| `announceUnblocked` | so | {name} unblocked. They can request again. | {name} xannibaaddii waa laga qaaday. Mar kale ayuu codsan karaa. | 2026-10-11 | machine-drafted, needs native review |
| `announceListStale` | so | The sign-up list could not be refreshed. | Liiska dadka is qoray lama cusboonaysiin karin. | 2026-10-11 | machine-drafted, needs native review |
| `optIn` | am | Opt In | ተመዝገብ | 2026-10-11 | machine-drafted, needs native review |
| `optedIn` | am | Opted In | ተመዝግበዋል | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | am | Withdraw | አንሳ | 2026-10-11 | machine-drafted, needs native review |
| `full` | am | Full | ሞልቷል | 2026-10-11 | machine-drafted, needs native review |
| `statusPending` | am | pending | በመጠባበቅ ላይ | 2026-10-11 | machine-drafted, needs native review |
| `statusAccepted` | am | accepted | ተቀባይነት አግኝቷል | 2026-10-11 | machine-drafted, needs native review |
| `statusDeclined` | am | declined | ተቀባይነት አላገኘም | 2026-10-11 | machine-drafted, needs native review |
| `statusCompleted` | am | completed | ተጠናቋል | 2026-10-11 | machine-drafted, needs native review |
| `declinedBefore` | am | Declined before | ከዚህ በፊት ውድቅ ተደርጓል | 2026-10-11 | machine-drafted, needs native review |
| `declinedBeforeTitle` | am | You have declined this person before | ይህን ሰው ከዚህ በፊት አልተቀበሉትም | 2026-10-11 | machine-drafted, needs native review |
| `unblock` | am | Unblock — they can request again | እገዳውን አንሳ — እንደገና መጠየቅ ይችላል | 2026-10-11 | machine-drafted, needs native review |
| `accept` | am | Accept | ተቀበል | 2026-10-11 | machine-drafted, needs native review |
| `decline` | am | Decline | አትቀበል | 2026-10-11 | machine-drafted, needs native review |
| `markCompleted` | am | Mark Completed | እንደተጠናቀቀ ምልክት አድርግ | 2026-10-11 | machine-drafted, needs native review |
| `reviewSeeker` | am | Review seeker | ጠያቂውን ገምግም | 2026-10-11 | machine-drafted, needs native review |
| `reviewSourcer` | am | Review sourcer | አቅራቢውን ገምግም | 2026-10-11 | machine-drafted, needs native review |
| `actionForPersonAria` | am | {action}: {name} | {action}: {name} | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | am | Create a free account to opt in. | ለመመዝገብ ነፃ መለያ ይፍጠሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errOptInFailed` | am | Couldn't opt in. Please try again. | መመዝገብ አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawFailed` | am | Couldn't withdraw opt-in. Please try again. | ምዝገባዎን ማንሳት አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errOfferFull` | am | This offer is full | ይህ አቅርቦት ሞልቷል | 2026-10-11 | machine-drafted, needs native review |
| `errPostClosed` | am | This post is closed | ይህ ልጥፍ ተዘግቷል | 2026-10-11 | machine-drafted, needs native review |
| `errOwnPost` | am | You cannot opt in to your own post | በራስዎ ልጥፍ ላይ መመዝገብ አይችሉም | 2026-10-11 | machine-drafted, needs native review |
| `errAlreadyOptedIn` | am | Already opted in | አስቀድመው ተመዝግበዋል | 2026-10-11 | machine-drafted, needs native review |
| `changedMeanwhile` | am | This request had already changed. It now shows where it stands. | ይህ ጥያቄ አስቀድሞ ተቀይሯል። አሁን ያለበትን ሁኔታ ያሳያል። | 2026-10-11 | machine-drafted, needs native review |
| `announceOptedIn` | am | You are opted in. | ተመዝግበዋል። | 2026-10-11 | machine-drafted, needs native review |
| `announceWithdrawn` | am | Your opt-in was withdrawn. | ምዝገባዎ ተነስቷል። | 2026-10-11 | machine-drafted, needs native review |
| `announceAccepted` | am | You accepted {name}. | {name} ተቀባይነት አግኝቷል። | 2026-10-11 | machine-drafted, needs native review |
| `announceDeclined` | am | You declined {name}. | {name} ተቀባይነት አላገኘም። | 2026-10-11 | machine-drafted, needs native review |
| `announceCompleted` | am | Marked completed for {name}. | ለ{name} እንደተጠናቀቀ ምልክት ተደርጓል። | 2026-10-11 | machine-drafted, needs native review |
| `announceUnblocked` | am | {name} unblocked. They can request again. | የ{name} እገዳ ተነስቷል። እንደገና መጠየቅ ይችላል። | 2026-10-11 | machine-drafted, needs native review |
| `announceListStale` | am | The sign-up list could not be refreshed. | የተመዝጋቢዎችን ዝርዝር ማደስ አልተቻለም። | 2026-10-11 | machine-drafted, needs native review |
| `optIn` | hmn | Opt In | Sau npe | 2026-10-11 | machine-drafted, needs native review |
| `optedIn` | hmn | Opted In | Sau npe lawm | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | hmn | Withdraw | Thim | 2026-10-11 | machine-drafted, needs native review |
| `full` | hmn | Full | Puv lawm | 2026-10-11 | machine-drafted, needs native review |
| `statusPending` | hmn | pending | tab tom tos | 2026-10-11 | machine-drafted, needs native review |
| `statusAccepted` | hmn | accepted | txais lawm | 2026-10-11 | machine-drafted, needs native review |
| `statusDeclined` | hmn | declined | tsis txais | 2026-10-11 | machine-drafted, needs native review |
| `statusCompleted` | hmn | completed | tiav lawm | 2026-10-11 | machine-drafted, needs native review |
| `declinedBefore` | hmn | Declined before | Tsis txais ua ntej lawm | 2026-10-11 | machine-drafted, needs native review |
| `declinedBeforeTitle` | hmn | You have declined this person before | Koj twb tsis txais tus neeg no ua ntej lawm | 2026-10-11 | machine-drafted, needs native review |
| `unblock` | hmn | Unblock — they can request again | Tshem kev thaiv — nws thov tau dua | 2026-10-11 | machine-drafted, needs native review |
| `accept` | hmn | Accept | Txais | 2026-10-11 | machine-drafted, needs native review |
| `decline` | hmn | Decline | Tsis txais | 2026-10-11 | machine-drafted, needs native review |
| `markCompleted` | hmn | Mark Completed | Kos tias tiav lawm | 2026-10-11 | machine-drafted, needs native review |
| `reviewSeeker` | hmn | Review seeker | Ntsuam xyuas tus neeg thov | 2026-10-11 | machine-drafted, needs native review |
| `reviewSourcer` | hmn | Review sourcer | Ntsuam xyuas tus neeg muab | 2026-10-11 | machine-drafted, needs native review |
| `actionForPersonAria` | hmn | {action}: {name} | {action}: {name} | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | hmn | Create a free account to opt in. | Tsim ib tus account dawb los sau npe. | 2026-10-11 | machine-drafted, needs native review |
| `errOptInFailed` | hmn | Couldn't opt in. Please try again. | Sau npe tsis tau. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawFailed` | hmn | Couldn't withdraw opt-in. Please try again. | Thim kev sau npe tsis tau. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errOfferFull` | hmn | This offer is full | Qhov kev muab no puv lawm | 2026-10-11 | machine-drafted, needs native review |
| `errPostClosed` | hmn | This post is closed | Qhov tshaj tawm no kaw lawm | 2026-10-11 | machine-drafted, needs native review |
| `errOwnPost` | hmn | You cannot opt in to your own post | Koj sau npe rau koj tus kheej qhov tshaj tawm tsis tau | 2026-10-11 | machine-drafted, needs native review |
| `errAlreadyOptedIn` | hmn | Already opted in | Koj twb sau npe lawm | 2026-10-11 | machine-drafted, needs native review |
| `changedMeanwhile` | hmn | This request had already changed. It now shows where it stands. | Daim ntawv thov no twb hloov lawm. Tam sim no nws qhia tias nws nyob li cas. | 2026-10-11 | machine-drafted, needs native review |
| `announceOptedIn` | hmn | You are opted in. | Koj sau npe lawm. | 2026-10-11 | machine-drafted, needs native review |
| `announceWithdrawn` | hmn | Your opt-in was withdrawn. | Koj thim kev sau npe lawm. | 2026-10-11 | machine-drafted, needs native review |
| `announceAccepted` | hmn | You accepted {name}. | Txais {name} lawm. | 2026-10-11 | machine-drafted, needs native review |
| `announceDeclined` | hmn | You declined {name}. | Tsis txais {name} lawm. | 2026-10-11 | machine-drafted, needs native review |
| `announceCompleted` | hmn | Marked completed for {name}. | Kos tias tiav lawm rau {name}. | 2026-10-11 | machine-drafted, needs native review |
| `announceUnblocked` | hmn | {name} unblocked. They can request again. | Tshem kev thaiv {name} lawm. Nws thov tau dua. | 2026-10-11 | machine-drafted, needs native review |
| `announceListStale` | hmn | The sign-up list could not be refreshed. | Rov thauj daim ntawv teev cov neeg sau npe tsis tau. | 2026-10-11 | machine-drafted, needs native review |
| `SPOTS_LEFT.other` | ht | {left} of {max} spots left | {left} sou {max} plas ki rete | 2026-10-11 | machine-drafted, needs native review |
| `SPOTS_LEFT.other` | so | {left} of {max} spots left | {left} ka mid ah {max} boos ayaa haray | 2026-10-11 | machine-drafted, needs native review |
| `SPOTS_LEFT.one` | am | {left} of {max} spot left | {left} ከ{max} ቦታ ቀርቷል | 2026-10-11 | machine-drafted, needs native review |
| `SPOTS_LEFT.other` | am | {left} of {max} spots left | {left} ከ{max} ቦታዎች ቀርተዋል | 2026-10-11 | machine-drafted, needs native review |
| `SPOTS_LEFT.other` | hmn | {left} of {max} spots left | Tshuav {left} ntawm {max} qhov chaw | 2026-10-11 | machine-drafted, needs native review |
| `OPTED_IN_COUNT.other` | ht | {count} opted in | {count} moun enskri | 2026-10-11 | machine-drafted, needs native review |
| `OPTED_IN_COUNT.other` | so | {count} opted in | {count} qof ayaa is qoray | 2026-10-11 | machine-drafted, needs native review |
| `OPTED_IN_COUNT.one` | am | {count} opted in | {count} ሰው ተመዝግቧል | 2026-10-11 | machine-drafted, needs native review |
| `OPTED_IN_COUNT.other` | am | {count} opted in | {count} ሰዎች ተመዝግበዋል | 2026-10-11 | machine-drafted, needs native review |
| `OPTED_IN_COUNT.other` | hmn | {count} opted in | {count} tus neeg sau npe lawm | 2026-10-11 | machine-drafted, needs native review |

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
| `embedLabel` | ht | Petition | Petisyon | 2026-10-11 | machine-drafted, needs native review |
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
| `embedLabel` | so | Petition | Codsi | 2026-10-11 | machine-drafted, needs native review |
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
| `embedLabel` | am | Petition | አቤቱታ | 2026-10-11 | machine-drafted, needs native review |
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
| `embedLabel` | hmn | Petition | Ntawv thov | 2026-10-11 | machine-drafted, needs native review |
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

### `lib/i18n-feed-photo.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `label` | ht | Photo (optional) | Foto (si ou vle) | 2026-10-11 | machine-drafted, needs native review |
| `previewAlt` | ht | Selected photo preview | Apèsi foto ou chwazi a | 2026-10-11 | machine-drafted, needs native review |
| `uploading` | ht | Uploading… | N ap telechaje… | 2026-10-11 | machine-drafted, needs native review |
| `add` | ht | Add a photo | Ajoute yon foto | 2026-10-11 | machine-drafted, needs native review |
| `errUploadFailed` | ht | Upload failed. Please try again. | Telechajman an echwe. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errUnsupported` | ht | That file is not a supported image. | Fichye sa a pa yon imaj nou aksepte. | 2026-10-11 | machine-drafted, needs native review |
| `errProcess` | ht | Could not process that image. Please try another. | Nou pa kapab trete imaj sa a. Tanpri eseye yon lòt. | 2026-10-11 | machine-drafted, needs native review |
| `errTooLarge` | ht | Image exceeds the {mb}MB limit. | Imaj la depase limit {mb} MB la. | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | ht | Create a free account to attach a photo. | Kreye yon kont gratis pou w ajoute yon foto. | 2026-10-11 | machine-drafted, needs native review |
| `label` | so | Photo (optional) | Sawir (ikhtiyaari) | 2026-10-11 | machine-drafted, needs native review |
| `previewAlt` | so | Selected photo preview | Horudhaca sawirka la doortay | 2026-10-11 | machine-drafted, needs native review |
| `uploading` | so | Uploading… | Waa la soo gelinayaa… | 2026-10-11 | machine-drafted, needs native review |
| `add` | so | Add a photo | Ku dar sawir | 2026-10-11 | machine-drafted, needs native review |
| `errUploadFailed` | so | Upload failed. Please try again. | Soo gelintu way fashilantay. Fadlan mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `errUnsupported` | so | That file is not a supported image. | Faylkaasi ma aha sawir la taageero. | 2026-10-11 | machine-drafted, needs native review |
| `errProcess` | so | Could not process that image. Please try another. | Sawirkaas lama farsamayn karin. Fadlan mid kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `errTooLarge` | so | Image exceeds the {mb}MB limit. | Sawirku wuu ka weyn yahay xadka {mb} MB. | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | so | Create a free account to attach a photo. | Samee akoon bilaash ah si aad sawir ugu lifaaqdo. | 2026-10-11 | machine-drafted, needs native review |
| `label` | am | Photo (optional) | ፎቶ (አማራጭ) | 2026-10-11 | machine-drafted, needs native review |
| `previewAlt` | am | Selected photo preview | የተመረጠው ፎቶ ቅድመ እይታ | 2026-10-11 | machine-drafted, needs native review |
| `uploading` | am | Uploading… | በመስቀል ላይ… | 2026-10-11 | machine-drafted, needs native review |
| `add` | am | Add a photo | ፎቶ አክል | 2026-10-11 | machine-drafted, needs native review |
| `errUploadFailed` | am | Upload failed. Please try again. | መስቀል አልተሳካም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errUnsupported` | am | That file is not a supported image. | ያ ፋይል የሚደገፍ ምስል አይደለም። | 2026-10-11 | machine-drafted, needs native review |
| `errProcess` | am | Could not process that image. Please try another. | ያንን ምስል ማስኬድ አልተቻለም። እባክዎ ሌላ ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errTooLarge` | am | Image exceeds the {mb}MB limit. | ምስሉ ከ{mb} ሜባ ገደብ ይበልጣል። | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | am | Create a free account to attach a photo. | ፎቶ ለማያያዝ ነፃ መለያ ይፍጠሩ። | 2026-10-11 | machine-drafted, needs native review |
| `label` | hmn | Photo (optional) | Duab (xaiv tau) | 2026-10-11 | machine-drafted, needs native review |
| `previewAlt` | hmn | Selected photo preview | Saib ua ntej daim duab uas xaiv | 2026-10-11 | machine-drafted, needs native review |
| `uploading` | hmn | Uploading… | Tab tom xa… | 2026-10-11 | machine-drafted, needs native review |
| `add` | hmn | Add a photo | Ntxiv ib daim duab | 2026-10-11 | machine-drafted, needs native review |
| `errUploadFailed` | hmn | Upload failed. Please try again. | Xa tsis tau. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errUnsupported` | hmn | That file is not a supported image. | Cov ntaub ntawv ntawd tsis yog ib daim duab uas siv tau. | 2026-10-11 | machine-drafted, needs native review |
| `errProcess` | hmn | Could not process that image. Please try another. | Ua tsis tau daim duab ntawd. Thov sim lwm daim. | 2026-10-11 | machine-drafted, needs native review |
| `errTooLarge` | hmn | Image exceeds the {mb}MB limit. | Daim duab loj tshaj qhov txwv {mb} MB. | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | hmn | Create a free account to attach a photo. | Tsim ib tus account dawb los txuas ib daim duab. | 2026-10-11 | machine-drafted, needs native review |

### `lib/i18n-forms.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `title` | ht | Forms & Applications | Fòmilè ak demann | 2026-11-15 | machine-drafted, needs native review |
| `subtitle` | ht | Apply for benefits, assistance programs, and community resources. | Fè demann pou benefis, pwogram asistans ak resous kominote. | 2026-11-15 | machine-drafted, needs native review |
| `fillPdf` | ht | Fill PDF Form | Ranpli yon fòmilè PDF | 2026-11-15 | machine-drafted, needs native review |
| `sectionsLabel` | ht | Forms sections | Seksyon fòmilè yo | 2026-11-15 | machine-drafted, needs native review |
| `tabAvailable` | ht | Available Forms | Fòmilè ki disponib | 2026-11-15 | machine-drafted, needs native review |
| `tabInProgress` | ht | In Progress | An kou | 2026-11-15 | machine-drafted, needs native review |
| `tabSubmitted` | ht | Submitted | Voye | 2026-11-15 | machine-drafted, needs native review |
| `estMinutes` | ht | Est. {m} min | Anviwon {m} min | 2026-11-15 | machine-drafted, needs native review |
| `estHours` | ht | Est. {h} h | Anviwon {h} è | 2026-11-15 | machine-drafted, needs native review |
| `estHoursMinutes` | ht | Est. {h} h {m} min | Anviwon {h} è {m} min | 2026-11-15 | machine-drafted, needs native review |
| `requiredDocs` | ht | Required Documents: | Dokiman ou bezwen: | 2026-11-15 | machine-drafted, needs native review |
| `startApplication` | ht | Start Application | Kòmanse demann lan | 2026-11-15 | machine-drafted, needs native review |
| `lastSaved` | ht | Last saved {when} | Dènye fwa sere {when} | 2026-11-15 | machine-drafted, needs native review |
| `progress` | ht | Progress | Pwogrè | 2026-11-15 | machine-drafted, needs native review |
| `continue` | ht | Continue | Kontinye | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraft` | ht | Delete draft | Efase bouyon an | 2026-11-15 | machine-drafted, needs native review |
| `submittedOn` | ht | Submitted {date} | Voye {date} | 2026-11-15 | machine-drafted, needs native review |
| `viewSubmission` | ht | View Submission | Gade sa ou voye a | 2026-11-15 | machine-drafted, needs native review |
| `catBenefits` | ht | Benefits | Benefis | 2026-11-15 | machine-drafted, needs native review |
| `catVeteran` | ht | Veterans | Ansyen konbatan | 2026-11-15 | machine-drafted, needs native review |
| `catDisability` | ht | Disability | Andikap | 2026-11-15 | machine-drafted, needs native review |
| `statusPending` | ht | Pending | Ap tann | 2026-11-15 | machine-drafted, needs native review |
| `statusUnderReview` | ht | Under Review | Ap egzamine | 2026-11-15 | machine-drafted, needs native review |
| `statusApproved` | ht | Approved | Apwouve | 2026-11-15 | machine-drafted, needs native review |
| `statusDenied` | ht | Denied | Refize | 2026-11-15 | machine-drafted, needs native review |
| `statusNeedsInfo` | ht | Needs Info | Bezwen enfòmasyon | 2026-11-15 | machine-drafted, needs native review |
| `formNumber` | ht | Form {number} | Fòmilè {number} | 2026-11-15 | machine-drafted, needs native review |
| `fillAnnotate` | ht | Fill & Annotate | Ranpli epi make | 2026-11-15 | machine-drafted, needs native review |
| `openAgencySite` | ht | Open on Agency Site | Louvri sou sit ajans lan | 2026-11-15 | machine-drafted, needs native review |
| `opensNewTab` | ht | (opens in a new tab) | (louvri nan yon nouvo onglè) | 2026-11-15 | machine-drafted, needs native review |
| `guestGovForms` | ht | Create a free account to fill and save government forms to your encrypted vault | Kreye yon kont gratis pou ranpli epi sere fòmilè gouvènman nan kòf chifre ou | 2026-11-15 | machine-drafted, needs native review |
| `guestWizard` | ht | Create a free account to fill out and submit assistance applications | Kreye yon kont gratis pou ranpli epi voye demann asistans | 2026-11-15 | machine-drafted, needs native review |
| `backToForms` | ht | Back to forms | Retounen nan fòmilè yo | 2026-11-15 | machine-drafted, needs native review |
| `pdfSaveFailed` | ht | We couldn’t save this PDF. Please try again. | Nou pa t ka sere PDF sa a. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `submissionFallback` | ht | Submission | Sa ou voye | 2026-11-15 | machine-drafted, needs native review |
| `back` | ht | Back | Retounen | 2026-11-15 | machine-drafted, needs native review |
| `statusLabel` | ht | Status: | Estati: | 2026-11-15 | machine-drafted, needs native review |
| `submittedLabel` | ht | Submitted: | Voye: | 2026-11-15 | machine-drafted, needs native review |
| `submissionNotFound` | ht | Submission not found. | Pa jwenn sa ou voye a. | 2026-11-15 | machine-drafted, needs native review |
| `checking` | ht | Checking available forms… (a few seconds) | N ap chèche fòmilè ki disponib… (kèk segonn) | 2026-11-15 | machine-drafted, needs native review |
| `loadFailed` | ht | Failed to load forms | Nou pa t ka chaje fòmilè yo | 2026-11-15 | machine-drafted, needs native review |
| `loadFailedBody` | ht | We couldn’t load the forms. Please try again. | Nou pa t ka chaje fòmilè yo. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `tryAgain` | ht | Try Again | Eseye ankò | 2026-11-15 | machine-drafted, needs native review |
| `noForms` | ht | No Forms Available | Pa gen fòmilè disponib | 2026-11-15 | machine-drafted, needs native review |
| `noFormsBody` | ht | No application forms are set up yet. The AI Assistant can help you find benefit programs and walk you through what you need. | Poko gen fòmilè demann ki pare. Asistan AI a ka ede w jwenn pwogram benefis epi gide w nan sa ou bezwen. | 2026-11-15 | machine-drafted, needs native review |
| `askAssistant` | ht | Ask the Assistant | Mande Asistan an | 2026-11-15 | machine-drafted, needs native review |
| `govTitle` | ht | Government Forms | Fòmilè gouvènman | 2026-11-15 | machine-drafted, needs native review |
| `govBody` | ht | Official federal benefit forms — fill and annotate in-app, then save to your Documents. | Fòmilè ofisyèl federal pou benefis — ranpli epi make yo nan aplikasyon an, epi sere yo nan Dokiman ou yo. | 2026-11-15 | machine-drafted, needs native review |
| `govLoadFailed` | ht | Could not load {form}. Please try again. | Nou pa t ka chaje {form}. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `noInProgress` | ht | No Forms In Progress | Pa gen fòmilè an kou | 2026-11-15 | machine-drafted, needs native review |
| `noInProgressBody` | ht | Start a new application from the {tab} tab. | Kòmanse yon nouvo demann nan onglè {tab}. | 2026-11-15 | machine-drafted, needs native review |
| `noSubmissions` | ht | No Submissions Yet | Poko voye anyen | 2026-11-15 | machine-drafted, needs native review |
| `noSubmissionsBody` | ht | Complete and submit an application to see it here. | Ranpli epi voye yon demann pou w wè l isit la. | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraftTitle` | ht | Delete this draft? | Efase bouyon sa a? | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraftBody` | ht | This cannot be undone. Your progress will be permanently removed. | Ou pa ka defèt sa. Pwogrè ou ap efase pou tout tan. | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | ht | Cancel | Anile | 2026-11-15 | machine-drafted, needs native review |
| `close` | ht | Close | Fèmen | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraftConfirm` | ht | Delete Draft | Efase bouyon an | 2026-11-15 | machine-drafted, needs native review |
| `draftDeleted` | ht | Draft deleted. | Bouyon an efase. | 2026-11-15 | machine-drafted, needs native review |
| `draftDeleteFailed` | ht | We couldn’t delete this draft. Please try again. | Nou pa t ka efase bouyon sa a. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `loadingForm` | ht | Loading form... | N ap chaje fòmilè a... | 2026-11-15 | machine-drafted, needs native review |
| `loadFormFailed` | ht | Failed to load form | Nou pa t ka chaje fòmilè a | 2026-11-15 | machine-drafted, needs native review |
| `templateNotFound` | ht | This form could not be found. | Nou pa jwenn fòmilè sa a. | 2026-11-15 | machine-drafted, needs native review |
| `goBack` | ht | Go Back | Retounen | 2026-11-15 | machine-drafted, needs native review |
| `noSections` | ht | This form has no sections defined. | Fòmilè sa a pa gen seksyon. | 2026-11-15 | machine-drafted, needs native review |
| `stepOf` | ht | Step {step} of {total} | Etap {step} sou {total} | 2026-11-15 | machine-drafted, needs native review |
| `reviewSubmit` | ht | Review & Submit | Revize epi voye | 2026-11-15 | machine-drafted, needs native review |
| `autofillBanner` | ht | Your profile data has been pre-filled where available. Review and update as needed. | Nou ranpli enfòmasyon pwofil ou kote sa te posib. Revize yo epi chanje sa ki nesesè. | 2026-11-15 | machine-drafted, needs native review |
| `reviewIntro` | ht | Review your answers before submitting. Use the {back} button to make corrections. | Revize repons ou anvan ou voye. Sèvi ak bouton {back} pou korije. | 2026-11-15 | machine-drafted, needs native review |
| `yes` | ht | Yes | Wi | 2026-11-15 | machine-drafted, needs native review |
| `no` | ht | No | Non | 2026-11-15 | machine-drafted, needs native review |
| `selectPlaceholder` | ht | Select... | Chwazi... | 2026-11-15 | machine-drafted, needs native review |
| `requiredMark` | ht | required | obligatwa | 2026-11-15 | machine-drafted, needs native review |
| `street` | ht | Street Address | Adrès | 2026-11-15 | machine-drafted, needs native review |
| `line2` | ht | Apt, Suite, Unit (optional) | Apatman, swit, inite (si genyen) | 2026-11-15 | machine-drafted, needs native review |
| `city` | ht | City | Vil | 2026-11-15 | machine-drafted, needs native review |
| `state` | ht | State | Eta | 2026-11-15 | machine-drafted, needs native review |
| `zip` | ht | ZIP Code | Kòd postal | 2026-11-15 | machine-drafted, needs native review |
| `signaturePlaceholder` | ht | Type your full legal name | Ekri non legal konplè ou | 2026-11-15 | machine-drafted, needs native review |
| `signatureConsent` | ht | By typing your name above, you are signing this document electronically. | Lè ou ekri non ou anlè a, ou siyen dokiman sa a elektwonikman. | 2026-11-15 | machine-drafted, needs native review |
| `next` | ht | Next | Swivan | 2026-11-15 | machine-drafted, needs native review |
| `review` | ht | Review | Revize | 2026-11-15 | machine-drafted, needs native review |
| `submitApplication` | ht | Submit Application | Voye demann lan | 2026-11-15 | machine-drafted, needs native review |
| `savingDraft` | ht | Saving your answers… | N ap sere repons ou yo… | 2026-11-15 | machine-drafted, needs native review |
| `submitting` | ht | Submitting your application… | N ap voye demann ou an… | 2026-11-15 | machine-drafted, needs native review |
| `submitFailed` | ht | We couldn’t submit your application. Please try again. | Nou pa t ka voye demann ou an. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `loadingPdf` | ht | Loading PDF... | N ap chaje PDF la... | 2026-11-15 | machine-drafted, needs native review |
| `loadPdfFailed` | ht | Failed to load PDF | Nou pa t ka chaje PDF la | 2026-11-15 | machine-drafted, needs native review |
| `loadPdfFailedBody` | ht | This PDF couldn’t be opened. It may be damaged or protected. | Nou pa t ka louvri PDF sa a. Li ka domaje oswa pwoteje. | 2026-11-15 | machine-drafted, needs native review |
| `renderFailed` | ht | Part of this PDF couldn’t be displayed. | Nou pa t ka montre yon pati nan PDF sa a. | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | ht | We couldn’t save your changes. Please try again. | Nou pa t ka sere chanjman ou yo. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `fillFailed` | ht | Fill from Profile didn’t work for this PDF. | Ranpli ak pwofil la pa t mache pou PDF sa a. | 2026-11-15 | machine-drafted, needs native review |
| `toolbarLabel` | ht | PDF tools | Zouti PDF | 2026-11-15 | machine-drafted, needs native review |
| `addTextBox` | ht | Add Text Box | Ajoute yon bwat tèks | 2026-11-15 | machine-drafted, needs native review |
| `placing` | ht | Click Page to Place | Klike sou paj la pou mete l | 2026-11-15 | machine-drafted, needs native review |
| `placingHint` | ht | Click a page to place a text box. | Klike sou yon paj pou mete yon bwat tèks. | 2026-11-15 | machine-drafted, needs native review |
| `fillFromProfile` | ht | Fill from Profile | Ranpli ak pwofil la | 2026-11-15 | machine-drafted, needs native review |
| `fillFromProfileHint` | ht | Fills the PDF’s fields from your saved profile. | Ranpli chan PDF la ak pwofil ou sere a. | 2026-11-15 | machine-drafted, needs native review |
| `textSize` | ht | Size: | Gwosè: | 2026-11-15 | machine-drafted, needs native review |
| `savePdf` | ht | Save PDF | Sere PDF la | 2026-11-15 | machine-drafted, needs native review |
| `renderingPages` | ht | Rendering pages... | N ap montre paj yo... | 2026-11-15 | machine-drafted, needs native review |
| `removeTextBox` | ht | Remove text box | Retire bwat tèks la | 2026-11-15 | machine-drafted, needs native review |
| `pageLabel` | ht | Page {n} | Paj {n} | 2026-11-15 | machine-drafted, needs native review |
| `applicationSubmitted` | ht | Application submitted. | Demann lan voye. | 2026-11-15 | machine-drafted, needs native review |
| `draftSaveFailed` | ht | We couldn’t save your answers. They are still here; please try again. | Nou pa t ka sere repons ou yo. Yo toujou la; tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `notAnswered` | ht | Not answered | Pa reponn | 2026-11-15 | machine-drafted, needs native review |
| `statusExpired` | ht | Expired | Ekspire | 2026-11-15 | machine-drafted, needs native review |
| `title` | so | Forms & Applications | Foomamka iyo codsiyada | 2026-11-15 | machine-drafted, needs native review |
| `subtitle` | so | Apply for benefits, assistance programs, and community resources. | Codso gargaar, barnaamijyo caawimo iyo kheyraadka bulshada. | 2026-11-15 | machine-drafted, needs native review |
| `fillPdf` | so | Fill PDF Form | Buuxi foom PDF ah | 2026-11-15 | machine-drafted, needs native review |
| `sectionsLabel` | so | Forms sections | Qaybaha foomamka | 2026-11-15 | machine-drafted, needs native review |
| `tabAvailable` | so | Available Forms | Foomamka la heli karo | 2026-11-15 | machine-drafted, needs native review |
| `tabInProgress` | so | In Progress | Socda | 2026-11-15 | machine-drafted, needs native review |
| `tabSubmitted` | so | Submitted | La diray | 2026-11-15 | machine-drafted, needs native review |
| `estMinutes` | so | Est. {m} min | Qiyaastii {m} daqiiqo | 2026-11-15 | machine-drafted, needs native review |
| `estHours` | so | Est. {h} h | Qiyaastii {h} saacadood | 2026-11-15 | machine-drafted, needs native review |
| `estHoursMinutes` | so | Est. {h} h {m} min | Qiyaastii {h} saacadood {m} daqiiqo | 2026-11-15 | machine-drafted, needs native review |
| `requiredDocs` | so | Required Documents: | Dukumentiyada loo baahan yahay: | 2026-11-15 | machine-drafted, needs native review |
| `startApplication` | so | Start Application | Bilow codsiga | 2026-11-15 | machine-drafted, needs native review |
| `lastSaved` | so | Last saved {when} | Markii ugu dambeysay ee la kaydiyay {when} | 2026-11-15 | machine-drafted, needs native review |
| `progress` | so | Progress | Horumarka | 2026-11-15 | machine-drafted, needs native review |
| `continue` | so | Continue | Sii wad | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraft` | so | Delete draft | Tirtir qabyada | 2026-11-15 | machine-drafted, needs native review |
| `submittedOn` | so | Submitted {date} | La diray {date} | 2026-11-15 | machine-drafted, needs native review |
| `viewSubmission` | so | View Submission | Eeg waxa la diray | 2026-11-15 | machine-drafted, needs native review |
| `catBenefits` | so | Benefits | Gargaarka | 2026-11-15 | machine-drafted, needs native review |
| `catVeteran` | so | Veterans | Ciidamadii hore | 2026-11-15 | machine-drafted, needs native review |
| `catDisability` | so | Disability | Naafonimada | 2026-11-15 | machine-drafted, needs native review |
| `statusPending` | so | Pending | Sugaya | 2026-11-15 | machine-drafted, needs native review |
| `statusUnderReview` | so | Under Review | Dib-u-eegis ku jira | 2026-11-15 | machine-drafted, needs native review |
| `statusApproved` | so | Approved | La ansixiyay | 2026-11-15 | machine-drafted, needs native review |
| `statusDenied` | so | Denied | La diiday | 2026-11-15 | machine-drafted, needs native review |
| `statusNeedsInfo` | so | Needs Info | Macluumaad ayaa loo baahan yahay | 2026-11-15 | machine-drafted, needs native review |
| `formNumber` | so | Form {number} | Foomka {number} | 2026-11-15 | machine-drafted, needs native review |
| `fillAnnotate` | so | Fill & Annotate | Buuxi oo calaamadee | 2026-11-15 | machine-drafted, needs native review |
| `openAgencySite` | so | Open on Agency Site | Ka fur websaydka hay’adda | 2026-11-15 | machine-drafted, needs native review |
| `opensNewTab` | so | (opens in a new tab) | (wuxuu ku furmaa tab cusub) | 2026-11-15 | machine-drafted, needs native review |
| `guestGovForms` | so | Create a free account to fill and save government forms to your encrypted vault | Samee akoon bilaash ah si aad u buuxiso oo ugu kaydiso foomamka dawladda khasnaddaada la sireeyay | 2026-11-15 | machine-drafted, needs native review |
| `guestWizard` | so | Create a free account to fill out and submit assistance applications | Samee akoon bilaash ah si aad u buuxiso oo u dirto codsiyada caawimada | 2026-11-15 | machine-drafted, needs native review |
| `backToForms` | so | Back to forms | Ku noqo foomamka | 2026-11-15 | machine-drafted, needs native review |
| `pdfSaveFailed` | so | We couldn’t save this PDF. Please try again. | Ma aanan kaydin karin PDF-kan. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `submissionFallback` | so | Submission | Waxa la diray | 2026-11-15 | machine-drafted, needs native review |
| `back` | so | Back | Dib u noqo | 2026-11-15 | machine-drafted, needs native review |
| `statusLabel` | so | Status: | Xaaladda: | 2026-11-15 | machine-drafted, needs native review |
| `submittedLabel` | so | Submitted: | La diray: | 2026-11-15 | machine-drafted, needs native review |
| `submissionNotFound` | so | Submission not found. | Waxa la diray lama helin. | 2026-11-15 | machine-drafted, needs native review |
| `checking` | so | Checking available forms… (a few seconds) | Waxaa la hubinayaa foomamka la heli karo… (dhowr ilbiriqsi) | 2026-11-15 | machine-drafted, needs native review |
| `loadFailed` | so | Failed to load forms | Foomamka lama soo rari karin | 2026-11-15 | machine-drafted, needs native review |
| `loadFailedBody` | so | We couldn’t load the forms. Please try again. | Ma aanan soo rari karin foomamka. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `tryAgain` | so | Try Again | Isku day mar kale | 2026-11-15 | machine-drafted, needs native review |
| `noForms` | so | No Forms Available | Foomam lama heli karo | 2026-11-15 | machine-drafted, needs native review |
| `noFormsBody` | so | No application forms are set up yet. The AI Assistant can help you find benefit programs and walk you through what you need. | Weli foomam codsi ah lama diyaarin. Kaaliyaha AI wuxuu kaa caawin karaa inaad hesho barnaamijyada gargaarka oo kuu sharxi karaa waxaad u baahan tahay. | 2026-11-15 | machine-drafted, needs native review |
| `askAssistant` | so | Ask the Assistant | Weydii Kaaliyaha | 2026-11-15 | machine-drafted, needs native review |
| `govTitle` | so | Government Forms | Foomamka dawladda | 2026-11-15 | machine-drafted, needs native review |
| `govBody` | so | Official federal benefit forms — fill and annotate in-app, then save to your Documents. | Foomamka rasmiga ah ee gargaarka federaalka — ku buuxi oo ku calaamadee app-ka, kadibna ku kaydi Dukumentiyadaada. | 2026-11-15 | machine-drafted, needs native review |
| `govLoadFailed` | so | Could not load {form}. Please try again. | Lama soo rari karin {form}. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `noInProgress` | so | No Forms In Progress | Foomam socda ma jiraan | 2026-11-15 | machine-drafted, needs native review |
| `noInProgressBody` | so | Start a new application from the {tab} tab. | Ka bilow codsi cusub tab-ka {tab}. | 2026-11-15 | machine-drafted, needs native review |
| `noSubmissions` | so | No Submissions Yet | Weli wax lama dirin | 2026-11-15 | machine-drafted, needs native review |
| `noSubmissionsBody` | so | Complete and submit an application to see it here. | Dhammee oo dir codsi si aad halkan ugu aragto. | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraftTitle` | so | Delete this draft? | Ma tirtirtaa qabyadan? | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraftBody` | so | This cannot be undone. Your progress will be permanently removed. | Lama celin karo. Horumarkaaga si joogto ah ayaa loo tirtiri doonaa. | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | so | Cancel | Jooji | 2026-11-15 | machine-drafted, needs native review |
| `close` | so | Close | Xir | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraftConfirm` | so | Delete Draft | Tirtir qabyada | 2026-11-15 | machine-drafted, needs native review |
| `draftDeleted` | so | Draft deleted. | Qabyadii waa la tirtiray. | 2026-11-15 | machine-drafted, needs native review |
| `draftDeleteFailed` | so | We couldn’t delete this draft. Please try again. | Ma aanan tirtiri karin qabyadan. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `loadingForm` | so | Loading form... | Foomka ayaa la soo rarayaa... | 2026-11-15 | machine-drafted, needs native review |
| `loadFormFailed` | so | Failed to load form | Foomka lama soo rari karin | 2026-11-15 | machine-drafted, needs native review |
| `templateNotFound` | so | This form could not be found. | Foomkan lama helin. | 2026-11-15 | machine-drafted, needs native review |
| `goBack` | so | Go Back | Dib u noqo | 2026-11-15 | machine-drafted, needs native review |
| `noSections` | so | This form has no sections defined. | Foomkan qaybo ma laha. | 2026-11-15 | machine-drafted, needs native review |
| `stepOf` | so | Step {step} of {total} | Tallaabada {step} ee {total} | 2026-11-15 | machine-drafted, needs native review |
| `reviewSubmit` | so | Review & Submit | Dib u eeg oo dir | 2026-11-15 | machine-drafted, needs native review |
| `autofillBanner` | so | Your profile data has been pre-filled where available. Review and update as needed. | Xogta astaantaada waa la buuxiyay meelaha ay suurtagal ahayd. Dib u eeg oo cusboonaysii hadba sida loo baahdo. | 2026-11-15 | machine-drafted, needs native review |
| `reviewIntro` | so | Review your answers before submitting. Use the {back} button to make corrections. | Dib u eeg jawaabahaaga ka hor intaadan dirin. Isticmaal badhanka {back} si aad wax u saxdo. | 2026-11-15 | machine-drafted, needs native review |
| `yes` | so | Yes | Haa | 2026-11-15 | machine-drafted, needs native review |
| `no` | so | No | Maya | 2026-11-15 | machine-drafted, needs native review |
| `selectPlaceholder` | so | Select... | Dooro... | 2026-11-15 | machine-drafted, needs native review |
| `requiredMark` | so | required | waa qasab | 2026-11-15 | machine-drafted, needs native review |
| `street` | so | Street Address | Cinwaanka waddada | 2026-11-15 | machine-drafted, needs native review |
| `line2` | so | Apt, Suite, Unit (optional) | Aqal, qol, unug (ikhtiyaari) | 2026-11-15 | machine-drafted, needs native review |
| `city` | so | City | Magaalada | 2026-11-15 | machine-drafted, needs native review |
| `state` | so | State | Gobolka | 2026-11-15 | machine-drafted, needs native review |
| `zip` | so | ZIP Code | Koodka boostada | 2026-11-15 | machine-drafted, needs native review |
| `signaturePlaceholder` | so | Type your full legal name | Qor magacaaga sharciga ah oo dhammaystiran | 2026-11-15 | machine-drafted, needs native review |
| `signatureConsent` | so | By typing your name above, you are signing this document electronically. | Markaad magacaaga kor ku qorto, waxaad dukumentigan u saxeexaysaa si elektaroonig ah. | 2026-11-15 | machine-drafted, needs native review |
| `next` | so | Next | Xiga | 2026-11-15 | machine-drafted, needs native review |
| `review` | so | Review | Dib u eeg | 2026-11-15 | machine-drafted, needs native review |
| `submitApplication` | so | Submit Application | Dir codsiga | 2026-11-15 | machine-drafted, needs native review |
| `savingDraft` | so | Saving your answers… | Jawaabahaaga ayaa la kaydinayaa… | 2026-11-15 | machine-drafted, needs native review |
| `submitting` | so | Submitting your application… | Codsigaaga ayaa la dirayaa… | 2026-11-15 | machine-drafted, needs native review |
| `submitFailed` | so | We couldn’t submit your application. Please try again. | Ma aanan diri karin codsigaaga. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `loadingPdf` | so | Loading PDF... | PDF-ka ayaa la soo rarayaa... | 2026-11-15 | machine-drafted, needs native review |
| `loadPdfFailed` | so | Failed to load PDF | PDF-ka lama soo rari karin | 2026-11-15 | machine-drafted, needs native review |
| `loadPdfFailedBody` | so | This PDF couldn’t be opened. It may be damaged or protected. | PDF-kan lama furi karin. Waxaa laga yaabaa inuu dhaawacan yahay ama ilaashan yahay. | 2026-11-15 | machine-drafted, needs native review |
| `renderFailed` | so | Part of this PDF couldn’t be displayed. | Qayb ka mid ah PDF-kan lama muujin karin. | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | so | We couldn’t save your changes. Please try again. | Ma aanan kaydin karin isbeddelladaada. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `fillFailed` | so | Fill from Profile didn’t work for this PDF. | Ka buuxinta astaanta kuma shaqayn PDF-kan. | 2026-11-15 | machine-drafted, needs native review |
| `toolbarLabel` | so | PDF tools | Qalabka PDF-ka | 2026-11-15 | machine-drafted, needs native review |
| `addTextBox` | so | Add Text Box | Ku dar sanduuq qoraal | 2026-11-15 | machine-drafted, needs native review |
| `placing` | so | Click Page to Place | Guji bogga si aad u dhigto | 2026-11-15 | machine-drafted, needs native review |
| `placingHint` | so | Click a page to place a text box. | Guji bog si aad u dhigto sanduuq qoraal. | 2026-11-15 | machine-drafted, needs native review |
| `fillFromProfile` | so | Fill from Profile | Ka buuxi astaanta | 2026-11-15 | machine-drafted, needs native review |
| `fillFromProfileHint` | so | Fills the PDF’s fields from your saved profile. | Wuxuu ka buuxiyaa goobaha PDF-ka astaantaada la kaydiyay. | 2026-11-15 | machine-drafted, needs native review |
| `textSize` | so | Size: | Cabbirka: | 2026-11-15 | machine-drafted, needs native review |
| `savePdf` | so | Save PDF | Kaydi PDF-ka | 2026-11-15 | machine-drafted, needs native review |
| `renderingPages` | so | Rendering pages... | Bogagga ayaa la muujinayaa... | 2026-11-15 | machine-drafted, needs native review |
| `removeTextBox` | so | Remove text box | Ka saar sanduuqa qoraalka | 2026-11-15 | machine-drafted, needs native review |
| `pageLabel` | so | Page {n} | Bogga {n} | 2026-11-15 | machine-drafted, needs native review |
| `applicationSubmitted` | so | Application submitted. | Codsiga waa la diray. | 2026-11-15 | machine-drafted, needs native review |
| `draftSaveFailed` | so | We couldn’t save your answers. They are still here; please try again. | Ma aanan kaydin karin jawaabahaaga. Weli halkan bay yaallaan; fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `notAnswered` | so | Not answered | Lama jawaabin | 2026-11-15 | machine-drafted, needs native review |
| `statusExpired` | so | Expired | Wakhtigiisu wuu dhacay | 2026-11-15 | machine-drafted, needs native review |
| `title` | am | Forms & Applications | ቅጾች እና ማመልከቻዎች | 2026-11-15 | machine-drafted, needs native review |
| `subtitle` | am | Apply for benefits, assistance programs, and community resources. | ለጥቅማ ጥቅሞች፣ ለድጋፍ ፕሮግራሞች እና ለማህበረሰብ ግብዓቶች ያመልክቱ። | 2026-11-15 | machine-drafted, needs native review |
| `fillPdf` | am | Fill PDF Form | የPDF ቅጽ ሙላ | 2026-11-15 | machine-drafted, needs native review |
| `sectionsLabel` | am | Forms sections | የቅጾች ክፍሎች | 2026-11-15 | machine-drafted, needs native review |
| `tabAvailable` | am | Available Forms | የሚገኙ ቅጾች | 2026-11-15 | machine-drafted, needs native review |
| `tabInProgress` | am | In Progress | በሂደት ላይ | 2026-11-15 | machine-drafted, needs native review |
| `tabSubmitted` | am | Submitted | የተላኩ | 2026-11-15 | machine-drafted, needs native review |
| `estMinutes` | am | Est. {m} min | በግምት {m} ደቂቃ | 2026-11-15 | machine-drafted, needs native review |
| `estHours` | am | Est. {h} h | በግምት {h} ሰዓት | 2026-11-15 | machine-drafted, needs native review |
| `estHoursMinutes` | am | Est. {h} h {m} min | በግምት {h} ሰዓት {m} ደቂቃ | 2026-11-15 | machine-drafted, needs native review |
| `requiredDocs` | am | Required Documents: | የሚያስፈልጉ ሰነዶች፦ | 2026-11-15 | machine-drafted, needs native review |
| `startApplication` | am | Start Application | ማመልከቻ ጀምር | 2026-11-15 | machine-drafted, needs native review |
| `lastSaved` | am | Last saved {when} | መጨረሻ የተቀመጠው {when} | 2026-11-15 | machine-drafted, needs native review |
| `progress` | am | Progress | ሂደት | 2026-11-15 | machine-drafted, needs native review |
| `continue` | am | Continue | ቀጥል | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraft` | am | Delete draft | ረቂቁን ሰርዝ | 2026-11-15 | machine-drafted, needs native review |
| `submittedOn` | am | Submitted {date} | {date} ተልኳል | 2026-11-15 | machine-drafted, needs native review |
| `viewSubmission` | am | View Submission | የተላከውን ይመልከቱ | 2026-11-15 | machine-drafted, needs native review |
| `catBenefits` | am | Benefits | ጥቅማ ጥቅሞች | 2026-11-15 | machine-drafted, needs native review |
| `catVeteran` | am | Veterans | የቀድሞ ወታደሮች | 2026-11-15 | machine-drafted, needs native review |
| `catDisability` | am | Disability | አካል ጉዳት | 2026-11-15 | machine-drafted, needs native review |
| `statusPending` | am | Pending | በመጠባበቅ ላይ | 2026-11-15 | machine-drafted, needs native review |
| `statusUnderReview` | am | Under Review | በግምገማ ላይ | 2026-11-15 | machine-drafted, needs native review |
| `statusApproved` | am | Approved | ጸድቋል | 2026-11-15 | machine-drafted, needs native review |
| `statusDenied` | am | Denied | ተቀባይነት አላገኘም | 2026-11-15 | machine-drafted, needs native review |
| `statusNeedsInfo` | am | Needs Info | መረጃ ያስፈልጋል | 2026-11-15 | machine-drafted, needs native review |
| `formNumber` | am | Form {number} | ቅጽ {number} | 2026-11-15 | machine-drafted, needs native review |
| `fillAnnotate` | am | Fill & Annotate | ሙላ እና ማስታወሻ ጨምር | 2026-11-15 | machine-drafted, needs native review |
| `openAgencySite` | am | Open on Agency Site | በተቋሙ ድረ-ገጽ ክፈት | 2026-11-15 | machine-drafted, needs native review |
| `opensNewTab` | am | (opens in a new tab) | (በአዲስ ትር ይከፈታል) | 2026-11-15 | machine-drafted, needs native review |
| `guestGovForms` | am | Create a free account to fill and save government forms to your encrypted vault | የመንግሥት ቅጾችን ለመሙላት እና በተመሰጠረ ካዝናዎ ለማስቀመጥ ነፃ መለያ ይፍጠሩ | 2026-11-15 | machine-drafted, needs native review |
| `guestWizard` | am | Create a free account to fill out and submit assistance applications | የድጋፍ ማመልከቻዎችን ለመሙላት እና ለመላክ ነፃ መለያ ይፍጠሩ | 2026-11-15 | machine-drafted, needs native review |
| `backToForms` | am | Back to forms | ወደ ቅጾቹ ተመለስ | 2026-11-15 | machine-drafted, needs native review |
| `pdfSaveFailed` | am | We couldn’t save this PDF. Please try again. | ይህን PDF ማስቀመጥ አልቻልንም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `submissionFallback` | am | Submission | የተላከ | 2026-11-15 | machine-drafted, needs native review |
| `back` | am | Back | ተመለስ | 2026-11-15 | machine-drafted, needs native review |
| `statusLabel` | am | Status: | ሁኔታ፦ | 2026-11-15 | machine-drafted, needs native review |
| `submittedLabel` | am | Submitted: | የተላከበት፦ | 2026-11-15 | machine-drafted, needs native review |
| `submissionNotFound` | am | Submission not found. | የተላከው አልተገኘም። | 2026-11-15 | machine-drafted, needs native review |
| `checking` | am | Checking available forms… (a few seconds) | የሚገኙ ቅጾች እየተፈለጉ ነው… (ጥቂት ሰከንዶች) | 2026-11-15 | machine-drafted, needs native review |
| `loadFailed` | am | Failed to load forms | ቅጾቹን መጫን አልተቻለም | 2026-11-15 | machine-drafted, needs native review |
| `loadFailedBody` | am | We couldn’t load the forms. Please try again. | ቅጾቹን መጫን አልቻልንም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `tryAgain` | am | Try Again | እንደገና ሞክር | 2026-11-15 | machine-drafted, needs native review |
| `noForms` | am | No Forms Available | የሚገኙ ቅጾች የሉም | 2026-11-15 | machine-drafted, needs native review |
| `noFormsBody` | am | No application forms are set up yet. The AI Assistant can help you find benefit programs and walk you through what you need. | እስካሁን የተዘጋጁ የማመልከቻ ቅጾች የሉም። የAI ረዳቱ የጥቅማ ጥቅም ፕሮግራሞችን እንዲያገኙ ሊረዳዎ እና የሚያስፈልገውን ሊመራዎ ይችላል። | 2026-11-15 | machine-drafted, needs native review |
| `askAssistant` | am | Ask the Assistant | ረዳቱን ጠይቅ | 2026-11-15 | machine-drafted, needs native review |
| `govTitle` | am | Government Forms | የመንግሥት ቅጾች | 2026-11-15 | machine-drafted, needs native review |
| `govBody` | am | Official federal benefit forms — fill and annotate in-app, then save to your Documents. | ይፋዊ የፌዴራል የጥቅማ ጥቅም ቅጾች — በመተግበሪያው ውስጥ ይሙሉ እና ማስታወሻ ይጨምሩ፣ ከዚያ በሰነዶችዎ ውስጥ ያስቀምጡ። | 2026-11-15 | machine-drafted, needs native review |
| `govLoadFailed` | am | Could not load {form}. Please try again. | {form}ን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `noInProgress` | am | No Forms In Progress | በሂደት ላይ ያሉ ቅጾች የሉም | 2026-11-15 | machine-drafted, needs native review |
| `noInProgressBody` | am | Start a new application from the {tab} tab. | ከ{tab} ትር አዲስ ማመልከቻ ይጀምሩ። | 2026-11-15 | machine-drafted, needs native review |
| `noSubmissions` | am | No Submissions Yet | እስካሁን የተላከ የለም | 2026-11-15 | machine-drafted, needs native review |
| `noSubmissionsBody` | am | Complete and submit an application to see it here. | ማመልከቻ ሞልተው ሲልኩ እዚህ ይታያል። | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraftTitle` | am | Delete this draft? | ይህ ረቂቅ ይሰረዝ? | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraftBody` | am | This cannot be undone. Your progress will be permanently removed. | ይህ ሊቀለበስ አይችልም። ሂደትዎ ለዘለቄታው ይሰረዛል። | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | am | Cancel | ይቅር | 2026-11-15 | machine-drafted, needs native review |
| `close` | am | Close | ዝጋ | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraftConfirm` | am | Delete Draft | ረቂቁን ሰርዝ | 2026-11-15 | machine-drafted, needs native review |
| `draftDeleted` | am | Draft deleted. | ረቂቁ ተሰርዟል። | 2026-11-15 | machine-drafted, needs native review |
| `draftDeleteFailed` | am | We couldn’t delete this draft. Please try again. | ይህን ረቂቅ መሰረዝ አልቻልንም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `loadingForm` | am | Loading form... | ቅጹ እየተጫነ ነው... | 2026-11-15 | machine-drafted, needs native review |
| `loadFormFailed` | am | Failed to load form | ቅጹን መጫን አልተቻለም | 2026-11-15 | machine-drafted, needs native review |
| `templateNotFound` | am | This form could not be found. | ይህ ቅጽ አልተገኘም። | 2026-11-15 | machine-drafted, needs native review |
| `goBack` | am | Go Back | ተመለስ | 2026-11-15 | machine-drafted, needs native review |
| `noSections` | am | This form has no sections defined. | ይህ ቅጽ ምንም ክፍሎች የሉትም። | 2026-11-15 | machine-drafted, needs native review |
| `stepOf` | am | Step {step} of {total} | ደረጃ {step} ከ{total} | 2026-11-15 | machine-drafted, needs native review |
| `reviewSubmit` | am | Review & Submit | ገምግም እና ላክ | 2026-11-15 | machine-drafted, needs native review |
| `autofillBanner` | am | Your profile data has been pre-filled where available. Review and update as needed. | በተቻለ መጠን የመገለጫ መረጃዎ ቀድሞ ተሞልቷል። ይገምግሙ እና እንደ አስፈላጊነቱ ያዘምኑ። | 2026-11-15 | machine-drafted, needs native review |
| `reviewIntro` | am | Review your answers before submitting. Use the {back} button to make corrections. | ከመላክዎ በፊት መልሶችዎን ይገምግሙ። ለማረም የ{back} ቁልፍን ይጠቀሙ። | 2026-11-15 | machine-drafted, needs native review |
| `yes` | am | Yes | አዎ | 2026-11-15 | machine-drafted, needs native review |
| `no` | am | No | አይ | 2026-11-15 | machine-drafted, needs native review |
| `selectPlaceholder` | am | Select... | ይምረጡ... | 2026-11-15 | machine-drafted, needs native review |
| `requiredMark` | am | required | ግዴታ | 2026-11-15 | machine-drafted, needs native review |
| `street` | am | Street Address | የመንገድ አድራሻ | 2026-11-15 | machine-drafted, needs native review |
| `line2` | am | Apt, Suite, Unit (optional) | አፓርታማ፣ ክፍል፣ ዩኒት (አማራጭ) | 2026-11-15 | machine-drafted, needs native review |
| `city` | am | City | ከተማ | 2026-11-15 | machine-drafted, needs native review |
| `state` | am | State | ግዛት | 2026-11-15 | machine-drafted, needs native review |
| `zip` | am | ZIP Code | የፖስታ ኮድ | 2026-11-15 | machine-drafted, needs native review |
| `signaturePlaceholder` | am | Type your full legal name | ሙሉ ሕጋዊ ስምዎን ይጻፉ | 2026-11-15 | machine-drafted, needs native review |
| `signatureConsent` | am | By typing your name above, you are signing this document electronically. | ስምዎን ከላይ በመጻፍ ይህን ሰነድ በኤሌክትሮኒክ መንገድ ይፈርማሉ። | 2026-11-15 | machine-drafted, needs native review |
| `next` | am | Next | ቀጣይ | 2026-11-15 | machine-drafted, needs native review |
| `review` | am | Review | ገምግም | 2026-11-15 | machine-drafted, needs native review |
| `submitApplication` | am | Submit Application | ማመልከቻውን ላክ | 2026-11-15 | machine-drafted, needs native review |
| `savingDraft` | am | Saving your answers… | መልሶችዎ እየተቀመጡ ነው… | 2026-11-15 | machine-drafted, needs native review |
| `submitting` | am | Submitting your application… | ማመልከቻዎ እየተላከ ነው… | 2026-11-15 | machine-drafted, needs native review |
| `submitFailed` | am | We couldn’t submit your application. Please try again. | ማመልከቻዎን መላክ አልቻልንም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `loadingPdf` | am | Loading PDF... | PDF እየተጫነ ነው... | 2026-11-15 | machine-drafted, needs native review |
| `loadPdfFailed` | am | Failed to load PDF | PDFን መጫን አልተቻለም | 2026-11-15 | machine-drafted, needs native review |
| `loadPdfFailedBody` | am | This PDF couldn’t be opened. It may be damaged or protected. | ይህ PDF ሊከፈት አልቻለም። የተበላሸ ወይም የተጠበቀ ሊሆን ይችላል። | 2026-11-15 | machine-drafted, needs native review |
| `renderFailed` | am | Part of this PDF couldn’t be displayed. | የዚህ PDF ክፍል ሊታይ አልቻለም። | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | am | We couldn’t save your changes. Please try again. | ለውጦችዎን ማስቀመጥ አልቻልንም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `fillFailed` | am | Fill from Profile didn’t work for this PDF. | ከመገለጫ መሙላት ለዚህ PDF አልሰራም። | 2026-11-15 | machine-drafted, needs native review |
| `toolbarLabel` | am | PDF tools | የPDF መሣሪያዎች | 2026-11-15 | machine-drafted, needs native review |
| `addTextBox` | am | Add Text Box | የጽሑፍ ሳጥን አክል | 2026-11-15 | machine-drafted, needs native review |
| `placing` | am | Click Page to Place | ለማስቀመጥ ገጹን ጠቅ ያድርጉ | 2026-11-15 | machine-drafted, needs native review |
| `placingHint` | am | Click a page to place a text box. | የጽሑፍ ሳጥን ለማስቀመጥ ገጽ ላይ ጠቅ ያድርጉ። | 2026-11-15 | machine-drafted, needs native review |
| `fillFromProfile` | am | Fill from Profile | ከመገለጫ ሙላ | 2026-11-15 | machine-drafted, needs native review |
| `fillFromProfileHint` | am | Fills the PDF’s fields from your saved profile. | የPDFን መስኮች ከተቀመጠው መገለጫዎ ይሞላል። | 2026-11-15 | machine-drafted, needs native review |
| `textSize` | am | Size: | መጠን፦ | 2026-11-15 | machine-drafted, needs native review |
| `savePdf` | am | Save PDF | PDF አስቀምጥ | 2026-11-15 | machine-drafted, needs native review |
| `renderingPages` | am | Rendering pages... | ገጾቹ እየታዩ ነው... | 2026-11-15 | machine-drafted, needs native review |
| `removeTextBox` | am | Remove text box | የጽሑፍ ሳጥኑን አስወግድ | 2026-11-15 | machine-drafted, needs native review |
| `pageLabel` | am | Page {n} | ገጽ {n} | 2026-11-15 | machine-drafted, needs native review |
| `applicationSubmitted` | am | Application submitted. | ማመልከቻው ተልኳል። | 2026-11-15 | machine-drafted, needs native review |
| `draftSaveFailed` | am | We couldn’t save your answers. They are still here; please try again. | መልሶችዎን ማስቀመጥ አልቻልንም። አሁንም እዚህ አሉ፤ እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `notAnswered` | am | Not answered | አልተመለሰም | 2026-11-15 | machine-drafted, needs native review |
| `statusExpired` | am | Expired | ጊዜው አልፏል | 2026-11-15 | machine-drafted, needs native review |
| `title` | hmn | Forms & Applications | Cov foos thiab ntawv thov | 2026-11-15 | machine-drafted, needs native review |
| `subtitle` | hmn | Apply for benefits, assistance programs, and community resources. | Thov cov txiaj ntsim, kev pab cuam thiab kev pab hauv zej zog. | 2026-11-15 | machine-drafted, needs native review |
| `fillPdf` | hmn | Fill PDF Form | Sau daim foos PDF | 2026-11-15 | machine-drafted, needs native review |
| `sectionsLabel` | hmn | Forms sections | Cov ntu foos | 2026-11-15 | machine-drafted, needs native review |
| `tabAvailable` | hmn | Available Forms | Cov foos muaj | 2026-11-15 | machine-drafted, needs native review |
| `tabInProgress` | hmn | In Progress | Tab tom ua | 2026-11-15 | machine-drafted, needs native review |
| `tabSubmitted` | hmn | Submitted | Xa lawm | 2026-11-15 | machine-drafted, needs native review |
| `estMinutes` | hmn | Est. {m} min | Kwv yees {m} feeb | 2026-11-15 | machine-drafted, needs native review |
| `estHours` | hmn | Est. {h} h | Kwv yees {h} teev | 2026-11-15 | machine-drafted, needs native review |
| `estHoursMinutes` | hmn | Est. {h} h {m} min | Kwv yees {h} teev {m} feeb | 2026-11-15 | machine-drafted, needs native review |
| `requiredDocs` | hmn | Required Documents: | Cov ntaub ntawv yuav tsum muaj: | 2026-11-15 | machine-drafted, needs native review |
| `startApplication` | hmn | Start Application | Pib ntawv thov | 2026-11-15 | machine-drafted, needs native review |
| `lastSaved` | hmn | Last saved {when} | Khaws zaum kawg {when} | 2026-11-15 | machine-drafted, needs native review |
| `progress` | hmn | Progress | Kev nce qib | 2026-11-15 | machine-drafted, needs native review |
| `continue` | hmn | Continue | Mus ntxiv | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraft` | hmn | Delete draft | Rho daim qauv tawm | 2026-11-15 | machine-drafted, needs native review |
| `submittedOn` | hmn | Submitted {date} | Xa rau {date} | 2026-11-15 | machine-drafted, needs native review |
| `viewSubmission` | hmn | View Submission | Saib daim ntawv xa | 2026-11-15 | machine-drafted, needs native review |
| `catBenefits` | hmn | Benefits | Cov txiaj ntsim | 2026-11-15 | machine-drafted, needs native review |
| `catVeteran` | hmn | Veterans | Tub rog qub | 2026-11-15 | machine-drafted, needs native review |
| `catDisability` | hmn | Disability | Kev xiam oob khab | 2026-11-15 | machine-drafted, needs native review |
| `statusPending` | hmn | Pending | Tos | 2026-11-15 | machine-drafted, needs native review |
| `statusUnderReview` | hmn | Under Review | Tab tom tshuaj xyuas | 2026-11-15 | machine-drafted, needs native review |
| `statusApproved` | hmn | Approved | Pom zoo lawm | 2026-11-15 | machine-drafted, needs native review |
| `statusDenied` | hmn | Denied | Tsis pom zoo | 2026-11-15 | machine-drafted, needs native review |
| `statusNeedsInfo` | hmn | Needs Info | Xav tau ntaub ntawv ntxiv | 2026-11-15 | machine-drafted, needs native review |
| `formNumber` | hmn | Form {number} | Foos {number} | 2026-11-15 | machine-drafted, needs native review |
| `fillAnnotate` | hmn | Fill & Annotate | Sau thiab cim | 2026-11-15 | machine-drafted, needs native review |
| `openAgencySite` | hmn | Open on Agency Site | Qhib ntawm lub vev xaib ntawm lub koom haum | 2026-11-15 | machine-drafted, needs native review |
| `opensNewTab` | hmn | (opens in a new tab) | (qhib rau hauv ib lub tab tshiab) | 2026-11-15 | machine-drafted, needs native review |
| `guestGovForms` | hmn | Create a free account to fill and save government forms to your encrypted vault | Tsim ib tus as khauj dawb kom sau thiab khaws tau cov foos tsoom fwv rau hauv koj lub thawv xauv uas muab zais | 2026-11-15 | machine-drafted, needs native review |
| `guestWizard` | hmn | Create a free account to fill out and submit assistance applications | Tsim ib tus as khauj dawb kom sau thiab xa tau cov ntawv thov kev pab | 2026-11-15 | machine-drafted, needs native review |
| `backToForms` | hmn | Back to forms | Rov qab mus rau cov foos | 2026-11-15 | machine-drafted, needs native review |
| `pdfSaveFailed` | hmn | We couldn’t save this PDF. Please try again. | Peb khaws tsis tau daim PDF no. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `submissionFallback` | hmn | Submission | Daim ntawv xa | 2026-11-15 | machine-drafted, needs native review |
| `back` | hmn | Back | Rov qab | 2026-11-15 | machine-drafted, needs native review |
| `statusLabel` | hmn | Status: | Xwm txheej: | 2026-11-15 | machine-drafted, needs native review |
| `submittedLabel` | hmn | Submitted: | Xa rau: | 2026-11-15 | machine-drafted, needs native review |
| `submissionNotFound` | hmn | Submission not found. | Nrhiav tsis tau daim ntawv xa. | 2026-11-15 | machine-drafted, needs native review |
| `checking` | hmn | Checking available forms… (a few seconds) | Tab tom nrhiav cov foos muaj… (ob peb vib nas this) | 2026-11-15 | machine-drafted, needs native review |
| `loadFailed` | hmn | Failed to load forms | Thauj tsis tau cov foos | 2026-11-15 | machine-drafted, needs native review |
| `loadFailedBody` | hmn | We couldn’t load the forms. Please try again. | Peb thauj tsis tau cov foos. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `tryAgain` | hmn | Try Again | Sim dua | 2026-11-15 | machine-drafted, needs native review |
| `noForms` | hmn | No Forms Available | Tsis muaj foos | 2026-11-15 | machine-drafted, needs native review |
| `noFormsBody` | hmn | No application forms are set up yet. The AI Assistant can help you find benefit programs and walk you through what you need. | Tseem tsis tau muaj foos ntawv thov. Tus Pab AI pab tau koj nrhiav cov kev pab txiaj ntsim thiab qhia koj tias yuav tsum ua li cas. | 2026-11-15 | machine-drafted, needs native review |
| `askAssistant` | hmn | Ask the Assistant | Nug tus Pab | 2026-11-15 | machine-drafted, needs native review |
| `govTitle` | hmn | Government Forms | Cov foos tsoom fwv | 2026-11-15 | machine-drafted, needs native review |
| `govBody` | hmn | Official federal benefit forms — fill and annotate in-app, then save to your Documents. | Cov foos txiaj ntsim raug cai ntawm tsoom fwv teb chaws — sau thiab cim hauv app, ces khaws rau hauv koj Cov ntaub ntawv. | 2026-11-15 | machine-drafted, needs native review |
| `govLoadFailed` | hmn | Could not load {form}. Please try again. | Thauj tsis tau {form}. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `noInProgress` | hmn | No Forms In Progress | Tsis muaj foos tab tom ua | 2026-11-15 | machine-drafted, needs native review |
| `noInProgressBody` | hmn | Start a new application from the {tab} tab. | Pib ib daim ntawv thov tshiab ntawm lub tab {tab}. | 2026-11-15 | machine-drafted, needs native review |
| `noSubmissions` | hmn | No Submissions Yet | Tseem tsis tau xa dab tsi | 2026-11-15 | machine-drafted, needs native review |
| `noSubmissionsBody` | hmn | Complete and submit an application to see it here. | Sau thiab xa ib daim ntawv thov kom pom nws ntawm no. | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraftTitle` | hmn | Delete this draft? | Rho daim qauv no tawm? | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraftBody` | hmn | This cannot be undone. Your progress will be permanently removed. | Rov qab tsis tau. Koj qhov kev nce qib yuav raug rho tawm mus tas li. | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | hmn | Cancel | Tso tseg | 2026-11-15 | machine-drafted, needs native review |
| `close` | hmn | Close | Kaw | 2026-11-15 | machine-drafted, needs native review |
| `deleteDraftConfirm` | hmn | Delete Draft | Rho daim qauv tawm | 2026-11-15 | machine-drafted, needs native review |
| `draftDeleted` | hmn | Draft deleted. | Rho daim qauv tawm lawm. | 2026-11-15 | machine-drafted, needs native review |
| `draftDeleteFailed` | hmn | We couldn’t delete this draft. Please try again. | Peb rho tsis tau daim qauv no. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `loadingForm` | hmn | Loading form... | Tab tom thauj daim foos... | 2026-11-15 | machine-drafted, needs native review |
| `loadFormFailed` | hmn | Failed to load form | Thauj tsis tau daim foos | 2026-11-15 | machine-drafted, needs native review |
| `templateNotFound` | hmn | This form could not be found. | Nrhiav tsis tau daim foos no. | 2026-11-15 | machine-drafted, needs native review |
| `goBack` | hmn | Go Back | Rov qab | 2026-11-15 | machine-drafted, needs native review |
| `noSections` | hmn | This form has no sections defined. | Daim foos no tsis muaj ntu. | 2026-11-15 | machine-drafted, needs native review |
| `stepOf` | hmn | Step {step} of {total} | Kauj ruam {step} ntawm {total} | 2026-11-15 | machine-drafted, needs native review |
| `reviewSubmit` | hmn | Review & Submit | Tshuaj xyuas thiab xa | 2026-11-15 | machine-drafted, needs native review |
| `autofillBanner` | hmn | Your profile data has been pre-filled where available. Review and update as needed. | Koj cov ntaub ntawv profile tau muab sau ua ntej rau qhov twg ua tau. Tshuaj xyuas thiab kho raws li xav tau. | 2026-11-15 | machine-drafted, needs native review |
| `reviewIntro` | hmn | Review your answers before submitting. Use the {back} button to make corrections. | Tshuaj xyuas koj cov lus teb ua ntej xa. Siv lub pob {back} los kho. | 2026-11-15 | machine-drafted, needs native review |
| `yes` | hmn | Yes | Yog | 2026-11-15 | machine-drafted, needs native review |
| `no` | hmn | No | Tsis yog | 2026-11-15 | machine-drafted, needs native review |
| `selectPlaceholder` | hmn | Select... | Xaiv... | 2026-11-15 | machine-drafted, needs native review |
| `requiredMark` | hmn | required | yuav tsum muaj | 2026-11-15 | machine-drafted, needs native review |
| `street` | hmn | Street Address | Chaw nyob (txoj kev) | 2026-11-15 | machine-drafted, needs native review |
| `line2` | hmn | Apt, Suite, Unit (optional) | Chav tsev, suite, unit (tsis yuav tsum) | 2026-11-15 | machine-drafted, needs native review |
| `city` | hmn | City | Nroog | 2026-11-15 | machine-drafted, needs native review |
| `state` | hmn | State | Xeev | 2026-11-15 | machine-drafted, needs native review |
| `zip` | hmn | ZIP Code | ZIP code | 2026-11-15 | machine-drafted, needs native review |
| `signaturePlaceholder` | hmn | Type your full legal name | Sau koj lub npe raug cai puv npo | 2026-11-15 | machine-drafted, needs native review |
| `signatureConsent` | hmn | By typing your name above, you are signing this document electronically. | Thaum koj sau koj lub npe saum toj no, koj kos npe rau daim ntawv no hauv hluav taws xob. | 2026-11-15 | machine-drafted, needs native review |
| `next` | hmn | Next | Tom ntej | 2026-11-15 | machine-drafted, needs native review |
| `review` | hmn | Review | Tshuaj xyuas | 2026-11-15 | machine-drafted, needs native review |
| `submitApplication` | hmn | Submit Application | Xa ntawv thov | 2026-11-15 | machine-drafted, needs native review |
| `savingDraft` | hmn | Saving your answers… | Tab tom khaws koj cov lus teb… | 2026-11-15 | machine-drafted, needs native review |
| `submitting` | hmn | Submitting your application… | Tab tom xa koj daim ntawv thov… | 2026-11-15 | machine-drafted, needs native review |
| `submitFailed` | hmn | We couldn’t submit your application. Please try again. | Peb xa tsis tau koj daim ntawv thov. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `loadingPdf` | hmn | Loading PDF... | Tab tom thauj PDF... | 2026-11-15 | machine-drafted, needs native review |
| `loadPdfFailed` | hmn | Failed to load PDF | Thauj tsis tau PDF | 2026-11-15 | machine-drafted, needs native review |
| `loadPdfFailedBody` | hmn | This PDF couldn’t be opened. It may be damaged or protected. | Qhib tsis tau daim PDF no. Tej zaum nws puas lossis raug tiv thaiv. | 2026-11-15 | machine-drafted, needs native review |
| `renderFailed` | hmn | Part of this PDF couldn’t be displayed. | Qhia tsis tau ib feem ntawm daim PDF no. | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | hmn | We couldn’t save your changes. Please try again. | Peb khaws tsis tau koj cov kev hloov. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `fillFailed` | hmn | Fill from Profile didn’t work for this PDF. | Sau ntawm profile tsis ua haujlwm rau daim PDF no. | 2026-11-15 | machine-drafted, needs native review |
| `toolbarLabel` | hmn | PDF tools | Cov cuab yeej PDF | 2026-11-15 | machine-drafted, needs native review |
| `addTextBox` | hmn | Add Text Box | Ntxiv lub thawv ntawv | 2026-11-15 | machine-drafted, needs native review |
| `placing` | hmn | Click Page to Place | Nias nplooj ntawv kom muab tso | 2026-11-15 | machine-drafted, needs native review |
| `placingHint` | hmn | Click a page to place a text box. | Nias ib nplooj ntawv kom muab ib lub thawv ntawv tso. | 2026-11-15 | machine-drafted, needs native review |
| `fillFromProfile` | hmn | Fill from Profile | Sau ntawm profile | 2026-11-15 | machine-drafted, needs native review |
| `fillFromProfileHint` | hmn | Fills the PDF’s fields from your saved profile. | Sau cov chaw hauv PDF ntawm koj profile uas khaws cia. | 2026-11-15 | machine-drafted, needs native review |
| `textSize` | hmn | Size: | Loj: | 2026-11-15 | machine-drafted, needs native review |
| `savePdf` | hmn | Save PDF | Khaws PDF | 2026-11-15 | machine-drafted, needs native review |
| `renderingPages` | hmn | Rendering pages... | Tab tom qhia cov nplooj ntawv... | 2026-11-15 | machine-drafted, needs native review |
| `removeTextBox` | hmn | Remove text box | Tshem lub thawv ntawv | 2026-11-15 | machine-drafted, needs native review |
| `pageLabel` | hmn | Page {n} | Nplooj {n} | 2026-11-15 | machine-drafted, needs native review |
| `applicationSubmitted` | hmn | Application submitted. | Xa daim ntawv thov lawm. | 2026-11-15 | machine-drafted, needs native review |
| `draftSaveFailed` | hmn | We couldn’t save your answers. They are still here; please try again. | Peb khaws tsis tau koj cov lus teb. Lawv tseem nyob ntawm no; thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `notAnswered` | hmn | Not answered | Tsis tau teb | 2026-11-15 | machine-drafted, needs native review |
| `statusExpired` | hmn | Expired | Tas sij hawm lawm | 2026-11-15 | machine-drafted, needs native review |
| `FORMS_MORE_DOCUMENTS.other` | ht | +{n} more documents | +{n} lòt dokiman | 2026-11-15 | machine-drafted, needs native review |
| `FORMS_MORE_DOCUMENTS.one` | so | +{n} more document | +{n} dukumenti oo kale | 2026-11-15 | machine-drafted, needs native review |
| `FORMS_MORE_DOCUMENTS.other` | so | +{n} more documents | +{n} dukumenti oo kale | 2026-11-15 | machine-drafted, needs native review |
| `FORMS_MORE_DOCUMENTS.one` | am | +{n} more document | +{n} ተጨማሪ ሰነድ | 2026-11-15 | machine-drafted, needs native review |
| `FORMS_MORE_DOCUMENTS.other` | am | +{n} more documents | +{n} ተጨማሪ ሰነዶች | 2026-11-15 | machine-drafted, needs native review |
| `FORMS_MORE_DOCUMENTS.other` | hmn | +{n} more documents | +{n} daim ntxiv | 2026-11-15 | machine-drafted, needs native review |
| `FORMS_FILLED_FIELDS.other` | ht | Filled {filled} of {n} fields | Ranpli {filled} sou {n} chan | 2026-11-15 | machine-drafted, needs native review |
| `FORMS_FILLED_FIELDS.one` | so | Filled {filled} of {n} field | Waa la buuxiyay {filled} ka mid ah {n} goob | 2026-11-15 | machine-drafted, needs native review |
| `FORMS_FILLED_FIELDS.other` | so | Filled {filled} of {n} fields | Waa la buuxiyay {filled} ka mid ah {n} goobood | 2026-11-15 | machine-drafted, needs native review |
| `FORMS_FILLED_FIELDS.one` | am | Filled {filled} of {n} field | ከ{n} መስክ {filled} ተሞልቷል | 2026-11-15 | machine-drafted, needs native review |
| `FORMS_FILLED_FIELDS.other` | am | Filled {filled} of {n} fields | ከ{n} መስኮች {filled} ተሞልተዋል | 2026-11-15 | machine-drafted, needs native review |
| `FORMS_FILLED_FIELDS.other` | hmn | Filled {filled} of {n} fields | Sau tau {filled} ntawm {n} qhov chaw | 2026-11-15 | machine-drafted, needs native review |

### `lib/i18n-friendly-error.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `permission` | ht | You don't have permission to view this right now. Please try again or contact support. | Ou pa gen pèmisyon pou wè sa kounye a. Tanpri eseye ankò oswa kontakte sipò. | 2026-10-11 | machine-drafted, needs native review |
| `connection` | ht | We're having trouble connecting. Please check your connection and try again. | Nou gen pwoblèm pou konekte. Tanpri verifye koneksyon ou epi eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `permission` | so | You don't have permission to view this right now. Please try again or contact support. | Hadda ma haysatid oggolaansho aad ku aragto tan. Fadlan mar kale isku day ama la xiriir taageerada. | 2026-10-11 | machine-drafted, needs native review |
| `connection` | so | We're having trouble connecting. Please check your connection and try again. | Waxaa naga jira dhibaato isku xirka ah. Fadlan hubi xiriirkaaga oo mar kale isku day. | 2026-10-11 | machine-drafted, needs native review |
| `permission` | am | You don't have permission to view this right now. Please try again or contact support. | ይህን አሁን ለማየት ፈቃድ የለዎትም። እባክዎ እንደገና ይሞክሩ ወይም ድጋፍን ያግኙ። | 2026-10-11 | machine-drafted, needs native review |
| `connection` | am | We're having trouble connecting. Please check your connection and try again. | ለመገናኘት ችግር አጋጥሞናል። እባክዎ ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `permission` | hmn | You don't have permission to view this right now. Please try again or contact support. | Tam sim no koj tsis muaj cai saib qhov no. Thov sim dua los yog hu rau kev pab. | 2026-10-11 | machine-drafted, needs native review |
| `connection` | hmn | We're having trouble connecting. Please check your connection and try again. | Peb muaj teeb meem txuas. Thov xyuas koj txoj kev txuas thiab sim dua. | 2026-10-11 | machine-drafted, needs native review |

### `lib/i18n-get-help.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `subtitle` | ht | Select a category to get personalized help from the AI assistant. | Chwazi yon kategori pou asistan IA a ka ede w selon bezwen ou. | 2026-11-15 | machine-drafted, needs native review |
| `hintChooseOne` | ht | Choose one. | Chwazi youn. | 2026-11-15 | machine-drafted, needs native review |
| `hintChooseAll` | ht | Choose all that apply. | Chwazi tout sa ki konsène w. | 2026-11-15 | machine-drafted, needs native review |
| `chooseAtLeastOne` | ht | Choose at least one to continue. | Chwazi omwen youn pou kontinye. | 2026-11-15 | machine-drafted, needs native review |
| `filterLabel` | ht | Filter the list | Filtre lis la | 2026-11-15 | machine-drafted, needs native review |
| `filterNone` | ht | No matches. | Pa gen anyen ki koresponn. | 2026-11-15 | machine-drafted, needs native review |
| `qStateLocated` | ht | What state are you located in? | Nan ki eta ou ye? | 2026-11-15 | machine-drafted, needs native review |
| `qWouldPreferBeContacted` | ht | How would you prefer to be contacted? | Ki jan ou pito yo kontakte w? | 2026-11-15 | machine-drafted, needs native review |
| `oPhoneCall` | ht | Phone call | Apèl telefòn | 2026-11-15 | machine-drafted, needs native review |
| `oTextMessage` | ht | Text message | Mesaj tèks | 2026-11-15 | machine-drafted, needs native review |
| `oEmail` | ht | Email | Imèl | 2026-11-15 | machine-drafted, needs native review |
| `oPersonVisit` | ht | In-person visit | Vizit an pèsòn | 2026-11-15 | machine-drafted, needs native review |
| `oNoPreference` | ht | No preference | Pa gen preferans | 2026-11-15 | machine-drafted, needs native review |
| `descFood` | ht | SNAP, food pantries, free meals, and more | SNAP, bank manje, manje gratis, ak plis ankò | 2026-11-15 | machine-drafted, needs native review |
| `qTypeFoodAssistance` | ht | What type of food assistance are you looking for? | Ki kalite èd manje w ap chèche? | 2026-11-15 | machine-drafted, needs native review |
| `oSnapEbtBenefits` | ht | SNAP / EBT benefits | Benefis SNAP / EBT | 2026-11-15 | machine-drafted, needs native review |
| `oFoodPantries` | ht | Food pantries | Bank manje | 2026-11-15 | machine-drafted, needs native review |
| `oFreeMeals` | ht | Free meals | Manje gratis | 2026-11-15 | machine-drafted, needs native review |
| `oWicProgram` | ht | WIC program | Pwogram WIC | 2026-11-15 | machine-drafted, needs native review |
| `oSchoolMeals` | ht | School meals | Manje lekòl | 2026-11-15 | machine-drafted, needs native review |
| `oCommunityGardens` | ht | Community gardens | Jaden kominotè | 2026-11-15 | machine-drafted, needs native review |
| `qManyPeopleHousehold` | ht | How many people are in your household? | Konbyen moun ki nan kay ou? | 2026-11-15 | machine-drafted, needs native review |
| `o1Person` | ht | 1 person | 1 moun | 2026-11-15 | machine-drafted, needs native review |
| `o2People` | ht | 2 people | 2 moun | 2026-11-15 | machine-drafted, needs native review |
| `o3People` | ht | 3 people | 3 moun | 2026-11-15 | machine-drafted, needs native review |
| `o4People` | ht | 4 people | 4 moun | 2026-11-15 | machine-drafted, needs native review |
| `o5People` | ht | 5 people | 5 moun | 2026-11-15 | machine-drafted, needs native review |
| `o6People` | ht | 6 people | 6 moun | 2026-11-15 | machine-drafted, needs native review |
| `o7People` | ht | 7 people | 7 moun | 2026-11-15 | machine-drafted, needs native review |
| `o8MorePeople` | ht | 8 or more people | 8 moun oswa plis | 2026-11-15 | machine-drafted, needs native review |
| `descHousing` | ht | Emergency shelter, rent help, and housing vouchers | Abri dijans, èd pou lwaye, ak koupon lojman | 2026-11-15 | machine-drafted, needs native review |
| `qTypeHousing` | ht | What type of housing help are you looking for? | Ki kalite èd lojman w ap chèche? | 2026-11-15 | machine-drafted, needs native review |
| `oEmergencyShelter` | ht | Emergency shelter | Abri dijans | 2026-11-15 | machine-drafted, needs native review |
| `oRentAssistance` | ht | Rent assistance | Èd pou lwaye | 2026-11-15 | machine-drafted, needs native review |
| `oSection8HousingVouchers` | ht | Section 8 / housing vouchers | Seksyon 8 / koupon lojman | 2026-11-15 | machine-drafted, needs native review |
| `oUtilityBill` | ht | Utility bill help | Èd pou bòdwo sèvis piblik | 2026-11-15 | machine-drafted, needs native review |
| `oHomeRepairAssistance` | ht | Home repair assistance | Èd pou repare kay | 2026-11-15 | machine-drafted, needs native review |
| `oTransitionalHousing` | ht | Transitional housing | Lojman tranzisyon | 2026-11-15 | machine-drafted, needs native review |
| `qDescribesCurrentSituation` | ht | Which best describes your current situation? | Kisa ki pi byen dekri sitiyasyon ou kounye a? | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyHomeless` | ht | Currently homeless | San kay kounye a | 2026-11-15 | machine-drafted, needs native review |
| `oAboutLoseHousing` | ht | About to lose housing | Prèt pou pèdi kay mwen | 2026-11-15 | machine-drafted, needs native review |
| `oNeedMoreAffordableHousing` | ht | Need more affordable housing | Bezwen yon kay ki pi bon mache | 2026-11-15 | machine-drafted, needs native review |
| `oNeedRepairsCurrentHome` | ht | Need repairs on current home | Bezwen reparasyon nan kay mwen | 2026-11-15 | machine-drafted, needs native review |
| `descJobs` | ht | Job search, training programs, and career support | Chèche travay, pwogram fòmasyon, ak sipò pou karyè | 2026-11-15 | machine-drafted, needs native review |
| `qTypeCareer` | ht | What type of career help are you looking for? | Ki kalite èd pou travay w ap chèche? | 2026-11-15 | machine-drafted, needs native review |
| `oJobSearch` | ht | Job search help | Èd pou chèche travay | 2026-11-15 | machine-drafted, needs native review |
| `oResumeInterviewCoaching` | ht | Resume and interview coaching | Konsèy pou CV ak entèvyou | 2026-11-15 | machine-drafted, needs native review |
| `oJobTrainingPrograms` | ht | Job training programs | Pwogram fòmasyon pou travay | 2026-11-15 | machine-drafted, needs native review |
| `oUnemploymentBenefits` | ht | Unemployment benefits | Benefis chomaj | 2026-11-15 | machine-drafted, needs native review |
| `oCareerCounseling` | ht | Career counseling | Konsèy sou karyè | 2026-11-15 | machine-drafted, needs native review |
| `oYouthEmploymentPrograms` | ht | Youth employment programs | Pwogram travay pou jèn | 2026-11-15 | machine-drafted, needs native review |
| `qWouldDescribeWorkExperience` | ht | How would you describe your work experience? | Ki jan ou ta dekri eksperyans travay ou? | 2026-11-15 | machine-drafted, needs native review |
| `oNoWorkExperienceYet` | ht | No work experience yet | Poko gen eksperyans travay | 2026-11-15 | machine-drafted, needs native review |
| `oSomeExperience` | ht | Some experience | Kèk eksperyans | 2026-11-15 | machine-drafted, needs native review |
| `oExperiencedWorker` | ht | Experienced worker | Travayè ki gen eksperyans | 2026-11-15 | machine-drafted, needs native review |
| `oCareerChange` | ht | Looking for a career change | Mwen vle chanje karyè | 2026-11-15 | machine-drafted, needs native review |
| `descTransportation` | ht | Bus passes, ride programs, and gas assistance | Kat bis, pwogram transpò, ak èd pou gaz | 2026-11-15 | machine-drafted, needs native review |
| `qTypeTransportation` | ht | What type of transportation help are you looking for? | Ki kalite èd transpò w ap chèche? | 2026-11-15 | machine-drafted, needs native review |
| `oBusTransitPasses` | ht | Bus / transit passes | Kat bis / transpò piblik | 2026-11-15 | machine-drafted, needs native review |
| `oCarRepairAssistance` | ht | Car repair assistance | Èd pou repare machin | 2026-11-15 | machine-drafted, needs native review |
| `oRidePrograms` | ht | Ride programs | Pwogram transpò | 2026-11-15 | machine-drafted, needs native review |
| `oGasVouchers` | ht | Gas vouchers | Koupon gaz | 2026-11-15 | machine-drafted, needs native review |
| `oVehicleDonationProgram` | ht | Vehicle donation program | Pwogram don machin | 2026-11-15 | machine-drafted, needs native review |
| `oDisabledTransportation` | ht | Disabled transportation | Transpò pou moun andikape | 2026-11-15 | machine-drafted, needs native review |
| `qOftenNeedTransportationSupport` | ht | How often do you need transportation support? | Konbyen fwa ou bezwen èd transpò? | 2026-11-15 | machine-drafted, needs native review |
| `oDailyWorkSchool` | ht | Daily (work / school) | Chak jou (travay / lekòl) | 2026-11-15 | machine-drafted, needs native review |
| `oSeveralTimesWeek` | ht | Several times a week | Plizyè fwa pa semèn | 2026-11-15 | machine-drafted, needs native review |
| `oOccasionalTrips` | ht | Occasional trips | Kèk vwayaj de tanzantan | 2026-11-15 | machine-drafted, needs native review |
| `oOneTimeNeed` | ht | One-time need | Yon sèl fwa | 2026-11-15 | machine-drafted, needs native review |
| `descLegal` | ht | Free legal aid for housing, family, and benefits | Èd legal gratis pou lojman, fanmi, ak benefis | 2026-11-15 | machine-drafted, needs native review |
| `qTypeLegal` | ht | What type of legal help are you looking for? | Ki kalite èd legal w ap chèche? | 2026-11-15 | machine-drafted, needs native review |
| `oTenantRightsEviction` | ht | Tenant rights / eviction | Dwa lokatè / degèpisman | 2026-11-15 | machine-drafted, needs native review |
| `oFamilyLaw` | ht | Family law | Dwa fanmi | 2026-11-15 | machine-drafted, needs native review |
| `oImmigration` | ht | Immigration | Imigrasyon | 2026-11-15 | machine-drafted, needs native review |
| `oCriminalRecordExpungement` | ht | Criminal record expungement | Efase dosye kriminèl | 2026-11-15 | machine-drafted, needs native review |
| `oBenefitsAppeals` | ht | Benefits appeals | Apèl pou benefis | 2026-11-15 | machine-drafted, needs native review |
| `oConsumerProtection` | ht | Consumer protection | Pwoteksyon konsomatè | 2026-11-15 | machine-drafted, needs native review |
| `qUrgentLegalSituation` | ht | How urgent is your legal situation? | Ki jan sitiyasyon legal ou ijan? | 2026-11-15 | machine-drafted, needs native review |
| `oImmediateCourtDateDeadlineThis` | ht | Immediate (court date / deadline this week) | Imedyat (dat tribinal / dat limit semèn sa a) | 2026-11-15 | machine-drafted, needs native review |
| `oUrgentWithinNextMonth` | ht | Urgent (within the next month) | Ijan (nan mwa k ap vini an) | 2026-11-15 | machine-drafted, needs native review |
| `oNotUrgentJustNeedGuidance` | ht | Not urgent, just need guidance | Pa ijan, mwen jis bezwen konsèy | 2026-11-15 | machine-drafted, needs native review |
| `oJustExploringMyOptions` | ht | Just exploring my options | M ap jis gade opsyon mwen yo | 2026-11-15 | machine-drafted, needs native review |
| `descHealthcare` | ht | Free clinics, Medicaid, prescriptions, and mental health | Klinik gratis, Medicaid, medikaman, ak sante mantal | 2026-11-15 | machine-drafted, needs native review |
| `qTypeHealthcare` | ht | What type of healthcare help are you looking for? | Ki kalite èd swen sante w ap chèche? | 2026-11-15 | machine-drafted, needs native review |
| `oMedicaidMedicareEnrollment` | ht | Medicaid / Medicare enrollment | Enskripsyon Medicaid / Medicare | 2026-11-15 | machine-drafted, needs native review |
| `oFreeLowCostClinics` | ht | Free or low-cost clinics | Klinik gratis oswa bon mache | 2026-11-15 | machine-drafted, needs native review |
| `oPrescriptionAssistance` | ht | Prescription assistance | Èd pou medikaman sou preskripsyon | 2026-11-15 | machine-drafted, needs native review |
| `oMentalHealthServices` | ht | Mental health services | Sèvis sante mantal | 2026-11-15 | machine-drafted, needs native review |
| `oDentalCare` | ht | Dental care | Swen dan | 2026-11-15 | machine-drafted, needs native review |
| `oVisionCare` | ht | Vision care | Swen je | 2026-11-15 | machine-drafted, needs native review |
| `qCurrentInsuranceStatus` | ht | What is your current insurance status? | Ki sitiyasyon asirans ou kounye a? | 2026-11-15 | machine-drafted, needs native review |
| `oNoInsurance` | ht | No insurance | Pa gen asirans | 2026-11-15 | machine-drafted, needs native review |
| `oPrivateInsurance` | ht | Private insurance | Asirans prive | 2026-11-15 | machine-drafted, needs native review |
| `oEmployerInsurance` | ht | Employer insurance | Asirans patwon | 2026-11-15 | machine-drafted, needs native review |
| `descEitcTaxFiling` | ht | Free tax prep, EITC refunds, and filing assistance | Preparasyon taks gratis, ranbousman EITC, ak èd pou deklarasyon | 2026-11-15 | machine-drafted, needs native review |
| `qTaxFilingStatus` | ht | What is your tax filing status? | Ki estati deklarasyon taks ou? | 2026-11-15 | machine-drafted, needs native review |
| `oSingle` | ht | Single | Selibatè | 2026-11-15 | machine-drafted, needs native review |
| `oMarriedFilingJointly` | ht | Married filing jointly | Marye, deklarasyon ansanm | 2026-11-15 | machine-drafted, needs native review |
| `oMarriedFilingSeparately` | ht | Married filing separately | Marye, deklarasyon separe | 2026-11-15 | machine-drafted, needs native review |
| `oHeadHousehold` | ht | Head of household | Chèf fanmi | 2026-11-15 | machine-drafted, needs native review |
| `oQualifyingSurvivingSpouse` | ht | Qualifying surviving spouse | Konjwen ki siviv ki kalifye | 2026-11-15 | machine-drafted, needs native review |
| `qApproximateAnnualHouseholdIncome` | ht | What is your approximate annual household income? | Konbyen revni anyèl kay ou apeprè? | 2026-11-15 | machine-drafted, needs native review |
| `qManyQualifyingChildrenDependentsHave` | ht | How many qualifying children or dependents do you have? | Konbyen timoun oswa moun ki depann de ou ki kalifye ou genyen? | 2026-11-15 | machine-drafted, needs native review |
| `oNone` | ht | None | Okenn | 2026-11-15 | machine-drafted, needs native review |
| `o1Child` | ht | 1 child | 1 timoun | 2026-11-15 | machine-drafted, needs native review |
| `o2Children` | ht | 2 children | 2 timoun | 2026-11-15 | machine-drafted, needs native review |
| `o3MoreChildren` | ht | 3 or more children | 3 timoun oswa plis | 2026-11-15 | machine-drafted, needs native review |
| `descFreeLegal` | ht | Legal aid clinics, pro bono attorneys, and self-help resources | Klinik èd legal, avoka pro bono, ak resous pou ede tèt ou | 2026-11-15 | machine-drafted, needs native review |
| `qTypeLegalIssueNeedWith` | ht | What type of legal issue do you need help with? | Ak ki kalite pwoblèm legal ou bezwen èd? | 2026-11-15 | machine-drafted, needs native review |
| `oEvictionHousingCourt` | ht | Eviction or housing court | Degèpisman oswa tribinal lojman | 2026-11-15 | machine-drafted, needs native review |
| `oDomesticViolenceProtectionOrder` | ht | Domestic violence protection order | Lòd pwoteksyon kont vyolans domestik | 2026-11-15 | machine-drafted, needs native review |
| `oChildCustodySupport` | ht | Child custody or support | Gad timoun oswa pansyon alimantè | 2026-11-15 | machine-drafted, needs native review |
| `oImmigrationDaca` | ht | Immigration or DACA | Imigrasyon oswa DACA | 2026-11-15 | machine-drafted, needs native review |
| `oBenefitsDenialAppeal` | ht | Benefits denial or appeal | Refi oswa apèl pou benefis | 2026-11-15 | machine-drafted, needs native review |
| `oImmediateCourtDateOrDeadline` | ht | Immediate (court date or deadline this week) | Imedyat (dat tribinal oswa dat limit semèn sa a) | 2026-11-15 | machine-drafted, needs native review |
| `oUrgentWithinNext30Days` | ht | Urgent (within the next 30 days) | Ijan (nan 30 jou k ap vini yo) | 2026-11-15 | machine-drafted, needs native review |
| `oNotUrgentNeedGeneralGuidance` | ht | Not urgent, need general guidance | Pa ijan, mwen bezwen konsèy jeneral | 2026-11-15 | machine-drafted, needs native review |
| `descPrenatalNatalCare` | ht | Prenatal visits, WIC, newborn support, and postpartum care | Vizit prenatal, WIC, sipò pou tibebe, ak swen apre akouchman | 2026-11-15 | machine-drafted, needs native review |
| `qTypeSupport` | ht | What type of support are you looking for? | Ki kalite sipò w ap chèche? | 2026-11-15 | machine-drafted, needs native review |
| `oPrenatalCheckupsUltrasounds` | ht | Prenatal checkups and ultrasounds | Egzamen prenatal ak ekografi | 2026-11-15 | machine-drafted, needs native review |
| `oWicNutritionProgram` | ht | WIC nutrition program | Pwogram nitrisyon WIC | 2026-11-15 | machine-drafted, needs native review |
| `oBirthingCenterHospitalFinancial` | ht | Birthing center or hospital financial help | Èd finansye pou sant akouchman oswa lopital | 2026-11-15 | machine-drafted, needs native review |
| `oPostpartumMentalHealthSupport` | ht | Postpartum mental health support | Sipò sante mantal apre akouchman | 2026-11-15 | machine-drafted, needs native review |
| `oNewbornCareSupplies` | ht | Newborn care and supplies | Swen ak founiti pou tibebe | 2026-11-15 | machine-drafted, needs native review |
| `oLactationBreastfeedingSupport` | ht | Lactation / breastfeeding support | Sipò pou bay tete | 2026-11-15 | machine-drafted, needs native review |
| `qStageDescribesCurrentSituation` | ht | What stage best describes your current situation? | Ki etap ki pi byen dekri sitiyasyon ou kounye a? | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyPregnant1stTrimester` | ht | Currently pregnant (1st trimester) | Ansent kounye a (1ye trimès) | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyPregnant2ndTrimester` | ht | Currently pregnant (2nd trimester) | Ansent kounye a (2yèm trimès) | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyPregnant3rdTrimester` | ht | Currently pregnant (3rd trimester) | Ansent kounye a (3yèm trimès) | 2026-11-15 | machine-drafted, needs native review |
| `oRecentlyGaveBirthWithin3` | ht | Recently gave birth (within 3 months) | Fèk akouche (nan 3 mwa) | 2026-11-15 | machine-drafted, needs native review |
| `oPlanningPregnancy` | ht | Planning a pregnancy | M ap planifye yon gwosès | 2026-11-15 | machine-drafted, needs native review |
| `descWasteDisposal` | ht | Bulk trash pickup, hazardous waste drop-off, and recycling help | Ranmase gwo fatra, depo dechè danjere, ak èd pou resiklaj | 2026-11-15 | machine-drafted, needs native review |
| `qTypeWasteDisposalNeed` | ht | What type of waste or disposal help do you need? | Ki kalite èd pou fatra oswa jete ou bezwen? | 2026-11-15 | machine-drafted, needs native review |
| `oBulkItemFurnitureRemoval` | ht | Bulk item or furniture removal | Retire gwo bagay oswa mèb | 2026-11-15 | machine-drafted, needs native review |
| `oHouseholdHazardousWastePaintChemicals` | ht | Household hazardous waste (paint, chemicals) | Dechè danjere lakay (penti, pwodui chimik) | 2026-11-15 | machine-drafted, needs native review |
| `oElectronicsRecyclingEWaste` | ht | Electronics recycling (e-waste) | Resiklaj aparèy elektwonik (dechè elektwonik) | 2026-11-15 | machine-drafted, needs native review |
| `oMedicalSharpsMedicationDisposal` | ht | Medical sharps or medication disposal | Jete zegwi medikal oswa medikaman | 2026-11-15 | machine-drafted, needs native review |
| `oYardWasteCompost` | ht | Yard waste or compost | Fatra lakou oswa konpòs | 2026-11-15 | machine-drafted, needs native review |
| `oGeneralRecyclingAccess` | ht | General recycling access | Aksè jeneral pou resiklaj | 2026-11-15 | machine-drafted, needs native review |
| `qDescribesSituation` | ht | Which best describes your situation? | Kisa ki pi byen dekri sitiyasyon ou? | 2026-11-15 | machine-drafted, needs native review |
| `oOneTimeLargeCleanout` | ht | One-time large cleanout | Yon gwo netwayaj yon sèl fwa | 2026-11-15 | machine-drafted, needs native review |
| `oOngoingDisposalNeed` | ht | Ongoing disposal need | Bezwen jete fatra regilyèman | 2026-11-15 | machine-drafted, needs native review |
| `oRespondingNaturalDisasterEmergency` | ht | Responding to a natural disaster or emergency | Apre yon dezas natirèl oswa yon ijans | 2026-11-15 | machine-drafted, needs native review |
| `oMovingEvictionCleanup` | ht | Moving or eviction cleanup | Netwayaj pou demenajman oswa degèpisman | 2026-11-15 | machine-drafted, needs native review |
| `descFreeCamping` | ht | Free campsites, dispersed camping, and overnight shelters | Kan gratis, kan nan nati, ak abri pou pase nwit | 2026-11-15 | machine-drafted, needs native review |
| `qTypeCampingOvernightShelter` | ht | What type of camping or overnight shelter are you looking for? | Ki kalite kan oswa abri pou nwit w ap chèche? | 2026-11-15 | machine-drafted, needs native review |
| `oFreeDispersedPrimitiveCampingPublic` | ht | Free dispersed (primitive) camping on public land | Kan gratis nan nati (primitif) sou tè piblik | 2026-11-15 | machine-drafted, needs native review |
| `oFreeDesignatedCampsitesNationalForest` | ht | Free designated campsites (national forest, BLM) | Kote kan gratis ki deziyen (forè nasyonal, BLM) | 2026-11-15 | machine-drafted, needs native review |
| `oSafeOvernightParkingVehicle` | ht | Safe overnight parking for a vehicle | Pakin an sekirite pou yon machin pandan nwit | 2026-11-15 | machine-drafted, needs native review |
| `oEmergencyOvernightShelter` | ht | Emergency overnight shelter | Abri dijans pou nwit | 2026-11-15 | machine-drafted, needs native review |
| `oLongTermCampingWhileAwaiting` | ht | Long-term camping while awaiting housing | Kan alontèm pandan m ap tann yon kay | 2026-11-15 | machine-drafted, needs native review |
| `qLongNeedCampStay` | ht | How long do you need to camp or stay? | Konbyen tan ou bezwen kan oswa rete? | 2026-11-15 | machine-drafted, needs native review |
| `o12Nights` | ht | 1–2 nights | 1–2 nwit | 2026-11-15 | machine-drafted, needs native review |
| `oFewDaysUpWeek` | ht | A few days (up to a week) | Kèk jou (jiska yon semèn) | 2026-11-15 | machine-drafted, needs native review |
| `o14Weeks` | ht | 1–4 weeks | 1–4 semèn | 2026-11-15 | machine-drafted, needs native review |
| `oMoreThanMonth` | ht | More than a month | Plis pase yon mwa | 2026-11-15 | machine-drafted, needs native review |
| `descFreeGoodsDonation` | ht | Free clothing, furniture, household items, and donation programs | Rad, mèb, bagay pou kay gratis, ak pwogram don | 2026-11-15 | machine-drafted, needs native review |
| `qTypesGoods` | ht | What types of goods are you looking for? | Ki kalite bagay w ap chèche? | 2026-11-15 | machine-drafted, needs native review |
| `oClothingShoes` | ht | Clothing and shoes | Rad ak soulye | 2026-11-15 | machine-drafted, needs native review |
| `oFurnitureHomeGoods` | ht | Furniture and home goods | Mèb ak bagay pou kay | 2026-11-15 | machine-drafted, needs native review |
| `oBabyChildrenItems` | ht | Baby and children items | Bagay pou tibebe ak timoun | 2026-11-15 | machine-drafted, needs native review |
| `oElectronicsAppliances` | ht | Electronics and appliances | Aparèy elektwonik ak aparèy menaje | 2026-11-15 | machine-drafted, needs native review |
| `oHygienePersonalCareItems` | ht | Hygiene and personal care items | Pwodui ijyèn ak swen pèsonèl | 2026-11-15 | machine-drafted, needs native review |
| `oSchoolSupplies` | ht | School supplies | Founiti lekòl | 2026-11-15 | machine-drafted, needs native review |
| `oSettingUpNewHome` | ht | Setting up a new home | M ap enstale nan yon nouvo kay | 2026-11-15 | machine-drafted, needs native review |
| `oLostBelongingsFireFloodDisaster` | ht | Lost belongings (fire, flood, disaster) | Mwen pèdi afè m (dife, inondasyon, dezas) | 2026-11-15 | machine-drafted, needs native review |
| `oExperiencingFinancialHardship` | ht | Experiencing financial hardship | M gen difikilte finansye | 2026-11-15 | machine-drafted, needs native review |
| `oTransitioningOutShelterFacility` | ht | Transitioning out of shelter or facility | M ap soti nan yon abri oswa yon sant | 2026-11-15 | machine-drafted, needs native review |
| `subtitle` | so | Select a category to get personalized help from the AI assistant. | Dooro qayb si kaaliyaha AI uu kuugu caawiyo si gaar ah. | 2026-11-15 | machine-drafted, needs native review |
| `hintChooseOne` | so | Choose one. | Dooro mid. | 2026-11-15 | machine-drafted, needs native review |
| `hintChooseAll` | so | Choose all that apply. | Dooro dhammaan kuwa ku khuseeya. | 2026-11-15 | machine-drafted, needs native review |
| `chooseAtLeastOne` | so | Choose at least one to continue. | Dooro ugu yaraan mid si aad u sii wadato. | 2026-11-15 | machine-drafted, needs native review |
| `filterLabel` | so | Filter the list | Shaandhee liiska | 2026-11-15 | machine-drafted, needs native review |
| `filterNone` | so | No matches. | Wax ku habboon lama helin. | 2026-11-15 | machine-drafted, needs native review |
| `qStateLocated` | so | What state are you located in? | Gobolkee ayaad ku nooshahay? | 2026-11-15 | machine-drafted, needs native review |
| `qWouldPreferBeContacted` | so | How would you prefer to be contacted? | Sidee ayaad doorbidaysaa in lagula soo xiriiro? | 2026-11-15 | machine-drafted, needs native review |
| `oPhoneCall` | so | Phone call | Wicitaan taleefan | 2026-11-15 | machine-drafted, needs native review |
| `oTextMessage` | so | Text message | Fariin qoraal ah | 2026-11-15 | machine-drafted, needs native review |
| `oEmail` | so | Email | Iimayl | 2026-11-15 | machine-drafted, needs native review |
| `oPersonVisit` | so | In-person visit | Booqasho fool ka fool ah | 2026-11-15 | machine-drafted, needs native review |
| `oNoPreference` | so | No preference | Doorbid ma leh | 2026-11-15 | machine-drafted, needs native review |
| `descFood` | so | SNAP, food pantries, free meals, and more | SNAP, bakhaarada cuntada, cuntooyin bilaash ah, iyo wax kale | 2026-11-15 | machine-drafted, needs native review |
| `qTypeFoodAssistance` | so | What type of food assistance are you looking for? | Noocee caawimaad cunto ah ayaad raadinaysaa? | 2026-11-15 | machine-drafted, needs native review |
| `oSnapEbtBenefits` | so | SNAP / EBT benefits | Gargaarka SNAP / EBT | 2026-11-15 | machine-drafted, needs native review |
| `oFoodPantries` | so | Food pantries | Bakhaarada cuntada | 2026-11-15 | machine-drafted, needs native review |
| `oFreeMeals` | so | Free meals | Cuntooyin bilaash ah | 2026-11-15 | machine-drafted, needs native review |
| `oWicProgram` | so | WIC program | Barnaamijka WIC | 2026-11-15 | machine-drafted, needs native review |
| `oSchoolMeals` | so | School meals | Cuntada dugsiga | 2026-11-15 | machine-drafted, needs native review |
| `oCommunityGardens` | so | Community gardens | Beero bulsho | 2026-11-15 | machine-drafted, needs native review |
| `qManyPeopleHousehold` | so | How many people are in your household? | Immisa qof ayaa ku nool gurigaaga? | 2026-11-15 | machine-drafted, needs native review |
| `o1Person` | so | 1 person | 1 qof | 2026-11-15 | machine-drafted, needs native review |
| `o2People` | so | 2 people | 2 qof | 2026-11-15 | machine-drafted, needs native review |
| `o3People` | so | 3 people | 3 qof | 2026-11-15 | machine-drafted, needs native review |
| `o4People` | so | 4 people | 4 qof | 2026-11-15 | machine-drafted, needs native review |
| `o5People` | so | 5 people | 5 qof | 2026-11-15 | machine-drafted, needs native review |
| `o6People` | so | 6 people | 6 qof | 2026-11-15 | machine-drafted, needs native review |
| `o7People` | so | 7 people | 7 qof | 2026-11-15 | machine-drafted, needs native review |
| `o8MorePeople` | so | 8 or more people | 8 qof ama ka badan | 2026-11-15 | machine-drafted, needs native review |
| `descHousing` | so | Emergency shelter, rent help, and housing vouchers | Hoy degdeg ah, caawimaad kiro, iyo foojarada guryaha | 2026-11-15 | machine-drafted, needs native review |
| `qTypeHousing` | so | What type of housing help are you looking for? | Noocee caawimaad guri ah ayaad raadinaysaa? | 2026-11-15 | machine-drafted, needs native review |
| `oEmergencyShelter` | so | Emergency shelter | Hoy degdeg ah | 2026-11-15 | machine-drafted, needs native review |
| `oRentAssistance` | so | Rent assistance | Caawimaad kiro | 2026-11-15 | machine-drafted, needs native review |
| `oSection8HousingVouchers` | so | Section 8 / housing vouchers | Qaybta 8 / foojarada guryaha | 2026-11-15 | machine-drafted, needs native review |
| `oUtilityBill` | so | Utility bill help | Caawimaad biilasha adeegyada | 2026-11-15 | machine-drafted, needs native review |
| `oHomeRepairAssistance` | so | Home repair assistance | Caawimaad dayactirka guriga | 2026-11-15 | machine-drafted, needs native review |
| `oTransitionalHousing` | so | Transitional housing | Guri ku-meel-gaar ah | 2026-11-15 | machine-drafted, needs native review |
| `qDescribesCurrentSituation` | so | Which best describes your current situation? | Maxaa sida ugu fiican u qeexaya xaaladdaada hadda? | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyHomeless` | so | Currently homeless | Hadda guri la’aan | 2026-11-15 | machine-drafted, needs native review |
| `oAboutLoseHousing` | so | About to lose housing | Waxaan ku dhow ahay inaan guriga waayo | 2026-11-15 | machine-drafted, needs native review |
| `oNeedMoreAffordableHousing` | so | Need more affordable housing | Waxaan u baahanahay guri ka jaban | 2026-11-15 | machine-drafted, needs native review |
| `oNeedRepairsCurrentHome` | so | Need repairs on current home | Gurigayga hadda wuxuu u baahan yahay dayactir | 2026-11-15 | machine-drafted, needs native review |
| `descJobs` | so | Job search, training programs, and career support | Raadinta shaqo, barnaamijyo tababar, iyo taageero xirfadeed | 2026-11-15 | machine-drafted, needs native review |
| `qTypeCareer` | so | What type of career help are you looking for? | Noocee caawimaad shaqo ah ayaad raadinaysaa? | 2026-11-15 | machine-drafted, needs native review |
| `oJobSearch` | so | Job search help | Caawimaad raadinta shaqo | 2026-11-15 | machine-drafted, needs native review |
| `oResumeInterviewCoaching` | so | Resume and interview coaching | Tababar CV iyo waraysi | 2026-11-15 | machine-drafted, needs native review |
| `oJobTrainingPrograms` | so | Job training programs | Barnaamijyo tababar shaqo | 2026-11-15 | machine-drafted, needs native review |
| `oUnemploymentBenefits` | so | Unemployment benefits | Gargaarka shaqo la’aanta | 2026-11-15 | machine-drafted, needs native review |
| `oCareerCounseling` | so | Career counseling | La-talin xirfadeed | 2026-11-15 | machine-drafted, needs native review |
| `oYouthEmploymentPrograms` | so | Youth employment programs | Barnaamijyo shaqo dhallinyarada | 2026-11-15 | machine-drafted, needs native review |
| `qWouldDescribeWorkExperience` | so | How would you describe your work experience? | Sidee u qeexi lahayd khibraddaada shaqo? | 2026-11-15 | machine-drafted, needs native review |
| `oNoWorkExperienceYet` | so | No work experience yet | Weli khibrad shaqo ma lihi | 2026-11-15 | machine-drafted, needs native review |
| `oSomeExperience` | so | Some experience | Khibrad yar | 2026-11-15 | machine-drafted, needs native review |
| `oExperiencedWorker` | so | Experienced worker | Shaqaale khibrad leh | 2026-11-15 | machine-drafted, needs native review |
| `oCareerChange` | so | Looking for a career change | Waxaan doonayaa inaan xirfad beddelo | 2026-11-15 | machine-drafted, needs native review |
| `descTransportation` | so | Bus passes, ride programs, and gas assistance | Tigidhada baska, barnaamijyo gaadiid, iyo caawimaad shidaal | 2026-11-15 | machine-drafted, needs native review |
| `qTypeTransportation` | so | What type of transportation help are you looking for? | Noocee caawimaad gaadiid ah ayaad raadinaysaa? | 2026-11-15 | machine-drafted, needs native review |
| `oBusTransitPasses` | so | Bus / transit passes | Tigidhada baska / gaadiidka dadweynaha | 2026-11-15 | machine-drafted, needs native review |
| `oCarRepairAssistance` | so | Car repair assistance | Caawimaad dayactirka baabuurta | 2026-11-15 | machine-drafted, needs native review |
| `oRidePrograms` | so | Ride programs | Barnaamijyo gaadiid | 2026-11-15 | machine-drafted, needs native review |
| `oGasVouchers` | so | Gas vouchers | Foojarada shidaalka | 2026-11-15 | machine-drafted, needs native review |
| `oVehicleDonationProgram` | so | Vehicle donation program | Barnaamijka deeqda baabuurta | 2026-11-15 | machine-drafted, needs native review |
| `oDisabledTransportation` | so | Disabled transportation | Gaadiidka dadka naafada ah | 2026-11-15 | machine-drafted, needs native review |
| `qOftenNeedTransportationSupport` | so | How often do you need transportation support? | Intee jeer ayaad u baahan tahay taageero gaadiid? | 2026-11-15 | machine-drafted, needs native review |
| `oDailyWorkSchool` | so | Daily (work / school) | Maalin kasta (shaqo / dugsi) | 2026-11-15 | machine-drafted, needs native review |
| `oSeveralTimesWeek` | so | Several times a week | Dhowr jeer usbuucii | 2026-11-15 | machine-drafted, needs native review |
| `oOccasionalTrips` | so | Occasional trips | Mararka qaarkood | 2026-11-15 | machine-drafted, needs native review |
| `oOneTimeNeed` | so | One-time need | Hal mar oo keliya | 2026-11-15 | machine-drafted, needs native review |
| `descLegal` | so | Free legal aid for housing, family, and benefits | Gargaar sharci oo bilaash ah oo ku saabsan guri, qoys, iyo gargaarro | 2026-11-15 | machine-drafted, needs native review |
| `qTypeLegal` | so | What type of legal help are you looking for? | Noocee caawimaad sharci ah ayaad raadinaysaa? | 2026-11-15 | machine-drafted, needs native review |
| `oTenantRightsEviction` | so | Tenant rights / eviction | Xuquuqda kireystaha / ka saarid | 2026-11-15 | machine-drafted, needs native review |
| `oFamilyLaw` | so | Family law | Sharciga qoyska | 2026-11-15 | machine-drafted, needs native review |
| `oImmigration` | so | Immigration | Socdaalka | 2026-11-15 | machine-drafted, needs native review |
| `oCriminalRecordExpungement` | so | Criminal record expungement | Tirtiridda diiwaanka dembiga | 2026-11-15 | machine-drafted, needs native review |
| `oBenefitsAppeals` | so | Benefits appeals | Racfaanka gargaarka | 2026-11-15 | machine-drafted, needs native review |
| `oConsumerProtection` | so | Consumer protection | Ilaalinta macaamiisha | 2026-11-15 | machine-drafted, needs native review |
| `qUrgentLegalSituation` | so | How urgent is your legal situation? | Intee in le’eg ayay degdeg u tahay xaaladdaada sharci? | 2026-11-15 | machine-drafted, needs native review |
| `oImmediateCourtDateDeadlineThis` | so | Immediate (court date / deadline this week) | Isla markiiba (taariikh maxkamad / waqti kama dambays ah usbuucan) | 2026-11-15 | machine-drafted, needs native review |
| `oUrgentWithinNextMonth` | so | Urgent (within the next month) | Degdeg (bisha soo socota gudaheed) | 2026-11-15 | machine-drafted, needs native review |
| `oNotUrgentJustNeedGuidance` | so | Not urgent, just need guidance | Ma degdeg aha, kaliya waxaan u baahanahay hagitaan | 2026-11-15 | machine-drafted, needs native review |
| `oJustExploringMyOptions` | so | Just exploring my options | Kaliya waxaan eegayaa doorashooyinkayga | 2026-11-15 | machine-drafted, needs native review |
| `descHealthcare` | so | Free clinics, Medicaid, prescriptions, and mental health | Rugaha caafimaadka bilaashka ah, Medicaid, daawooyin, iyo caafimaadka maskaxda | 2026-11-15 | machine-drafted, needs native review |
| `qTypeHealthcare` | so | What type of healthcare help are you looking for? | Noocee caawimaad caafimaad ah ayaad raadinaysaa? | 2026-11-15 | machine-drafted, needs native review |
| `oMedicaidMedicareEnrollment` | so | Medicaid / Medicare enrollment | Isdiiwaangelinta Medicaid / Medicare | 2026-11-15 | machine-drafted, needs native review |
| `oFreeLowCostClinics` | so | Free or low-cost clinics | Rugaha caafimaadka bilaash ah ama raqiis ah | 2026-11-15 | machine-drafted, needs native review |
| `oPrescriptionAssistance` | so | Prescription assistance | Caawimaad daawooyinka la qoro | 2026-11-15 | machine-drafted, needs native review |
| `oMentalHealthServices` | so | Mental health services | Adeegyada caafimaadka maskaxda | 2026-11-15 | machine-drafted, needs native review |
| `oDentalCare` | so | Dental care | Daryeelka ilkaha | 2026-11-15 | machine-drafted, needs native review |
| `oVisionCare` | so | Vision care | Daryeelka indhaha | 2026-11-15 | machine-drafted, needs native review |
| `qCurrentInsuranceStatus` | so | What is your current insurance status? | Waa maxay xaaladda caymiskaaga hadda? | 2026-11-15 | machine-drafted, needs native review |
| `oNoInsurance` | so | No insurance | Caymis ma leh | 2026-11-15 | machine-drafted, needs native review |
| `oPrivateInsurance` | so | Private insurance | Caymis gaar ah | 2026-11-15 | machine-drafted, needs native review |
| `oEmployerInsurance` | so | Employer insurance | Caymiska loo-shaqeeyaha | 2026-11-15 | machine-drafted, needs native review |
| `descEitcTaxFiling` | so | Free tax prep, EITC refunds, and filing assistance | Diyaarinta canshuurta bilaash ah, celinta EITC, iyo caawimaad xaraynta | 2026-11-15 | machine-drafted, needs native review |
| `qTaxFilingStatus` | so | What is your tax filing status? | Waa maxay xaaladdaada xaraynta canshuurta? | 2026-11-15 | machine-drafted, needs native review |
| `oSingle` | so | Single | Keli | 2026-11-15 | machine-drafted, needs native review |
| `oMarriedFilingJointly` | so | Married filing jointly | Xaas leh, xarayn wadajir ah | 2026-11-15 | machine-drafted, needs native review |
| `oMarriedFilingSeparately` | so | Married filing separately | Xaas leh, xarayn gooni ah | 2026-11-15 | machine-drafted, needs native review |
| `oHeadHousehold` | so | Head of household | Madaxa qoyska | 2026-11-15 | machine-drafted, needs native review |
| `oQualifyingSurvivingSpouse` | so | Qualifying surviving spouse | Xaas nool oo u qalma | 2026-11-15 | machine-drafted, needs native review |
| `qApproximateAnnualHouseholdIncome` | so | What is your approximate annual household income? | Waa imisa qiyaas ahaan dakhliga sanadlaha ah ee qoyskaaga? | 2026-11-15 | machine-drafted, needs native review |
| `qManyQualifyingChildrenDependentsHave` | so | How many qualifying children or dependents do you have? | Immisa carruur ama dad kugu tiirsan oo u qalma ayaad leedahay? | 2026-11-15 | machine-drafted, needs native review |
| `oNone` | so | None | Midna | 2026-11-15 | machine-drafted, needs native review |
| `o1Child` | so | 1 child | 1 ilmo | 2026-11-15 | machine-drafted, needs native review |
| `o2Children` | so | 2 children | 2 carruur ah | 2026-11-15 | machine-drafted, needs native review |
| `o3MoreChildren` | so | 3 or more children | 3 carruur ah ama ka badan | 2026-11-15 | machine-drafted, needs native review |
| `descFreeLegal` | so | Legal aid clinics, pro bono attorneys, and self-help resources | Rugaha gargaarka sharciga, qareenno bilaash ah, iyo ilaha is-caawinta | 2026-11-15 | machine-drafted, needs native review |
| `qTypeLegalIssueNeedWith` | so | What type of legal issue do you need help with? | Arrin sharci oo noocee ah ayaad u baahan tahay caawimaad? | 2026-11-15 | machine-drafted, needs native review |
| `oEvictionHousingCourt` | so | Eviction or housing court | Ka saarid ama maxkamadda guryaha | 2026-11-15 | machine-drafted, needs native review |
| `oDomesticViolenceProtectionOrder` | so | Domestic violence protection order | Amarka ilaalinta rabshadaha qoyska | 2026-11-15 | machine-drafted, needs native review |
| `oChildCustodySupport` | so | Child custody or support | Haynta carruurta ama nafaqada | 2026-11-15 | machine-drafted, needs native review |
| `oImmigrationDaca` | so | Immigration or DACA | Socdaalka ama DACA | 2026-11-15 | machine-drafted, needs native review |
| `oBenefitsDenialAppeal` | so | Benefits denial or appeal | Diidmada gargaarka ama racfaan | 2026-11-15 | machine-drafted, needs native review |
| `oImmediateCourtDateOrDeadline` | so | Immediate (court date or deadline this week) | Isla markiiba (taariikh maxkamad ama waqti kama dambays ah usbuucan) | 2026-11-15 | machine-drafted, needs native review |
| `oUrgentWithinNext30Days` | so | Urgent (within the next 30 days) | Degdeg (30-ka maalmood ee soo socda gudahooda) | 2026-11-15 | machine-drafted, needs native review |
| `oNotUrgentNeedGeneralGuidance` | so | Not urgent, need general guidance | Ma degdeg aha, waxaan u baahanahay hagitaan guud | 2026-11-15 | machine-drafted, needs native review |
| `descPrenatalNatalCare` | so | Prenatal visits, WIC, newborn support, and postpartum care | Booqashooyinka uurka, WIC, taageerada dhallaanka, iyo daryeelka dhalmada kadib | 2026-11-15 | machine-drafted, needs native review |
| `qTypeSupport` | so | What type of support are you looking for? | Noocee taageero ah ayaad raadinaysaa? | 2026-11-15 | machine-drafted, needs native review |
| `oPrenatalCheckupsUltrasounds` | so | Prenatal checkups and ultrasounds | Baaritaanka uurka iyo ultrasound | 2026-11-15 | machine-drafted, needs native review |
| `oWicNutritionProgram` | so | WIC nutrition program | Barnaamijka nafaqada WIC | 2026-11-15 | machine-drafted, needs native review |
| `oBirthingCenterHospitalFinancial` | so | Birthing center or hospital financial help | Caawimaad lacageed xarunta dhalmada ama isbitaalka | 2026-11-15 | machine-drafted, needs native review |
| `oPostpartumMentalHealthSupport` | so | Postpartum mental health support | Taageerada caafimaadka maskaxda kadib dhalmada | 2026-11-15 | machine-drafted, needs native review |
| `oNewbornCareSupplies` | so | Newborn care and supplies | Daryeelka iyo agabka dhallaanka | 2026-11-15 | machine-drafted, needs native review |
| `oLactationBreastfeedingSupport` | so | Lactation / breastfeeding support | Taageerada naas-nuujinta | 2026-11-15 | machine-drafted, needs native review |
| `qStageDescribesCurrentSituation` | so | What stage best describes your current situation? | Heerkee ayaa sida ugu fiican u qeexaya xaaladdaada hadda? | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyPregnant1stTrimester` | so | Currently pregnant (1st trimester) | Hadda uur leh (saddexda bilood ee hore) | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyPregnant2ndTrimester` | so | Currently pregnant (2nd trimester) | Hadda uur leh (saddexda bilood ee dhexe) | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyPregnant3rdTrimester` | so | Currently pregnant (3rd trimester) | Hadda uur leh (saddexda bilood ee dambe) | 2026-11-15 | machine-drafted, needs native review |
| `oRecentlyGaveBirthWithin3` | so | Recently gave birth (within 3 months) | Dhawaan dhalay (3 bilood gudahood) | 2026-11-15 | machine-drafted, needs native review |
| `oPlanningPregnancy` | so | Planning a pregnancy | Waxaan qorsheynayaa uur | 2026-11-15 | machine-drafted, needs native review |
| `descWasteDisposal` | so | Bulk trash pickup, hazardous waste drop-off, and recycling help | Qaadista qashinka waaweyn, dhigista qashinka khatarta ah, iyo caawimaad dib-u-warshadeyn | 2026-11-15 | machine-drafted, needs native review |
| `qTypeWasteDisposalNeed` | so | What type of waste or disposal help do you need? | Noocee caawimaad qashin ama tuurid ah ayaad u baahan tahay? | 2026-11-15 | machine-drafted, needs native review |
| `oBulkItemFurnitureRemoval` | so | Bulk item or furniture removal | Ka qaadista alaab waaweyn ama alaab guri | 2026-11-15 | machine-drafted, needs native review |
| `oHouseholdHazardousWastePaintChemicals` | so | Household hazardous waste (paint, chemicals) | Qashinka khatarta ah ee guriga (rinji, kiimikooyin) | 2026-11-15 | machine-drafted, needs native review |
| `oElectronicsRecyclingEWaste` | so | Electronics recycling (e-waste) | Dib-u-warshadeynta elektaroonigga (qashinka elektaroonigga) | 2026-11-15 | machine-drafted, needs native review |
| `oMedicalSharpsMedicationDisposal` | so | Medical sharps or medication disposal | Tuurista irbadaha caafimaadka ama daawooyinka | 2026-11-15 | machine-drafted, needs native review |
| `oYardWasteCompost` | so | Yard waste or compost | Qashinka beerta ama bacrimin | 2026-11-15 | machine-drafted, needs native review |
| `oGeneralRecyclingAccess` | so | General recycling access | Helitaanka guud ee dib-u-warshadeynta | 2026-11-15 | machine-drafted, needs native review |
| `qDescribesSituation` | so | Which best describes your situation? | Maxaa sida ugu fiican u qeexaya xaaladdaada? | 2026-11-15 | machine-drafted, needs native review |
| `oOneTimeLargeCleanout` | so | One-time large cleanout | Nadiifin weyn oo hal mar ah | 2026-11-15 | machine-drafted, needs native review |
| `oOngoingDisposalNeed` | so | Ongoing disposal need | Baahi joogto ah oo tuurid | 2026-11-15 | machine-drafted, needs native review |
| `oRespondingNaturalDisasterEmergency` | so | Responding to a natural disaster or emergency | Ka jawaabid masiibo dabiici ah ama xaalad degdeg ah | 2026-11-15 | machine-drafted, needs native review |
| `oMovingEvictionCleanup` | so | Moving or eviction cleanup | Nadiifin guri-guuris ama ka saarid | 2026-11-15 | machine-drafted, needs native review |
| `descFreeCamping` | so | Free campsites, dispersed camping, and overnight shelters | Goobo xero bilaash ah, xero kala firirsan, iyo hoyga habeenkii | 2026-11-15 | machine-drafted, needs native review |
| `qTypeCampingOvernightShelter` | so | What type of camping or overnight shelter are you looking for? | Noocee xero ama hoy habeen ah ayaad raadinaysaa? | 2026-11-15 | machine-drafted, needs native review |
| `oFreeDispersedPrimitiveCampingPublic` | so | Free dispersed (primitive) camping on public land | Xero bilaash ah oo kala firirsan (dabiici ah) dhulka dadweynaha | 2026-11-15 | machine-drafted, needs native review |
| `oFreeDesignatedCampsitesNationalForest` | so | Free designated campsites (national forest, BLM) | Goobo xero bilaash ah oo loo qoondeeyay (kaynta qaranka, BLM) | 2026-11-15 | machine-drafted, needs native review |
| `oSafeOvernightParkingVehicle` | so | Safe overnight parking for a vehicle | Baarkin ammaan ah oo habeenkii gaari | 2026-11-15 | machine-drafted, needs native review |
| `oEmergencyOvernightShelter` | so | Emergency overnight shelter | Hoy habeen oo degdeg ah | 2026-11-15 | machine-drafted, needs native review |
| `oLongTermCampingWhileAwaiting` | so | Long-term camping while awaiting housing | Xero muddo dheer inta aan sugayo guri | 2026-11-15 | machine-drafted, needs native review |
| `qLongNeedCampStay` | so | How long do you need to camp or stay? | Muddo intee le’eg ayaad u baahan tahay inaad xeroysato ama joogto? | 2026-11-15 | machine-drafted, needs native review |
| `o12Nights` | so | 1–2 nights | 1–2 habeen | 2026-11-15 | machine-drafted, needs native review |
| `oFewDaysUpWeek` | so | A few days (up to a week) | Dhowr maalmood (ilaa usbuuc) | 2026-11-15 | machine-drafted, needs native review |
| `o14Weeks` | so | 1–4 weeks | 1–4 usbuuc | 2026-11-15 | machine-drafted, needs native review |
| `oMoreThanMonth` | so | More than a month | In ka badan bil | 2026-11-15 | machine-drafted, needs native review |
| `descFreeGoodsDonation` | so | Free clothing, furniture, household items, and donation programs | Dhar, alaab guri, agab guri oo bilaash ah, iyo barnaamijyo deeq | 2026-11-15 | machine-drafted, needs native review |
| `qTypesGoods` | so | What types of goods are you looking for? | Noocyo alaab ah oo noocee ah ayaad raadinaysaa? | 2026-11-15 | machine-drafted, needs native review |
| `oClothingShoes` | so | Clothing and shoes | Dhar iyo kabo | 2026-11-15 | machine-drafted, needs native review |
| `oFurnitureHomeGoods` | so | Furniture and home goods | Alaab guri iyo agab guri | 2026-11-15 | machine-drafted, needs native review |
| `oBabyChildrenItems` | so | Baby and children items | Alaabta ilmaha yar iyo carruurta | 2026-11-15 | machine-drafted, needs native review |
| `oElectronicsAppliances` | so | Electronics and appliances | Elektaroonig iyo qalab guri | 2026-11-15 | machine-drafted, needs native review |
| `oHygienePersonalCareItems` | so | Hygiene and personal care items | Alaabta nadaafadda iyo daryeelka shakhsiga | 2026-11-15 | machine-drafted, needs native review |
| `oSchoolSupplies` | so | School supplies | Agabka dugsiga | 2026-11-15 | machine-drafted, needs native review |
| `oSettingUpNewHome` | so | Setting up a new home | Waxaan diyaarinayaa guri cusub | 2026-11-15 | machine-drafted, needs native review |
| `oLostBelongingsFireFloodDisaster` | so | Lost belongings (fire, flood, disaster) | Waxaan waayay hantidayda (dab, daad, masiibo) | 2026-11-15 | machine-drafted, needs native review |
| `oExperiencingFinancialHardship` | so | Experiencing financial hardship | Waxaan la kulmayaa dhibaato dhaqaale | 2026-11-15 | machine-drafted, needs native review |
| `oTransitioningOutShelterFacility` | so | Transitioning out of shelter or facility | Waxaan ka baxayaa hoy ama xarun | 2026-11-15 | machine-drafted, needs native review |
| `subtitle` | am | Select a category to get personalized help from the AI assistant. | ከAI ረዳቱ የተለየ እገዛ ለማግኘት ምድብ ይምረጡ። | 2026-11-15 | machine-drafted, needs native review |
| `hintChooseOne` | am | Choose one. | አንዱን ይምረጡ። | 2026-11-15 | machine-drafted, needs native review |
| `hintChooseAll` | am | Choose all that apply. | የሚመለከትዎትን ሁሉ ይምረጡ። | 2026-11-15 | machine-drafted, needs native review |
| `chooseAtLeastOne` | am | Choose at least one to continue. | ለመቀጠል ቢያንስ አንዱን ይምረጡ። | 2026-11-15 | machine-drafted, needs native review |
| `filterLabel` | am | Filter the list | ዝርዝሩን አጣራ | 2026-11-15 | machine-drafted, needs native review |
| `filterNone` | am | No matches. | የሚዛመድ የለም። | 2026-11-15 | machine-drafted, needs native review |
| `qStateLocated` | am | What state are you located in? | በየትኛው ግዛት ነው የሚኖሩት? | 2026-11-15 | machine-drafted, needs native review |
| `qWouldPreferBeContacted` | am | How would you prefer to be contacted? | በምን መንገድ እንዲገናኙዎት ይመርጣሉ? | 2026-11-15 | machine-drafted, needs native review |
| `oPhoneCall` | am | Phone call | የስልክ ጥሪ | 2026-11-15 | machine-drafted, needs native review |
| `oTextMessage` | am | Text message | የጽሑፍ መልእክት | 2026-11-15 | machine-drafted, needs native review |
| `oEmail` | am | Email | ኢሜይል | 2026-11-15 | machine-drafted, needs native review |
| `oPersonVisit` | am | In-person visit | በአካል መገናኘት | 2026-11-15 | machine-drafted, needs native review |
| `oNoPreference` | am | No preference | ምርጫ የለኝም | 2026-11-15 | machine-drafted, needs native review |
| `descFood` | am | SNAP, food pantries, free meals, and more | SNAP፣ የምግብ ባንኮች፣ ነፃ ምግብ እና ሌሎችም | 2026-11-15 | machine-drafted, needs native review |
| `qTypeFoodAssistance` | am | What type of food assistance are you looking for? | ምን ዓይነት የምግብ እርዳታ ይፈልጋሉ? | 2026-11-15 | machine-drafted, needs native review |
| `oSnapEbtBenefits` | am | SNAP / EBT benefits | የSNAP / EBT ጥቅማጥቅሞች | 2026-11-15 | machine-drafted, needs native review |
| `oFoodPantries` | am | Food pantries | የምግብ ባንኮች | 2026-11-15 | machine-drafted, needs native review |
| `oFreeMeals` | am | Free meals | ነፃ ምግብ | 2026-11-15 | machine-drafted, needs native review |
| `oWicProgram` | am | WIC program | የWIC ፕሮግራም | 2026-11-15 | machine-drafted, needs native review |
| `oSchoolMeals` | am | School meals | የትምህርት ቤት ምግብ | 2026-11-15 | machine-drafted, needs native review |
| `oCommunityGardens` | am | Community gardens | የማህበረሰብ የአትክልት ቦታዎች | 2026-11-15 | machine-drafted, needs native review |
| `qManyPeopleHousehold` | am | How many people are in your household? | በቤተሰብዎ ውስጥ ስንት ሰዎች አሉ? | 2026-11-15 | machine-drafted, needs native review |
| `o1Person` | am | 1 person | 1 ሰው | 2026-11-15 | machine-drafted, needs native review |
| `o2People` | am | 2 people | 2 ሰዎች | 2026-11-15 | machine-drafted, needs native review |
| `o3People` | am | 3 people | 3 ሰዎች | 2026-11-15 | machine-drafted, needs native review |
| `o4People` | am | 4 people | 4 ሰዎች | 2026-11-15 | machine-drafted, needs native review |
| `o5People` | am | 5 people | 5 ሰዎች | 2026-11-15 | machine-drafted, needs native review |
| `o6People` | am | 6 people | 6 ሰዎች | 2026-11-15 | machine-drafted, needs native review |
| `o7People` | am | 7 people | 7 ሰዎች | 2026-11-15 | machine-drafted, needs native review |
| `o8MorePeople` | am | 8 or more people | 8 ወይም ከዚያ በላይ ሰዎች | 2026-11-15 | machine-drafted, needs native review |
| `descHousing` | am | Emergency shelter, rent help, and housing vouchers | የአደጋ ጊዜ መጠለያ፣ የኪራይ እገዛ እና የመኖሪያ ቤት ቫውቸሮች | 2026-11-15 | machine-drafted, needs native review |
| `qTypeHousing` | am | What type of housing help are you looking for? | ምን ዓይነት የመኖሪያ ቤት እገዛ ይፈልጋሉ? | 2026-11-15 | machine-drafted, needs native review |
| `oEmergencyShelter` | am | Emergency shelter | የአደጋ ጊዜ መጠለያ | 2026-11-15 | machine-drafted, needs native review |
| `oRentAssistance` | am | Rent assistance | የኪራይ እገዛ | 2026-11-15 | machine-drafted, needs native review |
| `oSection8HousingVouchers` | am | Section 8 / housing vouchers | ክፍል 8 / የመኖሪያ ቤት ቫውቸሮች | 2026-11-15 | machine-drafted, needs native review |
| `oUtilityBill` | am | Utility bill help | የአገልግሎት ክፍያ እገዛ | 2026-11-15 | machine-drafted, needs native review |
| `oHomeRepairAssistance` | am | Home repair assistance | የቤት ጥገና እገዛ | 2026-11-15 | machine-drafted, needs native review |
| `oTransitionalHousing` | am | Transitional housing | የሽግግር መኖሪያ ቤት | 2026-11-15 | machine-drafted, needs native review |
| `qDescribesCurrentSituation` | am | Which best describes your current situation? | አሁን ያለዎትን ሁኔታ በተሻለ የሚገልጸው የትኛው ነው? | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyHomeless` | am | Currently homeless | አሁን ቤት አልባ ነኝ | 2026-11-15 | machine-drafted, needs native review |
| `oAboutLoseHousing` | am | About to lose housing | ቤቴን ላጣ ነው | 2026-11-15 | machine-drafted, needs native review |
| `oNeedMoreAffordableHousing` | am | Need more affordable housing | ዋጋው ተመጣጣኝ የሆነ ቤት ያስፈልገኛል | 2026-11-15 | machine-drafted, needs native review |
| `oNeedRepairsCurrentHome` | am | Need repairs on current home | አሁን ያለሁበት ቤት ጥገና ያስፈልገዋል | 2026-11-15 | machine-drafted, needs native review |
| `descJobs` | am | Job search, training programs, and career support | ሥራ ፍለጋ፣ የሥልጠና ፕሮግራሞች እና የሙያ ድጋፍ | 2026-11-15 | machine-drafted, needs native review |
| `qTypeCareer` | am | What type of career help are you looking for? | ምን ዓይነት የሙያ እገዛ ይፈልጋሉ? | 2026-11-15 | machine-drafted, needs native review |
| `oJobSearch` | am | Job search help | የሥራ ፍለጋ እገዛ | 2026-11-15 | machine-drafted, needs native review |
| `oResumeInterviewCoaching` | am | Resume and interview coaching | የሲቪ እና የቃለ መጠይቅ ሥልጠና | 2026-11-15 | machine-drafted, needs native review |
| `oJobTrainingPrograms` | am | Job training programs | የሥራ ሥልጠና ፕሮግራሞች | 2026-11-15 | machine-drafted, needs native review |
| `oUnemploymentBenefits` | am | Unemployment benefits | የሥራ አጥነት ጥቅማጥቅሞች | 2026-11-15 | machine-drafted, needs native review |
| `oCareerCounseling` | am | Career counseling | የሙያ ምክር | 2026-11-15 | machine-drafted, needs native review |
| `oYouthEmploymentPrograms` | am | Youth employment programs | የወጣቶች የሥራ ፕሮግራሞች | 2026-11-15 | machine-drafted, needs native review |
| `qWouldDescribeWorkExperience` | am | How would you describe your work experience? | የሥራ ልምድዎን እንዴት ይገልጹታል? | 2026-11-15 | machine-drafted, needs native review |
| `oNoWorkExperienceYet` | am | No work experience yet | እስካሁን የሥራ ልምድ የለኝም | 2026-11-15 | machine-drafted, needs native review |
| `oSomeExperience` | am | Some experience | ትንሽ ልምድ አለኝ | 2026-11-15 | machine-drafted, needs native review |
| `oExperiencedWorker` | am | Experienced worker | ልምድ ያለኝ ሠራተኛ | 2026-11-15 | machine-drafted, needs native review |
| `oCareerChange` | am | Looking for a career change | ሙያ መቀየር እፈልጋለሁ | 2026-11-15 | machine-drafted, needs native review |
| `descTransportation` | am | Bus passes, ride programs, and gas assistance | የአውቶቡስ ትኬቶች፣ የመጓጓዣ ፕሮግራሞች እና የነዳጅ እገዛ | 2026-11-15 | machine-drafted, needs native review |
| `qTypeTransportation` | am | What type of transportation help are you looking for? | ምን ዓይነት የመጓጓዣ እገዛ ይፈልጋሉ? | 2026-11-15 | machine-drafted, needs native review |
| `oBusTransitPasses` | am | Bus / transit passes | የአውቶቡስ / የሕዝብ ማመላለሻ ትኬቶች | 2026-11-15 | machine-drafted, needs native review |
| `oCarRepairAssistance` | am | Car repair assistance | የመኪና ጥገና እገዛ | 2026-11-15 | machine-drafted, needs native review |
| `oRidePrograms` | am | Ride programs | የመጓጓዣ ፕሮግራሞች | 2026-11-15 | machine-drafted, needs native review |
| `oGasVouchers` | am | Gas vouchers | የነዳጅ ቫውቸሮች | 2026-11-15 | machine-drafted, needs native review |
| `oVehicleDonationProgram` | am | Vehicle donation program | የተሽከርካሪ ልገሳ ፕሮግራም | 2026-11-15 | machine-drafted, needs native review |
| `oDisabledTransportation` | am | Disabled transportation | ለአካል ጉዳተኞች መጓጓዣ | 2026-11-15 | machine-drafted, needs native review |
| `qOftenNeedTransportationSupport` | am | How often do you need transportation support? | የመጓጓዣ ድጋፍ ምን ያህል ጊዜ ያስፈልግዎታል? | 2026-11-15 | machine-drafted, needs native review |
| `oDailyWorkSchool` | am | Daily (work / school) | በየቀኑ (ሥራ / ትምህርት ቤት) | 2026-11-15 | machine-drafted, needs native review |
| `oSeveralTimesWeek` | am | Several times a week | በሳምንት ብዙ ጊዜ | 2026-11-15 | machine-drafted, needs native review |
| `oOccasionalTrips` | am | Occasional trips | አልፎ አልፎ | 2026-11-15 | machine-drafted, needs native review |
| `oOneTimeNeed` | am | One-time need | አንድ ጊዜ ብቻ | 2026-11-15 | machine-drafted, needs native review |
| `descLegal` | am | Free legal aid for housing, family, and benefits | ለመኖሪያ ቤት፣ ለቤተሰብ እና ለጥቅማጥቅሞች ነፃ የሕግ እርዳታ | 2026-11-15 | machine-drafted, needs native review |
| `qTypeLegal` | am | What type of legal help are you looking for? | ምን ዓይነት የሕግ እገዛ ይፈልጋሉ? | 2026-11-15 | machine-drafted, needs native review |
| `oTenantRightsEviction` | am | Tenant rights / eviction | የተከራይ መብቶች / ማስለቀቅ | 2026-11-15 | machine-drafted, needs native review |
| `oFamilyLaw` | am | Family law | የቤተሰብ ሕግ | 2026-11-15 | machine-drafted, needs native review |
| `oImmigration` | am | Immigration | ኢሚግሬሽን | 2026-11-15 | machine-drafted, needs native review |
| `oCriminalRecordExpungement` | am | Criminal record expungement | የወንጀል ሪከርድ ማሰረዝ | 2026-11-15 | machine-drafted, needs native review |
| `oBenefitsAppeals` | am | Benefits appeals | የጥቅማጥቅም ይግባኞች | 2026-11-15 | machine-drafted, needs native review |
| `oConsumerProtection` | am | Consumer protection | የሸማቾች ጥበቃ | 2026-11-15 | machine-drafted, needs native review |
| `qUrgentLegalSituation` | am | How urgent is your legal situation? | የሕግ ጉዳይዎ ምን ያህል አስቸኳይ ነው? | 2026-11-15 | machine-drafted, needs native review |
| `oImmediateCourtDateDeadlineThis` | am | Immediate (court date / deadline this week) | ወዲያውኑ (በዚህ ሳምንት የፍርድ ቤት ቀጠሮ / የጊዜ ገደብ) | 2026-11-15 | machine-drafted, needs native review |
| `oUrgentWithinNextMonth` | am | Urgent (within the next month) | አስቸኳይ (በሚቀጥለው ወር ውስጥ) | 2026-11-15 | machine-drafted, needs native review |
| `oNotUrgentJustNeedGuidance` | am | Not urgent, just need guidance | አስቸኳይ አይደለም፣ መመሪያ ብቻ ያስፈልገኛል | 2026-11-15 | machine-drafted, needs native review |
| `oJustExploringMyOptions` | am | Just exploring my options | አማራጮቼን እያየሁ ብቻ ነው | 2026-11-15 | machine-drafted, needs native review |
| `descHealthcare` | am | Free clinics, Medicaid, prescriptions, and mental health | ነፃ ክሊኒኮች፣ Medicaid፣ መድኃኒቶች እና የአእምሮ ጤና | 2026-11-15 | machine-drafted, needs native review |
| `qTypeHealthcare` | am | What type of healthcare help are you looking for? | ምን ዓይነት የጤና እገዛ ይፈልጋሉ? | 2026-11-15 | machine-drafted, needs native review |
| `oMedicaidMedicareEnrollment` | am | Medicaid / Medicare enrollment | የMedicaid / Medicare ምዝገባ | 2026-11-15 | machine-drafted, needs native review |
| `oFreeLowCostClinics` | am | Free or low-cost clinics | ነፃ ወይም ዝቅተኛ ዋጋ ያላቸው ክሊኒኮች | 2026-11-15 | machine-drafted, needs native review |
| `oPrescriptionAssistance` | am | Prescription assistance | የታዘዙ መድኃኒቶች እገዛ | 2026-11-15 | machine-drafted, needs native review |
| `oMentalHealthServices` | am | Mental health services | የአእምሮ ጤና አገልግሎቶች | 2026-11-15 | machine-drafted, needs native review |
| `oDentalCare` | am | Dental care | የጥርስ ሕክምና | 2026-11-15 | machine-drafted, needs native review |
| `oVisionCare` | am | Vision care | የዓይን ሕክምና | 2026-11-15 | machine-drafted, needs native review |
| `qCurrentInsuranceStatus` | am | What is your current insurance status? | አሁን ያለዎት የመድን ሁኔታ ምንድን ነው? | 2026-11-15 | machine-drafted, needs native review |
| `oNoInsurance` | am | No insurance | መድን የለኝም | 2026-11-15 | machine-drafted, needs native review |
| `oPrivateInsurance` | am | Private insurance | የግል መድን | 2026-11-15 | machine-drafted, needs native review |
| `oEmployerInsurance` | am | Employer insurance | የአሠሪ መድን | 2026-11-15 | machine-drafted, needs native review |
| `descEitcTaxFiling` | am | Free tax prep, EITC refunds, and filing assistance | ነፃ የግብር ዝግጅት፣ የEITC ተመላሽ እና የማስታወቂያ እገዛ | 2026-11-15 | machine-drafted, needs native review |
| `qTaxFilingStatus` | am | What is your tax filing status? | የግብር ማስታወቂያ ሁኔታዎ ምንድን ነው? | 2026-11-15 | machine-drafted, needs native review |
| `oSingle` | am | Single | ያላገባ | 2026-11-15 | machine-drafted, needs native review |
| `oMarriedFilingJointly` | am | Married filing jointly | ያገባ፣ በጋራ ማስታወቂያ | 2026-11-15 | machine-drafted, needs native review |
| `oMarriedFilingSeparately` | am | Married filing separately | ያገባ፣ በተናጠል ማስታወቂያ | 2026-11-15 | machine-drafted, needs native review |
| `oHeadHousehold` | am | Head of household | የቤተሰብ ኃላፊ | 2026-11-15 | machine-drafted, needs native review |
| `oQualifyingSurvivingSpouse` | am | Qualifying surviving spouse | ብቁ የሆነ በሕይወት ያለ የትዳር አጋር | 2026-11-15 | machine-drafted, needs native review |
| `qApproximateAnnualHouseholdIncome` | am | What is your approximate annual household income? | የቤተሰብዎ ዓመታዊ ገቢ በግምት ምን ያህል ነው? | 2026-11-15 | machine-drafted, needs native review |
| `qManyQualifyingChildrenDependentsHave` | am | How many qualifying children or dependents do you have? | ስንት ብቁ ልጆች ወይም ጥገኞች አሉዎት? | 2026-11-15 | machine-drafted, needs native review |
| `oNone` | am | None | የለም | 2026-11-15 | machine-drafted, needs native review |
| `o1Child` | am | 1 child | 1 ልጅ | 2026-11-15 | machine-drafted, needs native review |
| `o2Children` | am | 2 children | 2 ልጆች | 2026-11-15 | machine-drafted, needs native review |
| `o3MoreChildren` | am | 3 or more children | 3 ወይም ከዚያ በላይ ልጆች | 2026-11-15 | machine-drafted, needs native review |
| `descFreeLegal` | am | Legal aid clinics, pro bono attorneys, and self-help resources | የሕግ እርዳታ ክሊኒኮች፣ በነፃ የሚሠሩ ጠበቆች እና የራስ አገዝ ምንጮች | 2026-11-15 | machine-drafted, needs native review |
| `qTypeLegalIssueNeedWith` | am | What type of legal issue do you need help with? | በምን ዓይነት የሕግ ጉዳይ እገዛ ያስፈልግዎታል? | 2026-11-15 | machine-drafted, needs native review |
| `oEvictionHousingCourt` | am | Eviction or housing court | ማስለቀቅ ወይም የመኖሪያ ቤት ፍርድ ቤት | 2026-11-15 | machine-drafted, needs native review |
| `oDomesticViolenceProtectionOrder` | am | Domestic violence protection order | የቤት ውስጥ ጥቃት የጥበቃ ትእዛዝ | 2026-11-15 | machine-drafted, needs native review |
| `oChildCustodySupport` | am | Child custody or support | የልጅ አሳዳጊነት ወይም ቀለብ | 2026-11-15 | machine-drafted, needs native review |
| `oImmigrationDaca` | am | Immigration or DACA | ኢሚግሬሽን ወይም DACA | 2026-11-15 | machine-drafted, needs native review |
| `oBenefitsDenialAppeal` | am | Benefits denial or appeal | የጥቅማጥቅም ውድቅ መደረግ ወይም ይግባኝ | 2026-11-15 | machine-drafted, needs native review |
| `oImmediateCourtDateOrDeadline` | am | Immediate (court date or deadline this week) | ወዲያውኑ (በዚህ ሳምንት የፍርድ ቤት ቀጠሮ ወይም የጊዜ ገደብ) | 2026-11-15 | machine-drafted, needs native review |
| `oUrgentWithinNext30Days` | am | Urgent (within the next 30 days) | አስቸኳይ (በሚቀጥሉት 30 ቀናት ውስጥ) | 2026-11-15 | machine-drafted, needs native review |
| `oNotUrgentNeedGeneralGuidance` | am | Not urgent, need general guidance | አስቸኳይ አይደለም፣ አጠቃላይ መመሪያ ያስፈልገኛል | 2026-11-15 | machine-drafted, needs native review |
| `descPrenatalNatalCare` | am | Prenatal visits, WIC, newborn support, and postpartum care | የቅድመ ወሊድ ክትትል፣ WIC፣ የአራስ ልጅ ድጋፍ እና የድኅረ ወሊድ እንክብካቤ | 2026-11-15 | machine-drafted, needs native review |
| `qTypeSupport` | am | What type of support are you looking for? | ምን ዓይነት ድጋፍ ይፈልጋሉ? | 2026-11-15 | machine-drafted, needs native review |
| `oPrenatalCheckupsUltrasounds` | am | Prenatal checkups and ultrasounds | የቅድመ ወሊድ ምርመራ እና አልትራሳውንድ | 2026-11-15 | machine-drafted, needs native review |
| `oWicNutritionProgram` | am | WIC nutrition program | የWIC የአመጋገብ ፕሮግራም | 2026-11-15 | machine-drafted, needs native review |
| `oBirthingCenterHospitalFinancial` | am | Birthing center or hospital financial help | ለወሊድ ማዕከል ወይም ለሆስፒታል የገንዘብ እገዛ | 2026-11-15 | machine-drafted, needs native review |
| `oPostpartumMentalHealthSupport` | am | Postpartum mental health support | ከወሊድ በኋላ የአእምሮ ጤና ድጋፍ | 2026-11-15 | machine-drafted, needs native review |
| `oNewbornCareSupplies` | am | Newborn care and supplies | የአራስ ልጅ እንክብካቤ እና አቅርቦቶች | 2026-11-15 | machine-drafted, needs native review |
| `oLactationBreastfeedingSupport` | am | Lactation / breastfeeding support | የጡት ማጥባት ድጋፍ | 2026-11-15 | machine-drafted, needs native review |
| `qStageDescribesCurrentSituation` | am | What stage best describes your current situation? | አሁን ያለዎትን ሁኔታ በተሻለ የሚገልጸው የትኛው ደረጃ ነው? | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyPregnant1stTrimester` | am | Currently pregnant (1st trimester) | አሁን ነፍሰ ጡር (የመጀመሪያው ሦስት ወር) | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyPregnant2ndTrimester` | am | Currently pregnant (2nd trimester) | አሁን ነፍሰ ጡር (ሁለተኛው ሦስት ወር) | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyPregnant3rdTrimester` | am | Currently pregnant (3rd trimester) | አሁን ነፍሰ ጡር (ሦስተኛው ሦስት ወር) | 2026-11-15 | machine-drafted, needs native review |
| `oRecentlyGaveBirthWithin3` | am | Recently gave birth (within 3 months) | በቅርቡ ወልጃለሁ (በ3 ወራት ውስጥ) | 2026-11-15 | machine-drafted, needs native review |
| `oPlanningPregnancy` | am | Planning a pregnancy | እርግዝና እያቀድኩ ነው | 2026-11-15 | machine-drafted, needs native review |
| `descWasteDisposal` | am | Bulk trash pickup, hazardous waste drop-off, and recycling help | ትልቅ ቆሻሻ ማንሳት፣ አደገኛ ቆሻሻ ማስረከብ እና የመልሶ መጠቀም እገዛ | 2026-11-15 | machine-drafted, needs native review |
| `qTypeWasteDisposalNeed` | am | What type of waste or disposal help do you need? | ምን ዓይነት የቆሻሻ ወይም የማስወገድ እገዛ ያስፈልግዎታል? | 2026-11-15 | machine-drafted, needs native review |
| `oBulkItemFurnitureRemoval` | am | Bulk item or furniture removal | ትልልቅ ዕቃዎችን ወይም የቤት ዕቃዎችን ማንሳት | 2026-11-15 | machine-drafted, needs native review |
| `oHouseholdHazardousWastePaintChemicals` | am | Household hazardous waste (paint, chemicals) | አደገኛ የቤት ቆሻሻ (ቀለም፣ ኬሚካሎች) | 2026-11-15 | machine-drafted, needs native review |
| `oElectronicsRecyclingEWaste` | am | Electronics recycling (e-waste) | የኤሌክትሮኒክስ መልሶ መጠቀም (ኢ-ቆሻሻ) | 2026-11-15 | machine-drafted, needs native review |
| `oMedicalSharpsMedicationDisposal` | am | Medical sharps or medication disposal | የሕክምና መርፌዎችን ወይም መድኃኒቶችን ማስወገድ | 2026-11-15 | machine-drafted, needs native review |
| `oYardWasteCompost` | am | Yard waste or compost | የግቢ ቆሻሻ ወይም ብስባሽ | 2026-11-15 | machine-drafted, needs native review |
| `oGeneralRecyclingAccess` | am | General recycling access | አጠቃላይ የመልሶ መጠቀም አገልግሎት | 2026-11-15 | machine-drafted, needs native review |
| `qDescribesSituation` | am | Which best describes your situation? | ሁኔታዎን በተሻለ የሚገልጸው የትኛው ነው? | 2026-11-15 | machine-drafted, needs native review |
| `oOneTimeLargeCleanout` | am | One-time large cleanout | የአንድ ጊዜ ትልቅ ጽዳት | 2026-11-15 | machine-drafted, needs native review |
| `oOngoingDisposalNeed` | am | Ongoing disposal need | ቀጣይ የማስወገድ ፍላጎት | 2026-11-15 | machine-drafted, needs native review |
| `oRespondingNaturalDisasterEmergency` | am | Responding to a natural disaster or emergency | ለተፈጥሮ አደጋ ወይም ለአስቸኳይ ሁኔታ ምላሽ | 2026-11-15 | machine-drafted, needs native review |
| `oMovingEvictionCleanup` | am | Moving or eviction cleanup | የቤት ለውጥ ወይም የማስለቀቅ ጽዳት | 2026-11-15 | machine-drafted, needs native review |
| `descFreeCamping` | am | Free campsites, dispersed camping, and overnight shelters | ነፃ የካምፕ ቦታዎች፣ ክፍት ካምፕ እና የሌሊት መጠለያዎች | 2026-11-15 | machine-drafted, needs native review |
| `qTypeCampingOvernightShelter` | am | What type of camping or overnight shelter are you looking for? | ምን ዓይነት ካምፕ ወይም የሌሊት መጠለያ ይፈልጋሉ? | 2026-11-15 | machine-drafted, needs native review |
| `oFreeDispersedPrimitiveCampingPublic` | am | Free dispersed (primitive) camping on public land | በሕዝብ መሬት ላይ ነፃ ክፍት (ቀላል) ካምፕ | 2026-11-15 | machine-drafted, needs native review |
| `oFreeDesignatedCampsitesNationalForest` | am | Free designated campsites (national forest, BLM) | ነፃ የተመደቡ የካምፕ ቦታዎች (ብሔራዊ ደን፣ BLM) | 2026-11-15 | machine-drafted, needs native review |
| `oSafeOvernightParkingVehicle` | am | Safe overnight parking for a vehicle | ለተሽከርካሪ ደኅንነቱ የተጠበቀ የሌሊት ማቆሚያ | 2026-11-15 | machine-drafted, needs native review |
| `oEmergencyOvernightShelter` | am | Emergency overnight shelter | የአደጋ ጊዜ የሌሊት መጠለያ | 2026-11-15 | machine-drafted, needs native review |
| `oLongTermCampingWhileAwaiting` | am | Long-term camping while awaiting housing | ቤት እስኪገኝ ድረስ የረጅም ጊዜ ካምፕ | 2026-11-15 | machine-drafted, needs native review |
| `qLongNeedCampStay` | am | How long do you need to camp or stay? | ለምን ያህል ጊዜ ካምፕ ማድረግ ወይም መቆየት ያስፈልግዎታል? | 2026-11-15 | machine-drafted, needs native review |
| `o12Nights` | am | 1–2 nights | 1–2 ሌሊቶች | 2026-11-15 | machine-drafted, needs native review |
| `oFewDaysUpWeek` | am | A few days (up to a week) | ጥቂት ቀናት (እስከ አንድ ሳምንት) | 2026-11-15 | machine-drafted, needs native review |
| `o14Weeks` | am | 1–4 weeks | 1–4 ሳምንታት | 2026-11-15 | machine-drafted, needs native review |
| `oMoreThanMonth` | am | More than a month | ከአንድ ወር በላይ | 2026-11-15 | machine-drafted, needs native review |
| `descFreeGoodsDonation` | am | Free clothing, furniture, household items, and donation programs | ነፃ ልብስ፣ የቤት ዕቃዎች፣ የቤት አቅርቦቶች እና የልገሳ ፕሮግራሞች | 2026-11-15 | machine-drafted, needs native review |
| `qTypesGoods` | am | What types of goods are you looking for? | ምን ዓይነት ዕቃዎችን ይፈልጋሉ? | 2026-11-15 | machine-drafted, needs native review |
| `oClothingShoes` | am | Clothing and shoes | ልብስ እና ጫማ | 2026-11-15 | machine-drafted, needs native review |
| `oFurnitureHomeGoods` | am | Furniture and home goods | የቤት ዕቃዎች እና የቤት አቅርቦቶች | 2026-11-15 | machine-drafted, needs native review |
| `oBabyChildrenItems` | am | Baby and children items | የሕፃናት እና የልጆች ዕቃዎች | 2026-11-15 | machine-drafted, needs native review |
| `oElectronicsAppliances` | am | Electronics and appliances | ኤሌክትሮኒክስ እና የቤት መገልገያዎች | 2026-11-15 | machine-drafted, needs native review |
| `oHygienePersonalCareItems` | am | Hygiene and personal care items | የንጽሕና እና የግል እንክብካቤ ዕቃዎች | 2026-11-15 | machine-drafted, needs native review |
| `oSchoolSupplies` | am | School supplies | የትምህርት ቤት ቁሳቁሶች | 2026-11-15 | machine-drafted, needs native review |
| `oSettingUpNewHome` | am | Setting up a new home | አዲስ ቤት እያዘጋጀሁ ነው | 2026-11-15 | machine-drafted, needs native review |
| `oLostBelongingsFireFloodDisaster` | am | Lost belongings (fire, flood, disaster) | ንብረቴን አጥቻለሁ (እሳት፣ ጎርፍ፣ አደጋ) | 2026-11-15 | machine-drafted, needs native review |
| `oExperiencingFinancialHardship` | am | Experiencing financial hardship | የገንዘብ ችግር እያጋጠመኝ ነው | 2026-11-15 | machine-drafted, needs native review |
| `oTransitioningOutShelterFacility` | am | Transitioning out of shelter or facility | ከመጠለያ ወይም ከተቋም እየወጣሁ ነው | 2026-11-15 | machine-drafted, needs native review |
| `subtitle` | hmn | Select a category to get personalized help from the AI assistant. | Xaiv ib pawg kom tus pab AI pab koj raws li koj xav tau. | 2026-11-15 | machine-drafted, needs native review |
| `hintChooseOne` | hmn | Choose one. | Xaiv ib qho. | 2026-11-15 | machine-drafted, needs native review |
| `hintChooseAll` | hmn | Choose all that apply. | Xaiv txhua yam uas haum rau koj. | 2026-11-15 | machine-drafted, needs native review |
| `chooseAtLeastOne` | hmn | Choose at least one to continue. | Xaiv tsawg kawg ib qho kom mus ntxiv. | 2026-11-15 | machine-drafted, needs native review |
| `filterLabel` | hmn | Filter the list | Lim daim ntawv teev | 2026-11-15 | machine-drafted, needs native review |
| `filterNone` | hmn | No matches. | Tsis muaj dab tsi phim. | 2026-11-15 | machine-drafted, needs native review |
| `qStateLocated` | hmn | What state are you located in? | Koj nyob rau lub xeev twg? | 2026-11-15 | machine-drafted, needs native review |
| `qWouldPreferBeContacted` | hmn | How would you prefer to be contacted? | Koj xav kom lawv tiv tauj koj li cas? | 2026-11-15 | machine-drafted, needs native review |
| `oPhoneCall` | hmn | Phone call | Hu xov tooj | 2026-11-15 | machine-drafted, needs native review |
| `oTextMessage` | hmn | Text message | Xa ntawv hauv xov tooj | 2026-11-15 | machine-drafted, needs native review |
| `oEmail` | hmn | Email | Email | 2026-11-15 | machine-drafted, needs native review |
| `oPersonVisit` | hmn | In-person visit | Ntsib tim ntsej muag | 2026-11-15 | machine-drafted, needs native review |
| `oNoPreference` | hmn | No preference | Li cas los tau | 2026-11-15 | machine-drafted, needs native review |
| `descFood` | hmn | SNAP, food pantries, free meals, and more | SNAP, chaw muab zaub mov, pluas mov dawb, thiab ntau yam ntxiv | 2026-11-15 | machine-drafted, needs native review |
| `qTypeFoodAssistance` | hmn | What type of food assistance are you looking for? | Koj nrhiav kev pab zaub mov hom twg? | 2026-11-15 | machine-drafted, needs native review |
| `oSnapEbtBenefits` | hmn | SNAP / EBT benefits | Kev pab SNAP / EBT | 2026-11-15 | machine-drafted, needs native review |
| `oFoodPantries` | hmn | Food pantries | Chaw muab zaub mov | 2026-11-15 | machine-drafted, needs native review |
| `oFreeMeals` | hmn | Free meals | Pluas mov dawb | 2026-11-15 | machine-drafted, needs native review |
| `oWicProgram` | hmn | WIC program | Kev pab cuam WIC | 2026-11-15 | machine-drafted, needs native review |
| `oSchoolMeals` | hmn | School meals | Pluas mov tom tsev kawm ntawv | 2026-11-15 | machine-drafted, needs native review |
| `oCommunityGardens` | hmn | Community gardens | Vaj zaub hauv zej zog | 2026-11-15 | machine-drafted, needs native review |
| `qManyPeopleHousehold` | hmn | How many people are in your household? | Koj tsev neeg muaj pes tsawg tus neeg? | 2026-11-15 | machine-drafted, needs native review |
| `o1Person` | hmn | 1 person | 1 tus neeg | 2026-11-15 | machine-drafted, needs native review |
| `o2People` | hmn | 2 people | 2 tus neeg | 2026-11-15 | machine-drafted, needs native review |
| `o3People` | hmn | 3 people | 3 tus neeg | 2026-11-15 | machine-drafted, needs native review |
| `o4People` | hmn | 4 people | 4 tus neeg | 2026-11-15 | machine-drafted, needs native review |
| `o5People` | hmn | 5 people | 5 tus neeg | 2026-11-15 | machine-drafted, needs native review |
| `o6People` | hmn | 6 people | 6 tus neeg | 2026-11-15 | machine-drafted, needs native review |
| `o7People` | hmn | 7 people | 7 tus neeg | 2026-11-15 | machine-drafted, needs native review |
| `o8MorePeople` | hmn | 8 or more people | 8 tus neeg los sis ntau dua | 2026-11-15 | machine-drafted, needs native review |
| `descHousing` | hmn | Emergency shelter, rent help, and housing vouchers | Chaw nyob thaum muaj xwm txheej ceev, kev pab them nqi xauj tsev, thiab daim pib vaj tse | 2026-11-15 | machine-drafted, needs native review |
| `qTypeHousing` | hmn | What type of housing help are you looking for? | Koj nrhiav kev pab vaj tse hom twg? | 2026-11-15 | machine-drafted, needs native review |
| `oEmergencyShelter` | hmn | Emergency shelter | Chaw nyob thaum muaj xwm txheej ceev | 2026-11-15 | machine-drafted, needs native review |
| `oRentAssistance` | hmn | Rent assistance | Kev pab them nqi xauj tsev | 2026-11-15 | machine-drafted, needs native review |
| `oSection8HousingVouchers` | hmn | Section 8 / housing vouchers | Section 8 / daim pib vaj tse | 2026-11-15 | machine-drafted, needs native review |
| `oUtilityBill` | hmn | Utility bill help | Kev pab them nqi hluav taws xob thiab dej | 2026-11-15 | machine-drafted, needs native review |
| `oHomeRepairAssistance` | hmn | Home repair assistance | Kev pab kho tsev | 2026-11-15 | machine-drafted, needs native review |
| `oTransitionalHousing` | hmn | Transitional housing | Tsev nyob ib ntus | 2026-11-15 | machine-drafted, needs native review |
| `qDescribesCurrentSituation` | hmn | Which best describes your current situation? | Yam twg piav koj qhov xwm txheej tam sim no zoo tshaj? | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyHomeless` | hmn | Currently homeless | Tam sim no tsis muaj tsev nyob | 2026-11-15 | machine-drafted, needs native review |
| `oAboutLoseHousing` | hmn | About to lose housing | Yuav poob tsev nyob | 2026-11-15 | machine-drafted, needs native review |
| `oNeedMoreAffordableHousing` | hmn | Need more affordable housing | Xav tau tsev uas pheej yig dua | 2026-11-15 | machine-drafted, needs native review |
| `oNeedRepairsCurrentHome` | hmn | Need repairs on current home | Lub tsev tam sim no yuav tsum kho | 2026-11-15 | machine-drafted, needs native review |
| `descJobs` | hmn | Job search, training programs, and career support | Nrhiav haujlwm, kev cob qhia, thiab kev txhawb nqa txoj haujlwm | 2026-11-15 | machine-drafted, needs native review |
| `qTypeCareer` | hmn | What type of career help are you looking for? | Koj nrhiav kev pab txog haujlwm hom twg? | 2026-11-15 | machine-drafted, needs native review |
| `oJobSearch` | hmn | Job search help | Kev pab nrhiav haujlwm | 2026-11-15 | machine-drafted, needs native review |
| `oResumeInterviewCoaching` | hmn | Resume and interview coaching | Kev qhia sau resume thiab xam phaj | 2026-11-15 | machine-drafted, needs native review |
| `oJobTrainingPrograms` | hmn | Job training programs | Kev cob qhia ua haujlwm | 2026-11-15 | machine-drafted, needs native review |
| `oUnemploymentBenefits` | hmn | Unemployment benefits | Nyiaj pab thaum tsis muaj haujlwm | 2026-11-15 | machine-drafted, needs native review |
| `oCareerCounseling` | hmn | Career counseling | Kev sab laj txog txoj haujlwm | 2026-11-15 | machine-drafted, needs native review |
| `oYouthEmploymentPrograms` | hmn | Youth employment programs | Kev pab haujlwm rau cov hluas | 2026-11-15 | machine-drafted, needs native review |
| `qWouldDescribeWorkExperience` | hmn | How would you describe your work experience? | Koj yuav piav koj txoj kev paub ua haujlwm li cas? | 2026-11-15 | machine-drafted, needs native review |
| `oNoWorkExperienceYet` | hmn | No work experience yet | Tseem tsis tau muaj kev paub ua haujlwm | 2026-11-15 | machine-drafted, needs native review |
| `oSomeExperience` | hmn | Some experience | Muaj kev paub me ntsis | 2026-11-15 | machine-drafted, needs native review |
| `oExperiencedWorker` | hmn | Experienced worker | Tus neeg ua haujlwm muaj kev paub | 2026-11-15 | machine-drafted, needs native review |
| `oCareerChange` | hmn | Looking for a career change | Xav hloov txoj haujlwm | 2026-11-15 | machine-drafted, needs native review |
| `descTransportation` | hmn | Bus passes, ride programs, and gas assistance | Daim pib tsheb npav, kev pab caij tsheb, thiab kev pab nqi roj | 2026-11-15 | machine-drafted, needs native review |
| `qTypeTransportation` | hmn | What type of transportation help are you looking for? | Koj nrhiav kev pab mus los hom twg? | 2026-11-15 | machine-drafted, needs native review |
| `oBusTransitPasses` | hmn | Bus / transit passes | Daim pib tsheb npav / tsheb pej xeem | 2026-11-15 | machine-drafted, needs native review |
| `oCarRepairAssistance` | hmn | Car repair assistance | Kev pab kho tsheb | 2026-11-15 | machine-drafted, needs native review |
| `oRidePrograms` | hmn | Ride programs | Kev pab caij tsheb | 2026-11-15 | machine-drafted, needs native review |
| `oGasVouchers` | hmn | Gas vouchers | Daim pib roj tsheb | 2026-11-15 | machine-drafted, needs native review |
| `oVehicleDonationProgram` | hmn | Vehicle donation program | Kev pub tsheb | 2026-11-15 | machine-drafted, needs native review |
| `oDisabledTransportation` | hmn | Disabled transportation | Kev mus los rau neeg xiam oob qhab | 2026-11-15 | machine-drafted, needs native review |
| `qOftenNeedTransportationSupport` | hmn | How often do you need transportation support? | Koj xav tau kev pab mus los ntau npaum li cas? | 2026-11-15 | machine-drafted, needs native review |
| `oDailyWorkSchool` | hmn | Daily (work / school) | Txhua hnub (haujlwm / tsev kawm ntawv) | 2026-11-15 | machine-drafted, needs native review |
| `oSeveralTimesWeek` | hmn | Several times a week | Ob peb zaug ib lub lim tiam | 2026-11-15 | machine-drafted, needs native review |
| `oOccasionalTrips` | hmn | Occasional trips | Qee zaus xwb | 2026-11-15 | machine-drafted, needs native review |
| `oOneTimeNeed` | hmn | One-time need | Ib zaug xwb | 2026-11-15 | machine-drafted, needs native review |
| `descLegal` | hmn | Free legal aid for housing, family, and benefits | Kev pab cai lij choj dawb txog vaj tse, tsev neeg, thiab kev pab | 2026-11-15 | machine-drafted, needs native review |
| `qTypeLegal` | hmn | What type of legal help are you looking for? | Koj nrhiav kev pab cai lij choj hom twg? | 2026-11-15 | machine-drafted, needs native review |
| `oTenantRightsEviction` | hmn | Tenant rights / eviction | Txoj cai ntawm tus xauj tsev / raug ntiab tawm | 2026-11-15 | machine-drafted, needs native review |
| `oFamilyLaw` | hmn | Family law | Cai lij choj tsev neeg | 2026-11-15 | machine-drafted, needs native review |
| `oImmigration` | hmn | Immigration | Kev tsiv teb tsaws chaw | 2026-11-15 | machine-drafted, needs native review |
| `oCriminalRecordExpungement` | hmn | Criminal record expungement | Lwv cov ntaub ntawv ua txhaum cai | 2026-11-15 | machine-drafted, needs native review |
| `oBenefitsAppeals` | hmn | Benefits appeals | Kev thov rov xav txog kev pab | 2026-11-15 | machine-drafted, needs native review |
| `oConsumerProtection` | hmn | Consumer protection | Kev tiv thaiv cov neeg yuav khoom | 2026-11-15 | machine-drafted, needs native review |
| `qUrgentLegalSituation` | hmn | How urgent is your legal situation? | Koj qhov teeb meem cai lij choj ceev npaum li cas? | 2026-11-15 | machine-drafted, needs native review |
| `oImmediateCourtDateDeadlineThis` | hmn | Immediate (court date / deadline this week) | Tam sim ntawd (hnub mus tsev hais plaub / hnub kawg lub lim tiam no) | 2026-11-15 | machine-drafted, needs native review |
| `oUrgentWithinNextMonth` | hmn | Urgent (within the next month) | Ceev (hauv lub hli tom ntej) | 2026-11-15 | machine-drafted, needs native review |
| `oNotUrgentJustNeedGuidance` | hmn | Not urgent, just need guidance | Tsis ceev, tsuas xav tau kev qhia xwb | 2026-11-15 | machine-drafted, needs native review |
| `oJustExploringMyOptions` | hmn | Just exploring my options | Tsuas yog saib kuv cov kev xaiv xwb | 2026-11-15 | machine-drafted, needs native review |
| `descHealthcare` | hmn | Free clinics, Medicaid, prescriptions, and mental health | Tsev kho mob dawb, Medicaid, tshuaj, thiab kev noj qab haus huv ntawm lub hlwb | 2026-11-15 | machine-drafted, needs native review |
| `qTypeHealthcare` | hmn | What type of healthcare help are you looking for? | Koj nrhiav kev pab kho mob hom twg? | 2026-11-15 | machine-drafted, needs native review |
| `oMedicaidMedicareEnrollment` | hmn | Medicaid / Medicare enrollment | Kev sau npe Medicaid / Medicare | 2026-11-15 | machine-drafted, needs native review |
| `oFreeLowCostClinics` | hmn | Free or low-cost clinics | Tsev kho mob dawb los sis pheej yig | 2026-11-15 | machine-drafted, needs native review |
| `oPrescriptionAssistance` | hmn | Prescription assistance | Kev pab tshuaj kws kho mob sau | 2026-11-15 | machine-drafted, needs native review |
| `oMentalHealthServices` | hmn | Mental health services | Kev pab txog lub hlwb | 2026-11-15 | machine-drafted, needs native review |
| `oDentalCare` | hmn | Dental care | Kev kho hniav | 2026-11-15 | machine-drafted, needs native review |
| `oVisionCare` | hmn | Vision care | Kev kho qhov muag | 2026-11-15 | machine-drafted, needs native review |
| `qCurrentInsuranceStatus` | hmn | What is your current insurance status? | Tam sim no koj muaj kev pov hwm li cas? | 2026-11-15 | machine-drafted, needs native review |
| `oNoInsurance` | hmn | No insurance | Tsis muaj kev pov hwm | 2026-11-15 | machine-drafted, needs native review |
| `oPrivateInsurance` | hmn | Private insurance | Kev pov hwm ntiag tug | 2026-11-15 | machine-drafted, needs native review |
| `oEmployerInsurance` | hmn | Employer insurance | Kev pov hwm los ntawm tus tswv haujlwm | 2026-11-15 | machine-drafted, needs native review |
| `descEitcTaxFiling` | hmn | Free tax prep, EITC refunds, and filing assistance | Kev npaj se dawb, nyiaj rov qab EITC, thiab kev pab ua ntawv se | 2026-11-15 | machine-drafted, needs native review |
| `qTaxFilingStatus` | hmn | What is your tax filing status? | Koj txoj xwm txheej ua ntawv se yog dab tsi? | 2026-11-15 | machine-drafted, needs native review |
| `oSingle` | hmn | Single | Nyob ib leeg | 2026-11-15 | machine-drafted, needs native review |
| `oMarriedFilingJointly` | hmn | Married filing jointly | Muaj txij nkawm, ua ntawv se ua ke | 2026-11-15 | machine-drafted, needs native review |
| `oMarriedFilingSeparately` | hmn | Married filing separately | Muaj txij nkawm, ua ntawv se cais | 2026-11-15 | machine-drafted, needs native review |
| `oHeadHousehold` | hmn | Head of household | Tus thawj tsev neeg | 2026-11-15 | machine-drafted, needs native review |
| `oQualifyingSurvivingSpouse` | hmn | Qualifying surviving spouse | Tus txij nkawm uas tseem muaj sia nyob tsim nyog | 2026-11-15 | machine-drafted, needs native review |
| `qApproximateAnnualHouseholdIncome` | hmn | What is your approximate annual household income? | Koj tsev neeg cov nyiaj tau los ib xyoos kwv yees li pes tsawg? | 2026-11-15 | machine-drafted, needs native review |
| `qManyQualifyingChildrenDependentsHave` | hmn | How many qualifying children or dependents do you have? | Koj muaj pes tsawg tus menyuam los sis tus neeg vam khom uas tsim nyog? | 2026-11-15 | machine-drafted, needs native review |
| `oNone` | hmn | None | Tsis muaj | 2026-11-15 | machine-drafted, needs native review |
| `o1Child` | hmn | 1 child | 1 tus menyuam | 2026-11-15 | machine-drafted, needs native review |
| `o2Children` | hmn | 2 children | 2 tus menyuam | 2026-11-15 | machine-drafted, needs native review |
| `o3MoreChildren` | hmn | 3 or more children | 3 tus menyuam los sis ntau dua | 2026-11-15 | machine-drafted, needs native review |
| `descFreeLegal` | hmn | Legal aid clinics, pro bono attorneys, and self-help resources | Chaw pab cai lij choj, kws lij choj pab dawb, thiab cov khoom siv pab koj tus kheej | 2026-11-15 | machine-drafted, needs native review |
| `qTypeLegalIssueNeedWith` | hmn | What type of legal issue do you need help with? | Koj xav tau kev pab txog teeb meem cai lij choj hom twg? | 2026-11-15 | machine-drafted, needs native review |
| `oEvictionHousingCourt` | hmn | Eviction or housing court | Raug ntiab tawm los sis tsev hais plaub vaj tse | 2026-11-15 | machine-drafted, needs native review |
| `oDomesticViolenceProtectionOrder` | hmn | Domestic violence protection order | Daim ntawv tiv thaiv kev ua phem hauv tsev neeg | 2026-11-15 | machine-drafted, needs native review |
| `oChildCustodySupport` | hmn | Child custody or support | Kev saib xyuas menyuam los sis nyiaj yug menyuam | 2026-11-15 | machine-drafted, needs native review |
| `oImmigrationDaca` | hmn | Immigration or DACA | Kev tsiv teb tsaws chaw los sis DACA | 2026-11-15 | machine-drafted, needs native review |
| `oBenefitsDenialAppeal` | hmn | Benefits denial or appeal | Raug tsis kam pab los sis thov rov xav | 2026-11-15 | machine-drafted, needs native review |
| `oImmediateCourtDateOrDeadline` | hmn | Immediate (court date or deadline this week) | Tam sim ntawd (hnub mus tsev hais plaub los sis hnub kawg lub lim tiam no) | 2026-11-15 | machine-drafted, needs native review |
| `oUrgentWithinNext30Days` | hmn | Urgent (within the next 30 days) | Ceev (hauv 30 hnub tom ntej) | 2026-11-15 | machine-drafted, needs native review |
| `oNotUrgentNeedGeneralGuidance` | hmn | Not urgent, need general guidance | Tsis ceev, xav tau kev qhia dav dav | 2026-11-15 | machine-drafted, needs native review |
| `descPrenatalNatalCare` | hmn | Prenatal visits, WIC, newborn support, and postpartum care | Kev kuaj thaum cev xeeb tub, WIC, kev pab me nyuam mos, thiab kev saib xyuas tom qab yug me nyuam | 2026-11-15 | machine-drafted, needs native review |
| `qTypeSupport` | hmn | What type of support are you looking for? | Koj nrhiav kev txhawb nqa hom twg? | 2026-11-15 | machine-drafted, needs native review |
| `oPrenatalCheckupsUltrasounds` | hmn | Prenatal checkups and ultrasounds | Kev kuaj cev xeeb tub thiab ultrasound | 2026-11-15 | machine-drafted, needs native review |
| `oWicNutritionProgram` | hmn | WIC nutrition program | Kev pab zaub mov WIC | 2026-11-15 | machine-drafted, needs native review |
| `oBirthingCenterHospitalFinancial` | hmn | Birthing center or hospital financial help | Kev pab nyiaj rau chaw yug me nyuam los sis tsev kho mob | 2026-11-15 | machine-drafted, needs native review |
| `oPostpartumMentalHealthSupport` | hmn | Postpartum mental health support | Kev pab lub hlwb tom qab yug me nyuam | 2026-11-15 | machine-drafted, needs native review |
| `oNewbornCareSupplies` | hmn | Newborn care and supplies | Kev saib xyuas thiab khoom siv rau me nyuam mos | 2026-11-15 | machine-drafted, needs native review |
| `oLactationBreastfeedingSupport` | hmn | Lactation / breastfeeding support | Kev pab pub mis niam | 2026-11-15 | machine-drafted, needs native review |
| `qStageDescribesCurrentSituation` | hmn | What stage best describes your current situation? | Theem twg piav koj qhov xwm txheej tam sim no zoo tshaj? | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyPregnant1stTrimester` | hmn | Currently pregnant (1st trimester) | Tab tom xeeb tub (3 lub hlis thawj) | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyPregnant2ndTrimester` | hmn | Currently pregnant (2nd trimester) | Tab tom xeeb tub (3 lub hlis thib ob) | 2026-11-15 | machine-drafted, needs native review |
| `oCurrentlyPregnant3rdTrimester` | hmn | Currently pregnant (3rd trimester) | Tab tom xeeb tub (3 lub hlis kawg) | 2026-11-15 | machine-drafted, needs native review |
| `oRecentlyGaveBirthWithin3` | hmn | Recently gave birth (within 3 months) | Nyuam qhuav yug me nyuam (hauv 3 lub hlis) | 2026-11-15 | machine-drafted, needs native review |
| `oPlanningPregnancy` | hmn | Planning a pregnancy | Npaj yuav xeeb tub | 2026-11-15 | machine-drafted, needs native review |
| `descWasteDisposal` | hmn | Bulk trash pickup, hazardous waste drop-off, and recycling help | Kev tuaj khaws khib nyiab loj, chaw muab khib nyiab txaus ntshai, thiab kev pab rov siv dua | 2026-11-15 | machine-drafted, needs native review |
| `qTypeWasteDisposalNeed` | hmn | What type of waste or disposal help do you need? | Koj xav tau kev pab khib nyiab los sis pov tseg hom twg? | 2026-11-15 | machine-drafted, needs native review |
| `oBulkItemFurnitureRemoval` | hmn | Bulk item or furniture removal | Kev tshem khoom loj los sis rooj zaum | 2026-11-15 | machine-drafted, needs native review |
| `oHouseholdHazardousWastePaintChemicals` | hmn | Household hazardous waste (paint, chemicals) | Khib nyiab txaus ntshai hauv tsev (xim, tshuaj lom neeg) | 2026-11-15 | machine-drafted, needs native review |
| `oElectronicsRecyclingEWaste` | hmn | Electronics recycling (e-waste) | Kev rov siv khoom hluav taws xob (e-waste) | 2026-11-15 | machine-drafted, needs native review |
| `oMedicalSharpsMedicationDisposal` | hmn | Medical sharps or medication disposal | Kev pov tseg koob txhaj tshuaj los sis tshuaj | 2026-11-15 | machine-drafted, needs native review |
| `oYardWasteCompost` | hmn | Yard waste or compost | Khib nyiab hauv vaj los sis chiv | 2026-11-15 | machine-drafted, needs native review |
| `oGeneralRecyclingAccess` | hmn | General recycling access | Kev siv chaw rov siv khoom dua | 2026-11-15 | machine-drafted, needs native review |
| `qDescribesSituation` | hmn | Which best describes your situation? | Yam twg piav koj qhov xwm txheej zoo tshaj? | 2026-11-15 | machine-drafted, needs native review |
| `oOneTimeLargeCleanout` | hmn | One-time large cleanout | Ntxuav loj ib zaug | 2026-11-15 | machine-drafted, needs native review |
| `oOngoingDisposalNeed` | hmn | Ongoing disposal need | Xav tau pov tseg tas li | 2026-11-15 | machine-drafted, needs native review |
| `oRespondingNaturalDisasterEmergency` | hmn | Responding to a natural disaster or emergency | Teb rau kev puas tsuaj los ntawm xwm los sis xwm txheej ceev | 2026-11-15 | machine-drafted, needs native review |
| `oMovingEvictionCleanup` | hmn | Moving or eviction cleanup | Ntxuav vim tsiv tsev los sis raug ntiab tawm | 2026-11-15 | machine-drafted, needs native review |
| `descFreeCamping` | hmn | Free campsites, dispersed camping, and overnight shelters | Chaw pw hav zoov dawb, pw hav zoov qhib, thiab chaw nyob ib hmo | 2026-11-15 | machine-drafted, needs native review |
| `qTypeCampingOvernightShelter` | hmn | What type of camping or overnight shelter are you looking for? | Koj nrhiav chaw pw hav zoov los sis chaw nyob ib hmo hom twg? | 2026-11-15 | machine-drafted, needs native review |
| `oFreeDispersedPrimitiveCampingPublic` | hmn | Free dispersed (primitive) camping on public land | Pw hav zoov dawb (yooj yim) rau ntawm av pej xeem | 2026-11-15 | machine-drafted, needs native review |
| `oFreeDesignatedCampsitesNationalForest` | hmn | Free designated campsites (national forest, BLM) | Chaw pw hav zoov dawb uas tau teem tseg (hav zoov teb chaws, BLM) | 2026-11-15 | machine-drafted, needs native review |
| `oSafeOvernightParkingVehicle` | hmn | Safe overnight parking for a vehicle | Chaw nres tsheb nyab xeeb ib hmo | 2026-11-15 | machine-drafted, needs native review |
| `oEmergencyOvernightShelter` | hmn | Emergency overnight shelter | Chaw nyob ib hmo thaum muaj xwm txheej ceev | 2026-11-15 | machine-drafted, needs native review |
| `oLongTermCampingWhileAwaiting` | hmn | Long-term camping while awaiting housing | Pw hav zoov ntev thaum tos tsev nyob | 2026-11-15 | machine-drafted, needs native review |
| `qLongNeedCampStay` | hmn | How long do you need to camp or stay? | Koj xav pw hav zoov los sis nyob ntev npaum li cas? | 2026-11-15 | machine-drafted, needs native review |
| `o12Nights` | hmn | 1–2 nights | 1–2 hmo | 2026-11-15 | machine-drafted, needs native review |
| `oFewDaysUpWeek` | hmn | A few days (up to a week) | Ob peb hnub (txog ib lub lim tiam) | 2026-11-15 | machine-drafted, needs native review |
| `o14Weeks` | hmn | 1–4 weeks | 1–4 lub lim tiam | 2026-11-15 | machine-drafted, needs native review |
| `oMoreThanMonth` | hmn | More than a month | Ntau tshaj ib hlis | 2026-11-15 | machine-drafted, needs native review |
| `descFreeGoodsDonation` | hmn | Free clothing, furniture, household items, and donation programs | Khaub ncaws, rooj zaum, khoom siv hauv tsev dawb, thiab kev pub dawb | 2026-11-15 | machine-drafted, needs native review |
| `qTypesGoods` | hmn | What types of goods are you looking for? | Koj nrhiav khoom hom twg? | 2026-11-15 | machine-drafted, needs native review |
| `oClothingShoes` | hmn | Clothing and shoes | Khaub ncaws thiab khau | 2026-11-15 | machine-drafted, needs native review |
| `oFurnitureHomeGoods` | hmn | Furniture and home goods | Rooj zaum thiab khoom siv hauv tsev | 2026-11-15 | machine-drafted, needs native review |
| `oBabyChildrenItems` | hmn | Baby and children items | Khoom rau me nyuam mos thiab menyuam yaus | 2026-11-15 | machine-drafted, needs native review |
| `oElectronicsAppliances` | hmn | Electronics and appliances | Khoom hluav taws xob thiab khoom siv hauv tsev | 2026-11-15 | machine-drafted, needs native review |
| `oHygienePersonalCareItems` | hmn | Hygiene and personal care items | Khoom huv si thiab saib xyuas tus kheej | 2026-11-15 | machine-drafted, needs native review |
| `oSchoolSupplies` | hmn | School supplies | Khoom siv kawm ntawv | 2026-11-15 | machine-drafted, needs native review |
| `oSettingUpNewHome` | hmn | Setting up a new home | Npaj lub tsev tshiab | 2026-11-15 | machine-drafted, needs native review |
| `oLostBelongingsFireFloodDisaster` | hmn | Lost belongings (fire, flood, disaster) | Poob khoom (hluav taws, dej nyab, kev puas tsuaj) | 2026-11-15 | machine-drafted, needs native review |
| `oExperiencingFinancialHardship` | hmn | Experiencing financial hardship | Muaj teeb meem nyiaj txiag | 2026-11-15 | machine-drafted, needs native review |
| `oTransitioningOutShelterFacility` | hmn | Transitioning out of shelter or facility | Tawm ntawm chaw nyob ib ntus los sis chaw saib xyuas | 2026-11-15 | machine-drafted, needs native review |
| `FILTER_MATCHES.other` | ht | {n} matches | {n} rezilta | 2026-11-15 | machine-drafted, needs native review |
| `FILTER_MATCHES.other` | so | {n} matches | {n} natiijo | 2026-11-15 | machine-drafted, needs native review |
| `FILTER_MATCHES.one` | am | {n} match | {n} ውጤት | 2026-11-15 | machine-drafted, needs native review |
| `FILTER_MATCHES.other` | am | {n} matches | {n} ውጤቶች | 2026-11-15 | machine-drafted, needs native review |
| `FILTER_MATCHES.other` | hmn | {n} matches | {n} qhov phim | 2026-11-15 | machine-drafted, needs native review |

### `lib/i18n-onboarding.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `roleSeeker` | ht | Seeker | Mwen bezwen èd | 2026-11-15 | machine-drafted, needs native review |
| `roleSeekerBody` | ht | Find food, housing, healthcare, jobs, and other resources near you | Jwenn manje, lojman, swen sante, travay ak lòt resous toupre w | 2026-11-15 | machine-drafted, needs native review |
| `roleSourcer` | ht | Sourcer | Mwen ofri èd | 2026-11-15 | machine-drafted, needs native review |
| `roleSourcerBody` | ht | Share resources, connect people with services, or offer direct support | Pataje resous, konekte moun ak sèvis, oswa bay sipò dirèk | 2026-11-15 | machine-drafted, needs native review |
| `roleBoth` | ht | Both | Toude | 2026-11-15 | machine-drafted, needs native review |
| `roleBothBody` | ht | I need help in some areas and can offer help in others | Mwen bezwen èd nan kèk domèn epi mwen ka ede nan lòt | 2026-11-15 | machine-drafted, needs native review |
| `needFood` | ht | Food Assistance | Èd pou manje | 2026-11-15 | machine-drafted, needs native review |
| `needHousing` | ht | Housing | Lojman | 2026-11-15 | machine-drafted, needs native review |
| `needHealthcare` | ht | Healthcare | Swen sante | 2026-11-15 | machine-drafted, needs native review |
| `needEmployment` | ht | Employment | Travay | 2026-11-15 | machine-drafted, needs native review |
| `needChildcare` | ht | Childcare | Gadri timoun | 2026-11-15 | machine-drafted, needs native review |
| `needLegal` | ht | Legal Aid | Èd legal | 2026-11-15 | machine-drafted, needs native review |
| `needFinancial` | ht | Financial Help | Èd finansye | 2026-11-15 | machine-drafted, needs native review |
| `needEducation` | ht | Education | Edikasyon | 2026-11-15 | machine-drafted, needs native review |
| `locationFailed` | ht | Could not get your location. Please enter it manually. | Nou pa t ka jwenn kote ou ye. Tanpri antre l poukont ou. | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | ht | Could not save your profile. Please try again. | Nou pa t ka anrejistre pwofil ou. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `step1Title` | ht | I'm here to... | Mwen la pou... | 2026-11-15 | machine-drafted, needs native review |
| `step2Title` | ht | Where are you located? | Ki kote ou ye? | 2026-11-15 | machine-drafted, needs native review |
| `step3TitleProviding` | ht | What can you help with? | Nan ki sa ou ka ede? | 2026-11-15 | machine-drafted, needs native review |
| `step3TitleSeeking` | ht | What do you need help with? | Nan ki sa ou bezwen èd? | 2026-11-15 | machine-drafted, needs native review |
| `step4Title` | ht | How can we reach you? | Kijan nou ka kontakte w? | 2026-11-15 | machine-drafted, needs native review |
| `step5Title` | ht | What language do you prefer? | Ki lang ou prefere? | 2026-11-15 | machine-drafted, needs native review |
| `step1Body` | ht | Tell us how you want to use FEED | Di nou kijan ou vle itilize FEED | 2026-11-15 | machine-drafted, needs native review |
| `step2Body` | ht | This helps us find resources near you | Sa ede nou jwenn resous toupre w | 2026-11-15 | machine-drafted, needs native review |
| `step3Body` | ht | Select all that apply - you can change this later | Chwazi tout sa ki aplike - ou ka chanje sa pita | 2026-11-15 | machine-drafted, needs native review |
| `step4Body` | ht | Optional - for appointment reminders and updates | Si ou vle - pou rapèl randevou ak nouvèl | 2026-11-15 | machine-drafted, needs native review |
| `step5Body` | ht | The AI assistant will greet you in your language | Asistan IA a ap salye w nan lang ou | 2026-11-15 | machine-drafted, needs native review |
| `skipForNow` | ht | Skip for now | Sote pou kounye a | 2026-11-15 | machine-drafted, needs native review |
| `locating` | ht | Getting location... | N ap chèche kote ou ye... | 2026-11-15 | machine-drafted, needs native review |
| `useLocation` | ht | Use my current location | Sèvi ak kote mwen ye kounye a | 2026-11-15 | machine-drafted, needs native review |
| `locationDetected` | ht | Location detected | Nou jwenn kote ou ye | 2026-11-15 | machine-drafted, needs native review |
| `locationDetectedAt` | ht | Location detected: {place} | Nou jwenn kote ou ye: {place} | 2026-11-15 | machine-drafted, needs native review |
| `orEnterManually` | ht | Or enter manually | Oswa antre l poukont ou | 2026-11-15 | machine-drafted, needs native review |
| `zipCode` | ht | ZIP Code | Kòd postal | 2026-11-15 | machine-drafted, needs native review |
| `city` | ht | City | Vil | 2026-11-15 | machine-drafted, needs native review |
| `phCity` | ht | Los Angeles | Los Angeles | 2026-11-15 | machine-drafted, needs native review |
| `stateLabel` | ht | State | Eta | 2026-11-15 | machine-drafted, needs native review |
| `phone` | ht | Phone Number | Nimewo telefòn | 2026-11-15 | machine-drafted, needs native review |
| `optional` | ht | (optional) | (si ou vle) | 2026-11-15 | machine-drafted, needs native review |
| `phoneHint` | ht | For appointment reminders and important updates only. Never shared. | Sèlman pou rapèl randevou ak nouvèl enpòtan. Nou pa janm pataje l. | 2026-11-15 | machine-drafted, needs native review |
| `languageLabel` | ht | Preferred language | Lang ou prefere | 2026-11-15 | machine-drafted, needs native review |
| `changeLater` | ht | You can change this at any time in Settings. | Ou ka chanje sa nenpòt ki lè nan Paramèt. | 2026-11-15 | machine-drafted, needs native review |
| `saving` | ht | Saving... | N ap anrejistre... | 2026-11-15 | machine-drafted, needs native review |
| `getStarted` | ht | Get Started | Kòmanse | 2026-11-15 | machine-drafted, needs native review |
| `chooseRole` | ht | Choose one option to continue. | Chwazi yon opsyon pou kontinye. | 2026-11-15 | machine-drafted, needs native review |
| `chooseLocation` | ht | Enter a 5-digit ZIP code or use your current location to continue. | Antre yon kòd postal 5 chif oswa sèvi ak kote ou ye kounye a pou kontinye. | 2026-11-15 | machine-drafted, needs native review |
| `chooseNeed` | ht | Choose at least one option to continue. | Chwazi omwen yon opsyon pou kontinye. | 2026-11-15 | machine-drafted, needs native review |
| `roleSeeker` | so | Seeker | Caawimo ayaan raadinayaa | 2026-11-15 | machine-drafted, needs native review |
| `roleSeekerBody` | so | Find food, housing, healthcare, jobs, and other resources near you | Hel cunto, guri, daryeel caafimaad, shaqo iyo kheyraad kale oo kuu dhow | 2026-11-15 | machine-drafted, needs native review |
| `roleSourcer` | so | Sourcer | Caawimo ayaan bixiyaa | 2026-11-15 | machine-drafted, needs native review |
| `roleSourcerBody` | so | Share resources, connect people with services, or offer direct support | La wadaag kheyraad, dadka ku xir adeegyo, ama bixi taageero toos ah | 2026-11-15 | machine-drafted, needs native review |
| `roleBoth` | so | Both | Labadaba | 2026-11-15 | machine-drafted, needs native review |
| `roleBothBody` | so | I need help in some areas and can offer help in others | Qaybaha qaar caawimo ayaan u baahanahay, qaar kalena waan caawin karaa | 2026-11-15 | machine-drafted, needs native review |
| `needFood` | so | Food Assistance | Gargaar cunto | 2026-11-15 | machine-drafted, needs native review |
| `needHousing` | so | Housing | Guri | 2026-11-15 | machine-drafted, needs native review |
| `needHealthcare` | so | Healthcare | Daryeel caafimaad | 2026-11-15 | machine-drafted, needs native review |
| `needEmployment` | so | Employment | Shaqo | 2026-11-15 | machine-drafted, needs native review |
| `needChildcare` | so | Childcare | Xannaanada carruurta | 2026-11-15 | machine-drafted, needs native review |
| `needLegal` | so | Legal Aid | Gargaar sharci | 2026-11-15 | machine-drafted, needs native review |
| `needFinancial` | so | Financial Help | Gargaar dhaqaale | 2026-11-15 | machine-drafted, needs native review |
| `needEducation` | so | Education | Waxbarasho | 2026-11-15 | machine-drafted, needs native review |
| `locationFailed` | so | Could not get your location. Please enter it manually. | Lama helin goobtaada. Fadlan gacanta ku geli. | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | so | Could not save your profile. Please try again. | Lama kaydin karin astaantaada. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `step1Title` | so | I'm here to... | Waxaan halkan u joogaa... | 2026-11-15 | machine-drafted, needs native review |
| `step2Title` | so | Where are you located? | Xaggee ayaad joogtaa? | 2026-11-15 | machine-drafted, needs native review |
| `step3TitleProviding` | so | What can you help with? | Maxaad ka caawin kartaa? | 2026-11-15 | machine-drafted, needs native review |
| `step3TitleSeeking` | so | What do you need help with? | Maxaad caawimo uga baahan tahay? | 2026-11-15 | machine-drafted, needs native review |
| `step4Title` | so | How can we reach you? | Sidee kuu soo xiriiri karnaa? | 2026-11-15 | machine-drafted, needs native review |
| `step5Title` | so | What language do you prefer? | Luuqaddee ayaad door bidaysaa? | 2026-11-15 | machine-drafted, needs native review |
| `step1Body` | so | Tell us how you want to use FEED | Noo sheeg sida aad u rabto inaad u isticmaasho FEED | 2026-11-15 | machine-drafted, needs native review |
| `step2Body` | so | This helps us find resources near you | Tani waxay naga caawinaysaa inaan helno kheyraad kuu dhow | 2026-11-15 | machine-drafted, needs native review |
| `step3Body` | so | Select all that apply - you can change this later | Dooro dhammaan kuwa khuseeya - hadhow waad beddeli kartaa | 2026-11-15 | machine-drafted, needs native review |
| `step4Body` | so | Optional - for appointment reminders and updates | Ikhtiyaari - xasuusinta ballamaha iyo warar | 2026-11-15 | machine-drafted, needs native review |
| `step5Body` | so | The AI assistant will greet you in your language | Kaaliyaha AI wuxuu kugu salaami doonaa luuqaddaada | 2026-11-15 | machine-drafted, needs native review |
| `skipForNow` | so | Skip for now | Hadda ka bood | 2026-11-15 | machine-drafted, needs native review |
| `locating` | so | Getting location... | Goobta waa la raadinayaa... | 2026-11-15 | machine-drafted, needs native review |
| `useLocation` | so | Use my current location | Isticmaal goobtayda hadda | 2026-11-15 | machine-drafted, needs native review |
| `locationDetected` | so | Location detected | Goobta waa la helay | 2026-11-15 | machine-drafted, needs native review |
| `locationDetectedAt` | so | Location detected: {place} | Goobta waa la helay: {place} | 2026-11-15 | machine-drafted, needs native review |
| `orEnterManually` | so | Or enter manually | Ama gacanta ku geli | 2026-11-15 | machine-drafted, needs native review |
| `zipCode` | so | ZIP Code | Koodhka boostada | 2026-11-15 | machine-drafted, needs native review |
| `city` | so | City | Magaalada | 2026-11-15 | machine-drafted, needs native review |
| `phCity` | so | Los Angeles | Los Angeles | 2026-11-15 | machine-drafted, needs native review |
| `stateLabel` | so | State | Gobolka | 2026-11-15 | machine-drafted, needs native review |
| `phone` | so | Phone Number | Lambarka taleefanka | 2026-11-15 | machine-drafted, needs native review |
| `optional` | so | (optional) | (ikhtiyaari) | 2026-11-15 | machine-drafted, needs native review |
| `phoneHint` | so | For appointment reminders and important updates only. Never shared. | Kaliya xasuusinta ballamaha iyo warar muhiim ah. Weligii lama wadaago. | 2026-11-15 | machine-drafted, needs native review |
| `languageLabel` | so | Preferred language | Luuqadda aad door bidayso | 2026-11-15 | machine-drafted, needs native review |
| `changeLater` | so | You can change this at any time in Settings. | Waqti kasta waad ka beddeli kartaa Dejinta. | 2026-11-15 | machine-drafted, needs native review |
| `saving` | so | Saving... | Waa la kaydinayaa... | 2026-11-15 | machine-drafted, needs native review |
| `getStarted` | so | Get Started | Bilow | 2026-11-15 | machine-drafted, needs native review |
| `chooseRole` | so | Choose one option to continue. | Dooro hal doorasho si aad u sii waddo. | 2026-11-15 | machine-drafted, needs native review |
| `chooseLocation` | so | Enter a 5-digit ZIP code or use your current location to continue. | Geli koodh boosto oo 5 god ah ama isticmaal goobtaada hadda si aad u sii waddo. | 2026-11-15 | machine-drafted, needs native review |
| `chooseNeed` | so | Choose at least one option to continue. | Dooro ugu yaraan hal doorasho si aad u sii waddo. | 2026-11-15 | machine-drafted, needs native review |
| `roleSeeker` | am | Seeker | እርዳታ እፈልጋለሁ | 2026-11-15 | machine-drafted, needs native review |
| `roleSeekerBody` | am | Find food, housing, healthcare, jobs, and other resources near you | በአቅራቢያዎ ምግብ፣ መኖሪያ፣ የጤና አገልግሎት፣ ሥራ እና ሌሎች ሀብቶችን ያግኙ | 2026-11-15 | machine-drafted, needs native review |
| `roleSourcer` | am | Sourcer | እርዳታ እሰጣለሁ | 2026-11-15 | machine-drafted, needs native review |
| `roleSourcerBody` | am | Share resources, connect people with services, or offer direct support | ሀብቶችን ያጋሩ፣ ሰዎችን ከአገልግሎቶች ጋር ያገናኙ ወይም ቀጥተኛ ድጋፍ ይስጡ | 2026-11-15 | machine-drafted, needs native review |
| `roleBoth` | am | Both | ሁለቱንም | 2026-11-15 | machine-drafted, needs native review |
| `roleBothBody` | am | I need help in some areas and can offer help in others | በአንዳንድ ጉዳዮች እርዳታ እፈልጋለሁ በሌሎች ደግሞ መርዳት እችላለሁ | 2026-11-15 | machine-drafted, needs native review |
| `needFood` | am | Food Assistance | የምግብ እርዳታ | 2026-11-15 | machine-drafted, needs native review |
| `needHousing` | am | Housing | መኖሪያ ቤት | 2026-11-15 | machine-drafted, needs native review |
| `needHealthcare` | am | Healthcare | የጤና አገልግሎት | 2026-11-15 | machine-drafted, needs native review |
| `needEmployment` | am | Employment | ሥራ | 2026-11-15 | machine-drafted, needs native review |
| `needChildcare` | am | Childcare | የሕፃናት እንክብካቤ | 2026-11-15 | machine-drafted, needs native review |
| `needLegal` | am | Legal Aid | የሕግ እርዳታ | 2026-11-15 | machine-drafted, needs native review |
| `needFinancial` | am | Financial Help | የገንዘብ እርዳታ | 2026-11-15 | machine-drafted, needs native review |
| `needEducation` | am | Education | ትምህርት | 2026-11-15 | machine-drafted, needs native review |
| `locationFailed` | am | Could not get your location. Please enter it manually. | አካባቢዎን ማግኘት አልተቻለም። እባክዎ በእጅ ያስገቡት። | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | am | Could not save your profile. Please try again. | መገለጫዎን ማስቀመጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `step1Title` | am | I'm here to... | እዚህ የመጣሁት ለ... | 2026-11-15 | machine-drafted, needs native review |
| `step2Title` | am | Where are you located? | የት ነው የሚገኙት? | 2026-11-15 | machine-drafted, needs native review |
| `step3TitleProviding` | am | What can you help with? | በምን መርዳት ይችላሉ? | 2026-11-15 | machine-drafted, needs native review |
| `step3TitleSeeking` | am | What do you need help with? | በምን እርዳታ ይፈልጋሉ? | 2026-11-15 | machine-drafted, needs native review |
| `step4Title` | am | How can we reach you? | እንዴት ልናገኝዎ እንችላለን? | 2026-11-15 | machine-drafted, needs native review |
| `step5Title` | am | What language do you prefer? | የትኛውን ቋንቋ ይመርጣሉ? | 2026-11-15 | machine-drafted, needs native review |
| `step1Body` | am | Tell us how you want to use FEED | FEEDን እንዴት መጠቀም እንደሚፈልጉ ይንገሩን | 2026-11-15 | machine-drafted, needs native review |
| `step2Body` | am | This helps us find resources near you | ይህ በአቅራቢያዎ ያሉ ሀብቶችን እንድናገኝ ይረዳናል | 2026-11-15 | machine-drafted, needs native review |
| `step3Body` | am | Select all that apply - you can change this later | የሚመለከቱትን ሁሉ ይምረጡ - በኋላ መቀየር ይችላሉ | 2026-11-15 | machine-drafted, needs native review |
| `step4Body` | am | Optional - for appointment reminders and updates | አማራጭ - ለቀጠሮ ማስታወሻዎችና ዝማኔዎች | 2026-11-15 | machine-drafted, needs native review |
| `step5Body` | am | The AI assistant will greet you in your language | የAI ረዳቱ በቋንቋዎ ሰላምታ ያቀርብልዎታል | 2026-11-15 | machine-drafted, needs native review |
| `skipForNow` | am | Skip for now | ለአሁን ዝለል | 2026-11-15 | machine-drafted, needs native review |
| `locating` | am | Getting location... | አካባቢ በመፈለግ ላይ... | 2026-11-15 | machine-drafted, needs native review |
| `useLocation` | am | Use my current location | የአሁኑን አካባቢዬን ተጠቀም | 2026-11-15 | machine-drafted, needs native review |
| `locationDetected` | am | Location detected | አካባቢ ተገኝቷል | 2026-11-15 | machine-drafted, needs native review |
| `locationDetectedAt` | am | Location detected: {place} | አካባቢ ተገኝቷል፦ {place} | 2026-11-15 | machine-drafted, needs native review |
| `orEnterManually` | am | Or enter manually | ወይም በእጅ ያስገቡ | 2026-11-15 | machine-drafted, needs native review |
| `zipCode` | am | ZIP Code | የፖስታ ኮድ (ZIP) | 2026-11-15 | machine-drafted, needs native review |
| `city` | am | City | ከተማ | 2026-11-15 | machine-drafted, needs native review |
| `phCity` | am | Los Angeles | ሎስ አንጀለስ | 2026-11-15 | machine-drafted, needs native review |
| `stateLabel` | am | State | ግዛት | 2026-11-15 | machine-drafted, needs native review |
| `phone` | am | Phone Number | ስልክ ቁጥር | 2026-11-15 | machine-drafted, needs native review |
| `optional` | am | (optional) | (አማራጭ) | 2026-11-15 | machine-drafted, needs native review |
| `phoneHint` | am | For appointment reminders and important updates only. Never shared. | ለቀጠሮ ማስታወሻዎችና አስፈላጊ ዝማኔዎች ብቻ። ፈጽሞ አይጋራም። | 2026-11-15 | machine-drafted, needs native review |
| `languageLabel` | am | Preferred language | የሚመርጡት ቋንቋ | 2026-11-15 | machine-drafted, needs native review |
| `changeLater` | am | You can change this at any time in Settings. | ይህን በማንኛውም ጊዜ በቅንብሮች ውስጥ መቀየር ይችላሉ። | 2026-11-15 | machine-drafted, needs native review |
| `saving` | am | Saving... | በማስቀመጥ ላይ... | 2026-11-15 | machine-drafted, needs native review |
| `getStarted` | am | Get Started | ጀምር | 2026-11-15 | machine-drafted, needs native review |
| `chooseRole` | am | Choose one option to continue. | ለመቀጠል አንድ አማራጭ ይምረጡ። | 2026-11-15 | machine-drafted, needs native review |
| `chooseLocation` | am | Enter a 5-digit ZIP code or use your current location to continue. | ለመቀጠል ባለ 5 አሃዝ የፖስታ ኮድ ያስገቡ ወይም የአሁኑን አካባቢዎን ይጠቀሙ። | 2026-11-15 | machine-drafted, needs native review |
| `chooseNeed` | am | Choose at least one option to continue. | ለመቀጠል ቢያንስ አንድ አማራጭ ይምረጡ። | 2026-11-15 | machine-drafted, needs native review |
| `roleSeeker` | hmn | Seeker | Kuv nrhiav kev pab | 2026-11-15 | machine-drafted, needs native review |
| `roleSeekerBody` | hmn | Find food, housing, healthcare, jobs, and other resources near you | Nrhiav zaub mov, vaj tse, kev kho mob, haujlwm, thiab lwm yam kev pab ze koj | 2026-11-15 | machine-drafted, needs native review |
| `roleSourcer` | hmn | Sourcer | Kuv muab kev pab | 2026-11-15 | machine-drafted, needs native review |
| `roleSourcerBody` | hmn | Share resources, connect people with services, or offer direct support | Qhia kev pab, txuas neeg rau cov kev pabcuam, lossis muab kev txhawb nqa ncaj qha | 2026-11-15 | machine-drafted, needs native review |
| `roleBoth` | hmn | Both | Ob yam | 2026-11-15 | machine-drafted, needs native review |
| `roleBothBody` | hmn | I need help in some areas and can offer help in others | Kuv xav tau kev pab rau qee yam thiab kuv pab tau rau lwm yam | 2026-11-15 | machine-drafted, needs native review |
| `needFood` | hmn | Food Assistance | Kev pab zaub mov | 2026-11-15 | machine-drafted, needs native review |
| `needHousing` | hmn | Housing | Vaj tse | 2026-11-15 | machine-drafted, needs native review |
| `needHealthcare` | hmn | Healthcare | Kev kho mob | 2026-11-15 | machine-drafted, needs native review |
| `needEmployment` | hmn | Employment | Haujlwm | 2026-11-15 | machine-drafted, needs native review |
| `needChildcare` | hmn | Childcare | Kev zov menyuam | 2026-11-15 | machine-drafted, needs native review |
| `needLegal` | hmn | Legal Aid | Kev pab txog kev cai lij choj | 2026-11-15 | machine-drafted, needs native review |
| `needFinancial` | hmn | Financial Help | Kev pab nyiaj txiag | 2026-11-15 | machine-drafted, needs native review |
| `needEducation` | hmn | Education | Kev kawm ntawv | 2026-11-15 | machine-drafted, needs native review |
| `locationFailed` | hmn | Could not get your location. Please enter it manually. | Nrhiav tsis tau koj qhov chaw. Thov ntaus nws rau koj tus kheej. | 2026-11-15 | machine-drafted, needs native review |
| `saveFailed` | hmn | Could not save your profile. Please try again. | Khaws tsis tau koj daim ntawv qhia txog koj. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `step1Title` | hmn | I'm here to... | Kuv tuaj ntawm no los... | 2026-11-15 | machine-drafted, needs native review |
| `step2Title` | hmn | Where are you located? | Koj nyob qhov twg? | 2026-11-15 | machine-drafted, needs native review |
| `step3TitleProviding` | hmn | What can you help with? | Koj pab tau dab tsi? | 2026-11-15 | machine-drafted, needs native review |
| `step3TitleSeeking` | hmn | What do you need help with? | Koj xav tau kev pab dab tsi? | 2026-11-15 | machine-drafted, needs native review |
| `step4Title` | hmn | How can we reach you? | Peb yuav tiv tauj koj li cas? | 2026-11-15 | machine-drafted, needs native review |
| `step5Title` | hmn | What language do you prefer? | Koj nyiam hom lus twg? | 2026-11-15 | machine-drafted, needs native review |
| `step1Body` | hmn | Tell us how you want to use FEED | Qhia peb seb koj xav siv FEED li cas | 2026-11-15 | machine-drafted, needs native review |
| `step2Body` | hmn | This helps us find resources near you | Qhov no pab peb nrhiav kev pab ze koj | 2026-11-15 | machine-drafted, needs native review |
| `step3Body` | hmn | Select all that apply - you can change this later | Xaiv txhua yam uas haum - koj hloov tau tom qab | 2026-11-15 | machine-drafted, needs native review |
| `step4Body` | hmn | Optional - for appointment reminders and updates | Tsis yuam - rau kev ceeb toom txog kev teem caij thiab xov xwm | 2026-11-15 | machine-drafted, needs native review |
| `step5Body` | hmn | The AI assistant will greet you in your language | Tus pab AI yuav tos txais koj ua koj hom lus | 2026-11-15 | machine-drafted, needs native review |
| `skipForNow` | hmn | Skip for now | Hla tam sim no | 2026-11-15 | machine-drafted, needs native review |
| `locating` | hmn | Getting location... | Tab tom nrhiav qhov chaw... | 2026-11-15 | machine-drafted, needs native review |
| `useLocation` | hmn | Use my current location | Siv kuv qhov chaw tam sim no | 2026-11-15 | machine-drafted, needs native review |
| `locationDetected` | hmn | Location detected | Nrhiav tau qhov chaw lawm | 2026-11-15 | machine-drafted, needs native review |
| `locationDetectedAt` | hmn | Location detected: {place} | Nrhiav tau qhov chaw lawm: {place} | 2026-11-15 | machine-drafted, needs native review |
| `orEnterManually` | hmn | Or enter manually | Lossis ntaus rau koj tus kheej | 2026-11-15 | machine-drafted, needs native review |
| `zipCode` | hmn | ZIP Code | Tus lej ZIP | 2026-11-15 | machine-drafted, needs native review |
| `city` | hmn | City | Lub nroog | 2026-11-15 | machine-drafted, needs native review |
| `phCity` | hmn | Los Angeles | Los Angeles | 2026-11-15 | machine-drafted, needs native review |
| `stateLabel` | hmn | State | Lub xeev | 2026-11-15 | machine-drafted, needs native review |
| `phone` | hmn | Phone Number | Tus xov tooj | 2026-11-15 | machine-drafted, needs native review |
| `optional` | hmn | (optional) | (tsis yuam) | 2026-11-15 | machine-drafted, needs native review |
| `phoneHint` | hmn | For appointment reminders and important updates only. Never shared. | Tsuas yog rau kev ceeb toom txog kev teem caij thiab xov xwm tseem ceeb xwb. Yeej tsis qhia rau leej twg. | 2026-11-15 | machine-drafted, needs native review |
| `languageLabel` | hmn | Preferred language | Hom lus koj nyiam | 2026-11-15 | machine-drafted, needs native review |
| `changeLater` | hmn | You can change this at any time in Settings. | Koj hloov tau qhov no txhua lub sijhawm hauv Chaw Teeb Tsa. | 2026-11-15 | machine-drafted, needs native review |
| `saving` | hmn | Saving... | Tab tom khaws... | 2026-11-15 | machine-drafted, needs native review |
| `getStarted` | hmn | Get Started | Pib | 2026-11-15 | machine-drafted, needs native review |
| `chooseRole` | hmn | Choose one option to continue. | Xaiv ib qho kom mus ntxiv. | 2026-11-15 | machine-drafted, needs native review |
| `chooseLocation` | hmn | Enter a 5-digit ZIP code or use your current location to continue. | Ntaus tus lej ZIP 5 tus lossis siv koj qhov chaw tam sim no kom mus ntxiv. | 2026-11-15 | machine-drafted, needs native review |
| `chooseNeed` | hmn | Choose at least one option to continue. | Xaiv tsawg kawg ib qho kom mus ntxiv. | 2026-11-15 | machine-drafted, needs native review |

### `lib/i18n-org-admin.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `backAll` | ht | All organizations | Tout òganizasyon yo | 2026-11-15 | machine-drafted, needs native review |
| `backYours` | ht | Your organizations | Òganizasyon ou yo | 2026-11-15 | machine-drafted, needs native review |
| `sections` | ht | Organization admin sections | Seksyon administrasyon òganizasyon an | 2026-11-15 | machine-drafted, needs native review |
| `tabOverview` | ht | Overview | Apèsi | 2026-11-15 | machine-drafted, needs native review |
| `tabEvents` | ht | Events | Evènman | 2026-11-15 | machine-drafted, needs native review |
| `tabProfile` | ht | Profile | Pwofil | 2026-11-15 | machine-drafted, needs native review |
| `tabMembers` | ht | Members | Manm | 2026-11-15 | machine-drafted, needs native review |
| `profileTitle` | ht | Public profile | Pwofil piblik | 2026-11-15 | machine-drafted, needs native review |
| `profileIntro` | ht | Name, description, contact details, hours, map pin, photos and linked resources shown on this organization’s public page. | Non, deskripsyon, kontak, lè ouvèti, pwen sou kat, foto ak resous ki lye ki parèt sou paj piblik òganizasyon sa a. | 2026-11-15 | machine-drafted, needs native review |
| `editProfile` | ht | Edit profile | Modifye pwofil la | 2026-11-15 | machine-drafted, needs native review |
| `overviewTitle` | ht | This organization at a glance | Òganizasyon sa a an bref | 2026-11-15 | machine-drafted, needs native review |
| `overviewLoading` | ht | Loading overview… | Ap chaje apèsi a… | 2026-11-15 | machine-drafted, needs native review |
| `overviewFailed` | ht | Could not load this organization’s numbers. | Nou pa t kapab chaje chif òganizasyon sa a. | 2026-11-15 | machine-drafted, needs native review |
| `tryAgain` | ht | Try again | Eseye ankò | 2026-11-15 | machine-drafted, needs native review |
| `tileActiveEvents` | ht | Active events | Evènman aktif | 2026-11-15 | machine-drafted, needs native review |
| `tileUpcomingDates` | ht | Event dates, next 30 days | Dat evènman, 30 pwochen jou yo | 2026-11-15 | machine-drafted, needs native review |
| `tileCheckins` | ht | Check-ins, last 30 days | Prezans anrejistre, 30 dènye jou yo | 2026-11-15 | machine-drafted, needs native review |
| `tileMembers` | ht | Members | Manm | 2026-11-15 | machine-drafted, needs native review |
| `endingTitle` | ht | Repeating events ending in the next 30 days | Evènman ki repete ki fini nan 30 pwochen jou yo | 2026-11-15 | machine-drafted, needs native review |
| `loading` | ht | Loading… | Ap chaje… | 2026-11-15 | machine-drafted, needs native review |
| `endingFailed` | ht | Could not load the repeating events that end soon. | Nou pa t kapab chaje evènman ki repete ki pral fini byento yo. | 2026-11-15 | machine-drafted, needs native review |
| `endingEmpty` | ht | No repeating event ends in the next 30 days. | Pa gen evènman ki repete ki fini nan 30 pwochen jou yo. | 2026-11-15 | machine-drafted, needs native review |
| `indexIntro` | ht | Choose an organization to manage its events, profile and members. | Chwazi yon òganizasyon pou jere evènman, pwofil ak manm li. | 2026-11-15 | machine-drafted, needs native review |
| `indexEmpty` | ht | You do not manage any active organization right now. | Ou pa jere okenn òganizasyon aktif kounye a. | 2026-11-15 | machine-drafted, needs native review |
| `userIdLabel` | ht | User ID | ID itilizatè | 2026-11-15 | machine-drafted, needs native review |
| `roleLabel` | ht | Role | Wòl | 2026-11-15 | machine-drafted, needs native review |
| `roleMember` | ht | Member | Manm | 2026-11-15 | machine-drafted, needs native review |
| `roleAdmin` | ht | Admin | Administratè | 2026-11-15 | machine-drafted, needs native review |
| `addMember` | ht | Add member | Ajoute manm | 2026-11-15 | machine-drafted, needs native review |
| `adding` | ht | Adding… | Ap ajoute… | 2026-11-15 | machine-drafted, needs native review |
| `membersLoading` | ht | Loading members… | Ap chaje manm yo… | 2026-11-15 | machine-drafted, needs native review |
| `membersEmpty` | ht | No members yet. | Poko gen manm. | 2026-11-15 | machine-drafted, needs native review |
| `colJoined` | ht | Joined | Antre | 2026-11-15 | machine-drafted, needs native review |
| `colActions` | ht | Actions | Aksyon | 2026-11-15 | machine-drafted, needs native review |
| `remove` | ht | Remove | Retire | 2026-11-15 | machine-drafted, needs native review |
| `membersLoadFailed` | ht | Could not load members. | Nou pa t kapab chaje manm yo. | 2026-11-15 | machine-drafted, needs native review |
| `addFailed` | ht | Could not add that member. Check the user ID and try again. | Nou pa t kapab ajoute manm sa a. Verifye ID itilizatè a epi eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `addDuplicate` | ht | That person is already a member. | Moun sa a deja manm. | 2026-11-15 | machine-drafted, needs native review |
| `addInvalid` | ht | That is not a valid user ID. | Sa a pa yon ID itilizatè ki valab. | 2026-11-15 | machine-drafted, needs native review |
| `addNoAccount` | ht | No account has that user ID. | Pa gen kont ki gen ID itilizatè sa a. | 2026-11-15 | machine-drafted, needs native review |
| `removeFailed` | ht | Could not remove that member — you may not have permission, or they were already removed. | Nou pa t kapab retire manm sa a — petèt ou pa gen otorizasyon, oswa yo te deja retire l. | 2026-11-15 | machine-drafted, needs native review |
| `roleFailed` | ht | Could not change that role — you may not have permission. | Nou pa t kapab chanje wòl sa a — petèt ou pa gen otorizasyon. | 2026-11-15 | machine-drafted, needs native review |
| `memberAdded` | ht | Member added. | Manm ajoute. | 2026-11-15 | machine-drafted, needs native review |
| `memberRemoved` | ht | Member removed. | Manm retire. | 2026-11-15 | machine-drafted, needs native review |
| `roleChanged` | ht | Role changed. | Wòl chanje. | 2026-11-15 | machine-drafted, needs native review |
| `close` | ht | Close | Fèmen | 2026-11-15 | machine-drafted, needs native review |
| `waitingTitle` | ht | Waiting to confirm ({count}) | Ap tann konfimasyon ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `waitingEmpty` | ht | No one is waiting — early check-ins appear here. | Pèsonn pa ap tann — moun ki anrejistre bonè parèt isit la. | 2026-11-15 | machine-drafted, needs native review |
| `householdSize` | ht | Household {size} | Fwaye {size} | 2026-11-15 | machine-drafted, needs native review |
| `attendance` | ht | attendance {rate} | prezans {rate} | 2026-11-15 | machine-drafted, needs native review |
| `confirm` | ht | Confirm | Konfime | 2026-11-15 | machine-drafted, needs native review |
| `walkinTitle` | ht | Add a walk-in | Ajoute yon moun ki vini san randevou | 2026-11-15 | machine-drafted, needs native review |
| `addHousehold` | ht | Add household | Ajoute fwaye | 2026-11-15 | machine-drafted, needs native review |
| `walkinHint` | ht | Anonymous walk-ins are counted for the event but not linked to any account. | Moun anonim ki vini san randevou konte pou evènman an, men yo pa lye ak okenn kont. | 2026-11-15 | machine-drafted, needs native review |
| `confirmedTitle` | ht | Confirmed ({count}) | Konfime ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `footer` | ht | Confirm each person as they arrive. Live count refreshes automatically. | Konfime chak moun lè yo rive. Kantite an dirèk la mete l ajou pou kont li. | 2026-11-15 | machine-drafted, needs native review |
| `flashConfirmed` | ht | Confirmed {name} | {name} konfime | 2026-11-15 | machine-drafted, needs native review |
| `flashWalkin` | ht | Walk-in added | Moun san randevou ajoute | 2026-11-15 | machine-drafted, needs native review |
| `kioskLoadFailed` | ht | Could not refresh the attendance list. It will try again shortly. | Nou pa t kapab mete lis prezans lan ajou. L ap eseye ankò talè. | 2026-11-15 | machine-drafted, needs native review |
| `kioskConfirmFailed` | ht | Could not confirm {name}. Try again. | Nou pa t kapab konfime {name}. Eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `kioskWalkinFailed` | ht | Could not add the walk-in. Try again. | Nou pa t kapab ajoute moun san randevou a. Eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `backAll` | so | All organizations | Dhammaan ururada | 2026-11-15 | machine-drafted, needs native review |
| `backYours` | so | Your organizations | Ururadaada | 2026-11-15 | machine-drafted, needs native review |
| `sections` | so | Organization admin sections | Qaybaha maamulka ururka | 2026-11-15 | machine-drafted, needs native review |
| `tabOverview` | so | Overview | Guudmar | 2026-11-15 | machine-drafted, needs native review |
| `tabEvents` | so | Events | Dhacdooyin | 2026-11-15 | machine-drafted, needs native review |
| `tabProfile` | so | Profile | Astaan | 2026-11-15 | machine-drafted, needs native review |
| `tabMembers` | so | Members | Xubno | 2026-11-15 | machine-drafted, needs native review |
| `profileTitle` | so | Public profile | Astaanta dadweynaha | 2026-11-15 | machine-drafted, needs native review |
| `profileIntro` | so | Name, description, contact details, hours, map pin, photos and linked resources shown on this organization’s public page. | Magaca, sharaxaadda, xiriirka, saacadaha, calaamadda khariidadda, sawirrada iyo kheyraadka ku xiran ee ka muuqda bogga dadweynaha ee ururkan. | 2026-11-15 | machine-drafted, needs native review |
| `editProfile` | so | Edit profile | Wax ka beddel astaanta | 2026-11-15 | machine-drafted, needs native review |
| `overviewTitle` | so | This organization at a glance | Ururkan oo kooban | 2026-11-15 | machine-drafted, needs native review |
| `overviewLoading` | so | Loading overview… | Guudmarka waa la soo rarayaa… | 2026-11-15 | machine-drafted, needs native review |
| `overviewFailed` | so | Could not load this organization’s numbers. | Lama soo rari karin tirooyinka ururkan. | 2026-11-15 | machine-drafted, needs native review |
| `tryAgain` | so | Try again | Isku day mar kale | 2026-11-15 | machine-drafted, needs native review |
| `tileActiveEvents` | so | Active events | Dhacdooyinka firfircoon | 2026-11-15 | machine-drafted, needs native review |
| `tileUpcomingDates` | so | Event dates, next 30 days | Taariikhaha dhacdooyinka, 30 maalmood ee soo socda | 2026-11-15 | machine-drafted, needs native review |
| `tileCheckins` | so | Check-ins, last 30 days | Is-diiwaangelinta, 30-kii maalmood ee la soo dhaafay | 2026-11-15 | machine-drafted, needs native review |
| `tileMembers` | so | Members | Xubno | 2026-11-15 | machine-drafted, needs native review |
| `endingTitle` | so | Repeating events ending in the next 30 days | Dhacdooyinka soo noqnoqda ee dhammaanaya 30 maalmood ee soo socda | 2026-11-15 | machine-drafted, needs native review |
| `loading` | so | Loading… | Waa la soo rarayaa… | 2026-11-15 | machine-drafted, needs native review |
| `endingFailed` | so | Could not load the repeating events that end soon. | Lama soo rari karin dhacdooyinka soo noqnoqda ee dhowaan dhammaanaya. | 2026-11-15 | machine-drafted, needs native review |
| `endingEmpty` | so | No repeating event ends in the next 30 days. | Ma jirto dhacdo soo noqnoqota oo dhammaanaysa 30 maalmood ee soo socda. | 2026-11-15 | machine-drafted, needs native review |
| `indexIntro` | so | Choose an organization to manage its events, profile and members. | Dooro urur si aad u maamusho dhacdooyinkiisa, astaantiisa iyo xubnihiisa. | 2026-11-15 | machine-drafted, needs native review |
| `indexEmpty` | so | You do not manage any active organization right now. | Hadda ma maamushid urur firfircoon. | 2026-11-15 | machine-drafted, needs native review |
| `userIdLabel` | so | User ID | Aqoonsiga isticmaalaha | 2026-11-15 | machine-drafted, needs native review |
| `roleLabel` | so | Role | Door | 2026-11-15 | machine-drafted, needs native review |
| `roleMember` | so | Member | Xubin | 2026-11-15 | machine-drafted, needs native review |
| `roleAdmin` | so | Admin | Maamule | 2026-11-15 | machine-drafted, needs native review |
| `addMember` | so | Add member | Ku dar xubin | 2026-11-15 | machine-drafted, needs native review |
| `adding` | so | Adding… | Waa lagu darayaa… | 2026-11-15 | machine-drafted, needs native review |
| `membersLoading` | so | Loading members… | Xubnaha waa la soo rarayaa… | 2026-11-15 | machine-drafted, needs native review |
| `membersEmpty` | so | No members yet. | Wali xubno ma jiraan. | 2026-11-15 | machine-drafted, needs native review |
| `colJoined` | so | Joined | Ku biiray | 2026-11-15 | machine-drafted, needs native review |
| `colActions` | so | Actions | Ficillo | 2026-11-15 | machine-drafted, needs native review |
| `remove` | so | Remove | Ka saar | 2026-11-15 | machine-drafted, needs native review |
| `membersLoadFailed` | so | Could not load members. | Lama soo rari karin xubnaha. | 2026-11-15 | machine-drafted, needs native review |
| `addFailed` | so | Could not add that member. Check the user ID and try again. | Xubintaas laguma dari karin. Hubi aqoonsiga isticmaalaha oo isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `addDuplicate` | so | That person is already a member. | Qofkaasi horeba waa xubin. | 2026-11-15 | machine-drafted, needs native review |
| `addInvalid` | so | That is not a valid user ID. | Kani ma aha aqoonsi isticmaale oo sax ah. | 2026-11-15 | machine-drafted, needs native review |
| `addNoAccount` | so | No account has that user ID. | Ma jiro akoon leh aqoonsigaas. | 2026-11-15 | machine-drafted, needs native review |
| `removeFailed` | so | Could not remove that member — you may not have permission, or they were already removed. | Xubintaas lama saari karin — waxa laga yaabaa inaadan ogolaansho lahayn, ama horeba waa la saaray. | 2026-11-15 | machine-drafted, needs native review |
| `roleFailed` | so | Could not change that role — you may not have permission. | Doorkaas lama beddeli karin — waxa laga yaabaa inaadan ogolaansho lahayn. | 2026-11-15 | machine-drafted, needs native review |
| `memberAdded` | so | Member added. | Xubin waa lagu daray. | 2026-11-15 | machine-drafted, needs native review |
| `memberRemoved` | so | Member removed. | Xubin waa la saaray. | 2026-11-15 | machine-drafted, needs native review |
| `roleChanged` | so | Role changed. | Doorka waa la beddelay. | 2026-11-15 | machine-drafted, needs native review |
| `close` | so | Close | Xir | 2026-11-15 | machine-drafted, needs native review |
| `waitingTitle` | so | Waiting to confirm ({count}) | Sugaya xaqiijin ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `waitingEmpty` | so | No one is waiting — early check-ins appear here. | Qofna ma sugayo — kuwa hore isu diiwaangeliyey halkan ayay ka muuqdaan. | 2026-11-15 | machine-drafted, needs native review |
| `householdSize` | so | Household {size} | Qoys {size} | 2026-11-15 | machine-drafted, needs native review |
| `attendance` | so | attendance {rate} | imaansho {rate} | 2026-11-15 | machine-drafted, needs native review |
| `confirm` | so | Confirm | Xaqiiji | 2026-11-15 | machine-drafted, needs native review |
| `walkinTitle` | so | Add a walk-in | Ku dar qof aan ballan lahayn | 2026-11-15 | machine-drafted, needs native review |
| `addHousehold` | so | Add household | Ku dar qoys | 2026-11-15 | machine-drafted, needs native review |
| `walkinHint` | so | Anonymous walk-ins are counted for the event but not linked to any account. | Dadka aan magacooda la aqoon ee aan ballanta lahayn waa lagu tiriyaa dhacdada laakiin laguma xiro akoon. | 2026-11-15 | machine-drafted, needs native review |
| `confirmedTitle` | so | Confirmed ({count}) | La xaqiijiyey ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `footer` | so | Confirm each person as they arrive. Live count refreshes automatically. | Xaqiiji qof walba markuu yimaado. Tirinta tooska ahi si toos ah ayay isu cusboonaysiisaa. | 2026-11-15 | machine-drafted, needs native review |
| `flashConfirmed` | so | Confirmed {name} | {name} waa la xaqiijiyey | 2026-11-15 | machine-drafted, needs native review |
| `flashWalkin` | so | Walk-in added | Qof aan ballan lahayn ayaa lagu daray | 2026-11-15 | machine-drafted, needs native review |
| `kioskLoadFailed` | so | Could not refresh the attendance list. It will try again shortly. | Lama cusboonaysiin karin liiska imaanshaha. Mar kale ayuu dhowaan isku dayi doonaa. | 2026-11-15 | machine-drafted, needs native review |
| `kioskConfirmFailed` | so | Could not confirm {name}. Try again. | Lama xaqiijin karin {name}. Isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `kioskWalkinFailed` | so | Could not add the walk-in. Try again. | Lama dari karin qofka aan ballanta lahayn. Isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `backAll` | am | All organizations | ሁሉም ድርጅቶች | 2026-11-15 | machine-drafted, needs native review |
| `backYours` | am | Your organizations | የእርስዎ ድርጅቶች | 2026-11-15 | machine-drafted, needs native review |
| `sections` | am | Organization admin sections | የድርጅት አስተዳደር ክፍሎች | 2026-11-15 | machine-drafted, needs native review |
| `tabOverview` | am | Overview | አጠቃላይ እይታ | 2026-11-15 | machine-drafted, needs native review |
| `tabEvents` | am | Events | ዝግጅቶች | 2026-11-15 | machine-drafted, needs native review |
| `tabProfile` | am | Profile | መገለጫ | 2026-11-15 | machine-drafted, needs native review |
| `tabMembers` | am | Members | አባላት | 2026-11-15 | machine-drafted, needs native review |
| `profileTitle` | am | Public profile | ይፋዊ መገለጫ | 2026-11-15 | machine-drafted, needs native review |
| `profileIntro` | am | Name, description, contact details, hours, map pin, photos and linked resources shown on this organization’s public page. | በዚህ ድርጅት ይፋዊ ገጽ ላይ የሚታዩ ስም፣ መግለጫ፣ የመገኛ ዝርዝሮች፣ ሰዓቶች፣ የካርታ ምልክት፣ ፎቶዎችና የተገናኙ ሀብቶች። | 2026-11-15 | machine-drafted, needs native review |
| `editProfile` | am | Edit profile | መገለጫውን አርትዕ | 2026-11-15 | machine-drafted, needs native review |
| `overviewTitle` | am | This organization at a glance | ይህ ድርጅት በአጭሩ | 2026-11-15 | machine-drafted, needs native review |
| `overviewLoading` | am | Loading overview… | አጠቃላይ እይታውን በመጫን ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `overviewFailed` | am | Could not load this organization’s numbers. | የዚህን ድርጅት ቁጥሮች መጫን አልተቻለም። | 2026-11-15 | machine-drafted, needs native review |
| `tryAgain` | am | Try again | እንደገና ሞክር | 2026-11-15 | machine-drafted, needs native review |
| `tileActiveEvents` | am | Active events | ንቁ ዝግጅቶች | 2026-11-15 | machine-drafted, needs native review |
| `tileUpcomingDates` | am | Event dates, next 30 days | የዝግጅት ቀኖች፣ በሚቀጥሉት 30 ቀናት | 2026-11-15 | machine-drafted, needs native review |
| `tileCheckins` | am | Check-ins, last 30 days | የመገኘት ምዝገባዎች፣ ባለፉት 30 ቀናት | 2026-11-15 | machine-drafted, needs native review |
| `tileMembers` | am | Members | አባላት | 2026-11-15 | machine-drafted, needs native review |
| `endingTitle` | am | Repeating events ending in the next 30 days | በሚቀጥሉት 30 ቀናት የሚያበቁ ተደጋጋሚ ዝግጅቶች | 2026-11-15 | machine-drafted, needs native review |
| `loading` | am | Loading… | በመጫን ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `endingFailed` | am | Could not load the repeating events that end soon. | በቅርቡ የሚያበቁትን ተደጋጋሚ ዝግጅቶች መጫን አልተቻለም። | 2026-11-15 | machine-drafted, needs native review |
| `endingEmpty` | am | No repeating event ends in the next 30 days. | በሚቀጥሉት 30 ቀናት የሚያበቃ ተደጋጋሚ ዝግጅት የለም። | 2026-11-15 | machine-drafted, needs native review |
| `indexIntro` | am | Choose an organization to manage its events, profile and members. | ዝግጅቶቹን፣ መገለጫውንና አባላቱን ለማስተዳደር ድርጅት ይምረጡ። | 2026-11-15 | machine-drafted, needs native review |
| `indexEmpty` | am | You do not manage any active organization right now. | በአሁኑ ጊዜ የሚያስተዳድሩት ንቁ ድርጅት የለም። | 2026-11-15 | machine-drafted, needs native review |
| `userIdLabel` | am | User ID | የተጠቃሚ መታወቂያ | 2026-11-15 | machine-drafted, needs native review |
| `roleLabel` | am | Role | ሚና | 2026-11-15 | machine-drafted, needs native review |
| `roleMember` | am | Member | አባል | 2026-11-15 | machine-drafted, needs native review |
| `roleAdmin` | am | Admin | አስተዳዳሪ | 2026-11-15 | machine-drafted, needs native review |
| `addMember` | am | Add member | አባል አክል | 2026-11-15 | machine-drafted, needs native review |
| `adding` | am | Adding… | በማከል ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `membersLoading` | am | Loading members… | አባላትን በመጫን ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `membersEmpty` | am | No members yet. | እስካሁን አባላት የሉም። | 2026-11-15 | machine-drafted, needs native review |
| `colJoined` | am | Joined | የተቀላቀለበት | 2026-11-15 | machine-drafted, needs native review |
| `colActions` | am | Actions | እርምጃዎች | 2026-11-15 | machine-drafted, needs native review |
| `remove` | am | Remove | አስወግድ | 2026-11-15 | machine-drafted, needs native review |
| `membersLoadFailed` | am | Could not load members. | አባላትን መጫን አልተቻለም። | 2026-11-15 | machine-drafted, needs native review |
| `addFailed` | am | Could not add that member. Check the user ID and try again. | ያንን አባል ማከል አልተቻለም። የተጠቃሚ መታወቂያውን ያረጋግጡና እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `addDuplicate` | am | That person is already a member. | ያ ሰው አስቀድሞ አባል ነው። | 2026-11-15 | machine-drafted, needs native review |
| `addInvalid` | am | That is not a valid user ID. | ይህ ትክክለኛ የተጠቃሚ መታወቂያ አይደለም። | 2026-11-15 | machine-drafted, needs native review |
| `addNoAccount` | am | No account has that user ID. | ያ የተጠቃሚ መታወቂያ ያለው መለያ የለም። | 2026-11-15 | machine-drafted, needs native review |
| `removeFailed` | am | Could not remove that member — you may not have permission, or they were already removed. | ያንን አባል ማስወገድ አልተቻለም — ፈቃድ ላይኖርዎት ይችላል፣ ወይም አስቀድሞ ተወግዷል። | 2026-11-15 | machine-drafted, needs native review |
| `roleFailed` | am | Could not change that role — you may not have permission. | ያንን ሚና መቀየር አልተቻለም — ፈቃድ ላይኖርዎት ይችላል። | 2026-11-15 | machine-drafted, needs native review |
| `memberAdded` | am | Member added. | አባል ታክሏል። | 2026-11-15 | machine-drafted, needs native review |
| `memberRemoved` | am | Member removed. | አባል ተወግዷል። | 2026-11-15 | machine-drafted, needs native review |
| `roleChanged` | am | Role changed. | ሚናው ተቀይሯል። | 2026-11-15 | machine-drafted, needs native review |
| `close` | am | Close | ዝጋ | 2026-11-15 | machine-drafted, needs native review |
| `waitingTitle` | am | Waiting to confirm ({count}) | ማረጋገጫ በመጠበቅ ላይ ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `waitingEmpty` | am | No one is waiting — early check-ins appear here. | የሚጠብቅ ሰው የለም — ቀድመው የተመዘገቡ እዚህ ይታያሉ። | 2026-11-15 | machine-drafted, needs native review |
| `householdSize` | am | Household {size} | ቤተሰብ {size} | 2026-11-15 | machine-drafted, needs native review |
| `attendance` | am | attendance {rate} | የመገኘት መጠን {rate} | 2026-11-15 | machine-drafted, needs native review |
| `confirm` | am | Confirm | አረጋግጥ | 2026-11-15 | machine-drafted, needs native review |
| `walkinTitle` | am | Add a walk-in | ያለ ቀጠሮ የመጣ ሰው አክል | 2026-11-15 | machine-drafted, needs native review |
| `addHousehold` | am | Add household | ቤተሰብ አክል | 2026-11-15 | machine-drafted, needs native review |
| `walkinHint` | am | Anonymous walk-ins are counted for the event but not linked to any account. | ማንነታቸው ያልታወቀ ያለ ቀጠሮ የመጡ ሰዎች ለዝግጅቱ ይቆጠራሉ፣ ግን ከማንም መለያ ጋር አይገናኙም። | 2026-11-15 | machine-drafted, needs native review |
| `confirmedTitle` | am | Confirmed ({count}) | የተረጋገጡ ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `footer` | am | Confirm each person as they arrive. Live count refreshes automatically. | እያንዳንዱ ሰው ሲደርስ ያረጋግጡ። የቀጥታ ቆጠራው በራሱ ይታደሳል። | 2026-11-15 | machine-drafted, needs native review |
| `flashConfirmed` | am | Confirmed {name} | {name} ተረጋግጧል | 2026-11-15 | machine-drafted, needs native review |
| `flashWalkin` | am | Walk-in added | ያለ ቀጠሮ የመጣ ሰው ታክሏል | 2026-11-15 | machine-drafted, needs native review |
| `kioskLoadFailed` | am | Could not refresh the attendance list. It will try again shortly. | የመገኘት ዝርዝሩን ማደስ አልተቻለም። በቅርቡ እንደገና ይሞከራል። | 2026-11-15 | machine-drafted, needs native review |
| `kioskConfirmFailed` | am | Could not confirm {name}. Try again. | {name}ን ማረጋገጥ አልተቻለም። እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `kioskWalkinFailed` | am | Could not add the walk-in. Try again. | ያለ ቀጠሮ የመጣውን ሰው ማከል አልተቻለም። እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `backAll` | hmn | All organizations | Txhua lub koom haum | 2026-11-15 | machine-drafted, needs native review |
| `backYours` | hmn | Your organizations | Koj cov koom haum | 2026-11-15 | machine-drafted, needs native review |
| `sections` | hmn | Organization admin sections | Cov ntu tswj lub koom haum | 2026-11-15 | machine-drafted, needs native review |
| `tabOverview` | hmn | Overview | Saib luv luv | 2026-11-15 | machine-drafted, needs native review |
| `tabEvents` | hmn | Events | Cov xwm txheej | 2026-11-15 | machine-drafted, needs native review |
| `tabProfile` | hmn | Profile | Cov ntaub ntawv | 2026-11-15 | machine-drafted, needs native review |
| `tabMembers` | hmn | Members | Cov tswv cuab | 2026-11-15 | machine-drafted, needs native review |
| `profileTitle` | hmn | Public profile | Cov ntaub ntawv rau pej xeem | 2026-11-15 | machine-drafted, needs native review |
| `profileIntro` | hmn | Name, description, contact details, hours, map pin, photos and linked resources shown on this organization’s public page. | Npe, piav qhia, kev tiv tauj, sij hawm qhib, tus pin hauv daim ntawv qhia chaw, duab thiab cov kev pab txuas uas pom hauv lub koom haum nplooj ntawv pej xeem. | 2026-11-15 | machine-drafted, needs native review |
| `editProfile` | hmn | Edit profile | Kho cov ntaub ntawv | 2026-11-15 | machine-drafted, needs native review |
| `overviewTitle` | hmn | This organization at a glance | Lub koom haum no luv luv | 2026-11-15 | machine-drafted, needs native review |
| `overviewLoading` | hmn | Loading overview… | Tab tom rub qhov saib luv luv… | 2026-11-15 | machine-drafted, needs native review |
| `overviewFailed` | hmn | Could not load this organization’s numbers. | Rub tsis tau lub koom haum no cov lej. | 2026-11-15 | machine-drafted, needs native review |
| `tryAgain` | hmn | Try again | Sim dua | 2026-11-15 | machine-drafted, needs native review |
| `tileActiveEvents` | hmn | Active events | Cov xwm txheej tab tom muaj | 2026-11-15 | machine-drafted, needs native review |
| `tileUpcomingDates` | hmn | Event dates, next 30 days | Cov hnub xwm txheej, 30 hnub tom ntej | 2026-11-15 | machine-drafted, needs native review |
| `tileCheckins` | hmn | Check-ins, last 30 days | Kev sau npe tuaj, 30 hnub dhau los | 2026-11-15 | machine-drafted, needs native review |
| `tileMembers` | hmn | Members | Cov tswv cuab | 2026-11-15 | machine-drafted, needs native review |
| `endingTitle` | hmn | Repeating events ending in the next 30 days | Cov xwm txheej rov ua dua uas xaus hauv 30 hnub tom ntej | 2026-11-15 | machine-drafted, needs native review |
| `loading` | hmn | Loading… | Tab tom rub… | 2026-11-15 | machine-drafted, needs native review |
| `endingFailed` | hmn | Could not load the repeating events that end soon. | Rub tsis tau cov xwm txheej rov ua dua uas yuav xaus sai sai no. | 2026-11-15 | machine-drafted, needs native review |
| `endingEmpty` | hmn | No repeating event ends in the next 30 days. | Tsis muaj xwm txheej rov ua dua twg xaus hauv 30 hnub tom ntej. | 2026-11-15 | machine-drafted, needs native review |
| `indexIntro` | hmn | Choose an organization to manage its events, profile and members. | Xaiv ib lub koom haum los tswj nws cov xwm txheej, cov ntaub ntawv thiab cov tswv cuab. | 2026-11-15 | machine-drafted, needs native review |
| `indexEmpty` | hmn | You do not manage any active organization right now. | Tam sim no koj tsis tau tswj lub koom haum twg uas tab tom ua haujlwm. | 2026-11-15 | machine-drafted, needs native review |
| `userIdLabel` | hmn | User ID | Tus ID siv | 2026-11-15 | machine-drafted, needs native review |
| `roleLabel` | hmn | Role | Lub luag haujlwm | 2026-11-15 | machine-drafted, needs native review |
| `roleMember` | hmn | Member | Tswv cuab | 2026-11-15 | machine-drafted, needs native review |
| `roleAdmin` | hmn | Admin | Thawj tswj | 2026-11-15 | machine-drafted, needs native review |
| `addMember` | hmn | Add member | Ntxiv tswv cuab | 2026-11-15 | machine-drafted, needs native review |
| `adding` | hmn | Adding… | Tab tom ntxiv… | 2026-11-15 | machine-drafted, needs native review |
| `membersLoading` | hmn | Loading members… | Tab tom rub cov tswv cuab… | 2026-11-15 | machine-drafted, needs native review |
| `membersEmpty` | hmn | No members yet. | Tseem tsis tau muaj tswv cuab. | 2026-11-15 | machine-drafted, needs native review |
| `colJoined` | hmn | Joined | Koom thaum | 2026-11-15 | machine-drafted, needs native review |
| `colActions` | hmn | Actions | Kev ua | 2026-11-15 | machine-drafted, needs native review |
| `remove` | hmn | Remove | Tshem tawm | 2026-11-15 | machine-drafted, needs native review |
| `membersLoadFailed` | hmn | Could not load members. | Rub tsis tau cov tswv cuab. | 2026-11-15 | machine-drafted, needs native review |
| `addFailed` | hmn | Could not add that member. Check the user ID and try again. | Ntxiv tsis tau tus tswv cuab ntawd. Kuaj tus ID siv thiab sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `addDuplicate` | hmn | That person is already a member. | Tus neeg ntawd twb yog tswv cuab lawm. | 2026-11-15 | machine-drafted, needs native review |
| `addInvalid` | hmn | That is not a valid user ID. | Qhov ntawd tsis yog tus ID siv raug. | 2026-11-15 | machine-drafted, needs native review |
| `addNoAccount` | hmn | No account has that user ID. | Tsis muaj tus account twg muaj tus ID ntawd. | 2026-11-15 | machine-drafted, needs native review |
| `removeFailed` | hmn | Could not remove that member — you may not have permission, or they were already removed. | Tshem tsis tau tus tswv cuab ntawd — tej zaum koj tsis muaj cai, lossis nws twb raug tshem lawm. | 2026-11-15 | machine-drafted, needs native review |
| `roleFailed` | hmn | Could not change that role — you may not have permission. | Hloov tsis tau lub luag haujlwm ntawd — tej zaum koj tsis muaj cai. | 2026-11-15 | machine-drafted, needs native review |
| `memberAdded` | hmn | Member added. | Ntxiv tswv cuab lawm. | 2026-11-15 | machine-drafted, needs native review |
| `memberRemoved` | hmn | Member removed. | Tshem tswv cuab lawm. | 2026-11-15 | machine-drafted, needs native review |
| `roleChanged` | hmn | Role changed. | Hloov lub luag haujlwm lawm. | 2026-11-15 | machine-drafted, needs native review |
| `close` | hmn | Close | Kaw | 2026-11-15 | machine-drafted, needs native review |
| `waitingTitle` | hmn | Waiting to confirm ({count}) | Tos lees paub ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `waitingEmpty` | hmn | No one is waiting — early check-ins appear here. | Tsis muaj leej twg tos — cov sau npe ntxov yuav tshwm ntawm no. | 2026-11-15 | machine-drafted, needs native review |
| `householdSize` | hmn | Household {size} | Tsev neeg {size} | 2026-11-15 | machine-drafted, needs native review |
| `attendance` | hmn | attendance {rate} | kev tuaj koom {rate} | 2026-11-15 | machine-drafted, needs native review |
| `confirm` | hmn | Confirm | Paub meej | 2026-11-15 | machine-drafted, needs native review |
| `walkinTitle` | hmn | Add a walk-in | Ntxiv ib tug neeg tuaj tsis tau teem | 2026-11-15 | machine-drafted, needs native review |
| `addHousehold` | hmn | Add household | Ntxiv tsev neeg | 2026-11-15 | machine-drafted, needs native review |
| `walkinHint` | hmn | Anonymous walk-ins are counted for the event but not linked to any account. | Cov neeg tuaj tsis tau teem uas tsis qhia npe raug suav rau qhov xwm txheej tab sis tsis txuas rau tus account twg. | 2026-11-15 | machine-drafted, needs native review |
| `confirmedTitle` | hmn | Confirmed ({count}) | Lees paub lawm ({count}) | 2026-11-15 | machine-drafted, needs native review |
| `footer` | hmn | Confirm each person as they arrive. Live count refreshes automatically. | Lees paub txhua tus neeg thaum lawv tuaj txog. Tus lej suav hloov tshiab nws tus kheej. | 2026-11-15 | machine-drafted, needs native review |
| `flashConfirmed` | hmn | Confirmed {name} | Lees paub {name} lawm | 2026-11-15 | machine-drafted, needs native review |
| `flashWalkin` | hmn | Walk-in added | Ntxiv tus neeg tuaj tsis tau teem lawm | 2026-11-15 | machine-drafted, needs native review |
| `kioskLoadFailed` | hmn | Could not refresh the attendance list. It will try again shortly. | Hloov tshiab tsis tau daim ntawv teev neeg tuaj. Nws yuav sim dua sai sai no. | 2026-11-15 | machine-drafted, needs native review |
| `kioskConfirmFailed` | hmn | Could not confirm {name}. Try again. | Lees paub tsis tau {name}. Sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `kioskWalkinFailed` | hmn | Could not add the walk-in. Try again. | Ntxiv tsis tau tus neeg tuaj tsis tau teem. Sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `PEOPLE_CONFIRMED.other` | ht | {n} people confirmed | {n} moun konfime | 2026-11-15 | machine-drafted, needs native review |
| `PEOPLE_CONFIRMED.one` | so | {n} person confirmed | {n} qof ayaa la xaqiijiyey | 2026-11-15 | machine-drafted, needs native review |
| `PEOPLE_CONFIRMED.other` | so | {n} people confirmed | {n} qof ayaa la xaqiijiyey | 2026-11-15 | machine-drafted, needs native review |
| `PEOPLE_CONFIRMED.one` | am | {n} person confirmed | {n} ሰው ተረጋግጧል | 2026-11-15 | machine-drafted, needs native review |
| `PEOPLE_CONFIRMED.other` | am | {n} people confirmed | {n} ሰዎች ተረጋግጠዋል | 2026-11-15 | machine-drafted, needs native review |
| `PEOPLE_CONFIRMED.other` | hmn | {n} people confirmed | Lees paub {n} tus neeg lawm | 2026-11-15 | machine-drafted, needs native review |
| `CHECKIN_COUNT.other` | ht | {n} check-ins | {n} anrejistreman | 2026-11-15 | machine-drafted, needs native review |
| `CHECKIN_COUNT.other` | so | {n} check-ins | {n} is-diiwaangelin | 2026-11-15 | machine-drafted, needs native review |
| `CHECKIN_COUNT.one` | am | {n} check-in | {n} ምዝገባ | 2026-11-15 | machine-drafted, needs native review |
| `CHECKIN_COUNT.other` | am | {n} check-ins | {n} ምዝገባዎች | 2026-11-15 | machine-drafted, needs native review |
| `CHECKIN_COUNT.other` | hmn | {n} check-ins | {n} zaug sau npe tuaj | 2026-11-15 | machine-drafted, needs native review |
| `PEOPLE_WORD.other` | ht | people | moun | 2026-11-15 | machine-drafted, needs native review |
| `PEOPLE_WORD.other` | so | people | qof | 2026-11-15 | machine-drafted, needs native review |
| `PEOPLE_WORD.one` | am | person | ሰው | 2026-11-15 | machine-drafted, needs native review |
| `PEOPLE_WORD.other` | am | people | ሰዎች | 2026-11-15 | machine-drafted, needs native review |
| `PEOPLE_WORD.other` | hmn | people | tus neeg | 2026-11-15 | machine-drafted, needs native review |

### `lib/i18n-overview.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `welcomeBack` | ht | Welcome back, {name}! | Byenveni ankò, {name}! | 2026-11-15 | machine-drafted, needs native review |
| `friend` | ht | Friend | zanmi | 2026-11-15 | machine-drafted, needs native review |
| `quickActions` | ht | Quick Actions | Aksyon rapid | 2026-11-15 | machine-drafted, needs native review |
| `findResourcesTitle` | ht | Find Resources | Jwenn resous | 2026-11-15 | machine-drafted, needs native review |
| `findResourcesBody` | ht | Discover local food banks, housing assistance, healthcare, and more near you. | Dekouvri bank manje, èd pou lojman, swen sante ak plis toupre w. | 2026-11-15 | machine-drafted, needs native review |
| `assistantTitle` | ht | AI Assistant | Asistan IA | 2026-11-15 | machine-drafted, needs native review |
| `assistantBody` | ht | Get personalized help finding resources and applying for benefits. | Jwenn èd pèsonalize pou jwenn resous epi aplike pou benefis. | 2026-11-15 | machine-drafted, needs native review |
| `programsTitle` | ht | Browse Programs | Gade pwogram yo | 2026-11-15 | machine-drafted, needs native review |
| `programsBody` | ht | Explore all available benefits and services by category. | Eksplore tout benefis ak sèvis ki disponib pa kategori. | 2026-11-15 | machine-drafted, needs native review |
| `wizardTitle` | ht | Resource Wizard | Gid resous | 2026-11-15 | machine-drafted, needs native review |
| `wizardBody` | ht | Guided help finding resources | Èd gide pou jwenn resous | 2026-11-15 | machine-drafted, needs native review |
| `applicationsTitle` | ht | My Applications | Aplikasyon m yo | 2026-11-15 | machine-drafted, needs native review |
| `applicationsBody` | ht | Track your benefit applications and see their current status. | Swiv aplikasyon benefis ou yo epi wè kote yo ye kounye a. | 2026-11-15 | machine-drafted, needs native review |
| `documentsTitle` | ht | My Documents | Dokiman m yo | 2026-11-15 | machine-drafted, needs native review |
| `documentsBody` | ht | Securely store and manage your important documents. | Konsève epi jere dokiman enpòtan ou yo an sekirite. | 2026-11-15 | machine-drafted, needs native review |
| `applyTitle` | ht | Apply for Benefits | Aplike pou benefis | 2026-11-15 | machine-drafted, needs native review |
| `applyBody` | ht | Fill out and submit forms for SNAP, Medicaid, and other programs. | Ranpli epi voye fòm pou SNAP, Medicaid ak lòt pwogram. | 2026-11-15 | machine-drafted, needs native review |
| `recentActivity` | ht | Recent Activity | Aktivite resan | 2026-11-15 | machine-drafted, needs native review |
| `loadingActivity` | ht | Loading recent activity | Ap chaje aktivite resan | 2026-11-15 | machine-drafted, needs native review |
| `activityTimedOut` | ht | Activity timed out — please check your connection and retry. | Aktivite a pran twòp tan — tanpri verifye koneksyon ou epi eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `activityFailed` | ht | Recent activity could not be loaded. Please try again. | Nou pa t ka chaje aktivite resan yo. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `noActivity` | ht | No recent activity yet. Start by exploring resources or posting in the community feed! | Poko gen aktivite resan. Kòmanse pa eksplore resous oswa poste nan kominote a! | 2026-11-15 | machine-drafted, needs native review |
| `activityPosted` | ht | Posted: “{excerpt}” | Ou poste: “{excerpt}” | 2026-11-15 | machine-drafted, needs native review |
| `activityLiked` | ht | Liked: “{excerpt}” | Ou renmen: “{excerpt}” | 2026-11-15 | machine-drafted, needs native review |
| `activityLikedPost` | ht | Liked a post | Ou renmen yon piblikasyon | 2026-11-15 | machine-drafted, needs native review |
| `upcomingReminders` | ht | Upcoming Reminders | Rapèl k ap vini | 2026-11-15 | machine-drafted, needs native review |
| `noReminders` | ht | No upcoming reminders. Reminders will appear here when you have appointments or deadlines. | Pa gen rapèl k ap vini. Rapèl yo ap parèt la a lè ou gen randevou oswa dat limit. | 2026-11-15 | machine-drafted, needs native review |
| `welcomeBack` | so | Welcome back, {name}! | Ku soo dhowow mar kale, {name}! | 2026-11-15 | machine-drafted, needs native review |
| `friend` | so | Friend | saaxiib | 2026-11-15 | machine-drafted, needs native review |
| `quickActions` | so | Quick Actions | Ficillo degdeg ah | 2026-11-15 | machine-drafted, needs native review |
| `findResourcesTitle` | so | Find Resources | Hel kheyraad | 2026-11-15 | machine-drafted, needs native review |
| `findResourcesBody` | so | Discover local food banks, housing assistance, healthcare, and more near you. | Ogow bangiyada cuntada, kaalmada guryaha, daryeelka caafimaadka iyo wax kale oo kuu dhow. | 2026-11-15 | machine-drafted, needs native review |
| `assistantTitle` | so | AI Assistant | Kaaliyaha AI | 2026-11-15 | machine-drafted, needs native review |
| `assistantBody` | so | Get personalized help finding resources and applying for benefits. | Hel caawimaad adiga kuu gaar ah oo aad ku hesho kheyraad oo aad ku codsato gargaar. | 2026-11-15 | machine-drafted, needs native review |
| `programsTitle` | so | Browse Programs | Daalaco barnaamijyada | 2026-11-15 | machine-drafted, needs native review |
| `programsBody` | so | Explore all available benefits and services by category. | Sahami dhammaan gargaarka iyo adeegyada la heli karo qayb kasta. | 2026-11-15 | machine-drafted, needs native review |
| `wizardTitle` | so | Resource Wizard | Hagaha kheyraadka | 2026-11-15 | machine-drafted, needs native review |
| `wizardBody` | so | Guided help finding resources | Caawimaad la hagayo oo aad ku hesho kheyraad | 2026-11-15 | machine-drafted, needs native review |
| `applicationsTitle` | so | My Applications | Codsiyadayda | 2026-11-15 | machine-drafted, needs native review |
| `applicationsBody` | so | Track your benefit applications and see their current status. | La soco codsiyadaada gargaarka oo arag xaaladdooda hadda. | 2026-11-15 | machine-drafted, needs native review |
| `documentsTitle` | so | My Documents | Dukumentiyadayda | 2026-11-15 | machine-drafted, needs native review |
| `documentsBody` | so | Securely store and manage your important documents. | Si ammaan ah u kaydi oo u maamul dukumentiyadaada muhiimka ah. | 2026-11-15 | machine-drafted, needs native review |
| `applyTitle` | so | Apply for Benefits | Codso gargaar | 2026-11-15 | machine-drafted, needs native review |
| `applyBody` | so | Fill out and submit forms for SNAP, Medicaid, and other programs. | Buuxi oo dir foomamka SNAP, Medicaid iyo barnaamijyo kale. | 2026-11-15 | machine-drafted, needs native review |
| `recentActivity` | so | Recent Activity | Dhaqdhaqaaqa dhowaan | 2026-11-15 | machine-drafted, needs native review |
| `loadingActivity` | so | Loading recent activity | Waxaa la soo rarayaa dhaqdhaqaaqa dhowaan | 2026-11-15 | machine-drafted, needs native review |
| `activityTimedOut` | so | Activity timed out — please check your connection and retry. | Dhaqdhaqaaqa wuu daahay — fadlan hubi xiriirkaaga oo isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `activityFailed` | so | Recent activity could not be loaded. Please try again. | Dhaqdhaqaaqa dhowaan lama soo rari karin. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `noActivity` | so | No recent activity yet. Start by exploring resources or posting in the community feed! | Weli ma jiro dhaqdhaqaaq dhowaan. Ku bilow inaad sahamiso kheyraadka ama aad wax ku qorto bulshada! | 2026-11-15 | machine-drafted, needs native review |
| `activityPosted` | so | Posted: “{excerpt}” | Waad qortay: “{excerpt}” | 2026-11-15 | machine-drafted, needs native review |
| `activityLiked` | so | Liked: “{excerpt}” | Waad jeclaatay: “{excerpt}” | 2026-11-15 | machine-drafted, needs native review |
| `activityLikedPost` | so | Liked a post | Waxaad jeclaatay qoraal | 2026-11-15 | machine-drafted, needs native review |
| `upcomingReminders` | so | Upcoming Reminders | Xasuusiyeyaasha soo socda | 2026-11-15 | machine-drafted, needs native review |
| `noReminders` | so | No upcoming reminders. Reminders will appear here when you have appointments or deadlines. | Ma jiraan xasuusiyeyaal soo socda. Xasuusiyeyaashu halkan ayay ka soo muuqan doonaan marka aad leedahay ballamo ama waqtiyo kama dambays ah. | 2026-11-15 | machine-drafted, needs native review |
| `welcomeBack` | am | Welcome back, {name}! | እንኳን ደህና መጡ፣ {name}! | 2026-11-15 | machine-drafted, needs native review |
| `friend` | am | Friend | ወዳጃችን | 2026-11-15 | machine-drafted, needs native review |
| `quickActions` | am | Quick Actions | ፈጣን እርምጃዎች | 2026-11-15 | machine-drafted, needs native review |
| `findResourcesTitle` | am | Find Resources | ሀብቶችን ያግኙ | 2026-11-15 | machine-drafted, needs native review |
| `findResourcesBody` | am | Discover local food banks, housing assistance, healthcare, and more near you. | በአቅራቢያዎ ያሉ የምግብ ባንኮችን፣ የመኖሪያ ቤት ድጋፍን፣ የጤና እንክብካቤን እና ሌሎችንም ያግኙ። | 2026-11-15 | machine-drafted, needs native review |
| `assistantTitle` | am | AI Assistant | የAI ረዳት | 2026-11-15 | machine-drafted, needs native review |
| `assistantBody` | am | Get personalized help finding resources and applying for benefits. | ሀብቶችን ለማግኘት እና ለጥቅማ ጥቅሞች ለማመልከት የግል እገዛ ያግኙ። | 2026-11-15 | machine-drafted, needs native review |
| `programsTitle` | am | Browse Programs | ፕሮግራሞችን ያስሱ | 2026-11-15 | machine-drafted, needs native review |
| `programsBody` | am | Explore all available benefits and services by category. | ሁሉንም የሚገኙ ጥቅማ ጥቅሞችን እና አገልግሎቶችን በምድብ ያስሱ። | 2026-11-15 | machine-drafted, needs native review |
| `wizardTitle` | am | Resource Wizard | የሀብት መመሪያ | 2026-11-15 | machine-drafted, needs native review |
| `wizardBody` | am | Guided help finding resources | ሀብቶችን ለማግኘት የሚመራ እገዛ | 2026-11-15 | machine-drafted, needs native review |
| `applicationsTitle` | am | My Applications | የእኔ ማመልከቻዎች | 2026-11-15 | machine-drafted, needs native review |
| `applicationsBody` | am | Track your benefit applications and see their current status. | የጥቅማ ጥቅም ማመልከቻዎችዎን ይከታተሉ እና አሁን ያሉበትን ሁኔታ ይመልከቱ። | 2026-11-15 | machine-drafted, needs native review |
| `documentsTitle` | am | My Documents | የእኔ ሰነዶች | 2026-11-15 | machine-drafted, needs native review |
| `documentsBody` | am | Securely store and manage your important documents. | አስፈላጊ ሰነዶችዎን በደህንነት ያስቀምጡ እና ያስተዳድሩ። | 2026-11-15 | machine-drafted, needs native review |
| `applyTitle` | am | Apply for Benefits | ለጥቅማ ጥቅሞች ያመልክቱ | 2026-11-15 | machine-drafted, needs native review |
| `applyBody` | am | Fill out and submit forms for SNAP, Medicaid, and other programs. | ለSNAP፣ Medicaid እና ለሌሎች ፕሮግራሞች ቅጾችን ይሙሉ እና ያስገቡ። | 2026-11-15 | machine-drafted, needs native review |
| `recentActivity` | am | Recent Activity | የቅርብ ጊዜ እንቅስቃሴ | 2026-11-15 | machine-drafted, needs native review |
| `loadingActivity` | am | Loading recent activity | የቅርብ ጊዜ እንቅስቃሴ በመጫን ላይ | 2026-11-15 | machine-drafted, needs native review |
| `activityTimedOut` | am | Activity timed out — please check your connection and retry. | እንቅስቃሴውን መጫን ጊዜ አልፎበታል — እባክዎ ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `activityFailed` | am | Recent activity could not be loaded. Please try again. | የቅርብ ጊዜ እንቅስቃሴን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `noActivity` | am | No recent activity yet. Start by exploring resources or posting in the community feed! | እስካሁን የቅርብ ጊዜ እንቅስቃሴ የለም። ሀብቶችን በማሰስ ወይም በማህበረሰቡ ውስጥ በመለጠፍ ይጀምሩ! | 2026-11-15 | machine-drafted, needs native review |
| `activityPosted` | am | Posted: “{excerpt}” | ለጥፈዋል፦ «{excerpt}» | 2026-11-15 | machine-drafted, needs native review |
| `activityLiked` | am | Liked: “{excerpt}” | ወደዋል፦ «{excerpt}» | 2026-11-15 | machine-drafted, needs native review |
| `activityLikedPost` | am | Liked a post | አንድ ልጥፍ ወደዋል | 2026-11-15 | machine-drafted, needs native review |
| `upcomingReminders` | am | Upcoming Reminders | መጪ አስታዋሾች | 2026-11-15 | machine-drafted, needs native review |
| `noReminders` | am | No upcoming reminders. Reminders will appear here when you have appointments or deadlines. | መጪ አስታዋሾች የሉም። ቀጠሮዎች ወይም የጊዜ ገደቦች ሲኖሩዎት አስታዋሾች እዚህ ይታያሉ። | 2026-11-15 | machine-drafted, needs native review |
| `welcomeBack` | hmn | Welcome back, {name}! | Zoo siab txais tos koj rov qab los, {name}! | 2026-11-15 | machine-drafted, needs native review |
| `friend` | hmn | Friend | phooj ywg | 2026-11-15 | machine-drafted, needs native review |
| `quickActions` | hmn | Quick Actions | Kev ua sai | 2026-11-15 | machine-drafted, needs native review |
| `findResourcesTitle` | hmn | Find Resources | Nrhiav kev pab | 2026-11-15 | machine-drafted, needs native review |
| `findResourcesBody` | hmn | Discover local food banks, housing assistance, healthcare, and more near you. | Nrhiav cov chaw muab zaub mov, kev pab vaj tse, kev kho mob thiab lwm yam nyob ze koj. | 2026-11-15 | machine-drafted, needs native review |
| `assistantTitle` | hmn | AI Assistant | Tus pab AI | 2026-11-15 | machine-drafted, needs native review |
| `assistantBody` | hmn | Get personalized help finding resources and applying for benefits. | Tau kev pab rau koj tus kheej los nrhiav kev pab thiab thov cov txiaj ntsig. | 2026-11-15 | machine-drafted, needs native review |
| `programsTitle` | hmn | Browse Programs | Saib cov kev pab cuam | 2026-11-15 | machine-drafted, needs native review |
| `programsBody` | hmn | Explore all available benefits and services by category. | Saib txhua yam txiaj ntsig thiab kev pab muaj raws li pawg. | 2026-11-15 | machine-drafted, needs native review |
| `wizardTitle` | hmn | Resource Wizard | Tus coj nrhiav kev pab | 2026-11-15 | machine-drafted, needs native review |
| `wizardBody` | hmn | Guided help finding resources | Kev pab coj ib kauj ruam zuj zus los nrhiav kev pab | 2026-11-15 | machine-drafted, needs native review |
| `applicationsTitle` | hmn | My Applications | Kuv cov ntawv thov | 2026-11-15 | machine-drafted, needs native review |
| `applicationsBody` | hmn | Track your benefit applications and see their current status. | Taug qab koj cov ntawv thov txiaj ntsig thiab saib lawv qhov xwm txheej tam sim no. | 2026-11-15 | machine-drafted, needs native review |
| `documentsTitle` | hmn | My Documents | Kuv cov ntaub ntawv | 2026-11-15 | machine-drafted, needs native review |
| `documentsBody` | hmn | Securely store and manage your important documents. | Khaws thiab tswj koj cov ntaub ntawv tseem ceeb kom muaj kev nyab xeeb. | 2026-11-15 | machine-drafted, needs native review |
| `applyTitle` | hmn | Apply for Benefits | Thov txiaj ntsig | 2026-11-15 | machine-drafted, needs native review |
| `applyBody` | hmn | Fill out and submit forms for SNAP, Medicaid, and other programs. | Sau thiab xa cov ntawv rau SNAP, Medicaid thiab lwm cov kev pab cuam. | 2026-11-15 | machine-drafted, needs native review |
| `recentActivity` | hmn | Recent Activity | Tej yam ua tsis ntev los no | 2026-11-15 | machine-drafted, needs native review |
| `loadingActivity` | hmn | Loading recent activity | Tab tom thauj tej yam ua tsis ntev los no | 2026-11-15 | machine-drafted, needs native review |
| `activityTimedOut` | hmn | Activity timed out — please check your connection and retry. | Thauj tsis tau raws sij hawm — thov kuaj xyuas koj qhov kev sib txuas thiab sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `activityFailed` | hmn | Recent activity could not be loaded. Please try again. | Thauj tsis tau tej yam ua tsis ntev los no. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `noActivity` | hmn | No recent activity yet. Start by exploring resources or posting in the community feed! | Tseem tsis tau muaj dab tsi ua tsis ntev los no. Pib los ntawm kev saib kev pab lossis tshaj tawm hauv zej zog! | 2026-11-15 | machine-drafted, needs native review |
| `activityPosted` | hmn | Posted: “{excerpt}” | Koj tshaj tawm: “{excerpt}” | 2026-11-15 | machine-drafted, needs native review |
| `activityLiked` | hmn | Liked: “{excerpt}” | Koj nyiam: “{excerpt}” | 2026-11-15 | machine-drafted, needs native review |
| `activityLikedPost` | hmn | Liked a post | Koj nyiam ib qho kev tshaj tawm | 2026-11-15 | machine-drafted, needs native review |
| `upcomingReminders` | hmn | Upcoming Reminders | Cov lus ceeb toom tom ntej | 2026-11-15 | machine-drafted, needs native review |
| `noReminders` | hmn | No upcoming reminders. Reminders will appear here when you have appointments or deadlines. | Tsis muaj lus ceeb toom tom ntej. Cov lus ceeb toom yuav tshwm ntawm no thaum koj muaj kev teem caij lossis hnub kawg. | 2026-11-15 | machine-drafted, needs native review |

### `lib/i18n-programs.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `title` | ht | Programs | Pwogram | 2026-11-15 | machine-drafted, needs native review |
| `subtitle` | ht | Find benefits and services available near you | Jwenn benefis ak sèvis ki disponib toupre w | 2026-11-15 | machine-drafted, needs native review |
| `tabBrowse` | ht | Browse | Gade | 2026-11-15 | machine-drafted, needs native review |
| `tabSaved` | ht | Saved | Sovgade | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | ht | Search programs | Chèche pwogram | 2026-11-15 | machine-drafted, needs native review |
| `searchPlaceholder` | ht | Program name or keyword | Non pwogram nan oswa yon mo kle | 2026-11-15 | machine-drafted, needs native review |
| `stateLabel` | ht | State | Eta | 2026-11-15 | machine-drafted, needs native review |
| `selectState` | ht | Select your state | Chwazi eta w | 2026-11-15 | machine-drafted, needs native review |
| `stateBody` | ht | Programs are state-specific. Choose your state above to see available benefits. | Pwogram yo depann de chak eta. Chwazi eta w anlè a pou w wè benefis ki disponib yo. | 2026-11-15 | machine-drafted, needs native review |
| `categoriesLabel` | ht | Categories | Kategori | 2026-11-15 | machine-drafted, needs native review |
| `allCategories` | ht | All | Tout | 2026-11-15 | machine-drafted, needs native review |
| `searching` | ht | Searching… | N ap chèche… | 2026-11-15 | machine-drafted, needs native review |
| `loadingPrograms` | ht | Loading programs… | N ap chaje pwogram yo… | 2026-11-15 | machine-drafted, needs native review |
| `searchTimeout` | ht | Search timed out. Please try again. | Rechèch la pran twòp tan. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `searchFailed` | ht | Search isn't working right now. Please try again. | Rechèch la pa mache kounye a. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `programsTimeout` | ht | Programs timed out. Please try again. | Pwogram yo pran twòp tan pou chaje. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `programsLoadFailed` | ht | Failed to load programs. Please try again. | Nou pa t ka chaje pwogram yo. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `retry` | ht | Retry | Eseye ankò | 2026-11-15 | machine-drafted, needs native review |
| `askAssistant` | ht | Ask the assistant what happened | Mande asistan an sa k pase | 2026-11-15 | machine-drafted, needs native review |
| `noResults` | ht | No results for “{query}” | Pa gen rezilta pou “{query}” | 2026-11-15 | machine-drafted, needs native review |
| `noPrograms` | ht | No programs found | Pa gen pwogram ki jwenn | 2026-11-15 | machine-drafted, needs native review |
| `tryDifferentSearch` | ht | Try a different search term. | Eseye yon lòt mo pou chèche. | 2026-11-15 | machine-drafted, needs native review |
| `tryAdjusting` | ht | Try adjusting your search or selecting a different category. | Eseye chanje rechèch ou a oswa chwazi yon lòt kategori. | 2026-11-15 | machine-drafted, needs native review |
| `eligibility` | ht | Eligibility | Kondisyon pou kalifye | 2026-11-15 | machine-drafted, needs native review |
| `servicesOffered` | ht | Services offered | Sèvis yo ofri | 2026-11-15 | machine-drafted, needs native review |
| `hours` | ht | Hours | Lè ouvèti | 2026-11-15 | machine-drafted, needs native review |
| `saved` | ht | Saved | Sovgade | 2026-11-15 | machine-drafted, needs native review |
| `saveToPlan` | ht | Save to My Plan | Sovgade nan Plan mwen | 2026-11-15 | machine-drafted, needs native review |
| `savedToPlan` | ht | Saved to My Plan. | Sovgade nan Plan mwen. | 2026-11-15 | machine-drafted, needs native review |
| `startApplication` | ht | Start Application | Kòmanse demann | 2026-11-15 | machine-drafted, needs native review |
| `contactDirectly` | ht | Contact Directly | Kontakte dirèkteman | 2026-11-15 | machine-drafted, needs native review |
| `applyOnline` | ht | Apply Online | Aplike sou entènèt | 2026-11-15 | machine-drafted, needs native review |
| `downloadForm` | ht | Download Form | Telechaje fòm nan | 2026-11-15 | machine-drafted, needs native review |
| `shareToFeed` | ht | Share to Feed | Pataje nan Feed la | 2026-11-15 | machine-drafted, needs native review |
| `close` | ht | Close | Fèmen | 2026-11-15 | machine-drafted, needs native review |
| `shareLabel` | ht | Your post | Piblikasyon w | 2026-11-15 | machine-drafted, needs native review |
| `sharePlaceholder` | ht | What do you want to say about this program? | Kisa ou vle di sou pwogram sa a? | 2026-11-15 | machine-drafted, needs native review |
| `shareDefault` | ht | Check out {name} | Gade {name} | 2026-11-15 | machine-drafted, needs native review |
| `shareDefaultWithDescription` | ht | Check out {name} — {description} | Gade {name} — {description} | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | ht | Cancel | Anile | 2026-11-15 | machine-drafted, needs native review |
| `share` | ht | Share | Pataje | 2026-11-15 | machine-drafted, needs native review |
| `unsave` | ht | Unsave | Retire | 2026-11-15 | machine-drafted, needs native review |
| `removedFromPlan` | ht | Removed from My Plan. | Retire nan Plan mwen. | 2026-11-15 | machine-drafted, needs native review |
| `unsaveFailed` | ht | We couldn't remove that program. Please try again. | Nou pa t ka retire pwogram sa a. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `loadingSaved` | ht | Loading saved programs… | N ap chaje pwogram ou sovgade yo… | 2026-11-15 | machine-drafted, needs native review |
| `savedTimeout` | ht | Saved programs timed out. Please try again. | Pwogram ou sovgade yo pran twòp tan. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `signInToSave` | ht | Sign in to save programs. | Konekte pou w sovgade pwogram. | 2026-11-15 | machine-drafted, needs native review |
| `savedFailed` | ht | Something went wrong with your saved programs. Please try again. | Yon bagay mal pase ak pwogram ou sovgade yo. Tanpri eseye ankò. | 2026-11-15 | machine-drafted, needs native review |
| `savedEmptyTitle` | ht | No saved programs yet | Ou poko sovgade okenn pwogram | 2026-11-15 | machine-drafted, needs native review |
| `savedEmptyBody` | ht | Browse programs and tap “{action}” to keep track of the ones that look right for you. | Gade pwogram yo epi peze “{action}” pou w kenbe sa ki bon pou ou yo. | 2026-11-15 | machine-drafted, needs native review |
| `title` | so | Programs | Barnaamijyada | 2026-11-15 | machine-drafted, needs native review |
| `subtitle` | so | Find benefits and services available near you | Hel gargaarro iyo adeegyo kuu dhow | 2026-11-15 | machine-drafted, needs native review |
| `tabBrowse` | so | Browse | Daalaco | 2026-11-15 | machine-drafted, needs native review |
| `tabSaved` | so | Saved | La keydiyay | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | so | Search programs | Raadi barnaamijyo | 2026-11-15 | machine-drafted, needs native review |
| `searchPlaceholder` | so | Program name or keyword | Magaca barnaamijka ama erey muhiim ah | 2026-11-15 | machine-drafted, needs native review |
| `stateLabel` | so | State | Gobolka | 2026-11-15 | machine-drafted, needs native review |
| `selectState` | so | Select your state | Dooro gobolkaaga | 2026-11-15 | machine-drafted, needs native review |
| `stateBody` | so | Programs are state-specific. Choose your state above to see available benefits. | Barnaamijyadu gobol kasta way ku kala duwan yihiin. Kor ka dooro gobolkaaga si aad u aragto gargaarrada jira. | 2026-11-15 | machine-drafted, needs native review |
| `categoriesLabel` | so | Categories | Qaybaha | 2026-11-15 | machine-drafted, needs native review |
| `allCategories` | so | All | Dhammaan | 2026-11-15 | machine-drafted, needs native review |
| `searching` | so | Searching… | Waa la raadinayaa… | 2026-11-15 | machine-drafted, needs native review |
| `loadingPrograms` | so | Loading programs… | Barnaamijyada waa la soo rarayaa… | 2026-11-15 | machine-drafted, needs native review |
| `searchTimeout` | so | Search timed out. Please try again. | Raadintu waqti badan bay qaadatay. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `searchFailed` | so | Search isn't working right now. Please try again. | Raadintu hadda ma shaqaynayso. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `programsTimeout` | so | Programs timed out. Please try again. | Barnaamijyadu waqti badan bay qaateen. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `programsLoadFailed` | so | Failed to load programs. Please try again. | Barnaamijyada lama soo rari karin. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `retry` | so | Retry | Isku day mar kale | 2026-11-15 | machine-drafted, needs native review |
| `askAssistant` | so | Ask the assistant what happened | Weydii caawiyaha waxa dhacay | 2026-11-15 | machine-drafted, needs native review |
| `noResults` | so | No results for “{query}” | Natiijo looma helin “{query}” | 2026-11-15 | machine-drafted, needs native review |
| `noPrograms` | so | No programs found | Barnaamij lama helin | 2026-11-15 | machine-drafted, needs native review |
| `tryDifferentSearch` | so | Try a different search term. | Isku day erey kale oo raadin ah. | 2026-11-15 | machine-drafted, needs native review |
| `tryAdjusting` | so | Try adjusting your search or selecting a different category. | Isku day inaad wax ka beddesho raadinta ama dooro qayb kale. | 2026-11-15 | machine-drafted, needs native review |
| `eligibility` | so | Eligibility | Shuruudaha | 2026-11-15 | machine-drafted, needs native review |
| `servicesOffered` | so | Services offered | Adeegyada la bixiyo | 2026-11-15 | machine-drafted, needs native review |
| `hours` | so | Hours | Saacadaha | 2026-11-15 | machine-drafted, needs native review |
| `saved` | so | Saved | La keydiyay | 2026-11-15 | machine-drafted, needs native review |
| `saveToPlan` | so | Save to My Plan | Ku keydi Qorshahayga | 2026-11-15 | machine-drafted, needs native review |
| `savedToPlan` | so | Saved to My Plan. | Waa lagu keydiyay Qorshahayga. | 2026-11-15 | machine-drafted, needs native review |
| `startApplication` | so | Start Application | Bilow codsiga | 2026-11-15 | machine-drafted, needs native review |
| `contactDirectly` | so | Contact Directly | Si toos ah ula xiriir | 2026-11-15 | machine-drafted, needs native review |
| `applyOnline` | so | Apply Online | Ka codso internetka | 2026-11-15 | machine-drafted, needs native review |
| `downloadForm` | so | Download Form | Soo deji foomka | 2026-11-15 | machine-drafted, needs native review |
| `shareToFeed` | so | Share to Feed | La wadaag Feed-ka | 2026-11-15 | machine-drafted, needs native review |
| `close` | so | Close | Xir | 2026-11-15 | machine-drafted, needs native review |
| `shareLabel` | so | Your post | Qoraalkaaga | 2026-11-15 | machine-drafted, needs native review |
| `sharePlaceholder` | so | What do you want to say about this program? | Maxaad ka odhan lahayd barnaamijkan? | 2026-11-15 | machine-drafted, needs native review |
| `shareDefault` | so | Check out {name} | Eeg {name} | 2026-11-15 | machine-drafted, needs native review |
| `shareDefaultWithDescription` | so | Check out {name} — {description} | Eeg {name} — {description} | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | so | Cancel | Jooji | 2026-11-15 | machine-drafted, needs native review |
| `share` | so | Share | La wadaag | 2026-11-15 | machine-drafted, needs native review |
| `unsave` | so | Unsave | Ka saar | 2026-11-15 | machine-drafted, needs native review |
| `removedFromPlan` | so | Removed from My Plan. | Waa laga saaray Qorshahayga. | 2026-11-15 | machine-drafted, needs native review |
| `unsaveFailed` | so | We couldn't remove that program. Please try again. | Lama saari karin barnaamijkaas. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `loadingSaved` | so | Loading saved programs… | Barnaamijyada la keydiyay waa la soo rarayaa… | 2026-11-15 | machine-drafted, needs native review |
| `savedTimeout` | so | Saved programs timed out. Please try again. | Barnaamijyada la keydiyay waqti badan bay qaateen. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `signInToSave` | so | Sign in to save programs. | Gal si aad u keydiso barnaamijyo. | 2026-11-15 | machine-drafted, needs native review |
| `savedFailed` | so | Something went wrong with your saved programs. Please try again. | Wax ayaa ka khaldamay barnaamijyadaada la keydiyay. Fadlan isku day mar kale. | 2026-11-15 | machine-drafted, needs native review |
| `savedEmptyTitle` | so | No saved programs yet | Weli barnaamij lama keydin | 2026-11-15 | machine-drafted, needs native review |
| `savedEmptyBody` | so | Browse programs and tap “{action}” to keep track of the ones that look right for you. | Daalaco barnaamijyada oo taabo “{action}” si aad ula socoto kuwa kugu habboon. | 2026-11-15 | machine-drafted, needs native review |
| `title` | am | Programs | ፕሮግራሞች | 2026-11-15 | machine-drafted, needs native review |
| `subtitle` | am | Find benefits and services available near you | በአቅራቢያዎ ያሉ ጥቅማ ጥቅሞችንና አገልግሎቶችን ያግኙ | 2026-11-15 | machine-drafted, needs native review |
| `tabBrowse` | am | Browse | ያስሱ | 2026-11-15 | machine-drafted, needs native review |
| `tabSaved` | am | Saved | የተቀመጡ | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | am | Search programs | ፕሮግራሞችን ይፈልጉ | 2026-11-15 | machine-drafted, needs native review |
| `searchPlaceholder` | am | Program name or keyword | የፕሮግራም ስም ወይም ቁልፍ ቃል | 2026-11-15 | machine-drafted, needs native review |
| `stateLabel` | am | State | ግዛት | 2026-11-15 | machine-drafted, needs native review |
| `selectState` | am | Select your state | ግዛትዎን ይምረጡ | 2026-11-15 | machine-drafted, needs native review |
| `stateBody` | am | Programs are state-specific. Choose your state above to see available benefits. | ፕሮግራሞች እንደ ግዛቱ ይለያያሉ። ያሉትን ጥቅማ ጥቅሞች ለማየት ከላይ ግዛትዎን ይምረጡ። | 2026-11-15 | machine-drafted, needs native review |
| `categoriesLabel` | am | Categories | ምድቦች | 2026-11-15 | machine-drafted, needs native review |
| `allCategories` | am | All | ሁሉም | 2026-11-15 | machine-drafted, needs native review |
| `searching` | am | Searching… | በመፈለግ ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `loadingPrograms` | am | Loading programs… | ፕሮግራሞች በመጫን ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `searchTimeout` | am | Search timed out. Please try again. | ፍለጋው በጣም ረጅም ጊዜ ወሰደ። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `searchFailed` | am | Search isn't working right now. Please try again. | ፍለጋው አሁን እየሰራ አይደለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `programsTimeout` | am | Programs timed out. Please try again. | ፕሮግራሞቹ ለመጫን በጣም ረጅም ጊዜ ወሰዱ። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `programsLoadFailed` | am | Failed to load programs. Please try again. | ፕሮግራሞችን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `retry` | am | Retry | እንደገና ይሞክሩ | 2026-11-15 | machine-drafted, needs native review |
| `askAssistant` | am | Ask the assistant what happened | ምን እንደተፈጠረ ረዳቱን ይጠይቁ | 2026-11-15 | machine-drafted, needs native review |
| `noResults` | am | No results for “{query}” | ለ“{query}” ምንም ውጤት የለም | 2026-11-15 | machine-drafted, needs native review |
| `noPrograms` | am | No programs found | ምንም ፕሮግራም አልተገኘም | 2026-11-15 | machine-drafted, needs native review |
| `tryDifferentSearch` | am | Try a different search term. | ሌላ የፍለጋ ቃል ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `tryAdjusting` | am | Try adjusting your search or selecting a different category. | ፍለጋዎን ይቀይሩ ወይም ሌላ ምድብ ይምረጡ። | 2026-11-15 | machine-drafted, needs native review |
| `eligibility` | am | Eligibility | የብቁነት መስፈርቶች | 2026-11-15 | machine-drafted, needs native review |
| `servicesOffered` | am | Services offered | የሚሰጡ አገልግሎቶች | 2026-11-15 | machine-drafted, needs native review |
| `hours` | am | Hours | የስራ ሰዓት | 2026-11-15 | machine-drafted, needs native review |
| `saved` | am | Saved | ተቀምጧል | 2026-11-15 | machine-drafted, needs native review |
| `saveToPlan` | am | Save to My Plan | በዕቅዴ ውስጥ አስቀምጥ | 2026-11-15 | machine-drafted, needs native review |
| `savedToPlan` | am | Saved to My Plan. | በዕቅዴ ውስጥ ተቀምጧል። | 2026-11-15 | machine-drafted, needs native review |
| `startApplication` | am | Start Application | ማመልከቻ ጀምር | 2026-11-15 | machine-drafted, needs native review |
| `contactDirectly` | am | Contact Directly | በቀጥታ ያግኙ | 2026-11-15 | machine-drafted, needs native review |
| `applyOnline` | am | Apply Online | በመስመር ላይ ያመልክቱ | 2026-11-15 | machine-drafted, needs native review |
| `downloadForm` | am | Download Form | ቅጹን አውርድ | 2026-11-15 | machine-drafted, needs native review |
| `shareToFeed` | am | Share to Feed | በፊድ ላይ አጋራ | 2026-11-15 | machine-drafted, needs native review |
| `close` | am | Close | ዝጋ | 2026-11-15 | machine-drafted, needs native review |
| `shareLabel` | am | Your post | የእርስዎ ልጥፍ | 2026-11-15 | machine-drafted, needs native review |
| `sharePlaceholder` | am | What do you want to say about this program? | ስለዚህ ፕሮግራም ምን ማለት ይፈልጋሉ? | 2026-11-15 | machine-drafted, needs native review |
| `shareDefault` | am | Check out {name} | {name}ን ይመልከቱ | 2026-11-15 | machine-drafted, needs native review |
| `shareDefaultWithDescription` | am | Check out {name} — {description} | {name}ን ይመልከቱ — {description} | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | am | Cancel | ይቅር | 2026-11-15 | machine-drafted, needs native review |
| `share` | am | Share | አጋራ | 2026-11-15 | machine-drafted, needs native review |
| `unsave` | am | Unsave | አስወግድ | 2026-11-15 | machine-drafted, needs native review |
| `removedFromPlan` | am | Removed from My Plan. | ከዕቅዴ ተወግዷል። | 2026-11-15 | machine-drafted, needs native review |
| `unsaveFailed` | am | We couldn't remove that program. Please try again. | ያንን ፕሮግራም ማስወገድ አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `loadingSaved` | am | Loading saved programs… | የተቀመጡ ፕሮግራሞች በመጫን ላይ… | 2026-11-15 | machine-drafted, needs native review |
| `savedTimeout` | am | Saved programs timed out. Please try again. | የተቀመጡ ፕሮግራሞች በጣም ረጅም ጊዜ ወሰዱ። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `signInToSave` | am | Sign in to save programs. | ፕሮግራሞችን ለማስቀመጥ ይግቡ። | 2026-11-15 | machine-drafted, needs native review |
| `savedFailed` | am | Something went wrong with your saved programs. Please try again. | በተቀመጡ ፕሮግራሞችዎ ላይ ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ። | 2026-11-15 | machine-drafted, needs native review |
| `savedEmptyTitle` | am | No saved programs yet | እስካሁን የተቀመጠ ፕሮግራም የለም | 2026-11-15 | machine-drafted, needs native review |
| `savedEmptyBody` | am | Browse programs and tap “{action}” to keep track of the ones that look right for you. | ፕሮግራሞችን ያስሱና የሚስማሙዎትን ለመከታተል “{action}”ን ይንኩ። | 2026-11-15 | machine-drafted, needs native review |
| `title` | hmn | Programs | Cov kev pab cuam | 2026-11-15 | machine-drafted, needs native review |
| `subtitle` | hmn | Find benefits and services available near you | Nrhiav cov kev pab thiab kev pabcuam nyob ze koj | 2026-11-15 | machine-drafted, needs native review |
| `tabBrowse` | hmn | Browse | Saib | 2026-11-15 | machine-drafted, needs native review |
| `tabSaved` | hmn | Saved | Khaws cia | 2026-11-15 | machine-drafted, needs native review |
| `searchLabel` | hmn | Search programs | Nrhiav cov kev pab cuam | 2026-11-15 | machine-drafted, needs native review |
| `searchPlaceholder` | hmn | Program name or keyword | Lub npe kev pab cuam lossis lo lus tseem ceeb | 2026-11-15 | machine-drafted, needs native review |
| `stateLabel` | hmn | State | Xeev | 2026-11-15 | machine-drafted, needs native review |
| `selectState` | hmn | Select your state | Xaiv koj lub xeev | 2026-11-15 | machine-drafted, needs native review |
| `stateBody` | hmn | Programs are state-specific. Choose your state above to see available benefits. | Cov kev pab cuam txawv raws txhua lub xeev. Xaiv koj lub xeev saum toj no kom pom cov kev pab uas muaj. | 2026-11-15 | machine-drafted, needs native review |
| `categoriesLabel` | hmn | Categories | Pawg | 2026-11-15 | machine-drafted, needs native review |
| `allCategories` | hmn | All | Tag nrho | 2026-11-15 | machine-drafted, needs native review |
| `searching` | hmn | Searching… | Tab tom nrhiav… | 2026-11-15 | machine-drafted, needs native review |
| `loadingPrograms` | hmn | Loading programs… | Tab tom thauj cov kev pab cuam… | 2026-11-15 | machine-drafted, needs native review |
| `searchTimeout` | hmn | Search timed out. Please try again. | Kev nrhiav siv sijhawm ntev dhau. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `searchFailed` | hmn | Search isn't working right now. Please try again. | Kev nrhiav tsis ua haujlwm tam sim no. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `programsTimeout` | hmn | Programs timed out. Please try again. | Cov kev pab cuam siv sijhawm ntev dhau los thauj. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `programsLoadFailed` | hmn | Failed to load programs. Please try again. | Thauj tsis tau cov kev pab cuam. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `retry` | hmn | Retry | Sim dua | 2026-11-15 | machine-drafted, needs native review |
| `askAssistant` | hmn | Ask the assistant what happened | Nug tus pab cuam seb muaj dab tsi tshwm sim | 2026-11-15 | machine-drafted, needs native review |
| `noResults` | hmn | No results for “{query}” | Tsis muaj qhov tshwm sim rau “{query}” | 2026-11-15 | machine-drafted, needs native review |
| `noPrograms` | hmn | No programs found | Nrhiav tsis tau kev pab cuam | 2026-11-15 | machine-drafted, needs native review |
| `tryDifferentSearch` | hmn | Try a different search term. | Sim lwm lo lus nrhiav. | 2026-11-15 | machine-drafted, needs native review |
| `tryAdjusting` | hmn | Try adjusting your search or selecting a different category. | Sim hloov koj qhov kev nrhiav lossis xaiv lwm pawg. | 2026-11-15 | machine-drafted, needs native review |
| `eligibility` | hmn | Eligibility | Kev tsim nyog | 2026-11-15 | machine-drafted, needs native review |
| `servicesOffered` | hmn | Services offered | Cov kev pabcuam muaj | 2026-11-15 | machine-drafted, needs native review |
| `hours` | hmn | Hours | Sijhawm qhib | 2026-11-15 | machine-drafted, needs native review |
| `saved` | hmn | Saved | Khaws lawm | 2026-11-15 | machine-drafted, needs native review |
| `saveToPlan` | hmn | Save to My Plan | Khaws rau Kuv Txoj Kev Npaj | 2026-11-15 | machine-drafted, needs native review |
| `savedToPlan` | hmn | Saved to My Plan. | Khaws rau Kuv Txoj Kev Npaj lawm. | 2026-11-15 | machine-drafted, needs native review |
| `startApplication` | hmn | Start Application | Pib daim ntawv thov | 2026-11-15 | machine-drafted, needs native review |
| `contactDirectly` | hmn | Contact Directly | Tiv tauj ncaj qha | 2026-11-15 | machine-drafted, needs native review |
| `applyOnline` | hmn | Apply Online | Thov hauv online | 2026-11-15 | machine-drafted, needs native review |
| `downloadForm` | hmn | Download Form | Rub daim ntawv | 2026-11-15 | machine-drafted, needs native review |
| `shareToFeed` | hmn | Share to Feed | Qhia rau Feed | 2026-11-15 | machine-drafted, needs native review |
| `close` | hmn | Close | Kaw | 2026-11-15 | machine-drafted, needs native review |
| `shareLabel` | hmn | Your post | Koj tsab ntawv | 2026-11-15 | machine-drafted, needs native review |
| `sharePlaceholder` | hmn | What do you want to say about this program? | Koj xav hais li cas txog qhov kev pab cuam no? | 2026-11-15 | machine-drafted, needs native review |
| `shareDefault` | hmn | Check out {name} | Saib {name} | 2026-11-15 | machine-drafted, needs native review |
| `shareDefaultWithDescription` | hmn | Check out {name} — {description} | Saib {name} — {description} | 2026-11-15 | machine-drafted, needs native review |
| `cancel` | hmn | Cancel | Tso tseg | 2026-11-15 | machine-drafted, needs native review |
| `share` | hmn | Share | Qhia | 2026-11-15 | machine-drafted, needs native review |
| `unsave` | hmn | Unsave | Tshem tawm | 2026-11-15 | machine-drafted, needs native review |
| `removedFromPlan` | hmn | Removed from My Plan. | Tshem tawm ntawm Kuv Txoj Kev Npaj lawm. | 2026-11-15 | machine-drafted, needs native review |
| `unsaveFailed` | hmn | We couldn't remove that program. Please try again. | Tshem tsis tau qhov kev pab cuam ntawd. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `loadingSaved` | hmn | Loading saved programs… | Tab tom thauj cov kev pab cuam koj khaws cia… | 2026-11-15 | machine-drafted, needs native review |
| `savedTimeout` | hmn | Saved programs timed out. Please try again. | Cov kev pab cuam koj khaws cia siv sijhawm ntev dhau. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `signInToSave` | hmn | Sign in to save programs. | Nkag mus kom khaws tau cov kev pab cuam. | 2026-11-15 | machine-drafted, needs native review |
| `savedFailed` | hmn | Something went wrong with your saved programs. Please try again. | Muaj qee yam yuam kev nrog koj cov kev pab cuam khaws cia. Thov sim dua. | 2026-11-15 | machine-drafted, needs native review |
| `savedEmptyTitle` | hmn | No saved programs yet | Tseem tsis tau muaj kev pab cuam khaws cia | 2026-11-15 | machine-drafted, needs native review |
| `savedEmptyBody` | hmn | Browse programs and tap “{action}” to keep track of the ones that look right for you. | Saib cov kev pab cuam thiab nias “{action}” kom koj taug qab tau cov uas haum rau koj. | 2026-11-15 | machine-drafted, needs native review |
| `PROGRAMS_FOUND.other` | ht | {n} programs found | {n} pwogram jwenn | 2026-11-15 | machine-drafted, needs native review |
| `PROGRAMS_FOUND.other` | so | {n} programs found | {n} barnaamij ayaa la helay | 2026-11-15 | machine-drafted, needs native review |
| `PROGRAMS_FOUND.one` | am | {n} program found | {n} ፕሮግራም ተገኝቷል | 2026-11-15 | machine-drafted, needs native review |
| `PROGRAMS_FOUND.other` | am | {n} programs found | {n} ፕሮግራሞች ተገኝተዋል | 2026-11-15 | machine-drafted, needs native review |
| `PROGRAMS_FOUND.other` | hmn | {n} programs found | Nrhiav tau {n} qhov kev pab cuam | 2026-11-15 | machine-drafted, needs native review |

### `lib/i18n-settings-language.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `heading` | ht | Preferred Language | Lang ou prefere | 2026-11-14 | machine-drafted, needs native review |
| `description` | ht | The AI assistant will respond in this language, and translated screens will show it. | Asistan IA a ap reponn nan lang sa a, epi ekran ki tradui yo ap montre l. | 2026-11-14 | machine-drafted, needs native review |
| `currently` | ht | Currently: {language} | Kounye a: {language} | 2026-11-14 | machine-drafted, needs native review |
| `save` | ht | Save | Anrejistre | 2026-11-14 | machine-drafted, needs native review |
| `otherLanguage` | ht | Other language | Lòt lang | 2026-11-14 | machine-drafted, needs native review |
| `saving` | ht | Saving… | Ap anrejistre… | 2026-11-14 | machine-drafted, needs native review |
| `saved` | ht | Language saved | Lang lan anrejistre | 2026-11-14 | machine-drafted, needs native review |
| `savedDevice` | ht | Language saved on this device | Lang lan anrejistre sou aparèy sa a | 2026-11-14 | machine-drafted, needs native review |
| `deviceOnly` | ht | Saved to this device only. Create an account to sync your preference. | Anrejistre sou aparèy sa a sèlman. Kreye yon kont pou senkronize preferans ou. | 2026-11-14 | machine-drafted, needs native review |
| `failed` | ht | Your language could not be saved. FEED is still in {language}. Please try again. | Nou pa t kapab anrejistre lang ou. FEED toujou nan {language}. Tanpri eseye ankò. | 2026-11-14 | machine-drafted, needs native review |
| `heading` | so | Preferred Language | Luqadda aad doorbidayso | 2026-11-14 | machine-drafted, needs native review |
| `description` | so | The AI assistant will respond in this language, and translated screens will show it. | Kaaliyaha AI-ga wuxuu kugu jawaabi doonaa luqaddan, shaashadaha la turjumayna way ku muujin doonaan. | 2026-11-14 | machine-drafted, needs native review |
| `currently` | so | Currently: {language} | Hadda: {language} | 2026-11-14 | machine-drafted, needs native review |
| `save` | so | Save | Keydi | 2026-11-14 | machine-drafted, needs native review |
| `otherLanguage` | so | Other language | Luqad kale | 2026-11-14 | machine-drafted, needs native review |
| `saving` | so | Saving… | Waa la keydinayaa… | 2026-11-14 | machine-drafted, needs native review |
| `saved` | so | Language saved | Luqadda waa la keydiyay | 2026-11-14 | machine-drafted, needs native review |
| `savedDevice` | so | Language saved on this device | Luqadda waxaa lagu keydiyay qalabkan | 2026-11-14 | machine-drafted, needs native review |
| `deviceOnly` | so | Saved to this device only. Create an account to sync your preference. | Kaliya qalabkan ayaa lagu keydiyay. Samee akoon si aad doorashadaada u waafajiso. | 2026-11-14 | machine-drafted, needs native review |
| `failed` | so | Your language could not be saved. FEED is still in {language}. Please try again. | Luqaddaada lama keydin karin. FEED weli waa {language}. Fadlan isku day mar kale. | 2026-11-14 | machine-drafted, needs native review |
| `heading` | am | Preferred Language | የሚመርጡት ቋንቋ | 2026-11-14 | machine-drafted, needs native review |
| `description` | am | The AI assistant will respond in this language, and translated screens will show it. | የAI ረዳቱ በዚህ ቋንቋ ይመልሳል፤ የተተረጎሙ ገጾችም በዚህ ቋንቋ ይታያሉ። | 2026-11-14 | machine-drafted, needs native review |
| `currently` | am | Currently: {language} | አሁን፦ {language} | 2026-11-14 | machine-drafted, needs native review |
| `save` | am | Save | አስቀምጥ | 2026-11-14 | machine-drafted, needs native review |
| `otherLanguage` | am | Other language | ሌላ ቋንቋ | 2026-11-14 | machine-drafted, needs native review |
| `saving` | am | Saving… | በማስቀመጥ ላይ… | 2026-11-14 | machine-drafted, needs native review |
| `saved` | am | Language saved | ቋንቋው ተቀምጧል | 2026-11-14 | machine-drafted, needs native review |
| `savedDevice` | am | Language saved on this device | ቋንቋው በዚህ መሣሪያ ላይ ተቀምጧል | 2026-11-14 | machine-drafted, needs native review |
| `deviceOnly` | am | Saved to this device only. Create an account to sync your preference. | በዚህ መሣሪያ ላይ ብቻ ተቀምጧል። ምርጫዎን ለማመሳሰል መለያ ይፍጠሩ። | 2026-11-14 | machine-drafted, needs native review |
| `failed` | am | Your language could not be saved. FEED is still in {language}. Please try again. | ቋንቋዎን ማስቀመጥ አልተቻለም። FEED አሁንም በ{language} ነው። እባክዎ እንደገና ይሞክሩ። | 2026-11-14 | machine-drafted, needs native review |
| `heading` | hmn | Preferred Language | Hom lus koj nyiam | 2026-11-14 | machine-drafted, needs native review |
| `description` | hmn | The AI assistant will respond in this language, and translated screens will show it. | Tus pab AI yuav teb ua hom lus no, thiab cov nplooj uas txhais lawm yuav tso tawm ua hom lus no. | 2026-11-14 | machine-drafted, needs native review |
| `currently` | hmn | Currently: {language} | Tam sim no: {language} | 2026-11-14 | machine-drafted, needs native review |
| `save` | hmn | Save | Khaws | 2026-11-14 | machine-drafted, needs native review |
| `otherLanguage` | hmn | Other language | Lwm hom lus | 2026-11-14 | machine-drafted, needs native review |
| `saving` | hmn | Saving… | Tab tom khaws… | 2026-11-14 | machine-drafted, needs native review |
| `saved` | hmn | Language saved | Tau khaws hom lus lawm | 2026-11-14 | machine-drafted, needs native review |
| `savedDevice` | hmn | Language saved on this device | Tau khaws hom lus rau ntawm lub cuab yeej no | 2026-11-14 | machine-drafted, needs native review |
| `deviceOnly` | hmn | Saved to this device only. Create an account to sync your preference. | Tsuas khaws rau ntawm lub cuab yeej no xwb. Tsim ib tug account kom sib txuas koj qhov kev nyiam. | 2026-11-14 | machine-drafted, needs native review |
| `failed` | hmn | Your language could not be saved. FEED is still in {language}. Please try again. | Khaws tsis tau koj hom lus. FEED tseem yog {language}. Thov sim dua. | 2026-11-14 | machine-drafted, needs native review |

### `lib/i18n-share.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `siteTitle` | ht | FEED - Mutual Aid Resource Sharing | FEED - Pataj resous pou èd mityèl | 2026-11-15 | machine-drafted, needs native review |
| `siteDescription` | ht | Community-powered mutual aid. Share resources, find help, support your neighbors. | Èd mityèl kominote a fè. Pataje resous, jwenn èd, sipòte vwazen w. | 2026-11-15 | machine-drafted, needs native review |
| `notFoundTitle` | ht | This page isn't available | Paj sa a pa disponib | 2026-11-15 | machine-drafted, needs native review |
| `notFoundBody` | ht | The link may be out of date, or what it shared is no longer public. | Petèt lyen an pa bon ankò, oswa sa li te pataje a pa piblik ankò. | 2026-11-15 | machine-drafted, needs native review |
| `postNotFound` | ht | Post Not Found - FEED | Nou pa jwenn piblikasyon an - FEED | 2026-11-15 | machine-drafted, needs native review |
| `businessNotFound` | ht | Business Not Found - FEED | Nou pa jwenn biznis la - FEED | 2026-11-15 | machine-drafted, needs native review |
| `organizationNotFound` | ht | Organization Not Found - FEED | Nou pa jwenn òganizasyon an - FEED | 2026-11-15 | machine-drafted, needs native review |
| `resourceNotFound` | ht | Resource Not Found - FEED | Nou pa jwenn resous la - FEED | 2026-11-15 | machine-drafted, needs native review |
| `communityMember` | ht | Community Member | Manm kominote a | 2026-11-15 | machine-drafted, needs native review |
| `aCommunityMember` | ht | a community member | yon manm kominote a | 2026-11-15 | machine-drafted, needs native review |
| `onFeed` | ht | {name} on FEED | {name} sou FEED | 2026-11-15 | machine-drafted, needs native review |
| `petitionOnFeed` | ht | {title} — FEED Community Petition | {title} — Petisyon kominotè FEED | 2026-11-15 | machine-drafted, needs native review |
| `tagline` | ht | Mutual Aid Resource Sharing | Pataj resous pou èd mityèl | 2026-11-15 | machine-drafted, needs native review |
| `poweredBy` | ht | Powered by FEED · Mutual Aid Resource Sharing | Se FEED ki fè l · Pataj resous pou èd mityèl | 2026-11-15 | machine-drafted, needs native review |
| `postImage` | ht | Post image | Imaj piblikasyon an | 2026-11-15 | machine-drafted, needs native review |
| `supportName` | ht | Support {name} | Sipòte {name} | 2026-11-15 | machine-drafted, needs native review |
| `supportBody` | ht | Send direct support through their preferred payment method. | Voye sipò dirèk ak metòd peman li prefere a. | 2026-11-15 | machine-drafted, needs native review |
| `joinFeed` | ht | Join FEED | Vin nan FEED | 2026-11-15 | machine-drafted, needs native review |
| `joinBody` | ht | Find resources, share help, build community. | Jwenn resous, pataje èd, bati kominote. | 2026-11-15 | machine-drafted, needs native review |
| `communityPetition` | ht | Community Petition | Petisyon kominotè | 2026-11-15 | machine-drafted, needs native review |
| `signOnFeed` | ht | Sign on FEED | Siyen sou FEED | 2026-11-15 | machine-drafted, needs native review |
| `optInOnFeed` | ht | Opt In on FEED | Enskri sou FEED | 2026-11-15 | machine-drafted, needs native review |
| `businessDescFallback` | ht | {name} - Local business on FEED | {name} - Biznis lokal sou FEED | 2026-11-15 | machine-drafted, needs native review |
| `organizationDescFallback` | ht | {name} - Local organization on FEED | {name} - Òganizasyon lokal sou FEED | 2026-11-15 | machine-drafted, needs native review |
| `resourceDescFallback` | ht | {name} - Community resource on FEED | {name} - Resous kominotè sou FEED | 2026-11-15 | machine-drafted, needs native review |
| `localBusiness` | ht | Local business | Biznis lokal | 2026-11-15 | machine-drafted, needs native review |
| `localOrganization` | ht | Local organization | Òganizasyon lokal | 2026-11-15 | machine-drafted, needs native review |
| `organization` | ht | Organization | Òganizasyon | 2026-11-15 | machine-drafted, needs native review |
| `communityResource` | ht | Community resource | Resous kominotè | 2026-11-15 | machine-drafted, needs native review |
| `coverAlt` | ht | {name} cover | Imaj kouvèti {name} | 2026-11-15 | machine-drafted, needs native review |
| `logoAlt` | ht | {name} logo | Logo {name} | 2026-11-15 | machine-drafted, needs native review |
| `mapAlt` | ht | Map showing {name} | Kat ki montre {name} | 2026-11-15 | machine-drafted, needs native review |
| `photoAlt` | ht | {name} photo | Foto {name} | 2026-11-15 | machine-drafted, needs native review |
| `visitWebsite` | ht | Visit website | Vizite sit entènèt la | 2026-11-15 | machine-drafted, needs native review |
| `call` | ht | Call | Rele | 2026-11-15 | machine-drafted, needs native review |
| `email` | ht | Email | Imèl | 2026-11-15 | machine-drafted, needs native review |
| `businessFeatures` | ht | Business features | Karakteristik biznis la | 2026-11-15 | machine-drafted, needs native review |
| `resourcesOffered` | ht | Resources offered | Resous yo ofri | 2026-11-15 | machine-drafted, needs native review |
| `exploreMore` | ht | Explore More on FEED | Dekouvri plis sou FEED | 2026-11-15 | machine-drafted, needs native review |
| `exploreBody` | ht | Find community resources and support near you. | Jwenn resous kominotè ak sipò toupre w. | 2026-11-15 | machine-drafted, needs native review |
| `hoursInFeed` | ht | Hours available - see full details in FEED | Gen orè - gade tout detay yo nan FEED | 2026-11-15 | machine-drafted, needs native review |
| `eligibility` | ht | Eligibility | Kondisyon pou jwenn li | 2026-11-15 | machine-drafted, needs native review |
| `viewDetails` | ht | View Full Details in FEED | Gade tout detay yo nan FEED | 2026-11-15 | machine-drafted, needs native review |
| `viewDetailsBody` | ht | Find more resources and community support. | Jwenn plis resous ak sipò kominotè. | 2026-11-15 | machine-drafted, needs native review |
| `supportTitle` | ht | Support {name} - FEED | Sipòte {name} - FEED | 2026-11-15 | machine-drafted, needs native review |
| `supportOnFeed` | ht | Support {name} on FEED | Sipòte {name} sou FEED | 2026-11-15 | machine-drafted, needs native review |
| `donateDescription` | ht | Send direct support to {name} through FEED's mutual aid platform. | Voye sipò dirèk bay {name} atravè platfòm èd mityèl FEED la. | 2026-11-15 | machine-drafted, needs native review |
| `mutualAid` | ht | Mutual Aid | Èd mityèl | 2026-11-15 | machine-drafted, needs native review |
| `sendVia` | ht | Send via {service} | Voye ak {service} | 2026-11-15 | machine-drafted, needs native review |
| `openFeed` | ht | Open FEED | Ouvri FEED | 2026-11-15 | machine-drafted, needs native review |
| `donateCtaBody` | ht | Join the community. Share resources. Build mutual aid. | Vin nan kominote a. Pataje resous. Bati èd mityèl. | 2026-11-15 | machine-drafted, needs native review |
| `open24h` | ht | Open 24 hours | Ouvri 24 è sou 24 | 2026-11-15 | machine-drafted, needs native review |
| `nextDay` | ht | {hours} (next day) | {hours} (jou apre a) | 2026-11-15 | machine-drafted, needs native review |
| `openNowCloses` | ht | Open now · closes {time} | Ouvri kounye a · fèmen a {time} | 2026-11-15 | machine-drafted, needs native review |
| `closedOpens` | ht | Closed · opens {day} {time} | Fèmen · ouvri {day} a {time} | 2026-11-15 | machine-drafted, needs native review |
| `siteTitle` | so | FEED - Mutual Aid Resource Sharing | FEED - Wadaagista kheyraadka is-caawinta | 2026-11-15 | machine-drafted, needs native review |
| `siteDescription` | so | Community-powered mutual aid. Share resources, find help, support your neighbors. | Is-caawin ay bulshadu wado. La wadaag kheyraad, hel caawimo, taageer deriskaaga. | 2026-11-15 | machine-drafted, needs native review |
| `notFoundTitle` | so | This page isn't available | Boggan lama heli karo | 2026-11-15 | machine-drafted, needs native review |
| `notFoundBody` | so | The link may be out of date, or what it shared is no longer public. | Xiriirku waxaa laga yaabaa inuu duugoobay, ama waxa la wadaagay hadda ma aha mid dadweyne. | 2026-11-15 | machine-drafted, needs native review |
| `postNotFound` | so | Post Not Found - FEED | Qoraalka lama helin - FEED | 2026-11-15 | machine-drafted, needs native review |
| `businessNotFound` | so | Business Not Found - FEED | Ganacsiga lama helin - FEED | 2026-11-15 | machine-drafted, needs native review |
| `organizationNotFound` | so | Organization Not Found - FEED | Ururka lama helin - FEED | 2026-11-15 | machine-drafted, needs native review |
| `resourceNotFound` | so | Resource Not Found - FEED | Kheyraadka lama helin - FEED | 2026-11-15 | machine-drafted, needs native review |
| `communityMember` | so | Community Member | Xubin bulshada ka mid ah | 2026-11-15 | machine-drafted, needs native review |
| `aCommunityMember` | so | a community member | xubin bulshada ka mid ah | 2026-11-15 | machine-drafted, needs native review |
| `onFeed` | so | {name} on FEED | {name} ee FEED | 2026-11-15 | machine-drafted, needs native review |
| `petitionOnFeed` | so | {title} — FEED Community Petition | {title} — Codsiga bulshada ee FEED | 2026-11-15 | machine-drafted, needs native review |
| `tagline` | so | Mutual Aid Resource Sharing | Wadaagista kheyraadka is-caawinta | 2026-11-15 | machine-drafted, needs native review |
| `poweredBy` | so | Powered by FEED · Mutual Aid Resource Sharing | Waxaa sameeyay FEED · Wadaagista kheyraadka is-caawinta | 2026-11-15 | machine-drafted, needs native review |
| `postImage` | so | Post image | Sawirka qoraalka | 2026-11-15 | machine-drafted, needs native review |
| `supportName` | so | Support {name} | Taageer {name} | 2026-11-15 | machine-drafted, needs native review |
| `supportBody` | so | Send direct support through their preferred payment method. | U dir taageero toos ah habka lacag bixinta ee uu door bido. | 2026-11-15 | machine-drafted, needs native review |
| `joinFeed` | so | Join FEED | Ku biir FEED | 2026-11-15 | machine-drafted, needs native review |
| `joinBody` | so | Find resources, share help, build community. | Hel kheyraad, wadaag caawimo, dhis bulsho. | 2026-11-15 | machine-drafted, needs native review |
| `communityPetition` | so | Community Petition | Codsiga bulshada | 2026-11-15 | machine-drafted, needs native review |
| `signOnFeed` | so | Sign on FEED | Ku saxiix FEED | 2026-11-15 | machine-drafted, needs native review |
| `optInOnFeed` | so | Opt In on FEED | Iska diiwaangeli FEED | 2026-11-15 | machine-drafted, needs native review |
| `businessDescFallback` | so | {name} - Local business on FEED | {name} - Ganacsi maxalli ah oo ku jira FEED | 2026-11-15 | machine-drafted, needs native review |
| `organizationDescFallback` | so | {name} - Local organization on FEED | {name} - Urur maxalli ah oo ku jira FEED | 2026-11-15 | machine-drafted, needs native review |
| `resourceDescFallback` | so | {name} - Community resource on FEED | {name} - Kheyraad bulsheed oo ku jira FEED | 2026-11-15 | machine-drafted, needs native review |
| `localBusiness` | so | Local business | Ganacsi maxalli ah | 2026-11-15 | machine-drafted, needs native review |
| `localOrganization` | so | Local organization | Urur maxalli ah | 2026-11-15 | machine-drafted, needs native review |
| `organization` | so | Organization | Urur | 2026-11-15 | machine-drafted, needs native review |
| `communityResource` | so | Community resource | Kheyraad bulsheed | 2026-11-15 | machine-drafted, needs native review |
| `coverAlt` | so | {name} cover | Sawirka daboolka {name} | 2026-11-15 | machine-drafted, needs native review |
| `logoAlt` | so | {name} logo | Astaanta {name} | 2026-11-15 | machine-drafted, needs native review |
| `mapAlt` | so | Map showing {name} | Khariidad muujinaysa {name} | 2026-11-15 | machine-drafted, needs native review |
| `photoAlt` | so | {name} photo | Sawirka {name} | 2026-11-15 | machine-drafted, needs native review |
| `visitWebsite` | so | Visit website | Booqo bogga internetka | 2026-11-15 | machine-drafted, needs native review |
| `call` | so | Call | Wac | 2026-11-15 | machine-drafted, needs native review |
| `email` | so | Email | Iimayl | 2026-11-15 | machine-drafted, needs native review |
| `businessFeatures` | so | Business features | Astaamaha ganacsiga | 2026-11-15 | machine-drafted, needs native review |
| `resourcesOffered` | so | Resources offered | Kheyraadka la bixiyo | 2026-11-15 | machine-drafted, needs native review |
| `exploreMore` | so | Explore More on FEED | Wax badan ka baadh FEED | 2026-11-15 | machine-drafted, needs native review |
| `exploreBody` | so | Find community resources and support near you. | Hel kheyraad bulsheed iyo taageero kuu dhow. | 2026-11-15 | machine-drafted, needs native review |
| `hoursInFeed` | so | Hours available - see full details in FEED | Saacadaha waa la heli karaa - faahfaahin buuxda ka eeg FEED | 2026-11-15 | machine-drafted, needs native review |
| `eligibility` | so | Eligibility | Shuruudaha | 2026-11-15 | machine-drafted, needs native review |
| `viewDetails` | so | View Full Details in FEED | Ka eeg faahfaahin buuxda FEED | 2026-11-15 | machine-drafted, needs native review |
| `viewDetailsBody` | so | Find more resources and community support. | Hel kheyraad dheeraad ah iyo taageero bulsheed. | 2026-11-15 | machine-drafted, needs native review |
| `supportTitle` | so | Support {name} - FEED | Taageer {name} - FEED | 2026-11-15 | machine-drafted, needs native review |
| `supportOnFeed` | so | Support {name} on FEED | Taageer {name} ee FEED | 2026-11-15 | machine-drafted, needs native review |
| `donateDescription` | so | Send direct support to {name} through FEED's mutual aid platform. | U dir taageero toos ah {name} adigoo adeegsanaya madalka is-caawinta ee FEED. | 2026-11-15 | machine-drafted, needs native review |
| `mutualAid` | so | Mutual Aid | Is-caawin | 2026-11-15 | machine-drafted, needs native review |
| `sendVia` | so | Send via {service} | Ku dir {service} | 2026-11-15 | machine-drafted, needs native review |
| `openFeed` | so | Open FEED | Fur FEED | 2026-11-15 | machine-drafted, needs native review |
| `donateCtaBody` | so | Join the community. Share resources. Build mutual aid. | Ku biir bulshada. Wadaag kheyraad. Dhis is-caawin. | 2026-11-15 | machine-drafted, needs native review |
| `open24h` | so | Open 24 hours | Furan 24 saac | 2026-11-15 | machine-drafted, needs native review |
| `nextDay` | so | {hours} (next day) | {hours} (maalinta xigta) | 2026-11-15 | machine-drafted, needs native review |
| `openNowCloses` | so | Open now · closes {time} | Hadda furan · wuxuu xirmayaa {time} | 2026-11-15 | machine-drafted, needs native review |
| `closedOpens` | so | Closed · opens {day} {time} | Xiran · wuxuu furmayaa {day} {time} | 2026-11-15 | machine-drafted, needs native review |
| `siteTitle` | am | FEED - Mutual Aid Resource Sharing | FEED - የመረዳዳት ሀብቶችን መጋራት | 2026-11-15 | machine-drafted, needs native review |
| `siteDescription` | am | Community-powered mutual aid. Share resources, find help, support your neighbors. | በማህበረሰብ የሚመራ መረዳዳት። ሀብቶችን ያጋሩ፣ እርዳታ ያግኙ፣ ጎረቤቶችዎን ይደግፉ። | 2026-11-15 | machine-drafted, needs native review |
| `notFoundTitle` | am | This page isn't available | ይህ ገጽ አይገኝም | 2026-11-15 | machine-drafted, needs native review |
| `notFoundBody` | am | The link may be out of date, or what it shared is no longer public. | ሊንኩ ጊዜው ያለፈበት ሊሆን ይችላል፣ ወይም የተጋራው ነገር ከአሁን በኋላ ለሕዝብ ክፍት አይደለም። | 2026-11-15 | machine-drafted, needs native review |
| `postNotFound` | am | Post Not Found - FEED | ልጥፉ አልተገኘም - FEED | 2026-11-15 | machine-drafted, needs native review |
| `businessNotFound` | am | Business Not Found - FEED | ንግዱ አልተገኘም - FEED | 2026-11-15 | machine-drafted, needs native review |
| `organizationNotFound` | am | Organization Not Found - FEED | ድርጅቱ አልተገኘም - FEED | 2026-11-15 | machine-drafted, needs native review |
| `resourceNotFound` | am | Resource Not Found - FEED | ሀብቱ አልተገኘም - FEED | 2026-11-15 | machine-drafted, needs native review |
| `communityMember` | am | Community Member | የማህበረሰብ አባል | 2026-11-15 | machine-drafted, needs native review |
| `aCommunityMember` | am | a community member | አንድ የማህበረሰብ አባል | 2026-11-15 | machine-drafted, needs native review |
| `onFeed` | am | {name} on FEED | {name} በFEED ላይ | 2026-11-15 | machine-drafted, needs native review |
| `petitionOnFeed` | am | {title} — FEED Community Petition | {title} — የFEED ማህበረሰብ አቤቱታ | 2026-11-15 | machine-drafted, needs native review |
| `tagline` | am | Mutual Aid Resource Sharing | የመረዳዳት ሀብቶችን መጋራት | 2026-11-15 | machine-drafted, needs native review |
| `poweredBy` | am | Powered by FEED · Mutual Aid Resource Sharing | በFEED የቀረበ · የመረዳዳት ሀብቶችን መጋራት | 2026-11-15 | machine-drafted, needs native review |
| `postImage` | am | Post image | የልጥፉ ምስል | 2026-11-15 | machine-drafted, needs native review |
| `supportName` | am | Support {name} | {name}ን ይደግፉ | 2026-11-15 | machine-drafted, needs native review |
| `supportBody` | am | Send direct support through their preferred payment method. | በሚመርጡት የክፍያ ዘዴ ቀጥተኛ ድጋፍ ይላኩ። | 2026-11-15 | machine-drafted, needs native review |
| `joinFeed` | am | Join FEED | FEEDን ይቀላቀሉ | 2026-11-15 | machine-drafted, needs native review |
| `joinBody` | am | Find resources, share help, build community. | ሀብቶችን ያግኙ፣ እርዳታ ያጋሩ፣ ማህበረሰብ ይገንቡ። | 2026-11-15 | machine-drafted, needs native review |
| `communityPetition` | am | Community Petition | የማህበረሰብ አቤቱታ | 2026-11-15 | machine-drafted, needs native review |
| `signOnFeed` | am | Sign on FEED | በFEED ላይ ይፈርሙ | 2026-11-15 | machine-drafted, needs native review |
| `optInOnFeed` | am | Opt In on FEED | በFEED ላይ ይመዝገቡ | 2026-11-15 | machine-drafted, needs native review |
| `businessDescFallback` | am | {name} - Local business on FEED | {name} - በFEED ላይ ያለ የአካባቢ ንግድ | 2026-11-15 | machine-drafted, needs native review |
| `organizationDescFallback` | am | {name} - Local organization on FEED | {name} - በFEED ላይ ያለ የአካባቢ ድርጅት | 2026-11-15 | machine-drafted, needs native review |
| `resourceDescFallback` | am | {name} - Community resource on FEED | {name} - በFEED ላይ ያለ የማህበረሰብ ሀብት | 2026-11-15 | machine-drafted, needs native review |
| `localBusiness` | am | Local business | የአካባቢ ንግድ | 2026-11-15 | machine-drafted, needs native review |
| `localOrganization` | am | Local organization | የአካባቢ ድርጅት | 2026-11-15 | machine-drafted, needs native review |
| `organization` | am | Organization | ድርጅት | 2026-11-15 | machine-drafted, needs native review |
| `communityResource` | am | Community resource | የማህበረሰብ ሀብት | 2026-11-15 | machine-drafted, needs native review |
| `coverAlt` | am | {name} cover | የ{name} የሽፋን ምስል | 2026-11-15 | machine-drafted, needs native review |
| `logoAlt` | am | {name} logo | የ{name} አርማ | 2026-11-15 | machine-drafted, needs native review |
| `mapAlt` | am | Map showing {name} | {name}ን የሚያሳይ ካርታ | 2026-11-15 | machine-drafted, needs native review |
| `photoAlt` | am | {name} photo | የ{name} ፎቶ | 2026-11-15 | machine-drafted, needs native review |
| `visitWebsite` | am | Visit website | ድረ-ገጹን ይጎብኙ | 2026-11-15 | machine-drafted, needs native review |
| `call` | am | Call | ይደውሉ | 2026-11-15 | machine-drafted, needs native review |
| `email` | am | Email | ኢሜይል ይላኩ | 2026-11-15 | machine-drafted, needs native review |
| `businessFeatures` | am | Business features | የንግዱ ባህሪያት | 2026-11-15 | machine-drafted, needs native review |
| `resourcesOffered` | am | Resources offered | የሚቀርቡ ሀብቶች | 2026-11-15 | machine-drafted, needs native review |
| `exploreMore` | am | Explore More on FEED | በFEED ላይ ተጨማሪ ያስሱ | 2026-11-15 | machine-drafted, needs native review |
| `exploreBody` | am | Find community resources and support near you. | በአቅራቢያዎ የማህበረሰብ ሀብቶችንና ድጋፍ ያግኙ። | 2026-11-15 | machine-drafted, needs native review |
| `hoursInFeed` | am | Hours available - see full details in FEED | የሥራ ሰዓት አለ - ሙሉ ዝርዝሩን በFEED ይመልከቱ | 2026-11-15 | machine-drafted, needs native review |
| `eligibility` | am | Eligibility | የብቁነት መስፈርቶች | 2026-11-15 | machine-drafted, needs native review |
| `viewDetails` | am | View Full Details in FEED | ሙሉ ዝርዝሩን በFEED ይመልከቱ | 2026-11-15 | machine-drafted, needs native review |
| `viewDetailsBody` | am | Find more resources and community support. | ተጨማሪ ሀብቶችንና የማህበረሰብ ድጋፍ ያግኙ። | 2026-11-15 | machine-drafted, needs native review |
| `supportTitle` | am | Support {name} - FEED | {name}ን ይደግፉ - FEED | 2026-11-15 | machine-drafted, needs native review |
| `supportOnFeed` | am | Support {name} on FEED | {name}ን በFEED ላይ ይደግፉ | 2026-11-15 | machine-drafted, needs native review |
| `donateDescription` | am | Send direct support to {name} through FEED's mutual aid platform. | በFEED የመረዳዳት መድረክ በኩል ለ{name} ቀጥተኛ ድጋፍ ይላኩ። | 2026-11-15 | machine-drafted, needs native review |
| `mutualAid` | am | Mutual Aid | መረዳዳት | 2026-11-15 | machine-drafted, needs native review |
| `sendVia` | am | Send via {service} | በ{service} ይላኩ | 2026-11-15 | machine-drafted, needs native review |
| `openFeed` | am | Open FEED | FEEDን ክፈት | 2026-11-15 | machine-drafted, needs native review |
| `donateCtaBody` | am | Join the community. Share resources. Build mutual aid. | ማህበረሰቡን ይቀላቀሉ። ሀብቶችን ያጋሩ። መረዳዳትን ይገንቡ። | 2026-11-15 | machine-drafted, needs native review |
| `open24h` | am | Open 24 hours | ለ24 ሰዓት ክፍት | 2026-11-15 | machine-drafted, needs native review |
| `nextDay` | am | {hours} (next day) | {hours} (በሚቀጥለው ቀን) | 2026-11-15 | machine-drafted, needs native review |
| `openNowCloses` | am | Open now · closes {time} | አሁን ክፍት · በ{time} ይዘጋል | 2026-11-15 | machine-drafted, needs native review |
| `closedOpens` | am | Closed · opens {day} {time} | ዝግ · {day} በ{time} ይከፈታል | 2026-11-15 | machine-drafted, needs native review |
| `siteTitle` | hmn | FEED - Mutual Aid Resource Sharing | FEED - Kev sib qhia kev pab sib pab | 2026-11-15 | machine-drafted, needs native review |
| `siteDescription` | hmn | Community-powered mutual aid. Share resources, find help, support your neighbors. | Kev sib pab uas zej zog coj. Qhia kev pab, nrhiav kev pab, txhawb koj cov neeg zej zog. | 2026-11-15 | machine-drafted, needs native review |
| `notFoundTitle` | hmn | This page isn't available | Nplooj ntawv no tsis muaj lawm | 2026-11-15 | machine-drafted, needs native review |
| `notFoundBody` | hmn | The link may be out of date, or what it shared is no longer public. | Tej zaum txoj kab txuas qub lawm, lossis yam uas tau qhia tsis yog pej xeem lawm. | 2026-11-15 | machine-drafted, needs native review |
| `postNotFound` | hmn | Post Not Found - FEED | Nrhiav tsis tau tsab ntawv - FEED | 2026-11-15 | machine-drafted, needs native review |
| `businessNotFound` | hmn | Business Not Found - FEED | Nrhiav tsis tau lub lag luam - FEED | 2026-11-15 | machine-drafted, needs native review |
| `organizationNotFound` | hmn | Organization Not Found - FEED | Nrhiav tsis tau lub koom haum - FEED | 2026-11-15 | machine-drafted, needs native review |
| `resourceNotFound` | hmn | Resource Not Found - FEED | Nrhiav tsis tau qhov kev pab - FEED | 2026-11-15 | machine-drafted, needs native review |
| `communityMember` | hmn | Community Member | Tus tswv cuab hauv zej zog | 2026-11-15 | machine-drafted, needs native review |
| `aCommunityMember` | hmn | a community member | ib tus tswv cuab hauv zej zog | 2026-11-15 | machine-drafted, needs native review |
| `onFeed` | hmn | {name} on FEED | {name} hauv FEED | 2026-11-15 | machine-drafted, needs native review |
| `petitionOnFeed` | hmn | {title} — FEED Community Petition | {title} — Daim ntawv thov ntawm zej zog FEED | 2026-11-15 | machine-drafted, needs native review |
| `tagline` | hmn | Mutual Aid Resource Sharing | Kev sib qhia kev pab sib pab | 2026-11-15 | machine-drafted, needs native review |
| `poweredBy` | hmn | Powered by FEED · Mutual Aid Resource Sharing | FEED ua · Kev sib qhia kev pab sib pab | 2026-11-15 | machine-drafted, needs native review |
| `postImage` | hmn | Post image | Duab ntawm tsab ntawv | 2026-11-15 | machine-drafted, needs native review |
| `supportName` | hmn | Support {name} | Txhawb {name} | 2026-11-15 | machine-drafted, needs native review |
| `supportBody` | hmn | Send direct support through their preferred payment method. | Xa kev txhawb ncaj qha los ntawm txoj kev them nyiaj uas lawv nyiam. | 2026-11-15 | machine-drafted, needs native review |
| `joinFeed` | hmn | Join FEED | Koom FEED | 2026-11-15 | machine-drafted, needs native review |
| `joinBody` | hmn | Find resources, share help, build community. | Nrhiav kev pab, qhia kev pab, tsim zej zog. | 2026-11-15 | machine-drafted, needs native review |
| `communityPetition` | hmn | Community Petition | Daim ntawv thov ntawm zej zog | 2026-11-15 | machine-drafted, needs native review |
| `signOnFeed` | hmn | Sign on FEED | Kos npe hauv FEED | 2026-11-15 | machine-drafted, needs native review |
| `optInOnFeed` | hmn | Opt In on FEED | Sau npe hauv FEED | 2026-11-15 | machine-drafted, needs native review |
| `businessDescFallback` | hmn | {name} - Local business on FEED | {name} - Lub lag luam hauv zos hauv FEED | 2026-11-15 | machine-drafted, needs native review |
| `organizationDescFallback` | hmn | {name} - Local organization on FEED | {name} - Lub koom haum hauv zos hauv FEED | 2026-11-15 | machine-drafted, needs native review |
| `resourceDescFallback` | hmn | {name} - Community resource on FEED | {name} - Kev pab rau zej zog hauv FEED | 2026-11-15 | machine-drafted, needs native review |
| `localBusiness` | hmn | Local business | Lub lag luam hauv zos | 2026-11-15 | machine-drafted, needs native review |
| `localOrganization` | hmn | Local organization | Lub koom haum hauv zos | 2026-11-15 | machine-drafted, needs native review |
| `organization` | hmn | Organization | Lub koom haum | 2026-11-15 | machine-drafted, needs native review |
| `communityResource` | hmn | Community resource | Kev pab rau zej zog | 2026-11-15 | machine-drafted, needs native review |
| `coverAlt` | hmn | {name} cover | Duab npog ntawm {name} | 2026-11-15 | machine-drafted, needs native review |
| `logoAlt` | hmn | {name} logo | Lub cim ntawm {name} | 2026-11-15 | machine-drafted, needs native review |
| `mapAlt` | hmn | Map showing {name} | Daim ntawv qhia chaw uas qhia {name} | 2026-11-15 | machine-drafted, needs native review |
| `photoAlt` | hmn | {name} photo | Duab ntawm {name} | 2026-11-15 | machine-drafted, needs native review |
| `visitWebsite` | hmn | Visit website | Mus saib lub vev xaib | 2026-11-15 | machine-drafted, needs native review |
| `call` | hmn | Call | Hu | 2026-11-15 | machine-drafted, needs native review |
| `email` | hmn | Email | Xa email | 2026-11-15 | machine-drafted, needs native review |
| `businessFeatures` | hmn | Business features | Cov yam ntxwv ntawm lub lag luam | 2026-11-15 | machine-drafted, needs native review |
| `resourcesOffered` | hmn | Resources offered | Cov kev pab uas muaj | 2026-11-15 | machine-drafted, needs native review |
| `exploreMore` | hmn | Explore More on FEED | Saib ntxiv hauv FEED | 2026-11-15 | machine-drafted, needs native review |
| `exploreBody` | hmn | Find community resources and support near you. | Nrhiav kev pab thiab kev txhawb hauv zej zog ze koj. | 2026-11-15 | machine-drafted, needs native review |
| `hoursInFeed` | hmn | Hours available - see full details in FEED | Muaj sijhawm qhib - saib tag nrho cov ntsiab lus hauv FEED | 2026-11-15 | machine-drafted, needs native review |
| `eligibility` | hmn | Eligibility | Cov cai tsim nyog | 2026-11-15 | machine-drafted, needs native review |
| `viewDetails` | hmn | View Full Details in FEED | Saib tag nrho cov ntsiab lus hauv FEED | 2026-11-15 | machine-drafted, needs native review |
| `viewDetailsBody` | hmn | Find more resources and community support. | Nrhiav kev pab ntxiv thiab kev txhawb hauv zej zog. | 2026-11-15 | machine-drafted, needs native review |
| `supportTitle` | hmn | Support {name} - FEED | Txhawb {name} - FEED | 2026-11-15 | machine-drafted, needs native review |
| `supportOnFeed` | hmn | Support {name} on FEED | Txhawb {name} hauv FEED | 2026-11-15 | machine-drafted, needs native review |
| `donateDescription` | hmn | Send direct support to {name} through FEED's mutual aid platform. | Xa kev txhawb ncaj qha rau {name} los ntawm FEED lub platform sib pab. | 2026-11-15 | machine-drafted, needs native review |
| `mutualAid` | hmn | Mutual Aid | Kev sib pab | 2026-11-15 | machine-drafted, needs native review |
| `sendVia` | hmn | Send via {service} | Xa los ntawm {service} | 2026-11-15 | machine-drafted, needs native review |
| `openFeed` | hmn | Open FEED | Qhib FEED | 2026-11-15 | machine-drafted, needs native review |
| `donateCtaBody` | hmn | Join the community. Share resources. Build mutual aid. | Koom zej zog. Qhia kev pab. Tsim kev sib pab. | 2026-11-15 | machine-drafted, needs native review |
| `open24h` | hmn | Open 24 hours | Qhib 24 teev | 2026-11-15 | machine-drafted, needs native review |
| `nextDay` | hmn | {hours} (next day) | {hours} (hnub tom qab) | 2026-11-15 | machine-drafted, needs native review |
| `openNowCloses` | hmn | Open now · closes {time} | Qhib tam sim no · kaw thaum {time} | 2026-11-15 | machine-drafted, needs native review |
| `closedOpens` | hmn | Closed · opens {day} {time} | Kaw lawm · qhib {day} thaum {time} | 2026-11-15 | machine-drafted, needs native review |
| `LIKES_COUNT.other` | ht | {count} likes | {count} renmen | 2026-11-15 | machine-drafted, needs native review |
| `LIKES_COUNT.other` | so | {count} likes | {count} jeclaysi | 2026-11-15 | machine-drafted, needs native review |
| `LIKES_COUNT.one` | am | {count} like | {count} መውደድ | 2026-11-15 | machine-drafted, needs native review |
| `LIKES_COUNT.other` | am | {count} likes | {count} መውደዶች | 2026-11-15 | machine-drafted, needs native review |
| `LIKES_COUNT.other` | hmn | {count} likes | {count} tus nyiam | 2026-11-15 | machine-drafted, needs native review |
| `COMMENTS_COUNT.other` | ht | {count} comments | {count} kòmantè | 2026-11-15 | machine-drafted, needs native review |
| `COMMENTS_COUNT.other` | so | {count} comments | {count} faallo | 2026-11-15 | machine-drafted, needs native review |
| `COMMENTS_COUNT.one` | am | {count} comment | {count} አስተያየት | 2026-11-15 | machine-drafted, needs native review |
| `COMMENTS_COUNT.other` | am | {count} comments | {count} አስተያየቶች | 2026-11-15 | machine-drafted, needs native review |
| `COMMENTS_COUNT.other` | hmn | {count} comments | {count} lus tawm tswv yim | 2026-11-15 | machine-drafted, needs native review |

### `lib/i18n-us-states.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `AL` | ht | Alabama | Alabama | 2026-11-15 | machine-drafted, needs native review |
| `AK` | ht | Alaska | Alaska | 2026-11-15 | machine-drafted, needs native review |
| `AZ` | ht | Arizona | Arizona | 2026-11-15 | machine-drafted, needs native review |
| `AR` | ht | Arkansas | Arkansas | 2026-11-15 | machine-drafted, needs native review |
| `CA` | ht | California | Kalifòni | 2026-11-15 | machine-drafted, needs native review |
| `CO` | ht | Colorado | Kolorado | 2026-11-15 | machine-drafted, needs native review |
| `CT` | ht | Connecticut | Konektikèt | 2026-11-15 | machine-drafted, needs native review |
| `DE` | ht | Delaware | Delawè | 2026-11-15 | machine-drafted, needs native review |
| `DC` | ht | District of Columbia | Distri Kolonbi | 2026-11-15 | machine-drafted, needs native review |
| `FL` | ht | Florida | Florid | 2026-11-15 | machine-drafted, needs native review |
| `GA` | ht | Georgia | Jòji | 2026-11-15 | machine-drafted, needs native review |
| `HI` | ht | Hawaii | Awayi | 2026-11-15 | machine-drafted, needs native review |
| `ID` | ht | Idaho | Idaho | 2026-11-15 | machine-drafted, needs native review |
| `IL` | ht | Illinois | Ilinwa | 2026-11-15 | machine-drafted, needs native review |
| `IN` | ht | Indiana | Indyana | 2026-11-15 | machine-drafted, needs native review |
| `IA` | ht | Iowa | Iowa | 2026-11-15 | machine-drafted, needs native review |
| `KS` | ht | Kansas | Kannzas | 2026-11-15 | machine-drafted, needs native review |
| `KY` | ht | Kentucky | Kentoki | 2026-11-15 | machine-drafted, needs native review |
| `LA` | ht | Louisiana | Lwizyàn | 2026-11-15 | machine-drafted, needs native review |
| `ME` | ht | Maine | Maine | 2026-11-15 | machine-drafted, needs native review |
| `MD` | ht | Maryland | Maryland | 2026-11-15 | machine-drafted, needs native review |
| `MA` | ht | Massachusetts | Massachusetts | 2026-11-15 | machine-drafted, needs native review |
| `MI` | ht | Michigan | Michigan | 2026-11-15 | machine-drafted, needs native review |
| `MN` | ht | Minnesota | Minnesota | 2026-11-15 | machine-drafted, needs native review |
| `MS` | ht | Mississippi | Mississippi | 2026-11-15 | machine-drafted, needs native review |
| `MO` | ht | Missouri | Missouri | 2026-11-15 | machine-drafted, needs native review |
| `MT` | ht | Montana | Montana | 2026-11-15 | machine-drafted, needs native review |
| `NE` | ht | Nebraska | Nebraska | 2026-11-15 | machine-drafted, needs native review |
| `NV` | ht | Nevada | Nevada | 2026-11-15 | machine-drafted, needs native review |
| `NH` | ht | New Hampshire | New Hampshire | 2026-11-15 | machine-drafted, needs native review |
| `NJ` | ht | New Jersey | New Jersey | 2026-11-15 | machine-drafted, needs native review |
| `NM` | ht | New Mexico | Nouvo Meksik | 2026-11-15 | machine-drafted, needs native review |
| `NY` | ht | New York | Nouyòk | 2026-11-15 | machine-drafted, needs native review |
| `NC` | ht | North Carolina | Karolin di Nò | 2026-11-15 | machine-drafted, needs native review |
| `ND` | ht | North Dakota | Dakota di Nò | 2026-11-15 | machine-drafted, needs native review |
| `OH` | ht | Ohio | Ohio | 2026-11-15 | machine-drafted, needs native review |
| `OK` | ht | Oklahoma | Oklahoma | 2026-11-15 | machine-drafted, needs native review |
| `OR` | ht | Oregon | Oregon | 2026-11-15 | machine-drafted, needs native review |
| `PA` | ht | Pennsylvania | Pennsilvani | 2026-11-15 | machine-drafted, needs native review |
| `RI` | ht | Rhode Island | Rhode Island | 2026-11-15 | machine-drafted, needs native review |
| `SC` | ht | South Carolina | Karolin di Sid | 2026-11-15 | machine-drafted, needs native review |
| `SD` | ht | South Dakota | Dakota di Sid | 2026-11-15 | machine-drafted, needs native review |
| `TN` | ht | Tennessee | Tennessee | 2026-11-15 | machine-drafted, needs native review |
| `TX` | ht | Texas | Texas | 2026-11-15 | machine-drafted, needs native review |
| `UT` | ht | Utah | Utah | 2026-11-15 | machine-drafted, needs native review |
| `VT` | ht | Vermont | Vermont | 2026-11-15 | machine-drafted, needs native review |
| `VA` | ht | Virginia | Vijini | 2026-11-15 | machine-drafted, needs native review |
| `WA` | ht | Washington | Washington | 2026-11-15 | machine-drafted, needs native review |
| `WV` | ht | West Virginia | Vijini Lwès | 2026-11-15 | machine-drafted, needs native review |
| `WI` | ht | Wisconsin | Wisconsin | 2026-11-15 | machine-drafted, needs native review |
| `WY` | ht | Wyoming | Wyoming | 2026-11-15 | machine-drafted, needs native review |
| `PR` | ht | Puerto Rico | Pòtoriko | 2026-11-15 | machine-drafted, needs native review |
| `GU` | ht | Guam | Gwam | 2026-11-15 | machine-drafted, needs native review |
| `VI` | ht | US Virgin Islands | Zile Vyèj Ameriken | 2026-11-15 | machine-drafted, needs native review |
| `AS` | ht | American Samoa | Samoa Ameriken | 2026-11-15 | machine-drafted, needs native review |
| `MP` | ht | Northern Mariana Islands | Zile Mariàn di Nò | 2026-11-15 | machine-drafted, needs native review |
| `AL` | so | Alabama | Alabama | 2026-11-15 | machine-drafted, needs native review |
| `AK` | so | Alaska | Alaska | 2026-11-15 | machine-drafted, needs native review |
| `AZ` | so | Arizona | Arizona | 2026-11-15 | machine-drafted, needs native review |
| `AR` | so | Arkansas | Arkansas | 2026-11-15 | machine-drafted, needs native review |
| `CA` | so | California | Kaliforniya | 2026-11-15 | machine-drafted, needs native review |
| `CO` | so | Colorado | Colorado | 2026-11-15 | machine-drafted, needs native review |
| `CT` | so | Connecticut | Connecticut | 2026-11-15 | machine-drafted, needs native review |
| `DE` | so | Delaware | Delaware | 2026-11-15 | machine-drafted, needs native review |
| `DC` | so | District of Columbia | Degmada Columbia | 2026-11-15 | machine-drafted, needs native review |
| `FL` | so | Florida | Florida | 2026-11-15 | machine-drafted, needs native review |
| `GA` | so | Georgia | Georgia | 2026-11-15 | machine-drafted, needs native review |
| `HI` | so | Hawaii | Hawaii | 2026-11-15 | machine-drafted, needs native review |
| `ID` | so | Idaho | Idaho | 2026-11-15 | machine-drafted, needs native review |
| `IL` | so | Illinois | Illinois | 2026-11-15 | machine-drafted, needs native review |
| `IN` | so | Indiana | Indiana | 2026-11-15 | machine-drafted, needs native review |
| `IA` | so | Iowa | Iowa | 2026-11-15 | machine-drafted, needs native review |
| `KS` | so | Kansas | Kansas | 2026-11-15 | machine-drafted, needs native review |
| `KY` | so | Kentucky | Kentucky | 2026-11-15 | machine-drafted, needs native review |
| `LA` | so | Louisiana | Louisiana | 2026-11-15 | machine-drafted, needs native review |
| `ME` | so | Maine | Maine | 2026-11-15 | machine-drafted, needs native review |
| `MD` | so | Maryland | Maryland | 2026-11-15 | machine-drafted, needs native review |
| `MA` | so | Massachusetts | Massachusetts | 2026-11-15 | machine-drafted, needs native review |
| `MI` | so | Michigan | Michigan | 2026-11-15 | machine-drafted, needs native review |
| `MN` | so | Minnesota | Minnesota | 2026-11-15 | machine-drafted, needs native review |
| `MS` | so | Mississippi | Mississippi | 2026-11-15 | machine-drafted, needs native review |
| `MO` | so | Missouri | Missouri | 2026-11-15 | machine-drafted, needs native review |
| `MT` | so | Montana | Montana | 2026-11-15 | machine-drafted, needs native review |
| `NE` | so | Nebraska | Nebraska | 2026-11-15 | machine-drafted, needs native review |
| `NV` | so | Nevada | Nevada | 2026-11-15 | machine-drafted, needs native review |
| `NH` | so | New Hampshire | New Hampshire | 2026-11-15 | machine-drafted, needs native review |
| `NJ` | so | New Jersey | New Jersey | 2026-11-15 | machine-drafted, needs native review |
| `NM` | so | New Mexico | New Mexico | 2026-11-15 | machine-drafted, needs native review |
| `NY` | so | New York | New York | 2026-11-15 | machine-drafted, needs native review |
| `NC` | so | North Carolina | Waqooyiga Carolina | 2026-11-15 | machine-drafted, needs native review |
| `ND` | so | North Dakota | Waqooyiga Dakota | 2026-11-15 | machine-drafted, needs native review |
| `OH` | so | Ohio | Ohio | 2026-11-15 | machine-drafted, needs native review |
| `OK` | so | Oklahoma | Oklahoma | 2026-11-15 | machine-drafted, needs native review |
| `OR` | so | Oregon | Oregon | 2026-11-15 | machine-drafted, needs native review |
| `PA` | so | Pennsylvania | Pennsylvania | 2026-11-15 | machine-drafted, needs native review |
| `RI` | so | Rhode Island | Rhode Island | 2026-11-15 | machine-drafted, needs native review |
| `SC` | so | South Carolina | Koonfurta Carolina | 2026-11-15 | machine-drafted, needs native review |
| `SD` | so | South Dakota | Koonfurta Dakota | 2026-11-15 | machine-drafted, needs native review |
| `TN` | so | Tennessee | Tennessee | 2026-11-15 | machine-drafted, needs native review |
| `TX` | so | Texas | Texas | 2026-11-15 | machine-drafted, needs native review |
| `UT` | so | Utah | Utah | 2026-11-15 | machine-drafted, needs native review |
| `VT` | so | Vermont | Vermont | 2026-11-15 | machine-drafted, needs native review |
| `VA` | so | Virginia | Virginia | 2026-11-15 | machine-drafted, needs native review |
| `WA` | so | Washington | Washington | 2026-11-15 | machine-drafted, needs native review |
| `WV` | so | West Virginia | Galbeedka Virginia | 2026-11-15 | machine-drafted, needs native review |
| `WI` | so | Wisconsin | Wisconsin | 2026-11-15 | machine-drafted, needs native review |
| `WY` | so | Wyoming | Wyoming | 2026-11-15 | machine-drafted, needs native review |
| `PR` | so | Puerto Rico | Puerto Rico | 2026-11-15 | machine-drafted, needs native review |
| `GU` | so | Guam | Guam | 2026-11-15 | machine-drafted, needs native review |
| `VI` | so | US Virgin Islands | Jasiiradaha Virgin ee Mareykanka | 2026-11-15 | machine-drafted, needs native review |
| `AS` | so | American Samoa | Samoa ee Mareykanka | 2026-11-15 | machine-drafted, needs native review |
| `MP` | so | Northern Mariana Islands | Jasiiradaha Waqooyiga Mariana | 2026-11-15 | machine-drafted, needs native review |
| `AL` | am | Alabama | አላባማ | 2026-11-15 | machine-drafted, needs native review |
| `AK` | am | Alaska | አላስካ | 2026-11-15 | machine-drafted, needs native review |
| `AZ` | am | Arizona | አሪዞና | 2026-11-15 | machine-drafted, needs native review |
| `AR` | am | Arkansas | አርካንሳስ | 2026-11-15 | machine-drafted, needs native review |
| `CA` | am | California | ካሊፎርኒያ | 2026-11-15 | machine-drafted, needs native review |
| `CO` | am | Colorado | ኮሎራዶ | 2026-11-15 | machine-drafted, needs native review |
| `CT` | am | Connecticut | ኮነቲከት | 2026-11-15 | machine-drafted, needs native review |
| `DE` | am | Delaware | ደላዌር | 2026-11-15 | machine-drafted, needs native review |
| `DC` | am | District of Columbia | ዲስትሪክት ኦፍ ኮሎምቢያ | 2026-11-15 | machine-drafted, needs native review |
| `FL` | am | Florida | ፍሎሪዳ | 2026-11-15 | machine-drafted, needs native review |
| `GA` | am | Georgia | ጆርጂያ | 2026-11-15 | machine-drafted, needs native review |
| `HI` | am | Hawaii | ሃዋይ | 2026-11-15 | machine-drafted, needs native review |
| `ID` | am | Idaho | አይዳሆ | 2026-11-15 | machine-drafted, needs native review |
| `IL` | am | Illinois | ኢሊኖይ | 2026-11-15 | machine-drafted, needs native review |
| `IN` | am | Indiana | ኢንዲያና | 2026-11-15 | machine-drafted, needs native review |
| `IA` | am | Iowa | አዮዋ | 2026-11-15 | machine-drafted, needs native review |
| `KS` | am | Kansas | ካንሳስ | 2026-11-15 | machine-drafted, needs native review |
| `KY` | am | Kentucky | ኬንታኪ | 2026-11-15 | machine-drafted, needs native review |
| `LA` | am | Louisiana | ሉዊዚያና | 2026-11-15 | machine-drafted, needs native review |
| `ME` | am | Maine | ሜይን | 2026-11-15 | machine-drafted, needs native review |
| `MD` | am | Maryland | ሜሪላንድ | 2026-11-15 | machine-drafted, needs native review |
| `MA` | am | Massachusetts | ማሳቹሴትስ | 2026-11-15 | machine-drafted, needs native review |
| `MI` | am | Michigan | ሚሺጋን | 2026-11-15 | machine-drafted, needs native review |
| `MN` | am | Minnesota | ሚኒሶታ | 2026-11-15 | machine-drafted, needs native review |
| `MS` | am | Mississippi | ሚሲሲፒ | 2026-11-15 | machine-drafted, needs native review |
| `MO` | am | Missouri | ሚዙሪ | 2026-11-15 | machine-drafted, needs native review |
| `MT` | am | Montana | ሞንታና | 2026-11-15 | machine-drafted, needs native review |
| `NE` | am | Nebraska | ነብራስካ | 2026-11-15 | machine-drafted, needs native review |
| `NV` | am | Nevada | ኔቫዳ | 2026-11-15 | machine-drafted, needs native review |
| `NH` | am | New Hampshire | ኒው ሃምፕሻየር | 2026-11-15 | machine-drafted, needs native review |
| `NJ` | am | New Jersey | ኒው ጀርሲ | 2026-11-15 | machine-drafted, needs native review |
| `NM` | am | New Mexico | ኒው ሜክሲኮ | 2026-11-15 | machine-drafted, needs native review |
| `NY` | am | New York | ኒው ዮርክ | 2026-11-15 | machine-drafted, needs native review |
| `NC` | am | North Carolina | ሰሜን ካሮላይና | 2026-11-15 | machine-drafted, needs native review |
| `ND` | am | North Dakota | ሰሜን ዳኮታ | 2026-11-15 | machine-drafted, needs native review |
| `OH` | am | Ohio | ኦሃዮ | 2026-11-15 | machine-drafted, needs native review |
| `OK` | am | Oklahoma | ኦክላሆማ | 2026-11-15 | machine-drafted, needs native review |
| `OR` | am | Oregon | ኦሪገን | 2026-11-15 | machine-drafted, needs native review |
| `PA` | am | Pennsylvania | ፔንሲልቬንያ | 2026-11-15 | machine-drafted, needs native review |
| `RI` | am | Rhode Island | ሮድ አይላንድ | 2026-11-15 | machine-drafted, needs native review |
| `SC` | am | South Carolina | ደቡብ ካሮላይና | 2026-11-15 | machine-drafted, needs native review |
| `SD` | am | South Dakota | ደቡብ ዳኮታ | 2026-11-15 | machine-drafted, needs native review |
| `TN` | am | Tennessee | ቴነሲ | 2026-11-15 | machine-drafted, needs native review |
| `TX` | am | Texas | ቴክሳስ | 2026-11-15 | machine-drafted, needs native review |
| `UT` | am | Utah | ዩታ | 2026-11-15 | machine-drafted, needs native review |
| `VT` | am | Vermont | ቨርሞንት | 2026-11-15 | machine-drafted, needs native review |
| `VA` | am | Virginia | ቨርጂኒያ | 2026-11-15 | machine-drafted, needs native review |
| `WA` | am | Washington | ዋሽንግተን | 2026-11-15 | machine-drafted, needs native review |
| `WV` | am | West Virginia | ምዕራብ ቨርጂኒያ | 2026-11-15 | machine-drafted, needs native review |
| `WI` | am | Wisconsin | ዊስኮንሲን | 2026-11-15 | machine-drafted, needs native review |
| `WY` | am | Wyoming | ዋዮሚንግ | 2026-11-15 | machine-drafted, needs native review |
| `PR` | am | Puerto Rico | ፖርቶ ሪኮ | 2026-11-15 | machine-drafted, needs native review |
| `GU` | am | Guam | ጉዋም | 2026-11-15 | machine-drafted, needs native review |
| `VI` | am | US Virgin Islands | የአሜሪካ ቨርጂን ደሴቶች | 2026-11-15 | machine-drafted, needs native review |
| `AS` | am | American Samoa | የአሜሪካ ሳሞአ | 2026-11-15 | machine-drafted, needs native review |
| `MP` | am | Northern Mariana Islands | የሰሜን ማሪያና ደሴቶች | 2026-11-15 | machine-drafted, needs native review |
| `AL` | hmn | Alabama | Alabama | 2026-11-15 | machine-drafted, needs native review |
| `AK` | hmn | Alaska | Alaska | 2026-11-15 | machine-drafted, needs native review |
| `AZ` | hmn | Arizona | Arizona | 2026-11-15 | machine-drafted, needs native review |
| `AR` | hmn | Arkansas | Arkansas | 2026-11-15 | machine-drafted, needs native review |
| `CA` | hmn | California | California | 2026-11-15 | machine-drafted, needs native review |
| `CO` | hmn | Colorado | Colorado | 2026-11-15 | machine-drafted, needs native review |
| `CT` | hmn | Connecticut | Connecticut | 2026-11-15 | machine-drafted, needs native review |
| `DE` | hmn | Delaware | Delaware | 2026-11-15 | machine-drafted, needs native review |
| `DC` | hmn | District of Columbia | Cheeb Tsam Columbia | 2026-11-15 | machine-drafted, needs native review |
| `FL` | hmn | Florida | Florida | 2026-11-15 | machine-drafted, needs native review |
| `GA` | hmn | Georgia | Georgia | 2026-11-15 | machine-drafted, needs native review |
| `HI` | hmn | Hawaii | Hawaii | 2026-11-15 | machine-drafted, needs native review |
| `ID` | hmn | Idaho | Idaho | 2026-11-15 | machine-drafted, needs native review |
| `IL` | hmn | Illinois | Illinois | 2026-11-15 | machine-drafted, needs native review |
| `IN` | hmn | Indiana | Indiana | 2026-11-15 | machine-drafted, needs native review |
| `IA` | hmn | Iowa | Iowa | 2026-11-15 | machine-drafted, needs native review |
| `KS` | hmn | Kansas | Kansas | 2026-11-15 | machine-drafted, needs native review |
| `KY` | hmn | Kentucky | Kentucky | 2026-11-15 | machine-drafted, needs native review |
| `LA` | hmn | Louisiana | Louisiana | 2026-11-15 | machine-drafted, needs native review |
| `ME` | hmn | Maine | Maine | 2026-11-15 | machine-drafted, needs native review |
| `MD` | hmn | Maryland | Maryland | 2026-11-15 | machine-drafted, needs native review |
| `MA` | hmn | Massachusetts | Massachusetts | 2026-11-15 | machine-drafted, needs native review |
| `MI` | hmn | Michigan | Michigan | 2026-11-15 | machine-drafted, needs native review |
| `MN` | hmn | Minnesota | Minnesota | 2026-11-15 | machine-drafted, needs native review |
| `MS` | hmn | Mississippi | Mississippi | 2026-11-15 | machine-drafted, needs native review |
| `MO` | hmn | Missouri | Missouri | 2026-11-15 | machine-drafted, needs native review |
| `MT` | hmn | Montana | Montana | 2026-11-15 | machine-drafted, needs native review |
| `NE` | hmn | Nebraska | Nebraska | 2026-11-15 | machine-drafted, needs native review |
| `NV` | hmn | Nevada | Nevada | 2026-11-15 | machine-drafted, needs native review |
| `NH` | hmn | New Hampshire | New Hampshire | 2026-11-15 | machine-drafted, needs native review |
| `NJ` | hmn | New Jersey | New Jersey | 2026-11-15 | machine-drafted, needs native review |
| `NM` | hmn | New Mexico | New Mexico | 2026-11-15 | machine-drafted, needs native review |
| `NY` | hmn | New York | New York | 2026-11-15 | machine-drafted, needs native review |
| `NC` | hmn | North Carolina | North Carolina | 2026-11-15 | machine-drafted, needs native review |
| `ND` | hmn | North Dakota | North Dakota | 2026-11-15 | machine-drafted, needs native review |
| `OH` | hmn | Ohio | Ohio | 2026-11-15 | machine-drafted, needs native review |
| `OK` | hmn | Oklahoma | Oklahoma | 2026-11-15 | machine-drafted, needs native review |
| `OR` | hmn | Oregon | Oregon | 2026-11-15 | machine-drafted, needs native review |
| `PA` | hmn | Pennsylvania | Pennsylvania | 2026-11-15 | machine-drafted, needs native review |
| `RI` | hmn | Rhode Island | Rhode Island | 2026-11-15 | machine-drafted, needs native review |
| `SC` | hmn | South Carolina | South Carolina | 2026-11-15 | machine-drafted, needs native review |
| `SD` | hmn | South Dakota | South Dakota | 2026-11-15 | machine-drafted, needs native review |
| `TN` | hmn | Tennessee | Tennessee | 2026-11-15 | machine-drafted, needs native review |
| `TX` | hmn | Texas | Texas | 2026-11-15 | machine-drafted, needs native review |
| `UT` | hmn | Utah | Utah | 2026-11-15 | machine-drafted, needs native review |
| `VT` | hmn | Vermont | Vermont | 2026-11-15 | machine-drafted, needs native review |
| `VA` | hmn | Virginia | Virginia | 2026-11-15 | machine-drafted, needs native review |
| `WA` | hmn | Washington | Washington | 2026-11-15 | machine-drafted, needs native review |
| `WV` | hmn | West Virginia | West Virginia | 2026-11-15 | machine-drafted, needs native review |
| `WI` | hmn | Wisconsin | Wisconsin | 2026-11-15 | machine-drafted, needs native review |
| `WY` | hmn | Wyoming | Wyoming | 2026-11-15 | machine-drafted, needs native review |
| `PR` | hmn | Puerto Rico | Puerto Rico | 2026-11-15 | machine-drafted, needs native review |
| `GU` | hmn | Guam | Guam | 2026-11-15 | machine-drafted, needs native review |
| `VI` | hmn | US Virgin Islands | Cov Kob Virgin Asmeskas | 2026-11-15 | machine-drafted, needs native review |
| `AS` | hmn | American Samoa | Asmeskas Samoa | 2026-11-15 | machine-drafted, needs native review |
| `MP` | hmn | Northern Mariana Islands | Cov Kob Northern Mariana | 2026-11-15 | machine-drafted, needs native review |

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
