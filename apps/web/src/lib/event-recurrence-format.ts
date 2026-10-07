// apps/web/src/lib/event-recurrence-format.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A repeat rule in words, in the viewer's language: "Every week on Tuesday and Thursday",
// "Monthly on the second Saturday", "Ends Sat, Apr 10, 2027", and the member-facing notice
// "Sat, Oct 10 cancelled — next: Sat, Oct 24".
//
// Every phrase is a whole-sentence template per locale (RECURRENCE_GRAMMAR) with named slots;
// pieces are never glued together outside a template. The grammar carries what Intl cannot:
// weekday forms inside a phrase (fr "le mardi", pt "às terças-feiras", ru "по вторникам"),
// ordinals that agree with the weekday's gender (pt "no segundo sábado" / "na segunda
// terça-feira"; ru "во второй вторник" / "во вторую субботу" / "во второе воскресенье"), plural
// forms chosen with Intl.PluralRules (Arabic dual "كل أسبوعين"), and weekday names plus the list
// word for ht and hmn, which have no CLDR data. Lists use Intl.ListFormat when the runtime has
// the locale and the grammar's own conjunction when it does not.
//
// Native-speaker review needed: every ht, so, am and hmn phrase; the pt and ru gender / case
// tables; the ar dual and plural forms.

import type { Locale } from './i18n'
import { eventFormT, formatMessage } from './i18n-event-forms'
import { browserTimeZone, formatCalendarDate, formatShortDate, intlLocale, isKnownTimeZone } from './event-time'
import {
  isMonthlyDayRule,
  WEEKDAY_DISPLAY_ORDER,
  type NthOfPeriod,
  type RecurrenceRule,
  type WeekdayCode,
} from './event-recurrence'

type Weekdays = Record<WeekdayCode, string>
type Gender = 'm' | 'f' | 'n'
/** An ordinal that agrees with the weekday's gender; `m` is the fallback. */
type GenderForms = { m: string; f?: string; n?: string }
/** Intl.PluralRules categories; `other` is always present. */
export type PluralForms = { other: string; zero?: string; one?: string; two?: string; few?: string; many?: string }
type NthKey = '1' | '2' | '3' | '4' | '-1'

export interface RecurrenceGrammar {
  /** Standalone weekday names (checkbox labels). */
  weekday: Weekdays
  /** Short weekday names (compact checkbox chips). */
  weekdayShort: Weekdays
  /** A weekday as it reads inside the weekly phrase. */
  weeklyDay: Weekdays
  /** A weekday as it reads after an ordinal (ru accusative); defaults to `weekday`. */
  ordinalDay?: Weekdays
  /** Grammatical gender of each weekday, for locales whose ordinals agree with it. */
  dayGender?: Record<WeekdayCode, Gender>
  /** 1st..4th and last, each with the article / preposition the monthly phrase needs. */
  ordinal: Record<NthKey, string | GenderForms>
  /** '{ordinal} {day}' or '{day} {ordinal}'. */
  ordinalWeekday: string
  /** One day of the month: 'day {n}'. */
  monthDay: string
  /** Every week: '{days}'. */
  weekly: string
  /** Every n (2..4) weeks: '{n}', '{days}' (a dual form may spell the number out). */
  weeklyInterval: PluralForms
  /** Monthly by weekday position: '{days}' = list of ordinalWeekday phrases. */
  monthlyByDay: string
  /** Monthly by day number: '{days}' = list of monthDay phrases. */
  monthlyByMonthDay: string
  /** Series end on a date: '{date}'. */
  until: string
  /** Series end after n dates: '{n}' (a form may spell the number out). */
  count: PluralForms
  /** No end. */
  never: string
  /** List separators used when Intl.ListFormat lacks the locale. */
  listComma: string
  listAnd: string
}

const EN_DAYS: Weekdays = { mo: 'Monday', tu: 'Tuesday', we: 'Wednesday', th: 'Thursday', fr: 'Friday', sa: 'Saturday', su: 'Sunday' }

