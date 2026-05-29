#!/usr/bin/env bash
# Run on the VPS as root (or with sudo) after: cd /var/www && git clone ...
# Usage: sudo bash /var/www/nexus/deploy/setup-vps.sh
set -euo pipefail

NEXUS_ROOT="${NEXUS_ROOT:-/var/www/nexus}"
HTTP_PORT="${HTTP_PORT:-8090}"
SERVER_URL="${SERVER_URL:-http://127.0.0.1:${HTTP_PORT}}"
DB_NAME="${DB_NAME:-nexus}"
DB_USER="${DB_USER:-nexus}"
DB_PASS="${DB_PASS:-}"

if [[ ! -d "$NEXUS_ROOT/backend" ]]; then
  echo "Missing $NEXUS_ROOT/backend — clone the repo first:"
  echo "  cd /var/www && git clone https://github.com/Oussama1002/nexus.git nexus"
  exit 1
fi

if [[ -z "$DB_PASS" ]]; then
  read -rsp "MySQL password for user '$DB_USER': " DB_PASS
  echo
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git nginx mariadb-server \
  php8.3-fpm php8.3-cli php8.3-mysql php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-bcmath unzip

if ! command -v composer >/dev/null 2>&1; then
  curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;"

cd "$NEXUS_ROOT/backend"
if [[ ! -f .env ]]; then
  cp .env.example .env
  php artisan key:generate --force
fi

# Patch core production settings (idempotent)
grep -q "^APP_ENV=production" .env 2>/dev/null || {
  sed -i 's/^APP_ENV=.*/APP_ENV=production/' .env
  sed -i 's/^APP_DEBUG=.*/APP_DEBUG=false/' .env
  sed -i "s|^APP_URL=.*|APP_URL=${SERVER_URL}|" .env
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=${SERVER_URL}|" .env
  sed -i 's/^DB_CONNECTION=.*/DB_CONNECTION=mysql/' .env
  sed -i "s/^DB_DATABASE=.*/DB_DATABASE=${DB_NAME}/" .env
  sed -i "s/^DB_USERNAME=.*/DB_USERNAME=${DB_USER}/" .env
  sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=${DB_PASS}/" .env
}

composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan storage:link 2>/dev/null || true
php artisan config:cache
php artisan route:cache

chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache

cd "$NEXUS_ROOT/frontend"
echo "VITE_API_BASE_URL=${SERVER_URL}/api" > .env.production
npm ci
npm run build

cp "$NEXUS_ROOT/deploy/nginx-nexus.conf" /etc/nginx/sites-available/nexus
sed -i "s/listen 8090/listen ${HTTP_PORT}/" /etc/nginx/sites-available/nexus
sed -i "s/listen \[::\]:8090/listen [::]:${HTTP_PORT}/" /etc/nginx/sites-available/nexus
ln -sf /etc/nginx/sites-available/nexus /etc/nginx/sites-enabled/nexus
nginx -t
systemctl reload nginx

echo ""
echo "Done. Open: ${SERVER_URL}"
echo "Health:  ${SERVER_URL}/api/health"
echo "If firewall is on: ufw allow ${HTTP_PORT}/tcp"
