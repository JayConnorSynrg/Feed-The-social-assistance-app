// apps/web/src/lib/i18n-friendly-error.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The two general failure sentences of lib/friendly-error.ts (getFriendlyErrorMessage) in the 14
// FEED locales, translated once for every surface whose hook reports through it (opt-ins,
// follows, reviews, appreciation). lib/friendly-error.ts itself is unchanged: it still returns
// English, and a surface reads the sentence as a code through readErrorSentence().
// Parity: i18n-feed-subtabs.test.ts.
// ht, so, am and hmn are machine-drafted, needs native review: docs/i18n-native-review.md.

import { translate, type Locale } from './i18n'

export interface FriendlyErrorMessages {
  /** The database refused the read or the write (never shown with its own text). */
  permission: string
  /** A timeout, an aborted request or no network. */
  connection: string
}

export const friendlyErrorMessages: Record<Locale, FriendlyErrorMessages> = {
  en: {
    permission: "You don't have permission to view this right now. Please try again or contact support.",
    connection: "We're having trouble connecting. Please check your connection and try again.",
  },
  es: {
    permission: 'No tienes permiso para ver esto en este momento. Inténtalo de nuevo o contacta con soporte.',
    connection: 'Tenemos problemas para conectarnos. Revisa tu conexión e inténtalo de nuevo.',
  },
  // machine-drafted, needs native review
  ht: {
    permission: 'Ou pa gen pèmisyon pou wè sa kounye a. Tanpri eseye ankò oswa kontakte sipò.',
    connection: 'Nou gen pwoblèm pou konekte. Tanpri verifye koneksyon ou epi eseye ankò.',
  },
  vi: {
    permission: 'Bạn không có quyền xem nội dung này lúc này. Vui lòng thử lại hoặc liên hệ bộ phận hỗ trợ.',
    connection: 'Chúng tôi đang gặp sự cố kết nối. Vui lòng kiểm tra kết nối của bạn và thử lại.',
  },
  ar: {
    permission: 'ليس لديك إذن لعرض هذا الآن. يُرجى المحاولة مرة أخرى أو الاتصال بالدعم.',
    connection: 'نواجه مشكلة في الاتصال. يُرجى التحقق من اتصالك والمحاولة مرة أخرى.',
  },
  zh: {
    permission: '您目前无权查看此内容。请重试或联系支持人员。',
    connection: '连接出现问题。请检查您的网络连接后重试。',
  },
  // machine-drafted, needs native review
  so: {
    permission: 'Hadda ma haysatid oggolaansho aad ku aragto tan. Fadlan mar kale isku day ama la xiriir taageerada.',
    connection: 'Waxaa naga jira dhibaato isku xirka ah. Fadlan hubi xiriirkaaga oo mar kale isku day.',
  },
  fr: {
    permission: "Vous n'avez pas l'autorisation de voir ceci pour le moment. Veuillez réessayer ou contacter l'assistance.",
    connection: 'Nous avons du mal à nous connecter. Vérifiez votre connexion et réessayez.',
  },
  pt: {
    permission: 'Você não tem permissão para ver isto no momento. Tente novamente ou entre em contato com o suporte.',
    connection: 'Estamos com problemas de conexão. Verifique sua conexão e tente novamente.',
  },
  ru: {
    permission: 'Сейчас у вас нет доступа к этому. Попробуйте ещё раз или обратитесь в поддержку.',
    connection: 'Не удаётся подключиться. Проверьте соединение и попробуйте ещё раз.',
  },
  ko: {
    permission: '지금은 이 내용을 볼 권한이 없습니다. 다시 시도하거나 지원팀에 문의해 주세요.',
    connection: '연결에 문제가 있습니다. 연결 상태를 확인한 후 다시 시도해 주세요.',
  },
  tl: {
    permission: 'Wala kang pahintulot na tingnan ito sa ngayon. Pakisubukang muli o makipag-ugnayan sa support.',
    connection: 'Nagkakaproblema kami sa pagkonekta. Pakisuri ang iyong koneksyon at subukang muli.',
  },
  // machine-drafted, needs native review
  am: {
    permission: 'ይህን አሁን ለማየት ፈቃድ የለዎትም። እባክዎ እንደገና ይሞክሩ ወይም ድጋፍን ያግኙ።',
    connection: 'ለመገናኘት ችግር አጋጥሞናል። እባክዎ ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ።',
  },
  // machine-drafted, needs native review
  hmn: {
    permission: 'Tam sim no koj tsis muaj cai saib qhov no. Thov sim dua los yog hu rau kev pab.',
    connection: 'Peb muaj teeb meem txuas. Thov xyuas koj txoj kev txuas thiab sim dua.',
  },
}

export function friendlyErrorT(locale: Locale, key: keyof FriendlyErrorMessages): string {
  return translate(friendlyErrorMessages, locale, key)
}

// ---------------------------------------------------------------------------
// Sentences read as codes
// ---------------------------------------------------------------------------

/** The two sentences lib/friendly-error.ts writes whatever fallback its caller passes. */
export const FRIENDLY_ERROR_SENTENCES: Record<string, keyof FriendlyErrorMessages> = {
  "You don't have permission to view this right now. Please try again or contact support.": 'permission',
  "We're having trouble connecting. Please check your connection and try again.": 'connection',
}

/** What a failure line shows: FEED's own sentence in the viewer's language, or text FEED did not
 *  write, returned as received so the caller marks it lang="en" dir="ltr". */
export interface ErrorText {
  text: string
  translated: boolean
}

/**
 * Reads a failure sentence as a code. `own` is the calling surface's table (its fixed English
 * sentences → the member's text, already in the viewer's language); the two general sentences are
 * known here; anything else comes back as received with `translated: false`.
 */
export function readErrorSentence(error: string, locale: Locale, own: (sentence: string) => string | null): ErrorText {
  const mine = own(error)
  if (mine !== null) return { text: mine, translated: true }
  if (Object.prototype.hasOwnProperty.call(FRIENDLY_ERROR_SENTENCES, error)) {
    return { text: friendlyErrorT(locale, FRIENDLY_ERROR_SENTENCES[error]), translated: true }
  }
  return { text: error, translated: false }
}
