# OFFBALL_FRONTEND · Football Intelligence

Frontend de scouting de OFFBALL, conectado a **OFFBALL API v0.1.0**. React 19 + TypeScript + Vite + Tailwind CSS v4. Interfaz en español.

Responde tres preguntas con la API como autoridad de cálculo:

1. **¿Cuánto estima el modelo que vale un jugador?** Estimación G02 (logarítmica) y referencia G01 (directa).
2. **¿Hay señal de posible infravaloración?** Residuo logarítmico frente al umbral P95 (requiere valor observado).
3. **Si es ofensivo, ¿qué perfil y qué afinidad posicional muestra?** GMM K=5 y afinidad relativa por zona.

No es un sistema que garantice rentabilidad, precio de traspaso ni rendimiento.

---

## 1. Puesta en marcha local (con el backend Docker ya existente)

Estructura esperada:

```
OFFBALL_MASTER/
├── OFFBALL_API/        ← backend existente (no se modifica)
└── OFFBALL_FRONTEND/   ← esta carpeta
```

**Requisitos:** Node.js ≥ 20.19 y npm.

```bash
# 1) Backend (como ya lo arrancáis), publicado en el puerto 8000
#    y permitiendo el origen del frontend:
#    OFFBALL_ORIGINS=http://localhost:5173,http://127.0.0.1:5173   (es el valor por defecto del backend)

# 2) Frontend
cd OFFBALL_MASTER/OFFBALL_FRONTEND
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev                   # http://localhost:5173  (strictPort: falla si 5173 está ocupado)
```

Comprobación rápida: la barra lateral debe mostrar **API conectada** y el corte de datos **12 jun 2026**. En *Analizar jugador → Cargar ejemplo ficticio → Analizar* se ejecutan las peticiones de prueba del anexo contra tu API.

### Modo proxy (mismo origen, sin CORS)

```env
VITE_API_BASE_URL=
VITE_DEV_PROXY_TARGET=http://localhost:8000
```

Vite reenvía `/api/*` y `/health` al backend; el navegador sólo ve `http://localhost:5173`.

### Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en 5173 |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve `dist/` en 5173 |
| `npm run test` | Tests (Vitest) |
| `npm run typecheck` | Comprobación de tipos (TypeScript estricto) |
| `npm run verify` | typecheck + tests + build |

---

## 2. Docker (frontend)

La imagen compila la app y la sirve con nginx, que hace de **proxy de mismo origen** hacia la API. El navegador nunca intenta resolver un hostname interno de Docker: sólo habla con `localhost:5173`, y es nginx (dentro del contenedor) quien llega al backend.

```bash
docker build -t offball-frontend .

# Backend publicado en el puerto 8000 del host:
docker run --rm -p 5173:80 \
  -e OFFBALL_API_UPSTREAM=http://host.docker.internal:8000 \
  offball-frontend
# Linux: añade  --add-host=host.docker.internal:host-gateway
```

Abre `http://localhost:5173`. Con proxy de mismo origen no hace falta CORS; si en su lugar compilas con `--build-arg VITE_API_BASE_URL=https://api.tudominio.com`, configura `OFFBALL_ORIGINS` del backend con el dominio real del frontend (nunca `*`).

`docker/docker-compose.example.yml` muestra cómo levantar ambos servicios en una red interna sin exponer el backend; ajusta el servicio `api` a cómo construís hoy OFFBALL_API.

---

## 3. Pantallas

> Rediseño UX/UI v0.2.0: ver **[docs/REDISENO.md](docs/REDISENO.md)** (auditoría, sistema de diseño, mapa táctico, modos, animaciones, comprobaciones y limitaciones).

Selector global **Esencial / Avanzado** (Esencial por defecto, preferencia guardada). Buscador global con **Ctrl/⌘ + K** o «/».

