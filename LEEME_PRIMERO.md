# OFFBALL v0.4.2 — Informe individual e introducción

## Actualización desde v0.4.1 (Windows)
1. Extraer el ZIP completo en una carpeta nueva.
2. Abrir Docker Desktop. La nueva configuración usa expresamente el mismo nombre de proyecto `offball_v040` de la instalación anterior, para mantener su volumen de datos y evitar un segundo frontend en el puerto 5173. Si tu instalación anterior usa otro nombre, comprueba el nombre del volumen antes de actualizar.
3. En PowerShell, desde la carpeta extraída que contiene `compose.yaml`, ejecutar `docker compose up -d --build --wait --wait-timeout 180`. Alternativamente ejecutar `INICIAR_OFFBALL.cmd`.
4. Entrar en http://localhost:5173 y pulsar Ctrl+F5. `docker compose ps` muestra ambos servicios; el frontend espera a la API saludable. No ejecutar `docker compose down -v` ni borrar los volúmenes.

## Novedades v0.4.2
- En Mercado, hacer clic en el nombre de un jugador (o pulsar «Analizar ficha») abre un informe con seis pantallas: resumen, valor de mercado, rendimiento, perfil GMM, mapa táctico y ficha técnica. También se accede desde el ranking y la lista de guardados.
- Nuevo endpoint GET `/api/v1/mercado/ficha` que consulta el registro seleccionado y conserva sus resultados originales; no modifica ni reentrena modelos. Los históricos muestran datos disponibles y N/D para el resto. Los importados presentan su valoración y perfil calculados, cuando existen.
- Introducción animada en la página inicial una vez por sesión de pestaña, con avance automático cada 6,5 s durante las primeras dos pantallas, pausa, avance manual y elección final de modo. «◆ Ver intro» en la cabecera permite reproducirla cuando se quiera. Respeta la preferencia de movimiento reducido (avance manual por defecto).
- Se conserva el proyecto Docker `offball_v040` y su volumen, así como las claves de plantilla y guardados del navegador. No borrar volúmenes ni almacenamiento local.

## Funcionalidades conservadas de v0.4.1
- Mercado: guardar una ficha o toda la página, probar en laboratorio, incorporar a plantilla. Seguimiento contiene una lista persistente de fichajes; se deduplica por fuente e ID y guarda la valoración más reciente cuando se vuelve a guardar.
- Mi plantilla: selección múltiple de guardados; rellenar puestos compatibles que estén libres sin eliminar titulares. Importar y exportar JSON o CSV, actualizar por ID, cargar once ficticios de demostración. Ejemplos en `ejemplos/PLANTILLA_CLUB_DEMO.*`. Los jugadores importados del mercado conservan sus estadísticas cuando están disponibles; el catálogo histórico no las contiene y queda pendiente de completar (0 minutos de evaluación).
- Laboratorio: carga la alineación propia, ofrece recomendaciones por puesto, presupuesto, nombre opcional, alertas económicas y guardados; simula hasta tres candidatos. Seleccionar candidato lo guarda en la lista. Para los jugadores históricos sin perfil GMM solo se simula la posición declarada. Los perfiles importados calculados por la API mantienen sus afinidades reales del modelo. No son posiciones observadas ni predicción de rendimiento colectivo.
- Docker: arranque coordinado con healthcheck de API y reinicio limitado del frontend en caso de fallo.

## Verificación y límites v0.4.2
- 20/20 pruebas de API con modelos de prueba superadas, incluyendo consulta exacta histórica e importada, ausencia de ficha y fechas no coincidentes.
- 87 archivos TypeScript/TSX revisados sintácticamente (transpilación, no comprobación completa de tipos). `npm ci --offline` no ha podido completarse por una dependencia ausente de la caché. El Dockerfile ejecutará `npm run verify` (tipos, Vitest y compilación) en el equipo del usuario. No se ha validado la interfaz en navegador ni se han ejecutado los modelos reales en este entorno.
- No se reentrenan ni modifican los modelos. Las afinidades son estimadas, no tracking de partido. Los datos históricos no contienen las estadísticas necesarias para calcular un GMM individual. Las señales económicas no acreditan disponibilidad de fichaje.
