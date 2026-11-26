from pathlib import Path
from unittest.mock import patch
import json
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
import pytest
from app.main import app
from app.service import Models

ASSETS=Path(__file__).resolve().parents[1]/'assets'
ECON={'age':23,'position':'Attack','sub_position':'Centre-Forward','competition_id':'ES1','partidos':30,'minutos':2100,'goles':12,'asistencias':5,'market_value_in_eur':750000,'fin_temporada':'2025-05-25','valuation_date':'2025-12-12'}
OFF={k:ECON[k] for k in ['position','sub_position','minutos','goles','asistencias']} | {'height_in_cm':181,'foot':'right'}

class StubRegressor:
    def __init__(self,value): self.value=value
    def predict(self,x): return np.full(len(x),self.value)
class StubGMM:
    def predict_proba(self,x): return np.tile([.6,.1,.1,.1,.1],(len(x),1))

@pytest.fixture
def client():
    m=Models.__new__(Models)
    m.config=json.loads((ASSETS/'configuracion.json').read_text())
    m.metrics=pd.read_csv(ASSETS/'metricas_test.csv').to_dict('records')
    m.thresholds={(r.position,r.rango):r.umbral for r in pd.read_csv(ASSETS/'calibracion_anomalias.csv').itertuples()}
    m.direct=StubRegressor(5e6);m.economic=StubRegressor(4e6)
    m.gmm={'variables':['goles_90','asistencias_90','height_in_cm'],'pipeline':StubGMM(),'zonas':['DC','ED','EI','MCO'],'perfiles':dict(enumerate(['a','b','c','d','e'])),'matriz_afinidad':np.array([[.7,.1,.1,.1]]*5),'prior':np.array([.25]*4),'prob_pie':pd.DataFrame({'right':[.8,.6,.7,.6]})}
    m.catalog=pd.DataFrame([dict(player_id=1,name='Ejemplo sintético',position='Attack',sub_position='Centre-Forward',competition_id='ES1',age=23,minutos=2100,valuation_date=pd.Timestamp('2025-12-12'),fin_temporada=pd.Timestamp('2025-05-25'),market_value_in_eur=750000,valor_estimado=4e6,diferencia_pct=433.3,alerta_economica=True,residuo=1.8,umbral=1.6,vigente_en_corte=False)])
    with patch('app.main.Models',return_value=m):
        with TestClient(app) as c: yield c

def test_health(client): assert client.get('/health').json()['status']=='ok'
def test_valuation(client):
    r=client.post('/api/v1/valoracion',json=ECON); assert r.status_code==200,r.text
    v=r.json(); assert v['valor_estimado_eur']==4e6 and v['alerta_economica'] is True
    assert v['goles_90']==pytest.approx(12*90/2100)
def test_no_market_value(client):
    v=client.post('/api/v1/valoracion',json=ECON|{'market_value_in_eur':None}).json();assert v['alerta_economica'] is None
@pytest.mark.parametrize('changes',[{'minutos':100},{'competition_id':'XX'},{'fin_temporada':'2020-01-01'},{'sub_position':'Goalkeeper'},{'goles':-1},{'partidos':1},{'market_value_in_eur':0}])
def test_invalid_inputs(client,changes): assert client.post('/api/v1/valoracion',json=ECON|changes).status_code==422
def test_affinity(client):
    r=client.post('/api/v1/afinidad',json=OFF);assert r.status_code==200,r.text
    v=r.json();assert sum(v['afinidad'].values())==pytest.approx(1);assert sum(x['probabilidad'] for x in v['perfiles'])==pytest.approx(1);assert v['mejor_zona']=='DC'
def test_nonoffensive(client): assert client.post('/api/v1/afinidad',json=OFF|{'position':'Defender','sub_position':'Centre-Back'}).status_code==422
def test_catalog(client):
    assert client.get('/api/v1/oportunidades').json()['total']==0
    assert client.get('/api/v1/oportunidades?incluir_no_vigentes=true').json()['total']==1
    assert client.get('/api/v1/oportunidades?incluir_no_vigentes=true&presupuesto=100').json()['total']==0
