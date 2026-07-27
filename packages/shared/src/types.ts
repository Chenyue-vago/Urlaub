// 假期记录（单一 28 天池，不再区分法定/合同类型）
export interface VacationRecord {
  id: string;
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
  workDays: number;  // 实际工作日数量（排除周末和公共假日）
  description: string; // 用户原始备注
  /**
   * 是否消耗的是上一年结转的假期。结转假期必须在 config.carryOverDeadline
   * （默认次年 12-31）前休完，展示时显示为「结转 / Carry-over」。
   */
  isCarryOver?: boolean;
  year: number;      // 该假期属于哪一年的配额
  createdAt: string;
}

// 公共假日
export interface PublicHoliday {
  date: string;
  name: string;     // 德语原名
  nameEn: string;   // 英文名
  nameZh: string;   // 中文名
}

// 年度假期统计（单一 28 天池 + 结转）
export interface YearlyVacationStats {
  year: number;
  total: number;           // 当年额度（默认 28，入职当年按比例缩减）
  used: number;            // 当年已用（含消耗结转的部分）
  remaining: number;       // 剩余可用 = total + carryOver − used − carryOverExpired
  carryOver: number;       // 从上年结转的天数
  carryOverUsed: number;   // 结转天数中已被使用的部分
  carryOverExpired: number; // 结转天数中截止日期后过期未用的部分
}

// 假期额度配置：单一年度总额 + 结转截止日
export interface EntitlementConfig {
  totalDays: number;         // 年度假期总天数，默认 28
  carryOverDeadline: string; // 结转截止日 "MM-DD"，默认次年同月日 "12-31"
}

export const DEFAULT_ENTITLEMENT: EntitlementConfig = {
  totalDays: 28,
  carryOverDeadline: '12-31',
};
