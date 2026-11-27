"""Importa ejecuciones archivadas de OFFBALL sin entrenar modelos."""
from pathlib import Path
import sqlite3
from datetime import datetime
import math
from mlflow import MlflowClient
from mlflow.entities import Metric, Param

ROOT = Path('/offball')
BASE = ROOT / 'experimentos_definitivos'
TARGET = ROOT / 'runs/verified/mlflow.db'
SOURCES = [
    ('OFFBALL_02_Clustering_EXTENDIDO_K5(1)', 'offball_mlflow.db', 'mlartifacts', 20),
    ('OFFBALL_03_Integracion_EXTENDIDA_K5(1)', 'integracion_mlflow.db', 'artefactos_mlflow', 26),
    ('OFFBALL_04_Resultados_EXTENDIDOS_K5(1)', 'anomalias_mlflow.db', 'artefactos_mlflow', 1),
    ('OFFBALL_05_Regresion_General (1)', 'general_mlflow.db', 'artefactos_mlflow', 9),
]

def open_read(path):
    conn = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
    conn.row_factory = sqlite3.Row
    return conn

def main():
    if not TARGET.is_file():
        raise FileNotFoundError(TARGET)
    # Comprobar todas las fuentes antes de escribir nada.
    for folder, db, artifacts, expected in SOURCES:
        with open_read(BASE / folder / db) as src:
            count = src.execute('SELECT count(*) FROM runs').fetchone()[0]
            if count != expected:
                raise RuntimeError(f'{db}: {count} runs; se esperaban {expected}')
    backup = TARGET.with_name('mlflow_pre_import_' + datetime.now().strftime('%Y%m%d_%H%M%S_%f') + '.db')
    with open_read(TARGET) as src, sqlite3.connect(backup) as dst:
        src.backup(dst)
    print('Backup:', backup, flush=True)
    # Cliente oficial, directamente contra la misma base de tracking del servidor.
    client = MlflowClient(tracking_uri='sqlite:////offball/runs/verified/mlflow.db')
    total = 0
    for folder, db, artifact_dir, expected in SOURCES:
        directory = BASE / folder
        with open_read(directory / db) as src:
            for exp in src.execute('SELECT * FROM experiments ORDER BY experiment_id'):
                runs = src.execute('SELECT * FROM runs WHERE experiment_id=? ORDER BY start_time,run_uuid', (exp['experiment_id'],)).fetchall()
                if not runs:
                    continue
                name = exp['name']
                dest = client.get_experiment_by_name(name)
                if dest is None:
                    eid = client.create_experiment(name, artifact_location=(ROOT / 'artefactos_importados' / name).as_uri(), tags={'offball.source_db': db})
                else:
                    if dest.tags.get('offball.source_db') != db:
                        raise RuntimeError(f'Experimento existente no pertenece a esta importacion: {name}')
                    eid = dest.experiment_id
                print(f'\n{name}: {len(runs)} runs', flush=True)
                for r in runs:
                    old = r['run_uuid']
                    existing = client.search_runs([eid], filter_string=f"tags.`offball.source_run_id` = '{old}'", max_results=10)
                    if len(existing) > 1:
                        raise RuntimeError(f'Importacion duplicada: {old}')
                    if existing and existing[0].data.tags.get('offball.import_complete') == 'true':
                        total += 1
                        print('  Ya importado:', r['name'], flush=True)
                        continue
                    tags = dict(src.execute('SELECT key,value FROM tags WHERE run_uuid=?', (old,)).fetchall())
                    tags.update({'offball.source_run_id': old, 'offball.source_db': db, 'offball.import_complete': 'false', 'offball.original_artifact_uri': r['artifact_uri'] or ''})
                    if existing:
                        rid = existing[0].info.run_id
                    else:
                        rid = client.create_run(eid, start_time=r['start_time'], tags=tags, run_name=r['name']).info.run_id
                    params = [Param(x['key'], x['value']) for x in src.execute('SELECT key,value FROM params WHERE run_uuid=?', (old,))]
                    metrics = [Metric(x['key'], math.nan if x['is_nan'] else x['value'], x['timestamp'], x['step']) for x in src.execute('SELECT key,value,timestamp,step,is_nan FROM metrics WHERE run_uuid=? ORDER BY timestamp,step', (old,))]
                    client.log_batch(rid, params=params, metrics=metrics, synchronous=True)
                    artifact_path = directory / artifact_dir / old / 'artifacts'
                    file_count = 0
                    if artifact_path.is_dir():
                        client.log_artifacts(rid, str(artifact_path))
                        file_count = sum(p.is_file() for p in artifact_path.rglob('*'))
                    client.set_tag(rid, 'offball.source_artifact_count', str(file_count))
                    client.set_terminated(rid, status=r['status'], end_time=r['end_time'])
                    check = client.get_run(rid)
                    if check.data.params != {p.key:p.value for p in params} or check.info.status != r['status']:
                        raise RuntimeError(f'Verificacion fallida: {rid}')
                    for key in {m.key for m in metrics}:
                        if len(client.get_metric_history(rid, key)) != sum(m.key == key for m in metrics):
                            raise RuntimeError(f'Historial de metricas distinto: {rid}/{key}')
                    client.set_tag(rid, 'offball.import_complete', 'true')
                    total += 1
                    print(f'  OK {r["name"]}: {len(metrics)} metricas, {len(params)} parametros, {file_count} archivos', flush=True)
    print(f'\nIMPORTACION COMPLETA: {total}/56 runs.', flush=True)

if __name__ == '__main__':
    main()
