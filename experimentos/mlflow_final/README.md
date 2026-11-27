# MLflow · registro final
MLflow 3.18.0, SQLite persistida en /offball/runs/verified/mlflow.db; entorno de inferencia scikit-learn 1.6.1, numpy 2.2.6, scipy 1.15.3, pandas 2.2.3 y joblib 1.4.2.

El tracking histórico y las bases archivadas se conservaron. La importación usó MlflowClient, con respaldo SQLite, comprobación de parámetros, historial de métricas y estado de cada run, y tags offball.source_run_id, offball.source_db y offball.import_complete. Se copiaron los artefactos disponibles. Las versiones definitivas se registraron sin fit: extracción del pipeline GMM y del estimador G02, predicción de prueba, serialización cloudpickle con signature e input_example, comprobación de predicción tras recarga, alias definitivo. Usar exclusivamente modelos Joblib/cloudpickle propios y de confianza.

## Reabrir servidor con el respaldo local autorizado
Desde el directorio que contiene runs/verified/mlflow.db y los artefactos referenciados en esa base:
```powershell
docker run -d --name offball-mlflow -p 127.0.0.1:5000:5000 -v "${PWD}:/offball" ghcr.io/mlflow/mlflow:v3.18.0 mlflow server --backend-store-uri sqlite:////offball/runs/verified/mlflow.db --host 0.0.0.0 --port 5000 --workers 1
```
Si el contenedor ya existe, usar docker start offball-mlflow en vez de crearlo de nuevo. El respaldo debe incluir las rutas de artefactos, no solo SQLite. No se distribuye la base ni los modelos de terceros en este repositorio.

## Serving G02
En el contenedor utilizado durante la sesión se preparó /opt/offball-venv con las versiones indicadas y uvicorn compatible. En una copia nueva, crear el entorno equivalente antes de servir.
```powershell
docker exec -e PATH=/opt/offball-venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin -e MLFLOW_TRACKING_URI=sqlite:////offball/runs/verified/mlflow.db -e MLFLOW_REGISTRY_URI=sqlite:////offball/runs/verified/mlflow.db -e OMP_NUM_THREADS=1 -e OPENBLAS_NUM_THREADS=1 offball-mlflow /opt/offball-venv/bin/python -m mlflow models serve -m "models:/OFFBALL_regression@definitivo" --env-manager local --host 127.0.0.1 --port 5003 --workers 1
```
En otra consola:
```powershell
@'
import requests
datos={"dataframe_records":[{"age":24.0,"partidos":25.0,"minutos":1800.0,"goles_por90":0.3,"asistencias_por90":0.2,"position":"Attack","sub_position":"Centre-Forward","competition_id":"ES1"}]}
r=requests.post("http://127.0.0.1:5003/invocations",json=datos,timeout=30)
print("HTTP:",r.status_code)
print(r.text)
r.raise_for_status()
'@ | docker exec -i offball-mlflow /opt/offball-venv/bin/python -
```
Resultado observado: HTTP 200, {"predictions":[7170882.919395378]}. La prueba corresponde a G02; la carga y las probabilidades del pipeline GMM K5 se verificaron al registrar, no mediante una segunda prueba HTTP. FastAPI es un servicio separado.

## Drift
Se compararon los lotes históricos de valoraciones de 2024 y 2025, solo G02, excluyendo 2026 incompleto. PSI para las ocho variables de entrada (umbrales orientativos 0,10 y 0,25), KS para variables numéricas y métricas de error/recall por año. El PSI máximo fue 0,00498 y el MAE aumentó aproximadamente 7,15 %. Esto apoya mantener y monitorizar el modelo, revisar errores por segmento y plantear reentrenamiento si la degradación persiste. No equivale a una segunda ingesta real ni demuestra causalidad.

[Capturas y métricas](../../docs/cierre-2026-11-27/README.md).

## Scripts de importación y registro utilizados
- [importar_offball.py](importar_offball.py): importar las cuatro bases archivadas en la base histórica local.
- [registrar_offball.py](registrar_offball.py): prevalidar y registrar GMM K5 y G02 sin volver a entrenar.

Requieren restaurar la estructura local original, con las cuatro carpetas bajo `/offball/experimentos_definitivos/`, los modelos propios de confianza y la base histórica `/offball/runs/verified/mlflow.db`. Copiar ambos scripts a la raíz del directorio montado como `/offball`. Antes de ejecutar, verificar que todos los datos de entrada están autorizados y conservar una copia íntegra del tracking y sus artefactos. No ejecutar simultáneamente otros procesos que escriban en la base.

```powershell
docker exec offball-mlflow /opt/offball-venv/bin/python /offball/importar_offball.py
docker exec offball-mlflow /opt/offball-venv/bin/python /offball/registrar_offball.py
```

En la sesión se registraron las versiones 2 por existir ya una versión 1 histórica; en otra base el número de versión depende de las versiones existentes. El alias es la referencia estable de selección. El importador y el registro no deben usarse como migraciones generales de cualquier esquema SQLite de MLflow.
