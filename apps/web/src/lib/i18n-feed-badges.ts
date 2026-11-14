// apps/web/src/lib/i18n-feed-badges.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The author badges of a feed post card and the sheets they open, in the 14 FEED locales: the
// Harmony badge and the wheat-stalk rating (components/feed/harmony-badge.tsx,
// components/ui/wheat-stalk-rating.tsx), the badge strip and the badge list
// (components/appreciation/author-badge-strip.tsx, components/profile/engagement-badges.tsx), the
// author sheet with its appreciation picker and the "Gifts received" shelf
// (components/appreciation/*), and the review dialog (components/feed/review-modal.tsx). Look up
// with badgesT(locale, key) (English fallback, logged as i18n.translation_fallback); fill
// {placeholders} with formatMessage().
//
// Stored values stay as stored, each with one label function here: a badge (badgeLabel — the ten
// category families read from the composer's category chips, their one translation), an
// appreciation item slug (appreciationItemLabel / appreciationItemAlt), the reviewed member's
// role (reviewDescription). lib/appreciation.ts and hooks/use-reviews.ts still report a failure as
// a fixed English sentence, read here as a code. Words other surfaces already have are read from
// them: Follow / Following / Cancel / Close (lib/i18n-feed-card.ts), Retry / Loading… / Create
// free account (lib/i18n-feed-chrome.ts), Yes / No (lib/i18n-feed-edit.ts), the tier marker
// (roleLabel).
// Parity: i18n-feed-subtabs.test.ts; the plural tables and vocabulary: i18n-feed-badges.test.ts.
// ht, so, am and hmn are machine-drafted, needs native review: docs/i18n-native-review.md.

import { translate, type Locale } from './i18n'
import { formatMessage } from './format-message'
import { formatCount, pluralMessage, type PluralForms } from './i18n-intl'
import { requestCategoryLabel } from './i18n-feed-composer'
import { readErrorSentence, type ErrorText } from './i18n-friendly-error'

export interface FeedBadgesMessages {
  // Harmony badge and the wheat-stalk rating
  /** No reviews yet. */
  harmonyNew: string
  /** Name of a rating shown as stalks. */
  ratingOutOf: string
  // The six community badges (profiles.badge_summary.badges keys); the ten category
  // families read from requestCategoryLabel (lib/i18n-feed-composer.ts)
  badgeHelper: string
  badgeConnector: string
  badgeVoice: string
  badgeAdvocate: string
  badgeWatcher: string
  badgeAppreciated: string
  /** Tooltip of a badge chip. */
  badgeTitle: string
  /** Screen-reader text of a category badge. */
  badgeCategoryAria: string
  /** Screen-reader text of a community badge. */
  badgeCommunityAria: string
  /** The short level beside a badge; {level} is a roman numeral. */
  levelShort: string
  badgesHeading: string
  /** Around the member's own name. */
  badgesEmpty: string
  /** The owner-only badge section (Settings). */
  privateHeading: string
  privateBody: string
  // The 12 appreciation items (lib/appreciation.ts slugs): the word under each icon
  itemHeart: string
  itemSmile: string
  itemCheer: string
  itemFlower: string
  itemSunflower: string
  itemLeaf: string
  itemBread: string
  itemApple: string
  itemSoup: string
  itemSun: string
  itemSeedling: string
  itemTree: string
  // …and what each icon shows (its title)
  altHeart: string
  altSmile: string
  altCheer: string
  altFlower: string
  altSunflower: string
  altLeaf: string
  altBread: string
  altApple: string
  altSoup: string
  altSun: string
  altSeedling: string
  altTree: string
  // The author sheet and its appreciation picker
  /** Accessible name of a picker button: the word under the icon first. */
  itemSentAria: string
  itemSendAria: string
  /** Said once an item has been sent. */
  itemSentNotice: string
  /** Guest prompt in place of following; {name} is the author. */
  guestFollowPrompt: string
  /** Around the author's own name. */
  appreciateHeading: string
  appreciateSelf: string
  appreciateGuestPrompt: string
  sendAppreciation: string
  // Failures of lib/appreciation.ts
  errItemUnavailable: string
  errSendTimeout: string
  errSendFailed: string
  errSentTimeout: string
  errSentFailed: string
  errShelfTimeout: string
  errShelfFailed: string
  // The "Gifts received" shelf (Settings)
  giftsHeading: string
  giftsLoading: string
  giftsEmpty: string
  /** Who sent an item: nobody named, then one, two, three names ({a} {b} {c} are the givers' own names). */
  giftsFromCommunity: string
  giftsFromOne: string
  giftsFromTwo: string
  giftsFromThree: string
  /** A giver with no name on their profile. */
  someone: string
  // The review dialog (components/feed/review-modal.tsx)
  /** Around the reviewed member's own name. */
  reviewTitle: string
  /** One sentence per role of the reviewed member (a code from the caller): the one who offered… */
  reviewDescSourcer: string
  /** …the one who asked… */
  reviewDescSeeker: string
  /** …the one who sent a request to a volunteer… */
  reviewDescRequester: string
  /** …the volunteer… */
  reviewDescVolunteer: string
  /** …and any other value. */
  reviewDescPerson: string
  ratingLabel: string
  /** Names the Yes / No pair below it. */
  recommendQuestion: string
  commentLabel: string
  /** {max} is the longest comment, in characters. */
  commentHint: string
  commentPlaceholder: string
  submitReview: string
  errRatingRequired: string
  errSubmitFailed: string
  // Failures of hooks/use-reviews.ts (submitReview)
  errReviewTimeout: string
  errReviewFailed: string
}

