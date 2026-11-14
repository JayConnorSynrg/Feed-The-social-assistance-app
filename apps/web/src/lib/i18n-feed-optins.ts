// apps/web/src/lib/i18n-feed-optins.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The sign-up ("opt-in") controls of a feed post card with a seeker limit
// (components/feed/feed-post-card.tsx) in the 14 FEED locales: the capacity line, the Opt In /
// Opted In / Withdraw / Full states, the author's list of people with its status badge and row
// buttons, the review buttons, and the failure line. Look up with optInsT(locale, key) (English
// fallback, logged as i18n.translation_fallback); fill {placeholders} with formatMessage().
//
// Text only: the handlers in components/panels/feed-panel.tsx and their table writes are not
// changed by the translation work. Stored values stay as stored: resource_opt_ins.status gets its
// label from optInStatusLabel(); a failure reaches the card as a fixed English sentence and
// optInErrorText() reads it as a code. English is word for word what the card showed before.
// Parity: i18n-feed-subtabs.test.ts; the two plural tables: i18n-feed-optins.test.ts.
// ht, so, am and hmn are machine-drafted, needs native review: docs/i18n-native-review.md.

import { translate, type Locale } from './i18n'
import { formatMessage, isolate } from './format-message'
import { formatCount, pluralMessage, type PluralForms } from './i18n-intl'
import { readErrorSentence, type ErrorText } from './i18n-friendly-error'
import { cardT } from './i18n-feed-card'

export interface FeedOptInsMessages {
  /** Button: ask for one of the spots. */
  optIn: string
  /** The member has asked for a spot. */
  optedIn: string
  /** Button: take the request back while it is pending. */
  withdraw: string
  /** Every spot is taken (a disabled button). */
  full: string
  // resource_opt_ins.status labels (the author's list)
  statusPending: string
  statusAccepted: string
  statusDeclined: string
  statusCompleted: string
  /** Marker beside a person the author declined on an earlier post. */
  declinedBefore: string
  /** Its tooltip. */
  declinedBeforeTitle: string
  // The author's row buttons
  unblock: string
  accept: string
  decline: string
  markCompleted: string
  /** The author reviews the person who asked. */
  reviewSeeker: string
  /** The person who asked reviews the author. */
  reviewSourcer: string
  /** Accessible name of a row button: its visible text, then the person. */
  actionForPersonAria: string
  errAccountRequired: string
  errOptInFailed: string
  errWithdrawFailed: string
  // What opt_in_to_post answers when it refuses
  errOfferFull: string
  errPostClosed: string
  errOwnPost: string
  errAlreadyOptedIn: string
  // Said in the feed's card-notice region once a sign-up action has gone through
  /** To the member who opted in / withdrew. */
  announceOptedIn: string
  announceWithdrawn: string
  /** To the author, about the person in {name}. */
  announceAccepted: string
  announceDeclined: string
  announceCompleted: string
  announceUnblocked: string
  /** Added to an outcome when the list could not be read again after it. */
  announceListStale: string
}

