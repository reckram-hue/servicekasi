/**
 * Seller and buyer details frozen onto an invoice when it is issued, so a
 * business changing its address (or a client changing name) never alters an
 * invoice that has already gone out. Stored in Invoice.sellerSnapshot /
 * Invoice.buyerSnapshot (JSON).
 *
 * Bank details are deliberately NOT frozen: they are payment instructions,
 * not part of the tax document, and an old unpaid invoice should point the
 * client at the account the business uses today.
 */

export type SellerSnapshot = {
  name: string;
  tradingName: string | null;
  vatNumber: string | null;
  companyRegNumber: string | null;
  addressLines: string[];
  phone: string | null;
  email: string | null;
};

export type BuyerSnapshot = {
  name: string;
  companyName: string | null;
  vatNumber: string | null;
  addressLines: string[];
  phone: string | null;
  email: string | null;
};

type TenantForSnapshot = {
  businessName: string;
  tradingName: string | null;
  vatRegistered: boolean;
  vatNumber: string | null;
  companyRegNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
};

type ClientForSnapshot = {
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  vatNumber: string | null;
  phone: string | null;
  email: string | null;
};

type PropertyForSnapshot = {
  unitOrComplex: string | null;
  street: string;
  suburb: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
};

const present = (parts: (string | null | undefined)[]) => parts.map((p) => p?.trim()).filter((p): p is string => !!p);

export function tenantAddressLines(t: TenantForSnapshot): string[] {
  return present([t.addressLine1, t.addressLine2, present([t.city, t.postalCode]).join(' '), t.region]);
}

export function propertyAddressLines(p: PropertyForSnapshot): string[] {
  return present([p.unitOrComplex, p.street, p.suburb, present([p.city, p.postalCode]).join(' '), p.region]);
}

export function buildSellerSnapshot(t: TenantForSnapshot): SellerSnapshot {
  return {
    name: t.businessName,
    tradingName: t.tradingName,
    vatNumber: t.vatRegistered ? t.vatNumber : null,
    companyRegNumber: t.companyRegNumber,
    addressLines: tenantAddressLines(t),
    phone: t.phone,
    email: t.email,
  };
}

export function buildBuyerSnapshot(c: ClientForSnapshot, property: PropertyForSnapshot | null): BuyerSnapshot {
  return {
    name: present([c.firstName, c.lastName]).join(' '),
    companyName: c.companyName,
    vatNumber: c.vatNumber,
    addressLines: property ? propertyAddressLines(property) : [],
    phone: c.phone,
    email: c.email,
  };
}
