"""Search the historical catalogue and imported players without changing either."""
import json
from fastapi import APIRouter, HTTPException, Query, Request
from typing import Literal
import pandas as pd
from .schemas import Position
from .imports import connect
router=APIRouter(prefix='/api/v1',tags=['Mercado ampliado'])

@router.get('/mercado')
def market(request:Request,q:str=Query('',max_length=200),position:Position|None=None,sub_position:str|None=None,presupuesto:float=Query(5e6,gt=0,le=1e10),edad_max:int=Query(45,ge=15,le=45),minutos_min:int=Query(450,ge=0,le=10000),solo_alertas:bool=False, incluir_historicos:bool=True,limit:int=Query(30,ge=1,le=100),offset:int=Query(0,ge=0)):
    m=request.app.state.models
    cols=['player_id','name','position','sub_position','competition_id','age','minutos','valuation_date','market_value_in_eur','valor_estimado','diferencia_pct','alerta_economica','vigente_en_corte']
    df=m.catalog.sort_values('valuation_date',ascending=False).drop_duplicates('player_id')
    historic=json.loads(df[cols].to_json(orient='records',date_format='iso'))
    rows=[dict(r,source='historico',id='historico:'+str(r['player_id'])) for r in historic if incluir_historicos or r['vigente_en_corte']]
    c=connect()
    try:
        seen=set()
        for row in c.execute('SELECT payload FROM players ORDER BY valuation_date DESC,id DESC'):
            r=json.loads(row['payload']); p=r['player']; e=r['economic']; pid=p['player_id']
            if pid in seen: continue
            seen.add(pid)
            rows.append(dict(id='importado:'+r['id'],source='importado',player_id=pid,name=p['name'],position=p['position'],sub_position=p['sub_position'],competition_id=p['competition_id'],age=p['age'],minutos=p['minutos'],valuation_date=p['valuation_date'],market_value_in_eur=p.get('market_value_in_eur'),valor_estimado=e['valor_estimado_eur'],diferencia_pct=e['diferencia_pct'],alerta_economica=e['alerta_economica'],vigente_en_corte=None,goles=p['goles'],asistencias=p['asistencias'],offensive=r.get('offensive')))
    finally: c.close()
    q=q.strip().casefold()
    rows=[r for r in rows if (not q or q in str(r['name'] or '').casefold() or q in str(r['player_id']).casefold()) and (not position or r['position']==position) and (not sub_position or r['sub_position']==sub_position) and r['market_value_in_eur'] is not None and 0<r['market_value_in_eur']<=presupuesto and r['age'] is not None and r['age']<=edad_max and r['minutos'] is not None and r['minutos']>=minutos_min and (not solo_alertas or r['alerta_economica'] is True)]
    rows.sort(key=lambda r:(r['alerta_economica'] is True,r['diferencia_pct'] if r['diferencia_pct'] is not None else -1e20),reverse=True)
    return {'total':len(rows),'results':rows[offset:offset+limit],'corte_datos':m.config['corte_datos']}

@router.get('/mercado/ficha')
def market_detail(request:Request,source:Literal['historico','importado'],id:str=Query(...,min_length=1,max_length=500),fecha:str|None=Query(None,max_length=32)):
    """Exact record selected by the scout; never recalculate or fill missing statistics."""
    m=request.app.state.models
    if source=='importado':
        if not id.startswith('importado:'): raise HTTPException(404,'Ficha no encontrada')
        c=connect()
        try:
            record=c.execute('SELECT payload FROM players WHERE id=?',(id[len('importado:'):],)).fetchone()
        finally: c.close()
        if record is None: raise HTTPException(404,'Ficha importada no encontrada')
        d=json.loads(record['payload']); p=d['player']; e=d['economic']
        row={**{k:p.get(k) for k in ['player_id','name','position','sub_position','competition_id','age','minutos','valuation_date','market_value_in_eur','goles','asistencias']},'id':id,'source':source,'valor_estimado':e['valor_estimado_eur'],'diferencia_pct':e['diferencia_pct'],'alerta_economica':e['alerta_economica'],'vigente_en_corte':None,'offensive':d.get('offensive')}
        return {'row':row,'player':p,'economic':e,'corte_datos':m.config['corte_datos'],'modelo':e['modelo'],'residuo':e.get('residuo_log'),'umbral':e.get('umbral_p95'),'fin_temporada':p.get('fin_temporada')}
    if not id.startswith('historico:'): raise HTTPException(404,'Ficha no encontrada')
    df=m.catalog
    selected=df[df['player_id'].astype(str)==id[len('historico:'):]]
    if fecha:
        try: day=pd.Timestamp(fecha).date()
        except (ValueError,TypeError,OverflowError): raise HTTPException(422,'Fecha inválida')
        selected=selected[pd.to_datetime(selected['valuation_date']).dt.date==day]
    if selected.empty: raise HTTPException(404,'Ficha histórica no encontrada')
    cols=['player_id','name','position','sub_position','competition_id','age','minutos','valuation_date','market_value_in_eur','valor_estimado','diferencia_pct','alerta_economica','vigente_en_corte','residuo','umbral','fin_temporada']
    r=json.loads(selected.sort_values('valuation_date',ascending=False).head(1)[[k for k in cols if k in selected.columns]].to_json(orient='records',date_format='iso'))[0]
    row={k:r[k] for k in cols[:13]}; row.update(id=id,source=source)
    return {'row':row,'player':None,'economic':None,'corte_datos':m.config['corte_datos'],'modelo':m.config.get('modelos',{}).get('general','G02'),'residuo':r.get('residuo'),'umbral':r.get('umbral'),'fin_temporada':r.get('fin_temporada')}
