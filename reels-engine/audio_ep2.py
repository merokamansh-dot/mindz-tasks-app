import json, numpy as np
from sfxlib import *
M=json.load(open('out/ep2_meta.json')); D=M['DUR']; mx=Mix(D); r=np.random.default_rng(4)
pent=[523,587,659,784,880,1046,1175,1318]
# --- 0-11 cacophony: ad jingles + sirens + whooshes, intensity ramps ---
t=0.2
while t<11.0:
    f=pent[r.integers(len(pent))]*[1,.5,2][r.integers(3)]
    mx.add(sine(f,.18,.22,12),t,.5,pan=r.uniform(-.8,.8))
    if r.random()<.35: mx.add(sine(f*1.5,.14,.18,14),t+.07,.4,pan=r.uniform(-.8,.8))
    if r.random()<.18: mx.add(sweep(500,1500,.5,.2,3),t,.35,pan=r.uniform(-.9,.9))
    t+=max(.07,.28-.02*t)*r.uniform(.6,1.3)
for tt in np.arange(0.1,10.8,.55): mx.add(whoosh(.7,.5),tt,.38+.2*(tt<4),pan=r.uniform(-.8,.8))
mx.add(pad(11,(110,130.81,164.81),.6,.7),0,.4)
for tt in np.arange(0.3,11.0,.46): mx.add(sweep(130,50,.15,.5,16),tt,.4)  # driving kick
mx.add(riser(2.4,.5,200,2600),8.6,.5)
# --- freeze (11.0): everything drops out ---
mx.gate(11.0,12.7)
mx.add(sweep(900,60,.9,.35,0),11.0,.55)           # sucked-out
mx.add(pad(1.7,(98,146.83),.6,.2),11.0,.35)
for tt in np.arange(11.5,12.7,.6): mx.add(tick(),tt,.35)
mx.add(riser(1.0,.35,300,3000),11.75,.5)
# --- transformation: clean, confident music ---
mx.add(snap(),12.7,.9); mx.add(boom(),12.75,.7); mx.add(sparkle(),12.9,.6)
chs=[(220,277.18,329.63),(196,246.94,293.66),(174.61,220,261.63),(196,246.94,293.66)]
tt=12.9; k=0
while tt<26.8:
    ch=chs[(k//4)%4]
    if k%4==0: mx.add(pad(2.0,ch,.7,.25),tt,.45)
    mx.add(sweep(120,45,.18,.6,14),tt,.4) if k%2==0 else None
    mx.add(sine(ch[k%3]*2,.2,.25,9),tt+.0,.4)
    k+=1; tt+=.28
for e in M['EVENTS']:
    k=e['k']; t=e['t']
    if k=='flip': mx.add(blip(660+ (t-13.1)*180),t,.5)
    elif k=='chip': mx.add(ding(),t,.8)
    elif k=='hit': mx.add(thud(),t,.4)
    elif k=='sting': mx.add(sting(261.63),t,.9); mx.add(sparkle(),t+.4,.6); mx.add(pad(2.4,(261.63,329.63,392),.6,.3),t,.35)
    elif k=='whoosh' and False: pass
mx.add(whoosh(1.0,.6),22.0,.5)
# duck music at 22.5–26.8 (takeaway): leave pad only by attenuating the busy layers
t_=np.arange(len(mx.L))/SR
gain=np.where(t_<11.0,1.45,np.where(t_<12.7,.5,np.where(t_<22.5,.7,.5)))
k_=int(.05*SR); gain=np.convolve(gain,np.ones(k_)/k_,mode='same'); mx.L*=gain; mx.R*=gain
fade_end(mx,.35); mx.write('out/ep2_audio.wav'); print('ep2 audio ok')
