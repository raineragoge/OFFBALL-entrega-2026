# OFFBALL. — Football Intelligence

![Arquitectura](docs/figuras/arquitectura.png)

**Ver lo que otros no ven.** Proyecto académico de Inteligencia Artificial y Big Data · Cebanc · noviembre de 2026. Equipo: Carmelo Beato, Igor y Byron.

OFFBALL ayuda a los clubes profesionales con presupuestos ajustados a explorar perfiles deportivos y estimar el valor de mercado de futbolistas. Es una herramienta de apoyo al scouting: una señal económica no acredita una ganga, un precio de traspaso ni la disponibilidad del jugador.

## Versión entregada: v0.4.2 · cierre técnico del 27/11/2026

- GMM extendido de cinco componentes (14 ligas): perfiles de jugadores ofensivos.
- G02: Random Forest con objetivo logarítmico, seleccionado por su rendimiento en jugadores económicamente accesibles; G01 se conserva como referencia directa.
- API FastAPI/Pydantic, frontend React/TypeScript/Vite, Docker Compose.
- Big Data: Hadoop/HDFS, Hive, arquitectura Bronze/Silver/Gold y Parquet.

## Ejecutar la aplicación

Requisitos: Docker Desktop (o Docker Engine con Compose v2), conexión para descargar las imágenes y dependencias, y los ocho artefactos originales en `OFFBALL_API/assets/`. Estos artefactos no se suben al repositorio hasta verificar los derechos de redistribución. El paquete local del equipo ya contiene los archivos; al clonar el repositorio, deben restaurarse desde una copia autorizada. Véase [preparación de assets](OFFBALL_API/README.md). No cargar Joblib de procedencia desconocida.

Desde la raíz, en PowerShell:

```powershell
python scripts/verificar_assets.py
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
```

Abrir <http://localhost:5173>. En esta configuración, el frontend hace de proxy de la API; documentación OpenAPI: <http://localhost:5173/docs> solo si el proxy la expone. Para Swagger directo usar el override local descrito abajo. Para probar, abrir Analizar jugador → Cargar ejemplo ficticio → Analizar.

```powershell
docker compose -f compose.yaml -f compose.swagger.local.yaml up -d --build --wait --wait-timeout 180
```

Swagger: <http://127.0.0.1:8000/docs>. El puerto queda enlazado a localhost. Para detener los servicios: `docker compose down` (sin `-v`, para conservar los datos). El nombre del proyecto Docker se mantiene como `offball_v040` para preservar la compatibilidad con la entrega original. No exponer el servicio directamente a Internet: no incorpora autenticación ni protección contra abuso.

## Estructura

| Carpeta | Contenido |
|---|---|
| `OFFBALL_API/` | API, validación, inferencia, pruebas y manifiesto de assets |
| `OFFBALL_FRONTEND/` | Interfaz, pruebas, configuración y documentación de rediseño |
| `notebooks/` | Código de los ocho notebooks originales, sin salidas con datos de jugadores |
| `experimentos/mlflow_historico/` | Código recuperado de un artefacto MLflow y resultados de una fase previa |
| `resultados/` | Métricas agregadas, comparación de modelos y verificación de datos |
| `docs/` | Figuras y pruebas con entradas ficticias |
| `ejemplos/` | Entradas ficticias y plantillas de demostración |
| `infra/hadoop/` | Configuración HDFS, ingesta, conversión Parquet y consultas Hive |
| `experimentos/mlflow_final/` | Guía de registro y Serving, trazabilidad y monitorización |
| `docs/cierre-2026-11-27/` | Evidencias y balance técnico final |
| `resultados/cierre-2026-11-27/` | Métricas agregadas finales y recuentos verificados |
| `entrega_local/` | Informe, presentación, evidencias, notebooks ejecutados y material reservado; excluido de Git |

## Pruebas y evidencias

En la comprobación local del 26/11/2026 se documentaron 78 pruebas de frontend y 2 pruebas de integración con modelos reales superadas. Se observaron respuestas HTTP 200 para valoración y afinidad y HTTP 422 al enviar una entrada inválida. La interfaz puede mostrar «API parcial» por una incompatibilidad de metadatos, sin que ello invalide las inferencias verificadas. Los resultados históricos no representan fichajes disponibles actualmente. El mapa táctico representa afinidad estimada, no tracking real de partido.

- [Pruebas API](docs/pruebas/)
- [Métricas de los modelos finales](resultados/modelos_finales/metricas_test.csv)
- [Experimentos MLflow históricos](experimentos/mlflow_historico/)
- [Documentación de la API](OFFBALL_API/README.md)
- [Documentación del frontend](OFFBALL_FRONTEND/README.md)

## Reproducibilidad y límites

Las dependencias de la API están fijadas en `OFFBALL_API/requirements.txt` (Python 3.11, scikit-learn 1.6.1, PyArrow 19.0.1). El frontend usa `package-lock.json`. El manifiesto SHA-256 permite verificar los ocho artefactos locales sin deserializarlos. Los notebooks conservan el código original y pueden requerir adaptar las rutas de Colab y aportar el dataset autorizado. No están incluidos los notebooks de entrenamiento definitivos K5/G02 si no constaban en los materiales recibidos; sí están los modelos, configuración y resultados disponibles. No se afirma que el reentrenamiento completo se haya reproducido aquí.

El 27/11 se importaron 56 ejecuciones archivadas al tracking local, se registraron GMM K5 y G02 como versión 2 con alias `definitivo` y se comprobó MLflow Serving de G02 (HTTP 200). La monitorización histórica compara 2024 frente a 2025; no equivale a una nueva ingesta de producción. Hadoop 3.3.6 y Hive 4.0.0 se verificaron en Docker con volúmenes HDFS persistentes, cinco tablas externas Parquet y MapReduce local. Véanse [cierre técnico y evidencias](docs/cierre-2026-11-27/README.md), [reproducción Hadoop/Hive](infra/hadoop/README.md) y [MLflow](experimentos/mlflow_final/README.md).

## Datos y acceso

La fuente de datos deportivos es Transfermarkt. La disponibilidad pública de los datos no implica permiso de redistribución, entrenamiento o uso comercial. No se incluyen historiales médicos privados. El catálogo, los modelos derivados, los datasets y los documentos con datos personales deben gestionarse por un canal autorizado; no subirlos automáticamente a un repositorio público. No se concede licencia sobre contenidos de terceros.

## Entrega académica

La memoria final, las reflexiones individuales, la Skill exportada y los artefactos sujetos a autorización se entregan por el canal del centro. Este repositorio contiene código público, configuración, resultados agregados y evidencias técnicas. El material local no se publica por defecto.