export const feedBadgesMessages: Record<Locale, FeedBadgesMessages> = {
  en: {
    harmonyNew: 'New',
    ratingOutOf: '{value} out of {max} stalks',
    badgeHelper: 'Helper',
    badgeConnector: 'Connector',
    badgeVoice: 'Voice',
    badgeAdvocate: 'Advocate',
    badgeWatcher: 'Watcher',
    badgeAppreciated: 'Appreciated',
    badgeTitle: '{label} · level {level}',
    badgeCategoryAria: '{label} category badge, level {level}',
    badgeCommunityAria: '{label} community badge, level {level}',
    levelShort: 'Lv {level}',
    badgesHeading: 'Community Badges',
    badgesEmpty: 'No badges yet — {name} earns badges by helping, connecting, and taking part.',
    privateHeading: 'Private — only you can see this',
    privateBody: 'Credit for the help you receive, and for what you save and bookmark. Not shown to anyone else.',
    itemHeart: 'Heart',
    itemSmile: 'Smile',
    itemCheer: 'Cheer',
    itemFlower: 'Flower',
    itemSunflower: 'Sunflower',
    itemLeaf: 'Leaf',
    itemBread: 'Bread',
    itemApple: 'Apple',
    itemSoup: 'Soup',
    itemSun: 'Sun',
    itemSeedling: 'Seedling',
    itemTree: 'Tree',
    altHeart: 'A heart',
    altSmile: 'A smiling face',
    altCheer: 'Cheering hands',
    altFlower: 'A flower',
    altSunflower: 'A sunflower',
    altLeaf: 'A leaf',
    altBread: 'A loaf of bread',
    altApple: 'An apple',
    altSoup: 'A bowl of soup',
    altSun: 'The sun',
    altSeedling: 'A seedling',
    altTree: 'A tree',
    itemSentAria: '{item} — already sent',
    itemSendAria: '{item} — send',
    itemSentNotice: '{item} sent.',
    guestFollowPrompt: 'Create a free account to follow {name}',
    appreciateHeading: 'Appreciate {name}',
    appreciateSelf: 'This is you — appreciation comes from the community.',
    appreciateGuestPrompt: 'Create a free account to send appreciation',
    sendAppreciation: 'Send appreciation',
    errItemUnavailable: 'That appreciation item is not available.',
    errSendTimeout: 'Sending appreciation timed out — please try again.',
    errSendFailed: "Couldn't send appreciation. Please try again.",
    errSentTimeout: 'Loading sent gifts timed out — please try again.',
    errSentFailed: "Couldn't load sent gifts.",
    errShelfTimeout: 'Loading your gifts timed out — please try again.',
    errShelfFailed: "Couldn't load your gifts.",
    giftsHeading: 'Gifts received',
    giftsLoading: 'Loading your gifts…',
    giftsEmpty: 'No gifts yet — appreciation from the community shows up here.',
    giftsFromCommunity: 'from the community',
    giftsFromOne: 'from {a}',
    giftsFromTwo: 'from {a} & {b}',
    giftsFromThree: 'from {a}, {b} & {c}',
    someone: 'Someone',
    reviewTitle: 'Review {name}',
    reviewDescSourcer: 'Share your experience with this sourcer. Your rating contributes to their Harmony Score.',
    reviewDescSeeker: 'Share your experience with this seeker. Your rating contributes to their Harmony Score.',
    reviewDescRequester: 'Share your experience with this requester. Your rating contributes to their Harmony Score.',
    reviewDescVolunteer: 'Share your experience with this volunteer. Your rating contributes to their Harmony Score.',
    reviewDescPerson: 'Share your experience with this person. Your rating contributes to their Harmony Score.',
    ratingLabel: 'Rating',
    recommendQuestion: 'Would you recommend this person?',
    commentLabel: 'Comment',
    commentHint: '(optional, max {max} chars)',
    commentPlaceholder: 'Describe your experience...',
    submitReview: 'Submit Review',
    errRatingRequired: 'Please select a stalk rating before submitting.',
    errSubmitFailed: 'Submission failed. Please try again.',
    errReviewTimeout: 'Review submission timed out — please check your connection and retry.',
    errReviewFailed: "Couldn't submit review. Please try again.",
  },
  es: {
    harmonyNew: 'Nuevo',
    ratingOutOf: '{value} de {max} espigas',
    badgeHelper: 'Ayudante',
    badgeConnector: 'Conector',
    badgeVoice: 'Voz',
    badgeAdvocate: 'Defensor',
    badgeWatcher: 'Vigilante',
    badgeAppreciated: 'Apreciado',
    badgeTitle: '{label} · nivel {level}',
    badgeCategoryAria: 'Insignia de categoría {label}, nivel {level}',
    badgeCommunityAria: 'Insignia comunitaria {label}, nivel {level}',
    levelShort: 'Nv. {level}',
    badgesHeading: 'Insignias de la comunidad',
    badgesEmpty: 'Aún no hay insignias: {name} gana insignias al ayudar, conectar y participar.',
    privateHeading: 'Privado: solo tú puedes verlo',
    privateBody: 'Reconocimiento por la ayuda que recibes y por lo que guardas y marcas. No se muestra a nadie más.',
    itemHeart: 'Corazón',
    itemSmile: 'Sonrisa',
    itemCheer: 'Aplauso',
    itemFlower: 'Flor',
    itemSunflower: 'Girasol',
    itemLeaf: 'Hoja',
    itemBread: 'Pan',
    itemApple: 'Manzana',
    itemSoup: 'Sopa',
    itemSun: 'Sol',
    itemSeedling: 'Brote',
    itemTree: 'Árbol',
    altHeart: 'Un corazón',
    altSmile: 'Una cara sonriente',
    altCheer: 'Manos que aplauden',
    altFlower: 'Una flor',
    altSunflower: 'Un girasol',
    altLeaf: 'Una hoja',
    altBread: 'Una hogaza de pan',
    altApple: 'Una manzana',
    altSoup: 'Un plato de sopa',
    altSun: 'El sol',
    altSeedling: 'Un brote',
    altTree: 'Un árbol',
    itemSentAria: '{item}: ya enviado',
    itemSendAria: '{item}: enviar',
    itemSentNotice: 'Enviado: {item}.',
    guestFollowPrompt: 'Crea una cuenta gratuita para seguir a {name}',
    appreciateHeading: 'Agradece a {name}',
    appreciateSelf: 'Eres tú: el agradecimiento viene de la comunidad.',
    appreciateGuestPrompt: 'Crea una cuenta gratuita para enviar tu agradecimiento',
    sendAppreciation: 'Enviar agradecimiento',
    errItemUnavailable: 'Ese obsequio de agradecimiento no está disponible.',
    errSendTimeout: 'El envío del agradecimiento tardó demasiado. Inténtalo de nuevo.',
    errSendFailed: 'No se pudo enviar el agradecimiento. Inténtalo de nuevo.',
    errSentTimeout: 'Cargar los obsequios enviados tardó demasiado. Inténtalo de nuevo.',
    errSentFailed: 'No se pudieron cargar los obsequios enviados.',
    errShelfTimeout: 'Cargar tus obsequios tardó demasiado. Inténtalo de nuevo.',
    errShelfFailed: 'No se pudieron cargar tus obsequios.',
    giftsHeading: 'Obsequios recibidos',
    giftsLoading: 'Cargando tus obsequios…',
    giftsEmpty: 'Aún no hay obsequios: aquí aparecerá el agradecimiento de la comunidad.',
    giftsFromCommunity: 'de la comunidad',
    giftsFromOne: 'de {a}',
    giftsFromTwo: 'de {a} y {b}',
    giftsFromThree: 'de {a}, {b} y {c}',
    someone: 'Alguien',
    reviewTitle: 'Valorar a {name}',
    reviewDescSourcer: 'Comparte tu experiencia con quien ofreció esta ayuda. Tu valoración cuenta para su puntuación de Armonía.',
    reviewDescSeeker: 'Comparte tu experiencia con quien solicitó esta ayuda. Tu valoración cuenta para su puntuación de Armonía.',
    reviewDescRequester: 'Comparte tu experiencia con quien hizo la solicitud. Tu valoración cuenta para su puntuación de Armonía.',
    reviewDescVolunteer: 'Comparte tu experiencia con esta persona voluntaria. Tu valoración cuenta para su puntuación de Armonía.',
    reviewDescPerson: 'Comparte tu experiencia con esta persona. Tu valoración cuenta para su puntuación de Armonía.',
    ratingLabel: 'Valoración',
    recommendQuestion: '¿Recomendarías a esta persona?',
    commentLabel: 'Comentario',
    commentHint: '(opcional, máx. {max} caracteres)',
    commentPlaceholder: 'Describe tu experiencia...',
    submitReview: 'Enviar valoración',
    errRatingRequired: 'Elige una valoración con espigas antes de enviar.',
    errSubmitFailed: 'No se pudo enviar. Inténtalo de nuevo.',
    errReviewTimeout: 'El envío de la valoración tardó demasiado. Revisa tu conexión e inténtalo de nuevo.',
    errReviewFailed: 'No se pudo enviar la valoración. Inténtalo de nuevo.',
  },
  // machine-drafted, needs native review
  ht: {
    harmonyNew: 'Nouvo',
    ratingOutOf: '{value} sou {max} zepi',
    badgeHelper: 'Moun k ap ede',
    badgeConnector: 'Moun k ap konekte',
    badgeVoice: 'Vwa',
    badgeAdvocate: 'Defansè',
    badgeWatcher: 'Veyatif',
    badgeAppreciated: 'Yo apresye',
    badgeTitle: '{label} · nivo {level}',
    badgeCategoryAria: 'Badj kategori {label}, nivo {level}',
    badgeCommunityAria: 'Badj kominote {label}, nivo {level}',
    levelShort: 'Nivo {level}',
    badgesHeading: 'Badj kominote',
    badgesEmpty: 'Poko gen badj — {name} ap genyen badj lè li ede, konekte ak patisipe.',
    privateHeading: 'Prive — se ou sèl ki ka wè sa',
    privateBody: 'Rekonesans pou èd ou resevwa, ak pou sa ou sove epi make. Pèsonn lòt pa wè li.',
    itemHeart: 'Kè',
    itemSmile: 'Souri',
    itemCheer: 'Bravo',
    itemFlower: 'Flè',
    itemSunflower: 'Flè solèy',
    itemLeaf: 'Fèy',
    itemBread: 'Pen',
    itemApple: 'Pòm',
    itemSoup: 'Bouyon',
    itemSun: 'Solèy',
    itemSeedling: 'Ti plant',
    itemTree: 'Pyebwa',
    altHeart: 'Yon kè',
    altSmile: 'Yon figi k ap souri',
    altCheer: 'Men k ap bat bravo',
    altFlower: 'Yon flè',
    altSunflower: 'Yon flè solèy',
    altLeaf: 'Yon fèy',
    altBread: 'Yon pen',
    altApple: 'Yon pòm',
    altSoup: 'Yon bòl bouyon',
    altSun: 'Solèy la',
    altSeedling: 'Yon ti plant',
    altTree: 'Yon pyebwa',
    itemSentAria: '{item} — deja voye',
    itemSendAria: '{item} — voye',
    itemSentNotice: '{item} voye.',
    guestFollowPrompt: 'Kreye yon kont gratis pou w swiv {name}',
    appreciateHeading: 'Remèsye {name}',
    appreciateSelf: 'Sa se ou menm — remèsiman an soti nan kominote a.',
    appreciateGuestPrompt: 'Kreye yon kont gratis pou w voye remèsiman',
    sendAppreciation: 'Voye remèsiman',
    errItemUnavailable: 'Kado remèsiman sa a pa disponib.',
    errSendTimeout: 'Voye remèsiman an pran twòp tan. Tanpri eseye ankò.',
    errSendFailed: 'Nou pa kapab voye remèsiman an. Tanpri eseye ankò.',
    errSentTimeout: 'Chajman kado ou voye yo pran twòp tan. Tanpri eseye ankò.',
    errSentFailed: 'Nou pa kapab chaje kado ou voye yo.',
    errShelfTimeout: 'Chajman kado ou yo pran twòp tan. Tanpri eseye ankò.',
    errShelfFailed: 'Nou pa kapab chaje kado ou yo.',
    giftsHeading: 'Kado ou resevwa',
    giftsLoading: 'N ap chaje kado ou yo…',
    giftsEmpty: 'Poko gen kado — remèsiman kominote a ap parèt isit la.',
    giftsFromCommunity: 'nan men kominote a',
    giftsFromOne: 'nan men {a}',
    giftsFromTwo: 'nan men {a} ak {b}',
    giftsFromThree: 'nan men {a}, {b} ak {c}',
    someone: 'Yon moun',
    reviewTitle: 'Evalye {name}',
    reviewDescSourcer: 'Pataje eksperyans ou ak moun ki ofri èd sa a. Evalyasyon ou a konte nan Nòt Amoni li.',
    reviewDescSeeker: 'Pataje eksperyans ou ak moun ki mande èd sa a. Evalyasyon ou a konte nan Nòt Amoni li.',
    reviewDescRequester: 'Pataje eksperyans ou ak moun ki fè demann lan. Evalyasyon ou a konte nan Nòt Amoni li.',
    reviewDescVolunteer: 'Pataje eksperyans ou ak volontè sa a. Evalyasyon ou a konte nan Nòt Amoni li.',
    reviewDescPerson: 'Pataje eksperyans ou ak moun sa a. Evalyasyon ou a konte nan Nòt Amoni li.',
    ratingLabel: 'Evalyasyon',
    recommendQuestion: 'Èske ou ta rekòmande moun sa a?',
    commentLabel: 'Kòmantè',
    commentHint: '(si ou vle, {max} karaktè maksimòm)',
    commentPlaceholder: 'Dekri eksperyans ou...',
    submitReview: 'Voye evalyasyon an',
    errRatingRequired: 'Tanpri chwazi yon evalyasyon ak zepi anvan ou voye.',
    errSubmitFailed: 'Voye a echwe. Tanpri eseye ankò.',
    errReviewTimeout: 'Voye evalyasyon an pran twòp tan. Tanpri verifye koneksyon ou epi eseye ankò.',
    errReviewFailed: 'Nou pa kapab voye evalyasyon an. Tanpri eseye ankò.',
  },
  vi: {
    harmonyNew: 'Mới',
    ratingOutOf: '{value} trên {max} bông lúa',
    badgeHelper: 'Người giúp đỡ',
    badgeConnector: 'Người kết nối',
    badgeVoice: 'Tiếng nói',
    badgeAdvocate: 'Người vận động',
    badgeWatcher: 'Người canh giữ',
    badgeAppreciated: 'Được trân trọng',
    badgeTitle: '{label} · cấp {level}',
    badgeCategoryAria: 'Huy hiệu danh mục {label}, cấp {level}',
    badgeCommunityAria: 'Huy hiệu cộng đồng {label}, cấp {level}',
    levelShort: 'Cấp {level}',
    badgesHeading: 'Huy hiệu cộng đồng',
    badgesEmpty: 'Chưa có huy hiệu — {name} nhận huy hiệu khi giúp đỡ, kết nối và tham gia.',
    privateHeading: 'Riêng tư — chỉ bạn thấy được',
    privateBody: 'Ghi nhận cho sự giúp đỡ bạn nhận được và cho những gì bạn lưu, đánh dấu. Không hiển thị với ai khác.',
    itemHeart: 'Trái tim',
    itemSmile: 'Nụ cười',
    itemCheer: 'Cổ vũ',
    itemFlower: 'Bông hoa',
    itemSunflower: 'Hoa hướng dương',
    itemLeaf: 'Chiếc lá',
    itemBread: 'Bánh mì',
    itemApple: 'Quả táo',
    itemSoup: 'Súp',
    itemSun: 'Mặt trời',
    itemSeedling: 'Cây non',
    itemTree: 'Cái cây',
    altHeart: 'Một trái tim',
    altSmile: 'Một khuôn mặt cười',
    altCheer: 'Đôi tay cổ vũ',
    altFlower: 'Một bông hoa',
    altSunflower: 'Một bông hoa hướng dương',
    altLeaf: 'Một chiếc lá',
    altBread: 'Một ổ bánh mì',
    altApple: 'Một quả táo',
    altSoup: 'Một bát súp',
    altSun: 'Mặt trời',
    altSeedling: 'Một cây non',
    altTree: 'Một cái cây',
    itemSentAria: '{item} — đã gửi',
    itemSendAria: '{item} — gửi',
    itemSentNotice: 'Đã gửi {item}.',
    guestFollowPrompt: 'Tạo tài khoản miễn phí để theo dõi {name}',
    appreciateHeading: 'Cảm ơn {name}',
    appreciateSelf: 'Đây là bạn — lời cảm ơn đến từ cộng đồng.',
    appreciateGuestPrompt: 'Tạo tài khoản miễn phí để gửi lời cảm ơn',
    sendAppreciation: 'Gửi lời cảm ơn',
    errItemUnavailable: 'Món quà cảm ơn đó hiện không có.',
    errSendTimeout: 'Gửi lời cảm ơn quá lâu. Vui lòng thử lại.',
    errSendFailed: 'Không thể gửi lời cảm ơn. Vui lòng thử lại.',
    errSentTimeout: 'Tải các món quà đã gửi quá lâu. Vui lòng thử lại.',
    errSentFailed: 'Không thể tải các món quà đã gửi.',
    errShelfTimeout: 'Tải quà của bạn quá lâu. Vui lòng thử lại.',
    errShelfFailed: 'Không thể tải quà của bạn.',
    giftsHeading: 'Quà đã nhận',
    giftsLoading: 'Đang tải quà của bạn…',
    giftsEmpty: 'Chưa có quà — lời cảm ơn từ cộng đồng sẽ hiện ở đây.',
    giftsFromCommunity: 'từ cộng đồng',
    giftsFromOne: 'từ {a}',
    giftsFromTwo: 'từ {a} và {b}',
    giftsFromThree: 'từ {a}, {b} và {c}',
    someone: 'Ai đó',
    reviewTitle: 'Đánh giá {name}',
    reviewDescSourcer: 'Chia sẻ trải nghiệm của bạn với người cho này. Đánh giá của bạn được tính vào Điểm Hòa hợp của họ.',
    reviewDescSeeker: 'Chia sẻ trải nghiệm của bạn với người nhận này. Đánh giá của bạn được tính vào Điểm Hòa hợp của họ.',
    reviewDescRequester: 'Chia sẻ trải nghiệm của bạn với người gửi yêu cầu này. Đánh giá của bạn được tính vào Điểm Hòa hợp của họ.',
    reviewDescVolunteer: 'Chia sẻ trải nghiệm của bạn với tình nguyện viên này. Đánh giá của bạn được tính vào Điểm Hòa hợp của họ.',
    reviewDescPerson: 'Chia sẻ trải nghiệm của bạn với người này. Đánh giá của bạn được tính vào Điểm Hòa hợp của họ.',
    ratingLabel: 'Đánh giá',
    recommendQuestion: 'Bạn có giới thiệu người này không?',
    commentLabel: 'Nhận xét',
    commentHint: '(không bắt buộc, tối đa {max} ký tự)',
    commentPlaceholder: 'Mô tả trải nghiệm của bạn...',
    submitReview: 'Gửi đánh giá',
    errRatingRequired: 'Vui lòng chọn số bông lúa trước khi gửi.',
    errSubmitFailed: 'Gửi không thành công. Vui lòng thử lại.',
    errReviewTimeout: 'Gửi đánh giá quá lâu. Vui lòng kiểm tra kết nối và thử lại.',
    errReviewFailed: 'Không thể gửi đánh giá. Vui lòng thử lại.',
  },
  ar: {
    harmonyNew: 'جديد',
    ratingOutOf: '{value} من {max} سنابل',
    badgeHelper: 'مُعين',
    badgeConnector: 'واصل',
    badgeVoice: 'صوت',
    badgeAdvocate: 'مُناصر',
    badgeWatcher: 'راصد',
    badgeAppreciated: 'محلّ تقدير',
    badgeTitle: '{label} · المستوى {level}',
    badgeCategoryAria: 'شارة فئة {label}، المستوى {level}',
    badgeCommunityAria: 'شارة مجتمعية {label}، المستوى {level}',
    levelShort: 'مستوى {level}',
    badgesHeading: 'شارات المجتمع',
    badgesEmpty: 'لا توجد شارات بعد — يحصل {name} على الشارات بالمساعدة والتواصل والمشاركة.',
    privateHeading: 'خاص — أنت فقط من يرى هذا',
    privateBody: 'تقدير للمساعدة التي تتلقاها ولما تحفظه وتضع عليه إشارة. لا يظهر لأي شخص آخر.',
    itemHeart: 'قلب',
    itemSmile: 'ابتسامة',
    itemCheer: 'تشجيع',
    itemFlower: 'زهرة',
    itemSunflower: 'عبّاد الشمس',
    itemLeaf: 'ورقة شجر',
    itemBread: 'خبز',
    itemApple: 'تفاحة',
    itemSoup: 'حساء',
    itemSun: 'شمس',
    itemSeedling: 'شتلة',
    itemTree: 'شجرة',
    altHeart: 'قلب',
    altSmile: 'وجه مبتسم',
    altCheer: 'يدان تصفّقان',
    altFlower: 'زهرة',
    altSunflower: 'زهرة عبّاد الشمس',
    altLeaf: 'ورقة شجر',
    altBread: 'رغيف خبز',
    altApple: 'تفاحة',
    altSoup: 'وعاء حساء',
    altSun: 'الشمس',
    altSeedling: 'شتلة',
    altTree: 'شجرة',
    itemSentAria: '{item} — أُرسل من قبل',
    itemSendAria: '{item} — إرسال',
    itemSentNotice: 'تم إرسال {item}.',
    guestFollowPrompt: 'أنشئ حسابًا مجانيًا لمتابعة {name}',
    appreciateHeading: 'عبّر عن تقديرك لـ {name}',
    appreciateSelf: 'هذا أنت — التقدير يأتي من المجتمع.',
    appreciateGuestPrompt: 'أنشئ حسابًا مجانيًا لإرسال التقدير',
    sendAppreciation: 'إرسال تقدير',
    errItemUnavailable: 'عنصر التقدير هذا غير متاح.',
    errSendTimeout: 'انتهت مهلة إرسال التقدير. يُرجى المحاولة مرة أخرى.',
    errSendFailed: 'تعذّر إرسال التقدير. يُرجى المحاولة مرة أخرى.',
    errSentTimeout: 'انتهت مهلة تحميل الهدايا المرسلة. يُرجى المحاولة مرة أخرى.',
    errSentFailed: 'تعذّر تحميل الهدايا المرسلة.',
    errShelfTimeout: 'انتهت مهلة تحميل هداياك. يُرجى المحاولة مرة أخرى.',
    errShelfFailed: 'تعذّر تحميل هداياك.',
    giftsHeading: 'الهدايا المستلمة',
    giftsLoading: 'جارٍ تحميل هداياك…',
    giftsEmpty: 'لا توجد هدايا بعد — يظهر هنا تقدير المجتمع.',
    giftsFromCommunity: 'من المجتمع',
    giftsFromOne: 'من {a}',
    giftsFromTwo: 'من {a} و{b}',
    giftsFromThree: 'من {a} و{b} و{c}',
    someone: 'شخص ما',
    reviewTitle: 'تقييم {name}',
    reviewDescSourcer: 'شارك تجربتك مع مقدّم المساعدة هذا. يُحتسب تقييمك ضمن درجة الانسجام الخاصة به.',
    reviewDescSeeker: 'شارك تجربتك مع طالب المساعدة هذا. يُحتسب تقييمك ضمن درجة الانسجام الخاصة به.',
    reviewDescRequester: 'شارك تجربتك مع صاحب الطلب هذا. يُحتسب تقييمك ضمن درجة الانسجام الخاصة به.',
    reviewDescVolunteer: 'شارك تجربتك مع هذا المتطوع. يُحتسب تقييمك ضمن درجة الانسجام الخاصة به.',
    reviewDescPerson: 'شارك تجربتك مع هذا الشخص. يُحتسب تقييمك ضمن درجة الانسجام الخاصة به.',
    ratingLabel: 'التقييم',
    recommendQuestion: 'هل توصي بهذا الشخص؟',
    commentLabel: 'تعليق',
    commentHint: '(اختياري، {max} حرف كحد أقصى)',
    commentPlaceholder: 'صف تجربتك...',
    submitReview: 'إرسال التقييم',
    errRatingRequired: 'يُرجى اختيار تقييم بالسنابل قبل الإرسال.',
    errSubmitFailed: 'فشل الإرسال. يُرجى المحاولة مرة أخرى.',
    errReviewTimeout: 'انتهت مهلة إرسال التقييم. يُرجى التحقق من اتصالك والمحاولة مرة أخرى.',
    errReviewFailed: 'تعذّر إرسال التقييم. يُرجى المحاولة مرة أخرى.',
  },
  zh: {
    harmonyNew: '新成员',
    ratingOutOf: '{value}/{max} 麦穗',
    badgeHelper: '帮手',
    badgeConnector: '联络人',
    badgeVoice: '发声者',
    badgeAdvocate: '倡导者',
    badgeWatcher: '守望者',
    badgeAppreciated: '受人感谢',
    badgeTitle: '{label} · {level} 级',
    badgeCategoryAria: '{label}类别徽章，{level} 级',
    badgeCommunityAria: '{label}社区徽章，{level} 级',
    levelShort: '{level} 级',
    badgesHeading: '社区徽章',
    badgesEmpty: '暂无徽章 — {name} 通过帮助他人、建立联系和参与活动来获得徽章。',
    privateHeading: '私密 — 仅您可见',
    privateBody: '记录您获得的帮助，以及您保存和收藏的内容。不会向其他任何人显示。',
    itemHeart: '爱心',
    itemSmile: '微笑',
    itemCheer: '喝彩',
    itemFlower: '花朵',
    itemSunflower: '向日葵',
    itemLeaf: '叶子',
    itemBread: '面包',
    itemApple: '苹果',
    itemSoup: '热汤',
    itemSun: '太阳',
    itemSeedling: '幼苗',
    itemTree: '树',
    altHeart: '一颗爱心',
    altSmile: '一张笑脸',
    altCheer: '鼓掌的双手',
    altFlower: '一朵花',
    altSunflower: '一朵向日葵',
    altLeaf: '一片叶子',
    altBread: '一条面包',
    altApple: '一个苹果',
    altSoup: '一碗热汤',
    altSun: '太阳',
    altSeedling: '一株幼苗',
    altTree: '一棵树',
    itemSentAria: '{item} — 已送出',
    itemSendAria: '{item} — 送出',
    itemSentNotice: '已送出{item}。',
    guestFollowPrompt: '创建免费账户即可关注 {name}',
    appreciateHeading: '向 {name} 表达感谢',
    appreciateSelf: '这是您自己 — 感谢来自社区。',
    appreciateGuestPrompt: '创建免费账户即可送出感谢',
    sendAppreciation: '送出感谢',
    errItemUnavailable: '该感谢礼物不可用。',
    errSendTimeout: '送出感谢超时。请重试。',
    errSendFailed: '无法送出感谢。请重试。',
    errSentTimeout: '加载已送出的礼物超时。请重试。',
    errSentFailed: '无法加载已送出的礼物。',
    errShelfTimeout: '加载您的礼物超时。请重试。',
    errShelfFailed: '无法加载您的礼物。',
    giftsHeading: '收到的礼物',
    giftsLoading: '正在加载您的礼物…',
    giftsEmpty: '暂无礼物 — 来自社区的感谢会显示在这里。',
    giftsFromCommunity: '来自社区',
    giftsFromOne: '来自 {a}',
    giftsFromTwo: '来自 {a} 和 {b}',
    giftsFromThree: '来自 {a}、{b} 和 {c}',
    someone: '某人',
    reviewTitle: '评价 {name}',
    reviewDescSourcer: '分享您与这位提供者的经历。 您的评分会计入对方的和谐分。',
    reviewDescSeeker: '分享您与这位求助者的经历。 您的评分会计入对方的和谐分。',
    reviewDescRequester: '分享您与这位请求者的经历。 您的评分会计入对方的和谐分。',
    reviewDescVolunteer: '分享您与这位志愿者的经历。 您的评分会计入对方的和谐分。',
    reviewDescPerson: '分享您与此人的经历。 您的评分会计入对方的和谐分。',
    ratingLabel: '评分',
    recommendQuestion: '您会推荐此人吗？',
    commentLabel: '评语',
    commentHint: '（可选，最多 {max} 个字符）',
    commentPlaceholder: '描述您的经历...',
    submitReview: '提交评价',
    errRatingRequired: '请先选择麦穗评分再提交。',
    errSubmitFailed: '提交失败。请重试。',
    errReviewTimeout: '提交评价超时。请检查您的网络连接后重试。',
    errReviewFailed: '无法提交评价。请重试。',
  },
  // machine-drafted, needs native review
  so: {
    harmonyNew: 'Cusub',
    ratingOutOf: '{value} ka mid ah {max} sabuul',
    badgeHelper: 'Caawiye',
    badgeConnector: 'Isku-xire',
    badgeVoice: 'Cod',
    badgeAdvocate: 'U-doode',
    badgeWatcher: 'Ilaaliye',
    badgeAppreciated: 'La qaddariyo',
    badgeTitle: '{label} · heerka {level}',
    badgeCategoryAria: 'Calaamadda qaybta {label}, heerka {level}',
    badgeCommunityAria: 'Calaamadda bulshada {label}, heerka {level}',
    levelShort: 'Heer {level}',
    badgesHeading: 'Calaamadaha bulshada',
    badgesEmpty: 'Weli calaamado ma jiraan — {name} wuxuu calaamado ku helaa caawinta, isku xirka iyo ka qaybgalka.',
    privateHeading: 'Gaar ah — adiga oo keliya ayaa arki kara',
    privateBody: 'Abaal-marin caawimaadda aad hesho iyo waxa aad kaydiso ama calaamadiso. Cid kale looma muujiyo.',
    itemHeart: 'Wadne',
    itemSmile: 'Dhoolla-caddayn',
    itemCheer: 'Sacab',
    itemFlower: 'Ubax',
    itemSunflower: 'Gabbaldaye',
    itemLeaf: 'Caleen',
    itemBread: 'Rooti',
    itemApple: 'Tufaax',
    itemSoup: 'Maraq',
    itemSun: 'Qorrax',
    itemSeedling: 'Geed yar',
    itemTree: 'Geed',
    altHeart: 'Wadne',
    altSmile: 'Weji dhoolla-caddaynaya',
    altCheer: 'Gacmo sacbinaya',
    altFlower: 'Ubax',
    altSunflower: 'Gabbaldaye',
    altLeaf: 'Caleen',
    altBread: 'Xabbad rooti ah',
    altApple: 'Tufaax',
    altSoup: 'Baaquli maraq ah',
    altSun: 'Qorraxda',
    altSeedling: 'Geed yar',
    altTree: 'Geed',
    itemSentAria: '{item} — hore loo diray',
    itemSendAria: '{item} — dir',
    itemSentNotice: '{item} waa la diray.',
    guestFollowPrompt: 'Samee akoon bilaash ah si aad u raacdo {name}',
    appreciateHeading: 'U mahadceli {name}',
    appreciateSelf: 'Kani waa adiga — mahadcelintu waxay ka timaaddaa bulshada.',
    appreciateGuestPrompt: 'Samee akoon bilaash ah si aad mahadcelin u dirto',
    sendAppreciation: 'Dir mahadcelin',
    errItemUnavailable: 'Hadiyaddaas mahadcelinta lama heli karo.',
    errSendTimeout: 'Dirista mahadcelintu way daahday. Fadlan mar kale isku day.',
    errSendFailed: 'Mahadcelinta lama diri karin. Fadlan mar kale isku day.',
    errSentTimeout: 'Soo dejinta hadiyadaha la diray way daahday. Fadlan mar kale isku day.',
    errSentFailed: 'Hadiyadaha la diray lama soo dejin karin.',
    errShelfTimeout: 'Soo dejinta hadiyadahaaga way daahday. Fadlan mar kale isku day.',
    errShelfFailed: 'Hadiyadahaaga lama soo dejin karin.',
    giftsHeading: 'Hadiyadaha la helay',
    giftsLoading: 'Hadiyadahaaga waa la soo shubayaa…',
    giftsEmpty: 'Weli hadiyado ma jiraan — mahadcelinta bulshada halkan ayay ka soo muuqataa.',
    giftsFromCommunity: 'ka timid bulshada',
    giftsFromOne: 'ka timid {a}',
    giftsFromTwo: 'ka timid {a} iyo {b}',
    giftsFromThree: 'ka timid {a}, {b} iyo {c}',
    someone: 'Qof',
    reviewTitle: 'Qiimee {name}',
    reviewDescSourcer: 'La wadaag waayo-aragnimadaada bixiyahan. Qiimayntaadu waxay qayb ka noqotaa Dhibcaha Wada-noolaanshaha ee qofkan.',
    reviewDescSeeker: 'La wadaag waayo-aragnimadaada codsadahan. Qiimayntaadu waxay qayb ka noqotaa Dhibcaha Wada-noolaanshaha ee qofkan.',
    reviewDescRequester: 'La wadaag waayo-aragnimadaada qofka codsiga soo diray. Qiimayntaadu waxay qayb ka noqotaa Dhibcaha Wada-noolaanshaha ee qofkan.',
    reviewDescVolunteer: 'La wadaag waayo-aragnimadaada tabaruc-hahan. Qiimayntaadu waxay qayb ka noqotaa Dhibcaha Wada-noolaanshaha ee qofkan.',
    reviewDescPerson: 'La wadaag waayo-aragnimadaada qofkan. Qiimayntaadu waxay qayb ka noqotaa Dhibcaha Wada-noolaanshaha ee qofkan.',
    ratingLabel: 'Qiimayn',
    recommendQuestion: 'Ma ku talin lahayd qofkan?',
    commentLabel: 'Faallo',
    commentHint: '(ikhtiyaari, ugu badnaan {max} xaraf)',
    commentPlaceholder: 'Sharax waayo-aragnimadaada...',
    submitReview: 'Dir qiimaynta',
    errRatingRequired: 'Fadlan dooro qiimayn sabuul ka hor intaadan dirin.',
    errSubmitFailed: 'Diristu way fashilantay. Fadlan mar kale isku day.',
    errReviewTimeout: 'Dirista qiimayntu way daahday. Fadlan hubi xiriirkaaga oo mar kale isku day.',
    errReviewFailed: 'Qiimaynta lama diri karin. Fadlan mar kale isku day.',
  },
  fr: {
    harmonyNew: 'Nouveau',
    ratingOutOf: '{value} épis sur {max}',
    badgeHelper: 'Entraide',
    badgeConnector: 'Lien',
    badgeVoice: 'Voix',
    badgeAdvocate: 'Porte-parole',
    badgeWatcher: 'Vigie',
    badgeAppreciated: 'Apprécié',
    badgeTitle: '{label} · niveau {level}',
    badgeCategoryAria: 'Badge de catégorie {label}, niveau {level}',
    badgeCommunityAria: 'Badge communautaire {label}, niveau {level}',
    levelShort: 'Niv. {level}',
    badgesHeading: 'Badges communautaires',
    badgesEmpty: 'Pas encore de badge — {name} gagne des badges en aidant, en créant des liens et en participant.',
    privateHeading: 'Privé — vous seul pouvez voir ceci',
    privateBody: "Reconnaissance pour l'aide que vous recevez et pour ce que vous enregistrez et mettez en favori. Personne d'autre ne le voit.",
    itemHeart: 'Cœur',
    itemSmile: 'Sourire',
    itemCheer: 'Bravo',
    itemFlower: 'Fleur',
    itemSunflower: 'Tournesol',
    itemLeaf: 'Feuille',
    itemBread: 'Pain',
    itemApple: 'Pomme',
    itemSoup: 'Soupe',
    itemSun: 'Soleil',
    itemSeedling: 'Jeune pousse',
    itemTree: 'Arbre',
    altHeart: 'Un cœur',
    altSmile: 'Un visage souriant',
    altCheer: 'Des mains qui applaudissent',
    altFlower: 'Une fleur',
    altSunflower: 'Un tournesol',
    altLeaf: 'Une feuille',
    altBread: 'Une miche de pain',
    altApple: 'Une pomme',
    altSoup: 'Un bol de soupe',
    altSun: 'Le soleil',
    altSeedling: 'Une jeune pousse',
    altTree: 'Un arbre',
    itemSentAria: '{item} — déjà envoyé',
    itemSendAria: '{item} — envoyer',
    itemSentNotice: 'Envoyé : {item}.',
    guestFollowPrompt: 'Créez un compte gratuit pour suivre {name}',
    appreciateHeading: 'Remercier {name}',
    appreciateSelf: "C'est vous — les remerciements viennent de la communauté.",
    appreciateGuestPrompt: 'Créez un compte gratuit pour envoyer des remerciements',
    sendAppreciation: 'Envoyer des remerciements',
    errItemUnavailable: "Ce cadeau de remerciement n'est pas disponible.",
    errSendTimeout: "L'envoi des remerciements a pris trop de temps. Veuillez réessayer.",
    errSendFailed: "Impossible d'envoyer les remerciements. Veuillez réessayer.",
    errSentTimeout: 'Le chargement des cadeaux envoyés a pris trop de temps. Veuillez réessayer.',
    errSentFailed: 'Impossible de charger les cadeaux envoyés.',
    errShelfTimeout: 'Le chargement de vos cadeaux a pris trop de temps. Veuillez réessayer.',
    errShelfFailed: 'Impossible de charger vos cadeaux.',
    giftsHeading: 'Cadeaux reçus',
    giftsLoading: 'Chargement de vos cadeaux…',
    giftsEmpty: 'Pas encore de cadeau — les remerciements de la communauté apparaissent ici.',
    giftsFromCommunity: 'de la communauté',
    giftsFromOne: 'de la part de {a}',
    giftsFromTwo: 'de la part de {a} et {b}',
    giftsFromThree: 'de la part de {a}, {b} et {c}',
    someone: "Quelqu'un",
    reviewTitle: 'Évaluer {name}',
    reviewDescSourcer: "Partagez votre expérience avec la personne qui a offert cette aide. Votre note compte dans son score d'Harmonie.",
    reviewDescSeeker: "Partagez votre expérience avec la personne qui a demandé cette aide. Votre note compte dans son score d'Harmonie.",
    reviewDescRequester: "Partagez votre expérience avec la personne qui a fait la demande. Votre note compte dans son score d'Harmonie.",
    reviewDescVolunteer: "Partagez votre expérience avec ce ou cette bénévole. Votre note compte dans son score d'Harmonie.",
    reviewDescPerson: "Partagez votre expérience avec cette personne. Votre note compte dans son score d'Harmonie.",
    ratingLabel: 'Note',
    recommendQuestion: 'Recommanderiez-vous cette personne ?',
    commentLabel: 'Commentaire',
    commentHint: '(facultatif, {max} caractères max.)',
    commentPlaceholder: 'Décrivez votre expérience...',
    submitReview: "Envoyer l'avis",
    errRatingRequired: "Veuillez choisir une note en épis avant d'envoyer.",
    errSubmitFailed: "L'envoi a échoué. Veuillez réessayer.",
    errReviewTimeout: "L'envoi de l'avis a pris trop de temps. Vérifiez votre connexion et réessayez.",
    errReviewFailed: "Impossible d'envoyer l'avis. Veuillez réessayer.",
  },
  pt: {
    harmonyNew: 'Novo',
    ratingOutOf: '{value} de {max} espigas',
    badgeHelper: 'Ajudante',
    badgeConnector: 'Conector',
    badgeVoice: 'Voz',
    badgeAdvocate: 'Defensor',
    badgeWatcher: 'Vigilante',
    badgeAppreciated: 'Apreciado',
    badgeTitle: '{label} · nível {level}',
    badgeCategoryAria: 'Selo de categoria {label}, nível {level}',
    badgeCommunityAria: 'Selo comunitário {label}, nível {level}',
    levelShort: 'Nv. {level}',
    badgesHeading: 'Selos da comunidade',
    badgesEmpty: 'Ainda não há selos — {name} ganha selos ao ajudar, conectar e participar.',
    privateHeading: 'Privado — só você pode ver isto',
    privateBody: 'Reconhecimento pela ajuda que você recebe e pelo que salva e marca. Não é mostrado a mais ninguém.',
    itemHeart: 'Coração',
    itemSmile: 'Sorriso',
    itemCheer: 'Aplauso',
    itemFlower: 'Flor',
    itemSunflower: 'Girassol',
    itemLeaf: 'Folha',
    itemBread: 'Pão',
    itemApple: 'Maçã',
    itemSoup: 'Sopa',
    itemSun: 'Sol',
    itemSeedling: 'Muda',
    itemTree: 'Árvore',
    altHeart: 'Um coração',
    altSmile: 'Um rosto sorridente',
    altCheer: 'Mãos aplaudindo',
    altFlower: 'Uma flor',
    altSunflower: 'Um girassol',
    altLeaf: 'Uma folha',
    altBread: 'Um pão',
    altApple: 'Uma maçã',
    altSoup: 'Uma tigela de sopa',
    altSun: 'O sol',
    altSeedling: 'Uma muda',
    altTree: 'Uma árvore',
    itemSentAria: '{item} — já enviado',
    itemSendAria: '{item} — enviar',
    itemSentNotice: 'Enviado: {item}.',
    guestFollowPrompt: 'Crie uma conta gratuita para seguir {name}',
    appreciateHeading: 'Agradeça a {name}',
    appreciateSelf: 'Este é você — o agradecimento vem da comunidade.',
    appreciateGuestPrompt: 'Crie uma conta gratuita para enviar um agradecimento',
    sendAppreciation: 'Enviar agradecimento',
    errItemUnavailable: 'Esse item de agradecimento não está disponível.',
    errSendTimeout: 'O envio do agradecimento demorou demais. Tente novamente.',
    errSendFailed: 'Não foi possível enviar o agradecimento. Tente novamente.',
    errSentTimeout: 'O carregamento dos presentes enviados demorou demais. Tente novamente.',
    errSentFailed: 'Não foi possível carregar os presentes enviados.',
    errShelfTimeout: 'O carregamento dos seus presentes demorou demais. Tente novamente.',
    errShelfFailed: 'Não foi possível carregar os seus presentes.',
    giftsHeading: 'Presentes recebidos',
    giftsLoading: 'Carregando os seus presentes…',
    giftsEmpty: 'Ainda não há presentes — o agradecimento da comunidade aparece aqui.',
    giftsFromCommunity: 'da comunidade',
    giftsFromOne: 'de {a}',
    giftsFromTwo: 'de {a} e {b}',
    giftsFromThree: 'de {a}, {b} e {c}',
    someone: 'Alguém',
    reviewTitle: 'Avaliar {name}',
    reviewDescSourcer: 'Compartilhe a sua experiência com quem ofereceu esta ajuda. A sua avaliação conta para a pontuação de Harmonia dessa pessoa.',
    reviewDescSeeker: 'Compartilhe a sua experiência com quem pediu esta ajuda. A sua avaliação conta para a pontuação de Harmonia dessa pessoa.',
    reviewDescRequester: 'Compartilhe a sua experiência com quem fez o pedido. A sua avaliação conta para a pontuação de Harmonia dessa pessoa.',
    reviewDescVolunteer: 'Compartilhe a sua experiência com esta pessoa voluntária. A sua avaliação conta para a pontuação de Harmonia dessa pessoa.',
    reviewDescPerson: 'Compartilhe a sua experiência com esta pessoa. A sua avaliação conta para a pontuação de Harmonia dessa pessoa.',
    ratingLabel: 'Avaliação',
    recommendQuestion: 'Você recomendaria esta pessoa?',
    commentLabel: 'Comentário',
    commentHint: '(opcional, máx. {max} caracteres)',
    commentPlaceholder: 'Descreva a sua experiência...',
    submitReview: 'Enviar avaliação',
    errRatingRequired: 'Escolha uma avaliação com espigas antes de enviar.',
    errSubmitFailed: 'Falha no envio. Tente novamente.',
    errReviewTimeout: 'O envio da avaliação demorou demais. Verifique sua conexão e tente novamente.',
    errReviewFailed: 'Não foi possível enviar a avaliação. Tente novamente.',
  },
  ru: {
    harmonyNew: 'Новичок',
    ratingOutOf: '{value} из {max} колосков',
    badgeHelper: 'Помощник',
    badgeConnector: 'Связующий',
    badgeVoice: 'Голос',
    badgeAdvocate: 'Защитник',
    badgeWatcher: 'Наблюдатель',
    badgeAppreciated: 'Ценимый',
    badgeTitle: '{label} · уровень {level}',
    badgeCategoryAria: 'Значок категории «{label}», уровень {level}',
    badgeCommunityAria: 'Значок сообщества «{label}», уровень {level}',
    levelShort: 'Ур. {level}',
    badgesHeading: 'Значки сообщества',
    badgesEmpty: 'Значков пока нет — {name} получает значки за помощь, связи и участие.',
    privateHeading: 'Личное — это видите только вы',
    privateBody: 'Отметки за помощь, которую вы получаете, и за то, что вы сохраняете и добавляете в закладки. Никому больше не показывается.',
    itemHeart: 'Сердце',
    itemSmile: 'Улыбка',
    itemCheer: 'Овация',
    itemFlower: 'Цветок',
    itemSunflower: 'Подсолнух',
    itemLeaf: 'Лист',
    itemBread: 'Хлеб',
    itemApple: 'Яблоко',
    itemSoup: 'Суп',
    itemSun: 'Солнце',
    itemSeedling: 'Росток',
    itemTree: 'Дерево',
    altHeart: 'Сердце',
    altSmile: 'Улыбающееся лицо',
    altCheer: 'Аплодирующие руки',
    altFlower: 'Цветок',
    altSunflower: 'Подсолнух',
    altLeaf: 'Лист',
    altBread: 'Буханка хлеба',
    altApple: 'Яблоко',
    altSoup: 'Тарелка супа',
    altSun: 'Солнце',
    altSeedling: 'Росток',
    altTree: 'Дерево',
    itemSentAria: '{item} — уже отправлено',
    itemSendAria: '{item} — отправить',
    itemSentNotice: 'Отправлено: {item}.',
    guestFollowPrompt: 'Создайте бесплатный аккаунт, чтобы подписаться на {name}',
    appreciateHeading: 'Поблагодарить: {name}',
    appreciateSelf: 'Это вы — благодарность приходит от сообщества.',
    appreciateGuestPrompt: 'Создайте бесплатный аккаунт, чтобы отправить благодарность',
    sendAppreciation: 'Отправить благодарность',
    errItemUnavailable: 'Этот подарок недоступен.',
    errSendTimeout: 'Отправка благодарности заняла слишком много времени. Попробуйте ещё раз.',
    errSendFailed: 'Не удалось отправить благодарность. Попробуйте ещё раз.',
    errSentTimeout: 'Загрузка отправленных подарков заняла слишком много времени. Попробуйте ещё раз.',
    errSentFailed: 'Не удалось загрузить отправленные подарки.',
    errShelfTimeout: 'Загрузка ваших подарков заняла слишком много времени. Попробуйте ещё раз.',
    errShelfFailed: 'Не удалось загрузить ваши подарки.',
    giftsHeading: 'Полученные подарки',
    giftsLoading: 'Загрузка ваших подарков…',
    giftsEmpty: 'Подарков пока нет — здесь появится благодарность сообщества.',
    giftsFromCommunity: 'от сообщества',
    giftsFromOne: 'от: {a}',
    giftsFromTwo: 'от: {a} и {b}',
    giftsFromThree: 'от: {a}, {b} и {c}',
    someone: 'Кто-то',
    reviewTitle: 'Оценить: {name}',
    reviewDescSourcer: 'Расскажите, как прошло общение с тем, кто предложил помощь. Ваша оценка учитывается в рейтинге «Гармония» этого человека.',
    reviewDescSeeker: 'Расскажите, как прошло общение с тем, кто просил о помощи. Ваша оценка учитывается в рейтинге «Гармония» этого человека.',
    reviewDescRequester: 'Расскажите, как прошло общение с автором запроса. Ваша оценка учитывается в рейтинге «Гармония» этого человека.',
    reviewDescVolunteer: 'Расскажите, как прошло общение с этим волонтёром. Ваша оценка учитывается в рейтинге «Гармония» этого человека.',
    reviewDescPerson: 'Расскажите, как прошло общение с этим человеком. Ваша оценка учитывается в рейтинге «Гармония» этого человека.',
    ratingLabel: 'Оценка',
    recommendQuestion: 'Вы бы порекомендовали этого человека?',
    commentLabel: 'Комментарий',
    commentHint: '(необязательно, до {max} символов)',
    commentPlaceholder: 'Опишите свой опыт...',
    submitReview: 'Отправить отзыв',
    errRatingRequired: 'Выберите оценку колосками перед отправкой.',
    errSubmitFailed: 'Не удалось отправить. Попробуйте ещё раз.',
    errReviewTimeout: 'Отправка отзыва заняла слишком много времени. Проверьте соединение и попробуйте ещё раз.',
    errReviewFailed: 'Не удалось отправить отзыв. Попробуйте ещё раз.',
  },
  ko: {
    harmonyNew: '신규',
    ratingOutOf: '이삭 {max}개 중 {value}개',
    badgeHelper: '도우미',
    badgeConnector: '연결자',
    badgeVoice: '목소리',
    badgeAdvocate: '옹호자',
    badgeWatcher: '지킴이',
    badgeAppreciated: '감사받는 이',
    badgeTitle: '{label} · 레벨 {level}',
    badgeCategoryAria: '{label} 분야 배지, 레벨 {level}',
    badgeCommunityAria: '{label} 커뮤니티 배지, 레벨 {level}',
    levelShort: 'Lv. {level}',
    badgesHeading: '커뮤니티 배지',
    badgesEmpty: '아직 배지가 없습니다 — {name} 님은 돕고, 연결하고, 참여하면서 배지를 얻습니다.',
    privateHeading: '비공개 — 나만 볼 수 있습니다',
    privateBody: '받은 도움과 저장·북마크한 항목에 대한 기록입니다. 다른 사람에게는 표시되지 않습니다.',
    itemHeart: '하트',
    itemSmile: '미소',
    itemCheer: '응원',
    itemFlower: '꽃',
    itemSunflower: '해바라기',
    itemLeaf: '나뭇잎',
    itemBread: '빵',
    itemApple: '사과',
    itemSoup: '수프',
    itemSun: '해',
    itemSeedling: '새싹',
    itemTree: '나무',
    altHeart: '하트 하나',
    altSmile: '웃는 얼굴',
    altCheer: '박수 치는 손',
    altFlower: '꽃 한 송이',
    altSunflower: '해바라기 한 송이',
    altLeaf: '나뭇잎 하나',
    altBread: '빵 한 덩이',
    altApple: '사과 한 개',
    altSoup: '수프 한 그릇',
    altSun: '해',
    altSeedling: '새싹 하나',
    altTree: '나무 한 그루',
    itemSentAria: '{item} — 이미 보냄',
    itemSendAria: '{item} — 보내기',
    itemSentNotice: '{item} 보냄.',
    guestFollowPrompt: '{name} 님을 팔로우하려면 무료 계정을 만드세요',
    appreciateHeading: '{name} 님에게 감사 표현하기',
    appreciateSelf: '본인입니다 — 감사는 커뮤니티가 보내는 것입니다.',
    appreciateGuestPrompt: '감사를 보내려면 무료 계정을 만드세요',
    sendAppreciation: '감사 보내기',
    errItemUnavailable: '해당 감사 선물은 사용할 수 없습니다.',
    errSendTimeout: '감사 보내기 시간이 초과되었습니다. 다시 시도해 주세요.',
    errSendFailed: '감사를 보내지 못했습니다. 다시 시도해 주세요.',
    errSentTimeout: '보낸 선물을 불러오는 시간이 초과되었습니다. 다시 시도해 주세요.',
    errSentFailed: '보낸 선물을 불러오지 못했습니다.',
    errShelfTimeout: '받은 선물을 불러오는 시간이 초과되었습니다. 다시 시도해 주세요.',
    errShelfFailed: '받은 선물을 불러오지 못했습니다.',
    giftsHeading: '받은 선물',
    giftsLoading: '받은 선물을 불러오는 중…',
    giftsEmpty: '아직 선물이 없습니다 — 커뮤니티가 보낸 감사가 여기에 표시됩니다.',
    giftsFromCommunity: '커뮤니티가 보냄',
    giftsFromOne: '{a} 님이 보냄',
    giftsFromTwo: '{a}, {b} 님이 보냄',
    giftsFromThree: '{a}, {b}, {c} 님이 보냄',
    someone: '누군가',
    reviewTitle: '{name} 님 리뷰하기',
    reviewDescSourcer: '이 제공자와의 경험을 공유해 주세요. 평점은 상대방의 하모니 점수에 반영됩니다.',
    reviewDescSeeker: '이 신청자와의 경험을 공유해 주세요. 평점은 상대방의 하모니 점수에 반영됩니다.',
    reviewDescRequester: '이 요청자와의 경험을 공유해 주세요. 평점은 상대방의 하모니 점수에 반영됩니다.',
    reviewDescVolunteer: '이 자원봉사자와의 경험을 공유해 주세요. 평점은 상대방의 하모니 점수에 반영됩니다.',
    reviewDescPerson: '이 분과의 경험을 공유해 주세요. 평점은 상대방의 하모니 점수에 반영됩니다.',
    ratingLabel: '평점',
    recommendQuestion: '이 분을 추천하시겠습니까?',
    commentLabel: '코멘트',
    commentHint: '(선택, 최대 {max}자)',
    commentPlaceholder: '경험을 적어 주세요...',
    submitReview: '리뷰 제출',
    errRatingRequired: '제출하기 전에 이삭 평점을 선택해 주세요.',
    errSubmitFailed: '제출하지 못했습니다. 다시 시도해 주세요.',
    errReviewTimeout: '리뷰 제출 시간이 초과되었습니다. 연결 상태를 확인한 후 다시 시도해 주세요.',
    errReviewFailed: '리뷰를 제출하지 못했습니다. 다시 시도해 주세요.',
  },
  tl: {
    harmonyNew: 'Bago',
    ratingOutOf: '{value} sa {max} uhay',
    badgeHelper: 'Katuwang',
    badgeConnector: 'Tagapag-ugnay',
    badgeVoice: 'Tinig',
    badgeAdvocate: 'Tagapagtaguyod',
    badgeWatcher: 'Tagabantay',
    badgeAppreciated: 'Pinahahalagahan',
    badgeTitle: '{label} · antas {level}',
    badgeCategoryAria: 'Badge ng kategoryang {label}, antas {level}',
    badgeCommunityAria: 'Badge ng komunidad na {label}, antas {level}',
    levelShort: 'Antas {level}',
    badgesHeading: 'Mga badge ng komunidad',
    badgesEmpty: 'Wala pang badge — nakakakuha si {name} ng mga badge sa pagtulong, pag-uugnay, at pakikilahok.',
    privateHeading: 'Pribado — ikaw lang ang nakakakita nito',
    privateBody: 'Pagkilala sa tulong na natatanggap mo, at sa mga sine-save at bino-bookmark mo. Hindi ipinapakita sa iba.',
    itemHeart: 'Puso',
    itemSmile: 'Ngiti',
    itemCheer: 'Palakpak',
    itemFlower: 'Bulaklak',
    itemSunflower: 'Mirasol',
    itemLeaf: 'Dahon',
    itemBread: 'Tinapay',
    itemApple: 'Mansanas',
    itemSoup: 'Sabaw',
    itemSun: 'Araw',
    itemSeedling: 'Punla',
    itemTree: 'Puno',
    altHeart: 'Isang puso',
    altSmile: 'Isang nakangiting mukha',
    altCheer: 'Mga kamay na pumapalakpak',
    altFlower: 'Isang bulaklak',
    altSunflower: 'Isang mirasol',
    altLeaf: 'Isang dahon',
    altBread: 'Isang tinapay',
    altApple: 'Isang mansanas',
    altSoup: 'Isang mangkok ng sabaw',
    altSun: 'Ang araw',
    altSeedling: 'Isang punla',
    altTree: 'Isang puno',
    itemSentAria: '{item} — naipadala na',
    itemSendAria: '{item} — ipadala',
    itemSentNotice: 'Naipadala: {item}.',
    guestFollowPrompt: 'Gumawa ng libreng account para masundan si {name}',
    appreciateHeading: 'Pasalamatan si {name}',
    appreciateSelf: 'Ikaw ito — nagmumula sa komunidad ang pasasalamat.',
    appreciateGuestPrompt: 'Gumawa ng libreng account para makapagpadala ng pasasalamat',
    sendAppreciation: 'Magpadala ng pasasalamat',
    errItemUnavailable: 'Hindi available ang regalong pasasalamat na iyon.',
    errSendTimeout: 'Natagalan ang pagpapadala ng pasasalamat. Pakisubukang muli.',
    errSendFailed: 'Hindi maipadala ang pasasalamat. Pakisubukang muli.',
    errSentTimeout: 'Natagalan ang pag-load ng mga naipadalang regalo. Pakisubukang muli.',
    errSentFailed: 'Hindi ma-load ang mga naipadalang regalo.',
    errShelfTimeout: 'Natagalan ang pag-load ng mga regalo mo. Pakisubukang muli.',
    errShelfFailed: 'Hindi ma-load ang mga regalo mo.',
    giftsHeading: 'Mga natanggap na regalo',
    giftsLoading: 'Nilo-load ang mga regalo mo…',
    giftsEmpty: 'Wala pang regalo — dito lalabas ang pasasalamat mula sa komunidad.',
    giftsFromCommunity: 'mula sa komunidad',
    giftsFromOne: 'mula kay {a}',
    giftsFromTwo: 'mula kina {a} at {b}',
    giftsFromThree: 'mula kina {a}, {b}, at {c}',
    someone: 'Isang tao',
    reviewTitle: 'I-review si {name}',
    reviewDescSourcer: 'Ibahagi ang karanasan mo sa nag-alok na ito. Kasama ang rating mo sa kanyang Harmony Score.',
    reviewDescSeeker: 'Ibahagi ang karanasan mo sa humiling na ito. Kasama ang rating mo sa kanyang Harmony Score.',
    reviewDescRequester: 'Ibahagi ang karanasan mo sa nagpadala ng kahilingang ito. Kasama ang rating mo sa kanyang Harmony Score.',
    reviewDescVolunteer: 'Ibahagi ang karanasan mo sa boluntaryong ito. Kasama ang rating mo sa kanyang Harmony Score.',
    reviewDescPerson: 'Ibahagi ang karanasan mo sa taong ito. Kasama ang rating mo sa kanyang Harmony Score.',
    ratingLabel: 'Marka',
    recommendQuestion: 'Irerekomenda mo ba ang taong ito?',
    commentLabel: 'Komento',
    commentHint: '(opsyonal, hanggang {max} character)',
    commentPlaceholder: 'Ilarawan ang karanasan mo...',
    submitReview: 'Ipasa ang review',
    errRatingRequired: 'Pumili muna ng rating na uhay bago ipasa.',
    errSubmitFailed: 'Hindi naipasa. Pakisubukang muli.',
    errReviewTimeout: 'Natagalan ang pagpasa ng review. Pakisuri ang iyong koneksyon at subukang muli.',
    errReviewFailed: 'Hindi maipasa ang review. Pakisubukang muli.',
  },
  // machine-drafted, needs native review
  am: {
    harmonyNew: 'አዲስ',
    ratingOutOf: '{value} ከ{max} ዛላ',
    badgeHelper: 'ረዳት',
    badgeConnector: 'አገናኝ',
    badgeVoice: 'ድምፅ',
    badgeAdvocate: 'ተሟጋች',
    badgeWatcher: 'ጠባቂ',
    badgeAppreciated: 'የተመሰገነ',
    badgeTitle: '{label} · ደረጃ {level}',
    badgeCategoryAria: 'የ{label} ምድብ ባጅ፣ ደረጃ {level}',
    badgeCommunityAria: 'የ{label} የማኅበረሰብ ባጅ፣ ደረጃ {level}',
    levelShort: 'ደረጃ {level}',
    badgesHeading: 'የማኅበረሰብ ባጆች',
    badgesEmpty: 'እስካሁን ባጅ የለም — {name} በመርዳት፣ በማገናኘት እና በመሳተፍ ባጆችን ያገኛል።',
    privateHeading: 'የግል — እርስዎ ብቻ ነዎት የሚያዩት',
    privateBody: 'ለሚያገኙት እርዳታ እና ለሚያስቀምጡትና ዕልባት ለሚያደርጉት ዕውቅና። ለሌላ ለማንም አይታይም።',
    itemHeart: 'ልብ',
    itemSmile: 'ፈገግታ',
    itemCheer: 'ማበረታቻ',
    itemFlower: 'አበባ',
    itemSunflower: 'የሱፍ አበባ',
    itemLeaf: 'ቅጠል',
    itemBread: 'ዳቦ',
    itemApple: 'ፖም',
    itemSoup: 'ሾርባ',
    itemSun: 'ፀሐይ',
    itemSeedling: 'ችግኝ',
    itemTree: 'ዛፍ',
    altHeart: 'አንድ ልብ',
    altSmile: 'ፈገግ ያለ ፊት',
    altCheer: 'የሚያጨበጭቡ እጆች',
    altFlower: 'አንድ አበባ',
    altSunflower: 'አንድ የሱፍ አበባ',
    altLeaf: 'አንድ ቅጠል',
    altBread: 'አንድ ዳቦ',
    altApple: 'አንድ ፖም',
    altSoup: 'አንድ ሳህን ሾርባ',
    altSun: 'ፀሐይ',
    altSeedling: 'አንድ ችግኝ',
    altTree: 'አንድ ዛፍ',
    itemSentAria: '{item} — አስቀድሞ ተልኳል',
    itemSendAria: '{item} — ላክ',
    itemSentNotice: '{item} ተልኳል።',
    guestFollowPrompt: '{name}ን ለመከተል ነፃ መለያ ይፍጠሩ',
    appreciateHeading: '{name}ን አመስግኑ',
    appreciateSelf: 'ይህ እርስዎ ነዎት — ምስጋና የሚመጣው ከማኅበረሰቡ ነው።',
    appreciateGuestPrompt: 'ምስጋና ለመላክ ነፃ መለያ ይፍጠሩ',
    sendAppreciation: 'ምስጋና ላክ',
    errItemUnavailable: 'ያ የምስጋና ስጦታ አይገኝም።',
    errSendTimeout: 'ምስጋና መላክ ጊዜ ወሰደ። እባክዎ እንደገና ይሞክሩ።',
    errSendFailed: 'ምስጋና መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
    errSentTimeout: 'የተላኩ ስጦታዎችን መጫን ጊዜ ወሰደ። እባክዎ እንደገና ይሞክሩ።',
    errSentFailed: 'የተላኩ ስጦታዎችን መጫን አልተቻለም።',
    errShelfTimeout: 'ስጦታዎችዎን መጫን ጊዜ ወሰደ። እባክዎ እንደገና ይሞክሩ።',
    errShelfFailed: 'ስጦታዎችዎን መጫን አልተቻለም።',
    giftsHeading: 'የተቀበሏቸው ስጦታዎች',
    giftsLoading: 'ስጦታዎችዎን በመጫን ላይ…',
    giftsEmpty: 'እስካሁን ስጦታ የለም — የማኅበረሰቡ ምስጋና እዚህ ይታያል።',
    giftsFromCommunity: 'ከማኅበረሰቡ',
    giftsFromOne: 'ከ{a}',
    giftsFromTwo: 'ከ{a} እና {b}',
    giftsFromThree: 'ከ{a}፣ {b} እና {c}',
    someone: 'አንድ ሰው',
    reviewTitle: '{name}ን ይገምግሙ',
    reviewDescSourcer: 'ከዚህ አቅራቢ ጋር ያለዎትን ተሞክሮ ያካፍሉ። የእርስዎ ደረጃ ወደ ስምምነት ነጥባቸው ይታከላል።',
    reviewDescSeeker: 'ከዚህ ጠያቂ ጋር ያለዎትን ተሞክሮ ያካፍሉ። የእርስዎ ደረጃ ወደ ስምምነት ነጥባቸው ይታከላል።',
    reviewDescRequester: 'ጥያቄውን ከላከው ሰው ጋር ያለዎትን ተሞክሮ ያካፍሉ። የእርስዎ ደረጃ ወደ ስምምነት ነጥባቸው ይታከላል።',
    reviewDescVolunteer: 'ከዚህ በጎ ፈቃደኛ ጋር ያለዎትን ተሞክሮ ያካፍሉ። የእርስዎ ደረጃ ወደ ስምምነት ነጥባቸው ይታከላል።',
    reviewDescPerson: 'ከዚህ ሰው ጋር ያለዎትን ተሞክሮ ያካፍሉ። የእርስዎ ደረጃ ወደ ስምምነት ነጥባቸው ይታከላል።',
    ratingLabel: 'ደረጃ',
    recommendQuestion: 'ይህን ሰው ይመክራሉ?',
    commentLabel: 'አስተያየት',
    commentHint: '(አማራጭ፣ ቢበዛ {max} ፊደላት)',
    commentPlaceholder: 'ተሞክሮዎን ይግለጹ...',
    submitReview: 'ግምገማ አስገባ',
    errRatingRequired: 'ከማስገባትዎ በፊት እባክዎ የዛላ ደረጃ ይምረጡ።',
    errSubmitFailed: 'ማስገባት አልተሳካም። እባክዎ እንደገና ይሞክሩ።',
    errReviewTimeout: 'ግምገማ ማስገባት ጊዜ ወሰደ። እባክዎ ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ።',
    errReviewFailed: 'ግምገማ ማስገባት አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
  },
  // machine-drafted, needs native review
  hmn: {
    harmonyNew: 'Tshiab',
    ratingOutOf: '{value} ntawm {max} tus nplej',
    badgeHelper: 'Tus pab',
    badgeConnector: 'Tus txuas',
    badgeVoice: 'Lub suab',
    badgeAdvocate: 'Tus tawm tswv yim',
    badgeWatcher: 'Tus saib xyuas',
    badgeAppreciated: 'Tau txais kev ris txiaj',
    badgeTitle: '{label} · theem {level}',
    badgeCategoryAria: 'Daim paib pawg {label}, theem {level}',
    badgeCommunityAria: 'Daim paib zej zog {label}, theem {level}',
    levelShort: 'Theem {level}',
    badgesHeading: 'Cov paib zej zog',
    badgesEmpty: 'Tseem tsis tau muaj paib — {name} tau paib los ntawm kev pab, kev txuas, thiab kev koom tes.',
    privateHeading: 'Ntiag tug — koj tib leeg thiaj pom tau',
    privateBody: 'Kev lees paub rau kev pab uas koj tau txais, thiab rau yam koj khaws thiab cim tseg. Tsis qhia rau lwm tus.',
    itemHeart: 'Lub plawv',
    itemSmile: 'Luag ntxhi',
    itemCheer: 'Qhuas',
    itemFlower: 'Paj',
    itemSunflower: 'Paj noob hnub',
    itemLeaf: 'Nplooj',
    itemBread: 'Ncuav',
    itemApple: 'Txiv apple',
    itemSoup: 'Kua zaub',
    itemSun: 'Lub hnub',
    itemSeedling: 'Yub ntoo',
    itemTree: 'Ntoo',
    altHeart: 'Ib lub plawv',
    altSmile: 'Ib lub ntsej muag luag ntxhi',
    altCheer: 'Ob txhais tes npuaj',
    altFlower: 'Ib lub paj',
    altSunflower: 'Ib lub paj noob hnub',
    altLeaf: 'Ib daim nplooj',
    altBread: 'Ib lub ncuav',
    altApple: 'Ib lub txiv apple',
    altSoup: 'Ib tais kua zaub',
    altSun: 'Lub hnub',
    altSeedling: 'Ib tsob yub ntoo',
    altTree: 'Ib tsob ntoo',
    itemSentAria: '{item} — twb xa lawm',
    itemSendAria: '{item} — xa',
    itemSentNotice: 'Xa {item} lawm.',
    guestFollowPrompt: 'Tsim ib tus account dawb los raws {name}',
    appreciateHeading: 'Ua tsaug rau {name}',
    appreciateSelf: 'Qhov no yog koj — kev ris txiaj los ntawm zej zog.',
    appreciateGuestPrompt: 'Tsim ib tus account dawb los xa kev ris txiaj',
    sendAppreciation: 'Xa kev ris txiaj',
    errItemUnavailable: 'Qhov khoom plig ris txiaj ntawd tsis muaj.',
    errSendTimeout: 'Kev xa kev ris txiaj siv sijhawm ntev dhau. Thov sim dua.',
    errSendFailed: 'Xa tsis tau kev ris txiaj. Thov sim dua.',
    errSentTimeout: 'Kev thauj cov khoom plig uas xa lawm siv sijhawm ntev dhau. Thov sim dua.',
    errSentFailed: 'Thauj tsis tau cov khoom plig uas xa lawm.',
    errShelfTimeout: 'Kev thauj koj cov khoom plig siv sijhawm ntev dhau. Thov sim dua.',
    errShelfFailed: 'Thauj tsis tau koj cov khoom plig.',
    giftsHeading: 'Cov khoom plig tau txais',
    giftsLoading: 'Tab tom thauj koj cov khoom plig…',
    giftsEmpty: 'Tseem tsis tau muaj khoom plig — kev ris txiaj los ntawm zej zog yuav tshwm ntawm no.',
    giftsFromCommunity: 'los ntawm zej zog',
    giftsFromOne: 'los ntawm {a}',
    giftsFromTwo: 'los ntawm {a} thiab {b}',
    giftsFromThree: 'los ntawm {a}, {b}, thiab {c}',
    someone: 'Ib tug neeg',
    reviewTitle: 'Ntsuam xyuas {name}',
    reviewDescSourcer: 'Qhia koj qhov kev paub dhau los nrog tus neeg muab no. Koj qhov kev ntsuas yuav suav rau nws tus Qhab Nia Sib Haum.',
    reviewDescSeeker: 'Qhia koj qhov kev paub dhau los nrog tus neeg thov no. Koj qhov kev ntsuas yuav suav rau nws tus Qhab Nia Sib Haum.',
    reviewDescRequester: 'Qhia koj qhov kev paub dhau los nrog tus neeg xa qhov kev thov no. Koj qhov kev ntsuas yuav suav rau nws tus Qhab Nia Sib Haum.',
    reviewDescVolunteer: 'Qhia koj qhov kev paub dhau los nrog tus neeg pab dawb no. Koj qhov kev ntsuas yuav suav rau nws tus Qhab Nia Sib Haum.',
    reviewDescPerson: 'Qhia koj qhov kev paub dhau los nrog tus neeg no. Koj qhov kev ntsuas yuav suav rau nws tus Qhab Nia Sib Haum.',
    ratingLabel: 'Kev ntsuas',
    recommendQuestion: 'Koj puas xav pom zoo tus neeg no?',
    commentLabel: 'Lus tawm tswv yim',
    commentHint: '(xaiv tau, ntau tshaj {max} tus ntawv)',
    commentPlaceholder: 'Piav koj qhov kev paub dhau los...',
    submitReview: 'Xa kev ntsuam xyuas',
    errRatingRequired: 'Thov xaiv ib qho kev ntsuas ua ntej xa.',
    errSubmitFailed: 'Xa tsis tau. Thov sim dua.',
    errReviewTimeout: 'Kev xa kev ntsuam xyuas siv sijhawm ntev dhau. Thov xyuas koj txoj kev txuas thiab sim dua.',
    errReviewFailed: 'Xa tsis tau kev ntsuam xyuas. Thov sim dua.',
  },
}

