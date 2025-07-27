# Disaster Response App - Fallback Setup

## Issues Fixed

1. **React Key Duplication Error**: Fixed by using unique IDs for notifications
2. **500 Server Error**: Added automatic fallback to localhost when remote server fails
3. **Socket Connection Issues**: Improved connection handling with automatic fallback

## How the Fallback System Works

### Automatic API Fallback
- Primary: `https://disaster-600s.onrender.com`
- Fallback: `http://localhost:3000`

The app automatically tries the primary server first, and if it fails, switches to localhost.

### Socket Connection Fallback
- Tries primary socket connection first
- After 8 seconds, if no connection, tries localhost
- Shows connection status in the header

## Running Locally

### Option 1: Use the batch file
```bash
# Double-click start-local.bat
# Or run from command line:
start-local.bat
```

### Option 2: Manual startup
```bash
cd backend
npm start
```

### Option 3: Force local mode
Rename `.env.local` to `.env` in the frontend directory to force local mode.

## Connection Status Indicator

The app shows a connection indicator in the header:
- 🟢 **Connected**: Real-time features working
- 🔴 **Disconnected**: Using polling mode, manual refresh needed

## Testing the Fallback

1. Start the frontend: `npm run dev` (in frontend/dis directory)
2. The app will try the remote server first
3. If remote fails, it automatically switches to localhost
4. You'll see notifications about the switch

## Environment Files

- `.env`: Production (remote server)
- `.env.local`: Development (localhost)

## Key Features

- **Graceful Degradation**: App works even without real-time features
- **Automatic Switching**: No manual intervention needed
- **Visual Feedback**: Clear status indicators
- **Unique Keys**: Fixed React key duplication warnings

## Troubleshooting

If you see "Both APIs failed":
1. Make sure the backend is running locally (`npm start` in backend folder)
2. Check if port 3000 is available
3. Verify the backend .env file has correct database credentials

The app will continue to work with cached data even if both servers are unavailable.