| Ruta | Pantalla | Endpoints | Modo |
| --- | --- | --- | --- |
| `/` | Centro de scouting: indicadores, observado vs. estimado, ranking de oportunidades, perfiles, modelo | `GET /health`, `GET /api/v1/metadata`, `GET /api/v1/oportunidades` | Ambos |
| `/analizar` | **Informe de jugador**: veredicto, valor, perfil GMM, mapa táctico estimado, detalle técnico | `POST /api/v1/valoracion` + `POST /api/v1/afinidad` (sólo DC, SD, EI, ED, MCO) | Ambos |
| `/mercado` | Mercado: ranking, tabla, valor vs. estimado, residuos; filtros del servidor, CSV | `GET /api/v1/oportunidades` | Ambos (residuos y CSV completo en Avanzado) |
| `/comparador` | 2–3 fichas: valor en escala común, radar superpuesto, mapas en paralelo, tabla | — (resultados ya calculados) | Ambos |
| `/perfiles` | Los cinco perfiles GMM y tus jugadores analizados en goles/90 × asistencias/90 | `GET /api/v1/metadata` + seguimiento local | Ambos |
| `/seguimiento` | Candidatos, notas, exportar/importar, similitud local | — (localStorage) | Ambos |
| `/rendimiento` | Métricas de test de los modelos de regresión | `GET /api/v1/metadata` | Avanzado |
| `/posicional` | Afinidad rápida (sólo perfil y mapa) | `POST /api/v1/afinidad` | Avanzado |
| `/metodologia` | Modelos, integridad de datos, perfiles, zonas, límites | `GET /api/v1/metadata` | Ambos |

### Reglas de contrato aplicadas

- **Payloads exactos y sin campos extra** (`extra='forbid'`). Valoración y afinidad se construyen por separado. El nombre del jugador es local y nunca se envía. `market_value_in_eur` y `foot` se omiten si están vacíos.
- **Códigos originales** en el payload (`Attack`, `Centre-Forward`, `ES1`…); etiquetas en español sólo en pantalla. Catálogos desde `metadata`; si aún no ha respondido, respaldo del contrato v0.1.0 (se indica en la UI).
- **Validación inmediata compatible con Pydantic**: rangos, `minutos ≤ partidos × 90`, cierre 1–365 días antes de la valoración, fecha no futura, subposición compatible, competición observada. Aviso (sin bloquear) si la valoración es posterior al corte.
- **Éxito parcial**: si falla una de las dos peticiones, la otra se muestra igualmente.
- **Porteros, defensas y medios no ofensivos**: no se llama al GMM; se explica por qué.
- **Porcentajes**: `diferencia_pct` ya viene en 0–100; probabilidades y afinidades (0–1) se multiplican por 100 **una sola vez** (`fractionToPct`).
- **P95**: “Posible infravaloración” / “Sin alerta según P95” / “No evaluada”. No se convierte en probabilidad ni se inventan intervalos.
- **Mercado**: por defecto sólo vigentes en el corte; históricos sólo con conmutador explícito. El vacío por defecto se explica como limitación del catálogo (`n_candidatos = 0`), no como fallo.
- **Errores**: sin conexión, timeout, cancelación de peticiones obsoletas, reintento manual, 422 con `detail` lista o string traducido al español. **Nunca** se rellenan datos simulados.

### Mapa táctico estimado

Media cancha reglamentaria en metros (SVG + canvas), ataque hacia arriba. Visualiza **sólo** las cuatro afinidades de `/afinidad` (DC, EI, ED, MCO): cada zona es el área convencional de ese rol, coloreada con una **escala fija** 0–100 % (v^γ, γ = 0,5 por defecto). Modos «Zonas» y «Difuminado»; hover, selección con panel contextual, zoom/desplazamiento, pantalla completa, capas, contraste, opacidad y comparación (otro jugador, media local del mismo perfil o reparto uniforme; en paralelo o como diferencia). Siempre etiquetado como **estimado**: no hay eventos ni coordenadas en la API. Una zona no reconocida aparece en la lista pero no se coloca en el campo.