export function badgesT(locale: Locale, key: keyof FeedBadgesMessages): string {
  return translate(feedBadgesMessages, locale, key)
}

// ---------------------------------------------------------------------------
// Counts — plural tables, selected through Intl.PluralRules (lib/i18n-intl.ts)
// ---------------------------------------------------------------------------
//
// What the "(12)" beside a Harmony score means, for a screen reader: "12 reviews".
export const REVIEW_COUNT: Record<Locale, PluralForms> = {
  en: { one: '{count} review', other: '{count} reviews' },
  es: { one: '{count} valoración', other: '{count} valoraciones' },
  ht: { other: '{count} evalyasyon' },
  vi: { other: '{count} đánh giá' },
  ar: {
    zero: '{count} تقييم',
    one: '{count} تقييم',
    two: '{count} تقييمان',
    few: '{count} تقييمات',
    many: '{count} تقييمًا',
    other: '{count} تقييم',
  },
  zh: { other: '{count} 条评价' },
  so: { other: '{count} qiimayn' },
  fr: { one: '{count} évaluation', other: '{count} évaluations' },
  pt: { one: '{count} avaliação', other: '{count} avaliações' },
  ru: {
    one: '{count} отзыв',
    few: '{count} отзыва',
    many: '{count} отзывов',
    other: '{count} отзыва',
  },
  ko: { other: '리뷰 {count}개' },
  tl: { other: '{count} na review' },
  am: { one: '{count} ግምገማ', other: '{count} ግምገማዎች' },
  hmn: { other: '{count} qhov kev ntsuam xyuas' },
}

