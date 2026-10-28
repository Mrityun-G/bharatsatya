import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { demoMode } from '../services/demoData';
import { validateSignup, type SignupFieldErrors } from '../services/signupValidation';
import { AuthBrand } from '../components/AuthBrand';

type FormValues = { name: string; email: string; institutionName: string; designation: string; password: string; confirmPassword: string };
const emptyForm: FormValues = { name: '', email: '', institutionName: '', designation: '', password: '', confirmPassword: '' };

export const SignupPage: React.FC = () => {
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { registerDemoProfile } = useAuth();
  const navigate = useNavigate();
  const strength = useMemo(() => [form.password.length >= 8, /[A-Z]/.test(form.password) && /[a-z]/.test(form.password), /\d/.test(form.password), /[^A-Za-z0-9]/.test(form.password)].filter(Boolean).length, [form.password]);
  const setField = (field: keyof FormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setMessage('');
    if (!demoMode) { setError('Account registration is not available here. Contact your organization administrator.'); return; }
    const validation = validateSignup(form);
    setFieldErrors(validation);
    if (Object.keys(validation).length) { setError('Please correct the highlighted fields.'); return; }
    setIsLoading(true);
    try {
      registerDemoProfile({ name: form.name, email: form.email, institutionName: form.institutionName, designation: form.designation });
      setMessage('A browser-local synthetic applicant profile was created. No password was saved, no email was sent, and no real account was created.');
      window.setTimeout(() => navigate('/', { replace: true }), 1000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The demo profile could not be created.');
    } finally { setIsLoading(false); }
  };

  return <main className="auth-page">
    <AuthBrand />
    <div className="signup-wrap">
      <Link className="back-link" to="/login"><ArrowLeft size={16} /> Back to sign in</Link>
      <section className="auth-card signup-card" aria-labelledby="signup-heading">
        <div className="auth-card-heading"><span className="eyebrow">Applicant access</span><h1 id="signup-heading">Create your profile</h1><p>Enter your institutional details to prepare an applicant workspace.</p></div>
        {demoMode ? <div className="notice-warning" role="note">Demo registration creates a synthetic, browser-local applicant profile only. It does not verify your email or create an official account.</div> : <div className="notice-warning" role="status">Online registration is not configured. You can’t create a real account from this page; contact your organization administrator.</div>}
        {error && <div className="notice-error" role="alert">{error}</div>}
        {message && <div className="notice-success" role="status">{message}</div>}
        <form onSubmit={submit} noValidate>
          <div className="signup-grid">
            <div className="form-group"><label className="form-label" htmlFor="signup-name">Full name</label><input className="form-input" id="signup-name" autoComplete="name" aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? 'signup-name-error' : undefined} value={form.name} onChange={(e) => setField('name', e.target.value)} required disabled={!demoMode} />{fieldErrors.name && <small className="field-error" id="signup-name-error">{fieldErrors.name}</small>}</div>
            <div className="form-group"><label className="form-label" htmlFor="signup-email">Institutional email</label><input className="form-input" id="signup-email" type="email" autoComplete="email" aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined} value={form.email} onChange={(e) => setField('email', e.target.value)} required disabled={!demoMode} />{fieldErrors.email && <small className="field-error" id="signup-email-error">{fieldErrors.email}</small>}</div>
            <div className="form-group"><label className="form-label" htmlFor="signup-institution">Institution name</label><input className="form-input" id="signup-institution" autoComplete="organization" aria-invalid={!!fieldErrors.institutionName} aria-describedby={fieldErrors.institutionName ? 'signup-institution-error' : undefined} value={form.institutionName} onChange={(e) => setField('institutionName', e.target.value)} required disabled={!demoMode} />{fieldErrors.institutionName && <small className="field-error" id="signup-institution-error">{fieldErrors.institutionName}</small>}</div>
            <div className="form-group"><label className="form-label" htmlFor="signup-designation">Designation</label><input className="form-input" id="signup-designation" autoComplete="organization-title" aria-invalid={!!fieldErrors.designation} aria-describedby={fieldErrors.designation ? 'signup-designation-error' : undefined} value={form.designation} onChange={(e) => setField('designation', e.target.value)} required disabled={!demoMode} />{fieldErrors.designation && <small className="field-error" id="signup-designation-error">{fieldErrors.designation}</small>}</div>
            <div className="form-group"><label className="form-label" htmlFor="signup-password">Password</label><div className="input-with-icon input-password-only"><input className="form-input" id="signup-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'signup-password-error' : 'signup-strength'} value={form.password} onChange={(e) => setField('password', e.target.value)} required minLength={8} disabled={!demoMode} /><button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)} disabled={!demoMode}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><div className="strength-row" aria-live="polite" id="signup-strength"><span className={`strength-meter strength-${strength}`} /><small>{form.password ? ['Add length, letters, a number and a symbol', 'Weak', 'Fair', 'Good', 'Strong'][strength] : 'At least 8 characters'}</small></div>{fieldErrors.password && <small className="field-error" id="signup-password-error">{fieldErrors.password}</small>}</div>
            <div className="form-group"><label className="form-label" htmlFor="signup-confirm">Confirm password</label><div className="input-with-icon input-password-only"><input className="form-input" id="signup-confirm" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" aria-invalid={!!fieldErrors.confirmPassword} aria-describedby={fieldErrors.confirmPassword ? 'signup-confirm-error' : undefined} value={form.confirmPassword} onChange={(e) => setField('confirmPassword', e.target.value)} required disabled={!demoMode} /><button className="password-toggle" type="button" aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'} onClick={() => setShowConfirm((value) => !value)} disabled={!demoMode}>{showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{fieldErrors.confirmPassword && <small className="field-error" id="signup-confirm-error">{fieldErrors.confirmPassword}</small>}</div>
          </div>
          <button className="btn btn-primary auth-submit" type="submit" disabled={isLoading || !demoMode}>{isLoading ? 'Creating profile…' : 'Create demo profile'}<ArrowRight size={17} /></button>
        </form>
        <p className="signup-role-note">Demo profiles always have the applicant role. Selecting a UI role never grants real authorization.</p>
      </section>
    </div>
    <footer className="auth-footer">BharatSatya <span>•</span> Application validation and compliance assistance</footer>
  </main>;
};
