import type {OffensiveResult} from './types'
import {getClient} from './client'
export interface MarketRow {id:string;source:'historico'|'importado';player_id:string|number;name:string|null;position:string;sub_position:string;competition_id:string;age:number;minutos:number;valuation_date:string;market_value_in_eur:number;valor_estimado:number|null;diferencia_pct:number|null;alerta_economica:boolean|null;vigente_en_corte:boolean|null;goles?:number;asistencias?:number;offensive?:OffensiveResult|null}
export interface MarketResponse {total:number;results:MarketRow[];corte_datos:string}
export async function searchMarket(params:Record<string,string>,signal?:AbortSignal):Promise<MarketResponse>{
 const response=await fetch(`${getClient().baseUrl}/api/v1/mercado?${new URLSearchParams(params)}`,{signal});if(!response.ok)throw new Error(`Mercado: HTTP ${response.status}`);return response.json() as Promise<MarketResponse>
}

export interface MarketDetail {row:MarketRow;player:import('./database').ImportedPlayer|null;economic:import('./types').EconomicResult|null;corte_datos:string;modelo:string;residuo:number|null;umbral:number|null;fin_temporada:string|null}
export function marketDetailUrl(row:MarketRow):string {return '/mercado/ficha?'+new URLSearchParams({source:row.source,id:row.id,fecha:row.valuation_date.slice(0,10)}).toString()}
export async function fetchMarketDetail(source:string,id:string,fecha:string,signal?:AbortSignal):Promise<MarketDetail>{
 const res=await fetch(`${getClient().baseUrl}/api/v1/mercado/ficha?${new URLSearchParams({source,id,fecha})}`,{signal});if(!res.ok)throw new Error(res.status===404?'No se encuentra esta valoración en el catálogo.':`Ficha: HTTP ${res.status}`);return res.json() as Promise<MarketDetail>
}
