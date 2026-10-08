// apps/web/src/lib/i18n-admin-nav.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Typed dictionary for the admin → member navigation chrome, across the 14 locales of lib/i18n.ts:
// the "Back to feed" bar (its landmark is named for the region — "Leave admin" — the link for the
// destination) every admin page shows (organization admins may not read English), the
// "opens in the feed preview tab" notice on "View …" links, and the reasons a row shows instead of a
// link when members cannot see the item. Record<Locale, …> makes a missing locale or key a type error.

import { translate, type Locale } from './i18n'
import type { ReasonCode } from './member-visibility'

export interface AdminNavMessages {
  backToFeed: string
  /** Name of the bar's nav landmark (the region, not the destination). */
  navLabel: string
  opensInPreviewTab: string
  reasonHidden: string
  reasonInactive: string
  reasonNotApproved: string
  reasonNotFound: string
}

export const adminNavMessages: Record<Locale, AdminNavMessages> = {
  en: {
    backToFeed: 'Back to feed',
    navLabel: 'Leave admin',
    opensInPreviewTab: '(opens in the feed preview tab)',
    reasonHidden: 'Hidden from members',
    reasonInactive: 'Inactive — hidden from members',
    reasonNotApproved: 'Not approved — hidden from members',
    reasonNotFound: 'No longer exists',
  },
  es: {
    backToFeed: 'Volver al feed',
    navLabel: 'Salir de la administración',
    opensInPreviewTab: '(se abre en la pestaña de vista previa del feed)',
    reasonHidden: 'Oculto para los miembros',
    reasonInactive: 'Inactivo: oculto para los miembros',
    reasonNotApproved: 'No aprobado: oculto para los miembros',
    reasonNotFound: 'Ya no existe',
  },
  ht: {
    backToFeed: 'Retounen nan fil la',
    navLabel: 'Kite administrasyon an',
    opensInPreviewTab: '(ap louvri nan onglè apèsi fil la)',
    reasonHidden: 'Kache pou manm yo',
    reasonInactive: 'Pa aktif — kache pou manm yo',
    reasonNotApproved: 'Pa apwouve — kache pou manm yo',
    reasonNotFound: 'Li pa egziste ankò',
  },
  vi: {
    backToFeed: 'Quay lại bảng tin',
    navLabel: 'Rời khỏi trang quản trị',
    opensInPreviewTab: '(mở trong thẻ xem trước bảng tin)',
    reasonHidden: 'Ẩn với thành viên',
    reasonInactive: 'Ngừng hoạt động — ẩn với thành viên',
    reasonNotApproved: 'Chưa được duyệt — ẩn với thành viên',
    reasonNotFound: 'Không còn tồn tại',
  },
  ar: {
    backToFeed: 'العودة إلى الموجز',
    navLabel: 'مغادرة الإدارة',
    opensInPreviewTab: '(يُفتح في علامة تبويب معاينة الموجز)',
    reasonHidden: 'مخفي عن الأعضاء',
    reasonInactive: 'غير نشط — مخفي عن الأعضاء',
    reasonNotApproved: 'غير معتمد — مخفي عن الأعضاء',
    reasonNotFound: 'لم يعد موجودًا',
  },
  zh: {
    backToFeed: '返回动态',
    navLabel: '离开管理',
    opensInPreviewTab: '（在动态预览标签页中打开）',
    reasonHidden: '对成员隐藏',
    reasonInactive: '已停用 — 对成员隐藏',
    reasonNotApproved: '未批准 — 对成员隐藏',
    reasonNotFound: '已不存在',
  },
  so: {
    backToFeed: 'Ku noqo bogga bulshada',
    navLabel: 'Ka bax maamulka',
    opensInPreviewTab: '(waxay ka furmaysaa tab-ka horudhaca bogga)',
    reasonHidden: 'Laga qariyay xubnaha',
    reasonInactive: 'Aan firfircoonayn — laga qariyay xubnaha',
    reasonNotApproved: 'Lama ansixin — laga qariyay xubnaha',
    reasonNotFound: 'Hadda ma jiro',
  },
  fr: {
    backToFeed: 'Retour au fil',
    navLabel: 'Quitter l’administration',
    opensInPreviewTab: '(s’ouvre dans l’onglet d’aperçu du fil)',
    reasonHidden: 'Masqué aux membres',
    reasonInactive: 'Inactif — masqué aux membres',
    reasonNotApproved: 'Non approuvé — masqué aux membres',
    reasonNotFound: 'N’existe plus',
  },
  pt: {
    backToFeed: 'Voltar ao feed',
    navLabel: 'Sair da administração',
    opensInPreviewTab: '(abre na aba de pré-visualização do feed)',
    reasonHidden: 'Oculto para os membros',
    reasonInactive: 'Inativo — oculto para os membros',
    reasonNotApproved: 'Não aprovado — oculto para os membros',
    reasonNotFound: 'Não existe mais',
  },
  ru: {
    backToFeed: 'Назад к ленте',
    navLabel: 'Выйти из администрирования',
    opensInPreviewTab: '(откроется во вкладке предпросмотра ленты)',
    reasonHidden: 'Скрыто от участников',
    reasonInactive: 'Неактивно — скрыто от участников',
    reasonNotApproved: 'Не одобрено — скрыто от участников',
    reasonNotFound: 'Больше не существует',
  },
  ko: {
    backToFeed: '피드로 돌아가기',
    navLabel: '관리자 화면 나가기',
    opensInPreviewTab: '(피드 미리보기 탭에서 열림)',
    reasonHidden: '회원에게 숨겨짐',
    reasonInactive: '비활성 — 회원에게 숨겨짐',
    reasonNotApproved: '승인되지 않음 — 회원에게 숨겨짐',
    reasonNotFound: '더 이상 존재하지 않음',
  },
  tl: {
    backToFeed: 'Bumalik sa feed',
    navLabel: 'Umalis sa admin',
    opensInPreviewTab: '(magbubukas sa tab ng preview ng feed)',
    reasonHidden: 'Nakatago sa mga miyembro',
    reasonInactive: 'Hindi aktibo — nakatago sa mga miyembro',
    reasonNotApproved: 'Hindi aprubado — nakatago sa mga miyembro',
    reasonNotFound: 'Wala na',
  },
  am: {
    backToFeed: 'ወደ ማህበረሰብ ገጽ ተመለስ',
    navLabel: 'ከአስተዳደር ውጣ',
    opensInPreviewTab: '(በገጹ ቅድመ እይታ ትር ይከፈታል)',
    reasonHidden: 'ከአባላት ተደብቋል',
    reasonInactive: 'ንቁ ያልሆነ — ከአባላት ተደብቋል',
    reasonNotApproved: 'ያልጸደቀ — ከአባላት ተደብቋል',
    reasonNotFound: 'ከአሁን በኋላ የለም',
  },
  hmn: {
    backToFeed: 'Rov qab mus rau zej zog',
    navLabel: 'Tawm ntawm admin',
    opensInPreviewTab: '(qhib rau hauv lub tab saib ua ntej)',
    reasonHidden: 'Zais ntawm cov tswv cuab',
    reasonInactive: 'Kaw — zais ntawm cov tswv cuab',
    reasonNotApproved: 'Tsis tau pom zoo — zais ntawm cov tswv cuab',
    reasonNotFound: 'Tsis muaj lawm',
  },
}

/** Looks up an admin-nav string with the shared EN fallback. */
export function adminNavT(locale: Locale, key: keyof AdminNavMessages): string {
  return translate(adminNavMessages, locale, key)
}

const REASON_KEY: Record<ReasonCode, keyof AdminNavMessages> = {
  hidden: 'reasonHidden',
  inactive: 'reasonInactive',
  not_approved: 'reasonNotApproved',
  not_found: 'reasonNotFound',
}

/** The text a row shows, in place of a "View …" link, when members cannot see the item. */
export function memberReasonText(locale: Locale, reason: ReasonCode): string {
  return adminNavT(locale, REASON_KEY[reason])
}
