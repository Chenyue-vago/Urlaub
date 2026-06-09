import { VacationRecord, YearlyVacationStats } from './types';
import { getPublicHolidays, isPublicHoliday } from './holidays';
import { RegionCode, DEFAULT_REGION } from './regions';

export interface EntitlementConfig {
  statutoryDays: number;
  contractualDays: number;
  carryOverDeadline: string; // 'MM-DD'
}

export const DEFAULT_ENTITLEMENT: EntitlementConfig = {
  statutoryDays: 20,
  contractualDays: 8,
  carryOverDeadline: '03-31',
};

// 生成唯一ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// 格式化日期为 YYYY-MM-DD
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 解析日期字符串
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// 检查是否是周末
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// 列出某段日期范围内所有"算作休假"的工作日（排除周末与该州的公共假日）
export function getWorkDayDates(
  startDateStr: string,
  endDateStr: string,
  region: RegionCode = DEFAULT_REGION
): string[] {
  const startDate = parseDate(startDateStr);
  const endDate = parseDate(endDateStr);

  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const allHolidays = [];
  for (let year = startYear; year <= endYear; year++) {
    allHolidays.push(...getPublicHolidays(year, region));
  }

  const dates: string[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    if (!isWeekend(current)) {
      const dateStr = formatDateString(current);
      if (!isPublicHoliday(dateStr, allHolidays)) {
        dates.push(dateStr);
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// 计算两个日期之间的工作日数量（排除周末和公共假日）
export function countWorkDays(
  startDateStr: string,
  endDateStr: string,
  region: RegionCode = DEFAULT_REGION
): number {
  return getWorkDayDates(startDateStr, endDateStr, region).length;
}

// 按年份拆分计算工作日
export function countWorkDaysByYear(
  startDateStr: string,
  endDateStr: string,
  region: RegionCode = DEFAULT_REGION
): { year: number; days: number; startDate: string; endDate: string }[] {
  const startDate = parseDate(startDateStr);
  const endDate = parseDate(endDateStr);
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  // 如果在同一年，直接返回
  if (startYear === endYear) {
    return [{
      year: startYear,
      days: countWorkDays(startDateStr, endDateStr, region),
      startDate: startDateStr,
      endDate: endDateStr,
    }];
  }

  // 跨年的情况，按年份拆分
  const result: { year: number; days: number; startDate: string; endDate: string }[] = [];

  for (let year = startYear; year <= endYear; year++) {
    let periodStart: string;
    let periodEnd: string;

    if (year === startYear) {
      periodStart = startDateStr;
      periodEnd = `${year}-12-31`;
    } else if (year === endYear) {
      periodStart = `${year}-01-01`;
      periodEnd = endDateStr;
    } else {
      periodStart = `${year}-01-01`;
      periodEnd = `${year}-12-31`;
    }

    const days = countWorkDays(periodStart, periodEnd, region);
    if (days > 0) {
      result.push({
        year,
        days,
        startDate: periodStart,
        endDate: periodEnd,
      });
    }
  }

  return result;
}

// 计算年度假期统计
export function getYearlyEntitlement(
  year: number,
  employmentStartDate?: string,
  config: EntitlementConfig = DEFAULT_ENTITLEMENT
): { statutoryTotal: number; contractualTotal: number } {
  if (!employmentStartDate) {
    return {
      statutoryTotal: config.statutoryDays,
      contractualTotal: config.contractualDays,
    };
  }

  const start = parseDate(employmentStartDate);
  const startYear = start.getFullYear();
  const startMonthIndex = start.getMonth(); // 0-11

  if (year < startYear) {
    return { statutoryTotal: 0, contractualTotal: 0 };
  }

  if (year === startYear) {
    const monthsEligible = 12 - startMonthIndex;
    return {
      statutoryTotal: Math.ceil((config.statutoryDays * monthsEligible) / 12),
      contractualTotal: Math.ceil((config.contractualDays * monthsEligible) / 12),
    };
  }

  return {
    statutoryTotal: config.statutoryDays,
    contractualTotal: config.contractualDays,
  };
}

export function calculateYearlyStats(
  records: VacationRecord[],
  year: number,
  carryOverFromPreviousYear: number = 0,
  employmentStartDate?: string,
  config: EntitlementConfig = DEFAULT_ENTITLEMENT
): YearlyVacationStats {
  // 筛选该年度的假期记录（确保类型一致）
  const yearRecords = records.filter(r => Number(r.year) === Number(year));

  // 结转假期截止日期（当年3月31日）
  const carryOverDeadline = `${year}-${config.carryOverDeadline}`;

  // 区分3月31日前后的法定假期使用量（结转天数优先抵扣截止日前的假期）
  let statutoryUsedBeforeDeadline = 0;
  let statutoryUsedAfterDeadline = 0;
  let contractualUsed = 0;

  yearRecords.forEach(record => {
    if (record.type === 'statutory') {
      if (record.startDate <= carryOverDeadline) {
        statutoryUsedBeforeDeadline += record.workDays;
      } else {
        statutoryUsedAfterDeadline += record.workDays;
      }
    } else {
      contractualUsed += record.workDays;
    }
  });

  // 结转天数优先用于3月31日前的假期，未用完部分3月31日过期
  const carryOverUsed = Math.min(carryOverFromPreviousYear, statutoryUsedBeforeDeadline);
  const carryOverExpired = Math.max(0, carryOverFromPreviousYear - carryOverUsed);
  const statutoryUsed = statutoryUsedBeforeDeadline + statutoryUsedAfterDeadline;

  // 计算剩余
  const entitlement = getYearlyEntitlement(year, employmentStartDate, config);
  const statutoryTotal = entitlement.statutoryTotal + carryOverFromPreviousYear;
  const contractualTotal = entitlement.contractualTotal;

  return {
    year,
    statutoryTotal,
    contractualTotal,
    statutoryUsed,
    contractualUsed,
    statutoryRemaining: Math.max(0, statutoryTotal - statutoryUsed - carryOverExpired),
    contractualRemaining: Math.max(0, contractualTotal - contractualUsed),
    carryOver: carryOverFromPreviousYear,
    carryOverUsed,
    carryOverExpired,
  };
}

// 检查某个日期是否在结转有效期内（法定假期可结转15个月）
export function isWithinCarryOverPeriod(originalYear: number, currentDate: Date): boolean {
  // 法定假期可以结转到下一年的3月31日
  const carryOverDeadline = new Date(originalYear + 1, 2, 31); // 3月31日
  return currentDate <= carryOverDeadline;
}

// 计算结转假期（法定假期因病未休可结转15个月）
export function calculateCarryOver(
  records: VacationRecord[],
  fromYear: number,
  employmentStartDate?: string,
  config: EntitlementConfig = DEFAULT_ENTITLEMENT
): number {
  const stats = calculateYearlyStats(records, fromYear, 0, employmentStartDate, config);
  // 只有法定假期可以结转
  return stats.statutoryRemaining;
}

// 本地存储键
const STORAGE_KEY = 'urlaub_manager_data';

// 备份/恢复涉及的所有 localStorage key —— 与 App.tsx / i18n.ts / 各 useState 初值保持一致。
// 新增 key 时记得同步加进来，否则备份文件不会包含它。
export const ALL_STORAGE_KEYS = [
  'urlaub_manager_data',
  'urlaub_employment_start',
  'urlaub_language',
  'urlaub_region',
  'urlaub_selected_year',
] as const;

export interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, string>;
}

export function exportAllData(): BackupFile {
  const data: Record<string, string> = {};
  for (const key of ALL_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

// 校验并把备份内容写回 localStorage。返回写入了多少条 key（供 UI 提示）。
// 任何非预期结构都抛错，由调用方决定怎么提示用户。
export function importAllData(parsed: unknown): { count: number } {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('invalid backup file');
  }
  const root = parsed as { data?: unknown };
  if (!root.data || typeof root.data !== 'object') {
    throw new Error('missing data field');
  }
  const data = root.data as Record<string, unknown>;
  let count = 0;
  for (const key of ALL_STORAGE_KEYS) {
    if (key in data) {
      const value = data[key];
      if (typeof value === 'string') {
        localStorage.setItem(key, value);
        count++;
      }
    }
  }
  if (count === 0) {
    throw new Error('no recognised keys');
  }
  return { count };
}

// 保存数据到本地存储
export function saveToStorage(records: VacationRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// 旧版本会把本地化后缀写入 description，这里在加载时做一次性迁移：
// - 检测到「（结转优先）/(carry-over first)」时设置 isCarryOver = true
// - 删除自动生成的后缀（结转优先/合同假期/法定假期，及其英文对应）
// - 删除按年拆分时自动追加的「(YYYY年部分) / (Part of YYYY)」标记
// - 默认占位词 "假期" / "Vacation" 视为空备注
function migrateRecord(raw: Partial<VacationRecord> & { description?: string }): VacationRecord {
  const original = raw.description ?? '';
  const carryOverHinted =
    original.includes('（结转优先）') || /\(carry-over first\)/i.test(original);

  const cleaned = original
    .replace(/（结转优先）/g, '')
    .replace(/（合同假期）/g, '')
    .replace(/（法定假期）/g, '')
    .replace(/\s*\(carry-over first\)/gi, '')
    .replace(/\s*\(contractual\)/gi, '')
    .replace(/\s*\(statutory\)/gi, '')
    .replace(/\s*\(\d+年部分\)/g, '')
    .replace(/\s*\(Part of \d+\)/gi, '')
    .trim();

  const isPlaceholderOnly = cleaned === '假期' || cleaned === 'Vacation';
  const description = isPlaceholderOnly ? '' : cleaned;

  return {
    id: String(raw.id ?? ''),
    startDate: String(raw.startDate ?? ''),
    endDate: String(raw.endDate ?? ''),
    workDays: Number(raw.workDays ?? 0),
    description,
    type: (raw.type as VacationRecord['type']) ?? 'statutory',
    isCarryOver: raw.isCarryOver === true || (carryOverHinted && raw.type !== 'contractual'),
    year: Number(raw.year ?? new Date().getFullYear()),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

// 从本地存储加载数据
export function loadFromStorage(): VacationRecord[] {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(migrateRecord);
  } catch {
    return [];
  }
}

// 格式化显示日期 (德国格式 DD.MM.YYYY)
export function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
}

// 短日期 (DD.MM.) — 用在已经有年份上下文的列表里
export function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${day}.${month}.`;
}

// 获取月份名称
export function getMonthName(month: number): string {
  const months = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];
  return months[month];
}
