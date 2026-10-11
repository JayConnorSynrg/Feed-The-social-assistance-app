// apps/web/src/lib/i18n-feed-petitions.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Community → Petitions sub-tab (components/panels/petitions-panel.tsx, hooks/use-petitions.ts)
// in the 14 FEED locales. Look up with petitionsT(locale, key) (English fallback, logged as
// i18n.translation_fallback); fill {placeholders} with formatMessage().
//
// Wording rule, in every locale: a petition signature is a "verified signature of support" —
// community advocacy. No value here calls it binding, a contract, or a matter of law
// (i18n-feed-petitions.test.ts checks each locale).
//
// Stored values stay as stored: petitions.cause_category gets its label from
// petitionCategoryLabel(); the hook and the sign route return codes and petitionErrorText() turns
// a code into a sentence. Counts take their plural form from the two tables below through
// Intl.PluralRules (lib/i18n-intl.ts).
// Parity: i18n-feed-subtabs.test.ts.
// ht, so, am and hmn are machine-drafted, needs native review: docs/i18n-native-review.md.
// Arabic says "confirmed" (مؤكَّد), not "certified" (a word that can read as notarised); that
// wording choice is on the same list for an Arabic speaker to confirm.

import { translate, type Locale } from './i18n'
import { pluralMessage, type PluralForms } from './i18n-intl'

export interface FeedPetitionsMessages {
  // petitions.cause_category labels
  catLandRights: string
  catInfrastructure: string
  catHousing: string
  catFoodAccess: string
  catHealthcare: string
  catEducation: string
  catEnvironment: string
  catCivilRights: string
  /** A petition with no category. */
  catCommunity: string
  /** The sub-tab heading. */
  title: string
  /** Name of the All / Signed tab list. */
  tabsLabel: string
  tabAll: string
  tabSigned: string
  /** Name of the progress bar toward the signature target. */
  progressLabel: string
  /** The member has signed this petition. */
  signed: string
  signaturesFinal: string
  /** Button: withdraw the member's own signature. */
  withdraw: string
  /** Button: sign. */
  sign: string
  /** Accessible name of a card's button: its visible text, then the petition title. */
  actionForPetitionAria: string
  /** Around the member's own name. */
  signingAs: string
  retentionNotice: string
  loading: string
  tryAgain: string
  emptyTitle: string
  emptyBody: string
  faqToggle: string
  faqPrivacy: string
  faqWithdraw: string
  faqVerified: string
  /** Guest prompt in place of signing. */
  guestPrompt: string
  signInPrompt: string
  signedEmptyTitle: string
  signedEmptyBody: string
  errLoadFailed: string
  errSignFailed: string
  errAccountRequired: string
  errAffirmationRequired: string
  errWithdrawLocked: string
  errWithdrawFailed: string
}

