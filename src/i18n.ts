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
  'header.signedInAs': '当前登录：{name}',

  'settings.title': '⚙️ 设置',
  'settings.employmentStartLabel': '入职日期',
  'settings.employmentStartHint': '用于按入职月份比例计算入职当年的假期额度。设置之后可以随时修改。',
  'settings.save': '保存',
  'settings.cancel': '取消',
  'settings.backupTitle': '💾 备份与恢复',
  'settings.backupHint': '导出会把你的所有请假记录保存为 JSON 文件。导入会把文件中的记录追加到现有数据上（不会覆盖），也兼容旧版（localStorage 时代）的备份文件。',
  'settings.export': '📤 导出备份',
  'settings.import': '📥 导入备份',
  'settings.importConfirm': '将把备份文件中的 {n} 条记录添加到你现有的数据上（不会删除任何现有记录）。继续吗？',
  'settings.importSuccess': '导入成功，添加了 {n} 条记录。',
  'settings.importError': '无法读取备份文件，请确认它是本应用导出的 JSON 文件。',
  'settings.importStartApplied': '已自动应用备份中的入职日期（{date}）。',
  'settings.importStartConflict': '备份中的入职日期为 {date}，与当前设置不同——请在设置中确认。',

  // auth
  'auth.title': '登录 Urlaub',
  'auth.subtitle': '管理你的假期',
  'auth.loginTab': '登录',
  'auth.signupTab': '注册',
  'auth.email': '邮箱',
  'auth.password': '密码',
  'auth.displayName': '昵称（可选）',
  'auth.submitLogin': '登录',
  'auth.submitSignup': '创建账号',
  'auth.checkEmail': '请查收邮件确认账号，然后登录。',
  'auth.errorInvalidCredentials': '邮箱或密码错误。',
  'auth.errorWeakPassword': '密码至少需要 6 个字符。',
  'auth.errorGeneric': '出错了，请重试。',
  'auth.deactivated': '你的账号已被停用，请联系管理员。',
  'auth.signOut': '退出登录',
  'auth.loginHint': '欢迎回来，登录以继续。',
  'auth.signupHint': '创建账号，开始记录假期。',
  'auth.featureStatutory': '法定与合同假期',
  'auth.featureHolidays': '按地区公共假日',
  'auth.featureCarryover': '结转追踪',
  // navigation
  'nav.dashboard': '面板',
  'nav.admin': '管理',
  'nav.main': '主导航',
  // common
  'common.loading': '加载中…',
  'common.saveFailed': '保存失败，请重试。',
  'common.loadFailed': '数据加载失败，请刷新页面。',
  // admin
  'admin.title': '管理后台',
  'admin.subtitle': '管理用户账号与全局假期配额设置。',
  'admin.statUsers': '注册用户',
  'admin.statActive': '活跃账号',
  'admin.you': '你',
  'admin.settingsLead': '这些设置适用于所有用户。在下方输入框中修改数值后点击保存。',
  'admin.daysUnit': '天',
  'admin.deadlineHint': '格式：MM-DD，例如 03-31',
  'admin.usersTitle': '用户',
  'admin.colEmail': '邮箱',
  'admin.colName': '昵称',
  'admin.colRole': '角色',
  'admin.colStatus': '状态',
  'admin.colUsage': '今年已用',
  'admin.colActions': '操作',
  'admin.roleAdmin': '管理员',
  'admin.roleUser': '用户',
  'admin.statusActive': '正常',
  'admin.statusInactive': '已停用',
  'admin.promote': '设为管理员',
  'admin.demote': '取消管理员',
  'admin.deactivate': '停用',
  'admin.activate': '启用',
  'admin.viewRecords': '记录',
  'admin.recordsOf': '假期记录 — {email}',
  'admin.noRecords': '暂无记录。',
  'admin.usageSummary': '已用 {used} / {total} 天',
  'admin.settingsTitle': '全局设置',
  'admin.statutoryDays': '法定假期天数',
  'admin.contractualDays': '合同假期天数',
  'admin.carryOverDeadline': '结转截止日（MM-DD）',
  'admin.save': '保存设置',
  'admin.saved': '设置已保存。',
  'admin.confirmDeleteRecord': '删除这条记录？',

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
};

