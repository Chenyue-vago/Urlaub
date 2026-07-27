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
  'stats.remainingLabel': '剩余假期',
  'stats.daysShort': '{n} 天',
  'stats.totalDays': '总额 {n} 天',
  'stats.includesCarryOver': '（含结转 {n} 天）',
  'stats.expiredCarryOver': '，已过期 {n} 天',
  'stats.carryoverHint': '未休完的天数结转至次年，可休至次年12月31日',

  'modal.addTitle': '📅 记录假期',
  'modal.startDate': '开始日期',
  'modal.endDate': '结束日期',
  'modal.dateSelected': '已选择日期：{start} — {end}',
  'modal.dash': '—',
  'modal.consumeDays': '消耗假期天数：',
  'modal.daysValue': '{n} 天',
  'modal.carryoverHint': '如有上年结转的天数，将优先使用结转天数',
  'modal.descLabel': '备注（可选）',
  'modal.descPlaceholder': '例如：圣诞假期、回国探亲...',
  'modal.cancel': '取消',
  'modal.save': '保存',

  'alert.invalidDateRange': '请选择有效的日期范围',
  'alert.noWorkDays': '所选日期范围内没有工作日',
  'alert.confirmDelete': '确定要删除这条记录吗？',

  'records.holidaysTitle': '🎌 {year}年 {region} 公共假日',
  'records.title': '📋 {year}年 假期记录',
  'records.summary': '本年度：共已用 {total} 天',
  'records.empty': '暂无假期记录',
  'records.emptyHint': '点击"记录假期"开始添加',
  'records.regular': '假期',
  'records.carryover': '结转',
  'records.belongsToYear': '计入{year}年',
  'records.consumeRegular': '占用 {n} 天假期',
  'records.consumeCarryover': '占用 {n} 天结转假期',
  'records.workdayDates': '具体日期：{dates}',
  'records.deleteTitle': '删除记录',

  'rules.title': '📖 假期规则说明',
  'rules.totalTitle': '年假总额',
  'rules.totalBody': '每年共 28 天假期（基于五天工作周）',
  'rules.expiryTitle': '结转与过期',
  'rules.expiryBody': '当年未休完的天数全部结转至次年，可休至次年 12 月 31 日；逾期未休即失效',
  'rules.leaveTitle': '离职规则',
  'rules.leaveBody': '下半年离职时，假期按月份比例计算；剩余假期需在离职期内休完',

  'nav.home': '我的假期',
  'nav.team': '团队日历',
  'nav.admin': '管理',

  'status.pending': '待审批',
  'status.approved': '已批准',
  'status.rejected': '已拒绝',
  'status.cancelled': '已取消',

  'dashboard.requestVacation': '申请假期',
  'dashboard.cancelRequest': '取消申请',
  'dashboard.confirmCancel': '确定要取消这条休假吗？取消后相应的假期天数会退回。',
  'dashboard.removeRecord': '从列表中移除',
  'dashboard.confirmRemove': '从你的列表中移除这条已取消的记录？（不影响审计记录）',
  'dashboard.reasonLabel': '理由（可选）',
  'dashboard.typeLabel': '假期类型',
  'dashboard.submit': '提交',
  'dashboard.carryOverLabel': '结转',

  'team.comingSoon': '团队日历 — 即将上线 (M7b)',
  'admin.comingSoon': '管理 — 即将上线 (M7b)',

  'team.title': '团队日历',
  'team.subtitle': '查看团队成员已批准的假期',
  'team.prevRange': '‹ 上个月',
  'team.nextRange': '下个月 ›',
  'team.thisMonth': '本月',
  'team.empty': '该时间段内没有假期安排',
  'team.rangeLabel': '{from} — {to}',

  'admin.title': '管理后台',
  'admin.subtitle': '审批申请、管理用户与全局设置',
  'admin.statUsers': '注册用户',
  'admin.statActive': '活跃账号',
  'admin.statPending': '待审批',
  'admin.you': '你',

  'admin.approvalsTitle': '待审批申请',
  'admin.approvalsEmpty': '当前没有待审批的申请',
  'admin.approve': '批准',
  'admin.reject': '拒绝',
  'admin.rejectPrompt': '请输入拒绝理由（必填）：',
  'admin.rejectNoteRequired': '拒绝时必须填写理由',
  'admin.requestedBy': '申请人',
  'admin.workDaysLabel': '{n} 个工作日',
  'admin.approveSuccess': '已批准该申请',
  'admin.rejectSuccess': '已拒绝该申请',
  'admin.actionFailed': '操作失败，请重试',

  'admin.usersTitle': '用户',
  'admin.colEmail': '邮箱',
  'admin.colRole': '角色',
  'admin.colStatus': '状态',
  'admin.colUsage': '今年已用',
  'admin.colActions': '操作',
  'admin.roleAdmin': '管理员',
  'admin.roleMember': '成员',
  'admin.statusActive': '正常',
  'admin.statusInactive': '已停用',
  'admin.promote': '设为管理员',
  'admin.demote': '取消管理员',
  'admin.deactivate': '停用',
  'admin.activate': '启用',
  'admin.viewRecords': '记录',
  'admin.recordsOf': '假期记录 — {email}',
  'admin.noRecords': '暂无记录',
  'admin.usageSummary': '已用 {used} 天',
  'admin.close': '关闭',

  'admin.inviteTitle': '邀请新用户',
  'admin.inviteEmailPlaceholder': '邮箱地址',
  'admin.inviteSubmit': '发送邀请',
  'admin.inviteSuccess': '邀请成功',

  'admin.settingsTitle': '全局设置',
  'admin.settingsLead': '这些设置适用于所有用户',
  'admin.daysUnit': '天',
  'admin.totalDays': '年度假期总天数',
  'admin.carryOverDeadline': '结转截止日（MM-DD）',
  'admin.deadlineHint': '格式：MM-DD，例如 12-31',
  'admin.save': '保存设置',
  'admin.saved': '设置已保存',
  'admin.settingsInvalid': '请检查输入的设置数值',

  'admin.auditTitle': '审计日志',
  'admin.auditEmpty': '暂无审计记录',
  'admin.auditActor': '操作人',
  'admin.auditAction': '操作',
  'admin.auditTime': '时间',
  'admin.auditDetails': '详情',
  'audit.detail.create_leave': '{actor} 申请了 {start} 至 {end} 的休假（{days} 天）',
  'audit.detail.record_leave': '{actor} 为 {target} 录入了 {start} 至 {end} 的休假（{days} 天，已批准）',
  'audit.detail.approve_leave': '{actor} 批准了 {target} 的 {start} 至 {end} 休假',
  'audit.detail.reject_leave': '{actor} 拒绝了 {target} 的 {start} 至 {end} 休假（理由：{note}）',
  'audit.detail.cancel_leave': '{actor} 取消了 {target} 的 {start} 至 {end} 休假',
  'audit.detail.change_role': '{actor} 把 {target} 的角色从 {from} 改为 {to}',
  'audit.detail.activate_user': '{actor} 启用了用户 {target}',
  'audit.detail.deactivate_user': '{actor} 停用了用户 {target}',
  'audit.detail.update_settings': '{actor} 更新了假期配置',
  'audit.detail.generic': '{actor} 执行了操作 {action}',
  'admin.loadMore': '加载更多',

  'errors.insufficient_balance': '假期余额不足，无法提交此申请',
  'errors.forbidden': '你没有权限执行此操作',
  'errors.account_deactivated': '你的账号已被停用',
  'errors.email_domain_not_allowed': '该邮箱域名不允许注册',
  'errors.validation_error': '提交的信息有误，请检查后重试',
  'errors.invalid_transition': '该请求当前状态不允许此操作',
  'errors.last_admin': '不能移除最后一位管理员',
  'errors.concurrent_request': '操作冲突，请刷新后重试',
  'errors.overlapping_request': '该时间段与你已有的休假申请重叠',
  'errors.generic': '发生错误，请重试',
  'errors.loadFailed': '加载失败，请重试',
  'errors.retry': '重试',

  'dashboard.loading': '加载中…',
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
  'stats.remainingLabel': 'Remaining',
  'stats.daysShort': '{n} days',
  'stats.totalDays': 'Total {n} days',
  'stats.includesCarryOver': ' (incl. {n} carried over)',
  'stats.expiredCarryOver': ', {n} expired',
  'stats.carryoverHint': 'Unused days carry over and can be taken until Dec 31 of the next year',

  'modal.addTitle': '📅 Record Vacation',
  'modal.startDate': 'Start date',
  'modal.endDate': 'End date',
  'modal.dateSelected': 'Selected: {start} — {end}',
  'modal.dash': '—',
  'modal.consumeDays': 'Vacation days used:',
  'modal.daysValue': '{n} days',
  'modal.carryoverHint': 'Carry-over days from last year are used first',
  'modal.descLabel': 'Note (optional)',
  'modal.descPlaceholder': 'e.g. Christmas, family visit...',
  'modal.cancel': 'Cancel',
  'modal.save': 'Save',

  'alert.invalidDateRange': 'Please select a valid date range',
  'alert.noWorkDays': 'No working days in the selected range',
  'alert.confirmDelete': 'Delete this record?',

  'records.holidaysTitle': '🎌 Public Holidays {year} — {region}',
  'records.title': '📋 Vacation Records {year}',
  'records.summary': 'This year: {total} days used',
  'records.empty': 'No vacation records yet',
  'records.emptyHint': 'Click "Record Vacation" to add one',
  'records.regular': 'Vacation',
  'records.carryover': 'Carry-over',
  'records.belongsToYear': 'Counted in {year}',
  'records.consumeRegular': 'Takes {n} days',
  'records.consumeCarryover': 'Takes {n} carry-over days',
  'records.workdayDates': 'Days off: {dates}',
  'records.deleteTitle': 'Delete record',

  'rules.title': '📖 Vacation Rules',
  'rules.totalTitle': 'Yearly entitlement',
  'rules.totalBody': '28 days total per year (based on a 5-day work week)',
  'rules.expiryTitle': 'Carry-over & expiry',
  'rules.expiryBody': 'Any unused days carry over to the next year and can be taken until Dec 31 of that year; unused days then lapse.',
  'rules.leaveTitle': 'On leaving the company',
  'rules.leaveBody': 'When leaving in the second half of the year, vacation is prorated; remaining days must be taken before the last day.',

  'nav.home': 'My Dashboard',
  'nav.team': 'Team Timeline',
  'nav.admin': 'Admin',

  'status.pending': 'Pending',
  'status.approved': 'Approved',
  'status.rejected': 'Rejected',
  'status.cancelled': 'Cancelled',

  'dashboard.requestVacation': 'Request Vacation',
  'dashboard.cancelRequest': 'Cancel request',
  'dashboard.confirmCancel': 'Cancel this leave? The vacation days will be returned to your balance.',
  'dashboard.removeRecord': 'Remove from list',
  'dashboard.confirmRemove': 'Remove this cancelled record from your list? (Audit records are unaffected.)',
  'dashboard.reasonLabel': 'Reason (optional)',
  'dashboard.typeLabel': 'Vacation type',
  'dashboard.submit': 'Submit',
  'dashboard.carryOverLabel': 'Carry-over',

  'team.comingSoon': 'Team Timeline — Coming soon (M7b)',
  'admin.comingSoon': 'Admin — Coming soon (M7b)',

  'team.title': 'Team Timeline',
  'team.subtitle': "See your team's approved vacations",
  'team.prevRange': '‹ Previous',
  'team.nextRange': 'Next ›',
  'team.thisMonth': 'This month',
  'team.empty': 'No vacations in this range',
  'team.rangeLabel': '{from} — {to}',

  'admin.title': 'Administration',
  'admin.subtitle': 'Review approvals, manage users and global settings',
  'admin.statUsers': 'Registered users',
  'admin.statActive': 'Active accounts',
  'admin.statPending': 'Pending approvals',
  'admin.you': 'You',

  'admin.approvalsTitle': 'Pending Approvals',
  'admin.approvalsEmpty': 'No pending requests',
  'admin.approve': 'Approve',
  'admin.reject': 'Reject',
  'admin.rejectPrompt': 'Enter a rejection note (required):',
  'admin.rejectNoteRequired': 'A note is required to reject a request',
  'admin.requestedBy': 'Requested by',
  'admin.workDaysLabel': '{n} work day(s)',
  'admin.approveSuccess': 'Request approved',
  'admin.rejectSuccess': 'Request rejected',
  'admin.actionFailed': 'Action failed, please try again',

  'admin.usersTitle': 'Users',
  'admin.colEmail': 'Email',
  'admin.colRole': 'Role',
  'admin.colStatus': 'Status',
  'admin.colUsage': 'Used this year',
  'admin.colActions': 'Actions',
  'admin.roleAdmin': 'Admin',
  'admin.roleMember': 'Member',
  'admin.statusActive': 'Active',
  'admin.statusInactive': 'Deactivated',
  'admin.promote': 'Make admin',
  'admin.demote': 'Remove admin',
  'admin.deactivate': 'Deactivate',
  'admin.activate': 'Activate',
  'admin.viewRecords': 'Records',
  'admin.recordsOf': 'Vacation records — {email}',
  'admin.noRecords': 'No records',
  'admin.usageSummary': '{used} days used',
  'admin.close': 'Close',

  'admin.inviteTitle': 'Invite a new user',
  'admin.inviteEmailPlaceholder': 'Email address',
  'admin.inviteSubmit': 'Send invite',
  'admin.inviteSuccess': 'Invite sent',

  'admin.settingsTitle': 'Global settings',
  'admin.settingsLead': 'These settings apply to all users',
  'admin.daysUnit': 'days',
  'admin.totalDays': 'Yearly vacation days',
  'admin.carryOverDeadline': 'Carry-over deadline (MM-DD)',
  'admin.deadlineHint': 'Format: MM-DD, e.g. 12-31',
  'admin.save': 'Save settings',
  'admin.saved': 'Settings saved',
  'admin.settingsInvalid': 'Please check the settings values',

  'admin.auditTitle': 'Audit Log',
  'admin.auditEmpty': 'No audit entries',
  'admin.auditActor': 'Actor',
  'admin.auditAction': 'Action',
  'admin.auditTime': 'Time',
  'admin.auditDetails': 'Details',
  'audit.detail.create_leave': '{actor} requested leave from {start} to {end} ({days} days)',
  'audit.detail.record_leave': '{actor} recorded leave for {target} from {start} to {end} ({days} days, approved)',
  'audit.detail.approve_leave': '{actor} approved {target}’s leave from {start} to {end}',
  'audit.detail.reject_leave': '{actor} rejected {target}’s leave from {start} to {end} (reason: {note})',
  'audit.detail.cancel_leave': '{actor} cancelled {target}’s leave from {start} to {end}',
  'audit.detail.change_role': '{actor} changed {target}’s role from {from} to {to}',
  'audit.detail.activate_user': '{actor} activated user {target}',
  'audit.detail.deactivate_user': '{actor} deactivated user {target}',
  'audit.detail.update_settings': '{actor} updated the entitlement settings',
  'audit.detail.generic': '{actor} performed action {action}',
  'admin.loadMore': 'Load more',

  'errors.insufficient_balance': 'You do not have enough vacation balance for this request',
  'errors.forbidden': 'You are not allowed to perform this action',
  'errors.account_deactivated': 'Your account has been deactivated',
  'errors.email_domain_not_allowed': 'This email domain is not allowed',
  'errors.validation_error': 'The submitted data is invalid, please check and try again',
  'errors.invalid_transition': 'This request cannot be changed from its current status',
  'errors.last_admin': 'Cannot remove the last remaining admin',
  'errors.concurrent_request': 'This conflicted with another change, please refresh and retry',
  'errors.overlapping_request': 'This date range overlaps an existing leave request of yours',
  'errors.generic': 'Something went wrong, please try again',
  'errors.loadFailed': 'Failed to load, please try again',
  'errors.retry': 'Retry',

  'dashboard.loading': 'Loading…',
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
