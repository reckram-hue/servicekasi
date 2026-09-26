import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  LocateFixed,
  Filter,
  Users,
  Clock,
  Layers,
  Phone,
  MessageSquare,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Route as RouteIcon,
} from 'lucide-react';
import { Client, Job, JobStatus, User } from '../types';
import {
  createGoogleMapsLink,
  createWhatsAppDispatchLink,
  formatZAR,
} from '../lib/southAfrica';

interface AdminRouteMapProps {
  jobs: Job[];
  clients: Client[];
  technicians: User[];
  onSelectJobForTechView: (jobId: string) => void;
  onAssignTechnician: (jobId: string, techId: string) => void;
  onUpdateJobStatus: (jobId: string, status: JobStatus) => void;
}

// Color palette for technicians
const TECH_COLORS: Record<string, { bg: string; border: string; hex: string; text: string }> = {
  'user-tech-1': { bg: 'bg-amber-500', border: 'border-amber-600', hex: '#f59e0b', text: 'text-amber-800' }, // Sipho (Solar)
  'user-tech-2': { bg: 'bg-emerald-600', border: 'border-emerald-700', hex: '#059669', text: 'text-emerald-800' }, // Thabo (Plumbing)
  'user-tech-3': { bg: 'bg-blue-600', border: 'border-blue-700', hex: '#2563eb', text: 'text-blue-800' }, // Pieter (HVAC)
  'user-tech-4': { bg: 'bg-purple-600', border: 'border-purple-700', hex: '#9333ea', text: 'text-purple-800' }, // Naledi (Gate/Smart)
  unassigned: { bg: 'bg-rose-500', border: 'border-rose-600', hex: '#f43f5e', text: 'text-rose-800' },
};

// Color palette for status
const STATUS_COLORS: Record<JobStatus, { bg: string; hex: string }> = {
  PENDING: { bg: 'bg-amber-400', hex: '#fbbf24' },
  SCHEDULED: { bg: 'bg-blue-500', hex: '#3b82f6' },
  IN_PROGRESS: { bg: 'bg-purple-600', hex: '#9333ea' },
  COMPLETED: { bg: 'bg-emerald-500', hex: '#10b981' },
  INVOICED: { bg: 'bg-slate-700', hex: '#334155' },
  CANCELLED: { bg: 'bg-slate-400', hex: '#94a3b8' },
};

