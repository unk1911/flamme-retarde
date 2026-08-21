#!/bin/bash
# Flamme Retardé burst bootstrap — runs ONCE as root on a fresh Lambda box via
# cloud-init user_data. tools/burst.py fills the __DOUBLE_UNDERSCORE__ slots
# before launch. Progress lands in /var/log/flamme-burst.log, which
# `tools/burst.py status` tails.
#
# The shape of this file is ablit-central/bin/lambda-bootstrap.sh's, deliberately
# — that one is proven and this is the same problem with a different payload.
#
# THE FIRST THING IT DOES IS ARM THE SELF-DESTRUCT, before anything that could
# hang. Every other ordering has a window where a box is billing with nothing
# able to stop it, and the whole reason this runs on the instance instead of on
# the operator's laptop is that the laptop rebooted mid-job once already.
set -uo pipefail
exec > >(tee -a /var/log/flamme-burst.log) 2>&1
log(){ echo "[burst $(date -u +%T)] $*"; }

MAX_MIN=__MAX_MIN__
ARCH=__ARCH__
SD_KEY='__SELF_DESTRUCT_KEY__'

# ---- 1. the hard stop --------------------------------------------------------
# Lambda has no server-side "terminate me at T+n", and `shutdown -h` stops the
# machine without stopping the bill, so the only real dead-man's switch is the
# API called from here. Written as a systemd transient timer so it survives this
# script failing, the SSH tunnel dropping, and anybody going to bed.
if [ -n "$SD_KEY" ]; then
  install -m 700 -d /opt/burst
  cat > /opt/burst/selfdestruct.sh <<'EOS'