const en: Dict = {
  'app.title': 'Urlaubsverwaltung',
  'app.subtitle': 'Vacation Management',
  'app.footer': 'Vacation Management for {region} · {year}',

  'header.language': 'Language',
  'header.region': 'Region',
  'header.settings': 'Settings',
  'header.signedInAs': 'Signed in as {name}',

  'settings.title': '⚙️ Settings',
  'settings.employmentStartLabel': 'Employment start date',
  'settings.employmentStartHint': 'Used to pro-rate your vacation entitlement for the year you joined. You can change this anytime.',
  'settings.save': 'Save',
  'settings.cancel': 'Cancel',
  'settings.backupTitle': '💾 Backup & restore',
  'settings.backupHint': 'Export saves all your vacation records as a JSON file. Import adds the records from a file on top of your existing data (nothing is overwritten). Old backups from the localStorage version also work.',
  'settings.export': '📤 Export backup',
  'settings.import': '📥 Import backup',
  'settings.importConfirm': 'This will add the {n} record(s) from the backup file to your existing data (no existing records are removed). Continue?',
  'settings.importSuccess': 'Import successful, {n} record(s) added.',
  'settings.importError': 'Could not read the backup file. Please make sure it is a JSON file exported from this app.',
  'settings.importStartApplied': 'Employment start date from backup applied ({date}).',
  'settings.importStartConflict': 'Backup has employment start {date} — different from your current setting. Check Settings if totals look wrong.',

  // auth
  'auth.title': 'Sign in to Urlaub',
  'auth.subtitle': 'Track your vacation days',
  'auth.loginTab': 'Sign in',
  'auth.signupTab': 'Create account',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.displayName': 'Display name (optional)',
  'auth.submitLogin': 'Sign in',
  'auth.submitSignup': 'Create account',
  'auth.checkEmail': 'Check your email to confirm your account, then sign in.',
  'auth.errorInvalidCredentials': 'Invalid email or password.',
  'auth.errorWeakPassword': 'Password must be at least 6 characters.',
  'auth.errorGeneric': 'Something went wrong. Please try again.',
  'auth.deactivated': 'Your account has been deactivated. Contact an administrator.',
  'auth.signOut': 'Sign out',
  'auth.loginHint': 'Welcome back — sign in to continue.',
  'auth.signupHint': 'Create an account to start tracking days off.',
  'auth.featureStatutory': 'Statutory & contractual days',
  'auth.featureHolidays': 'Public holidays by region',
  'auth.featureCarryover': 'Carry-over tracking',
  // navigation
  'nav.dashboard': 'Dashboard',
  'nav.admin': 'Admin',
  'nav.main': 'Main navigation',
  // common
  'common.loading': 'Loading…',
  'common.saveFailed': 'Saving failed. Please try again.',
  'common.loadFailed': 'Loading data failed. Please reload the page.',
  // admin
  'admin.title': 'Administration',
  'admin.subtitle': 'Manage user accounts and global vacation entitlement settings.',
  'admin.statUsers': 'Registered users',
  'admin.statActive': 'Active accounts',
  'admin.you': 'You',
  'admin.settingsLead': 'These settings apply to all users. Edit the fields below, then save.',
  'admin.daysUnit': 'days',
  'admin.deadlineHint': 'Format: MM-DD, e.g. 03-31',
  'admin.usersTitle': 'Users',
  'admin.colEmail': 'Email',
  'admin.colName': 'Name',
  'admin.colRole': 'Role',
  'admin.colStatus': 'Status',
  'admin.colUsage': 'Used this year',
  'admin.colActions': 'Actions',
  'admin.roleAdmin': 'Admin',
  'admin.roleUser': 'User',
  'admin.statusActive': 'Active',
  'admin.statusInactive': 'Deactivated',
  'admin.promote': 'Make admin',
  'admin.demote': 'Remove admin',
  'admin.deactivate': 'Deactivate',
  'admin.activate': 'Activate',
  'admin.viewRecords': 'Records',
  'admin.recordsOf': 'Vacation records — {email}',
  'admin.noRecords': 'No records.',
  'admin.usageSummary': '{used} of {total} days',
  'admin.settingsTitle': 'Global settings',
  'admin.statutoryDays': 'Statutory vacation days',
  'admin.contractualDays': 'Contractual vacation days',
  'admin.carryOverDeadline': 'Carry-over deadline (MM-DD)',
  'admin.save': 'Save settings',
  'admin.saved': 'Settings saved.',
  'admin.confirmDeleteRecord': 'Delete this record?',

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
