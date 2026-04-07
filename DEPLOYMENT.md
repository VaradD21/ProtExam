# Deployment Guide

## Prerequisites
- Node.js 14+ 
- npm or yarn
- A machine to host the application
- A domain name (optional, for HTTPS)

## Production Deployment

### 1. Environment Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/protexam.git
cd protexam

# Install dependencies
cd backend
npm install
cd ..

# Create production .env file
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with production values:

```env
PORT=8000
NODE_ENV=production
JWT_SECRET=your-very-secure-random-key-here
CORS_ORIGIN=https://yourdomain.com
DATABASE_PATH=/var/lib/protexam/protexam.db
```

### 3. Database Setup

```bash
# Create data directory
mkdir -p /var/lib/protexam
chmod 755 /var/lib/protexam

# Database will be auto-created on first run
```

### 4. Start the Server

```bash
cd backend
NODE_ENV=production npm start
```

### 5. Use a Process Manager (Recommended)

Install PM2:
```bash
npm install -g pm2
```

Create `backend/ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'protexam',
    script: './server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 8000
    },
    instances: 4,
    exec_mode: 'cluster'
  }]
};
```

Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 6. Setup Nginx Reverse Proxy

Create `/etc/nginx/sites-available/protexam`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/protexam /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Setup HTTPS with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 8. Backup Strategy

Create a backup script (`backup.sh`):

```bash
#!/bin/bash
BACKUP_DIR="/backups/protexam"
DB_FILE="/var/lib/protexam/protexam.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp $DB_FILE $BACKUP_DIR/protexam_$DATE.db
gzip $BACKUP_DIR/protexam_$DATE.db
```

Schedule with cron:
```bash
0 2 * * * /path/to/backup.sh
```

### 9. Monitoring

Install and configure monitoring tools:
- PM2 Plus for application monitoring
- Nginx logs for access monitoring
- System logs for error tracking

## Docker Deployment (Optional)

Create `Dockerfile`:

```dockerfile
FROM node:16-alpine

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production

COPY backend/ .

EXPOSE 8000
ENV NODE_ENV=production
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t protexam:latest .
docker run -d -p 8000:8000 -v protexam-data:/app/backend/data protexam:latest
```

## Security Checklist

- [ ] Changed JWT_SECRET
- [ ] Updated CORS_ORIGIN
- [ ] Enabled HTTPS/SSL
- [ ] Set up firewall rules
- [ ] Enabled database backups
- [ ] Configured access logs
- [ ] Set NODE_ENV=production
- [ ] Secured .env file permissions
- [ ] Configured anti-DDoS measures
- [ ] Set up monitoring and alerts

## Troubleshooting

### Port already in use
```bash
lsof -i :8000
kill -9 <PID>
```

### Database locked
Restart the application - database will recover.

### High memory usage
Configure PM2 instance management or use clustering.

### CORS errors
Check CORS_ORIGIN in .env matches your domain.

## Support

For issues, check the documentation or open an issue on GitHub.
