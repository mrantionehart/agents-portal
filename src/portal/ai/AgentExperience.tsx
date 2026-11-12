'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/providers';
import { useAskEnabled } from './use-ask-enabled';
import AskPanel from './AskPanel';
import * as api from './agent-api';

export default function AgentExperience({ transactionId }: { transactionId?: string }) {
  const enabled = useAskEnabled();
  const { user } = useAuth();
  return enabled ? <Experience key={`${user?.id}:${transactionId}`} transactionId={transactionId} /> : null;
}
function Experience({ transactionId }: { transactionId?: string }) {
  return <div className="space-y-6 p-4 text-sm text-[#F1F1F3] [&_section]:space-y-3 [&_h2]:font-semibold [&_h3]:font-medium [&_input:not([type=checkbox])]:block [&_input]:rounded [&_input]:border [&_input]:border-[#252538] [&_input]:bg-[#0b0b10] [&_input]:p-2 [&_textarea]:block [&_textarea]:w-full [&_textarea]:rounded [&_textarea]:border [&_textarea]:border-[#252538] [&_textarea]:bg-[#0b0b10] [&_textarea]:p-2 [&_button]:rounded [&_button]:border [&_button]:border-[#C9A84C] [&_button]:px-3 [&_button]:py-2 [&_button:disabled]:opacity-50 [&_a]:text-[#C9A84C] [&_summary]:cursor-pointer [&_li]:my-2">
    <Procedures />
    {transactionId && <TransactionAssistance transactionId={transactionId} />}
    <Support transactionId={transactionId} />
    <nav aria-label="Relevant training" className="flex flex-wrap gap-4">
      <Link href="/training">Training library</Link>
      <Link href="/training/checklist">Training checklist</Link>
      <Link href="/training/wizard">Training wizard</Link>
    </nav>
  </div>;
}
function Procedures() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<api.Procedure[]>();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  return <section aria-label="Search procedures"><h2>Search procedures</h2>
    <form onSubmit={async event => {
      event.preventDefault(); if (busy || !query.trim()) return;
      setBusy(true); setError(false); setResults(undefined);
      try { setResults((await api.searchProcedures(query.trim())).results ?? []); } catch { setError(true); } finally { setBusy(false); }
    }}><label>Procedure query<input maxLength={500} value={query} onChange={e => setQuery(e.target.value)} /></label>
      <button disabled={busy || !query.trim()}>Search procedures</button></form>
    <div aria-live="polite">{error && <p>Procedures not available.</p>}
      {results?.length === 0 && <p>No procedures found.</p>}
      <ul>{results?.map(row => <li key={row.id ?? row.section_key}><p>{row.heading} · v{row.version}</p>
        <p>{row.body.slice(0, 180)}</p><details><summary>Open full text: {row.heading}</summary><p className="whitespace-pre-wrap">{row.body}</p></details>
      </li>)}</ul></div>
  </section>;
}
function TransactionAssistance({ transactionId }: { transactionId: string }) {
  const [report, setReport] = useState<api.TransactionReport>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    api.transactionReport(transactionId).then(value => { if (active) setReport(value); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [transactionId]);
  return <section aria-label="Transaction assistance"><h2>Transaction assistance</h2>
    {error && <p>Transaction assistance not available.</p>}
    {report && <><p>Report only — human review required.</p><p>{report.summary}</p>
      <h3>Requirements and attention items</h3><ul>{report.attention_items.filter(i => i.type !== 'missing_document').map((item, index) => <li key={index}>{item.type} · {item.severity}{item.due_at && ` · ${item.due_at}`}{item.evidence.map((e, n) => <p key={n}>{e.note}</p>)}</li>)}</ul>
      <h3>Missing documents</h3><ul>{report.attention_items.filter(i => i.type === 'missing_document').map((item, index) => <li key={index}>{item.evidence.map((e, n) => <p key={n}>{e.note}</p>)}</li>)}</ul>
      <h3>Closing readiness</h3><ul>{report.readiness.map(item => <li key={item.key}>{item.label}: {item.status}{item.evidence.map((e, n) => <p key={n}>{e.note}</p>)}</li>)}</ul>
      <AskPanel transactionId={transactionId} />
    </>}
  </section>;
}
function Support({ transactionId }: { transactionId?: string }) {
  const [items, setItems] = useState<api.SupportItem[]>();
  const [detail, setDetail] = useState<api.SupportDetail>();
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState('');
  const [linked, setLinked] = useState(!!transactionId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { let active = true; api.myRequests().then(data => { if (active) setItems(data.items); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, []);
  async function run(action: () => Promise<void>) {
    if (busy) return; setBusy(true); setError(false);
    try { await action(); } catch { setError(true); } finally { setBusy(false); }
  }
  return <section aria-label="Broker assistance"><h2>Request broker assistance</h2>
    <div aria-live="polite">{error && <p>Broker assistance not available.</p>}</div>
    {items && <><form onSubmit={e => { e.preventDefault(); if (!question.trim()) return; void run(async () => {
      const created = await api.createRequest(question.trim(), linked ? transactionId : undefined);
      setQuestion(''); setDetail(await api.requestDetail(created.id)); setItems((await api.myRequests()).items);
    }); }}><label>Assistance request<textarea maxLength={4000} value={question} onChange={e => setQuestion(e.target.value)} /></label>
      {transactionId && <label><input type="checkbox" checked={linked} onChange={e => setLinked(e.target.checked)} />Link to this transaction</label>}
      <button disabled={busy || !question.trim()}>Send request</button></form>
      <h3>My requests</h3><ul>{items.map(item => <li key={item.id}><button disabled={busy} onClick={() => { setDetail(undefined); setReply(''); void run(async () => setDetail(await api.requestDetail(item.id))); }}>{item.question} · {item.status}</button></li>)}</ul>
      {detail && <article aria-label="Request detail"><h3>{detail.item.question}</h3><p>Status: {detail.item.status}</p>{detail.item.resolution && <p>{detail.item.resolution}</p>}
        <ul>{detail.messages.map(message => <li key={message.id}><p className="whitespace-pre-wrap">{message.body}</p><time>{message.created_at}</time></li>)}</ul>
        <form onSubmit={e => { e.preventDefault(); if (!reply.trim()) return; void run(async () => {
          const result = await api.replyToRequest(detail.item.id, reply.trim());
          if (!result.saved) throw new Error('Not saved');
          setReply(''); setDetail(await api.requestDetail(detail.item.id));
        }); }}><label>Reply<textarea maxLength={4000} value={reply} onChange={e => setReply(e.target.value)} /></label><button disabled={busy || !reply.trim()}>Send reply</button></form>
      </article>}
    </>}
  </section>;
}
