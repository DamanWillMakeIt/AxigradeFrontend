# Click Engineer - Thumbnail Generator

## Overview
The Click Engineer is a YouTube thumbnail generation tool that uses AI to create compelling thumbnail concepts based on reference images.

## Features
- Upload 1 reference image (max)
- Automatically uploads images to Cloudinary for CDN hosting
- Generates AI-powered thumbnail concepts using xAI's Grok model
- User provides video title, optional summary, and generation prompt
- xAI API key is session-only (not stored anywhere)

## Setup Instructions

### 1. Cloudinary Setup
1. Create a free account at [cloudinary.com](https://cloudinary.com)
2. Get your credentials from the dashboard:
   - Cloud Name
   - API Key
   - API Secret
3. Add to your `.env` file:
```
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
```

### 2. xAI API Key
Users need to provide their own xAI API key when using the tool:
- Get your key from [x.ai](https://x.ai)
- The key is NOT stored anywhere (browser, database, or server)
- Users must enter it each session

### 3. Install Dependencies
```bash
npm install
# This will install cloudinary package
```

## Usage Flow

1. User enters xAI API key (session-only)
2. User uploads a reference image (PNG/JPG, max 10MB)
3. User enters:
   - Video title (required)
   - Short summary (optional)
   - Generation prompt describing desired thumbnail style (required)
4. Click "Generate"
5. System:
   - Uploads image to Cloudinary
   - Sends Cloudinary URL + context to xAI API
   - Returns AI-generated thumbnail concept

## API Endpoint

**POST** `/api/thumbnail-generate`

**Request (FormData):**
- `image`: File (required)
- `videoTitle`: string (required)
- `summary`: string (optional)
- `prompt`: string (required)
- `xaiApiKey`: string (required)

**Response:**
```json
{
  "success": true,
  "cloudinaryUrl": "https://res.cloudinary.com/...",
  "thumbnailConcept": "AI-generated concept text",
  "videoTitle": "Your Video Title",
  "summary": "Optional summary"
}
```

## Security Notes
- xAI API key is never stored (localStorage, database, or server)
- User must re-enter key each session
- Images are stored on Cloudinary (CDN hosting)
- FormData is used for secure file uploads

## File Locations
- Frontend: `/src/app/tools/yt-studio/click-engineer/page.tsx`
- API Route: `/src/app/api/thumbnail-generate/route.ts`
