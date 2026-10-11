// apps/web/src/lib/i18n-feed-organizations.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Community → Organizations sub-tab (components/panels/organizations-panel.tsx) in the 14 FEED
// locales: its heading, its one-line description, the empty state and the failed-read sentence.
// Look up with orgsT(locale, key) (English fallback, logged as i18n.translation_fallback). The
// organization type on each row comes from the organization vocabulary's own translation
// (orgFormT + orgTypeKey), and the distance from distanceBucketLabel; neither is repeated here.
// Parity: i18n-feed-subtabs.test.ts.
// ht, so, am and hmn are machine-drafted, needs native review: docs/i18n-native-review.md.

import { translate, type Locale } from './i18n'

export interface FeedOrganizationsMessages {
  /** The sub-tab heading. */
  title: string
  subtitle: string
  /** No organization is listed yet. */
  empty: string
  /** The list could not be read (the server's own text goes to the log, never the screen). */
  loadFailed: string
}

export const feedOrganizationsMessages: Record<Locale, FeedOrganizationsMessages> = {
  en: {
    title: 'Local Organizations',
    subtitle: 'Food banks, shelters, clinics, and community organizations near you',
    empty: 'No organizations yet.',
    loadFailed: "We couldn't load organizations right now.",
  },
  es: {
    title: 'Organizaciones locales',
    subtitle: 'Bancos de alimentos, refugios, clínicas y organizaciones comunitarias cerca de ti',
    empty: 'Aún no hay organizaciones.',
    loadFailed: 'No pudimos cargar las organizaciones en este momento.',
  },
  // machine-drafted, needs native review
  ht: {
    title: 'Òganizasyon lokal yo',
    subtitle: 'Bank manje, abri, klinik ak òganizasyon kominotè ki toupre w',
    empty: 'Poko gen òganizasyon.',
    loadFailed: 'Nou pa t kapab chaje òganizasyon yo kounye a.',
  },
  vi: {
    title: 'Tổ chức địa phương',
    subtitle: 'Ngân hàng thực phẩm, nơi tạm trú, phòng khám và các tổ chức cộng đồng gần bạn',
    empty: 'Chưa có tổ chức nào.',
    loadFailed: 'Hiện không thể tải danh sách tổ chức.',
  },
  ar: {
    title: 'المنظمات المحلية',
    subtitle: 'بنوك الطعام والملاجئ والعيادات والمنظمات المجتمعية القريبة منك',
    empty: 'لا توجد منظمات بعد.',
    loadFailed: 'تعذّر تحميل المنظمات الآن.',
  },
  zh: {
    title: '本地组织',
    subtitle: '您附近的食物银行、收容所、诊所和社区组织',
    empty: '暂无组织。',
    loadFailed: '暂时无法加载组织。',
  },
  // machine-drafted, needs native review
  so: {
    title: 'Ururrada deegaanka',
    subtitle: 'Bangiyada cuntada, hoyga, rugaha caafimaadka iyo ururrada bulshada ee kuu dhow',
    empty: 'Weli ma jiraan ururro.',
    loadFailed: 'Hadda lama soo shubi karo ururrada.',
  },
  fr: {
    title: 'Organisations locales',
    subtitle: 'Banques alimentaires, refuges, cliniques et organisations communautaires près de chez vous',
    empty: 'Aucune organisation pour le moment.',
    loadFailed: 'Impossible de charger les organisations pour le moment.',
  },
  pt: {
    title: 'Organizações locais',
    subtitle: 'Bancos de alimentos, abrigos, clínicas e organizações comunitárias perto de você',
    empty: 'Ainda não há organizações.',
    loadFailed: 'Não foi possível carregar as organizações agora.',
  },
  ru: {
    title: 'Местные организации',
    subtitle: 'Продовольственные банки, приюты, клиники и общественные организации рядом с вами',
    empty: 'Организаций пока нет.',
    loadFailed: 'Сейчас не удалось загрузить организации.',
  },
  ko: {
    title: '지역 단체',
    subtitle: '가까운 푸드뱅크, 쉼터, 진료소 및 지역사회 단체',
    empty: '아직 단체가 없습니다.',
    loadFailed: '지금은 단체 목록을 불러올 수 없습니다.',
  },
  tl: {
    title: 'Mga lokal na organisasyon',
    subtitle: 'Mga food bank, silungan, klinika, at organisasyong pangkomunidad na malapit sa iyo',
    empty: 'Wala pang organisasyon.',
    loadFailed: 'Hindi ma-load ang mga organisasyon ngayon.',
  },
  // machine-drafted, needs native review
  am: {
    title: 'የአካባቢ ድርጅቶች',
    subtitle: 'በአቅራቢያዎ ያሉ የምግብ ባንኮች፣ መጠለያዎች፣ ክሊኒኮች እና የማኅበረሰብ ድርጅቶች',
    empty: 'እስካሁን ምንም ድርጅት የለም።',
    loadFailed: 'ድርጅቶቹን አሁን መጫን አልተቻለም።',
  },
  // machine-drafted, needs native review
  hmn: {
    title: 'Cov koom haum hauv zos',
    subtitle: 'Cov txhab nyiaj zaub mov, chaw nyob ib ntus, tsev kho mob thiab cov koom haum zej zog nyob ze koj',
    empty: 'Tseem tsis tau muaj koom haum.',
    loadFailed: 'Tam sim no thauj tsis tau cov koom haum.',
  },
}

export function orgsT(locale: Locale, key: keyof FeedOrganizationsMessages): string {
  return translate(feedOrganizationsMessages, locale, key)
}
