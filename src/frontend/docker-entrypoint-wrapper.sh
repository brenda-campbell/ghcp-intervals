#!/bin/sh
# Extract DNS resolver from /etc/resolv.conf for nginx dynamic upstream resolution
export RESOLVER=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)
echo "Using DNS resolver: $RESOLVER"
echo "API_FQDN is: $API_FQDN"
exec /docker-entrypoint.sh "$@"
