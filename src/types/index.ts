export type UserRole = 'ADMIN' | 'TECHNICIAN' | 'DISPATCHER';

export type JobStatus = 'PENDING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'INVOICED' | 'CANCELLED';

export type JobPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED';

export type PaymentMethod = 'PAYFAST' | 'YOCO' | 'EFT' | 'CASH';

export type CostItemType = 'MATERIAL' | 'LABOR' | 'CALLOUT' | 'TRAVEL';

export type SouthAfricanProvince =
  | 'Gauteng'
  | 'Western Cape'
  | 'KwaZulu-Natal'
  | 'Eastern Cape'
  | 'Free State'
  | 'Limpopo'
  | 'Mpumalanga'
  | 'North West'
  | 'Northern Cape';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  tenantId?: string;
  avatarUrl?: string;
  specialties: string[];
  activeJobsCount?: number;
  available: boolean;
  hourlyCostRateZAR: number; // Internal technician hourly wage burden (e.g. R220/hr)
  hourlyBillingRateZAR: number; // Client chargeout rate (e.g. R650/hr)
}

export interface SouthAfricanAddress {
  unitOrComplex?: string;
  streetAddress: string;
  suburb: string;
  city: string;
  postalCode: string;
  province: SouthAfricanProvince;
  accessNotes?: string;
  latitude?: number;
  longitude?: number;
}

export interface Client {
  id: string;
  tenantId?: string;
  name: string;
  companyName?: string;
  phone: string;
  email: string;
  address: SouthAfricanAddress;
  vatNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface WorkPhoto {
  id: string;
  url: string;
  caption: string;
  type: 'BEFORE' | 'AFTER' | 'PARTS' | 'SIGN_OFF';
  uploadedAt: string;
}

export interface DigitalSignature {
  signatureDataUrl: string;
  signedByName: string;
  signedAt: string;
  designation?: 'CLIENT' | 'TECHNICIAN';
}

export interface TimeEntry {
  id: string;
  jobId: string;
  technicianId: string;
  clockIn: string; // ISO String
  clockOut?: string; // ISO String, undefined if currently running
  durationMinutes: number;
  notes?: string;
}

export interface QuoteLineItem {
  id: string;
  type: CostItemType; // 'MATERIAL' | 'LABOR' | 'CALLOUT' | 'TRAVEL'
  description: string;
  quantity: number;
  unitCostZAR: number; // Internal supplier/labor cost excl VAT
  markupPercentage: number; // e.g. 35%
  unitPriceExclVat: number; // Client chargeout price excl VAT
  vatRate: number; // Standard 0.15
  vatAmount: number;
  lineTotalInclVat: number;
}

export interface Quote {
  id: string;
  tenantId?: string;
  quoteNumber: string; // e.g. "QT-2026-0892"
  clientId: string;
  jobTitle: string;
  category: string;
  status: QuoteStatus;
  issueDate: string;
  expiryDate: string;
  items: QuoteLineItem[];
  subtotalCostZAR: number; // Total internal cost to business
  subtotalExclVat: number; // Total billed to client excl VAT
  estimatedGrossProfitZAR: number;
  estimatedMarginPercent: number;
  vatTotal: number;
  totalInclVat: number;
  convertedToJobId?: string;
  notes?: string;
}

export interface JobCosting {
  // Estimated targets
  estimatedLaborHours: number;
  estimatedLaborCostZAR: number; // hours * tech cost rate
  estimatedMaterialCostZAR: number;
  estimatedCalloutZAR: number;
  estimatedTotalCostZAR: number;
  estimatedRevenueExclVat: number;
  estimatedProfitZAR: number;
  estimatedMarginPercent: number;

  // Actual tracked metrics
  actualLaborHours: number;
  actualLaborCostZAR: number; // actual hours * tech cost rate
  actualMaterialCostZAR: number; // supplier cost of parts actually used
  actualCalloutZAR: number;
  actualTotalCostZAR: number;
  actualRevenueExclVat: number;
  actualProfitZAR: number;
  actualMarginPercent: number;

  // Variance & Performance
  laborHoursVariance: number; // actual - estimated (positive means overtime)
  profitVarianceZAR: number; // actualProfit - estimatedProfit
  status: 'OPTIMAL' | 'ACCEPTABLE' | 'EROSION_WARNING' | 'LOSS_ALERT';
}

export interface DominoConflict {
  delayedJobId: string;
  technicianId: string;
  technicianName: string;
  overrunMinutes: number; // e.g. 180 (3 hours)
  affectedJobIds: string[];
  suggestedAction: 'AUTO_SHIFT' | 'REASSIGN' | 'RESCHEDULE';
}

export interface Job {
  id: string;
  tenantId?: string;
  jobNumber: string; // e.g. "SK-2026-084"
  quoteId?: string;
  leadId?: string;
  source?: 'MANUAL' | 'GOOGLE_BUSINESS_PROFILE' | 'WEB_BOOKING_SLUG' | 'WHATSAPP';
  urgency?: 'EMERGENCY' | 'WITHIN_24_HOURS' | 'FLEXIBLE_WEEK';
  title: string;
  description: string;
  category: 'Solar & Inverters' | 'Electrical' | 'Plumbing & Geysers' | 'HVAC & Refrigeration' | 'Security & Gate Automation';
  clientId: string;
  assignedTechId?: string;
  status: JobStatus;
  priority: JobPriority;
  scheduledDate: string; // YYYY-MM-DD
  scheduledStartTime: string; // "09:00"
  scheduledEndTime: string; // "12:00"
  scheduledTime: string; // "09:00 - 12:00"
  estimatedDurationHours: number;
  
  // Real-time On-site Clock tracking
  timeEntries: TimeEntry[];
  isClockedIn?: boolean;
  clockInTimestamp?: string; // ISO string when active timer running

  // South African Address & Site Notes
  address: SouthAfricanAddress;
  notes?: string;
  technicianNotes?: string;
  photos: WorkPhoto[];
  clientSignature?: DigitalSignature;
  customerRating?: number; // 1 to 5 stars
  ratingFeedback?: string;
  invoiceId?: string;

  // Costing & P&L Engine
  costing: JobCosting;

  // Scheduling Domino Tracker
  overrunMinutes?: number;
  hasDominoConflict?: boolean;
  dominoWarning?: string;

  createdAt: string;
  completedAt?: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceExclVat: number; // in South African Rand (ZAR)
  vatRate: number; // 0.15 for standard SA VAT
  vatAmount: number;
  totalInclVat: number;
}

export interface Invoice {
  id: string;
  tenantId?: string;
  invoiceNumber: string;
  quoteNumber?: string;
  jobId?: string;
  clientId: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  items: InvoiceLineItem[];
  subtotalExclVat: number;
  vatTotal: number;
  totalInclVat: number;
  statutoryInfo: {
    companyName: string;
    companyRegistrationNumber: string;
    vatRegistrationNumber: string;
    physicalAddress: string;
    bankName: string;
    accountNumber: string;
    branchCode: string;
    accountType: string;
  };
  paymentGateway?: {
    gateway: PaymentMethod;
    transactionReference?: string;
    paidAt?: string;
  };
  accountingSync?: {
    platform: 'SAGE_SA' | 'XERO_SA';
    syncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
    syncedAt?: string;
    externalId?: string;
  };
}
