import React, { useState } from 'react';
import {
  Users,
  MapPin,
  Phone,
  Mail,
  Plus,
  Building2,
  Calendar,
  MessageSquare,
  Search,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { Client, Job, SouthAfricanProvince } from '../types';
import {
  SA_PROVINCES,
  createGoogleMapsLink,
  createWhatsAppDispatchLink,
  normalizeSaPhone,
} from '../lib/southAfrica';

interface ClientDirectoryProps {
  clients: Client[];
  jobs: Job[];
  onAddClient: (client: Client) => void;
  onSelectClientForJob: (clientId: string) => void;
}

export const ClientDirectory: React.FC<ClientDirectoryProps> = ({
  clients,
  jobs,
  onAddClient,
  onSelectClientForJob,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states for new client
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [unitOrComplex, setUnitOrComplex] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [suburb, setSuburb] = useState('');
  const [city, setCity] = useState('Johannesburg');
  const [postalCode, setPostalCode] = useState('');
  const [province, setProvince] = useState<SouthAfricanProvince>('Gauteng');
  const [accessNotes, setAccessNotes] = useState('');

  const filteredClients = clients.filter((client) => {
    const term = searchTerm.toLowerCase();
    return (
      client.name.toLowerCase().includes(term) ||
      (client.companyName?.toLowerCase() || '').includes(term) ||
      client.address.suburb.toLowerCase().includes(term) ||
      client.address.city.toLowerCase().includes(term) ||
      client.phone.includes(term)
    );
  });

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !streetAddress.trim() || !suburb.trim()) return;

    const newClient: Client = {
      id: `cli-${Date.now()}`,
      name: name.trim(),
      companyName: companyName.trim() || undefined,
      phone: phone.trim() || '+27820000000',
      email: email.trim() || 'customer@servicekasi.co.za',
      vatNumber: vatNumber.trim() || undefined,
      address: {
        unitOrComplex: unitOrComplex.trim() || undefined,
        streetAddress: streetAddress.trim(),
        suburb: suburb.trim(),
        city: city.trim(),
        postalCode: postalCode.trim() || '2000',
        province,
        accessNotes: accessNotes.trim() || undefined,
      },
      createdAt: new Date().toISOString(),
    };

    onAddClient(newClient);
    setShowAddModal(false);

    // Reset fields
    setName('');
    setCompanyName('');
    setPhone('');
    setEmail('');
    setVatNumber('');
    setUnitOrComplex('');
    setStreetAddress('');
    setSuburb('');
    setAccessNotes('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Client Portfolio (South Africa)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Residential & commercial accounts with localized postal code and security gate protocols
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Add Client</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by client name, suburb (e.g. Sandton, Soweto), or phone..."
          className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Client Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => {
          const clientJobs = jobs.filter((j) => j.clientId === client.id);

          return (
            <div
              key={client.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {client.name}
                    </h3>
                    {client.companyName && (
                      <p className="text-xs text-slate-500 font-medium">{client.companyName}</p>
                    )}
                  </div>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {clientJobs.length} Job{clientJobs.length === 1 ? '' : 's'}
                  </span>
                </div>

                {/* South African Physical Address */}
                <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      {client.address.unitOrComplex && (
                        <span className="block text-slate-700 font-medium">
                          {client.address.unitOrComplex}
                        </span>
                      )}
                      <span>{client.address.streetAddress}</span>
                      <br />
                      <span className="font-semibold text-slate-800">
                        {client.address.suburb}, {client.address.city}
                      </span>
                      <br />
                      <span className="text-slate-500">
                        {client.address.province} · {client.address.postalCode}
                      </span>
                    </div>
                  </div>

                  {client.address.accessNotes && (
                    <p className="text-[11px] text-amber-800 bg-amber-50/75 p-1.5 rounded border border-amber-200/50 mt-1">
                      <span className="font-bold">Access:</span> {client.address.accessNotes}
                    </p>
                  )}
                </div>

                {/* Contact & Tax Info */}
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{client.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{client.email}</span>
                  </div>
                  {client.vatNumber && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-700 font-medium">
                      <span>SARS VAT:</span>
                      <span className="font-mono">{client.vatNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <a
                  href={createGoogleMapsLink(client.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-md transition-colors"
                  title="View on Google Maps"
                >
                  <MapPin className="w-4 h-4" />
                </a>

                <a
                  href={`https://wa.me/${normalizeSaPhone(client.phone).replace('+', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 rounded-md transition-colors"
                  title="Chat on WhatsApp"
                >
                  <MessageSquare className="w-4 h-4" />
                </a>

                <button
                  onClick={() => onSelectClientForJob(client.id)}
                  className="flex-1 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium text-center transition-colors shadow-2xs"
                >
                  + New Work Order
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-base font-bold text-slate-900">
                Register New Client (South Africa)
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Client Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Siphiwe Nkosi"
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company / Estate Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Nkosi Logistics (Pty) Ltd"
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SA Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="082 123 4567"
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.co.za"
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SARS VAT Number
                  </label>
                  <input
                    type="text"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                    placeholder="e.g. 4890284729"
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <span className="text-xs font-bold text-slate-900 block">
                  South African Physical Address Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Complex / Unit / Building
                    </label>
                    <input
                      type="text"
                      value={unitOrComplex}
                      onChange={(e) => setUnitOrComplex(e.target.value)}
                      placeholder="e.g. Unit 24, Leopard Rock Estate"
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Street Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="e.g. 42 Witkoppen Road"
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Suburb / Township *
                    </label>
                    <input
                      type="text"
                      required
                      value={suburb}
                      onChange={(e) => setSuburb(e.target.value)}
                      placeholder="e.g. Sandton / Soweto"
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Johannesburg"
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Province (RSA)
                    </label>
                    <select
                      value={province}
                      onChange={(e) => setProvince(e.target.value as SouthAfricanProvince)}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                    >
                      {SA_PROVINCES.map((p) => (
                        <option key={p.code} value={p.name}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Security Gate Code / Access Protocol
                  </label>
                  <input
                    type="text"
                    value={accessNotes}
                    onChange={(e) => setAccessNotes(e.target.value)}
                    placeholder="e.g. Security dial-code #492, guard requires contractor ID"
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors"
                >
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