// Name of one rating button: "3 stalks".
export const STALKS: Record<Locale, PluralForms> = {
  en: { one: '{n} stalk', other: '{n} stalks' },
  es: { one: '{n} espiga', other: '{n} espigas' },
  ht: { other: '{n} zepi' },
  vi: { other: '{n} bông lúa' },
  ar: {
    zero: '{n} سنبلة',
    one: '{n} سنبلة',
    two: '{n} سنبلتان',
    few: '{n} سنابل',
    many: '{n} سنبلة',
    other: '{n} سنبلة',
  },
  zh: { other: '{n} 个麦穗' },
  so: { other: '{n} sabuul' },
  fr: { one: '{n} épi', other: '{n} épis' },
  pt: { one: '{n} espiga', other: '{n} espigas' },
  ru: {
    one: '{n} колосок',
    few: '{n} колоска',
    many: '{n} колосков',
    other: '{n} колоска',
  },
  ko: { other: '이삭 {n}개' },
  tl: { other: '{n} uhay' },
  am: { one: '{n} ዛላ', other: '{n} ዛላዎች' },
  hmn: { other: '{n} tus nplej' },
}

// Screen-reader text of a badge the owner sees with its points; the form follows {count}.
export const BADGE_CATEGORY_POINTS: Record<Locale, PluralForms> = {
  en: {
    one: '{label} category badge, level {level}, {count} point earned',
    other: '{label} category badge, level {level}, {count} points earned',
  },
  es: {
    one: 'Insignia de categoría {label}, nivel {level}, {count} punto ganado',
    other: 'Insignia de categoría {label}, nivel {level}, {count} puntos ganados',
  },
  ht: { other: 'Badj kategori {label}, nivo {level}, {count} pwen genyen' },
  vi: { other: 'Huy hiệu danh mục {label}, cấp {level}, đã đạt {count} điểm' },
  ar: {
    zero: 'شارة فئة {label}، المستوى {level}، {count} نقطة مكتسبة',
    one: 'شارة فئة {label}، المستوى {level}، {count} نقطة مكتسبة',
    two: 'شارة فئة {label}، المستوى {level}، {count} نقطتان مكتسبتان',
    few: 'شارة فئة {label}، المستوى {level}، {count} نقاط مكتسبة',
    many: 'شارة فئة {label}، المستوى {level}، {count} نقطة مكتسبة',
    other: 'شارة فئة {label}، المستوى {level}، {count} نقطة مكتسبة',
  },
  zh: { other: '{label}类别徽章，{level} 级，已获得 {count} 分' },
  so: { other: 'Calaamadda qaybta {label}, heerka {level}, {count} dhibcood la helay' },
  fr: {
    one: 'Badge de catégorie {label}, niveau {level}, {count} point gagné',
    other: 'Badge de catégorie {label}, niveau {level}, {count} points gagnés',
  },
  pt: {
    one: 'Selo de categoria {label}, nível {level}, {count} ponto ganho',
    other: 'Selo de categoria {label}, nível {level}, {count} pontos ganhos',
  },
  ru: {
    one: 'Значок категории «{label}», уровень {level}, получен {count} балл',
    few: 'Значок категории «{label}», уровень {level}, получено {count} балла',
    many: 'Значок категории «{label}», уровень {level}, получено {count} баллов',
    other: 'Значок категории «{label}», уровень {level}, получено {count} балла',
  },
  ko: { other: '{label} 분야 배지, 레벨 {level}, {count}점 획득' },
  tl: { other: 'Badge ng kategoryang {label}, antas {level}, {count} puntos ang nakuha' },
  am: {
    one: 'የ{label} ምድብ ባጅ፣ ደረጃ {level}፣ {count} ነጥብ ተገኝቷል',
    other: 'የ{label} ምድብ ባጅ፣ ደረጃ {level}፣ {count} ነጥቦች ተገኝተዋል',
  },
  hmn: { other: 'Daim paib pawg {label}, theem {level}, tau {count} qhab nia' },
}

