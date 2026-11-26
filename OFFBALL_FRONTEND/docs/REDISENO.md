# OFFBALL · Rediseño integral UX/UI (v0.2.0)

Rama: `rediseno/ux-ui` (el estado original del zip está en `main`, commit `bc57f09`).
Nada se ha publicado ni desplegado. Los modelos, la API y sus resultados no se han modificado.

> **Capturas:** las imágenes de `docs/capturas/` se tomaron contra una **API simulada de desarrollo** (datos sintéticos con la forma exacta del contrato v0.1.0, jugadores llamados «Jugador sintético NNN»). Esa API vive fuera del proyecto y **no forma parte del frontend**. Las cifras de las capturas no son resultados reales de OFFBALL.

---

## 1. Auditoría de la interfaz anterior

### 1.1 Tecnología y arquitectura (se conserva)

| Capa | Estado encontrado | Decisión |
| --- | --- | --- |
| Stack | React 19 + TypeScript estricto + Vite 7 + Tailwind CSS v4 | Se mantiene |
| Dependencias de ejecución | Sólo `react`, `react-dom` y tipografías `@fontsource` | **Ninguna dependencia nueva** |
| Router | Propio sobre History API | Se mantiene, se añaden View Transitions |
| Datos | Cliente único `api/client.ts` contra OFFBALL API v0.1.0 (timeout, abort, errores 422) | Sin cambios |
| Lógica | `domain/` puro y testeado (formulario, payloads, mercado, comparador, zonas) | Sin cambios; se añaden módulos nuevos |
| Persistencia | `localStorage` versionado (`offball.seguimiento`, `offball.comparador`) | Sin cambios; se añade `offball.preferencias` |
| Tests | 55 tests Vitest | 55 intactos + 14 nuevos |

### 1.2 Problemas detectados

**Bloqueantes**
- `src/components/brand/Logo.tsx` **no venía en el zip** pero lo importaban `Shell.tsx` y `Home.tsx` → `npm run build` fallaba y `tsc` daba error (ver `docs/capturas/` y sección 9).
- `PlayerForm.tsx` propagaba props de `<input>` a `<select>` → 2 errores de tipos.
- No había `package-lock.json`.

**Usabilidad y navegación**
- Siete entradas de menú con el mismo peso para cualquier usuario; no había un camino «rápido» para directivos ni uno «profundo» para analistas.
- La ficha de resultados mezclaba en una columna cifras técnicas (residuo log, G01, P95) y conclusiones: un usuario no técnico no encontraba la respuesta en una frase.
- Formulario siempre desplegado junto al resultado: ocupaba 400 px aunque el análisis ya estuviera hecho.
- Sin buscador global ni atajos de teclado.
- El inicio era una portada de presentación (titular + cuatro tarjetas de acceso + «tres preguntas») sin ningún dato del mercado.

**Jerarquía visual**
- Rótulos en mayúsculas monoespaciadas con numeración «01 / …» en cada página aunque no fueran secuencias.
- Cuadrícula repetitiva de tarjetas iguales en el inicio.
- Un único radio y la misma caja para todo.

**Mapa de calor**
- Datos: **sólo** `afinidad` de `POST /api/v1/afinidad` (4 fracciones que suman 1: DC, EI, ED, MCO). **No existen coordenadas ni eventos.**
- Representación: círculos con degradado radial superpuestos en posiciones fijas y una pastilla con el porcentaje (las «manchas artificiales» del encargo).
- Sin interacción (ni hover, ni selección, ni zoom), sin comparación, sin pantalla completa.
- Campo en unidades arbitrarias (10 u/m) con proporciones aproximadas.
- Ya se declaraba como afinidad (no movimientos): ese principio se ha mantenido y reforzado.

**Rendimiento**
- Correcto en general (SVG propios, sin librerías). El mapa recreaba gradientes por zona en cada render; el nuevo campo continuo usa un único `canvas`.

### 1.3 Reutilizado
Cliente API, guards, errores, todo `domain/` (formulario, validación, payloads, mercado/CSV, comparador, similitud, formatos), estado de conexión, almacenamiento, `ValueChart` y `ResidualGauge`, `PlayerForm`, páginas de Seguimiento y Metodología (reestilizadas).

### 1.4 Mejoras posibles sin tocar modelos ni datos
Todo lo implementado en este rediseño. Lo que exigiría cambios en la API se lista en la sección 10.

---

## 2. Propuesta de rediseño

