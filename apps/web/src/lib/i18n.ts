// apps/web/src/lib/i18n.ts
// Static i18n floor for pre-auth and error surfaces.
// Zero runtime dependencies — pure TypeScript string lookup.

import { LANGUAGES, detectBrowserLanguage, GUEST_LANGUAGE_KEY } from './languages'
import { logger } from './logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 14 supported locale codes (excludes 'other' which is not a translatable locale). */
export type Locale =
  | 'en' | 'es' | 'ht' | 'vi' | 'ar' | 'zh' | 'so'
  | 'fr' | 'pt' | 'ru' | 'ko' | 'tl' | 'am' | 'hmn'

export interface Messages {
  heading: string
  body: string
  tryAgain: string
  goHome: string
  welcome: string
  signInSubtitle: string
  emailLabel: string
  passwordLabel: string
  signIn: string
  findHelpNow: string
  forgotPassword: string
  noAccountText: string
  signUpLabel: string
  oauthError: string
  rateLimitError: string
  lockoutError: string
  chatErrorGeneric: string
  chatErrorTimeout: string
  chatErrorOffline: string
}

// ---------------------------------------------------------------------------
// RTL
// ---------------------------------------------------------------------------

export const RTL_LOCALES = new Set<Locale>(['ar'])

export function dir(locale: Locale): 'rtl' | 'ltr' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr'
}

// ---------------------------------------------------------------------------
// Locale set — derived from LANGUAGES SSOT, excluding 'other'
// ---------------------------------------------------------------------------

const LOCALE_SET = new Set<string>(
  LANGUAGES
    .map((l) => l.code)
    .filter((c) => c !== 'other')
)

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

