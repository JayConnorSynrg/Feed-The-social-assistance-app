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

### `lib/i18n-feed-messages.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `guestPrompt` | ht | Create a free account to message volunteers and connect with your community | Kreye yon kont gratis pou w voye mesaj bay volontè yo epi konekte ak kominote w la | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | so | Create a free account to message volunteers and connect with your community | Samee akoon bilaash ah si aad fariin ugu dirto tabaruceyaasha oo aad ula xiriirto bulshadaada | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | am | Create a free account to message volunteers and connect with your community | ለበጎ ፈቃደኞች መልዕክት ለመላክ እና ከማኅበረሰብዎ ጋር ለመገናኘት ነፃ መለያ ይፍጠሩ | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | hmn | Create a free account to message volunteers and connect with your community | Tsim ib tus account dawb los xa lus rau cov neeg pab dawb thiab txuas nrog koj lub zej zog | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | ht | No messages yet | Poko gen mesaj | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | so | No messages yet | Weli fariimo ma jiraan | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | am | No messages yet | እስካሁን ምንም መልዕክት የለም | 2026-10-11 | machine-drafted, needs native review |
| `emptyTitle` | hmn | No messages yet | Tseem tsis tau muaj lus | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | ht | Volunteer resources on the map have a Message button. Send a request to start a conversation. | Resous volontè yo sou kat la gen yon bouton Mesaj. Voye yon demann pou kòmanse yon konvèsasyon. | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | so | Volunteer resources on the map have a Message button. Send a request to start a conversation. | Agabka tabaruceyaasha ee khariidadda ku yaal waxay leeyihiin badhan Fariin ah. Dir codsi si aad wada hadal u bilowdo. | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | am | Volunteer resources on the map have a Message button. Send a request to start a conversation. | በካርታው ላይ ያሉ የበጎ ፈቃደኞች ግብዓቶች የመልዕክት አዝራር አላቸው። ውይይት ለመጀመር ጥያቄ ይላኩ። | 2026-10-11 | machine-drafted, needs native review |
| `emptyBody` | hmn | Volunteer resources on the map have a Message button. Send a request to start a conversation. | Cov neeg pab dawb li kev pab hauv daim ntawv qhia chaw muaj ib lub khawm Xa Lus. Xa ib qho kev thov los pib sib tham. | 2026-10-11 | machine-drafted, needs native review |
| `title` | ht | Messages | Mesaj | 2026-10-11 | machine-drafted, needs native review |
| `title` | so | Messages | Fariimo | 2026-10-11 | machine-drafted, needs native review |
| `title` | am | Messages | መልዕክቶች | 2026-10-11 | machine-drafted, needs native review |
| `title` | hmn | Messages | Cov lus | 2026-10-11 | machine-drafted, needs native review |
| `sectionPending` | ht | Pending Requests ({n}) | Demann k ap tann ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionPending` | so | Pending Requests ({n}) | Codsiyo sugaya ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionPending` | am | Pending Requests ({n}) | በመጠባበቅ ላይ ያሉ ጥያቄዎች ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionPending` | hmn | Pending Requests ({n}) | Cov kev thov uas tos ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionActive` | ht | Active ({n}) | Aktif ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionActive` | so | Active ({n}) | Firfircoon ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionActive` | am | Active ({n}) | ንቁ ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionActive` | hmn | Active ({n}) | Tab tom sib tham ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionCompleted` | ht | Completed ({n}) | Fini ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionCompleted` | so | Completed ({n}) | La dhammeeyay ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionCompleted` | am | Completed ({n}) | የተጠናቀቁ ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionCompleted` | hmn | Completed ({n}) | Tiav lawm ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionHistory` | ht | History ({n}) | Istwa ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionHistory` | so | History ({n}) | Taariikh ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionHistory` | am | History ({n}) | ታሪክ ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `sectionHistory` | hmn | History ({n}) | Keeb kwm ({n}) | 2026-10-11 | machine-drafted, needs native review |
| `backToList` | ht | Back to conversations | Tounen nan konvèsasyon yo | 2026-10-11 | machine-drafted, needs native review |
| `backToList` | so | Back to conversations | Ku noqo wada hadallada | 2026-10-11 | machine-drafted, needs native review |
| `backToList` | am | Back to conversations | ወደ ውይይቶች ተመለስ | 2026-10-11 | machine-drafted, needs native review |
| `backToList` | hmn | Back to conversations | Rov qab mus rau cov kev sib tham | 2026-10-11 | machine-drafted, needs native review |
| `unknownUser` | ht | User | Itilizatè | 2026-10-11 | machine-drafted, needs native review |
| `unknownUser` | so | User | Isticmaale | 2026-10-11 | machine-drafted, needs native review |
| `unknownUser` | am | User | ተጠቃሚ | 2026-10-11 | machine-drafted, needs native review |
| `unknownUser` | hmn | User | Tus neeg siv | 2026-10-11 | machine-drafted, needs native review |
| `statusPending` | ht | pending | ap tann | 2026-10-11 | machine-drafted, needs native review |
| `statusPending` | so | pending | sugaya | 2026-10-11 | machine-drafted, needs native review |
| `statusPending` | am | pending | በመጠባበቅ ላይ | 2026-10-11 | machine-drafted, needs native review |
| `statusPending` | hmn | pending | tos | 2026-10-11 | machine-drafted, needs native review |
| `statusActive` | ht | active | aktif | 2026-10-11 | machine-drafted, needs native review |
| `statusActive` | so | active | firfircoon | 2026-10-11 | machine-drafted, needs native review |
| `statusActive` | am | active | ንቁ | 2026-10-11 | machine-drafted, needs native review |
| `statusActive` | hmn | active | tab tom sib tham | 2026-10-11 | machine-drafted, needs native review |
| `statusCompleted` | ht | completed | fini | 2026-10-11 | machine-drafted, needs native review |
| `statusCompleted` | so | completed | la dhammeeyay | 2026-10-11 | machine-drafted, needs native review |
| `statusCompleted` | am | completed | ተጠናቋል | 2026-10-11 | machine-drafted, needs native review |
| `statusCompleted` | hmn | completed | tiav lawm | 2026-10-11 | machine-drafted, needs native review |
| `statusDeclined` | ht | declined | refize | 2026-10-11 | machine-drafted, needs native review |
| `statusDeclined` | so | declined | la diiday | 2026-10-11 | machine-drafted, needs native review |
| `statusDeclined` | am | declined | ተቀባይነት አላገኘም | 2026-10-11 | machine-drafted, needs native review |
| `statusDeclined` | hmn | declined | tsis kam txais | 2026-10-11 | machine-drafted, needs native review |
| `statusCancelled` | ht | cancelled | anile | 2026-10-11 | machine-drafted, needs native review |
| `statusCancelled` | so | cancelled | la joojiyay | 2026-10-11 | machine-drafted, needs native review |
| `statusCancelled` | am | cancelled | ተሰርዟል | 2026-10-11 | machine-drafted, needs native review |
| `statusCancelled` | hmn | cancelled | raug tshem | 2026-10-11 | machine-drafted, needs native review |
| `accept` | ht | Accept | Aksepte | 2026-10-11 | machine-drafted, needs native review |
| `accept` | so | Accept | Aqbal | 2026-10-11 | machine-drafted, needs native review |
| `accept` | am | Accept | ተቀበል | 2026-10-11 | machine-drafted, needs native review |
| `accept` | hmn | Accept | Txais | 2026-10-11 | machine-drafted, needs native review |
| `decline` | ht | Decline | Refize | 2026-10-11 | machine-drafted, needs native review |
| `decline` | so | Decline | Diid | 2026-10-11 | machine-drafted, needs native review |
| `decline` | am | Decline | አትቀበል | 2026-10-11 | machine-drafted, needs native review |
| `decline` | hmn | Decline | Tsis kam | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | ht | Withdraw | Retire | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | so | Withdraw | Ka noqo | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | am | Withdraw | አንሳ | 2026-10-11 | machine-drafted, needs native review |
| `withdraw` | hmn | Withdraw | Thim | 2026-10-11 | machine-drafted, needs native review |
| `endAndReview` | ht | End & review | Fini epi evalye | 2026-10-11 | machine-drafted, needs native review |
| `endAndReview` | so | End & review | Dhammee oo qiimee | 2026-10-11 | machine-drafted, needs native review |
| `endAndReview` | am | End & review | ጨርስ እና ገምግም | 2026-10-11 | machine-drafted, needs native review |
| `endAndReview` | hmn | End & review | Xaus thiab ntsuam xyuas | 2026-10-11 | machine-drafted, needs native review |
| `waitingForAccept` | ht | Waiting for {name} to accept your request... | N ap tann {name} aksepte demann ou an... | 2026-10-11 | machine-drafted, needs native review |
| `waitingForAccept` | so | Waiting for {name} to accept your request... | Waxaa la sugayaa in {name} aqbalo codsigaaga... | 2026-10-11 | machine-drafted, needs native review |
| `waitingForAccept` | am | Waiting for {name} to accept your request... | {name} ጥያቄዎን እስኪቀበሉ በመጠባበቅ ላይ... | 2026-10-11 | machine-drafted, needs native review |
| `waitingForAccept` | hmn | Waiting for {name} to accept your request... | Tab tom tos {name} txais koj qhov kev thov... | 2026-10-11 | machine-drafted, needs native review |
| `inputPlaceholder` | ht | Type a message... | Ekri yon mesaj... | 2026-10-11 | machine-drafted, needs native review |
| `inputPlaceholder` | so | Type a message... | Qor fariin... | 2026-10-11 | machine-drafted, needs native review |
| `inputPlaceholder` | am | Type a message... | መልዕክት ይጻፉ... | 2026-10-11 | machine-drafted, needs native review |
| `inputPlaceholder` | hmn | Type a message... | Ntaus ib cov lus... | 2026-10-11 | machine-drafted, needs native review |
| `send` | ht | Send message | Voye mesaj | 2026-10-11 | machine-drafted, needs native review |
| `send` | so | Send message | Dir fariinta | 2026-10-11 | machine-drafted, needs native review |
| `send` | am | Send message | መልዕክት ላክ | 2026-10-11 | machine-drafted, needs native review |
| `send` | hmn | Send message | Xa cov lus | 2026-10-11 | machine-drafted, needs native review |
| `reviewSubmitted` | ht | Your review was submitted | Evalyasyon ou an voye | 2026-10-11 | machine-drafted, needs native review |
| `reviewSubmitted` | so | Your review was submitted | Qiimayntaada waa la diray | 2026-10-11 | machine-drafted, needs native review |
| `reviewSubmitted` | am | Your review was submitted | ግምገማዎ ተልኳል | 2026-10-11 | machine-drafted, needs native review |
| `reviewSubmitted` | hmn | Your review was submitted | Koj qhov kev ntsuam xyuas raug xa lawm | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptTitle` | ht | How did it go? | Kijan sa te pase? | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptTitle` | so | How did it go? | Sidee bay u dhacday? | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptTitle` | am | How did it go? | እንዴት ነበር? | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptTitle` | hmn | How did it go? | Nws mus li cas? | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptBody` | ht | Leave a review for {name} | Kite yon evalyasyon pou {name} | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptBody` | so | Leave a review for {name} | U reeb qiimayn {name} | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptBody` | am | Leave a review for {name} | ለ{name} ግምገማ ይተዉ | 2026-10-11 | machine-drafted, needs native review |
| `reviewPromptBody` | hmn | Leave a review for {name} | Tso ib qho kev ntsuam xyuas rau {name} | 2026-10-11 | machine-drafted, needs native review |
| `rateExperience` | ht | Rate your experience | Evalye eksperyans ou | 2026-10-11 | machine-drafted, needs native review |
| `rateExperience` | so | Rate your experience | Qiimee waayo-aragnimadaada | 2026-10-11 | machine-drafted, needs native review |
| `rateExperience` | am | Rate your experience | ተሞክሮዎን ይገምግሙ | 2026-10-11 | machine-drafted, needs native review |
| `rateExperience` | hmn | Rate your experience | Ntsuam xyuas koj qhov kev paub dhau los | 2026-10-11 | machine-drafted, needs native review |
| `selectConversation` | ht | Select a conversation to view messages | Chwazi yon konvèsasyon pou w wè mesaj yo | 2026-10-11 | machine-drafted, needs native review |
| `selectConversation` | so | Select a conversation to view messages | Dooro wada hadal si aad u aragto fariimaha | 2026-10-11 | machine-drafted, needs native review |
| `selectConversation` | am | Select a conversation to view messages | መልዕክቶችን ለማየት ውይይት ይምረጡ | 2026-10-11 | machine-drafted, needs native review |
| `selectConversation` | hmn | Select a conversation to view messages | Xaiv ib qho kev sib tham los saib cov lus | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineTitle` | ht | Decline this request? | Refize demann sa a? | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineTitle` | so | Decline this request? | Ma diidaysaa codsigan? | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineTitle` | am | Decline this request? | ይህን ጥያቄ አይቀበሉም? | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineTitle` | hmn | Decline this request? | Tsis kam txais qhov kev thov no? | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawTitle` | ht | Withdraw your request? | Retire demann ou an? | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawTitle` | so | Withdraw your request? | Ma ka noqonaysaa codsigaaga? | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawTitle` | am | Withdraw your request? | ጥያቄዎን ያነሳሉ? | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawTitle` | hmn | Withdraw your request? | Thim koj qhov kev thov? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelTitle` | ht | End this conversation? | Fini konvèsasyon sa a? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelTitle` | so | End this conversation? | Ma dhammaynaysaa wada hadalkan? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelTitle` | am | End this conversation? | ይህን ውይይት ያቆማሉ? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelTitle` | hmn | End this conversation? | Xaus qhov kev sib tham no? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteTitle` | ht | End conversation? | Fini konvèsasyon an? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteTitle` | so | End conversation? | Ma dhammaynaysaa wada hadalka? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteTitle` | am | End conversation? | ውይይቱን ይጨርሳሉ? | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteTitle` | hmn | End conversation? | Xaus kev sib tham? | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineBody` | ht | The requester will be notified that their request was declined. | Moun ki fè demann lan ap resevwa yon avi ke demann li an refize. | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineBody` | so | The requester will be notified that their request was declined. | Qofka codsaday waxaa lagu wargelin doonaa in codsigiisa la diiday. | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineBody` | am | The requester will be notified that their request was declined. | ጠያቂው ጥያቄው ተቀባይነት እንዳላገኘ ማሳወቂያ ይደርሰዋል። | 2026-10-11 | machine-drafted, needs native review |
| `confirmDeclineBody` | hmn | The requester will be notified that their request was declined. | Tus neeg thov yuav tau txais kev ceeb toom tias nws qhov kev thov tsis raug txais. | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawBody` | ht | Your request will be cancelled and cannot be recovered. | Demann ou an ap anile epi ou pa p ka jwenn li ankò. | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawBody` | so | Your request will be cancelled and cannot be recovered. | Codsigaaga waa la joojin doonaa lamana soo celin karo. | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawBody` | am | Your request will be cancelled and cannot be recovered. | ጥያቄዎ ይሰረዛል፤ መልሶ ማግኘትም አይቻልም። | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdrawBody` | hmn | Your request will be cancelled and cannot be recovered. | Koj qhov kev thov yuav raug tshem thiab muab rov qab tsis tau. | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelBody` | ht | This conversation will be closed and cannot be reopened. | Konvèsasyon sa a ap fèmen epi li pa p ka relouvri. | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelBody` | so | This conversation will be closed and cannot be reopened. | Wada hadalkan waa la xiri doonaa dibna looma furi karo. | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelBody` | am | This conversation will be closed and cannot be reopened. | ይህ ውይይት ይዘጋል፤ እንደገና መክፈትም አይቻልም። | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancelBody` | hmn | This conversation will be closed and cannot be reopened. | Qhov kev sib tham no yuav raug kaw thiab qhib dua tsis tau. | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteBody` | ht | Both of you will be able to leave a review once the conversation is marked complete. | Nou toulède ap ka kite yon evalyasyon lè konvèsasyon an make kòm fini. | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteBody` | so | Both of you will be able to leave a review once the conversation is marked complete. | Labadiinuba waxaad reebi kartaan qiimayn marka wada hadalka lagu calaamadiyo inuu dhammaaday. | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteBody` | am | Both of you will be able to leave a review once the conversation is marked complete. | ውይይቱ እንደተጠናቀቀ ከተመዘገበ በኋላ ሁለታችሁም ግምገማ መተው ትችላላችሁ። | 2026-10-11 | machine-drafted, needs native review |
| `confirmCompleteBody` | hmn | Both of you will be able to leave a review once the conversation is marked complete. | Neb ob leeg puav leej tso tau kev ntsuam xyuas thaum qhov kev sib tham raug cim tias tiav lawm. | 2026-10-11 | machine-drafted, needs native review |
| `keepChatting` | ht | Keep chatting | Kontinye pale | 2026-10-11 | machine-drafted, needs native review |
| `keepChatting` | so | Keep chatting | Sii wad wada hadalka | 2026-10-11 | machine-drafted, needs native review |
| `keepChatting` | am | Keep chatting | ውይይቱን ቀጥል | 2026-10-11 | machine-drafted, needs native review |
| `keepChatting` | hmn | Keep chatting | Sib tham ntxiv | 2026-10-11 | machine-drafted, needs native review |
| `confirmDecline` | ht | Decline Request | Refize demann lan | 2026-10-11 | machine-drafted, needs native review |
| `confirmDecline` | so | Decline Request | Diid codsiga | 2026-10-11 | machine-drafted, needs native review |
| `confirmDecline` | am | Decline Request | ጥያቄውን አትቀበል | 2026-10-11 | machine-drafted, needs native review |
| `confirmDecline` | hmn | Decline Request | Tsis kam txais kev thov | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdraw` | ht | Withdraw Request | Retire demann lan | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdraw` | so | Withdraw Request | Ka noqo codsiga | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdraw` | am | Withdraw Request | ጥያቄውን አንሳ | 2026-10-11 | machine-drafted, needs native review |
| `confirmWithdraw` | hmn | Withdraw Request | Thim kev thov | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancel` | ht | End Conversation | Fini konvèsasyon an | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancel` | so | End Conversation | Dhammee wada hadalka | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancel` | am | End Conversation | ውይይቱን አቁም | 2026-10-11 | machine-drafted, needs native review |
| `confirmCancel` | hmn | End Conversation | Xaus kev sib tham | 2026-10-11 | machine-drafted, needs native review |
| `errTimeout` | ht | Messages timed out — please check your connection and retry. | Mesaj yo pran twòp tan. Tanpri tcheke koneksyon ou epi eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `errTimeout` | so | Messages timed out — please check your connection and retry. | Fariimuhu waqti badan bay qaateen. Fadlan hubi xiriirkaaga oo isku day mar kale. | 2026-10-11 | machine-drafted, needs native review |
| `errTimeout` | am | Messages timed out — please check your connection and retry. | መልዕክቶቹ በጣም ዘግይተዋል። እባክዎ ግንኙነትዎን ያረጋግጡና እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errTimeout` | hmn | Messages timed out — please check your connection and retry. | Cov lus siv sij hawm ntev dhau. Thov xyuas koj txoj kev sib txuas thiab sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `errLoadConversations` | ht | Failed to fetch conversations | Nou pa t kapab chaje konvèsasyon yo | 2026-10-11 | machine-drafted, needs native review |
| `errLoadConversations` | so | Failed to fetch conversations | Lama soo shubi karin wada hadallada | 2026-10-11 | machine-drafted, needs native review |
| `errLoadConversations` | am | Failed to fetch conversations | ውይይቶችን መጫን አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errLoadConversations` | hmn | Failed to fetch conversations | Thauj tsis tau cov kev sib tham | 2026-10-11 | machine-drafted, needs native review |
| `errLoadMessages` | ht | Failed to fetch messages | Nou pa t kapab chaje mesaj yo | 2026-10-11 | machine-drafted, needs native review |
| `errLoadMessages` | so | Failed to fetch messages | Lama soo shubi karin fariimaha | 2026-10-11 | machine-drafted, needs native review |
| `errLoadMessages` | am | Failed to fetch messages | መልዕክቶችን መጫን አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errLoadMessages` | hmn | Failed to fetch messages | Thauj tsis tau cov lus | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToRequest` | ht | Please sign in to send a request | Tanpri konekte pou w voye yon demann | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToRequest` | so | Please sign in to send a request | Fadlan soo gal si aad codsi u dirto | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToRequest` | am | Please sign in to send a request | ጥያቄ ለመላክ እባክዎ ይግቡ | 2026-10-11 | machine-drafted, needs native review |
| `errSignInToRequest` | hmn | Please sign in to send a request | Thov nkag mus los xa ib qho kev thov | 2026-10-11 | machine-drafted, needs native review |
| `errPendingExists` | ht | This volunteer already has a pending request. Please try again later. | Volontè sa a gen yon demann k ap tann deja. Tanpri eseye pita. | 2026-10-11 | machine-drafted, needs native review |
| `errPendingExists` | so | This volunteer already has a pending request. Please try again later. | Tabaruc-hahan mar hore ayuu leeyahay codsi sugaya. Fadlan isku day goor dambe. | 2026-10-11 | machine-drafted, needs native review |
| `errPendingExists` | am | This volunteer already has a pending request. Please try again later. | ይህ በጎ ፈቃደኛ አስቀድሞ በመጠባበቅ ላይ ያለ ጥያቄ አለው። እባክዎ ቆይተው እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `errPendingExists` | hmn | This volunteer already has a pending request. Please try again later. | Tus neeg pab dawb no twb muaj ib qho kev thov uas tos lawm. Thov sim dua tom qab. | 2026-10-11 | machine-drafted, needs native review |
| `errNotAccepting` | ht | This member isn't accepting new messages right now. | Manm sa a pa aksepte nouvo mesaj kounye a. | 2026-10-11 | machine-drafted, needs native review |
| `errNotAccepting` | so | This member isn't accepting new messages right now. | Xubintani hadda ma aqbalayso fariimo cusub. | 2026-10-11 | machine-drafted, needs native review |
| `errNotAccepting` | am | This member isn't accepting new messages right now. | ይህ አባል አሁን አዲስ መልዕክቶችን አይቀበልም። | 2026-10-11 | machine-drafted, needs native review |
| `errNotAccepting` | hmn | This member isn't accepting new messages right now. | Tus tswv cuab no tsis txais lus tshiab tam sim no. | 2026-10-11 | machine-drafted, needs native review |
| `errSendRequest` | ht | Failed to send request | Nou pa t kapab voye demann lan | 2026-10-11 | machine-drafted, needs native review |
| `errSendRequest` | so | Failed to send request | Lama diri karin codsiga | 2026-10-11 | machine-drafted, needs native review |
| `errSendRequest` | am | Failed to send request | ጥያቄውን መላክ አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errSendRequest` | hmn | Failed to send request | Xa tsis tau qhov kev thov | 2026-10-11 | machine-drafted, needs native review |
| `errAccept` | ht | Failed to accept request | Nou pa t kapab aksepte demann lan | 2026-10-11 | machine-drafted, needs native review |
| `errAccept` | so | Failed to accept request | Lama aqbali karin codsiga | 2026-10-11 | machine-drafted, needs native review |
| `errAccept` | am | Failed to accept request | ጥያቄውን መቀበል አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errAccept` | hmn | Failed to accept request | Txais tsis tau qhov kev thov | 2026-10-11 | machine-drafted, needs native review |
| `errDecline` | ht | Failed to decline request | Nou pa t kapab refize demann lan | 2026-10-11 | machine-drafted, needs native review |
| `errDecline` | so | Failed to decline request | Lama diidi karin codsiga | 2026-10-11 | machine-drafted, needs native review |
| `errDecline` | am | Failed to decline request | ጥያቄውን አለመቀበል አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errDecline` | hmn | Failed to decline request | Tsis kam tsis tau qhov kev thov | 2026-10-11 | machine-drafted, needs native review |
| `errCancel` | ht | Failed to cancel conversation | Nou pa t kapab anile konvèsasyon an | 2026-10-11 | machine-drafted, needs native review |
| `errCancel` | so | Failed to cancel conversation | Lama joojin karin wada hadalka | 2026-10-11 | machine-drafted, needs native review |
| `errCancel` | am | Failed to cancel conversation | ውይይቱን መሰረዝ አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errCancel` | hmn | Failed to cancel conversation | Tshem tsis tau qhov kev sib tham | 2026-10-11 | machine-drafted, needs native review |
| `errComplete` | ht | Failed to complete conversation | Nou pa t kapab fini konvèsasyon an | 2026-10-11 | machine-drafted, needs native review |
| `errComplete` | so | Failed to complete conversation | Lama dhammayn karin wada hadalka | 2026-10-11 | machine-drafted, needs native review |
| `errComplete` | am | Failed to complete conversation | ውይይቱን ማጠናቀቅ አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errComplete` | hmn | Failed to complete conversation | Ua tsis tau kom qhov kev sib tham tiav | 2026-10-11 | machine-drafted, needs native review |
| `errWithdraw` | ht | Failed to withdraw request | Nou pa t kapab retire demann lan | 2026-10-11 | machine-drafted, needs native review |
| `errWithdraw` | so | Failed to withdraw request | Lagama noqon karin codsiga | 2026-10-11 | machine-drafted, needs native review |
| `errWithdraw` | am | Failed to withdraw request | ጥያቄውን ማንሳት አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errWithdraw` | hmn | Failed to withdraw request | Thim tsis tau qhov kev thov | 2026-10-11 | machine-drafted, needs native review |
| `errNoConversation` | ht | No conversation selected | Pa gen konvèsasyon ki chwazi | 2026-10-11 | machine-drafted, needs native review |
| `errNoConversation` | so | No conversation selected | Wada hadal lama dooran | 2026-10-11 | machine-drafted, needs native review |
| `errNoConversation` | am | No conversation selected | ምንም ውይይት አልተመረጠም | 2026-10-11 | machine-drafted, needs native review |
| `errNoConversation` | hmn | No conversation selected | Tsis tau xaiv kev sib tham | 2026-10-11 | machine-drafted, needs native review |
| `errSendMessage` | ht | Failed to send message | Nou pa t kapab voye mesaj la | 2026-10-11 | machine-drafted, needs native review |
| `errSendMessage` | so | Failed to send message | Lama diri karin fariinta | 2026-10-11 | machine-drafted, needs native review |
| `errSendMessage` | am | Failed to send message | መልዕክቱን መላክ አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errSendMessage` | hmn | Failed to send message | Xa tsis tau cov lus | 2026-10-11 | machine-drafted, needs native review |
| `errMarkRead` | ht | Failed to mark messages as read | Nou pa t kapab make mesaj yo kòm li | 2026-10-11 | machine-drafted, needs native review |
| `errMarkRead` | so | Failed to mark messages as read | Fariimaha laguma calaamadin karin in la akhriyay | 2026-10-11 | machine-drafted, needs native review |
| `errMarkRead` | am | Failed to mark messages as read | መልዕክቶቹን እንደተነበቡ ምልክት ማድረግ አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `errMarkRead` | hmn | Failed to mark messages as read | Cim tsis tau tias cov lus raug nyeem lawm | 2026-10-11 | machine-drafted, needs native review |

