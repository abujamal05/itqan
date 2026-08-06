"""
Build the frontend handover PDF from README.md.

The README is the source of truth; this only renders it. Editing the PDF by hand
would guarantee the two drift apart, so don't — edit README.md and re-run:

    python scripts/make_handover_pdf.py

Needs `markdown` (pip) and a Chromium based browser. Verifies the result by
rendering the real PDF back and checking every page is actually inked, because a
PDF can have the right page count and still be blank.
"""

import glob
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "README.md")
BUILD = os.path.join(HERE, "_handover")
OUT = os.path.join(ROOT, "Itqan-frontend-handover.pdf")
FONTS_SRC = os.path.join(os.path.dirname(ROOT), "itqan-website", "public", "fonts")
PORT = 4357

CSS = """
@font-face{font-family:'Rubik';src:url('rubik.woff2') format('woff2-variations');
  font-weight:300 800;font-style:normal;font-display:block}

:root{
  --paper:#FAF8F3; --navy:#071055; --navy-700:#14205C; --navy-300:#6B72A6;
  --gold:#F39F1C; --gold-700:#C57A14; --gold-50:#FEF6E9;
  --ink:#101534; --muted:#5A6180; --line:#E3E0D6; --maroon:#820000;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Rubik',system-ui,sans-serif;color:var(--ink);background:#fff;
  font-size:10.2pt;line-height:1.62;-webkit-print-color-adjust:exact;print-color-adjust:exact}

@page{size:A4;margin:18mm 16mm 20mm}
@page:first{margin:0}

/* ---- cover ---- */
.cover{
  position:relative;width:210mm;height:297mm;padding:26mm 20mm;
  display:flex;flex-direction:column;justify-content:center;
  color:var(--paper);break-after:page;
  background-image:
    radial-gradient(circle at 1px 1px, rgba(255,255,255,.06) 1px, transparent 0),
    radial-gradient(60% 40% at 82% 12%, rgba(243,159,28,.16) 0%, rgba(243,159,28,0) 68%),
    linear-gradient(165deg,#0A1338 0%,#060C2B 48%,#04070F 100%);
  background-size:24px 24px,auto,auto;
}
/* align-self and width:auto both matter: the cover is a column flex container,
   so a bare <img> is stretched to the full column width and the lockup comes
   out smeared across the page. */
.cover__mark{height:14mm;width:auto;align-self:flex-start;margin-bottom:16mm}
.cover h1{font-size:30pt;line-height:1.1;font-weight:700;letter-spacing:-.02em;color:#fff}
.cover h1 span{display:block;color:var(--gold)}
.cover__sub{margin-top:8mm;font-size:12pt;font-weight:300;color:#A9AEC9;max-width:120mm}
.cover__rule{width:40mm;height:2px;background:var(--gold);margin:10mm 0;border-radius:2px}
.cover__meta{font-size:9pt;color:#8B92B8;line-height:1.9}
.cover__meta b{color:var(--paper);font-weight:500}
.cover__foot{position:absolute;left:20mm;right:20mm;bottom:18mm;
  font-size:8.5pt;color:#6B72A6;border-top:1px solid rgba(255,255,255,.12);padding-top:5mm}

/* ---- document flow ---- */
h2{font-size:16pt;font-weight:700;color:var(--navy);letter-spacing:-.01em;
  margin:11mm 0 4mm;padding-bottom:2.5mm;border-bottom:2px solid var(--gold);
  break-after:avoid;break-inside:avoid}
h2:first-of-type{margin-top:0}
h3{font-size:11.5pt;font-weight:600;color:var(--navy-700);margin:7mm 0 2.5mm;break-after:avoid}
p{margin:0 0 3.2mm}
strong{font-weight:600;color:var(--navy)}
em{font-style:italic}
a{color:var(--gold-700);text-decoration:none;word-break:break-word}

ul,ol{margin:0 0 3.6mm;padding-inline-start:5.5mm}
li{margin-bottom:1.6mm}
li::marker{color:var(--gold)}
ul ul,ol ol,ul ol,ol ul{margin:1.6mm 0 0}

code{font-family:'Consolas','SF Mono',ui-monospace,monospace;font-size:8.6pt;
  background:var(--gold-50);color:var(--navy);padding:.4mm 1.2mm;border-radius:1mm;
  border:1px solid #F0E4CC}
pre{background:#0B1440;color:#D7DAEC;padding:4mm 5mm;border-radius:2mm;
  margin:0 0 4mm;overflow:hidden;break-inside:avoid;border-inline-start:2.5mm solid var(--gold)}
pre code{background:none;border:0;color:inherit;font-size:8.2pt;line-height:1.55;padding:0;
  white-space:pre-wrap;word-break:break-word}

table{width:100%;border-collapse:collapse;margin:0 0 4.5mm;font-size:9pt;break-inside:avoid}
th,td{text-align:start;padding:2.2mm 3mm;border-bottom:1px solid var(--line);vertical-align:top}
thead th{background:var(--navy);color:#fff;font-weight:600;font-size:8.6pt;
  letter-spacing:.03em;border-bottom:0}
thead th:first-child{border-start-start-radius:1.5mm}
thead th:last-child{border-start-end-radius:1.5mm}
tbody tr:nth-child(even){background:#FBFAF6}

blockquote{margin:0 0 4.5mm;padding:3.5mm 5mm;background:var(--gold-50);
  border-inline-start:2.5mm solid var(--gold);border-radius:0 2mm 2mm 0;break-inside:avoid}
blockquote p{margin:0}
blockquote strong{color:var(--gold-700)}

hr{border:0;border-top:1px solid var(--line);margin:8mm 0}

/* Keep a heading with what follows it. */
h2,h3{page-break-after:avoid}
table,pre,blockquote{page-break-inside:avoid}
"""


