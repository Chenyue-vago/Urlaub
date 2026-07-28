import { Sun, CheckCircle } from 'lucide-react';
import type { YearlyVacationStats } from '@urlaub/shared';
import { useTranslation } from '../../i18n';

interface StatsCardsProps {
  stats: YearlyVacationStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const { t } = useTranslation();
  // Single pool: everything the user can still draw on this year.
  // `used` already includes any carry-over consumed; `remaining` already
  // includes carry-over. Total available = what's left + what's used.
  const totalAvailable = stats.remaining + stats.used;
  const usedPct = totalAvailable > 0 ? (stats.used / totalAvailable) * 100 : 0;

  return (
    <div className="stats-grid">
      <div className="stat-card main-stat">
        <div className="stat-header">
          <Sun size={24} />
          <span>{t('stats.yearlyOverview')}</span>
        </div>
        <div className="stat-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${usedPct}%` }} />
          </div>
          <div className="progress-labels">
            <span>{t('stats.usedDays', { n: stats.used })}</span>
            <span>{t('stats.remainingDays', { n: stats.remaining })}</span>
          </div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">
          <CheckCircle size={20} />
        </div>
        <div className="stat-info">
          <span className="stat-label">{t('stats.remainingLabel')}</span>
          <span className="stat-value">{t('stats.daysShort', { n: stats.remaining })}</span>
          <span className="stat-sublabel">
            {/* Total available = base entitlement + carry-over (e.g. 37 = 28 + 9). */}
            {t('stats.totalDays', { n: totalAvailable })}
            {stats.carryOver > 0 && t('stats.includesCarryOver', { n: stats.carryOver, base: stats.total })}
            {stats.carryOverExpired > 0 && t('stats.expiredCarryOver', { n: stats.carryOverExpired })}
          </span>
        </div>
        <div className="stat-note">
          <span>{t('stats.carryoverHint')}</span>
        </div>
      </div>
    </div>
  );
}
