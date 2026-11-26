import {useSyncExternalStore} from 'react'
import type {MarketRow} from '../api/market'
import {SHORTLIST_KEY,marketKey,mergeShortlist} from '../domain/shortlist'
const EVENT='offball:shortlist'
let raw:string|null=null,cache:MarketRow[]=[]
function snapshot(){try{const next=localStorage.getItem(SHORTLIST_KEY);if(next!==raw){raw=next;const x=JSON.parse(next??'[]');cache=Array.isArray(x)?x.filter(r=>r&&typeof r.id==='string'&&typeof r.sub_position==='string'):[]}}catch{}return cache}
function subscribe(cb:()=>void){window.addEventListener(EVENT,cb);window.addEventListener('storage',cb);return()=>{window.removeEventListener(EVENT,cb);window.removeEventListener('storage',cb)}}
function commit(rows:MarketRow[]){localStorage.setItem(SHORTLIST_KEY,JSON.stringify(rows));window.dispatchEvent(new Event(EVENT))}
export function useShortlist(){const rows=useSyncExternalStore(subscribe,snapshot,snapshot);return {rows,save:(r:MarketRow)=>commit(mergeShortlist(snapshot(),[r])),saveMany:(r:MarketRow[])=>commit(mergeShortlist(snapshot(),r)),remove:(r:MarketRow)=>commit(snapshot().filter(x=>marketKey(x)!==marketKey(r))),has:(r:MarketRow)=>rows.some(x=>marketKey(x)===marketKey(r))}}
