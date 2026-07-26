import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useInviteUser } from '../../hooks/useAdmin';
import { useToast } from '../Toast';
import { translateApiErrorCode } from '../../lib/errorMessages';
import { ApiError } from '../../lib/api';

export function InviteUserForm() {
  const { t } = useTranslation();
  const { showError, showSuccess } = useToast();
  const inviteUser = useInviteUser();
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    inviteUser.mutate(
      { email: email.trim() },
      {
        onSuccess: () => {
          setEmail('');
          showSuccess(t('admin.inviteSuccess'));
        },
        onError: (err) => {
          const code = err instanceof ApiError ? err.code : undefined;
          showError(translateApiErrorCode(code, t));
        },
      }
    );
  };

  return (
    <form className="admin-invite-form" onSubmit={handleSubmit}>
      <input
        type="email"
        className="admin-invite-input"
        placeholder={t('admin.inviteEmailPlaceholder')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        aria-label={t('admin.inviteTitle')}
      />
      <button type="submit" className="btn btn-secondary" disabled={inviteUser.isPending}>
        <UserPlus size={14} aria-hidden="true" />
        {t('admin.inviteSubmit')}
      </button>
    </form>
  );
}
