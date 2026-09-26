import { CatalogItemType } from '@prisma/client';

export const CATALOG_ITEM_TYPE_LABELS: Record<CatalogItemType, string> = {
  SERVICE: 'Service',
  MATERIAL: 'Material',
  CALLOUT: 'Call-out fee',
  TRAVEL: 'Travel',
  LABOUR: 'Labour',
};
