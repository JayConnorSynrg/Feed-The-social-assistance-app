// apps/web/src/lib/i18n-admin-shell.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The admin shell's own words (app/(admin)/moderation/admin-shell.tsx): the header of a non-tier
// organizer, the organization selector, and the name of every tab, in the 14 FEED locales. The tier
// marker in the header is roleLabel() (lib/i18n-feed-card.ts), the one source of tier names. Look up
// with adminShellT(locale, key) (English fallback, logged as i18n.translation_fallback); a tab's
// name with adminTabLabel(id, locale). The content of each tab is translated by its own wave.
// Parity: i18n-admin-shell.test.ts.
// ht, so, am and hmn are machine-drafted, needs native review: docs/i18n-native-review.md.

import { translate, type Locale } from './i18n'
import type { AdminTabId } from '@/app/(admin)/moderation/admin-shell-tabs'

export interface AdminShellMessages {
  /** Header of an organization admin who holds no tier. */
  organizer: string
  /** Accessible name of the organization selector. */
  organization: string
  allOrganizations: string
  /** Accessible name of the tab bar. */
  sections: string
  tabOverview: string
  tabEvents: string
  tabModeration: string
  tabCommunity: string
  tabOrganizations: string
  tabResources: string
  tabBusinesses: string
  tabManage: string
  tabPeople: string
}

