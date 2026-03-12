import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useRouter } from "next/navigation";
import { Route } from "lucide-react";

const customIcon = L.divIcon({
  className: "custom-theme-pin",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
  html: `
    <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));">
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0z" fill="hsl(var(--primary))" stroke="hsl(var(--primary-foreground))" stroke-width="1.2" />
      <circle cx="12" cy="10" r="3" fill="hsl(var(--primary-foreground))"/>
    </svg>
  `,
});

export default function CustomMarker({ id, latitude, longitude, name, image, imageUrl, description, categoryName, views, eventHandlers, onAddTrajeto }) {

  const router = useRouter();

  const handleClick = () => {
    router.push(`/view/p/${id}`);
  };

  const handleAddTrajetoClick = (event) => {
    event.stopPropagation();
    onAddTrajeto?.();
  };

  const previewSrc = imageUrl || (image ? `data:image/jpeg;base64,${image}` : null);

  return (
    <Marker position={[parseFloat(latitude), parseFloat(longitude)]} icon={customIcon} eventHandlers={eventHandlers}>
      <Popup closeButton={false} className="ponto-popup" offset={[0, -14]}>
        <div
          onClick={handleClick}
          className="group relative w-[240px] overflow-hidden cursor-pointer rounded-xl bg-card"
        >
          {onAddTrajeto && (
            <button
              type="button"
              onClick={handleAddTrajetoClick}
              className="absolute right-2 top-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white shadow-sm transition hover:bg-black"
              title="Adicionar trajeto"
              aria-label="Adicionar trajeto"
            >
              <Route size={14} />
            </button>
          )}

          <div className="relative h-[148px] w-full overflow-hidden bg-muted">
            {previewSrc ? (
              <img
                alt={name}
                src={previewSrc}
                className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                Sem imagem
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
            <p className="absolute bottom-3 left-3 right-3 text-sm font-semibold text-white drop-shadow-sm">
              {name}
            </p>
          </div>

          <div className="space-y-2 p-3">
            <p
              className="text-xs text-muted-foreground"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {description || "Sem descrição disponível"}
            </p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">
              Categoria: {categoryName || "Sem categoria"}
            </p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">
              {views ?? 0} visualizações
            </p>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}