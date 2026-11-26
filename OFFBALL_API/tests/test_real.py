"""Pruebas de integración con los artefactos originales, no con simulaciones."""
import os
import pytest
import sklearn
from fastapi.testclient import TestClient
from app.main import app
from tests.test_api import ECON, OFF
pytestmark=pytest.mark.skipif(sklearn.__version__!='1.6.1',reason='Los modelos requieren scikit-learn 1.6.1')

def test_real_models():
    with TestClient(app) as client:
        assert client.get('/health').status_code==200
        r=client.post('/api/v1/valoracion',json=ECON);assert r.status_code==200,r.text
        assert r.json()['valor_estimado_eur']>0
        for position,sub in [('Defender','Centre-Back'),('Goalkeeper','Goalkeeper'),('Midfield','Central Midfield')]:
            r=client.post('/api/v1/valoracion',json=ECON|{'position':position,'sub_position':sub,'goles':0,'asistencias':0});assert r.status_code==200,r.text
        r=client.post('/api/v1/afinidad',json=OFF);assert r.status_code==200,r.text
        assert sum(r.json()['afinidad'].values())==pytest.approx(1)
        assert len(r.json()['perfiles'])==5
        assert client.get('/api/v1/oportunidades').json()['total']==0
        assert client.get('/api/v1/oportunidades?incluir_no_vigentes=true').json()['total']>0

def test_real_database(tmp_path,monkeypatch):
    import json
    monkeypatch.setenv('OFFBALL_DATABASE',str(tmp_path/'real.sqlite3'))
    with TestClient(app) as client:
        rows=[ECON|{'player_id':'demo','name':'Ejemplo de prueba','height_in_cm':181,'foot':'right'}]
        r=client.post('/api/v1/database/import',json={'filename':'demo.json','format':'json','content':json.dumps(rows),'preview':False})
        assert r.status_code==200,r.text
        assert r.json()['committed']
        saved=client.get('/api/v1/database/players').json()['results'][0]
        assert saved['economic']['valor_estimado_eur']==pytest.approx(client.post('/api/v1/valoracion',json=ECON).json()['valor_estimado_eur'])
        assert sum(saved['offensive']['afinidad'].values())==pytest.approx(1)
