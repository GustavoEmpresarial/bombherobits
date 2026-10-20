#!/bin/sh
# One-time HTTPS bootstrap. Poll DNS without submitting repeated failed ACME orders.
set -eu
exec 9>/run/lock/herobits-domain.lock
flock -n 9 || exit 0
hb_shared=/opt/herobits/shared
hb_lineage=/etc/letsencrypt/live/bombherobits.pro
if ! python3 - <<'PY'
import json, urllib.request
urls = [
 'https://dns.google/resolve?name=bombherobits.pro&type=A',
 'https://cloudflare-dns.com/dns-query?name=bombherobits.pro&type=A',
]
for url in urls:
 try:
  req=urllib.request.Request(url,headers={'Accept':'application/dns-json','User-Agent':'HeroBits-domain-setup/1.0'})
  data=json.load(urllib.request.urlopen(req,timeout=12))
  addresses={row['data'] for row in data.get('Answer',[]) if row['type']==1}
  if data.get('Status')!=0 or addresses!={'5.189.157.88'}:
   print('PENDING: public DNS has not converged to 5.189.157.88 for bombherobits.pro.',flush=True)
   raise SystemExit(1)
 except Exception as error:
  print('PENDING: DNS check unavailable: '+str(error),flush=True)
  raise SystemExit(1)
print('Public DNS verified on Google and Cloudflare.',flush=True)
PY
then
    exit 0
fi
if [ ! -f "$hb_lineage/fullchain.pem" ]; then
    hb_now=$(date +%s)
    hb_last=0
    if [ -f "$hb_shared/domain-last-acme-attempt" ]; then hb_last=$(cat "$hb_shared/domain-last-acme-attempt"); fi
    if [ "$((hb_now - hb_last))" -lt 3600 ]; then
        echo 'PENDING: ACME cooldown; the next DNS check will retry after the cooldown.'
        exit 0
    fi
    printf '%s\n' "$hb_now" > "$hb_shared/domain-last-acme-attempt"
    certbot certonly --webroot -w /root/blockminer-dev/nginx/ssl/acme-webroot \
        --cert-name bombherobits.pro -d bombherobits.pro \
        --non-interactive --agree-tos --register-unsafely-without-email \
        --deploy-hook /opt/herobits/shared/renew-domain.sh
fi
RENEWED_LINEAGE="$hb_lineage" "$hb_shared/renew-domain.sh"
cp "$hb_shared/domain-https.conf" /root/blockminer-dev/nginx/includes/herobits-domain.conf
if ! docker exec blockminer-dev-nginx nginx -t; then
    cp "$hb_shared/domain-http.conf" /root/blockminer-dev/nginx/includes/herobits-domain.conf
    echo 'ERROR: HTTPS configuration rejected; HTTP bootstrap restored.'
    exit 1
fi
docker exec blockminer-dev-nginx nginx -s reload
python3 - <<'PY'
from pathlib import Path
path=Path('/opt/herobits/shared/.env')
lines=path.read_text().splitlines()
lines=[line for line in lines if not line.startswith('WEB_ORIGIN=')]
lines.append('WEB_ORIGIN=https://bombherobits.pro')
path.write_text('\n'.join(lines)+'\n')
path.chmod(0o600)
PY
cd /opt/herobits/current
docker compose --env-file "$hb_shared/.env" -f deploy/compose.yml up -d --no-deps api
docker exec herobits-web nginx -t
docker exec herobits-web nginx -s reload
curl --fail --silent --show-error --resolve bombherobits.pro:443:127.0.0.1 \
    --retry 8 --retry-delay 2 --retry-all-errors --connect-timeout 5 --max-time 10 \
    https://bombherobits.pro/api/health
printf '\nHTTPS active: https://bombherobits.pro\n'
systemctl disable --now herobits-domain-setup.timer
