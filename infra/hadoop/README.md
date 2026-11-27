# Hadoop y Hive · reproducción local
Configuración empleada el 27/11/2026. Requiere Docker Desktop/Compose v2 y los CSV/Parquet de la copia autorizada. Ejecutar desde esta carpeta; el proyecto Compose se denomina hadoop (red hadoop_default). No compartir datos de terceros.

## Primera inicialización (solo volúmenes nuevos y vacíos)
```powershell
docker compose pull
docker compose run --rm --no-deps --user root --entrypoint /bin/sh namenode -c "chown -R hadoop /tmp/hadoop-hadoop/dfs/name && chmod 700 /tmp/hadoop-hadoop/dfs/name"
docker compose run --rm --no-deps --user root --entrypoint /bin/sh datanode -c "chown -R hadoop /tmp/hadoop-hadoop/dfs/data && chmod 700 /tmp/hadoop-hadoop/dfs/data"
docker compose run --rm --no-deps namenode ls -la /tmp/hadoop-hadoop/dfs/name
```
Confirmar que está vacío ANTES de formatear. Nunca formatear un NameNode ya inicializado ni usar down -v con datos que se quieran conservar.
```powershell
docker compose run --rm --no-deps namenode hdfs namenode -format -nonInteractive
docker compose up -d
docker compose exec namenode hdfs dfsadmin -report
docker compose exec namenode hdfs dfsadmin -safemode get
```
Esperar un DataNode vivo y modo seguro OFF. Interfaz NameNode: http://127.0.0.1:9870.

## Ingesta y conversión
Los CSV de Bronze se copiaron desde las copias limpias verificadas; no es una nueva extracción. Usar un directorio con appearances.csv, players.csv, clubs.csv, games.csv y player_valuations.csv.
```powershell
$raw = "$HOME\Downloads\DataLimpio"
$silver = "$HOME\Downloads\OFFBALL_Silver"
New-Item -ItemType Directory -Force $silver | Out-Null
.\ingesta.ps1 -Capa raw -Origen $raw
docker run --rm --memory 1g --cpus 1 --entrypoint python -v "${raw}:/entrada:ro" -v "${silver}:/salida" -v "${PWD}:/scripts:ro" ghcr.io/mlflow/mlflow:v3.18.0 /scripts/convertir_parquet.py
.\ingesta.ps1 -Capa silver -Origen $silver
.\ingesta.ps1 -Capa gold -Origen "RUTA_A_CARPETA_DE_RESULTADOS"
docker compose exec namenode hdfs fsck /offball/raw
docker compose exec namenode hdfs fsck /offball/silver
docker compose exec namenode hdfs fsck /offball/gold
```
Si la política de PowerShell impide ejecutar el script, ejecutar sus comandos en una consola autorizada por el centro. Gold contiene resultados ya calculados externamente, no una ejecución de ML sobre HDFS. El script de ingesta organizado aquí reproduce el patrón probado; no se ha vuelto a ejecutar de extremo a extremo como archivo.

## Hive y Beeline
```powershell
docker pull apache/hive:4.0.0
docker run -d --name offball-hive --network hadoop_default --memory 2g --cpus 1 -p 127.0.0.1:10000:10000 -p 127.0.0.1:10002:10002 -e SERVICE_NAME=hiveserver2 -e "SERVICE_OPTS=-Dhive.server2.enable.doAs=false" apache/hive:4.0.0
docker logs --tail 40 offball-hive
docker exec offball-hive hdfs dfs -ls hdfs://namenode:8020/offball/silver
docker cp tablas_y_validacion.sql offball-hive:/tmp/offball.sql
docker exec -it offball-hive beeline -u "jdbc:hive2://localhost:10000/" -n hive -f /tmp/offball.sql
```
Ejecutar cuando HiveServer2 acepte conexiones. Cinco tablas externas y cinco recuentos comprobados el 27/11. El Metastore Derby es local al contenedor; su recreación no está acreditada. Mantener el contenedor o recrear las definiciones con el SQL. MapReduce local es una opción académica obsoleta, no un clúster YARN. Detener Hive antes de Hadoop; no borrar volúmenes.

[Evidencias](../../docs/cierre-2026-11-27/README.md).
