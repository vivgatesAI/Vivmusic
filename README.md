# Vivmusic

Studio Eleven Venice — a Venice-powered music creation studio with pro-grade guidance and a minimal, focused interface.

## Current MVP Shape

- **Storage:** browser-local JSON via localStorage
- **Auth:** none
- **Deploy target:** Railway
- **AI layer:** Venice producer planning, lyrics direction, prompt optimization, and image generation
- **Music generation:** staged for future integration when available in the Venice / ElevenLabs pathway

## Getting Started Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the app:
   ```bash
   npm run dev
   ```
3. Open the app in your browser
4. Paste your own Venice API key into the BYO key field
5. Generate producer plans and moodboard images
6. Save projects locally in the browser or export/import them as JSON

## How Users Add Their Own Venice API Key

1. Create a Venice account
2. Open your Venice API settings
3. Generate a new API key
4. Paste it into the app’s **Venice API Key** field

In this MVP, the key is stored in the browser on the user’s machine so the app can work without auth.

## Browser-Local Project Workflow

- Save current project to the browser
- Reload any saved local project
- Export project as JSON
- Import project from JSON
- Clear all saved browser-local projects

## Railway Deployment

This repo includes a `railway.json` for a simple Next.js deployment.

Typical Railway flow:
1. Create a new Railway project
2. Connect this GitHub repo
3. Deploy using the default Nixpacks builder
4. Railway will run the app with `npm run start`

## Notes

- Venice music model listing currently returns no available music models for this setup.
- The app is ready to evolve into full music generation once that API path is active.
- Current UX emphasizes fast planning, structured iteration, and a clean pro-studio workflow.
