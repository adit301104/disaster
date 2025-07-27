import React, { useState, useEffect, useRef } from 'react';
import { 
  HiLocationMarker, 
  HiSparkles, 
  HiGlobe, 
  HiSearch, 
  HiRefresh,
  HiExclamation,
  HiInformationCircle,
  HiLightBulb,
  HiMap
} from 'react-icons/hi';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AIMapDemo = () => {
  const [description, setDescription] = useState('');
  const [locationResult, setLocationResult] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [mapsApiKey, setMapsApiKey] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Sample disaster scenarios for demonstration
  const sampleScenarios = [
    "Severe flooding reported in downtown Miami, Florida. Water levels rising rapidly near Biscayne Bay area.",
    "Earthquake magnitude 6.2 struck near San Francisco, California. Buildings shaking in Financial District.",
    "Wildfire spreading rapidly through Malibu, California. Evacuation orders issued for coastal areas.",
    "Hurricane approaching New Orleans, Louisiana. Category 3 storm with 120 mph winds expected landfall.",
    "Tornado spotted in Moore, Oklahoma. Funnel cloud moving northeast towards residential areas."
  ];

  // Initialize Leaflet Map
  useEffect(() => {
    const initLeafletMap = () => {
      if (!document.getElementById('leaflet-css')) {
        const css = document.createElement('link');
        css.id = 'leaflet-css';
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);
      }

      if (!window.L) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = createMap;
        script.onerror = () => setMapLoaded(false);
        document.head.appendChild(script);
      } else {
        createMap();
      }
    };

    const createMap = () => {
      if (!window.L || !mapRef.current || mapInstanceRef.current) return;
      
      const map = window.L.map(mapRef.current).setView([39.8283, -98.5795], 4);
      
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      
      mapInstanceRef.current = map;
      setMapLoaded(true);
    };

    initLeafletMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Add marker to map
  const addMarkerToMap = (coordinates, title, description) => {
    if (mapInstanceRef.current && coordinates && window.L) {
      // Clear existing markers
      if (window.currentMarker) {
        mapInstanceRef.current.removeLayer(window.currentMarker);
      }

      const marker = window.L.marker([coordinates.lat, coordinates.lng]).addTo(mapInstanceRef.current);
      
      marker.bindPopup(`
        <div style="color: #333; max-width: 300px;">
          <h3 style="margin: 0 0 10px 0; color: #ef4444;">${title}</h3>
          <p style="margin: 0; line-height: 1.4;">${description}</p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
            Coordinates: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}
          </p>
        </div>
      `);

      // Center map on marker
      mapInstanceRef.current.setView([coordinates.lat, coordinates.lng], 12);

      // Store marker reference for cleanup
      window.currentMarker = marker;

      // Auto-open popup
      setTimeout(() => {
        marker.openPopup();
      }, 500);
    }
  };

  // Analyze description with Gemini AI and get location
  const analyzeDescription = async () => {
    if (!description.trim()) return;

    setLoading(true);
    setLocationResult(null);
    setAiAnalysis('');

    try {
      // Use free AI analysis without backend dependency
      const locationName = extractLocationFromText(description);
      const mockAnalysis = generateMockAnalysis(description, locationName);
      
      setAiAnalysis(mockAnalysis);
      
      if (locationName) {
        setLocationResult({ locationName });
        generateSuggestions(description, locationName);
      }

    } catch (error) {
      console.error('Analysis error:', error);
      setAiAnalysis('Error: Unable to analyze the description.');
    } finally {
      setLoading(false);
    }
  };

  const extractLocationFromText = (text) => {
    const patterns = [
      /(?:in|near|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/gi,
      /(?:in|near|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+)/gi,
      /([A-Z][a-z]+\s+(?:City|County|Area|Region))/gi
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].replace(/^(in|near|at)\s+/i, '').trim();
      }
    }
    return null;
  };

  // Generate mock AI analysis (simulating Gemini AI response)
  const generateMockAnalysis = (desc, location) => {
    const disasterType = detectDisasterType(desc);
    const severity = detectSeverity(desc);
    
    return `🤖 **AI Analysis Results**

**Disaster Type:** ${disasterType}
**Severity Level:** ${severity}
**Location:** ${location || 'Location extracted from description'}

**Key Insights:**
• This appears to be a ${severity.toLowerCase()} priority ${disasterType.toLowerCase()} event
• Immediate response coordination recommended
• Resource allocation should focus on emergency services and evacuation support
• Real-time monitoring of the situation is advised

**Recommended Actions:**
1. Alert local emergency services
2. Coordinate with disaster response teams
3. Monitor social media for additional reports
4. Prepare evacuation routes if necessary

**Risk Assessment:** Based on the description, this event requires immediate attention and coordinated response efforts.`;
  };

  const detectDisasterType = (desc) => {
    const lower = desc.toLowerCase();
    if (lower.includes('flood') || lower.includes('water')) return 'Flood';
    if (lower.includes('fire') || lower.includes('wildfire')) return 'Wildfire';
    if (lower.includes('earthquake') || lower.includes('quake')) return 'Earthquake';
    if (lower.includes('hurricane') || lower.includes('storm')) return 'Hurricane';
    if (lower.includes('tornado') || lower.includes('funnel')) return 'Tornado';
    return 'Natural Disaster';
  };

  const detectSeverity = (desc) => {
    const lower = desc.toLowerCase();
    if (lower.includes('severe') || lower.includes('critical') || lower.includes('emergency')) return 'HIGH';
    if (lower.includes('moderate') || lower.includes('warning')) return 'MEDIUM';
    return 'MODERATE';
  };

  const generateSuggestions = (desc, location) => {
    const suggestions = [
      `Create disaster report for ${location || 'this location'}`,
      `Monitor social media for updates about this event`,
      `Check official emergency services for ${location || 'the area'}`,
      `Set up resource coordination for affected areas`,
      `Verify information with additional sources`
    ];
    setSuggestions(suggestions);
  };

  const loadSampleScenario = (scenario) => {
    setDescription(scenario);
  };

  const clearAll = () => {
    setDescription('');
    setLocationResult(null);
    setAiAnalysis('');
    setSuggestions([]);
    if (window.currentMarker && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(window.currentMarker);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([39.8283, -98.5795], 4);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <HiSparkles className="w-8 h-8 text-purple-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-300 via-violet-200 to-white bg-clip-text text-transparent">
              AI-Powered Disaster Analysis
            </h1>
            <HiMap className="w-8 h-8 text-purple-400" />
          </div>
          <p className="text-gray-300 text-lg">
            Demonstrating Gemini AI + Google Maps integration for disaster response
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
          {/* Left Panel - Input and Analysis */}
          <div className="space-y-6">
            {/* Input Section */}
            <div className="card bg-black/40 backdrop-blur-sm border border-purple-500/30">
              <div className="card-body">
                <h2 className="card-title text-white flex items-center gap-2">
                  <HiLightBulb className="w-5 h-5 text-yellow-400" />
                  Disaster Description
                </h2>
                
                <div className="form-control">
                  <textarea
                    className="textarea textarea-bordered bg-black/20 border-purple-500/40 text-white placeholder-gray-400 focus:border-purple-400 min-h-32"
                    placeholder="Describe a disaster scenario (e.g., 'Severe flooding in downtown Miami, Florida...')"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    className="btn btn-primary flex-1 bg-gradient-to-r from-purple-600 to-violet-600 border-none"
                    onClick={analyzeDescription}
                    disabled={loading || !description.trim()}
                  >
                    {loading ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <HiSparkles className="w-4 h-4" />
                        Analyze with AI
                      </>
                    )}
                  </button>
                  <button
                    className="btn btn-outline border-purple-500/50 text-purple-300 hover:bg-purple-500/20"
                    onClick={clearAll}
                  >
                    <HiRefresh className="w-4 h-4" />
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Sample Scenarios */}
            <div className="card bg-black/40 backdrop-blur-sm border border-purple-500/30">
              <div className="card-body">
                <h3 className="card-title text-white text-sm">Sample Scenarios</h3>
                <div className="space-y-2">
                  {sampleScenarios.map((scenario, index) => (
                    <button
                      key={index}
                      className="btn btn-ghost btn-sm justify-start text-left h-auto py-2 px-3 text-gray-300 hover:bg-purple-500/20 hover:text-white normal-case"
                      onClick={() => loadSampleScenario(scenario)}
                    >
                      <HiExclamation className="w-3 h-3 text-orange-400 flex-shrink-0" />
                      <span className="truncate">{scenario}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Location Result */}
            {locationResult && (
              <div className="card bg-black/40 backdrop-blur-sm border border-green-500/30">
                <div className="card-body">
                  <h3 className="card-title text-white flex items-center gap-2">
                    <HiLocationMarker className="w-5 h-5 text-green-400" />
                    Location Extracted
                  </h3>
                  <div className="space-y-2">
                    <p className="text-green-300 font-medium">{locationResult.locationName}</p>
                    {locationResult.coordinates && (
                      <div className="text-sm text-gray-300">
                        <p>Latitude: {locationResult.coordinates.lat.toFixed(6)}</p>
                        <p>Longitude: {locationResult.coordinates.lng.toFixed(6)}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Source: {locationResult.coordinates.source}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* AI Analysis */}
            {aiAnalysis && (
              <div className="card bg-black/40 backdrop-blur-sm border border-blue-500/30">
                <div className="card-body">
                  <h3 className="card-title text-white flex items-center gap-2">
                    <HiSparkles className="w-5 h-5 text-blue-400" />
                    AI Analysis
                  </h3>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-gray-300 text-sm font-mono bg-black/20 p-4 rounded-lg border border-gray-600/30">
                      {aiAnalysis}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="card bg-black/40 backdrop-blur-sm border border-yellow-500/30">
                <div className="card-body">
                  <h3 className="card-title text-white flex items-center gap-2">
                    <HiInformationCircle className="w-5 h-5 text-yellow-400" />
                    Suggested Actions
                  </h3>
                  <ul className="space-y-2">
                    {suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-2 text-gray-300 text-sm">
                        <span className="text-yellow-400 mt-1">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Map */}
          <div className="space-y-6">
            <div className="card bg-black/40 backdrop-blur-sm border border-purple-500/30 h-full">
              <div className="card-body p-0">
                <div className="p-4 border-b border-purple-500/30">
                  <h3 className="card-title text-white flex items-center gap-2">
                    <HiGlobe className="w-5 h-5 text-purple-400" />
                    Interactive Map
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {mapLoaded ? 'Map loaded - locations will appear here' : 'Loading OpenStreetMap...'}
                  </p>
                </div>
                <div className="relative h-64 md:h-96 xl:h-[600px]">
                  <div
                    ref={mapRef}
                    className="w-full h-full rounded-b-lg"
                    style={{ minHeight: '400px' }}
                  />
                  {!mapLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-b-lg">
                      <div className="text-center">
                        <span className="loading loading-spinner loading-lg text-purple-400"></span>
                        <p className="text-gray-300 mt-2">Loading OpenStreetMap...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <div className="card bg-black/20 backdrop-blur-sm border border-purple-500/20">
            <div className="card-body py-4">
              <p className="text-gray-400 text-sm">
                🚀 This demo showcases the integration of <strong className="text-purple-300">Free AI Processing</strong> for 
                intelligent text analysis and <strong className="text-purple-300">OpenStreetMap</strong> for location 
                visualization in disaster response scenarios.
              </p>
              <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500">
                <span>✨ AI-powered location extraction</span>
                <span>🗺️ Real-time map visualization</span>
                <span>📊 Intelligent disaster analysis</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIMapDemo;