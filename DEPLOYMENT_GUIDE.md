# Deployment Guide for NOTIS EEG Viewer

## Production Build

The application has been built successfully. The production files are in the `dist/` folder.

**Build Output:**
- `dist/index.html` - Main HTML file
- `dist/assets/` - CSS and JavaScript bundles

---

## Deployment Options

### Option 1: Vercel (Recommended - Easiest)

Vercel is the easiest option for quick deployment with automatic HTTPS and CDN.

**Steps:**

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Set up and deploy? **Yes**
   - Which scope? (Select your account)
   - Link to existing project? **No**
   - Project name? (e.g., `notis-eeg-viewer`)
   - Directory? **./dist**
   - Override settings? **No**

3. **Your app will be live at:** `https://your-project-name.vercel.app`

4. **For future updates:**
   ```bash
   npm run build
   vercel --prod
   ```

**Benefits:**
- Free tier available
- Automatic HTTPS
- Global CDN
- Easy updates
- Custom domain support

---

### Option 2: Netlify

Netlify is another excellent option with similar features.

**Steps:**

1. **Install Netlify CLI** (if not already installed):
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy:**
   ```bash
   netlify deploy --prod --dir=dist
   ```
   
   First time will ask you to login and authorize.

3. **Your app will be live at:** `https://random-name.netlify.app`

4. **For future updates:**
   ```bash
   npm run build
   netlify deploy --prod --dir=dist
   ```

**Benefits:**
- Free tier available
- Automatic HTTPS
- Global CDN
- Easy updates
- Custom domain support

---

### Option 3: GitHub Pages

If your code is on GitHub, you can deploy to GitHub Pages.

**Steps:**

1. **Install gh-pages package:**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Add to package.json scripts:**
   ```json
   "scripts": {
     "deploy": "npm run build && gh-pages -d dist"
   }
   ```

3. **Update vite.config.js:**
   ```javascript
   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react'

   export default defineConfig({
     plugins: [react()],
     base: '/your-repo-name/' // Replace with your GitHub repo name
   })
   ```

4. **Deploy:**
   ```bash
   npm run deploy
   ```

5. **Enable GitHub Pages:**
   - Go to your GitHub repo → Settings → Pages
   - Source: `gh-pages` branch
   - Your app will be at: `https://your-username.github.io/your-repo-name/`

**Benefits:**
- Free
- Integrated with GitHub
- Automatic HTTPS

---

### Option 4: Simple Static Server (For Internal Testing)

If you want to host it on your own server or internal network:

**Using Python:**
```bash
cd dist
python3 -m http.server 8000
```
Access at: `http://localhost:8000` or `http://your-ip:8000`

**Using Node.js (serve package):**
```bash
npm install -g serve
serve -s dist -l 8000
```

**Using nginx:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

### Option 5: Docker (For Containerized Deployment)

Create a `Dockerfile`:

```dockerfile
FROM nginx:alpine
COPY dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `nginx.conf`:
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Build and run:
```bash
docker build -t notis-eeg-viewer .
docker run -p 8080:80 notis-eeg-viewer
```

---

## Quick Deployment Commands

### For Vercel (Recommended):
```bash
npm run build
vercel --prod
```

### For Netlify:
```bash
npm run build
netlify deploy --prod --dir=dist
```

### For Local Testing:
```bash
npm run build
npm run preview
```

---

## Sharing with Testers

Once deployed, you can share:

1. **The deployment URL** (e.g., `https://notis-eeg-viewer.vercel.app`)
2. **The feedback document**: `NEUROLOGIST_FEEDBACK.md`
3. **Testing instructions** (create a simple test plan)

---

## Environment Variables (If Needed)

If you need to configure different environments, create:
- `.env.production` for production
- `.env.development` for development

Then update `vite.config.js` to use them.

---

## Troubleshooting

### Build Issues:
- Clear cache: `rm -rf dist node_modules/.vite`
- Rebuild: `npm run build`

### Routing Issues:
- Ensure your hosting provider supports SPA routing (all routes redirect to index.html)

### CORS Issues:
- If accessing from different domain, configure CORS in your hosting provider

---

## Next Steps

1. Choose a deployment option
2. Deploy the application
3. Share the URL with testers
4. Collect feedback
5. Iterate based on feedback

---

## Recommended: Vercel Quick Start

The fastest way to get your app online:

```bash
# Install Vercel CLI
npm install -g vercel

# Build the app
npm run build

# Deploy
vercel --prod
```

That's it! Your app will be live in under 2 minutes.

