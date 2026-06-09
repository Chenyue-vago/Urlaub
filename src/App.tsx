import { useState, useEffect, useMemo } from 'react';
import { VacationRecord, NewVacationRecord } from './types';
import {
  countWorkDays,
  countWorkDaysByYear,
  calculateYearlyStats,
  calculateCarryOver,
  formatDisplayDate,
  formatDateString,
  formatShortDate,
  getWorkDayDates,
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
  Shield,
  LogOut,
} from 'lucide-react';
import { LOCALES, Locale, useTranslation } from './i18n';
import { DEFAULT_REGION, REGIONS, RegionCode, getRegion } from './regions';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './components/Toast';
import { useVacations, useCreateVacations, useDeleteVacation } from './hooks/useVacations';
import { useEntitlementConfig } from './hooks/useSettings';
import { updateProfile } from './services/profile';
import { LoginPage } from './components/auth/LoginPage';
import { WelcomeModal } from './components/dashboard/WelcomeModal';
import { SettingsModal } from './components/dashboard/SettingsModal';
import { AdminPanel } from './components/admin/AdminPanel';

function App() {
  const { locale, setLocale, t } = useTranslation();
  const { profile, isAdmin, signOut, refreshProfile, loading: authLoading } = useAuth();
  const { showError } = useToast();

  const { data: records = [], isLoading: recordsLoading, isError: recordsError } =
    useVacations(profile?.id ?? '');
  const entitlement = useEntitlementConfig(!!profile);
  const createMutation = useCreateVacations(profile?.id ?? '');
  const deleteMutation = useDeleteVacation(profile?.id ?? '');

  const region: RegionCode = profile?.region ?? DEFAULT_REGION;
  const employmentStartDate = profile?.employmentStartDate ?? '';

  const [selectedYear, setSelectedYear] = useState(() => {
    const stored = localStorage.getItem('urlaub_selected_year');
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHolidays, setShowHolidays] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState<'dashboard' | 'admin'>('dashboard');

  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formDescription, setFormDescription] = useState('');

  useEffect(() => {
    localStorage.setItem('urlaub_selected_year', String(selectedYear));
  }, [selectedYear]);

  const handleRegionChange = async (newRegion: RegionCode) => {
    if (!profile) return;
    try {
      await updateProfile(profile.id, { region: newRegion });
      await refreshProfile();
    } catch {
      showError(t('common.saveFailed'));
    }
  };

  const handleEmploymentDateSave = async (date: string) => {
    if (!profile) return;
    try {
      await updateProfile(profile.id, { employmentStartDate: date });
      await refreshProfile();
      setShowSettings(false);
    } catch {
      showError(t('common.saveFailed'));
    }
  };

  const todayDate = new Date();
  const isCurrentYear = selectedYear === todayDate.getFullYear();
  const carryOverFromPreviousYear = isCurrentYear
    ? calculateCarryOver(records, selectedYear - 1, employmentStartDate, entitlement)
    : 0;
  const stats = calculateYearlyStats(
    records,
    selectedYear,
    carryOverFromPreviousYear,
    employmentStartDate,
    entitlement
  );
  const yearlyTotal = stats.statutoryTotal + stats.contractualTotal;

  const yearRecords = records
    .filter((r) => Number(r.year) === Number(selectedYear))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const publicHolidays = useMemo(
    () => getPublicHolidays(selectedYear, region),
    [selectedYear, region]
  );

  const currentRegion = getRegion(region);
  const regionLabel = locale === 'zh' ? currentRegion.nameZh : currentRegion.nameEn;

  function allocateDays(
    totalDays: number,
    periodEndDate: string,
    periodYear: number,
    tempRecords: VacationRecord[]
  ): { carryover: number; contractual: number; statutory: number } {
    const carryOverDeadlineStr = `${periodYear}-${entitlement.carryOverDeadline}`;
    const currentStats = calculateYearlyStats(
      tempRecords, periodYear, carryOverFromPreviousYear, employmentStartDate, entitlement
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

  const previewByYear =
    formStartDate && formEndDate && formStartDate <= formEndDate
      ? countWorkDaysByYear(formStartDate, formEndDate, region)
      : [];
  const previewWorkDays = previewByYear.reduce((sum, p) => sum + p.days, 0);

  const handleAddRecord = async (
    startDate: string,
    endDate: string,
    description: string
  ) => {
    if (!profile) return;
    if (!startDate || !endDate || startDate > endDate) {
      alert(t('alert.invalidDateRange'));
      return;
    }

    const totalWorkDays = countWorkDays(startDate, endDate, region);
    if (totalWorkDays === 0) {
      alert(t('alert.noWorkDays'));
      return;
    }

    const splitByYear = countWorkDaysByYear(startDate, endDate, region);
    const desc = description.trim();

    const newRecords: NewVacationRecord[] = [];
    const tempRecords = [...records];

    splitByYear.forEach((period) => {
      const alloc = allocateDays(period.days, period.endDate, period.year, tempRecords);

      if (alloc.carryover > 0) {
        newRecords.push({
          startDate: period.startDate,
          endDate: period.endDate,
          workDays: alloc.carryover,
          description: desc,
          type: 'statutory',
          isCarryOver: true,
          year: period.year,
        });
      }
      if (alloc.contractual > 0) {
        newRecords.push({
          startDate: period.startDate,
          endDate: period.endDate,
          workDays: alloc.contractual,
          description: desc,
          type: 'contractual',
          isCarryOver: false,
          year: period.year,
        });
      }
      if (alloc.statutory > 0) {
        newRecords.push({
          startDate: period.startDate,
          endDate: period.endDate,
          workDays: alloc.statutory,
          description: desc,
          type: 'statutory',
          isCarryOver: false,
          year: period.year,
        });
      }

      tempRecords.push(
        ...newRecords
          .filter((r) => r.year === period.year)
          .map((r, i) => ({
            ...r,
            id: `temp-${i}`,
            userId: profile.id,
            createdAt: new Date().toISOString(),
          }))
      );
    });

    try {
      await createMutation.mutateAsync(newRecords);
      resetForm();
      setShowAddForm(false);
    } catch {
      showError(t('common.saveFailed'));
    }
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm(t('alert.confirmDelete'))) {
      deleteMutation.mutate(id, {
        onError: () => showError(t('common.saveFailed')),
      });
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
  const dash = t('modal.dash');

  const handleYearChange = (delta: number) => {
    setSelectedYear((prev) => {
      const next = prev + delta;
      localStorage.setItem('urlaub_selected_year', String(next));
      return next;
    });
  };

  if (authLoading) {
    return <div className="app-loading">{t('common.loading')}</div>;
  }
  if (!profile) {
    return <LoginPage />;
  }

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
                  onChange={(e) => handleRegionChange(e.target.value as RegionCode)}
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
                onClick={() => setShowSettings(true)}
                aria-label={t('header.settings')}
                title={t('header.settings')}
              >
                <Settings size={16} />
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className="header-icon-btn"
                  onClick={() => setView(view === 'admin' ? 'dashboard' : 'admin')}
                  aria-label={t('nav.admin')}
                  title={t('nav.admin')}
                >
                  <Shield size={16} />
                </button>
              )}
              <button
                type="button"
                className="header-icon-btn"
                onClick={() => signOut()}
                aria-label={t('auth.signOut')}
                title={t('auth.signOut')}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
          <p className="subtitle">{t('app.subtitle')} · {regionLabel}</p>
        </div>
      </header>

      {!profile.employmentStartDate && (
        <WelcomeModal
          onSubmit={(date) => {
            handleEmploymentDateSave(date);
            setLocale('en');
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          initialDate={employmentStartDate}
          onSave={handleEmploymentDateSave}
          onClose={() => setShowSettings(false)}
        />
      )}

      {view === 'admin' && isAdmin ? (
        <AdminPanel />
      ) : (
        <main className="main" key={selectedYear}>
          <div className="year-selector">
            <button className="year-btn" onClick={() => handleYearChange(-1)}>
              <ChevronLeft size={20} />
            </button>
            <span className="year-display">{selectedYear}</span>
            <button className="year-btn" onClick={() => handleYearChange(1)}>
              <ChevronRight size={20} />
            </button>
          </div>

          {recordsError && <div className="form-error">{t('common.loadFailed')}</div>}
          {recordsLoading && <div className="app-loading">{t('common.loading')}</div>}

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
                <span>{t('stats.contractualExpiryHint')}</span>
              </div>
            </div>
          </div>

          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
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
                {carryOverFromPreviousYear > 0 &&
                  formEndDate &&
                  formEndDate <= `${selectedYear}-${entitlement.carryOverDeadline}` && (
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
                  <button
                    className="btn btn-primary"
                    onClick={() => handleAddRecord(formStartDate, formEndDate, formDescription)}
                  >
                    {t('modal.save')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showHolidays && (
            <div className="section">
              <h2>{t('records.holidaysTitle', { year: selectedYear, region: regionLabel })}</h2>
              <div className="holidays-grid">
                {publicHolidays.map((holiday) => {
                  const isPast = holiday.date < today;
                  const localizedName = locale === 'zh' ? holiday.nameZh : holiday.nameEn;
                  return (
                    <div key={holiday.date} className={`holiday-card ${isPast ? 'past' : ''}`}>
                      <div className="holiday-date">{formatDisplayDate(holiday.date)}</div>
                      <div className="holiday-name">{localizedName}</div>
                      <div className="holiday-name-de">{holiday.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                  const dateMap = new Map<string, string[]>();
                  const groups = new Map<string, VacationRecord[]>();
                  for (const r of yearRecords) {
                    const key = `${r.startDate}__${r.endDate}__${r.description}`;
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
                  <strong>{t('rules.expiryBodyContractual')}</strong>
                  {t('rules.expiryBodyContractualDesc')}
                  <br />
                  <strong>{t('rules.expiryBodyStatutory')}</strong>
                  {t('rules.expiryBodyStatutoryDesc')}
                </p>
              </div>
              <div className="rule-item">
                <h4>{t('rules.leaveTitle')}</h4>
                <p>{t('rules.leaveBody')}</p>
              </div>
            </div>
          </div>
        </main>
      )}

      <footer className="footer">
        <p>{t('app.footer', { region: regionLabel, year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  );
}

export default App;