export const AdminRouteMap: React.FC<AdminRouteMapProps> = ({
  jobs,
  clients,
  technicians,
  onSelectJobForTechView,
  onAssignTechnician,
  onUpdateJobStatus,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);

  const [colorCodingBy, setColorCodingBy] = useState<'TECHNICIAN' | 'STATUS'>('TECHNICIAN');
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('ALL');
  const [showRouteLines, setShowRouteLines] = useState<boolean>(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const getClient = (clientId: string) => clients.find((c) => c.id === clientId);
  const getTech = (techId?: string) => technicians.find((t) => t.id === techId);

  // Filter jobs based on selected technician
  const filteredJobs = jobs.filter((job) => {
    if (selectedTechFilter === 'ALL') return true;
    if (selectedTechFilter === 'UNASSIGNED') return !job.assignedTechId;
    return job.assignedTechId === selectedTechFilter;
  });

  // Center of Gauteng / JHB area
  const GAUTENG_CENTER: [number, number] = [-26.11, 28.02];

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: GAUTENG_CENTER,
      zoom: 11,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    routesLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers & Polylines whenever jobs, filters, or view states change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current || !routesLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    routesLayerRef.current.clearLayers();

    const bounds: [number, number][] = [];

    // Group jobs by technician to draw sequential daily routes
    const techRoutes: Record<string, { lat: number; lng: number; job: Job }[]> = {};

    filteredJobs.forEach((job) => {
      const client = getClient(job.clientId);
      if (!client || client.address.latitude == null || client.address.longitude == null) return;

      const lat = client.address.latitude;
      const lng = client.address.longitude;
      bounds.push([lat, lng]);

      const tech = getTech(job.assignedTechId);
      const techColor = job.assignedTechId
        ? TECH_COLORS[job.assignedTechId] || TECH_COLORS.unassigned
        : TECH_COLORS.unassigned;
      const statusColor = STATUS_COLORS[job.status] || STATUS_COLORS.PENDING;

      const activeColorHex =
        colorCodingBy === 'TECHNICIAN' ? techColor.hex : statusColor.hex;

      // Group into tech route list for polyline drawing
      const techKey = job.assignedTechId || 'unassigned';
      if (!techRoutes[techKey]) {
        techRoutes[techKey] = [];
      }
      techRoutes[techKey].push({ lat, lng, job });

      // Create Custom SVG Marker Icon
      const isSelected = activeJobId === job.id;
      const markerHtml = `
        <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-full cursor-pointer transition-transform ${
          isSelected ? 'scale-125 z-50' : 'hover:scale-110'
        }">
          ${
            job.status === 'IN_PROGRESS' || (job.overrunMinutes && job.overrunMinutes > 0)
              ? `<div class="absolute -top-1 w-9 h-9 rounded-full ${
                  job.overrunMinutes ? 'bg-red-500/35' : 'bg-emerald-500/25'
                } animate-ping pointer-events-none"></div>`
              : ''
          }
          <div class="w-8 h-8 rounded-full shadow-md border-2 border-white flex items-center justify-center text-white font-bold text-xs" style="background-color: ${activeColorHex}">
            ${
              job.assignedTechId && tech
                ? tech.name.split(' ')[0][0]
                : '?'
            }
          </div>
          <div class="w-2.5 h-1.5 -mt-0.5 rounded-b-full shadow-xs" style="background-color: ${activeColorHex}"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'route-job-marker',
        html: markerHtml,
        iconSize: [32, 38],
        iconAnchor: [16, 38],
        popupAnchor: [0, -38],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(
        markersLayerRef.current!
      );

      // Interactive popup
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 11px; line-height: 1.4; color: #0f172a; min-width: 220px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 800; font-family: monospace; color: #0f172a; font-size: 12px;">${job.jobNumber}</span>
            <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; background: ${activeColorHex}20; color: ${activeColorHex}; padding: 1px 6px; rounded: 4px;">
              ${colorCodingBy === 'TECHNICIAN' ? (tech ? tech.name.split(' ')[0] : 'Unassigned') : job.status}
            </span>
          </div>

          <div style="font-weight: 700; font-size: 12px; margin-bottom: 2px; color: #0f172a;">${job.title}</div>
          <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">
            <strong>${client.name}</strong> · ${client.address.suburb}
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; margin-bottom: 6px; font-size: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="color: #64748b;">Scheduled Slot:</span>
              <strong style="color: #0f172a; font-family: monospace;">${job.scheduledTime}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Assigned Crew:</span>
              <strong style="color: #0f172a;">${tech ? tech.name : 'Unassigned'}</strong>
            </div>
            ${
              job.overrunMinutes && job.overrunMinutes > 0
                ? `<div style="color: #dc2626; font-weight: 700; margin-top: 4px;">⚠️ Overrun delay: +${Math.round(job.overrunMinutes / 60)}h</div>`
                : ''
            }
          </div>

          <div style="display: flex; gap: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0;">
            <a href="${createGoogleMapsLink(client.address)}" target="_blank" style="flex: 1; text-align: center; background: #2563eb; color: white; padding: 4px 6px; border-radius: 4px; font-weight: 600; text-decoration: none; font-size: 10px;">
              Maps Directions
            </a>
            ${
              tech
                ? `<a href="${createWhatsAppDispatchLink(client.phone, client.name, tech.name, job.scheduledTime)}" target="_blank" style="flex: 1; text-align: center; background: #059669; color: white; padding: 4px 6px; border-radius: 4px; font-weight: 600; text-decoration: none; font-size: 10px;">
                    WhatsApp ETA
                  </a>`
                : ''
            }
          </div>
        </div>
      `);

      marker.on('click', () => {
        setActiveJobId(job.id);
      });
    });

    // Draw route polylines connecting stops per technician if enabled
    if (showRouteLines) {
      Object.entries(techRoutes).forEach(([techId, stops]) => {
        if (techId === 'unassigned' || stops.length < 2) return;

        const techColor = TECH_COLORS[techId] || TECH_COLORS.unassigned;
        const polylineCoords = stops.map((s) => [s.lat, s.lng] as [number, number]);

        L.polyline(polylineCoords, {
          color: techColor.hex,
          weight: 3.5,
          opacity: 0.8,
          dashArray: '6, 8',
          lineCap: 'round',
        }).addTo(routesLayerRef.current!);
      });
    }

    // Fit map bounds to view all active pins with gentle padding
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [filteredJobs, colorCodingBy, showRouteLines, activeJobId]);

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(GAUTENG_CENTER, 11, { animate: true });
    }
  };

  const handleFocusJob = (job: Job) => {
    const client = getClient(job.clientId);
    if (!client?.address.latitude || !client?.address.longitude || !mapInstanceRef.current) return;

    setActiveJobId(job.id);
    mapInstanceRef.current.flyTo(
      [client.address.latitude, client.address.longitude],
      14,
      { duration: 0.8 }
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
      {/* Route Map Controls Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/75 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <RouteIcon className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Gauteng Regional Route & Territory Dispatch Map
            </h3>
            <span className="text-[11px] font-mono font-bold bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700">
              {filteredJobs.length} Stops Plotted
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Color-coded geospatial dispatch across Johannesburg, Midrand, Soweto, Sandton & Centurion
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Color Mode Switcher */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setColorCodingBy('TECHNICIAN')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                colorCodingBy === 'TECHNICIAN'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Crew / Tech
            </button>
            <button
              onClick={() => setColorCodingBy('STATUS')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                colorCodingBy === 'STATUS'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Job Status
            </button>
          </div>

          {/* Technician Filter Dropdown */}
          <select
            value={selectedTechFilter}
            onChange={(e) => setSelectedTechFilter(e.target.value)}
            className="text-xs font-semibold py-1.5 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">All Crews (Global Route)</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.specialties[0]})
              </option>
            ))}
            <option value="UNASSIGNED">Unassigned Only</option>
          </select>

          {/* Toggle Route Polyline Connections */}
          <button
            onClick={() => setShowRouteLines(!showRouteLines)}
            className={`px-2.5 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              showRouteLines
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <RouteIcon className="w-3.5 h-3.5" />
            <span>{showRouteLines ? 'Hide Route Lines' : 'Show Route Lines'}</span>
          </button>

          {/* Recenter Button */}
          <button
            onClick={handleRecenter}
            title="Recenter Gauteng Area"
            className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <LocateFixed className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main 2-Column Layout: Leaflet Map (Left/Center) + Daily Route Sidebar (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 min-h-[560px]">
        {/* Leaflet Central Map View (3 columns on desktop) */}
        <div className="lg:col-span-3 relative h-[480px] lg:h-[580px] bg-slate-100 z-0">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Floating Map Legend Overlay */}
          <div className="absolute bottom-3 left-3 z-1000 bg-white/90 backdrop-blur-md p-2.5 rounded-xl border border-slate-200 shadow-sm max-w-xs text-xs space-y-1.5">
            <span className="font-bold text-[10px] uppercase text-slate-500 tracking-wider block">
              {colorCodingBy === 'TECHNICIAN' ? 'Assigned Field Crew' : 'Job Status'}
            </span>

            {colorCodingBy === 'TECHNICIAN' ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                {technicians.map((t) => {
                  const color = TECH_COLORS[t.id] || TECH_COLORS.unassigned;
                  return (
                    <div key={t.id} className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="truncate">{t.name.split(' ')[0]}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: TECH_COLORS.unassigned.hex }}
                  />
                  <span>Unassigned</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                {Object.entries(STATUS_COLORS).map(([st, color]) => (
                  <div key={st} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="truncate">
                      {st.charAt(0) + st.slice(1).toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Daily Route Order & Stops Drawer (1 column on desktop) */}
        <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/50 flex flex-col h-[400px] lg:h-[580px] overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Route Itinerary ({filteredJobs.length})
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Today</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 no-scrollbar">
            {filteredJobs.map((job, idx) => {
              const client = getClient(job.clientId);
              const tech = getTech(job.assignedTechId);
              const techColor = job.assignedTechId
                ? TECH_COLORS[job.assignedTechId] || TECH_COLORS.unassigned
                : TECH_COLORS.unassigned;
              const isSelected = activeJobId === job.id;

              return (
                <div
                  key={job.id}
                  onClick={() => handleFocusJob(job)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all space-y-2 ${
                    isSelected
                      ? 'bg-white border-amber-500 shadow-sm ring-1 ring-amber-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: techColor.hex }}
                      />
                      <span className="font-mono font-bold text-slate-900">
                        {job.jobNumber}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      Stop #{idx + 1}
                    </span>
                  </div>

                  <h5 className="font-bold text-slate-900 line-clamp-1 leading-snug">
                    {job.title}
                  </h5>

                  {client && (
                    <div className="text-[11px] text-slate-600 flex items-start gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                      <span className="truncate">
                        {client.address.streetAddress}, {client.address.suburb}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-slate-500 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{job.scheduledTime}</span>
                    </div>
                    <span className="font-semibold text-slate-800">
                      {tech ? tech.name.split(' ')[0] : 'Unassigned'}
                    </span>
                  </div>

                  {/* Overrun Warning badge if job is delayed */}
                  {job.overrunMinutes && job.overrunMinutes > 0 ? (
                    <div className="p-1.5 bg-red-50 text-red-700 rounded text-[10px] font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-red-600" />
                      <span>Overrun delay: +{Math.round(job.overrunMinutes / 60)}h</span>
                    </div>
                  ) : null}

                  {/* Quick Action links */}
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectJobForTechView(job.id);
                      }}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[10px] font-semibold"
                    >
                      Field View →
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredJobs.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs">
                No active stops match the selected filter.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
