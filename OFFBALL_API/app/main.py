from contextlib import asynccontextmanager
import os
from pathlib import Path
from typing import Annotated
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from .schemas import EconomicInput, EconomicResult, OffensiveInput, OffensiveResult, Position, SUBPOS
from .service import Models

@asynccontextmanager
async def lifespan(app):
    path=Path(os.environ.get('OFFBALL_ASSETS',Path(__file__).resolve().parents[1]/'assets'))
    app.state.models=Models(path)
    yield

app=FastAPI(title='OFFBALL API',version='0.4.1',description='Valoración económica, perfiles ofensivos y oportunidades históricas.',lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=os.getenv('OFFBALL_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(','),allow_methods=['GET','POST'],allow_headers=['Content-Type'])

@app.get('/health')
def health(request:Request):
    return {'status':'ok','regresion':'G02_general_log','gmm_componentes':5,'corte_datos':request.app.state.models.config['corte_datos']}

@app.get('/api/v1/metadata')
def metadata(request:Request):
    m=request.app.state.models
    return {'configuracion':m.config,'subposiciones':SUBPOS,'metricas_test':m.metrics,'zonas':m.gmm['zonas'],'perfiles':m.gmm['perfiles'],'nota':'Afinidad posicional relativa, no rendimiento observado por zona.'}

@app.post('/api/v1/valoracion',response_model=EconomicResult)
def valuation(data:EconomicInput,request:Request):
    try: return request.app.state.models.estimate(data)
    except ValueError as e: raise HTTPException(422,str(e)) from e

@app.post('/api/v1/afinidad',response_model=OffensiveResult)
def affinity(data:OffensiveInput,request:Request):
    return request.app.state.models.offensive(data)

@app.get('/api/v1/oportunidades')
def opportunities(request:Request,presupuesto:Annotated[float,Query(gt=0,le=1e10)]=5e6,edad_max:Annotated[int,Query(ge=15,le=45)]=45,minutos_min:Annotated[int,Query(ge=450,le=10000)]=450,position:Position|None=None,competition_id:str|None=None,incluir_no_vigentes:bool=False,limit:Annotated[int,Query(ge=1,le=100)]=30,offset:Annotated[int,Query(ge=0)]=0):
    return request.app.state.models.search(presupuesto,edad_max,minutos_min,position,competition_id,incluir_no_vigentes,limit,offset)

from .imports import router as database_router
app.include_router(database_router)
from .market import router as market_router
app.include_router(market_router)