**Idea rectora:** «informe de scouting interactivo». Cada pantalla responde primero con una conclusión legible y deja la técnica a un clic (divulgación progresiva), con el campo de fútbol como elemento propio de la marca.

**Dirección artística**
- Se respeta la identidad: Verde noche `#0D1915`, Blanco `#FCFCFA`, Salvia `#7D948C`, y los colores de datos con significado fijo (Lime, Blue, Gold, Lavender; Coral sólo errores).
- Montserrat para titulares (personalidad deportiva), Inter para interfaz, IBM Plex Mono **sólo para cifras** (ya no para rótulos).
- Rótulos en frase normal, sin mayúsculas forzadas ni numeraciones decorativas. Numeración sólo donde hay secuencia real (pasos del formulario, puestos del ranking).
- Superficies planas, bordes finos, sombras sólo en capas flotantes, sin glassmorphism ni degradados decorativos.
- La audacia se concentra en un sitio: **el mapa táctico**. El resto, sobrio.

**Arquitectura de navegación**

| Grupo | Página | Esencial | Avanzado |
| --- | --- | --- | --- |
| Scouting | Inicio (centro de scouting) | ✔ | ✔ |
| | Analizar jugador (informe) | ✔ | ✔ |
| | Mercado (explorador + oportunidades) | ✔ | ✔ |
| | Comparador | ✔ | ✔ |
| | Perfiles (GMM) — **nueva** | ✔ | ✔ |
| Mi trabajo | Seguimiento | ✔ | ✔ |
| Modelo | Rendimiento del modelo — **nueva** | — | ✔ |
| | Afinidad rápida (antes «Inteligencia posicional») | — | ✔ |
| | Metodología | ✔ | ✔ |

«Explorador de jugadores» y «Oportunidades de mercado» comparten el mismo endpoint (`/oportunidades`): se unifican en **Mercado** con cuatro vistas de los mismos datos (Ranking · Tabla · Valor vs. estimado · Residuos). Así no hay dos pantallas que muestren lo mismo.

Además: buscador global (Ctrl/⌘ + K o «/»), estados activos animados, migas en la cabecera, filtros con chips eliminables y «Restablecer».

---

## 3. Sistema de diseño

Fuente única de tokens: `src/styles/index.css` (`@theme`) y `src/motion/tokens.ts`.

### Color
| Token | Valor | Uso |
| --- | --- | --- |
| `noche` / `noche-2` | `#0d1915` / `#0a1411` | Fondo / barra lateral y campos |
| `panel` · `panel-2` · `panel-3` | `#12211b` · `#172a22` · `#1e352b` | Superficies por elevación |
| `line` · `line-2` · `line-3` | `#22392f` · `#2f4a3e` · `#3c5a4c` | Bordes por énfasis |
| `blanco` · `salvia-2` · `salvia` | `#fcfcfa` · `#a8b9b2` · `#7d948c` | Texto principal / secundario / terciario |
| `lime` | `#b7e68f` | Estimación G02, señal, mejor zona, positivo |
| `blue` | `#83b9ce` | Referencia G01, segundo elemento comparado |
| `gold` | `#e5c383` | Valor observado, histórico, «estimado» |
| `lavender` | `#c9a4d3` | Perfiles GMM |
| `coral` | `#ec9a8c` | Errores (siempre con icono/texto) |
| `p0…p4` | azul, oro, lavanda, menta, albaricoque | Los cinco perfiles GMM (índice de clúster) |
| `heat-0…5` | `#13261e` → `#eaf8d4` | Rampa secuencial del mapa (escala fija 0–100 %) |

### Tipografía (escala ~1,2)
`2xs` 11 · `xs` 12 · `sm` 13 · base 14 · `base` 15 · títulos de sección 18–20 (Montserrat 700) · títulos de página 28–35 (Montserrat 800). Cifras: Plex Mono con `tabular-nums`.

### Espaciado, radios y elevación
Rejilla de 4 px (Tailwind). Radios jerárquicos: control 5 px < botón 7 px < panel 10 px; campo 8 px. Sombra sólo en tooltip, cajón, paleta de comandos.

### Componentes (`src/components/ui/primitives.tsx`)
`Button` (primary · secondary · ghost · quiet · danger; sm/md/lg; estado de carga) · `IconButton` · `Kbd` · `Panel`/`PanelHeader`/`PageHeader`/`SectionTitle` · `Badge` · `DataTag` (procedencia: API / estimado / local / N/D) · `Field`/`TextInput`/`Select` · `Segmented` (indicador deslizante, flechas del teclado) · `Tabs` (subrayado deslizante, `role=tablist`) · `Toggle` · `ChipToggle` (capas) · `Stat` · `Meter` (barra que crece) · `InfoTip` (tooltip animado, foco y Escape) · `Disclosure` (plegado animado) · `Drawer` (cajón modal con salida animada y foco gestionado) · `Skeleton` (barrido) · `EmptyState` · `ErrorState` · `Notice` · `KeyValue`.