#!/bin/bash
KEY=$(cat /opt/burst/key)
ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null)
[ -n "$ID" ] || ID=$(curl -s -H "Authorization: Bearer $KEY" \
  https://cloud.lambda.ai/api/v1/instances \
  | python3 -c 'import sys,json,socket;d=json.load(sys.stdin)["data"];
me=socket.gethostbyname(socket.gethostname())
print(next((i["id"] for i in d if i.get("ip")==me),""))' 2>/dev/null)
[ -n "$ID" ] || exit 1
curl -s -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d "{\"instance_ids\":[\"$ID\"]}" \
  https://cloud.lambda.ai/api/v1/instance-operations/terminate
EOS
  printf '%s' "$SD_KEY" > /opt/burst/key
  chmod 600 /opt/burst/key; chmod 700 /opt/burst/selfdestruct.sh
  systemd-run --on-active="${MAX_MIN}min" --unit=flamme-selfdestruct \
    /opt/burst/selfdestruct.sh
  log "self-destruct armed for T+${MAX_MIN} min"
else
  log "WARNING: no self-destruct key — nothing on this box can stop the bill"
fi

# ---- 2. system ---------------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
apt-get update -y || true
apt-get install -y git python3-venv python3-pip aria2 ffmpeg build-essential || true

# ---- 3. ComfyUI --------------------------------------------------------------
cd /home/ubuntu
# Pinned, not master. Master pulls in `comfy_kitchen`, whose na3d custom op is
# annotated `kernel_size: list[int]` — PEP 585 builtin generics, which
# torch.library.infer_schema rejects on 2.5 AND 2.6 (it wants typing.List[int]).
# ComfyUI then crashloops on import with a ValueError that names neither
# ComfyUI nor the node. v0.3.41 is what the laptop runs and predates it.
sudo -u ubuntu git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
sudo -u ubuntu git checkout -q v0.3.41
sudo -u ubuntu python3 -m venv venv
V=/home/ubuntu/ComfyUI/venv/bin
sudo -u ubuntu $V/pip install -q --upgrade pip wheel

# torch. Lambda images ship CUDA 12.x; aarch64 needs the ARM index, which is why
# `up` passes the arch down rather than letting pip guess.
if [ "$ARCH" = "aarch64" ]; then
  log "torch for aarch64 (cu124)"
  sudo -u ubuntu $V/pip install -q torch torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/cu124
  # Explicit, because the aarch64 torch wheel does not depend on triton the way
  # the x86 one does, and sageattention imports triton at *import* time. Without
  # it, `pip install sageattention` succeeds and `import sageattention` raises —
  # which is exactly the shape of failure the old best-effort probe could not
  # see, since it only looked at pip's exit status.
  log "triton for aarch64 (sageattention needs it at import)"
  sudo -u ubuntu $V/pip install -q triton || log "  triton unavailable"
else
  log "torch for x86_64 (cu121)"
  sudo -u ubuntu $V/pip install -q torch torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/cu121
fi
sudo -u ubuntu $V/pip install -q -r requirements.txt

# ── custom nodes, pinned to the commits the laptop runs ────────────────────
#
# Three of them, and the first version of this file had one wrong and one
# missing. Both cost a paid boot to find, so they are written down:
#
#   KJNodes was not here at all. It is not obvious that it is needed — nothing
#   in the workflow is called "KJ" except `ImageResizeKJ`, which is the node
#   that fits the control frames to the sampler's resolution. The queue is
#   rejected with "Cannot execute because node ImageResizeKJ does not exist",
#   twelve minutes and $1.26 into an instance.
#
#   And `--depth 1` of master is wrong for all three. Latest WanVideoWrapper
#   imports `apply_rope1` from `comfy.ldm.flux.math`, which exists in ComfyUI
#   master and not in the v0.3.41 this pins to — so the wrapper fails to import
#   and every WanVideo* node silently vanishes from /object_info while ComfyUI
#   itself starts up perfectly happily. A custom node that fails to import is a
#   log line, not an error.
#
# So: the same commits the laptop has, fetched by sha. The pairing is what
# matters — ComfyUI and its nodes move together, and any two halves from
# different weeks are a coin toss.
cd custom_nodes
clone_at() {   # clone_at <repo> <sha>
  local name=${1##*/}
  sudo -u ubuntu git clone -q "https://github.com/$1.git" || return 1
  ( cd "$name" && sudo -u ubuntu git fetch -q --depth 1 origin "$2" \
      && sudo -u ubuntu git checkout -q FETCH_HEAD ) || log "  WARN $name not pinned"
  # `sudo -u ubuntu` on the rev-parse too. Without it root asks git about a
  # ubuntu-owned repo, hits dubious-ownership, and the pin is logged as an
  # empty string — so the one line that proves which commit is on the box
  # silently proves nothing.
  log "  $name @ $(cd "$name" && sudo -u ubuntu git rev-parse --short HEAD)"
}
clone_at kijai/ComfyUI-WanVideoWrapper 8479624614ec0d52e982bbbab633736fb1a15eef
clone_at kijai/ComfyUI-KJNodes         f7eb33abc80a2aded1b46dff0dd14d07856a7d50
clone_at Kosinkadink/ComfyUI-VideoHelperSuite a7ce59e381934733bfae03b1be029756d6ce936d
for d in */; do
  [ -f "$d/requirements.txt" ] && sudo -u ubuntu $V/pip install -q -r "$d/requirements.txt"
done

# sageattention is a 2-3x attention win and the most likely thing to fail on ARM.
#
# An earlier version of this file said it was safe to skip because
# "WanVideoWrapper falls back to sdpa". It does not. `attention_mode` goes
# straight from vacejob.py into the model loader and is used as given, so a box
# with no sageattention does not render slowly — it raises at model load, ten
# minutes and two dollars into an instance.
#
# And pip's exit status is not the test. On aarch64 the install reports success
# and the import fails on missing triton. So: install, then actually import it,
# and write the verdict where `burst.py run` can read it and pass --attn.
log "sageattention (best effort)"
sudo -u ubuntu $V/pip install -q sageattention || log "  pip could not install it"
sudo -u ubuntu mkdir -p /home/ubuntu/job
if sudo -u ubuntu $V/python -c 'import sageattention' 2>/dev/null; then
  echo sageattn | sudo -u ubuntu tee /home/ubuntu/job/attn >/dev/null
  log "  sageattention imports — using sageattn"
else
  echo sdpa | sudo -u ubuntu tee /home/ubuntu/job/attn >/dev/null
  log "  sageattention does NOT import — falling back to sdpa (slower)"
fi

# ---- 4. models ---------------------------------------------------------------
# Pulled from HuggingFace by the instance, not pushed from the laptop: 38 GB up
# a home connection is hours, and down Lambda's is minutes. If LAMBDA_FS_NAME
# mounted a persistent filesystem, symlink into it so the next burst skips this
# entirely.
cd /home/ubuntu/ComfyUI/models
FS=$(ls -d /home/ubuntu/*/ 2>/dev/null | grep -v ComfyUI | head -1)
log "fetching models${FS:+ (cache: $FS)}"
while IFS='|' read -r sub fn url; do
  [ -n "$sub" ] || continue
  sudo -u ubuntu mkdir -p "$sub"
  if [ -n "$FS" ] && [ -f "$FS/models/$sub/$fn" ]; then
    sudo -u ubuntu ln -sf "$FS/models/$sub/$fn" "$sub/$fn"
    log "  cached $fn"
    continue
  fi
  sudo -u ubuntu aria2c -x8 -s8 -q --allow-overwrite=true \
    -d "$sub" -o "$fn" "$url" || log "  FAILED $fn"
  if [ -n "$FS" ]; then
    sudo -u ubuntu mkdir -p "$FS/models/$sub"
    sudo -u ubuntu cp -n "$sub/$fn" "$FS/models/$sub/$fn" 2>/dev/null || true
  fi
  log "  got $fn"
done <<'MODELS'
__MODELS__
MODELS

# ---- 5. serve ----------------------------------------------------------------
# Loopback only. The operator reaches it through an SSH tunnel; nothing here is
# exposed to the internet.
cat > /etc/systemd/system/comfyui.service <<EOS
[Unit]
Description=ComfyUI
After=network.target
[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/ComfyUI
ExecStart=$V/python main.py --listen 127.0.0.1 --port 8188 --disable-auto-launch
Restart=on-failure
[Install]
WantedBy=multi-user.target
EOS
systemctl daemon-reload

# Wait for CUDA before starting, because on an SXM box it is not ready when the
# instance is. H100 SXM5 sits at `Fabric State: In Progress` while NVSwitch
# initialises, and until it clears, cudaGetDeviceCount() returns error 802 and
# torch reports no GPU at all. ComfyUI starting into that crashloops until
# systemd gives up, and the failure names CUDA rather than the fabric. One box
# never cleared it in 24 minutes and had to be scrapped — so this gives up after
# five and says so, which is a cheaper way to learn the same thing.
for i in $(seq 1 30); do
  if sudo -u ubuntu $V/python -c 'import torch,sys; sys.exit(0 if torch.cuda.is_available() else 1)' 2>/dev/null; then
    log "cuda ready after $((i*10))s"; break
  fi
  systemctl start nvidia-fabricmanager >/dev/null 2>&1
  [ $i -eq 30 ] && log "WARNING cuda never came up — fabric stuck; scrap this box"
  sleep 10
done

systemctl enable --now comfyui
log "comfyui starting; bootstrap done"

# One last check, because a missing custom node does not stop ComfyUI starting —
# it just removes nodes from /object_info and turns the first queue into a 400.
for i in $(seq 1 20); do
  miss=$(curl -s http://127.0.0.1:8188/object_info 2>/dev/null | python3 -c '
import json, sys
try: d = json.load(sys.stdin)
except Exception: sys.exit(1)
need = ["WanVideoSampler", "WanVideoVACEEncode", "WanVideoModelLoader",
        "ImageResizeKJ", "VHS_LoadImagesPath", "ImageUpscaleWithModel"]
print(",".join(n for n in need if n not in d))' 2>/dev/null) && break
  sleep 15
done
[ -z "${miss:-}" ] && log "all workflow nodes present" \
                   || log "WARNING missing nodes: $miss"
