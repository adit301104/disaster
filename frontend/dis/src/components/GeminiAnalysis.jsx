import React, { useState } from 'react';
import { HiSparkles, HiLocationMarker, HiExclamation } from 'react-icons/hi';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const GeminiAnalysis = ({ disaster }) => {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState(null);

  const analyzeWithGemini = async () => {
    if (!disaster?.description) return;

    setLoading(true);
    try {
      // Use free AI analysis without API keys
      const analysisResult = await generateFreeAIAnalysis(disaster);
      setAnalysis(analysisResult.analysis);
      if (analysisResult.locationData) {
        setLocationData(analysisResult.locationData);
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      setAnalysis('Error: Unable to analyze with AI. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateFreeAIAnalysis = async (disaster) => {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const description = disaster.description || '';
    const title = disaster.title || '';
    const location = disaster.location_name || '';
    const type = disaster.disaster_type || '';
    
    // Extract location using simple text analysis
    const locationData = extractLocationFromText(description + ' ' + title + ' ' + location);
    
    // Generate severity assessment
    const severity = assessSeverity(description + ' ' + title);
    
    // Generate disaster type if not provided
    const detectedType = type || detectDisasterType(description + ' ' + title);
    
    // Generate resource needs
    const resourceNeeds = identifyResourceNeeds(description + ' ' + title + ' ' + detectedType);
    
    // Generate timeline assessment
    const timeline = assessTimeline(description + ' ' + title);
    
    const analysisText = `🤖 Free AI Analysis Results:

Location Analysis: ${locationData.name || location || 'Location not clearly specified'}
${locationData.confidence ? `Confidence: ${locationData.confidence}` : ''}

Disaster Assessment:
• Type: ${detectedType}
• Severity: ${severity}
• Timeline: ${timeline}
• Status: ${disaster.status || 'Active'}

Key Insights:
• ${getInsight(detectedType, severity)}
• Resource allocation priority: ${getResourcePriority(severity)}
• Response coordination: ${getResponseLevel(severity)}

Predicted Resource Needs:
${resourceNeeds.map(need => `• ${need}`).join('\n')}

Recommended Actions:
1. ${getRecommendation(detectedType, severity, 1)}
2. ${getRecommendation(detectedType, severity, 2)}
3. ${getRecommendation(detectedType, severity, 3)}
4. Monitor situation for updates and escalation

Risk Assessment: ${getRiskAssessment(detectedType, severity)}`;

    return {
      analysis: analysisText,
      locationData: locationData.name ? {
        locationName: locationData.name,
        coordinates: locationData.coordinates
      } : null
    };
  };

  const extractLocationFromText = (text) => {
    const locationPatterns = [
      /in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/g,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+)/g,
      /near\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
      /([A-Z][a-z]+\s+(?:City|County|Area|Region))/g
    ];
    
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          name: match[0].replace(/^(in|near)\s+/i, ''),
          confidence: 'Medium',
          coordinates: null
        };
      }
    }
    
    return { name: null, confidence: 'Low', coordinates: null };
  };

  const assessSeverity = (text) => {
    const highSeverityWords = ['severe', 'critical', 'emergency', 'catastrophic', 'devastating', 'major'];
    const mediumSeverityWords = ['moderate', 'significant', 'serious', 'considerable'];
    const lowSeverityWords = ['minor', 'small', 'limited', 'localized'];
    
    const lowerText = text.toLowerCase();
    
    if (highSeverityWords.some(word => lowerText.includes(word))) return 'HIGH';
    if (mediumSeverityWords.some(word => lowerText.includes(word))) return 'MEDIUM';
    if (lowSeverityWords.some(word => lowerText.includes(word))) return 'LOW';
    
    return 'MEDIUM';
  };

  const detectDisasterType = (text) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('flood') || lowerText.includes('water')) return 'Flood';
    if (lowerText.includes('fire') || lowerText.includes('wildfire')) return 'Wildfire';
    if (lowerText.includes('earthquake') || lowerText.includes('quake')) return 'Earthquake';
    if (lowerText.includes('hurricane') || lowerText.includes('storm')) return 'Hurricane';
    if (lowerText.includes('tornado') || lowerText.includes('funnel')) return 'Tornado';
    if (lowerText.includes('landslide') || lowerText.includes('mudslide')) return 'Landslide';
    return 'Natural Disaster';
  };

  const identifyResourceNeeds = (text) => {
    const needs = [];
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('water') || lowerText.includes('flood')) needs.push('Water pumps and sandbags');
    if (lowerText.includes('fire')) needs.push('Fire suppression equipment');
    if (lowerText.includes('medical') || lowerText.includes('injured')) needs.push('Medical supplies and personnel');
    if (lowerText.includes('evacuation') || lowerText.includes('shelter')) needs.push('Emergency shelters and transportation');
    if (lowerText.includes('food') || lowerText.includes('supply')) needs.push('Food and water supplies');
    
    if (needs.length === 0) {
      needs.push('Emergency response teams', 'Communication equipment', 'First aid supplies');
    }
    
    return needs;
  };

  const assessTimeline = (text) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('immediate') || lowerText.includes('urgent')) return 'Immediate response required';
    if (lowerText.includes('ongoing') || lowerText.includes('continuing')) return 'Ongoing situation';
    if (lowerText.includes('developing') || lowerText.includes('emerging')) return 'Developing situation';
    return 'Active monitoring required';
  };

  const getInsight = (type, severity) => {
    const insights = {
      'Flood': 'Water damage assessment and drainage solutions needed',
      'Wildfire': 'Fire containment and evacuation planning critical',
      'Earthquake': 'Structural damage assessment and aftershock monitoring',
      'Hurricane': 'Wind damage and flooding preparation required',
      'Tornado': 'Rapid response and debris clearance needed'
    };
    return insights[type] || 'Comprehensive disaster response coordination required';
  };

  const getResourcePriority = (severity) => {
    return severity === 'HIGH' ? 'Critical - immediate deployment' : 
           severity === 'MEDIUM' ? 'High - rapid deployment' : 'Standard - coordinated deployment';
  };

  const getResponseLevel = (severity) => {
    return severity === 'HIGH' ? 'Multi-agency coordination required' : 
           severity === 'MEDIUM' ? 'Regional response coordination' : 'Local response coordination';
  };

  const getRecommendation = (type, severity, step) => {
    const recommendations = {
      1: `Activate ${severity === 'HIGH' ? 'emergency' : 'standard'} response protocols`,
      2: `Deploy ${type.toLowerCase()} specialized response teams`,
      3: `Establish ${severity === 'HIGH' ? 'emergency' : 'temporary'} coordination center`
    };
    return recommendations[step] || 'Continue monitoring situation';
  };

  const getRiskAssessment = (type, severity) => {
    if (severity === 'HIGH') return 'High risk - immediate action required';
    if (severity === 'MEDIUM') return 'Moderate risk - coordinated response needed';
    return 'Low to moderate risk - standard protocols apply';
  };

  return (
    <div className="card bg-black/40 backdrop-blur-sm border border-purple-500/30">
      <div className="card-body p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-title text-white flex items-center gap-2">
            <HiSparkles className="w-5 h-5 text-purple-400" />
            Free AI Analysis
          </h3>
          <button
            className="btn btn-sm btn-primary bg-gradient-to-r from-purple-600 to-violet-600 border-none"
            onClick={analyzeWithGemini}
            disabled={loading || !disaster?.description}
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Analyzing...
              </>
            ) : (
              <>
                <HiSparkles className="w-4 h-4" />
                Analyze
              </>
            )}
          </button>
        </div>

        {locationData && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <HiLocationMarker className="w-4 h-4 text-green-400" />
              <span className="text-green-300 font-medium">Location Extracted</span>
            </div>
            <p className="text-white text-sm">{locationData.locationName}</p>
            {locationData.coordinates && (
              <p className="text-gray-300 text-xs mt-1">
                {locationData.coordinates.lat.toFixed(6)}, {locationData.coordinates.lng.toFixed(6)}
              </p>
            )}
          </div>
        )}

        {analysis && (
          <div className="bg-black/20 border border-gray-600/30 rounded-lg p-4">
            <pre className="whitespace-pre-wrap text-gray-300 text-sm font-mono">
              {analysis}
            </pre>
          </div>
        )}

        {!analysis && !loading && (
          <div className="text-center py-8 text-gray-400">
            <HiExclamation className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Click "Analyze" to get AI insights about this disaster</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeminiAnalysis;