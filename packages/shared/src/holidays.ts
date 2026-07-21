import HolidaysParser from 'date-holidays-parser';
import deData from './data/de-holidays.json' with { type: 'json' };
import { PublicHoliday } from './types.js';
import { RegionCode, DEFAULT_REGION } from './regions.js';

/**
 * 公共假日数据来源：date-holidays（commenthol/date-holidays，按 ISO 3166-2:DE 区码区分各联邦州）
 *
 * 实现细节：
 *  - 仅打包德国部分（src/data/de-holidays.json，由 scripts/extract-de-holidays.mjs 在
 *    `predev` / `prebuild` 时从 date-holidays/data/holidays.json 自动抽取）
 *  - 使用底层 `date-holidays-parser` 直接解析，避免引入全球 100+ 国家数据
 *  - 德语原名 + 英文名直接来自该库；中文名由本文件 `ZH_NAMES` 维护（按德语原名匹配）
 *  - 仅返回 `type === 'public'` 的法定公共假日
 *
 * 该库内部已处理：
 *   - 复活节算法、Buß- und Bettag（11/23 之前最后一个周三）等浮动假日
 *   - 各州差异（Mariä Himmelfahrt 仅 BY/SL，Reformationstag 北部州 2018 起，
 *     Internationaler Frauentag MV 2023 起，等等）
 */

// 德语原名 → 中文名映射，缺失时回退到英文名
const ZH_NAMES: Record<string, string> = {
  'Neujahr': '元旦',
  'Heilige Drei Könige': '三王节',
  'Internationaler Frauentag': '国际妇女节',
  'Karfreitag': '耶稣受难日',
  'Ostersonntag': '复活节星期日',
  'Ostermontag': '复活节星期一',
  'Maifeiertag': '劳动节',
  'Tag der Arbeit': '劳动节',
  'Christi Himmelfahrt': '耶稣升天节',
  'Pfingstsonntag': '圣灵降临节星期日',
  'Pfingstmontag': '圣灵降临节星期一',
  'Fronleichnam': '基督圣体节',
  'Mariä Himmelfahrt': '圣母升天节',
  'Augsburger Friedensfest': '奥格斯堡和平节',
  'Weltkindertag': '世界儿童日',
  'Tag der Deutschen Einheit': '德国统一日',
  'Reformationstag': '宗教改革日',
  'Allerheiligen': '万圣节',
  'Buß- und Bettag': '忏悔祈祷日',
  '1. Weihnachtstag': '圣诞节第一天',
  '2. Weihnachtstag': '圣诞节第二天',
};

// 缓存每个州的 parser 实例
const cache = new Map<RegionCode, HolidaysParser>();

function getInstance(region: RegionCode): HolidaysParser {
  let hd = cache.get(region);
  if (!hd) {
    hd = new HolidaysParser(deData, 'DE', region);
    cache.set(region, hd);
  }
  return hd;
}

interface RawHoliday {
  date: string;            // "YYYY-MM-DD HH:mm:ss"
  name: string;
  type: string;
}

function toIsoDate(rawDate: string): string {
  // date-holidays 返回 "YYYY-MM-DD HH:mm:ss"
  return rawDate.slice(0, 10);
}

// 获取指定州指定年份的所有公共假日
export function getPublicHolidays(year: number, region: RegionCode = DEFAULT_REGION): PublicHoliday[] {
  const hd = getInstance(region);

  hd.setLanguages(['de']);
  const deList = (hd.getHolidays(year) as RawHoliday[]).filter((h) => h.type === 'public');

  hd.setLanguages(['en']);
  const enByDate = new Map<string, string>();
  (hd.getHolidays(year) as RawHoliday[])
    .filter((h) => h.type === 'public')
    .forEach((h) => enByDate.set(toIsoDate(h.date), h.name));

  hd.setLanguages(['de']);

  const holidays: PublicHoliday[] = deList.map((h) => {
    const dateStr = toIsoDate(h.date);
    const nameDe = h.name;
    const nameEn = enByDate.get(dateStr) ?? nameDe;
    const nameZh = ZH_NAMES[nameDe] ?? nameEn;
    return {
      date: dateStr,
      name: nameDe,
      nameEn,
      nameZh,
    };
  });

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

// 检查某天是否是公共假日
export function isPublicHoliday(dateStr: string, holidays: PublicHoliday[]): boolean {
  return holidays.some((h) => h.date === dateStr);
}

// 获取某个日期的公共假日信息
export function getHolidayInfo(dateStr: string, holidays: PublicHoliday[]): PublicHoliday | undefined {
  return holidays.find((h) => h.date === dateStr);
}
