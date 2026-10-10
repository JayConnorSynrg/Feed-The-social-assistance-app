// apps/web/src/lib/i18n-resource-categories.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The resource category labels a member reads on a feed card's category chip, in the 14 locales of
// lib/i18n.ts. The category KEYS are lib/resource-categories.ts CATEGORY_META (the stored values);
// an unknown key falls back to that file's English label. Parity: i18n-resource-categories.test.ts.
// ht, so, am and hmn need native-speaker review.

import { translate, type Locale } from './i18n'
import { getCategoryLabel } from './resource-categories'

export interface ResourceCategoryMessages {
  food: string
  housing: string
  healthcare: string
  employment: string
  education: string
  legal: string
  transportation: string
  utilities: string
  clothing: string
  financial: string
  mental_health: string
  substance_abuse: string
  domestic_violence: string
  childcare: string
  senior_services: string
  disability_services: string
  veteran_services: string
  immigration: string
  eitc_tax_filing: string
  free_legal: string
  prenatal_natal_care: string
  waste_disposal: string
  free_camping: string
  free_goods_donation: string
  other: string
}

export const resourceCategoryMessages: Record<Locale, ResourceCategoryMessages> = {
  en: {
    food: 'Food', housing: 'Housing', healthcare: 'Healthcare', employment: 'Jobs', education: 'Education', legal: 'Legal',
    transportation: 'Transportation', utilities: 'Utilities', clothing: 'Clothing', financial: 'Financial', mental_health: 'Mental Health',
    substance_abuse: 'Substance Abuse', domestic_violence: 'Domestic Violence', childcare: 'Childcare', senior_services: 'Senior Services',
    disability_services: 'Disability Services', veteran_services: 'Veteran Services', immigration: 'Immigration', eitc_tax_filing: 'Tax Filing & EITC',
    free_legal: 'Free Legal Help', prenatal_natal_care: 'Prenatal & Newborn Care', waste_disposal: 'Waste & Disposal', free_camping: 'Free Camping',
    free_goods_donation: 'Free Goods & Donations', other: 'General',
  },
  es: {
    food: 'Alimentos', housing: 'Vivienda', healthcare: 'Salud', employment: 'Empleo', education: 'Educación', legal: 'Legal',
    transportation: 'Transporte', utilities: 'Servicios públicos', clothing: 'Ropa', financial: 'Finanzas', mental_health: 'Salud mental',
    substance_abuse: 'Consumo de sustancias', domestic_violence: 'Violencia doméstica', childcare: 'Cuidado infantil', senior_services: 'Servicios para personas mayores',
    disability_services: 'Servicios para discapacidad', veteran_services: 'Servicios para veteranos', immigration: 'Inmigración', eitc_tax_filing: 'Impuestos y EITC',
    free_legal: 'Ayuda legal gratuita', prenatal_natal_care: 'Atención prenatal y del recién nacido', waste_disposal: 'Residuos y desechos', free_camping: 'Campamento gratuito',
    free_goods_donation: 'Artículos gratuitos y donaciones', other: 'General',
  },
  ht: {
    food: 'Manje', housing: 'Lojman', healthcare: 'Swen sante', employment: 'Travay', education: 'Edikasyon', legal: 'Legal',
    transportation: 'Transpò', utilities: 'Sèvis piblik', clothing: 'Rad', financial: 'Finans', mental_health: 'Sante mantal',
    substance_abuse: 'Abi sibstans', domestic_violence: 'Vyolans domestik', childcare: 'Gadri timoun', senior_services: 'Sèvis pou granmoun',
    disability_services: 'Sèvis pou moun andikape', veteran_services: 'Sèvis pou veteran', immigration: 'Imigrasyon', eitc_tax_filing: 'Taks ak EITC',
    free_legal: 'Èd legal gratis', prenatal_natal_care: 'Swen prenatal ak tibebe', waste_disposal: 'Fatra ak jete', free_camping: 'Kan gratis',
    free_goods_donation: 'Byen gratis ak don', other: 'Jeneral',
  },
  vi: {
    food: 'Thực phẩm', housing: 'Nhà ở', healthcare: 'Y tế', employment: 'Việc làm', education: 'Giáo dục', legal: 'Pháp lý',
    transportation: 'Giao thông', utilities: 'Tiện ích', clothing: 'Quần áo', financial: 'Tài chính', mental_health: 'Sức khỏe tâm thần',
    substance_abuse: 'Lạm dụng chất', domestic_violence: 'Bạo lực gia đình', childcare: 'Giữ trẻ', senior_services: 'Dịch vụ người cao tuổi',
    disability_services: 'Dịch vụ người khuyết tật', veteran_services: 'Dịch vụ cựu chiến binh', immigration: 'Di trú', eitc_tax_filing: 'Khai thuế & EITC',
    free_legal: 'Trợ giúp pháp lý miễn phí', prenatal_natal_care: 'Chăm sóc thai sản & sơ sinh', waste_disposal: 'Rác thải & xử lý', free_camping: 'Cắm trại miễn phí',
    free_goods_donation: 'Đồ miễn phí & quyên góp', other: 'Chung',
  },
  ar: {
    food: 'طعام', housing: 'سكن', healthcare: 'رعاية صحية', employment: 'وظائف', education: 'تعليم', legal: 'قانوني',
    transportation: 'مواصلات', utilities: 'مرافق', clothing: 'ملابس', financial: 'مالي', mental_health: 'صحة نفسية',
    substance_abuse: 'تعاطي المواد', domestic_violence: 'عنف أسري', childcare: 'رعاية الأطفال', senior_services: 'خدمات كبار السن',
    disability_services: 'خدمات ذوي الإعاقة', veteran_services: 'خدمات المحاربين القدامى', immigration: 'هجرة', eitc_tax_filing: 'الضرائب وEITC',
    free_legal: 'مساعدة قانونية مجانية', prenatal_natal_care: 'رعاية الحمل والمولود', waste_disposal: 'النفايات والتخلص منها', free_camping: 'تخييم مجاني',
    free_goods_donation: 'سلع مجانية وتبرعات', other: 'عام',
  },
  zh: {
    food: '食物', housing: '住房', healthcare: '医疗', employment: '工作', education: '教育', legal: '法律',
    transportation: '交通', utilities: '水电公用', clothing: '衣物', financial: '财务', mental_health: '心理健康',
    substance_abuse: '药物滥用', domestic_violence: '家庭暴力', childcare: '托儿', senior_services: '老年服务',
    disability_services: '残障服务', veteran_services: '退伍军人服务', immigration: '移民', eitc_tax_filing: '报税与 EITC',
    free_legal: '免费法律帮助', prenatal_natal_care: '产前与新生儿护理', waste_disposal: '垃圾与处理', free_camping: '免费露营',
    free_goods_donation: '免费物品与捐赠', other: '综合',
  },
  so: {
    food: 'Cunto', housing: 'Guryeyn', healthcare: 'Daryeel caafimaad', employment: 'Shaqo', education: 'Waxbarasho', legal: 'Sharci',
    transportation: 'Gaadiid', utilities: 'Adeegyada guriga', clothing: 'Dhar', financial: 'Maaliyad', mental_health: 'Caafimaadka maskaxda',
    substance_abuse: 'Isticmaalka maandooriyaha', domestic_violence: 'Rabshadaha qoyska', childcare: 'Daryeelka carruurta', senior_services: 'Adeegyada waayeelka',
    disability_services: 'Adeegyada naafada', veteran_services: 'Adeegyada halyeeyada', immigration: 'Socdaal', eitc_tax_filing: 'Canshuurta iyo EITC',
    free_legal: 'Caawimo sharci oo bilaash ah', prenatal_natal_care: 'Daryeelka uurka iyo dhallaanka', waste_disposal: 'Qashinka iyo tuurista', free_camping: 'Kaam bilaash ah',
    free_goods_donation: 'Alaab bilaash ah iyo deeq', other: 'Guud',
  },
  fr: {
    food: 'Alimentation', housing: 'Logement', healthcare: 'Santé', employment: 'Emploi', education: 'Éducation', legal: 'Juridique',
    transportation: 'Transport', utilities: 'Services publics', clothing: 'Vêtements', financial: 'Finances', mental_health: 'Santé mentale',
    substance_abuse: 'Dépendances', domestic_violence: 'Violence conjugale', childcare: "Garde d'enfants", senior_services: 'Services aux aînés',
    disability_services: 'Services handicap', veteran_services: 'Services aux anciens combattants', immigration: 'Immigration', eitc_tax_filing: 'Impôts et EITC',
    free_legal: 'Aide juridique gratuite', prenatal_natal_care: 'Soins prénatals et du nouveau-né', waste_disposal: 'Déchets et élimination', free_camping: 'Camping gratuit',
    free_goods_donation: 'Objets gratuits et dons', other: 'Général',
  },
  pt: {
    food: 'Alimentação', housing: 'Moradia', healthcare: 'Saúde', employment: 'Emprego', education: 'Educação', legal: 'Jurídico',
    transportation: 'Transporte', utilities: 'Serviços básicos', clothing: 'Roupas', financial: 'Finanças', mental_health: 'Saúde mental',
    substance_abuse: 'Uso de substâncias', domestic_violence: 'Violência doméstica', childcare: 'Cuidado infantil', senior_services: 'Serviços para idosos',
    disability_services: 'Serviços para deficiência', veteran_services: 'Serviços para veteranos', immigration: 'Imigração', eitc_tax_filing: 'Impostos e EITC',
    free_legal: 'Ajuda jurídica gratuita', prenatal_natal_care: 'Pré-natal e recém-nascido', waste_disposal: 'Lixo e descarte', free_camping: 'Acampamento gratuito',
    free_goods_donation: 'Itens gratuitos e doações', other: 'Geral',
  },
  ru: {
    food: 'Еда', housing: 'Жильё', healthcare: 'Здоровье', employment: 'Работа', education: 'Образование', legal: 'Юридическое',
    transportation: 'Транспорт', utilities: 'Коммунальные услуги', clothing: 'Одежда', financial: 'Финансы', mental_health: 'Психическое здоровье',
    substance_abuse: 'Зависимости', domestic_violence: 'Домашнее насилие', childcare: 'Уход за детьми', senior_services: 'Услуги для пожилых',
    disability_services: 'Услуги для людей с инвалидностью', veteran_services: 'Услуги для ветеранов', immigration: 'Иммиграция', eitc_tax_filing: 'Налоги и EITC',
    free_legal: 'Бесплатная юридическая помощь', prenatal_natal_care: 'Беременность и новорождённые', waste_disposal: 'Отходы и вывоз', free_camping: 'Бесплатный кемпинг',
    free_goods_donation: 'Бесплатные вещи и пожертвования', other: 'Общее',
  },
  ko: {
    food: '음식', housing: '주거', healthcare: '의료', employment: '일자리', education: '교육', legal: '법률',
    transportation: '교통', utilities: '공과금', clothing: '의류', financial: '재정', mental_health: '정신 건강',
    substance_abuse: '약물 남용', domestic_violence: '가정 폭력', childcare: '보육', senior_services: '노인 서비스',
    disability_services: '장애인 서비스', veteran_services: '재향군인 서비스', immigration: '이민', eitc_tax_filing: '세금 신고 및 EITC',
    free_legal: '무료 법률 지원', prenatal_natal_care: '산전 및 신생아 돌봄', waste_disposal: '폐기물 및 처리', free_camping: '무료 캠핑',
    free_goods_donation: '무료 물품 및 기부', other: '일반',
  },
  tl: {
    food: 'Pagkain', housing: 'Pabahay', healthcare: 'Kalusugan', employment: 'Trabaho', education: 'Edukasyon', legal: 'Legal',
    transportation: 'Transportasyon', utilities: 'Mga utility', clothing: 'Damit', financial: 'Pananalapi', mental_health: 'Kalusugang pangkaisipan',
    substance_abuse: 'Pang-aabuso sa droga', domestic_violence: 'Karahasan sa tahanan', childcare: 'Pag-aalaga ng bata', senior_services: 'Serbisyo para sa nakatatanda',
    disability_services: 'Serbisyo para sa may kapansanan', veteran_services: 'Serbisyo para sa beterano', immigration: 'Imigrasyon', eitc_tax_filing: 'Buwis at EITC',
    free_legal: 'Libreng tulong legal', prenatal_natal_care: 'Pangangalaga bago manganak at sa sanggol', waste_disposal: 'Basura at pagtatapon', free_camping: 'Libreng camping',
    free_goods_donation: 'Libreng gamit at donasyon', other: 'Pangkalahatan',
  },
  am: {
    food: 'ምግብ', housing: 'መኖሪያ ቤት', healthcare: 'የጤና እንክብካቤ', employment: 'ሥራ', education: 'ትምህርት', legal: 'ሕጋዊ',
    transportation: 'መጓጓዣ', utilities: 'መገልገያዎች', clothing: 'ልብስ', financial: 'ፋይናንስ', mental_health: 'የአእምሮ ጤና',
    substance_abuse: 'የዕፅ ሱስ', domestic_violence: 'የቤት ውስጥ ጥቃት', childcare: 'የሕፃናት እንክብካቤ', senior_services: 'የአረጋውያን አገልግሎት',
    disability_services: 'የአካል ጉዳተኞች አገልግሎት', veteran_services: 'የቀድሞ ወታደሮች አገልግሎት', immigration: 'ኢሚግሬሽን', eitc_tax_filing: 'ግብር እና EITC',
    free_legal: 'ነፃ የሕግ እርዳታ', prenatal_natal_care: 'የእርግዝና እና የአራስ እንክብካቤ', waste_disposal: 'ቆሻሻ እና አወጋገድ', free_camping: 'ነፃ ካምፕ',
    free_goods_donation: 'ነፃ ዕቃዎች እና ልገሳ', other: 'አጠቃላይ',
  },
  hmn: {
    food: 'Zaub mov', housing: 'Vaj tse', healthcare: 'Kev kho mob', employment: 'Hauj lwm', education: 'Kev kawm', legal: 'Kev cai lij choj',
    transportation: 'Kev thauj mus los', utilities: 'Dej hluav taws', clothing: 'Khaub ncaws', financial: 'Nyiaj txiag', mental_health: 'Kev puas siab puas ntsws',
    substance_abuse: 'Kev siv yeeb tshuaj', domestic_violence: 'Kev ua phem hauv tsev', childcare: 'Kev zov me nyuam', senior_services: 'Kev pab neeg laus',
    disability_services: 'Kev pab neeg xiam oob qhab', veteran_services: 'Kev pab tub rog qub', immigration: 'Kev tsiv teb chaws', eitc_tax_filing: 'Ua se thiab EITC',
    free_legal: 'Kev pab cai lij choj dawb', prenatal_natal_care: 'Kev saib xyuas cev xeeb tub thiab me nyuam mos', waste_disposal: 'Khib nyiab thiab kev muab pov tseg', free_camping: 'Chaw pw hav zoov dawb',
    free_goods_donation: 'Khoom dawb thiab khoom pub', other: 'Dav dav',
  },
}

/** The category chip label in the viewer's language; an unknown category falls back to English. */
export function resourceCategoryLabel(category: string, locale: Locale): string {
  if (Object.prototype.hasOwnProperty.call(resourceCategoryMessages.en, category)) {
    return translate(resourceCategoryMessages, locale, category as keyof ResourceCategoryMessages)
  }
  return getCategoryLabel(category)
}