### `lib/i18n-feed-businesses.ts`

| Key | Locale | English | Text | Added | Status |
|---|---|---|---|---|---|
| `title` | ht | Local Businesses | Biznis lokal yo | 2026-10-11 | machine-drafted, needs native review |
| `title` | so | Local Businesses | Ganacsiyada deegaanka | 2026-10-11 | machine-drafted, needs native review |
| `title` | am | Local Businesses | የአካባቢ ንግዶች | 2026-10-11 | machine-drafted, needs native review |
| `title` | hmn | Local Businesses | Cov lag luam hauv zos | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | ht | Community-submitted local businesses near you | Biznis lokal toupre w, kominote a ajoute | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | so | Community-submitted local businesses near you | Ganacsiyo deegaanka ah oo kuu dhow oo ay bulshadu soo gudbisay | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | am | Community-submitted local businesses near you | ማኅበረሰቡ ያስገባቸው በአቅራቢያዎ ያሉ የአካባቢ ንግዶች | 2026-10-11 | machine-drafted, needs native review |
| `subtitle` | hmn | Community-submitted local businesses near you | Cov lag luam hauv zos nyob ze koj uas zej zog tau xa tuaj | 2026-10-11 | machine-drafted, needs native review |
| `addBusiness` | ht | Add a local business | Ajoute yon biznis lokal | 2026-10-11 | machine-drafted, needs native review |
| `addBusiness` | so | Add a local business | Ku dar ganacsi deegaanka ah | 2026-10-11 | machine-drafted, needs native review |
| `addBusiness` | am | Add a local business | የአካባቢ ንግድ አክል | 2026-10-11 | machine-drafted, needs native review |
| `addBusiness` | hmn | Add a local business | Ntxiv ib lub lag luam hauv zos | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | ht | Create a free account to add a local business to the map | Kreye yon kont gratis pou w ajoute yon biznis lokal sou kat la | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | so | Create a free account to add a local business to the map | Samee akoon bilaash ah si aad khariidadda ugu darto ganacsi deegaanka ah | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | am | Create a free account to add a local business to the map | የአካባቢ ንግድን በካርታው ላይ ለማከል ነፃ መለያ ይፍጠሩ | 2026-10-11 | machine-drafted, needs native review |
| `guestPrompt` | hmn | Create a free account to add a local business to the map | Tsim ib tus account dawb los ntxiv ib lub lag luam hauv zos rau daim ntawv qhia chaw | 2026-10-11 | machine-drafted, needs native review |
| `formLabel` | ht | Submit a local business | Soumèt yon biznis lokal | 2026-10-11 | machine-drafted, needs native review |
| `formLabel` | so | Submit a local business | Soo gudbi ganacsi deegaanka ah | 2026-10-11 | machine-drafted, needs native review |
| `formLabel` | am | Submit a local business | የአካባቢ ንግድ አስገባ | 2026-10-11 | machine-drafted, needs native review |
| `formLabel` | hmn | Submit a local business | Xa ib lub lag luam hauv zos | 2026-10-11 | machine-drafted, needs native review |
| `submitError` | ht | Could not submit: {message}. Please try again. | Nou pa t kapab soumèt li: {message}. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `submitError` | so | Could not submit: {message}. Please try again. | Lama gudbin karin: {message}. Fadlan isku day mar kale. | 2026-10-11 | machine-drafted, needs native review |
| `submitError` | am | Could not submit: {message}. Please try again. | ማስገባት አልተቻለም፦ {message}። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `submitError` | hmn | Could not submit: {message}. Please try again. | Xa tsis tau: {message}. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `submitFailed` | ht | Could not submit. Please try again. | Nou pa t kapab soumèt li. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `submitFailed` | so | Could not submit. Please try again. | Lama gudbin karin. Fadlan isku day mar kale. | 2026-10-11 | machine-drafted, needs native review |
| `submitFailed` | am | Could not submit. Please try again. | ማስገባት አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `submitFailed` | hmn | Could not submit. Please try again. | Xa tsis tau. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |
| `submittedTitle` | ht | Submitted for review | Soumèt pou revizyon | 2026-10-11 | machine-drafted, needs native review |
| `submittedTitle` | so | Submitted for review | Waxaa loo gudbiyay dib-u-eegis | 2026-10-11 | machine-drafted, needs native review |
| `submittedTitle` | am | Submitted for review | ለግምገማ ገብቷል | 2026-10-11 | machine-drafted, needs native review |
| `submittedTitle` | hmn | Submitted for review | Xa mus tshuaj xyuas lawm | 2026-10-11 | machine-drafted, needs native review |
| `submittedBody` | ht | Your business is pending review. A resource admin will approve it before it appears on the map. | Biznis ou an ap tann revizyon. Yon administratè resous ap apwouve l anvan li parèt sou kat la. | 2026-10-11 | machine-drafted, needs native review |
| `submittedBody` | so | Your business is pending review. A resource admin will approve it before it appears on the map. | Ganacsigaagu wuxuu sugayaa dib-u-eegis. Maamule agabka ayaa ansixin doona ka hor inta uusan khariidadda ka soo muuqan. | 2026-10-11 | machine-drafted, needs native review |
| `submittedBody` | am | Your business is pending review. A resource admin will approve it before it appears on the map. | ንግድዎ ግምገማ በመጠባበቅ ላይ ነው። በካርታው ላይ ከመታየቱ በፊት የግብዓት አስተዳዳሪ ያጸድቀዋል። | 2026-10-11 | machine-drafted, needs native review |
| `submittedBody` | hmn | Your business is pending review. A resource admin will approve it before it appears on the map. | Koj lub lag luam tab tom tos kev tshuaj xyuas. Ib tug thawj tswj kev pab yuav pom zoo ua ntej nws tshwm rau ntawm daim ntawv qhia chaw. | 2026-10-11 | machine-drafted, needs native review |
| `done` | ht | Done | Fini | 2026-10-11 | machine-drafted, needs native review |
| `done` | so | Done | Dhammaad | 2026-10-11 | machine-drafted, needs native review |
| `done` | am | Done | ተከናውኗል | 2026-10-11 | machine-drafted, needs native review |
| `done` | hmn | Done | Tiav lawm | 2026-10-11 | machine-drafted, needs native review |
| `fieldName` | ht | Business name | Non biznis la | 2026-10-11 | machine-drafted, needs native review |
| `fieldName` | so | Business name | Magaca ganacsiga | 2026-10-11 | machine-drafted, needs native review |
| `fieldName` | am | Business name | የንግዱ ስም | 2026-10-11 | machine-drafted, needs native review |
| `fieldName` | hmn | Business name | Lub lag luam lub npe | 2026-10-11 | machine-drafted, needs native review |
| `phName` | ht | Corner Cafe | Kafe Kwen an | 2026-10-11 | machine-drafted, needs native review |
| `phName` | so | Corner Cafe | Maqaaxida Geeska | 2026-10-11 | machine-drafted, needs native review |
| `phName` | am | Corner Cafe | የማዕዘን ካፌ | 2026-10-11 | machine-drafted, needs native review |
| `phName` | hmn | Corner Cafe | Tsev Kas Fes Ntawm Ces Kaum | 2026-10-11 | machine-drafted, needs native review |
| `fieldDescription` | ht | Description | Deskripsyon | 2026-10-11 | machine-drafted, needs native review |
| `fieldDescription` | so | Description | Sharaxaad | 2026-10-11 | machine-drafted, needs native review |
| `fieldDescription` | am | Description | መግለጫ | 2026-10-11 | machine-drafted, needs native review |
| `fieldDescription` | hmn | Description | Lus piav qhia | 2026-10-11 | machine-drafted, needs native review |
| `phDescription` | ht | What does this business offer the community? | Kisa biznis sa a ofri kominote a? | 2026-10-11 | machine-drafted, needs native review |
| `phDescription` | so | What does this business offer the community? | Maxuu ganacsigani bulshada u hayaa? | 2026-10-11 | machine-drafted, needs native review |
| `phDescription` | am | What does this business offer the community? | ይህ ንግድ ለማኅበረሰቡ ምን ያቀርባል? | 2026-10-11 | machine-drafted, needs native review |
| `phDescription` | hmn | What does this business offer the community? | Lub lag luam no muab dab tsi rau zej zog? | 2026-10-11 | machine-drafted, needs native review |
| `fieldAddress` | ht | Street address | Adrès | 2026-10-11 | machine-drafted, needs native review |
| `fieldAddress` | so | Street address | Cinwaanka waddada | 2026-10-11 | machine-drafted, needs native review |
| `fieldAddress` | am | Street address | የመንገድ አድራሻ | 2026-10-11 | machine-drafted, needs native review |
| `fieldAddress` | hmn | Street address | Chaw nyob ntawm txoj kev | 2026-10-11 | machine-drafted, needs native review |
| `fieldCity` | ht | City | Vil | 2026-10-11 | machine-drafted, needs native review |
| `fieldCity` | so | City | Magaalo | 2026-10-11 | machine-drafted, needs native review |
| `fieldCity` | am | City | ከተማ | 2026-10-11 | machine-drafted, needs native review |
| `fieldCity` | hmn | City | Nroog | 2026-10-11 | machine-drafted, needs native review |
| `fieldState` | ht | State | Eta | 2026-10-11 | machine-drafted, needs native review |
| `fieldState` | so | State | Gobol | 2026-10-11 | machine-drafted, needs native review |
| `fieldState` | am | State | ግዛት | 2026-10-11 | machine-drafted, needs native review |
| `fieldState` | hmn | State | Xeev | 2026-10-11 | machine-drafted, needs native review |
| `fieldPhone` | ht | Phone | Telefòn | 2026-10-11 | machine-drafted, needs native review |
| `fieldPhone` | so | Phone | Telefoon | 2026-10-11 | machine-drafted, needs native review |
| `fieldPhone` | am | Phone | ስልክ | 2026-10-11 | machine-drafted, needs native review |
| `fieldPhone` | hmn | Phone | Xov tooj | 2026-10-11 | machine-drafted, needs native review |
| `fieldWebsite` | ht | Website | Sit entènèt | 2026-10-11 | machine-drafted, needs native review |
| `fieldWebsite` | so | Website | Bogga internetka | 2026-10-11 | machine-drafted, needs native review |
| `fieldWebsite` | am | Website | ድረ-ገጽ | 2026-10-11 | machine-drafted, needs native review |
| `fieldWebsite` | hmn | Website | Lub vev xaib | 2026-10-11 | machine-drafted, needs native review |
| `sectionDetails` | ht | Details | Detay | 2026-10-11 | machine-drafted, needs native review |
| `sectionDetails` | so | Details | Faahfaahin | 2026-10-11 | machine-drafted, needs native review |
| `sectionDetails` | am | Details | ዝርዝሮች | 2026-10-11 | machine-drafted, needs native review |
| `sectionDetails` | hmn | Details | Cov ntsiab lus | 2026-10-11 | machine-drafted, needs native review |
| `fieldCategory` | ht | Category | Kategori | 2026-10-11 | machine-drafted, needs native review |
| `fieldCategory` | so | Category | Qaybta | 2026-10-11 | machine-drafted, needs native review |
| `fieldCategory` | am | Category | ምድብ | 2026-10-11 | machine-drafted, needs native review |
| `fieldCategory` | hmn | Category | Pawg | 2026-10-11 | machine-drafted, needs native review |
| `selectPlaceholder` | ht | Select… | Chwazi… | 2026-10-11 | machine-drafted, needs native review |
| `selectPlaceholder` | so | Select… | Dooro… | 2026-10-11 | machine-drafted, needs native review |
| `selectPlaceholder` | am | Select… | ይምረጡ… | 2026-10-11 | machine-drafted, needs native review |
| `selectPlaceholder` | hmn | Select… | Xaiv… | 2026-10-11 | machine-drafted, needs native review |
| `fieldEmail` | ht | Email | Imèl | 2026-10-11 | machine-drafted, needs native review |
| `fieldEmail` | so | Email | Iimayl | 2026-10-11 | machine-drafted, needs native review |
| `fieldEmail` | am | Email | ኢሜይል | 2026-10-11 | machine-drafted, needs native review |
| `fieldEmail` | hmn | Email | Email | 2026-10-11 | machine-drafted, needs native review |
| `fieldCostModel` | ht | Cost model | Kalite pri | 2026-10-11 | machine-drafted, needs native review |
| `fieldCostModel` | so | Cost model | Nooca kharashka | 2026-10-11 | machine-drafted, needs native review |
| `fieldCostModel` | am | Cost model | የክፍያ ዓይነት | 2026-10-11 | machine-drafted, needs native review |
| `fieldCostModel` | hmn | Cost model | Hom nqi | 2026-10-11 | machine-drafted, needs native review |
| `costFree` | ht | Free | Gratis | 2026-10-11 | machine-drafted, needs native review |
| `costFree` | so | Free | Bilaash | 2026-10-11 | machine-drafted, needs native review |
| `costFree` | am | Free | ነፃ | 2026-10-11 | machine-drafted, needs native review |
| `costFree` | hmn | Free | Dawb | 2026-10-11 | machine-drafted, needs native review |
| `costSlidingScale` | ht | Sliding scale | Pri selon mwayen | 2026-10-11 | machine-drafted, needs native review |
| `costSlidingScale` | so | Sliding scale | Qiimo ku xiran awoodda | 2026-10-11 | machine-drafted, needs native review |
| `costSlidingScale` | am | Sliding scale | እንደ አቅም የሚከፈል | 2026-10-11 | machine-drafted, needs native review |
| `costSlidingScale` | hmn | Sliding scale | Nqi raws li them taus | 2026-10-11 | machine-drafted, needs native review |
| `costPaid` | ht | Paid | Peyan | 2026-10-11 | machine-drafted, needs native review |
| `costPaid` | so | Paid | Lacag leh | 2026-10-11 | machine-drafted, needs native review |
| `costPaid` | am | Paid | በክፍያ | 2026-10-11 | machine-drafted, needs native review |
| `costPaid` | hmn | Paid | Them nqi | 2026-10-11 | machine-drafted, needs native review |
| `fieldZip` | ht | ZIP code | Kòd postal | 2026-10-11 | machine-drafted, needs native review |
| `fieldZip` | so | ZIP code | Koodhka boostada | 2026-10-11 | machine-drafted, needs native review |
| `fieldZip` | am | ZIP code | የፖስታ ኮድ | 2026-10-11 | machine-drafted, needs native review |
| `fieldZip` | hmn | ZIP code | Tus lej ZIP | 2026-10-11 | machine-drafted, needs native review |
| `fieldRadius` | ht | Service radius (miles) | Reyon sèvis (mil) | 2026-10-11 | machine-drafted, needs native review |
| `fieldRadius` | so | Service radius (miles) | Baaxadda adeegga (mayl) | 2026-10-11 | machine-drafted, needs native review |
| `fieldRadius` | am | Service radius (miles) | የአገልግሎት ክልል (ማይል) | 2026-10-11 | machine-drafted, needs native review |
| `fieldRadius` | hmn | Service radius (miles) | Thaj tsam pab (mais) | 2026-10-11 | machine-drafted, needs native review |
| `catFood` | ht | Food | Manje | 2026-10-11 | machine-drafted, needs native review |
| `catFood` | so | Food | Cunto | 2026-10-11 | machine-drafted, needs native review |
| `catFood` | am | Food | ምግብ | 2026-10-11 | machine-drafted, needs native review |
| `catFood` | hmn | Food | Zaub mov | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | ht | Housing | Lojman | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | so | Housing | Guriyeyn | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | am | Housing | መኖሪያ ቤት | 2026-10-11 | machine-drafted, needs native review |
| `catHousing` | hmn | Housing | Vaj tse | 2026-10-11 | machine-drafted, needs native review |
| `catHealth` | ht | Health | Sante | 2026-10-11 | machine-drafted, needs native review |
| `catHealth` | so | Health | Caafimaad | 2026-10-11 | machine-drafted, needs native review |
| `catHealth` | am | Health | ጤና | 2026-10-11 | machine-drafted, needs native review |
| `catHealth` | hmn | Health | Kev noj qab haus huv | 2026-10-11 | machine-drafted, needs native review |
| `catLegal` | ht | Legal | Legal | 2026-10-11 | machine-drafted, needs native review |
| `catLegal` | so | Legal | Sharci | 2026-10-11 | machine-drafted, needs native review |
| `catLegal` | am | Legal | ሕግ | 2026-10-11 | machine-drafted, needs native review |
| `catLegal` | hmn | Legal | Kev cai lij choj | 2026-10-11 | machine-drafted, needs native review |
| `catEmployment` | ht | Employment | Travay | 2026-10-11 | machine-drafted, needs native review |
| `catEmployment` | so | Employment | Shaqo | 2026-10-11 | machine-drafted, needs native review |
| `catEmployment` | am | Employment | ሥራ | 2026-10-11 | machine-drafted, needs native review |
| `catEmployment` | hmn | Employment | Hauj lwm | 2026-10-11 | machine-drafted, needs native review |
| `catChildcare` | ht | Childcare | Gadri timoun | 2026-10-11 | machine-drafted, needs native review |
| `catChildcare` | so | Childcare | Daryeelka carruurta | 2026-10-11 | machine-drafted, needs native review |
| `catChildcare` | am | Childcare | የሕፃናት እንክብካቤ | 2026-10-11 | machine-drafted, needs native review |
| `catChildcare` | hmn | Childcare | Kev zov me nyuam | 2026-10-11 | machine-drafted, needs native review |
| `catTransportation` | ht | Transportation | Transpò | 2026-10-11 | machine-drafted, needs native review |
| `catTransportation` | so | Transportation | Gaadiid | 2026-10-11 | machine-drafted, needs native review |
| `catTransportation` | am | Transportation | መጓጓዣ | 2026-10-11 | machine-drafted, needs native review |
| `catTransportation` | hmn | Transportation | Kev thauj mus los | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | ht | Education | Edikasyon | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | so | Education | Waxbarasho | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | am | Education | ትምህርት | 2026-10-11 | machine-drafted, needs native review |
| `catEducation` | hmn | Education | Kev kawm | 2026-10-11 | machine-drafted, needs native review |
| `catFinancial` | ht | Financial | Finans | 2026-10-11 | machine-drafted, needs native review |
| `catFinancial` | so | Financial | Maaliyad | 2026-10-11 | machine-drafted, needs native review |
| `catFinancial` | am | Financial | ፋይናንስ | 2026-10-11 | machine-drafted, needs native review |
| `catFinancial` | hmn | Financial | Nyiaj txiag | 2026-10-11 | machine-drafted, needs native review |
| `catRetail` | ht | Retail | Komès | 2026-10-11 | machine-drafted, needs native review |
| `catRetail` | so | Retail | Tafaariiq | 2026-10-11 | machine-drafted, needs native review |
| `catRetail` | am | Retail | ችርቻሮ | 2026-10-11 | machine-drafted, needs native review |
| `catRetail` | hmn | Retail | Khw muag khoom | 2026-10-11 | machine-drafted, needs native review |
| `catOther` | ht | Other | Lòt | 2026-10-11 | machine-drafted, needs native review |
| `catOther` | so | Other | Kale | 2026-10-11 | machine-drafted, needs native review |
| `catOther` | am | Other | ሌላ | 2026-10-11 | machine-drafted, needs native review |
| `catOther` | hmn | Other | Lwm yam | 2026-10-11 | machine-drafted, needs native review |
| `sectionHours` | ht | Hours | Orè | 2026-10-11 | machine-drafted, needs native review |
| `sectionHours` | so | Hours | Saacadaha | 2026-10-11 | machine-drafted, needs native review |
| `sectionHours` | am | Hours | የሥራ ሰዓታት | 2026-10-11 | machine-drafted, needs native review |
| `sectionHours` | hmn | Hours | Sij hawm qhib | 2026-10-11 | machine-drafted, needs native review |
| `copyMonday` | ht | Copy Monday to weekdays | Kopye lendi sou jou travay yo | 2026-10-11 | machine-drafted, needs native review |
| `copyMonday` | so | Copy Monday to weekdays | U koobiyee Isniinta maalmaha shaqada | 2026-10-11 | machine-drafted, needs native review |
| `copyMonday` | am | Copy Monday to weekdays | ሰኞን ወደ የሥራ ቀናት ቅዳ | 2026-10-11 | machine-drafted, needs native review |
| `copyMonday` | hmn | Copy Monday to weekdays | Luam Hnub Ib rau cov hnub ua hauj lwm | 2026-10-11 | machine-drafted, needs native review |
| `hoursOpen` | ht | Open | Ouvri | 2026-10-11 | machine-drafted, needs native review |
| `hoursOpen` | so | Open | Furan | 2026-10-11 | machine-drafted, needs native review |
| `hoursOpen` | am | Open | ክፍት | 2026-10-11 | machine-drafted, needs native review |
| `hoursOpen` | hmn | Open | Qhib | 2026-10-11 | machine-drafted, needs native review |
| `hoursClosed` | ht | Closed | Fèmen | 2026-10-11 | machine-drafted, needs native review |
| `hoursClosed` | so | Closed | Xiran | 2026-10-11 | machine-drafted, needs native review |
| `hoursClosed` | am | Closed | ዝግ | 2026-10-11 | machine-drafted, needs native review |
| `hoursClosed` | hmn | Closed | Kaw | 2026-10-11 | machine-drafted, needs native review |
| `hoursDayAria` | ht | {state} — {day} | {state} — {day} | 2026-10-11 | machine-drafted, needs native review |
| `hoursDayAria` | so | {state} — {day} | {state} — {day} | 2026-10-11 | machine-drafted, needs native review |
| `hoursDayAria` | am | {state} — {day} | {state} — {day} | 2026-10-11 | machine-drafted, needs native review |
| `hoursDayAria` | hmn | {state} — {day} | {state} — {day} | 2026-10-11 | machine-drafted, needs native review |
| `openTimeAria` | ht | {day} opening time | Lè ouvèti, {day} | 2026-10-11 | machine-drafted, needs native review |
| `openTimeAria` | so | {day} opening time | Waqtiga furitaanka, {day} | 2026-10-11 | machine-drafted, needs native review |
| `openTimeAria` | am | {day} opening time | የመክፈቻ ሰዓት፣ {day} | 2026-10-11 | machine-drafted, needs native review |
| `openTimeAria` | hmn | {day} opening time | Sij hawm qhib, {day} | 2026-10-11 | machine-drafted, needs native review |
| `closeTimeAria` | ht | {day} closing time | Lè fèmti, {day} | 2026-10-11 | machine-drafted, needs native review |
| `closeTimeAria` | so | {day} closing time | Waqtiga xiritaanka, {day} | 2026-10-11 | machine-drafted, needs native review |
| `closeTimeAria` | am | {day} closing time | የመዝጊያ ሰዓት፣ {day} | 2026-10-11 | machine-drafted, needs native review |
| `closeTimeAria` | hmn | {day} closing time | Sij hawm kaw, {day} | 2026-10-11 | machine-drafted, needs native review |
| `hoursTo` | ht | to | rive | 2026-10-11 | machine-drafted, needs native review |
| `hoursTo` | so | to | ilaa | 2026-10-11 | machine-drafted, needs native review |
| `hoursTo` | am | to | እስከ | 2026-10-11 | machine-drafted, needs native review |
| `hoursTo` | hmn | to | txog | 2026-10-11 | machine-drafted, needs native review |
| `removeInterval` | ht | Remove interval | Retire entèval la | 2026-10-11 | machine-drafted, needs native review |
| `removeInterval` | so | Remove interval | Ka saar muddada | 2026-10-11 | machine-drafted, needs native review |
| `removeInterval` | am | Remove interval | የጊዜ ክፍተቱን አስወግድ | 2026-10-11 | machine-drafted, needs native review |
| `removeInterval` | hmn | Remove interval | Tshem lub sij hawm no | 2026-10-11 | machine-drafted, needs native review |
| `addInterval` | ht | Add interval | Ajoute yon entèval | 2026-10-11 | machine-drafted, needs native review |
| `addInterval` | so | Add interval | Ku dar muddo | 2026-10-11 | machine-drafted, needs native review |
| `addInterval` | am | Add interval | የጊዜ ክፍተት አክል | 2026-10-11 | machine-drafted, needs native review |
| `addInterval` | hmn | Add interval | Ntxiv lub sij hawm | 2026-10-11 | machine-drafted, needs native review |
| `sectionPhotos` | ht | Photos | Foto | 2026-10-11 | machine-drafted, needs native review |
| `sectionPhotos` | so | Photos | Sawirro | 2026-10-11 | machine-drafted, needs native review |
| `sectionPhotos` | am | Photos | ፎቶዎች | 2026-10-11 | machine-drafted, needs native review |
| `sectionPhotos` | hmn | Photos | Cov duab | 2026-10-11 | machine-drafted, needs native review |
| `photoLogo` | ht | Logo | Logo | 2026-10-11 | machine-drafted, needs native review |
| `photoLogo` | so | Logo | Astaan | 2026-10-11 | machine-drafted, needs native review |
| `photoLogo` | am | Logo | አርማ | 2026-10-11 | machine-drafted, needs native review |
| `photoLogo` | hmn | Logo | Lub cim | 2026-10-11 | machine-drafted, needs native review |
| `photoCover` | ht | Cover | Kouvèti | 2026-10-11 | machine-drafted, needs native review |
| `photoCover` | so | Cover | Sawirka daboolka | 2026-10-11 | machine-drafted, needs native review |
| `photoCover` | am | Cover | የሽፋን ፎቶ | 2026-10-11 | machine-drafted, needs native review |
| `photoCover` | hmn | Cover | Daim duab npog | 2026-10-11 | machine-drafted, needs native review |
| `photoGallery` | ht | Gallery | Galri | 2026-10-11 | machine-drafted, needs native review |
| `photoGallery` | so | Gallery | Sawir-qaadaha | 2026-10-11 | machine-drafted, needs native review |
| `photoGallery` | am | Gallery | የፎቶ ስብስብ | 2026-10-11 | machine-drafted, needs native review |
| `photoGallery` | hmn | Gallery | Chav duab | 2026-10-11 | machine-drafted, needs native review |
| `removeGalleryPhoto` | ht | Remove gallery photo | Retire foto galri a | 2026-10-11 | machine-drafted, needs native review |
| `removeGalleryPhoto` | so | Remove gallery photo | Ka saar sawirka sawir-qaadaha | 2026-10-11 | machine-drafted, needs native review |
| `removeGalleryPhoto` | am | Remove gallery photo | የስብስቡን ፎቶ አስወግድ | 2026-10-11 | machine-drafted, needs native review |
| `removeGalleryPhoto` | hmn | Remove gallery photo | Tshem daim duab hauv chav duab | 2026-10-11 | machine-drafted, needs native review |
| `photoAdd` | ht | Add | Ajoute | 2026-10-11 | machine-drafted, needs native review |
| `photoAdd` | so | Add | Ku dar | 2026-10-11 | machine-drafted, needs native review |
| `photoAdd` | am | Add | አክል | 2026-10-11 | machine-drafted, needs native review |
| `photoAdd` | hmn | Add | Ntxiv | 2026-10-11 | machine-drafted, needs native review |
| `addLogo` | ht | Add logo | Ajoute logo | 2026-10-11 | machine-drafted, needs native review |
| `addLogo` | so | Add logo | Ku dar astaan | 2026-10-11 | machine-drafted, needs native review |
| `addLogo` | am | Add logo | አርማ አክል | 2026-10-11 | machine-drafted, needs native review |
| `addLogo` | hmn | Add logo | Ntxiv lub cim | 2026-10-11 | machine-drafted, needs native review |
| `addCover` | ht | Add cover | Ajoute kouvèti | 2026-10-11 | machine-drafted, needs native review |
| `addCover` | so | Add cover | Ku dar sawirka daboolka | 2026-10-11 | machine-drafted, needs native review |
| `addCover` | am | Add cover | የሽፋን ፎቶ አክል | 2026-10-11 | machine-drafted, needs native review |
| `addCover` | hmn | Add cover | Ntxiv daim duab npog | 2026-10-11 | machine-drafted, needs native review |
| `removeLogo` | ht | Remove logo | Retire logo a | 2026-10-11 | machine-drafted, needs native review |
| `removeLogo` | so | Remove logo | Ka saar astaanta | 2026-10-11 | machine-drafted, needs native review |
| `removeLogo` | am | Remove logo | አርማውን አስወግድ | 2026-10-11 | machine-drafted, needs native review |
| `removeLogo` | hmn | Remove logo | Tshem lub cim | 2026-10-11 | machine-drafted, needs native review |
| `removeCover` | ht | Remove cover | Retire kouvèti a | 2026-10-11 | machine-drafted, needs native review |
| `removeCover` | so | Remove cover | Ka saar sawirka daboolka | 2026-10-11 | machine-drafted, needs native review |
| `removeCover` | am | Remove cover | የሽፋን ፎቶውን አስወግድ | 2026-10-11 | machine-drafted, needs native review |
| `removeCover` | hmn | Remove cover | Tshem daim duab npog | 2026-10-11 | machine-drafted, needs native review |
| `sectionServices` | ht | Services | Sèvis | 2026-10-11 | machine-drafted, needs native review |
| `sectionServices` | so | Services | Adeegyo | 2026-10-11 | machine-drafted, needs native review |
| `sectionServices` | am | Services | አገልግሎቶች | 2026-10-11 | machine-drafted, needs native review |
| `sectionServices` | hmn | Services | Cov kev pab | 2026-10-11 | machine-drafted, needs native review |
| `serviceNameAria` | ht | Service {n} name | Non sèvis {n} | 2026-10-11 | machine-drafted, needs native review |
| `serviceNameAria` | so | Service {n} name | Magaca adeegga {n} | 2026-10-11 | machine-drafted, needs native review |
| `serviceNameAria` | am | Service {n} name | የአገልግሎት {n} ስም | 2026-10-11 | machine-drafted, needs native review |
| `serviceNameAria` | hmn | Service {n} name | Kev pab {n} lub npe | 2026-10-11 | machine-drafted, needs native review |
| `phServiceName` | ht | Service name | Non sèvis la | 2026-10-11 | machine-drafted, needs native review |
| `phServiceName` | so | Service name | Magaca adeegga | 2026-10-11 | machine-drafted, needs native review |
| `phServiceName` | am | Service name | የአገልግሎት ስም | 2026-10-11 | machine-drafted, needs native review |
| `phServiceName` | hmn | Service name | Kev pab lub npe | 2026-10-11 | machine-drafted, needs native review |
| `removeService` | ht | Remove service | Retire sèvis la | 2026-10-11 | machine-drafted, needs native review |
| `removeService` | so | Remove service | Ka saar adeegga | 2026-10-11 | machine-drafted, needs native review |
| `removeService` | am | Remove service | አገልግሎቱን አስወግድ | 2026-10-11 | machine-drafted, needs native review |
| `removeService` | hmn | Remove service | Tshem kev pab | 2026-10-11 | machine-drafted, needs native review |
| `serviceDescriptionAria` | ht | Service {n} description | Deskripsyon sèvis {n} | 2026-10-11 | machine-drafted, needs native review |
| `serviceDescriptionAria` | so | Service {n} description | Sharaxaadda adeegga {n} | 2026-10-11 | machine-drafted, needs native review |
| `serviceDescriptionAria` | am | Service {n} description | የአገልግሎት {n} መግለጫ | 2026-10-11 | machine-drafted, needs native review |
| `serviceDescriptionAria` | hmn | Service {n} description | Lus piav qhia txog kev pab {n} | 2026-10-11 | machine-drafted, needs native review |
| `phServiceDescription` | ht | Short description (optional) | Ti deskripsyon (si ou vle) | 2026-10-11 | machine-drafted, needs native review |
| `phServiceDescription` | so | Short description (optional) | Sharaxaad gaaban (ikhtiyaari) | 2026-10-11 | machine-drafted, needs native review |
| `phServiceDescription` | am | Short description (optional) | አጭር መግለጫ (አማራጭ) | 2026-10-11 | machine-drafted, needs native review |
| `phServiceDescription` | hmn | Short description (optional) | Lus piav qhia luv (tsis yuam) | 2026-10-11 | machine-drafted, needs native review |
| `addService` | ht | Add service | Ajoute yon sèvis | 2026-10-11 | machine-drafted, needs native review |
| `addService` | so | Add service | Ku dar adeeg | 2026-10-11 | machine-drafted, needs native review |
| `addService` | am | Add service | አገልግሎት አክል | 2026-10-11 | machine-drafted, needs native review |
| `addService` | hmn | Add service | Ntxiv kev pab | 2026-10-11 | machine-drafted, needs native review |
| `sectionAttributes` | ht | Attributes | Karakteristik | 2026-10-11 | machine-drafted, needs native review |
| `sectionAttributes` | so | Attributes | Astaamaha | 2026-10-11 | machine-drafted, needs native review |
| `sectionAttributes` | am | Attributes | መለያ ባህሪያት | 2026-10-11 | machine-drafted, needs native review |
| `sectionAttributes` | hmn | Attributes | Cov yam ntxwv | 2026-10-11 | machine-drafted, needs native review |
| `attrWheelchairAccessible` | ht | Wheelchair accessible | Aksesib pou chèz woulant | 2026-10-11 | machine-drafted, needs native review |
| `attrWheelchairAccessible` | so | Wheelchair accessible | Kursiga curyaanka waa lagu geli karaa | 2026-10-11 | machine-drafted, needs native review |
| `attrWheelchairAccessible` | am | Wheelchair accessible | ለዊልቸር ተደራሽ | 2026-10-11 | machine-drafted, needs native review |
| `attrWheelchairAccessible` | hmn | Wheelchair accessible | Lub rooj zaum muaj log nkag tau | 2026-10-11 | machine-drafted, needs native review |
| `attrWifi` | ht | Free Wi-Fi | Wi-Fi gratis | 2026-10-11 | machine-drafted, needs native review |
| `attrWifi` | so | Free Wi-Fi | Wi-Fi bilaash ah | 2026-10-11 | machine-drafted, needs native review |
| `attrWifi` | am | Free Wi-Fi | ነፃ Wi-Fi | 2026-10-11 | machine-drafted, needs native review |
| `attrWifi` | hmn | Free Wi-Fi | Wi-Fi dawb | 2026-10-11 | machine-drafted, needs native review |
| `attrParking` | ht | Parking available | Gen pakin | 2026-10-11 | machine-drafted, needs native review |
| `attrParking` | so | Parking available | Baarkin waa la heli karaa | 2026-10-11 | machine-drafted, needs native review |
| `attrParking` | am | Parking available | የመኪና ማቆሚያ አለ | 2026-10-11 | machine-drafted, needs native review |
| `attrParking` | hmn | Parking available | Muaj chaw nres tsheb | 2026-10-11 | machine-drafted, needs native review |
| `attrAcceptsEbt` | ht | Accepts EBT | Aksepte EBT | 2026-10-11 | machine-drafted, needs native review |
| `attrAcceptsEbt` | so | Accepts EBT | Wuxuu aqbalaa EBT | 2026-10-11 | machine-drafted, needs native review |
| `attrAcceptsEbt` | am | Accepts EBT | EBT ይቀበላል | 2026-10-11 | machine-drafted, needs native review |
| `attrAcceptsEbt` | hmn | Accepts EBT | Txais EBT | 2026-10-11 | machine-drafted, needs native review |
| `attrMultilingual` | ht | Multilingual staff | Anplwaye ki pale plizyè lang | 2026-10-11 | machine-drafted, needs native review |
| `attrMultilingual` | so | Multilingual staff | Shaqaale ku hadla luqado badan | 2026-10-11 | machine-drafted, needs native review |
| `attrMultilingual` | am | Multilingual staff | ብዙ ቋንቋ የሚናገሩ ሠራተኞች | 2026-10-11 | machine-drafted, needs native review |
| `attrMultilingual` | hmn | Multilingual staff | Cov neeg ua hauj lwm hais tau ntau hom lus | 2026-10-11 | machine-drafted, needs native review |
| `attrWomanOwned` | ht | Woman-owned | Pwopriyetè a se yon fanm | 2026-10-11 | machine-drafted, needs native review |
| `attrWomanOwned` | so | Woman-owned | Waxaa leh haweeney | 2026-10-11 | machine-drafted, needs native review |
| `attrWomanOwned` | am | Woman-owned | የሴት ባለቤትነት | 2026-10-11 | machine-drafted, needs native review |
| `attrWomanOwned` | hmn | Woman-owned | Poj niam yog tus tswv | 2026-10-11 | machine-drafted, needs native review |
| `attrVeteranOwned` | ht | Veteran-owned | Pwopriyetè a se yon veteran | 2026-10-11 | machine-drafted, needs native review |
| `attrVeteranOwned` | so | Veteran-owned | Waxaa leh halyeey ciidan | 2026-10-11 | machine-drafted, needs native review |
| `attrVeteranOwned` | am | Veteran-owned | የአርበኛ ባለቤትነት | 2026-10-11 | machine-drafted, needs native review |
| `attrVeteranOwned` | hmn | Veteran-owned | Qub tub rog yog tus tswv | 2026-10-11 | machine-drafted, needs native review |
| `attrLgbtqFriendly` | ht | LGBTQ+ friendly | Akeyan pou moun LGBTQ+ | 2026-10-11 | machine-drafted, needs native review |
| `attrLgbtqFriendly` | so | LGBTQ+ friendly | Soo dhaweeya dadka LGBTQ+ | 2026-10-11 | machine-drafted, needs native review |
| `attrLgbtqFriendly` | am | LGBTQ+ friendly | ለLGBTQ+ ምቹ | 2026-10-11 | machine-drafted, needs native review |
| `attrLgbtqFriendly` | hmn | LGBTQ+ friendly | Txais tos cov neeg LGBTQ+ | 2026-10-11 | machine-drafted, needs native review |
| `attrBlackOwned` | ht | Black-owned | Pwopriyetè a se yon moun nwa | 2026-10-11 | machine-drafted, needs native review |
| `attrBlackOwned` | so | Black-owned | Waxaa leh qof madow | 2026-10-11 | machine-drafted, needs native review |
| `attrBlackOwned` | am | Black-owned | የጥቁር ባለቤትነት | 2026-10-11 | machine-drafted, needs native review |
| `attrBlackOwned` | hmn | Black-owned | Neeg tawv dub yog tus tswv | 2026-10-11 | machine-drafted, needs native review |
| `sectionSocial` | ht | Social links | Rezo sosyal | 2026-10-11 | machine-drafted, needs native review |
| `sectionSocial` | so | Social links | Xiriiriyeyaasha baraha bulshada | 2026-10-11 | machine-drafted, needs native review |
| `sectionSocial` | am | Social links | የማኅበራዊ ሚዲያ አገናኞች | 2026-10-11 | machine-drafted, needs native review |
| `sectionSocial` | hmn | Social links | Cov txuas rau social media | 2026-10-11 | machine-drafted, needs native review |
| `submitting` | ht | Submitting… | N ap soumèt… | 2026-10-11 | machine-drafted, needs native review |
| `submitting` | so | Submitting… | Waa la gudbinayaa… | 2026-10-11 | machine-drafted, needs native review |
| `submitting` | am | Submitting… | በማስገባት ላይ… | 2026-10-11 | machine-drafted, needs native review |
| `submitting` | hmn | Submitting… | Tab tom xa… | 2026-10-11 | machine-drafted, needs native review |
| `submitForReview` | ht | Submit for review | Soumèt pou revizyon | 2026-10-11 | machine-drafted, needs native review |
| `submitForReview` | so | Submit for review | U gudbi dib-u-eegis | 2026-10-11 | machine-drafted, needs native review |
| `submitForReview` | am | Submit for review | ለግምገማ አስገባ | 2026-10-11 | machine-drafted, needs native review |
| `submitForReview` | hmn | Submit for review | Xa mus tshuaj xyuas | 2026-10-11 | machine-drafted, needs native review |
| `cancel` | ht | Cancel | Anile | 2026-10-11 | machine-drafted, needs native review |
| `cancel` | so | Cancel | Jooji | 2026-10-11 | machine-drafted, needs native review |
| `cancel` | am | Cancel | ሰርዝ | 2026-10-11 | machine-drafted, needs native review |
| `cancel` | hmn | Cancel | Thim | 2026-10-11 | machine-drafted, needs native review |
| `empty` | ht | No local businesses yet. | Poko gen biznis lokal. | 2026-10-11 | machine-drafted, needs native review |
| `empty` | so | No local businesses yet. | Weli ma jiraan ganacsiyo deegaanka ah. | 2026-10-11 | machine-drafted, needs native review |
| `empty` | am | No local businesses yet. | እስካሁን ምንም የአካባቢ ንግድ የለም። | 2026-10-11 | machine-drafted, needs native review |
| `empty` | hmn | No local businesses yet. | Tseem tsis tau muaj lag luam hauv zos. | 2026-10-11 | machine-drafted, needs native review |
| `emptyAddFirst` | ht | Be the first to add one. | Se ou ki ka premye ajoute youn. | 2026-10-11 | machine-drafted, needs native review |
| `emptyAddFirst` | so | Be the first to add one. | Noqo qofka ugu horreeya ee mid ku dara. | 2026-10-11 | machine-drafted, needs native review |
| `emptyAddFirst` | am | Be the first to add one. | የመጀመሪያውን ለማከል ቀዳሚ ይሁኑ። | 2026-10-11 | machine-drafted, needs native review |
| `emptyAddFirst` | hmn | Be the first to add one. | Koj ua thawj tus ntxiv ib lub. | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | ht | Failed to load businesses | Nou pa t kapab chaje biznis yo | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | so | Failed to load businesses | Lama soo shubi karin ganacsiyada | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | am | Failed to load businesses | ንግዶችን መጫን አልተቻለም | 2026-10-11 | machine-drafted, needs native review |
| `loadFailed` | hmn | Failed to load businesses | Thauj tsis tau cov lag luam | 2026-10-11 | machine-drafted, needs native review |
| `uploadFailed` | ht | Upload failed. Please try again. | Foto a pa t rive monte. Tanpri eseye ankò. | 2026-10-11 | machine-drafted, needs native review |
| `uploadFailed` | so | Upload failed. Please try again. | Sawirka lama soo gelin karin. Fadlan isku day mar kale. | 2026-10-11 | machine-drafted, needs native review |
| `uploadFailed` | am | Upload failed. Please try again. | መስቀል አልተቻለም። እባክዎ እንደገና ይሞክሩ። | 2026-10-11 | machine-drafted, needs native review |
| `uploadFailed` | hmn | Upload failed. Please try again. | Xa daim duab tsis tau. Thov sim dua. | 2026-10-11 | machine-drafted, needs native review |

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
