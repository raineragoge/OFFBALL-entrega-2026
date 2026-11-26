import type { ZoneSlot } from './zones'
export type Slot={id:string;x:number;y:number;sub:string;role?:ZoneSlot;line:number}
const subs:Record<string,string>={PT:'Goalkeeper',LI:'Left-Back',LD:'Right-Back',DFC:'Centre-Back',MC:'Central Midfield',MCD:'Defensive Midfield',MI:'Left Midfield',MD:'Right Midfield',EI:'Left Winger',ED:'Right Winger',DC:'Centre-Forward',SD:'Second Striker',MCO:'Attacking Midfield'}
const make=(lines:string[][]):Slot[]=>{
 const count=lines.length;return [{id:'PT',x:50,y:91,sub:'Goalkeeper',line:0},...lines.flatMap((line,i)=>line.map((id,j)=>{const code=id.replace(/\d/g,'');const role=(['EI','ED','DC','MCO'].includes(code)?code:undefined) as ZoneSlot|undefined;return {id,x:line.length===1?50:15+70*j/(line.length-1),y:74-i*56/Math.max(1,count-1),sub:subs[code]!,role,line:i+1}}))]
}
export const formations:Record<string,Slot[]>={
 '4-3-3':make([['LI','DFC1','DFC2','LD'],['MC1','MCD','MC2'],['EI','DC','ED']]),
 '4-2-3-1':make([['LI','DFC1','DFC2','LD'],['MCD1','MCD2'],['EI','MCO','ED'],['DC']]),
 '4-4-2':make([['LI','DFC1','DFC2','LD'],['MI','MC1','MC2','MD'],['DC1','DC2']]),
 '4-4-2 rombo':make([['LI','DFC1','DFC2','LD'],['MCD'],['MC1','MC2'],['MCO'],['DC1','DC2']]),
 '3-5-2':make([['DFC1','DFC2','DFC3'],['MI','MC1','MCD','MC2','MD'],['DC1','DC2']]),
 '3-4-3':make([['DFC1','DFC2','DFC3'],['MI','MC1','MC2','MD'],['EI','DC','ED']]),
 '5-3-2':make([['LI','DFC1','DFC2','DFC3','LD'],['MC1','MCD','MC2'],['DC1','DC2']]),
 '5-4-1':make([['LI','DFC1','DFC2','DFC3','LD'],['MI','MC1','MC2','MD'],['DC']]),
 '4-1-4-1':make([['LI','DFC1','DFC2','LD'],['MCD'],['MI','MC1','MC2','MD'],['DC']]),
 '4-3-1-2':make([['LI','DFC1','DFC2','LD'],['MC1','MCD','MC2'],['MCO'],['DC1','DC2']]),
}