export const feedPetitionsMessages: Record<Locale, FeedPetitionsMessages> = {
  en: {
    catLandRights: 'Land Rights',
    catInfrastructure: 'Infrastructure',
    catHousing: 'Housing',
    catFoodAccess: 'Food Access',
    catHealthcare: 'Healthcare',
    catEducation: 'Education',
    catEnvironment: 'Environment',
    catCivilRights: 'Civil Rights',
    catCommunity: 'Community',
    title: 'Community Petitions',
    tabsLabel: 'Petitions view',
    tabAll: 'All petitions',
    tabSigned: 'Signed',
    progressLabel: 'Signature progress',
    signed: 'Signed',
    signaturesFinal: 'Signatures are final (the list has been exported).',
    withdraw: 'Withdraw my signature',
    sign: 'Add your verified signature of support',
    actionForPetitionAria: '{action}: {title}',
    signingAs: 'Signing as {name}',
    retentionNotice: 'Your name, the date, and a record of this petition version are kept as your verified signature of support.',
    loading: 'Loading petitions…',
    tryAgain: 'Try again',
    emptyTitle: 'No active petitions',
    emptyBody: 'Community petitions will appear here when published.',
    faqToggle: 'About petition signatures',
    faqPrivacy: 'Only administrators can see signers’ names; the public count never reveals who signed.',
    faqWithdraw: 'You can withdraw your signature anytime — until the organizer exports the signed list, after which signatures become final.',
    faqVerified: '“Verified signature of support” means your signature is recorded with a secure timestamp.',
    guestPrompt: 'Create a free account to add your verified signature of support to petitions',
    signInPrompt: 'Sign in to add your verified signature of support to any petition.',
    signedEmptyTitle: 'No signed petitions yet',
    signedEmptyBody: 'Petitions you sign will appear here.',
    errLoadFailed: 'Unable to load petitions. Please try again.',
    errSignFailed: 'Unable to add your signature. Please try again.',
    errAccountRequired: 'Sign in with an account to add your verified signature of support.',
    errAffirmationRequired: 'You must affirm to add your verified signature of support.',
    errWithdrawLocked: 'Signatures are final — the organizer has exported this list.',
    errWithdrawFailed: 'Unable to withdraw your signature. Please try again.',
  },
  es: {
    catLandRights: 'Derechos sobre la tierra',
    catInfrastructure: 'Infraestructura',
    catHousing: 'Vivienda',
    catFoodAccess: 'Acceso a alimentos',
    catHealthcare: 'Salud',
    catEducation: 'Educación',
    catEnvironment: 'Medio ambiente',
    catCivilRights: 'Derechos civiles',
    catCommunity: 'Comunidad',
    title: 'Peticiones de la comunidad',
    tabsLabel: 'Vista de peticiones',
    tabAll: 'Todas las peticiones',
    tabSigned: 'Firmadas',
    progressLabel: 'Avance de firmas',
    signed: 'Firmada',
    signaturesFinal: 'Las firmas son definitivas (la lista ya se exportó).',
    withdraw: 'Retirar mi firma',
    sign: 'Añade tu firma verificada de apoyo',
    actionForPetitionAria: '{action}: {title}',
    signingAs: 'Firmas como {name}',
    retentionNotice: 'Tu nombre, la fecha y un registro de esta versión de la petición se guardan como tu firma verificada de apoyo.',
    loading: 'Cargando peticiones…',
    tryAgain: 'Intentar de nuevo',
    emptyTitle: 'No hay peticiones activas',
    emptyBody: 'Las peticiones de la comunidad aparecerán aquí cuando se publiquen.',
    faqToggle: 'Acerca de las firmas de peticiones',
    faqPrivacy: 'Solo los administradores pueden ver los nombres de quienes firman; el recuento público nunca revela quién firmó.',
    faqWithdraw: 'Puedes retirar tu firma en cualquier momento, hasta que la persona organizadora exporte la lista de firmas; después las firmas son definitivas.',
    faqVerified: '«Firma verificada de apoyo» significa que tu firma queda registrada con una marca de tiempo segura.',
    guestPrompt: 'Crea una cuenta gratuita para añadir tu firma verificada de apoyo a las peticiones',
    signInPrompt: 'Inicia sesión para añadir tu firma verificada de apoyo a cualquier petición.',
    signedEmptyTitle: 'Aún no has firmado peticiones',
    signedEmptyBody: 'Las peticiones que firmes aparecerán aquí.',
    errLoadFailed: 'No se pudieron cargar las peticiones. Inténtalo de nuevo.',
    errSignFailed: 'No se pudo añadir tu firma. Inténtalo de nuevo.',
    errAccountRequired: 'Inicia sesión con una cuenta para añadir tu firma verificada de apoyo.',
    errAffirmationRequired: 'Debes confirmar para añadir tu firma verificada de apoyo.',
    errWithdrawLocked: 'Las firmas son definitivas: la persona organizadora ya exportó esta lista.',
    errWithdrawFailed: 'No se pudo retirar tu firma. Inténtalo de nuevo.',
  },
  // machine-drafted, needs native review
  ht: {
    catLandRights: 'Dwa sou tè',
    catInfrastructure: 'Enfrastrikti',
    catHousing: 'Lojman',
    catFoodAccess: 'Aksè a manje',
    catHealthcare: 'Swen sante',
    catEducation: 'Edikasyon',
    catEnvironment: 'Anviwònman',
    catCivilRights: 'Dwa sivil',
    catCommunity: 'Kominote',
    title: 'Petisyon kominote a',
    tabsLabel: 'Fason pou wè petisyon yo',
    tabAll: 'Tout petisyon yo',
    tabSigned: 'Sa m siyen yo',
    progressLabel: 'Pwogrè siyati yo',
    signed: 'Siyen',
    signaturesFinal: 'Siyati yo definitif (lis la deja ekspòte).',
    withdraw: 'Retire siyati mwen',
    sign: 'Ajoute siyati verifye pou sipò ou',
    actionForPetitionAria: '{action}: {title}',
    signingAs: 'W ap siyen kòm {name}',
    retentionNotice: 'Non ou, dat la ak yon dosye sou vèsyon petisyon sa a rete kòm siyati verifye pou sipò ou.',
    loading: 'N ap chaje petisyon yo…',
    tryAgain: 'Eseye ankò',
    emptyTitle: 'Pa gen petisyon aktif',
    emptyBody: 'Petisyon kominote a ap parèt isit la lè yo pibliye.',
    faqToggle: 'Konsènan siyati petisyon yo',
    faqPrivacy: 'Se administratè yo sèlman ki ka wè non moun ki siyen yo; kantite piblik la pa janm montre kiyès ki siyen.',
    faqWithdraw: 'Ou ka retire siyati ou nenpòt lè, jiskaske òganizatè a ekspòte lis siyati yo; apre sa, siyati yo vin definitif.',
    faqVerified: '« Siyati verifye pou sipò » vle di siyati ou anrejistre ak yon mak tan ki an sekirite.',
    guestPrompt: 'Kreye yon kont gratis pou w ajoute siyati verifye pou sipò ou nan petisyon yo',
    signInPrompt: 'Konekte pou w ajoute siyati verifye pou sipò ou nan nenpòt petisyon.',
    signedEmptyTitle: 'Ou poko siyen okenn petisyon',
    signedEmptyBody: 'Petisyon ou siyen yo ap parèt isit la.',
    errLoadFailed: 'Nou pa kapab chaje petisyon yo. Tanpri eseye ankò.',
    errSignFailed: 'Nou pa kapab ajoute siyati ou. Tanpri eseye ankò.',
    errAccountRequired: 'Konekte ak yon kont pou w ajoute siyati verifye pou sipò ou.',
    errAffirmationRequired: 'Ou dwe konfime pou w ajoute siyati verifye pou sipò ou.',
    errWithdrawLocked: 'Siyati yo definitif: òganizatè a deja ekspòte lis sa a.',
    errWithdrawFailed: 'Nou pa kapab retire siyati ou. Tanpri eseye ankò.',
  },
  vi: {
    catLandRights: 'Quyền đất đai',
    catInfrastructure: 'Cơ sở hạ tầng',
    catHousing: 'Nhà ở',
    catFoodAccess: 'Tiếp cận thực phẩm',
    catHealthcare: 'Y tế',
    catEducation: 'Giáo dục',
    catEnvironment: 'Môi trường',
    catCivilRights: 'Quyền công dân',
    catCommunity: 'Cộng đồng',
    title: 'Kiến nghị cộng đồng',
    tabsLabel: 'Chế độ xem kiến nghị',
    tabAll: 'Tất cả kiến nghị',
    tabSigned: 'Đã ký',
    progressLabel: 'Tiến độ chữ ký',
    signed: 'Đã ký',
    signaturesFinal: 'Chữ ký không thể thay đổi nữa (danh sách đã được xuất).',
    withdraw: 'Rút chữ ký của tôi',
    sign: 'Thêm chữ ký ủng hộ đã xác minh của bạn',
    actionForPetitionAria: '{action}: {title}',
    signingAs: 'Ký với tên {name}',
    retentionNotice: 'Tên của bạn, ngày ký và bản ghi về phiên bản kiến nghị này được lưu làm chữ ký ủng hộ đã xác minh của bạn.',
    loading: 'Đang tải kiến nghị…',
    tryAgain: 'Thử lại',
    emptyTitle: 'Không có kiến nghị nào đang mở',
    emptyBody: 'Kiến nghị cộng đồng sẽ xuất hiện ở đây khi được đăng.',
    faqToggle: 'Về chữ ký kiến nghị',
    faqPrivacy: 'Chỉ quản trị viên mới thấy tên người ký; số đếm công khai không bao giờ cho biết ai đã ký.',
    faqWithdraw: 'Bạn có thể rút chữ ký bất cứ lúc nào, cho đến khi người tổ chức xuất danh sách chữ ký; sau đó chữ ký không thể thay đổi nữa.',
    faqVerified: '“Chữ ký ủng hộ đã xác minh” nghĩa là chữ ký của bạn được ghi lại kèm dấu thời gian an toàn.',
    guestPrompt: 'Tạo tài khoản miễn phí để thêm chữ ký ủng hộ đã xác minh của bạn vào các kiến nghị',
    signInPrompt: 'Đăng nhập để thêm chữ ký ủng hộ đã xác minh của bạn vào bất kỳ kiến nghị nào.',
    signedEmptyTitle: 'Chưa ký kiến nghị nào',
    signedEmptyBody: 'Các kiến nghị bạn ký sẽ xuất hiện ở đây.',
    errLoadFailed: 'Không thể tải kiến nghị. Vui lòng thử lại.',
    errSignFailed: 'Không thể thêm chữ ký của bạn. Vui lòng thử lại.',
    errAccountRequired: 'Hãy đăng nhập bằng tài khoản để thêm chữ ký ủng hộ đã xác minh của bạn.',
    errAffirmationRequired: 'Bạn cần xác nhận để thêm chữ ký ủng hộ đã xác minh của mình.',
    errWithdrawLocked: 'Chữ ký không thể thay đổi nữa: người tổ chức đã xuất danh sách này.',
    errWithdrawFailed: 'Không thể rút chữ ký của bạn. Vui lòng thử lại.',
  },
  ar: {
    catLandRights: 'حقوق الأراضي',
    catInfrastructure: 'البنية التحتية',
    catHousing: 'السكن',
    catFoodAccess: 'الحصول على الغذاء',
    catHealthcare: 'الرعاية الصحية',
    catEducation: 'التعليم',
    catEnvironment: 'البيئة',
    catCivilRights: 'الحقوق المدنية',
    catCommunity: 'المجتمع',
    title: 'عرائض المجتمع',
    tabsLabel: 'عرض العرائض',
    tabAll: 'كل العرائض',
    tabSigned: 'الموقَّعة',
    progressLabel: 'تقدّم التوقيعات',
    signed: 'تم التوقيع',
    signaturesFinal: 'التوقيعات نهائية (تم تصدير القائمة).',
    withdraw: 'سحب توقيعي',
    sign: 'أضف توقيع الدعم المؤكَّد الخاص بك',
    actionForPetitionAria: '{action}: {title}',
    signingAs: 'التوقيع باسم {name}',
    retentionNotice: 'يُحفظ اسمك والتاريخ وسجل لهذه النسخة من العريضة بوصفها توقيع الدعم المؤكَّد الخاص بك.',
    loading: 'جارٍ تحميل العرائض…',
    tryAgain: 'حاول مرة أخرى',
    emptyTitle: 'لا توجد عرائض نشطة',
    emptyBody: 'ستظهر عرائض المجتمع هنا عند نشرها.',
    faqToggle: 'حول توقيعات العرائض',
    faqPrivacy: 'المشرفون وحدهم يرون أسماء الموقِّعين؛ والعدد المعلن لا يكشف أبدًا من وقَّع.',
    faqWithdraw: 'يمكنك سحب توقيعك في أي وقت، إلى أن يصدِّر المنظِّم قائمة التوقيعات؛ بعدها تصبح التوقيعات نهائية.',
    faqVerified: '«توقيع الدعم المؤكَّد» يعني أن توقيعك يُسجَّل مع طابع زمني آمن.',
    guestPrompt: 'أنشئ حسابًا مجانيًا لتضيف توقيع الدعم المؤكَّد الخاص بك إلى العرائض',
    signInPrompt: 'سجِّل الدخول لتضيف توقيع الدعم المؤكَّد الخاص بك إلى أي عريضة.',
    signedEmptyTitle: 'لم توقِّع أي عريضة بعد',
    signedEmptyBody: 'ستظهر هنا العرائض التي توقِّعها.',
    errLoadFailed: 'تعذّر تحميل العرائض. حاول مرة أخرى.',
    errSignFailed: 'تعذّرت إضافة توقيعك. حاول مرة أخرى.',
    errAccountRequired: 'سجِّل الدخول بحساب لتضيف توقيع الدعم المؤكَّد الخاص بك.',
    errAffirmationRequired: 'عليك التأكيد لتضيف توقيع الدعم المؤكَّد الخاص بك.',
    errWithdrawLocked: 'التوقيعات نهائية: صدَّر المنظِّم هذه القائمة.',
    errWithdrawFailed: 'تعذّر سحب توقيعك. حاول مرة أخرى.',
  },
  zh: {
    catLandRights: '土地权利',
    catInfrastructure: '基础设施',
    catHousing: '住房',
    catFoodAccess: '食物获取',
    catHealthcare: '医疗保健',
    catEducation: '教育',
    catEnvironment: '环境',
    catCivilRights: '公民权利',
    catCommunity: '社区',
    title: '社区请愿',
    tabsLabel: '请愿视图',
    tabAll: '全部请愿',
    tabSigned: '已签名',
    progressLabel: '签名进度',
    signed: '已签名',
    signaturesFinal: '签名已不可更改（名单已导出）。',
    withdraw: '撤回我的签名',
    sign: '添加您的经验证的支持签名',
    actionForPetitionAria: '{action}：{title}',
    signingAs: '以 {name} 的名义签名',
    retentionNotice: '您的姓名、日期以及此请愿版本的记录将作为您的经验证的支持签名保存。',
    loading: '正在加载请愿…',
    tryAgain: '重试',
    emptyTitle: '暂无进行中的请愿',
    emptyBody: '社区请愿发布后会显示在这里。',
    faqToggle: '关于请愿签名',
    faqPrivacy: '只有管理员可以看到签名者的姓名；公开的计数不会显示谁签了名。',
    faqWithdraw: '在组织者导出签名名单之前，您可以随时撤回签名；导出之后签名不可更改。',
    faqVerified: '“经验证的支持签名”是指您的签名连同安全时间戳一起被记录。',
    guestPrompt: '创建免费账户，即可为请愿添加您的经验证的支持签名',
    signInPrompt: '登录后即可为任何请愿添加您的经验证的支持签名。',
    signedEmptyTitle: '尚未签署任何请愿',
    signedEmptyBody: '您签署的请愿会显示在这里。',
    errLoadFailed: '无法加载请愿。请重试。',
    errSignFailed: '无法添加您的签名。请重试。',
    errAccountRequired: '请使用账户登录，以添加您的经验证的支持签名。',
    errAffirmationRequired: '您需要确认后才能添加您的经验证的支持签名。',
    errWithdrawLocked: '签名已不可更改：组织者已导出此名单。',
    errWithdrawFailed: '无法撤回您的签名。请重试。',
  },
  // machine-drafted, needs native review
  so: {
    catLandRights: 'Xuquuqda dhulka',
    catInfrastructure: 'Kaabayaasha',
    catHousing: 'Guriyeyn',
    catFoodAccess: 'Helitaanka cuntada',
    catHealthcare: 'Daryeel caafimaad',
    catEducation: 'Waxbarasho',
    catEnvironment: 'Deegaanka',
    catCivilRights: 'Xuquuqda madaniga',
    catCommunity: 'Bulsho',
    title: 'Codsiyada bulshada',
    tabsLabel: 'Muuqaalka codsiyada',
    tabAll: 'Dhammaan codsiyada',
    tabSigned: 'Kuwa la saxiixay',
    progressLabel: 'Horumarka saxiixyada',
    signed: 'Waa la saxiixay',
    signaturesFinal: 'Saxiixyadu waa kama dambays (liiska waa la soo dejiyay).',
    withdraw: 'Ka noqo saxiixayga',
    sign: 'Ku dar saxiixaaga taageerada ee la xaqiijiyay',
    actionForPetitionAria: '{action}: {title}',
    signingAs: 'Waxaad u saxiixaysaa magaca {name}',
    retentionNotice: 'Magacaaga, taariikhda iyo diiwaanka nuqulkan codsiga waxaa loo kaydiyaa sidii saxiixaaga taageerada ee la xaqiijiyay.',
    loading: 'Codsiyada waa la soo shubayaa…',
    tryAgain: 'Isku day mar kale',
    emptyTitle: 'Ma jiraan codsiyo firfircoon',
    emptyBody: 'Codsiyada bulshadu halkan ayay ka soo muuqan doonaan marka la daabaco.',
    faqToggle: 'Ku saabsan saxiixyada codsiyada',
    faqPrivacy: 'Maamulayaasha oo keliya ayaa arki kara magacyada dadka saxiixay; tirada dadweynaha u muuqata weligeed ma muujiso cidda saxiixday.',
    faqWithdraw: 'Waad ka noqon kartaa saxiixaaga wakhti kasta, ilaa qabanqaabiyuhu soo dejiyo liiska saxiixyada; intaas ka dib saxiixyadu waa kama dambays.',
    faqVerified: '“Saxiix taageero oo la xaqiijiyay” waxay ka dhigan tahay in saxiixaaga lagu diiwaangeliyo shaabad waqti oo ammaan ah.',
    guestPrompt: 'Samee akoon bilaash ah si aad codsiyada ugu darto saxiixaaga taageerada ee la xaqiijiyay',
    signInPrompt: 'Soo gal si aad codsi kasta ugu darto saxiixaaga taageerada ee la xaqiijiyay.',
    signedEmptyTitle: 'Weli ma saxiixin wax codsi ah',
    signedEmptyBody: 'Codsiyada aad saxiixdo halkan ayay ka soo muuqan doonaan.',
    errLoadFailed: 'Lama soo shubi karo codsiyada. Fadlan isku day mar kale.',
    errSignFailed: 'Lama dari karo saxiixaaga. Fadlan isku day mar kale.',
    errAccountRequired: 'Ku soo gal akoon si aad ugu darto saxiixaaga taageerada ee la xaqiijiyay.',
    errAffirmationRequired: 'Waa inaad xaqiijisaa si aad ugu darto saxiixaaga taageerada ee la xaqiijiyay.',
    errWithdrawLocked: 'Saxiixyadu waa kama dambays: qabanqaabiyuhu wuu soo dejiyay liiskan.',
    errWithdrawFailed: 'Lagama noqon karo saxiixaaga. Fadlan isku day mar kale.',
  },
  fr: {
    catLandRights: 'Droits fonciers',
    catInfrastructure: 'Infrastructures',
    catHousing: 'Logement',
    catFoodAccess: 'Accès à l’alimentation',
    catHealthcare: 'Santé',
    catEducation: 'Éducation',
    catEnvironment: 'Environnement',
    catCivilRights: 'Droits civiques',
    catCommunity: 'Communauté',
    title: 'Pétitions de la communauté',
    tabsLabel: 'Affichage des pétitions',
    tabAll: 'Toutes les pétitions',
    tabSigned: 'Signées',
    progressLabel: 'Progression des signatures',
    signed: 'Signée',
    signaturesFinal: 'Les signatures sont définitives (la liste a été exportée).',
    withdraw: 'Retirer ma signature',
    sign: 'Ajoutez votre signature de soutien vérifiée',
    actionForPetitionAria: '{action} : {title}',
    signingAs: 'Vous signez en tant que {name}',
    retentionNotice: 'Votre nom, la date et une trace de cette version de la pétition sont conservés comme votre signature de soutien vérifiée.',
    loading: 'Chargement des pétitions…',
    tryAgain: 'Réessayer',
    emptyTitle: 'Aucune pétition en cours',
    emptyBody: 'Les pétitions de la communauté apparaîtront ici dès leur publication.',
    faqToggle: 'À propos des signatures de pétitions',
    faqPrivacy: 'Seuls les administrateurs voient les noms des signataires ; le compteur public ne révèle jamais qui a signé.',
    faqWithdraw: 'Vous pouvez retirer votre signature à tout moment, jusqu’à ce que l’organisateur exporte la liste des signatures ; ensuite, les signatures sont définitives.',
    faqVerified: '« Signature de soutien vérifiée » signifie que votre signature est enregistrée avec un horodatage sécurisé.',
    guestPrompt: 'Créez un compte gratuit pour ajouter votre signature de soutien vérifiée aux pétitions',
    signInPrompt: 'Connectez-vous pour ajouter votre signature de soutien vérifiée à n’importe quelle pétition.',
    signedEmptyTitle: 'Aucune pétition signée pour le moment',
    signedEmptyBody: 'Les pétitions que vous signez apparaîtront ici.',
    errLoadFailed: 'Impossible de charger les pétitions. Veuillez réessayer.',
    errSignFailed: 'Impossible d’ajouter votre signature. Veuillez réessayer.',
    errAccountRequired: 'Connectez-vous avec un compte pour ajouter votre signature de soutien vérifiée.',
    errAffirmationRequired: 'Vous devez confirmer pour ajouter votre signature de soutien vérifiée.',
    errWithdrawLocked: 'Les signatures sont définitives : l’organisateur a exporté cette liste.',
    errWithdrawFailed: 'Impossible de retirer votre signature. Veuillez réessayer.',
  },
  pt: {
    catLandRights: 'Direitos à terra',
    catInfrastructure: 'Infraestrutura',
    catHousing: 'Moradia',
    catFoodAccess: 'Acesso a alimentos',
    catHealthcare: 'Saúde',
    catEducation: 'Educação',
    catEnvironment: 'Meio ambiente',
    catCivilRights: 'Direitos civis',
    catCommunity: 'Comunidade',
    title: 'Petições da comunidade',
    tabsLabel: 'Visualização das petições',
    tabAll: 'Todas as petições',
    tabSigned: 'Assinadas',
    progressLabel: 'Progresso das assinaturas',
    signed: 'Assinada',
    signaturesFinal: 'As assinaturas são definitivas (a lista foi exportada).',
    withdraw: 'Retirar minha assinatura',
    sign: 'Adicione sua assinatura de apoio verificada',
    actionForPetitionAria: '{action}: {title}',
    signingAs: 'Assinando como {name}',
    retentionNotice: 'Seu nome, a data e um registro desta versão da petição são guardados como sua assinatura de apoio verificada.',
    loading: 'Carregando petições…',
    tryAgain: 'Tentar novamente',
    emptyTitle: 'Nenhuma petição ativa',
    emptyBody: 'As petições da comunidade aparecerão aqui quando forem publicadas.',
    faqToggle: 'Sobre as assinaturas de petições',
    faqPrivacy: 'Somente administradores veem os nomes de quem assinou; a contagem pública nunca revela quem assinou.',
    faqWithdraw: 'Você pode retirar sua assinatura a qualquer momento, até que a pessoa organizadora exporte a lista de assinaturas; depois disso as assinaturas são definitivas.',
    faqVerified: '“Assinatura de apoio verificada” significa que sua assinatura é registrada com um carimbo de data e hora seguro.',
    guestPrompt: 'Crie uma conta gratuita para adicionar sua assinatura de apoio verificada às petições',
    signInPrompt: 'Entre para adicionar sua assinatura de apoio verificada a qualquer petição.',
    signedEmptyTitle: 'Nenhuma petição assinada ainda',
    signedEmptyBody: 'As petições que você assinar aparecerão aqui.',
    errLoadFailed: 'Não foi possível carregar as petições. Tente novamente.',
    errSignFailed: 'Não foi possível adicionar sua assinatura. Tente novamente.',
    errAccountRequired: 'Entre com uma conta para adicionar sua assinatura de apoio verificada.',
    errAffirmationRequired: 'Você precisa confirmar para adicionar sua assinatura de apoio verificada.',
    errWithdrawLocked: 'As assinaturas são definitivas: a pessoa organizadora exportou esta lista.',
    errWithdrawFailed: 'Não foi possível retirar sua assinatura. Tente novamente.',
  },
  ru: {
    catLandRights: 'Права на землю',
    catInfrastructure: 'Инфраструктура',
    catHousing: 'Жильё',
    catFoodAccess: 'Доступ к продуктам',
    catHealthcare: 'Здравоохранение',
    catEducation: 'Образование',
    catEnvironment: 'Окружающая среда',
    catCivilRights: 'Гражданские права',
    catCommunity: 'Сообщество',
    title: 'Петиции сообщества',
    tabsLabel: 'Вид списка петиций',
    tabAll: 'Все петиции',
    tabSigned: 'Подписанные',
    progressLabel: 'Сбор подписей',
    signed: 'Подписано',
    signaturesFinal: 'Подписи окончательны (список уже выгружен).',
    withdraw: 'Отозвать мою подпись',
    sign: 'Добавьте свою подтверждённую подпись в поддержку',
    actionForPetitionAria: '{action}: {title}',
    signingAs: 'Вы подписываете как {name}',
    retentionNotice: 'Ваше имя, дата и запись об этой версии петиции сохраняются как ваша подтверждённая подпись в поддержку.',
    loading: 'Загрузка петиций…',
    tryAgain: 'Повторить',
    emptyTitle: 'Активных петиций нет',
    emptyBody: 'Петиции сообщества появятся здесь после публикации.',
    faqToggle: 'О подписях под петициями',
    faqPrivacy: 'Имена подписавших видят только администраторы; общедоступный счётчик никогда не показывает, кто подписал.',
    faqWithdraw: 'Вы можете отозвать подпись в любое время, пока организатор не выгрузит список подписей; после этого подписи окончательны.',
    faqVerified: '«Подтверждённая подпись в поддержку» означает, что ваша подпись записана с защищённой отметкой времени.',
    guestPrompt: 'Создайте бесплатную учётную запись, чтобы добавить свою подтверждённую подпись в поддержку петиций',
    signInPrompt: 'Войдите, чтобы добавить свою подтверждённую подпись в поддержку любой петиции.',
    signedEmptyTitle: 'Вы пока не подписали ни одной петиции',
    signedEmptyBody: 'Подписанные вами петиции появятся здесь.',
    errLoadFailed: 'Не удалось загрузить петиции. Повторите попытку.',
    errSignFailed: 'Не удалось добавить вашу подпись. Повторите попытку.',
    errAccountRequired: 'Войдите в учётную запись, чтобы добавить свою подтверждённую подпись в поддержку.',
    errAffirmationRequired: 'Чтобы добавить свою подтверждённую подпись в поддержку, нужно подтвердить согласие.',
    errWithdrawLocked: 'Подписи окончательны: организатор уже выгрузил этот список.',
    errWithdrawFailed: 'Не удалось отозвать вашу подпись. Повторите попытку.',
  },
  ko: {
    catLandRights: '토지 권리',
    catInfrastructure: '기반 시설',
    catHousing: '주거',
    catFoodAccess: '식품 접근',
    catHealthcare: '의료',
    catEducation: '교육',
    catEnvironment: '환경',
    catCivilRights: '시민권',
    catCommunity: '지역 사회',
    title: '커뮤니티 청원',
    tabsLabel: '청원 보기',
    tabAll: '모든 청원',
    tabSigned: '서명한 청원',
    progressLabel: '서명 진행 상황',
    signed: '서명함',
    signaturesFinal: '서명이 확정되었습니다(명단이 내보내졌습니다).',
    withdraw: '내 서명 철회',
    sign: '확인된 지지 서명 추가하기',
    actionForPetitionAria: '{action}: {title}',
    signingAs: '{name} 이름으로 서명합니다',
    retentionNotice: '이름, 날짜, 이 청원 버전의 기록이 회원님의 확인된 지지 서명으로 보관됩니다.',
    loading: '청원을 불러오는 중…',
    tryAgain: '다시 시도',
    emptyTitle: '진행 중인 청원이 없습니다',
    emptyBody: '커뮤니티 청원이 게시되면 여기에 표시됩니다.',
    faqToggle: '청원 서명 안내',
    faqPrivacy: '서명자의 이름은 관리자만 볼 수 있으며, 공개되는 수치로는 누가 서명했는지 알 수 없습니다.',
    faqWithdraw: '주최자가 서명 명단을 내보내기 전까지는 언제든지 서명을 철회할 수 있으며, 그 후에는 서명이 확정됩니다.',
    faqVerified: '“확인된 지지 서명”이란 회원님의 서명이 안전한 타임스탬프와 함께 기록된다는 뜻입니다.',
    guestPrompt: '무료 계정을 만들어 청원에 확인된 지지 서명을 추가하세요',
    signInPrompt: '로그인하면 어떤 청원에든 확인된 지지 서명을 추가할 수 있습니다.',
    signedEmptyTitle: '아직 서명한 청원이 없습니다',
    signedEmptyBody: '서명한 청원이 여기에 표시됩니다.',
    errLoadFailed: '청원을 불러올 수 없습니다. 다시 시도해 주세요.',
    errSignFailed: '서명을 추가할 수 없습니다. 다시 시도해 주세요.',
    errAccountRequired: '확인된 지지 서명을 추가하려면 계정으로 로그인하세요.',
    errAffirmationRequired: '확인된 지지 서명을 추가하려면 동의 확인이 필요합니다.',
    errWithdrawLocked: '서명이 확정되었습니다. 주최자가 이 명단을 내보냈습니다.',
    errWithdrawFailed: '서명을 철회할 수 없습니다. 다시 시도해 주세요.',
  },
  tl: {
    catLandRights: 'Karapatan sa lupa',
    catInfrastructure: 'Imprastraktura',
    catHousing: 'Pabahay',
    catFoodAccess: 'Access sa pagkain',
    catHealthcare: 'Pangangalagang pangkalusugan',
    catEducation: 'Edukasyon',
    catEnvironment: 'Kapaligiran',
    catCivilRights: 'Karapatang sibil',
    catCommunity: 'Komunidad',
    title: 'Mga petisyon ng komunidad',
    tabsLabel: 'View ng mga petisyon',
    tabAll: 'Lahat ng petisyon',
    tabSigned: 'Mga nilagdaan',
    progressLabel: 'Progreso ng mga lagda',
    signed: 'Nilagdaan',
    signaturesFinal: 'Pinal na ang mga lagda (na-export na ang listahan).',
    withdraw: 'Bawiin ang aking lagda',
    sign: 'Idagdag ang iyong beripikadong lagda ng suporta',
    actionForPetitionAria: '{action}: {title}',
    signingAs: 'Lumalagda bilang {name}',
    retentionNotice: 'Ang iyong pangalan, ang petsa, at isang tala ng bersyong ito ng petisyon ay itinatago bilang iyong beripikadong lagda ng suporta.',
    loading: 'Nilo-load ang mga petisyon…',
    tryAgain: 'Subukang muli',
    emptyTitle: 'Walang aktibong petisyon',
    emptyBody: 'Lalabas dito ang mga petisyon ng komunidad kapag nailathala.',
    faqToggle: 'Tungkol sa mga lagda sa petisyon',
    faqPrivacy: 'Mga administrator lang ang nakakakita ng pangalan ng mga lumagda; hindi kailanman ipinapakita ng pampublikong bilang kung sino ang lumagda.',
    faqWithdraw: 'Maaari mong bawiin ang iyong lagda anumang oras, hanggang i-export ng organizer ang listahan ng mga lagda; pagkatapos nito, pinal na ang mga lagda.',
    faqVerified: 'Ang “beripikadong lagda ng suporta” ay nangangahulugang naitala ang iyong lagda na may ligtas na timestamp.',
    guestPrompt: 'Gumawa ng libreng account para maidagdag ang iyong beripikadong lagda ng suporta sa mga petisyon',
    signInPrompt: 'Mag-sign in para maidagdag ang iyong beripikadong lagda ng suporta sa anumang petisyon.',
    signedEmptyTitle: 'Wala ka pang nilalagdaang petisyon',
    signedEmptyBody: 'Lalabas dito ang mga petisyong lalagdaan mo.',
    errLoadFailed: 'Hindi ma-load ang mga petisyon. Pakisubukang muli.',
    errSignFailed: 'Hindi maidagdag ang iyong lagda. Pakisubukang muli.',
    errAccountRequired: 'Mag-sign in gamit ang isang account para maidagdag ang iyong beripikadong lagda ng suporta.',
    errAffirmationRequired: 'Kailangan mong kumpirmahin para maidagdag ang iyong beripikadong lagda ng suporta.',
    errWithdrawLocked: 'Pinal na ang mga lagda: na-export na ng organizer ang listahang ito.',
    errWithdrawFailed: 'Hindi mabawi ang iyong lagda. Pakisubukang muli.',
  },
  // machine-drafted, needs native review
  am: {
    catLandRights: 'የመሬት መብቶች',
    catInfrastructure: 'መሠረተ ልማት',
    catHousing: 'መኖሪያ ቤት',
    catFoodAccess: 'የምግብ አቅርቦት',
    catHealthcare: 'የጤና እንክብካቤ',
    catEducation: 'ትምህርት',
    catEnvironment: 'አካባቢ',
    catCivilRights: 'የዜጎች መብቶች',
    catCommunity: 'ማኅበረሰብ',
    title: 'የማኅበረሰብ አቤቱታዎች',
    tabsLabel: 'የአቤቱታዎች እይታ',
    tabAll: 'ሁሉም አቤቱታዎች',
    tabSigned: 'የተፈረሙ',
    progressLabel: 'የፊርማዎች ሂደት',
    signed: 'ተፈርሟል',
    signaturesFinal: 'ፊርማዎቹ የመጨረሻ ናቸው (ዝርዝሩ ወጥቷል)።',
    withdraw: 'ፊርማዬን አንሳ',
    sign: 'የተረጋገጠ የድጋፍ ፊርማዎን ያክሉ',
    actionForPetitionAria: '{action}፦ {title}',
    signingAs: 'በ{name} ስም እየፈረሙ ነው',
    retentionNotice: 'ስምዎ፣ ቀኑ እና የዚህ አቤቱታ እትም መዝገብ እንደ የተረጋገጠ የድጋፍ ፊርማዎ ይቀመጣሉ።',
    loading: 'አቤቱታዎች በመጫን ላይ…',
    tryAgain: 'እንደገና ይሞክሩ',
    emptyTitle: 'ንቁ አቤቱታዎች የሉም',
    emptyBody: 'የማኅበረሰብ አቤቱታዎች ሲታተሙ እዚህ ይታያሉ።',
    faqToggle: 'ስለ አቤቱታ ፊርማዎች',
    faqPrivacy: 'የፈራሚዎችን ስም ማየት የሚችሉት አስተዳዳሪዎች ብቻ ናቸው፤ ለሕዝብ የሚታየው ቁጥር ማን እንደፈረመ ፈጽሞ አያሳይም።',
    faqWithdraw: 'አዘጋጁ የፊርማዎችን ዝርዝር እስኪያወጣ ድረስ ፊርማዎን በማንኛውም ጊዜ ማንሳት ይችላሉ፤ ከዚያ በኋላ ፊርማዎች የመጨረሻ ይሆናሉ።',
    faqVerified: '“የተረጋገጠ የድጋፍ ፊርማ” ማለት ፊርማዎ ከአስተማማኝ የጊዜ ማህተም ጋር ተመዝግቧል ማለት ነው።',
    guestPrompt: 'የተረጋገጠ የድጋፍ ፊርማዎን በአቤቱታዎች ላይ ለማከል ነፃ መለያ ይፍጠሩ',
    signInPrompt: 'የተረጋገጠ የድጋፍ ፊርማዎን በማንኛውም አቤቱታ ላይ ለማከል ይግቡ።',
    signedEmptyTitle: 'እስካሁን የፈረሙት አቤቱታ የለም',
    signedEmptyBody: 'የሚፈርሟቸው አቤቱታዎች እዚህ ይታያሉ።',
    errLoadFailed: 'አቤቱታዎችን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
    errSignFailed: 'ፊርማዎን ማከል አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
    errAccountRequired: 'የተረጋገጠ የድጋፍ ፊርማዎን ለማከል በመለያ ይግቡ።',
    errAffirmationRequired: 'የተረጋገጠ የድጋፍ ፊርማዎን ለማከል ማረጋገጥ አለብዎት።',
    errWithdrawLocked: 'ፊርማዎቹ የመጨረሻ ናቸው፦ አዘጋጁ ይህን ዝርዝር አውጥቷል።',
    errWithdrawFailed: 'ፊርማዎን ማንሳት አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
  },
  // machine-drafted, needs native review
  hmn: {
    catLandRights: 'Cai txog av',
    catInfrastructure: 'Kev tsim kho vaj tse thiab kev',
    catHousing: 'Vaj tse',
    catFoodAccess: 'Kev tau txais zaub mov',
    catHealthcare: 'Kev kho mob',
    catEducation: 'Kev kawm',
    catEnvironment: 'Ib puag ncig',
    catCivilRights: 'Pej xeem txoj cai',
    catCommunity: 'Zej zog',
    title: 'Zej zog cov ntawv thov',
    tabsLabel: 'Saib cov ntawv thov',
    tabAll: 'Tag nrho cov ntawv thov',
    tabSigned: 'Cov uas tau kos npe',
    progressLabel: 'Kev nce qib ntawm cov kos npe',
    signed: 'Tau kos npe lawm',
    signaturesFinal: 'Cov kos npe hloov tsis tau lawm (daim npe twb raug rho tawm lawm).',
    withdraw: 'Thim kuv qhov kos npe',
    sign: 'Ntxiv koj qhov kos npe txhawb nqa uas tau txheeb xyuas',
    actionForPetitionAria: '{action}: {title}',
    signingAs: 'Koj kos npe ua {name}',
    retentionNotice: 'Koj lub npe, hnub tim thiab ib daim ntawv teev txog tsab ntawv thov no raug khaws ua koj qhov kos npe txhawb nqa uas tau txheeb xyuas.',
    loading: 'Tab tom thauj cov ntawv thov…',
    tryAgain: 'Sim dua',
    emptyTitle: 'Tsis muaj ntawv thov uas tseem qhib',
    emptyBody: 'Zej zog cov ntawv thov yuav tshwm ntawm no thaum muab tshaj tawm.',
    faqToggle: 'Hais txog cov kos npe rau ntawv thov',
    faqPrivacy: 'Tsuas yog cov thawj tswj thiaj pom cov neeg kos npe lub npe; tus lej uas pej xeem pom yeej tsis qhia tias leej twg tau kos npe.',
    faqWithdraw: 'Koj thim tau koj qhov kos npe txhua lub sij hawm, mus txog thaum tus neeg npaj rho daim npe kos npe tawm; tom qab ntawd cov kos npe hloov tsis tau lawm.',
    faqVerified: '“Kos npe txhawb nqa uas tau txheeb xyuas” txhais tias koj qhov kos npe raug sau tseg nrog lub sij hawm uas ruaj ntseg.',
    guestPrompt: 'Tsim ib tus account dawb los ntxiv koj qhov kos npe txhawb nqa uas tau txheeb xyuas rau cov ntawv thov',
    signInPrompt: 'Nkag mus los ntxiv koj qhov kos npe txhawb nqa uas tau txheeb xyuas rau txhua daim ntawv thov.',
    signedEmptyTitle: 'Koj tseem tsis tau kos npe rau ib daim ntawv thov',
    signedEmptyBody: 'Cov ntawv thov uas koj kos npe yuav tshwm ntawm no.',
    errLoadFailed: 'Thauj tsis tau cov ntawv thov. Thov sim dua.',
    errSignFailed: 'Ntxiv tsis tau koj qhov kos npe. Thov sim dua.',
    errAccountRequired: 'Nkag mus nrog ib tus account los ntxiv koj qhov kos npe txhawb nqa uas tau txheeb xyuas.',
    errAffirmationRequired: 'Koj yuav tsum lees paub thiaj ntxiv tau koj qhov kos npe txhawb nqa uas tau txheeb xyuas.',
    errWithdrawLocked: 'Cov kos npe hloov tsis tau lawm: tus neeg npaj twb rho daim npe no tawm lawm.',
    errWithdrawFailed: 'Thim tsis tau koj qhov kos npe. Thov sim dua.',
  },
}

