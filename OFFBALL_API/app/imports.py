"""Importaciones persistentes, sin modificar el catálogo histórico ni reentrenar."""
import csv, io, json, sqlite3, os
from pathlib import Path
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field, ValidationError, ConfigDict
from .schemas import EconomicInput, OffensiveInput

router = APIRouter(prefix='/api/v1/database', tags=['Base de jugadores'])
class ImportRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    filename: str = Field(min_length=1,max_length=255)
    format: Literal['csv','json']
    content: str = Field(min_length=1,max_length=8_000_000)
    preview: bool = True

class Player(EconomicInput):
    player_id: str = Field(min_length=1,max_length=100)
    name: str = Field(min_length=1,max_length=200)
    height_in_cm: float | None = Field(default=None,ge=140,le=220)
    foot: Literal['left','right','both','desconocido'] | None = None

FIELDS=set(Player.model_fields)

def connect():
    path=Path(os.environ.get('OFFBALL_DATABASE', Path(__file__).resolve().parents[1]/'data'/'players.sqlite3'))
    path.parent.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(path,timeout=30)
    c.row_factory=sqlite3.Row
    c.execute('CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, player_id TEXT NOT NULL, valuation_date TEXT NOT NULL, payload TEXT NOT NULL)')
    c.execute('CREATE TABLE IF NOT EXISTS imports (id INTEGER PRIMARY KEY, at TEXT, filename TEXT, inserted INTEGER, updated INTEGER, errors INTEGER)')
    return c

def parse(data):
    if data.format=='csv':
        content=data.content.lstrip('\ufeff')
        try: dialect=csv.Sniffer().sniff(content[:4096], delimiters=',;\t')
        except csv.Error: dialect=csv.excel
        rows=list(csv.DictReader(io.StringIO(content),dialect=dialect))
    else:
        rows=json.loads(data.content.lstrip('\ufeff'))
    if not isinstance(rows,list) or not rows or len(rows)>5000: raise ValueError('Se requieren de 1 a 5.000 filas por carga.')
    return rows

def clean(row):
    if not isinstance(row,dict): raise ValueError('La fila debe ser un objeto.')
    vals={str(k).strip(): v.strip() if isinstance(v,str) else v for k,v in row.items() if k is not None}
    vals={k:v for k,v in vals.items() if k in FIELDS and v not in ('',None)}
    if 'player_id' in vals: vals['player_id']=str(vals['player_id'])
    p=Player.model_validate(vals)
    return p

def identity(p): return json.dumps([p.player_id,p.competition_id,p.fin_temporada.isoformat(),p.valuation_date.isoformat()],ensure_ascii=False)

@router.post('/import')
def import_players(data:ImportRequest,request:Request):
    try: rows=parse(data)
    except (ValueError,csv.Error) as e: raise HTTPException(422,str(e)) from e
    m=request.app.state.models
    errors=[]; valid=[]; seen=set()
    for i,row in enumerate(rows,1):
        try:
            p=clean(row)
            for k,values in m.config['categorias_entrenamiento'].items():
                if getattr(p,k) not in values: raise ValueError(f'{k}: categoría no observada en entrenamiento')
            key=identity(p)
            if key in seen: raise ValueError('Registro duplicado dentro del archivo')
            seen.add(key); valid.append((key,p))
        except (ValueError,TypeError) as e:
            msg='; '.join(f"{'.'.join(map(str,x['loc']))}: {x['msg']}" for x in e.errors()) if isinstance(e,ValidationError) else str(e)
            errors.append({'row':i,'error':msg})
    c=connect()
    try:
        existing={r['id'] for r in c.execute('SELECT id FROM players')}
        inserted=sum(k not in existing for k,p in valid); updated=len(valid)-inserted
        if not data.preview and not errors:
            records=[]
            economic=m.estimate_many([EconomicInput.model_validate(p.model_dump(include=set(EconomicInput.model_fields))) for _,p in valid])
            for (key,p),econ in zip(valid,economic,strict=True):
                off=None
                if p.height_in_cm is not None and p.sub_position in ('Centre-Forward','Second Striker','Left Winger','Right Winger','Attacking Midfield'):
                    off=m.offensive(OffensiveInput.model_validate(p.model_dump(include=set(OffensiveInput.model_fields))))
                payload={'id':key,'player':p.model_dump(mode='json'),'economic':econ.model_dump(mode='json'),'offensive':off.model_dump(mode='json') if off else None}
                records.append((key,p.player_id,p.valuation_date.isoformat(),json.dumps(payload,ensure_ascii=False)))
            with c:
                c.executemany('INSERT INTO players VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',records)
                c.execute('INSERT INTO imports(at,filename,inserted,updated,errors) VALUES (?,?,?,?,?)',(datetime.now(timezone.utc).isoformat(),data.filename,inserted,updated,0))
        return {'total':len(rows),'valid':len(valid),'inserted':inserted,'updated':updated,'errors':errors[:100],'error_count':len(errors),'committed':not data.preview and not errors,'sample':[p.model_dump(mode='json') for _,p in valid[:8]]}
    finally: c.close()

@router.get('/players')
def players(alerts:bool=False, latest:bool=True, limit:int=Query(100,ge=1,le=500),offset:int=Query(0,ge=0),q:str=''):
    c=connect()
    try:
        rows=[json.loads(r['payload']) for r in c.execute('SELECT payload FROM players ORDER BY valuation_date DESC,id DESC')]
        if latest:
            seen=set(); selected=[]
            for r in rows:
                k=r['player']['player_id']
                if k not in seen: selected.append(r); seen.add(k)
            rows=selected
        if alerts: rows=[r for r in rows if r['economic']['alerta_economica'] is True]
        if q: rows=[r for r in rows if q.casefold() in r['player']['name'].casefold() or q.casefold() in r['player']['player_id'].casefold()]
        if alerts: rows.sort(key=lambda r:r['economic']['residuo_log']-r['economic']['umbral_p95'],reverse=True)
        return {'total':len(rows),'results':rows[offset:offset+limit]}
    finally: c.close()

@router.get('/history')
def history():
    c=connect()
    try: return [dict(r) for r in c.execute('SELECT * FROM imports ORDER BY id DESC LIMIT 100')]
    finally: c.close()
