# Vardhman ERP - Deployment Guide

## Overview
This is a full-stack application with separate Frontend (React) and Backend (Node.js) deployments.

---

## **BACKEND DEPLOYMENT** (Node.js Server)

### Prerequisites
- Node.js 16+ installed
- MongoDB Atlas account (or local MongoDB)
- Server/VPS with public IP

### Local Testing (Before Deployment)

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Start development server
npm run dev
```

Expected output:
```
🚀 Vardhman Family ERP Server running on port 5000
📌 Environment: development
🌐 API Base: http://0.0.0.0:5000/api
```

Test the API:
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "success": true,
  "message": "Vardhman Family ERP API is running.",
  "timestamp": "2024-05-13T...",
  "environment": "development"
}
```

### Production Deployment Steps

#### Option 1: Deploy on Company Server (Linux/Ubuntu)

1. **SSH into your server:**
   ```bash
   ssh user@your-server-ip
   ```

2. **Clone the repository:**
   ```bash
   git clone https://github.com/zalakdoshi/Inventory_Management_System.git
   cd Inventory_Management_System/server
   ```

3. **Install Node.js (if not installed):**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Create `.env` file with production values:**
   ```bash
   nano .env
   ```
   
   Add:
   ```
   PORT=5000
   MONGO_URI=mongodb+srv://vardhman:vardhman123@cluster0.uecpw01.mongodb.net/vardhman_inventory_management_sys?retryWrites=true&w=majority&appName=Cluster0
   JWT_SECRET=your_secure_secret_key_here
   JWT_REFRESH_SECRET=your_secure_refresh_key_here
   JWT_EXPIRES_IN=7d
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_app_password
   FRONTEND_URL=http://your-frontend-domain-or-ip
   NODE_ENV=production
   UPLOAD_PATH=./uploads
   ```

6. **Install PM2 (process manager):**
   ```bash
   sudo npm install -g pm2
   ```

7. **Start the server with PM2:**
   ```bash
   pm2 start server.js --name "vardhman-api"
   pm2 save
   pm2 startup
   ```

8. **Verify it's running:**
   ```bash
   pm2 list
   curl http://localhost:5000/health
   ```

9. **Setup Nginx as reverse proxy (optional but recommended):**
   ```bash
   sudo apt-get install nginx
   sudo nano /etc/nginx/sites-available/default
   ```
   
   Add:
   ```nginx
   server {
       listen 80;
       server_name your-backend-domain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   
   Then:
   ```bash
   sudo systemctl restart nginx
   ```

#### Option 2: Deploy on Vercel (Easiest)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Add New" → "Project"
4. Select your repository
5. Set **Root Directory** to `server`
6. Add environment variables (same as above)
7. Click "Deploy"

---

## **FRONTEND DEPLOYMENT** (React App)

### Local Testing (Before Deployment)

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Start development server
npm run dev
```

Expected output:
```
  VITE v4.5.14  ready in 123 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

Visit `http://localhost:5173` in your browser.

### Production Deployment Steps

#### Option 1: Deploy on Company Server (Linux/Ubuntu)

1. **SSH into your server:**
   ```bash
   ssh user@your-frontend-server-ip
   ```

2. **Clone the repository:**
   ```bash
   git clone https://github.com/zalakdoshi/Inventory_Management_System.git
   cd Inventory_Management_System/client
   ```

3. **Install Node.js (if not installed):**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Create `.env.production` file:**
   ```bash
   nano .env.production
   ```
   
   Add:
   ```
   VITE_API_URL=http://your-backend-server-ip:5000/api
   ```
   
   Or if backend is on same server:
   ```
   VITE_API_URL=http://localhost:5000/api
   ```

6. **Build the application:**
   ```bash
   npm run build
   ```
   
   This creates a `dist` folder with optimized production files.

7. **Install and setup Nginx:**
   ```bash
   sudo apt-get install nginx
   sudo nano /etc/nginx/sites-available/default
   ```
   
   Add:
   ```nginx
   server {
       listen 80;
       server_name your-frontend-domain.com;
       root /home/user/Inventory_Management_System/client/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
           expires 1y;
           add_header Cache-Control "public, immutable";
       }
   }
   ```
   
   Then:
   ```bash
   sudo systemctl restart nginx
   ```

8. **Verify it's running:**
   ```bash
   curl http://localhost
   ```

#### Option 2: Deploy on Vercel (Easiest)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Add New" → "Project"
4. Select your repository
5. Set **Root Directory** to `client`
6. Set **Build Command** to `npm run build`
7. Set **Output Directory** to `dist`
8. Add environment variable:
   ```
   VITE_API_URL=http://your-backend-url/api
   ```
9. Click "Deploy"

#### Option 3: Deploy on Netlify

1. Push code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Select your repository
5. Set **Base directory** to `client`
6. Set **Build command** to `npm run build`
7. Set **Publish directory** to `dist`
8. Add environment variable:
   ```
   VITE_API_URL=http://your-backend-url/api
   ```
9. Click "Deploy"

---

## **Testing After Deployment**

### Test Backend
```bash
curl http://your-backend-url/health
```

### Test Frontend
Visit `http://your-frontend-url` in browser

### Test Login
1. Go to login page
2. Use demo credentials:
   - Email: `admin@vardhman.com`
   - Password: `admin123`

---

## **Troubleshooting**

### Backend won't start
- Check MongoDB connection: `MONGO_URI` is correct
- Check port 5000 is not in use: `lsof -i :5000`
- Check logs: `pm2 logs vardhman-api`

### Frontend can't connect to backend
- Check `VITE_API_URL` in `.env.production`
- Check backend CORS allows frontend URL
- Check firewall allows port 5000

### Login fails
- Check backend is running: `curl http://backend-url/health`
- Check MongoDB has user data
- Check browser console for errors

---

## **Environment Variables Reference**

### Backend (.env)
| Variable | Purpose | Example |
|----------|---------|---------|
| `PORT` | Server port | `5000` |
| `MONGO_URI` | MongoDB connection | `mongodb+srv://...` |
| `JWT_SECRET` | JWT signing key | `your_secret_key` |
| `FRONTEND_URL` | Frontend domain for CORS | `http://localhost:5173` |
| `NODE_ENV` | Environment | `production` or `development` |

### Frontend (.env.production)
| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:5000/api` |

---

## **Quick Reference**

### Start Backend Locally
```bash
cd server && npm run dev
```

### Start Frontend Locally
```bash
cd client && npm run dev
```

### Build Frontend for Production
```bash
cd client && npm run build
```

### Deploy Backend to Production
```bash
cd server
npm install
pm2 start server.js --name "vardhman-api"
```

### Deploy Frontend to Production
```bash
cd client
npm install
npm run build
# Serve dist folder with Nginx or upload to hosting
```
