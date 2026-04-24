import { useState, useEffect, useMemo, useRef } from 'react';
import { VacationRecord } from './types';
import {
  generateId,
  countWorkDays,
  countWorkDaysByYear,
  calculateYearlyStats,
  calculateCarryOver,
  saveToStorage,
  loadFromStorage,
  formatDisplayDate,
  formatDateString,
  formatShortDate,
  getWorkDayDates,
  exportAllData,
  importAllData,
} from './utils';
import { getPublicHolidays } from './holidays';
import {
  Calendar,
  Plus,
  Trash2,
  Sun,
  Palmtree,
  AlertCircle,
  CheckCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  Globe,
  MapPin,
  Settings,
} from 'lucide-react';
import { LOCALES, Locale, getTranslator, useTranslation } from './i18n';
import { DEFAULT_REGION, REGIONS, RegionCode, getRegion, isRegionCode } from './regions';

const REGION_STORAGE_KEY = 'urlaub_region';
const EMPLOYMENT_START_STORAGE_KEY = 'urlaub_employment_start';

// 简单校验：YYYY-MM-DD 且能 parse 出有效日期
function isValidIsoDate(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

function App() {
  const { locale, setLocale, t } = useTranslation();

  // 当前选中的州（影响公共假日 & 工作日计算）
  const [region, setRegion] = useState<RegionCode>(() => {
    try {
      const saved = localStorage.getItem(REGION_STORAGE_KEY);
      if (isRegionCode(saved)) return saved;
    } catch {
      // ignore
    }
    return DEFAULT_REGION;
  });

  useEffect(() => {
    try {
      localStorage.setItem(REGION_STORAGE_KEY, region);
    } catch {
      // ignore
    }
  }, [region]);

  // 使用惰性初始化直接从 localStorage 加载数据
  const [records, setRecords] = useState<VacationRecord[]>(() => {
    const saved = loadFromStorage();
    return saved;
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const stored = localStorage.getItem('urlaub_selected_year');
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHolidays, setShowHolidays] = useState(false);

  // 入职日期：从 localStorage 读取；首次访问时为空，会触发欢迎模态框
  const [employmentStartDate, setEmploymentStartDate] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(EMPLOYMENT_START_STORAGE_KEY);
      return isValidIsoDate(saved) ? saved : '';
    } catch {
      return '';
    }
  });

  // 设置模态框（手动打开）
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraftDate, setSettingsDraftDate] = useState('');

  // 用于触发隐藏的 file input 走系统文件选择
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = () => {
    const payload = exportAllData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `urlaub-backup-${formatDateString(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    // 一定要清空，否则下次选同名文件 onChange 不会再触发
    const resetInput = () => {
      input.value = '';
    };
    if (!window.confirm(t('settings.importConfirm'))) {
      resetInput();
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => {
      window.alert(t('settings.importError'));
      resetInput();
    };
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const { count } = importAllData(parsed);
        window.alert(t('settings.importSuccess', { n: count }));
        // 各种 state 都是 useState 初值时一次性从 localStorage 读的，
        // 简单起见整页刷新让所有读取重新走一遍。
        window.location.reload();
      } catch {
        window.alert(t('settings.importError'));
        resetInput();
      }
    };
    reader.readAsText(file);
  };

  // 首次欢迎模态框（必须填写后才能进入）
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    try {
      return !isValidIsoDate(localStorage.getItem(EMPLOYMENT_START_STORAGE_KEY));
    } catch {
      return true;
    }
  });
  const [welcomeDraftDate, setWelcomeDraftDate] = useState('');
  const [welcomeError, setWelcomeError] = useState(false);

  useEffect(() => {
    if (!employmentStartDate) return;
    try {
      localStorage.setItem(EMPLOYMENT_START_STORAGE_KEY, employmentStartDate);
    } catch {
      // ignore
    }
  }, [employmentStartDate]);

  // 表单状态
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formDescription, setFormDescription] = useState('');

  useEffect(() => {
    saveToStorage(records);
  }, [records]);

  useEffect(() => {
    localStorage.setItem('urlaub_selected_year', String(selectedYear));
  }, [selectedYear]);

  const todayDate = new Date();
  const isCurrentYear = selectedYear === todayDate.getFullYear();
  const carryOverFromPreviousYear = isCurrentYear
    ? calculateCarryOver(records, selectedYear - 1, employmentStartDate)
    : 0;
  const stats = calculateYearlyStats(
    records,
    selectedYear,
    carryOverFromPreviousYear,
    employmentStartDate
  );
  const yearlyTotal = stats.statutoryTotal + stats.contractualTotal;

  const yearRecords = records
    .filter((r) => Number(r.year) === Number(selectedYear))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  // 公共假日（按当前州和年份）
  const publicHolidays = useMemo(
    () => getPublicHolidays(selectedYear, region),
    [selectedYear, region]
  );

  // 当前州的本地化名称
  const currentRegion = getRegion(region);
  const regionLabel = locale === 'zh' ? currentRegion.nameZh : currentRegion.nameEn;

  // 按优先级自动分配假期天数：结转法定 → 合同 → 基础法定
  function allocateDays(
    totalDays: number,
    periodEndDate: string,
    periodYear: number,
    tempRecords: VacationRecord[]
  ): { carryover: number; contractual: number; statutory: number } {
    const carryOverDeadlineStr = `${periodYear}-03-31`;
    const currentStats = calculateYearlyStats(
      tempRecords, periodYear, carryOverFromPreviousYear, employmentStartDate
    );

    let remaining = totalDays;
    let carryoverDays = 0;
    let contractualDays = 0;
    let statutoryDays = 0;

    if (periodEndDate <= carryOverDeadlineStr && carryOverFromPreviousYear > 0) {
      const carryOverAvailable = Math.max(0, carryOverFromPreviousYear - currentStats.carryOverUsed);
      carryoverDays = Math.min(carryOverAvailable, remaining);
      remaining -= carryoverDays;
    }

    contractualDays = Math.min(currentStats.contractualRemaining, remaining);
    remaining -= contractualDays;

    statutoryDays = remaining;

    return { carryover: carryoverDays, contractual: contractualDays, statutory: statutoryDays };
  }

  // 计算预览工作日（按年份拆分，按地区）
  const previewByYear = (formStartDate && formEndDate && formStartDate <= formEndDate)
    ? countWorkDaysByYear(formStartDate, formEndDate, region)
    : [];

  const previewWorkDays = previewByYear.reduce((sum, p) => sum + p.days, 0);

  const handleAddRecord = () => {
    if (!formStartDate || !formEndDate || formStartDate > formEndDate) {
      alert(t('alert.invalidDateRange'));
      return;
    }

    const totalWorkDays = countWorkDays(formStartDate, formEndDate, region);
    if (totalWorkDays === 0) {
      alert(t('alert.noWorkDays'));
      return;
    }

    const splitByYear = countWorkDaysByYear(formStartDate, formEndDate, region);
    const createdAt = new Date().toISOString();
    // 备注只保存用户实际输入；类型 / 结转 / 拆分年份等由结构化字段承载
    const description = formDescription.trim();

    const newRecords: VacationRecord[] = [];
    const tempRecords: VacationRecord[] = [...records];

    splitByYear.forEach((period) => {
      const alloc = allocateDays(period.days, period.endDate, period.year, tempRecords);

      if (alloc.carryover > 0) {
        newRecords.push({
          id: generateId(),
          startDate: period.startDate,
          endDate: period.endDate,
          workDays: alloc.carryover,
          description,
          type: 'statutory',
          isCarryOver: true,
          year: period.year,
          createdAt,
        });
      }

      if (alloc.contractual > 0) {
        newRecords.push({
          id: generateId(),
          startDate: period.startDate,
          endDate: period.endDate,
          workDays: alloc.contractual,
          description,
          type: 'contractual',
          year: period.year,
          createdAt,
        });
      }

      if (alloc.statutory > 0) {
        newRecords.push({
          id: generateId(),
          startDate: period.startDate,
          endDate: period.endDate,
          workDays: alloc.statutory,
          description,
          type: 'statutory',
          year: period.year,
          createdAt,
        });
      }

      tempRecords.push(...newRecords.filter((r) => r.year === period.year));
    });

    setRecords((prev) => [...prev, ...newRecords]);
    resetForm();
    setShowAddForm(false);
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm(t('alert.confirmDelete'))) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const resetForm = () => {
    setFormStartDate('');
    setFormEndDate('');
    setFormDescription('');
  };

  const totalUsed = stats.statutoryUsed + stats.contractualUsed;
  const totalRemaining = stats.statutoryRemaining + stats.contractualRemaining;

  const today = formatDateString(new Date());

  const handleYearChange = (delta: number) => {
    setSelectedYear((prev) => {
      const next = prev + delta;
      localStorage.setItem('urlaub_selected_year', String(next));
      return next;
    });
  };

  const dash = t('modal.dash');

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="header-top">
            <div className="logo">
              <Palmtree size={32} />
              <h1>{t('app.title')}</h1>
            </div>
            <div className="header-controls">
              <label className="header-select">
                <Globe size={16} />
                <span className="sr-only">{t('header.language')}</span>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                  aria-label={t('header.language')}
                >
                  {LOCALES.map((l) => (
                    <option key={l.code} value={l.code}>{l.nativeLabel}</option>
                  ))}
                </select>
              </label>
              <label className="header-select">
                <MapPin size={16} />
                <span className="sr-only">{t('header.region')}</span>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value as RegionCode)}
                  aria-label={t('header.region')}
                >
                  {REGIONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {locale === 'zh' ? r.nameZh : r.nameEn}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="header-icon-btn"
                onClick={() => {
                  setSettingsDraftDate(employmentStartDate);
                  setShowSettings(true);
                }}
                aria-label={t('header.settings')}
                title={t('header.settings')}
              >
                <Settings size={16} />
              </button>
            </div>
          </div>
          <p className="subtitle">{t('app.subtitle')} · {regionLabel}</p>
        </div>
      </header>

      <main className="main" key={selectedYear}>
        {/* 年份选择器 */}
        <div className="year-selector">
          <button
            className="year-btn"
            onClick={() => handleYearChange(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <span className="year-display">{selectedYear}</span>
          <button
            className="year-btn"
            onClick={() => handleYearChange(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 统计卡片 */}
        <div className="stats-grid">
          <div className="stat-card main-stat">
            <div className="stat-header">
              <Sun size={24} />
              <span>{t('stats.yearlyOverview')}</span>
            </div>
            <div className="stat-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill statutory"
                  style={{ width: `${yearlyTotal > 0 ? (stats.statutoryUsed / yearlyTotal) * 100 : 0}%` }}
                />
                <div
                  className="progress-fill contractual"
                  style={{
                    width: `${yearlyTotal > 0 ? (stats.contractualUsed / yearlyTotal) * 100 : 0}%`,
                    left: `${yearlyTotal > 0 ? (stats.statutoryUsed / yearlyTotal) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="progress-labels">
                <span>{t('stats.usedDays', { n: totalUsed })}</span>
                <span>{t('stats.remainingDays', { n: totalRemaining })}</span>
              </div>
            </div>
            <div className="stat-breakdown">
              <div className="breakdown-item">
                <span className="dot statutory" />
                <span>{t('stats.statutory')}</span>
                <span className="breakdown-value">
                  {t('stats.usedOf', { used: stats.statutoryUsed, total: stats.statutoryTotal })}
                </span>
              </div>
              <div className="breakdown-item">
                <span className="dot contractual" />
                <span>{t('stats.contractual')}</span>
                <span className="breakdown-value">
                  {t('stats.usedOf', { used: stats.contractualUsed, total: stats.contractualTotal })}
                </span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon statutory-bg">
              <CheckCircle size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">{t('stats.statutoryRemaining')}</span>
              <span className="stat-value">{t('stats.daysShort', { n: stats.statutoryRemaining })}</span>
              <span className="stat-sublabel">
                {t('stats.totalDays', { n: stats.statutoryTotal })}
                {carryOverFromPreviousYear > 0 && t('stats.includesCarryOver', { n: carryOverFromPreviousYear })}
                {stats.carryOverExpired > 0 && t('stats.expiredCarryOver', { n: stats.carryOverExpired })}
              </span>
            </div>
            <div className="stat-note">
              <Info size={14} />
              <span>{t('stats.carryoverHint')}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon contractual-bg">
              <AlertCircle size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">{t('stats.contractualRemaining')}</span>
              <span className="stat-value">{t('stats.daysShort', { n: stats.contractualRemaining })}</span>
            </div>
            <div className="stat-note warning">
              <Info size={14} />
              <span>{t('stats.contractualExpiryHint')}</span>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={18} />
            {t('actions.addRecord')}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowHolidays(!showHolidays)}
          >
            <Calendar size={18} />
            {showHolidays ? t('actions.hideHolidays') : t('actions.showHolidays')}
          </button>
        </div>

        {/* 添加假期表单 */}
        {showAddForm && (
          <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>{t('modal.addTitle')}</h2>
              <div className="form-group">
                <label>{t('modal.startDate')}</label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>{t('modal.endDate')}</label>
                <input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                />
              </div>
              {(formStartDate || formEndDate) && (
                <div className="date-summary">
                  {t('modal.dateSelected', {
                    start: formStartDate ? formatDisplayDate(formStartDate) : dash,
                    end: formEndDate ? formatDisplayDate(formEndDate) : dash,
                  })}
                </div>
              )}
              {previewWorkDays > 0 && (
                <div className="preview-days">
                  <div className="preview-header">
                    <span>{t('modal.consumeDays')}</span>
                    <strong>{t('modal.daysValue', { n: previewWorkDays })}</strong>
                  </div>
                </div>
              )}
              {carryOverFromPreviousYear > 0 && formEndDate && formEndDate <= `${selectedYear}-03-31` && (
                <div className="carryover-hint">
                  <Info size={14} />
                  <span>{t('modal.carryoverHint')}</span>
                </div>
              )}
              <div className="form-group">
                <label>{t('modal.descLabel')}</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t('modal.descPlaceholder')}
                />
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowAddForm(false)}>
                  {t('modal.cancel')}
                </button>
                <button className="btn btn-primary" onClick={handleAddRecord}>
                  {t('modal.save')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 公共假日列表 */}
        {showHolidays && (
          <div className="section">
            <h2>{t('records.holidaysTitle', { year: selectedYear, region: regionLabel })}</h2>
            <div className="holidays-grid">
              {publicHolidays.map((holiday) => {
                const isPast = holiday.date < today;
                const localizedName = locale === 'zh' ? holiday.nameZh : holiday.nameEn;
                return (
                  <div
                    key={holiday.date}
                    className={`holiday-card ${isPast ? 'past' : ''}`}
                  >
                    <div className="holiday-date">
                      {formatDisplayDate(holiday.date)}
                    </div>
                    <div className="holiday-name">{localizedName}</div>
                    <div className="holiday-name-de">{holiday.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 假期记录列表 */}
        <div className="section">
          <h2>{t('records.title', { year: selectedYear })}</h2>
          <div className="year-summary">
            {t('records.summary', {
              statutory: stats.statutoryUsed,
              contractual: stats.contractualUsed,
              total: stats.statutoryUsed + stats.contractualUsed,
            })}
          </div>
          {yearRecords.length === 0 ? (
            <div className="empty-state">
              <Palmtree size={48} />
              <p>{t('records.empty')}</p>
              <p className="empty-hint">{t('records.emptyHint')}</p>
            </div>
          ) : (
            <div className="records-list">
              {(() => {
                // 同一次提交（同 start/end/createdAt）的多条记录，把范围内的工作日按
                // 「结转 → 合同 → 法定」的优先级切片，分别归给各条记录，避免重复列出相同日期
                const dateMap = new Map<string, string[]>();
                const groups = new Map<string, VacationRecord[]>();
                for (const r of yearRecords) {
                  const key = `${r.startDate}__${r.endDate}__${r.createdAt}`;
                  const arr = groups.get(key);
                  if (arr) arr.push(r);
                  else groups.set(key, [r]);
                }
                for (const group of groups.values()) {
                  const sample = group[0];
                  const allDates = getWorkDayDates(sample.startDate, sample.endDate, region);
                  const priority = (r: VacationRecord) =>
                    r.isCarryOver ? 0 : r.type === 'contractual' ? 1 : 2;
                  const sorted = [...group].sort((a, b) => priority(a) - priority(b));
                  let cursor = 0;
                  for (const r of sorted) {
                    dateMap.set(r.id, allDates.slice(cursor, cursor + r.workDays));
                    cursor += r.workDays;
                  }
                }
                return yearRecords.map((record) => {
                const kind: 'carryover' | 'contractual' | 'statutory' =
                  record.isCarryOver ? 'carryover' : record.type;
                const kindLabelKey =
                  kind === 'carryover'
                    ? 'records.carryover'
                    : kind === 'contractual'
                      ? 'records.contractual'
                      : 'records.statutory';
                const consumeKey =
                  kind === 'carryover'
                    ? 'records.consumeCarryover'
                    : kind === 'contractual'
                      ? 'records.consumeContractual'
                      : 'records.consumeStatutory';
                const workDayDates = dateMap.get(record.id) ?? [];
                const workDayLabel = workDayDates.map(formatShortDate).join(', ');
                return (
                  <div key={record.id} className="record-card">
                    <div className="record-row-main">
                      <div className="record-dates">
                        <span className="record-range">
                          {formatDisplayDate(record.startDate)}
                          {record.startDate !== record.endDate && (
                            <> — {formatDisplayDate(record.endDate)}</>
                          )}
                        </span>
                        <div className="record-tags">
                          <span className={`record-type ${kind}`}>{t(kindLabelKey)}</span>
                          <span className="record-year">
                            {t('records.belongsToYear', { year: record.year })}
                          </span>
                        </div>
                      </div>
                      <div className="record-info">
                        <span className="record-days">{t(consumeKey, { n: record.workDays })}</span>
                        {record.description && (
                          <span className="record-desc">{record.description}</span>
                        )}
                      </div>
                      <button
                        className="record-delete"
                        onClick={() => handleDeleteRecord(record.id)}
                        title={t('records.deleteTitle')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {workDayDates.length > 0 && (
                      <div className="record-workdays">
                        {t('records.workdayDates', { dates: workDayLabel })}
                      </div>
                    )}
                  </div>
                );
                });
              })()}
            </div>
          )}
        </div>

        {/* 规则说明 */}
        <div className="section rules">
          <h2>{t('rules.title')}</h2>
          <div className="rules-content">
            <div className="rule-item">
              <h4>{t('rules.totalTitle')}</h4>
              <p>{t('rules.totalBody')}</p>
            </div>
            <div className="rule-item">
              <h4>{t('rules.expiryTitle')}</h4>
              <p>
                <strong>{t('rules.expiryBodyContractual')}</strong>{t('rules.expiryBodyContractualDesc')}<br />
                <strong>{t('rules.expiryBodyStatutory')}</strong>{t('rules.expiryBodyStatutoryDesc')}
              </p>
            </div>
            <div className="rule-item">
              <h4>{t('rules.leaveTitle')}</h4>
              <p>{t('rules.leaveBody')}</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>{t('app.footer', { region: regionLabel, year: new Date().getFullYear() })}</p>
      </footer>

      {/* 设置模态框（手动打开） */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('settings.title')}</h2>
            <div className="form-group">
              <label>{t('settings.employmentStartLabel')}</label>
              <input
                type="date"
                value={settingsDraftDate}
                onChange={(e) => setSettingsDraftDate(e.target.value)}
              />
              <p className="form-hint">{t('settings.employmentStartHint')}</p>
            </div>

            <div className="settings-section">
              <h3 className="settings-section-title">{t('settings.backupTitle')}</h3>
              <p className="form-hint">{t('settings.backupHint')}</p>
              <div className="settings-backup-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleExportBackup}
                >
                  {t('settings.export')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => importInputRef.current?.click()}
                >
                  {t('settings.import')}
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={handleImportFileChosen}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowSettings(false)}
              >
                {t('settings.cancel')}
              </button>
              <button
                className="btn btn-primary"
                disabled={!isValidIsoDate(settingsDraftDate)}
                onClick={() => {
                  if (!isValidIsoDate(settingsDraftDate)) return;
                  setEmploymentStartDate(settingsDraftDate);
                  setShowSettings(false);
                }}
              >
                {t('settings.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 首次访问的欢迎/必填模态框 —— 始终使用英文，避免老用户残留的中文偏好让新同事困惑；
          不允许通过点击遮罩关闭，必须填合法日期才能进入主界面 */}
      {showWelcome && (() => {
        const tw = getTranslator('en');
        return (
          <div className="modal-overlay welcome-overlay">
            <div className="modal welcome-modal" onClick={(e) => e.stopPropagation()}>
              <h2>{tw('welcome.title')}</h2>
              <p className="welcome-body">{tw('welcome.body')}</p>
              <div className="form-group">
                <label>{tw('settings.employmentStartLabel')}</label>
                <input
                  type="date"
                  value={welcomeDraftDate}
                  onChange={(e) => {
                    setWelcomeDraftDate(e.target.value);
                    if (e.target.value) setWelcomeError(false);
                  }}
                />
                {welcomeError && (
                  <p className="form-error">{tw('welcome.required')}</p>
                )}
              </div>
              <div className="modal-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (!isValidIsoDate(welcomeDraftDate)) {
                      setWelcomeError(true);
                      return;
                    }
                    setEmploymentStartDate(welcomeDraftDate);
                    // 欢迎模态固定英文显示，所以完成欢迎后默认整个应用也用英文，
                    // 覆盖浏览器里可能残留的旧语言偏好；用户随时可在 header 切回。
                    setLocale('en');
                    setShowWelcome(false);
                  }}
                >
                  {tw('welcome.continue')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default App;
