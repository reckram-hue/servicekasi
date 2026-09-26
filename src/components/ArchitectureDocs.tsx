import React, { useState } from 'react';
import { Copy, Check, Terminal, Database, Code2, ShieldCheck, ArrowRight } from 'lucide-react';

const PRISMA_SCHEMA_STRING = `// ServiceKasi - Field Service Management (South Africa)
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  PLATFORM_SUPER_ADMIN
  BUSINESS_ADMIN
  DISPATCHER
  FIELD_TECHNICIAN
}

model Tenant {
  id                        String            @id @default(uuid())
  slug                      String            @unique // e.g. "kasivolt-solar"
  businessName              String
  tradingName               String
  companyRegistrationNumber String            // CIPC 2020/192841/07
  vatNumber                 String            // SARS 4920281920
  currency                  String            @default("ZAR")
  primaryColor              String            @default("#f59e0b")
  googlePlaceId             String?
  appointmentBookingUrl     String            // https://servicekasi.co.za/book/[slug]
  monthlySubscriptionZAR    Decimal           @db.Decimal(10, 2)
  createdAt                 DateTime          @default(now())

  users                     User[]
  clients                   Client[]
  jobs                      Job[]
  invoices                  Invoice[]
  leads                     LeadSubmission[]
  webhooks                  WebhookEndpoint[]
  webhookLogs               WebhookEventLog[]
  @@map("tenants")
}

model LeadSubmission {
  id                String         @id @default(uuid())
  tenantId          String
  tenant            Tenant         @relation(fields: [tenantId], references: [id])
  clientName        String
  clientPhone       String         // SA validated +27
  clientEmail       String
  serviceCategory   String
  urgency           String         // EMERGENCY, WITHIN_24_HOURS, FLEXIBLE
  streetAddress     String
  suburb            String
  complexOrEstate   String?
  gateCodeNotes     String?        // Boom gate / intercom codes
  preferredDate     DateTime
  preferredTimeSlot String
  issueDescription  String
  source            String         @default("GOOGLE_BUSINESS_PROFILE")
  convertedJobId    String?
  createdAt         DateTime       @default(now())
  @@map("lead_submissions")
}

model WebhookEventLog {
  id                   String      @id @default(uuid())
  tenantId             String
  tenant               Tenant      @relation(fields: [tenantId], references: [id])
  provider             String      // OZOW, PAYFAST, SNAPSCAN, CAPITEC_PAY
  event                String      // payment.success, invoice.settled
  transactionReference String
  amountZAR            Decimal     @db.Decimal(10, 2)
  payloadJson          Json
  responseCode         Int         @default(200)
  createdAt            DateTime    @default(now())
  @@map("webhook_event_logs")
}

enum JobStatus {
  PENDING
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  INVOICED
  CANCELLED
}

enum JobPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
  CANCELLED
}

enum PaymentMethod {
  PAYFAST
  YOCO
  EFT
  CASH
}

model User {
  id              String         @id @default(uuid())
  name            String
  email           String         @unique
  phone           String         // e.g. +27821234567
  role            UserRole       @default(TECHNICIAN)
  specialties     String[]
  isAvailable     Boolean        @default(true)
  createdAt       DateTime       @default(now())

  assignedJobs    Job[]          @relation("TechnicianJobs")
  createdJobs     Job[]          @relation("DispatcherJobs")
  @@map("users")
}

model Client {
  id              String         @id @default(uuid())
  name            String
  companyName     String?
  phone           String         // South African phone e.g. +2782...
  email           String
  
  // South African Address Hierarchy
  unitOrComplex   String?        // Complex / Unit
  streetAddress   String         // Street name and number
  suburb          String         // e.g. Sandton / Soweto / Fourways
  city            String         // e.g. Johannesburg
  postalCode      String         // e.g. 2196
  province        String         // Gauteng, Western Cape, KwaZulu-Natal, etc.
  accessNotes     String?        // Complex security gate code, intercom number
  latitude        Float?
  longitude       Float?

  vatNumber       String?        // SARS 10-digit VAT registration number
  jobs            Job[]
  invoices        Invoice[]
  @@map("clients")
}

model Job {
  id                     String         @id @default(uuid())
  jobNumber              String         @unique // e.g. SK-2026-0041
  title                  String
  description            String
  category               String
  status                 JobStatus      @default(PENDING)
  priority               JobPriority    @default(MEDIUM)

  scheduledDate          DateTime
  scheduledTimeSlot      String         // e.g. "09:00 - 11:30"
  estimatedDurationHours Decimal        @db.Decimal(4, 2)

  technicianId           String?
  technician             User?          @relation("TechnicianJobs", fields: [technicianId], references: [id])
  clientId               String
  client                 Client         @relation(fields: [clientId], references: [id])
  
  technicianNotes        String?
  clientSignatureUrl     String?        // Digital sign-off base64 / S3 URL
  signedByName           String?
  signedAt               DateTime?

  createdAt              DateTime       @default(now())
  invoice                Invoice?
  @@map("jobs")
}

model Invoice {
  id                         String         @id @default(uuid())
  invoiceNumber              String         @unique // e.g. INV-2026-104
  jobId                      String?        @unique
  job                        Job?           @relation(fields: [jobId], references: [id])
  clientId                   String
  client                     Client         @relation(fields: [clientId], references: [id])

  issueDate                  DateTime       @default(now())
  dueDate                    DateTime
  status                     InvoiceStatus  @default(DRAFT)

  // ZAR Amounts and 15% South African VAT
  subtotalExclVat            Decimal        @db.Decimal(12, 2)
  vatRate                    Decimal        @default(0.15) @db.Decimal(4, 2)
  vatTotal                   Decimal        @db.Decimal(12, 2)
  totalInclVat               Decimal        @db.Decimal(12, 2)

  // Statutory South African Company details
  statutoryCompanyName       String
  statutoryCompanyRegNumber  String         // CIPC e.g. 2023/182930/07
  statutoryVatNumber         String         // SARS e.g. 4920184721

  paymentMethod              PaymentMethod?
  paymentReference           String?        // PayFast or Yoco reference
  paidAt                     DateTime?

  items                      InvoiceLineItem[]
  @@map("invoices")
}

model InvoiceLineItem {
  id               String      @id @default(uuid())
  invoiceId        String
  invoice          Invoice     @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  description      String
  quantity         Decimal     @db.Decimal(8, 2)
  unitPriceExclVat Decimal     @db.Decimal(12, 2)
  vatRate          Decimal     @default(0.15) @db.Decimal(4, 2)
  vatAmount        Decimal     @db.Decimal(12, 2)
  totalInclVat     Decimal     @db.Decimal(12, 2)
  @@map("invoice_line_items")
}`;