### Similitud local (exploración)

No hay endpoint de similitud en v0.1.0. En Seguimiento, “Similares (local)” compara **sólo análisis manuales guardados y completos** (goles/90, asistencias/90, altura, edad, minutos), estandarizados con z-score sobre el propio conjunto y distancia euclídea. Requiere ≥ 3 fichas completas, no imputa faltantes y no es una predicción GMM ni una recomendación validada.

---

## 4. Arquitectura

```
src/
├── api/          cliente único (timeout, abort, errores), tipos del contrato, guards
├── domain/       lógica pura y testeable: formulario/validación/payload, análisis,
│                 mercado/CSV, comparador, zonas y escala, formato es-ES, similitud
├── state/        conexión (health + metadata), almacenamiento local versionado, preferencias (modo)
├── router/       enrutador mínimo sobre History API (sin dependencia)
├── motion/       tokens de movimiento y hooks (contadores, interpolación, cascadas)
├── components/   ui (design system), layout, charts y pitch (SVG/canvas propios), market, analysis, brand (logo)
├── pages/        una página por ruta
└── styles/       tokens Tailwind v4 (@theme)
tests/            Vitest: payloads, porcentajes, filtros, persistencia, errores, posiciones
```

Decisiones:

- **Sin dependencias gráficas ni de router**: gráficos, campo e iconos son SVG propios (iconos con la gramática de Lucide: trazo 1,75 px, retícula 24 px; sustituibles 1:1 por `lucide-react`).
- **Tipografías autoalojadas** con `@fontsource` (Montserrat, Inter, IBM Plex Mono): sin CDN externo.
- **Persistencia**: `localStorage` con clave `offball.seguimiento` y `version: 1`. Una versión incompatible se respalda y no se pierde. Las fichas de catálogo usan identidad `player_id + valuation_date` para no duplicarse.
- **Ejemplo ficticio**: `src/domain/example.ts` contiene únicamente la petición de prueba del anexo, etiquetada como ficticia; se envía a la API real.

---

## 5. Identidad visual

- **Logotipo:** `src/components/brand/Logo.tsx` muestra el **JPG maestro aprobado** (`public/brand/offball-logo.jpg`) sin redibujarlo ni recolorearlo; las variantes (lockup, wordmark, isotipo) son recortes y un filtro SVG vuelve transparente sólo su fondo. Nota: las carpetas `brand/logo/` y `brand/guia/` y el componente `Logo.tsx` original citados en versiones anteriores de este README **no venían en el zip recibido**; si existen en vuestro repositorio, `Logo.tsx` puede apuntar a los SVG vectorizados sin cambiar ningún otro archivo.
- Favicon y apple-touch-icon en `public/`.
- Tokens en `src/styles/index.css` (Design System v2, ver `docs/REDISENO.md` §3). Los colores de datos (Lime, Blue, Gold, Lavender) tienen significado fijo y nunca se aplican al logotipo. Coral sólo para errores. Paleta categórica p0–p4 para los perfiles GMM y rampa heat-0…5 para el mapa.

---

## 6. Verificación

Estado verificado el 26 nov 2026 en la rama `rediseno/ux-ui` (detalle en `docs/REDISENO.md`, sección 9):

- `npm run verify` en verde: tipos sin errores, 69 tests, build de producción.
- `package-lock.json` incluido.
- Recorrido en Chromium (escritorio y 375 px) contra una API simulada **externa** al proyecto: sin errores de consola ni desbordamiento horizontal.

**Pendiente de verificar en vuestra máquina:** integración con la OFFBALL API real, `docker build`, Safari/Firefox y lectores de pantalla.

**Ampliaciones que requieren la API:** eventos espaciales para un mapa de calor real, asignaciones K-Means, medias por clúster, distribuciones de liga para percentiles, endpoint de similitud e importación masiva CSV.