export const RECURRENCE_GRAMMAR: Record<Locale, RecurrenceGrammar> = {
  en: {
    weekday: EN_DAYS,
    weekdayShort: { mo: 'Mon', tu: 'Tue', we: 'Wed', th: 'Thu', fr: 'Fri', sa: 'Sat', su: 'Sun' },
    weeklyDay: EN_DAYS,
    ordinal: { '1': 'first', '2': 'second', '3': 'third', '4': 'fourth', '-1': 'last' },
    ordinalWeekday: 'the {ordinal} {day}',
    monthDay: 'day {n}',
    weekly: 'Every week on {days}',
    weeklyInterval: { other: 'Every {n} weeks on {days}' },
    monthlyByDay: 'Monthly on {days}',
    monthlyByMonthDay: 'Monthly on {days}',
    until: 'Ends {date}',
    count: { one: 'Ends after {n} date', other: 'Ends after {n} dates' },
    never: 'No end date',
    listComma: ', ',
    listAnd: ' and ',
  },
  es: {
    weekday: { mo: 'lunes', tu: 'martes', we: 'miércoles', th: 'jueves', fr: 'viernes', sa: 'sábado', su: 'domingo' },
    weekdayShort: { mo: 'lun', tu: 'mar', we: 'mié', th: 'jue', fr: 'vie', sa: 'sáb', su: 'dom' },
    weeklyDay: { mo: 'los lunes', tu: 'los martes', we: 'los miércoles', th: 'los jueves', fr: 'los viernes', sa: 'los sábados', su: 'los domingos' },
    ordinal: { '1': 'el primer', '2': 'el segundo', '3': 'el tercer', '4': 'el cuarto', '-1': 'el último' },
    ordinalWeekday: '{ordinal} {day}',
    monthDay: 'el día {n}',
    weekly: 'Cada semana, {days}',
    weeklyInterval: { other: 'Cada {n} semanas, {days}' },
    monthlyByDay: 'Cada mes, {days}',
    monthlyByMonthDay: 'Cada mes, {days}',
    until: 'Termina el {date}',
    count: { one: 'Termina tras {n} fecha', other: 'Termina tras {n} fechas' },
    never: 'Sin fecha de fin',
    listComma: ', ',
    listAnd: ' y ',
  },
  ht: {
    weekday: { mo: 'lendi', tu: 'madi', we: 'mèkredi', th: 'jedi', fr: 'vandredi', sa: 'samdi', su: 'dimanch' },
    weekdayShort: { mo: 'len', tu: 'mad', we: 'mèk', th: 'jed', fr: 'van', sa: 'sam', su: 'dim' },
    weeklyDay: { mo: 'lendi', tu: 'madi', we: 'mèkredi', th: 'jedi', fr: 'vandredi', sa: 'samdi', su: 'dimanch' },
    ordinal: { '1': 'premye', '2': 'dezyèm', '3': 'twazyèm', '4': 'katriyèm', '-1': 'dènye' },
    ordinalWeekday: '{ordinal} {day}',
    monthDay: 'jou {n}',
    weekly: 'Chak semèn, {days}',
    weeklyInterval: { other: 'Chak {n} semèn, {days}' },
    monthlyByDay: 'Chak mwa, {days}',
    monthlyByMonthDay: 'Chak mwa, {days}',
    until: 'Fini {date}',
    count: { other: 'Fini apre {n} dat' },
    never: 'Pa gen dat pou fini',
    listComma: ', ',
    listAnd: ' ak ',
  },
  vi: {
    weekday: { mo: 'Thứ Hai', tu: 'Thứ Ba', we: 'Thứ Tư', th: 'Thứ Năm', fr: 'Thứ Sáu', sa: 'Thứ Bảy', su: 'Chủ Nhật' },
    weekdayShort: { mo: 'Thứ 2', tu: 'Thứ 3', we: 'Thứ 4', th: 'Thứ 5', fr: 'Thứ 6', sa: 'Thứ 7', su: 'CN' },
    weeklyDay: { mo: 'Thứ Hai', tu: 'Thứ Ba', we: 'Thứ Tư', th: 'Thứ Năm', fr: 'Thứ Sáu', sa: 'Thứ Bảy', su: 'Chủ Nhật' },
    ordinal: { '1': 'đầu tiên', '2': 'thứ hai', '3': 'thứ ba', '4': 'thứ tư', '-1': 'cuối cùng' },
    ordinalWeekday: '{day} {ordinal}',
    monthDay: 'ngày {n}',
    weekly: 'Hằng tuần vào {days}',
    weeklyInterval: { other: '{n} tuần một lần vào {days}' },
    monthlyByDay: 'Hằng tháng vào {days}',
    monthlyByMonthDay: 'Hằng tháng vào {days}',
    until: 'Kết thúc {date}',
    count: { other: 'Kết thúc sau {n} lần' },
    never: 'Không có ngày kết thúc',
    listComma: ', ',
    listAnd: ' và ',
  },
  ar: {
    weekday: { mo: 'الاثنين', tu: 'الثلاثاء', we: 'الأربعاء', th: 'الخميس', fr: 'الجمعة', sa: 'السبت', su: 'الأحد' },
    weekdayShort: { mo: 'الاثنين', tu: 'الثلاثاء', we: 'الأربعاء', th: 'الخميس', fr: 'الجمعة', sa: 'السبت', su: 'الأحد' },
    weeklyDay: { mo: 'الاثنين', tu: 'الثلاثاء', we: 'الأربعاء', th: 'الخميس', fr: 'الجمعة', sa: 'السبت', su: 'الأحد' },
    ordinal: { '1': 'الأول', '2': 'الثاني', '3': 'الثالث', '4': 'الرابع', '-1': 'الأخير' },
    ordinalWeekday: '{day} {ordinal}',
    monthDay: 'اليوم {n}',
    weekly: 'كل أسبوع: {days}',
    // Dual: "every two weeks" is one word, no numeral.
    weeklyInterval: { two: 'كل أسبوعين: {days}', few: 'كل {n} أسابيع: {days}', other: 'كل {n} أسبوع: {days}' },
    monthlyByDay: 'كل شهر: {days}',
    monthlyByMonthDay: 'كل شهر: {days}',
    until: 'ينتهي في {date}',
    count: {
      one: 'ينتهي بعد موعد واحد',
      two: 'ينتهي بعد موعدين',
      few: 'ينتهي بعد {n} مواعيد',
      many: 'ينتهي بعد {n} موعدًا',
      other: 'ينتهي بعد {n} موعد',
    },
    never: 'بلا تاريخ انتهاء',
    listComma: '، ',
    listAnd: ' و',
  },
  zh: {
    weekday: { mo: '星期一', tu: '星期二', we: '星期三', th: '星期四', fr: '星期五', sa: '星期六', su: '星期日' },
    weekdayShort: { mo: '周一', tu: '周二', we: '周三', th: '周四', fr: '周五', sa: '周六', su: '周日' },
    weeklyDay: { mo: '星期一', tu: '星期二', we: '星期三', th: '星期四', fr: '星期五', sa: '星期六', su: '星期日' },
    ordinal: { '1': '第一个', '2': '第二个', '3': '第三个', '4': '第四个', '-1': '最后一个' },
    ordinalWeekday: '{ordinal}{day}',
    monthDay: '{n}日',
    weekly: '每周{days}',
    weeklyInterval: { other: '每{n}周{days}' },
    monthlyByDay: '每月{days}',
    monthlyByMonthDay: '每月{days}',
    until: '{date}结束',
    count: { other: '共{n}次后结束' },
    never: '无结束日期',
    listComma: '、',
    listAnd: '和',
  },
  so: {
    weekday: { mo: 'Isniin', tu: 'Talaado', we: 'Arbaco', th: 'Khamiis', fr: 'Jimco', sa: 'Sabti', su: 'Axad' },
    weekdayShort: { mo: 'Isn', tu: 'Tldo', we: 'Arbc', th: 'Khms', fr: 'Jmc', sa: 'Sbti', su: 'Axd' },
    weeklyDay: { mo: 'Isniin', tu: 'Talaado', we: 'Arbaco', th: 'Khamiis', fr: 'Jimco', sa: 'Sabti', su: 'Axad' },
    ordinalDay: { mo: 'Isniinta', tu: 'Talaadada', we: 'Arbacada', th: 'Khamiista', fr: 'Jimcaha', sa: 'Sabtida', su: 'Axadda' },
    ordinal: { '1': 'ugu horreysa', '2': 'labaad', '3': 'saddexaad', '4': 'afraad', '-1': 'ugu dambeysa' },
    ordinalWeekday: '{day} {ordinal}',
    monthDay: 'maalinta {n}',
    weekly: 'Toddobaad kasta: {days}',
    weeklyInterval: { other: '{n} toddobaad kasta: {days}' },
    monthlyByDay: 'Bil kasta: {days}',
    monthlyByMonthDay: 'Bil kasta: {days}',
    until: 'Wuxuu dhammaanayaa {date}',
    count: { other: 'Wuxuu dhammaanayaa {n} jeer kadib' },
    never: 'Taariikh dhammaad ma leh',
    listComma: ', ',
    listAnd: ' iyo ',
  },
  fr: {
    weekday: { mo: 'lundi', tu: 'mardi', we: 'mercredi', th: 'jeudi', fr: 'vendredi', sa: 'samedi', su: 'dimanche' },
    weekdayShort: { mo: 'lun.', tu: 'mar.', we: 'mer.', th: 'jeu.', fr: 'ven.', sa: 'sam.', su: 'dim.' },
    weeklyDay: { mo: 'le lundi', tu: 'le mardi', we: 'le mercredi', th: 'le jeudi', fr: 'le vendredi', sa: 'le samedi', su: 'le dimanche' },
    ordinal: { '1': 'le premier', '2': 'le deuxième', '3': 'le troisième', '4': 'le quatrième', '-1': 'le dernier' },
    ordinalWeekday: '{ordinal} {day}',
    monthDay: 'le {n}',
    weekly: 'Toutes les semaines, {days}',
    weeklyInterval: { other: 'Toutes les {n} semaines, {days}' },
    monthlyByDay: 'Tous les mois, {days}',
    monthlyByMonthDay: 'Tous les mois, {days}',
    until: 'Jusqu’au {date}',
    count: { one: 'Se termine après {n} date', other: 'Se termine après {n} dates' },
    never: 'Sans date de fin',
    listComma: ', ',
    listAnd: ' et ',
  },
  pt: {
    weekday: { mo: 'segunda-feira', tu: 'terça-feira', we: 'quarta-feira', th: 'quinta-feira', fr: 'sexta-feira', sa: 'sábado', su: 'domingo' },
    weekdayShort: { mo: 'seg.', tu: 'ter.', we: 'qua.', th: 'qui.', fr: 'sex.', sa: 'sáb.', su: 'dom.' },
    weeklyDay: {
      mo: 'às segundas-feiras',
      tu: 'às terças-feiras',
      we: 'às quartas-feiras',
      th: 'às quintas-feiras',
      fr: 'às sextas-feiras',
      sa: 'aos sábados',
      su: 'aos domingos',
    },
    // segunda..sexta-feira are feminine, sábado and domingo masculine.
    dayGender: { mo: 'f', tu: 'f', we: 'f', th: 'f', fr: 'f', sa: 'm', su: 'm' },
    ordinal: {
      '1': { m: 'no primeiro', f: 'na primeira' },
      '2': { m: 'no segundo', f: 'na segunda' },
      '3': { m: 'no terceiro', f: 'na terceira' },
      '4': { m: 'no quarto', f: 'na quarta' },
      '-1': { m: 'no último', f: 'na última' },
    },
    ordinalWeekday: '{ordinal} {day}',
    monthDay: 'no dia {n}',
    weekly: 'Toda semana, {days}',
    weeklyInterval: { other: 'A cada {n} semanas, {days}' },
    monthlyByDay: 'Todo mês, {days}',
    monthlyByMonthDay: 'Todo mês, {days}',
    until: 'Termina em {date}',
    count: { one: 'Termina após {n} data', other: 'Termina após {n} datas' },
    never: 'Sem data de término',
    listComma: ', ',
    listAnd: ' e ',
  },
  ru: {
    weekday: { mo: 'понедельник', tu: 'вторник', we: 'среда', th: 'четверг', fr: 'пятница', sa: 'суббота', su: 'воскресенье' },
    weekdayShort: { mo: 'пн', tu: 'вт', we: 'ср', th: 'чт', fr: 'пт', sa: 'сб', su: 'вс' },
    // "по" + dative plural: every <weekday>.
    weeklyDay: {
      mo: 'по понедельникам',
      tu: 'по вторникам',
      we: 'по средам',
      th: 'по четвергам',
      fr: 'по пятницам',
      sa: 'по субботам',
      su: 'по воскресеньям',
    },
    // Accusative after "в": "в субботу".
    ordinalDay: { mo: 'понедельник', tu: 'вторник', we: 'среду', th: 'четверг', fr: 'пятницу', sa: 'субботу', su: 'воскресенье' },
    dayGender: { mo: 'm', tu: 'm', we: 'f', th: 'm', fr: 'f', sa: 'f', su: 'n' },
    ordinal: {
      '1': { m: 'в первый', f: 'в первую', n: 'в первое' },
      '2': { m: 'во второй', f: 'во вторую', n: 'во второе' },
      '3': { m: 'в третий', f: 'в третью', n: 'в третье' },
      '4': { m: 'в четвёртый', f: 'в четвёртую', n: 'в четвёртое' },
      '-1': { m: 'в последний', f: 'в последнюю', n: 'в последнее' },
    },
    ordinalWeekday: '{ordinal} {day}',
    monthDay: '{n}-го числа',
    weekly: 'Каждую неделю {days}',
    weeklyInterval: { few: 'Раз в {n} недели {days}', many: 'Раз в {n} недель {days}', other: 'Раз в {n} недели {days}' },
    monthlyByDay: 'Каждый месяц {days}',
    monthlyByMonthDay: 'Каждый месяц {days}',
    until: 'Окончание: {date}',
    count: { one: 'Всего {n} раз', few: 'Всего {n} раза', many: 'Всего {n} раз', other: 'Всего {n} раза' },
    never: 'Без даты окончания',
    listComma: ', ',
    listAnd: ' и ',
  },
  ko: {
    weekday: { mo: '월요일', tu: '화요일', we: '수요일', th: '목요일', fr: '금요일', sa: '토요일', su: '일요일' },
    weekdayShort: { mo: '월', tu: '화', we: '수', th: '목', fr: '금', sa: '토', su: '일' },
    weeklyDay: { mo: '월요일', tu: '화요일', we: '수요일', th: '목요일', fr: '금요일', sa: '토요일', su: '일요일' },
    ordinal: { '1': '첫째', '2': '둘째', '3': '셋째', '4': '넷째', '-1': '마지막' },
    ordinalWeekday: '{ordinal} {day}',
    monthDay: '{n}일',
    weekly: '매주 {days}',
    weeklyInterval: { other: '{n}주마다 {days}' },
    monthlyByDay: '매월 {days}',
    monthlyByMonthDay: '매월 {days}',
    until: '{date} 종료',
    count: { other: '{n}회 후 종료' },
    never: '종료일 없음',
    listComma: ', ',
    listAnd: ' 및 ',
  },
  tl: {
    weekday: { mo: 'Lunes', tu: 'Martes', we: 'Miyerkules', th: 'Huwebes', fr: 'Biyernes', sa: 'Sabado', su: 'Linggo' },
    weekdayShort: { mo: 'Lun', tu: 'Mar', we: 'Miy', th: 'Huw', fr: 'Biy', sa: 'Sab', su: 'Lin' },
    weeklyDay: { mo: 'Lunes', tu: 'Martes', we: 'Miyerkules', th: 'Huwebes', fr: 'Biyernes', sa: 'Sabado', su: 'Linggo' },
    ordinal: { '1': 'unang', '2': 'ikalawang', '3': 'ikatlong', '4': 'ikaapat na', '-1': 'huling' },
    ordinalWeekday: '{ordinal} {day}',
    monthDay: 'ika-{n} na araw',
    weekly: 'Linggu-linggo tuwing {days}',
    weeklyInterval: { other: 'Kada {n} linggo tuwing {days}' },
    monthlyByDay: 'Buwan-buwan tuwing {days}',
    monthlyByMonthDay: 'Buwan-buwan tuwing {days}',
    until: 'Matatapos sa {date}',
    count: { other: 'Matatapos pagkatapos ng {n} petsa' },
    never: 'Walang petsa ng pagtatapos',
    listComma: ', ',
    listAnd: ' at ',
  },
  am: {
    weekday: { mo: 'ሰኞ', tu: 'ማክሰኞ', we: 'ረቡዕ', th: 'ሐሙስ', fr: 'ዓርብ', sa: 'ቅዳሜ', su: 'እሑድ' },
    weekdayShort: { mo: 'ሰኞ', tu: 'ማክሰ', we: 'ረቡዕ', th: 'ሐሙስ', fr: 'ዓርብ', sa: 'ቅዳሜ', su: 'እሑድ' },
    weeklyDay: { mo: 'ሰኞ', tu: 'ማክሰኞ', we: 'ረቡዕ', th: 'ሐሙስ', fr: 'ዓርብ', sa: 'ቅዳሜ', su: 'እሑድ' },
    ordinal: { '1': 'የመጀመሪያው', '2': 'ሁለተኛው', '3': 'ሦስተኛው', '4': 'አራተኛው', '-1': 'የመጨረሻው' },
    ordinalWeekday: '{ordinal} {day}',
    monthDay: 'ቀን {n}',
    weekly: 'በየሳምንቱ {days}',
    weeklyInterval: { other: 'በየ{n} ሳምንቱ {days}' },
    monthlyByDay: 'በየወሩ {days}',
    monthlyByMonthDay: 'በየወሩ {days}',
    until: 'የሚያበቃው {date}',
    count: { other: 'ከ{n} ጊዜ በኋላ ያበቃል' },
    never: 'የማብቂያ ቀን የለውም',
    listComma: '፣ ',
    listAnd: ' እና ',
  },
  hmn: {
    weekday: { mo: 'Hnub Ib', tu: 'Hnub Ob', we: 'Hnub Peb', th: 'Hnub Plaub', fr: 'Hnub Tsib', sa: 'Hnub Rau', su: 'Hnub Xya' },
    weekdayShort: { mo: 'Ib', tu: 'Ob', we: 'Peb', th: 'Plaub', fr: 'Tsib', sa: 'Rau', su: 'Xya' },
    weeklyDay: { mo: 'Hnub Ib', tu: 'Hnub Ob', we: 'Hnub Peb', th: 'Hnub Plaub', fr: 'Hnub Tsib', sa: 'Hnub Rau', su: 'Hnub Xya' },
    ordinal: { '1': 'thib ib', '2': 'thib ob', '3': 'thib peb', '4': 'thib plaub', '-1': 'kawg' },
    ordinalWeekday: '{day} {ordinal}',
    monthDay: 'hnub tim {n}',
    weekly: 'Txhua lub lim tiam rau {days}',
    weeklyInterval: { other: 'Txhua {n} lub lim tiam rau {days}' },
    monthlyByDay: 'Txhua lub hli rau {days}',
    monthlyByMonthDay: 'Txhua lub hli rau {days}',
    until: 'Xaus rau {date}',
    count: { other: 'Xaus tom qab {n} zaug' },
    never: 'Tsis muaj hnub xaus',
    listComma: ', ',
    listAnd: ' thiab ',
  },
}

