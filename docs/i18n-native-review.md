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

### `lib/i18n-feed-organizations.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `title` | ht | Local Organizations | Òganizasyon lokal yo | 2026-10-11 | machine-drafted, needs native review |
| `title` | so | Local Organizations | Ururrada deegaanka | 2026-10-11 | machine-drafted, needs native review |
| `title` | am | Local Organizations | የአካባቢ ድርጅቶች | 2026-10-11 | machine-drafted, needs native review |
| `title` | hmn | Local Organizations | Cov koom haum hauv zos | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | ht | Food banks, shelters, clinics, and community organizations near you | Bank manje, abri, klinik ak òganizasyon kominotè ki toupre w | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | so | Food banks, shelters, clinics, and community organizations near you | Bangiyada cuntada, hoyga, rugaha caafimaadka iyo ururrada bulshada ee kuu dhow | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | am | Food banks, shelters, clinics, and community organizations near you | በአቅራቢያዎ ያሉ የምግብ ባንኮች፣ መጠለያዎች፣ ክሊኒኮች እና የማኅበረሰብ ድርጅቶች | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | hmn | Food banks, shelters, clinics, and community organizations near you | Cov txhab nyiaj zaub mov, chaw nyob ib ntus, tsev kho mob thiab cov koom haum zej zog nyob ze koj | 2026-10-11 | machine-drafted, needs native review |
| `empty` | ht | No organizations yet. | Poko gen òganizasyon. | 2026-10-11 | machine-drafted, needs native review |
| `empty` | so | No organizations yet. | Weli ma jiraan ururro. | 2026-10-11 | machine-drafted, needs native review |
| `empty` | am | No organizations yet. | እስካሁን ምንም ድርጅት የለም። | 2026-10-11 | machine-drafted, needs native review |
| `empty` | hmn | No organizations yet. | Tseem tsis tau muaj koom haum. | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | ht | We couldn't load organizations right now. | Nou pa t kapab chaje òganizasyon yo kounye a. | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | so | We couldn't load organizations right now. | Hadda lama soo shubi karo ururrada. | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | am | We couldn't load organizations right now. | ድርጅቶቹን አሁን መጫን አልተቻለም። | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | hmn | We couldn't load organizations right now. | Tam sim no thauj tsis tau cov koom haum. | 2026-10-11 | machine-drafted, needs native review |

