// apps/web/src/lib/i18n-feed-photo.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The photo picker of the composer, the post wizard and the edit dialog
// (components/feed/post-image-picker.tsx) in the 14 FEED locales. Look up with
// photoT(locale, key) (English fallback, logged as i18n.translation_fallback); fill
// {placeholders} with formatMessage().
//
// "Remove photo" is the edit dialog's own word (lib/i18n-feed-edit.ts removePhoto), read from
// there. The upload code and the edge function still report a failure as one of their fixed
// English sentences; photoErrorText() reads each as a code.
// Parity: i18n-feed-subtabs.test.ts.
// ht, so, am and hmn are machine-drafted, needs native review: docs/i18n-native-review.md.

import { translate, type Locale } from './i18n'
import { formatMessage } from './format-message'
import { formatCount } from './i18n-intl'

export interface FeedPhotoMessages {
  /** The field label above the picker (the wizard and the edit dialog). */
  label: string
  /** Alt text of the chosen photo's preview. */
  previewAlt: string
  uploading: string
  /** The button that opens the file chooser; its visible text is its name. */
  add: string
  errUploadFailed: string
  errUnsupported: string
  errProcess: string
  /** {mb} is the limit in megabytes. */
  errTooLarge: string
  /** A guest tried to attach a photo. */
  errAccountRequired: string
}

