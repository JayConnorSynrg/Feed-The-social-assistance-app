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
