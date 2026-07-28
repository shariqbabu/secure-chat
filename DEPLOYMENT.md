# VPS Deployment Guide

## Prerequisites

1. **Firebase Setup** (one-time)
   - Create Firebase project at https://console.firebase.google.com
   - Enable Authentication (Email/Password + Google)
   - Enable Firestore Database
   - Deploy security rules: `firebase deploy --only firestore:rules,firestore:indexes`

2. **Environment Configuration**
   ```bash
   cd frontend
   cp .env.example .env
   # Fill in your Firebase credentials from Firebase Console → Project settings
   ```

## Option 1: Docker Deployment (Recommended)

### Build and Run
```bash
# Build the Docker image
docker build -t secure-chat .

# Run with docker-compose
docker-compose up -d

# Or run directly
docker run -d -p 3000:80 --name secure-chat secure-chat
```

### Updates
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Option 2: Manual Deployment (No Docker)

### Prerequisites
- Node.js 18+ 
- nginx (or Caddy/Apache)

### Build
```bash
npm ci
npm run build --workspace=frontend
```

### nginx Configuration
Copy `nginx.conf` to your nginx sites:
```bash
sudo cp nginx.conf /etc/nginx/sites-available/secure-chat
sudo ln -s /etc/nginx/sites-available/secure-chat /etc/nginx/sites-enabled/
sudo nginx -t && sudo nginx -s reload
```

### Serve with Caddy (simpler alternative)
```bash
caddy file-server --root ./frontend/dist --listen :3000
```

## Option 3: Cloudflare Pages / Vercel / Netlify

Since this is a static SPA, you can deploy directly:

```bash
# Build
npm run build --workspace=frontend

# Deploy the frontend/dist folder
```

No server needed - Firebase handles all backend functionality.

## Production Notes

- **Environment Variables**: Never commit `.env` files. Set them in your CI/CD or hosting platform.
- **HTTPS**: Required for service workers and Web Crypto API. Use Let's Encrypt or Cloudflare SSL.
- **Domain**: Update Firebase Auth authorized domains if using a custom domain.
- **CORS**: Firebase handles this automatically - no CORS configuration needed.
