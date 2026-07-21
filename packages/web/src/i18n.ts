import { createContext, createElement, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Locale = 'zh' | 'en';

export const LOCALES: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: 'zh', label: '中文', nativeLabel: '中文' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
];

export const DEFAULT_LOCALE: Locale = 'en';

const STORAGE_KEY = 'urlaub_language';

type Dict = Record<string, string>;

const zh: Dict = {
  'app.title': 'Urlaubsverwaltung',
  'app.subtitle': '假期管理系统',
  'app.footer': '{region} 假期管理系统 · {year}',

  'header.language': '语言',
  'header.region': '地区',
  'header.settings': '设置',

  'settings.title': '⚙️ 设置',
  'settings.employmentStartLabel': '入职日期',
  'settings.employmentStartHint': '用于按入职月份比例计算入职当年的假期额度。设置之后可以随时修改。',
  'settings.save': '保存',
  'settings.cancel': '取消',

  'settings.backupTitle': '💾 备份与恢复',
  'settings.backupHint': '建议定期导出备份。换浏览器、换设备、换端口或清理浏览器数据时，先在旧地方导出，再到新地方导入。',
  'settings.export': '📤 导出备份',
  'settings.import': '📥 导入备份',
  'settings.importConfirm': '导入会用备份文件中的内容覆盖当前的所有数据（包括请假记录、入职日期、语言和地区设置）。继续吗？',
  'settings.importSuccess': '导入成功，恢复了 {n} 项数据。页面将刷新以应用更改。',
  'settings.importError': '无法读取备份文件，请确认它是本应用导出的 JSON 文件。',

  'welcome.title': '👋 欢迎使用',
  'welcome.body': '请先填写你在公司的入职日期。系统会按入职月份按比例计算你入职当年的假期额度（之后年份按完整 28 天计算）。这个值之后可以在右上角 ⚙️ 设置里修改。',
  'welcome.continue': '开始使用',
  'welcome.required': '请选择入职日期',

  'actions.addRecord': '记录假期',
  'actions.showHolidays': '查看公共假日',
  'actions.hideHolidays': '隐藏公共假日',

  'stats.yearlyOverview': '年度假期概览',
  'stats.usedDays': '已用 {n} 天',
  'stats.remainingDays': '剩余 {n} 天',
  'stats.statutory': '法定假期 (Gesetzlich)',
  'stats.contractual': '合同假期 (Vertraglich)',
  'stats.statutoryRemaining': '法定假期剩余',
  'stats.contractualRemaining': '合同假期剩余',
  'stats.daysShort': '{n} 天',
  'stats.usedOf': '{used} / {total} 天',
  'stats.totalDays': '总额 {n} 天',
  'stats.includesCarryOver': '（含结转 {n} 天）',
  'stats.expiredCarryOver': '，已过期 {n} 天',
  'stats.carryoverHint': '结转部分须在次年3月31日前使用',
  'stats.contractualExpiryHint': '12月31日过期',

  'modal.addTitle': '📅 记录假期',
  'modal.startDate': '开始日期',
  'modal.endDate': '结束日期',
  'modal.dateSelected': '已选择日期：{start} — {end}',
  'modal.dash': '—',
  'modal.consumeDays': '消耗假期天数：',
  'modal.daysValue': '{n} 天',
  'modal.carryoverHint': '3月31日前有结转法定假期，将优先使用结转天数',
  'modal.descLabel': '备注（可选）',
  'modal.descPlaceholder': '例如：圣诞假期、回国探亲...',
  'modal.cancel': '取消',
  'modal.save': '保存',

  'alert.invalidDateRange': '请选择有效的日期范围',
  'alert.noWorkDays': '所选日期范围内没有工作日',
  'alert.confirmDelete': '确定要删除这条记录吗？',

  'records.holidaysTitle': '🎌 {year}年 {region} 公共假日',
  'records.title': '📋 {year}年 假期记录',
  'records.summary': '本年度：已用 {statutory} 天法定 + {contractual} 天合同 = 共 {total} 天',
  'records.empty': '暂无假期记录',
  'records.emptyHint': '点击"记录假期"开始添加',
  'records.statutory': '法定',
  'records.contractual': '合同',
  'records.carryover': '结转',
  'records.belongsToYear': '计入{year}年',
  'records.consumeStatutory': '占用 {n} 天法定假期',
  'records.consumeContractual': '占用 {n} 天合同假期',
  'records.consumeCarryover': '占用 {n} 天结转假期',
  'records.workdayDates': '具体日期：{dates}',
  'records.deleteTitle': '删除记录',

  'rules.title': '📖 假期规则说明',
  'rules.totalTitle': '年假总额',
  'rules.totalBody': '每年28天假期（基于五天工作周）= 20天法定假期 + 8天合同额外假期',
  'rules.expiryTitle': '假期过期',
  'rules.expiryBodyContractual': '合同假期',
  'rules.expiryBodyContractualDesc': '：每年12月31日过期，不可结转',
  'rules.expiryBodyStatutory': '法定假期',
  'rules.expiryBodyStatutoryDesc': '：如因病无法休假，可结转至次年3月31日（15个月）',
  'rules.leaveTitle': '离职规则',
  'rules.leaveBody': '下半年离职时，假期按月份比例计算（不低于法定最低假期）；剩余假期需在离职期内休完，合同额外假期在离职时失效',

  'nav.home': '我的假期',
  'nav.team': '团队日历',
  'nav.admin': '管理',

  'status.pending': '待审批',
  'status.approved': '已批准',
  'status.rejected': '已拒绝',
  'status.cancelled': '已取消',

  'type.statutory': '法定假期',
  'type.contractual': '合同假期',

  'dashboard.requestVacation': '申请假期',
  'dashboard.cancelRequest': '取消申请',
  'dashboard.confirmCancel': '确定要取消这条申请吗？',
  'dashboard.reasonLabel': '理由（可选）',
  'dashboard.typeLabel': '假期类型',
  'dashboard.submit': '提交',
  'dashboard.carryOverLabel': '结转',

  'team.comingSoon': '团队日历 — 即将上线 (M7b)',
  'admin.comingSoon': '管理 — 即将上线 (M7b)',

  'errors.insufficient_balance': '假期余额不足，无法提交此申请',
  'errors.forbidden': '你没有权限执行此操作',
  'errors.account_deactivated': '你的账号已被停用',
  'errors.email_domain_not_allowed': '该邮箱域名不允许注册',
  'errors.validation_error': '提交的信息有误，请检查后重试',
  'errors.invalid_transition': '该请求当前状态不允许此操作',
  'errors.last_admin': '不能移除最后一位管理员',
  'errors.concurrent_request': '操作冲突，请刷新后重试',
  'errors.generic': '发生错误，请重试',
};

