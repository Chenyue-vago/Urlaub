import { useState, FormEvent } from 'react';
import { Palmtree, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
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

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setError('');
    setInfo('');
  };

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
      <div className="auth-page-bg" aria-hidden="true">
        <div className="auth-page-glow auth-page-glow--1" />
        <div className="auth-page-glow auth-page-glow--2" />
        <div className="auth-page-grain" />
      </div>

      <div className="auth-shell">
        <aside className="auth-hero">
          <div className="auth-hero-inner">
            <div className="auth-hero-badge">
              <Palmtree size={18} strokeWidth={2.25} />
              <span>Urlaub</span>
            </div>
            <h1 className="auth-hero-title">{t('auth.title')}</h1>
            <p className="auth-hero-lead">{t('auth.subtitle')}</p>
            <ul className="auth-hero-features">
              <li>
                <span className="auth-hero-dot" />
                {t('auth.featureStatutory')}
              </li>
              <li>
                <span className="auth-hero-dot" />
                {t('auth.featureHolidays')}
              </li>
              <li>
                <span className="auth-hero-dot" />
                {t('auth.featureCarryover')}
              </li>
            </ul>
          </div>
          <div className="auth-hero-accent" aria-hidden="true" />
        </aside>

        <div className="auth-panel">
          <div className="auth-card">
            <div className="auth-card-header">
              <h2>{mode === 'login' ? t('auth.loginTab') : t('auth.signupTab')}</h2>
              <p>
                {mode === 'login' ? t('auth.loginHint') : t('auth.signupHint')}
              </p>
            </div>

            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={mode === 'login' ? 'active' : ''}
                onClick={() => switchMode('login')}
              >
                {t('auth.loginTab')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                className={mode === 'signup' ? 'active' : ''}
                onClick={() => switchMode('signup')}
              >
                {t('auth.signupTab')}
              </button>
              <span
                className="auth-tabs-indicator"
                data-mode={mode}
                aria-hidden="true"
              />
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label htmlFor="auth-email">{t('auth.email')}</label>
                <div className="auth-input-wrap">
                  <Mail size={18} className="auth-input-icon" aria-hidden="true" />
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="auth-password">{t('auth.password')}</label>
                <div className="auth-input-wrap">
                  <Lock size={18} className="auth-input-icon" aria-hidden="true" />
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div
                className={`auth-signup-fields${mode === 'signup' ? ' auth-signup-fields--open' : ''}`}
                aria-hidden={mode !== 'signup'}
              >
                <div className="auth-field">
                  <label htmlFor="auth-display-name">{t('auth.displayName')}</label>
                  <div className="auth-input-wrap">
                    <User size={18} className="auth-input-icon" aria-hidden="true" />
                    <input
                      id="auth-display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      autoComplete="name"
                      tabIndex={mode === 'signup' ? 0 : -1}
                    />
                  </div>
                </div>
              </div>

              {(deactivated || error || info) && (
                <div className="auth-messages">
                  {deactivated && (
                    <p className="auth-message auth-message--error">{t('auth.deactivated')}</p>
                  )}
                  {error && <p className="auth-message auth-message--error">{error}</p>}
                  {info && <p className="auth-message auth-message--info">{info}</p>}
                </div>
              )}

              <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 size={18} className="auth-spinner" aria-hidden="true" />
                    <span>{mode === 'login' ? t('auth.submitLogin') : t('auth.submitSignup')}</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'login' ? t('auth.submitLogin') : t('auth.submitSignup')}</span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