export const feedOptInsMessages: Record<Locale, FeedOptInsMessages> = {
  en: {
    optIn: 'Opt In',
    optedIn: 'Opted In',
    withdraw: 'Withdraw',
    full: 'Full',
    statusPending: 'pending',
    statusAccepted: 'accepted',
    statusDeclined: 'declined',
    statusCompleted: 'completed',
    declinedBefore: 'Declined before',
    declinedBeforeTitle: 'You have declined this person before',
    unblock: 'Unblock — they can request again',
    accept: 'Accept',
    decline: 'Decline',
    markCompleted: 'Mark Completed',
    reviewSeeker: 'Review seeker',
    reviewSourcer: 'Review sourcer',
    actionForPersonAria: '{action}: {name}',
    errAccountRequired: 'Create a free account to opt in.',
    errOptInFailed: "Couldn't opt in. Please try again.",
    errWithdrawFailed: "Couldn't withdraw opt-in. Please try again.",
    errOfferFull: 'This offer is full',
    errPostClosed: 'This post is closed',
    errOwnPost: 'You cannot opt in to your own post',
    errAlreadyOptedIn: 'Already opted in',
    announceOptedIn: 'You are opted in.',
    announceWithdrawn: 'Your opt-in was withdrawn.',
    announceAccepted: 'You accepted {name}.',
    announceDeclined: 'You declined {name}.',
    announceCompleted: 'Marked completed for {name}.',
    announceUnblocked: '{name} unblocked. They can request again.',
    announceListStale: 'The sign-up list could not be refreshed.',
  },
  es: {
    optIn: 'Apuntarme',
    optedIn: 'Te apuntaste',
    withdraw: 'Retirarme',
    full: 'Completo',
    statusPending: 'pendiente',
    statusAccepted: 'aceptada',
    statusDeclined: 'rechazada',
    statusCompleted: 'completada',
    declinedBefore: 'Rechazada antes',
    declinedBeforeTitle: 'Ya rechazaste a esta persona antes',
    unblock: 'Desbloquear: podrá volver a solicitarlo',
    accept: 'Aceptar',
    decline: 'Rechazar',
    markCompleted: 'Marcar como completada',
    reviewSeeker: 'Valorar a quien solicitó',
    reviewSourcer: 'Valorar a quien ofreció',
    actionForPersonAria: '{action}: {name}',
    errAccountRequired: 'Crea una cuenta gratuita para apuntarte.',
    errOptInFailed: 'No pudiste apuntarte. Inténtalo de nuevo.',
    errWithdrawFailed: 'No se pudo retirar tu solicitud. Inténtalo de nuevo.',
    errOfferFull: 'Esta oferta está completa',
    errPostClosed: 'Esta publicación está cerrada',
    errOwnPost: 'No puedes apuntarte a tu propia publicación',
    errAlreadyOptedIn: 'Ya te apuntaste',
    announceOptedIn: 'Te apuntaste.',
    announceWithdrawn: 'Retiraste tu solicitud.',
    announceAccepted: 'Aceptaste a {name}.',
    announceDeclined: 'Rechazaste a {name}.',
    announceCompleted: 'Marcada como completada: {name}.',
    announceUnblocked: 'Desbloqueaste a {name}. Podrá volver a solicitarlo.',
    announceListStale: 'No se pudo actualizar la lista de personas apuntadas.',
  },
  // machine-drafted, needs native review
  ht: {
    optIn: 'Enskri',
    optedIn: 'Ou enskri',
    withdraw: 'Retire',
    full: 'Plen',
    statusPending: 'ann atant',
    statusAccepted: 'aksepte',
    statusDeclined: 'refize',
    statusCompleted: 'fini',
    declinedBefore: 'Refize deja',
    declinedBeforeTitle: 'Ou te deja refize moun sa a',
    unblock: 'Debloke — li ka mande ankò',
    accept: 'Aksepte',
    decline: 'Refize',
    markCompleted: 'Make kòm fini',
    reviewSeeker: 'Evalye moun ki mande a',
    reviewSourcer: 'Evalye moun ki ofri a',
    actionForPersonAria: '{action}: {name}',
    errAccountRequired: 'Kreye yon kont gratis pou w enskri.',
    errOptInFailed: 'Nou pa kapab enskri w. Tanpri eseye ankò.',
    errWithdrawFailed: 'Nou pa kapab retire enskripsyon ou. Tanpri eseye ankò.',
    errOfferFull: 'Òf sa a plen',
    errPostClosed: 'Piblikasyon sa a fèmen',
    errOwnPost: 'Ou pa ka enskri nan pwòp piblikasyon ou',
    errAlreadyOptedIn: 'Ou deja enskri',
    announceOptedIn: 'Ou enskri.',
    announceWithdrawn: 'Ou retire enskripsyon ou.',
    announceAccepted: 'Ou aksepte {name}.',
    announceDeclined: 'Ou refize {name}.',
    announceCompleted: 'Make kòm fini pou {name}.',
    announceUnblocked: 'Ou debloke {name}. Li ka mande ankò.',
    announceListStale: 'Nou pa t kapab mete lis moun ki enskri yo ajou.',
  },
  vi: {
    optIn: 'Đăng ký',
    optedIn: 'Đã đăng ký',
    withdraw: 'Rút lại',
    full: 'Đã đủ',
    statusPending: 'đang chờ',
    statusAccepted: 'đã chấp nhận',
    statusDeclined: 'đã từ chối',
    statusCompleted: 'đã hoàn tất',
    declinedBefore: 'Từng bị từ chối',
    declinedBeforeTitle: 'Bạn đã từng từ chối người này',
    unblock: 'Bỏ chặn — họ có thể yêu cầu lại',
    accept: 'Chấp nhận',
    decline: 'Từ chối',
    markCompleted: 'Đánh dấu hoàn tất',
    reviewSeeker: 'Đánh giá người nhận',
    reviewSourcer: 'Đánh giá người cho',
    actionForPersonAria: '{action}: {name}',
    errAccountRequired: 'Tạo tài khoản miễn phí để đăng ký.',
    errOptInFailed: 'Không thể đăng ký. Vui lòng thử lại.',
    errWithdrawFailed: 'Không thể rút lại đăng ký. Vui lòng thử lại.',
    errOfferFull: 'Lượt này đã đủ người',
    errPostClosed: 'Bài đăng này đã đóng',
    errOwnPost: 'Bạn không thể đăng ký vào bài đăng của chính mình',
    errAlreadyOptedIn: 'Bạn đã đăng ký rồi',
    announceOptedIn: 'Bạn đã đăng ký.',
    announceWithdrawn: 'Bạn đã rút lại đăng ký.',
    announceAccepted: 'Đã chấp nhận {name}.',
    announceDeclined: 'Đã từ chối {name}.',
    announceCompleted: 'Đã đánh dấu hoàn tất cho {name}.',
    announceUnblocked: 'Đã bỏ chặn {name}. Họ có thể yêu cầu lại.',
    announceListStale: 'Không thể làm mới danh sách đăng ký.',
  },
  ar: {
    optIn: 'سجّلني',
    optedIn: 'تم تسجيلك',
    withdraw: 'انسحاب',
    full: 'مكتمل العدد',
    statusPending: 'قيد الانتظار',
    statusAccepted: 'مقبول',
    statusDeclined: 'مرفوض',
    statusCompleted: 'مكتمل',
    declinedBefore: 'رُفض سابقًا',
    declinedBeforeTitle: 'سبق أن رفضت هذا الشخص',
    unblock: 'إلغاء الحظر — يمكنه الطلب مجددًا',
    accept: 'قبول',
    decline: 'رفض',
    markCompleted: 'تحديد كمكتمل',
    reviewSeeker: 'تقييم طالب المساعدة',
    reviewSourcer: 'تقييم مقدّم المساعدة',
    actionForPersonAria: '{action}: {name}',
    errAccountRequired: 'أنشئ حسابًا مجانيًا للتسجيل.',
    errOptInFailed: 'تعذّر التسجيل. يُرجى المحاولة مرة أخرى.',
    errWithdrawFailed: 'تعذّر سحب تسجيلك. يُرجى المحاولة مرة أخرى.',
    errOfferFull: 'هذا العرض مكتمل العدد',
    errPostClosed: 'هذا المنشور مغلق',
    errOwnPost: 'لا يمكنك التسجيل في منشورك',
    errAlreadyOptedIn: 'سبق أن سجّلت',
    announceOptedIn: 'تم تسجيلك.',
    announceWithdrawn: 'تم سحب تسجيلك.',
    announceAccepted: 'تم قبول {name}.',
    announceDeclined: 'تم رفض {name}.',
    announceCompleted: 'تم التحديد كمكتمل لـ {name}.',
    announceUnblocked: 'تم إلغاء حظر {name}. يمكنه الطلب مجددًا.',
    announceListStale: 'تعذّر تحديث قائمة المسجّلين.',
  },
  zh: {
    optIn: '报名',
    optedIn: '已报名',
    withdraw: '撤回',
    full: '已满',
    statusPending: '待处理',
    statusAccepted: '已接受',
    statusDeclined: '已拒绝',
    statusCompleted: '已完成',
    declinedBefore: '曾被拒绝',
    declinedBeforeTitle: '您之前拒绝过此人',
    unblock: '解除限制 — 对方可再次申请',
    accept: '接受',
    decline: '拒绝',
    markCompleted: '标记为已完成',
    reviewSeeker: '评价求助者',
    reviewSourcer: '评价提供者',
    actionForPersonAria: '{action}: {name}',
    errAccountRequired: '创建免费账户即可报名。',
    errOptInFailed: '无法报名。请重试。',
    errWithdrawFailed: '无法撤回报名。请重试。',
    errOfferFull: '此名额已满',
    errPostClosed: '此帖子已关闭',
    errOwnPost: '您不能报名自己的帖子',
    errAlreadyOptedIn: '您已报名',
    announceOptedIn: '您已报名。',
    announceWithdrawn: '您已撤回报名。',
    announceAccepted: '已接受 {name}。',
    announceDeclined: '已拒绝 {name}。',
    announceCompleted: '已为 {name} 标记为已完成。',
    announceUnblocked: '已解除对 {name} 的限制。对方可再次申请。',
    announceListStale: '无法刷新报名名单。',
  },
  // machine-drafted, needs native review
  so: {
    optIn: 'Isu qor',
    optedIn: 'Waad is qortay',
    withdraw: 'Ka noqo',
    full: 'Buuxa',
    statusPending: 'la sugayo',
    statusAccepted: 'la aqbalay',
    statusDeclined: 'la diiday',
    statusCompleted: 'la dhammeeyay',
    declinedBefore: 'Hore loo diiday',
    declinedBeforeTitle: 'Qofkan hore ayaad u diiday',
    unblock: 'Ka qaad xannibaadda — mar kale ayuu codsan karaa',
    accept: 'Aqbal',
    decline: 'Diid',
    markCompleted: 'Calaamadee in la dhammeeyay',
    reviewSeeker: 'Qiimee codsadaha',
    reviewSourcer: 'Qiimee bixiyaha',
    actionForPersonAria: '{action}: {name}',
    errAccountRequired: 'Samee akoon bilaash ah si aad isu qorto.',
    errOptInFailed: 'Lama is qori karin. Fadlan mar kale isku day.',
    errWithdrawFailed: 'Is-qoristaada lagama noqon karin. Fadlan mar kale isku day.',
    errOfferFull: 'Deeqdani way buuxdaa',
    errPostClosed: 'Qoraalkani wuu xiran yahay',
    errOwnPost: 'Iskuma qori kartid qoraalkaaga',
    errAlreadyOptedIn: 'Hore ayaad isu qortay',
    announceOptedIn: 'Waad is qortay.',
    announceWithdrawn: 'Is-qoristaadii waad ka noqotay.',
    announceAccepted: '{name} waa la aqbalay.',
    announceDeclined: '{name} waa la diiday.',
    announceCompleted: 'Waxaa loo calaamadeeyay in la dhammeeyay: {name}.',
    announceUnblocked: '{name} xannibaaddii waa laga qaaday. Mar kale ayuu codsan karaa.',
    announceListStale: 'Liiska dadka is qoray lama cusboonaysiin karin.',
  },
  fr: {
    optIn: "M'inscrire",
    optedIn: 'Inscription enregistrée',
    withdraw: 'Me retirer',
    full: 'Complet',
    statusPending: 'en attente',
    statusAccepted: 'acceptée',
    statusDeclined: 'refusée',
    statusCompleted: 'terminée',
    declinedBefore: 'Refus précédent',
    declinedBeforeTitle: 'Vous avez déjà refusé cette personne',
    unblock: 'Débloquer — elle pourra refaire une demande',
    accept: 'Accepter',
    decline: 'Refuser',
    markCompleted: 'Marquer comme terminée',
    reviewSeeker: 'Évaluer la personne qui a demandé',
    reviewSourcer: 'Évaluer la personne qui a offert',
    actionForPersonAria: '{action}: {name}',
    errAccountRequired: 'Créez un compte gratuit pour vous inscrire.',
    errOptInFailed: 'Impossible de vous inscrire. Veuillez réessayer.',
    errWithdrawFailed: 'Impossible de retirer votre inscription. Veuillez réessayer.',
    errOfferFull: 'Cette offre est complète',
    errPostClosed: 'Cette publication est fermée',
    errOwnPost: 'Vous ne pouvez pas vous inscrire à votre propre publication',
    errAlreadyOptedIn: 'Inscription déjà enregistrée',
    announceOptedIn: 'Votre inscription est enregistrée.',
    announceWithdrawn: 'Votre inscription est retirée.',
    announceAccepted: '{name} : demande acceptée.',
    announceDeclined: '{name} : demande refusée.',
    announceCompleted: '{name} : marquée comme terminée.',
    announceUnblocked: '{name} : déblocage fait. Une nouvelle demande est possible.',
    announceListStale: "Impossible d'actualiser la liste des inscriptions.",
  },
  pt: {
    optIn: 'Inscrever-me',
    optedIn: 'Inscrição feita',
    withdraw: 'Retirar',
    full: 'Lotado',
    statusPending: 'pendente',
    statusAccepted: 'aceita',
    statusDeclined: 'recusada',
    statusCompleted: 'concluída',
    declinedBefore: 'Recusada antes',
    declinedBeforeTitle: 'Você já recusou esta pessoa antes',
    unblock: 'Desbloquear — a pessoa poderá pedir de novo',
    accept: 'Aceitar',
    decline: 'Recusar',
    markCompleted: 'Marcar como concluída',
    reviewSeeker: 'Avaliar quem pediu',
    reviewSourcer: 'Avaliar quem ofereceu',
    actionForPersonAria: '{action}: {name}',
    errAccountRequired: 'Crie uma conta gratuita para se inscrever.',
    errOptInFailed: 'Não foi possível fazer a inscrição. Tente novamente.',
    errWithdrawFailed: 'Não foi possível retirar a inscrição. Tente novamente.',
    errOfferFull: 'Esta oferta está lotada',
    errPostClosed: 'Esta publicação está fechada',
    errOwnPost: 'Você não pode se inscrever na sua própria publicação',
    errAlreadyOptedIn: 'Você já se inscreveu',
    announceOptedIn: 'Sua inscrição foi feita.',
    announceWithdrawn: 'Sua inscrição foi retirada.',
    announceAccepted: 'Você aceitou {name}.',
    announceDeclined: 'Você recusou {name}.',
    announceCompleted: 'Marcada como concluída: {name}.',
    announceUnblocked: 'Você desbloqueou {name}. A pessoa poderá pedir de novo.',
    announceListStale: 'Não foi possível atualizar a lista de inscrições.',
  },
  ru: {
    optIn: 'Записаться',
    optedIn: 'Вы записаны',
    withdraw: 'Отозвать',
    full: 'Мест нет',
    statusPending: 'ожидает',
    statusAccepted: 'принята',
    statusDeclined: 'отклонена',
    statusCompleted: 'завершена',
    declinedBefore: 'Ранее был отказ',
    declinedBeforeTitle: 'Вы уже отклоняли этого человека',
    unblock: 'Разблокировать — сможет подать заявку снова',
    accept: 'Принять',
    decline: 'Отклонить',
    markCompleted: 'Отметить как завершённую',
    reviewSeeker: 'Оценить просившего',
    reviewSourcer: 'Оценить предложившего',
    actionForPersonAria: '{action}: {name}',
    errAccountRequired: 'Создайте бесплатный аккаунт, чтобы записаться.',
    errOptInFailed: 'Не удалось записаться. Попробуйте ещё раз.',
    errWithdrawFailed: 'Не удалось отозвать запись. Попробуйте ещё раз.',
    errOfferFull: 'В этом предложении больше нет мест',
    errPostClosed: 'Эта публикация закрыта',
    errOwnPost: 'Нельзя записаться на собственную публикацию',
    errAlreadyOptedIn: 'Вы уже записаны на это',
    announceOptedIn: 'Вы записаны.',
    announceWithdrawn: 'Ваша запись отозвана.',
    announceAccepted: 'Заявка принята: {name}.',
    announceDeclined: 'Заявка отклонена: {name}.',
    announceCompleted: 'Отмечено как завершённое: {name}.',
    announceUnblocked: 'Блокировка снята: {name}. Можно подать заявку снова.',
    announceListStale: 'Не удалось обновить список записавшихся.',
  },
  ko: {
    optIn: '신청하기',
    optedIn: '신청함',
    withdraw: '신청 취소',
    full: '마감',
    statusPending: '대기 중',
    statusAccepted: '수락됨',
    statusDeclined: '거절됨',
    statusCompleted: '완료됨',
    declinedBefore: '이전에 거절함',
    declinedBeforeTitle: '이전에 이 사람을 거절한 적이 있습니다',
    unblock: '차단 해제 — 다시 신청할 수 있습니다',
    accept: '수락',
    decline: '거절',
    markCompleted: '완료로 표시',
    reviewSeeker: '신청자 평가',
    reviewSourcer: '제공자 평가',
    actionForPersonAria: '{action}: {name}',
    errAccountRequired: '신청하려면 무료 계정을 만드세요.',
    errOptInFailed: '신청하지 못했습니다. 다시 시도해 주세요.',
    errWithdrawFailed: '신청을 취소하지 못했습니다. 다시 시도해 주세요.',
    errOfferFull: '이 나눔은 마감되었습니다',
    errPostClosed: '이 게시물은 닫혔습니다',
    errOwnPost: '자신의 게시물에는 신청할 수 없습니다',
    errAlreadyOptedIn: '이미 신청했습니다',
    announceOptedIn: '신청되었습니다.',
    announceWithdrawn: '신청이 취소되었습니다.',
    announceAccepted: '{name} 님을 수락했습니다.',
    announceDeclined: '{name} 님을 거절했습니다.',
    announceCompleted: '{name} 님 건을 완료로 표시했습니다.',
    announceUnblocked: '{name} 님의 차단을 해제했습니다. 다시 신청할 수 있습니다.',
    announceListStale: '신청 목록을 새로 고치지 못했습니다.',
  },
  tl: {
    optIn: 'Mag-opt in',
    optedIn: 'Naka-opt in',
    withdraw: 'Bawiin',
    full: 'Puno na',
    statusPending: 'nakabinbin',
    statusAccepted: 'tinanggap',
    statusDeclined: 'tinanggihan',
    statusCompleted: 'natapos',
    declinedBefore: 'Tinanggihan dati',
    declinedBeforeTitle: 'Tinanggihan mo na ang taong ito dati',
    unblock: 'I-unblock — maaari siyang humiling muli',
    accept: 'Tanggapin',
    decline: 'Tanggihan',
    markCompleted: 'Markahang tapos na',
    reviewSeeker: 'I-review ang humiling',
    reviewSourcer: 'I-review ang nag-alok',
    actionForPersonAria: '{action}: {name}',
    errAccountRequired: 'Gumawa ng libreng account para makapag-opt in.',
    errOptInFailed: 'Hindi makapag-opt in. Pakisubukang muli.',
    errWithdrawFailed: 'Hindi mabawi ang opt-in. Pakisubukang muli.',
    errOfferFull: 'Puno na ang alok na ito',
    errPostClosed: 'Sarado na ang post na ito',
    errOwnPost: 'Hindi ka maaaring mag-opt in sa sarili mong post',
    errAlreadyOptedIn: 'Naka-opt in ka na',
    announceOptedIn: 'Naka-opt in ka na ngayon.',
    announceWithdrawn: 'Binawi ang opt-in mo.',
    announceAccepted: 'Tinanggap si {name}.',
    announceDeclined: 'Tinanggihan si {name}.',
    announceCompleted: 'Minarkahang tapos na para kay {name}.',
    announceUnblocked: 'Na-unblock si {name}. Maaari siyang humiling muli.',
    announceListStale: 'Hindi na-refresh ang listahan ng mga nag-opt in.',
  },
  // machine-drafted, needs native review
  am: {
    optIn: 'ተመዝገብ',
    optedIn: 'ተመዝግበዋል',
    withdraw: 'አንሳ',
    full: 'ሞልቷል',
    statusPending: 'በመጠባበቅ ላይ',
    statusAccepted: 'ተቀባይነት አግኝቷል',
    statusDeclined: 'ተቀባይነት አላገኘም',
    statusCompleted: 'ተጠናቋል',
    declinedBefore: 'ከዚህ በፊት ውድቅ ተደርጓል',
    declinedBeforeTitle: 'ይህን ሰው ከዚህ በፊት አልተቀበሉትም',
    unblock: 'እገዳውን አንሳ — እንደገና መጠየቅ ይችላል',
    accept: 'ተቀበል',
    decline: 'አትቀበል',
    markCompleted: 'እንደተጠናቀቀ ምልክት አድርግ',
    reviewSeeker: 'ጠያቂውን ገምግም',
    reviewSourcer: 'አቅራቢውን ገምግም',
    actionForPersonAria: '{action}: {name}',
    errAccountRequired: 'ለመመዝገብ ነፃ መለያ ይፍጠሩ።',
    errOptInFailed: 'መመዝገብ አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
    errWithdrawFailed: 'ምዝገባዎን ማንሳት አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
    errOfferFull: 'ይህ አቅርቦት ሞልቷል',
    errPostClosed: 'ይህ ልጥፍ ተዘግቷል',
    errOwnPost: 'በራስዎ ልጥፍ ላይ መመዝገብ አይችሉም',
    errAlreadyOptedIn: 'አስቀድመው ተመዝግበዋል',
    announceOptedIn: 'ተመዝግበዋል።',
    announceWithdrawn: 'ምዝገባዎ ተነስቷል።',
    announceAccepted: '{name} ተቀባይነት አግኝቷል።',
    announceDeclined: '{name} ተቀባይነት አላገኘም።',
    announceCompleted: 'ለ{name} እንደተጠናቀቀ ምልክት ተደርጓል።',
    announceUnblocked: 'የ{name} እገዳ ተነስቷል። እንደገና መጠየቅ ይችላል።',
    announceListStale: 'የተመዝጋቢዎችን ዝርዝር ማደስ አልተቻለም።',
  },
  // machine-drafted, needs native review
  hmn: {
    optIn: 'Sau npe',
    optedIn: 'Sau npe lawm',
    withdraw: 'Thim',
    full: 'Puv lawm',
    statusPending: 'tab tom tos',
    statusAccepted: 'txais lawm',
    statusDeclined: 'tsis txais',
    statusCompleted: 'tiav lawm',
    declinedBefore: 'Tsis txais ua ntej lawm',
    declinedBeforeTitle: 'Koj twb tsis txais tus neeg no ua ntej lawm',
    unblock: 'Tshem kev thaiv — nws thov tau dua',
    accept: 'Txais',
    decline: 'Tsis txais',
    markCompleted: 'Kos tias tiav lawm',
    reviewSeeker: 'Ntsuam xyuas tus neeg thov',
    reviewSourcer: 'Ntsuam xyuas tus neeg muab',
    actionForPersonAria: '{action}: {name}',
    errAccountRequired: 'Tsim ib tus account dawb los sau npe.',
    errOptInFailed: 'Sau npe tsis tau. Thov sim dua.',
    errWithdrawFailed: 'Thim kev sau npe tsis tau. Thov sim dua.',
    errOfferFull: 'Qhov kev muab no puv lawm',
    errPostClosed: 'Qhov tshaj tawm no kaw lawm',
    errOwnPost: 'Koj sau npe rau koj tus kheej qhov tshaj tawm tsis tau',
    errAlreadyOptedIn: 'Koj twb sau npe lawm',
    announceOptedIn: 'Koj sau npe lawm.',
    announceWithdrawn: 'Koj thim kev sau npe lawm.',
    announceAccepted: 'Txais {name} lawm.',
    announceDeclined: 'Tsis txais {name} lawm.',
    announceCompleted: 'Kos tias tiav lawm rau {name}.',
    announceUnblocked: 'Tshem kev thaiv {name} lawm. Nws thov tau dua.',
    announceListStale: 'Rov thauj daim ntawv teev cov neeg sau npe tsis tau.',
  },
}