def widen_list_indents(md_text: str) -> str:
    """Turn 2 space list nesting into the 4 spaces Python-Markdown requires.

    GitHub and every editor render 2 space nesting correctly, so the README uses
    it. Python-Markdown does not, and silently flattens the sub-items to one
    level instead of erroring. Normalising here keeps the README readable where
    it actually lives and the PDF correct. Fenced code is skipped, since
    indentation there is content.
    """
    out, in_fence = [], False
    for line in md_text.split("\n"):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            out.append(line)
            continue
        if not in_fence:
            m = re.match(r"^( +)(?=[-*+] |\d+\. )", line)
            if m:
                line = " " * (len(m.group(1)) * 2) + line[len(m.group(1)):]
            else:
                # Continuation lines inside a nested item need to move with it.
                m2 = re.match(r"^( {2,})(?=\S)", line)
                if m2 and out and out[-1].strip():
                    line = " " * (len(m2.group(1)) * 2) + line[len(m2.group(1)):]
        out.append(line)
    return "\n".join(out)


def build_html(md_text: str) -> str:
    import markdown

    # Drop the H1 and the leading blockquote; the cover carries both.
    body_md = re.sub(r"^# .*?\n", "", md_text, count=1)
    body_md = widen_list_indents(body_md)

    # No `sane_lists`: it demands a 4 space indent to nest, so the 2 space
    # nesting the README actually uses came out flattened to one level.
    html_body = markdown.markdown(
        body_md,
        extensions=["tables", "fenced_code", "attr_list"],
    )

    cover = f"""
<div class="cover">
  <img class="cover__mark" src="lockup.webp" alt="Itqan">
  <h1>Frontend<span>handover</span></h1>
  <p class="cover__sub">The product app, the marketing site, and exactly how the two
     are wired together. Written to be read once and answered from.</p>
  <div class="cover__rule"></div>
  <div class="cover__meta">
    <b>Itqan</b> &middot; the signed in product app<br>
    React, TypeScript and Vite &middot; Arabic first, RTL native, bilingual<br>
    Generated from <b>Onboarding/README.md</b>
  </div>
  <div class="cover__foot">
    Section 6 states plainly what is real and what is simulated. Read it before any demo.
  </div>
</div>
"""
    return (
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        "<title>Itqan frontend handover</title>"
        f"<style>{CSS}</style></head><body>{cover}{html_body}</body></html>"
    )


