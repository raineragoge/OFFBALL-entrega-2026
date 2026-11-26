import {marketDetailUrl,type MarketRow} from '../../api/market'
import {marketKey} from '../../domain/shortlist'
import {navigate} from '../../router/router'
import {useShortlist} from '../../state/shortlist'
import {useToast} from '../ui/toast'
import {Button} from '../ui/primitives'
export function QuickActions({row,hideDetail=false}:{row:MarketRow;hideDetail?:boolean}){const list=useShortlist(),toast=useToast();function save(target?:string){try{list.save(row);if(target)navigate(`${target}?candidato=${encodeURIComponent(marketKey(row))}`);else toast('Jugador guardado en tu lista de fichajes.')}catch{toast('No se pudo guardar en el navegador.','warn')}}return <div className="flex flex-wrap gap-1">{!hideDetail&&<Button size="sm" variant="ghost" onClick={()=>navigate(marketDetailUrl(row))}>Analizar ficha ↗</Button>}<Button size="sm" variant="secondary" disabled={list.has(row)} onClick={()=>save()}>{list.has(row)?'◆ Guardado':'＋ Guardar'}</Button><Button size="sm" variant="ghost" onClick={()=>save('/tactica')}>Probar tácticamente</Button><Button size="sm" variant="ghost" onClick={()=>save('/plantilla')}>Añadir a plantilla</Button></div>}
