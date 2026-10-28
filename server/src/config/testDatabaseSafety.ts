export interface LocalTestDatabaseTarget {
  hostname: string;
  port: string;
  databaseName: string;
}

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const TEST_DATABASE_PREFIX = 'bharatsatya_test_';

export function parseLocalTestDatabaseUrl(value: string | undefined, variableName: string): LocalTestDatabaseTarget {
  if (!value) throw new Error(`${variableName} must be set to a dedicated local test database.`);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL connection URL.`);
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const hostname = url.hostname.toLowerCase();
  const routingOverrides = ['host', 'hostaddr', 'port', 'dbname', 'database', 'service', 'servicefile'];
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !LOCAL_DATABASE_HOSTS.has(hostname) ||
      [...url.searchParams.keys()].some((parameter) => routingOverrides.includes(parameter.toLowerCase())) ||
      !/^bharatsatya_test_[0-9a-f]{32}$/.test(databaseName)) {
    throw new Error(`${variableName} must target a local PostgreSQL database named ${TEST_DATABASE_PREFIX}<32-character-guid>.`);
  }

  return { hostname, port: url.port || '5432', databaseName };
}

function sameTarget(left: LocalTestDatabaseTarget, right: LocalTestDatabaseTarget): boolean {
  return left.hostname === right.hostname && left.port === right.port && left.databaseName === right.databaseName;
}

export function assertMatchingTestDatabaseUrls(
  testDatabaseUrl: string | undefined,
  testDirectUrl: string | undefined,
): { databaseName: string } {
  const database = parseLocalTestDatabaseUrl(testDatabaseUrl, 'TEST_DATABASE_URL');
  const direct = parseLocalTestDatabaseUrl(testDirectUrl, 'TEST_DIRECT_URL');
  if (!sameTarget(database, direct)) {
    throw new Error('TEST_DATABASE_URL and TEST_DIRECT_URL must point to the same local test database.');
  }
  return { databaseName: database.databaseName };
}

export function assertRuntimeMatchesTestDatabase(env: NodeJS.ProcessEnv = process.env): { databaseName: string } {
  const target = assertMatchingTestDatabaseUrls(env.TEST_DATABASE_URL, env.TEST_DIRECT_URL);
  const runtimeDatabase = parseLocalTestDatabaseUrl(env.DATABASE_URL, 'DATABASE_URL');
  const runtimeDirect = parseLocalTestDatabaseUrl(env.DIRECT_URL, 'DIRECT_URL');
  const expected = parseLocalTestDatabaseUrl(env.TEST_DATABASE_URL, 'TEST_DATABASE_URL');

  if (!sameTarget(runtimeDatabase, expected) || !sameTarget(runtimeDirect, expected)) {
    throw new Error('DATABASE_URL and DIRECT_URL must both match the explicitly designated local test database.');
  }
  return target;
}
