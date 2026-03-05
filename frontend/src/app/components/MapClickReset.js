import { useMapEvent } from 'react-leaflet';

export default function MapaClickReset({ onClick }) {
  useMapEvent('click', (e) => {
    const target = e.originalEvent.target;

    if (!target) return;

    const tag = target.tagName?.toLowerCase();
    const className = target.className || "";
    const closest = typeof target.closest === 'function' ? target.closest.bind(target) : null;

    // Ignorar cliques em paths (rotas) ou na UI
    const isRoutingPath = tag === 'path';
    const isRoutingUI = typeof className === 'string' && className.includes('leaflet-routing-container');
    const isLeafletInteractive = typeof className === 'string' && className.includes('leaflet-interactive');
    const isInsideRoutingUI = !!closest?.('.leaflet-routing-container');
    const isInsideInteractivePane = !!closest?.('.leaflet-overlay-pane');

    if (isRoutingPath || isRoutingUI || isLeafletInteractive || isInsideRoutingUI || isInsideInteractivePane) {
      console.log('[MapaClickReset] Ignorado: clique em rota ou UI');
      return;
    }

    console.log('[MapaClickReset] Clique válido → limpar seleção');
    onClick?.();
  });

  return null;
}