function grammar(locale: Locale): RecurrenceGrammar {
  return RECURRENCE_GRAMMAR[locale] ?? RECURRENCE_GRAMMAR.en
}

const pluralRules = new Map<Locale, Intl.PluralRules>()

function pluralForm(forms: PluralForms, n: number, locale: Locale): string {
  let rules = pluralRules.get(locale)
  if (!rules) {
    rules = new Intl.PluralRules(intlLocale(locale))
    pluralRules.set(locale, rules)
  }
  const cat = rules.select(n) as keyof PluralForms
  return forms[cat] ?? forms.other
}

const listFormats = new Map<Locale, { format(items: string[]): string } | null>()

/** "a, b and c" in the locale: Intl.ListFormat where the runtime has the locale, otherwise the
 *  grammar's separators (ht "a, b ak c", hmn "a, b thiab c"). */
export function joinList(items: readonly string[], locale: Locale): string {
  if (items.length <= 1) return items[0] ?? ''
  let lf = listFormats.get(locale)
  if (lf === undefined) {
    const LF = (Intl as unknown as { ListFormat?: typeof Intl.ListFormat }).ListFormat
    const tag = intlLocale(locale)[0]
    lf = LF && LF.supportedLocalesOf(tag).length > 0 ? new LF(tag, { type: 'conjunction', style: 'long' }) : null
    listFormats.set(locale, lf)
  }
  if (lf) return lf.format([...items])
  const g = grammar(locale)
  return items.slice(0, -1).join(g.listComma) + g.listAnd + items[items.length - 1]
}

