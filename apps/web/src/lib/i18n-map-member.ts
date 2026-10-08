// apps/web/src/lib/i18n-map-member.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Member-side copy the map panel shows in the viewer's language. Today that is the polite status
// line for a deep link (#map?focus=<kind>:<id>, lib/deep-link.ts) whose place is not on the map
// right now. Same shape and rules as its siblings: look up with mapMemberT(locale, key) (EN
// fallback); Record<Locale, …> makes a missing locale or key a type error, and
// i18n-map-member.test.ts checks parity. ht, so, am and hmn need native-speaker review.

import { translate, type Locale } from './i18n'

export interface MapMemberMessages {
  /** A deep link named a place the members' map does not show right now. */
  focusNotOnMap: string
}

export const mapMemberMessages: Record<Locale, MapMemberMessages> = {
  en: { focusNotOnMap: "That place isn't on the map right now." },
  es: { focusNotOnMap: 'Ese lugar no está en el mapa en este momento.' },
  ht: { focusNotOnMap: 'Kote sa a pa sou kat la kounye a.' },
  vi: { focusNotOnMap: 'Địa điểm đó hiện không có trên bản đồ.' },
  ar: { focusNotOnMap: 'هذا المكان غير موجود على الخريطة حاليًا.' },
  zh: { focusNotOnMap: '该地点目前不在地图上。' },
  so: { focusNotOnMap: 'Goobtaas hadda kuma jirto khariidadda.' },
  fr: { focusNotOnMap: 'Ce lieu n’est pas sur la carte pour le moment.' },
  pt: { focusNotOnMap: 'Esse local não está no mapa no momento.' },
  ru: { focusNotOnMap: 'Этого места сейчас нет на карте.' },
  ko: { focusNotOnMap: '해당 장소는 현재 지도에 없습니다.' },
  tl: { focusNotOnMap: 'Wala sa mapa ang lugar na iyon sa ngayon.' },
  am: { focusNotOnMap: 'ያ ቦታ በአሁኑ ጊዜ በካርታው ላይ የለም።' },
  hmn: { focusNotOnMap: 'Qhov chaw ntawd tsis nyob ntawm daim ntawv qhia tam sim no.' },
}

/** Looks up a member map string with the shared EN fallback. */
export function mapMemberT(locale: Locale, key: keyof MapMemberMessages): string {
  return translate(mapMemberMessages, locale, key)
}
