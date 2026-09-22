#!/usr/bin/env bash
# Put the built page on edeliverables, with a retry.
#
# WHY THIS EXISTS. A night of one-deploy-per-increment sent the 33 MB page up
# fifteen times in seven hours, and on the fifteenth the host started refusing
# connections outright — `kex_exchange_identification: read: Connection reset
# by peer`, which is sshd shutting the door rather than a network fault. It
# cleared by itself in two minutes. Nothing was wrong with the build, the file
# or the key, and the only cost was working out which of those it was.
#
# So: three tries, ninety seconds apart, and the version on the server is read
# back and compared with the one in build.py. A deploy that says nothing is a
# deploy nobody checked.
set -u
cd "$(dirname "$0")/.."

# ANCHORED AT THE LINE START. Without the caret this also matches
# `THREE_VERSION = "0.180.0"` two lines below it, and what comes back is two
# versions separated by a newline — which never equals the one the server
# serves, so a deploy that worked reports as a failure and retries twice.
WANT=$(grep -oP '^VERSION = "\K[^"]+' build.py)
WEB=edeliverables.com:/var/www/vhost/edeliverables/public_html/flamme-retarde
DEST=$WEB/index.html

# The wardrobe viewer goes up beside the game, and NOT in the retry loop: it
# has no version stamp to read back, it changes on the rare days the rack
# changes rather than on every increment, and a failure to copy it must not
# report the game as undeployed. Unchanged bytes are skipped outright, because
# the whole reason deploy.sh counts its attempts is that this host starts
# refusing connections when fifteen large files go up in seven hours.
if [ -f wardrobe.html ]; then
  SUM=$(md5sum wardrobe.html | cut -c1-32)
  GOTSUM=$(curl -s https://flamme-retarde.edeliverables.com/wardrobe.html | md5sum | cut -c1-32)
  if [ "$SUM" = "$GOTSUM" ]; then
    echo "wardrobe.html unchanged"
  elif scp -C -o ConnectTimeout=20 wardrobe.html "$WEB/wardrobe.html" 2>/dev/null; then
    echo "wardrobe.html deployed"
  else
    echo "wardrobe.html FAILED to copy (the game deploy below is unaffected)"
  fi
fi

for try in 1 2 3; do
  if scp -C -o ConnectTimeout=20 flamme-retarde.html "$DEST" 2>/dev/null; then
    GOT=$(curl -s -r 0-900 https://flamme-retarde.edeliverables.com/ \
      | grep -oP 'name="version" content="\K[^"]+')
    if [ "$GOT" = "$WANT" ]; then
      echo "deployed $WANT"
      exit 0
    fi
    echo "served $GOT, wanted $WANT"
  fi
  echo "try $try failed"
  [ "$try" -lt 3 ] && sleep 90
done
echo "DEPLOY FAILED — $WANT is committed and pushed but not served"
exit 1
