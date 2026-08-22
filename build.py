#!/usr/bin/env python3
"""Build flamme-retarde.html — one self-contained file, no network at runtime.

Three.js ships as two ES modules that import each other. We rewrite each into an
IIFE so both can live in a single classic <script>, then expose window.THREE.
The transform is purely mechanical:

    import{A as e,...}from"./three.core.min.js";  ->  const {A:e,...} = __core;
    export{Foo,Bar}from"./three.core.min.js";     ->  (re-export, merged at the end)
    export{q as Foo,...};                         ->  return {Foo:q,...};

On top of that we inline the baked payloads from build/payload/ — the Sibenik
heightfield, the land-cover map, the building footprints and the Blender-authored
landmarks — as base64 in a single JS object, so the finished page opens from the
filesystem with no server and no requests.
"""

import base64
import json
import re
import shutil
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
VENDOR = ROOT / "vendor"
SRC = ROOT / "src"
PAYLOAD = ROOT / "build" / "payload"
OUT = ROOT / "flamme-retarde.html"
DEPLOY = Path("/mnt/c/tmp/flamme-retarde")

# The build stamp shown on the title screen, so a page can be identified at a
# glance without diffing ten megabytes. Both are constants rather than
# `git describe` and today's date, deliberately: an unchanged tree has to
# rebuild byte-for-byte identically, because comparing checksums is how we
# check that what is on the server is what is in the repo. Bump them together
# when cutting a release, next to the CHANGELOG entry.
VERSION = "1.96.0"
BUILD_DATE = "2026-08-22"

THREE_VERSION = "0.180.0"
CDN = f"https://unpkg.com/three@{THREE_VERSION}/build"
CORE, MAIN = "three.core.min.js", "three.module.min.js"


def fetch(name: str) -> str:
    VENDOR.mkdir(exist_ok=True)
    cached = VENDOR / name
    if not cached.exists():
        print(f"  downloading {name}")
        with urllib.request.urlopen(f"{CDN}/{name}") as r:
            cached.write_bytes(r.read())
    return cached.read_text()


def split_binding_list(body: str):
    """'q as Foo,Bar' -> [('q','Foo'), ('Bar','Bar')]"""
    out = []
    for part in body.split(","):
        part = part.strip()
        if not part:
            continue
        if " as " in part:
            local, exported = (p.strip() for p in part.split(" as ", 1))
        else:
            local = exported = part
        out.append((local, exported))
    return out


def statements(src: str, keyword: str):
    """Yield (start, end, binding_list, from_specifier_or_None) for each
    top-level `import{...}` / `export{...}` statement."""
    for m in re.finditer(rf"\b{keyword}\s*\{{", src):
        i = m.start()
        close = src.index("}", i)
        body = src[m.end():close]
        rest = src[close + 1:]
        spec = None
        fm = re.match(r'\s*from\s*["\']([^"\']+)["\']\s*;?', rest)
        end = close + 1
        if fm:
            spec = fm.group(1)
            end += fm.end()
        else:
            sm = re.match(r"\s*;", rest)
            if sm:
                end += sm.end()
        yield i, end, split_binding_list(body), spec


def to_iife(src: str, name: str, core_var: str | None) -> tuple[str, list[str]]:
    """Rewrite one ES module into `const <name> = (() => { ... })();`."""
    edits = []
    returns = []
    reexports = []

    for start, end, bindings, spec in statements(src, "import"):
        if spec is None:
            continue
        assert core_var, f"{name} has an import but no core to bind against"
        # In `import {Foo as q}` the *first* name is core's, the second is local,
        # which is the opposite of the export case split_binding_list assumes.
        pairs = ", ".join(f"{outer}: {inner}" for outer, inner in bindings)
        edits.append((start, end, f"const {{{pairs}}} = {core_var};"))

    for start, end, bindings, spec in statements(src, "export"):
        if spec is not None:
            reexports += [exp for _, exp in bindings]
            edits.append((start, end, ""))
        else:
            returns = bindings
            edits.append((start, end, ""))

    if not returns:
        sys.exit(f"error: no local export statement found in {name}")

    out, cursor = [], 0
    for start, end, replacement in sorted(edits):
        out.append(src[cursor:start])
        out.append(replacement)
        cursor = end
    out.append(src[cursor:])
    body = "".join(out)

    ret = ",".join(f"{exp}:{loc}" for loc, exp in returns)
    return f"const {name} = (() => {{\n{body}\nreturn {{{ret}}};\n}})();\n", reexports


