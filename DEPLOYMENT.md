# Deployment Guide

This guide covers deploying the Hartfelt Real Estate Agents Portal to production.

## Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Supabase project created and configured
- [ ] Vault API running and accessible
- [ ] Database tables created (see README)
- [ ] RLS policies configured on Supabase
- [ ] CORS configured on Vault API
- [ ] Tested locally with `npm run dev`
- [ ] Run `npm run type-check` for TypeScript errors
- [ ] Run `npm run build` successfully

## Deployment Options

### Option 1: Vercel (Recommended for Next.js)

Vercel is the official Next.js hosting platform and provides the best experience.

#### Steps:

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Select your GitHub repository
   - Follow the setup wizard

3. **Configure Environment Variables**
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add all variables from `.env.example`:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `NEXT_PUBLIC_VAULT_API_URL`
     - `NEXT_PUBLIC_APP_URL` (your Vercel domain)

4. **Deploy**
   - Click "Deploy"
   - Vercel automatically builds and deploys
   - Visit your live URL

#### Vercel Benefits:
- Zero-config Next.js deployment
- Automatic SSL certificates
- Global CDN
- Serverless functions
- Easy rollbacks
- Built-in analytics

### Option 2: Docker Deployment

For self-hosted environments.

#### Build Docker Image

```bash
docker build -t hartfelt-agents-portal:latest .
```

#### Run with Docker

```bash
docker run -p 3000:3000 \
  --env-file .env.production \
  -e NODE_ENV=production \
  hartfelt-agents-portal:latest
```

#### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - NEXT_PUBLIC_VAULT_API_URL=${NEXT_PUBLIC_VAULT_API_URL}
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Run with:
```bash
docker-compose up -d
```

### Option 3: AWS (EC2 + ECS)

#### Using EC2:

1. **Launch EC2 Instance**
   - AMI: Ubuntu 22.04 LTS
   - Instance type: t3.small (or larger)
   - Security group: Allow HTTP/HTTPS

2. **Install Node.js**
   ```bash
   curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Setup Application**
   ```bash
   git clone <your-repo> /opt/agents-portal
   cd /opt/agents-portal
   npm install
   npm run build
   ```

4. **Setup PM2**
   ```bash
   sudo npm install -g pm2
   pm2 start "npm start" --name "agents-portal"
   pm2 startup
   pm2 save
   ```

5. **Setup Nginx Reverse Proxy**
   ```nginx
   server {
       listen 80;
       server_name agents.hartfeltrealestate.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

6. **Setup SSL with Let's Encrypt**
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d agents.hartfeltrealestate.com
   ```

### Option 4: DigitalOcean App Platform

1. Connect GitHub repository to DigitalOcean
2. Set environment variables in App settings
3. Configure build command: `npm run build`
4. Configure run command: `npm start`
5. Deploy

### Option 5: Heroku

Note: Heroku's free tier is discontinued. Use paid dynos.

```bash
heroku create agents-portal
heroku config:set NEXT_PUBLIC_SUPABASE_URL=...
heroku config:set NEXT_PUBLIC_SUPABASE_ANON_KEY=...
heroku config:set NEXT_PUBLIC_VAULT_API_URL=...
heroku config:set NEXT_PUBLIC_APP_URL=https://agents-portal.herokuapp.com
git push heroku main
```

## Production Environment Variables

Create `.env.production` with:

```env
# Supabase (Production)
NEXT_PUBLIC_SUPABASE_URL=https://prod-supabase.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=prod-anon-key

# Vault API (Production)
NEXT_PUBLIC_VAULT_API_URL=https://vault-api.hartfeltrealestate.com/api

# App URL
NEXT_PUBLIC_APP_URL=https://agents.hartfeltrealestate.com

# Optional
NEXT_PUBLIC_DEBUG=false
```

## Post-Deployment

### Verify Deployment

1. **Test Login**
   - Visit deployed URL
   - Try logging in with test credentials

2. **Check API Connections**
   - Verify deals load on `/deals`
   - Verify commissions load on `/commissions`
   - Test document upload on `/documents`

3. **Monitor Logs**
   ```bash
   # Vercel
   vercel logs --follow
   
   # Docker
   docker logs -f container_id
   
   # EC2 with PM2
   pm2 logs agents-portal
   ```

### Health Checks

Set up monitoring:
- URL monitoring for homepage
- API response monitoring
- Supabase connectivity
- Vault API connectivity

### Backup Strategy

- Regular Supabase backups
- Version control commits
- Environment variable backups (in secure location)

## Scaling Considerations

### As Traffic Grows:

1. **Database**
   - Scale Supabase (increase compute)
   - Add indexes for frequently queried fields
   - Implement caching

2. **Application**
   - Use CDN (Vercel provides this)
   - Consider API caching
   - Optimize images and assets

3. **Vault API**
   - Load balance Vault API
   - Add caching layer
   - Monitor API response times

## Troubleshooting Deployment

### Application Won't Start
```bash
# Check for build errors
npm run build

# Check Node version
node --version

# Verify environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
```

### Supabase Connection Issues
- Verify URL is correct
- Check anon key is valid
- Ensure project is active
- Check firewall/CORS settings

### Vault API Connection Issues
- Verify URL is accessible
- Check API is running
- Verify CORS allows requests
- Check authentication token handling

### Performance Issues
- Check database query performance
- Review Vault API response times
- Implement pagination on lists
- Use browser DevTools to identify slow assets

## Monitoring and Maintenance

### Daily Tasks
- Monitor error logs
- Check API response times
- Monitor Supabase usage

### Weekly Tasks
- Review user activity
- Check for failed authentications
- Monitor storage usage

### Monthly Tasks
- Update dependencies: `npm update`
- Review and optimize slow queries
- Backup critical data
- Security audit

## Rollback Procedure

### Vercel
- Go to Deployments tab
- Click the previous deployment
- Click "Promote to Production"

### Docker
```bash
# Keep old images
docker tag hartfelt-agents-portal:latest hartfelt-agents-portal:v1.0.0

# Revert to previous
docker run hartfelt-agents-portal:v1.0.0
```

### EC2
```bash
cd /opt/agents-portal
git revert <commit-hash>
npm run build
pm2 restart agents-portal
```

## Domain Setup

1. **Update DNS Records**
   ```
   agents.hartfeltrealestate.com CNAME your-deployment-url
   ```

2. **SSL Certificate**
   - Vercel: Automatic
   - AWS/DigitalOcean: Use Let's Encrypt
   - Self-hosted: Setup SSL with Nginx/Apache

3. **Email Notifications**
   - Set `support@hartfelt.com` in contact forms
   - Configure email service if needed

## Support & Resources

- Next.js Docs: https://nextjs.org/docs
- Supabase Docs: https://supabase.com/docs
- Vercel Docs: https://vercel.com/docs
- Docker Docs: https://docs.docker.com
