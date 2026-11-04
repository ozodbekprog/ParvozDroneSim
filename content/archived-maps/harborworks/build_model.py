"""Original Harborworks geometry. Run with Python + NumPy; no external assets."""
import json, math, struct
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parent
MATS=[('Concrete','#8b9189',.96,0),('Asphalt','#343e43',.96,0),('Steel','#394d58',.48,.7),('Oxide','#b7603e',.72,.4),('Safety yellow','#efbd48',.65,.2),('Ivory','#d9d5bc',.8,0),('Teal','#388e95',.62,.4),('Sea','#285969',.3,.25),('Timber','#8c6846',.94,0),('Rubber','#232d31',.96,0),('Glazing','#72a1af',.24,.45),('Red','#c74535',.65,.2),('Light','#fff1bd',.3,0),('Moss','#567b66',1,0),('Dark concrete','#596466',.94,0),('Blue','#406987',.65,.4)]
verts=[[] for _ in MATS]; normals=[[] for _ in MATS]; colliders=[]; count=0
def tri(a,b,c,m):
    a,b,c=map(lambda v:np.asarray(v,float),(a,b,c)); n=np.cross(b-a,c-a); l=np.linalg.norm(n)
    if l<1e-9:return
    verts[m].extend([a.tolist(),b.tolist(),c.tolist()]); normals[m].extend([(n/l).tolist()]*3)
def box(p,s,m=0,collision=False):
    global count
    count+=1;p=np.array(p);s=np.array(s)
    v=[p+s*np.array(q)*.5 for q in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    for a,b,c,d in [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)]:tri(v[a],v[b],v[c],m);tri(v[a],v[c],v[d],m)
    if collision:colliders.append(dict(position=p.tolist(),size=s.tolist()))
def beam(a,b,r,m=2,sides=8,collision=False):
    a=np.array(a,float);b=np.array(b,float);d=b-a;d/=np.linalg.norm(d)
    u=np.cross(d,[0,1,0] if abs(d[1])<.9 else [1,0,0]);u/=np.linalg.norm(u);v=np.cross(d,u)
    rings=[[p+r*(u*math.cos(i*2*math.pi/sides)+v*math.sin(i*2*math.pi/sides)) for i in range(sides)] for p in [a,b]]
    for i in range(sides):
        j=(i+1)%sides
        tri(rings[0][i],rings[0][j],rings[1][j],m);tri(rings[0][i],rings[1][j],rings[1][i],m)
        tri(a,rings[0][j],rings[0][i],m);tri(b,rings[1][i],rings[1][j],m)
    if collision:colliders.append(dict(position=((a+b)/2).tolist(),size=(np.maximum(.01,np.abs(b-a)+2*r*np.sqrt(np.maximum(0,1-d*d)))).tolist()))
def cylinder(x,y,z,r,h,m=2,collision=True,sides=24):beam([x,y-h/2,z],[x,y+h/2,z],r,m,sides,collision)
def rail(a,b,y=1.3):
    beam([a[0],y,a[1]],[b[0],y,b[1]],.055,4)
    beam([a[0],y*.55,a[1]],[b[0],y*.55,b[1]],.035,2)
    n=max(1,int(math.dist(a,b)/3))
    for i in range(n+1):
        p=np.array(a)+(np.array(b)-a)*i/n;beam([p[0],0,p[1]],[p[0],y,p[1]],.055,2)
def pallet(x,z,y=0):
    for dx in [-.65,.65]:box([x+dx,y+.14,z],[.15,.28,1.4],8)
    for dz in np.linspace(-.62,.62,6):box([x,y+.3,z+dz],[1.6,.12,.17],8)
def container(x,z,m=6,y=0,length=12):
    box([x,y+1.45,z],[5.5,2.9,length],m,True)
    for zz in np.arange(z-length/2+.3,z+length/2,.48):
        for xx in [x-2.77,x+2.77]:box([xx,y+1.45,zz],[.06,2.62,.1],m)
    for xx in [x-2.65,x+2.65]:
        for yy in [y+.12,y+2.8]:box([xx,yy,z],[.16,.17,length],2)
    for xx in [x-1.3,x+1.3]:
        box([xx,y+1.45,z+length/2+.035],[2.5,2.63,.09],m)
        beam([xx,y+.3,z+length/2+.11],[xx,y+2.6,z+length/2+.11],.045,5)
        box([xx+.22,y+1.3,z+length/2+.16],[.42,.08,.08],2)
    box([x,y+2.2,z+length/2+.1],[1.1,.25,.03],5)

