import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  FileText,
  Calculator,
  Percent,
  CheckCircle2,
  Printer,
  Sparkles,
} from 'lucide-react';
import { Client, CostItemType, Quote, QuoteLineItem } from '../types';
import {
  calculateQuoteTotals,
  formatZAR,
  SA_VAT_RATE,
} from '../lib/southAfrica';

interface QuoteBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onCreateQuote: (quote: Quote) => void;
  onConvertQuoteToJob?: (quote: Quote) => void;
}

export const QuoteBuilderModal: React.FC<QuoteBuilderModalProps> = ({
  isOpen,
  onClose,
  clients,
  onCreateQuote,
  onConvertQuoteToJob,
}) => {
  const [jobTitle, setJobTitle] = useState('');
  const [category, setCategory] = useState('Solar & Inverters');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [notes, setNotes] = useState(
    'Quotation valid for 14 days. Prices subject to ZAR foreign exchange rates on imported components.'
  );

  const [items, setItems] = useState<QuoteLineItem[]>([
    {
      id: 'item-1',
      type: 'MATERIAL',
      description: '5kW Deye Hybrid Inverter & 5.12kWh Lithium Battery Pack',
      quantity: 1,
      unitCostZAR: 24500, // Supplier cost
      markupPercentage: 30, // 30% markup
      unitPriceExclVat: 31850,
      vatRate: SA_VAT_RATE,
      vatAmount: 4777.5,
      lineTotalInclVat: 36627.5,
    },
    {
      id: 'item-2',
      type: 'LABOR',
      description: 'Senior Electrician & Assistant On-Site Installation',
      quantity: 5,
      unitCostZAR: 240, // Tech wage burden
      markupPercentage: 170.83,
      unitPriceExclVat: 650,
      vatRate: SA_VAT_RATE,
      vatAmount: 487.5,
      lineTotalInclVat: 3737.5,
    },
    {
      id: 'item-3',
      type: 'CALLOUT',
      description: 'Gauteng Service Region Call-out & CoC Inspection',
      quantity: 1,
      unitCostZAR: 300,
      markupPercentage: 150,
      unitPriceExclVat: 750,
      vatRate: SA_VAT_RATE,
      vatAmount: 112.5,
      lineTotalInclVat: 862.5,
    },
  ]);

  if (!isOpen) return null;

  const totals = calculateQuoteTotals(items);
  const selectedClient = clients.find((c) => c.id === clientId) || clients[0];

  const handleUpdateItem = (
    index: number,
    field: 'type' | 'description' | 'quantity' | 'unitCostZAR' | 'markupPercentage' | 'unitPriceExclVat',
    val: string | number
  ) => {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === 'type') {
      item.type = val as CostItemType;
    } else if (field === 'description') {
      item.description = String(val);
    } else if (field === 'quantity') {
      item.quantity = Math.max(0.1, Number(val) || 1);
    } else if (field === 'unitCostZAR') {
      item.unitCostZAR = Math.max(0, Number(val) || 0);
      // Recalculate price based on current markup
      item.unitPriceExclVat =
        Math.round(item.unitCostZAR * (1 + item.markupPercentage / 100) * 100) / 100;
    } else if (field === 'markupPercentage') {
      item.markupPercentage = Number(val) || 0;
      item.unitPriceExclVat =
        Math.round(item.unitCostZAR * (1 + item.markupPercentage / 100) * 100) / 100;
    } else if (field === 'unitPriceExclVat') {
      item.unitPriceExclVat = Math.max(0, Number(val) || 0);
      // Recalculate markup % based on price
      if (item.unitCostZAR > 0) {
        item.markupPercentage =
          Math.round(((item.unitPriceExclVat - item.unitCostZAR) / item.unitCostZAR) * 1000) / 10;
      }
    }

    const priceSubtotal = item.quantity * item.unitPriceExclVat;
    item.vatAmount = Math.round(priceSubtotal * SA_VAT_RATE * 100) / 100;
    item.lineTotalInclVat = priceSubtotal + item.vatAmount;

    updated[index] = item;
    setItems(updated);
  };

  const handleAddItem = (type: CostItemType) => {
    const defaultCost = type === 'LABOR' ? 240 : type === 'CALLOUT' ? 350 : 1500;
    const defaultMarkup = type === 'LABOR' ? 170 : 35;
    const defaultPrice = Math.round(defaultCost * (1 + defaultMarkup / 100));
    const vat = Math.round(defaultPrice * SA_VAT_RATE * 100) / 100;

    const newItem: QuoteLineItem = {
      id: `item-${Date.now()}`,
      type,
      description:
        type === 'MATERIAL'
          ? 'New Trade Hardware / Inverter'
          : type === 'LABOR'
          ? 'Certified Technician Labor Hours'
          : 'Service Region Travel & Inspection',
      quantity: 1,
      unitCostZAR: defaultCost,
      markupPercentage: defaultMarkup,
      unitPriceExclVat: defaultPrice,
      vatRate: SA_VAT_RATE,
      vatAmount: vat,
      lineTotalInclVat: defaultPrice + vat,
    };

    setItems([...items, newItem]);
  };

  const handleDeleteItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim() || items.length === 0) return;

    const quoteNumber = `QT-2026-${String(Math.floor(Math.random() * 900) + 100)}`;
    const newQuote: Quote = {
      id: `qt-${Date.now()}`,
      quoteNumber,
      clientId,
      jobTitle: jobTitle.trim(),
      category,
      status: 'SENT',
      issueDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      items,
      subtotalCostZAR: totals.subtotalCostZAR,
      subtotalExclVat: totals.subtotalExclVat,
      estimatedGrossProfitZAR: totals.estimatedGrossProfitZAR,
      estimatedMarginPercent: totals.estimatedMarginPercent,
      vatTotal: totals.vatTotal,
      totalInclVat: totals.totalInclVat,
      notes,
    };

    onCreateQuote(newQuote);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Advanced Quotation & Margin Builder
            </h2>
            <p className="text-xs text-slate-500">
              Separates Supplier Materials, Labor Burden & Callouts with 15% South African VAT
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Header Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quotation Title / Scope of Work *
              </label>
              <input
                type="text"
                required
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. 5kW Hybrid Inverter, Battery & Sub-DB Board Installation"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Client (RSA)
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.address.suburb})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Itemized Line Items by Category */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Cost Breakdown (Materials · Labor · Callouts)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAddItem('MATERIAL')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3 text-amber-600" />
                  <span>+ Material</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddItem('LABOR')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3 text-blue-600" />
                  <span>+ Labor</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddItem('CALLOUT')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3 text-emerald-600" />
                  <span>+ Callout</span>
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Item Description</th>
                    <th className="px-2 py-2.5 text-right w-16">Qty</th>
                    <th className="px-3 py-2.5 text-right w-28">Supplier/Wage Cost (R)</th>
                    <th className="px-2 py-2.5 text-right w-20">Markup %</th>
                    <th className="px-3 py-2.5 text-right w-28">Client Price Excl. VAT</th>
                    <th className="px-3 py-2.5 text-right w-28">Total Incl. 15% VAT</th>
                    <th className="px-2 py-2.5 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            item.type === 'MATERIAL'
                              ? 'bg-amber-100 text-amber-900'
                              : item.type === 'LABOR'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                          className="w-full p-1 border border-slate-200 rounded text-xs"
                        />
                      </td>

                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          step="0.5"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                          className="w-14 p-1 border border-slate-200 rounded text-xs text-right font-mono"
                        />
                      </td>

                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={item.unitCostZAR}
                          onChange={(e) => handleUpdateItem(idx, 'unitCostZAR', e.target.value)}
                          className="w-24 p-1 border border-slate-200 rounded text-xs text-right font-mono"
                        />
                      </td>

                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          step="1"
                          value={item.markupPercentage}
                          onChange={(e) =>
                            handleUpdateItem(idx, 'markupPercentage', e.target.value)
                          }
                          className="w-16 p-1 border border-slate-200 rounded text-xs text-right font-mono"
                        />
                      </td>

                      <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-slate-800">
                        {formatZAR(item.quantity * item.unitPriceExclVat)}
                      </td>

                      <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatZAR(item.lineTotalInclVat)}
                      </td>

                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quotation Profit & Loss Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="space-y-2">
              <span className="font-bold text-slate-800 block">
                Estimated Gross Profit & Commercial Margin
              </span>
              <div className="space-y-1 text-slate-600 font-mono">
                <div className="flex justify-between">
                  <span>Total Internal Job Cost:</span>
                  <span className="font-semibold text-slate-900">
                    {formatZAR(totals.subtotalCostZAR)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Quoted Revenue (Excl. VAT):</span>
                  <span className="font-semibold text-slate-900">
                    {formatZAR(totals.subtotalExclVat)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-slate-200">
                  <span>Projected Gross Profit (ZAR):</span>
                  <span>{formatZAR(totals.estimatedGrossProfitZAR)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Projected Margin %:</span>
                  <span>{totals.estimatedMarginPercent}%</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t sm:border-t-0 sm:border-l border-slate-200 sm:pl-6">
              <span className="font-bold text-slate-800 block">
                Customer Quotation Total (15% VAT)
              </span>
              <div className="space-y-1 text-slate-600 font-mono">
                <div className="flex justify-between">
                  <span>Subtotal Excl. VAT:</span>
                  <span>{formatZAR(totals.subtotalExclVat)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SARS VAT (15% Output):</span>
                  <span>{formatZAR(totals.vatTotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t-2 border-slate-900">
                  <span>Total Quoted (ZAR):</span>
                  <span>{formatZAR(totals.totalInclVat)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs"
            >
              Issue Quotation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
