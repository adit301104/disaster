# AI-Powered Disaster Analysis Demo

## Overview

I've created a small frontend application that demonstrates the use of both the existing **Gemini API** and **Google Maps API** for disaster response scenarios. This demo showcases how AI can be used to analyze disaster descriptions and extract location information, which is then visualized on an interactive map.

## What's Been Created

### 1. AI Map Demo (`ai-demo.html`)
- **Location**: `frontend/dis/ai-demo.html`
- **Purpose**: Standalone HTML demo that showcases AI + Maps integration
- **Features**:
  - AI-powered location extraction from disaster descriptions
  - Interactive Google Maps visualization
  - Sample disaster scenarios for testing
  - Real-time analysis and suggestions
  - Beautiful dark theme matching the main application

### 2. React Component (`AIMapDemo.jsx`)
- **Location**: `frontend/dis/src/components/AIMapDemo.jsx`
- **Purpose**: React component version of the demo
- **Features**: Same as the HTML version but integrated with React

## How It Works

### Backend Integration
The demo uses the existing backend APIs:
- **`/geocode` endpoint**: Uses Gemini AI to extract location from disaster descriptions
- **Google Maps API**: For geocoding and map visualization
- **Gemini API**: For intelligent text analysis and location extraction

### Frontend Features
1. **Text Analysis**: Enter a disaster description and the AI will:
   - Extract the location mentioned in the text
   - Analyze the disaster type and severity
   - Provide intelligent insights and recommendations

2. **Map Visualization**: 
   - Shows extracted locations on an interactive map
   - Custom disaster markers with information windows
   - Automatic map centering and zooming

3. **Sample Scenarios**: Pre-loaded disaster scenarios for quick testing:
   - Flooding in Miami, Florida
   - Earthquake in San Francisco, California
   - Wildfire in Malibu, California
   - Hurricane approaching New Orleans, Louisiana
   - Tornado in Moore, Oklahoma

## How to Access the Demo

### Option 1: Direct HTML Access
1. Navigate to `frontend/dis/ai-demo.html`
2. Open the file in a web browser
3. Make sure the backend server is running on `http://localhost:3000`

### Option 2: Through the Main Application
1. Start the frontend application (`npm run dev`)
2. Look for the "Try AI + Maps Demo" button in the main interface
3. Click to open the demo in a new tab

## Configuration Required

### Google Maps API Key
The demo currently uses a placeholder for the Google Maps API key. To enable full functionality:

1. Get a Google Maps API key from the Google Cloud Console
2. Replace `YOUR_GOOGLE_MAPS_API_KEY` in the HTML file with your actual key
3. Make sure the key has access to:
   - Maps JavaScript API
   - Geocoding API
   - Places API

### Backend Configuration
Ensure your backend has the following environment variables set:
- `GEMINI_API_KEY`: Your Google Gemini API key
- `GOOGLE_MAPS_API_KEY`: Your Google Maps API key (for server-side geocoding)

## Demo Workflow

1. **Enter Description**: Type or select a disaster scenario
2. **AI Analysis**: Click "Analyze with AI" to process the text
3. **View Results**: See extracted location, AI analysis, and suggestions
4. **Map Visualization**: Location appears on the interactive map
5. **Explore**: Try different scenarios to see various AI responses

## Technical Implementation

### AI Integration
- Uses the existing Gemini API integration in the backend
- Calls the `/geocode` endpoint to extract locations
- Generates mock AI analysis for demonstration purposes
- Real Gemini API responses would provide more sophisticated analysis

### Maps Integration
- Google Maps JavaScript API for interactive maps
- Custom styling for dark theme consistency
- Disaster-specific markers and info windows
- Automatic geocoding and location visualization

## Benefits Demonstrated

1. **Intelligent Location Extraction**: AI can understand natural language descriptions and extract precise locations
2. **Visual Context**: Maps provide immediate spatial understanding of disaster locations
3. **Rapid Analysis**: Quick processing of disaster reports for faster response
4. **User-Friendly Interface**: Intuitive design for emergency responders and coordinators
5. **Scalable Architecture**: Built on existing backend infrastructure

## Future Enhancements

The demo shows the potential for:
- Real-time disaster monitoring
- Automated alert systems
- Resource allocation optimization
- Multi-language support
- Integration with emergency services
- Social media monitoring and analysis

## Files Created/Modified

1. **New Files**:
   - `frontend/dis/ai-demo.html` - Standalone demo
   - `frontend/dis/src/components/AIMapDemo.jsx` - React component
   - `frontend/dis/src/AppWithDemo.jsx` - App wrapper with demo integration

2. **Modified Files**:
   - `frontend/dis/src/main.jsx` - Updated to use new app structure
   - `frontend/dis/src/App.jsx` - Added demo link integration

This demo effectively showcases how the existing Gemini and Google Maps APIs can be leveraged to create powerful disaster response tools that combine AI intelligence with geographical visualization.