# Raised land and a deeply coloured east basin. Surface seams establish scale.
box([-20,-1,0],[150,2,170],0,True)
box([88,-1.3,0],[66,.25,220],7)
box([-8,.018,0],[94,.035,140],1)
for x in np.arange(-92,53,12):box([x,.024,0],[.035,.012,169],14)
for z in np.arange(-80,85,12):box([-20,.024,z],[148,.012,.035],14)
for z in np.arange(-66,70,8):box([7,.05,z],[.16,.03,3.6],5)
for z in [-68,68]:box([-8,.05,z],[94,.03,.16],4)
for x in [-85,48]:
    for z in np.arange(-75,80,10):box([x,.15,z],[.45,.3,7],14)
# Quay: stone edge, mooring hardware, fenders, access piers.
box([54,-.5,0],[2,3,170],14,True)
for z in range(-76,80,8):
    cylinder(52,.35,z,.24,.7,2);beam([51.5,.6,z],[52.5,.6,z],.14,2)
    box([55.15,-.1,z],[.32,1.4,.85],9)
    box([53.4,1.03,z],[.5,.06,3],4)
for z in [-57,57]:
    box([68,.0,z],[27,.7,8],0,True)
    for x in [59,68,77]:cylinder(x,-2,z, .45,4,14)
    rail([57,z-3.7],[80,z-3.7]);rail([57,z+3.7],[80,z+3.7])
# Workshop: fully traversable central aisle and open 10m portals at both ends.
for x in [-50,-22]:box([x,6,0],[.5,12,40],14,True)
for z in [-20,20]:
    for x in [-45.3,-26.7]:box([x,5,z],[9,10,.5],6,True)
    box([-36,11,z],[28,2,.5],6,True)
    for x in [-41.2,-30.8]:box([x,5,z],[.25,10,.8],4,True)
    box([-36,10,z],[10.7,.3,.8],4,True)
    box([-36,11.2,z+(.3 if z>0 else -.3)],[8,.7,.06],5)
    # Horizontal door slats and structural corner pieces.
    for yy in np.arange(.6,9.8,.55):
        for x in [-45.3,-26.7]:box([x,yy,z+.28],[8.6,.045,.08],2)
for z in [-18,-9,0,9,18]:
    for x in [-49.5,-22.5]:box([x,6,z],[.38,12,.45],2,True)
    box([-36,11.8,z],[28,.35,.3],2,True)
    beam([-49,11.6,z],[-36,15,z],.17,2);beam([-36,15,z],[-23,11.6,z],.17,2)
    for x in [-44,-28]:box([x,10.9,z],[2.8,.1,.25],12)
for x in np.arange(-49,-22,.65):
    y=15-abs(x+36)*.23;box([x,y,0],[.68,.12,42],2,True)
    if abs(x+36)>3:box([x,y+.07,0],[.035,.04,42],14)
# Each narrow pitched-roof strip has a matching solid collision proxy.
# Side windows, benches, tool boards, welding booth, shelves, gantry hoist.
for z in [-13,-5,5,13]:
    for x in [-49.72,-22.28]:
        box([x,7.5,z],[.06,2.4,4.5],10)
        for dz in [-2.25,0,2.25]:box([x,7.5,z+dz],[.09,2.5,.07],5)
for z in [-12,-4,6,13]:
    box([-47.5,1.3,z],[3,2.6,4],2,True);box([-47.5,2.65,z],[3.2,.16,4.2],8)
    box([-49.65,3.8,z],[.1,1.8,3.7],8)
    for dz in [-1,-.5,0,.5,1]:beam([-49.53,3.3,z+dz],[-49.53,4.1,z+dz],.06,2)
    for dx in [-.8,0,.8]:box([-47.5+dx,2.92,z],[.5,.4,.7],3)
for z in [-12,9]:
    for yy in [1,3,5]:
        box([-24.5,yy,z],[3,.15,6],2,True)
        for dz in [-2,0,2]:box([-24.5,yy+.55,z+dz],[1.8,1,1.5],8,True)
    for dz in [-3,3]:box([-24.5,3,z+dz],[.15,6,.15],4,True)
