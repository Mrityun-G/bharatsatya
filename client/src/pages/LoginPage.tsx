import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
  Languages,
  Sun,
  Moon,
  Laptop,
  ChevronDown,
  Check,
  LucideIcon,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme, ThemePreference } from '../context/ThemeContext';
import { demoMode } from '../services/demoData';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const { themePreference, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  const langRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  const demoAccessEnabled = import.meta.env.DEV && demoMode && import.meta.env.VITE_DEMO_ACCESS === 'true';
  const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated && !demoMode) navigate(destination, { replace: true });
  }, [destination, isAuthenticated, navigate]);

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLangMenuOpen(false);
        setThemeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (demoMode) {
      setError(String(t('auth.demoNotice', 'Frontend demo mode is enabled. Real authentication is not active in this build.')));
      return;
    }
    if (!email.trim() || !password) {
      setError('Please enter both your institutional email and password.');
      return;
    }
    setIsLoading(true);
    try {
      if (await login(email, password)) {
        navigate(destination, { replace: true });
      } else {
        setError('The email or password was not accepted. Please verify your credentials.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign-in could not be completed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const currentLang = i18n.language || 'en';
  const languageOptions = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
    { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
    { code: 'te', label: 'Telugu', native: 'తెలుగు' },
    { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  ];

  const themeOptions: { key: ThemePreference; labelKey: string; icon: LucideIcon }[] = [
    { key: 'light', labelKey: 'header.themes.light', icon: Sun },
    { key: 'dark', labelKey: 'header.themes.dark', icon: Moon },
    { key: 'system', labelKey: 'header.themes.system', icon: Laptop },
  ];

  const ActiveThemeIcon = themePreference === 'light' ? Sun : themePreference === 'dark' ? Moon : Laptop;

  return (
    <div className="portal-shell">
      {/* 1. Indian National Tricolor Ribbon */}
      <div className="portal-tricolor-strip" />

      {/* 2. Compact Institutional Masthead */}
      <header className="portal-masthead">
        <div className="portal-masthead-inner">
          <div className="portal-org-lockup">
            <img
              src="/assets/aicte-logo.png"
              alt="AICTE Emblem"
              className="portal-org-logo"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="portal-org-meta">
              <span className="portal-org-hi">अखिल भारतीय तकनीकी शिक्षा परिषद</span>
              <span className="portal-org-en">ALL INDIA COUNCIL FOR TECHNICAL EDUCATION</span>
              <span className="portal-org-dept">शिक्षा मंत्रालय, भारत सरकार | Ministry of Education, Government of India</span>
            </div>
          </div>

          <div className="portal-masthead-actions">
            <div className="portal-brand-badge">
              <span className="portal-brand-name">BharatSatya</span>
              <span className="portal-brand-sep">·</span>
              <span className="portal-brand-desc">Decision-Support Platform</span>
            </div>

            <div className="portal-controls-group">
              {/* Language Selector */}
              <div className="portal-dropdown-wrap" ref={langRef}>
                <button
                  type="button"
                  className="portal-control-btn"
                  onClick={() => {
                    setLangMenuOpen((open) => !open);
                    setThemeMenuOpen(false);
                  }}
                  aria-haspopup="true"
                  aria-expanded={langMenuOpen}
                  title={t('header.language', 'Language')}
                >
                  <Languages size={13} />
                  <span>{languageOptions.find((l) => l.code === currentLang)?.native || 'English'}</span>
                  <ChevronDown size={11} />
                </button>

                {langMenuOpen && (
                  <div className="portal-dropdown-menu" role="menu">
                    {languageOptions.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        role="menuitem"
                        className={`portal-dropdown-item${currentLang === lang.code ? ' active' : ''}`}
                        onClick={() => {
                          void i18n.changeLanguage(lang.code);
                          setLangMenuOpen(false);
                        }}
                      >
                        <span>{lang.native} ({lang.code.toUpperCase()})</span>
                        {currentLang === lang.code && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Theme Selector */}
              <div className="portal-dropdown-wrap" ref={themeRef}>
                <button
                  type="button"
                  className="portal-control-btn"
                  onClick={() => {
                    setThemeMenuOpen((open) => !open);
                    setLangMenuOpen(false);
                  }}
                  aria-haspopup="true"
                  aria-expanded={themeMenuOpen}
                  title={t('header.theme', 'Appearance')}
                >
                  <ActiveThemeIcon size={13} />
                  <span>{String(t(`header.themes.${themePreference}`, themePreference.toUpperCase()))}</span>
                  <ChevronDown size={11} />
                </button>

                {themeMenuOpen && (
                  <div className="portal-dropdown-menu" role="menu">
                    {themeOptions.map((opt) => {
                      const Icon = opt.icon;
                      const isActive = themePreference === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          role="menuitem"
                          className={`portal-dropdown-item${isActive ? ' active' : ''}`}
                          onClick={() => {
                            setTheme(opt.key);
                            setThemeMenuOpen(false);
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Icon size={12} />
                            {t(opt.labelKey)}
                          </span>
                          {isActive && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 3. Introduction and sign-in */}
      <main className="login-main">
        <div className="login-grid">
          <section aria-labelledby="scope-title">
            <p className="login-kicker">{t('auth.eyebrow', 'AICTE approval processing')}</p>
            <h1 id="scope-title" className="login-title">
              {t('auth.heroTitle', 'Every application. Every document. Every finding.')}
            </h1>
            <p className="login-lede">
              {t('auth.heroSubtitle', 'Validate institutional submissions, trace document evidence and support consistent regulatory scrutiny.')}
            </p>

            <dl className="login-principles" aria-label="Core regulatory principles">
              <div>
                <dt>{t('auth.panelSubmissions', 'Secure Submissions')}</dt>
                <dd>{t('auth.panelSubmissionsDesc', 'Tamper-evident storage & cryptographic SHA-256 verification')}</dd>
              </div>
              <div>
                <dt>{t('auth.panelReview', 'Transparent Review')}</dt>
                <dd>{t('auth.panelReviewDesc', 'Deterministic statutory rules with pinpoint evidence citations')}</dd>
              </div>
              <div>
                <dt>{t('auth.panelDecisions', 'Accountable Decisions')}</dt>
                <dd>{t('auth.panelDecisionsDesc', 'Reviewer identity provenance & immutable audit trail')}</dd>
              </div>
            </dl>

            <figure className="login-figure">
              <img src="/assets/institutional-campus.jpg" alt="Campus buildings of a technical institution" loading="lazy" />
              <figcaption>Illustrative photograph by Kartik Saini (Unsplash). Not an AICTE facility.</figcaption>
            </figure>
          </section>

          {/* Right Side: Compact Institutional Sign-In Panel */}
          <div className="portal-access-pane">
            <section className="portal-signin-card" aria-labelledby="signin-title">
              <div className="portal-card-header">
                <div className="portal-card-badge">
                  <img
                    src="/assets/aicte-logo.png"
                    alt="AICTE Emblem"
                    className="portal-badge-logo"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span className="portal-badge-text">OFFICIAL ACCESS</span>
                </div>
                <h2 id="signin-title" className="portal-card-title">
                  {t('auth.signInTitle', 'Institutional Sign In')}
                </h2>
                <p className="portal-card-desc">
                  {t('auth.signInSubtitle', 'Authorized AICTE scrutiny officers and institutional applicants')}
                </p>
              </div>

              {error && (
                <div className="portal-error-banner" role="alert">
                  <AlertCircle size={15} className="portal-error-icon" />
                  <span className="portal-error-text">{error}</span>
                </div>
              )}

              {demoMode && (
                <div className="notice-warning" role="note" style={{ marginBottom: '12px', fontSize: '11.5px', lineHeight: 1.45 }}>
                  {t('auth.demoNotice', 'Frontend demo mode is enabled. Real authentication is not active in this build.')}
                </div>
              )}

              <form onSubmit={submit} noValidate className="portal-form">
                <div className="portal-field-group">
                  <label className="portal-label" htmlFor="login-email">
                    {t('auth.emailLabel', 'Institutional Email')}
                  </label>
                  <div className="portal-input-wrap">
                    <Mail size={14} className="portal-input-icon" />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="username"
                      className="portal-input portal-input-iconified"
                      placeholder={String(t('auth.emailPlaceholder', 'name@institution.edu.in'))}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="portal-field-group">
                  <label className="portal-label" htmlFor="login-password">
                    {t('auth.passwordLabel', 'Password')}
                  </label>
                  <div className="portal-input-wrap">
                    <LockKeyhole size={14} className="portal-input-icon" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className="portal-input portal-input-iconified portal-input-toggleable"
                      placeholder={String(t('auth.passwordPlaceholder', 'Enter your password'))}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="portal-pw-toggle"
                      aria-label={showPassword ? String(t('auth.hidePassword', 'Hide password')) : String(t('auth.showPassword', 'Show password'))}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="portal-submit-btn"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="portal-submit-loading">
                      <Loader2 size={15} className="portal-spinner" />
                      {t('auth.signingIn', 'Signing in...')}
                    </span>
                  ) : (
                    t('auth.signInButton', 'Sign In')
                  )}
                </button>

                <div className="portal-security-note">
                  <ShieldCheck size={12} className="security-note-icon" />
                  <span>{t('auth.securityNote', 'Protected by role-based access control and encrypted transmission.')}</span>
                </div>
              </form>

              {demoAccessEnabled && (
                <div className="portal-demo-link-wrap">
                  <Link to="/dev/demo-access" className="portal-demo-link">
                    {t('auth.devDemoLink', 'Open development demo access')}
                  </Link>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* 4. Footer */}
      <footer className="portal-footer">
        <span>{t('auth.footer', 'BharatSatya | AICTE Regulation Bureau · Application Validation & Regulatory Compliance')}</span>
      </footer>
    </div>
  );
};
