// apps/web/src/lib/i18n-admin-petitions.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The petition signatures download in admin (Moderation › Community,
// app/(admin)/moderation/petition-export-section.tsx), across the 14 locales of lib/i18n.ts. Same
// shape and rules as its siblings: adminPetitionsT(locale, key) with the EN fallback;
// Record<Locale, …> makes a missing locale or key a type error, and i18n-admin-petitions.test.ts
// checks placeholders. A petition signature is a "signature of support" (advocacy), so no value
// speaks of law. ht, so, am and hmn need native review (docs/i18n-native-review.md).

import { translate, type Locale } from './i18n'

export interface AdminPetitionsMessages {
  heading: string
  intro: string
  /** What the file holds and what it leaves out. */
  columnsNote: string
  /** The first download locks withdrawals (petitions.exported_at). */
  lockNote: string
  /** Label of the petition picker. */
  petitionLabel: string
  /** Shown beside the picker when the chosen petition was downloaded before. */
  alreadyLocked: string
  download: string
  downloading: string
  /** {count} = signatures in the file. */
  downloaded: string
  loading: string
  none: string
  loadFailed: string
  errForbidden: string
  errNotFound: string
  errIncomplete: string
  errGeneric: string
}

export const adminPetitionsMessages: Record<Locale, AdminPetitionsMessages> = {
  en: {
    heading: 'Petition signatures',
    intro: 'Download the signatures of a petition as a CSV file for its organizer.',
    columnsNote: 'The file lists each signer’s name, when they signed, the statement they agreed to and the petition version they signed. IP addresses and device details are left out.',
    lockNote: 'The first download locks the list: signers can no longer withdraw their signature from that petition.',
    petitionLabel: 'Petition',
    alreadyLocked: 'Downloaded before — withdrawals are locked.',
    download: 'Download CSV',
    downloading: 'Preparing CSV…',
    downloaded: 'Downloaded. Signatures in the file: {count}',
    loading: 'Loading petitions…',
    none: 'No approved petitions yet.',
    loadFailed: 'Petitions could not be loaded. Try again later.',
    errForbidden: 'Only platform admins can download petition signatures.',
    errNotFound: 'This petition no longer exists or is not approved.',
    errIncomplete: 'Not every signature could be read, so no file was made. Try again.',
    errGeneric: 'The download failed and no file was made. Try again.',
  },
  es: {
    heading: 'Firmas de peticiones',
    intro: 'Descargue las firmas de una petición como archivo CSV para quien la organiza.',
    columnsNote: 'El archivo muestra el nombre de cada firmante, cuándo firmó, la declaración que aceptó y la versión de la petición que firmó. No incluye direcciones IP ni datos del dispositivo.',
    lockNote: 'La primera descarga bloquea la lista: los firmantes ya no pueden retirar su firma de esa petición.',
    petitionLabel: 'Petición',
    alreadyLocked: 'Ya se descargó — los retiros están bloqueados.',
    download: 'Descargar CSV',
    downloading: 'Preparando CSV…',
    downloaded: 'Descargado. Firmas en el archivo: {count}',
    loading: 'Cargando peticiones…',
    none: 'Todavía no hay peticiones aprobadas.',
    loadFailed: 'No se pudieron cargar las peticiones. Inténtelo más tarde.',
    errForbidden: 'Solo los administradores de la plataforma pueden descargar las firmas.',
    errNotFound: 'Esta petición ya no existe o no está aprobada.',
    errIncomplete: 'No se pudieron leer todas las firmas, así que no se creó ningún archivo. Inténtelo de nuevo.',
    errGeneric: 'La descarga falló y no se creó ningún archivo. Inténtelo de nuevo.',
  },
  ht: {
    heading: 'Siyati petisyon yo',
    intro: 'Telechaje siyati yon petisyon nan yon fichye CSV pou moun ki òganize li a.',
    columnsNote: 'Fichye a montre non chak moun ki siyen, ki lè yo siyen, deklarasyon yo te dakò a ak vèsyon petisyon yo te siyen an. Adrès IP ak detay aparèy yo pa ladan l.',
    lockNote: 'Premye telechajman an bloke lis la: moun ki siyen yo pa ka retire siyati yo sou petisyon sa a ankò.',
    petitionLabel: 'Petisyon',
    alreadyLocked: 'Yo te telechaje l deja — retrè yo bloke.',
    download: 'Telechaje CSV',
    downloading: 'N ap prepare CSV a…',
    downloaded: 'Telechaje. Siyati nan fichye a: {count}',
    loading: 'N ap chaje petisyon yo…',
    none: 'Poko gen petisyon ki apwouve.',
    loadFailed: 'Nou pa t ka chaje petisyon yo. Eseye ankò pita.',
    errForbidden: 'Se sèlman administratè platfòm nan ki ka telechaje siyati petisyon yo.',
    errNotFound: 'Petisyon sa a pa egziste ankò oswa li pa apwouve.',
    errIncomplete: 'Nou pa t ka li tout siyati yo, kidonk pa gen fichye ki fèt. Eseye ankò.',
    errGeneric: 'Telechajman an echwe e pa gen fichye ki fèt. Eseye ankò.',
  },
  vi: {
    heading: 'Chữ ký kiến nghị',
    intro: 'Tải xuống chữ ký của một kiến nghị dưới dạng tệp CSV cho người tổ chức.',
    columnsNote: 'Tệp liệt kê tên từng người ký, thời điểm ký, lời cam kết họ đã đồng ý và phiên bản kiến nghị họ đã ký. Không bao gồm địa chỉ IP và thông tin thiết bị.',
    lockNote: 'Lần tải xuống đầu tiên sẽ khóa danh sách: người ký không thể rút chữ ký khỏi kiến nghị đó nữa.',
    petitionLabel: 'Kiến nghị',
    alreadyLocked: 'Đã tải xuống trước đây — việc rút chữ ký đã bị khóa.',
    download: 'Tải xuống CSV',
    downloading: 'Đang chuẩn bị CSV…',
    downloaded: 'Đã tải xuống. Số chữ ký trong tệp: {count}',
    loading: 'Đang tải các kiến nghị…',
    none: 'Chưa có kiến nghị nào được duyệt.',
    loadFailed: 'Không thể tải các kiến nghị. Vui lòng thử lại sau.',
    errForbidden: 'Chỉ quản trị viên nền tảng mới có thể tải xuống chữ ký kiến nghị.',
    errNotFound: 'Kiến nghị này không còn tồn tại hoặc chưa được duyệt.',
    errIncomplete: 'Không đọc được tất cả chữ ký nên không có tệp nào được tạo. Vui lòng thử lại.',
    errGeneric: 'Tải xuống thất bại và không có tệp nào được tạo. Vui lòng thử lại.',
  },
  ar: {
    heading: 'توقيعات العرائض',
    intro: 'نزّل توقيعات عريضة في ملف CSV لمنظّمها.',
    columnsNote: 'يتضمن الملف اسم كل موقّع ووقت توقيعه والإقرار الذي وافق عليه ونسخة العريضة التي وقّعها. لا يتضمن عناوين IP ولا تفاصيل الجهاز.',
    lockNote: 'أول تنزيل يقفل القائمة: لا يعود بإمكان الموقّعين سحب توقيعهم من تلك العريضة.',
    petitionLabel: 'العريضة',
    alreadyLocked: 'نُزّلت من قبل — سحب التوقيعات مقفل.',
    download: 'تنزيل CSV',
    downloading: 'جارٍ تجهيز CSV…',
    downloaded: 'تم التنزيل. عدد التوقيعات في الملف: {count}',
    loading: 'جارٍ تحميل العرائض…',
    none: 'لا توجد عرائض معتمدة بعد.',
    loadFailed: 'تعذّر تحميل العرائض. حاول مرة أخرى لاحقًا.',
    errForbidden: 'لا يمكن تنزيل توقيعات العرائض إلا لمسؤولي المنصة.',
    errNotFound: 'هذه العريضة لم تعد موجودة أو غير معتمدة.',
    errIncomplete: 'تعذّرت قراءة كل التوقيعات، لذا لم يُنشأ أي ملف. حاول مرة أخرى.',
    errGeneric: 'فشل التنزيل ولم يُنشأ أي ملف. حاول مرة أخرى.',
  },
  zh: {
    heading: '请愿签名',
    intro: '将请愿的签名下载为 CSV 文件，交给请愿的组织者。',
    columnsNote: '文件列出每位签名者的姓名、签名时间、其同意的声明以及其签署的请愿版本。不包含 IP 地址和设备信息。',
    lockNote: '首次下载会锁定名单：签名者将无法再撤回对该请愿的签名。',
    petitionLabel: '请愿',
    alreadyLocked: '此前已下载 — 撤回已锁定。',
    download: '下载 CSV',
    downloading: '正在准备 CSV…',
    downloaded: '已下载。文件中的签名数：{count}',
    loading: '正在加载请愿…',
    none: '还没有已批准的请愿。',
    loadFailed: '无法加载请愿。请稍后再试。',
    errForbidden: '只有平台管理员可以下载请愿签名。',
    errNotFound: '此请愿已不存在或未获批准。',
    errIncomplete: '未能读取全部签名，因此没有生成文件。请重试。',
    errGeneric: '下载失败，没有生成文件。请重试。',
  },
  so: {
    heading: 'Saxiixyada codsiyada',
    intro: 'Soo deji saxiixyada codsi ahaan fayl CSV ah oo loogu talagalay qofka abaabulay.',
    columnsNote: 'Faylku wuxuu taxayaa magaca qof kasta oo saxiixay, goorta uu saxiixay, bayaanka uu ku raacay iyo nooca codsiga uu saxiixay. Cinwaannada IP iyo faahfaahinta qalabka laguma darin.',
    lockNote: 'Soo dejinta ugu horreysa waxay xiraysaa liiska: saxiixayaashu mar dambe kama noqon karaan saxiixooda codsigaas.',
    petitionLabel: 'Codsi',
    alreadyLocked: 'Hore ayaa loo soo dejiyay — ka noqoshada waa la xiray.',
    download: 'Soo deji CSV',
    downloading: 'CSV waa la diyaarinayaa…',
    downloaded: 'Waa la soo dejiyay. Saxiixyada faylka ku jira: {count}',
    loading: 'Codsiyada waa la soo rarayaa…',
    none: 'Weli ma jiraan codsiyo la ansixiyay.',
    loadFailed: 'Codsiyada lama soo rari karin. Mar dambe isku day.',
    errForbidden: 'Maamulayaasha madasha oo keliya ayaa soo dejin kara saxiixyada codsiyada.',
    errNotFound: 'Codsigan hadda ma jiro ama lama ansixin.',
    errIncomplete: 'Dhammaan saxiixyada lama akhrin karin, sidaas darteed fayl lama samayn. Mar kale isku day.',
    errGeneric: 'Soo dejintu way guuldareysatay, fayl lama samayn. Mar kale isku day.',
  },
  fr: {
    heading: 'Signatures des pétitions',
    intro: 'Téléchargez les signatures d’une pétition dans un fichier CSV pour son organisateur.',
    columnsNote: 'Le fichier indique le nom de chaque signataire, la date de sa signature, la déclaration acceptée et la version de la pétition signée. Les adresses IP et les détails de l’appareil n’y figurent pas.',
    lockNote: 'Le premier téléchargement verrouille la liste : les signataires ne peuvent plus retirer leur signature de cette pétition.',
    petitionLabel: 'Pétition',
    alreadyLocked: 'Déjà téléchargée — les retraits sont verrouillés.',
    download: 'Télécharger le CSV',
    downloading: 'Préparation du CSV…',
    downloaded: 'Téléchargé. Signatures dans le fichier : {count}',
    loading: 'Chargement des pétitions…',
    none: 'Aucune pétition approuvée pour l’instant.',
    loadFailed: 'Impossible de charger les pétitions. Réessayez plus tard.',
    errForbidden: 'Seuls les administrateurs de la plateforme peuvent télécharger les signatures.',
    errNotFound: 'Cette pétition n’existe plus ou n’est pas approuvée.',
    errIncomplete: 'Toutes les signatures n’ont pas pu être lues : aucun fichier n’a été créé. Réessayez.',
    errGeneric: 'Le téléchargement a échoué et aucun fichier n’a été créé. Réessayez.',
  },
  pt: {
    heading: 'Assinaturas de petições',
    intro: 'Baixe as assinaturas de uma petição em um arquivo CSV para quem a organiza.',
    columnsNote: 'O arquivo lista o nome de cada signatário, quando assinou, a declaração que aceitou e a versão da petição que assinou. Endereços IP e dados do dispositivo ficam de fora.',
    lockNote: 'O primeiro download bloqueia a lista: os signatários não podem mais retirar a assinatura dessa petição.',
    petitionLabel: 'Petição',
    alreadyLocked: 'Já foi baixada — as retiradas estão bloqueadas.',
    download: 'Baixar CSV',
    downloading: 'Preparando CSV…',
    downloaded: 'Baixado. Assinaturas no arquivo: {count}',
    loading: 'Carregando petições…',
    none: 'Ainda não há petições aprovadas.',
    loadFailed: 'Não foi possível carregar as petições. Tente novamente mais tarde.',
    errForbidden: 'Somente administradores da plataforma podem baixar as assinaturas.',
    errNotFound: 'Esta petição não existe mais ou não está aprovada.',
    errIncomplete: 'Nem todas as assinaturas puderam ser lidas, então nenhum arquivo foi criado. Tente novamente.',
    errGeneric: 'O download falhou e nenhum arquivo foi criado. Tente novamente.',
  },
  ru: {
    heading: 'Подписи под петициями',
    intro: 'Скачайте подписи под петицией в файле CSV для её организатора.',
    columnsNote: 'В файле указаны имя каждого подписавшего, время подписи, заявление, с которым он согласился, и версия петиции, которую он подписал. IP-адреса и сведения об устройстве не включаются.',
    lockNote: 'Первое скачивание закрывает список: подписавшие больше не смогут отозвать свою подпись под этой петицией.',
    petitionLabel: 'Петиция',
    alreadyLocked: 'Уже скачивалась — отзыв подписей закрыт.',
    download: 'Скачать CSV',
    downloading: 'Готовим CSV…',
    downloaded: 'Скачано. Подписей в файле: {count}',
    loading: 'Загружаем петиции…',
    none: 'Одобренных петиций пока нет.',
    loadFailed: 'Не удалось загрузить петиции. Попробуйте позже.',
    errForbidden: 'Скачивать подписи могут только администраторы платформы.',
    errNotFound: 'Эта петиция больше не существует или не одобрена.',
    errIncomplete: 'Не удалось прочитать все подписи, поэтому файл не создан. Попробуйте ещё раз.',
    errGeneric: 'Скачивание не удалось, файл не создан. Попробуйте ещё раз.',
  },
  ko: {
    heading: '청원 서명',
    intro: '청원의 서명을 CSV 파일로 내려받아 청원 주최자에게 전달하세요.',
    columnsNote: '파일에는 각 서명자의 이름, 서명 시각, 동의한 문구, 서명한 청원 버전이 담깁니다. IP 주소와 기기 정보는 포함되지 않습니다.',
    lockNote: '처음 내려받으면 명단이 잠깁니다. 서명자는 더 이상 해당 청원에서 서명을 철회할 수 없습니다.',
    petitionLabel: '청원',
    alreadyLocked: '이전에 내려받음 — 철회가 잠겨 있습니다.',
    download: 'CSV 내려받기',
    downloading: 'CSV 준비 중…',
    downloaded: '내려받았습니다. 파일의 서명 수: {count}',
    loading: '청원을 불러오는 중…',
    none: '아직 승인된 청원이 없습니다.',
    loadFailed: '청원을 불러올 수 없습니다. 나중에 다시 시도하세요.',
    errForbidden: '플랫폼 관리자만 청원 서명을 내려받을 수 있습니다.',
    errNotFound: '이 청원은 더 이상 존재하지 않거나 승인되지 않았습니다.',
    errIncomplete: '모든 서명을 읽지 못해 파일을 만들지 않았습니다. 다시 시도하세요.',
    errGeneric: '내려받기에 실패하여 파일을 만들지 않았습니다. 다시 시도하세요.',
  },
  tl: {
    heading: 'Mga lagda sa petisyon',
    intro: 'I-download ang mga lagda ng isang petisyon bilang CSV file para sa nag-oorganisa nito.',
    columnsNote: 'Nakalista sa file ang pangalan ng bawat lumagda, kung kailan sila lumagda, ang pahayag na sinang-ayunan nila at ang bersyon ng petisyong nilagdaan nila. Hindi kasama ang mga IP address at detalye ng device.',
    lockNote: 'Ila-lock ng unang pag-download ang listahan: hindi na mababawi ng mga lumagda ang kanilang lagda sa petisyong iyon.',
    petitionLabel: 'Petisyon',
    alreadyLocked: 'Na-download na dati — naka-lock na ang pagbawi.',
    download: 'I-download ang CSV',
    downloading: 'Inihahanda ang CSV…',
    downloaded: 'Na-download. Mga lagda sa file: {count}',
    loading: 'Nilo-load ang mga petisyon…',
    none: 'Wala pang aprubadong petisyon.',
    loadFailed: 'Hindi ma-load ang mga petisyon. Subukan muli mamaya.',
    errForbidden: 'Ang mga platform admin lang ang makakapag-download ng mga lagda sa petisyon.',
    errNotFound: 'Wala na ang petisyong ito o hindi ito aprubado.',
    errIncomplete: 'Hindi nabasa ang lahat ng lagda, kaya walang ginawang file. Subukan muli.',
    errGeneric: 'Nabigo ang pag-download at walang ginawang file. Subukan muli.',
  },
  am: {
    heading: 'የአቤቱታ ፊርማዎች',
    intro: 'የአንድን አቤቱታ ፊርማዎች ለአዘጋጁ በCSV ፋይል ያውርዱ።',
    columnsNote: 'ፋይሉ የእያንዳንዱን ፈራሚ ስም፣ የፈረሙበትን ጊዜ፣ የተስማሙበትን መግለጫ እና የፈረሙትን የአቤቱታ ስሪት ይዘረዝራል። የIP አድራሻዎችና የመሣሪያ ዝርዝሮች አልተካተቱም።',
    lockNote: 'የመጀመሪያው ማውረድ ዝርዝሩን ይቆልፋል፤ ፈራሚዎች ከዚያ አቤቱታ ፊርማቸውን ማንሳት አይችሉም።',
    petitionLabel: 'አቤቱታ',
    alreadyLocked: 'ቀደም ብሎ ወርዷል — ፊርማ ማንሳት ተቆልፏል።',
    download: 'CSV አውርድ',
    downloading: 'CSV በመዘጋጀት ላይ…',
    downloaded: 'ወርዷል። በፋይሉ ውስጥ ያሉ ፊርማዎች፦ {count}',
    loading: 'አቤቱታዎች በመጫን ላይ…',
    none: 'እስካሁን የጸደቀ አቤቱታ የለም።',
    loadFailed: 'አቤቱታዎቹን መጫን አልተቻለም። ቆይተው እንደገና ይሞክሩ።',
    errForbidden: 'የአቤቱታ ፊርማዎችን ማውረድ የሚችሉት የመድረኩ አስተዳዳሪዎች ብቻ ናቸው።',
    errNotFound: 'ይህ አቤቱታ ከእንግዲህ የለም ወይም አልጸደቀም።',
    errIncomplete: 'ሁሉንም ፊርማዎች ማንበብ ስላልተቻለ ምንም ፋይል አልተሠራም። እንደገና ይሞክሩ።',
    errGeneric: 'ማውረዱ አልተሳካም፤ ምንም ፋይል አልተሠራም። እንደገና ይሞክሩ።',
  },
  hmn: {
    heading: 'Cov kos npe rau daim ntawv thov',
    intro: 'Rub cov kos npe ntawm ib daim ntawv thov los ua ib daim ntawv CSV rau tus neeg npaj.',
    columnsNote: 'Daim ntawv no teev txhua tus neeg kos npe lub npe, lub sijhawm lawv kos npe, cov lus lawv pom zoo thiab daim ntawv thov version uas lawv kos npe. Tsis muaj IP address thiab cov ntsiab lus ntawm lub cuab yeej.',
    lockNote: 'Thawj zaug rub yuav xauv daim ntawv teev npe: cov neeg kos npe yuav rho tsis tau lawv kos npe ntawm daim ntawv thov ntawd lawm.',
    petitionLabel: 'Daim ntawv thov',
    alreadyLocked: 'Tau rub dua lawm — kev rho kos npe raug xauv lawm.',
    download: 'Rub CSV',
    downloading: 'Tab tom npaj CSV…',
    downloaded: 'Rub tau lawm. Cov kos npe hauv daim ntawv: {count}',
    loading: 'Tab tom thauj cov ntawv thov…',
    none: 'Tseem tsis tau muaj daim ntawv thov uas tau pom zoo.',
    loadFailed: 'Thauj tsis tau cov ntawv thov. Thov rov sim dua tom qab.',
    errForbidden: 'Tsuas yog cov thawj tswj platform thiaj rub tau cov kos npe.',
    errNotFound: 'Daim ntawv thov no tsis muaj lawm los yog tsis tau pom zoo.',
    errIncomplete: 'Nyeem tsis tau txhua tus kos npe, yog li tsis tau ua daim ntawv. Thov rov sim dua.',
    errGeneric: 'Rub tsis tau thiab tsis tau ua daim ntawv. Thov rov sim dua.',
  },
}

/** Looks up a petition-download line with the shared EN fallback. */
export function adminPetitionsT(locale: Locale, key: keyof AdminPetitionsMessages): string {
  return translate(adminPetitionsMessages, locale, key)
}

/** Server error codes from POST /api/admin/petitions/[id]/export → the line the admin reads. */
export function petitionExportErrorKey(code: string | null | undefined): keyof AdminPetitionsMessages {
  switch (code) {
    case 'insufficient_tier':
    case 'auth':
      return 'errForbidden'
    case 'not_found':
      return 'errNotFound'
    case 'incomplete':
      return 'errIncomplete'
    default:
      return 'errGeneric'
  }
}
