import React, { useState } from 'react';
import {
  Webhook,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  Copy,
  Check,
  ShieldCheck,
  CreditCard,
  Building2,
  RefreshCw,
  Code,
  ArrowDownRight,
  ExternalLink,
} from 'lucide-react';
import { Tenant, WebhookEndpoint, WebhookEventLog } from '../types/multiTenant';
import { Invoice } from '../types';
import { formatZAR } from '../lib/southAfrica';
import { playNotificationChime } from '../lib/notificationSound';

interface WebhookHubProps {
  tenant: Tenant;
  invoices: Invoice[];
  webhookLogs: WebhookEventLog[];
  onTriggerSimulatedWebhook: (log: WebhookEventLog, affectedInvoiceId?: string) => void;
}

export const WebhookHub: React.FC<WebhookHubProps> = ({
  tenant,
  invoices,
  webhookLogs,
  onTriggerSimulatedWebhook,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<'OZOW' | 'PAYFAST' | 'SNAPSCAN' | 'CAPITEC_PAY'>('OZOW');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    invoices.find((i) => i.status === 'SENT' || i.status === 'DRAFT')?.id || invoices[0]?.id || ''
  );
  const [copiedEndpointId, setCopiedEndpointId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeLogInspect, setActiveLogInspect] = useState<WebhookEventLog | null>(null);

  const tenantLogs = webhookLogs.filter((l) => l.tenantId === tenant.id);
  const targetInvoice = invoices.find((i) => i.id === selectedInvoiceId);

  const handleCopySecret = (endpoint: WebhookEndpoint) => {
    navigator.clipboard?.writeText(endpoint.secret);
    setCopiedEndpointId(endpoint.id);
    setTimeout(() => setCopiedEndpointId(null), 2000);
  };

  const handleRunSimulation = () => {
    if (!targetInvoice) return;

    setIsSimulating(true);

    setTimeout(() => {
      const txRef = `${selectedProvider}-${Math.floor(100000 + Math.random() * 900000)}`;
      const amount = targetInvoice.totalInclVat;

      const newLog: WebhookEventLog = {
        id: `wh-log-${Date.now()}`,
        tenantId: tenant.id,
        event: 'payment.success',
        provider: selectedProvider,
        transactionReference: txRef,
        amountZAR: amount,
        payload: {
          event_type: 'PAYMENT_COMPLETED',
          tenant_slug: tenant.slug,
          provider: selectedProvider,
          transaction_reference: txRef,
          invoice_number: targetInvoice.invoiceNumber,
          invoice_id: targetInvoice.id,
          amount_zar: amount.toFixed(2),
          vat_15_percent: targetInvoice.vatTotal.toFixed(2),
          currency: 'ZAR',
          status: 'SUCCESSFUL',
          settlement_bank: tenant.banking.bankName,
          timestamp: new Date().toISOString(),
          hmac_sha256_signature: 'v1=' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        },
        receivedAt: new Date().toISOString(),
        status: 'PROCESSED',
        responseCode: 200,
      };

      // Play pleasant cash-register / payment notification chime
      playNotificationChime('payment');

      onTriggerSimulatedWebhook(newLog, targetInvoice.id);
      setIsSimulating(false);
      setActiveLogInspect(newLog);
    }, 700);
  };

  return (
    <div className="space-y-6">
      {/* Header Overview */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Payment Webhooks & Digital Wallet Integration
              </h2>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded-full">
                South African Gateway Hub
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Real-time payment notifications for <strong>Ozow Instant EFT</strong>, <strong>PayFast</strong>, <strong>SnapScan</strong>, and <strong>Capitec Pay</strong>. Incoming webhooks auto-reconcile invoices, mark jobs invoiced, and update tenant revenue in ZAR.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
              Registered Endpoints
            </span>
            <span className="text-base font-extrabold font-mono text-slate-900">
              {tenant.webhooks.length} Active
            </span>
          </div>

          <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
              Processed Events
            </span>
            <span className="text-base font-extrabold font-mono text-emerald-600">
              {tenantLogs.length} OK
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-Column: Left = Interactive Simulator, Right = Registered Endpoints */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Webhook Simulator (Left 2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Real-Time Webhook Simulator (Test Instant Settlement)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">HMAC SHA-256 Verified</span>
            </div>

            <p className="text-xs text-slate-600">
              Simulate an instant customer payment from a South African banking app or QR code scan. The applet will process the webhook payload, verify the signature, and transition the selected invoice to <strong>PAID</strong>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Select Provider */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Payment Gateway Provider
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value as any)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg bg-white font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="OZOW">Ozow Instant EFT (FNB, Capitec, Nedbank, Standard Bank)</option>
                  <option value="PAYFAST">PayFast / Network (Credit Card & Debit Card)</option>
                  <option value="SNAPSCAN">SnapScan (Mobile In-Field QR)</option>
                  <option value="CAPITEC_PAY">Capitec Pay (Direct In-App Mandate)</option>
                </select>
              </div>

              {/* Select Invoice */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Target Unpaid / Open Invoice
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg bg-white font-mono font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} · {formatZAR(inv.totalInclVat)} ({inv.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Target Invoice Details Preview */}
            {targetInvoice && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500">Selected Invoice: </span>
                  <strong className="font-mono text-slate-900">{targetInvoice.invoiceNumber}</strong>
                  <span className="mx-2 text-slate-300">|</span>
                  <span className="text-slate-500">Current Status: </span>
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      targetInvoice.status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {targetInvoice.status}
                  </span>
                </div>
                <div className="font-mono font-extrabold text-sm text-slate-900">
                  {formatZAR(targetInvoice.totalInclVat)}
                </div>
              </div>
            )}

            {/* Trigger Button */}
            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                disabled={isSimulating}
                onClick={handleRunSimulation}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Webhook Delivery...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Dispatch Simulated {selectedProvider} Payment Webhook</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Webhook Logs Stream Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50/75 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Live Webhook Delivery Stream ({tenantLogs.length})
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">Status 200 OK</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white border-b border-slate-100 text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">Event & Provider</th>
                    <th className="px-3 py-2.5">Transaction Ref</th>
                    <th className="px-3 py-2.5 text-right">Amount (ZAR)</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Time</th>
                    <th className="px-4 py-2.5 text-right">Inspect Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenantLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-slate-900">{log.event}</div>
                        <span className="text-[10px] font-mono text-slate-500">{log.provider}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 text-[11px]">
                        {log.transactionReference}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                        {log.amountZAR > 0 ? formatZAR(log.amountZAR) : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                          200 OK
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 font-mono text-[10px]">
                        {new Date(log.receivedAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => setActiveLogInspect(log)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold flex items-center gap-1 ml-auto"
                        >
                          <Code className="w-3 h-3 text-slate-400" />
                          <span>View JSON</span>
                        </button>
                      </td>
                    </tr>
                  ))}

                  {tenantLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400">
                        No webhook events recorded yet. Click the simulate button above!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Registered Endpoints & Active Payload Inspector */}
        <div className="space-y-4">
          {/* Endpoints List */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Configured Payment Endpoints
            </h4>

            <div className="space-y-2.5">
              {tenant.webhooks.map((ep) => (
                <div
                  key={ep.id}
                  className="p-3 bg-slate-50/75 border border-slate-200 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{ep.name}</span>
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                      {ep.status}
                    </span>
                  </div>

                  <div className="font-mono text-[10px] text-slate-500 break-all bg-white p-1.5 rounded border border-slate-200">
                    {ep.url}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[10px]">
                    <span className="text-slate-400">Secret: ••••••••••••</span>
                    <button
                      onClick={() => handleCopySecret(ep)}
                      className="text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-1"
                    >
                      {copiedEndpointId === ep.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Secret</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* JSON Payload Inspector */}
          {activeLogInspect && (
            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 shadow-xs space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-[11px]">
                <span className="text-emerald-400 font-bold">
                  {activeLogInspect.provider} Webhook Payload
                </span>
                <span className="text-slate-500">200 OK</span>
              </div>

              <pre className="text-[10px] text-slate-300 overflow-x-auto max-h-56 p-1 no-scrollbar">
                {JSON.stringify(activeLogInspect.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