export function petitionsT(locale: Locale, key: keyof FeedPetitionsMessages): string {
  return translate(feedPetitionsMessages, locale, key)
}

// ---------------------------------------------------------------------------
// Counts — "{count} of {target} signatures" and "{count} verified signatures"
// ---------------------------------------------------------------------------

/** Toward a target, chosen by the TARGET's plural form: "12 of 100 signatures". */
export const SIGNATURES_OF_TARGET: Record<Locale, PluralForms> = {
  en: { one: '{count} of {target} signature', other: '{count} of {target} signatures' },
  es: { one: '{count} de {target} firma', other: '{count} de {target} firmas' },
  ht: { other: '{count} sou {target} siyati' },
  vi: { other: '{count} trên {target} chữ ký' },
  ar: {
    zero: '{count} من {target} توقيع',
    one: '{count} من {target} توقيع',
    two: '{count} من {target} توقيعين',
    few: '{count} من {target} توقيعات',
    many: '{count} من {target} توقيعًا',
    other: '{count} من {target} توقيع',
  },
  zh: { other: '{count} / {target} 个签名' },
  so: { other: '{count} ka mid ah {target} saxiix' },
  fr: { one: '{count} sur {target} signature', other: '{count} sur {target} signatures' },
  pt: { one: '{count} de {target} assinatura', other: '{count} de {target} assinaturas' },
  ru: {
    one: '{count} из {target} подписи',
    few: '{count} из {target} подписей',
    many: '{count} из {target} подписей',
    other: '{count} из {target} подписи',
  },
  ko: { other: '목표 {target}명 중 {count}명 서명' },
  tl: { other: '{count} sa {target} lagda' },
  am: { one: '{count} ከ{target} ፊርማ', other: '{count} ከ{target} ፊርማዎች' },
  hmn: { other: '{count} ntawm {target} tus kos npe' },
}

