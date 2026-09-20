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

WANT=$(grep -oP 'VERSION = "\K[^"]+' build.py)
DEST=edeliverables.com:/var/www/vhost/edeliverables/public_html/flamme-retarde/index.html

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
