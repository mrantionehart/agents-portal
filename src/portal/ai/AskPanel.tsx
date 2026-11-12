'use client';

import { useState } from 'react';
import { transactionAsk } from './agent-api';
import { askQuestion, escalateQuestion, type AskResponse } from './ask-api';

export default function AskPanel({ transactionId }: { transactionId?: string }) {
  const [question, setQuestion] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const [conversationId, setConversationId] = useState<string>();
  const [result, setResult] = useState<AskResponse>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !question.trim()) return;
    setBusy(true);
    setError('');
    setSent(false);
    setResult(undefined);
    const text = question.trim();
    setLastQuestion(text);
    try {
      const response = await (transactionId ? transactionAsk(transactionId, text, conversationId) : askQuestion(text, conversationId));
      setResult(response);
      if (response.conversation_id) setConversationId(response.conversation_id);
      setQuestion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ask HartFelt AI is unavailable.');
    } finally { setBusy(false); }
  }

  async function escalate() {
    if (busy || sent) return;
    setBusy(true);
    setError('');
    try {
      const response = await escalateQuestion(lastQuestion, conversationId);
      setSent(true);
      setResult(previous => previous ? { ...previous, disclaimer: response.disclaimer } : previous);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send to the Broker of Record.');
    } finally { setBusy(false); }
  }

  return <section aria-label="Ask HartFelt AI" className="flex flex-col gap-4 p-4 text-sm text-[#F1F1F3] overflow-y-auto">
    <h2 className="font-medium">Ask HartFelt AI</h2>
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
      <label className="flex-1">Your question
        <textarea maxLength={2000} value={question} onChange={event => setQuestion(event.target.value)} disabled={busy}
          className="block w-full rounded border border-[#252538] bg-[#0b0b10] p-2" />
      </label>
      <button type="submit" disabled={busy || !question.trim()} className="rounded bg-[#C9A84C] px-3 py-2 text-black disabled:opacity-50">{busy ? 'Working…' : 'Submit question'}</button>
    </form>
    <div aria-live="polite" className="space-y-3">
      {error && <p role="alert">{error}</p>}
      {result?.unavailable && <p>Ask HartFelt AI is unavailable. Please try again or contact the Broker of Record.</p>}
      {result?.answer && <p className="whitespace-pre-wrap">{result.answer}</p>}
      {result?.citations.map(source => <span key={`${source.section_key}:${source.version}`} className="inline-block mr-2 rounded-full border border-[#C9A84C] px-3 py-1">{source.title} · v{source.version}</span>)}
      {result?.disclaimer && <p className="text-xs text-[#A1A1AA]">{result.disclaimer}</p>}
      {result?.escalation_id && <p>This question has been escalated to the Broker of Record.</p>}
      {result && !result.unavailable && <button type="button" onClick={escalate} disabled={busy || sent} className="rounded border border-[#C9A84C] px-3 py-2 disabled:opacity-50">Ask the Broker</button>}
      {sent && <p>Sent to the Broker of Record</p>}
    </div>
  </section>;
}
