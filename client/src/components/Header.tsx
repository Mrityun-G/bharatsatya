import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Menu,
  X,
  Languages,
  Sun,
  Moon,
  Laptop,
  Check,
  ChevronDown,
  LogOut,
  RotateCcw,
  LucideIcon,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme, ThemePreference } from '../context/ThemeContext';
import { demoMode, demoStorageAvailable, resetDemoData } from '../services/demoData';
import { AlertsBell } from './AlertsBell';

interface HeaderProps {
  navigationOpen: boolean;
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ navigationOpen, onMenuToggle }) => {
  const { user, logout, switchDemoRole } = useAuth();
  const { themePreference, setTheme } = useTheme();
  const { t, i18n } = useTranslation();

  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  const langRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'ADMIN';
  const isReviewer = user?.role === 'REVIEWER' || isAdmin;

  // Close dropdowns on outside click or Escape
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

  const resetDemo = () => {
    if (window.confirm(t('header.resetConfirm'))) {
      resetDemoData();
      window.location.reload();
    }
  };

  const getRoleDisplayName = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return t('header.roles.admin');
      case 'REVIEWER':
        return t('header.roles.reviewer');
      case 'APPLICANT':
        return t('header.roles.applicant');
      default:
        return t('header.roles.unknown');
    }
  };

  const getUserAffiliation = () => {
    if (user?.institution?.name) {
      return user.institution.name;
    }
    if (user?.department) {
      return user.department;
    }
    return user?.role === 'ADMIN' ? 'AICTE Regulation Bureau · New Delhi' : 'Technical Institution';
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

  // Horizontal Portal Navigation Items (Institutional Government Standard)
  const navItems = [
    { to: '/applications', labelKey: 'sidebar.applications', isPrimary: true },
    ...(isReviewer ? [{ to: '/reviews', labelKey: 'sidebar.reviewQueue' }] : []),
    { to: '/documents/intake', labelKey: 'sidebar.documentIntake' },
    { to: '/documents/intelligence', labelKey: 'sidebar.documentIntelligence' },
    { to: '/compliance', labelKey: 'sidebar.complianceChecklist' },
    { to: '/anomalies', labelKey: 'sidebar.anomalyIndicators' },
    ...(isReviewer ? [{ to: '/verifications', labelKey: 'sidebar.sourceVerification' }] : []),
    { to: '/infrastructure', labelKey: 'sidebar.infrastructureCompliance' },
    { to: '/reports', labelKey: 'sidebar.reportsAudit' },
    ...(isAdmin ? [{ to: '/rules', labelKey: 'sidebar.ruleManagement' }] : []),
    { to: '/', labelKey: 'sidebar.dashboard' },
  ];

  return (
    <header className="app-header">
      {/* 1. Indian National Tricolor Ribbon */}
      <div className="national-tricolor-strip" />

      {/* 2. Unified Institutional Masthead */}
      <div className="inst-masthead">
        <div className="inst-masthead-inner">
          {/* Left: AICTE Institutional Identity */}
          <div className="inst-branding">
            <button
              className="gov-mobile-toggle"
              type="button"
              aria-label={navigationOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={navigationOpen}
              onClick={onMenuToggle}
            >
              {navigationOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <Link to="/" className="inst-logo-link" title="AICTE - BharatSatya Portal">
              <img
                src="/assets/aicte-logo.png"
                alt="AICTE Emblem"
                className="inst-logo"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="inst-titles">
                <span className="inst-org-hi">अखिल भारतीय तकनीकी शिक्षा परिषद</span>
                <span className="inst-org-en">ALL INDIA COUNCIL FOR TECHNICAL EDUCATION</span>
                <span className="inst-ministry">शिक्षा मंत्रालय, भारत सरकार | Ministry of Education, Government of India</span>
              </div>
            </Link>
          </div>

          {/* Right: Controls & User Identity */}
          <div className="inst-controls">
            {isReviewer && <AlertsBell />}

            {/* Language Selector */}
            <div className="header-dropdown-wrap" ref={langRef}>
              <button
                type="button"
                className="gov-control-btn"
                onClick={() => {
                  setLangMenuOpen((open) => !open);
                  setThemeMenuOpen(false);
                }}
                aria-haspopup="true"
                aria-expanded={langMenuOpen}
                title={t('header.language')}
              >
                <Languages size={13} />
                <span>{languageOptions.find((l) => l.code === currentLang)?.native || 'English'}</span>
                <ChevronDown size={11} />
              </button>

              {langMenuOpen && (
                <div className="gov-dropdown-menu" role="menu">
                  {languageOptions.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      role="menuitem"
                      className={`gov-dropdown-item${currentLang === lang.code ? ' active' : ''}`}
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

            {/* Appearance / Theme Selector */}
            <div className="header-dropdown-wrap" ref={themeRef}>
              <button
                type="button"
                className="gov-control-btn"
                onClick={() => {
                  setThemeMenuOpen((open) => !open);
                  setLangMenuOpen(false);
                }}
                aria-haspopup="true"
                aria-expanded={themeMenuOpen}
                title={t('header.theme')}
              >
                <ActiveThemeIcon size={13} />
                <span>{String(t(`header.themes.${themePreference}`))}</span>
                <ChevronDown size={11} />
              </button>

              {themeMenuOpen && (
                <div className="gov-dropdown-menu" role="menu">
                  {themeOptions.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = themePreference === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        role="menuitem"
                        className={`gov-dropdown-item${isActive ? ' active' : ''}`}
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

            {/* User Session Badge */}
            {user && (
              <div className="gov-user-chip">
                <div className="gov-user-text">
                  <span className="gov-user-name" title={user.name}>{user.name}</span>
                  <span className="gov-user-role" title={getUserAffiliation()}>
                    {getRoleDisplayName(user.role)}
                  </span>
                </div>
                <button
                  type="button"
                  className="gov-signout-btn"
                  title={t('header.signOut')}
                  aria-label={t('header.signOut')}
                  onClick={logout}
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Synthetic Demo Bar (When in Demo Mode) */}
        {demoMode && (
          <div className="gov-demo-subbar">
            <div className="gov-demo-notice">
              <strong>{t('header.demoMode')}:</strong> {t('header.demoNotice')}
            </div>
            <div className="gov-demo-actions">
              <div className="gov-role-switcher" aria-label="Demo role selector">
                {(['APPLICANT', 'REVIEWER', 'ADMIN'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`gov-role-btn${user?.role === role ? ' active' : ''}`}
                    onClick={() => void switchDemoRole(role)}
                    title={`Switch synthetic demo persona to ${role}`}
                  >
                    {role === 'ADMIN' ? 'Admin' : role === 'REVIEWER' ? 'Reviewer' : 'Applicant'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="gov-demo-reset-btn"
                onClick={resetDemo}
                title="Reset browser storage"
              >
                <RotateCcw size={11} />
                <span>{t('header.resetDemo')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Horizontal Administrative Navigation Ribbon */}
      <nav className="gov-navbar" aria-label="Regulatory Portal Navigation">
        <div className="gov-navbar-inner">
          <Link to="/" className="app-wordmark" aria-label="BharatSatya home">
            <strong>BharatSatya</strong>
            <span>Application validation</span>
          </Link>
          <ul className="gov-nav-list" role="menubar">
            {navItems.map((item) => (
              <li key={item.to} role="none" className="gov-nav-item">
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  role="menuitem"
                  className={({ isActive }) =>
                    `gov-nav-link${isActive ? ' active' : ''}${item.isPrimary ? ' primary-register' : ''}`
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="gov-navbar-context">
            <span className="gov-workspace-tag">
              {user?.institution?.name || user?.department || 'Central Scrutiny Register'}
            </span>
          </div>
        </div>
      </nav>
    </header>
  );
};
