import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { Breadcrumb } from '../components/Breadcrumb';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Search,
  Filter,
  X,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

export const ApplicationsPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal State for New Application Creation
  const [showModal, setShowModal] = useState(false);
  const [selectedInstId, setSelectedInstId] = useState(user?.institution?.id || 'INST-001');
  const [selectedCategory, setSelectedCategory] = useState('ENGINEERING_TECH');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.role === 'APPLICANT' && user.institution?.id) {
      setSelectedInstId(user.institution.id);
    }
  }, [user?.role, user?.institution?.id]);

  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const res = await api.get('/applications', {
        params: {
          category: categoryFilter,
          status: statusFilter,
          search: searchTerm,
        },
      });
      if (res.data.success) {
        setApplications(res.data.data);
        setCurrentPage(1); // Reset to first page on new fetch
      } else {
        setLoadError('Failed to retrieve applications from the server.');
      }
    } catch (err) {
      console.error('Failed to fetch applications', err);
      setLoadError('Applications could not be loaded. Please verify database connectivity and retry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchApplications();
  }, [categoryFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchApplications();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
  };

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post('/applications', {
        institutionId: user?.role === 'APPLICANT' ? user.institution?.id : selectedInstId,
        category: selectedCategory,
        academicYear: '2026-2027',
        remarks: remarks || 'Application submitted for review under the configured decision-support rules.',
      });

      if (res.data.success) {
        setShowModal(false);
        setRemarks('');
        void fetchApplications();
      }
    } catch (err: any) {
      alert(`Error creating application: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pagination calculation
  const totalCount = applications.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedApplications = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return applications.slice(start, start + pageSize);
  }, [applications, currentPage, pageSize]);

  // Scrutiny register summary counts
  const registerMetrics = useMemo(() => {
    let flagged = 0;
    let verified = 0;
    let pending = 0;
    for (const app of applications) {
      if (app.status === 'DEFICIENCY_FLAGGED' || app.status === 'REJECTED_NON_COMPLIANT') {
        flagged++;
      } else if (app.status === 'VERIFIED_RECOMMENDED' || app.status === 'APPROVED') {
        verified++;
      } else {
        pending++;
      }
    }
    return { flagged, verified, pending, total: applications.length };
  }, [applications]);

  return (
    <div className="gov-page-container">
      <Breadcrumb items={[{ label: t('applications.breadcrumb') }]} />

      {loadError && (
        <div className="notice-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={15} />
            <span>{loadError}</span>
          </div>
          <button type="button" className="gov-btn gov-btn-secondary gov-btn-xs" onClick={fetchApplications}>
            <RotateCcw size={12} /> {t('common.retry')}
          </button>
        </div>
      )}

      {/* Institutional Page Title & Action Bar */}
      <div className="gov-page-header">
        <div className="gov-page-titles">
          <h1 className="gov-page-h1">{t('applications.title')}</h1>
          <p className="gov-page-sub">{t('applications.subtitle')}</p>
        </div>

        <div className="gov-page-actions">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="gov-btn gov-btn-primary"
          >
            <Plus size={14} />
            <span>{t('applications.createNew')}</span>
          </button>
        </div>
      </div>

      {/* Scrutiny Register Summary Bar (Institutional Restraint) */}
      <div className="gov-register-summary-bar">
        <div className="gov-summary-item">
          <span className="gov-summary-label">Total Registered</span>
          <span className="gov-summary-value">{registerMetrics.total}</span>
        </div>
        <div className="gov-summary-divider" />
        <div className="gov-summary-item">
          <span className="gov-summary-label">Pending Scrutiny</span>
          <span className="gov-summary-value text-amber">{registerMetrics.pending}</span>
        </div>
        <div className="gov-summary-divider" />
        <div className="gov-summary-item">
          <span className="gov-summary-label">Deficiencies Flagged</span>
          <span className="gov-summary-value text-red">{registerMetrics.flagged}</span>
        </div>
        <div className="gov-summary-divider" />
        <div className="gov-summary-item">
          <span className="gov-summary-label">Verified & Recommended</span>
          <span className="gov-summary-value text-green">{registerMetrics.verified}</span>
        </div>
      </div>

      {/* High-Density Administrative Filter Toolbar */}
      <div className="gov-filter-panel">
        <form onSubmit={handleSearchSubmit} className="gov-filter-form">
          <div className="gov-search-wrap">
            <Search size={14} className="gov-search-icon" />
            <input
              type="text"
              className="gov-input"
              placeholder={t('applications.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="gov-search-clear"
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="gov-select-wrap">
            <select
              className="gov-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              title="Filter by stream / category"
            >
              <option value="ALL">{t('categories.ALL')}</option>
              <option value="ENGINEERING_TECH">{t('categories.ENGINEERING_TECH')}</option>
              <option value="MANAGEMENT">{t('categories.MANAGEMENT')}</option>
              <option value="PHARMACY">{t('categories.PHARMACY')}</option>
              <option value="ARCHITECTURE">{t('categories.ARCHITECTURE')}</option>
              <option value="POLYTECHNIC">{t('categories.POLYTECHNIC')}</option>
            </select>
          </div>

          <div className="gov-select-wrap">
            <select
              className="gov-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              title="Filter by regulatory scrutiny status"
            >
              <option value="ALL">{t('common.allStatuses')}</option>
              <option value="SUBMITTED">{t('status.SUBMITTED')}</option>
              <option value="UNDER_AUTOMATED_REVIEW">{t('status.UNDER_AUTOMATED_REVIEW')}</option>
              <option value="DEFICIENCY_FLAGGED">{t('status.DEFICIENCY_FLAGGED')}</option>
              <option value="CLARIFICATION_REQUESTED">{t('status.CLARIFICATION_REQUESTED')}</option>
              <option value="VERIFIED_RECOMMENDED">{t('status.VERIFIED_RECOMMENDED')}</option>
              <option value="APPROVED">{t('status.APPROVED')}</option>
              <option value="REJECTED_NON_COMPLIANT">{t('status.REJECTED_NON_COMPLIANT')}</option>
            </select>
          </div>

          <div className="gov-filter-btns">
            <button type="submit" className="gov-btn gov-btn-secondary">
              <Filter size={13} />
              <span>{t('common.applyFilter')}</span>
            </button>
            {(searchTerm || categoryFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="gov-btn gov-btn-secondary"
                title={t('common.resetFilters')}
              >
                <RotateCcw size={13} />
                <span>{t('common.reset')}</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Administrative Register Table Card */}
      <div className="gov-register-box">
        <div className="gov-table-wrapper">
          <table className="gov-register-table">
            <thead>
              <tr>
                <th className="th-id">{t('applications.colId')}</th>
                <th className="th-inst">{t('applications.colInstitution')}</th>
                <th className="th-category">{t('applications.colCategory')}</th>
                <th className="th-cycle">{t('applications.colCycle')}</th>
                <th className="th-docs">{t('applications.colDocs')}</th>
                <th className="th-findings">{t('applications.colFindings')}</th>
                <th className="th-status">{t('applications.colStatus')}</th>
                <th className="th-actions">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="gov-td-center gov-td-empty">
                    <span>{t('common.loading')}</span>
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={8} className="gov-td-center gov-td-empty">
                    <button type="button" className="gov-btn gov-btn-secondary gov-btn-xs" onClick={fetchApplications}>
                      <RotateCcw size={12} /> {t('common.retry')}
                    </button>
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="gov-td-center gov-td-empty">
                    <div className="gov-empty-content">
                      <FileSpreadsheet size={28} className="gov-empty-icon" />
                      <strong>{t('applications.emptyTitle')}</strong>
                      <p>{t('applications.emptyDesc')}</p>
                      {(searchTerm || categoryFilter !== 'ALL' || statusFilter !== 'ALL') && (
                        <button
                          type="button"
                          className="gov-btn gov-btn-secondary gov-btn-xs"
                          onClick={handleResetFilters}
                        >
                          <RotateCcw size={12} /> {t('common.resetFilters')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedApplications.map((app) => (
                  <tr key={app.id}>
                    <td className="cell-id">
                      <Link
                        to={`/applications/${app.id}`}
                        className="gov-link-id"
                        title={`${t('common.inspectDossier')}: ${app.id}`}
                      >
                        {app.id}
                      </Link>
                    </td>
                    <td className="cell-inst">
                      <div className="inst-name">{app.institution?.name}</div>
                      <div className="inst-details">
                        Permanent ID: <span className="inst-perm-id">{app.institution?.aictePermanentId}</span> · {app.institution?.district}, {app.institution?.state}
                      </div>
                    </td>
                    <td className="cell-category">
                      <span className="gov-discipline-tag">
                        {String(t(`categories.${app.category}`, app.category?.replace(/_/g, ' ')))}
                      </span>
                    </td>
                    <td className="cell-cycle">
                      <span className="gov-academic-year">{app.academicYear}</span>
                    </td>
                    <td className="cell-docs">
                      <span className="gov-num-docs">
                        {app._count?.documents ?? app.documents?.length ?? 0}
                      </span>
                    </td>
                    <td className="cell-findings">
                      <span className="gov-num-findings">
                        {app._count?.validationFindings ?? app.validationFindings?.length ?? 0}
                      </span>
                    </td>
                    <td className="cell-status">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="cell-actions">
                      <Link
                        to={`/applications/${app.id}`}
                        className="gov-btn-dossier"
                        title={`Inspect regulatory dossier for ${app.id}`}
                      >
                        {t('common.viewDossier')}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Dense Administrative Pagination Footer */}
        {!isLoading && applications.length > 0 && (
          <div className="gov-pagination-bar">
            <div className="gov-pagination-count">
              {t('common.showing')}{' '}
              <strong>
                {Math.min(totalCount, (currentPage - 1) * pageSize + 1)}–
                {Math.min(totalCount, currentPage * pageSize)}
              </strong>{' '}
              {t('common.of')} <strong>{totalCount}</strong> applications
            </div>

            <div className="gov-pagination-controls">
              <div className="gov-rows-select-wrap">
                <span className="gov-rows-label">{t('common.rowsPerPage')}:</span>
                <select
                  className="gov-rows-select"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="gov-page-nav-btns">
                <button
                  type="button"
                  className="gov-btn-page"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label={t('common.prev')}
                >
                  <ChevronLeft size={13} />
                  <span>{t('common.prev')}</span>
                </button>

                <span className="gov-page-counter">
                  {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  className="gov-btn-page"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  aria-label={t('common.next')}
                >
                  <span>{t('common.next')}</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal for Creating New Institutional Application */}
      {showModal && (
        <div className="gov-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="gov-modal-window">
            <div className="gov-modal-header">
              <h2 id="modal-title" className="gov-modal-h2">{t('applications.modalTitle')}</h2>
              <button
                type="button"
                className="gov-modal-close"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateApplication}>
              <div className="gov-modal-body">
                {user?.role !== 'APPLICANT' && (
                  <div className="gov-field-group">
                    <label className="gov-field-label">{t('applications.modalInstitution')}</label>
                    <select
                      className="gov-select"
                      value={selectedInstId}
                      onChange={(e) => setSelectedInstId(e.target.value)}
                    >
                      <option value="INST-001">Vellore Jawaharlal Institute of Technology (INST-001)</option>
                      <option value="INST-002">National Institute of Pharmaceutical Sciences (INST-002)</option>
                      <option value="INST-003">Bhopal Regional Polytechnic (INST-003)</option>
                    </select>
                  </div>
                )}

                <div className="gov-field-group">
                  <label className="gov-field-label">{t('applications.modalCategory')}</label>
                  <select
                    className="gov-select"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="ENGINEERING_TECH">{t('categories.ENGINEERING_TECH')}</option>
                    <option value="MANAGEMENT">{t('categories.MANAGEMENT')}</option>
                    <option value="PHARMACY">{t('categories.PHARMACY')}</option>
                    <option value="ARCHITECTURE">{t('categories.ARCHITECTURE')}</option>
                    <option value="POLYTECHNIC">{t('categories.POLYTECHNIC')}</option>
                  </select>
                </div>

                <div className="gov-field-group">
                  <label className="gov-field-label">{t('applications.modalAcademicYear')}</label>
                  <input
                    type="text"
                    className="gov-input"
                    value="2026-2027"
                    disabled
                  />
                </div>

                <div className="gov-field-group">
                  <label className="gov-field-label">{t('applications.modalRemarks')}</label>
                  <textarea
                    className="gov-textarea"
                    rows={3}
                    placeholder={t('applications.modalRemarksPlaceholder')}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              </div>

              <div className="gov-modal-footer">
                <button
                  type="button"
                  className="gov-btn gov-btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="gov-btn gov-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t('common.loading') : t('applications.modalSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