export const messages: Record<Locale, Messages> = {
  en: {
    heading: 'Something went wrong',
    body: 'An unexpected error occurred. Your data is safe — please try again.',
    tryAgain: 'Try again',
    goHome: 'Go home',
    welcome: 'Welcome to FEED',
    signInSubtitle: 'Sign in to access resources',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    signIn: 'Sign in',
    findHelpNow: 'Find Help Now — no account needed',
    forgotPassword: 'Forgot your password?',
    noAccountText: "Don't have an account?",
    signUpLabel: "Sign up",
    oauthError: 'Authentication failed. Please try again.',
    rateLimitError: 'Too many attempts. Please wait before trying again.',
    lockoutError: 'Account temporarily locked. Please try again later.',
    chatErrorGeneric: "I'm having trouble connecting right now.",
    chatErrorTimeout: 'The request timed out. Please try again.',
    chatErrorOffline: 'You appear to be offline. Please check your connection.',
  },

  es: {
    heading: 'Algo salió mal',
    body: 'Ocurrió un error inesperado. Sus datos están seguros — por favor intente de nuevo.',
    tryAgain: 'Intentar de nuevo',
    goHome: 'Ir al inicio',
    welcome: 'Bienvenido a FEED',
    signInSubtitle: 'Inicia sesión para acceder a los recursos',
    emailLabel: 'Correo electrónico',
    passwordLabel: 'Contraseña',
    signIn: 'Iniciar sesión',
    findHelpNow: 'Encuentra ayuda ahora — sin cuenta necesaria',
    forgotPassword: '¿Olvidaste tu contraseña?',
    noAccountText: '¿No tienes cuenta?',
    signUpLabel: 'Regístrate',
    oauthError: 'La autenticación falló. Por favor intente de nuevo.',
    rateLimitError: 'Demasiados intentos. Por favor espera antes de intentar de nuevo.',
    lockoutError: 'Cuenta bloqueada temporalmente. Por favor intente más tarde.',
    chatErrorGeneric: 'Estoy teniendo problemas para conectarme ahora mismo.',
    chatErrorTimeout: 'La solicitud expiró. Por favor intente de nuevo.',
    chatErrorOffline: 'Parece que estás sin conexión. Por favor verifica tu conexión.',
  },

  // TODO: native-speaker review
  ht: {
    heading: 'Yon bagay te mal pase',
    body: 'Yon erè inatann te pase. Done ou yo an sekirite — tanpri eseye ankò.',
    tryAgain: 'Eseye ankò',
    goHome: 'Ale lakay',
    welcome: 'Byenveni nan FEED',
    signInSubtitle: 'Konekte pou jwenn aksè nan resous yo',
    emailLabel: 'Imèl',
    passwordLabel: 'Modpas',
    signIn: 'Konekte',
    findHelpNow: 'Jwenn èd kounye a — pa bezwen kont',
    forgotPassword: 'Ou bliye modpas ou?',
    noAccountText: 'Ou pa gen kont?',
    signUpLabel: 'Enskri',
    oauthError: 'Otantifikasyon echwe. Tanpri eseye ankò.',
    rateLimitError: 'Twòp tantativ. Tanpri tann anvan ou eseye ankò.',
    lockoutError: 'Kont bloke pou kèk tan. Tanpri eseye pita.',
    chatErrorGeneric: 'Mwen gen pwoblèm pou konekte kounye a.',
    chatErrorTimeout: 'Demann an pran twò lontan. Tanpri eseye ankò.',
    chatErrorOffline: 'Ou sanble pa gen koneksyon. Tanpri tcheke koneksyon ou.',
  },

  vi: {
    heading: 'Đã xảy ra lỗi',
    body: 'Đã xảy ra lỗi không mong muốn. Dữ liệu của bạn an toàn — vui lòng thử lại.',
    tryAgain: 'Thử lại',
    goHome: 'Về trang chủ',
    welcome: 'Chào mừng đến với FEED',
    signInSubtitle: 'Đăng nhập để truy cập tài nguyên',
    emailLabel: 'Email',
    passwordLabel: 'Mật khẩu',
    signIn: 'Đăng nhập',
    findHelpNow: 'Tìm trợ giúp ngay — không cần tài khoản',
    forgotPassword: 'Quên mật khẩu?',
    noAccountText: 'Chưa có tài khoản?',
    signUpLabel: 'Đăng ký',
    oauthError: 'Xác thực thất bại. Vui lòng thử lại.',
    rateLimitError: 'Quá nhiều lần thử. Vui lòng đợi trước khi thử lại.',
    lockoutError: 'Tài khoản tạm thời bị khóa. Vui lòng thử lại sau.',
    chatErrorGeneric: 'Tôi đang gặp sự cố kết nối.',
    chatErrorTimeout: 'Yêu cầu đã hết thời gian. Vui lòng thử lại.',
    chatErrorOffline: 'Bạn dường như đang ngoại tuyến. Vui lòng kiểm tra kết nối.',
  },

  ar: {
    heading: 'حدث خطأ ما',
    body: 'حدث خطأ غير متوقع. بياناتك آمنة — يرجى المحاولة مرة أخرى.',
    tryAgain: 'حاول مجدداً',
    goHome: 'الذهاب للرئيسية',
    welcome: 'مرحباً بك في FEED',
    signInSubtitle: 'سجّل دخولك للوصول إلى الموارد',
    emailLabel: 'البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    signIn: 'تسجيل الدخول',
    findHelpNow: 'احصل على مساعدة الآن — لا حساب مطلوب',
    forgotPassword: 'نسيت كلمة المرور؟',
    noAccountText: 'ليس لديك حساب؟',
    signUpLabel: 'سجّل',
    oauthError: 'فشل التحقق. يرجى المحاولة مرة أخرى.',
    rateLimitError: 'محاولات كثيرة جداً. يرجى الانتظار قبل المحاولة مرة أخرى.',
    lockoutError: 'تم تعليق الحساب مؤقتاً. يرجى المحاولة لاحقاً.',
    chatErrorGeneric: 'أواجه مشكلة في الاتصال الآن.',
    chatErrorTimeout: 'انتهت مهلة الطلب. يرجى المحاولة مرة أخرى.',
    chatErrorOffline: 'يبدو أنك غير متصل. يرجى التحقق من اتصالك.',
  },

  zh: {
    heading: '出现了错误',
    body: '发生了意外错误。您的数据是安全的 — 请重试。',
    tryAgain: '重试',
    goHome: '返回首页',
    welcome: '欢迎使用 FEED',
    signInSubtitle: '登录以访问资源',
    emailLabel: '电子邮件',
    passwordLabel: '密码',
    signIn: '登录',
    findHelpNow: '立即寻求帮助 — 无需账户',
    forgotPassword: '忘记密码？',
    noAccountText: '没有账户？',
    signUpLabel: '注册',
    oauthError: '认证失败。请重试。',
    rateLimitError: '尝试次数过多。请稍后再试。',
    lockoutError: '账户已暂时锁定。请稍后再试。',
    chatErrorGeneric: '我现在无法连接。',
    chatErrorTimeout: '请求超时。请重试。',
    chatErrorOffline: '您似乎已离线。请检查您的连接。',
  },

  // TODO: native-speaker review
  so: {
    heading: 'Wax khalad ah ayaa dhacay',
    body: 'Khalad aan la filanayn ayaa dhacay. Xogahaagu waa badbaadsan yahay — fadlan isku day mar kale.',
    tryAgain: 'Isku day mar kale',
    goHome: 'Aad bogga hore',
    welcome: 'Ku soo dhawow FEED',
    signInSubtitle: 'Gal si aad u gasho kheyraadka',
    emailLabel: 'Iimaylka',
    passwordLabel: 'Furaha sirta ah',
    signIn: 'Gal',
    findHelpNow: 'Raadi caawimo hadda — xisaab looma baahna',
    forgotPassword: 'Ma ilowday furaha sirta ah?',
    noAccountText: 'Ma haysatid xisaab?',
    signUpLabel: 'Isdiiwaangeli',
    oauthError: 'Xaqiijinta waxay ku guuldareysatay. Fadlan isku day mar kale.',
    rateLimitError: 'Tijaabooyin badan oo aad u badan. Fadlan sug ka hor intaadan isku dayin mar kale.',
    lockoutError: 'Xisaabta waxaa ku xidnayd si ku meel gaar ah. Fadlan isku day mar dambe.',
    chatErrorGeneric: 'Waxaan dhibaato ku hayaa xiriirka hadda.',
    chatErrorTimeout: 'Codsigii wuxuu dhaafay waqtiga. Fadlan isku day mar kale.',
    chatErrorOffline: 'Waxaa muuqata inaadan xiriir lahayn. Fadlan hubin xiriirkaaga.',
  },

  fr: {
    heading: "Une erreur s'est produite",
    body: "Une erreur inattendue s'est produite. Vos données sont en sécurité — veuillez réessayer.",
    tryAgain: 'Réessayer',
    goHome: 'Accueil',
    welcome: 'Bienvenue sur FEED',
    signInSubtitle: 'Connectez-vous pour accéder aux ressources',
    emailLabel: 'E-mail',
    passwordLabel: 'Mot de passe',
    signIn: 'Se connecter',
    findHelpNow: "Trouver de l'aide maintenant — sans compte requis",
    forgotPassword: 'Mot de passe oublié ?',
    noAccountText: "Pas de compte ?",
    signUpLabel: "S'inscrire",
    oauthError: "L'authentification a échoué. Veuillez réessayer.",
    rateLimitError: 'Trop de tentatives. Veuillez attendre avant de réessayer.',
    lockoutError: 'Compte temporairement bloqué. Veuillez réessayer plus tard.',
    chatErrorGeneric: "J'ai du mal à me connecter en ce moment.",
    chatErrorTimeout: 'La demande a expiré. Veuillez réessayer.',
    chatErrorOffline: 'Vous semblez hors ligne. Veuillez vérifier votre connexion.',
  },

  pt: {
    heading: 'Algo deu errado',
    body: 'Ocorreu um erro inesperado. Seus dados estão seguros — por favor, tente novamente.',
    tryAgain: 'Tentar novamente',
    goHome: 'Ir para início',
    welcome: 'Bem-vindo ao FEED',
    signInSubtitle: 'Entre para acessar recursos',
    emailLabel: 'E-mail',
    passwordLabel: 'Senha',
    signIn: 'Entrar',
    findHelpNow: 'Encontre ajuda agora — sem conta necessária',
    forgotPassword: 'Esqueceu sua senha?',
    noAccountText: 'Não tem conta?',
    signUpLabel: 'Cadastre-se',
    oauthError: 'A autenticação falhou. Por favor, tente novamente.',
    rateLimitError: 'Muitas tentativas. Por favor, aguarde antes de tentar novamente.',
    lockoutError: 'Conta temporariamente bloqueada. Por favor, tente mais tarde.',
    chatErrorGeneric: 'Estou com problemas para conectar agora.',
    chatErrorTimeout: 'A solicitação expirou. Por favor, tente novamente.',
    chatErrorOffline: 'Você parece estar offline. Por favor, verifique sua conexão.',
  },

  ru: {
    heading: 'Что-то пошло не так',
    body: 'Произошла непредвиденная ошибка. Ваши данные в безопасности — пожалуйста, попробуйте снова.',
    tryAgain: 'Попробовать снова',
    goHome: 'На главную',
    welcome: 'Добро пожаловать в FEED',
    signInSubtitle: 'Войдите для доступа к ресурсам',
    emailLabel: 'Электронная почта',
    passwordLabel: 'Пароль',
    signIn: 'Войти',
    findHelpNow: 'Найти помощь сейчас — без учётной записи',
    forgotPassword: 'Забыли пароль?',
    noAccountText: 'Нет аккаунта?',
    signUpLabel: 'Зарегистрируйтесь',
    oauthError: 'Аутентификация не удалась. Пожалуйста, попробуйте снова.',
    rateLimitError: 'Слишком много попыток. Подождите перед следующей попыткой.',
    lockoutError: 'Аккаунт временно заблокирован. Попробуйте позже.',
    chatErrorGeneric: 'У меня проблемы с подключением прямо сейчас.',
    chatErrorTimeout: 'Время запроса истекло. Пожалуйста, попробуйте снова.',
    chatErrorOffline: 'Похоже, вы не в сети. Проверьте подключение.',
  },

  ko: {
    heading: '문제가 발생했습니다',
    body: '예기치 않은 오류가 발생했습니다. 데이터는 안전합니다 — 다시 시도해 주세요.',
    tryAgain: '다시 시도',
    goHome: '홈으로',
    welcome: 'FEED에 오신 것을 환영합니다',
    signInSubtitle: '리소스에 접근하려면 로그인하세요',
    emailLabel: '이메일',
    passwordLabel: '비밀번호',
    signIn: '로그인',
    findHelpNow: '지금 도움 찾기 — 계정 불필요',
    forgotPassword: '비밀번호를 잊으셨나요?',
    noAccountText: '계정이 없으신가요?',
    signUpLabel: '가입하기',
    oauthError: '인증에 실패했습니다. 다시 시도해 주세요.',
    rateLimitError: '너무 많은 시도입니다. 잠시 후 다시 시도해 주세요.',
    lockoutError: '계정이 일시적으로 잠겼습니다. 나중에 다시 시도해 주세요.',
    chatErrorGeneric: '지금 연결에 문제가 있습니다.',
    chatErrorTimeout: '요청 시간이 초과되었습니다. 다시 시도해 주세요.',
    chatErrorOffline: '오프라인 상태인 것 같습니다. 연결을 확인해 주세요.',
  },

  tl: {
    heading: 'May nangyaring mali',
    body: 'Naganap ang isang hindi inaasahang error. Ligtas ang iyong data — pakisubukang muli.',
    tryAgain: 'Subukan muli',
    goHome: 'Pumunta sa home',
    welcome: 'Maligayang pagdating sa FEED',
    signInSubtitle: 'Mag-sign in upang ma-access ang mga resources',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    signIn: 'Mag-sign in',
    findHelpNow: 'Hanapin ang tulong ngayon — hindi kailangan ng account',
    forgotPassword: 'Nakalimutan ang password?',
    noAccountText: 'Wala kang account?',
    signUpLabel: 'Mag-sign up',
    oauthError: 'Nabigo ang authentication. Pakisubukang muli.',
    rateLimitError: 'Napakaraming pagtatangka. Mangyaring maghintay bago subukang muli.',
    lockoutError: 'Pansamantalang na-lock ang account. Pakisubukang muli mamaya.',
    chatErrorGeneric: 'May problema akong sa koneksyon ngayon.',
    chatErrorTimeout: 'Nag-time out ang kahilingan. Pakisubukang muli.',
    chatErrorOffline: 'Mukhang offline ka. Pakisuriin ang iyong koneksyon.',
  },

  // TODO: native-speaker review
  am: {
    heading: 'ችግር ተፈጥሯል',
    body: 'ያልተጠበቀ ስህተት ተፈጥሯል። ውሂብዎ ደህና ነው — እባክዎ እንደገና ይሞክሩ።',
    tryAgain: 'እንደገና ሞክር',
    goHome: 'ወደ ቤት ሂድ',
    welcome: 'ወደ FEED እንኳን ደህና መጡ',
    signInSubtitle: 'ግብዓቶችን ለማግኘት ይግቡ',
    emailLabel: 'ኢሜይል',
    passwordLabel: 'የይለፍ ቃል',
    signIn: 'ግባ',
    findHelpNow: 'አሁን እርዳታ ፈልግ — መለያ አያስፈልግም',
    forgotPassword: 'የይለፍ ቃልዎን ረሱ?',
    noAccountText: 'መለያ የለዎትም?',
    signUpLabel: 'ይመዝገቡ',
    oauthError: 'ማረጋገጫ አልተሳካም። እባክዎ እንደገና ይሞክሩ።',
    rateLimitError: 'በጣም ብዙ ሙከራዎች። እባክዎ እንደገና ከመሞከርዎ በፊት ይጠብቁ።',
    lockoutError: 'መለያ ለጊዜው ተዘግቷል። እባክዎ ቆይተው ይሞክሩ።',
    chatErrorGeneric: 'አሁን ለመገናኘት ችግር አለኝ።',
    chatErrorTimeout: 'ጥያቄው ጊዜ አለቀ። እባክዎ እንደገና ይሞክሩ።',
    chatErrorOffline: 'ከኢንተርኔት ውጪ ይመስላሉ። እባክዎ ግንኙነትዎን ያረጋግጡ።',
  },

  // TODO: native-speaker review
  hmn: {
    heading: 'Muaj qee yam yuam kev',
    body: 'Muaj yuam kev uas tsis tau xav txog. Koj cov ntaub ntawv nyab xeeb — thov sim dua.',
    tryAgain: 'Sim dua',
    goHome: 'Mus tsev',
    welcome: 'Txais tos rau FEED',
    signInSubtitle: 'Nkag mus saib cov peev txheej',
    emailLabel: 'Email',
    passwordLabel: 'Tus password',
    signIn: 'Nkag mus',
    findHelpNow: 'Nrhiav kev pab tam sim no — tsis xav tau tus account',
    forgotPassword: 'Tsis nco qab tus password?',
    noAccountText: 'Tsis muaj account?',
    signUpLabel: 'Sau npe',
    oauthError: 'Kev lees paub tsis ua tiav. Thov sim dua.',
    rateLimitError: 'Sim ntau dhau lawm. Thov tos ua ntej sim dua.',
    lockoutError: 'Account raug kaw ib ntus. Thov sim dua tom qab.',
    chatErrorGeneric: 'Kuv muaj teeb meem txuas nrog tam sim no.',
    chatErrorTimeout: 'Kev thov siv sijhawm ntau dhau. Thov sim dua.',
    chatErrorOffline: 'Zoo li koj tsis muaj internet. Thov kuaj xyuas koj txoj kev txuas.',
  },
}

