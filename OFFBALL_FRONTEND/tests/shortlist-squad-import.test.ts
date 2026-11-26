import {describe,it,expect} from 'vitest'
import type {MarketRow} from '../src/api/market'
import {marketKey,mergeShortlist} from '../src/domain/shortlist'
import {freshSquad,assess} from '../src/domain/squad'
import {DEMO_CLUB,mergeClub,parseSquad,parseSquadCsv,squadCsv,playerFromMarket} from '../src/domain/squadImport'
const row:MarketRow={id:'historic:1',source:'historico',player_id:1,name:'Jugador',position:'Attack',sub_position:'Centre-Forward',competition_id:'ES1',age:22,minutos:1500,valuation_date:'2026-06-01',market_value_in_eur:1000000,valor_estimado:1500000,diferencia_pct:50,alerta_economica:true,vigente_en_corte:true}
describe('Lista de fichajes y plantilla',()=>{
 it('deduplica por fuente e ID, conserva la valoración más reciente',()=>{expect(marketKey(row)).toBe('historico:1');expect(mergeShortlist([row],[{...row,valuation_date:'2025-06-01'}])).toEqual([row]);expect(mergeShortlist([row],[{...row,valuation_date:'2026-07-01'}])[0]?.valuation_date).toBe('2026-07-01')})
 it('históricos sin estadísticas quedan pendientes',()=>{const p=playerFromMarket(row);expect(p.minutes).toBe(0);expect(assess(mergeClub(freshSquad(),[p])).find(n=>n.slot.id==='DC')?.level).toBe('revisar')})
 it('importados conservan estadísticas, no inventan nota',()=>{const p=playerFromMarket({...row,source:'importado',goles:9,asistencias:4});expect([p.minutes,p.goals,p.assists,p.rating]).toEqual([1500,9,4,null])})
 it('carga once y no duplica al repetir, conserva edición local',()=>{const s=mergeClub(freshSquad(),DEMO_CLUB);expect(Object.keys(s.lineups[s.formation]??{})).toHaveLength(11);expect(mergeClub(s,DEMO_CLUB).players).toHaveLength(11);expect(mergeClub(s,[{...DEMO_CLUB[0]!,name:'Cambio'}]).players[0]?.name).toBe(DEMO_CLUB[0]?.name)})
 it('CSV de ida y vuelta con comillas',()=>{const players=[{...DEMO_CLUB[0]!,name:'Jugador, \"A\"'}];expect(parseSquadCsv(squadCsv(players))[0]?.name).toBe(players[0]?.name);expect(()=>parseSquadCsv('id,name\n1,Jugador')).toThrow()})
 it('valida duplicados e importa por ID',()=>{expect(parseSquad(JSON.stringify(DEMO_CLUB))).toHaveLength(11);expect(()=>parseSquad(JSON.stringify([DEMO_CLUB[0],DEMO_CLUB[0]]))).toThrow();const s=mergeClub(freshSquad(),DEMO_CLUB);expect(mergeClub(s,[{...DEMO_CLUB[0]!,name:'Cambio'}],true).players[0]?.name).toBe('Cambio')})
})
