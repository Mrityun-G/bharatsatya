import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LucideIcon,
  LayoutDashboard,
  FileText,
  UploadCloud,
  ScanSearch,
  CheckSquare,
  Inbox,
  FileCheck,
  Settings2,
  LockKeyhole,
  Building2,
  ShieldAlert,
  BadgeCheck,
  Ruler,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { demoMode } from '../services/demoData';

interface SidebarProps {
  isOpen: boolean;
  onNavigate: () => void;
}

interface NavSection {
  titleKey: string;
  items: {
    to: string;
    labelKey: string;
    icon: LucideIcon;
    requiresReviewer?: boolean;
    requiresAdmin?: boolean;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onNavigate }) => {
  const { user, switchDemoRole } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === 'ADMIN';
  const isReviewer = user?.role === 'REVIEWER' || isAdmin;

  const sections: NavSection[] = [
    {
      titleKey: 'sidebar.workspaces',
      items: [
        { to: '/applications', labelKey: 'sidebar.applications', icon: FileText },
        { to: '/', labelKey: 'sidebar.dashboard', icon: LayoutDashboard },
      ],
    },
    {
      titleKey: 'sidebar.scrutinyVerification',
      items: [
        { to: '/documents/intake', labelKey: 'sidebar.documentIntake', icon: UploadCloud },
        { to: '/documents/intelligence', labelKey: 'sidebar.documentIntelligence', icon: ScanSearch },
        { to: '/compliance', labelKey: 'sidebar.complianceChecklist', icon: CheckSquare },
        { to: '/anomalies', labelKey: 'sidebar.anomalyIndicators', icon: ShieldAlert },
        { to: '/verifications', labelKey: 'sidebar.sourceVerification', icon: BadgeCheck, requiresReviewer: true },
        { to: '/infrastructure', labelKey: 'sidebar.infrastructureCompliance', icon: Ruler },
        { to: '/reviews', labelKey: 'sidebar.reviewQueue', icon: Inbox, requiresReviewer: true },
      ],
    },
    {
      titleKey: 'sidebar.governanceRules',
      items: [
        { to: '/reports', labelKey: 'sidebar.reportsAudit', icon: FileCheck },
        { to: '/rules', labelKey: 'sidebar.ruleManagement', icon: Settings2, requiresAdmin: true },
      ],
    },
  ];

  return (
    <aside className={`app-sidebar-drawer${isOpen ? ' is-open' : ''}`} aria-label="Mobile Navigation Drawer">
      <div className="sidebar-drawer-header">
        <span className="sidebar-drawer-title">AICTE BharatSatya Menu</span>
        <button
          type="button"
          className="sidebar-drawer-close"
          onClick={onNavigate}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav aria-label="Mobile regulatory navigation" className="sidebar-drawer-nav">
        {sections.map((section) => (
          <div key={section.titleKey} className="sidebar-drawer-section">
            <div className="sidebar-section-title">{t(section.titleKey)}</div>
            <div className="sidebar-drawer-links">
              {section.items.map((item) => {
                const Icon = item.icon;
                const restricted =
                  (item.requiresAdmin && !isAdmin) || (item.requiresReviewer && !isReviewer);
                const translatedLabel = t(item.labelKey);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    aria-disabled={restricted}
                    tabIndex={restricted ? -1 : undefined}
                    onClick={(event) => {
                      if (restricted) {
                        event.preventDefault();
                      } else {
                        onNavigate();
                      }
                    }}
                    className={({ isActive }) =>
                      `drawer-nav-item${isActive ? ' active' : ''}${restricted ? ' restricted' : ''}`
                    }
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span>{translatedLabel}</span>
                    {restricted && (
                      <span className="nav-restricted">
                        <LockKeyhole size={11} />
                        {item.requiresAdmin ? t('sidebar.restrictedAdmin') : t('sidebar.restrictedReviewer')}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Institutional Context */}
      <div className="sidebar-institution-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <Building2 size={13} />
          <strong>{t('sidebar.activeWorkspace')}</strong>
        </div>
        <div style={{ fontSize: '11px', fontWeight: 600 }}>
          {user?.institution?.name || user?.department || (isAdmin ? 'Central AICTE Bureau' : 'AICTE Regulatory System')}
        </div>
        {user?.institution?.aictePermanentId && (
          <div style={{ fontSize: '10px', color: 'var(--gov-grey-muted)', marginTop: '2px' }}>
            Permanent ID: {user.institution.aictePermanentId}
          </div>
        )}
      </div>

      {demoMode && (
        <div className="mobile-demo-roles" aria-label="Switch synthetic demonstration role">
          {(['APPLICANT', 'REVIEWER', 'ADMIN'] as const).map((role) => (
            <button
              key={role}
              type="button"
              className={user?.role === role ? 'active' : ''}
              onClick={() => {
                void switchDemoRole(role);
                onNavigate();
              }}
            >
              {role === 'ADMIN' ? 'Admin' : role[0] + role.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
};
