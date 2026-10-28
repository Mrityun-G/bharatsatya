import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { demoMode } from '../services/demoData';
import { Breadcrumb } from '../components/Breadcrumb';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import {
  Inbox,
  Filter,
  Search,
  MessageSquare,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Send,
  X,
} from 'lucide-react';

export const ReviewQueuePage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Clarification Modal State
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [deficiencyTitle, setDeficiencyTitle] = useState('');
  const [clarificationMessage, setClarificationMessage] = useState('');
  const [isSubmittingClarify, setIsSubmittingClarify] = useState(false);

  // Review Observation State
  const [reviewNote, setReviewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  const fetchQueue = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/applications', {
        params: {
          status: statusFilter,
          category: categoryFilter,
        },
      });
      if (res.data.success) {
        setApplications(res.data.data);
        if (res.data.data.length > 0) {
          // Default select the first or retain selected
          if (!selectedApp) {
            loadApplicationDetails(res.data.data[0].id);
          } else {
            loadApplicationDetails(selectedApp.id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load review queue', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadApplicationDetails = async (id: string) => {
    try {
      const res = await api.get(`/applications/${id}`);
      if (res.data.success) {
        setSelectedApp(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load application details', err);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [statusFilter, categoryFilter]);

  const handleSendClarification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !deficiencyTitle.trim() || !clarificationMessage.trim()) {
      alert('Title and specific clarification details are required.');
      return;
    }

    try {
      setIsSubmittingClarify(true);
      const res = await api.post('/reviews/clarification', {
        applicationId: selectedApp.id,
        deficiencyTitle,
        clarificationMessage,
      });

      if (res.data.success) {
        setShowClarifyModal(false);
        setDeficiencyTitle('');
        setClarificationMessage('');
        await loadApplicationDetails(selectedApp.id);
        fetchQueue();
      }
    } catch (err: any) {
      alert(`Error submitting clarification: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmittingClarify(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !reviewNote.trim()) return;

    try {
      setIsAddingNote(true);
      const res = await api.post('/reviews/note', {
        applicationId: selectedApp.id,
        note: reviewNote,
      });

      if (res.data.success) {
        setReviewNote('');
        await loadApplicationDetails(selectedApp.id);
      }
    } catch (err: any) {
      alert(`Error recording note: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsAddingNote(false);
    }
  };

  const findings = selectedApp?.validationFindings || [];
  const deficiencies = findings.filter((f: any) => f.status !== 'PASSED');

  return (
    <div>
      <Breadcrumb items={[{ label: t('sidebar.reviewQueue') }]} />

      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>{t('reviewQueue.title')}</h1>
          <p style={{ color: 'var(--gov-grey-muted)', fontSize: '13px', marginTop: '2px' }}>
            {t('reviewQueue.subtitle')}
          </p>
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            className="form-select"
            style={{ width: '180px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">{t('reviewQueue.allQueue')}</option>
            <option value="DEFICIENCY_FLAGGED">{t('status.DEFICIENCY_FLAGGED')}</option>
            <option value="CLARIFICATION_REQUESTED">{t('status.CLARIFICATION_REQUESTED')}</option>
            <option value="SUBMITTED">{t('status.SUBMITTED')}</option>
            <option value="VERIFIED_RECOMMENDED">{t('status.VERIFIED_RECOMMENDED')}</option>
          </select>

          <select
            className="form-select"
            style={{ width: '180px' }}
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
      </div>

      {/* Split Review Workspace: Left Queue List, Right Inspection Deck */}
      <div className="responsive-two-column" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '20px' }}>
        {/* Left: Application Queue List */}
        <div className="panel review-pane" style={{ height: '700px', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <div>
              <h2>{t('reviewQueue.caseQueue')} ({applications.length})</h2>
              <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>
                Sorted by submission timestamp & priority
              </div>
            </div>
          </div>

          <div className="panel-body" style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {applications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--gov-grey-muted)' }}>
                {t('reviewQueue.noCases')}
              </div>
            ) : (
              applications.map((app) => {
                const isSelected = selectedApp?.id === app.id;
                return (
                  <div
                    key={app.id}
                    onClick={() => loadApplicationDetails(app.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '4px',
                      border: isSelected ? '2px solid var(--gov-navy)' : '1px solid var(--gov-border)',
                      backgroundColor: isSelected ? 'var(--gov-surface-alt)' : 'var(--gov-card)',
                      cursor: 'pointer',
                      transition: 'all 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gov-navy)' }}>
                        {app.id}
                      </span>
                      <StatusBadge status={app.status} />
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gov-text)', marginTop: '4px' }}>
                      {app.institution?.name}
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{app.category.replace(/_/g, ' ')}</span>
                      <span>{new Date(app.submissionDate).toLocaleDateString('en-IN')}</span>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)', marginTop: '4px' }}>
                      {app.currentStage}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Inspection & Action Workspace */}
        {selectedApp ? (
          <div className="panel review-pane" style={{ height: '700px', display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{ padding: '14px 20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '16px' }}>{selectedApp.id} — {t('reviewQueue.inspectionDeck')}</h2>
                  <StatusBadge status={selectedApp.status} />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--gov-grey-muted)', marginTop: '2px' }}>
                  {selectedApp.institution?.name} · Permanent ID: {selectedApp.institution?.aictePermanentId}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowClarifyModal(true)} className="btn btn-saffron btn-sm">
                  <HelpCircle size={13} />
                  {t('reviewQueue.requestClarification')}
                </button>
                <Link to={`/applications/${selectedApp.id}`} className="btn btn-secondary btn-sm">
                  {t('common.viewDossier')}
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            <div className="panel-body" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {/* Flagged Deficiencies Section */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={16} color="var(--gov-red)" />
                  Flagged Deficiencies & Non-Compliances ({deficiencies.length})
                </h3>

                {deficiencies.length === 0 ? (
                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: 'var(--gov-green-light)',
                      border: '1px solid var(--gov-green-border)',
                      borderRadius: '3px',
                      fontSize: '12px',
                      color: 'var(--gov-green)',
                      fontWeight: 600,
                    }}
                  >
                    ✓ No findings were returned by the currently configured rules. Confirm that applicable documents and source rules are complete.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {deficiencies.map((f: any) => (
                      <div
                        key={f.id}
                        style={{
                          border: '1px solid var(--gov-border)',
                          borderLeft: '3px solid var(--gov-red)',
                          padding: '12px',
                          borderRadius: '0 4px 4px 0',
                          backgroundColor: 'var(--gov-card)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gov-navy)' }}>
                            {f.rule?.code}: {f.title}
                          </span>
                          <StatusBadge status={f.status} />
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)', marginTop: '2px' }}>
                          Configured source: {f.rule?.officialSourceReference}
                        </div>

                        <div style={{ fontSize: '12px', color: 'var(--gov-grey-text)', marginTop: '6px' }}>
                          {f.message}
                        </div>

                        {f.evidenceSnippet && (
                          <div
                            style={{
                              marginTop: '6px',
                              padding: '4px 8px',
                              backgroundColor: 'var(--gov-surface-alt)',
                              fontSize: '11px',
                              color: 'var(--gov-grey-muted)',
                              borderRadius: '2px',
                            }}
                          >
                            <strong>Evidence:</strong> {f.evidenceLocation} — <em>"{f.evidenceSnippet}"</em>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reviewer Action History & Internal Notes */}
              <div>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>{t('reviewQueue.recordedObservations')}</h3>

                <form onSubmit={handleAddNote} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={t('reviewQueue.addNotePlaceholder')}
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                    />
                    <button type="submit" className="btn btn-secondary btn-sm" disabled={isAddingNote || !reviewNote.trim()}>
                      <Send size={12} />
                      {t('reviewQueue.recordNoteBtn')}
                    </button>
                  </div>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedApp.reviewActions?.map((act: any) => (
                    <div
                      key={act.id}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: 'var(--gov-surface-alt)',
                        border: '1px solid var(--gov-border)',
                        borderRadius: '3px',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--gov-grey-muted)', fontSize: '11px' }}>
                        <span>
                          <strong>{act.reviewer?.name}</strong> ({act.reviewer?.role})
                        </span>
                        <span>{new Date(act.createdAt).toLocaleString('en-IN')}</span>
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--gov-navy)', marginTop: '4px' }}>
                        {act.reason}
                      </div>
                      {act.notes && (
                        <div style={{ color: 'var(--gov-grey-text)', marginTop: '2px' }}>{act.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--gov-grey-muted)' }}>{t('reviewQueue.selectToInspect')}</span>
          </div>
        )}
      </div>

      {/* Clarification Request Modal */}
      {showClarifyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div className="panel" style={{ width: '100%', maxWidth: '520px', margin: 0, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}>
            <div className="panel-header">
              <h2>{demoMode ? 'Record Simulated Clarification' : t('reviewQueue.clarifyModal.title')}</h2>
              <button onClick={() => setShowClarifyModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gov-text)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendClarification} style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">{t('reviewQueue.clarifyModal.titleLabel')}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Expired Fire NOC Clearance Submission"
                  value={deficiencyTitle}
                  onChange={(e) => setDeficiencyTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('reviewQueue.clarifyModal.messageLabel')}</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Describe the finding and the specific correction or supporting document requested..."
                  value={clarificationMessage}
                  onChange={(e) => setClarificationMessage(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowClarifyModal(false)} className="btn btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-saffron" disabled={isSubmittingClarify}>
                  {isSubmittingClarify ? (demoMode ? 'Recording...' : 'Sending request...') : (demoMode ? 'Record Demo Clarification' : t('reviewQueue.clarifyModal.sendBtn'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
