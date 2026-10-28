import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../services/api';

interface Alert {
  id: string;
  applicationId?: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

const TYPE_COLOR: Record<string, string> = {
  MISSING: 'var(--gov-red)',
  EXPIRED: 'var(--gov-red)',
  MISMATCH: 'var(--gov-amber)',
  ANOMALY: 'var(--gov-amber)',
  PENDING_VERIFICATION: 'var(--gov-saffron)',
  SOURCE_UNAVAILABLE: 'var(--gov-grey-muted)',
  MANUAL_REVIEW: 'var(--gov-navy)',
  INSPECTION: 'var(--gov-navy)',
};

const POLL_MS = 60_000;

/** Header alert menu: missing items, expired documents, pending verifications, suspected anomalies. */
export const AlertsBell: React.FC = () => {
  const [items, setItems] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data.success) {
        setItems(res.data.data.items);
        setUnread(res.data.data.unreadCount);
      }
    } catch {
      // Alerts are a convenience; the rest of the page works without them.
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, []);

  const markRead = async (alert: Alert) => {
    if (alert.isRead) return;
    setItems((list) => list.map((a) => (a.id === alert.id ? { ...a, isRead: true } : a)));
    setUnread((n) => Math.max(0, n - 1));
    try { await api.patch(`/notifications/${alert.id}/read`); } catch { load(); }
  };

  const markAll = async () => {
    setItems((list) => list.map((a) => ({ ...a, isRead: true })));
    setUnread(0);
    try { await api.post('/notifications/read-all'); } catch { load(); }
  };

  return (
    <div className="header-dropdown-wrap" ref={ref}>
      <button
        type="button"
        className="gov-control-btn"
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread ? `Alerts, ${unread} unread` : 'Alerts'}
        title="Alerts"
        style={{ position: 'relative' }}
      >
        <Bell size={13} />
        <span>Alerts</span>
        {unread > 0 && (
          <span style={{ minWidth: '16px', height: '16px', padding: '0 4px', borderRadius: '8px', background: 'var(--gov-red)', color: '#FFFFFF', fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="gov-dropdown-menu" role="menu" style={{ width: 'min(360px, 92vw)', maxHeight: '420px', overflowY: 'auto', right: 0, left: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--gov-border)' }}>
            <strong style={{ fontSize: '13px' }}>Alerts</strong>
            {unread > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={markAll}>Mark all read</button>}
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '16px 12px', fontSize: '12px', color: 'var(--gov-grey-muted)' }}>No alerts. You'll be notified about missing or expired documents, pending verifications and suspected anomalies.</div>
          ) : items.map((a) => (
            <Link
              key={a.id}
              role="menuitem"
              to={a.applicationId ? `/applications/${encodeURIComponent(a.applicationId)}` : '/'}
              onClick={() => { markRead(a); setOpen(false); }}
              className="gov-dropdown-item"
              style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', textDecoration: 'none', whiteSpace: 'normal', fontWeight: a.isRead ? 400 : 600 }}
            >
              <span aria-hidden="true" style={{ flex: 'none', width: '8px', height: '8px', borderRadius: '4px', marginTop: '5px', background: a.isRead ? 'transparent' : TYPE_COLOR[a.type] || 'var(--gov-navy)', border: `1px solid ${TYPE_COLOR[a.type] || 'var(--gov-navy)'}` }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <span style={{ fontSize: '12px' }}>{a.title}</span>
                <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--gov-grey-text)' }}>{a.message}</span>
                <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--gov-grey-muted)' }}>
                  {a.applicationId ? `${a.applicationId} · ` : ''}{new Date(a.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