export function optInsT(locale: Locale, key: keyof FeedOptInsMessages): string {
  return translate(feedOptInsMessages, locale, key)
}

// ---------------------------------------------------------------------------
// Counts — plural tables, selected through Intl.PluralRules (lib/i18n-intl.ts)
// ---------------------------------------------------------------------------
//
// "2 of 5 spots left": the form follows {max}, the number the noun stands beside.
export const SPOTS_LEFT: Record<Locale, PluralForms> = {
  en: { one: '{left} of {max} spot left', other: '{left} of {max} spots left' },
  es: { one: '{left} de {max} plaza disponible', other: '{left} de {max} plazas disponibles' },
  ht: { other: '{left} sou {max} plas ki rete' },
  vi: { other: 'Còn {left} trên {max} chỗ' },
  ar: {
    zero: '{left} من {max} مكان متاح',
    one: '{left} من {max} مكان متاح',
    two: '{left} من {max} مكانين متاحين',
    few: '{left} من {max} أماكن متاحة',
    many: '{left} من {max} مكانًا متاحًا',
    other: '{left} من {max} مكان متاح',
  },
  zh: { other: '剩余 {left}/{max} 个名额' },
  so: { other: '{left} ka mid ah {max} boos ayaa haray' },
  fr: { one: '{left} sur {max} place disponible', other: '{left} sur {max} places disponibles' },
  pt: { one: '{left} de {max} vaga disponível', other: '{left} de {max} vagas disponíveis' },
  ru: {
    one: 'Свободно {left} из {max} места',
    few: 'Свободно {left} из {max} мест',
    many: 'Свободно {left} из {max} мест',
    other: 'Свободно {left} из {max} места',
  },
  ko: { other: '{max}자리 중 {left}자리 남음' },
  tl: { other: '{left} sa {max} puwesto ang natitira' },
  am: { one: '{left} ከ{max} ቦታ ቀርቷል', other: '{left} ከ{max} ቦታዎች ቀርተዋል' },
  hmn: { other: 'Tshuav {left} ntawm {max} qhov chaw' },
}

