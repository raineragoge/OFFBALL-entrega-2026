import {describe,it,expect} from 'vitest'
import {formations} from '../src/domain/formations'
import {assess,freshSquad,type ClubPlayer} from '../src/domain/squad'
const p:ClubPlayer={id:'p',name:'Prueba',sub:'Centre-Forward',minutes:900,goals:1,assists:0,rating:5,updated:'2026-11-26'}
describe('Mi plantilla',()=>{
 it('cada formación contiene once puestos únicos y válidos',()=>{for(const slots of Object.values(formations)){expect(slots).toHaveLength(11);expect(new Set(slots.map(s=>s.id)).size).toBe(11);expect(slots.every(s=>!!s.sub)).toBe(true)}})
 it('detecta vacantes, bajo rendimiento y actualizaciones',()=>{const s=freshSquad();expect(assess(s).filter(n=>n.level==='vacante')).toHaveLength(11);s.players=[p];s.lineups[s.formation]={DC:p.id};const get=()=>assess(s).find(n=>n.slot.id==='DC');expect(get()?.level).toBe('prioridad');s.players=[{...p,goals:5,rating:8}];expect(get()?.level).toBe('correcto');s.players=[{...p,minutes:45}];expect(get()?.level).toBe('revisar')})
 it('no usa goles para evaluar defensas y pide una valoración cuando falta',()=>{const s=freshSquad();s.players=[{...p,sub:'Centre-Back',goals:0,rating:null}];s.lineups[s.formation]={DFC1:p.id};expect(assess(s).find(n=>n.slot.id==='DFC1')?.level).toBe('revisar');s.players=[{...s.players[0]!,rating:8}];expect(assess(s).find(n=>n.slot.id==='DFC1')?.level).toBe('correcto')})
})
