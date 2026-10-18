'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createJobAction, type FormState } from '@/lib/jobs/actions';
import { Field, FormMessage, Select, SubmitButton, TextArea } from '@/components/auth/ui';

const PRIORITY_LABELS: Record<string, string> = { LOW: 'Low', NORMAL: 'Normal', HIGH: 'High', EMERGENCY: 'Emergency' };

export function JobForm({ client, mobileCarWash = false }: { client: { id: string; name: string; properties: { id: string; label: string }[] }; mobileCarWash?: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(createJobAction, undefined);
  const e = state?.fieldErrors;

  return (
    <form action={action}>
      <input type="hidden" name="clientId" value={client.id} />
      <FormMessage error={state?.error} />

      <div className="mb-6 rounded-xl border border-slate-800 p-4">
        <div className="mb-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Client</div>
          <div className="font-medium text-slate-100">{client.name}</div>
        </div>

        <Field label={mobileCarWash ? 'Wash / vehicle' : 'Title'} name="title" required errors={e?.title} placeholder={mobileCarWash ? 'e.g. Full wash — Toyota Corolla, CA 123 456' : 'e.g. Burst geyser'} />

        {client.properties.length > 0 && (
          <Select label="Property (optional)" name="propertyId" defaultValue={client.properties[0]?.id ?? ''}>
            <option value="">No specific property</option>
            {client.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        )}

        <div className="grid grid-cols-2 gap-x-3">
          <Select label="Priority" name="priority" defaultValue="NORMAL">
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Field label="Category (optional)" name="category" placeholder={mobileCarWash ? 'e.g. Full wash, detailing or fleet' : 'e.g. Plumbing'} />
        </div>
      </div>

      <TextArea label={mobileCarWash ? 'Wash location, vehicles and instructions (optional)' : 'Description / instructions (optional)'} name="description" errors={e?.description} placeholder={mobileCarWash ? 'Customer address, vehicle details, parking/access instructions and water or power availability.' : undefined} />

      <div className="flex gap-3">
        <SubmitButton pending={pending}>{mobileCarWash ? 'Create wash' : 'Create job'}</SubmitButton>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