box([-36,9.6,2],[25,.55,.5],4,True)
box([-36,9.1,2],[2,.7,1.1],2,True)
beam([-36,8.8,2],[-36,6.8,2],.055,2)
# Outdoor pipe rack connecting workshop to utility plant, with a high clear arch.
for x in [-12,22]:
    for z in [26,30]:box([x,5,z],[.4,10,.4],2,True)
    box([x,10,28],[.6,.35,6],2,True)
for z in [26.7,28,29.3]:beam([-21,10.5,z],[26,10.5,z],.26,3,12,True)
# Tank farm on southeast side, with ring detail, stairs and valves.
for x,z,r,h in [(29,43,4.5,12),(42,43,4,9),(29,59,3.7,8)]:
    cylinder(x,h/2,z,r,h,5)
    for yy in [1,h*.45,h-.5]:cylinder(x,yy,z,r+.05,.12,2,False)
    cylinder(x,h+.15,z,r*.9,.25,2,False)
    beam([x+r+.4,0,z],[x+r+.4,h+.8,z],.055,2)
    beam([x+r+.4,0,z+.65],[x+r+.4,h+.8,z+.65],.055,2)
    for yy in np.arange(.3,h,.35):beam([x+r+.4,yy,z],[x+r+.4,yy,z+.65],.04,4)
    beam([x,1,z-r],[x,1,z-r-3],.25,3)
    cylinder(x,1.8,z-r-2,.22,.6,11,False)
# Northern container precinct: stacked rows and generous slalom corridors.
for x,z,m in [(-70,-43,3),(-57,-48,15),(-42,-48,6),(-26,-45,3),(-12,-50,15),(22,-49,6),(36,-49,3),(23,-66,15)]:
    container(x,z,m)
for x,z,m in [(-70,-43,6),(-42,-48,3),(36,-49,15)]:container(x,z,m,2.9)
for x,z in [(-61,32),(-64,35),(-59,36),(-9,-38),(33,-35)]:
    pallet(x,z)
    box([x,.95,z],[1.45,1.15,1.25],8,True)
    for dz in [-.55,.55]:box([x,1,z+dz],[1.5,.08,.05],2)
# Two iconic yellow portal cranes, open beneath their 18m crossheads.
for z in [-18,16]:
    for x in [35,49]:
        box([x,8.7,z],[.8,17.4,1.2],4,True)
        box([x,.55,z],[2.2,1.1,4.8],2,True)
        for dz in [-1.5,1.5]:cylinder(x,.35,z+dz,.45,.7,9,False)
        beam([x,2,z-2],[x,14,z],.14,4)
    box([46,18,z],[29,1.1,1.5],4,True)
    for xx in np.arange(33,60,3):beam([xx,17.4,z-.7],[xx+2,18.6,z-.7],.09,2)
    box([54,16.4,z],[3,2.4,2.5],4,True)
    box([54,16.5,z+1.26],[2.5,1.4,.04],10)
    beam([58,17,z],[58,7,z],.045,2)
    beam([58,7,z],[58.5,6.5,z],.12,2)
# Crane rails and yard lights.
for x in [35,49]:box([x,.07,-1],[.16,.12,61],2)
for x,z in [(-78,-65),(-77,55),(16,-74),(18,70),(48,-73)]:
    cylinder(x,7,z,.12,14,2)
    beam([x,14,z],[x+3,14,z],.1,2)
    box([x+3,13.9,z],[1,.16,.7],12)
# Office facade, rooftop HVAC, exterior stair tower and panoramic control room.
box([-70,4.5,8],[17,9,22],5,True)
box([-70,9.2,8],[18,.4,23],2,True)
for y in [2.6,6.5]:
    for z in [0,5,10,15]:
        box([-61.45,y,z],[.06,2.2,3.3],10)
        box([-61.38,y,z],[.08,2.3,.06],2)
