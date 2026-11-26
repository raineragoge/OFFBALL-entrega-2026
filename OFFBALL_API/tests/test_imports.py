import json
from .test_api import client, ECON

def test_import_preview_commit_update(client,monkeypatch,tmp_path):
    monkeypatch.setenv('OFFBALL_DATABASE',str(tmp_path/'test.sqlite3'))
    row=ECON|{'player_id':'p1','name':'Prueba','height_in_cm':181,'foot':'right'}
    body={'filename':'players.json','format':'json','content':json.dumps([row]),'preview':True}
    res=client.post('/api/v1/database/import',json=body).json()
    assert res['valid']==1 and res['inserted']==1 and not res['committed']
    assert client.get('/api/v1/database/players').json()['total']==0
    res=client.post('/api/v1/database/import',json=body|{'preview':False}).json()
    assert res['committed'] and res['inserted']==1
    assert client.get('/api/v1/database/players?alerts=true').json()['total']==1
    assert client.post('/api/v1/database/import',json=body|{'preview':False}).json()['updated']==1
    assert client.get('/api/v1/database/players').json()['total']==1
    assert len(client.get('/api/v1/database/history').json())==2
    invalid=client.post('/api/v1/database/import',json=body|{'content':json.dumps([row,row]),'preview':False}).json()
    assert invalid['error_count']==1 and not invalid['committed']

def test_csv_invalid_atomic(client,monkeypatch,tmp_path):
    monkeypatch.setenv('OFFBALL_DATABASE',str(tmp_path/'test.sqlite3'))
    row=ECON|{'player_id':'p1','name':'Prueba'}
    content=';'.join(row)+'\n'+';'.join(map(str,row.values()))+'\n'
    result=client.post('/api/v1/database/import',json={'filename':'players.csv','format':'csv','content':content,'preview':False}).json()
    assert result['committed']
