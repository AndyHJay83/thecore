# The Core - Word Filtering App

A progressive web app for word filtering and workflow management.

## Features
- 20 filtering features (ABCDE, ABC, FIND-EEE, VOWEL, etc.)
- Multiple wordlists (134K, 19127, Emotions, Names, etc.)
- Custom workflow builder with drag-and-drop
- Case-insensitive filtering
- Mobile-optimized PWA

## Setup

### GitHub Pages Deployment

1. Go to repository Settings → Pages
2. Set source to `main` branch
3. Set custom path to `/coretest/` 
4. Deploy and access at: `andyhjay83.github.io/coretest/`

### Development

```bash
# Serve locally
python3 -m http.server 8000
# Or
npx serve .
```

Access at: `http://localhost:8000`

## PWA Installation

After deployment, visit the site and:
1. Click "Add to Home Screen"
2. App will install as "The Core"

## Recent Updates

- Fixed case-sensitivity bugs in ABCDE, ABC, FIND-EEE, and frequency features
- Updated paths from /grail-binary/ to /coretest/
- Added scope to manifest for proper PWA installation
