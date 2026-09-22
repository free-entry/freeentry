import { SITE_URL } from '../lib/deployment';
import type { CountryConfig } from './types';

/** Italian province codes → names, for the provinces the dataset covers. */
export const PROVINCE_NAMES: Record<string, string> = {
  AL: 'Alessandria', AN: 'Ancona', AP: 'Ascoli Piceno', AQ: "L'Aquila",
  AR: 'Arezzo', AT: 'Asti', AV: 'Avellino', BA: 'Bari', BL: 'Belluno',
  BN: 'Benevento', BO: 'Bologna', BR: 'Brindisi', BS: 'Brescia',
  BT: 'Barletta-Andria-Trani', CA: 'Cagliari', CB: 'Campobasso',
  CE: 'Caserta', CH: 'Chieti', CN: 'Cuneo', CR: 'Cremona', CS: 'Cosenza',
  CZ: 'Catanzaro', FC: 'Forlì-Cesena', FE: 'Ferrara', FG: 'Foggia',
  FI: 'Firenze', FR: 'Frosinone', GE: 'Genova', GO: 'Gorizia',
  GR: 'Grosseto', IM: 'Imperia', IS: 'Isernia', KR: 'Crotone',
  LE: 'Lecce', LI: 'Livorno', LT: 'Latina', LU: 'Lucca', MB: 'Monza e Brianza',
  MC: 'Macerata', MI: 'Milano', MN: 'Mantova', MO: 'Modena', MT: 'Matera',
  NA: 'Napoli', OT: 'Olbia-Tempio', PC: 'Piacenza', PD: 'Padova',
  PE: 'Pescara', PG: 'Perugia', PI: 'Pisa', PN: 'Pordenone', PO: 'Prato',
  PR: 'Parma', PT: 'Pistoia', PU: 'Pesaro e Urbino', PV: 'Pavia',
  PZ: 'Potenza', RA: 'Ravenna', RC: 'Reggio Calabria', RM: 'Roma',
  RN: 'Rimini', RO: 'Rovigo', SA: 'Salerno', SI: 'Siena', SO: 'Sondrio',
  SP: 'La Spezia', SS: 'Sassari', SV: 'Savona', TA: 'Taranto',
  TE: 'Teramo', TO: 'Torino', TR: 'Terni', TS: 'Trieste', TV: 'Treviso',
  UD: 'Udine', VE: 'Venezia', VR: 'Verona', VT: 'Viterbo', VV: 'Vibo Valentia',
};

/** Italy — state venues of the Domenica al Museo scheme. */
export const it: CountryConfig = {
  code: 'it',
  canonicalLocale: 'it',
  basePath: '/italy/',
  siteUrl: `${SITE_URL}/italy`,
  repoUrl: 'https://github.com/free-entry/freeentry',
  bbox: { minLat: 35.4, maxLat: 47.2, minLng: 6.5, maxLng: 18.7 },
  adminAreas: {
    names: PROVINCE_NAMES,
    // Italian CAPs don't encode the province; validate the shape only.
    postalPrefix: () => /^\d{5}$/,
    districtRanges: {},
  },
  eventKeys: [],
  brand: {
    "en": {
      title: "Free Entry",
      titleShort: "Free Entry",
      metaDescription: "Interactive map of free museums and monuments in Italy: free on the 1st Sunday of the month (Domenica al Museo), on 25 April, 2 June & 4 November, and for under-18s.",
    },
    "fr": {
      title: "Free Entry",
      titleShort: "Free Entry",
      metaDescription: "Carte interactive des musées et monuments gratuits en Italie : gratuits le 1er dimanche du mois (Domenica al Museo), les 25 avr., 2 juin et 4 nov., et pour les -18 ans.",
    },
    "es": {
      title: "Free Entry",
      titleShort: "Free Entry",
      metaDescription: "Mapa interactivo de museos y monumentos gratuitos en Italia: gratis el 1er domingo de mes (Domenica al Museo), el 25 abr., 2 jun. y 4 nov., y para menores de 18 años.",
    },
    "it": {
      title: "Free Entry",
      titleShort: "Free Entry",
      metaDescription: "Mappa interattiva di musei e monumenti gratuiti in Italia: gratis la 1ª domenica del mese (Domenica al Museo), 25 aprile, 2 giugno e 4 novembre, e ai minori di 18 anni.",
    },
    "de": {
      title: "Free Entry",
      titleShort: "Free Entry",
      metaDescription: "Interaktive Karte kostenloser Museen und Denkmäler in Italien: kostenlos am 1. Sonntag im Monat (Domenica al Museo), am 25.4., 2.6. und 4.11., und für unter 18-Jährige.",
    },
    "zh-Hans": {
      title: "Free Entry",
      titleShort: "Free Entry",
      metaDescription: "意大利免费博物馆和古迹互动地图：每月第一个周日免费（Domenica al Museo）、4月25日、6月2日、11月4日免费、18岁以下免费等。",
    },
    "zh-Hant": {
      title: "Free Entry",
      titleShort: "Free Entry",
      metaDescription: "義大利免費博物館與古蹟互動地圖：每月首個週日免費（Domenica al Museo）、4月25日、6月2日、11月4日免費、18歲以下免費等。",
    },
    "ja": {
      title: "Free Entry",
      titleShort: "Free Entry",
      metaDescription: "イタリアの無料で入館できる美術館・博物館・モニュメントのインタラクティブマップ：毎月第1日曜無料（ドメニカ・アル・ムゼオ）、4月25日・6月2日・11月4日は無料、18歳未満無料など。",
    },
    "ko": {
      title: "Free Entry",
      titleShort: "Free Entry",
      metaDescription: "이탈리아의 무료 박물관·기념물 인터랙티브 지도: 매월 첫째 일요일 무료(도메니카 알 무제오), 4월 25일·6월 2일·11월 4일 무료, 18세 미만 무료 등.",
    },
    "ar": {
      title: "Free Entry",
      titleShort: "Free Entry",
      metaDescription: "خريطة تفاعلية للمتاحف والمعالم المجانية في إيطاليا: مجاني الأحد الأول من كل شهر (دومينيكا آل موزيو)، وفي 25 أبريل و2 يونيو و4 نوفمبر، ولمن هم دون 18 عامًا.",
    },
  },
};