export const feedPhotoMessages: Record<Locale, FeedPhotoMessages> = {
  en: {
    label: 'Photo (optional)',
    previewAlt: 'Selected photo preview',
    uploading: 'Uploading…',
    add: 'Add a photo',
    errUploadFailed: 'Upload failed. Please try again.',
    errUnsupported: 'That file is not a supported image.',
    errProcess: 'Could not process that image. Please try another.',
    errTooLarge: 'Image exceeds the {mb}MB limit.',
    errAccountRequired: 'Create a free account to attach a photo.',
  },
  es: {
    label: 'Foto (opcional)',
    previewAlt: 'Vista previa de la foto seleccionada',
    uploading: 'Subiendo…',
    add: 'Añadir una foto',
    errUploadFailed: 'No se pudo subir. Inténtalo de nuevo.',
    errUnsupported: 'Ese archivo no es una imagen compatible.',
    errProcess: 'No se pudo procesar esa imagen. Prueba con otra.',
    errTooLarge: 'La imagen supera el límite de {mb} MB.',
    errAccountRequired: 'Crea una cuenta gratuita para adjuntar una foto.',
  },
  // machine-drafted, needs native review
  ht: {
    label: 'Foto (si ou vle)',
    previewAlt: 'Apèsi foto ou chwazi a',
    uploading: 'N ap telechaje…',
    add: 'Ajoute yon foto',
    errUploadFailed: 'Telechajman an echwe. Tanpri eseye ankò.',
    errUnsupported: 'Fichye sa a pa yon imaj nou aksepte.',
    errProcess: 'Nou pa kapab trete imaj sa a. Tanpri eseye yon lòt.',
    errTooLarge: 'Imaj la depase limit {mb} MB la.',
    errAccountRequired: 'Kreye yon kont gratis pou w ajoute yon foto.',
  },
  vi: {
    label: 'Ảnh (không bắt buộc)',
    previewAlt: 'Xem trước ảnh đã chọn',
    uploading: 'Đang tải lên…',
    add: 'Thêm ảnh',
    errUploadFailed: 'Tải lên không thành công. Vui lòng thử lại.',
    errUnsupported: 'Tệp đó không phải là ảnh được hỗ trợ.',
    errProcess: 'Không thể xử lý ảnh đó. Vui lòng thử ảnh khác.',
    errTooLarge: 'Ảnh vượt quá giới hạn {mb} MB.',
    errAccountRequired: 'Tạo tài khoản miễn phí để đính kèm ảnh.',
  },
  ar: {
    label: 'صورة (اختياري)',
    previewAlt: 'معاينة الصورة المحددة',
    uploading: 'جارٍ الرفع…',
    add: 'إضافة صورة',
    errUploadFailed: 'فشل الرفع. يُرجى المحاولة مرة أخرى.',
    errUnsupported: 'هذا الملف ليس صورة مدعومة.',
    errProcess: 'تعذّرت معالجة هذه الصورة. يُرجى تجربة صورة أخرى.',
    errTooLarge: 'الصورة تتجاوز الحد الأقصى البالغ {mb} ميغابايت.',
    errAccountRequired: 'أنشئ حسابًا مجانيًا لإرفاق صورة.',
  },
  zh: {
    label: '照片（可选）',
    previewAlt: '所选照片预览',
    uploading: '正在上传…',
    add: '添加照片',
    errUploadFailed: '上传失败。请重试。',
    errUnsupported: '该文件不是受支持的图片。',
    errProcess: '无法处理该图片。请换一张试试。',
    errTooLarge: '图片超过 {mb} MB 的上限。',
    errAccountRequired: '创建免费账户即可附加照片。',
  },
  // machine-drafted, needs native review
  so: {
    label: 'Sawir (ikhtiyaari)',
    previewAlt: 'Horudhaca sawirka la doortay',
    uploading: 'Waa la soo gelinayaa…',
    add: 'Ku dar sawir',
    errUploadFailed: 'Soo gelintu way fashilantay. Fadlan mar kale isku day.',
    errUnsupported: 'Faylkaasi ma aha sawir la taageero.',
    errProcess: 'Sawirkaas lama farsamayn karin. Fadlan mid kale isku day.',
    errTooLarge: 'Sawirku wuu ka weyn yahay xadka {mb} MB.',
    errAccountRequired: 'Samee akoon bilaash ah si aad sawir ugu lifaaqdo.',
  },
  fr: {
    label: 'Photo (facultatif)',
    previewAlt: 'Aperçu de la photo sélectionnée',
    uploading: 'Envoi en cours…',
    add: 'Ajouter une photo',
    errUploadFailed: "L'envoi a échoué. Veuillez réessayer.",
    errUnsupported: "Ce fichier n'est pas une image prise en charge.",
    errProcess: 'Impossible de traiter cette image. Veuillez en essayer une autre.',
    errTooLarge: "L'image dépasse la limite de {mb} Mo.",
    errAccountRequired: 'Créez un compte gratuit pour joindre une photo.',
  },
  pt: {
    label: 'Foto (opcional)',
    previewAlt: 'Pré-visualização da foto selecionada',
    uploading: 'Enviando…',
    add: 'Adicionar uma foto',
    errUploadFailed: 'Falha no envio. Tente novamente.',
    errUnsupported: 'Esse arquivo não é uma imagem compatível.',
    errProcess: 'Não foi possível processar essa imagem. Tente outra.',
    errTooLarge: 'A imagem ultrapassa o limite de {mb} MB.',
    errAccountRequired: 'Crie uma conta gratuita para anexar uma foto.',
  },
  ru: {
    label: 'Фото (необязательно)',
    previewAlt: 'Предпросмотр выбранного фото',
    uploading: 'Загрузка…',
    add: 'Добавить фото',
    errUploadFailed: 'Не удалось загрузить. Попробуйте ещё раз.',
    errUnsupported: 'Этот файл не является поддерживаемым изображением.',
    errProcess: 'Не удалось обработать это изображение. Попробуйте другое.',
    errTooLarge: 'Изображение превышает лимит в {mb} МБ.',
    errAccountRequired: 'Создайте бесплатный аккаунт, чтобы прикрепить фото.',
  },
  ko: {
    label: '사진 (선택)',
    previewAlt: '선택한 사진 미리보기',
    uploading: '업로드 중…',
    add: '사진 추가',
    errUploadFailed: '업로드하지 못했습니다. 다시 시도해 주세요.',
    errUnsupported: '지원되는 이미지 파일이 아닙니다.',
    errProcess: '이미지를 처리하지 못했습니다. 다른 이미지를 사용해 보세요.',
    errTooLarge: '이미지가 {mb}MB 한도를 초과합니다.',
    errAccountRequired: '사진을 첨부하려면 무료 계정을 만드세요.',
  },
  tl: {
    label: 'Larawan (opsyonal)',
    previewAlt: 'Preview ng napiling larawan',
    uploading: 'Ina-upload…',
    add: 'Magdagdag ng larawan',
    errUploadFailed: 'Hindi na-upload. Pakisubukang muli.',
    errUnsupported: 'Ang file na iyon ay hindi sinusuportahang larawan.',
    errProcess: 'Hindi maproseso ang larawang iyon. Pakisubukan ang iba.',
    errTooLarge: 'Lampas ang larawan sa limitasyong {mb} MB.',
    errAccountRequired: 'Gumawa ng libreng account para makapag-attach ng larawan.',
  },
  // machine-drafted, needs native review
  am: {
    label: 'ፎቶ (አማራጭ)',
    previewAlt: 'የተመረጠው ፎቶ ቅድመ እይታ',
    uploading: 'በመስቀል ላይ…',
    add: 'ፎቶ አክል',
    errUploadFailed: 'መስቀል አልተሳካም። እባክዎ እንደገና ይሞክሩ።',
    errUnsupported: 'ያ ፋይል የሚደገፍ ምስል አይደለም።',
    errProcess: 'ያንን ምስል ማስኬድ አልተቻለም። እባክዎ ሌላ ይሞክሩ።',
    errTooLarge: 'ምስሉ ከ{mb} ሜባ ገደብ ይበልጣል።',
    errAccountRequired: 'ፎቶ ለማያያዝ ነፃ መለያ ይፍጠሩ።',
  },
  // machine-drafted, needs native review
  hmn: {
    label: 'Duab (xaiv tau)',
    previewAlt: 'Saib ua ntej daim duab uas xaiv',
    uploading: 'Tab tom xa…',
    add: 'Ntxiv ib daim duab',
    errUploadFailed: 'Xa tsis tau. Thov sim dua.',
    errUnsupported: 'Cov ntaub ntawv ntawd tsis yog ib daim duab uas siv tau.',
    errProcess: 'Ua tsis tau daim duab ntawd. Thov sim lwm daim.',
    errTooLarge: 'Daim duab loj tshaj qhov txwv {mb} MB.',
    errAccountRequired: 'Tsim ib tus account dawb los txuas ib daim duab.',
  },
}