/** Weekday name for checkboxes and lists ('long' = "Saturday", 'short' = "Sat"). */
export function weekdayName(day: WeekdayCode, locale: Locale, width: 'long' | 'short' = 'long'): string {
  const g = grammar(locale)
  return (width === 'short' ? g.weekdayShort : g.weekday)[day]
}

/** "the second Saturday" / "no segundo sábado" / "во вторую субботу" / "السبت الثاني". */
export function ordinalWeekday(nth: NthOfPeriod, day: WeekdayCode, locale: Locale): string {
  const g = grammar(locale)
  const form = g.ordinal[String(nth) as NthKey]
  const gender = g.dayGender?.[day] ?? 'm'
  const ordinal = typeof form === 'string' ? form : (form[gender] ?? form.m)
  return formatMessage(g.ordinalWeekday, { ordinal, day: (g.ordinalDay ?? g.weekday)[day] })
}

const displayIndex = (d: WeekdayCode) => WEEKDAY_DISPLAY_ORDER.indexOf(d)
const nthIndex = (n: NthOfPeriod) => (n === -1 ? 5 : n)

/** The pattern in words: "Every 2 weeks on Tuesday and Thursday", "Monthly on day 10". Weekdays
 *  are listed Sunday-first, monthly positions first-to-last, days of the month ascending. */
