#!/usr/bin/env python3
"""Burst mode: rent a real GPU for the minutes a restyle actually takes.

    tools/burst.py preflight                  # free; checks everything first
    tools/burst.py types                      # live capacity and prices
    tools/burst.py up --yes                   # launch + bootstrap (~5 min x86, ~12 ARM)
    tools/burst.py run ~/fr-video/entry/frames --n 49 --denoise 0.80 --tag _b1
    tools/burst.py status
    tools/burst.py down

── why this exists ────────────────────────────────────────────────────────────

Measured on the laptop's RTX 4090 (16 GB), from tools/vacejob.py's own logs:

    Transformer blocks on cpu:     10 952 MB      <- 67 per cent of the model
    Transformer blocks on cuda:0:   5 364 MB
    Total transformer weights:     16 316 MB      <- against 16 376 MB of VRAM

Two thirds of the model crosses PCIe on every forward pass. Working back from
22.5 s/step at seq len 20 670, the card sustains about 50 TFLOPS against a
~200 TFLOPS FP8 peak — a quarter of what it can do. It is not compute-bound,
it is starved. On an 80 GB card the weights are simply resident and the whole
block-swap apparatus disappears.

The prize is not the speedup at 480p, though that is real. It is 720p, which
on 16 GB is not slow but *impossible*: base + VACE + 720p latents do not fit,
so it thrashes at 1 280 s/step and projects to three and a quarter hours.

── the money ──────────────────────────────────────────────────────────────────

Real Lambda prices, and note that a rented H100 left running is $79 a day:

    gpu_1x_h100_pcie     80 GB   $3.29/hr   x86     the workhorse
    gpu_1x_h100_sxm5     80 GB   $4.29/hr   x86     ~1.3x the PCIe, 3.35 TB/s
    gpu_1x_gh200         96 GB   $2.29/hr   aarch64 cheapest Hopper, see below
    gpu_1x_a100_sxm4     40 GB   $1.99/hr   x86     no FP8 — fits, but Ampere
    gpu_1x_a10           24 GB   $1.29/hr   x86     not worth it, see below

A10 is listed to be dismissed, and the arithmetic that dismissed it was wrong
in an instructive way. 24 GB *sounds* like it holds the 16.3 GB of weights with
room to spare, so it should avoid block swap — but the card reports 22.6 GB
usable, and 6.3 GB does not hold a 20 670-token activation set. Measured: it
needs --swap 20 at 480p and --swap 40 at 720p, which is the very PCIe tax the
whole exercise exists to escape. Ampere also has no FP8 tensor cores, so the
fp8 checkpoint runs upcast. Under 2x the laptop, for $1.29/hr. The A100s have
the same no-FP8 problem with more room; they are the x86 fallback when both
H100s are sold out.

GH200 is the cost play and the trap. It is aarch64 — not the GPU, the CPU —
so torch, sageattention, and every custom node's wheels have to exist for ARM.
Two ARM-only details, both of which cost a paid boot:

  The ARM torch wheel does not pull `triton`, and sageattention needs it. Pip
  reports success installing sageattention and `import sageattention` then
  fails, so the probe has to be the import, not pip's exit status.

  There is NO automatic fallback. Nothing in WanVideoWrapper notices a broken
  sageattention and quietly picks sdpa — `attention_mode` is passed straight
  through and it raises. So the bootstrap records what actually imports, `up`
  reads that back, and `run` passes the answer to vacejob as --attn. A box
  without sageattention now renders slower instead of not at all.

── the guardrail ──────────────────────────────────────────────────────────────

The hard stop runs ON THE INSTANCE, not here. ablit-central's watchdog is a
local process, which is correct for a chat session someone is sitting in front
of and wrong for this: on 2026-08-21 this laptop rebooted mid-job and took a
three-hour render with it. Had that been a rented H100, it would have kept
billing into the morning with nothing watching it.

So the bootstrap arms a `systemd-run --on-active` timer that terminates the
instance through the Lambda API from the box itself. It survives this laptop
dying, the SSH tunnel dropping, and the operator going to bed. `--max-min`
sets it; there is no way to launch without one.

That does mean the Lambda API key sits on a rented machine, in cloud-init's
user_data and so in /var/lib/cloud as well. Lambda keys are account-wide — they
do not scope — so a second key would buy independent revocation and nothing
else, which is not worth the ceremony of keeping two in sync. One key, and if a
box is ever suspect, rotate it.
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ABLIT = Path(os.environ.get("ABLIT_CENTRAL", Path.home() / "ablit-central"))
# One file per instance, so several bursts can run at once. BURST_STATE names
# it; the default is the single-instance case. Concurrency is not theoretical
# here — comparing A10 against A100 against GH200 means three boxes billing
# simultaneously, and one shared state file would have the third `up` overwrite
# the second's instance id and strand it running.
STATE = ROOT / "build" / (os.environ.get("BURST_STATE") or "burst") .replace("/", "_")
STATE = STATE.with_suffix(".json")
BOOTSTRAP = ROOT / "tools" / "burst-bootstrap.sh"

sys.path.insert(0, str(ABLIT / "bin"))

# The fleet, in the order a burst should try them. Overridable with
# BURST_FLEET; the point of a list is that H100 capacity churns and a burst
# should fall through to the next box rather than fail.
FLEET = [t.strip() for t in os.environ.get(
    "BURST_FLEET",
    "gpu_1x_h100_pcie,gpu_1x_h100_sxm5,gpu_1x_gh200,gpu_1x_a100_sxm4"
).split(",") if t.strip()]

# What the workflow needs, as (comfy subdir, filename, url). Checked by
# `preflight` with HTTP HEAD *before* anything is rented, because discovering
# a 404 after the meter starts is the expensive way to find a typo.
HF = "https://huggingface.co/Kijai/WanVideo_comfy/resolve/main"
MODELS = [
    ("diffusion_models", "Wan2_1-T2V-14B_fp8_e4m3fn.safetensors",
     f"{HF}/Wan2_1-T2V-14B_fp8_e4m3fn.safetensors"),
    ("diffusion_models", "Wan2_1-VACE_module_14B_fp8_e4m3fn.safetensors",
     f"{HF}/Wan2_1-VACE_module_14B_fp8_e4m3fn.safetensors"),
    ("text_encoders", "umt5-xxl-enc-fp8_e4m3fn.safetensors",
     f"{HF}/umt5-xxl-enc-fp8_e4m3fn.safetensors"),
    ("vae", "wan_2.1_vae.safetensors",
     f"{HF}/Wan2_1_VAE_bf16.safetensors"),
    # Both of these were 404s on the obvious path and `preflight` caught it
    # before anything was rented, which is the entire reason that command
    # exists. The distill LoRA is at the repo *root*, not under Lightx2v/ with
    # its siblings; and the ditto one is stored upstream with its extension
    # doubled — .safetensors.safetensors — which is not a typo here. Neither is
    # guessable. Both were read off the HuggingFace file tree API.
    ("loras", "Wan21_T2V_14B_lightx2v_cfg_step_distill_lora_rank32.safetensors",
     f"{HF}/Wan21_T2V_14B_lightx2v_cfg_step_distill_lora_rank32.safetensors"),
    ("loras", "Wan21_14B_VACE_lora_ditto_sim2real_bf16.safetensors",
     f"{HF}/LoRAs/Ditto/Wan21_14B_VACE_lora_ditto_sim2real_bf16"
     ".safetensors.safetensors"),
    ("upscale_models", "RealESRGAN_x4plus.pth",
     "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/"
     "RealESRGAN_x4plus.pth"),
]

# Derived from BURST_STATE, not fixed, and this one cost a benchmark.
#
# With a hardcoded port, two concurrent bursts both forward 127.0.0.1:18188.
# The second ssh prints "bind: Address already in use" to a pipe nobody reads
# and keeps running — so the readiness probe against that port SUCCEEDS, against
# the *other* instance's ComfyUI, and the job executes on the wrong GPU. The
# frame poll then SSHes to the right box, sees nothing, and reports 0/N until it
# times out: a silent ten-minute hang, a benchmark of a machine that was never
# rented for it, and no error anywhere.
#
# Two defences: a port per state, and ExitOnForwardFailure below, so a collision
# kills the tunnel instead of quietly borrowing somebody else's.
_STATE_NAME = os.environ.get("BURST_STATE") or "burst"
PORT = int(os.environ.get("BURST_PORT")
           or 18188 + (sum(ord(c) for c in _STATE_NAME) % 300))


# --------------------------------------------------------------------------- #
#  small helpers                                                               #
# --------------------------------------------------------------------------- #

def env_from(path: Path):
    """Read KEY=VALUE out of an .env without importing anything."""
    if not path.exists():
        return
    for ln in path.read_text().splitlines():
        ln = ln.strip()
        if not ln or ln.startswith("#") or "=" not in ln:
            continue
        k, v = ln.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def say(msg):
    print("[burst] " + msg, flush=True)


def state_read() -> dict | None:
    if STATE.exists():
        try:
            return json.loads(STATE.read_text())
        except Exception:
            return None
    return None


def state_write(d: dict):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(d, indent=2))


def ssh_base(ip: str) -> list[str]:
    cmd = ["ssh", "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes",
           "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=30"]
    kf = os.environ.get("LAMBDA_SSH_KEY_FILE", "").strip()
    if kf:
        cmd += ["-i", kf]
    return cmd + [f"ubuntu@{ip}"]


def ssh(ip: str, script: str, check=True) -> subprocess.CompletedProcess:
    # stdin=DEVNULL is not defensive tidiness, it is the fix for a real bug.
    # ssh reads its standard input and forwards it to the remote command, so an
    # ssh called from inside a shell `while read` loop consumes the rest of the
    # loop's input file. A matrix of eight experiments ran its first one and
    # then reported that it had finished them all — the remaining seven lines
    # were eaten by the readiness probe, and nothing anywhere errored.
    return subprocess.run(ssh_base(ip) + [script], text=True,
                          capture_output=True, check=check,
                          stdin=subprocess.DEVNULL)


def head_ok(url: str, timeout=20) -> tuple[bool, str]:
    req = urllib.request.Request(url, method="HEAD")
    req.add_header("User-Agent", "flamme-burst/1.0")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            n = r.headers.get("Content-Length")
            return True, (f"{int(n) / 1e9:.1f} GB" if n else "ok")
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}"
    except Exception as e:                                # noqa: BLE001
        return False, str(e)[:60]


# --------------------------------------------------------------------------- #
#  commands                                                                    #
# --------------------------------------------------------------------------- #

def cmd_preflight(_a):
    """Everything that can go wrong, checked before anything costs money."""
    import lambda_gpu as L
    bad = 0

    def line(ok, what, detail=""):
        nonlocal bad
        if not ok:
            bad += 1
        print(f"  {'OK  ' if ok else 'FAIL'}  {what:<34} {detail}")

    print("credentials")
    line(bool(os.environ.get("LAMBDA_API_KEY", "").strip()), "LAMBDA_API_KEY",
         "from " + str(ABLIT / ".env"))
    line(bool(os.environ.get("LAMBDA_SSH_KEY_NAME", "").strip()),
         "LAMBDA_SSH_KEY_NAME")
    kf = os.environ.get("LAMBDA_SSH_KEY_FILE", "").strip()
    line(bool(kf) and Path(kf).exists(), "LAMBDA_SSH_KEY_FILE", kf or "unset")
    line(bool(os.environ.get("LAMBDA_API_KEY", "").strip()),
         "key for self-destruct", "same key; goes onto the rented box")

    print("local")
    line(BOOTSTRAP.exists(), "tools/burst-bootstrap.sh")
    line((ROOT / "tools" / "vacejob.py").exists(), "tools/vacejob.py")
    for b in ("ssh", "rsync"):
        line(subprocess.run(["which", b], capture_output=True).returncode == 0, b)

    print("models (HEAD, no download)")
    for sub, name, url in MODELS:
        ok, detail = head_ok(url)
        line(ok, f"{sub}/{name[:30]}", detail)

    print("capacity")
    try:
        types = L.instance_types()
        for t in FLEET:
            info = types.get(t)
            if not info:
                line(False, t, "unknown instance type")
                continue
            price = info["instance_type"].get("price_cents_per_hour", 0) / 100
            regions = [r["name"] for r in info.get("regions_with_capacity_available", [])]
            line(bool(regions), t,
                 f"${price:.2f}/hr  " + (", ".join(regions) if regions else "sold out"))
    except Exception as e:                                # noqa: BLE001
        line(False, "lambda API", str(e)[:70])

    print()
    print("preflight " + ("PASSED" if not bad else f"FAILED — {bad} problem(s)"))
    return 1 if bad else 0


def cmd_types(_a):
    import lambda_gpu as L
    types = L.instance_types()
    rows = []
    for name, info in types.items():
        it = info["instance_type"]
        regions = [r["name"] for r in info.get("regions_with_capacity_available", [])]
        rows.append((it.get("price_cents_per_hour", 0) / 100, name,
                     it.get("specs", {}).get("gpus", "?"),
                     it.get("gpu_description", ""), regions))
    for price, name, gpus, desc, regions in sorted(rows):
        mark = "*" if name in FLEET else " "
        print(f"{mark} {name:<24} ${price:>6.2f}/hr  {gpus}x {desc[:28]:<28} "
              + (", ".join(regions) if regions else "sold out"))
    print("\n* = in BURST_FLEET")
    return 0


def cmd_up(a):
    import lambda_gpu as L
    if state_read():
        sys.exit("an instance is already recorded in build/burst.json — "
                 "`status` to look, `down` to release it")
    if not a.yes:
        sys.exit("refusing to launch without --yes (this rents a GPU by the hour)")

    key = os.environ.get("LAMBDA_API_KEY", "").strip()

    name, region, info = L.pick_from_fleet(
        FLEET, prefs=[r for r in os.environ.get("BURST_REGIONS", "").split(",") if r],
        max_price=a.max_price)
    price = info.get("price_cents_per_hour", 0) / 100
    say(f"{name} in {region} — ${price:.2f}/hr, hard stop at {a.max_min} min "
        f"(${price * a.max_min / 60:.2f} worst case)")

    arch = "aarch64" if "gh200" in name else "x86_64"
    user_data = (BOOTSTRAP.read_text()
                 .replace("__MAX_MIN__", str(int(a.max_min)))
                 .replace("__ARCH__", arch)
                 .replace("__SELF_DESTRUCT_KEY__", "" if a.no_self_destruct else key)
                 .replace("__MODELS__", "\n".join(
                     f"{sub}|{fn}|{url}" for sub, fn, url in MODELS)))

    iid = L.launch(name, region, os.environ["LAMBDA_SSH_KEY_NAME"],
                   f"flamme-burst-{int(time.time())}", user_data)
    say(f"launched {iid}; waiting for an address")
    # Twenty minutes, not ten, and it says what it is waiting on. Lambda hands
    # out an address in about ninety seconds most days and in rather more than
    # ten minutes on a bad one — and the old ten-minute bound terminated a box
    # that was merely slow, having already paid for the boot, then went and
    # rented another one that had the same odds.
    ip = ""
    for i in range(120):
        d = L.get_instance(iid)
        ip = d.get("ip") or ""
        if ip and d.get("status") == "active":
            break
        if i and i % 12 == 0:
            say(f"  still {d.get('status') or 'pending'} at {i * 10 // 60} min")
        time.sleep(10)
    if not ip:
        say("no address after 20 minutes — terminating so it does not bill")
        L.terminate([iid])
        sys.exit(1)

    state_write({"id": iid, "ip": ip, "type": name, "region": region,
                 "price": price, "launched": time.time(),
                 "max_min": a.max_min})
    say(f"{ip} is up. Bootstrap is running on the box; watch it with")
    say(f"  {' '.join(shlex.quote(c) for c in ssh_base(ip))} "
        f"'tail -f /var/log/flamme-burst.log'")
    say("`tools/burst.py status` reports when ComfyUI answers.")
    return 0


def cmd_status(_a):
    st = state_read()
    if not st:
        print("no instance")
        return 0
    mins = (time.time() - st["launched"]) / 60
    print(f"{st['type']} {st['id']}  {st['ip']}  {st['region']}")
    print(f"up {mins:.0f} min · ${st['price'] * mins / 60:.2f} so far · "
          f"hard stop at {st['max_min']} min")
    r = ssh(st["ip"], "curl -s -o /dev/null -w '%{http_code}' "
            "http://127.0.0.1:8188/system_stats || true", check=False)
    ready = (r.stdout or "").strip() == "200"
    print("comfyui: " + ("ready" if ready else "not up yet"))
    if not ready:
        r = ssh(st["ip"], "tail -3 /var/log/flamme-burst.log 2>/dev/null || true",
                check=False)
        for ln in (r.stdout or "").splitlines():
            print("  " + ln)
    return 0


def cmd_run(a):
    """Frames up, workflow through a tunnel, results back. Nothing persists."""
    st = state_read()
    if not st:
        sys.exit("no instance — `up` first")
    ip, frames = st["ip"], Path(a.frames).expanduser()
    if not frames.is_dir():
        sys.exit(f"not a directory: {frames}")
    n_local = len(list(frames.glob("*.png")))
    say(f"{n_local} frames from {frames}")

    # Same 4k+1 truth as vacejob.py, needed here too: this is the number the
    # frame poll below waits for, and waiting for 75 when 73 is all the VAE can
    # emit is a ten-minute hang that ends in a timeout on a finished job.
    n = (a.n - 1) // 4 * 4 + 1
    if n != a.n:
        say(f"--n {a.n} rounded to {n} (4k+1)")

    # Which attention actually imports on this box. The bootstrap wrote it;
    # guessing sageattn on an ARM machine where it did not build is a crash at
    # model load, ten minutes and two dollars in.
    attn = a.attn
    if not attn:
        r = ssh(ip, "cat /home/ubuntu/job/attn 2>/dev/null || true", check=False)
        attn = (r.stdout or "").strip() or "sageattn"
        say(f"attention: {attn}")

    # ref_images: the second conditioning channel. `input_frames` says where
    # everything is, `ref_images` says what it is made of — and a photograph
    # does not argue with the model's prior about Dalmatian holiday scenery,
    # it replaces it. Worth its own upload.
    refs_remote = ""
    if a.ref:
        local = [Path(r.strip()).expanduser() for r in a.ref.split(",") if r.strip()]
        missing = [str(r) for r in local if not r.exists()]
        if missing:
            sys.exit("no such reference image(s): " + ", ".join(missing))
        ssh(ip, "mkdir -p ~/job/refs")
        subprocess.run(
            ["rsync", "-az", "-e", " ".join(ssh_base(ip)[:-1])]
            + [str(r) for r in local] + [f"ubuntu@{ip}:job/refs/"], check=True,
            stdin=subprocess.DEVNULL)
        refs_remote = ",".join(f"/home/ubuntu/job/refs/{r.name}" for r in local)
        say(f"refs: {refs_remote}")

    ssh(ip, "mkdir -p ~/job/frames ~/job/out")
    subprocess.run(
        ["rsync", "-az", "--delete", "-e", " ".join(ssh_base(ip)[:-1]),
         str(frames) + "/", f"ubuntu@{ip}:job/frames/"], check=True,
        stdin=subprocess.DEVNULL)

    tun = subprocess.Popen(
        ssh_base(ip)[:-1]
        + ["-o", "ExitOnForwardFailure=yes", "-N",
           "-L", f"{PORT}:127.0.0.1:8188", f"ubuntu@{ip}"],
        stdin=subprocess.DEVNULL)
    say(f"tunnel :{PORT} -> {ip}:8188")
    try:
        for _ in range(60):
            try:
                urllib.request.urlopen(
                    f"http://127.0.0.1:{PORT}/system_stats", timeout=5)
                break
            except Exception:                             # noqa: BLE001
                time.sleep(5)
        else:
            sys.exit("ComfyUI never answered through the tunnel — `status`")

        # And prove it is *our* ComfyUI. A port collision produces a tunnel that
        # answers perfectly while pointing somewhere else, so identity has to be
        # checked rather than assumed: write a nonce on the box over SSH, then
        # read it back through the tunnel. Different machine, different answer.
        nonce = f"{ip}-{PORT}-{os.getpid()}"
        ssh(ip, "mkdir -p ~/ComfyUI/input && printf '%s' "
                + shlex.quote(nonce) + " > ~/ComfyUI/input/burst-nonce.txt")
        try:
            got = urllib.request.urlopen(
                f"http://127.0.0.1:{PORT}/view?filename=burst-nonce.txt"
                "&type=input", timeout=15).read().decode()
        except Exception as e:                            # noqa: BLE001
            got = f"<unreadable: {e}>"
        if got != nonce:
            sys.exit(f"the tunnel on :{PORT} is NOT this instance "
                     f"(expected {nonce!r}, got {got!r}) — another burst has "
                     "that port. Set BURST_PORT and retry.")

        cmd = [sys.executable, str(ROOT / "tools" / "vacejob.py"),
               "--frames", "/home/ubuntu/job/frames", "--n", str(n),
               "--w", str(a.w), "--h", str(a.h), "--tag", a.tag,
               "--steps", str(a.steps), "--denoise", str(a.denoise),
               "--sim2real", str(a.sim2real), "--vace", str(a.vace),
               "--seed", str(a.seed), "--swap", str(a.swap),
               "--attn", attn,
               "--host", f"http://127.0.0.1:{PORT}"]
        if a.ctx:
            cmd += ["--ctx", str(a.ctx), "--ctxover", str(a.ctxover),
                    "--ctxstride", str(a.ctxstride)]
        if a.upscale:
            cmd += ["--upscale", a.upscale, "--outw", str(a.outw)]
        if a.pos:
            cmd += ["--pos", a.pos]
        if refs_remote:
            cmd += ["--ref", refs_remote]
        say("queueing " + a.tag)
        subprocess.run(cmd, check=True)

        want = n
        t0 = time.time()
        timed_out = False
        while True:
            # `grep -c` prints 0 AND exits 1 when it matches nothing, so a
            # trailing `|| echo 0` fires as well and the reply is "0\n0".
            # Count with wc instead, which has one exit status and one line.
            r = ssh(ip, f"ls ~/ComfyUI/output 2>/dev/null | grep 'vace{a.tag}_' "
                        "| wc -l", check=False)
            done = int((r.stdout or "0").strip().splitlines()[-1] or 0)
            say(f"{done}/{want} frames · {(time.time() - t0) / 60:.1f} min")
            if done >= want:
                break
            # Timed out — but do NOT exit here. Whatever frames exist are the
            # expensive part and they are still on a machine that is about to
            # be terminated; the old code sys.exit()ed on this branch, above
            # the rsync, and threw away a partial run that had already been
            # paid for. Fall through, fetch what there is, and report short.
            if time.time() - t0 > a.timeout * 60:
                timed_out = True
                say(f"gave up waiting after {a.timeout} min at {done}/{want} — "
                    "fetching whatever finished")
                break
            time.sleep(30)
    finally:
        tun.terminate()

    out = Path(a.out).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["rsync", "-az", "-e", " ".join(ssh_base(ip)[:-1]),
         f"ubuntu@{ip}:ComfyUI/output/", str(out) + "/",
         "--include", f"vace{a.tag}_*", "--include", "*/", "--exclude", "*"],
        check=True, stdin=subprocess.DEVNULL)
    got = len(list(out.glob(f"vace{a.tag}_*")))
    mins = (time.time() - st["launched"]) / 60
    say(f"{got} frames in {out} · ${st['price'] * mins / 60:.2f} spent so far")
    say("`tools/burst.py down` when you are finished — the meter is running")
    return 2 if timed_out else 0


def cmd_down(_a):
    import lambda_gpu as L
    st = state_read()
    if not st:
        print("no instance")
        return 0
    mins = (time.time() - st["launched"]) / 60
    L.terminate([st["id"]])
    STATE.unlink(missing_ok=True)
    say(f"terminated {st['id']} after {mins:.0f} min · "
        f"${st['price'] * mins / 60:.2f}")
    return 0


def main():
    env_from(ABLIT / ".env")
    env_from(ROOT / ".env")
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("preflight").set_defaults(fn=cmd_preflight)
    sub.add_parser("types").set_defaults(fn=cmd_types)
    sub.add_parser("status").set_defaults(fn=cmd_status)
    sub.add_parser("down").set_defaults(fn=cmd_down)

    u = sub.add_parser("up")
    u.add_argument("--yes", action="store_true")
    u.add_argument("--max-min", type=float, default=90)
    u.add_argument("--max-price", type=float, default=4.50)
    u.add_argument("--no-self-destruct", action="store_true")
    u.set_defaults(fn=cmd_up)

    r = sub.add_parser("run")
    r.add_argument("frames")
    r.add_argument("--n", type=int, default=49)
    r.add_argument("--w", type=int, default=848)
    r.add_argument("--h", type=int, default=480)
    r.add_argument("--tag", default="_burst")
    r.add_argument("--steps", type=int, default=12)
    r.add_argument("--denoise", type=float, default=0.80)
    r.add_argument("--sim2real", type=float, default=0.70)
    r.add_argument("--vace", type=float, default=1.0)
    r.add_argument("--seed", type=int, default=7731)
    r.add_argument("--ctx", type=int, default=0)
    r.add_argument("--ctxover", type=int, default=24)
    r.add_argument("--ctxstride", type=int, default=4)
    r.add_argument("--upscale", default="RealESRGAN_x4plus.pth")
    # ESRGAN is 40-45 per cent of the wall clock of every run, and at 720p it is
    # no longer buying resolution — 1280x720 is already deliverable. Being able
    # to switch it off is the difference between measuring the model and
    # measuring the model plus a fixed upscaling tax.
    r.add_argument("--no-upscale", dest="upscale", action="store_const",
                   const="")
    r.add_argument("--outw", type=int, default=1920)
    r.add_argument("--pos", default=None)
    r.add_argument("--out", default=str(Path.home() / "fr-video" / "burst"))
    r.add_argument("--timeout", type=float, default=60)
    r.add_argument("--attn", default="")
    # Local paths, comma-separated. They get rsynced to the box and rewritten to
    # box-side paths, because `ref_images` wants files the instance can open and
    # the photographs live on the laptop.
    r.add_argument("--ref", default="")
    # 0 is right for 80 GB and a guaranteed OOM on an A10: 22.6 GB usable does
    # not hold 16.3 GB of weights plus a 20 670-token activation set. Measured:
    # A10 needs 20 at 480p and 40 at 720p.
    r.add_argument("--swap", type=int, default=0)
    r.set_defaults(fn=cmd_run)

    a = p.parse_args()
    sys.exit(a.fn(a))


if __name__ == "__main__":
    main()
