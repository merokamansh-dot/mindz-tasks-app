import sys, os, asyncio, subprocess
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__)); FPS=30
HTML='''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"CairoBrand";src:url("assets/Cairo.ttf");font-weight:200 1000}
html,body{margin:0;background:#000}canvas{display:block;width:1080px;height:1920px}</style></head>
<body><canvas id="c" width="1080" height="1920"></canvas>
<script src="engine.js"></script><script src="timeline.js"></script><script src="ep5.js"></script><script>loadAll(ASSETS)</script></body></html>'''
async def run(out, stills=None, meta=False):
    open(os.path.join(HERE,'_ep5.html'),'w').write(HTML)
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--allow-file-access-from-files'])
        pg=await br.new_page(viewport={'width':1080,'height':1920})
        pg.on('console',lambda m: print('console:',m.text) if 'ERR' in m.text or 'rror' in m.text else None)
        pg.on('pageerror',lambda e: print('PAGEERR',e))
        await pg.goto('file://'+os.path.join(HERE,'_ep5.html')); await pg.wait_for_function('window.READY===true',timeout=20000)
        dur=await pg.evaluate('window.DUR')
        if meta:
            import json; m=await pg.evaluate('({DUR:window.DUR,SECT:window.SECT,EVENTS:window.EVENTS,SCN:SCN,END:END})'); json.dump(m,open('out/ep5_meta.json','w'),indent=1); print('meta',len(m['EVENTS'])); await br.close(); return
        if stills:
            os.makedirs('stills',exist_ok=True)
            for s in stills:
                await pg.evaluate(f'PRE({s})'); await pg.evaluate(f'RENDER({s},{int(s*FPS)})'); await pg.screenshot(path=f'stills/ep5_{s:05.2f}.png')
            await br.close(); return
        n=int(round(dur*FPS))
        ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','image2pipe','-framerate',str(FPS),'-i','-','-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p','-r',str(FPS),'-movflags','+faststart',out],stdin=subprocess.PIPE)
        for i in range(n):
            t=i/FPS; await pg.evaluate(f'PRE({t})'); await pg.evaluate(f'RENDER({t},{i})'); ff.stdin.write(await pg.screenshot(type='jpeg',quality=95))
        ff.stdin.close(); ff.wait(); await br.close(); print('rendered',n,'frames',dur,'s')
if __name__=='__main__':
    os.makedirs('out',exist_ok=True)
    a=sys.argv[1:] 
    if a and a[0]=='stills': asyncio.run(run(None,[float(x) for x in a[1:]]))
    elif a and a[0]=='meta': asyncio.run(run(None,meta=True))
    else: asyncio.run(run('out/ep5_silent.mp4'))