def find_browser():
    local = os.environ.get("LOCALAPPDATA", "")
    cands = sorted(glob.glob(os.path.join(
        local, "ms-playwright", "chromium-*", "chrome-win", "chrome.exe"))) if local else []
    cands += [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    ]
    return next((c for c in cands if os.path.isfile(c)), None)


def verify(path):
    try:
        from pypdf import PdfReader
        r = PdfReader(path)
        box = r.pages[0].mediabox
        print(f"  pages     : {len(r.pages)}")
        print(f"  page size : {float(box.width)/72*25.4:.0f} x {float(box.height)/72*25.4:.0f} mm")
    except Exception as exc:  # noqa: BLE001
        print(f"  (pypdf unavailable: {exc})")
        return True

    try:
        import pypdfium2 as pdfium
    except ImportError:
        print("  ink check : SKIPPED (pip install pypdfium2)")
        return True

    doc = pdfium.PdfDocument(path)
    blank, thin = [], []
    for i in range(len(doc)):
        bmp = doc[i].render(scale=0.4).to_pil().convert("L")
        px = bmp.load()
        w, h = bmp.size
        dark = sum(1 for y in range(0, h, 3) for x in range(0, w, 3) if px[x, y] < 200)
        total = len(range(0, h, 3)) * len(range(0, w, 3))
        ratio = dark / total
        if ratio < 0.005:
            blank.append(i + 1)
        elif ratio < 0.02:
            thin.append((i + 1, ratio))
    doc.close()

    if blank:
        print(f"  ink check : FAILED — blank pages: {blank}")
        return False
    print(f"  ink check : OK — no blank pages"
          + (f" ({len(thin)} light: {[p for p, _ in thin]})" if thin else ""))
    return True


def main():
    if not os.path.isfile(SRC):
        print(f"missing {SRC}")
        return 1

    os.makedirs(BUILD, exist_ok=True)
    with open(SRC, encoding="utf-8") as fh:
        md = fh.read()

    with open(os.path.join(BUILD, "index.html"), "w", encoding="utf-8") as fh:
        fh.write(build_html(md))

    font = os.path.join(FONTS_SRC, "rubik-latin-wght-normal.woff2")
    if os.path.isfile(font):
        shutil.copyfile(font, os.path.join(BUILD, "rubik.woff2"))
    logo = os.path.join(os.path.dirname(ROOT), "itqan-website", "public", "logos",
                        "lockup-horizontal-reversed.webp")
    if os.path.isfile(logo):
        shutil.copyfile(logo, os.path.join(BUILD, "lockup.webp"))

    handler = partial(SimpleHTTPRequestHandler, directory=BUILD)
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    httpd.log_message = lambda *a, **k: None
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    time.sleep(0.4)

    binary = find_browser()
    if not binary:
        print("No Chromium based browser found.")
        return 1

    if os.path.exists(OUT):
        os.remove(OUT)
    profile = os.path.join(BUILD, "_profile")
    try:
        subprocess.run([
            binary, "--headless=new", "--disable-gpu", "--no-sandbox",
            f"--user-data-dir={profile}", "--window-size=1240,1754",
            "--no-pdf-header-footer", "--print-to-pdf-no-header",
            "--virtual-time-budget=20000",
            f"--print-to-pdf={OUT}", f"http://127.0.0.1:{PORT}/index.html",
        ], check=True, timeout=180, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    finally:
        httpd.shutdown()
        shutil.rmtree(profile, ignore_errors=True)

    if not os.path.exists(OUT):
        print("FAILED: no PDF produced")
        return 1

    print(f"Wrote {os.path.relpath(OUT, ROOT)}  ({os.path.getsize(OUT)/1024:,.0f} KB)")
    return 0 if verify(OUT) else 1


if __name__ == "__main__":
    sys.exit(main())
