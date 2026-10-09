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
  /** Event rows: the event is retired (assistance_events.is_active = false). */
  reasonRetired: string
  /** Event rows: its organization is inactive. */
  reasonOrgInactive: string
  /** Event rows: no date that is not ended and still shown. */
  reasonNoUpcoming: string
  /** Event rows: the link to the event in the members' Events list. */
  viewInFeed: string
  /** Event rows: not listed yet; {date} = the venue-local date it will be. */
  appearsInFeed: string
  /** Map rows: the link to the item's pin on the members' map. */
  viewOnMap: string
  /** Map rows: the item has no location, so the map draws no pin. */
  reasonNoLocation: string
  /** Map rows: the safety alert is past its expiry. */
  reasonExpired: string
  /** Member surfaces (admins only): the link that opens the item in the admin screen. */
  editInAdmin: string
  /** Appended to the "Edit in admin" accessible name: where the link opens. */
  opensInAdminTab: string
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
    reasonRetired: 'Retired — not in the feed',
    reasonOrgInactive: 'Organization inactive — not in the feed',
    reasonNoUpcoming: 'No upcoming dates — not in the feed',
    viewInFeed: 'View in feed',
    appearsInFeed: 'Appears in feed {date}',
    viewOnMap: 'View on map',
    reasonNoLocation: 'No location — not on the map',
    reasonExpired: 'Expired — not on the map',
    editInAdmin: 'Edit in admin',
    opensInAdminTab: '(opens in the admin tab)',
  },
  es: {
    backToFeed: 'Volver al feed',
    navLabel: 'Salir de la administración',
    opensInPreviewTab: '(se abre en la pestaña de vista previa del feed)',
    reasonHidden: 'Oculto para los miembros',
    reasonInactive: 'Inactivo: oculto para los miembros',
    reasonNotApproved: 'No aprobado: oculto para los miembros',
    reasonNotFound: 'Ya no existe',
    reasonRetired: 'Retirado: no aparece en el feed',
    reasonOrgInactive: 'Organización inactiva: no aparece en el feed',
    reasonNoUpcoming: 'Sin fechas próximas: no aparece en el feed',
    viewInFeed: 'Ver en el feed',
    appearsInFeed: 'Aparece en el feed el {date}',
    viewOnMap: 'Ver en el mapa',
    reasonNoLocation: 'Sin ubicación: no aparece en el mapa',
    reasonExpired: 'Vencida: no aparece en el mapa',
    editInAdmin: 'Editar en administración',
    opensInAdminTab: '(se abre en la pestaña de administración)',
  },
  ht: {
    backToFeed: 'Retounen nan fil la',
    navLabel: 'Kite administrasyon an',
    opensInPreviewTab: '(ap louvri nan onglè apèsi fil la)',
    reasonHidden: 'Kache pou manm yo',
    reasonInactive: 'Pa aktif — kache pou manm yo',
    reasonNotApproved: 'Pa apwouve — kache pou manm yo',
    reasonNotFound: 'Li pa egziste ankò',
    reasonRetired: 'Retire — pa nan fil la',
    reasonOrgInactive: 'Òganizasyon an pa aktif — pa nan fil la',
    reasonNoUpcoming: 'Pa gen dat k ap vini — pa nan fil la',
    viewInFeed: 'Gade nan fil la',
    appearsInFeed: 'Ap parèt nan fil la {date}',
    viewOnMap: 'Gade sou kat la',
    reasonNoLocation: 'Pa gen kote — pa sou kat la',
    reasonExpired: 'Ekspire — pa sou kat la',
    editInAdmin: 'Modifye nan administrasyon an',
    opensInAdminTab: '(ap louvri nan onglè administrasyon an)',
  },
  vi: {
    backToFeed: 'Quay lại bảng tin',
    navLabel: 'Rời khỏi trang quản trị',
    opensInPreviewTab: '(mở trong thẻ xem trước bảng tin)',
    reasonHidden: 'Ẩn với thành viên',
    reasonInactive: 'Ngừng hoạt động — ẩn với thành viên',
    reasonNotApproved: 'Chưa được duyệt — ẩn với thành viên',
    reasonNotFound: 'Không còn tồn tại',
    reasonRetired: 'Đã ngừng — không có trên bảng tin',
    reasonOrgInactive: 'Tổ chức ngừng hoạt động — không có trên bảng tin',
    reasonNoUpcoming: 'Không có ngày sắp tới — không có trên bảng tin',
    viewInFeed: 'Xem trên bảng tin',
    appearsInFeed: 'Xuất hiện trên bảng tin vào {date}',
    viewOnMap: 'Xem trên bản đồ',
    reasonNoLocation: 'Không có vị trí — không có trên bản đồ',
    reasonExpired: 'Đã hết hạn — không có trên bản đồ',
    editInAdmin: 'Chỉnh sửa trong trang quản trị',
    opensInAdminTab: '(mở trong thẻ quản trị)',
  },
  ar: {
    backToFeed: 'العودة إلى الموجز',
    navLabel: 'مغادرة الإدارة',
    opensInPreviewTab: '(يُفتح في علامة تبويب معاينة الموجز)',
    reasonHidden: 'مخفي عن الأعضاء',
    reasonInactive: 'غير نشط — مخفي عن الأعضاء',
    reasonNotApproved: 'غير معتمد — مخفي عن الأعضاء',
    reasonNotFound: 'لم يعد موجودًا',
    reasonRetired: 'متوقف — غير ظاهر في الموجز',
    reasonOrgInactive: 'المنظمة غير نشطة — غير ظاهر في الموجز',
    reasonNoUpcoming: 'لا توجد مواعيد قادمة — غير ظاهر في الموجز',
    viewInFeed: 'عرض في الموجز',
    appearsInFeed: 'يظهر في الموجز في {date}',
    viewOnMap: 'عرض على الخريطة',
    reasonNoLocation: 'لا يوجد موقع — غير ظاهر على الخريطة',
    reasonExpired: 'منتهي الصلاحية — غير ظاهر على الخريطة',
    editInAdmin: 'تعديل في لوحة الإدارة',
    opensInAdminTab: '(يُفتح في علامة تبويب الإدارة)',
  },
  zh: {
    backToFeed: '返回动态',
    navLabel: '离开管理',
    opensInPreviewTab: '（在动态预览标签页中打开）',
    reasonHidden: '对成员隐藏',
    reasonInactive: '已停用 — 对成员隐藏',
    reasonNotApproved: '未批准 — 对成员隐藏',
    reasonNotFound: '已不存在',
    reasonRetired: '已停办 — 不在动态中',
    reasonOrgInactive: '组织已停用 — 不在动态中',
    reasonNoUpcoming: '没有即将到来的日期 — 不在动态中',
    viewInFeed: '在动态中查看',
    appearsInFeed: '将于 {date} 出现在动态中',
    viewOnMap: '在地图上查看',
    reasonNoLocation: '没有位置 — 不在地图上',
    reasonExpired: '已过期 — 不在地图上',
    editInAdmin: '在管理后台编辑',
    opensInAdminTab: '（在管理标签页中打开）',
  },
  so: {
    backToFeed: 'Ku noqo bogga bulshada',
    navLabel: 'Ka bax maamulka',
    opensInPreviewTab: '(waxay ka furmaysaa tab-ka horudhaca bogga)',
    reasonHidden: 'Laga qariyay xubnaha',
    reasonInactive: 'Aan firfircoonayn — laga qariyay xubnaha',
    reasonNotApproved: 'Lama ansixin — laga qariyay xubnaha',
    reasonNotFound: 'Hadda ma jiro',
    reasonRetired: 'La joojiyay — kuma jiro bogga bulshada',
    reasonOrgInactive: 'Ururku ma firfircoona — kuma jiro bogga bulshada',
    reasonNoUpcoming: 'Ma jiraan taariikho soo socda — kuma jiro bogga bulshada',
    viewInFeed: 'Ka eeg bogga bulshada',
    appearsInFeed: 'Wuxuu ka soo muuqan doonaa bogga bulshada {date}',
    viewOnMap: 'Ka eeg khariidadda',
    reasonNoLocation: 'Goob ma leh — kuma jiro khariidadda',
    reasonExpired: 'Wuu dhacay — kuma jiro khariidadda',
    editInAdmin: 'Ka beddel maamulka',
    opensInAdminTab: '(waxay ka furmaysaa tabka maamulka)',
  },
  fr: {
    backToFeed: 'Retour au fil',
    navLabel: 'Quitter l’administration',
    opensInPreviewTab: '(s’ouvre dans l’onglet d’aperçu du fil)',
    reasonHidden: 'Masqué aux membres',
    reasonInactive: 'Inactif — masqué aux membres',
    reasonNotApproved: 'Non approuvé — masqué aux membres',
    reasonNotFound: 'N’existe plus',
    reasonRetired: 'Retiré — absent du fil',
    reasonOrgInactive: 'Organisation inactive — absent du fil',
    reasonNoUpcoming: 'Aucune date à venir — absent du fil',
    viewInFeed: 'Voir dans le fil',
    appearsInFeed: 'Apparaît dans le fil le {date}',
    viewOnMap: 'Voir sur la carte',
    reasonNoLocation: 'Aucun emplacement — absent de la carte',
    reasonExpired: 'Expirée — absente de la carte',
    editInAdmin: 'Modifier dans l’administration',
    opensInAdminTab: '(s’ouvre dans l’onglet d’administration)',
  },
  pt: {
    backToFeed: 'Voltar ao feed',
    navLabel: 'Sair da administração',
    opensInPreviewTab: '(abre na aba de pré-visualização do feed)',
    reasonHidden: 'Oculto para os membros',
    reasonInactive: 'Inativo — oculto para os membros',
    reasonNotApproved: 'Não aprovado — oculto para os membros',
    reasonNotFound: 'Não existe mais',
    reasonRetired: 'Encerrado — fora do feed',
    reasonOrgInactive: 'Organização inativa — fora do feed',
    reasonNoUpcoming: 'Sem datas futuras — fora do feed',
    viewInFeed: 'Ver no feed',
    appearsInFeed: 'Aparece no feed em {date}',
    viewOnMap: 'Ver no mapa',
    reasonNoLocation: 'Sem localização — fora do mapa',
    reasonExpired: 'Expirado — fora do mapa',
    editInAdmin: 'Editar na administração',
    opensInAdminTab: '(abre na aba de administração)',
  },
  ru: {
    backToFeed: 'Назад к ленте',
    navLabel: 'Выйти из администрирования',
    opensInPreviewTab: '(откроется во вкладке предпросмотра ленты)',
    reasonHidden: 'Скрыто от участников',
    reasonInactive: 'Неактивно — скрыто от участников',
    reasonNotApproved: 'Не одобрено — скрыто от участников',
    reasonNotFound: 'Больше не существует',
    reasonRetired: 'Снято — нет в ленте',
    reasonOrgInactive: 'Организация неактивна — нет в ленте',
    reasonNoUpcoming: 'Нет предстоящих дат — нет в ленте',
    viewInFeed: 'Посмотреть в ленте',
    appearsInFeed: 'Появится в ленте {date}',
    viewOnMap: 'Показать на карте',
    reasonNoLocation: 'Нет местоположения — нет на карте',
    reasonExpired: 'Истёк срок — нет на карте',
    editInAdmin: 'Изменить в панели администратора',
    opensInAdminTab: '(откроется во вкладке администратора)',
  },
  ko: {
    backToFeed: '피드로 돌아가기',
    navLabel: '관리자 화면 나가기',
    opensInPreviewTab: '(피드 미리보기 탭에서 열림)',
    reasonHidden: '회원에게 숨겨짐',
    reasonInactive: '비활성 — 회원에게 숨겨짐',
    reasonNotApproved: '승인되지 않음 — 회원에게 숨겨짐',
    reasonNotFound: '더 이상 존재하지 않음',
    reasonRetired: '종료됨 — 피드에 없음',
    reasonOrgInactive: '단체 비활성 — 피드에 없음',
    reasonNoUpcoming: '예정된 날짜 없음 — 피드에 없음',
    viewInFeed: '피드에서 보기',
    appearsInFeed: '{date}에 피드에 표시됨',
    viewOnMap: '지도에서 보기',
    reasonNoLocation: '위치 없음 — 지도에 없음',
    reasonExpired: '만료됨 — 지도에 없음',
    editInAdmin: '관리자에서 편집',
    opensInAdminTab: '(관리자 탭에서 열림)',
  },
  tl: {
    backToFeed: 'Bumalik sa feed',
    navLabel: 'Umalis sa admin',
    opensInPreviewTab: '(magbubukas sa tab ng preview ng feed)',
    reasonHidden: 'Nakatago sa mga miyembro',
    reasonInactive: 'Hindi aktibo — nakatago sa mga miyembro',
    reasonNotApproved: 'Hindi aprubado — nakatago sa mga miyembro',
    reasonNotFound: 'Wala na',
    reasonRetired: 'Itinigil — wala sa feed',
    reasonOrgInactive: 'Hindi aktibo ang organisasyon — wala sa feed',
    reasonNoUpcoming: 'Walang paparating na petsa — wala sa feed',
    viewInFeed: 'Tingnan sa feed',
    appearsInFeed: 'Lalabas sa feed sa {date}',
    viewOnMap: 'Tingnan sa mapa',
    reasonNoLocation: 'Walang lokasyon — wala sa mapa',
    reasonExpired: 'Nag-expire na — wala sa mapa',
    editInAdmin: 'I-edit sa admin',
    opensInAdminTab: '(magbubukas sa admin tab)',
  },
  am: {
    backToFeed: 'ወደ ማህበረሰብ ገጽ ተመለስ',
    navLabel: 'ከአስተዳደር ውጣ',
    opensInPreviewTab: '(በገጹ ቅድመ እይታ ትር ይከፈታል)',
    reasonHidden: 'ከአባላት ተደብቋል',
    reasonInactive: 'ንቁ ያልሆነ — ከአባላት ተደብቋል',
    reasonNotApproved: 'ያልጸደቀ — ከአባላት ተደብቋል',
    reasonNotFound: 'ከአሁን በኋላ የለም',
    reasonRetired: 'ተቋርጧል — በማህበረሰብ ገጽ ላይ የለም',
    reasonOrgInactive: 'ድርጅቱ ንቁ አይደለም — በማህበረሰብ ገጽ ላይ የለም',
    reasonNoUpcoming: 'መጪ ቀኖች የሉም — በማህበረሰብ ገጽ ላይ የለም',
    viewInFeed: 'በማህበረሰብ ገጽ ላይ ይመልከቱ',
    appearsInFeed: 'በ{date} በማህበረሰብ ገጽ ላይ ይታያል',
    viewOnMap: 'በካርታ ላይ ይመልከቱ',
    reasonNoLocation: 'አካባቢ የለውም — በካርታው ላይ የለም',
    reasonExpired: 'ጊዜው አልፎበታል — በካርታው ላይ የለም',
    editInAdmin: 'በአስተዳደር ውስጥ ያርትዑ',
    opensInAdminTab: '(በአስተዳደር ትር ይከፈታል)',
  },
  hmn: {
    backToFeed: 'Rov qab mus rau zej zog',
    navLabel: 'Tawm ntawm admin',
    opensInPreviewTab: '(qhib rau hauv lub tab saib ua ntej)',
    reasonHidden: 'Zais ntawm cov tswv cuab',
    reasonInactive: 'Kaw — zais ntawm cov tswv cuab',
    reasonNotApproved: 'Tsis tau pom zoo — zais ntawm cov tswv cuab',
    reasonNotFound: 'Tsis muaj lawm',
    reasonRetired: 'Tso lawm — tsis muaj nyob rau zej zog',
    reasonOrgInactive: 'Lub koom haum kaw lawm — tsis muaj nyob rau zej zog',
    reasonNoUpcoming: 'Tsis muaj hnub tom ntej — tsis muaj nyob rau zej zog',
    viewInFeed: 'Saib hauv zej zog',
    appearsInFeed: 'Yuav tshwm rau zej zog {date}',
    viewOnMap: 'Saib ntawm daim ntawv qhia',
    reasonNoLocation: 'Tsis muaj qhov chaw — tsis nyob ntawm daim ntawv qhia',
    reasonExpired: 'Tas sij hawm lawm — tsis nyob ntawm daim ntawv qhia',
    editInAdmin: 'Kho hauv admin',
    opensInAdminTab: '(qhib rau hauv lub tab admin)',
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
  retired: 'reasonRetired',
  org_inactive: 'reasonOrgInactive',
  no_upcoming: 'reasonNoUpcoming',
  no_location: 'reasonNoLocation',
  expired: 'reasonExpired',
}

/** The text a row shows, in place of a "View …" link, when members cannot see the item. */
export function memberReasonText(locale: Locale, reason: ReasonCode): string {
  return adminNavT(locale, REASON_KEY[reason])
}