export function formatRecurrence(rule: RecurrenceRule, locale: Locale): string {
  const g = grammar(locale)
  if (rule.frequency === 'weekly') {
    const days = [...rule.byDay].map((e) => e.day).sort((a, b) => displayIndex(a) - displayIndex(b))
    const list = joinList(days.map((d) => g.weeklyDay[d]), locale)
    const n = rule.interval ?? 1
    return n === 1
      ? formatMessage(g.weekly, { days: list })
      : formatMessage(pluralForm(g.weeklyInterval, n, locale), { n, days: list })
  }
  if (isMonthlyDayRule(rule)) {
    const days = [...rule.byMonthDay].sort((a, b) => a - b).map((n) => formatMessage(g.monthDay, { n }))
    return formatMessage(g.monthlyByMonthDay, { days: joinList(days, locale) })
  }
  const entries = [...rule.byDay].sort(
    (a, b) => nthIndex(a.nthOfPeriod) - nthIndex(b.nthOfPeriod) || displayIndex(a.day) - displayIndex(b.day),
  )
  const days = entries.map((e) => ordinalWeekday(e.nthOfPeriod, e.day, locale))
  return formatMessage(g.monthlyByDay, { days: joinList(days, locale) })
}

/** How the series ends: "Ends Fri, Apr 30, 2027" / "Ends after 10 dates" / "No end date". */
export function formatSeriesEnd(rule: RecurrenceRule, locale: Locale): string {
  const g = grammar(locale)
  if (rule.until !== undefined) return formatMessage(g.until, { date: formatCalendarDate(rule.until.slice(0, 10), locale) })
  if (rule.count !== undefined) return formatMessage(pluralForm(g.count, rule.count, locale), { n: rule.count })
  return g.never
}

