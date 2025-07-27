import React, { useEffect, useRef, useState } from 'react';
import { HiMap, HiLocationMarker, HiExclamation } from 'react-icons/hi';

const DisasterMap = ({ disaster }) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!disaster) return;

    const initLeafletMap = () => {
      // Load Leaflet CSS and JS
      if (!document.getElementById('leaflet-css')) {
        const css = document.createElement('link');
        css.id = 'leaflet-css';
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);
      }

      if (!window.L) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = createMap;
        script.onerror = () => setError('Failed to load map');
        document.head.appendChild(script);
      } else {
        createMap();
      }
    };

    const createMap = () => {
      if (!window.L || !mapRef.current) return;

      try {
        const center = disaster.location_details?.coordinates 
          ? [disaster.location_details.coordinates.lat, disaster.location_details.coordinates.lng]
          : [39.8283, -98.5795];

        const map = window.L.map(mapRef.current).setView(center, disaster.location_details?.coordinates ? 12 : 4);

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        if (disaster.location_details?.coordinates) {
          const marker = window.L.marker(center).addTo(map);
          marker.bindPopup(`
            <div style="color: #333;">
              <h3 style="margin: 0 0 8px 0; color: #ef4444;">${disaster.title}</h3>
              <p style="margin: 0 0 8px 0; font-size: 13px;">${disaster.location_name || 'Unknown location'}</p>
              <p style="margin: 0; font-size: 12px;">Status: ${disaster.status || 'Unknown'}</p>
            </div>
          `).openPopup();
        }

        mapInstanceRef.current = map;
        setMapLoaded(true);
      } catch (err) {
        setError('Failed to initialize map');
      }
    };

    initLeafletMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
    };
  }, [disaster]);

  if (error) {
    return (
      <div className="card bg-black/40 backdrop-blur-sm border border-red-500/30">
        <div className="card-body p-4">
          <div className="flex items-center gap-2 mb-2">
            <HiMap className="w-5 h-5 text-red-400" />
            <h3 className="card-title text-white">Location Map</h3>
          </div>
          <div className="text-center py-8 text-red-400">
            <HiExclamation className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-black/40 backdrop-blur-sm border border-purple-500/30">
      <div className="card-body p-0">
        <div className="p-4 border-b border-purple-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HiMap className="w-5 h-5 text-purple-400" />
              <h3 className="card-title text-white">Location Map</h3>
            </div>
            {disaster.location_name && (
              <div className="flex items-center gap-1 text-sm text-gray-300">
                <HiLocationMarker className="w-4 h-4" />
                {disaster.location_name}
              </div>
            )}
          </div>
        </div>
        <div className="relative h-64">
          <div
            ref={mapRef}
            className="w-full h-full rounded-b-lg"
          />
          {!mapLoaded && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-b-lg">
              <div className="text-center">
                <span className="loading loading-spinner loading-lg text-purple-400"></span>
                <p className="text-gray-300 mt-2 text-sm">Loading map...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DisasterMap;