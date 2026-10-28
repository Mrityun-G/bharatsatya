export function isAllowedBrowserOrigin(
  origin: string | undefined,
  configuredOrigin: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  if (!origin) return true; // Non-browser clients do not send an Origin header.
  if (configuredOrigin && origin === configuredOrigin) return true;
  if (nodeEnv === 'production') return false;

  try {
    const parsed = new URL(origin);
    return ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) && parsed.origin === origin;
  } catch {
    return false;
  }
}