export const BADGE_COMMUNITY_POINTS: Record<Locale, PluralForms> = {
  en: {
    one: '{label} community badge, level {level}, {count} point earned',
    other: '{label} community badge, level {level}, {count} points earned',
  },
  es: {
    one: 'Insignia comunitaria {label}, nivel {level}, {count} punto ganado',
    other: 'Insignia comunitaria {label}, nivel {level}, {count} puntos ganados',
  },
  ht: { other: 'Badj kominote {label}, nivo {level}, {count} pwen genyen' },
  vi: { other: 'Huy hiệu cộng đồng {label}, cấp {level}, đã đạt {count} điểm' },
  ar: {
    zero: 'شارة مجتمعية {label}، المستوى {level}، {count} نقطة مكتسبة',
    one: 'شارة مجتمعية {label}، المستوى {level}، {count} نقطة مكتسبة',
    two: 'شارة مجتمعية {label}، المستوى {level}، {count} نقطتان مكتسبتان',
    few: 'شارة مجتمعية {label}، المستوى {level}، {count} نقاط مكتسبة',
    many: 'شارة مجتمعية {label}، المستوى {level}، {count} نقطة مكتسبة',
    other: 'شارة مجتمعية {label}، المستوى {level}، {count} نقطة مكتسبة',
  },
  zh: { other: '{label}社区徽章，{level} 级，已获得 {count} 分' },
  so: { other: 'Calaamadda bulshada {label}, heerka {level}, {count} dhibcood la helay' },
  fr: {
    one: 'Badge communautaire {label}, niveau {level}, {count} point gagné',
    other: 'Badge communautaire {label}, niveau {level}, {count} points gagnés',
  },
  pt: {
    one: 'Selo comunitário {label}, nível {level}, {count} ponto ganho',
    other: 'Selo comunitário {label}, nível {level}, {count} pontos ganhos',
  },
  ru: {
    one: 'Значок сообщества «{label}», уровень {level}, получен {count} балл',
    few: 'Значок сообщества «{label}», уровень {level}, получено {count} балла',
    many: 'Значок сообщества «{label}», уровень {level}, получено {count} баллов',
    other: 'Значок сообщества «{label}», уровень {level}, получено {count} балла',
  },
  ko: { other: '{label} 커뮤니티 배지, 레벨 {level}, {count}점 획득' },
  tl: { other: 'Badge ng komunidad na {label}, antas {level}, {count} puntos ang nakuha' },
  am: {
    one: 'የ{label} የማኅበረሰብ ባጅ፣ ደረጃ {level}፣ {count} ነጥብ ተገኝቷል',
    other: 'የ{label} የማኅበረሰብ ባጅ፣ ደረጃ {level}፣ {count} ነጥቦች ተገኝተዋል',
  },
  hmn: { other: 'Daim paib zej zog {label}, theem {level}, tau {count} qhab nia' },
}

