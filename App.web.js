import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './webLeaflet.css';

// Fix default icon paths so markers show up after bundling
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

export default function App() {
  const [pos, setPos] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!navigator || !navigator.geolocation) {
      setErr('Geolocation is not available in this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (p) => setPos([p.coords.latitude, p.coords.longitude]),
      (e) => setErr(e.message || 'Failed to get position'),
      { enableHighAccuracy: true }
    );
  }, []);

  if (err) {
    return (
      <div className="center">
        <div>{err}</div>
      </div>
    );
  }

  if (!pos) {
    return (
      <div className="center">
        <div className="spinner" />
        <div style={{ marginTop: 8 }}>Fetching location…</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <MapContainer center={pos} zoom={15} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={pos}>
          <Popup>You are here</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
