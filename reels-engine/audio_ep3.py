import json, numpy as np
from sfxlib import *
M=json.load(open('out/ep3_meta.json')); D=M['DUR']; mx=Mix(D); r=np.random.default_rng(6)
# --- 0.5-6.8 triumphant fanfare ---
bpm=124; beat=60/bpm; tt=.3; k=0
prog=[(261.63,329.63,392),(349.23,440,523.25),(392,493.88,587.33),(261.63,329.63,392)]
while tt<6.8:
    bar=(k//4)%4
    mx.add(sweep(130,45,.2,.8,13),tt,.6) if k%2==0 or k%4==3 else None
    if k%4 in (1,3): mx.add(clap(k),tt,.45)
    mx.add(lpf_fast(noise(.05,.4,70,k+30),9000),tt+beat/2,.28)
    if k%4==0: mx.add(brass(prog[bar],beat*2.2,.7),tt,.5)
    if k%4==2: mx.add(brass([f*1.5 for f in prog[bar]],beat*.8,.5),tt,.35)
    mx.add(sine(prog[bar][0]/2,beat*.9,.4,5),tt,.5)
    k+=1; tt+=beat
mx.add(riser(3.7,.6,200,3200),.5,.5)
for e in M['EVENTS']:
    kk=e['k']; t=e['t']
    if kk=='hit': mx.add(crash(1.8),t,.7); mx.add(boom(),t,.6); mx.add(brass((261.63,329.63,392,523.25),1.2,1.0),t,.7)
    elif kk=='pop': mx.add(pop(),t,.25,pan=r.uniform(-.8,.8))
    elif kk=='scratch': mx.add(scratch(),t,.9)
    elif kk=='thud': mx.add(thud(),t,.55)
    elif kk=='whoosh': mx.add(whoosh(1.0,.6),t,.5)
    elif kk=='ding3': mx.add(ding3(),t,.9)
    elif kk=='chirp': mx.add(chirp(),t,.45,pan=-.5)
    elif kk=='ding': mx.add(ding(),t,.8)
    elif kk=='ding2': mx.add(ding2(),t,.8)
    elif kk=='coin': mx.add(coin(),t,.35,pan=r.uniform(-.3,.3))
    elif kk=='hit2': mx.add(boom(),t,.5); mx.add(sparkle(),t,.6)
    elif kk=='sting': mx.add(sting(261.63),t,.9); mx.add(sparkle(),t+.4,.6); mx.add(pad(2.4,(261.63,329.63,392),.6,.3),t,.35)
# silence after the music cut: only room tone, crickets, wind
mx.gate(6.8,7.2)
# sound that survives the cut:
mx.add(roomtone(2.6,.05),7.2,1)
mx.add(scratch(),6.8,.9); mx.add(thud(),7.15,.55)
for t in np.arange(7.2,9.8,.35): mx.add(chirp(),t,.0)
# thinking music from 9.8 (gentle) and funnel bed
chs=[(220,261.63,329.63),(174.61,220,261.63),(196,246.94,293.66),(164.81,207.65,246.94)]
tt=9.8; k=0
while tt<23.0:
    ch=chs[(k//8)%4]
    if k%8==0: mx.add(pad(2.6,ch,.7,.25),tt,.4)
    mx.add(sine(ch[k%3]*2,.22,.22,9),tt,.38)
    if k%2==0: mx.add(sweep(110,45,.14,.5,18),tt,.3)
    k+=1; tt+=.32
# punchline build + resolve
mx.add(riser(1.9,.5,250,3000),23.0,.5)
tt=24.9; 
for i in range(4): mx.add(brass(prog[i%4],.45,.5),tt+i*.28,.35)
fade_end(mx,.35); mx.write('out/ep3_audio.wav'); print('ep3 audio ok')
