// 假期类型
export type VacationType = 'statutory' | 'contractual';

// 假期记录
export interface VacationRecord {
  id: string;
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
  workDays: number;  // 实际工作日数量（排除周末和公共假日）
  description: string;
  type: VacationType;
  year: number;      // 该假期属于哪一年的配额
  createdAt: string;
}

// 公共假日
export interface PublicHoliday {
  date: string;
  name: string;
  nameZh: string;
}

// 年度假期统计
export interface YearlyVacationStats {
  year: number;
  statutoryTotal: number;      // 法定假期总数 (20天)
  contractualTotal: number;    // 合同额外假期 (8天)
  statutoryUsed: number;       // 法定假期已用
  contractualUsed: number;     // 合同额外假期已用
  statutoryRemaining: number;  // 法定假期剩余
  contractualRemaining: number; // 合同额外假期剩余
  carryOver: number;           // 从上年结转的法定假期
  carryOverUsed: number;       // 结转假期中已被使用的天数
  carryOverExpired: number;    // 结转假期中3月31日后过期未用的天数
}

// 应用状态
export interface AppState {
  records: VacationRecord[];
  currentYear: number;
  startYear: number; // 入职年份
}
