import type { CatalogItemType, Industry } from '@prisma/client';

export const INDUSTRY_LABELS: Record<Industry, string> = {
  PLUMBING: 'Plumbing',
  ELECTRICAL: 'Electrical',
  LANDSCAPING: 'Landscaping & gardens',
  POOL: 'Pool maintenance & repairs',
  GENERAL_MAINTENANCE: 'General maintenance / handyman',
  OTHER: 'Other',
};

export const INDUSTRIES = Object.keys(INDUSTRY_LABELS) as Industry[];

export type StarterItem = { type: CatalogItemType; name: string; priceRands: number };

// Rough South African prices, excluding VAT. They're starting points only:
// every business edits them to its own rates on the price list.
export const STARTER_PRICE_LISTS: Record<Industry, StarterItem[]> = {
  PLUMBING: [
    { type: 'CALLOUT', name: 'Call-out fee', priceRands: 550 },
    { type: 'LABOUR', name: 'Labour (per hour)', priceRands: 550 },
    { type: 'SERVICE', name: 'Blocked drain unblock', priceRands: 950 },
    { type: 'SERVICE', name: 'Burst pipe repair', priceRands: 1200 },
    { type: 'SERVICE', name: 'Leaking tap repair', priceRands: 450 },
    { type: 'SERVICE', name: 'Toilet cistern repair', priceRands: 650 },
    { type: 'SERVICE', name: 'Geyser element replacement (labour)', priceRands: 850 },
    { type: 'MATERIAL', name: 'Geyser element 3 kW', priceRands: 450 },
    { type: 'MATERIAL', name: 'Geyser thermostat', priceRands: 380 },
    { type: 'SERVICE', name: 'Geyser replacement 150 L (labour)', priceRands: 3500 },
    { type: 'SERVICE', name: 'Plumbing certificate of compliance', priceRands: 1500 },
  ],
  ELECTRICAL: [
    { type: 'CALLOUT', name: 'Call-out fee', priceRands: 550 },
    { type: 'LABOUR', name: 'Labour (per hour)', priceRands: 550 },
    { type: 'SERVICE', name: 'Fault finding', priceRands: 850 },
    { type: 'SERVICE', name: 'Electrical certificate of compliance (CoC)', priceRands: 2500 },
    { type: 'SERVICE', name: 'Install plug point', priceRands: 650 },
    { type: 'SERVICE', name: 'Install light fitting', priceRands: 450 },
    { type: 'SERVICE', name: 'DB board replacement (labour)', priceRands: 3500 },
    { type: 'MATERIAL', name: 'Circuit breaker 20 A', priceRands: 180 },
    { type: 'MATERIAL', name: 'Earth leakage unit', priceRands: 850 },
  ],
  LANDSCAPING: [
    { type: 'TRAVEL', name: 'Travel', priceRands: 250 },
    { type: 'LABOUR', name: 'Garden labour (per hour)', priceRands: 250 },
    { type: 'SERVICE', name: 'Lawn mowing (standard garden)', priceRands: 450 },
    { type: 'SERVICE', name: 'Hedge trimming', priceRands: 650 },
    { type: 'SERVICE', name: 'Garden clean-up', priceRands: 900 },
    { type: 'SERVICE', name: 'Refuse removal (bakkie load)', priceRands: 650 },
    { type: 'SERVICE', name: 'Tree felling (small tree)', priceRands: 1800 },
    { type: 'SERVICE', name: 'Irrigation repair', priceRands: 650 },
    { type: 'MATERIAL', name: 'Compost (30 dm³ bag)', priceRands: 65 },
    { type: 'MATERIAL', name: 'Instant lawn (per m²)', priceRands: 55 },
  ],
  POOL: [
    { type: 'TRAVEL', name: 'Travel', priceRands: 250 },
    { type: 'SERVICE', name: 'Weekly pool service', priceRands: 450 },
    { type: 'SERVICE', name: 'Green pool clean-up', priceRands: 1500 },
    { type: 'SERVICE', name: 'Pump repair (labour)', priceRands: 750 },
    { type: 'SERVICE', name: 'Filter sand change (labour)', priceRands: 650 },
    { type: 'SERVICE', name: 'Leak detection', priceRands: 1200 },
    { type: 'MATERIAL', name: 'Pool chlorine (5 kg)', priceRands: 550 },
    { type: 'MATERIAL', name: 'Filter sand (40 kg)', priceRands: 280 },
  ],
  GENERAL_MAINTENANCE: [
    { type: 'CALLOUT', name: 'Call-out fee', priceRands: 450 },
    { type: 'LABOUR', name: 'Labour (per hour)', priceRands: 400 },
    { type: 'SERVICE', name: 'Painting (per m²)', priceRands: 85 },
    { type: 'SERVICE', name: 'Door hanging or repair', priceRands: 650 },
    { type: 'SERVICE', name: 'Tiling repair (per m²)', priceRands: 350 },
    { type: 'SERVICE', name: 'Gutter cleaning', priceRands: 750 },
    { type: 'SERVICE', name: 'Waterproofing (per m²)', priceRands: 180 },
    { type: 'SERVICE', name: 'Gate or burglar bar repair', priceRands: 650 },
  ],
  OTHER: [
    { type: 'CALLOUT', name: 'Call-out fee', priceRands: 450 },
    { type: 'LABOUR', name: 'Labour (per hour)', priceRands: 450 },
    { type: 'TRAVEL', name: 'Travel', priceRands: 250 },
  ],
};
