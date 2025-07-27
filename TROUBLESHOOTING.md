# Troubleshooting Guide

## Issues Fixed

### 1. IntersectionObserver Error
**Error**: `Uncaught (in promise) TypeError: Failed to execute 'observe' on 'IntersectionObserver': parameter 1 is not of type 'Element'.`

**Solution**: This was likely caused by React trying to observe a null element. Fixed by:
- Adding proper error handling in the map initialization
- Ensuring elements exist before trying to observe them
- Created a new fixed component: `AIMapDemoFixed.jsx`

### 2. 400 Bad Request Error
**Error**: `:3000/geocode:1 Failed to load resource: the server responded with a status of 400 (Bad Request)`

**Solution**: The backend expects specific request format. Fixed by:
- Ensuring the request body contains `description` field
- Adding proper error handling and logging
- Trimming whitespace from input
- Adding validation for empty descriptions

## How to Test the Fixes

### Option 1: Use the Test Page
1. Open `frontend/dis/test-backend.html` in your browser
2. Click "Test Health Endpoint" to verify backend is running
3. Click "Test CORS" to verify CORS configuration
4. Enter a disaster description and click "Test Geocode API"

### Option 2: Use the Fixed React Component
1. The fixed component is in `frontend/dis/src/components/AIMapDemoFixed.jsx`
2. Import and use this component instead of the original
3. It includes better error handling and logging

### Option 3: Use the HTML Demo
1. Open `frontend/dis/ai-demo.html` in your browser
2. Make sure the backend server is running on `http://localhost:3000`
3. Try the sample scenarios or enter your own description

## Backend Requirements

### 1. Server Running
Make sure your backend server is running:
```bash
cd backend
npm start
# or
node app.js
```

### 2. Environment Variables
Ensure these environment variables are set in your backend:
- `GEMINI_API_KEY`: Your Google Gemini API key
- `GOOGLE_MAPS_API_KEY`: Your Google Maps API key (optional for geocoding)

### 3. CORS Configuration
The backend should allow requests from:
- `http://localhost:3000` (React dev server)
- `http://localhost:5173` (Vite dev server)
- `file://` (for HTML files opened directly)

## Frontend Configuration

### 1. API URL
Update the API base URL in your frontend:
- React: Check `VITE_API_URL` in `.env` files
- HTML: Update `API_BASE` constant in the JavaScript

### 2. Google Maps API Key
Replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual Google Maps API key in:
- `ai-demo.html`
- `AIMapDemoFixed.jsx`

## Common Issues and Solutions

### Issue: "Failed to analyze location"
**Causes**:
1. Backend server not running
2. Wrong API URL
3. Missing Gemini API key
4. CORS issues

**Solutions**:
1. Start the backend server
2. Check API_BASE URL matches your backend
3. Set GEMINI_API_KEY environment variable
4. Check browser console for CORS errors

### Issue: Map not loading
**Causes**:
1. Missing Google Maps API key
2. Invalid API key
3. API key restrictions

**Solutions**:
1. Get a Google Maps API key from Google Cloud Console
2. Replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual key
3. Enable required APIs: Maps JavaScript API, Geocoding API, Places API

### Issue: Empty response from backend
**Causes**:
1. Gemini API key not configured
2. Gemini API quota exceeded
3. Invalid request format

**Solutions**:
1. Set GEMINI_API_KEY in backend environment
2. Check Gemini API usage in Google Cloud Console
3. Verify request body format matches backend expectations

## Testing Steps

1. **Test Backend Health**:
   ```bash
   curl http://localhost:3000/health
   ```

2. **Test Geocode Endpoint**:
   ```bash
   curl -X POST http://localhost:3000/geocode \
     -H "Content-Type: application/json" \
     -H "x-user-id: netrunnerX" \
     -d '{"description": "Flooding in Miami, Florida"}'
   ```

3. **Test Frontend**:
   - Open the test page: `frontend/dis/test-backend.html`
   - Try the AI demo: `frontend/dis/ai-demo.html`
   - Use the React app with fixed component

## Debug Information

### Browser Console
Check the browser console for:
- Network errors
- CORS errors
- JavaScript errors
- API response details

### Backend Logs
Check backend console for:
- Request details
- Gemini API responses
- Error messages
- CORS configuration

### Network Tab
In browser dev tools, check:
- Request headers
- Response status codes
- Response bodies
- CORS headers

## Success Indicators

When everything is working correctly, you should see:
1. ✅ Health endpoint returns server status
2. ✅ CORS test passes
3. ✅ Geocode endpoint returns location data
4. ✅ Map loads and shows markers
5. ✅ AI analysis appears with suggestions

## Next Steps

If issues persist:
1. Check all environment variables are set
2. Verify API keys are valid and have proper permissions
3. Test with the provided test page first
4. Check backend logs for detailed error messages
5. Ensure all required APIs are enabled in Google Cloud Console