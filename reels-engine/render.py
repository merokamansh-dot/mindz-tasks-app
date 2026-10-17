import sys, os, json, asyncio, subprocess
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30
def page_html(ep):
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:"CairoBrand";src:url("assets/Cairo.ttf");font-weight:200 1000}}
html,body{{margin:0;background:#000}}canvas{{display:block;width:1080px;height:1920px}}</style></head>
<body><canvas id="c" width="1080" height="1920"></canvas>
<script src="engine.js"></script><script src="{ep}.js"></script>
<script>loadAll(ASSETS)</script></body></html>'''

async def run(ep, out, t0=None, t1=None, stills=None, scale=1):
    open(os.path.join(HERE, f'_{ep}.html'), 'w').write(page_html(ep))
    async with async_playwright() as p:
        br = await p.chromium.launch(args=['--allow-file-access-from-files'])
        pg = await br.new_page(viewport={'width': 1080, 'height': 1920})
        pg.on('console', lambda m: print('console:', m.text) if 'ERR' in m.text or 'rror' in m.text else None)
        await pg.goto('file://' + os.path.join(HERE, f'_{ep}.html'))
        await pg.wait_for_function('window.READY===true', timeout=20000)
        dur = await pg.evaluate('window.DUR')
        if stills:
            for s in stills:
                await pg.evaluate(f'RENDER({s},{int(s*FPS)})')
                await pg.screenshot(path=os.path.join(HERE, 'stills', f'{ep}_{s:05.2f}.png'))
            await br.close(); return
        n = int(round(dur * FPS))
        ff = subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','image2pipe','-framerate',str(FPS),'-i','-',
            '-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p','-r',str(FPS),'-movflags','+faststart',out], stdin=subprocess.PIPE)
        for i in range(n):
            await pg.evaluate(f'RENDER({i/FPS},{i})')
            ff.stdin.write(await pg.screenshot(type='jpeg', quality=95))
        ff.stdin.close(); ff.wait(); await br.close()
        print(ep, 'rendered', n, 'frames', dur, 's')

if __name__ == '__main__':
    ep = sys.argv[1]
    os.makedirs(os.path.join(HERE, 'stills'), exist_ok=True); os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
    if len(sys.argv) > 2 and sys.argv[2] == 'stills':
        asyncio.run(run(ep, None, stills=[float(x) for x in sys.argv[3:]]))
    else:
        asyncio.run(run(ep, os.path.join(HERE, 'out', f'{ep}_silent.mp4')))
