/**
 * @jest-environment node
 */
// HR-CERT-SECURITY — the volume-completion email goes to the LEARNER's own
// brokerage only. Before: recipients were `profiles WHERE role IN
// ('admin','broker')` with no tenant filter, so every brokerage's admins and
// brokers were emailed whenever any agent anywhere finished a volume. The
// SendGrid call is the observable: every `to` address is asserted.

type Row = Record<string, any>;
let PROFILES: Row[] = [];
const quizInserts: any[] = [];

function chain(table: string): any {
  const filters: [string, string, any][] = [];
  const c: any = {};
  const match = () =>
    (table === 'profiles' ? PROFILES : []).filter((r) =>
      filters.every(([k, kind, v]) => (kind === 'eq' ? r[k] === v : kind === 'in' ? v.includes(r[k]) : true)),
    );
  c.select = jest.fn(() => c);
  c.eq = jest.fn((k: string, v: any) => (filters.push([k, 'eq', v]), c));
  c.in = jest.fn((k: string, v: any) => (filters.push([k, 'in', v]), c));
  c.is = jest.fn(() => c);
  c.order = jest.fn(() => c);
  c.insert = jest.fn(async (p: any) => {
    if (table === 'training_quiz_results') quizInserts.push(p);
    return { data: null, error: null };
  });
  c.update = jest.fn(() => c);
  c.maybeSingle = jest.fn(async () => {
    if (table === 'training_modules') return { data: { required_role: null }, error: null };
    if (table === 'profiles') return { data: match()[0] ?? null, error: null };
    return { data: null, error: null }; // no existing training_progress → fresh volume
  });
  c.single = jest.fn(async () => ({ data: match()[0] ?? null, error: null }));
  c.then = (res: any, rej: any) =>
    Promise.resolve(table === 'profiles' ? { data: match(), error: null } : { count: 0, data: null, error: null }).then(res, rej);
  return c;
}
const client = { from: jest.fn((t: string) => chain(t)) };

let currentUser = 'learner-a';
jest.mock('@/lib/security', () => ({
  requireAuth: jest.fn(async () => ({ user: { id: currentUser, email: `${currentUser}@x.test` } })),
  userClient: jest.fn(() => client),
  adminClient: jest.fn(() => client),
}));

import { POST } from '@/app/api/training/quiz/route';
import { MODULE_QUIZZES } from '@/app/data/quizzes';

const quiz = MODULE_QUIZZES['vol3_m1']; // Volume 3 completes on module 1 alone (VOLUME_MODULE_COUNTS[3] = [1])
const correct = Object.fromEntries(quiz.questions.map((q) => [q.id, q.correct]));
const req = (body: unknown): any => ({ json: async () => body, headers: { get: () => null } });
const fetchSpy = jest.fn(async () => ({ ok: true }));
const recipients = () =>
  fetchSpy.mock.calls.map((c: any[]) => JSON.parse(c[1].body).personalizations[0].to[0].email).sort();

beforeEach(() => {
  quizInserts.length = 0;
  currentUser = 'learner-a';
  PROFILES = [
    { id: 'learner-a', role: 'new_agent', tenant_id: 'T-A', full_name: 'Ann', email: 'ann@a.test' },
    { id: 'broker-a', role: 'broker', tenant_id: 'T-A', email: 'broker@a.test' },
    { id: 'admin-a', role: 'admin', tenant_id: 'T-A', email: 'admin@a.test' },
    { id: 'om-a', role: 'office_manager', tenant_id: 'T-A', email: 'om@a.test' },
    { id: 'broker-b', role: 'broker', tenant_id: 'T-B', email: 'broker@b.test' },
    { id: 'admin-b', role: 'admin', tenant_id: 'T-B', email: 'admin@b.test' },
    { id: 'broker-none', role: 'broker', tenant_id: null, email: 'orphan@x.test' },
    { id: 'learner-orphan', role: 'new_agent', tenant_id: null, full_name: 'Orph', email: 'o@x.test' },
  ];
  fetchSpy.mockClear();
  (global as any).fetch = fetchSpy;
  process.env.SENDGRID_API_KEY = 'test-key';
});
afterAll(() => { delete process.env.SENDGRID_API_KEY; });

describe('volume-completion email — learner tenant only', () => {
  it("✅ the learner's own brokerage's broker and admin are emailed (same-tenant notification preserved)", async () => {
    const res = await POST(req({ volume: 3, module_num: 1, answers: correct }));
    expect((await res.json()).volumeCompleted).toBe(true);
    expect(recipients()).toEqual(['admin@a.test', 'broker@a.test']);
  });

  it('🛑 no other brokerage, and no tenant-less account, receives a training email', async () => {
    await POST(req({ volume: 3, module_num: 1, answers: correct }));
    const to = recipients();
    expect(to).not.toContain('broker@b.test');
    expect(to).not.toContain('admin@b.test');
    expect(to).not.toContain('orphan@x.test');
  });

  it("🛑 a brokerage-B learner's completion never reaches brokerage A", async () => {
    PROFILES.push({ id: 'learner-b', role: 'new_agent', tenant_id: 'T-B', full_name: 'Bo', email: 'bo@b.test' });
    currentUser = 'learner-b';
    await POST(req({ volume: 3, module_num: 1, answers: correct }));
    expect(recipients()).toEqual(['admin@b.test', 'broker@b.test']);
  });

  it('🛑 a learner with NO tenant notifies nobody (fail closed); the result is still recorded', async () => {
    currentUser = 'learner-orphan';
    const res = await POST(req({ volume: 3, module_num: 1, answers: correct }));
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(quizInserts).toHaveLength(1);
  });

  it('a failed quiz sends no email at all', async () => {
    const wrong = Object.fromEntries(quiz.questions.map((q) => [q.id, 'z']));
    await POST(req({ volume: 3, module_num: 1, answers: wrong }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
