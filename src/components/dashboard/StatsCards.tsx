import { Sun, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { YearlyVacationStats } from '../../types';

interface StatsCardsProps {
  stats: YearlyVacationStats;
  carryOverFromPreviousYear: number;
}

export function StatsCards({ stats, carryOverFromPreviousYear }: StatsCardsProps) {
  const { t } = useTranslation();
  const yearlyTotal = stats.statutoryTotal + stats.contractualTotal;
  const totalUsed = stats.statutoryUsed + stats.contractualUsed;
  const totalRemaining = stats.statutoryRemaining + stats.contractualRemaining;

  return (
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
  );
}
