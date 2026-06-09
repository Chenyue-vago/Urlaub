import { useState, FormEvent } from 'react';
import { Palmtree } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../i18n';

export function LoginPage() {
  const { signIn, signUp, deactivated } = useAuth();
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        const { needsEmailConfirmation } = await signUp(
          email,
          password,
          displayName.trim() || undefined
        );
        if (needsEmailConfirmation) setInfo(t('auth.checkEmail'));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (/invalid login credentials/i.test(message)) {
        setError(t('auth.errorInvalidCredentials'));
      } else if (/password/i.test(message) && /6/.test(message)) {
        setError(t('auth.errorWeakPassword'));
      } else {
        setError(t('auth.errorGeneric'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="logo">
          <Palmtree size={32} />
          <h1>{t('auth.title')}</h1>
        </div>
        <p className="subtitle">{t('auth.subtitle')}</p>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            {t('auth.loginTab')}
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => setMode('signup')}
          >
            {t('auth.signupTab')}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label>{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          {mode === 'signup' && (
            <div className="form-group">
              <label>{t('auth.displayName')}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}
          {deactivated && <p className="form-error">{t('auth.deactivated')}</p>}
          {error && <p className="form-error">{error}</p>}
          {info && <p className="form-info">{info}</p>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {mode === 'login' ? t('auth.submitLogin') : t('auth.submitSignup')}
          </button>
        </form>
      </div>
    </div>
  );
}
