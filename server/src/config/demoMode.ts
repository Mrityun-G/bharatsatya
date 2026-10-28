export function isLocalDemoEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'development' && env.DEMO_ACCOUNTS_MODE === 'local' && env.VERCEL !== '1';
}