/** With no target, chosen by the COUNT's plural form: "12 verified signatures". */
export const VERIFIED_SIGNATURES: Record<Locale, PluralForms> = {
  en: { one: '{count} verified signature', other: '{count} verified signatures' },
  es: { one: '{count} firma verificada', other: '{count} firmas verificadas' },
  ht: { other: '{count} siyati verifye' },
  vi: { other: '{count} chữ ký đã xác minh' },
  ar: {
    zero: '{count} توقيع مؤكَّد',
    one: '{count} توقيع مؤكَّد',
    two: '{count} توقيعان مؤكَّدان',
    few: '{count} توقيعات مؤكَّدة',
    many: '{count} توقيعًا مؤكَّدًا',
    other: '{count} توقيع مؤكَّد',
  },
  zh: { other: '{count} 个经验证的签名' },
  so: { other: '{count} saxiix oo la xaqiijiyay' },
  fr: { one: '{count} signature vérifiée', other: '{count} signatures vérifiées' },
  pt: { one: '{count} assinatura verificada', other: '{count} assinaturas verificadas' },
  ru: {
    one: '{count} подтверждённая подпись',
    few: '{count} подтверждённые подписи',
    many: '{count} подтверждённых подписей',
    other: '{count} подтверждённой подписи',
  },
  ko: { other: '확인된 서명 {count}개' },
  tl: { other: '{count} beripikadong lagda' },
  am: { one: '{count} የተረጋገጠ ፊርማ', other: '{count} የተረጋገጡ ፊርማዎች' },
  hmn: { other: '{count} tus kos npe uas tau txheeb xyuas' },
}

