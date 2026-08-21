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
sudo -u ubuntu git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
sudo -u ubuntu python3 -m venv venv
V=/home/ubuntu/ComfyUI/venv/bin
sudo -u ubuntu $V/pip install -q --upgrade pip wheel

# torch. Lambda images ship CUDA 12.x; aarch64 needs the ARM index, which is why
# `up` passes the arch down rather than letting pip guess.
if [ "$ARCH" = "aarch64" ]; then
  log "torch for aarch64 (cu124)"
  sudo -u ubuntu $V/pip install -q torch torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/cu124
else
  log "torch for x86_64 (cu121)"
  sudo -u ubuntu $V/pip install -q torch torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/cu121
fi
sudo -u ubuntu $V/pip install -q -r requirements.txt

# custom nodes: the wrapper that owns every WanVideo* node, and VHS for
# VHS_LoadImagesPath. Pinned to nothing on purpose — the workflow is validated
# against /object_info at queue time by vacejob.py, which fails loudly on a
# renamed input rather than silently sampling the wrong thing.
cd custom_nodes
for r in kijai/ComfyUI-WanVideoWrapper Kosinkadink/ComfyUI-VideoHelperSuite; do
  sudo -u ubuntu git clone --depth 1 "https://github.com/$r.git"
done
for d in */; do
  [ -f "$d/requirements.txt" ] && sudo -u ubuntu $V/pip install -q -r "$d/requirements.txt"
done

# sageattention is a 2-3x attention win and is the most likely thing to fail on
# ARM, so it is best-effort and explicitly not fatal: WanVideoWrapper falls back
# to sdpa, which is slower and correct. Better a slow render than a dead box
# that already cost twelve minutes of boot.
log "sageattention (best effort)"
sudo -u ubuntu $V/pip install -q sageattention || log "sageattention unavailable — sdpa it is"

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
systemctl enable --now comfyui
log "comfyui starting; bootstrap done"
