// apps/web/src/lib/i18n-errors.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The error screens' own words beyond the shared heading / body / Try again / Go home of lib/i18n.ts:
// the panel error line (components/layout/panel-error-boundary.tsx) and the error reference line
// (app/error.tsx, app/global-error.tsx), in the 14 FEED locales. Look up with errorsT(locale, key)
// (English fallback, logged as i18n.translation_fallback). Parity: i18n-errors.test.ts.
// ht, so, am and hmn are machine-drafted, needs native review: docs/i18n-native-review.md.

import { translate, type Locale } from './i18n'

export interface ErrorsMessages {
  /** A panel failed to render; the shell around it still works. */
  panelError: string
  /** The error's digest, for support: "Reference: {digest}". */
  errorRef: string
}

export const errorsMessages: Record<Locale, ErrorsMessages> = {
  en: { panelError: 'This panel encountered an error.', errorRef: 'Reference: {digest}' },
  es: { panelError: 'Este panel tuvo un error.', errorRef: 'Referencia: {digest}' },
  // machine-drafted, needs native review
  ht: { panelError: 'Panno sa a rankontre yon erè.', errorRef: 'Referans: {digest}' },
  vi: { panelError: 'Bảng này đã gặp lỗi.', errorRef: 'Mã tham chiếu: {digest}' },
  ar: { panelError: 'حدث خطأ في هذه اللوحة.', errorRef: 'المرجع: {digest}' },
  zh: { panelError: '此面板出现错误。', errorRef: '参考编号：{digest}' },
  // machine-drafted, needs native review
  so: { panelError: 'Guddigan wuxuu la kulmay khalad.', errorRef: 'Tixraac: {digest}' },
  fr: { panelError: 'Ce panneau a rencontré une erreur.', errorRef: 'Référence : {digest}' },
  pt: { panelError: 'Este painel encontrou um erro.', errorRef: 'Referência: {digest}' },
  ru: { panelError: 'В этой панели произошла ошибка.', errorRef: 'Номер ошибки: {digest}' },
  ko: { panelError: '이 패널에서 오류가 발생했습니다.', errorRef: '참조 번호: {digest}' },
  tl: { panelError: 'Nagkaroon ng error ang panel na ito.', errorRef: 'Sanggunian: {digest}' },
  // machine-drafted, needs native review
  am: { panelError: 'ይህ ፓነል ስህተት አጋጥሞታል።', errorRef: 'ማጣቀሻ፦ {digest}' },
  // machine-drafted, needs native review
  hmn: { panelError: 'Lub vaj huam sib luag no muaj qhov yuam kev.', errorRef: 'Tus lej siv: {digest}' },
}

export function errorsT(locale: Locale, key: keyof ErrorsMessages): string {
  return translate(errorsMessages, locale, key)
}