// "3 opted in": the author's toggle; the form follows {count}.
export const OPTED_IN_COUNT: Record<Locale, PluralForms> = {
  en: { other: '{count} opted in' },
  es: { one: '{count} persona apuntada', other: '{count} personas apuntadas' },
  ht: { other: '{count} moun enskri' },
  vi: { other: '{count} người đã đăng ký' },
  ar: {
    zero: '{count} مسجّل',
    one: '{count} مسجّل',
    two: '{count} مسجّلان',
    few: '{count} مسجّلين',
    many: '{count} مسجّلًا',
    other: '{count} مسجّل',
  },
  zh: { other: '{count} 人已报名' },
  so: { other: '{count} qof ayaa is qoray' },
  fr: { one: '{count} personne inscrite', other: '{count} personnes inscrites' },
  pt: { one: '{count} pessoa inscrita', other: '{count} pessoas inscritas' },
  ru: {
    one: '{count} человек записался',
    few: '{count} человека записались',
    many: '{count} человек записались',
    other: '{count} человека записались',
  },
  ko: { other: '{count}명 신청' },
  tl: { other: '{count} ang nag-opt in' },
  am: { one: '{count} ሰው ተመዝግቧል', other: '{count} ሰዎች ተመዝግበዋል' },
  hmn: { other: '{count} tus neeg sau npe lawm' },
}

