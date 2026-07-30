import { VacationRecord, YearlyVacationStats, EntitlementConfig, DEFAULT_ENTITLEMENT } from './types.js';
import { getPublicHolidays, isPublicHoliday } from './holidays.js';
import { RegionCode, DEFAULT_REGION } from './regions.js';
import { parseDate, formatDateString, isWeekend } from './dates.js';

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

// 计算年度假期额度（单一 28 天池），按 config 参数化。入职当年按月份比例缩减。
export function getYearlyEntitlement(
  year: number,
  config: EntitlementConfig = DEFAULT_ENTITLEMENT,
  employmentStartDate?: string
): { total: number } {
  if (!employmentStartDate) {
    return { total: config.totalDays };
  }

  const start = parseDate(employmentStartDate);
  const startYear = start.getFullYear();
  const startMonthIndex = start.getMonth(); // 0-11

  if (year < startYear) {
    return { total: 0 };
  }

  if (year === startYear) {
    const monthsEligible = 12 - startMonthIndex;
    return { total: Math.ceil((config.totalDays * monthsEligible) / 12) };
  }

  return { total: config.totalDays };
}

export function calculateYearlyStats(
  records: VacationRecord[],
  year: number,
  carryOverFromPreviousYear: number = 0,
  employmentStartDate?: string,
  config: EntitlementConfig = DEFAULT_ENTITLEMENT
): YearlyVacationStats {
  // 筛选该年度的假期记录
  const yearRecords = records.filter(r => Number(r.year) === Number(year));

  // 结转假期截止日期（默认当年 12-31，可通过 config.carryOverDeadline 覆盖）。
  // 结转天数必须在此日期前休完，之后过期。
  const carryOverDeadline = `${year}-${config.carryOverDeadline}`;

  // 区分截止日前后的使用量（结转天数优先抵扣截止日前的假期）
  let usedBeforeDeadline = 0;
  let usedAfterDeadline = 0;

  yearRecords.forEach(record => {
    if (record.startDate <= carryOverDeadline) {
      usedBeforeDeadline += record.workDays;
    } else {
      usedAfterDeadline += record.workDays;
    }
  });

  // 结转天数优先用于截止日前的假期，未用完部分在截止日后过期
  const carryOverUsed = Math.min(carryOverFromPreviousYear, usedBeforeDeadline);
  const carryOverExpired = Math.max(0, carryOverFromPreviousYear - carryOverUsed);
  const used = usedBeforeDeadline + usedAfterDeadline;

  // 当年额度 + 结转 叠加为总可用
  const { total } = getYearlyEntitlement(year, config, employmentStartDate);
  const available = total + carryOverFromPreviousYear;

  return {
    year,
    total,
    used,
    remaining: Math.max(0, available - used - carryOverExpired),
    carryOver: carryOverFromPreviousYear,
    carryOverUsed,
    carryOverExpired,
  };
}

// 检查某个日期是否在结转有效期内（结转到 config.carryOverDeadline，默认次年 12-31）
export function isWithinCarryOverPeriod(
  originalYear: number,
  currentDate: Date,
  config: EntitlementConfig = DEFAULT_ENTITLEMENT
): boolean {
  const [month, day] = config.carryOverDeadline.split('-').map(Number);
  const carryOverDeadline = new Date(originalYear + 1, month - 1, day);
  return currentDate <= carryOverDeadline;
}

// 计算结转到下一年的假期。规则（不链式结转）：只有当年【基础额度】未用完的
// 部分能滚到下一年；从上一年结转进来的天数（`carryInFromPreviousYear`）当年
// 不用就在截止日过期，不再向后链式结转。由于申请优先消耗结转（见
// `allocateLeaveDays`），当年用量先抵扣结转额度，剩余用量才抵扣基础额度。
// 因此：基础额度已用 = max(0, used − carryOverUsed)，结转出去 = total − 该值。
// 无天数上限。
export function calculateCarryOver(
  records: VacationRecord[],
  fromYear: number,
  employmentStartDate?: string,
  config: EntitlementConfig = DEFAULT_ENTITLEMENT,
  carryInFromPreviousYear: number = 0
): number {
  const stats = calculateYearlyStats(
    records,
    fromYear,
    carryInFromPreviousYear,
    employmentStartDate,
    config
  );
  const baseUsed = Math.max(0, stats.used - stats.carryOverUsed);
  return Math.max(0, stats.total - baseUsed);
}
