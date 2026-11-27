"""Registra modelos OFFBALL ya entrenados, sin fit ni alteracion de versiones anteriores."""
import os
os.environ.setdefault('OMP_NUM_THREADS', '1')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
os.environ.setdefault('MKL_NUM_THREADS', '1')
from pathlib import Path
import hashlib
import sqlite3
import tempfile
from datetime import datetime
from importlib.metadata import version
import joblib
import numpy as np
import pandas as pd
import mlflow
import mlflow.sklearn
from mlflow import MlflowClient
from mlflow.models import infer_signature
from sklearn.utils.validation import check_is_fitted

ROOT = Path('/offball')
DB = ROOT / 'runs/verified/mlflow.db'
URI = 'sqlite:////offball/runs/verified/mlflow.db'
BASE = ROOT / 'experimentos_definitivos'
SPECS = [
    ('OFFBALL_Clustering_EXTENDIDO', 'b40d1f13b2934192acb86422d8f3af57',
     'OFFBALL_02_Clustering_EXTENDIDO_K5(1)', 'OFFBALL_clustering_EXTENDIDO_K5.joblib',
     'OFFBALL_clustering', 'GMM K5 extendido, 14 ligas. Pipeline de perfiles.',
     pd.DataFrame({'goles_90':[0.3], 'asistencias_90':[0.2], 'height_in_cm':[180.0]})),
    ('OFFBALL_Regresion_General_Todas_Posiciones', '16d0f3230a7242c88bd89be7344051b6',
     'OFFBALL_05_Regresion_General (1)', 'G02_general_log.joblib',
     'OFFBALL_regression', 'G02 general: regresion con transformacion log1p/expm1, todas las posiciones.',
     pd.DataFrame({'age':[24.0], 'partidos':[25.0], 'minutos':[1800.0], 'goles_por90':[0.3], 'asistencias_por90':[0.2], 'position':['Attack'], 'sub_position':['Centre-Forward'], 'competition_id':['ES1']})),
]

def same(a,b):
    np.testing.assert_allclose(a,b, rtol=1e-10, atol=1e-10)

def verify(model, x, expected, proba):
    same(model.predict(x), expected)
    if proba is not None:
        same(model.predict_proba(x), proba)

def main():
    assert version('scikit-learn') == '1.6.1'
    mlflow.set_tracking_uri(URI)
    mlflow.set_registry_uri(URI)
    client = MlflowClient(tracking_uri=URI, registry_uri=URI)
    deps = [f'{p}=={version(p)}' for p in ['mlflow','scikit-learn','numpy','scipy','pandas','joblib','cloudpickle','threadpoolctl']]
    ready = []
    with tempfile.TemporaryDirectory() as tmp:
        for i,(exp_name, source_run, folder, filename, registry, description, x) in enumerate(SPECS):
            exp = client.get_experiment_by_name(exp_name)
            if exp is None: raise RuntimeError(f'Falta experimento: {exp_name}')
            runs = client.search_runs([exp.experiment_id], filter_string=f"tags.`offball.source_run_id` = '{source_run}'")
            if len(runs)!=1 or runs[0].data.tags.get('offball.import_complete')!='true':
                raise RuntimeError(f'Run importado no encontrado: {source_run}')
            run = runs[0]
            original = BASE / folder / filename
            sha = hashlib.sha256(original.read_bytes()).hexdigest()
            # Solo archivos propios y de confianza, no pickle de terceros.
            obj = joblib.load(original)
            model = obj['pipeline'] if isinstance(obj,dict) else obj
            check_is_fitted(model)
            x = x[list(model.feature_names_in_)]
            pred = model.predict(x)
            if not np.all(np.isfinite(pred)): raise RuntimeError('Prediccion no finita')
            proba = model.predict_proba(x) if i==0 else None
            if i==0:
                assert proba.shape == (1,5), proba.shape
                same(proba.sum(axis=1), [1.0])
            path = Path(tmp)/str(i)
            mlflow.sklearn.save_model(model, str(path), serialization_format='cloudpickle',
                 signature=infer_signature(x,pred), input_example=x, pip_requirements=deps,
                 metadata={'offball_source_sha256':sha,'offball_source_run_id':source_run,'offball_retrained':False})
            verify(mlflow.sklearn.load_model(str(path)),x,pred,proba)
            print(f'PREVALIDADO {registry}: {type(model).__name__}; prediccion de prueba {pred}',flush=True)
            ready.append((run, registry, description, path, sha, source_run, x, pred, proba))
        backup=DB.with_name('mlflow_pre_registry_'+datetime.now().strftime('%Y%m%d_%H%M%S_%f')+'.db')
        with sqlite3.connect(DB) as src, sqlite3.connect(backup) as dst: src.backup(dst)
        print('Backup:',backup,flush=True)
        for run,registry,description,path,sha,source_run,x,pred,proba in ready:
            # No crear duplicados al repetir el script.
            names={r.name for r in client.search_registered_models()}
            if registry not in names: client.create_registered_model(registry)
            versions=client.search_model_versions(f"name = '{registry}'")
            matched=[v for v in versions if v.tags.get('offball.source_sha256')==sha and v.run_id==run.info.run_id]
            if len(matched)>1: raise RuntimeError(f'Versiones duplicadas: {registry}')
            if matched:
                v=matched[0]
            else:
                client.log_artifacts(run.info.run_id,str(path),artifact_path='modelo_mlflow_definitivo')
                source=run.info.artifact_uri.rstrip('/')+'/modelo_mlflow_definitivo'
                v=client.create_model_version(name=registry,source=source,run_id=run.info.run_id,
                    tags={'offball.source_sha256':sha,'offball.source_run_id':source_run,'offball.retrained':'false'},description=description)
            model_uri=f'models:/{registry}/{v.version}'
            verify(mlflow.sklearn.load_model(model_uri),x,pred,proba)
            client.set_model_version_tag(registry,v.version,'offball.smoke_test','passed')
            client.set_registered_model_alias(registry,'definitivo',v.version)
            print(f'REGISTRADO Y VERIFICADO: {registry} v{v.version} alias definitivo; run {run.info.run_id}',flush=True)
    print('REGISTRO COMPLETO: 2/2 modelos. Sin reentrenamiento.',flush=True)

if __name__=='__main__': main()