const PAYFAST_WEBHOOK_CODE = `// app/api/webhooks/payfast/route.ts (Next.js App Router)
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const data: Record<string, string> = {};
  formData.forEach((val, key) => {
    data[key] = String(val);
  });

  // Verify PayFast Signature (MD5 hash of sorted payload)
  const pfParamString = Object.keys(data)
    .filter((k) => k !== 'signature')
    .sort()
    .map((k) => \`\${k}=\${encodeURIComponent(data[k].trim())}\`)
    .join('&');

  const calculatedSignature = crypto
    .createHash('md5')
    .update(pfParamString + (process.env.PAYFAST_PASSPHRASE ? \`&passphrase=\${process.env.PAYFAST_PASSPHRASE}\` : ''))
    .digest('hex');

  if (calculatedSignature !== data['signature']) {
    return NextResponse.json({ error: 'Invalid PayFast signature' }, { status: 400 });
  }

  // Update invoice status if payment status is COMPLETE
  if (data['payment_status'] === 'COMPLETE') {
    const invoiceNumber = data['m_payment_id'];
    await prisma.invoice.update({
      where: { invoiceNumber },
      data: {
        status: 'PAID',
        paymentMethod: 'PAYFAST',
        paymentReference: data['pf_payment_id'],
        paidAt: new Date(),
      },
    });
  }

  return NextResponse.json({ status: 'success' });
}`;

