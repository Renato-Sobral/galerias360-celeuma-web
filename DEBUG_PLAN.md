# Debug Plan: Renderização de Imagem 4P não funciona após upload

## Problema
Utilizador faz upload de imagem local ou muda URL externa no menu, mas a imagem não aparece visualmente no hotspot da cena 360.

## Fluxo Esperado:
1. `updatePayload({ src: dataUrl })` → Enco de imagem recebido
2. `persistUserCustomization()` → localStorage atualizado
3. `setMyHotspotCustomizations(nextStore)` → State React atualizado
4. `effectiveHotspots` recomputa (depends on `myHotspotCustomizations`) → Override aplicado
5. `warpOverlays` recomputa (depends on `effectiveHotspots`) → Payload decodificado
6. JSX re-renderiza `warpOverlays.map()` → Entidade A-Frame atualizada
7. `warp-image.update()` → TextureLoader carrega imagem
8. Renderização visual na cena

## Logs Adicionados:
- 🔵 `persistUserCustomization`: localStorage.setItem, myHotspotCustomizations updated
- 🟠 `updatePayload`: chamada ao atualizar imagem
- 🟡 `effectiveHotspots` recalculated: contagem de hotspots/customizações
- 🟢 `applyUserOverridesToHotspot`: aplicação de override de conteudo
- 🟡 `warpOverlay mapping`: decoding do payload
- 🟣 `warpOverlays` changed: lista de overlays renderizados

## Passos de Debug:
1. Abrir DevTools Console
2. Fazer upload/mudar URL no menu
3. Ver sequência de logs (esperado: 🔵 → 🟠 → 🟡 → 🟢 → 🟡 → 🟣)
4. Se faltar algum: bug está nesse passo
5. Se todos existirem: bug está na renderização A-Frame ou no update do component

## Hipóteses:
A. `myHotspotCustomizations` não reage à mudança → useEffect dependency problem
B. `effectiveHotspots` não recomputa → useMemo not re-rendering
C. `warpOverlays` não recomputa → useMemo not re-rendering
D. Payload decodificado está vazio → encode/decode bug
E. A-Frame component não atualiza → schema or update() method issue
