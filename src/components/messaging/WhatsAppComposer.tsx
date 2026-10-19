'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { renderTemplate, unresolvedTokens, whatsAppMessageUrl, type WhatsAppTemplate } from '@/lib/messaging/templates';
import { DateInput, TimeInput } from '@/components/ui/DateTimeInputs';
import { formatDateStr } from '@/lib/dates';

export function WhatsAppComposer({ templates, customer, business, reviewLink, phone, canEditTemplates }: {
  templates: WhatsAppTemplate[]; customer: string; business: string; reviewLink: string | null;
  phone: string | null; canEditTemplates: boolean;
}) {
  const [selected, setSelected] = useState(templates[0].id);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [copyStatus, setCopyStatus] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const template = templates.find((item) => item.id === selected)!;
  const rawMessage = drafts[selected] ?? renderTemplate(template.body, { customer, business, reviewLink });
  const message = rawMessage.replace(/\[date\]/g, appointmentDate ? formatDateStr(appointmentDate, { day: 'numeric', month: 'long', year: 'numeric' }) : '[date]').replace(/\[time\]/g, appointmentTime || '[time]');
  const missing = unresolvedTokens(message);
  const ready = !!message.trim() && missing.length === 0;
  const href = whatsAppMessageUrl(phone, message);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyStatus('Message copied. Paste it into WhatsApp and send when you’re ready.');
    } catch {
      messageRef.current?.focus();
      messageRef.current?.select();
      setCopyStatus('Copying was blocked by your browser. The message is selected—use Copy on your phone or keyboard.');
    }
  }

  return <section id="whatsapp-message" aria-labelledby="whatsapp-heading" className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 id="whatsapp-heading" className="font-semibold text-slate-100">WhatsApp message</h2>
      {canEditTemplates && <Link href="/messages/templates" className="text-sm text-amber-400 underline">Edit shared templates</Link>}
    </div>
    <label className="mb-3 block text-sm text-slate-300">Choose a template
      <select value={selected} onChange={(event) => { setSelected(event.target.value as WhatsAppTemplate['id']); setCopyStatus(''); }} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5">
        {templates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
    </label>
    {(rawMessage.includes('[date]') || rawMessage.includes('[time]')) && <div className="mb-3 grid gap-3 sm:grid-cols-2">
      {rawMessage.includes('[date]') && <label className="text-sm text-slate-300">Appointment date
        <DateInput value={appointmentDate} onChange={(event) => { setAppointmentDate(event.target.value); setCopyStatus(''); }} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5" />
      </label>}
      {rawMessage.includes('[time]') && <TimeInput label="Appointment time" name="messageTime" value={appointmentTime} onChange={(time) => { setAppointmentTime(time); setCopyStatus(''); }} />}
    </div>}
    <label className="block text-sm text-slate-300">Message to {customer.trim() || 'customer'}
      <textarea ref={messageRef} value={message} onChange={(event) => { setDrafts({ ...drafts, [selected]: event.target.value }); setCopyStatus(''); }} rows={7} maxLength={4000} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-3" />
    </label>
    <p className="mt-2 text-xs text-slate-400">Your customer’s name is filled in. Changes here apply only to this message. Review the wording, then press Send in WhatsApp.</p>
    {missing.length > 0 && <p className="mt-2 text-sm text-amber-300">Replace {missing.join(', ')} in the message before copying or opening WhatsApp.</p>}
    {!phone && <p className="mt-2 text-sm text-slate-400">Add a customer phone number to open their chat. You can still copy a completed message.</p>}
    {phone && ready && !href && <p className="mt-2 text-sm text-amber-300">Check the customer’s phone number, including its country code.</p>}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" disabled={!ready} onClick={copyMessage} className="rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Copy message</button>
      {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">Open WhatsApp</a>
        : <button type="button" disabled className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white opacity-50">Open WhatsApp</button>}
    </div>
    <p role="status" className="mt-2 text-sm text-slate-300">{copyStatus}</p>
  </section>;
}