export function photoT(locale: Locale, key: keyof FeedPhotoMessages): string {
  return translate(feedPhotoMessages, locale, key)
}

// ---------------------------------------------------------------------------
// Failures — sentences read as codes
// ---------------------------------------------------------------------------

/**
 * Each fixed sentence the picker can be handed and the key of the member's sentence. They come
 * from components/feed/post-image-picker.tsx, lib/post-image-upload.ts and the post-image-upload
 * edge function (supabase/functions/post-image-upload), none of which the translation work
 * changes. i18n-feed-photo.test.ts fails when one of those files gains a sentence this table
 * does not know.
 */
export const PHOTO_ERROR_SENTENCES: Record<string, keyof FeedPhotoMessages> = {
  'Could not upload that image.': 'errUploadFailed',
  'Upload failed. Please try again.': 'errUploadFailed',
  'Upload failed.': 'errUploadFailed',
  'That file is not a supported image.': 'errUnsupported',
  'Could not process that image. Please try another.': 'errProcess',
  'Create a free account to attach a photo.': 'errAccountRequired',
}

/** "Too large", from the client check (lib/security.ts) or the edge function: the limit in MB. */
const TOO_LARGE = /^(?:File size exceeds|Image exceeds the) (\d{1,4})MB limit\.?$/
/** The client check naming a type or an extension it does not take. */
const NOT_ALLOWED = /^File (?:type|extension) \S{0,100} is not allowed$/

/**
 * What the picker shows for a failure. A sentence FEED wrote reads in the viewer's language
 * (`translated: true`). Anything else is returned as received with `translated: false`, so the
 * picker marks it lang="en" dir="ltr".
 */
export function photoErrorText(error: string, locale: Locale): { text: string; translated: boolean } {
  if (Object.prototype.hasOwnProperty.call(PHOTO_ERROR_SENTENCES, error)) {
    return { text: photoT(locale, PHOTO_ERROR_SENTENCES[error]), translated: true }
  }
  const size = TOO_LARGE.exec(error)
  if (size) return { text: formatMessage(photoT(locale, 'errTooLarge'), { mb: formatCount(Number(size[1]), locale) }), translated: true }
  if (NOT_ALLOWED.test(error)) return { text: photoT(locale, 'errUnsupported'), translated: true }
  return { text: error, translated: false }
}