export const ArchitectureDocs: React.FC = () => {
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'PRISMA' | 'WEBHOOK' | 'NEXTJS'>('PRISMA');

  const handleCopySchema = () => {
    navigator.clipboard.writeText(PRISMA_SCHEMA_STRING);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(PAYFAST_WEBHOOK_CODE);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Architecture, Prisma Schema & Production Setup
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Full-stack blueprint for Next.js App Router, Prisma ORM, PostgreSQL/Supabase, and South African Payment Integrations
        </p>
      </div>

      {/* 3-Column Architecture Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Database className="w-4 h-4 text-blue-600" />
            <span>PostgreSQL & Prisma</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Strict relational schema optimized for South African complex access protocols, technician dispatch, itemized line billing, and digital signatures.
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>SARS 15% VAT Statutory Engine</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Meets Section 20(4) of the South African Value-Added Tax Act with CIPC registration, 10-digit VAT formatting, and Sage/Xero SA export mapping.
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Terminal className="w-4 h-4 text-amber-600" />
            <span>Local Payment Gateways</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            PayFast Instant EFT (Capitec, FNB, Standard Bank, Absa, Nedbank) and Yoco card payment link automation with instant webhook settlement.
          </p>
        </div>
      </div>

      {/* Terminal Setup Instructions */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-6 space-y-4 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-sm text-white">Project Quickstart Terminal Steps</span>
          </div>
          <span className="text-slate-400 text-[11px]">Node.js 18+ · PostgreSQL</span>
        </div>

        <div className="space-y-3 leading-relaxed">
          <div>
            <span className="text-slate-500"># 1. Clone repository & install dependencies</span>
            <div className="text-emerald-400 pt-0.5">
              git clone https://github.com/your-org/servicekasi.git && cd servicekasi<br />
              npm install @prisma/client prisma lucide-react
            </div>
          </div>

          <div>
            <span className="text-slate-500"># 2. Configure .env with South African credentials</span>
            <div className="text-amber-300 pt-0.5">
              DATABASE_URL="postgresql://postgres:password@localhost:5432/servicekasi?schema=public"<br />
              PAYFAST_MERCHANT_ID="10000100"<br />
              PAYFAST_MERCHANT_KEY="46f0cd694581a"<br />
              PAYFAST_PASSPHRASE="your_secret_passphrase"<br />
              NEXT_PUBLIC_YOCO_KEY="pk_test_ed3c54a6g829140f8a92"
            </div>
          </div>

          <div>
            <span className="text-slate-500"># 3. Push schema to database & generate Prisma client</span>
            <div className="text-emerald-400 pt-0.5">
              npx prisma db push<br />
              npx prisma db seed<br />
              npm run dev
            </div>
          </div>
        </div>
      </div>

      {/* Code Viewer Container */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveCodeTab('PRISMA')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeCodeTab === 'PRISMA'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              prisma/schema.prisma
            </button>
            <button
              onClick={() => setActiveCodeTab('WEBHOOK')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeCodeTab === 'WEBHOOK'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              app/api/webhooks/payfast/route.ts
            </button>
          </div>

          <button
            onClick={activeCodeTab === 'PRISMA' ? handleCopySchema : handleCopyWebhook}
            className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
          >
            {(activeCodeTab === 'PRISMA' ? copiedSchema : copiedWebhook) ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        <div className="p-4 bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-[600px] leading-relaxed">
          <pre>
            {activeCodeTab === 'PRISMA' ? PRISMA_SCHEMA_STRING : PAYFAST_WEBHOOK_CODE}
          </pre>
        </div>
      </div>
    </div>
  );
};
