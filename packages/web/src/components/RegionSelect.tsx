import { MapPin } from 'lucide-react';
import { REGIONS, type RegionCode } from '@urlaub/shared';
import { useTranslation } from '../i18n';
import { useMe, useUpdateMe } from '../hooks/useMe';

/**
 * Header control: shows the signed-in user's region and persists a change to
 * their profile (PATCH /me). The region drives which German state's public
 * holidays are shown across the app.
 */
export function RegionSelect() {
  const { t, locale } = useTranslation();
  const me = useMe();
  const updateMe = useUpdateMe();

  if (!me.data) return null;
  const region = me.data.region as RegionCode;

  return (
    <label className="header-select">
      <MapPin size={16} />
      <span className="sr-only">{t('header.region')}</span>
      <select
        value={region}
        aria-label={t('header.region')}
        onChange={(e) => updateMe.mutate({ region: e.target.value as RegionCode })}
      >
        {REGIONS.map((r) => (
          <option key={r.code} value={r.code}>
            {locale === 'zh' ? r.nameZh : r.nameEn}
          </option>
        ))}
      </select>
    </label>
  );
}
