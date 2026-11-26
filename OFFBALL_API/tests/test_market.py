import json
from .test_api import client, ECON

def test_market_position_and_budget(client,monkeypatch,tmp_path):
    monkeypatch.setenv('OFFBALL_DATABASE',str(tmp_path/'test.sqlite3'))
    r=client.get('/api/v1/mercado?sub_position=Centre-Forward').json()
    assert r['total']==1 and r['results'][0]['source']=='historico'
    assert client.get('/api/v1/mercado?sub_position=Left-Winger').json()['total']==0
    assert client.get('/api/v1/mercado?position=Defender').json()['total']==0
    assert client.get('/api/v1/mercado?presupuesto=100').json()['total']==0
    assert client.get('/api/v1/mercado?incluir_historicos=false').json()['total']==0
    assert client.get('/api/v1/mercado?q=imposible').json()['total']==0
    assert client.get('/api/v1/mercado?offset=1').json()['results']==[]

def test_market_imports_and_nonalerts(client,monkeypatch,tmp_path):
    monkeypatch.setenv('OFFBALL_DATABASE',str(tmp_path/'test.sqlite3'))
    row=ECON|{'player_id':'new','name':'Jugador nuevo','market_value_in_eur':4e6,'position':'Defender','sub_position':'Centre-Back'}
    r=client.post('/api/v1/database/import',json={'filename':'demo.json','format':'json','content':json.dumps([row]),'preview':False})
    assert r.status_code==200 and r.json()['committed'],r.text
    r=client.get('/api/v1/mercado?sub_position=Centre-Back').json()
    assert r['total']==1 and r['results'][0]['source']=='importado' and not r['results'][0]['alerta_economica']
    assert client.get('/api/v1/mercado?sub_position=Centre-Back&solo_alertas=true').json()['total']==0
    assert client.get('/api/v1/mercado?sub_position=Centre-Back&q=nuevo').json()['total']==1

def test_market_offensive_profile_available_for_imported(client,monkeypatch,tmp_path):
    monkeypatch.setenv('OFFBALL_DATABASE',str(tmp_path/'test.sqlite3'))
    row=ECON|{'player_id':'profile','name':'Perfil','height_in_cm':180}
    r=client.post('/api/v1/database/import',json={'filename':'demo.json','format':'json','content':json.dumps([row]),'preview':False})
    assert r.status_code==200 and r.json()['committed'],r.text
    r=client.get('/api/v1/mercado?q=Perfil').json()['results'][0]
    assert r['goles']==row['goles'] and r['asistencias']==row['asistencias']
    assert r['offensive'] is not None and 'afinidad' in r['offensive']

def test_market_detail_historical(client,monkeypatch,tmp_path):
    monkeypatch.setenv('OFFBALL_DATABASE',str(tmp_path/'test.sqlite3'))
    row=client.get('/api/v1/mercado').json()['results'][0]
    params={'source':row['source'],'id':row['id'],'fecha':'2025-12-12'}
    r=client.get('/api/v1/mercado/ficha',params=params)
    assert r.status_code==200,r.text
    d=r.json();assert d['row']==row and d['player'] is None and d['economic'] is None and d['residuo']==1.8
    assert client.get('/api/v1/mercado/ficha',params=params|{'fecha':'2020-01-01'}).status_code==404
    assert client.get('/api/v1/mercado/ficha',params=params|{'id':'historico:999'}).status_code==404

def test_market_detail_imported(client,monkeypatch,tmp_path):
    monkeypatch.setenv('OFFBALL_DATABASE',str(tmp_path/'test.sqlite3'))
    row=ECON|{'player_id':'new-42','name':'Ficha nueva','height_in_cm':182,'foot':'right'}
    result=client.post('/api/v1/database/import',json={'filename':'demo.json','format':'json','content':json.dumps([row]),'preview':False})
    assert result.json()['committed'],result.text
    market=client.get('/api/v1/mercado?q=new-42').json()['results'][0]
    params={'source':'importado','id':market['id'],'fecha':row['valuation_date']}
    r=client.get('/api/v1/mercado/ficha',params=params)
    assert r.status_code==200,r.text
    d=r.json();assert d['row']==market and d['player']['height_in_cm']==182 and d['economic']['goles_90']>0 and d['row']['offensive'] is not None
    assert client.get('/api/v1/mercado/ficha',params=params|{'id':'importado:missing'}).status_code==404
