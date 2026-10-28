import React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, UserRound, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { AuthBrand } from '../components/AuthBrand';
import { useAuth } from '../context/AuthContext';
import { demoMode } from '../services/demoData';

const enabled = import.meta.env.DEV && demoMode && import.meta.env.VITE_DEMO_ACCESS === 'true';
const workspaces = [
  { role: 'APPLICANT' as const, label: 'Applicant workspace', icon: UserRound },
  { role: 'REVIEWER' as const, label: 'Reviewer workspace', icon: ClipboardCheck },
  { role: 'ADMIN' as const, label: 'Administrator workspace', icon: ShieldCheck },
];

export const DevDemoAccessPage: React.FC = () => {
  const { switchDemoRole } = useAuth();
  const navigate = useNavigate();
  if (!enabled) return <Navigate to="/login" replace />;

  return <main className="auth-page dev-demo-page">
    <AuthBrand />
    <section className="auth-card dev-demo-card">
      <span className="eyebrow">Development only</span>
      <h1>Choose a synthetic workspace</h1>
      <p>This local browser demonstration is not an authenticated account and does not grant real permissions.</p>
      <div className="dev-demo-options">{workspaces.map(({ role, label, icon: Icon }) => <button key={role} type="button" className="dev-demo-option" onClick={async () => { await switchDemoRole(role); navigate('/', { replace: true }); }}><Icon size={19} /><span>{label}</span><ArrowRight size={17} /></button>)}</div>
      <Link className="back-link" to="/login">Return to sign in</Link>
    </section>
  </main>;
};
