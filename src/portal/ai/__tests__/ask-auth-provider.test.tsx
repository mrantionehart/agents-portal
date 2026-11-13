// ============================================================================
// Ask HartFelt AI must read auth from the MOUNTED provider
// ============================================================================
// #138 imported useAuth from '@/lib/auth-context', whose AuthProvider is not
// mounted anywhere in the portal (Portal 2.0 mounts app/providers.tsx). TopBar
// calls useAskEnabled on EVERY portal page, so every signed-in page threw
// "useAuth must be used within an AuthProvider" in production. The ask.ui suite
// mocked the module, so it could not see this. These tests use the REAL modules.
// ============================================================================

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { renderHook } from '@testing-library/react';

jest.mock('../ask-api', () => ({ askStatus: jest.fn(() => Promise.resolve(false)) }));

import { useAskEnabled } from '../use-ask-enabled';

it('useAskEnabled renders with the real app/providers context (no AuthProvider error)', () => {
  const { result } = renderHook(() => useAskEnabled());
  expect(result.current).toBe(false); // default context: loading, no user → hidden
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name === '__tests__') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

it('no portal module imports the unmounted legacy @/lib/auth-context', () => {
  const files = [...walk(join(process.cwd(), 'src/portal')), ...walk(join(process.cwd(), 'app/(portal)'))];
  expect(files.length).toBeGreaterThan(20);
  const offenders = files.filter((f) =>
    /from\s+['"]@\/lib\/auth-context['"]/.test(readFileSync(f, 'utf8')),
  );
  expect(offenders).toEqual([]);
});
