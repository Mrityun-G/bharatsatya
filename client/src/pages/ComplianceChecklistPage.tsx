import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Breadcrumb } from '../components/Breadcrumb';
import { StatusBadge } from '../components/StatusBadge';
import {
  CheckSquare,
  BookOpen,
  AlertCircle,
  FileText,
  Search,
  Filter,
  Shield,
  Layers,
} from 'lucide-react';

export const ComplianceChecklistPage: React.FC = () => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadRules() {
      try {
        setIsLoading(true);
        const res = await api.get('/rules', { params: { category: categoryFilter } });
        if (res.data.success) {
          setRules(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load compliance checklist', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadRules();
  }, [categoryFilter]);

  const filteredRules = rules.filter((r) => {
    return (
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div>
      <Breadcrumb items={[{ label: t('sidebar.complianceChecklist') }]} />

      <div style={{ marginBottom: '20px' }}>
        <h1>{t('compliance.title')}</h1>
        <p style={{ color: 'var(--gov-grey-muted)', fontSize: '13px', marginTop: '2px' }}>
          {t('compliance.subtitle')}
        </p>
      </div>

      <div className="notice-warning" role="note">
        {t('compliance.notice')}
      </div>

      {/* Filter and Notice Bar */}
      <div className="panel" style={{ padding: '14px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1 }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <Search size={14} color="var(--gov-grey-muted)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px' }}
                placeholder={t('compliance.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="form-select"
              style={{ width: '220px' }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">{t('categories.ALL')}</option>
              <option value="ENGINEERING_TECH">{t('categories.ENGINEERING_TECH')}</option>
              <option value="MANAGEMENT">{t('categories.MANAGEMENT')}</option>
              <option value="PHARMACY">{t('categories.PHARMACY')}</option>
              <option value="ARCHITECTURE">{t('categories.ARCHITECTURE')}</option>
              <option value="POLYTECHNIC">{t('categories.POLYTECHNIC')}</option>
            </select>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--gov-grey-muted)', display: 'flex', gap: '16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: 'var(--gov-green)', borderRadius: '50%' }} />
              {t('compliance.officialTag')} ({rules.filter((r) => r.isOfficial).length})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: 'var(--gov-amber)', borderRadius: '50%' }} />
              {t('compliance.illustrativeTag')} ({rules.filter((r) => !r.isOfficial).length})
            </span>
          </div>
        </div>
      </div>

      {/* Checklist Rules Table */}
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <div className="gov-table-container" style={{ border: 'none' }}>
            <table className="gov-table" style={{ minWidth: '880px' }}>
              <thead>
                <tr>
                  <th style={{ width: '140px', minWidth: '130px' }}>{t('compliance.colCode')}</th>
                  <th style={{ width: '260px', minWidth: '240px' }}>{t('compliance.colTitle')}</th>
                  <th style={{ minWidth: '240px' }}>{t('compliance.colRef')}</th>
                  <th style={{ width: '130px', minWidth: '120px' }}>{t('compliance.colType')}</th>
                  <th style={{ width: '100px', minWidth: '90px' }}>{t('compliance.colSeverity')}</th>
                  <th style={{ width: '100px', minWidth: '90px' }}>{t('compliance.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--gov-grey-muted)' }}>
                      {t('common.loading')}
                    </td>
                  </tr>
                ) : filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--gov-grey-muted)' }}>
                      No rules found matching search.
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => (
                    <tr key={rule.id}>
                      <td style={{ fontWeight: 700, color: 'var(--gov-navy)' }}>{rule.code}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--gov-navy)' }}>{rule.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>
                          Applies to: <strong>{rule.category}</strong> · Version {rule.version}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: 'var(--gov-grey-text)', fontWeight: 500 }}>
                          {rule.officialSourceReference}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)', marginTop: '2px' }}>
                          {rule.description}
                        </div>
                        {rule.isOfficial ? (
                          <div
                            style={{
                              marginTop: '4px',
                              display: 'inline-block',
                              fontSize: '10px',
                              fontWeight: 700,
                              color: 'var(--gov-green)',
                              backgroundColor: 'var(--gov-green-light)',
                              padding: '1px 5px',
                              borderRadius: '2px',
                            }}
                          >
                            ● {t('compliance.officialTag')}
                          </div>
                        ) : (
                          <div
                            style={{
                              marginTop: '4px',
                              display: 'inline-block',
                              fontSize: '10px',
                              fontWeight: 700,
                              color: 'var(--gov-amber)',
                              backgroundColor: 'var(--gov-amber-light)',
                              padding: '1px 5px',
                              borderRadius: '2px',
                            }}
                          >
                            ● {t('compliance.illustrativeTag')}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>
                          {rule.ruleType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '2px',
                            backgroundColor:
                              rule.severity === 'CRITICAL' ? 'var(--gov-red-light)' : 'var(--gov-amber-light)',
                            color: rule.severity === 'CRITICAL' ? 'var(--gov-red)' : 'var(--gov-amber)',
                          }}
                        >
                          {rule.severity}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: rule.isActive ? 'var(--gov-green)' : 'var(--gov-grey-muted)',
                          }}
                        >
                          {rule.isActive ? t('ruleManagement.active') : t('ruleManagement.inactive')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
