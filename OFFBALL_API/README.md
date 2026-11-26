# OFFBALL API · 0.1.0

Backend local de scouting para la carpeta OFFBALL_MASTER. No requiere MongoDB ni Colab para servir las predicciones. No reentrena los modelos. Incluye FastAPI, Pydantic v2 y los artefactos originales de las etapas 02 y 05.

## 1. Arranque en Windows (PowerShell)

La carpeta `OFFBALL_API` ya está integrada en `OFFBALL_MASTER`. Abre una terminal en ella o utiliza `INICIAR_API_WINDOWS.cmd` desde la raíz. Se recomienda Python 3.11 de 64 bits.

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Abrir http://127.0.0.1:8000/docs (Swagger UI). `/health` confirma que se han cargado los tres modelos y el catálogo. No hay que activar el entorno virtual. La versión de scikit-learn debe ser exactamente 1.6.1, como en los notebooks; la API bloquea versiones diferentes. El resto de dependencias son versiones propuestas y fijadas para el servicio, no una reproducción verificada del entorno original de Colab. Alternativa: `docker build -t offball-api .` y `docker run --rm -p 127.0.0.1:8000:8000 offball-api` (Dockerfile incluido, no construido en este entorno).

## 2. Endpoints

| Método | Ruta | Función |
|---|---|---|
| GET | /health | Comprobar servicio |
| GET | /api/v1/metadata | Variables, categorías admitidas, perfiles, métricas y zonas |
| POST | /api/v1/valoracion | G02 logarítmico y G01 de referencia; señal P95 según posición y rango |
| POST | /api/v1/afinidad | Cinco perfiles GMM y afinidad DC/ED/EI/MCO |
| GET | /api/v1/oportunidades | Catálogo histórico, filtros y paginación |

Ejemplo de valoración (datos ficticios; no representa un jugador real):

```json
{"age":23,"position":"Attack","sub_position":"Centre-Forward","competition_id":"ES1","partidos":30,"minutos":2100,"goles":12,"asistencias":5,"market_value_in_eur":750000,"fin_temporada":"2025-05-25","valuation_date":"2025-12-12"}
```

Usar la última temporada cerrada de liga anterior a la valoración (1–365 días). Se rechazan entradas con categorías desconocidas, incoherencias de posición, menos de 450 minutos o edad fuera de 15–45 años. El valor observado es opcional: si falta, se predice valor, pero no se calcula alerta. Los límites defensivos adicionales del formulario (100 partidos, 10.000 minutos, altura 140–220 cm) son decisiones de implementación, no umbrales aprendidos.

Ejemplo de afinidad:

```json
{"position":"Attack","sub_position":"Centre-Forward","minutos":2100,"goles":12,"asistencias":5,"height_in_cm":181,"foot":"right"}
```

Las probabilidades GMM y puntuaciones de afinidad están en [0,1]. La interfaz puede multiplicarlas por 100. La afinidad usa la fórmula del notebook 02 (mezcla, factor por pie y corrección por frecuencia). Si no se conoce el pie, omitirlo o usar `null` para aplicar factor neutro. No son coordenadas de movimiento ni probabilidades de éxito. La posición alternativa es la segunda puntuación más alta.

Búsqueda: `/api/v1/oportunidades?presupuesto=5000000&edad_max=25&minutos_min=900&incluir_no_vigentes=true`. Presupuesto exclusivo, como en el notebook. Por defecto solo incluye alertas vigentes respecto al corte histórico 2026-06-12. El catálogo general no tiene candidatos que cumplan todos los requisitos con presupuesto inferior a 5 M€; un resultado vacío es válido. Activar `incluir_no_vigentes` para estudiar alertas históricas claramente identificadas. No presentar el catálogo como disponibilidad actual. Las ocho alertas de la regresión ofensiva extendida pertenecen a otro experimento y no se mezclan con este catálogo.

## 3. Reproducibilidad y GitHub

Los assets incluidos son copias exactas de `OFFBALL_05_Regresion_General.zip` y `OFFBALL_02_Clustering_EXTENDIDO_K5.zip`. Si faltan, recuperarlos así (ajustar rutas a la ubicación real):

```powershell
py -3.11 preparar_assets.py --general "..\datos\etapas\OFFBALL_05_Regresion_General.zip" --clustering "..\datos\etapas\OFFBALL_02_Clustering_EXTENDIDO_K5.zip"
```

Se verifican los hashes de los ocho archivos antes de escribirlos. Si se reentrenan los modelos, se debe versionar la nueva configuración y generar un nuevo manifiesto; no reemplazar silenciosamente las referencias. `.gitignore` excluye los assets de Git hasta verificar permisos de redistribución de datos y modelos. Nunca cargar Joblib de terceros no confiables. CORS solo admite localhost:5173 por defecto; configurar `OFFBALL_ORIGINS` con los orígenes reales al desplegar. No se han añadido autenticación ni controles de abuso; no publicar directamente como servicio abierto.

## 4. Verificación y límites

En el entorno de desarrollo se ejecutaron 13 pruebas unitarias/HTTP con dobles de modelo y configuración/calibración originales. La prueba con modelos reales quedó omitida debido a scikit-learn 1.8.0 frente a 1.6.1 y ausencia de PyArrow. El arranque con artefactos reales debe comprobarse con las dependencias anteriores antes de conectar la interfaz. El servicio no verifica externamente si la temporada aportada está cerrada. No hay métricas específicas de porteros o defensas, ni garantía de que una alerta sea una oportunidad real. Pendientes: integración real, interfaz de mapa de afinidad, comparador y búsqueda por similitud.

**Actualización 25/11/2026:** construcción Docker y pruebas manuales de `/health`, `/api/v1/valoracion`, `/api/v1/afinidad` y `/api/v1/oportunidades` superadas con los modelos reales en el equipo del compañero. Prueba de integración del frontend pendiente.