/**
 * The signature line of a petition card, with {count} (and {target}) still to fill: the component
 * keeps the count in its own bold element and splits the sentence around it.
 */
export function signatureCountMessage(count: number, target: number, locale: Locale): string {
  return target > 0
    ? pluralMessage(SIGNATURES_OF_TARGET[locale] ?? SIGNATURES_OF_TARGET.en, target, locale)
    : pluralMessage(VERIFIED_SIGNATURES[locale] ?? VERIFIED_SIGNATURES.en, count, locale)
}

// ---------------------------------------------------------------------------
// Vocabulary — petitions.cause_category
// ---------------------------------------------------------------------------

const CATEGORY_KEYS: Record<string, keyof FeedPetitionsMessages> = {
  land_rights: 'catLandRights',
  infrastructure: 'catInfrastructure',
  housing: 'catHousing',
  food_access: 'catFoodAccess',
  healthcare: 'catHealthcare',
  education: 'catEducation',
  environment: 'catEnvironment',
  civil_rights: 'catCivilRights',
}

/** The known petition categories (the stored cause_category values). */
export const PETITION_CATEGORIES = Object.keys(CATEGORY_KEYS)

/** True when the badge for this value is one of FEED's labels (a missing category reads
 *  "Community"); false when it is the stored value itself, which is English. */
