import numpy as np, wave, subprocess, os
SR=44100
def tarr(d): return np.arange(int(SR*d))/SR
def env(t,a=.005,dec=8): return np.minimum(1,t/a)*np.exp(-t*dec)
def sine(f,d,amp=.3,dec=8,a=.005): t=tarr(d); return np.sin(2*np.pi*f*t)*env(t,a,dec)*amp
def sweep(f0,f1,d,amp=.3,dec=0,a=.01):
    t=tarr(d); f=f0+(f1-f0)*(t/d); ph=2*np.pi*np.cumsum(f)/SR; return np.sin(ph)*env(t,a,dec)*amp
def noise(d,amp=.3,dec=20,seed=1):
    r=np.random.default_rng(seed); t=tarr(d); return r.standard_normal(len(t))*env(t,.002,dec)*amp
def lp(x,fc):
    a=np.exp(-2*np.pi*fc/SR); y=np.zeros_like(x); s=0
    for i in range(len(x)): s=(1-a)*x[i]+a*s; y[i]=s
    return y
def lpf_fast(x,fc):  # FFT brickwall-ish for speed
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); X*=1/(1+(f/fc)**4); return np.fft.irfft(X,len(x))
def hpf_fast(x,fc):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); X*=1-1/(1+(f/fc)**4); return np.fft.irfft(X,len(x))
def ov(*parts):
    n=max(int(SR*o)+len(x) for x,o in parts); out=np.zeros(n)
    for x,o in parts: i=int(SR*o); out[i:i+len(x)]+=x
    return out
def ding(base=1318,amp=.35): return ov((sine(base,.5,amp,6),0),(sine(base*1.335,.5,amp*.8,6),.11))
def ding2(): return ov((sine(988,.4,.3,7),0),(sine(1318,.3,.28,8),.09))
def ding3(): return ov((sine(740,.7,.34,4),0),(sine(554,.6,.32,4),.12))
def slap(seed=1): return ov((lpf_fast(noise(.09,.55,45,seed),3000),0),(sweep(190,70,.12,.5,22),0))
def pop(): return sweep(700,180,.07,.28,30)
def tick(): return ov((noise(.012,.5,200,3),0),(sine(2400,.02,.2,150),0))
def thud(): return ov((sweep(110,45,.35,.7,9),0),(lpf_fast(noise(.2,.25,25,4),600),0))
def cut(): return ov((sweep(260,35,.45,.7,6),0),(lpf_fast(noise(.3,.3,10,2),400),0))
def scratch():
    t=tarr(.32); n=np.random.default_rng(8).standard_normal(len(t)); f=1500+1800*np.sin(2*np.pi*7*t)
    x=hpf_fast(n,900)*np.exp(-t*5)*.6; return ov((x,0),(sweep(900,300,.25,.25,6),0))
def heartbeat(): return np.r_[sweep(80,48,.22,.8,13), np.zeros(int(SR*.12))][:int(SR*.3)]*1 if False else sweep(80,48,.22,.8,13)
def riser(d,amp=.4,f0=200,f1=3000):
    t=tarr(d); r=np.random.default_rng(5).standard_normal(len(t)); p=(t/d)
    n=hpf_fast(r,400)*p**2.2*amp*.5; s=sweep(f0,f1,d,amp*.6,0,.05)*p**1.5; return n+s
def sting(root=261.63):
    out=np.zeros(int(SR*1.6))
    for i,m in enumerate((1,1.25,1.5,2)):
        x=sine(root*m,1.2,.16,3); out[int(SR*.06*i):int(SR*.06*i)+len(x)]+=x[:len(out)-int(SR*.06*i)]
    return out
def sparkle():
    out=np.zeros(int(SR*1.0))
    for i,f in enumerate((1568,2093,2637,3136)):
        x=sine(f,.4,.1,8); o=int(SR*.07*i); out[o:o+len(x)]+=x
    return out
def pad(d,chord,amp=.06,lfo=.2):
    t=tarr(d); x=sum(np.sin(2*np.pi*f*t+i)+.4*np.sin(2*np.pi*f*2*t) for i,f in enumerate(chord))
    x*= (.75+.25*np.sin(2*np.pi*lfo*t)); return x*amp/len(chord)
def roomtone(d,amp=.02):
    r=np.random.default_rng(11).standard_normal(int(SR*d)); return lpf_fast(r,500)*amp*4
class Mix:
    def __init__(s,d): s.d=d; s.L=np.zeros(int(SR*d)); s.R=np.zeros(int(SR*d))
    def add(s,x,t,g=1,pan=0):
        i=int(t*SR)
        if i<0 or i>=len(s.L): return
        m=min(len(x),len(s.L)-i); l=g*(1-max(0,pan)); r=g*(1+min(0,pan))
        s.L[i:i+m]+=x[:m]*l; s.R[i:i+m]+=x[:m]*r
    def gate(s,t0,t1,fade=.01):  # hard silence window
        a,b=int(t0*SR),int(t1*SR); f=int(fade*SR)
        for ch in (s.L,s.R):
            ch[a:b]=0
    def write(s,path):
        st=np.stack([s.L,s.R],1); st=st/max(1e-6,np.max(np.abs(st)))*.9
        with wave.open(path,'wb') as w: w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((st*32767).astype(np.int16).tobytes())
def mux(video,wav,out,lufs=-14):
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',video,'-i',wav,'-filter_complex',f'[1:a]loudnorm=I={lufs}:TP=-1.5:LRA=7[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','224k','-ar','48000','-shortest',out],check=True)

def whoosh(d=.9,amp=.5,up=True):
    t=tarr(d); r=np.random.default_rng(int(d*1000)).standard_normal(len(t)); x=hpf_fast(lpf_fast(r,5000),500)
    p=np.sin(np.pi*t/d)**2; return x*p*amp
def boom(): return ov((sweep(90,30,.9,.8,3.5),0),(lpf_fast(noise(.6,.5,6,9),700),0))
def snap(): return ov((noise(.025,.8,120,6),0),(sine(1800,.03,.3,120),0))
def chirp():
    parts=[]; 
    for i in range(3): parts.append((sine(4200,.06,.12,40),i*.1))
    return ov(*parts)
def coin(): return ov((sine(1568,.3,.28,9),0),(sine(2093,.4,.28,8),.07))
def crash(d=1.6): return hpf_fast(noise(d,.6,2.6,12),3000)
def clap(seed=2): return ov((hpf_fast(noise(.09,.6,45,seed),900),0),(hpf_fast(noise(.07,.5,60,seed+1),1500),.02))
def brass(freqs,d=.5,amp=.12):
    t=tarr(d); x=sum(sum(np.sin(2*np.pi*f*k*t)/k for k in (1,2,3,4,5)) for f in freqs)
    e=np.minimum(1,t/.03)*np.exp(-t*2.2); return lpf_fast(x*e,3500)*amp/len(freqs)
def blip(f): return sine(f,.14,.22,22)
def fade_end(mx,sec=.35):
    n=int(sec*SR); mx.L[-n:]*=np.linspace(1,0,n); mx.R[-n:]*=np.linspace(1,0,n)
