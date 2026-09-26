import { Field } from '@/components/auth/ui';

const LANGUAGES: [string, string][] = [
  ['en', 'English'],
  ['af', 'Afrikaans'],
  ['zu', 'isiZulu'],
  ['xh', 'isiXhosa'],
  ['st', 'Sesotho'],
  ['tn', 'Setswana'],
  ['nso', 'Sepedi'],
  ['ts', 'Xitsonga'],
  ['ss', 'siSwati'],
  ['ve', 'Tshivenda'],
  ['nr', 'isiNdebele'],
  ['pt', 'Português'],
  ['sn', 'chiShona'],
  ['ny', 'chiChewa'],
  ['sw', 'Kiswahili'],
  ['fr', 'Français'],
];

/** The fields shared by the add-client and edit-client forms. */
export function ClientFormFields({
  errors,
  defaults,
}: {
  errors?: Record<string, string[] | undefined>;
  defaults?: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    phone?: string;
    email?: string;
    preferredLanguage?: string;
    notes?: string;
    whatsappOptIn?: boolean;
    street?: string;
    suburb?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    accessNotes?: string;
  };
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-x-3">
        <Field label="First name" name="firstName" required defaultValue={defaults?.firstName} errors={errors?.firstName} />
        <Field label="Last name" name="lastName" defaultValue={defaults?.lastName} errors={errors?.lastName} />
      </div>
      <Field label="Company (optional)" name="companyName" defaultValue={defaults?.companyName} errors={errors?.companyName} />
      <div className="grid grid-cols-2 gap-x-3">
        <Field
          label="Cellphone"
          name="phone"
          type="tel"
          placeholder="082 123 4567"
          defaultValue={defaults?.phone}
          errors={errors?.phone}
        />
        <Field label="Email" name="email" type="email" defaultValue={defaults?.email} errors={errors?.email} />
      </div>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Language they prefer</span>
        <select
          name="preferredLanguage"
          defaultValue={defaults?.preferredLanguage ?? 'en'}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100"
        >
          {LANGUAGES.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="mb-4 rounded-lg border border-slate-800 p-3">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">Address (optional)</legend>
        <Field label="Street" name="street" defaultValue={defaults?.street} errors={errors?.street} />
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Suburb" name="suburb" defaultValue={defaults?.suburb} errors={errors?.suburb} />
          <Field label="City" name="city" defaultValue={defaults?.city} errors={errors?.city} />
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Province/region" name="region" defaultValue={defaults?.region} errors={errors?.region} />
          <Field label="Postal code" name="postalCode" defaultValue={defaults?.postalCode} errors={errors?.postalCode} />
        </div>
        <Field
          label="Access notes"
          name="accessNotes"
          defaultValue={defaults?.accessNotes}
          errors={errors?.accessNotes}
          hint="Gate code, dogs, estate security — shown to technicians only."
        />
      </fieldset>

      <label className="mb-4 flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" name="whatsappOptIn" defaultChecked={defaults?.whatsappOptIn} className="h-4 w-4 rounded" />
        Client has agreed to receive WhatsApp messages
      </label>

      <Field
        label="Notes (optional)"
        name="notes"
        defaultValue={defaults?.notes}
        errors={errors?.notes}
      />
    </>
  );
}