for x in [-75,-66]:box([x,10,8],[3,1.3,3],14,True)
for i in range(18):box([-57, .15+i*.24,17-i*.48],[3,.3,.55],2,True)
box([-57,4.4,8],[3,.25,3],2,True)
# Harbour signal tower, stripes visible across the entire map.
cylinder(75,7,57,1.5,14,5)
for y in [3,7,11]:cylinder(75,y,57,1.52,1.8,11,False)
cylinder(75,14.3,57,2,.6,2,False)
cylinder(75,15.1,57,1.3,1.2,12,False)
beam([75,15.5,57],[75,18,57],.07,2)
# Service boat in basin, deckhouse, rails, exhaust and cargo deck.
box([77,-.05,-20],[11,2,27],3,True)
box([77,1,-20],[10.5,.35,26],2,True)
box([77,3,-27],[7,4,6],5,True)
box([77,4,-23.9],[5.8,1.5,.08],10)
box([77,5.2,-27],[8,.3,7],2,True)
cylinder(79,6,-28,.35,2,2)
for x in [72,82]:
    beam([x,2,-32],[x,2,-8],.06,5)
    for z in range(-32,-7,3):beam([x,1,z],[x,2,z],.05,5)
for z in [-18,-13]:box([77,1.8,z],[6,1.3,3],8,True)
# Low clutter and painted service zones support readable altitude and speed.
for x,z in [(-8,48),(-5,48),(16,-37),(-78,-23),(-73,41)]:
    cylinder(x,.65,z,.42,1.3,3,True,16)
    for y in [.2,1.1]:cylinder(x,y,z,.44,.08,2,False,16)
for x in [-17,16]:
    for z in [40,48,56]:
        box([x,.05,z],[9,.03,.12],5)
for z in range(-75,77,4):
    box([-93,1.2,z],[.09,2.4,.09],2)
    beam([-93,2.3,z],[-93,2.3,min(z+4,80)],.03,2)
for x,z in [(-86,68),(-83,-69),(-80,40),(-88,-20)]:
    box([x,.12,z],[3.2,.2,2.6],13)
# Launch pad, concentric square markings and direction chevrons.
box([0,.08,52],[10,.16,10],14,True)
for x in [-3,3]:box([x,.17,52],[.22,.02,6],4)
for z in [49,55]:box([0,.17,z],[6,.02,.22],4)
box([0,.17,52],[4,.02,.25],5)

def save_glb():
    binary=bytearray();accessors=[];views=[];meshes=[];nodes=[]
    def attr(a):
        a=np.asarray(a,dtype='<f4');offset=len(binary);binary.extend(a.tobytes())
        views.append(dict(buffer=0,byteOffset=offset,byteLength=a.nbytes,target=34962))
        accessors.append(dict(bufferView=len(views)-1,componentType=5126,count=len(a),type='VEC3',min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist()))
        return len(accessors)-1
    materials=[]
    for i,(name,color,rough,metal) in enumerate(MATS):
        rgb=[int(color[j:j+2],16)/255 for j in [1,3,5]]
        mat=dict(name=name,pbrMetallicRoughness=dict(baseColorFactor=rgb+[1],metallicFactor=metal,roughnessFactor=rough))
        if i==12:mat['emissiveFactor']=[.5,.43,.25]
        materials.append(mat)
        if verts[i]:
            meshes.append(dict(name=name,primitives=[dict(attributes=dict(POSITION=attr(verts[i]),NORMAL=attr(normals[i])),material=i)]))
            nodes.append(dict(name='Harborworks '+name,mesh=len(meshes)-1))
    doc=dict(asset=dict(version='2.0',generator='Harborworks original procedural authoring'),scene=0,scenes=[dict(nodes=list(range(len(nodes))))],nodes=nodes,meshes=meshes,materials=materials,buffers=[dict(byteLength=len(binary))],bufferViews=views,accessors=accessors)
    jb=json.dumps(doc,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4)
    total=12+8+len(jb)+8+len(binary)
    (ROOT/'model.glb').write_bytes(struct.pack('<III',0x46546c67,2,total)+struct.pack('<II',len(jb),0x4e4f534a)+jb+struct.pack('<II',len(binary),0x004e4942)+binary)
    print(f'{total:,} bytes; {sum(len(v) for v in verts)//3:,} triangles; {len(meshes)} material batches; {len(colliders)} collision boxes')
