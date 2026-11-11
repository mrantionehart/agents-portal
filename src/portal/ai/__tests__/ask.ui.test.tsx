import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TopBar from '../../TopBar';
import AIChatPanel from '../AIChatPanel';

// Auth/session fixtures only; all Ask transport is exercised through real modules.
jest.mock('@/lib/auth-context', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ getAccessToken: jest.fn(), supabase: { auth: { getSession: jest.fn() } } }));
import { useAuth } from '@/lib/auth-context';
import { getAccessToken } from '@/lib/supabase';

const fetchMock = jest.fn();
const disclaimer = 'AI guidance, not legal, tax or investment advice. Your Broker of Record has final authority.';
const answer = { answer: 'Upload your contract promptly.', citations: [{ section_key: 'fl-ppm-11.7', title: 'Contract uploads', version: '2', status: 'published' }], disclaimer, conversation_id: 'conversation-1' };
function response(body: object, status = 200) { return { ok: status < 400, status, json: async () => body }; }
function mount() { return render(<><TopBar userName="Agent" userEmail="agent@test.com" role="agent" /><AIChatPanel transactionId={null} /></>); }
async function openAsk() {
  fireEvent.click(await screen.findByRole('button', { name: 'Ask' }));
  const dialog = screen.getByRole('dialog');
  await within(dialog).findByRole('textbox', { name: 'Your question' });
  return within(dialog);
}
async function submit(ui: ReturnType<typeof within>, text = 'When must I upload a contract?') {
  fireEvent.change(ui.getByRole('textbox', { name: 'Your question' }), { target: { value: text } });
  fireEvent.click(ui.getByRole('button', { name: 'Submit question' }));
}
beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'agent-1' }, role: 'agent', loading: false });
  (getAccessToken as jest.Mock).mockResolvedValue('user-token');
  global.fetch = fetchMock;
  // jsdom's AbortSignal does not implement timeout.
  if (!AbortSignal.timeout) AbortSignal.timeout = () => new AbortController().signal;
  fetchMock.mockImplementation(async (url: string) => url.endsWith('/status') ? response({ enabled: true }) : response(answer));
});

test.each(['false', 'error', 'loading'])('status %s hides both entry points and never asks', async state => {
  fetchMock.mockImplementation(() => state === 'error' ? Promise.reject(new Error('offline')) : state === 'loading' ? new Promise(() => {}) : Promise.resolve(response({ enabled: false })));
  mount();
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: 'Ask' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ask HartFelt AI' })).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.every(([url]) => url.endsWith('/status'))).toBe(true);
});

test.each([1280, 375])('agent journey renders answer, sources, disclaimer and retains follow-up conversation at width %i', async width => {
  window.innerWidth = width;
  mount();
  const ui = await openAsk();
  await submit(ui);
  expect(await ui.findByText(answer.answer)).toBeVisible();
  expect(ui.getByText('Contract uploads · v2')).toBeVisible();
  expect(ui.getByText(disclaimer)).toBeVisible();
  const askCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/ai/ask'));
  expect(askCall[1]).toEqual(expect.objectContaining({ credentials: 'omit', headers: expect.objectContaining({ Authorization: 'Bearer user-token' }) }));
  expect(JSON.parse(askCall[1].body)).toEqual({ question: 'When must I upload a contract?', surface: 'ap' });
  await submit(ui, 'What next?');
  await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/ai/ask'))).toHaveLength(2));
  expect(JSON.parse(fetchMock.mock.calls.filter(([url]) => url.endsWith('/ai/ask'))[1][1].body)).toEqual({ question: 'What next?', conversation_id: 'conversation-1', surface: 'ap' });
});

test('escalation notice and explicit Ask the Broker confirmation', async () => {
  fetchMock.mockImplementation(async (url: string) => url.endsWith('/status') ? response({ enabled: true }) : url.endsWith('/escalate') ? response({ escalation_id: 'e2', disclaimer }) : response({ ...answer, escalation_id: 'e1' }));
  mount();
  const ui = await openAsk();
  await submit(ui);
  expect(await ui.findByText('This question has been escalated to the Broker of Record.')).toBeVisible();
  fireEvent.click(ui.getByRole('button', { name: 'Ask the Broker' }));
  expect(await ui.findByText('Sent to the Broker of Record')).toBeVisible();
  const call = fetchMock.mock.calls.find(([url]) => url.endsWith('/escalate'));
  expect(JSON.parse(call[1].body)).toEqual({ conversation_id: 'conversation-1' });
  expect(call[1].headers.Authorization).toBe('Bearer user-token');
});

test('503 renders unavailable and response disclaimer without crashing', async () => {
  fetchMock.mockImplementation(async (url: string) => url.endsWith('/status') ? response({ enabled: true }) : response({ answer: null, citations: [], disclaimer, unavailable: true }, 503));
  mount();
  const ui = await openAsk();
  await submit(ui);
  expect(await ui.findByText(/Ask HartFelt AI is unavailable/)).toBeVisible();
  expect(ui.getByText(disclaimer)).toBeVisible();
});

test.each(['office_manager', 'admin', 'broker'])('%s sees no Ask even when status would be true', async role => {
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'staff' }, role, loading: false });
  mount();
  expect(screen.queryByRole('button', { name: 'Ask' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ask HartFelt AI' })).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('existing panel mode opens Ask and returns to existing Chat', async () => {
  render(<AIChatPanel transactionId={null} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Ask HartFelt AI' }));
  expect(screen.getByRole('textbox', { name: 'Your question' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
  expect(screen.getByRole('button', { name: 'Send' })).toBeVisible();
  expect(fetchMock.mock.calls.every(([url]) => url.endsWith('/status'))).toBe(true);
});

test('closing Ask restores focus to its entry point', async () => {
  mount();
  const ui = await openAsk();
  fireEvent.keyDown(ui.getByRole('textbox', { name: 'Your question' }), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ask' })).toHaveFocus();
});

test('switching to a denied identity immediately removes Ask', async () => {
  const view = mount();
  await openAsk();
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'staff' }, role: 'office_manager', loading: false });
  view.rerender(<><TopBar userName="Staff" userEmail="staff@test.com" role="office_manager" /><AIChatPanel transactionId={null} /></>);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ask HartFelt AI' })).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.every(([url]) => url.endsWith('/status'))).toBe(true);
});
