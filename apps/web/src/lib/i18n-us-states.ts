// apps/web/src/lib/i18n-us-states.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The names of the 50 US states, the District of Columbia and the 5 inhabited territories in the 14
// FEED locales, keyed by the 2-letter USPS code — the value every state picker submits and every
// query filters on (lib/us-states.ts STATE_TO_ABBR). Only the label is translated; the option value
// stays the code. Look up with usStateName(code, locale) (English fallback, logged as
// i18n.translation_fallback); usStateOptions(locale) lists every code with its name, in the order of
// lib/us-states.ts. Shared by every state picker (Browse Programs first).
// Many languages write these names as English does; that is not a missing translation.
// Parity: i18n-us-states.test.ts.
// ht, so, am and hmn are machine-drafted, needs native review: docs/i18n-native-review.md.

import { translate, type Locale } from './i18n'
import { STATE_TO_ABBR, US_STATES } from './us-states'

/** The 56 codes in lib/us-states.ts order. */
export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA',
  'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR',
  'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'PR', 'GU', 'VI', 'AS', 'MP',
] as const
export type UsStateCode = (typeof US_STATE_CODES)[number]
export type UsStateMessages = Record<UsStateCode, string>

const table = (names: readonly string[]): UsStateMessages =>
  Object.fromEntries(US_STATE_CODES.map((code, i) => [code, names[i]])) as UsStateMessages

// Names in US_STATE_CODES order.
const EN = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
  'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
  'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'Puerto Rico', 'Guam', 'US Virgin Islands', 'American Samoa',
  'Northern Mariana Islands',
]

