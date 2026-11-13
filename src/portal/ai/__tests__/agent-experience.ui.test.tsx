import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AgentExperience from '../AgentExperience';
jest.mock('@/app/providers', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ getAccessToken: jest.fn() }));
import { useAuth } from '@/app/providers';
import { getAccessToken } from '@/lib/supabase';
const network = jest.fn();
const item = { id: 'r1', question: 'Please help', status: 'open', created_at: '2026-11-11', transaction_id: 't1', resolution: null };
const report = { transaction_id: 't1', report_only: true, summary: 'Human review required', attention_items: [{ type: 'missing_document', severity: 'medium', due_at: null, source_record_ref: 'ref', evidence: [{ ref: 'ref', note: 'Missing: Contract' }] }], readiness: [{ key: 'broker', label: 'BoR sign-off', status: 'NOT ASSESSED', evidence: [] }] };
const response = (data: object, status = 200) => ({ ok: status < 400, status, json: async () => data });
beforeEach(() => {
  jest.clearAllMocks(); network.mockReset(); global.fetch = network;
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'a1' }, role: 'agent', loading: false });
  (getAccessToken as jest.Mock).mockResolvedValue('token');
  if (!AbortSignal.timeout) AbortSignal.timeout = () => new AbortController().signal;
  network.mockImplementation(async (url: string, options: RequestInit) => {
    if (url.endsWith('/status')) return response({ enabled: true });
    if (url.includes('/kb/search')) return response({ results: [{ id: 'k1', section_key: 'upload', heading: 'Upload procedure', version: '2', body: 'Returned procedure text '.repeat(20) }] });
    if (url.endsWith('/ask')) return response({ answer: 'Transaction answer', citations: [], disclaimer: 'Human review', conversation_id: 'c1' });
    if (url.includes('/tc/transactions/')) return response(report);
    if (url.endsWith('/messages')) return response({ saved: true });
    if (url.endsWith('/requests/r1')) return response({ item, messages: [{ id: 'm1', body: 'Agent-visible response', created_at: '2026-11-11' }] });
    return response(options.method === 'POST' ? { id: 'r1' } : { items: [item] });
  });
});
const mount = () => render(<AgentExperience transactionId="t1" />);
test.each(['disabled', 'error', '503'])('%s status hides every new surface', async state => {
  network.mockImplementation(async () => { if (state === 'error') throw new Error('offline'); return response({ enabled: false }, state === '503' ? 503 : 200); });
  mount(); await waitFor(() => expect(network).toHaveBeenCalledTimes(1));
  expect(screen.queryByText('Search procedures')).toBeNull();
  expect(screen.queryByText('Transaction assistance')).toBeNull();
  expect(screen.queryByText('Request broker assistance')).toBeNull();
  expect(screen.queryByRole('navigation')).toBeNull();
});
test.each(['broker', 'admin', 'office_manager'])('%s sees no surfaces or requests', role => {
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'a1' }, role, loading: false });
  mount(); expect(network).not.toHaveBeenCalled(); expect(screen.queryByRole('navigation')).toBeNull();
});
test('procedures show returned title/version/snippet and expandable full text; training stays in portal', async () => {
  mount(); fireEvent.change(await screen.findByLabelText('Procedure query'), { target: { value: 'upload & sign' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search procedures' }));
  expect(await screen.findByText('Upload procedure · v2')).toBeVisible();
  fireEvent.click(screen.getByText('Open full text: Upload procedure'));
  expect(screen.getByText('Returned procedure text '.repeat(20).trim())).toBeVisible();
  expect(network.mock.calls.some(([url]) => url.endsWith('q=upload%20%26%20sign'))).toBe(true);
  expect(screen.getByRole('link', { name: 'Training library' })).toHaveAttribute('href', '/training');
  expect(screen.getByRole('link', { name: 'Training checklist' })).toHaveAttribute('href', '/training/checklist');
  expect(screen.getByRole('link', { name: 'Training wizard' })).toHaveAttribute('href', '/training/wizard');
});
test('transaction report preserves NOT ASSESSED and asks with transaction context', async () => {
  mount(); expect(await screen.findByText('BoR sign-off: NOT ASSESSED')).toBeVisible();
  expect(screen.getByText('Missing: Contract')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'What next?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit question' }));
  expect(await screen.findByText('Transaction answer')).toBeVisible();
  const call = network.mock.calls.find(([url]) => url.endsWith('/tc/transactions/t1/ask'));
  expect(JSON.parse(call[1].body)).toEqual({ question: 'What next?', surface: 'ap' });
  expect(call[1]).toEqual(expect.objectContaining({ credentials: 'omit', headers: expect.objectContaining({ Authorization: 'Bearer token' }) }));
});
test('create linked request, view public messages and reply', async () => {
  mount(); fireEvent.change(await screen.findByLabelText('Assistance request'), { target: { value: 'Please help' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
  expect(await screen.findByText('Agent-visible response')).toBeVisible();
  const create = network.mock.calls.find(([url, options]) => url.endsWith('/requests') && options.method === 'POST');
  expect(JSON.parse(create[1].body)).toEqual({ question: 'Please help', transaction_id: 't1' });
  fireEvent.change(screen.getByLabelText('Reply'), { target: { value: 'Thank you' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  await waitFor(() => expect(network.mock.calls.some(([url, options]) => url.endsWith('/messages') && options.body === JSON.stringify({ body: 'Thank you' }))).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'Please help · open' }));
  expect(await screen.findByText('Status: open')).toBeVisible();
});
test.each([404, 503])('%i from new endpoints fails quietly', async status => {
  network.mockImplementation(async (url: string) => url.endsWith('/status') ? response({ enabled: true }) : response({ unavailable: true }, status));
  mount(); expect(await screen.findByText('Transaction assistance not available.')).toBeVisible();
  expect(await screen.findByText('Broker assistance not available.')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Procedure query'), { target: { value: 'upload' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search procedures' }));
  expect(await screen.findByText('Procedures not available.')).toBeVisible();
  expect(screen.queryByLabelText('Assistance request')).toBeNull();
});
test('identity change removes loaded content', async () => {
  const view = mount(); await screen.findByText('Missing: Contract');
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'b1' }, role: 'broker', loading: false });
  view.rerender(<AgentExperience transactionId="t1" />); expect(screen.queryByText('Missing: Contract')).toBeNull();
});
test('new_agent can create an unlinked request', async () => {
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'a1' }, role: 'new_agent', loading: false });
  render(<AgentExperience />);
  fireEvent.change(await screen.findByLabelText('Assistance request'), { target: { value: 'Please help' } });
  expect(screen.queryByLabelText('Link to this transaction')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
  await screen.findByText('Agent-visible response');
  const call = network.mock.calls.find(([url, options]) => url.endsWith('/requests') && options.method === 'POST');
  expect(JSON.parse(call[1].body)).toEqual({ question: 'Please help' });
});
test('503 on transaction Ask and support creation reports unavailable without success', async () => {
  const normal = network.getMockImplementation()!;
  network.mockImplementation((url, options) => options.method === 'POST' ? Promise.resolve(response({ unavailable: true }, 503)) : normal(url, options));
  mount(); await screen.findByText('Missing: Contract');
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'What next?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit question' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Not available');
  fireEvent.change(await screen.findByLabelText('Assistance request'), { target: { value: 'Please help' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
  expect(await screen.findByText('Broker assistance not available.')).toBeVisible();
  expect(screen.queryByRole('article')).toBeNull();
});

test.each(['present', 'absent', 'empty'])('transaction Ask opens citations and renders %s party_display', async state => {
  const normal = network.getMockImplementation()!;
  network.mockImplementation((url, options) => {
    if (url.includes('/kb/source?')) return Promise.resolve(response({ section_key: 'policy & upload', heading: 'Published procedure', body: 'Full transaction source body', version: 2 }));
    if (url.endsWith('/ask')) return Promise.resolve(response({ answer: 'Cited answer', disclaimer: 'Human review', citations: [
      { section_key: 'policy & upload', title: 'Upload policy', version: 2, status: 'published' },
      { section_key: 'transaction_parties:p1', title: 'Buyer record', version: 1, status: 'vault_record' },
    ], ...(state === 'absent' ? {} : { party_display: state === 'empty' ? [] : [
      { ref: 'p1', role: 'Buyer', name: 'Jamie Agent' }, { ref: 'p2', role: 'Seller', name: null },
    ] }) }));
    return normal(url, options);
  });
  mount(); await screen.findByText('Missing: Contract');
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Who is cited?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit question' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Open source Upload policy' }));
  expect(await screen.findByText('Full transaction source body')).toBeVisible();
  const askUrl = network.mock.calls.find(([url]) => url.endsWith('/tc/transactions/t1/ask'))[0];
  expect(network).toHaveBeenCalledWith(askUrl.replace('/tc/transactions/t1/ask', '/kb/source?section_key=policy%20%26%20upload'), expect.objectContaining({ method: 'GET' }));
  expect(screen.getByText('Buyer record · v1 · Vault record')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Open source Buyer record' })).toBeNull();
  if (state === 'present') {
    expect(screen.getByRole('region', { name: 'Parties cited' })).toBeVisible();
    expect(screen.getByText('Buyer: Jamie Agent')).toBeVisible();
    expect(screen.getByText('Seller: name not on file')).toBeVisible();
  } else expect(screen.queryByText('Parties cited')).toBeNull();
});
