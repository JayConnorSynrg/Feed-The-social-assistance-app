// apps/web/src/lib/i18n-feed-follows.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The follow / unfollow failure line of the community feed (components/feed/follow-error-banner.tsx)
// in the 14 FEED locales. Look up with followsT(locale, key) (English fallback, logged as
// i18n.translation_fallback).
//
// hooks/use-follows.ts is not changed by the translation work: it still reports a failure as one
// of its fixed English sentences. followErrorText() reads each as a code;
// i18n-feed-follows.test.ts fails when the hook gains a sentence this table does not know. The
// Follow / Following button words stay in lib/i18n-feed-card.ts, their one translation.
// Parity: i18n-feed-subtabs.test.ts.
// ht, so, am and hmn are machine-drafted, needs native review: docs/i18n-native-review.md.

import { translate, type Locale } from './i18n'
import { readErrorSentence, type ErrorText } from './i18n-friendly-error'

export interface FeedFollowsMessages {
  errLoadTimeout: string
  errLoadFailed: string
  errSignInToFollow: string
  errFollowFailed: string
  errSignInToUnfollow: string
  errUnfollowFailed: string
}

export const feedFollowsMessages: Record<Locale, FeedFollowsMessages> = {
  en: {
    errLoadTimeout: 'Follows data timed out — please check your connection and retry.',
    errLoadFailed: "Couldn't load follows. Please try again.",
    errSignInToFollow: 'You must be signed in to follow someone.',
    errFollowFailed: "Couldn't follow. Please try again.",
    errSignInToUnfollow: 'You must be signed in to unfollow someone.',
    errUnfollowFailed: "Couldn't unfollow. Please try again.",
  },
  es: {
    errLoadTimeout: 'Se agotó el tiempo al cargar a quién sigues. Revisa tu conexión e inténtalo de nuevo.',
    errLoadFailed: 'No se pudo cargar a quién sigues. Inténtalo de nuevo.',
    errSignInToFollow: 'Debes iniciar sesión para seguir a alguien.',
    errFollowFailed: 'No se pudo seguir. Inténtalo de nuevo.',
    errSignInToUnfollow: 'Debes iniciar sesión para dejar de seguir a alguien.',
    errUnfollowFailed: 'No se pudo dejar de seguir. Inténtalo de nuevo.',
  },
  // machine-drafted, needs native review
  ht: {
    errLoadTimeout: 'Chajman moun w ap swiv yo pran twòp tan. Tanpri verifye koneksyon ou epi eseye ankò.',
    errLoadFailed: 'Nou pa kapab chaje moun w ap swiv yo. Tanpri eseye ankò.',
    errSignInToFollow: 'Ou dwe konekte pou w swiv yon moun.',
    errFollowFailed: 'Nou pa kapab swiv moun sa a. Tanpri eseye ankò.',
    errSignInToUnfollow: 'Ou dwe konekte pou w sispann swiv yon moun.',
    errUnfollowFailed: 'Nou pa kapab sispann swiv moun sa a. Tanpri eseye ankò.',
  },
  vi: {
    errLoadTimeout: 'Tải danh sách đang theo dõi quá lâu. Vui lòng kiểm tra kết nối và thử lại.',
    errLoadFailed: 'Không thể tải danh sách đang theo dõi. Vui lòng thử lại.',
    errSignInToFollow: 'Bạn cần đăng nhập để theo dõi ai đó.',
    errFollowFailed: 'Không thể theo dõi. Vui lòng thử lại.',
    errSignInToUnfollow: 'Bạn cần đăng nhập để bỏ theo dõi ai đó.',
    errUnfollowFailed: 'Không thể bỏ theo dõi. Vui lòng thử lại.',
  },
  ar: {
    errLoadTimeout: 'انتهت مهلة تحميل قائمة المتابَعين. يُرجى التحقق من اتصالك والمحاولة مرة أخرى.',
    errLoadFailed: 'تعذّر تحميل قائمة المتابَعين. يُرجى المحاولة مرة أخرى.',
    errSignInToFollow: 'يجب تسجيل الدخول لمتابعة أي شخص.',
    errFollowFailed: 'تعذّرت المتابعة. يُرجى المحاولة مرة أخرى.',
    errSignInToUnfollow: 'يجب تسجيل الدخول لإلغاء متابعة أي شخص.',
    errUnfollowFailed: 'تعذّر إلغاء المتابعة. يُرجى المحاولة مرة أخرى.',
  },
  zh: {
    errLoadTimeout: '加载关注列表超时。请检查您的网络连接后重试。',
    errLoadFailed: '无法加载关注列表。请重试。',
    errSignInToFollow: '您需要登录才能关注他人。',
    errFollowFailed: '无法关注。请重试。',
    errSignInToUnfollow: '您需要登录才能取消关注他人。',
    errUnfollowFailed: '无法取消关注。请重试。',
  },
  // machine-drafted, needs native review
  so: {
    errLoadTimeout: 'Soo dejinta dadka aad raacdo way daahday. Fadlan hubi xiriirkaaga oo mar kale isku day.',
    errLoadFailed: 'Lama soo dejin karin dadka aad raacdo. Fadlan mar kale isku day.',
    errSignInToFollow: 'Waa inaad soo gashaa si aad qof u raacdo.',
    errFollowFailed: 'Lama raaci karin. Fadlan mar kale isku day.',
    errSignInToUnfollow: 'Waa inaad soo gashaa si aad qof uga hartid raacitaankiisa.',
    errUnfollowFailed: 'Raacitaanka lama joojin karin. Fadlan mar kale isku day.',
  },
  fr: {
    errLoadTimeout: 'Le chargement de vos abonnements a pris trop de temps. Vérifiez votre connexion et réessayez.',
    errLoadFailed: 'Impossible de charger vos abonnements. Veuillez réessayer.',
    errSignInToFollow: "Vous devez être connecté pour suivre quelqu'un.",
    errFollowFailed: 'Impossible de suivre. Veuillez réessayer.',
    errSignInToUnfollow: "Vous devez être connecté pour ne plus suivre quelqu'un.",
    errUnfollowFailed: 'Impossible de ne plus suivre. Veuillez réessayer.',
  },
  pt: {
    errLoadTimeout: 'O carregamento de quem você segue demorou demais. Verifique sua conexão e tente novamente.',
    errLoadFailed: 'Não foi possível carregar quem você segue. Tente novamente.',
    errSignInToFollow: 'Você precisa entrar na sua conta para seguir alguém.',
    errFollowFailed: 'Não foi possível seguir. Tente novamente.',
    errSignInToUnfollow: 'Você precisa entrar na sua conta para deixar de seguir alguém.',
    errUnfollowFailed: 'Não foi possível deixar de seguir. Tente novamente.',
  },
  ru: {
    errLoadTimeout: 'Не удалось вовремя загрузить ваши подписки. Проверьте соединение и попробуйте ещё раз.',
    errLoadFailed: 'Не удалось загрузить ваши подписки. Попробуйте ещё раз.',
    errSignInToFollow: 'Войдите в аккаунт, чтобы подписаться на кого-либо.',
    errFollowFailed: 'Не удалось подписаться. Попробуйте ещё раз.',
    errSignInToUnfollow: 'Войдите в аккаунт, чтобы отписаться от кого-либо.',
    errUnfollowFailed: 'Не удалось отписаться. Попробуйте ещё раз.',
  },
  ko: {
    errLoadTimeout: '팔로우 목록을 불러오는 데 시간이 너무 오래 걸렸습니다. 연결 상태를 확인한 후 다시 시도해 주세요.',
    errLoadFailed: '팔로우 목록을 불러오지 못했습니다. 다시 시도해 주세요.',
    errSignInToFollow: '다른 사람을 팔로우하려면 로그인해야 합니다.',
    errFollowFailed: '팔로우하지 못했습니다. 다시 시도해 주세요.',
    errSignInToUnfollow: '팔로우를 취소하려면 로그인해야 합니다.',
    errUnfollowFailed: '팔로우를 취소하지 못했습니다. 다시 시도해 주세요.',
  },
  tl: {
    errLoadTimeout: 'Natagalan ang pag-load ng mga sinusundan mo. Pakisuri ang iyong koneksyon at subukang muli.',
    errLoadFailed: 'Hindi ma-load ang mga sinusundan mo. Pakisubukang muli.',
    errSignInToFollow: 'Kailangan mong mag-sign in para sumunod sa iba.',
    errFollowFailed: 'Hindi masundan. Pakisubukang muli.',
    errSignInToUnfollow: 'Kailangan mong mag-sign in para ihinto ang pagsunod sa iba.',
    errUnfollowFailed: 'Hindi maihinto ang pagsunod. Pakisubukang muli.',
  },
  // machine-drafted, needs native review
  am: {
    errLoadTimeout: 'የሚከተሏቸውን መጫን ጊዜ ወሰደ። እባክዎ ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ።',
    errLoadFailed: 'የሚከተሏቸውን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
    errSignInToFollow: 'ሰውን ለመከተል መግባት አለብዎት።',
    errFollowFailed: 'መከተል አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
    errSignInToUnfollow: 'መከተል ለማቆም መግባት አለብዎት።',
    errUnfollowFailed: 'መከተል ማቆም አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
  },
  // machine-drafted, needs native review
  hmn: {
    errLoadTimeout: 'Kev thauj cov neeg koj raws siv sijhawm ntev dhau. Thov xyuas koj txoj kev txuas thiab sim dua.',
    errLoadFailed: 'Thauj tsis tau cov neeg koj raws. Thov sim dua.',
    errSignInToFollow: 'Koj yuav tsum nkag mus ua ntej thiaj raws tau ib tug neeg.',
    errFollowFailed: 'Raws tsis tau. Thov sim dua.',
    errSignInToUnfollow: 'Koj yuav tsum nkag mus ua ntej thiaj tso tseg raws tau ib tug neeg.',
    errUnfollowFailed: 'Tso tseg raws tsis tau. Thov sim dua.',
  },
}

