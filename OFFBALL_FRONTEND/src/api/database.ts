import { getClient } from './client'
import type { EconomicPayload, EconomicResult, OffensiveResult } from './types'
export interface ImportedPlayer extends EconomicPayload { player_id: string; name: string; height_in_cm?: number | null; foot?: string | null }
export interface DatabaseRow { id: string; player: ImportedPlayer; economic: EconomicResult; offensive: OffensiveResult | null }
export interface ImportResult {total:number; valid:number; inserted:number; updated:number; errors:{row:number;error:string}[]; error_count:number; committed:boolean; sample:ImportedPlayer[]}
export interface ImportHistory {id:number;at:string;filename:string;inserted:number;updated:number;errors:number}
async function request<T>(path:string, init?:RequestInit):Promise<T> {
  const res=await fetch(`${getClient().baseUrl}/api/v1/database${path}`,init)
  const data=await res.json()
  if(!res.ok) throw new Error(typeof data.detail==='string'?data.detail:`Error HTTP ${res.status}`)
  return data as T
}
export const importPlayers=(filename:string,format:'csv'|'json',content:string,preview:boolean)=>request<ImportResult>('/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename,format,content,preview})})
export const listPlayers=(alerts=false,q='',offset=0,limit=100,latest=true)=>request<{total:number;results:DatabaseRow[]}>(`/players?${new URLSearchParams({alerts:String(alerts),q,offset:String(offset),limit:String(limit),latest:String(latest)})}`)
export const importHistory=()=>request<ImportHistory[]>('/history')
