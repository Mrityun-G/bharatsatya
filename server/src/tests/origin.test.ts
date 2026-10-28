import { describe, expect, it } from 'vitest';
import { isAllowedBrowserOrigin } from '../config/origin.js';

describe('browser origin policy', () => {
  it('allows only the configured browser origin in production', () => {
    expect(isAllowedBrowserOrigin('https://portal.example.gov', 'https://portal.example.gov', 'production')).toBe(true);
    expect(isAllowedBrowserOrigin('http://localhost:5173', undefined, 'production')).toBe(false);
    expect(isAllowedBrowserOrigin('https://localhost.evil.example', undefined, 'production')).toBe(false);
  });

  it('allows exact loopback origins for local development only', () => {
    expect(isAllowedBrowserOrigin('http://localhost:5173', undefined, 'development')).toBe(true);
    expect(isAllowedBrowserOrigin('http://127.0.0.1:5173', undefined, 'development')).toBe(true);
    expect(isAllowedBrowserOrigin('https://localhost.evil.example', undefined, 'development')).toBe(false);
    expect(isAllowedBrowserOrigin(undefined, undefined, 'production')).toBe(true);
  });
});