export function isPetitionCategory(category: string | null): boolean {
  return !category || Object.prototype.hasOwnProperty.call(CATEGORY_KEYS, category)
}

/**
 * The category badge in the viewer's language. No category reads "Community". A value this list
 * does not know is shown as stored, with its underscores opened up, as before.
 */
export function petitionCategoryLabel(category: string | null, locale: Locale): string {
  if (!category) return petitionsT(locale, 'catCommunity')
  const key = Object.prototype.hasOwnProperty.call(CATEGORY_KEYS, category) ? CATEGORY_KEYS[category] : undefined
  return key ? petitionsT(locale, key) : category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Codes → sentences (hooks/use-petitions.ts, app/api/petitions/sign/route.ts)
// ---------------------------------------------------------------------------

/** What the hook reports: its own codes and the sign route's `error` codes. */
export type PetitionErrorCode =
  | 'load_failed'
  | 'sign_failed'
  | 'account_required'
  | 'affirmation_required'
  | 'withdraw_locked'
  | 'withdraw_failed'

const ERROR_KEYS: Record<PetitionErrorCode, keyof FeedPetitionsMessages> = {
  load_failed: 'errLoadFailed',
  sign_failed: 'errSignFailed',
  account_required: 'errAccountRequired',
  affirmation_required: 'errAffirmationRequired',
  withdraw_locked: 'errWithdrawLocked',
  withdraw_failed: 'errWithdrawFailed',
}

/** The codes with a sentence of their own. */
export const PETITION_ERROR_CODES = Object.keys(ERROR_KEYS) as PetitionErrorCode[]

/**
 * The sentence for a code, in the viewer's language. Any other code the sign route may send
 * (petition_not_found, unexpected_error, …) reads as the plain signing failure, as it did before.
 */
export function petitionErrorText(code: string, locale: Locale): string {
  const key = Object.prototype.hasOwnProperty.call(ERROR_KEYS, code) ? ERROR_KEYS[code as PetitionErrorCode] : 'errSignFailed'
  return petitionsT(locale, key)
}
