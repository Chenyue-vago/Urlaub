import { useMemo } from 'react';
import { getPublicHolidays, getRegion, type RegionCode } from '@urlaub/shared';
import { useTranslation } from '../../i18n';
import { formatDisplayDate } from '../../utils';

interface PublicHolidaysProps {
  year: number;
  region: RegionCode;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Public-holiday list for the selected German state and year. Read-only
 * reference so people can see which official holidays fall in the year; past
 * holidays are dimmed. Purely client-side (from @urlaub/shared).
 */
export function PublicHolidays({ year, region }: PublicHolidaysProps) {
  const { t, locale } = useTranslation();
  const holidays = useMemo(() => getPublicHolidays(year, region), [year, region]);
  const regionLabel = locale === 'zh' ? getRegion(region).nameZh : getRegion(region).nameEn;
  const today = todayIso();

  return (
    <div className="section">
      <h2>{t('records.holidaysTitle', { year, region: regionLabel })}</h2>
      <div className="holidays-grid">
        {holidays.map((holiday) => {
          const isPast = holiday.date < today;
          const localizedName = locale === 'zh' ? holiday.nameZh : holiday.nameEn;
          return (
            <div
              key={holiday.date}
              className={`holiday-card ${isPast ? 'past' : ''}`}
              data-testid={`holiday-${holiday.date}`}
            >
              <div className="holiday-date">{formatDisplayDate(holiday.date)}</div>
              <div className="holiday-name">{localizedName}</div>
              <div className="holiday-name-de">{holiday.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
