# Generates src/theme-dark.css: maps hard-coded light surfaces to dark ones and dark text to light,
# scoped under [data-theme="dark"]. Re-run after editing styles.css / acud.css.
import re, colorsys, os
os.chdir(r'D:\New folder\smart-building\src')
SKIP = re.compile(r'\.(dcard|dcards|dlinks|hero|hl|mk-|sv-|siteview|twin|legend|room-label|labels|cc-cap|cc-ppl|cc-pager|cc-main|cc-tile|feed|crit-banner|tip)')

def hx(h):
    h = h.lstrip('#')
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def lum(r, g, b): return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
def to_dark_surface(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if s < 0.3 or l > 0.97: h, s = 45 / 360, 0.05
    nl = max(0.18, min(0.25, 1 - l + 0.16)); ns = min(0.22, s * 0.25 + 0.04)
    rr, gg, bb = colorsys.hls_to_rgb(h, nl, ns)
    return '#%02x%02x%02x' % (int(rr * 255), int(gg * 255), int(bb * 255))
def to_light_text(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    rr, gg, bb = colorsys.hls_to_rgb(h, min(0.92, 1 - l + 0.05), s * 0.4)
    return '#%02x%02x%02x' % (int(rr * 255), int(gg * 255), int(bb * 255))

HEX = re.compile(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b')
RGBA = re.compile(r'rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)')

def map_value(prop, val):
    changed = False
    surface = prop.startswith(('background', 'border', 'outline', 'box-shadow')) and not prop.startswith('box-shadow')
    text = prop in ('color', 'fill', 'stroke', 'caret-color')
    def rh(m):
        nonlocal changed
        r, g, b = hx(m.group(0)); L = lum(r, g, b)
        if surface and L > 0.78: changed = True; return to_dark_surface(r, g, b)
        if text and L < 0.42: changed = True; return to_light_text(r, g, b)
        return m.group(0)
    def rr(m):
        nonlocal changed
        r, g, b, a = int(m.group(1)), int(m.group(2)), int(m.group(3)), float(m.group(4))
        if surface and lum(r, g, b) > 0.85 and a >= 0.4: changed = True; return f'rgba(52, 51, 47, {min(0.9, a):.2f})'
        return m.group(0)
    v = HEX.sub(rh, val); v = RGBA.sub(rr, v)
    if surface and 'linear-gradient' in val and changed: pass
    return v, changed

def process(css):
    out = []
    i = 0
    while i < len(css):
        j = css.find('{', i)
        if j < 0: break
        sel = css[i:j].strip()
        if sel.startswith('@media') or sel.startswith('@supports'):
            depth, k = 1, j + 1
            while depth and k < len(css):
                if css[k] == '{': depth += 1
                elif css[k] == '}': depth -= 1
                k += 1
            inner = process(css[j + 1:k - 1])
            if inner.strip(): out.append(f'{sel} {{\n{inner}}}\n')
            i = k; continue
        if sel.startswith('@keyframes') or sel.startswith('@font-face'):
            depth, k = 1, j + 1
            while depth and k < len(css):
                if css[k] == '{': depth += 1
                elif css[k] == '}': depth -= 1
                k += 1
            i = k; continue
        k = css.find('}', j)
        body = css[j + 1:k]; i = k + 1
        sel = re.sub(r'/\*.*?\*/', '', sel, flags=re.S).strip()
        if not sel or sel.startswith(':root') or SKIP.search(sel): continue
        decls = []
        for d in body.split(';'):
            if ':' not in d: continue
            p, v = d.split(':', 1); p = p.strip().lower(); v = v.strip()
            nv, ch = map_value(p, v)
            if ch: decls.append(f'{p}: {nv}')
        if decls:
            sels = ', '.join('[data-theme="dark"] ' + s.strip() for s in sel.split(','))
            out.append(f'{sels} {{ {"; ".join(decls)}; }}\n')
    return ''.join(out)

src = ''
for f in ('styles.css', 'acud.css'):
    src += re.sub(r'/\*.*?\*/', '', open(f, encoding='utf-8').read(), flags=re.S)
gen = process(src)
BASE = '''/* Dark theme base — warm charcoal + muted amber (ACUD spec). */
[data-theme="dark"] {
  --bg: #252522; --bg2: #2d2c29; --card: rgba(64, 62, 56, .62); --card2: #34332f; --panel: #403e38; --line: #4d4a44; --line2: #3f3d38;
  --ink: #f2efe8; --ink2: #cdc7bb; --mute: #9d978b; --amber: #c99a55; --amber2: #dcb377; --cyan: #73c9d8;
  --red: #d77970; --green: #80b995; --warn: #d9a35a;
  --sh: 0 1px 2px rgba(0, 0, 0, .3), 0 10px 30px -14px rgba(0, 0, 0, .6);
  color-scheme: dark;
}
[data-theme="dark"] body { background: var(--bg); }
[data-theme="dark"] .top { background: rgba(37, 37, 34, .62); }
[data-theme="dark"] .rail { background: rgba(37, 37, 34, .45); }
[data-theme="dark"] ::-webkit-scrollbar-thumb { background: #57534b; }
[data-theme="dark"] select, [data-theme="dark"] input { background-color: var(--card2); color: var(--ink); }
[data-theme="dark"] .seg { background: rgba(37, 37, 34, .7); }
[data-theme="dark"] .seg button.on { background: #4a4740; color: var(--ink); box-shadow: 0 1px 3px rgba(0, 0, 0, .4); }
[data-theme="dark"] .chart .grid { stroke: #4a4740; } [data-theme="dark"] .chart .ax { fill: #9d978b; }
[data-theme="dark"] .donut circle:first-child { stroke: #4a4740; }
[data-theme="dark"] .gauge path:first-child { stroke: #4a4740; }
[data-theme="dark"] .offline-banner { background: #34332f; border-color: #4d4a44; }
[data-theme="dark"] .modal-bg { background: rgba(0, 0, 0, .55); }
[data-theme="dark"] .al-btn span { background: color-mix(in srgb, var(--c) 22%, #2d2c29); }
'''
open('theme-dark.css', 'w', encoding='utf-8').write('/* generated surface overrides */' + chr(10) + gen + BASE)
print(len(gen.splitlines()), 'rules')
