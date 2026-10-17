import sys, os, json, asyncio
from playwright.async_api import async_playwright
from render import page_html, HERE
async def main(ep):
    open(os.path.join(HERE,f'_{ep}.html'),'w').write(page_html(ep))
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--allow-file-access-from-files']); pg=await br.new_page()
        await pg.goto('file://'+os.path.join(HERE,f'_{ep}.html')); await pg.wait_for_function('window.READY===true')
        m=await pg.evaluate('({DUR:window.DUR,SUBS:window.SUBS,EVENTS:window.EVENTS||[]})'); await br.close()
    os.makedirs(os.path.join(HERE,'out'),exist_ok=True)
    json.dump(m,open(os.path.join(HERE,'out',f'{ep}_meta.json'),'w'),ensure_ascii=False,indent=1); print(ep,len(m['EVENTS']),'events')
asyncio.run(main(sys.argv[1]))
