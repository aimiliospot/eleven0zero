#!/bin/sh
# Keys mounted from Windows arrive with loose permissions that ssh rejects: copy and chmod them first.
# ssh config written on Windows references C:/Users/<you>/... key paths: rewrite them to the copies.
mkdir -p /root/.ssh /root/.boxd
{ cp -r /ssh-src/. /root/.ssh/ 2>/dev/null || true; }
{ cp /boxd-src/id_* /root/.boxd/ 2>/dev/null || true; }
chmod 700 /root/.ssh /root/.boxd
find /root/.ssh /root/.boxd -type f -exec chmod 600 {} +
[ ! -f /root/.ssh/config ] || sed -i -E \
  -e 's#[A-Za-z]:[/\]Users[/\][^/\]+[/\]AppData[/\]Roaming[/\]boxd#/root/.boxd#g' \
  -e 's#[A-Za-z]:[/\]Users[/\][^/\]+[/\]\.ssh#/root/.ssh#g' /root/.ssh/config
exec "$@"