const en: Dict = {
  'app.title': 'Urlaubsverwaltung',
  'app.subtitle': 'Vacation Management',
  'app.footer': 'Vacation Management for {region} · {year}',

  'header.language': 'Language',
  'header.region': 'Region',
  'header.settings': 'Settings',

  'settings.title': '⚙️ Settings',
  'settings.employmentStartLabel': 'Employment start date',
  'settings.employmentStartHint': 'Used to pro-rate your vacation entitlement for the year you joined. You can change this anytime.',
  'settings.save': 'Save',
  'settings.cancel': 'Cancel',

  'settings.backupTitle': '💾 Backup & restore',
  'settings.backupHint': 'Export a backup once in a while. Before changing browser, machine, port or clearing site data, export from the old place and import on the new one.',
  'settings.export': '📤 Export backup',
  'settings.import': '📥 Import backup',
  'settings.importConfirm': 'Importing will overwrite all your current data (vacation records, employment start date, language and region) with what is in the backup file. Continue?',
  'settings.importSuccess': 'Import successful, {n} item(s) restored. The page will reload to apply the changes.',
  'settings.importError': 'Could not read the backup file. Please make sure it is a JSON file exported from this app.',

  'welcome.title': '👋 Welcome',
  'welcome.body': 'First, tell us when you joined the company. Your entitlement for the join year will be pro-rated by the number of remaining months (later years use the full 28 days). You can change this later via the ⚙️ Settings button in the top right.',
  'welcome.continue': 'Get started',
  'welcome.required': 'Please pick an employment start date',

  'actions.addRecord': 'Record Vacation',
  'actions.showHolidays': 'Show Public Holidays',
  'actions.hideHolidays': 'Hide Public Holidays',

  'stats.yearlyOverview': 'Yearly Overview',
  'stats.usedDays': 'Used {n} days',
  'stats.remainingDays': 'Remaining {n} days',
  'stats.statutory': 'Statutory (Gesetzlich)',
  'stats.contractual': 'Contractual (Vertraglich)',
  'stats.statutoryRemaining': 'Statutory remaining',
  'stats.contractualRemaining': 'Contractual remaining',
  'stats.daysShort': '{n} days',
  'stats.usedOf': '{used} / {total} days',
  'stats.totalDays': 'Total {n} days',
  'stats.includesCarryOver': ' (incl. {n} carried over)',
  'stats.expiredCarryOver': ', {n} expired',
  'stats.carryoverHint': 'Carry-over must be used by Mar 31 of the next year',
  'stats.contractualExpiryHint': 'Expires Dec 31',

  'modal.addTitle': '📅 Record Vacation',
  'modal.startDate': 'Start date',
  'modal.endDate': 'End date',
  'modal.dateSelected': 'Selected: {start} — {end}',
  'modal.dash': '—',
  'modal.consumeDays': 'Vacation days used:',
  'modal.daysValue': '{n} days',
  'modal.carryoverHint': 'Carry-over is prioritized for vacations ending on or before Mar 31',
  'modal.descLabel': 'Note (optional)',
  'modal.descPlaceholder': 'e.g. Christmas, family visit...',
  'modal.cancel': 'Cancel',
  'modal.save': 'Save',

  'alert.invalidDateRange': 'Please select a valid date range',
  'alert.noWorkDays': 'No working days in the selected range',
  'alert.confirmDelete': 'Delete this record?',

  'records.holidaysTitle': '🎌 Public Holidays {year} — {region}',
  'records.title': '📋 Vacation Records {year}',
  'records.summary': 'This year: {statutory} statutory + {contractual} contractual = {total} days used',
  'records.empty': 'No vacation records yet',
  'records.emptyHint': 'Click "Record Vacation" to add one',
  'records.statutory': 'Statutory',
  'records.contractual': 'Contractual',
  'records.carryover': 'Carry-over',
  'records.belongsToYear': 'Counted in {year}',
  'records.consumeStatutory': 'Takes {n} statutory days',
  'records.consumeContractual': 'Takes {n} contractual days',
  'records.consumeCarryover': 'Takes {n} carry-over days',
  'records.workdayDates': 'Days off: {dates}',
  'records.deleteTitle': 'Delete record',

  'rules.title': '📖 Vacation Rules',
  'rules.totalTitle': 'Yearly entitlement',
  'rules.totalBody': '28 days per year (based on 5-day work week) = 20 statutory + 8 contractual',
  'rules.expiryTitle': 'Expiry',
  'rules.expiryBodyContractual': 'Contractual',
  'rules.expiryBodyContractualDesc': ': expires Dec 31, no carry-over',
  'rules.expiryBodyStatutory': 'Statutory',
  'rules.expiryBodyStatutoryDesc': ': if unused due to illness, can be carried to Mar 31 of the next year (15 months)',
  'rules.leaveTitle': 'On leaving the company',
  'rules.leaveBody': 'When leaving in the second half of the year, vacation is prorated (not below the statutory minimum); remaining days must be taken before the last day; contractual extras lapse on the leaving date.',

  'nav.home': 'My Dashboard',
  'nav.team': 'Team Timeline',
  'nav.admin': 'Admin',

  'status.pending': 'Pending',
  'status.approved': 'Approved',
  'status.rejected': 'Rejected',
  'status.cancelled': 'Cancelled',

  'type.statutory': 'Statutory',
  'type.contractual': 'Contractual',

  'dashboard.requestVacation': 'Request Vacation',
  'dashboard.cancelRequest': 'Cancel request',
  'dashboard.confirmCancel': 'Cancel this request?',
  'dashboard.reasonLabel': 'Reason (optional)',
  'dashboard.typeLabel': 'Vacation type',
  'dashboard.submit': 'Submit',
  'dashboard.carryOverLabel': 'Carry-over',

  'team.comingSoon': 'Team Timeline — Coming soon (M7b)',
  'admin.comingSoon': 'Admin — Coming soon (M7b)',

  'errors.insufficient_balance': 'You do not have enough vacation balance for this request',
  'errors.forbidden': 'You are not allowed to perform this action',
  'errors.account_deactivated': 'Your account has been deactivated',
  'errors.email_domain_not_allowed': 'This email domain is not allowed',
  'errors.validation_error': 'The submitted data is invalid, please check and try again',
  'errors.invalid_transition': 'This request cannot be changed from its current status',
  'errors.last_admin': 'Cannot remove the last remaining admin',
  'errors.concurrent_request': 'This conflicted with another change, please refresh and retry',
  'errors.generic': 'Something went wrong, please try again',
};

const DICTS: Record<Locale, Dict> = { zh, en };

function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_m, k) => {
    return params[k] !== undefined ? String(params[k]) : `{${k}}`;
  });
}

export type Translator = (key: string, params?: Record<string, string | number>) => string;

export function getTranslator(locale: Locale): Translator {
  const dict = DICTS[locale] || DICTS[DEFAULT_LOCALE];
  const fallback = DICTS[DEFAULT_LOCALE];
  return (key, params) => {
    const template = dict[key] ?? fallback[key] ?? key;
    return format(template, params);
  };
}

interface LanguageContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translator;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function loadLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    // ignore
  }
  return DEFAULT_LOCALE;
}

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => loadLocale());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
      document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    } catch {
      // ignore
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLocale, t: getTranslator(locale) }),
    [locale, setLocale]
  );

  return createElement(LanguageContext.Provider, { value }, children);
}

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return { locale: DEFAULT_LOCALE, setLocale: () => {}, t: getTranslator(DEFAULT_LOCALE) };
  }
  return ctx;
}