export const usStateMessages: Record<Locale, UsStateMessages> = {
  en: table(EN),
  es: table([
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Distrito de Columbia',
    'Florida', 'Georgia', 'Hawái', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Luisiana', 'Maine',
    'Maryland', 'Massachusetts', 'Míchigan', 'Minnesota', 'Misisipi', 'Misuri', 'Montana', 'Nebraska', 'Nevada',
    'Nuevo Hampshire', 'Nueva Jersey', 'Nuevo México', 'Nueva York', 'Carolina del Norte', 'Dakota del Norte', 'Ohio', 'Oklahoma', 'Oregón',
    'Pensilvania', 'Rhode Island', 'Carolina del Sur', 'Dakota del Sur', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
    'Washington', 'Virginia Occidental', 'Wisconsin', 'Wyoming', 'Puerto Rico', 'Guam', 'Islas Vírgenes de EE. UU.', 'Samoa Americana',
    'Islas Marianas del Norte',
  ]),
  // machine-drafted, needs native review
  ht: table([
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'Kalifòni', 'Kolorado', 'Konektikèt', 'Delawè', 'Distri Kolonbi',
    'Florid', 'Jòji', 'Awayi', 'Idaho', 'Ilinwa', 'Indyana', 'Iowa', 'Kannzas', 'Kentoki', 'Lwizyàn', 'Maine',
    'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'New Hampshire', 'New Jersey', 'Nouvo Meksik', 'Nouyòk', 'Karolin di Nò', 'Dakota di Nò', 'Ohio', 'Oklahoma', 'Oregon',
    'Pennsilvani', 'Rhode Island', 'Karolin di Sid', 'Dakota di Sid', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Vijini',
    'Washington', 'Vijini Lwès', 'Wisconsin', 'Wyoming', 'Pòtoriko', 'Gwam', 'Zile Vyèj Ameriken', 'Samoa Ameriken',
    'Zile Mariàn di Nò',
  ]),
  vi: table([
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Đặc khu Columbia',
    'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
    'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'Bắc Carolina', 'Bắc Dakota', 'Ohio', 'Oklahoma', 'Oregon',
    'Pennsylvania', 'Rhode Island', 'Nam Carolina', 'Nam Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
    'Washington', 'Tây Virginia', 'Wisconsin', 'Wyoming', 'Puerto Rico', 'Guam', 'Quần đảo Virgin thuộc Mỹ', 'Samoa thuộc Mỹ',
    'Quần đảo Bắc Mariana',
  ]),
  ar: table([
    'ألاباما', 'ألاسكا', 'أريزونا', 'أركنساس', 'كاليفورنيا', 'كولورادو', 'كونيتيكت', 'ديلاوير', 'مقاطعة كولومبيا',
    'فلوريدا', 'جورجيا', 'هاواي', 'أيداهو', 'إلينوي', 'إنديانا', 'آيوا', 'كانساس', 'كنتاكي', 'لويزيانا', 'مين',
    'ماريلاند', 'ماساتشوستس', 'ميشيغان', 'مينيسوتا', 'ميسيسيبي', 'ميزوري', 'مونتانا', 'نبراسكا', 'نيفادا',
    'نيوهامشير', 'نيوجيرسي', 'نيومكسيكو', 'نيويورك', 'كارولاينا الشمالية', 'داكوتا الشمالية', 'أوهايو', 'أوكلاهوما', 'أوريغون',
    'بنسلفانيا', 'رود آيلاند', 'كارولاينا الجنوبية', 'داكوتا الجنوبية', 'تينيسي', 'تكساس', 'يوتا', 'فيرمونت', 'فيرجينيا',
    'واشنطن', 'فيرجينيا الغربية', 'ويسكونسن', 'وايومنغ', 'بورتوريكو', 'غوام', 'جزر العذراء الأمريكية', 'ساموا الأمريكية',
    'جزر ماريانا الشمالية',
  ]),
  zh: table([
    '阿拉巴马州', '阿拉斯加州', '亚利桑那州', '阿肯色州', '加利福尼亚州', '科罗拉多州', '康涅狄格州', '特拉华州', '哥伦比亚特区',
    '佛罗里达州', '佐治亚州', '夏威夷州', '爱达荷州', '伊利诺伊州', '印第安纳州', '艾奥瓦州', '堪萨斯州', '肯塔基州', '路易斯安那州', '缅因州',
    '马里兰州', '马萨诸塞州', '密歇根州', '明尼苏达州', '密西西比州', '密苏里州', '蒙大拿州', '内布拉斯加州', '内华达州',
    '新罕布什尔州', '新泽西州', '新墨西哥州', '纽约州', '北卡罗来纳州', '北达科他州', '俄亥俄州', '俄克拉何马州', '俄勒冈州',
    '宾夕法尼亚州', '罗得岛州', '南卡罗来纳州', '南达科他州', '田纳西州', '得克萨斯州', '犹他州', '佛蒙特州', '弗吉尼亚州',
    '华盛顿州', '西弗吉尼亚州', '威斯康星州', '怀俄明州', '波多黎各', '关岛', '美属维尔京群岛', '美属萨摩亚',
    '北马里亚纳群岛',
  ]),
  // machine-drafted, needs native review
  so: table([
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'Kaliforniya', 'Colorado', 'Connecticut', 'Delaware', 'Degmada Columbia',
    'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
    'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'Waqooyiga Carolina', 'Waqooyiga Dakota', 'Ohio', 'Oklahoma', 'Oregon',
    'Pennsylvania', 'Rhode Island', 'Koonfurta Carolina', 'Koonfurta Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
    'Washington', 'Galbeedka Virginia', 'Wisconsin', 'Wyoming', 'Puerto Rico', 'Guam', 'Jasiiradaha Virgin ee Mareykanka', 'Samoa ee Mareykanka',
    'Jasiiradaha Waqooyiga Mariana',
  ]),
  fr: table([
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'Californie', 'Colorado', 'Connecticut', 'Delaware', 'District de Columbia',
    'Floride', 'Géorgie', 'Hawaï', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiane', 'Maine',
    'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'New Hampshire', 'New Jersey', 'Nouveau-Mexique', 'État de New York', 'Caroline du Nord', 'Dakota du Nord', 'Ohio', 'Oklahoma', 'Oregon',
    'Pennsylvanie', 'Rhode Island', 'Caroline du Sud', 'Dakota du Sud', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginie',
    'État de Washington', 'Virginie-Occidentale', 'Wisconsin', 'Wyoming', 'Porto Rico', 'Guam', 'Îles Vierges des États-Unis', 'Samoa américaines',
    'Îles Mariannes du Nord',
  ]),
  pt: table([
    'Alabama', 'Alasca', 'Arizona', 'Arkansas', 'Califórnia', 'Colorado', 'Connecticut', 'Delaware', 'Distrito de Colúmbia',
    'Flórida', 'Geórgia', 'Havaí', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Luisiana', 'Maine',
    'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'Nova Hampshire', 'Nova Jersey', 'Novo México', 'Nova York', 'Carolina do Norte', 'Dakota do Norte', 'Ohio', 'Oklahoma', 'Oregon',
    'Pensilvânia', 'Rhode Island', 'Carolina do Sul', 'Dakota do Sul', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virgínia',
    'Washington', 'Virgínia Ocidental', 'Wisconsin', 'Wyoming', 'Porto Rico', 'Guam', 'Ilhas Virgens Americanas', 'Samoa Americana',
    'Ilhas Marianas do Norte',
  ]),
  ru: table([
    'Алабама', 'Аляска', 'Аризона', 'Арканзас', 'Калифорния', 'Колорадо', 'Коннектикут', 'Делавэр', 'Округ Колумбия',
    'Флорида', 'Джорджия', 'Гавайи', 'Айдахо', 'Иллинойс', 'Индиана', 'Айова', 'Канзас', 'Кентукки', 'Луизиана', 'Мэн',
    'Мэриленд', 'Массачусетс', 'Мичиган', 'Миннесота', 'Миссисипи', 'Миссури', 'Монтана', 'Небраска', 'Невада',
    'Нью-Гэмпшир', 'Нью-Джерси', 'Нью-Мексико', 'Нью-Йорк', 'Северная Каролина', 'Северная Дакота', 'Огайо', 'Оклахома', 'Орегон',
    'Пенсильвания', 'Род-Айленд', 'Южная Каролина', 'Южная Дакота', 'Теннесси', 'Техас', 'Юта', 'Вермонт', 'Виргиния',
    'Вашингтон', 'Западная Виргиния', 'Висконсин', 'Вайоминг', 'Пуэрто-Рико', 'Гуам', 'Виргинские Острова (США)', 'Американское Самоа',
    'Северные Марианские Острова',
  ]),
  ko: table([
    '앨라배마', '알래스카', '애리조나', '아칸소', '캘리포니아', '콜로라도', '코네티컷', '델라웨어', '컬럼비아 특별구',
    '플로리다', '조지아', '하와이', '아이다호', '일리노이', '인디애나', '아이오와', '캔자스', '켄터키', '루이지애나', '메인',
    '메릴랜드', '매사추세츠', '미시간', '미네소타', '미시시피', '미주리', '몬태나', '네브래스카', '네바다',
    '뉴햄프셔', '뉴저지', '뉴멕시코', '뉴욕', '노스캐롤라이나', '노스다코타', '오하이오', '오클라호마', '오리건',
    '펜실베이니아', '로드아일랜드', '사우스캐롤라이나', '사우스다코타', '테네시', '텍사스', '유타', '버몬트', '버지니아',
    '워싱턴', '웨스트버지니아', '위스콘신', '와이오밍', '푸에르토리코', '괌', '미국령 버진아일랜드', '아메리칸사모아',
    '북마리아나 제도',
  ]),
  tl: table([
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Distrito ng Columbia',
    'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
    'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'Hilagang Carolina', 'Hilagang Dakota', 'Ohio', 'Oklahoma', 'Oregon',
    'Pennsylvania', 'Rhode Island', 'Timog Carolina', 'Timog Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
    'Washington', 'Kanlurang Virginia', 'Wisconsin', 'Wyoming', 'Puerto Rico', 'Guam', 'Kapuluang Birhen ng Estados Unidos', 'Samoang Amerikano',
    'Kapuluan ng Hilagang Mariana',
  ]),
  // machine-drafted, needs native review
  am: table([
    'አላባማ', 'አላስካ', 'አሪዞና', 'አርካንሳስ', 'ካሊፎርኒያ', 'ኮሎራዶ', 'ኮነቲከት', 'ደላዌር', 'ዲስትሪክት ኦፍ ኮሎምቢያ',
    'ፍሎሪዳ', 'ጆርጂያ', 'ሃዋይ', 'አይዳሆ', 'ኢሊኖይ', 'ኢንዲያና', 'አዮዋ', 'ካንሳስ', 'ኬንታኪ', 'ሉዊዚያና', 'ሜይን',
    'ሜሪላንድ', 'ማሳቹሴትስ', 'ሚሺጋን', 'ሚኒሶታ', 'ሚሲሲፒ', 'ሚዙሪ', 'ሞንታና', 'ነብራስካ', 'ኔቫዳ',
    'ኒው ሃምፕሻየር', 'ኒው ጀርሲ', 'ኒው ሜክሲኮ', 'ኒው ዮርክ', 'ሰሜን ካሮላይና', 'ሰሜን ዳኮታ', 'ኦሃዮ', 'ኦክላሆማ', 'ኦሪገን',
    'ፔንሲልቬንያ', 'ሮድ አይላንድ', 'ደቡብ ካሮላይና', 'ደቡብ ዳኮታ', 'ቴነሲ', 'ቴክሳስ', 'ዩታ', 'ቨርሞንት', 'ቨርጂኒያ',
    'ዋሽንግተን', 'ምዕራብ ቨርጂኒያ', 'ዊስኮንሲን', 'ዋዮሚንግ', 'ፖርቶ ሪኮ', 'ጉዋም', 'የአሜሪካ ቨርጂን ደሴቶች', 'የአሜሪካ ሳሞአ',
    'የሰሜን ማሪያና ደሴቶች',
  ]),
  // machine-drafted, needs native review
  hmn: table([
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Cheeb Tsam Columbia',
    'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
    'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
    'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
    'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'Puerto Rico', 'Guam', 'Cov Kob Virgin Asmeskas', 'Asmeskas Samoa',
    'Cov Kob Northern Mariana',
  ]),
}

export function isUsStateCode(code: unknown): code is UsStateCode {
  return typeof code === 'string' && (US_STATE_CODES as readonly string[]).includes(code)
}

/** The state's name in the viewer's language; an unknown code is returned as given. */
export function usStateName(code: string, locale: Locale): string {
  return isUsStateCode(code) ? translate(usStateMessages, locale, code) : code
}

/** Every state picker's options: the code (the value) and its name, in lib/us-states.ts order. */
export function usStateOptions(locale: Locale): Array<{ code: UsStateCode; name: string }> {
  return US_STATES.map((name) => STATE_TO_ABBR[name] as UsStateCode).map((code) => ({ code, name: usStateName(code, locale) }))
}