### Gráficos (`src/components/charts`, `src/components/pitch`)
`TacticalPitch` / `TacticalMap` (mapa) · `ProfileRadar` (radar 0–100 % fijo) · `ProbabilityStrip` (franja apilada GMM) · `ValueScatter` (observado vs. estimado, log-log, diagonal de predicción perfecta, leyenda filtrable) · `ResidualChart` (exceso sobre P95) · `ValueChart` y `ResidualGauge` (reutilizados) · `OpportunityRanking` (dumbbell observado → estimado en escala log común).
Reglas: escalas comunes cuando se compara, ejes que parten de 0 en lineales, `role="img"` con `<title>` descriptivo, tooltips accesibles por foco, puntos navegables con teclado.

### Iconografía
SVG propios con la gramática de Lucide (trazo 1,75 px, retícula 24 px). Se añaden 13 iconos (perfiles, radar, dispersión, residuos, pantalla completa, modos…).

### Logotipo
`src/components/brand/Logo.tsx` usa el **JPG maestro aprobado** (`public/brand/offball-logo.jpg`) sin redibujar ni recolorear: las variantes son recortes (`viewBox`) y un filtro SVG vuelve transparente sólo el fondo verde noche (canal alfa por luminancia; el RGB del blanco y del salvia no cambia).

---

## 4. Mapa táctico interactivo

Archivos: `src/domain/pitch.ts` (lógica pura, testeada) · `src/components/pitch/PitchMarkings.tsx` · `TacticalPitch.tsx` · `TacticalMap.tsx`.

**Campo:** media cancha reglamentaria en metros (68 × 52,5; área 40,32 × 16,5; área pequeña 18,32 × 5,5; punto de penalti a 11 m; arco y círculo central r = 9,15; portería 7,32 × 2,44; córners r = 1). Trazo de grosor constante al hacer zoom. Se adapta al ancho (relación de aspecto fija) y el panel lateral se coloca con *container queries*.

**Representaciones:** «Zonas» (cada rol como un área de color uniforme; la más honesta, por defecto) y «Difuminado» (núcleos gaussianos centrados en cada zona, rasterizados en un `canvas`; en el centro de cada zona el color corresponde a su afinidad).

**Interacción:** hover y foco con tooltip animado (valor, puesto, diferencia frente a reparto uniforme y frente a la comparación) · clic/Intro para seleccionar una zona → panel contextual con detalle · Escape para deseleccionar · zoom con botones, Ctrl/⌘ + rueda y doble clic; arrastre para desplazar; restablecer vista · pantalla completa · contraste (γ) y opacidad · capas (líneas, nombres, valores, mejor/alternativa) · leyenda de intensidad que se reajusta al contraste.

**Comparación:** con otro jugador guardado, con la media de **tus** fichas del mismo perfil dominante (muestra local, n visible) o con el reparto uniforme; en paralelo (zoom sincronizado) o como mapa de diferencias (rampa divergente azul ↔ lima).

**Animación:** las zonas aparecen escalonadas (70 ms) creciendo desde 0; al cambiar de jugador o de comparación los valores se interpolan (700 ms, curva de firma); pulso en la zona seleccionada; tooltips con entrada/salida.

**Integridad (obligatoria):** aviso permanente «Mapa táctico estimado… No son acciones, toques ni posiciones registradas». No hay filtros por tipo de acción ni reproducción cronológica porque **no existen datos** que los respalden. Una zona con nombre desconocido aparece sólo en la lista, nunca se coloca en el campo. «Comparación con la media del clúster» no es posible: la API no publica centroides ni medias por perfil; se ofrece la media local etiquetada como tal.

---

## 5. Modos Esencial y Avanzado

- Selector global en la cabecera (y en el menú móvil); **Esencial por defecto**; preferencia guardada en `localStorage` (`offball.preferencias`).
- Ambos modos usan los mismos componentes, datos y lógica: los componentes leen `useMode()` y muestran u ocultan detalle. No hay dos aplicaciones.
- Cambiar de modo **no** pierde la página, el jugador, los filtros ni la sección; usa una transición de vista (fundido) si el navegador la soporta.

