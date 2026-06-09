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
