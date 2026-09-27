'use client';

import { useActionState, useState } from 'react';
import { addBillAction, uploadSlipPhotoAction, type FormState } from '@/lib/bookkeeping/actions';
import { Field, FormMessage, RadioGroup, Select, SubmitButton, TextArea } from '@/components/auth/ui';
import { resizeImageToJpeg } from '@/lib/imageResize';

type Option = { id: string; name: string };

export function AddBillForm({ today, categories }: { today: string; categories: Option[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addBillAction, undefined);
  const [slip, setSlip] = useState<{ url: string; mimeType: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [clientGeneratedId, setClientGeneratedId] = useState(() => crypto.randomUUID());

  const [formKey, setFormKey] = useState(0);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) {
      setFormKey((k) => k + 1);
      setSlip(null);
      setClientGeneratedId(crypto.randomUUID());
    }
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const blob = await resizeImageToJpeg(file);
      const fd = new FormData();
      fd.set('photo', blob, 'slip.jpg');
      const result = await uploadSlipPhotoAction(fd);
      if (result.error || !result.url || !result.mimeType) setUploadError(result.error || 'Could not upload that photo.');
      else setSlip({ url: result.url, mimeType: result.mimeType });
    } catch {
      setUploadError('Could not process that photo. Try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form key={formKey} action={action} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <FormMessage error={state?.error} ok={state?.ok} />
      <input type="hidden" name="clientGeneratedId" value={clientGeneratedId} readOnly />
      <input type="hidden" name="slipUrl" value={slip?.url ?? ''} readOnly />
      <input type="hidden" name="slipMimeType" value={slip?.mimeType ?? ''} readOnly />

      <div className="mb-4">
        <span className="mb-1 block text-sm font-medium text-slate-300">Bill photo</span>
        {slip ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slip.url} alt="Bill" className="h-16 w-16 rounded-lg object-cover" />
            <button type="button" onClick={() => setSlip(null)} className="text-xs text-slate-400 hover:text-slate-200">
              Remove
            </button>
          </div>
        ) : (
          <label className={`inline-block cursor-pointer rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 ${uploading ? 'opacity-60' : 'active:opacity-80'}`}>
            {uploading ? 'Uploading…' : '📷 Add photo'}
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} disabled={uploading} className="hidden" />
          </label>
        )}
        {uploadError && <p className="mt-1 text-xs text-red-400">{uploadError}</p>}
      </div>

      <Field label="Supplier" name="supplier" placeholder="e.g. Builders Warehouse" errors={state?.fieldErrors?.supplier} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Bill date" name="billDate" type="date" max={today} defaultValue={today} errors={state?.fieldErrors?.billDate} />
        <Field label="Due date" name="dueDate" type="date" defaultValue={today} errors={state?.fieldErrors?.dueDate} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" name="amount" inputMode="decimal" placeholder="0.00" errors={state?.fieldErrors?.amount} />
        <Select label="Category" name="categoryId" errors={state?.fieldErrors?.categoryId}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <RadioGroup
        label="VAT"
        name="vatStatus"
        defaultValue="NO_VAT"
        options={[
          { value: 'NO_VAT', label: 'No VAT' },
          { value: 'INCLUDES_VAT', label: 'Includes VAT' },
        ]}
        errors={state?.fieldErrors?.vatStatus}
      />

      <TextArea label="Note (optional)" name="note" errors={state?.fieldErrors?.note} />

      <SubmitButton pending={pending}>Save bill</SubmitButton>
    </form>
  );
}
