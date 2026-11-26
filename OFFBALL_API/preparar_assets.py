"""Extrae exclusivamente los archivos necesarios de las etapas 02 y 05."""
import argparse, hashlib, json
from pathlib import Path
from zipfile import ZipFile

FILES_GENERAL=['G01_general_directo.joblib','G02_general_log.joblib','configuracion.json','calibracion_anomalias.csv','metricas_test.csv','catalogo_historico.parquet']
FILES_GMM=['OFFBALL_clustering_EXTENDIDO_K5.joblib','perfiles_K5.csv']
root=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--general',type=Path,required=True)
parser.add_argument('--clustering',type=Path,required=True)
a=parser.parse_args()
expected=json.loads((root/'assets_manifest.json').read_text())
contents={}
for file,names in [(a.general,FILES_GENERAL),(a.clustering,FILES_GMM)]:
    with ZipFile(file) as z:
        for name in names:
            paths=[p for p in z.namelist() if Path(p).name==name and 'artifacts' not in Path(p).parts]
            if len(paths)!=1: raise ValueError(f'{name}: se esperaba un único archivo')
            blob=z.read(paths[0])
            if hashlib.sha256(blob).hexdigest()!=expected[name]: raise ValueError(f'Hash distinto: {name}; se requieren los modelos de referencia')
            contents[name]=blob
(root/'assets').mkdir(exist_ok=True)
for name,blob in contents.items(): (root/'assets'/name).write_bytes(blob)
print(f'{len(contents)} archivos extraídos y verificados.')