// Who sent an item, four givers or more: two names and how many others; the form follows {n}.
export const GIFTS_FROM_MORE: Record<Locale, PluralForms> = {
  en: { one: 'from {a}, {b} & {n} other', other: 'from {a}, {b} & {n} others' },
  es: { one: 'de {a}, {b} y {n} persona más', other: 'de {a}, {b} y {n} personas más' },
  ht: { other: 'nan men {a}, {b} ak {n} lòt moun' },
  vi: { other: 'từ {a}, {b} và {n} người khác' },
  ar: {
    zero: 'من {a} و{b} و{n} آخرين',
    one: 'من {a} و{b} و{n} شخص آخر',
    two: 'من {a} و{b} و{n} آخرَين',
    few: 'من {a} و{b} و{n} آخرين',
    many: 'من {a} و{b} و{n} آخرًا',
    other: 'من {a} و{b} و{n} آخر',
  },
  zh: { other: '来自 {a}、{b} 和另外 {n} 人' },
  so: { other: 'ka timid {a}, {b} iyo {n} kale' },
  fr: {
    one: 'de la part de {a}, {b} et {n} autre personne',
    other: 'de la part de {a}, {b} et {n} autres personnes',
  },
  pt: { one: 'de {a}, {b} e mais {n} pessoa', other: 'de {a}, {b} e mais {n} pessoas' },
  ru: {
    one: 'от: {a}, {b} и ещё {n} человек',
    few: 'от: {a}, {b} и ещё {n} человека',
    many: 'от: {a}, {b} и ещё {n} человек',
    other: 'от: {a}, {b} и ещё {n} человека',
  },
  ko: { other: '{a}, {b} 님 외 {n}명이 보냄' },
  tl: { other: 'mula kina {a}, {b}, at {n} pang iba' },
  am: { one: 'ከ{a}፣ {b} እና {n} ሌላ ሰው', other: 'ከ{a}፣ {b} እና {n} ሌሎች ሰዎች' },
  hmn: { other: 'los ntawm {a}, {b}, thiab {n} tus ntxiv' },
}

