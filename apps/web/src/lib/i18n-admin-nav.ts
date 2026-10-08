// apps/web/src/lib/i18n-admin-nav.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Typed dictionary for the admin → member navigation chrome, across the 14 locales of lib/i18n.ts:
// the "Back to feed" bar every admin page shows (organization admins may not read English), the
// "opens in the feed preview tab" notice on "View …" links, and the reasons a row shows instead of a
// link when members cannot see the item. Record<Locale, …> makes a missing locale or key a type error.

import { translate, type Locale } from './i18n'
import type { ReasonCode } from './member-visibility'

export interface AdminNavMessages {
  backToFeed: string
  navLabel: string
  opensInPreviewTab: string
  reasonHidden: string
  reasonInactive: string
  reasonNotApproved: string
  reasonNoUsername: string
  reasonNotFound: string
}

export const adminNavMessages: Record<Locale, AdminNavMessages> = {
  en: {
    backToFeed: 'Back to feed',
    navLabel: 'Community feed',
    opensInPreviewTab: '(opens in the feed preview tab)',
    reasonHidden: 'Hidden from members',
    reasonInactive: 'Inactive — hidden from members',
    reasonNotApproved: 'Not approved — hidden from members',
    reasonNoUsername: 'No username — no public profile',
    reasonNotFound: 'No longer exists',
  },
  es: {
    backToFeed: 'Volver al feed',
    navLabel: 'Feed comunitario',
    opensInPreviewTab: '(se abre en la pestaña de vista previa del feed)',
    reasonHidden: 'Oculto para los miembros',
    reasonInactive: 'Inactivo: oculto para los miembros',
    reasonNotApproved: 'No aprobado: oculto para los miembros',
    reasonNoUsername: 'Sin nombre de usuario: sin perfil público',
    reasonNotFound: 'Ya no existe',
  },
  ht: {
    backToFeed: 'Retounen nan fil la',
    navLabel: 'Fil kominote a',
    opensInPreviewTab: '(ap louvri nan onglè apèsi fil la)',
    reasonHidden: 'Kache pou manm yo',
    reasonInactive: 'Pa aktif — kache pou manm yo',
    reasonNotApproved: 'Pa apwouve — kache pou manm yo',
    reasonNoUsername: 'Pa gen non itilizatè — pa gen pwofil piblik',
    reasonNotFound: 'Li pa egziste ankò',
  },
  vi: {
    backToFeed: 'Quay lại bảng tin',
    navLabel: 'Bảng tin cộng đồng',
    opensInPreviewTab: '(mở trong thẻ xem trước bảng tin)',
    reasonHidden: 'Ẩn với thành viên',
    reasonInactive: 'Ngừng hoạt động — ẩn với thành viên',
    reasonNotApproved: 'Chưa được duyệt — ẩn với thành viên',
    reasonNoUsername: 'Không có tên người dùng — không có hồ sơ công khai',
    reasonNotFound: 'Không còn tồn tại',
  },
  ar: {
    backToFeed: 'العودة إلى الموجز',
    navLabel: 'موجز المجتمع',
    opensInPreviewTab: '(يُفتح في علامة تبويب معاينة الموجز)',
    reasonHidden: 'مخفي عن الأعضاء',
    reasonInactive: 'غير نشط — مخفي عن الأعضاء',
    reasonNotApproved: 'غير معتمد — مخفي عن الأعضاء',
    reasonNoUsername: 'لا يوجد اسم مستخدم — لا يوجد ملف شخصي عام',
    reasonNotFound: 'لم يعد موجودًا',
  },
  zh: {
    backToFeed: '返回动态',
    navLabel: '社区动态',
    opensInPreviewTab: '（在动态预览标签页中打开）',
    reasonHidden: '对成员隐藏',
    reasonInactive: '已停用 — 对成员隐藏',
    reasonNotApproved: '未批准 — 对成员隐藏',
    reasonNoUsername: '没有用户名 — 没有公开资料',
    reasonNotFound: '已不存在',
  },
  so: {
    backToFeed: 'Ku noqo bogga bulshada',
    navLabel: 'Bogga bulshada',
    opensInPreviewTab: '(waxay ka furmaysaa tab-ka horudhaca bogga)',
    reasonHidden: 'Laga qariyay xubnaha',
    reasonInactive: 'Aan firfircoonayn — laga qariyay xubnaha',
    reasonNotApproved: 'Lama ansixin — laga qariyay xubnaha',
    reasonNoUsername: 'Magac isticmaale ma leh — bog dadweyne ma leh',
    reasonNotFound: 'Hadda ma jiro',
  },
  fr: {
    backToFeed: 'Retour au fil',
    navLabel: 'Fil de la communauté',
    opensInPreviewTab: '(s’ouvre dans l’onglet d’aperçu du fil)',
    reasonHidden: 'Masqué aux membres',
    reasonInactive: 'Inactif — masqué aux membres',
    reasonNotApproved: 'Non approuvé — masqué aux membres',
    reasonNoUsername: 'Aucun nom d’utilisateur — pas de profil public',
    reasonNotFound: 'N’existe plus',
  },
  pt: {
    backToFeed: 'Voltar ao feed',
    navLabel: 'Feed da comunidade',
    opensInPreviewTab: '(abre na aba de pré-visualização do feed)',
    reasonHidden: 'Oculto para os membros',
    reasonInactive: 'Inativo — oculto para os membros',
    reasonNotApproved: 'Não aprovado — oculto para os membros',
    reasonNoUsername: 'Sem nome de usuário — sem perfil público',
    reasonNotFound: 'Não existe mais',
  },
  ru: {
    backToFeed: 'Назад к ленте',
    navLabel: 'Лента сообщества',
    opensInPreviewTab: '(откроется во вкладке предпросмотра ленты)',
    reasonHidden: 'Скрыто от участников',
    reasonInactive: 'Неактивно — скрыто от участников',
    reasonNotApproved: 'Не одобрено — скрыто от участников',
    reasonNoUsername: 'Нет имени пользователя — нет публичного профиля',
    reasonNotFound: 'Больше не существует',
  },
  ko: {
    backToFeed: '피드로 돌아가기',
    navLabel: '커뮤니티 피드',
    opensInPreviewTab: '(피드 미리보기 탭에서 열림)',
    reasonHidden: '회원에게 숨겨짐',
    reasonInactive: '비활성 — 회원에게 숨겨짐',
    reasonNotApproved: '승인되지 않음 — 회원에게 숨겨짐',
    reasonNoUsername: '사용자 이름 없음 — 공개 프로필 없음',
    reasonNotFound: '더 이상 존재하지 않음',
  },
  tl: {
    backToFeed: 'Bumalik sa feed',
    navLabel: 'Feed ng komunidad',
    opensInPreviewTab: '(magbubukas sa tab ng preview ng feed)',
    reasonHidden: 'Nakatago sa mga miyembro',
    reasonInactive: 'Hindi aktibo — nakatago sa mga miyembro',
    reasonNotApproved: 'Hindi aprubado — nakatago sa mga miyembro',
    reasonNoUsername: 'Walang username — walang pampublikong profile',
    reasonNotFound: 'Wala na',
  },
  am: {
    backToFeed: 'ወደ ማህበረሰብ ገጽ ተመለስ',
    navLabel: 'የማህበረሰብ ገጽ',
    opensInPreviewTab: '(በገጹ ቅድመ እይታ ትር ይከፈታል)',
    reasonHidden: 'ከአባላት ተደብቋል',
    reasonInactive: 'ንቁ ያልሆነ — ከአባላት ተደብቋል',
    reasonNotApproved: 'ያልጸደቀ — ከአባላት ተደብቋል',
    reasonNoUsername: 'የተጠቃሚ ስም የለም — ይፋዊ መገለጫ የለም',
    reasonNotFound: 'ከአሁን በኋላ የለም',
  },
  hmn: {
    backToFeed: 'Rov qab mus rau zej zog',
    navLabel: 'Zej zog',
    opensInPreviewTab: '(qhib rau hauv lub tab saib ua ntej)',
    reasonHidden: 'Zais ntawm cov tswv cuab',
    reasonInactive: 'Kaw — zais ntawm cov tswv cuab',
    reasonNotApproved: 'Tsis tau pom zoo — zais ntawm cov tswv cuab',
    reasonNoUsername: 'Tsis muaj lub npe siv — tsis muaj profile pej xeem',
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
  no_username: 'reasonNoUsername',
  not_found: 'reasonNotFound',
}

/** The text a row shows, in place of a "View …" link, when members cannot see the item. */
export function memberReasonText(locale: Locale, reason: ReasonCode): string {
  return adminNavT(locale, REASON_KEY[reason])
}
