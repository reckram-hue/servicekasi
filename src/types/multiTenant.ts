import { SouthAfricanAddress, User, Job, Client, Invoice, Quote } from './index';

export type UserRole =
  | 'PLATFORM_SUPER_ADMIN'
  | 'BUSINESS_ADMIN'
  | 'DISPATCHER'
  | 'FIELD_TECHNICIAN';

export interface TenantBranding {
  logoUrl: string;
  primaryColor: string; // Hex e.g. '#f59e0b'
  accentColor: string;
  tagline: string;
  bannerUrl?: string;
}

export interface TenantBanking {
  bankName: string;
  accountNumber: string;
  branchCode: string;
  accountType: 'Cheque' | 'Current' | 'Savings' | 'Business';
  accountHolder: string;
}

export interface GoogleBusinessProfileConfig {
  placeId: string;
  businessName: string;
  googleRating: number;
  reviewCount: number;
  verifiedBadge: boolean;
  appointmentBookingUrl: string; // e.g. https://servicekasi.co.za/book/kasivolt-solar
  publicSlug: string; // e.g. 'kasivolt-solar'
  googleMapsCidUrl: string;
  isActive: boolean;
  autoAcknowledgeWhatsApp: boolean;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  provider: 'OZOW' | 'PAYFAST' | 'SNAPSCAN' | 'ZAPPER' | 'CAPITEC_PAY' | 'CUSTOM';
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt?: string;
  status: 'HEALTHY' | 'WARNING' | 'FAILED';
}

export interface WebhookEventLog {
  id: string;
  tenantId: string;
  event: 'payment.success' | 'payment.failed' | 'lead.created' | 'invoice.settled' | 'job.dispatched';
  provider: string;
  transactionReference: string;
  amountZAR: number;
  payload: Record<string, any>;
  receivedAt: string;
  status: 'PROCESSED' | 'FAILED' | 'PENDING';
  responseCode: number;
}

export interface LeadSubmission {
  id: string;
  tenantId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  serviceCategory: string;
  urgency: 'EMERGENCY' | 'WITHIN_24_HOURS' | 'FLEXIBLE_WEEK';
  address: SouthAfricanAddress;
  complexOrEstate?: string;
  gateCodeNotes?: string;
  preferredDate: string;
  preferredTimeSlot: 'MORNING' | 'AFTERNOON' | 'ANYTIME';
  issueDescription: string;
  photoUrls?: string[];
  submittedAt: string;
  source: 'GOOGLE_BUSINESS_PROFILE' | 'WEB_BOOKING_SLUG' | 'WHATSAPP_BOT';
  convertedJobId?: string;
  status: 'NEW' | 'CONVERTED' | 'DISMISSED';
}

export interface Tenant {
  id: string;
  slug: string; // URL identifier e.g. "kasivolt-solar"
  businessName: string;
  tradingName: string;
  companyRegistrationNumber: string; // CIPC format e.g. 2019/548291/07
  vatNumber: string; // SARS 10-digit VAT e.g. 4920281920
  currency: 'ZAR';
  currencySymbol: 'R';
  contact: {
    phone: string;
    email: string;
    whatsappNumber: string;
    supportEmail: string;
  };
  address: SouthAfricanAddress;
  branding: TenantBranding;
  banking: TenantBanking;
  googleBusinessProfile: GoogleBusinessProfileConfig;
  webhooks: WebhookEndpoint[];
  staffUserIds: string[]; // IDs of Users assigned to this tenant
  serviceCategories: string[];
  subscriptionPlan: 'PRO_ENTERPRISE' | 'GROWTH_MULTI_VAN' | 'SOLO_TRADESMAN';
  monthlySubscriptionZAR: number;
  createdAt: string;
}