| Pantalla | Esencial | Avanzado añade |
| --- | --- | --- |
| Informe | Tres cifras con contador, frase en lenguaje llano, perfil con frase, radar, mapa | Referencia G01, residuo/umbral/exceso, 5 clústeres con barras y margen, «Detalle técnico» (peticiones y respuestas exactas), exportación JSON |
| Inicio | Error medio en €, captions explicativas | R², F1, guías ×2/×½ en la dispersión, nombre del modelo |
| Mercado | Ranking, tabla y dispersión; CSV de página | Vista Residuos, columnas de exceso y fechas, CSV completo |
| Comparador | Valor, radar, mapas, tabla esencial | Filas técnicas y procedencia |
| Perfiles | Perfiles con lectura llana | Medias locales por perfil, nota K-Means |
| Navegación | 7 entradas | + Rendimiento del modelo, Afinidad rápida |

Si un usuario Esencial abre una página técnica (p. ej. por enlace), la ve con un aviso y un botón para cambiar de modo.

---

## 6. Sistema global de animaciones

Implementación con **CSS + ~150 líneas de hooks** (`src/motion/`). Se descartaron Framer Motion y GSAP: las necesidades (contadores, interpolación de valores, cascadas) no justificaban 40–60 kB extra.

| Regla | Valor |
| --- | --- |
| Curva de firma (80 %) | `cubic-bezier(0.2, 0, 0, 1)` |
| Entradas con énfasis | `cubic-bezier(0.05, 0.7, 0.1, 1)` |
| Salidas | `cubic-bezier(0.3, 0, 1, 1)` (≈ 40 % más cortas que las entradas) |
| Duraciones | 120 ms feedback · 200 ms estado · 320 ms paneles · 520 ms datos · 700 ms mapa |
| Desplazamientos | 4–10 px en entradas; 24 px en paneles laterales |
| Escala | mínimo 0,97 en pulsación; 0,98 en apariciones |
| Escalonado | 45 ms por elemento, máx. 8 (≤ 360 ms) |

Catálogo: transiciones de página y de modo (View Transitions API, con la barra lateral y la cabecera fijas) · cajones, paleta y menú móvil con entrada/salida · indicador deslizante en selectores y pestañas · subrayado animado en la navegación del informe · plegado de secciones y del formulario · contadores numéricos · barras que crecen · radar que se dibuja · dispersiones con puntos que se desplazan al filtrar · ranking en cascada con dumbbells que se extienden · mapa (sección 4) · skeletons con barrido · microinteracción de pulsación (`.press`).

Sólo se animan `transform` y `opacity` (y anchos en barras pequeñas). `prefers-reduced-motion` desactiva animaciones, transiciones, cascadas y transiciones de vista, y los hooks saltan al valor final.

---

## 7. Comparativa visual antes / después

| Antes | Después |
| --- | --- |
| `capturas/antes-01-inicio.jpg` — portada de presentación, tarjetas de acceso, sin datos de mercado | `capturas/despues-01-inicio.jpg` — indicadores, dispersión observado/estimado, ranking de oportunidades |
| `capturas/antes-02-analisis.jpg` — formulario fijo de 400 px y paneles técnicos | `capturas/despues-02-informe.jpg` — informe con cabecera, navegación por secciones, veredicto en lenguaje llano |
| `capturas/antes-03-mapa.jpg` — círculos superpuestos sin interacción | `capturas/despues-03-mapa-zona-seleccionada.jpg`, `-04-mapa-diferencia-avanzado.jpg`, `-05-mapa-paralelo-difuminado.jpg` |
| — | `despues-06-comparador.jpg`, `-07-mercado.jpg`, `-08-perfiles.jpg`, `-09-movil.jpg` |

(Las capturas «antes» se tomaron con un `Logo` provisional, porque el original no compilaba sin él.)

---

## 8. Registro de cambios

**Nuevo**
- `src/motion/` (tokens, hooks, `AnimatedNumber`, `RevealGroup`).
- `src/state/prefs.ts` (modo y preferencias persistentes), `useOpportunities.ts`, `useCatalogActions.ts`.
- `src/domain/pitch.ts`, `profiles.ts`, `comparisons.ts`, `metrics.ts`.
- `src/components/pitch/*`, `charts/ProfileRadar`, `ProbabilityStrip`, `ValueScatter`, `ResidualChart`, `market/OpportunityRanking`, `market/RowDetail`, `layout/CommandPalette`, `ModeSwitch`, `nav.ts`, `brand/Logo.tsx`, `ui/cx.ts`.
- Páginas `Profiles.tsx` y `ModelPerformance.tsx`; rutas `/perfiles` y `/rendimiento`.
- `public/brand/offball-logo.jpg` (maestro aprobado), `package-lock.json`, `tests/redesign.test.ts`.

