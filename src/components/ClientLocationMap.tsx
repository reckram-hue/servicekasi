import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Maximize2, LocateFixed } from 'lucide-react';
import { SouthAfricanAddress } from '../types';
import { createGoogleMapsLink } from '../lib/southAfrica';

interface ClientLocationMapProps {
  address: SouthAfricanAddress;
  clientName: string;
  jobNumber?: string;
  heightClass?: string;
}

export const ClientLocationMap: React.FC<ClientLocationMapProps> = ({
  address,
  clientName,
  jobNumber,
  heightClass = 'h-48 sm:h-56',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // South Africa default coords (Johannesburg) if not provided
  const lat = address.latitude ?? -26.1076;
  const lng = address.longitude ?? 28.0567;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing instance if container already initialized
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Initialize Leaflet map
    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 14,
      zoomControl: false, // We'll add subtle controls or keep clean touch UI
      attributionControl: false,
    });

    // High quality OpenStreetMap tiles with retina support
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // Custom modern SVG / HTML marker icon with pulse ring
    const customIcon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-full">
          <div class="absolute -top-1 w-8 h-8 bg-amber-500/25 rounded-full animate-ping pointer-events-none"></div>
          <div class="w-8 h-8 bg-slate-900 text-amber-400 rounded-full shadow-lg border-2 border-white flex items-center justify-center transition-transform hover:scale-110">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div class="w-2 h-1.5 bg-slate-900 -mt-0.5 rounded-b-full"></div>
        </div>
      `,
      iconSize: [32, 36],
      iconAnchor: [16, 36],
      popupAnchor: [0, -36],
    });

    // Create marker with popup
    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

    marker.bindPopup(`
      <div style="font-family: inherit; font-size: 11px; line-height: 1.4; color: #0f172a; padding: 2px;">
        <div style="font-weight: 700; color: #d97706; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; margin-bottom: 2px;">
          ${jobNumber ? `Work Order: ${jobNumber}` : 'Job Location'}
        </div>
        <div style="font-weight: 700; font-size: 12px; margin-bottom: 2px;">${clientName}</div>
        <div style="color: #64748b; font-size: 10px;">${address.streetAddress}, ${address.suburb}</div>
      </div>
    `);

    // Invalidate size after container render in case of layout shifts
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    mapInstanceRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [lat, lng, clientName, jobNumber, address.streetAddress, address.suburb]);

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 15, { duration: 0.8 });
      markerRef.current?.openPopup();
    }
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs group">
      {/* Map Header / Location Bar */}
      <div className="absolute top-2 left-2 right-2 z-1000 flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1.5 text-[11px] font-medium pointer-events-auto">
          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate max-w-[180px] sm:max-w-xs">
            {address.suburb}, {address.city}
          </span>
        </div>

        <div className="flex items-center gap-1 pointer-events-auto">
          <button
            type="button"
            onClick={handleRecenter}
            title="Recenter pin"
            className="p-1.5 bg-white/90 backdrop-blur-xs text-slate-700 hover:text-slate-900 rounded-lg shadow-sm border border-slate-200 hover:bg-white transition-colors"
          >
            <LocateFixed className="w-3.5 h-3.5" />
          </button>
          <a
            href={createGoogleMapsLink(address)}
            target="_blank"
            rel="noreferrer"
            title="Open in external Google Maps"
            className="p-1.5 bg-white/90 backdrop-blur-xs text-slate-700 hover:text-blue-600 rounded-lg shadow-sm border border-slate-200 hover:bg-white transition-colors flex items-center gap-1 text-[11px] font-medium"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-600" />
          </a>
        </div>
      </div>

      {/* Leaflet Map Canvas */}
      <div ref={mapContainerRef} className={`w-full ${heightClass} z-0`} />

      {/* Bottom Coordinates & Street Indicator */}
      <div className="absolute bottom-1.5 left-2 z-1000 pointer-events-none">
        <span className="bg-white/85 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] font-mono text-slate-600 shadow-2xs border border-slate-200/60">
          {lat.toFixed(4)}° S, {lng.toFixed(4)}° E
        </span>
      </div>
    </div>
  );
};
