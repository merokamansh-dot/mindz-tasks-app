import json, numpy as np
from sfxlib import *
M=json.load(open('out/ep1_meta.json')); D=M['DUR']; mx=Mix(D)
# --- music: calm lo-fi bed (0-3.9) ---
chords=[(220,261.63,329.63),(174.61,220,261.63),(196,246.94,293.66),(164.81,207.65,246.94)]
for i in range(0,3):  mx.add(pad(2.2,chords[i%4],.5),i*1.1,.5)
for i,t in enumerate(np.arange(0.4,3.9,.55)): mx.add(sine([440,523,659,523][i%4],.5,.2,6),t,.35)
# --- escalation (3.9-17.0): accelerating pulse + rising arp + riser ---
t=3.9; step=.5; k=0
while t<17.0:
    mx.add(sweep(140,45,.2,.7,14),t,.55)               # kick
    if k%2==1: mx.add(lpf_fast(noise(.06,.4,60,k),9000)*1,t,.3)  # hat-ish
    arp=[220,277,330,440,330,277][k%6]*(1+.5*max(0,(t-8)/9))
    mx.add(sine(arp,.18,.25,10),t,.4)
    step=max(.17,.5-.025*(t-3.9)); t+=step; k+=1
mx.add(riser(3.2,.7,200,3600),13.8,.7)
mx.add(pad(12,(110,164.81,220),.5,.5),4.5,.35)
# --- sfx events ---
for e in M['EVENTS']:
    k=e['k']; t=e['t']
    if k=='ding': mx.add(ding(),t,.9)
    elif k=='ding2': mx.add(ding2(),t,.8)
    elif k=='ding3': mx.add(ding3(),t,.9)
    elif k=='slap': mx.add(slap(int(t*100)),t,.55,pan=((int(t*77)%3)-1)*.6)
    elif k=='pop': mx.add(pop(),t,.22,pan=((int(t*91)%3)-1)*.5)
    elif k=='tick': mx.add(tick(),t,.5)
    elif k=='thud': mx.add(thud(),t,.5)
    elif k=='cut': pass
    elif k=='scratch': mx.add(scratch(),t,.9)
# hard silence at the cut + room tone / clock ticks in the calm
mx.gate(17.0,17.5)
mx.add(roomtone(5.8,.05),17.5,1)
for i,t in enumerate(np.arange(17.8,23.3,1.0)): mx.add(tick(),t,.28)
mx.add(thud(),17.0,.0)
# thud when the sticky lands is included via events; heartbeat + riser into the close-up
for i,t in enumerate(np.arange(21.5,23.3,.62-.0)):
    mx.add(heartbeat(),t,.8); mx.add(heartbeat(),t+.19,.55)
mx.add(riser(1.8,.5,150,2400),21.5,.5)
# end sting
mx.add(sting(261.63),23.35,.9); mx.add(sparkle(),23.8,.7)
mx.add(pad(2.6,(261.63,329.63,392),.6,.3),23.35,.35)
# fade for loop
n=int(.35*SR); mx.L[-n:]*=np.linspace(1,0,n); mx.R[-n:]*=np.linspace(1,0,n)
mx.write('out/ep1_audio.wav'); print('audio ok')