/** "2 of 5 spots left", both numbers in the locale's digits. */
export function spotsLeftText(left: number, max: number, locale: Locale): string {
  return formatMessage(pluralMessage(SPOTS_LEFT[locale] ?? SPOTS_LEFT.en, max, locale), { left: formatCount(left, locale), max: formatCount(max, locale) })
}

/** "3 opted in". */
export function optedInCountText(count: number, locale: Locale): string {
  return formatMessage(pluralMessage(OPTED_IN_COUNT[locale] ?? OPTED_IN_COUNT.en, count, locale), { count: formatCount(count, locale) })
}

// ---------------------------------------------------------------------------
// Vocabulary — resource_opt_ins.status
// ---------------------------------------------------------------------------

const STATUS_KEYS: Record<string, keyof FeedOptInsMessages> = {
  pending: 'statusPending',
  accepted: 'statusAccepted',
  declined: 'statusDeclined',
  completed: 'statusCompleted',
}

/** The four values of resource_opt_ins.status (its CHECK constraint). */
export const OPT_IN_STATUSES = Object.keys(STATUS_KEYS)

/** True when the badge for this status is one of FEED's labels; false when it is the stored
 *  value itself, which is English. */
export function isOptInStatus(status: string): boolean {
  return Object.prototype.hasOwnProperty.call(STATUS_KEYS, status)
}