// ---------------------------------------------------------------------------
// t() — translate with EN fallback
// ---------------------------------------------------------------------------

export function t(locale: Locale, key: keyof Messages): string {
  const val = messages[locale]?.[key]
  if (!val) {
    try {
      logger.warn('i18n.translation_fallback', { key, locale })
    } catch {
      // guard: never throw in error context
    }
    return messages.en[key]
  }
  return val
}

// ---------------------------------------------------------------------------
// resolveLocale() — storage → browser → default
// ---------------------------------------------------------------------------

export function resolveLocale(): Locale {
  let locale: string | null = null
  let source: 'storage' | 'browser' | 'default' = 'default'

  try {
    locale = typeof localStorage !== 'undefined' ? localStorage.getItem(GUEST_LANGUAGE_KEY) : null
    if (locale && LOCALE_SET.has(locale as Locale)) {
      source = 'storage'
    } else {
      locale = null
    }
  } catch {
    // SSR or restricted context
  }

  if (!locale) {
    const detected = detectBrowserLanguage()
    if (detected && LOCALE_SET.has(detected as Locale)) {
      locale = detected
      source = 'browser'
    }
  }

  const resolved = (locale && LOCALE_SET.has(locale as Locale) ? locale : 'en') as Locale

  // Log with guarded try/catch — never throw in error context
  try {
    logger.debug('i18n.locale_resolved', { locale: resolved, source })
  } catch {
    // guard: never throw in error context
  }

  return resolved
}
