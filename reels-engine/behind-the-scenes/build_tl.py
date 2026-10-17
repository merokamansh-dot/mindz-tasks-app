import json, math, subprocess, os, shutil, sys
B=60/128.0
G24="eq=contrast=1.22:brightness=-0.045:saturation=1.5:gamma=0.95,colorbalance=rs=-.03:bs=.06:rh=-.02:bh=.04"
GWA="hqdn3d=2:1:3:3,eq=contrast=1.07:saturation=1.14:brightness=-0.01,colorbalance=bs=.03"
SC="scale=1080:1920:flags=lanczos"; SH="unsharp=5:5:.55:5:5:0"
P24=f"{SC},{G24},{SH}"; PWA=f"{GWA},{SC},{SH}"
def crop(w,h,x,y=0,g=G24): return f"crop={w}:{h}:{x}:{y},{SC},{g},{SH}"
L=lambda g=GWA: f"scale=900:506:flags=lanczos,{g}"
CARD=f"scale=960:540:flags=lanczos,{GWA}"
# (id, type, beats, [(shot_id, src, ss, vf)])
T=[
 ('wire','full',6,[('wire','20241107_001534.mp4',0.2,P24)]),
 ('arch','full',3,[('arch','20241107_002322.mp4',0.0,P24)]),
 ('arch2','full',3,[('arch2','20241107_002322.mp4',7.0,P24)]),
 ('stk','stack',6,[('stk1','VID-20260718-WA0030.mp4',3.0,L()),('stk2','VID-20260718-WA0013.mp4',14.4,L())]),
 ('kneel','full',5,[('kneel','VID-20260718-WA0025.mp4',1.8,PWA)]),
 ('wrap','full',6,[('wrap','20241107_010903.mp4',0.0,P24)]),
 ('banner','full',4,[('banner','20241107_003719.mp4',2.0,P24)]),
 ('curve','full',4,[('curve','20241107_001534.mp4',7.3,P24)]),
 ('ladder','full',4,[('ladder','20241107_013256.mp4',0.0,crop(608,1080,420))]),
 ('mk1','full',1,[('mk1','VID-20260718-WA0013.mp4',15.3,crop(324,576,298,0,GWA))]),
 ('mk2','full',1,[('mk2','20241107_001534.mp4',3.4,P24)]),
 ('mk3','full',1,[('mk3','20241107_010903.mp4',9.8,P24)]),
 ('mk4','full',1,[('mk4','20241107_002322.mp4',8.3,P24)]),
 ('mk5','full',1,[('mk5','VID-20260718-WA0025.mp4',4.2,PWA)]),
 ('mk6','full',1,[('mk6','VID-20260718-WA0028.mp4',0.0,crop(324,576,340,0,GWA))]),
 ('mk7','full',1,[('mk7','VID-20260718-WA0025.mp4',2.4,PWA)]),
 ('mk8','full',1,[('mk8','20241107_013256.mp4',13.0,crop(608,1080,656))]),
 ('void','void',1.5,[]),
 ('r1','full',7,[('r1','VID-20260718-WA0091.mp4',0.0,PWA)]),
 ('r2','full',6,[('r2','VID-20260718-WA0091.mp4',4.0,PWA)]),
 ('r3','full',4,[('r3','VID-20260718-WA0085.mp4',0.0,PWA)]),
 ('r4','card',5,[('r4','VID-20260718-WA0028.mp4',2.6,CARD)]),
 ('r5','full',7,[('r5','VID-20260718-WA0091.mp4',17.5,PWA)]),
 ('r6','full',6,[('r6','20250925_083020.mp4',10.5,crop(712,1266,0,279,"eq=contrast=1.1:saturation=1.15"))]),
 ('r7','full',5,[('r7','20250925_083020.mp4',44.0,crop(712,1266,0,279,"eq=contrast=1.1:saturation=1.15"))]),
 ('r8','full',5,[('r8','20250925_083020.mp4',50.0,crop(712,1266,0,279,"eq=contrast=1.1:saturation=1.15"))]),
]
t=0; SCN=[]; shots=[]
for sid,typ,b,sh in T:
    d=b*B; n=math.ceil(d*30)+1
    SCN.append({'id':sid,'type':typ,'a':round(t,5),'b':round(t+d,5),'n':n,'srcs':[s[0] for s in sh]})
    for s in sh: shots.append((s,d,n))
    t+=d
END=t; DUR=round(END+4.45,3)
open('timeline.js','w').write('const SCN='+json.dumps(SCN)+';const END='+str(round(END,5))+';window.DUR='+str(DUR)+';const BEAT='+str(B)+';\n')
print('END',END,'DUR',DUR,'scenes',len(SCN))
if len(sys.argv)>1 and sys.argv[1]=='prep':
    only=sys.argv[2:]
    for (sid,src,ss,vf),d,n in shots:
        if only and sid not in only: continue
        out=f'frames/{sid}'; shutil.rmtree(out,ignore_errors=True); os.makedirs(out)
        subprocess.run(['ffmpeg','-v','error','-y','-ss',str(ss),'-t',str(d+.3),'-i',f'raw/{src}','-an','-vf',f'fps=30,{vf}','-frames:v',str(n),'-q:v','2',f'{out}/%04d.jpg'],check=True)
        print(sid,len(os.listdir(out)),flush=True)
