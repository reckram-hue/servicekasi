import React, { useState } from 'react';
import {
  FileText,
  Plus,
  ArrowRight,
  Printer,
  CheckCircle2,
  Calendar,
  Building2,
  TrendingUp,
} from 'lucide-react';
import { Client, Quote } from '../types';
import { formatZAR } from '../lib/southAfrica';

interface QuoteListViewProps {
  quotes: Quote[];
  clients: Client[];
  onOpenNewQuote: () => void;
  onConvertQuoteToJob: (quote: Quote) => void;
}

export const QuoteListView: React.FC<QuoteListViewProps> = ({
  quotes,
  clients,
  onOpenNewQuote,
  onConvertQuoteToJob,
}) => {
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>(quotes[0]?.id || '');

  const activeQuote = quotes.find((q) => q.id === selectedQuoteId) || quotes[0];
  const client = activeQuote ? clients.find((c) => c.id === activeQuote.clientId) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Quotation Portfolio & Statutory Job Estimates
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Separates materials markup from technician labor rates with 15% South African VAT
          </p>
        </div>

        <button
          onClick={onOpenNewQuote}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>New Quotation</span>
        </button>
      </div>

      {/* Grid of quotes and active quote detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quote list */}
        <div className="space-y-3">
          {quotes.map((quote) => {
            const qClient = clients.find((c) => c.id === quote.clientId);
            const isSelected = activeQuote?.id === quote.id;

            return (
              <div
                key={quote.id}
                onClick={() => setSelectedQuoteId(quote.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                  isSelected
                    ? 'bg-white border-amber-500 shadow-sm ring-1 ring-amber-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-slate-900">
                    {quote.quoteNumber}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      quote.status === 'ACCEPTED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : quote.status === 'CONVERTED'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {quote.status}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 leading-snug">
                  {quote.jobTitle}
                </h4>

                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>{qClient?.name}</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatZAR(quote.totalInclVat)}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Valid to: {quote.expiryDate}</span>
                  <span className="text-emerald-700 font-semibold">
                    {quote.estimatedMarginPercent}% Margin
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Statutory Quotation Document & Job Card Layout */}
        <div className="lg:col-span-2">
          {activeQuote && client ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs space-y-6">
              {/* Document Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-slate-900 pb-6">
                <div>
                  <span className="text-[11px] font-bold text-amber-600 uppercase tracking-widest block mb-1">
                    Republic of South Africa · Formal Job Estimate
                  </span>
                  <h2 className="text-2xl font-extrabold text-slate-900">
                    QUOTATION / JOB ESTIMATE
                  </h2>
                  <p className="text-xs font-mono text-slate-500 mt-1">
                    Quote #{activeQuote.quoteNumber} · Issue Date: {activeQuote.issueDate}
                  </p>
                </div>

                <div className="sm:text-right space-y-1 text-xs text-slate-600">
                  <div className="font-bold text-slate-900">
                    Kasi Spark Electrical & Solar Solutions (Pty) Ltd
                  </div>
                  <div>CIPC Reg: 2023/849201/07</div>
                  <div>SARS VAT: 4920184721</div>
                  <div className="text-slate-400">Midrand, Gauteng, 1685</div>
                </div>
              </div>

              {/* Client & Scope info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Prepared For
                  </span>
                  <div className="font-bold text-slate-900">{client.name}</div>
                  <div className="text-slate-600">
                    {client.address.streetAddress}, {client.address.suburb}
                  </div>
                  <div className="text-slate-500">
                    {client.address.city}, {client.address.province}
                  </div>
                </div>

                <div className="space-y-1 sm:text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Quote Status & Validity
                  </span>
                  <div className="font-bold text-emerald-700">{activeQuote.status}</div>
                  <div className="text-slate-600">Validity: 14 Days from issue</div>
                  <div className="text-slate-500">Expires: {activeQuote.expiryDate}</div>
                </div>
              </div>

              {/* Scope Title */}
              <div>
                <h3 className="text-sm font-bold text-slate-900">{activeQuote.jobTitle}</h3>
                <p className="text-xs text-slate-600 mt-1">{activeQuote.notes}</p>
              </div>

              {/* Itemized Line Schedule */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Category</th>
                      <th className="px-4 py-2.5">Scope / Specification</th>
                      <th className="px-3 py-2.5 text-right">Qty</th>
                      <th className="px-4 py-2.5 text-right">Rate Excl. VAT</th>
                      <th className="px-4 py-2.5 text-right">Total (Incl. 15% VAT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activeQuote.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5">
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
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
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          {item.description}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                          {formatZAR(item.unitPriceExclVat)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatZAR(item.lineTotalInclVat)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-slate-200 text-xs">
                {/* Costing Margin Breakdown (Internal Dispatcher View) */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-800 text-[11px] block">
                    Commercial Cost & Margin Projection
                  </span>
                  <div className="flex justify-between text-slate-600">
                    <span>Internal Job Cost (Wages & Wholesale):</span>
                    <span className="font-mono">{formatZAR(activeQuote.subtotalCostZAR)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Projected Gross Margin:</span>
                    <span>
                      {formatZAR(activeQuote.estimatedGrossProfitZAR)} (
                      {activeQuote.estimatedMarginPercent}%)
                    </span>
                  </div>
                </div>

                {/* Customer Facing Totals */}
                <div className="space-y-1.5 font-mono">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Excl. VAT:</span>
                    <span>{formatZAR(activeQuote.subtotalExclVat)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>SARS VAT (15% Output):</span>
                    <span>{formatZAR(activeQuote.vatTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t-2 border-slate-900">
                    <span>Total Quoted (ZAR):</span>
                    <span>{formatZAR(activeQuote.totalInclVat)}</span>
                  </div>
                </div>
              </div>

              {/* Convert to Job Button */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Quotation (PDF)</span>
                </button>

                {activeQuote.status !== 'CONVERTED' ? (
                  <button
                    type="button"
                    onClick={() => onConvertQuoteToJob(activeQuote)}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Convert to Scheduled Work Order →</span>
                  </button>
                ) : (
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                    Converted to Active Job
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
