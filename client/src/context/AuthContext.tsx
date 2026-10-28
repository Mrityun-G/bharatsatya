import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { User } from '../types';
import { createDemoProfile, demoMode, demoSignIn, demoSignOut, restoreDemoUser, type DemoProfileInput } from '../services/demoData';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  registerDemoProfile: (profile: DemoProfileInput) => User;
  logout: () => void;
  switchDemoRole: (role: 'APPLICANT' | 'REVIEWER' | 'ADMIN') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => demoMode ? restoreDemoUser() : null);
  const [token, setToken] = useState<string | null>(() => demoMode ? null : localStorage.getItem('bharatsatya_auth_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (demoMode) {
        setUser(restoreDemoUser());
        setIsLoading(false);
        return;
      }
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        if (res.data.success) {
          setUser(res.data.data);
        }
      } catch {
        localStorage.removeItem('bharatsatya_auth_token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (email: string, password: string): Promise<boolean> => {
    if (demoMode) {
      const normalized = email.toLowerCase();
      const role = normalized.includes('reviewer') ? 'REVIEWER' : normalized.includes('admin') ? 'ADMIN' : 'APPLICANT';
      setUser(demoSignIn(role));
      return true;
    }
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        const { token: newToken, user: newUser } = res.data.data;
        localStorage.setItem('bharatsatya_auth_token', newToken);
        setToken(newToken);
        setUser(newUser);
        return true;
      }
      return false;
    } catch (error: any) {
      // Do not log Axios errors: their request config may contain the submitted password.
      if (!error.response || error.response.status >= 500) {
        throw new Error('Authentication service is unavailable. Check the API connection and try again.');
      }
      return false;
    }
  };

  const registerDemoProfile = (profile: DemoProfileInput): User => {
    if (!demoMode) throw new Error('Registration is unavailable: no account-registration API is configured.');
    const created = createDemoProfile(profile);
    setUser(created);
    return created;
  };

  const loginWithGoogle = async (idToken: string): Promise<void> => {
    if (demoMode) throw new Error('Google authentication is unavailable in synthetic demo mode. Choose a demo workspace instead.');
    try {
      const response = await api.post('/auth/google', { idToken });
      if (!response.data.success || !response.data.data?.token || !response.data.data?.user) {
        throw new Error('Google sign-in could not be completed.');
      }
      const { token: newToken, user: newUser } = response.data.data;
      localStorage.setItem('bharatsatya_auth_token', newToken);
      setToken(newToken);
      setUser(newUser);
    } catch (error: any) {
      const message = error.response?.data?.message;
      if (typeof message === 'string') throw new Error(message);
      if (error instanceof Error && error.message === 'Google sign-in could not be completed.') throw error;
      throw new Error('Google sign-in service is unavailable. Try again or use your institutional credentials.');
    }
  };

  const logout = () => {
    if (demoMode) { demoSignOut(); setUser(null); return; }
    localStorage.removeItem('bharatsatya_auth_token');
    setToken(null);
    setUser(null);
  };

  const switchDemoRole = async (role: 'APPLICANT' | 'REVIEWER' | 'ADMIN') => {
    if (demoMode) { setUser(demoSignIn(role)); return; }
    try {
      const response = await api.get('/auth/demo-accounts');
      const account = response.data.accounts?.find((candidate: { role: string }) => candidate.role === role);
      if (!response.data.enabled || !account?.email) return;
      const password = window.prompt(`Enter the locally configured password for ${account.label}:`);
      if (password) await login(account.email, password);
    } catch {
      // Demo discovery is intentionally unavailable outside explicitly enabled local development.
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginWithGoogle,
        registerDemoProfile,
        logout,
        switchDemoRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