export const adminShellMessages: Record<Locale, AdminShellMessages> = {
  en: {
    organizer: 'Organizer',
    organization: 'Organization',
    allOrganizations: 'All Organizations',
    sections: 'Admin sections',
    tabOverview: 'Overview',
    tabEvents: 'Events',
    tabModeration: 'Moderation',
    tabCommunity: 'Community',
    tabOrganizations: 'Organizations',
    tabResources: 'Resources',
    tabBusinesses: 'Businesses',
    tabManage: 'Manage',
    tabPeople: 'People',
  },
  es: {
    organizer: 'Organizador',
    organization: 'Organización',
    allOrganizations: 'Todas las organizaciones',
    sections: 'Secciones de administración',
    tabOverview: 'Resumen',
    tabEvents: 'Eventos',
    tabModeration: 'Moderación',
    tabCommunity: 'Comunidad',
    tabOrganizations: 'Organizaciones',
    tabResources: 'Recursos',
    tabBusinesses: 'Negocios',
    tabManage: 'Gestionar',
    tabPeople: 'Personas',
  },
  // machine-drafted, needs native review
  ht: {
    organizer: 'Òganizatè',
    organization: 'Òganizasyon',
    allOrganizations: 'Tout òganizasyon yo',
    sections: 'Seksyon administrasyon',
    tabOverview: 'Apèsi',
    tabEvents: 'Evènman',
    tabModeration: 'Moderasyon',
    tabCommunity: 'Kominote',
    tabOrganizations: 'Òganizasyon yo',
    tabResources: 'Resous',
    tabBusinesses: 'Biznis',
    tabManage: 'Jere',
    tabPeople: 'Moun',
  },
  vi: {
    organizer: 'Người tổ chức',
    organization: 'Tổ chức',
    allOrganizations: 'Tất cả tổ chức',
    sections: 'Các mục quản trị',
    tabOverview: 'Tổng quan',
    tabEvents: 'Sự kiện',
    tabModeration: 'Kiểm duyệt',
    tabCommunity: 'Cộng đồng',
    tabOrganizations: 'Các tổ chức',
    tabResources: 'Tài nguyên',
    tabBusinesses: 'Doanh nghiệp',
    tabManage: 'Quản lý',
    tabPeople: 'Mọi người',
  },
  ar: {
    organizer: 'المنظِّم',
    organization: 'المنظمة',
    allOrganizations: 'كل المنظمات',
    sections: 'أقسام الإدارة',
    tabOverview: 'نظرة عامة',
    tabEvents: 'الفعاليات',
    tabModeration: 'الإشراف',
    tabCommunity: 'المجتمع',
    tabOrganizations: 'المنظمات',
    tabResources: 'الموارد',
    tabBusinesses: 'الأعمال التجارية',
    tabManage: 'الإدارة',
    tabPeople: 'الأشخاص',
  },
  zh: {
    organizer: '组织者',
    organization: '组织',
    allOrganizations: '所有组织',
    sections: '管理分区',
    tabOverview: '概览',
    tabEvents: '活动',
    tabModeration: '审核',
    tabCommunity: '社区',
    tabOrganizations: '组织机构',
    tabResources: '资源',
    tabBusinesses: '商家',
    tabManage: '管理',
    tabPeople: '人员',
  },
  // machine-drafted, needs native review
  so: {
    organizer: 'Abaabule',
    organization: 'Urur',
    allOrganizations: 'Dhammaan ururada',
    sections: 'Qaybaha maamulka',
    tabOverview: 'Guudmar',
    tabEvents: 'Dhacdooyin',
    tabModeration: 'Dib-u-eegis',
    tabCommunity: 'Bulshada',
    tabOrganizations: 'Ururada',
    tabResources: 'Kheyraadka',
    tabBusinesses: 'Ganacsiyada',
    tabManage: 'Maamul',
    tabPeople: 'Dadka',
  },
  fr: {
    organizer: 'Organisateur',
    organization: 'Organisation',
    allOrganizations: 'Toutes les organisations',
    sections: 'Sections d’administration',
    tabOverview: 'Vue d’ensemble',
    tabEvents: 'Événements',
    tabModeration: 'Modération',
    tabCommunity: 'Communauté',
    tabOrganizations: 'Organisations',
    tabResources: 'Ressources',
    tabBusinesses: 'Commerces',
    tabManage: 'Gérer',
    tabPeople: 'Personnes',
  },
  pt: {
    organizer: 'Organizador',
    organization: 'Organização',
    allOrganizations: 'Todas as organizações',
    sections: 'Seções de administração',
    tabOverview: 'Visão geral',
    tabEvents: 'Eventos',
    tabModeration: 'Moderação',
    tabCommunity: 'Comunidade',
    tabOrganizations: 'Organizações',
    tabResources: 'Recursos',
    tabBusinesses: 'Negócios',
    tabManage: 'Gerenciar',
    tabPeople: 'Pessoas',
  },
  ru: {
    organizer: 'Организатор',
    organization: 'Организация',
    allOrganizations: 'Все организации',
    sections: 'Разделы администрирования',
    tabOverview: 'Обзор',
    tabEvents: 'События',
    tabModeration: 'Модерация',
    tabCommunity: 'Сообщество',
    tabOrganizations: 'Организации',
    tabResources: 'Ресурсы',
    tabBusinesses: 'Предприятия',
    tabManage: 'Управление',
    tabPeople: 'Люди',
  },
  ko: {
    organizer: '주최자',
    organization: '단체',
    allOrganizations: '모든 단체',
    sections: '관리 섹션',
    tabOverview: '개요',
    tabEvents: '이벤트',
    tabModeration: '검토',
    tabCommunity: '커뮤니티',
    tabOrganizations: '단체 목록',
    tabResources: '자원',
    tabBusinesses: '사업체',
    tabManage: '관리',
    tabPeople: '사람',
  },
  tl: {
    organizer: 'Tagapag-organisa',
    organization: 'Organisasyon',
    allOrganizations: 'Lahat ng organisasyon',
    sections: 'Mga seksyon ng admin',
    tabOverview: 'Pangkalahatang-ideya',
    tabEvents: 'Mga kaganapan',
    tabModeration: 'Pagmo-moderate',
    tabCommunity: 'Komunidad',
    tabOrganizations: 'Mga organisasyon',
    tabResources: 'Mga mapagkukunan',
    tabBusinesses: 'Mga negosyo',
    tabManage: 'Pamahalaan',
    tabPeople: 'Mga tao',
  },
  // machine-drafted, needs native review
  am: {
    organizer: 'አደራጅ',
    organization: 'ድርጅት',
    allOrganizations: 'ሁሉም ድርጅቶች',
    sections: 'የአስተዳደር ክፍሎች',
    tabOverview: 'አጠቃላይ እይታ',
    tabEvents: 'ዝግጅቶች',
    tabModeration: 'ቁጥጥር',
    tabCommunity: 'ማህበረሰብ',
    tabOrganizations: 'ድርጅቶች',
    tabResources: 'ሀብቶች',
    tabBusinesses: 'ንግዶች',
    tabManage: 'አስተዳድር',
    tabPeople: 'ሰዎች',
  },
  // machine-drafted, needs native review
  hmn: {
    organizer: 'Tus npaj',
    organization: 'Koom haum',
    allOrganizations: 'Txhua lub koom haum',
    sections: 'Cov ntu tswj',
    tabOverview: 'Saib tag nrho',
    tabEvents: 'Cov kev tshwm sim',
    tabModeration: 'Kev tswj xyuas',
    tabCommunity: 'Zej zog',
    tabOrganizations: 'Cov koom haum',
    tabResources: 'Cov peev txheej',
    tabBusinesses: 'Cov lag luam',
    tabManage: 'Tswj',
    tabPeople: 'Neeg',
  },
}

export function adminShellT(locale: Locale, key: keyof AdminShellMessages): string {
  return translate(adminShellMessages, locale, key)
}

const TAB_KEY = {
  overview: 'tabOverview',
  events: 'tabEvents',
  moderation: 'tabModeration',
  community: 'tabCommunity',
  organizations: 'tabOrganizations',
  resources: 'tabResources',
  businesses: 'tabBusinesses',
  manage: 'tabManage',
  people: 'tabPeople',
} as const satisfies Record<AdminTabId, keyof AdminShellMessages>

/** The name of an admin tab in the viewer's language: the one source the tab bar reads. */
export function adminTabLabel(id: AdminTabId, locale: Locale): string {
  return adminShellT(locale, TAB_KEY[id])
}
