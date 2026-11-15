// apps/web/src/lib/i18n-settings-language.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Language section of Settings (components/settings/language-section.tsx) in the 14 FEED
// locales. Look up with settingsLanguageT(locale, key) (English fallback, logged as
// i18n.translation_fallback). {language} is a language's own name (lib/languages.ts nativeName);
// the component puts it in its own element with its own lang. The rest of Settings is still
// English (a later phase).
// Parity: i18n-settings-language.test.ts.
// ht, so, am and hmn are machine-drafted, needs native review: docs/i18n-native-review.md.

import { translate, type Locale } from './i18n'

export interface SettingsLanguageMessages {
  heading: string
  description: string
  currently: string
  save: string
  otherLanguage: string
  saving: string
  saved: string
  savedDevice: string
  deviceOnly: string
  failed: string
}

export const settingsLanguageMessages: Record<Locale, SettingsLanguageMessages> = {
  en: {
    heading: 'Preferred Language',
    description: 'The AI assistant will respond in this language, and translated screens will show it.',
    currently: 'Currently: {language}',
    save: 'Save',
    otherLanguage: 'Other language',
    saving: 'Saving…',
    saved: 'Language saved',
    savedDevice: 'Language saved on this device',
    deviceOnly: 'Saved to this device only. Create an account to sync your preference.',
    failed: 'Your language could not be saved. FEED is still in {language}. Please try again.',
  },
  es: {
    heading: 'Idioma preferido',
    description: 'El asistente de IA responderá en este idioma, y las pantallas traducidas lo mostrarán.',
    currently: 'Idioma actual: {language}',
    save: 'Guardar',
    otherLanguage: 'Otro idioma',
    saving: 'Guardando…',
    saved: 'Idioma guardado',
    savedDevice: 'Idioma guardado en este dispositivo',
    deviceOnly: 'Guardado solo en este dispositivo. Crea una cuenta para sincronizar tu preferencia.',
    failed: 'No se pudo guardar tu idioma. FEED sigue en {language}. Inténtalo de nuevo.',
  },
  // machine-drafted, needs native review
  ht: {
    heading: 'Lang ou prefere',
    description: 'Asistan IA a ap reponn nan lang sa a, epi ekran ki tradui yo ap montre l.',
    currently: 'Kounye a: {language}',
    save: 'Anrejistre',
    otherLanguage: 'Lòt lang',
    saving: 'Ap anrejistre…',
    saved: 'Lang lan anrejistre',
    savedDevice: 'Lang lan anrejistre sou aparèy sa a',
    deviceOnly: 'Anrejistre sou aparèy sa a sèlman. Kreye yon kont pou senkronize preferans ou.',
    failed: 'Nou pa t kapab anrejistre lang ou. FEED toujou nan {language}. Tanpri eseye ankò.',
  },
  vi: {
    heading: 'Ngôn ngữ ưa thích',
    description: 'Trợ lý AI sẽ trả lời bằng ngôn ngữ này, và các màn hình đã được dịch sẽ hiển thị bằng ngôn ngữ này.',
    currently: 'Hiện tại: {language}',
    save: 'Lưu',
    otherLanguage: 'Ngôn ngữ khác',
    saving: 'Đang lưu…',
    saved: 'Đã lưu ngôn ngữ',
    savedDevice: 'Đã lưu ngôn ngữ trên thiết bị này',
    deviceOnly: 'Chỉ lưu trên thiết bị này. Hãy tạo tài khoản để đồng bộ tùy chọn của bạn.',
    failed: 'Không thể lưu ngôn ngữ của bạn. FEED vẫn đang dùng {language}. Vui lòng thử lại.',
  },
  ar: {
    heading: 'اللغة المفضلة',
    description: 'سيرد المساعد الذكي بهذه اللغة، وستظهر بها الشاشات المترجمة.',
    currently: 'اللغة الحالية: {language}',
    save: 'حفظ',
    otherLanguage: 'لغة أخرى',
    saving: 'جارٍ الحفظ…',
    saved: 'تم حفظ اللغة',
    savedDevice: 'تم حفظ اللغة على هذا الجهاز',
    deviceOnly: 'محفوظة على هذا الجهاز فقط. أنشئ حسابًا لمزامنة تفضيلك.',
    failed: 'تعذّر حفظ لغتك. ما زال FEED بلغة {language}. يُرجى المحاولة مرة أخرى.',
  },
  zh: {
    heading: '首选语言',
    description: 'AI 助手将使用此语言回复，已翻译的页面也会以此语言显示。',
    currently: '当前：{language}',
    save: '保存',
    otherLanguage: '其他语言',
    saving: '正在保存…',
    saved: '语言已保存',
    savedDevice: '语言已保存在此设备上',
    deviceOnly: '仅保存在此设备上。创建账户即可同步您的偏好设置。',
    failed: '无法保存您的语言。FEED 仍为{language}。请重试。',
  },
  // machine-drafted, needs native review
  so: {
    heading: 'Luqadda aad doorbidayso',
    description: 'Kaaliyaha AI-ga wuxuu kugu jawaabi doonaa luqaddan, shaashadaha la turjumayna way ku muujin doonaan.',
    currently: 'Hadda: {language}',
    save: 'Keydi',
    otherLanguage: 'Luqad kale',
    saving: 'Waa la keydinayaa…',
    saved: 'Luqadda waa la keydiyay',
    savedDevice: 'Luqadda waxaa lagu keydiyay qalabkan',
    deviceOnly: 'Kaliya qalabkan ayaa lagu keydiyay. Samee akoon si aad doorashadaada u waafajiso.',
    failed: 'Luqaddaada lama keydin karin. FEED weli waa {language}. Fadlan isku day mar kale.',
  },
  fr: {
    heading: 'Langue préférée',
    description: 'L’assistant IA répondra dans cette langue, et les écrans traduits l’afficheront.',
    currently: 'Actuellement : {language}',
    save: 'Enregistrer',
    otherLanguage: 'Autre langue',
    saving: 'Enregistrement…',
    saved: 'Langue enregistrée',
    savedDevice: 'Langue enregistrée sur cet appareil',
    deviceOnly: 'Enregistrée sur cet appareil uniquement. Créez un compte pour synchroniser votre préférence.',
    failed: 'Votre langue n’a pas pu être enregistrée. FEED reste en {language}. Veuillez réessayer.',
  },
  pt: {
    heading: 'Idioma preferido',
    description: 'O assistente de IA responderá neste idioma, e as telas traduzidas o exibirão.',
    currently: 'Idioma atual: {language}',
    save: 'Salvar',
    otherLanguage: 'Outro idioma',
    saving: 'Salvando…',
    saved: 'Idioma salvo',
    savedDevice: 'Idioma salvo neste dispositivo',
    deviceOnly: 'Salvo apenas neste dispositivo. Crie uma conta para sincronizar sua preferência.',
    failed: 'Não foi possível salvar seu idioma. O FEED continua em {language}. Tente novamente.',
  },
  ru: {
    heading: 'Предпочитаемый язык',
    description: 'ИИ-помощник будет отвечать на этом языке, а переведённые экраны будут показаны на нём.',
    currently: 'Сейчас: {language}',
    save: 'Сохранить',
    otherLanguage: 'Другой язык',
    saving: 'Сохранение…',
    saved: 'Язык сохранён',
    savedDevice: 'Язык сохранён на этом устройстве',
    deviceOnly: 'Сохранено только на этом устройстве. Создайте аккаунт, чтобы синхронизировать настройку.',
    failed: 'Не удалось сохранить язык. FEED по-прежнему на языке: {language}. Попробуйте ещё раз.',
  },
  ko: {
    heading: '선호 언어',
    description: 'AI 도우미가 이 언어로 답변하며, 번역된 화면도 이 언어로 표시됩니다.',
    currently: '현재: {language}',
    save: '저장',
    otherLanguage: '기타 언어',
    saving: '저장 중…',
    saved: '언어가 저장되었습니다',
    savedDevice: '이 기기에 언어가 저장되었습니다',
    deviceOnly: '이 기기에만 저장되었습니다. 계정을 만들면 설정이 동기화됩니다.',
    failed: '언어를 저장하지 못했습니다. FEED는 계속 {language}(으)로 표시됩니다. 다시 시도해 주세요.',
  },
  tl: {
    heading: 'Gustong Wika',
    description: 'Sasagot ang AI assistant sa wikang ito, at ipapakita rin ito ng mga screen na naisalin na.',
    currently: 'Kasalukuyan: {language}',
    save: 'I-save',
    otherLanguage: 'Ibang wika',
    saving: 'Sine-save…',
    saved: 'Na-save ang wika',
    savedDevice: 'Na-save ang wika sa device na ito',
    deviceOnly: 'Sa device na ito lang naka-save. Gumawa ng account para ma-sync ang iyong kagustuhan.',
    failed: 'Hindi ma-save ang iyong wika. Nasa {language} pa rin ang FEED. Pakisubukang muli.',
  },
  // machine-drafted, needs native review
  am: {
    heading: 'የሚመርጡት ቋንቋ',
    description: 'የAI ረዳቱ በዚህ ቋንቋ ይመልሳል፤ የተተረጎሙ ገጾችም በዚህ ቋንቋ ይታያሉ።',
    currently: 'አሁን፦ {language}',
    save: 'አስቀምጥ',
    otherLanguage: 'ሌላ ቋንቋ',
    saving: 'በማስቀመጥ ላይ…',
    saved: 'ቋንቋው ተቀምጧል',
    savedDevice: 'ቋንቋው በዚህ መሣሪያ ላይ ተቀምጧል',
    deviceOnly: 'በዚህ መሣሪያ ላይ ብቻ ተቀምጧል። ምርጫዎን ለማመሳሰል መለያ ይፍጠሩ።',
    failed: 'ቋንቋዎን ማስቀመጥ አልተቻለም። FEED አሁንም በ{language} ነው። እባክዎ እንደገና ይሞክሩ።',
  },
  // machine-drafted, needs native review
  hmn: {
    heading: 'Hom lus koj nyiam',
    description: 'Tus pab AI yuav teb ua hom lus no, thiab cov nplooj uas txhais lawm yuav tso tawm ua hom lus no.',
    currently: 'Tam sim no: {language}',
    save: 'Khaws',
    otherLanguage: 'Lwm hom lus',
    saving: 'Tab tom khaws…',
    saved: 'Tau khaws hom lus lawm',
    savedDevice: 'Tau khaws hom lus rau ntawm lub cuab yeej no',
    deviceOnly: 'Tsuas khaws rau ntawm lub cuab yeej no xwb. Tsim ib tug account kom sib txuas koj qhov kev nyiam.',
    failed: 'Khaws tsis tau koj hom lus. FEED tseem yog {language}. Thov sim dua.',
  },
}

export function settingsLanguageT(locale: Locale, key: keyof SettingsLanguageMessages): string {
  return translate(settingsLanguageMessages, locale, key)
}
