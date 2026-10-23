"""Candy Catch headless test: load w/o console errors, catch, avoid, golden, end screen + PNG card, DE toggle, kids mode, mobile tap. Writes screenshots."""
import asyncio, os, struct, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + ROOT + '/index.html'
OUT = ROOT + '/test/shots/'; os.makedirs(OUT, exist_ok=True)
ARGS = ['--autoplay-policy=no-user-gesture-required']
R = []
def check(n, ok, info=''): R.append(ok); print(('PASS ' if ok else 'FAIL ') + n + (f' — {info}' if info != '' else ''), flush=True)

async def page(b, **kw):
    ctx = await b.new_context(accept_downloads=True, **kw)
    await ctx.add_init_script("window.__ccSeed = 4242; try{localStorage.clear()}catch(e){}")
    pg = await ctx.new_page(); logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR {e}'))
    await pg.goto(URL); await pg.wait_for_function('document.body.classList.contains("ready")')
    await pg.wait_for_timeout(600)
    return ctx, pg, logs

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        ctx, pg, logs = await page(b, viewport={'width': 1280, 'height': 800})
        check('menu visible, EN default', await pg.is_visible('#menu.show') and (await pg.text_content('#btnPlay')) == 'Play')
        await pg.screenshot(path=OUT + 'shot-menu.png')
        await pg.click('#btnLang'); de = await pg.text_content('#btnPlay'); await pg.screenshot(path=OUT + 'shot-menu-de.png')
        check('DE toggle', de == 'Spielen', de); await pg.click('#btnLang')
        await pg.click('#btnPlay'); await pg.wait_for_timeout(1500)
        check('round starts', await pg.evaluate('__cc.S.state') == 'play')
        n = await pg.evaluate('new Promise(r => { const f = () => window.__ccAudioReady ? r(window.__ccAudioReady) : setTimeout(f, 100); f(); })')
        check('CC0 sounds decoded', n == 15, n)
        await pg.mouse.move(640, 500); await pg.wait_for_timeout(2500); await pg.screenshot(path=OUT + 'shot-play.png')
        # deterministic logic checks
        await pg.evaluate('window.__ccManual = true; __cc.S.spawnT = 999; __cc.step(1/60, 300); __cc.S.spawnT = 999; __cc.S.lives = 3')  # let candy/spiders still falling from the real-time part drop out first (was flaky)
        await pg.evaluate('(() => { for (const e of __cc.ents()) {} })()')
        bx = await pg.evaluate('__cc.bucket.x'); by = await pg.evaluate('__cc.bucket.y - __cc.bucket.h')
        s0 = await pg.evaluate('__cc.S.score')
        await pg.evaluate(f'__cc.spawnAt("candy", {bx}, {by} - 120)'); await pg.evaluate('__cc.step(1/60, 120)')
        s1 = await pg.evaluate('__cc.S.score'); check('catch candy adds score', s1 > s0, f'{s0}->{s1}')
        await pg.evaluate(f'__cc.spawnAt("gold", {bx}, {by} - 120)'); await pg.evaluate('__cc.step(1/60, 120)')
        s2 = await pg.evaluate('__cc.S.score'); check('golden candy bonus >= 50', s2 - s1 >= 50, s2 - s1)
        # avoid: spider falls at basket, player moves away with arrow key
        await pg.evaluate(f'__cc.spawnAt("spider", {bx}, {by} - 350)')
        await pg.keyboard.down('ArrowLeft'); await pg.evaluate('__cc.step(1/60, 30)'); await pg.keyboard.up('ArrowLeft')
        await pg.evaluate('__cc.step(1/60, 200)')
        check('avoid spider (arrow keys) keeps lives', await pg.evaluate('__cc.S.lives') == 3, await pg.evaluate('__cc.bucket.x'))
        bx = await pg.evaluate('__cc.bucket.x')
        await pg.evaluate(f'__cc.spawnAt("spider", {bx}, {by} - 120)'); await pg.evaluate('__cc.step(1/60, 120)')
        check('caught spider costs a life + resets combo', await pg.evaluate('__cc.S.lives == 2 && __cc.S.combo == 0'))
        # tempo
        await pg.evaluate('window.__ccManual = false; __cc.S.spawnT = 0')
        # end screen
        await pg.evaluate('__cc.S.el = 49.5'); await pg.wait_for_timeout(1200)
        check('end screen after timer', await pg.is_visible('#end.show') and await pg.evaluate('__cc.S.state') == 'end', await pg.text_content('#eScore'))
        check('default name Player', await pg.input_value('#eName') == 'Player')
        await pg.screenshot(path=OUT + 'shot-end.png')
        async with pg.expect_download() as dl: await pg.click('#btnCard')
        d = await dl.value; path = OUT + 'card.png'; await d.save_as(path)
        w, h = struct.unpack('>II', open(path, 'rb').read()[16:24]); check('highscore card PNG 1080x1350', (w, h) == (1080, 1350), (w, h, d.suggested_filename))
        check('no console errors (desktop)', not logs, logs[:5])
        await ctx.close()
        # kids mode
        ctx, pg, logs = await page(b, viewport={'width': 1280, 'height': 800})
        await pg.click('#btnKids'); check('kids text', 'spiders' in (await pg.text_content('#h3')))
        await pg.screenshot(path=OUT + 'shot-kids-menu.png')
        await pg.click('#btnPlay'); await pg.wait_for_timeout(300)
        await pg.evaluate('window.__ccManual = true; window.__types = new Set(); window.__vmax = 0')
        for _ in range(56):
            await pg.evaluate('__cc.step(1/30, 30); for (const e of __cc.ents()) { __types.add(e.type); __vmax = Math.max(__vmax, e.vy / innerHeight); }')
        ty = await pg.evaluate('[...__types]'); v = await pg.evaluate('__vmax')
        check('kids mode: no spiders over full round', 'spider' not in ty and await pg.evaluate('__cc.S.state') in ('end',), ty)
        check('kids mode slower (max fall < 0.4 H/s)', v < .4, round(v, 3))
        await pg.evaluate('window.__ccManual = false'); await pg.wait_for_timeout(300); await pg.screenshot(path=OUT + 'shot-kids-end.png')
        check('no console errors (kids)', not logs, logs[:5]); await ctx.close()
        # mobile tap
        ctx, pg, logs = await page(b, viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
        await pg.screenshot(path=OUT + 'shot-mobile-menu.png')
        await pg.tap('#btnPlay'); await pg.wait_for_timeout(500)
        check('mobile: tap starts game', await pg.evaluate('__cc.S.state') == 'play')
        await pg.touchscreen.tap(40, 600); await pg.wait_for_timeout(500); x1 = await pg.evaluate('__cc.bucket.x')
        await pg.touchscreen.tap(350, 600); await pg.wait_for_timeout(500); x2 = await pg.evaluate('__cc.bucket.x')
        check('mobile: tap moves basket', x1 < 100 and x2 > 290, (round(x1), round(x2)))
        await pg.wait_for_timeout(2500); await pg.screenshot(path=OUT + 'shot-mobile-play.png')
        check('no console errors (mobile)', not logs, logs[:5]); await ctx.close()
        await b.close()
    print(f'{sum(R)}/{len(R)} passed'); sys.exit(0 if all(R) else 1)
asyncio.run(main())
