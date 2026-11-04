const finiteVector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
function distance(bounds,a,b=a){
 let squared=0;
 for(let axis=0;axis<3;axis++){
  const gap=Math.max(bounds.min[axis]-Math.max(a[axis],b[axis]),Math.min(a[axis],b[axis])-bounds.max[axis],0);squared+=gap*gap;
 }
 return squared;
}

/** Shared experiment admission policy; library traversal can further cull the
 * admitted candidates. This is a count/radius gate, not total RAM reservation. */
export function selectStreamPackages(packages,position,velocity,{radius,retainRadius,lookAheadSeconds,maxEntries,ready=new Set()}={}){
 if(!finiteVector(position)||!finiteVector(velocity))throw Error('Invalid stream focus');
 const ahead=position.map((n,i)=>n+velocity[i]*lookAheadSeconds),rows=packages.map(p=>({p,current:distance(p.bounds,position),ahead:distance(p.bounds,position,ahead)})),scores=new Map();
 for(const row of rows)scores.set(row.p.cell,Math.min(row.current,row.ahead+radius*radius*.25));
 rows.sort((a,b)=>scores.get(a.p.cell)-scores.get(b.p.cell)||a.p.cell.localeCompare(b.p.cell));
 const chosen=rows.filter(row=>Math.min(row.current,row.ahead)<=radius*radius).slice(0,maxEntries);
 for(const row of rows)if(chosen.length<maxEntries&&ready.has(row.p.cell)&&row.current<=retainRadius*retainRadius&&!chosen.includes(row))chosen.push(row);
 return {selected:chosen.map(row=>row.p),scores};
}
