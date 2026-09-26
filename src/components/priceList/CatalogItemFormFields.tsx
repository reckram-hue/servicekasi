import { Checkbox, Field, Select, TextArea } from '@/components/auth/ui';
import { CATALOG_ITEM_TYPE_LABELS } from '@/lib/catalogItemTypes';

export type CatalogItemDefaults = {
  type?: string;
  name?: string;
  description?: string;
  unitCostRands?: string;
  unitPriceRands?: string;
  taxable?: boolean;
};

export function CatalogItemFormFields({
  errors,
  defaults,
}: {
  errors?: Record<string, string[] | undefined>;
  defaults?: CatalogItemDefaults;
}) {
  return (
    <>
      <Select label="Type" name="type" defaultValue={defaults?.type ?? 'SERVICE'} errors={errors?.type}>
        {Object.entries(CATALOG_ITEM_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Field label="Name" name="name" required defaultValue={defaults?.name ?? ''} errors={errors?.name} />
      <TextArea
        label="Description (optional)"
        name="description"
        defaultValue={defaults?.description ?? ''}
        errors={errors?.description}
      />
      <div className="grid grid-cols-2 gap-x-3">
        <Field
          label="Cost price (excl. VAT)"
          name="unitCostCents"
          placeholder="0"
          defaultValue={defaults?.unitCostRands ?? ''}
          errors={errors?.unitCostCents}
          hint="What it costs you. Never shown to the client."
        />
        <Field
          label="Selling price (excl. VAT)"
          name="unitPriceCents"
          placeholder="450"
          defaultValue={defaults?.unitPriceRands ?? ''}
          errors={errors?.unitPriceCents}
        />
      </div>
      <Checkbox label="VAT applies to this item" name="taxable" defaultChecked={defaults?.taxable ?? true} />
    </>
  );
}
