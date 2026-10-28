import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { demoMode } from '../services/demoData';
import { Breadcrumb } from '../components/Breadcrumb';
import { useAuth } from '../context/AuthContext';
import {
  Settings2,
  Plus,
  Edit2,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  History,
  X,
  CheckCircle2,
} from 'lucide-react';

export const RuleManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [rules, setRules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Rule Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRuleCode, setNewRuleCode] = useState('');
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleDesc, setNewRuleDesc] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState('ALL');
  const [newRuleRef, setNewRuleRef] = useState('');
  const [newRuleType, setNewRuleType] = useState('MANDATORY_DOCUMENT');
  const [newRuleSeverity, setNewRuleSeverity] = useState('CRITICAL');
  const [newRuleLogic, setNewRuleLogic] = useState('{\n  "threshold": 1.0\n}');
  const [isOfficial, setIsOfficial] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit / Version Modal
  const [editingRule, setEditingRule] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLogic, setEditLogic] = useState('');
  const [editCategory, setEditCategory] = useState('ALL');
  const [changeReason, setChangeReason] = useState('');

  const fetchRules = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/rules');
      if (res.data.success) {
        setRules(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load rules', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleToggle = async (ruleId: string) => {
    if (!isAdmin) {
      alert('Administrator authorization required to toggle rule state.');
      return;
    }

    const changeReason = window.prompt('Reason for activating or deactivating this rule:');
    if (!changeReason?.trim()) return;
    try {
      const res = await api.patch(`/rules/${ruleId}/toggle`, { changeReason });
      if (res.data.success) {
        fetchRules();
      }
    } catch (err: any) {
      alert(`Error toggling rule: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      JSON.parse(newRuleLogic);
    } catch {
      alert('Validation logic must be syntactically valid JSON.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post('/rules', {
        code: newRuleCode,
        title: newRuleTitle,
        description: newRuleDesc,
        category: newRuleCategory,
        officialSourceReference: newRuleRef,
        isOfficial,
        ruleType: newRuleType,
        severity: newRuleSeverity,
        logicConfigJson: newRuleLogic,
      });

      if (res.data.success) {
        setShowCreateModal(false);
        setNewRuleCode('');
        setNewRuleTitle('');
        setNewRuleDesc('');
        setNewRuleRef('');
        fetchRules();
      }
    } catch (err: any) {
      alert(`Error creating rule: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (r: any) => {
    setEditingRule(r);
    setEditTitle(r.title);
    setEditDesc(r.description);
    setEditLogic(r.logicConfigJson);
    setEditCategory(r.category);
    setChangeReason('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeReason.trim()) {
      alert('A change reason is mandatory to record this new rule version.');
      return;
    }

    try {
      const res = await api.put(`/rules/${editingRule.id}`, {
        title: editTitle,
        description: editDesc,
        category: editCategory,
        logicConfigJson: editLogic,
        changeReason,
      });

      if (res.data.success) {
        setEditingRule(null);
        fetchRules();
      }
    } catch (err: any) {
      alert(`Error updating rule: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <div>
      <Breadcrumb items={[{ label: t('sidebar.ruleManagement') }]} />

      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>{t('ruleManagement.title')}</h1>
          <p style={{ color: 'var(--gov-grey-muted)', fontSize: '13px', marginTop: '2px' }}>
            {t('ruleManagement.subtitle')}
          </p>
        </div>

        {isAdmin && (
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus size={16} />
            {t('ruleManagement.newRuleBtn')}
          </button>
        )}
      </div>

      {!isAdmin && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--gov-surface-alt)',
            border: '1px solid var(--gov-border)',
            borderRadius: '4px',
            marginBottom: '16px',
            fontSize: '12px',
            color: 'var(--gov-navy)',
          }}
        >
          <strong>Read-Only Notice:</strong> You are viewing rules under the <em>{user?.role}</em> role.
          Administrative privileges are required to create, edit, or toggle rules.
        </div>
      )}

      {/* Rules Table */}
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <div className="gov-table-container" style={{ border: 'none' }}>
            <table className="gov-table" style={{ minWidth: '960px' }}>
              <thead>
                <tr>
                  <th style={{ width: '130px', minWidth: '120px' }}>{t('ruleManagement.colCode')}</th>
                  <th style={{ minWidth: '220px' }}>{t('ruleManagement.colTitle')}</th>
                  <th style={{ minWidth: '220px' }}>{t('ruleManagement.colRef')}</th>
                  <th style={{ width: '130px', minWidth: '120px' }}>{t('ruleManagement.colCat')}</th>
                  <th style={{ width: '100px', minWidth: '90px' }}>{t('ruleManagement.colSev')}</th>
                  <th style={{ width: '80px', minWidth: '70px' }}>{t('ruleManagement.colVer')}</th>
                  <th style={{ width: '110px', minWidth: '100px' }}>{t('ruleManagement.colStatus')}</th>
                  <th style={{ width: '100px', minWidth: '90px' }}>{t('ruleManagement.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--gov-grey-muted)' }}>
                      {t('common.loading')}
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => (
                    <tr key={rule.id}>
                      <td style={{ fontWeight: 700, color: 'var(--gov-navy)' }}>{rule.code}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{rule.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>{rule.description}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '11px', color: 'var(--gov-grey-text)' }}>{rule.officialSourceReference}</div>
                        {rule.isOfficial ? (
                          <span style={{ fontSize: '10px', color: 'var(--gov-green)', fontWeight: 700 }}>
                            ● {t('compliance.officialTag')}
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--gov-amber)', fontWeight: 700 }}>
                            ● {t('compliance.illustrativeTag')}
                          </span>
                        )}
                      </td>
                      <td>{rule.category}</td>
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
                        <span style={{ fontWeight: 700 }}>v{rule.version}</span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggle(rule.id)}
                          disabled={!isAdmin}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: isAdmin ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: rule.isActive ? 'var(--gov-green)' : 'var(--gov-grey-muted)',
                            fontWeight: 700,
                            fontSize: '12px',
                          }}
                        >
                          {rule.isActive ? (
                            <>
                              <ToggleRight size={20} />
                              {t('ruleManagement.active')}
                            </>
                          ) : (
                            <>
                              <ToggleLeft size={20} />
                              {t('ruleManagement.inactive')}
                            </>
                          )}
                        </button>
                      </td>
                      <td>
                        {isAdmin && (
                          <button onClick={() => handleStartEdit(rule)} className="btn btn-secondary btn-sm">
                            <Edit2 size={12} />
                            Edit / Version
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Register New Rule Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div className="panel" style={{ width: '100%', maxWidth: '580px', margin: 0, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="panel-header">
              <h2>Register New Compliance Validation Rule</h2>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRule} style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">Rule Code (Unique)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. RULE-APH-11"
                  value={newRuleCode}
                  onChange={(e) => setNewRuleCode(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Rule Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Barrier-Free Access Norms for Persons with Disabilities"
                  value={newRuleTitle}
                  onChange={(e) => setNewRuleTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Rule Description</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Describe the regulatory verification condition..."
                  value={newRuleDesc}
                  onChange={(e) => setNewRuleDesc(e.target.value)}
                  required
                />
                <label className="form-label" style={{ marginTop: 12 }}>Applicable Category</label>
                <select className="form-input" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                  {['ALL', 'ENGINEERING_TECH', 'MANAGEMENT', 'PHARMACY', 'ARCHITECTURE', 'POLYTECHNIC'].map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Applicable Category</label>
                  <select
                    className="form-select"
                    value={newRuleCategory}
                    onChange={(e) => setNewRuleCategory(e.target.value)}
                  >
                    <option value="ALL">All Categories</option>
                    <option value="ENGINEERING_TECH">Engineering & Tech</option>
                    <option value="MANAGEMENT">Management</option>
                    <option value="PHARMACY">Pharmacy</option>
                    <option value="ARCHITECTURE">Architecture</option>
                    <option value="POLYTECHNIC">Polytechnic</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Severity Level</label>
                  <select
                    className="form-select"
                    value={newRuleSeverity}
                    onChange={(e) => setNewRuleSeverity(e.target.value)}
                  >
                    <option value="CRITICAL">Critical (Blocks Approval)</option>
                    <option value="MAJOR">Major (Deficiency Flagged)</option>
                    <option value="MINOR">Minor</option>
                    <option value="INFO">Informational</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Official Regulatory Handbook Reference</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. AICTE Approval Process Handbook (APH) 2026-27, Chapter II, Clause 2.18"
                  value={newRuleRef}
                  onChange={(e) => setNewRuleRef(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Validation Logic Configuration (JSON format)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                  value={newRuleLogic}
                  onChange={(e) => setNewRuleLogic(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Registering...' : 'Register Rule Baseline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Versioning Modal */}
      {editingRule && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div className="panel" style={{ width: '100%', maxWidth: '580px', margin: 0 }}>
            <div className="panel-header">
              <h2>Modify Rule & Commit Version {editingRule.version + 1}</h2>
              <button onClick={() => setEditingRule(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">Rule Code</label>
                <input type="text" className="form-input" value={editingRule.code} disabled />
              </div>

              <div className="form-group">
                <label className="form-label">Rule Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Rule Description</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Logic JSON Configuration</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                  value={editLogic}
                  onChange={(e) => setEditLogic(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mandatory Version Change Reason (For Legal Traceability)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Updated land norm in accordance with AICTE Gazette Notification 2026"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setEditingRule(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Commit Version {editingRule.version + 1}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