/** The name of one rating button: "3 stalks". */
export function stalksText(n: number, locale: Locale): string {
  return formatMessage(pluralMessage(STALKS[locale] ?? STALKS.en, n, locale), { n: formatCount(n, locale) })
}

/** "12 reviews": what the count beside a Harmony score means. */
export function reviewCountText(count: number, locale: Locale): string {
  return formatMessage(pluralMessage(REVIEW_COUNT[locale] ?? REVIEW_COUNT.en, count, locale), { count: formatCount(count, locale) })
}

/** The name of a rating shown as stalks: "4 out of 5 stalks". */
export function ratingText(value: number, max: number, locale: Locale): string {
  return formatMessage(badgesT(locale, 'ratingOutOf'), { value: formatCount(value, locale), max: formatCount(max, locale) })
}

// ---------------------------------------------------------------------------
// Vocabulary — badges (profiles.badge_summary) and appreciation items
// ---------------------------------------------------------------------------

const COMMUNITY_BADGE_KEYS: Record<string, keyof FeedBadgesMessages> = {
  helper: 'badgeHelper',
  connector: 'badgeConnector',
  voice: 'badgeVoice',
  advocate: 'badgeAdvocate',
  watcher: 'badgeWatcher',
  appreciated: 'badgeAppreciated',
}