export function followsT(locale: Locale, key: keyof FeedFollowsMessages): string {
  return translate(feedFollowsMessages, locale, key)
}

// ---------------------------------------------------------------------------
// Failures — the fixed sentences of hooks/use-follows.ts, read as codes
// ---------------------------------------------------------------------------

/** Each sentence the hook can put in `error`, and the key of the member's sentence. */
export const FOLLOW_ERROR_SENTENCES: Record<string, keyof FeedFollowsMessages> = {
  'Follows data timed out — please check your connection and retry.': 'errLoadTimeout',
  "Couldn't load follows. Please try again.": 'errLoadFailed',
  'You must be signed in to follow someone.': 'errSignInToFollow',
  "Couldn't follow. Please try again.": 'errFollowFailed',
  'You must be signed in to unfollow someone.': 'errSignInToUnfollow',
  "Couldn't unfollow. Please try again.": 'errUnfollowFailed',
}

/**
 * What the follow-error line shows: the hook's own sentence (or one of the two general ones of
 * lib/friendly-error.ts) in the viewer's language; anything else as received, `translated: false`.
 */
export function followErrorText(error: string, locale: Locale): ErrorText {
  return readErrorSentence(error, locale, (sentence) =>
    Object.prototype.hasOwnProperty.call(FOLLOW_ERROR_SENTENCES, sentence) ? followsT(locale, FOLLOW_ERROR_SENTENCES[sentence]) : null,
  )
}
