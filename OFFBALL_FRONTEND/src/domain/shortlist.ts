import type {MarketRow} from '../api/market'
import type {OpportunityRow} from '../api/types'
export const SHORTLIST_KEY='offball.shortlist.v1'
export function marketKey(r:MarketRow){return `${r.source}:${String(r.player_id)}`}
export function mergeShortlist(rows:MarketRow[],incoming:MarketRow[]){const m=new Map(rows.map(r=>[marketKey(r),r]));for(const r of incoming){const k=marketKey(r),old=m.get(k);if(!old||r.valuation_date>=old.valuation_date)m.set(k,r)}return [...m.values()]}
export function fromHistorical(r:OpportunityRow):MarketRow|null{if(!r.position||!r.sub_position||r.age===null||r.minutos===null||r.market_value_in_eur===null||!r.valuation_date)return null;return {id:'historico:'+r.player_id,source:'historico',player_id:r.player_id,name:r.name,position:r.position,sub_position:r.sub_position,competition_id:r.competition_id??'',age:r.age,minutos:r.minutos,valuation_date:r.valuation_date,market_value_in_eur:r.market_value_in_eur,valor_estimado:r.valor_estimado,diferencia_pct:r.diferencia_pct,alerta_economica:true,vigente_en_corte:r.vigente_en_corte}}
