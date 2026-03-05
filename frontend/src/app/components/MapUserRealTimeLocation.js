import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState } from 'react';

const userIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function MapUserRealTimeLocation() {
  const map = useMap();
  const [posicao, setPosicao] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setPosicao([latitude, longitude]);
        map.setView([latitude, longitude], 15);
      },
      () => {
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }, [map]);

  if (!posicao) return null;

  return <Marker position={posicao} icon={userIcon} />;
}
