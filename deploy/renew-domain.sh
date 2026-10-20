#!/bin/sh
# Certbot deploy hook; never print key material or the production environment.
set -eu
hb_lineage=${RENEWED_LINEAGE:-/etc/letsencrypt/live/bombherobits.pro}
[ "$hb_lineage" = /etc/letsencrypt/live/bombherobits.pro ] || exit 0
openssl x509 -in "$hb_lineage/fullchain.pem" -noout -checkhost bombherobits.pro >/dev/null
umask 077
install -d -m 700 /root/blockminer-dev/nginx/ssl/herobits
install -m 644 "$hb_lineage/fullchain.pem" /root/blockminer-dev/nginx/ssl/herobits/fullchain.pem.next
install -m 600 "$hb_lineage/privkey.pem" /root/blockminer-dev/nginx/ssl/herobits/privkey.pem.next
mv /root/blockminer-dev/nginx/ssl/herobits/fullchain.pem.next /root/blockminer-dev/nginx/ssl/herobits/fullchain.pem
mv /root/blockminer-dev/nginx/ssl/herobits/privkey.pem.next /root/blockminer-dev/nginx/ssl/herobits/privkey.pem
docker exec blockminer-dev-nginx nginx -t
docker exec blockminer-dev-nginx nginx -s reload