/** The community badges this dictionary names (the keys of COMMUNITY_META). */
export const COMMUNITY_BADGES = Object.keys(COMMUNITY_BADGE_KEYS)

/** What a badge is read from: its group, its stored key and its English label. */
export interface LabelledBadge {
  group: 'family' | 'community'
  key: string
  label: string
}

/**
 * A badge's name in the viewer's language — the one reader every surface uses. A category
 * family is one of the composer's ten category chips, so it reads from their one translation
 * (requestCategoryLabel); a community badge from this dictionary. A badge neither knows is shown
 * with its English label, as before.
 */
export function badgeLabel(badge: LabelledBadge, locale: Locale): string {
  if (badge.group === 'family') return requestCategoryLabel(badge.label, locale)
  return Object.prototype.hasOwnProperty.call(COMMUNITY_BADGE_KEYS, badge.key) ? badgesT(locale, COMMUNITY_BADGE_KEYS[badge.key]) : badge.label
}

/** A badge chip's tooltip: "Food · level 2". */
export function badgeTitleText(badge: LabelledBadge & { level: number }, locale: Locale): string {
  return formatMessage(badgesT(locale, 'badgeTitle'), { label: badgeLabel(badge, locale), level: formatCount(badge.level, locale) })
}

/**
 * A badge's screen-reader text: "Food category badge, level 2", and for the owner's private
 * badges the points too ("…, 12 points earned", the form following the count).
 */
export function badgeAriaText(badge: LabelledBadge & { level: number; count?: number }, locale: Locale): string {
  const vars = { label: badgeLabel(badge, locale), level: formatCount(badge.level, locale) }
  const family = badge.group === 'family'
  if (typeof badge.count !== 'number') return formatMessage(badgesT(locale, family ? 'badgeCategoryAria' : 'badgeCommunityAria'), vars)
  const table = family ? BADGE_CATEGORY_POINTS : BADGE_COMMUNITY_POINTS
  return formatMessage(pluralMessage(table[locale] ?? table.en, badge.count, locale), { ...vars, count: formatCount(badge.count, locale) })
}

const ITEM_KEYS: Record<string, { label: keyof FeedBadgesMessages; alt: keyof FeedBadgesMessages }> = {
  heart: { label: 'itemHeart', alt: 'altHeart' },
  smile: { label: 'itemSmile', alt: 'altSmile' },
  cheer: { label: 'itemCheer', alt: 'altCheer' },
  flower: { label: 'itemFlower', alt: 'altFlower' },
  sunflower: { label: 'itemSunflower', alt: 'altSunflower' },
  leaf: { label: 'itemLeaf', alt: 'altLeaf' },
  bread: { label: 'itemBread', alt: 'altBread' },
  apple: { label: 'itemApple', alt: 'altApple' },
  soup: { label: 'itemSoup', alt: 'altSoup' },
  sun: { label: 'itemSun', alt: 'altSun' },
  seedling: { label: 'itemSeedling', alt: 'altSeedling' },
  tree: { label: 'itemTree', alt: 'altTree' },
}

/** The appreciation items this dictionary names (the slugs of lib/appreciation.ts). */
export const APPRECIATION_ITEM_SLUGS = Object.keys(ITEM_KEYS)

/** The word under an appreciation icon; an unknown slug is shown as stored. */
export function appreciationItemLabel(slug: string, locale: Locale): string {
  return Object.prototype.hasOwnProperty.call(ITEM_KEYS, slug) ? badgesT(locale, ITEM_KEYS[slug].label) : slug
}

/** What an appreciation icon shows (its title); an unknown slug is shown as stored. */
export function appreciationItemAlt(slug: string, locale: Locale): string {
  return Object.prototype.hasOwnProperty.call(ITEM_KEYS, slug) ? badgesT(locale, ITEM_KEYS[slug].alt) : slug
}

/**
 * A picker button's accessible name: the word under the icon first (WCAG 2.5.3), then what
 * pressing it does, or that it has been sent.
 */
export function appreciationItemName(slug: string, sent: boolean, locale: Locale): string {
  return formatMessage(badgesT(locale, sent ? 'itemSentAria' : 'itemSendAria'), { item: appreciationItemLabel(slug, locale) })
}

/** What the picker says once an item has been sent: "Heart sent." */
export function appreciationSentNotice(slug: string, locale: Locale): string {
  return formatMessage(badgesT(locale, 'itemSentNotice'), { item: appreciationItemLabel(slug, locale) })
}

/**
 * "from Ada, Ben & 3 others": the sentence for a number of givers, with {a} {b} {c} (and {n})
 * still to fill — the shelf puts each giver's own name, in its own element, into its slot.
 */
export function giftsFromMessage(givers: number, locale: Locale): string {
  if (givers <= 0) return badgesT(locale, 'giftsFromCommunity')
  if (givers === 1) return badgesT(locale, 'giftsFromOne')
  if (givers === 2) return badgesT(locale, 'giftsFromTwo')
  if (givers === 3) return badgesT(locale, 'giftsFromThree')
  const others = givers - 2
  return formatMessage(pluralMessage(GIFTS_FROM_MORE[locale] ?? GIFTS_FROM_MORE.en, others, locale), { n: formatCount(others, locale) })
}

// ---------------------------------------------------------------------------
// The review dialog — the reviewed member's role is a code from the caller
// ---------------------------------------------------------------------------

const REVIEW_ROLE_KEYS: Record<string, keyof FeedBadgesMessages> = {
  sourcer: 'reviewDescSourcer',
  seeker: 'reviewDescSeeker',
  requester: 'reviewDescRequester',
  volunteer: 'reviewDescVolunteer',
}

/** The roles a caller passes (components/panels/feed-panel.tsx, messages-panel.tsx). */
export const REVIEW_ROLES = Object.keys(REVIEW_ROLE_KEYS)

/** The dialog's description for the role; any other value reads as "this person". */
export function reviewDescription(role: string, locale: Locale): string {
  return badgesT(locale, Object.prototype.hasOwnProperty.call(REVIEW_ROLE_KEYS, role) ? REVIEW_ROLE_KEYS[role] : 'reviewDescPerson')
}

// ---------------------------------------------------------------------------
// Failures — sentences and codes
// ---------------------------------------------------------------------------

/** Each fixed sentence lib/appreciation.ts can report, and the key of the member's sentence. */
export const APPRECIATION_ERROR_SENTENCES: Record<string, keyof FeedBadgesMessages> = {
  'That appreciation item is not available.': 'errItemUnavailable',
  'Sending appreciation timed out — please try again.': 'errSendTimeout',
  "Couldn't send appreciation. Please try again.": 'errSendFailed',
  'Loading sent gifts timed out — please try again.': 'errSentTimeout',
  "Couldn't load sent gifts.": 'errSentFailed',
  'Loading your gifts timed out — please try again.': 'errShelfTimeout',
  "Couldn't load your gifts.": 'errShelfFailed',
}

/**
 * What the picker or the shelf shows for a failure: the library's own sentence (or one of the two
 * general ones of lib/friendly-error.ts) in the viewer's language; anything else as received,
 * with `translated: false` so the caller marks it lang="en" dir="ltr".
 */
export function appreciationErrorText(error: string, locale: Locale): ErrorText {
  return readErrorSentence(error, locale, (sentence) =>
    Object.prototype.hasOwnProperty.call(APPRECIATION_ERROR_SENTENCES, sentence) ? badgesT(locale, APPRECIATION_ERROR_SENTENCES[sentence]) : null,
  )
}

/** The review dialog's own two failures, kept in its state as codes. */
export const REVIEW_RATING_REQUIRED = 'rating_required'
export const REVIEW_SUBMIT_FAILED = 'submit_failed'

/** The dialog's codes and the fixed sentences of hooks/use-reviews.ts (submitReview). */
export const REVIEW_ERROR_SENTENCES: Record<string, keyof FeedBadgesMessages> = {
  [REVIEW_RATING_REQUIRED]: 'errRatingRequired',
  [REVIEW_SUBMIT_FAILED]: 'errSubmitFailed',
  'Review submission timed out — please check your connection and retry.': 'errReviewTimeout',
  "Couldn't submit review. Please try again.": 'errReviewFailed',
}

/** What the review dialog's failure line shows; same contract as appreciationErrorText. */
export function reviewErrorText(error: string, locale: Locale): ErrorText {
  return readErrorSentence(error, locale, (sentence) =>
    Object.prototype.hasOwnProperty.call(REVIEW_ERROR_SENTENCES, sentence) ? badgesT(locale, REVIEW_ERROR_SENTENCES[sentence]) : null,
  )
}
