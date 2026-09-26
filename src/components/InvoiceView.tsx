import React, { useState } from 'react';
import {
  Printer,
  CreditCard,
  Building2,
  FileCheck,
  CheckCircle2,
  Plus,
  Trash2,
  Send,
  ExternalLink,
  ShieldCheck,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { Client, Invoice, InvoiceLineItem, InvoiceStatus } from '../types';
import {
  formatZAR,
  calculateVat,
  generatePayFastPayload,
  generateYocoPaymentLink,
  buildSageAccountingPayload,
  SA_VAT_RATE,
} from '../lib/southAfrica';

interface InvoiceViewProps {
  invoices: Invoice[];
  clients: Client[];
  selectedInvoiceId?: string;
  onSelectInvoice: (invoiceId: string) => void;
  onUpdateInvoiceStatus: (invoiceId: string, status: InvoiceStatus) => void;
  onUpdateInvoiceItems: (invoiceId: string, items: InvoiceLineItem[]) => void;
  onSimulatePayment: (invoiceId: string, gateway: 'PAYFAST' | 'YOCO' | 'EFT') => void;
  onSimulateAccountingSync: (invoiceId: string, platform: 'SAGE_SA' | 'XERO_SA') => void;
}

export const InvoiceView: React.FC<InvoiceViewProps> = ({
  invoices,
  clients,
  selectedInvoiceId,
  onSelectInvoice,
  onUpdateInvoiceStatus,
  onUpdateInvoiceItems,
  onSimulatePayment,
  onSimulateAccountingSync,
}) => {
  const activeInvoice =
    invoices.find((inv) => inv.id === selectedInvoiceId) || invoices[0];

  const client = activeInvoice
    ? clients.find((c) => c.id === activeInvoice.clientId)
    : undefined;

  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editedItems, setEditedItems] = useState<InvoiceLineItem[]>(
    activeInvoice ? activeInvoice.items : []
  );
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSageModal, setShowSageModal] = useState(false);

  // Sync editedItems if active invoice changes
  React.useEffect(() => {
    if (activeInvoice) {
      setEditedItems(activeInvoice.items);
      setIsEditingItems(false);
    }
  }, [activeInvoice?.id]);

  if (!activeInvoice || !client) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">
        No invoices available. Create an invoice from completed work orders.
      </div>
    );
  }

  // Handle adding line item
  const handleAddItem = () => {
    const defaultPrice = 1200;
    const { vatAmount, totalInclVat } = calculateVat(defaultPrice, SA_VAT_RATE);
    const newItem: InvoiceLineItem = {
      id: `item-${Date.now()}`,
      description: 'Field Service Labor / Materials (RSA)',
      quantity: 1,
      unitPriceExclVat: defaultPrice,
      vatRate: SA_VAT_RATE,
      vatAmount,
      totalInclVat,
    };
    setEditedItems([...editedItems, newItem]);
  };

  const handleUpdateItemField = (
    index: number,
    field: 'description' | 'quantity' | 'unitPriceExclVat',
    val: string | number
  ) => {
    const updated = [...editedItems];
    const item = { ...updated[index] };

    if (field === 'description') {
      item.description = String(val);
    } else if (field === 'quantity') {
      item.quantity = Math.max(0.1, Number(val) || 1);
    } else if (field === 'unitPriceExclVat') {
      item.unitPriceExclVat = Math.max(0, Number(val) || 0);
    }

    const subtotal = item.quantity * item.unitPriceExclVat;
    const { vatAmount, totalInclVat } = calculateVat(subtotal, SA_VAT_RATE);
    item.vatAmount = vatAmount;
    item.totalInclVat = totalInclVat;

    updated[index] = item;
    setEditedItems(updated);
  };

  const handleDeleteItem = (index: number) => {
    setEditedItems(editedItems.filter((_, i) => i !== index));
  };

  const handleSaveItems = () => {
    onUpdateInvoiceItems(activeInvoice.id, editedItems);
    setIsEditingItems(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const payFastPayload = generatePayFastPayload(
    activeInvoice.invoiceNumber,
    activeInvoice.totalInclVat,
    client.name,
    client.email,
    client.phone
  );

  const yocoLink = generateYocoPaymentLink(
    activeInvoice.invoiceNumber,
    activeInvoice.totalInclVat,
    client.email
  );

  const sagePayload = buildSageAccountingPayload({
    invoiceNumber: activeInvoice.invoiceNumber,
    issueDate: activeInvoice.issueDate,
    dueDate: activeInvoice.dueDate,
    clientName: client.name,
    clientVatNumber: client.vatNumber,
    subtotalExclVat: activeInvoice.subtotalExclVat,
    vatTotal: activeInvoice.vatTotal,
    totalInclVat: activeInvoice.totalInclVat,
    items: activeInvoice.items,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Controls Bar (Hidden during Print) */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500">Invoice:</div>
          <select
            value={activeInvoice.id}
            onChange={(e) => onSelectInvoice(e.target.value)}
            className="text-xs font-bold py-1.5 px-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoiceNumber} - {clients.find((c) => c.id === inv.clientId)?.name} (
                {formatZAR(inv.totalInclVat)}) [{inv.status}]
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status badge and switcher */}
          <select
            value={activeInvoice.status}
            onChange={(e) =>
              onUpdateInvoiceStatus(activeInvoice.id, e.target.value as InvoiceStatus)
            }
            className="text-xs font-semibold py-1.5 px-3 rounded-lg border border-slate-200 bg-white"
          >
            <option value="DRAFT">Status: DRAFT</option>
            <option value="SENT">Status: SENT</option>
            <option value="PAID">Status: PAID</option>
            <option value="OVERDUE">Status: OVERDUE</option>
          </select>

          {/* PayFast & Yoco Modal Trigger */}
          <button
            onClick={() => setShowPaymentModal(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>PayFast / Yoco Checkout</span>
          </button>

          {/* Sage SA Sync Trigger */}
          <button
            onClick={() => setShowSageModal(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
            <span>Sage / Xero SA</span>
          </button>

          {/* Print / PDF generation */}
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Tax Invoice (PDF)</span>
          </button>
        </div>
      </div>

      {/* STATUTORY SOUTH AFRICAN TAX INVOICE DOCUMENT */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-8 sm:p-12 print:border-none print:shadow-none print:p-0">
        {/* Statutory Tax Invoice Header */}
        <div className="border-b-2 border-slate-900 pb-6 mb-8 flex flex-col sm:flex-row justify-between items-start gap-6">
          <div>
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-widest block mb-1">
              Republic of South Africa · Value-Added Tax Act, 1991
            </span>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              TAX INVOICE
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Invoice #{activeInvoice.invoiceNumber}
              {activeInvoice.quoteNumber && ` · Ref Quote: ${activeInvoice.quoteNumber}`}
            </p>
          </div>

          <div className="sm:text-right space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              {activeInvoice.statutoryInfo.companyName}
            </h2>
            <div className="text-xs text-slate-600">
              <span className="font-medium">CIPC Reg No:</span>{' '}
              <span className="font-mono">{activeInvoice.statutoryInfo.companyRegistrationNumber}</span>
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-medium">SARS VAT Reg No:</span>{' '}
              <span className="font-mono font-bold text-slate-900">
                {activeInvoice.statutoryInfo.vatRegistrationNumber}
              </span>
            </div>
            <div className="text-xs text-slate-500 max-w-xs sm:ml-auto">
              {activeInvoice.statutoryInfo.physicalAddress}
            </div>
          </div>
        </div>

        {/* Client Details & Dates Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8 text-xs">
          <div className="space-y-1.5 p-4 bg-slate-50/75 rounded-lg border border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Billed To (Tax Invoice Recipient)
            </div>
            <div className="text-sm font-bold text-slate-900">
              {client.companyName || client.name}
            </div>
            {client.companyName && (
              <div className="text-slate-600 font-medium">Attn: {client.name}</div>
            )}
            <div className="text-slate-600">
              {client.address.streetAddress}
              {client.address.unitOrComplex ? `, ${client.address.unitOrComplex}` : ''}
              <br />
              {client.address.suburb}, {client.address.city}, {client.address.province}{' '}
              {client.address.postalCode}
            </div>
            <div className="text-slate-600 pt-1">
              <span className="font-medium">Phone:</span> {client.phone} ·{' '}
              <span className="font-medium">Email:</span> {client.email}
            </div>
            {client.vatNumber && (
              <div className="text-slate-800 font-medium pt-1">
                <span>Client SARS VAT No:</span>{' '}
                <span className="font-mono">{client.vatNumber}</span>
              </div>
            )}
          </div>

          <div className="space-y-2 p-4 bg-slate-50/75 rounded-lg border border-slate-200 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Tax Invoice Date:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {activeInvoice.issueDate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Due Date:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {activeInvoice.dueDate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Standard VAT Rate:</span>
                <span className="font-semibold text-slate-900 font-mono">15.00% (RSA)</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-slate-500">Payment Status:</span>
              <span
                className={`font-bold font-mono uppercase text-xs ${
                  activeInvoice.status === 'PAID'
                    ? 'text-emerald-600'
                    : activeInvoice.status === 'OVERDUE'
                    ? 'text-red-600'
                    : 'text-amber-600'
                }`}
              >
                {activeInvoice.status}
              </span>
            </div>
          </div>
        </div>

        {/* Itemized Line Items Table */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Itemized Tax Billing Schedule
            </h3>
            <div className="print:hidden">
              {isEditingItems ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Line
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveItems}
                    className="px-2.5 py-1 bg-slate-900 text-white rounded text-xs font-medium"
                  >
                    Save Changes
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingItems(true)}
                  className="text-xs text-slate-600 hover:text-slate-900 underline"
                >
                  Edit Line Items
                </button>
              )}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Description & Scope</th>
                  <th className="px-3 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Unit Price (Excl. VAT)</th>
                  <th className="px-4 py-3 text-right">VAT (15%)</th>
                  <th className="px-4 py-3 text-right">Total (Incl. VAT)</th>
                  {isEditingItems && <th className="px-2 py-3 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {editedItems.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {isEditingItems ? (
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) =>
                            handleUpdateItemField(idx, 'description', e.target.value)
                          }
                          className="w-full p-1 border border-slate-300 rounded text-xs"
                        />
                      ) : (
                        item.description
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">
                      {isEditingItems ? (
                        <input
                          type="number"
                          step="0.5"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItemField(idx, 'quantity', e.target.value)
                          }
                          className="w-16 p-1 border border-slate-300 rounded text-xs text-right font-mono"
                        />
                      ) : (
                        item.quantity
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {isEditingItems ? (
                        <input
                          type="number"
                          step="10"
                          value={item.unitPriceExclVat}
                          onChange={(e) =>
                            handleUpdateItemField(idx, 'unitPriceExclVat', e.target.value)
                          }
                          className="w-24 p-1 border border-slate-300 rounded text-xs text-right font-mono"
                        />
                      ) : (
                        formatZAR(item.unitPriceExclVat)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                      {formatZAR(item.vatAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatZAR(item.totalInclVat)}
                    </td>
                    {isEditingItems && (
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* VAT Calculation Summary & Banking Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-200 text-xs">
          {/* Statutory Banking Details for EFT */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-600" />
              <span>South African Banking Details (Instant EFT)</span>
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-slate-700">
              <span className="text-slate-500">Bank:</span>
              <span className="font-semibold">{activeInvoice.statutoryInfo.bankName}</span>

              <span className="text-slate-500">Account Holder:</span>
              <span className="font-medium">{activeInvoice.statutoryInfo.companyName}</span>

              <span className="text-slate-500">Account Number:</span>
              <span className="font-mono font-bold text-slate-900">
                {activeInvoice.statutoryInfo.accountNumber}
              </span>

              <span className="text-slate-500">Branch Code:</span>
              <span className="font-mono">{activeInvoice.statutoryInfo.branchCode}</span>

              <span className="text-slate-500">Reference:</span>
              <span className="font-mono font-bold text-amber-700">
                {activeInvoice.invoiceNumber}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 pt-1">
              Please email proof of payment (PoP) to accounts@servicekasi.co.za
            </p>
          </div>

          {/* Totals & SARS 15% VAT Breakdown */}
          <div className="space-y-2 self-start">
            <div className="flex justify-between py-1 text-slate-600">
              <span>Subtotal (Exclusive of VAT):</span>
              <span className="font-mono tabular-nums font-medium text-slate-900">
                {formatZAR(activeInvoice.subtotalExclVat)}
              </span>
            </div>

            <div className="flex justify-between py-1 text-slate-600">
              <div className="flex items-center gap-1">
                <span>Value-Added Tax (VAT):</span>
                <span className="text-[11px] font-mono text-slate-400">@ 15%</span>
              </div>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {formatZAR(activeInvoice.vatTotal)}
              </span>
            </div>

            <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-bold text-slate-900">
              <span>Total Due (ZAR):</span>
              <span className="font-mono tabular-nums text-base text-slate-900">
                {formatZAR(activeInvoice.totalInclVat)}
              </span>
            </div>

            {activeInvoice.status === 'PAID' && activeInvoice.paymentGateway && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-xs">
                    Paid via {activeInvoice.paymentGateway.gateway}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-emerald-700">
                  Ref: {activeInvoice.paymentGateway.transactionReference}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Statutory Note */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-[11px] text-slate-400 text-center">
          <p>
            This document serves as an official Tax Invoice in terms of Section 20(4) of the
            South African Value-Added Tax Act, 1991.
          </p>
        </div>
      </div>

      {/* PAYFAST / YOCO PAYMENT MODAL (Interactive Mock) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">South African Payment Gateway Gateway Simulator</h3>
                <p className="text-[11px] text-slate-400">PayFast & Yoco sandbox flows</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                <div>
                  <span className="text-slate-500">Invoice: </span>
                  <span className="font-mono font-bold text-slate-900">
                    {activeInvoice.invoiceNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Amount: </span>
                  <span className="font-mono font-bold text-emerald-600 text-sm">
                    {formatZAR(activeInvoice.totalInclVat)}
                  </span>
                </div>
              </div>

              {/* PayFast Card */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-600 tracking-tight">PayFast</span>
                    <span className="text-[11px] text-slate-400">
                      Instant EFT & Credit Card (RSA)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Sandbox: 10000100</span>
                </div>
                <p className="text-xs text-slate-600 leading-tight">
                  Supports Capitec Pay, FNB, Standard Bank, Absa, Nedbank & Visa/Mastercard.
                </p>
                <div className="pt-1 flex gap-2">
                  <button
                    onClick={() => {
                      onSimulatePayment(activeInvoice.id, 'PAYFAST');
                      setShowPaymentModal(false);
                    }}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                  >
                    Simulate Instant PayFast Settlement
                  </button>
                </div>
              </div>

              {/* Yoco Card */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-600 tracking-tight">Yoco</span>
                    <span className="text-[11px] text-slate-400">Card Payment Link</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">PK: pk_test_***</span>
                </div>
                <p className="text-xs text-slate-600 leading-tight">
                  South Africa's fastest card machine & online checkout for trade businesses.
                </p>
                <div className="pt-1 flex gap-2">
                  <button
                    onClick={() => {
                      onSimulatePayment(activeInvoice.id, 'YOCO');
                      setShowPaymentModal(false);
                    }}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                  >
                    Simulate Yoco Card Link Payment
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 text-center">
                Clicking will trigger instantaneous webhook callback and update invoice status to PAID.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SAGE / XERO ACCOUNTING MODAL */}
      {showSageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Sage One & Xero South Africa Ledger Sync</h3>
                <p className="text-[11px] text-slate-400">
                  Standard Rated Output VAT (15%) payload inspection
                </p>
              </div>
              <button
                onClick={() => setShowSageModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Sage Accounting JSON Payload</span>
                <span className="text-emerald-600 font-mono text-[11px]">
                  SARS Standard Rated 15%
                </span>
              </div>

              <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-lg overflow-x-auto max-h-64 leading-relaxed">
                {JSON.stringify(sagePayload, null, 2)}
              </pre>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => setShowSageModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onSimulateAccountingSync(activeInvoice.id, 'SAGE_SA');
                    setShowSageModal(false);
                  }}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors"
                >
                  Push to Sage Accounting SA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