### `lib/i18n-feed-petitions.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `catLandRights` | ht | Land Rights | Dwa sou tè | 2026-10-11 | machine-drafted, needs native review |
| `catLandRights` | so | Land Rights | Xuquuqda dhulka | 2026-10-11 | machine-drafted, needs native review |
| `catLandRights` | am | Land Rights | የመሬት መብቶች | 2026-10-11 | machine-drafted, needs native review |
| `catLandRights` | hmn | Land Rights | Cai txog av | 2026-10-11 | machine-drafted, needs native review |
| `catInfrastructure` | ht | Infrastructure | Enfrastrikti | 2026-10-11 | machine-drafted, needs native review |
| `catInfrastructure` | so | Infrastructure | Kaabayaasha | 2026-10-11 | machine-drafted, needs native review |
| `catInfrastructure` | am | Infrastructure | መሠረተ ልማት | 2026-10-11 | machine-drafted, needs native review |
| `catInfrastructure` | hmn | Infrastructure | Kev tsim kho vaj tse thiab kev | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | ht | Housing | Lojman | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | so | Housing | Guriyeyn | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | am | Housing | መኖሪያ ቤት | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | hmn | Housing | Vaj tse | 2026-10-11 | machine-drafted, needs native review |
| `catFoodAccess` | ht | Food Access | Aksè a manje | 2026-10-11 | machine-drafted, needs native review |
| `catFoodAccess` | so | Food Access | Helitaanka cuntada | 2026-10-11 | machine-drafted, needs native review |
| `catFoodAccess` | am | Food Access | የምግብ አቅርቦት | 2026-10-11 | machine-drafted, needs native review |
| `catFoodAccess` | hmn | Food Access | Kev tau txais zaub mov | 2026-10-11 | machine-drafted, needs native review |
| `catHealthcare` | ht | Healthcare | Swen sante | 2026-10-11 | machine-drafted, needs native review |
| `catHealthcare` | so | Healthcare | Daryeel caafimaad | 2026-10-11 | machine-drafted, needs native review |
| `catHealthcare` | am | Healthcare | የጤና እንክብካቤ | 2026-10-11 | machine-drafted, needs native review |
| `catHealthcare` | hmn | Healthcare | Kev kho mob | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | ht | Education | Edikasyon | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | so | Education | Waxbarasho | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | am | Education | ትምህርት | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | hmn | Education | Kev kawm | 2026-10-11 | machine-drafted, needs native review |
| `catEnvironment` | ht | Environment | Anviwònman | 2026-10-11 | machine-drafted, needs native review |
| `catEnvironment` | so | Environment | Deegaanka | 2026-10-11 | machine-drafted, needs native review |
| `catEnvironment` | am | Environment | አካባቢ | 2026-10-11 | machine-drafted, needs native review |
| `catEnvironment` | hmn | Environment | Ib puag ncig | 2026-10-11 | machine-drafted, needs native review |
| `catCivilRights` | ht | Civil Rights | Dwa sivil | 2026-10-11 | machine-drafted, needs native review |
| `catCivilRights` | so | Civil Rights | Xuquuqda madaniga | 2026-10-11 | machine-drafted, needs native review |
| `catCivilRights` | am | Civil Rights | የዜጎች መብቶች | 2026-10-11 | machine-drafted, needs native review |
| `catCivilRights` | hmn | Civil Rights | Pej xeem txoj cai | 2026-10-11 | machine-drafted, needs native review |
| `catCommunity` | ht | Community | Kominote | 2026-10-11 | machine-drafted, needs native review |
| `catCommunity` | so | Community | Bulsho | 2026-10-11 | machine-drafted, needs native review |
| `catCommunity` | am | Community | ማኅበረሰብ | 2026-10-11 | machine-drafted, needs native review |
| `catCommunity` | hmn | Community | Zej zog | 2026-10-11 | machine-drafted, needs native review |
| `title` | ht | Community Petitions | Petisyon kominote a | 2026-10-11 | machine-drafted, needs native review |
| `title` | so | Community Petitions | Codsiyada bulshada | 2026-10-11 | machine-drafted, needs native review |
| `title` | am | Community Petitions | የማኅበረሰብ አቤቱታዎች | 2026-10-11 | machine-drafted, needs native review |
| `title` | hmn | Community Petitions | Zej zog cov ntawv thov | 2026-10-11 | machine-drafted, needs native review |
| `tabsLabel` | ht | Petitions view | Fason pou wè petisyon yo | 2026-10-11 | machine-drafted, needs native review |
| `tabsLabel` | so | Petitions view | Muuqaalka codsiyada | 2026-10-11 | machine-drafted, needs native review |
| `tabsLabel` | am | Petitions view | የአቤቱታዎች እይታ | 2026-10-11 | machine-drafted, needs native review |
| `tabsLabel` | hmn | Petitions view | Saib cov ntawv thov | 2026-10-11 | machine-drafted, needs native review |
| `tabAll` | ht | All petitions | Tout petisyon yo | 2026-10-11 | machine-drafted, needs native review |
| `tabAll` | so | All petitions | Dhammaan codsiyada | 2026-10-11 | machine-drafted, needs native review |
| `tabAll` | am | All petitions | ሁሉም አቤቱታዎች | 2026-10-11 | machine-drafted, needs native review |
| `tabAll` | hmn | All petitions | Tag nrho cov ntawv thov | 2026-10-11 | machine-drafted, needs native review |
| `tabSigned` | ht | Signed | Sa m siyen yo | 2026-10-11 | machine-drafted, needs native review |
| `tabSigned` | so | Signed | Kuwa la saxiixay | 2026-10-11 | machine-drafted, needs native review |
| `tabSigned` | am | Signed | የተፈረሙ | 2026-10-11 | machine-drafted, needs native review |
| `tabSigned` | hmn | Signed | Cov uas tau kos npe | 2026-10-11 | machine-drafted, needs native review |
| `progressLabel` | ht | Signature progress | Pwogrè siyati yo | 2026-10-11 | machine-drafted, needs native review |
| `progressLabel` | so | Signature progress | Horumarka saxiixyada | 2026-10-11 | machine-drafted, needs native review |
| `progressLabel` | am | Signature progress | የፊርማዎች ሂደት | 2026-10-11 | machine-drafted, needs native review |
| `progressLabel` | hmn | Signature progress | Kev nce qib ntawm cov kos npe | 2026-10-11 | machine-drafted, needs native review |
| `signed` | ht | Signed | Siyen | 2026-10-11 | machine-drafted, needs native review |
| `signed` | so | Signed | Waa la saxiixay | 2026-10-11 | machine-drafted, needs native review |
| `signed` | am | Signed | ተፈርሟል | 2026-10-11 | machine-drafted, needs native review |
| `signed` | hmn | Signed | Tau kos npe lawm | 2026-10-11 | machine-drafted, needs native review |
| `signaturesFinal` | ht | Signatures are final (the list has been exported). | Siyati yo definitif (lis la deja ekspòte). | 2026-10-11 | machine-drafted, needs native review |
| `signaturesFinal` | so | Signatures are final (the list has been exported). | Saxiixyadu waa kama dambays (liiska waa la soo dejiyay). | 2026-10-11 | machine-drafted, needs native review |
| `signaturesFinal` | am | Signatures are final (the list has been exported). | ፊርማዎቹ የመጨረሻ ናቸው (ዝርዝሩ ወጥቷል)። | 2026-10-11 | machine-drafted, needs native review |
| `signaturesFinal` | hmn | Signatures are final (the list has been exported). | Cov kos npe hloov tsis tau lawm (daim npe twb raug rho tawm lawm). | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | ht | Withdraw my signature | Retire siyati mwen | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | so | Withdraw my signature | Ka noqo saxiixayga | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | am | Withdraw my signature | ፊርማዬን አንሳ | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | hmn | Withdraw my signature | Thim kuv qhov kos npe | 2026-10-11 | machine-drafted, needs native review |
| `sign` | ht | Add your verified signature of support | Ajoute siyati verifye pou sipò ou | 2026-10-11 | machine-drafted, needs native review |
| `sign` | so | Add your verified signature of support | Ku dar saxiixaaga taageerada ee la xaqiijiyay | 2026-10-11 | machine-drafted, needs native review |
| `sign` | am | Add your verified signature of support | የተረጋገጠ የድጋፍ ፊርማዎን ያክሉ | 2026-10-11 | machine-drafted, needs native review |
| `sign` | hmn | Add your verified signature of support | Ntxiv koj qhov kos npe txhawb nqa uas tau txheeb xyuas | 2026-10-11 | machine-drafted, needs native review |
| `actionForPetitionAria` | ht | {action}: {title} | {action}: {title} | 2026-10-11 | machine-drafted, needs native review |
| `actionForPetitionAria` | so | {action}: {title} | {action}: {title} | 2026-10-11 | machine-drafted, needs native review |
| `actionForPetitionAria` | am | {action}: {title} | {action}፦ {title} | 2026-10-11 | machine-drafted, needs native review |
| `actionForPetitionAria` | hmn | {action}: {title} | {action}: {title} | 2026-10-11 | machine-drafted, needs native review |
| `signingAs` | ht | Signing as {name} | W ap siyen kòm {name} | 2026-10-11 | machine-drafted, needs native review |
| `signingAs` | so | Signing as {name} | Waxaad u saxiixaysaa magaca {name} | 2026-10-11 | machine-drafted, needs native review |
| `signingAs` | am | Signing as {name} | በ{name} ስም እየፈረሙ ነው | 2026-10-11 | machine-drafted, needs native review |
| `signingAs` | hmn | Signing as {name} | Koj kos npe ua {name} | 2026-10-11 | machine-drafted, needs native review |
| `retentionNotice` | ht | Your name, the date, and a record of this petition version are kept as your verified signature of support. | Non ou, dat la ak yon dosye sou vèsyon petisyon sa a rete kòm siyati verifye pou sipò ou. | 2026-10-11 | machine-drafted, needs native review |
| `retentionNotice` | so | Your name, the date, and a record of this petition version are kept as your verified signature of support. | Magacaaga, taariikhda iyo diiwaanka nuqulkan codsiga waxaa loo kaydiyaa sidii saxiixaaga taageerada ee la xaqiijiyay. | 2026-10-11 | machine-drafted, needs native review |
| `retentionNotice` | am | Your name, the date, and a record of this petition version are kept as your verified signature of support. | ስምዎ፣ ቀኑ እና የዚህ አቤቱታ እትም መዝገብ እንደ የተረጋገጠ የድጋፍ ፊርማዎ ይቀመጣሉ። | 2026-10-11 | machine-drafted, needs native review |
| `retentionNotice` | hmn | Your name, the date, and a record of this petition version are kept as your verified signature of support. | Koj lub npe, hnub tim thiab ib daim ntawv teev txog tsab ntawv thov no raug khaws ua koj qhov kos npe txhawb nqa uas tau txheeb xyuas. | 2026-10-11 | machine-drafted, needs native review |
| `loading` | ht | Loading petitions… | N ap chaje petisyon yo… | 2026-10-11 | machine-drafted, needs native review |
| `loading` | so | Loading petitions… | Codsiyada waa la soo shubayaa… | 2026-10-11 | machine-drafted, needs native review |
| `loading` | am | Loading petitions… | አቤቱታዎች በመጫን ላይ… | 2026-10-11 | machine-drafted, needs native review |
| `loading` | hmn | Loading petitions… | Tab tom thauj cov ntawv thov… | 2026-10-11 | machine-drafted, needs native review |
| `tryAgain` | ht | Try again | Eseye ankò | 2026-10-11 | machine-drafted, needs native review |
| `tryAgain` | so | Try again | Isku day mar kale | 2026-10-11 | machine-drafted, needs native review |
| `tryAgain` | am | Try again | እንደገና ይሞክሩ | 2026-10-11 | machine-drafted, needs native review |
| `tryAgain` | hmn | Try again | Sim dua | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | ht | No active petitions | Pa gen petisyon aktif | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | so | No active petitions | Ma jiraan codsiyo firfircoon | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | am | No active petitions | ንቁ አቤቱታዎች የሉም | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | hmn | No active petitions | Tsis muaj ntawv thov uas tseem qhib | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | ht | Community petitions will appear here when published. | Petisyon kominote a ap parèt isit la lè yo pibliye. | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | so | Community petitions will appear here when published. | Codsiyada bulshadu halkan ayay ka soo muuqan doonaan marka la daabaco. | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | am | Community petitions will appear here when published. | የማኅበረሰብ አቤቱታዎች ሲታተሙ እዚህ ይታያሉ። | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | hmn | Community petitions will appear here when published. | Zej zog cov ntawv thov yuav tshwm ntawm no thaum muab tshaj tawm. | 2026-10-11 | machine-drafted, needs native review |
| `faqToggle` | ht | About petition signatures | Konsènan siyati petisyon yo | 2026-10-11 | machine-drafted, needs native review |
| `faqToggle` | so | About petition signatures | Ku saabsan saxiixyada codsiyada | 2026-10-11 | machine-drafted, needs native review |
| `faqToggle` | am | About petition signatures | ስለ አቤቱታ ፊርማዎች | 2026-10-11 | machine-drafted, needs native review |
| `faqToggle` | hmn | About petition signatures | Hais txog cov kos npe rau ntawv thov | 2026-10-11 | machine-drafted, needs native review |
| `faqPrivacy` | ht | Only administrators can see signers’ names; the public count never reveals who signed. | Se administratè yo sèlman ki ka wè non moun ki siyen yo; kantite piblik la pa janm montre kiyès ki siyen. | 2026-10-11 | machine-drafted, needs native review |
| `faqPrivacy` | so | Only administrators can see signers’ names; the public count never reveals who signed. | Maamulayaasha oo keliya ayaa arki kara magacyada dadka saxiixay; tirada dadweynaha u muuqata weligeed ma muujiso cidda saxiixday. | 2026-10-11 | machine-drafted, needs native review |
| `faqPrivacy` | am | Only administrators can see signers’ names; the public count never reveals who signed. | የፈራሚዎችን ስም ማየት የሚችሉት አስተዳዳሪዎች ብቻ ናቸው፤ ለሕዝብ የሚታየው ቁጥር ማን እንደፈረመ ፈጽሞ አያሳይም። | 2026-10-11 | machine-drafted, needs native review |
| `faqPrivacy` | hmn | Only administrators can see signers’ names; the public count never reveals who signed. | Tsuas yog cov thawj tswj thiaj pom cov neeg kos npe lub npe; tus lej uas pej xeem pom yeej tsis qhia tias leej twg tau kos npe. | 2026-10-11 | machine-drafted, needs native review |
| `faqWithdraw` | ht | You can withdraw your signature anytime — until the organizer exports the signed list, after which signatures become final. | Ou ka retire siyati ou nenpòt lè, jiskaske òganizatè a ekspòte lis siyati yo; apre sa, siyati yo vin definitif. | 2026-10-11 | machine-drafted, needs native review |
| `faqWithdraw` | so | You can withdraw your signature anytime — until the organizer exports the signed list, after which signatures become final. | Waad ka noqon kartaa saxiixaaga wakhti kasta, ilaa qabanqaabiyuhu soo dejiyo liiska saxiixyada; intaas ka dib saxiixyadu waa kama dambays. | 2026-10-11 | machine-drafted, needs native review |
| `faqWithdraw` | am | You can withdraw your signature anytime — until the organizer exports the signed list, after which signatures become final. | አዘጋጁ የፊርማዎችን ዝርዝር እስኪያወጣ ድረስ ፊርማዎን በማንኛውም ጊዜ ማንሳት ይችላሉ፤ ከዚያ በኋላ ፊርማዎች የመጨረሻ ይሆናሉ። | 2026-10-11 | machine-drafted, needs native review |
| `faqWithdraw` | hmn | You can withdraw your signature anytime — until the organizer exports the signed list, after which signatures become final. | Koj thim tau koj qhov kos npe txhua lub sij hawm, mus txog thaum tus neeg npaj rho daim npe kos npe tawm; tom qab ntawd cov kos npe hloov tsis tau lawm. | 2026-10-11 | machine-drafted, needs native review |
| `faqVerified` | ht | “Verified signature of support” means your signature is recorded with a secure timestamp. | « Siyati verifye pou sipò » vle di siyati ou anrejistre ak yon mak tan ki an sekirite. | 2026-10-11 | machine-drafted, needs native review |
| `faqVerified` | so | “Verified signature of support” means your signature is recorded with a secure timestamp. | “Saxiix taageero oo la xaqiijiyay” waxay ka dhigan tahay in saxiixaaga lagu diiwaangeliyo shaabad waqti oo ammaan ah. | 2026-10-11 | machine-drafted, needs native review |
| `faqVerified` | am | “Verified signature of support” means your signature is recorded with a secure timestamp. | “የተረጋገጠ የድጋፍ ፊርማ” ማለት ፊርማዎ ከአስተማማኝ የጊዜ ማህተም ጋር ተመዝግቧል ማለት ነው። | 2026-10-11 | machine-drafted, needs native review |
| `faqVerified` | hmn | “Verified signature of support” means your signature is recorded with a secure timestamp. | “Kos npe txhawb nqa uas tau txheeb xyuas” txhais tias koj qhov kos npe raug sau tseg nrog lub sij hawm uas ruaj ntseg. | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | ht | Create a free account to add your verified signature of support to petitions | Kreye yon kont gratis pou w ajoute siyati verifye pou sipò ou nan petisyon yo | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | so | Create a free account to add your verified signature of support to petitions | Samee akoon bilaash ah si aad codsiyada ugu darto saxiixaaga taageerada ee la xaqiijiyay | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | am | Create a free account to add your verified signature of support to petitions | የተረጋገጠ የድጋፍ ፊርማዎን በአቤቱታዎች ላይ ለማከል ነፃ መለያ ይፍጠሩ | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | hmn | Create a free account to add your verified signature of support to petitions | Tsim ib tus account dawb los ntxiv koj qhov kos npe txhawb nqa uas tau txheeb xyuas rau cov ntawv thov | 2026-10-11 | machine-drafted, needs native review |
| `signInPrompt` | ht | Sign in to add your verified signature of support to any petition. | Konekte pou w ajoute siyati verifye pou sipò ou nan nenpòt petisyon. | 2026-10-11 | machine-drafted, needs native review |
| `signInPrompt` | so | Sign in to add your verified signature of support to any petition. | Soo gal si aad codsi kasta ugu darto saxiixaaga taageerada ee la xaqiijiyay. | 2026-10-11 | machine-drafted, needs native review |
| `signInPrompt` | am | Sign in to add your verified signature of support to any petition. | የተረጋገጠ የድጋፍ ፊርማዎን በማንኛውም አቤቱታ ላይ ለማከል ይግቡ። | 2026-10-11 | machine-drafted, needs native review |
| `signInPrompt` | hmn | Sign in to add your verified signature of support to any petition. | Nkag mus los ntxiv koj qhov kos npe txhawb nqa uas tau txheeb xyuas rau txhua daim ntawv thov. | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyTitle` | ht | No signed petitions yet | Ou poko siyen okenn petisyon | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyTitle` | so | No signed petitions yet | Weli ma saxiixin wax codsi ah | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyTitle` | am | No signed petitions yet | እስካሁን የፈረሙት አቤቱታ የለም | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyTitle` | hmn | No signed petitions yet | Koj tseem tsis tau kos npe rau ib daim ntawv thov | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyBody` | ht | Petitions you sign will appear here. | Petisyon ou siyen yo ap parèt isit la. | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyBody` | so | Petitions you sign will appear here. | Codsiyada aad saxiixdo halkan ayay ka soo muuqan doonaan. | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyBody` | am | Petitions you sign will appear here. | የሚፈርሟቸው አቤቱታዎች እዚህ ይታያሉ። | 2026-10-11 | machine-drafted, needs native review |
| `signedEmptyBody` | hmn | Petitions you sign will appear here. | Cov ntawv thov uas koj kos npe yuav tshwm ntawm no. | 2026-10-11 | machine-drafted, needs native review |
| `errLoadFailed` | ht | Unable to load petitions. Please try again. | Nou pa kapab chaje petisyon yo. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errLoadFailed` | so | Unable to load petitions. Please try again. | Lama soo shubi karo codsiyada. Fadlan isku day mar kale. | 2026-10-11 | machine-drafted, needs native review |
| `errLoadFailed` | am | Unable to load petitions. Please try again. | አቤቱታዎችን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errLoadFailed` | hmn | Unable to load petitions. Please try again. | Thauj tsis tau cov ntawv thov. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errSignFailed` | ht | Unable to add your signature. Please try again. | Nou pa kapab ajoute siyati ou. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errSignFailed` | so | Unable to add your signature. Please try again. | Lama dari karo saxiixaaga. Fadlan isku day mar kale. | 2026-10-11 | machine-drafted, needs native review |
| `errSignFailed` | am | Unable to add your signature. Please try again. | ፊርማዎን ማከል አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errSignFailed` | hmn | Unable to add your signature. Please try again. | Ntxiv tsis tau koj qhov kos npe. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | ht | Sign in with an account to add your verified signature of support. | Konekte ak yon kont pou w ajoute siyati verifye pou sipò ou. | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | so | Sign in with an account to add your verified signature of support. | Ku soo gal akoon si aad ugu darto saxiixaaga taageerada ee la xaqiijiyay. | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | am | Sign in with an account to add your verified signature of support. | የተረጋገጠ የድጋፍ ፊርማዎን ለማከል በመለያ ይግቡ። | 2026-10-11 | machine-drafted, needs native review |
| `errAccountRequired` | hmn | Sign in with an account to add your verified signature of support. | Nkag mus nrog ib tus account los ntxiv koj qhov kos npe txhawb nqa uas tau txheeb xyuas. | 2026-10-11 | machine-drafted, needs native review |
| `errAffirmationRequired` | ht | You must affirm to add your verified signature of support. | Ou dwe konfime pou w ajoute siyati verifye pou sipò ou. | 2026-10-11 | machine-drafted, needs native review |
| `errAffirmationRequired` | so | You must affirm to add your verified signature of support. | Waa inaad xaqiijisaa si aad ugu darto saxiixaaga taageerada ee la xaqiijiyay. | 2026-10-11 | machine-drafted, needs native review |
| `errAffirmationRequired` | am | You must affirm to add your verified signature of support. | የተረጋገጠ የድጋፍ ፊርማዎን ለማከል ማረጋገጥ አለብዎት። | 2026-10-11 | machine-drafted, needs native review |
| `errAffirmationRequired` | hmn | You must affirm to add your verified signature of support. | Koj yuav tsum lees paub thiaj ntxiv tau koj qhov kos npe txhawb nqa uas tau txheeb xyuas. | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawLocked` | ht | Signatures are final — the organizer has exported this list. | Siyati yo definitif: òganizatè a deja ekspòte lis sa a. | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawLocked` | so | Signatures are final — the organizer has exported this list. | Saxiixyadu waa kama dambays: qabanqaabiyuhu wuu soo dejiyay liiskan. | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawLocked` | am | Signatures are final — the organizer has exported this list. | ፊርማዎቹ የመጨረሻ ናቸው፦ አዘጋጁ ይህን ዝርዝር አውጥቷል። | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawLocked` | hmn | Signatures are final — the organizer has exported this list. | Cov kos npe hloov tsis tau lawm: tus neeg npaj twb rho daim npe no tawm lawm. | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawFailed` | ht | Unable to withdraw your signature. Please try again. | Nou pa kapab retire siyati ou. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawFailed` | so | Unable to withdraw your signature. Please try again. | Lagama noqon karo saxiixaaga. Fadlan isku day mar kale. | 2026-10-11 | machine-drafted, needs native review |
| `errWithdrawFailed` | am | Unable to withdraw your signature. Please try again. | ፊርማዎን ማንሳት አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
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
