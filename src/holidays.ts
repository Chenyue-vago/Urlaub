import { PublicHoliday } from './types';

// 巴登-符腾堡州公共假日
// 这些是固定日期的假日，复活节等浮动假日需要每年计算

// 计算复活节日期 (Anonymous Gregorian algorithm)
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// 格式化日期为 YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 添加天数到日期
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// 获取指定年份巴登-符腾堡州的所有公共假日
export function getPublicHolidays(year: number): PublicHoliday[] {
  const easter = getEasterDate(year);
  
  const holidays: PublicHoliday[] = [
    // 固定假日
    { date: `${year}-01-01`, name: 'Neujahr', nameZh: '元旦' },
    { date: `${year}-01-06`, name: 'Heilige Drei Könige', nameZh: '三王节' },
    { date: `${year}-05-01`, name: 'Tag der Arbeit', nameZh: '劳动节' },
    { date: `${year}-10-03`, name: 'Tag der Deutschen Einheit', nameZh: '德国统一日' },
    { date: `${year}-11-01`, name: 'Allerheiligen', nameZh: '万圣节' },
    { date: `${year}-12-25`, name: '1. Weihnachtstag', nameZh: '圣诞节第一天' },
    { date: `${year}-12-26`, name: '2. Weihnachtstag', nameZh: '圣诞节第二天' },
    
    // 浮动假日（基于复活节）
    { date: formatDate(addDays(easter, -2)), name: 'Karfreitag', nameZh: '耶稣受难日' },
    { date: formatDate(easter), name: 'Ostersonntag', nameZh: '复活节星期日' },
    { date: formatDate(addDays(easter, 1)), name: 'Ostermontag', nameZh: '复活节星期一' },
    { date: formatDate(addDays(easter, 39)), name: 'Christi Himmelfahrt', nameZh: '耶稳升天节' },
    { date: formatDate(addDays(easter, 49)), name: 'Pfingstsonntag', nameZh: '圣灵降临节星期日' },
    { date: formatDate(addDays(easter, 50)), name: 'Pfingstmontag', nameZh: '圣灵降临节星期一' },
    { date: formatDate(addDays(easter, 60)), name: 'Fronleichnam', nameZh: '基督圣体节' },
  ];

  // 按日期排序
  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

// 检查某天是否是公共假日
export function isPublicHoliday(dateStr: string, holidays: PublicHoliday[]): boolean {
  return holidays.some(h => h.date === dateStr);
}

// 获取某个日期的公共假日信息
export function getHolidayInfo(dateStr: string, holidays: PublicHoliday[]): PublicHoliday | undefined {
  return holidays.find(h => h.date === dateStr);
}
