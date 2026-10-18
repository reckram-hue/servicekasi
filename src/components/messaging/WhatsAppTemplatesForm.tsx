'use client';

import { useActionState, useState } from 'react';
import { Field, TextArea, SubmitButton } from '@/components/auth/ui';
import { saveWhatsAppTemplatesAction } from '@/lib/messaging/templateActions';
import { type WhatsAppTemplate } from '@/lib/messaging/templates';
import { WhatsAppComposer } from './WhatsAppComposer';

export function WhatsAppTemplatesForm({ initialTemplates, initialReviewUrl, business, ecoDraft }: {
  initialTemplates: WhatsAppTemplate[]; initialReviewUrl: string; business: string; ecoDraft: boolean;
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [reviewUrl, setReviewUrl] = useState(initialReviewUrl);
  const [state, action, pending] = useActionState(saveWhatsAppTemplatesAction, undefined);
  function edit(index: number, field: 'title' | 'body', value: string) {
    setTemplates((items) => items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }
  return <>
    {ecoDraft && <p className="mb-4 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">Eco4 Wash starter draft: Jeremy’s Google review link is included below. Save only while signed in to Eco4 Wash.</p>}
    <form action={action} className="space-y-5">
      <Field label="Google review link" name="reviewUrl" type="url" value={reviewUrl} onChange={(event) => setReviewUrl(event.target.value)} maxLength={1000} hint="Used wherever [review_link] appears. This also updates the Google review link in Business settings." />
      <p className="text-sm text-slate-400">Use [customer] for the customer’s first name, [business] for your business name and [review_link] for the link above. Leave [date] and [time] where staff should enter appointment details before sending.</p>
      {templates.map((item, index) => <fieldset key={item.id} className="rounded-xl border border-slate-800 p-4">
        <legend className="px-2 text-sm font-semibold text-slate-300">Template {index + 1}</legend>
        <Field label={`Template ${index + 1} name`} name={`${item.id}_title`} value={item.title} onChange={(event) => edit(index, 'title', event.target.value)} required maxLength={60} />
        <TextArea label={`Template ${index + 1} message`} name={`${item.id}_body`} value={item.body} onChange={(event) => edit(index, 'body', event.target.value)} required maxLength={2000} rows={5} />
      </fieldset>)}
      <div aria-live="polite">
        {state?.error && <p role="alert" className="mb-3 text-sm text-red-300">{state.error}</p>}
        {state?.ok && <p className="mb-3 text-sm text-emerald-300">{state.ok}</p>}
      </div>
      <SubmitButton pending={pending}>Save four templates</SubmitButton>
    </form>
    <h2 className="mt-8 mb-2 text-lg font-semibold">Try your wording</h2>
    <p className="mb-3 text-sm text-slate-400">Preview using the example customer Sarah. Open a real customer’s profile to message them.</p>
    <WhatsAppComposer templates={templates} customer="Sarah" business={business} reviewLink={reviewUrl} phone={null} canEditTemplates={false} />
  </>;
}