save_glb()
(ROOT/'collision.json').write_text(json.dumps(colliders,separators=(',',':'))+'\n')
definition=dict(id='harborworks',name='Harborworks',region='Tidewater Industrial Port',theme='custom',seed=927,description='A working tidal port: thread the tool-lined workshop, dive beneath yellow quay cranes and weave stacked containers beside the harbour beacon.',sky='#a9c2cc',fog='#a9bcc2',ground='#8b9189',sun='#fff1d5',sunPosition=[-55,85,35],cloudColor='#e1e8e6',wind=[.55,0,.25],gravity=1,groundPlane=False,materials=[],colliders=[],objects=[])
(ROOT/'map.json').write_text(json.dumps(definition,indent=2)+'\n')
def course(id,name,points,width,height,laps):
    gates=[]
    for i,p in enumerate(points):
        prev=points[i-1];nxt=points[(i+1)%len(points)]
        yaw=math.atan2(nxt[0]-prev[0],nxt[2]-prev[2])
        gates.append(dict(position=p,yaw=yaw,width=width,height=height))
    p=points[0];yaw=gates[0]['yaw'];spawn=[p[0]-math.sin(yaw)*9,p[1],p[2]-math.cos(yaw)*9]
    folder=ROOT.parent.parent/'races'/id;folder.mkdir(parents=True,exist_ok=True)
    (folder/'race.json').write_text(json.dumps(dict(id=id,name=name,map='harborworks',laps=laps,spawn=dict(position=spawn,yaw=yaw),gates=gates),indent=2)+'\n')
course('harborworks-dock-circuit','Quayside Circuit',[[0,4,52],[-16,4,36],[-36,4,27],[-36,4,12],[-36,4,-12],[-36,4,-29],[-3,5,-29],[19,5,-28],[42,6,-28],[42,6,-18],[42,6,16],[17,5,30],[10,4,49]],7,5,2)
course('harborworks-high-tide','High Tide Technical',[[0,5,-61],[-19,6,-63],[-55,8,-65],[-59,7,-30],[-36,6,-27],[-36,6,-8],[-36,6,27],[-15,7,27],[8,7,35],[20,14,37],[43,16,44],[43,21,16],[43,21,-18],[19,8,-34]],6,4,2)

# A real orthographic rendering of this geometry for the map selection card.
# Pillow is optional; it is not required to regenerate the GLB or courses.
try:
    from PIL import Image, ImageDraw
    eye=np.array([.85,1.2,1.1]);eye/=np.linalg.norm(eye)
    right=np.cross([0,1,0],eye);right/=np.linalg.norm(right);up=np.cross(eye,right)
    pixels=np.full((1000,1400,3),[169,194,204],dtype=np.uint8);depth=np.full((1000,1400),-1e9)
    light=np.array([-.4,.9,.3]);light/=np.linalg.norm(light)
    for mi,vv in enumerate(verts):
        base=np.array([int(MATS[mi][1][j:j+2],16) for j in [1,3,5]])
        for k in range(0,len(vv),3):
            pts=np.array(vv[k:k+3]);n=np.array(normals[mi][k])
            if np.dot(n,eye)<=0:continue
            shade=.55+.45*max(0,np.dot(n,light));color=tuple(np.clip(base*shade,0,255).astype(int))
            xy=[(700+np.dot(p,right)*5.5,530-np.dot(p,up)*5.5) for p in pts]
            x0=max(0,int(min(p[0] for p in xy)));x1=min(1399,int(max(p[0] for p in xy))+1)
            y0=max(0,int(min(p[1] for p in xy)));y1=min(999,int(max(p[1] for p in xy))+1)
            if x1<x0 or y1<y0:continue
            (ax,ay),(bx,by),(cx,cy)=xy;den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
            if abs(den)<1e-9:continue
            yy,xx=np.mgrid[y0:y1+1,x0:x1+1];xx=xx+.5;yy=yy+.5
            wa=((by-cy)*(xx-cx)+(cx-bx)*(yy-cy))/den
            wb=((cy-ay)*(xx-cx)+(ax-cx)*(yy-cy))/den;wc=1-wa-wb
            zz=wa*np.dot(pts[0],eye)+wb*np.dot(pts[1],eye)+wc*np.dot(pts[2],eye)
            old=depth[y0:y1+1,x0:x1+1];mask=(wa>=0)&(wb>=0)&(wc>=0)&(zz>old)
            old[mask]=zz[mask];pixels[y0:y1+1,x0:x1+1][mask]=color
    im=Image.fromarray(pixels)
    im.resize((1120,800),Image.Resampling.LANCZOS).save(ROOT/'thumbnail.png')
except ImportError:
    print('Pillow unavailable: thumbnail unchanged.')