/**
 * Member notice for a cancelled date: "Sat, Oct 10 cancelled — next: Sat, Oct 24", or "Sat,
 * Oct 10 cancelled" when no later date is known. Dates are the viewer's local dates, plus the
 * venue's date whenever that reads differently ("Fri, Oct 9 (Venue time: Sat, Oct 10)") — the
 * venue-time rule of formatEventWhen applied to a date — so a remote viewer never reads a date
 * that contradicts the venue-day group the card is filed under.
 */
export function formatCancelledNotice(
  cancelledStartsAt: string,
  nextStartsAt: string | null,
  locale: Locale,
  viewerTz: string = browserTimeZone(),
  venueTz?: string | null,
): string {
  const dateText = (iso: string) => {
    const viewer = formatShortDate(iso, locale, viewerTz)
    if (!venueTz || !isKnownTimeZone(venueTz)) return viewer
    const venue = formatShortDate(iso, locale, venueTz)
    return venue === viewer ? viewer : `${viewer} (${formatMessage(eventFormT(locale, 'whenVenueTime'), { when: venue })})`
  }
  const date = dateText(cancelledStartsAt)
  if (!nextStartsAt) return formatMessage(eventFormT(locale, 'cancelledNoticeNoNext'), { date })
  return formatMessage(eventFormT(locale, 'cancelledNotice'), { date, next: dateText(nextStartsAt) })
}
