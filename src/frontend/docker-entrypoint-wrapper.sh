#!/bin/sh
set -e

# Replace the placeholder with the actual API FQDN using sed.
# This avoids envsubst which can corrupt nginx $ variables like $host, $uri.
echo "Configuring nginx proxy to API_FQDN: ${API_FQDN}"

sed "s|API_FQDN_PLACEHOLDER|${API_FQDN}|g" \
    /etc/nginx/nginx.conf.template \
    > /etc/nginx/conf.d/default.conf

echo "Generated nginx config:"
cat /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
