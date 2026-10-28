import React from 'react';

export const AuthBrand: React.FC<{ institutional?: boolean }> = ({ institutional = false }) => (
  <div className="auth-topline">
    <img className="aicte-logo" src="/assets/aicte-logo.png" alt="All India Council for Technical Education (AICTE) emblem" />
    <div className="auth-brand-copy">
      <strong>BharatSatya</strong>
      <span>Institutional compliance portal</span>
    </div>
    {institutional && <div className="auth-institution-copy"><strong>All India Council for Technical Education</strong><span>Ministry of Education · Government of India</span></div>}
  </div>
);
