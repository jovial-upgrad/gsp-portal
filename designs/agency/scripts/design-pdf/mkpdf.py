# Turns DESIGN-SYSTEM.md into styled HTML for the PDF: a cover, colour swatches beside hex values. Run via `npm run build:design-pdf`.
import markdown, re, sys
src, OUTF = sys.argv[1], sys.argv[2]
md = open(src, encoding='utf-8').read()
# python-markdown needs 4-space nesting and a blank line before a list
import re as _re
lines, out, fence = md.split('\n'), [], False
islist = lambda l: bool(_re.match(r'^\s*([-*]|\d+\.)\s', l))
for l in lines:
    if l.startswith('```'): fence = not fence
    if not fence:
        m = _re.match(r'^( +)', l)
        if m: l = ' ' * (len(m.group(1)) * 2) + l[len(m.group(1)):]
        if islist(l) and out and out[-1].strip() and not islist(out[-1]):
            out.append('')
        # a table inside a list item needs a blank line before it
        if l.lstrip().startswith('|') and out and out[-1].strip() and not out[-1].lstrip().startswith('|'):
            out.append('')
    out.append(l)
md = '\n'.join(out)
html = markdown.markdown(md, extensions=['tables', 'fenced_code', 'toc', 'sane_lists'])
# colour swatches beside hex values in code spans
def sw(m):
    v = m.group(1)
    return f'<code><span class="sw" style="background:{v}"></span>{v}</code>'
html = re.sub(r'<code>(#[0-9A-Fa-f]{6})</code>', sw, html)
html = re.sub(r'<code>(#[0-9A-Fa-f]{6}) \(', lambda m: f'<code><span class="sw" style="background:{m.group(1)}"></span>{m.group(1)} (', html)
# swatches for multi-hex code spans like `#AC225E` `#5E2D77`: handled above; and "a / b" pairs inside one code span
def multi(m):
    inner = m.group(1)
    if '#' not in inner or '<span' in inner: return m.group(0)
    inner2 = re.sub(r'(#[0-9A-Fa-f]{6})', r'<span class="sw" style="background:\1"></span>\1', inner)
    return f'<code>{inner2}</code>'
html = re.sub(r'<code>([^<]*)</code>', multi, html)
css = """
@page { size: A4; }
* { box-sizing: border-box; }
body { font-family: 'Figtree', system-ui, sans-serif; color: #344054; font-size: 10pt; line-height: 1.5; letter-spacing: -0.005em; }
h1 { font-size: 24pt; color: #0B0F19; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 6pt; line-height: 1.2; }
h2 { font-size: 15pt; color: #0B0F19; font-weight: 600; margin: 22pt 0 8pt; padding-top: 8pt; border-top: 1.5pt solid #0E2C4C; break-after: avoid; }
h3 { font-size: 11.5pt; color: #0B0F19; font-weight: 600; margin: 16pt 0 6pt; break-after: avoid; }
h1 + p { color: #5D6676; font-size: 11pt; }
p, li { orphans: 3; widows: 3; }
ul, ol { padding-left: 16pt; margin: 4pt 0 8pt; }
li { margin: 2pt 0; }
a { color: #1A4F86; text-decoration: none; }
code { font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; font-size: 8.4pt; background: #F0F2F5; border-radius: 3pt; padding: 0.5pt 3pt; color: #0B0F19; white-space: nowrap; }
td code { white-space: normal; word-break: break-word; }
td:first-child code { white-space: nowrap; word-break: normal; }
hr:last-of-type { break-after: avoid; margin: 10pt 0 6pt; }
body > p:last-child { break-before: avoid; }
pre { background: #F0F2F5; border-radius: 6pt; padding: 8pt 10pt; font-size: 8.4pt; break-inside: avoid; }
pre code { background: none; padding: 0; white-space: pre; }
table { width: 100%; border-collapse: collapse; margin: 6pt 0 12pt; font-size: 8.6pt; break-inside: auto; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { background: #F0F2F5; color: #5D6676; text-align: left; font-weight: 600; padding: 5pt 6pt; border-bottom: 1pt solid #CDD2DA; }
td { padding: 5pt 6pt; border-bottom: 0.75pt solid #E4E7EC; vertical-align: top; }
hr { border: 0; border-top: 0.75pt solid #E4E7EC; margin: 14pt 0; }
strong { color: #0B0F19; font-weight: 600; }
.sw { display: inline-block; width: 8pt; height: 8pt; border-radius: 2pt; margin-right: 3pt; vertical-align: -0.5pt; box-shadow: inset 0 0 0 0.5pt rgba(0,0,0,.25); }
.cover { height: 250mm; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 30mm; break-after: page; }
.cover .kicker { color: #EE2C3C; font-weight: 600; font-size: 11pt; letter-spacing: 0.04em; text-transform: uppercase; }
.cover h1 { font-size: 36pt; margin: 8pt 0 10pt; }
.cover p { font-size: 13pt; color: #5D6676; max-width: 130mm; }
.cover .bar { display: flex; gap: 0; height: 8pt; width: 120mm; border-radius: 4pt; overflow: hidden; margin: 18pt 0 12pt; }
.cover .bar span { flex: 1; }
.cover .meta { font-size: 10pt; color: #5D6676; }
"""
cover = """<section class="cover"><div class="kicker">upGrad GSP 3.0</div><h1>Design system</h1>
<p>The specification for developers: foundations, layout, page patterns, components, writing, every role's pages, and accessibility.</p>
<div class="bar"><span style="background:#0E2C4C"></span><span style="background:#8F4E00"></span><span style="background:#5B33A6"></span><span style="background:#1A55AE"></span><span style="background:#17703F"></span><span style="background:#B4231B"></span></div>
<div class="meta">Version of 5 November 2026 · from <code>designs/agency/DESIGN-SYSTEM.md</code></div></section>"""
doc = f"""<!doctype html><html><head><meta charset="utf-8"><title>GSP 3.0 Design System</title>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>{css}</style></head><body>{cover}{html}</body></html>"""
open(OUTF, "w", encoding="utf-8").write(doc)