**Rediseñado**
- `styles/index.css` (tokens v2, utilidades de movimiento, transiciones de vista, reduced-motion).
- `ui/primitives.tsx` (todas las exportaciones previas se conservan; se añaden las nuevas).
- `layout/Shell.tsx`, `App.tsx`, `router.tsx` (View Transitions).
- `pages/Home`, `Analyze`, `Market`, `Compare` reescritas; `Positional`, `Tracking`, `Methodology` adaptadas.
- `analysis/Economic.tsx` (veredicto + detalle), `analysis/Positional.tsx` (lectura de perfil + mapa).

**Eliminado**
- `charts/MarketScatter.tsx` (sustituido por `ValueScatter`); `PitchAffinity` e `IntensityLegend` (sustituidos por el mapa nuevo).

**Corregido**
- Build roto por `Logo` ausente; errores de tipos en `PlayerForm`.

---

## 9. Comprobaciones realizadas (26 nov 2026)

| Comprobación | Antes | Después |
| --- | --- | --- |
| `npm run typecheck` | ✖ 4 errores (Logo ausente, `PlayerForm`) | ✔ sin errores |
| `npm run test` | ✔ 55/55 | ✔ 69/69 (55 originales intactos + 14 nuevos) |
| `npm run build` | ✖ falla | ✔ JS 467 kB (141 kB gzip), CSS 70 kB (12 kB gzip) |
| Consola del navegador (todas las rutas) | — | ✔ sin errores ni avisos |
| Desbordamiento horizontal a 375 px (10 rutas) | — | ✔ ninguno |
| Flujos recorridos en el navegador | — | inicio · análisis completo del ejemplo · guardar · segunda ficha · mapa (hover, selección, difuminado, ajustes, paralelo, diferencia) · cambio de modo conservando estado · perfiles · comparador · mercado · buscador Ctrl+K |

Tests nuevos: integridad del mapa (no inventa zonas, geometría dentro del campo reglamentario, campo = afinidad en el centro de cada zona, sin datos → 0), escala fija y monótona, zoom acotado, preferencias tolerantes (Esencial por defecto), perfiles mixtos, colores estables, media de grupo etiquetada como local, frases sin certezas, selección de métricas.

**No verificado:** integración con la OFFBALL API real (no accesible desde este entorno; se usó una API simulada externa), `docker build`, lectores de pantalla reales, Safari/Firefox (revisado en Chromium).

---

## 10. Limitaciones detectadas

1. **No hay datos espaciales.** El mapa es una representación estimada de 4 afinidades. Un mapa de calor real requeriría eventos con coordenadas (p. ej. `x, y, tipo, minuto`) por jugador.
2. **K-Means:** la API no expone asignaciones ni métricas → no hay comparación GMM vs. K-Means en la interfaz (se explica en Perfiles y Metodología).
3. **Media del clúster:** no publicada; se usa la media de las fichas guardadas del mismo perfil, etiquetada como local.
4. **Estadísticas para el radar:** sólo existen goles/90, asistencias/90, minutos, edad y altura, sin distribuciones de liga; un radar estadístico con percentiles sería engañoso. El radar muestra probabilidades GMM (misma escala).
5. **Distribución de jugadores por perfil:** la API no publica el conjunto de entrenamiento; Inicio y Perfiles cuentan sólo tus análisis guardados.
6. **Catálogo:** sin goles, asistencias, altura ni pie → sin perfil ni mapa para filas de mercado. La muestra del inicio son las 100 primeras filas que devuelve el servidor.
7. **Residuos de test e intervalos de predicción:** no publicados; no se dibujan.
8. **Fotografías, clubes, biografías:** no existen en los datos; no se muestran ni se inventan.

---

## 11. Ejecución y despliegue

Sin cambios respecto al README (puerto 5173, proxy o modo directo, Docker con nginx).

```bash
npm install          # usa el package-lock.json incluido
npm run dev          # http://localhost:5173 (necesita OFFBALL API en :8000 o el proxy)
npm run verify       # tipos + tests + build
npm run build        # dist/ listo para nginx o cualquier hosting estático SPA
```

Para integrar en el repositorio del equipo: revisar la rama `rediseno/ux-ui` y fusionarla en la rama principal cuando el equipo lo apruebe. No se ha hecho push ni despliegue.
