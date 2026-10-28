import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Crumb {
  label: string;
  to?: string;
}

interface Props {
  items: Crumb[];
}

export const Breadcrumb: React.FC<Props> = ({ items }) => {
  const { t } = useTranslation();

  return (
    <nav className="breadcrumb-nav">
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Home size={13} />
        <span>{t('sidebar.dashboard')}</span>
      </Link>
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          <ChevronRight size={12} style={{ opacity: 0.5 }} />
          {item.to ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <span style={{ color: 'var(--gov-grey-text)', fontWeight: 600 }}>{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