/** The status badge in the viewer's language; an unknown stored value is shown as stored. */
export function optInStatusLabel(status: string, locale: Locale): string {
  return isOptInStatus(status) ? optInsT(locale, STATUS_KEYS[status]) : status
}

// ---------------------------------------------------------------------------
// Accessible names
// ---------------------------------------------------------------------------

export type OptInRowAction = 'accept' | 'decline' | 'markCompleted' | 'unblock' | 'reviewSeeker'

/**
 * A row button's accessible name: its visible text first (WCAG 2.5.3), then the person it acts
 * on, so five "Accept" buttons are five names. The person's name is their own text: isolated,
 * never translated.
 */
export function optInActionName(locale: Locale, action: OptInRowAction, name: string): string {
  return formatMessage(optInsT(locale, 'actionForPersonAria'), { action: optInsT(locale, action), name: isolate(name) })
}

// ---------------------------------------------------------------------------
// What the feed says once a sign-up action has gone through
// ---------------------------------------------------------------------------

/** The sign-up actions a card offers: the member's two and the author's four. */
export type SignUpKind = 'optIn' | 'withdraw' | 'accept' | 'decline' | 'complete' | 'unblock'

const NOTICE_KEYS: Record<SignUpKind, keyof FeedOptInsMessages> = {
  optIn: 'announceOptedIn',
  withdraw: 'announceWithdrawn',
  accept: 'announceAccepted',
  decline: 'announceDeclined',
  complete: 'announceCompleted',
  unblock: 'announceUnblocked',
}

