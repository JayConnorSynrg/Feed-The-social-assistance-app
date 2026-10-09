// apps/web/src/lib/i18n-admin-focus.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The line an admin screen shows when a followed "Edit in admin" link opened nothing (the shell's
// focus gate, app/(admin)/moderation/admin-focus-session.ts): forbidden (the viewer's role does not
// include the screen) or invalid (the link is malformed). Same shape and rules as its siblings:
// adminFocusT(locale, key) with the EN fallback; Record<Locale, …> makes a missing locale or key a
// type error, and i18n-admin-focus.test.ts checks parity. ht, so, am and hmn need native review.

import { translate, type Locale } from './i18n'

export interface AdminFocusMessages {
  /** The link opens a screen this admin's role does not include. */
  forbidden: string
  /** The link is incomplete or broken. */
  invalid: string
}

export const adminFocusMessages: Record<Locale, AdminFocusMessages> = {
  en: {
    forbidden: "This admin link opens a screen your role doesn't include, so nothing was opened.",
    invalid: 'This admin link is incomplete or broken, so nothing was opened.',
  },
  es: {
    forbidden: 'Este enlace de administración abre una pantalla que su función no incluye, así que no se abrió nada.',
    invalid: 'Este enlace de administración está incompleto o dañado, así que no se abrió nada.',
  },
  ht: {
    forbidden: 'Lyen administrasyon sa a louvri yon ekran wòl ou pa genyen, kidonk anyen pa t louvri.',
    invalid: 'Lyen administrasyon sa a pa konplè oswa li kase, kidonk anyen pa t louvri.',
  },
  vi: {
    forbidden: 'Liên kết quản trị này mở một màn hình mà vai trò của bạn không có, nên không có gì được mở.',
    invalid: 'Liên kết quản trị này không đầy đủ hoặc bị hỏng, nên không có gì được mở.',
  },
  ar: {
    forbidden: 'يفتح رابط الإدارة هذا شاشة لا يشملها دورك، لذا لم يُفتح شيء.',
    invalid: 'رابط الإدارة هذا غير مكتمل أو تالف، لذا لم يُفتح شيء.',
  },
  zh: {
    forbidden: '此管理链接打开的页面不在您的角色权限内，因此未打开任何内容。',
    invalid: '此管理链接不完整或已损坏，因此未打开任何内容。',
  },
  so: {
    forbidden: 'Xiriirkan maamulku wuxuu furayaa shaashad aanu doorkaagu lahayn, sidaas darteed waxba lama furin.',
    invalid: 'Xiriirkan maamulku waa dhammaystirnayn ama waa jaban yahay, sidaas darteed waxba lama furin.',
  },
  fr: {
    forbidden: 'Ce lien d’administration ouvre un écran que votre rôle n’inclut pas : rien n’a été ouvert.',
    invalid: 'Ce lien d’administration est incomplet ou cassé : rien n’a été ouvert.',
  },
  pt: {
    forbidden: 'Este link de administração abre uma tela que sua função não inclui, então nada foi aberto.',
    invalid: 'Este link de administração está incompleto ou quebrado, então nada foi aberto.',
  },
  ru: {
    forbidden: 'Эта ссылка открывает раздел, который не входит в вашу роль, поэтому ничего не открыто.',
    invalid: 'Эта ссылка администратора неполная или повреждена, поэтому ничего не открыто.',
  },
  ko: {
    forbidden: '이 관리자 링크는 귀하의 역할에 포함되지 않은 화면을 열기 때문에 아무것도 열리지 않았습니다.',
    invalid: '이 관리자 링크가 불완전하거나 손상되어 아무것도 열리지 않았습니다.',
  },
  tl: {
    forbidden: 'Nagbubukas ang admin link na ito ng screen na hindi kasama sa iyong tungkulin, kaya walang nabuksan.',
    invalid: 'Kulang o sira ang admin link na ito, kaya walang nabuksan.',
  },
  am: {
    forbidden: 'ይህ የአስተዳዳሪ አገናኝ የእርስዎ ሚና የማያካትተውን ገጽ ስለሚከፍት ምንም አልተከፈተም።',
    invalid: 'ይህ የአስተዳዳሪ አገናኝ ያልተሟላ ወይም የተበላሸ ስለሆነ ምንም አልተከፈተም።',
  },
  hmn: {
    forbidden: 'Qhov txuas admin no qhib ib lub vijtsam uas koj txoj haujlwm tsis muaj, yog li tsis tau qhib dabtsi.',
    invalid: 'Qhov txuas admin no tsis tiav lossis puas lawm, yog li tsis tau qhib dabtsi.',
  },
}

/** Looks up an admin focus line with the shared EN fallback. */
export function adminFocusT(locale: Locale, key: keyof AdminFocusMessages): string {
  return translate(adminFocusMessages, locale, key)
}
