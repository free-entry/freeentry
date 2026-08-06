import type { CountryConfig } from './types';

/** Belgian provinces (plus Brussels-Capital) with their postal ranges. */
export const BE_PROVINCE_NAMES: Record<string, string> = {
  BRU: 'Bruxelles / Brussel',
  WBR: 'Brabant wallon',
  VBR: 'Vlaams-Brabant',
  ANT: 'Antwerpen',
  LIM: 'Limburg',
  LIE: 'Liège',
  NAM: 'Namur',
  HAI: 'Hainaut',
  LUX: 'Luxembourg',
  WVL: 'West-Vlaanderen',
  OVL: 'Oost-Vlaanderen',
};

const RANGES: Record<string, [number, number][]> = {
  BRU: [[1000, 1299]],
  WBR: [[1300, 1499]],
  VBR: [[1500, 1999], [3000, 3499]],
  ANT: [[2000, 2999]],
  LIM: [[3500, 3999]],
  LIE: [[4000, 4999]],
  NAM: [[5000, 5999]],
  HAI: [[6000, 6599], [7000, 7999]],
  LUX: [[6600, 6999]],
  WVL: [[8000, 8999]],
  OVL: [[9000, 9999]],
};

export function beProvinceOfPostcode(postcode: string): string | null {
  const n = Number(postcode);
  for (const [code, ranges] of Object.entries(RANGES)) {
    if (ranges.some(([lo, hi]) => n >= lo && n <= hi)) return code;
  }
  return null;
}

/** Belgium — Brussels/FWB first-Sunday networks, city schemes, always-free museums. */
export const be: CountryConfig = {
  code: 'be',
  canonicalLocale: 'fr',
  basePath: '/free-museums-belgium/',
  siteUrl: 'https://travel-eu.github.io/free-museums-belgium',
  repoUrl: 'https://github.com/travel-eu/free-museums-france',
  bbox: { minLat: 49.45, maxLat: 51.6, minLng: 2.4, maxLng: 6.5 },
  adminAreas: {
    names: BE_PROVINCE_NAMES,
    postalPrefix: (area: string) => {
      const ranges = RANGES[area];
      if (!ranges) return /^\d{4}$/;
      // Ranges are aligned on hundreds; enumerate the valid hundred-blocks.
      const blocks: string[] = [];
      for (const [lo, hi] of ranges) {
        for (let h = Math.floor(lo / 100); h <= Math.floor(hi / 100); h++) {
          blocks.push(String(h).padStart(2, '0'));
        }
      }
      return new RegExp(`^(?:${blocks.join('|')})\\d{2}$`);
    },
    districtRanges: {},
  },
  eventKeys: [],
  brand: {
    "en": {
      title: "Free Museums & Monuments — Belgium",
      titleShort: "Free Museums Belgium",
      metaDescription: "Interactive map of free museums and monuments in Belgium: always free, free on first Sundays (Brussels & Wallonia), free on first Wednesday afternoons and more.",
    },
    "fr": {
      title: "Musées & monuments gratuits — Belgique",
      titleShort: "Musées gratuits Belgique",
      metaDescription: "Carte interactive des musées et monuments gratuits en Belgique : toujours gratuits, gratuits les 1ers dimanches et mercredis après-midi (Bruxelles/Wallonie), et plus.",
    },
    "es": {
      title: "Museos y monumentos gratuitos — Bélgica",
      titleShort: "Museos gratis en Bélgica",
      metaDescription: "Mapa interactivo de museos y monumentos gratuitos en Bélgica: siempre gratis, gratis los primeros domingos y miércoles por la tarde (Bruselas y Valonia), y más.",
    },
    "it": {
      title: "Musei e monumenti gratuiti — Belgio",
      titleShort: "Musei gratis in Belgio",
      metaDescription: "Mappa interattiva di musei e monumenti gratuiti in Belgio: sempre gratis, gratis le prime domeniche (Bruxelles e Vallonia) e i primi mercoledì pomeriggio, e altro.",
    },
    "de": {
      title: "Kostenlose Museen und Denkmäler – Belgien",
      titleShort: "Kostenlose Museen in Belgien",
      metaDescription: "Interaktive Karte kostenloser Museen und Denkmäler in Belgien: immer kostenlos, kostenlos an den 1. Sonntagen (Brüssel/Wallonien) und am 1. Mittwochnachmittag, und mehr.",
    },
    "zh-Hans": {
      title: "比利时免费博物馆和古迹",
      titleShort: "比利时免费博物馆",
      metaDescription: "比利时免费博物馆和古迹互动地图：常年免费、每月第一个周日免费（布鲁塞尔和瓦隆区）、每月第一个周三下午免费等。",
    },
    "zh-Hant": {
      title: "免費博物館與古蹟 — 比利時",
      titleShort: "比利時免費博物館",
      metaDescription: "比利時免費博物館與古蹟互動地圖：全年免費、每月首個週日免費（布魯塞爾與瓦隆區）、每月首個週三下午免費等。",
    },
    "ja": {
      title: "無料ミュージアム＆モニュメント — ベルギー",
      titleShort: "ベルギー無料ミュージアム",
      metaDescription: "ベルギーの無料で入館できる美術館・博物館・モニュメントのインタラクティブマップ：常時無料、毎月第1日曜無料（ブリュッセル＆ワロン）、毎月第1水曜午後無料など。",
    },
    "ko": {
      title: "벨기에 무료 박물관·기념물",
      titleShort: "벨기에 무료 박물관",
      metaDescription: "벨기에의 무료 박물관·기념물 인터랙티브 지도: 상시 무료, 매월 첫째 일요일 무료(브뤼셀·왈롱), 매월 첫째 수요일 오후 무료 등.",
    },
    "ar": {
      title: "المتاحف والمعالم المجانية — بلجيكا",
      titleShort: "متاحف مجانية في بلجيكا",
      metaDescription: "خريطة تفاعلية للمتاحف والمعالم المجانية في بلجيكا: مجاني دائمًا، مجاني الأحد الأول من كل شهر (بروكسل ووالونيا)، مجاني بعد ظهر الأربعاء الأول من كل شهر والمزيد.",
    },
  },
};