/**
 * The sentence for the feed's card-notice region once an action has gone through. The author's
 * four name the person: their name is their own text, isolated and never looked up.
 */
export function signUpNotice(kind: SignUpKind, name: string | null, locale: Locale): string {
  return formatMessage(optInsT(locale, NOTICE_KEYS[kind]), { name: isolate(name ?? '') })
}

// ---------------------------------------------------------------------------
// Failures — sentences read as codes
// ---------------------------------------------------------------------------

/**
 * The fixed sentence the feed hands the card when a sign-up action — accept, decline, mark
 * completed, unblock, or a withdraw — did not go through: its request failed, or answered without
 * an error and changed nothing. Read as a code. The member's sentence is the card's own generic
 * failure (lib/i18n-feed-card.ts statusModerationFailed): one source for those words.
 */
export const SIGN_UP_NOT_DONE = "That didn't work. Please try again."

/**
 * Each fixed sentence the card can be handed as an opt-in failure, and the key of the member's
 * sentence: the guest refusal and the two thrown-value fallbacks of the feed panel's handlers
 * (components/panels/feed-panel.tsx, unchanged), the two failures of hooks/use-opt-ins.ts, and the
 * four refusals of the opt_in_to_post function, which the hook hands through as they are.
 */
export const OPT_IN_ERROR_SENTENCES: Record<string, keyof FeedOptInsMessages> = {
  'Create a free account to opt in.': 'errAccountRequired',
  "Couldn't opt in. Please try again.": 'errOptInFailed',
  'Could not opt in.': 'errOptInFailed',
  "Couldn't withdraw opt-in. Please try again.": 'errWithdrawFailed',
  'Could not withdraw.': 'errWithdrawFailed',
  'This offer is full': 'errOfferFull',
  'This post is closed': 'errPostClosed',
  'You cannot opt in to your own post': 'errOwnPost',
  'Already opted in': 'errAlreadyOptedIn',
}

/**
 * What the card's opt-in failure line shows: one of the sentences above (or one of the two
 * general ones of lib/friendly-error.ts) in the viewer's language; anything else as received,
 * with `translated: false` so the card marks it lang="en" dir="ltr".
 */
export function optInErrorText(error: string, locale: Locale): ErrorText {
  return readErrorSentence(error, locale, (sentence) =>
    sentence === SIGN_UP_NOT_DONE
      ? cardT(locale, 'statusModerationFailed')
      : Object.prototype.hasOwnProperty.call(OPT_IN_ERROR_SENTENCES, sentence)
        ? optInsT(locale, OPT_IN_ERROR_SENTENCES[sentence])
        : null,
  )
}
