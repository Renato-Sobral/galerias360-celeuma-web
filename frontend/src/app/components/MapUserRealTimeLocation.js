import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';

const userIcon = L.divIcon({
  className: 'user-location-marker',
  html: `
    <div style="
      width: 18px;
      height: 18px;
      border-radius: 9999px;
      background: #2563eb;
      border: 3px solid #ffffff;
      box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.25);
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function MapUserRealTimeLocation() {
  const map = useMap();
  const [posicao, setPosicao] = useState(null);
  const watchIdRef = useRef(null);
  const isMountedRef = useRef(false);
  const latestPositionRef = useRef(null);
  const hasCenteredRef = useRef(false);
  const lastErrorMessageRef = useRef('');
  const retriedHighAccuracyRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    isMountedRef.current = true;

    const isMapReady = () => {
      return !!(
        map &&
        map._loaded &&
        typeof map.getContainer === 'function' &&
        map.getContainer()
      );
    };

    const withReadyMap = (callback) => {
      if (!isMountedRef.current || !isMapReady()) return;

      try {
        callback();
      } catch (error) {
        console.warn('MapUserRealTimeLocation ignored map access before readiness.', error);
      }
    };

    const showMapMessage = (message) => {
      if (!message || message === lastErrorMessageRef.current) return;

      lastErrorMessageRef.current = message;

      withReadyMap(() => {
        const latLng = latestPositionRef.current || map.getCenter();
        L.popup({ closeButton: true, autoClose: false, closeOnClick: true })
          .setLatLng(latLng)
          .setContent(message)
          .openOn(map);
      });
    };

    if (!navigator.geolocation) {
      showMapMessage('Este browser não suporta geolocalização.');
      return;
    }

    const onSuccess = (position) => {
      if (!isMountedRef.current) return;

      const { latitude, longitude } = position.coords;
      latestPositionRef.current = [latitude, longitude];
      setPosicao([latitude, longitude]);

      if (!hasCenteredRef.current) {
        withReadyMap(() => {
          map.setView([latitude, longitude], 15);
          hasCenteredRef.current = true;
        });
      }

      lastErrorMessageRef.current = '';
      withReadyMap(() => {
        map.closePopup();
      });
    };

    const onError = (error, { showTimeoutMessage = false } = {}) => {
      const code = error?.code;
      let message = 'Não foi possível obter a tua localização.';

      if (code === 1) {
        message = 'Permissão de localização negada. Ativa a localização no browser/dispositivo.';
      } else if (code === 2) {
        message = 'Localização indisponível neste momento. Tenta novamente em instantes.';
      } else if (code === 3) {
        if (!showTimeoutMessage) {
          return;
        }

        message = 'A localização está a demorar mais do que o esperado. Tenta novamente em instantes.';
      }

      showMapMessage(message);
    };

    const passiveOptions = {
      enableHighAccuracy: false,
      timeout: 30000,
      maximumAge: 300000,
    };

    const preciseOptions = {
      enableHighAccuracy: true,
      timeout: 45000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (error) => {
        if (error?.code === 3 && !retriedHighAccuracyRef.current) {
          retriedHighAccuracyRef.current = true;
          navigator.geolocation.getCurrentPosition(
            onSuccess,
            (preciseError) => onError(preciseError, { showTimeoutMessage: false }),
            preciseOptions
          );
          return;
        }

        onError(error, { showTimeoutMessage: false });
      },
      passiveOptions
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      onSuccess,
      (error) => onError(error, { showTimeoutMessage: false }),
      passiveOptions
    );

    return () => {
      isMountedRef.current = false;

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [map]);

  if (!posicao) return null;

  return <Marker position={posicao} icon={userIcon} />;
}