def bundle_three() -> str:
    print("bundling three.js")
    core_js, core_reexports = to_iife(fetch(CORE), "__three_core", None)
    main_js, reexported = to_iife(fetch(MAIN), "__three_main", "__three_core")
    assert not core_reexports
    print(f"  {len(reexported)} names re-exported from core")
    return (
        "/* Three.js r%s — MIT, (c) Three.js Authors. Inlined for offline use. */\n"
        % THREE_VERSION
        + core_js
        + main_js
        + "window.THREE = Object.assign({}, __three_core, __three_main);\n"
    )


# Payload files, in the order they should appear. `.png` becomes a data URI the
# browser can hand straight to an <img>; `.gz` becomes base64 the app inflates
# with DecompressionStream; `.json` is inlined verbatim.
MIME = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".glb": "model/gltf-binary",
}


def bundle_payload() -> str:
    if not PAYLOAD.exists():
        print("no build/payload — skipping baked assets")
        return "const PAYLOAD = {};\n"

    entries = []
    total = 0
    for p in sorted(PAYLOAD.iterdir()):
        if p.is_dir() or p.name.startswith("."):
            continue
        key = p.stem if p.suffix != ".gz" else p.name[: -len(".gz")].replace(".", "_")
        key = re.sub(r"[^A-Za-z0-9_]", "_", key)
        raw = p.read_bytes()
        total += len(raw)
        if p.suffix == ".json":
            entries.append(f"  {key}: {p.read_text()}")
        elif p.suffix in MIME:
            b64 = base64.b64encode(raw).decode()
            entries.append(f'  {key}: "data:{MIME[p.suffix]};base64,{b64}"')
        else:
            b64 = base64.b64encode(raw).decode()
            entries.append(f'  {key}: "{b64}"')
        print(f"  + {p.name}  {len(raw)/1024:.0f} KB")

    print(f"  payload total {total/1024/1024:.2f} MB raw")
    return "const PAYLOAD = {\n" + ",\n".join(entries) + "\n};\n"


def app_source() -> str:
    """Concatenate src/NN-*.js in filename order into one scope."""
    parts = sorted(SRC.glob("[0-9][0-9]-*.js"))
    if not parts:
        sys.exit("error: no src/NN-*.js files found")
    body = []
    for p in parts:
        print(f"  + {p.name}")
        body.append(f"\n// ==== {p.name} " + "=" * max(4, 58 - len(p.name)) + "\n")
        body.append(p.read_text())
    return "'use strict';\n(() => {\n" + "".join(body) + "\n})();\n"


def check_syntax(app: str) -> None:
    """Parse the concatenated app with node before shipping it.

    Worth the second it costs: a stray backtick inside one of the GLSL template
    literals silently ends the literal and turns the rest of the shader into
    JavaScript, which shows up only as a blank page and a console error.
    """
    import subprocess
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(app)
        tmp = f.name
    try:
        r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
        if r.returncode != 0:
            err = (r.stderr or "").replace(tmp, "app.js")
            sys.exit(f"error: generated app has a syntax error\n{err}")
        print("  syntax ok")
    except FileNotFoundError:
        print("  (node not found — skipping syntax check)")
    finally:
        Path(tmp).unlink(missing_ok=True)


def main() -> None:
    three = bundle_three()
    print("baking payload")
    payload = bundle_payload()
    print("assembling app")
    shell = (SRC / "shell.html").read_text()
    shell = shell.replace("{{VERSION}}", VERSION).replace("{{BUILD_DATE}}", BUILD_DATE)
    css = (SRC / "styles.css").read_text()
    app = app_source()
    check_syntax(app)

    html = shell.replace("/*STYLES*/", css)
    html = html.replace(
        "/*BUILD*/", f'const BUILD = {{ v: "{VERSION}", date: "{BUILD_DATE}" }};'
    )
    html = html.replace("/*THREE*/", three)
    html = html.replace("/*PAYLOAD*/", payload)
    html = html.replace("/*APP*/", app)
    OUT.write_text(html)
    size = OUT.stat().st_size / 1024 / 1024
    print(f"wrote {OUT} — v{VERSION} ({BUILD_DATE}), {size:.2f} MB")

    if DEPLOY.parent.exists():
        DEPLOY.mkdir(parents=True, exist_ok=True)
        shutil.copy2(OUT, DEPLOY / "flamme-retarde.html")
        shutil.copy2(OUT, DEPLOY / "index.html")
        print(f"deployed to {DEPLOY}")
    else:
        print(f"note: {DEPLOY.parent} not mounted — skipped deploy")


if __name__ == "__main__":
    main()
