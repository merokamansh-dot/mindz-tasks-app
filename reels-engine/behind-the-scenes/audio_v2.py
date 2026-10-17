import json, numpy as np
from sfxlib import *
M=json.load(open('out/ep5_meta.json')); D=M['DUR']; VA=M['SECT']['void']; VB=M['SECT']['drop']; MA=M['SECT']['mont']; END=M['END']
B=60/128.0; N=int(D*SR); rng=np.random.default_rng(21)
dry=Mix(D); wet=Mix(D)   # dry: drums/fx  |  wet: sidechained (bass, pads, arps, stabs)
kicks=[]
def kick(t,g=1.0):
    dry.add(sweep(165,46,.30,.95,7),t,g); dry.add(sine(48,.35,.6,5),t,g*.8); dry.add(noise(.01,.5,300,int(t*100)%97),t,g*.3); kicks.append(t)
def hat(t,g=.25,o=False): dry.add(hpf_fast(noise(.16 if o else .04,.5,18 if o else 90,int(t*1000)%89),7500),t,g)
def snare(t,g=.5): dry.add(clap(int(t*100)%53),t,g); dry.add(lpf_fast(noise(.12,.3,30,int(t*77)%61),3500),t,g*.5)
def bass(f,t,d=.22,g=.6):
    tt=tarr(d); x=np.sin(2*np.pi*f*tt)+.5*np.sin(4*np.pi*f*tt)+.25*np.sin(6*np.pi*f*tt); e=np.minimum(1,tt/.004)*np.exp(-tt*(2.2 if d>.3 else 6)); wet.add(np.tanh(1.6*x)*e*.55,t,g)
def pluck(f,t,g=.3,d=.22):
    tt=tarr(d); x=np.sin(2*np.pi*f*tt)+.45*np.sin(4*np.pi*f*tt)+.2*np.sin(6*np.pi*f*tt+1); wet.add(x*np.minimum(1,tt/.003)*np.exp(-tt*13)*.5,t,g)
CH_A=[(110,(220,261.63,329.63)),(87.31,(174.61,220,261.63)),(130.81,(261.63,329.63,392)),(98,(196,246.94,293.66))]   # Am F C G (build, minor)
CH_D=[(130.81,(261.63,329.63,392)),(98,(196,246.94,293.66)),(110,(220,261.63,329.63)),(87.31,(174.61,220,261.63))] # C G Am F (drop, bright)
def arpnotes(ch): return [ch[0],ch[1],ch[2],ch[1]]
# ---------------- ACT A: build (grid origin 0) ----------------
nA=int(MA/B)   # beats before montage
for i in range(nA):
    t=i*B; root,ch=CH_A[(i//4)%4]
    if i<8: kick(t,.55 if i%2 else .75)
    else: kick(t,.95)
    if i>=4: hat(t+B/2,.22+.08*(i>=16))
    if i>=12 and i%4 in (1,3): snare(t,.45)
    if i%4==0: wet.add(pad(4*B+.2,ch,.55 if i<16 else .75,.2),t,.5)
    if i>=8:
        for h in range(2): bass(root*(2 if h else 1),t+h*B/2+ (0 if h==0 else 0),.22,.55)
    if i>=16:
        for q in range(4): pluck(arpnotes(ch)[q%4]*(2 if i>=28 else 1)*(1 if q<3 else 2),t+q*B/4,.22+.08*(i>=28),.2)
    if i>=24 and i%2==1: hat(t,.18)
    if i>=32 and i%4==3:  # fill
        for q in range(4): snare(t+q*B/4,.28+.1*q)
dry.add(riser(nA*B-16*B+.1,.5,200,3600),16*B,.35)
# ---------------- MONTAGE: 8 beats, snare roll + riser ----------------
for i in range(8):
    t=MA+i*B; kick(t,1.0); kick(t+B/2,.7) if i>=4 else None; hat(t+B/2,.3); bass(110 if i<4 else 130.81,t,.2,.6)
t=MA
while t<MA+4*B: snare(t,.45); t+=B/2
while t<MA+6*B: snare(t,.55); t+=B/4
while t<VA-.02: snare(t,.65+.3*(t-MA-6*B)/(2*B)); t+=B/8
dry.add(riser(VA-MA,.7,300,5200),MA,.55)
# ---------------- events (SFX layer over the music) ----------------
mi=0
for e in M['EVENTS']:
    kk=e['k']; t=e['t']
    if kk=='slam': dry.add(snap(),t,.38); dry.add(thud(),t,.4)
    elif kk=='cut': dry.add(whoosh(.3,.5),max(0,t-.1),.38); dry.add(tick(),t,.3)
    elif kk=='mont': dry.add(blip([500,600,700,800,900,1050,1200,1400][mi%8]),t,.35); mi+=1
    elif kk=='hit': dry.add(crash(1.3),t,.5); dry.add(boom(),t,.55); wet.add(brass(CH_D[0][1],.8,.55),t,.4)
    elif kk=='boom': dry.add(boom(),t,.95); dry.add(crash(2.0),t,.6); dry.add(sparkle(),t+.1,.5)
    elif kk=='sting': dry.add(sting(261.63),t,.9); dry.add(sparkle(),t+.4,.55); wet.add(pad(3.2,CH_D[0][1],.7,.3),t,.4)
# ---------------- silence beat ----------------
dry.gate(VA,VB); wet.gate(VA,VB); dry.add(roomtone(VB-VA,.05),VA,1)
# ---------------- DROP (grid origin VB) ----------------
nD=int((END-VB)/B)
for i in range(nD):
    t=VB+i*B; root,ch=CH_D[(i//4)%4]
    kick(t,1.0); hat(t+B/2,.3,True); 
    for q in (1,3): hat(t+q*B/4,.14)
    if i%4 in (1,3): snare(t,.55)
    if i%4==0: wet.add(pad(4*B+.3,ch,.8,.2),t,.5)
    for h in range(2): bass(root*(2 if (i+h)%4==3 else 1),t+h*B/2+B/4*0,.2,.62) if h==1 else bass(root,t+B/4,.2,.6)
    for q in range(4): pluck(arpnotes(ch)[q]*(2 if (i//2)%2 else 4)/(1 if True else 1),t+q*B/4,.24,.18)
    if i%4==0 or i%4==2: wet.add(brass(ch,.32,.5),t+(0 if i%4==0 else B*.5),.3)
    if i>=24 and i%2==0: hat(t,.2)
# risers on the section builds
dry.add(riser(6*B,.45,250,3400),VB+(int((M['SCN'][-4]['a']-VB)/B)-6)*B,.4)
# ---------------- sidechain + mix ----------------
kt=np.array(sorted(kicks)); env=np.ones(N)
for k in kt:
    i=int(k*SR); L=int(.45*SR); tt=np.arange(min(L,N-i))/SR
    if len(tt): env[i:i+len(tt)]=np.minimum(env[i:i+len(tt)],1-.78*np.exp(-tt/.10))
L=dry.L+wet.L*env*.8; R=dry.R+wet.R*env*.8
tt_=np.arange(N)/SR; gc=np.interp(tt_,[0,6,MA-3,MA,VA,VB,VB+.3,END,D],[.45,.58,.85,1.0,1.0,1.15,1.3,1.3,1.1]); L=np.tanh(L*gc*.9)/.9; R=np.tanh(R*gc*.9)/.9
mx=Mix(D); mx.L=L; mx.R=R; fade_end(mx,.45); mx.write('out/ep5_audio.wav'); print('audio ok',len(kt),'kicks')
