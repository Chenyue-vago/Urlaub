// 德国 16 个联邦州（Bundesländer）及其本地化名称
// 区码遵循 ISO 3166-2:DE

export type RegionCode =
  | 'BW' | 'BY' | 'BE' | 'BB' | 'HB' | 'HH'
  | 'HE' | 'MV' | 'NI' | 'NW' | 'RP' | 'SL'
  | 'SN' | 'ST' | 'SH' | 'TH';

export interface Region {
  code: RegionCode;
  nameDe: string;
  nameEn: string;
  nameZh: string;
}

export const REGIONS: Region[] = [
  { code: 'BW', nameDe: 'Baden-Württemberg',       nameEn: 'Baden-Württemberg',         nameZh: '巴登-符腾堡州' },
  { code: 'BY', nameDe: 'Bayern',                   nameEn: 'Bavaria',                   nameZh: '巴伐利亚州' },
  { code: 'BE', nameDe: 'Berlin',                   nameEn: 'Berlin',                    nameZh: '柏林' },
  { code: 'BB', nameDe: 'Brandenburg',              nameEn: 'Brandenburg',               nameZh: '勃兰登堡州' },
  { code: 'HB', nameDe: 'Bremen',                   nameEn: 'Bremen',                    nameZh: '不来梅' },
  { code: 'HH', nameDe: 'Hamburg',                  nameEn: 'Hamburg',                   nameZh: '汉堡' },
  { code: 'HE', nameDe: 'Hessen',                   nameEn: 'Hesse',                     nameZh: '黑森州' },
  { code: 'MV', nameDe: 'Mecklenburg-Vorpommern',   nameEn: 'Mecklenburg-Vorpommern',    nameZh: '梅克伦堡-前波美拉尼亚州' },
  { code: 'NI', nameDe: 'Niedersachsen',            nameEn: 'Lower Saxony',              nameZh: '下萨克森州' },
  { code: 'NW', nameDe: 'Nordrhein-Westfalen',      nameEn: 'North Rhine-Westphalia',    nameZh: '北莱茵-威斯特法伦州' },
  { code: 'RP', nameDe: 'Rheinland-Pfalz',          nameEn: 'Rhineland-Palatinate',      nameZh: '莱茵兰-普法尔茨州' },
  { code: 'SL', nameDe: 'Saarland',                 nameEn: 'Saarland',                  nameZh: '萨尔州' },
  { code: 'SN', nameDe: 'Sachsen',                  nameEn: 'Saxony',                    nameZh: '萨克森州' },
  { code: 'ST', nameDe: 'Sachsen-Anhalt',           nameEn: 'Saxony-Anhalt',             nameZh: '萨克森-安哈尔特州' },
  { code: 'SH', nameDe: 'Schleswig-Holstein',       nameEn: 'Schleswig-Holstein',        nameZh: '石勒苏益格-荷尔斯泰因州' },
  { code: 'TH', nameDe: 'Thüringen',                nameEn: 'Thuringia',                 nameZh: '图林根州' },
];

export const DEFAULT_REGION: RegionCode = 'BW';

export function getRegion(code: RegionCode): Region {
  return REGIONS.find((r) => r.code === code) ?? REGIONS[0];
}

export function isRegionCode(value: unknown): value is RegionCode {
  return typeof value === 'string' && REGIONS.some((r) => r.code === value);
}
