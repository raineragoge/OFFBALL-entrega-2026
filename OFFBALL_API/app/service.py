import json, math
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import sklearn
from .schemas import EconomicInput, OffensiveInput, EconomicResult, OffensiveResult, Profile

class Models:
    def __init__(self, path: Path):
        self.config = json.loads((path/'configuracion.json').read_text())
        if sklearn.__version__ != self.config['sklearn']:
            raise RuntimeError(f"Se requiere scikit-learn {self.config['sklearn']}; instalada {sklearn.__version__}")
        self.direct = joblib.load(path/'G01_general_directo.joblib')
        self.economic = joblib.load(path/'G02_general_log.joblib')
        self.gmm = joblib.load(path/'OFFBALL_clustering_EXTENDIDO_K5.joblib')
        if self.gmm['sklearn_version'] != sklearn.__version__:
            raise RuntimeError('Versión incompatible del GMM')
        if self.config['modelos']['economico'] != 'G02_general_log' or self.config['modelos']['general'] != 'G02_general_log':
            raise RuntimeError('Configuración de selección inesperada')
        if self.gmm['matriz_afinidad'].shape != (5,4):
            raise RuntimeError('Matriz de afinidad incompatible')
        self.thresholds = {(r.position,r.rango):float(r.umbral) for r in pd.read_csv(path/'calibracion_anomalias.csv').itertuples()}
        self.metrics = pd.read_csv(path/'metricas_test.csv').to_dict('records')
        self.catalog = pd.read_parquet(path/'catalogo_historico.parquet')
        self.catalog['valuation_date'] = pd.to_datetime(self.catalog['valuation_date'])
        self.catalog['fin_temporada'] = pd.to_datetime(self.catalog['fin_temporada'])

    def estimate(self, x: EconomicInput) -> EconomicResult:
        return self.estimate_many([x])[0]

    def estimate_many(self, inputs: list[EconomicInput]) -> list[EconomicResult]:
        if not inputs: return []
        records=[]
        for x in inputs:
            for key, values in self.config['categorias_entrenamiento'].items():
                if getattr(x,key) not in values:
                    raise ValueError(f'{key}: categoría no observada en entrenamiento')
            records.append({**x.model_dump(), 'goles_por90':x.goles*90/x.minutos,'asistencias_por90':x.asistencias*90/x.minutos})
        frame=pd.DataFrame(records)[self.config['features']]
        pred=self.economic.predict(frame); direct=self.direct.predict(frame)
        return [self._economic_result(x,float(p),float(ref)) for x,p,ref in zip(inputs,pred,direct,strict=True)]

    def _economic_result(self,x: EconomicInput,p: float,ref: float) -> EconomicResult:
        g,a=x.goles*90/x.minutos,x.asistencias*90/x.minutos
        if not all(math.isfinite(v) and v>0 for v in (p,ref)):
            raise RuntimeError('Predicción inválida')
        v=x.market_value_in_eur
        band=None; r=None; t=None; alert=None
        if v is not None:
            band='Menos de 1M' if v<1e6 else 'Entre 1M y 5M' if v<5e6 else '5M o mas'
            r=math.log(p/v); t=self.thresholds.get((x.position,band),self.thresholds.get(('TODAS',band)))
            alert=None if t is None else r>t
        warnings=['Estimación estadística, no precio de traspaso ni garantía de infravaloración.', 'Sin métricas específicas de rendimiento defensivo o de porteros.', 'La temporada cerrada y los datos aportados por el usuario no se verifican externamente.']
        if x.valuation_date.isoformat()>self.config['corte_datos']:
            warnings.append('Fecha posterior al corte del dataset: extrapolación temporal no validada.')
        return EconomicResult(modelo='G02_general_log', valor_estimado_eur=p, referencia_directa_eur=ref, valor_observado_eur=v,diferencia_eur=None if v is None else p-v,diferencia_pct=None if v is None else (p/v-1)*100,residuo_log=r,umbral_p95=t,alerta_economica=alert,rango=band,goles_90=g,asistencias_90=a,advertencias=warnings)

    def offensive(self,x: OffensiveInput) -> OffensiveResult:
        s=self.gmm
        row=pd.DataFrame([{'goles_90':x.goles*90/x.minutos,'asistencias_90':x.asistencias*90/x.minutos,'height_in_cm':x.height_in_cm}])
        probs=s['pipeline'].predict_proba(row[s['variables']])[0]
        # Misma fórmula que el Colab: mezcla ponderada, factor pie y corrección por prior.
        factor=s['prob_pie'][x.foot].to_numpy() if x.foot in s['prob_pie'].columns else np.ones(len(s['zonas']))
        scores=(probs @ s['matriz_afinidad'])*factor/s['prior']
        scores=scores/scores.sum()
        if not np.isfinite(scores).all() or not np.isfinite(probs).all(): raise RuntimeError('Afinidad inválida')
        order=np.argsort(-scores)
        return OffensiveResult(modelo='GMM_EXTENDIDO_K5',perfiles=[Profile(cluster=i,perfil=s['perfiles'][i],probabilidad=float(probs[i])) for i in range(5)],afinidad={z:float(p) for z,p in zip(s['zonas'],scores)},mejor_zona=s['zonas'][order[0]],alternativa=s['zonas'][order[1]],advertencias=['Afinidad estadística relativa, no probabilidad de éxito ni mapa de movimientos reales.', 'El componente sin asistencias registradas puede reflejar características del registro de datos.', 'El modelo utiliza solo goles/90, asistencias/90 y altura; el pie modifica la afinidad.'])

    def search(self, budget, max_age, min_minutes, position, competition, include_stale, limit, offset):
        c=self.catalog
        mask=c['alerta_economica'].eq(True)&c['market_value_in_eur'].lt(budget)&c['minutos'].ge(min_minutes)&c['age'].le(max_age)
        if position: mask &= c['position'].eq(position)
        if competition: mask &= c['competition_id'].eq(competition)
        if not include_stale: mask &= c['vigente_en_corte'].eq(True)
        rows=c.loc[mask].copy(); rows['exceso_residuo']=rows['residuo']-rows['umbral']
        rows=rows.sort_values(['exceso_residuo','player_id'],ascending=[False,True])
        cols=['player_id','name','position','sub_position','competition_id','age','minutos','valuation_date','fin_temporada','market_value_in_eur','valor_estimado','diferencia_pct','exceso_residuo','vigente_en_corte']
        results=json.loads(rows.iloc[offset:offset+limit][cols].to_json(orient='records',date_format='iso'))
        return {'modelo':'G02_general_log','corte_datos':self.config['corte_datos'],'incluye_no_vigentes':include_stale,'total':len(rows),'resultados':results,'advertencia':'Catálogo histórico; vigencia relativa al corte del dataset, no a hoy. No acredita disponibilidad de fichaje.'}
