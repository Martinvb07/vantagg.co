# VANTA en un VPS Ubuntu con PM2 + nginx (vantagg.co)

Alternativa a Docker (DESPLIEGUE.md). La tienda corre con PM2 en `127.0.0.1:3020`, nginx la publica con HTTPS y cada push a `main` se despliega solo con GitHub Actions (`.github/workflows/deploy.yml`).

## 1. Servidor base (como root)

```bash
apt update && apt upgrade -y
apt install -y git curl nginx mysql-server certbot python3-certbot-nginx ufw
adduser vanta && usermod -aG sudo vanta
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
mkdir -p /var/lib/vanta/uploads /var/www/vantagg && chown -R vanta:vanta /var/lib/vanta /var/www/vantagg
```

## 2. MySQL

```bash
mysql_secure_installation
mysql -u root
```
```sql
CREATE DATABASE vanta_store CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'vanta'@'localhost' IDENTIFIED BY 'CLAVE_FUERTE';
GRANT ALL PRIVILEGES ON vanta_store.* TO 'vanta'@'localhost';
FLUSH PRIVILEGES;
```

## 3. Node 22 + PM2 (como usuario vanta)

```bash
su - vanta
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22 && npm i -g pm2
pm2 startup   # copia y ejecuta el comando sudo que imprime
```

## 4. Código y variables

```bash
ssh-keygen -t ed25519 -C "vps-vantagg"     # agrega ~/.ssh/id_ed25519.pub como Deploy key (solo lectura) del repo
git clone git@github.com:Martinvb07/vantagg.co.git /var/www/vantagg
cd /var/www/vantagg
nano .env
```

En `.env` pega el contenido de `deploy/.env.production` de tu PC y agrega:

```
DATABASE_URL=mysql://vanta:CLAVE_FUERTE@127.0.0.1:3306/vanta_store
UPLOADS_DIR=/var/lib/vanta/uploads
```

```bash
chmod 600 .env
npm ci && npx prisma migrate deploy && npm run build
npm run db:seed
pm2 start deploy/ecosystem.config.js && pm2 save
curl -s http://127.0.0.1:3020/api/health
```

Configuración de tu PC: `npm run config:exportar`, súbela con `scp -r exportacion/config-XXXX vanta@IP:~/` y en el VPS:
`npm run config:importar -- ~/config-XXXX` (simula) y luego con `--confirmar`.

## 5. DNS + nginx + HTTPS

GoDaddy → DNS: `A @ → IP del VPS`, `CNAME www → vantagg.co`. Luego:

```bash
sudo cp deploy/nginx-vantagg.conf /etc/nginx/sites-available/vantagg
sudo ln -s /etc/nginx/sites-available/vantagg /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d vantagg.co -d www.vantagg.co --redirect
```

Sube el límite de subida en el bloque 443 que dejó certbot: `client_max_body_size 8m;` y `sudo systemctl reload nginx`.

## 6. Deploy automático (GitHub Actions)

En el VPS (usuario vanta), una clave solo para Actions:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/gh_actions -N ""
cat ~/.ssh/gh_actions.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/gh_actions          # contenido para el secreto VPS_SSH_KEY
```

GitHub → repo → Settings → Environments → **produccion** → secretos:

| Secreto | Valor |
|---|---|
| `VPS_HOST` | IP del VPS |
| `VPS_USER` | `vanta` |
| `VPS_PATH` | `/var/www/vantagg` |
| `VPS_SSH_KEY` | la clave privada `gh_actions` completa |

Cada push a `main`: tipos + pruebas + build en CI → en el VPS `git reset`, `npm ci`, migraciones, build, PM2 y health check a `/api/health` (si falla, vuelve a la versión anterior).

## 7. Cron y respaldos

```bash
crontab -e
```
```cron
*/2 * * * * curl -fsS -m 50 -H "Authorization: Bearer TU_CRON_SECRET" https://vantagg.co/api/cron/maintenance > /dev/null
30 3 * * * sh /var/www/vantagg/deploy/respaldo-vps.sh >> /home/vanta/respaldo.log 2>&1
```

Para el respaldo crea `~/.my.cnf` (`chmod 600`):

```
[client]
user=vanta
password=CLAVE_FUERTE
```

## Comandos útiles

```bash
pm2 status · pm2 logs vanta · pm2 restart vanta
npm run verificar:produccion      # debe decir «Sin bloqueantes»
```
