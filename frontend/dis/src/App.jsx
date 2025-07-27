import React, { useState, useEffect, useRef } from 'react';
import { 
  HiExclamation, 
  HiLocationMarker, 
  HiUsers, 
  HiChatAlt2, 
  HiShieldCheck, 
  HiPlus, 
  HiSearch, 
  HiFilter, 
  HiBell, 
  HiRefresh, 
  HiClock, 
  HiCheckCircle, 
  HiXCircle, 
  HiExclamationCircle,
  HiGlobe,
  HiChartBar,
  HiHeart,
  HiShare,
  HiExternalLink,
  HiWifi,
  HiEye,
  HiTrendingUp,
  HiDocumentReport,
  HiCollection,
  HiSparkles,
  HiAdjustments,
  HiInformationCircle,
  HiLightBulb
} from 'react-icons/hi';
import io from 'socket.io-client';
import AIMapDemo from './components/AIMapDemo';
import GeminiAnalysis from './components/GeminiAnalysis';
import DisasterMap from './components/DisasterMap';

const PRIMARY_API_URL = import.meta.env.VITE_API_URL || 'https://disaster-600s.onrender.com';
const FALLBACK_API_URL = 'http://localhost:3000';

let API_BASE = PRIMARY_API_URL;
let SOCKET_URL = PRIMARY_API_URL;

// Utility function for API calls with fallback
const apiCall = async (endpoint, options = {}) => {
  const tryRequest = async (baseUrl) => {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'netrunnerX',
        ...options.headers,
      },
      ...options,
    });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  };

  try {
    // Try primary API first
    return await tryRequest(API_BASE);
  } catch (error) {
    console.warn(`Primary API failed (${API_BASE}), trying fallback...`);
    try {
      // Try fallback API
      const result = await tryRequest(FALLBACK_API_URL);
      // If fallback works, switch to it
      if (API_BASE !== FALLBACK_API_URL) {
        API_BASE = FALLBACK_API_URL;
        SOCKET_URL = FALLBACK_API_URL;
        console.log('Switched to fallback API:', FALLBACK_API_URL);
      }
      return result;
    } catch (fallbackError) {
      console.error('Both APIs failed:', error, fallbackError);
      throw new Error(`API Error: Both primary and fallback servers unavailable`);
    }
  }
};

// Main App Component
const App = ({ hideHeader = false }) => {
  const [disasters, setDisasters] = useState([]);
  const [selectedDisaster, setSelectedDisaster] = useState(null);
  const [socialMedia, setSocialMedia] = useState([]);
  const [resources, setResources] = useState([]);
  const [reports, setReports] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' or 'ai-demo'
  const [searchQuery, setSearchQuery] = useState('');
  const socketRef = useRef(null);

  // Socket connection and event handlers
  useEffect(() => {
    let connectionTimeout;
    
    const connectSocket = (url) => {
      console.log('Connecting to socket:', url);
      
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      
      socketRef.current = io(url, {
        transports: ['polling', 'websocket'], // Try polling first, then websocket
        withCredentials: true,
        timeout: 30000, // Increased timeout
        forceNew: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 3, // Reduced attempts for faster fallback
        maxReconnectionAttempts: 3
      });
      
      return socketRef.current;
    };

    // Try primary socket first
    let socket = connectSocket(SOCKET_URL);
    
    // Add a timeout to try fallback socket
    connectionTimeout = setTimeout(() => {
      if (!socketConnected && SOCKET_URL !== FALLBACK_API_URL) {
        console.log('Primary socket failed, trying fallback...');
        SOCKET_URL = FALLBACK_API_URL;
        socket = connectSocket(SOCKET_URL);
        addNotification('Switched to local server', 'info');
      } else if (!socketConnected) {
        console.log('Socket connection timeout - continuing without real-time features');
        addNotification('Real-time features unavailable - using polling mode', 'warning');
      }
    }, 8000); // 8 second timeout for faster fallback
    
    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current.id);
      setSocketConnected(true);
      setConnectionAttempts(0);
      if (connectionTimeout) clearTimeout(connectionTimeout); // Clear timeout when connected
      addNotification('Connected to real-time updates', 'success');
    });

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
      setSocketConnected(false);
      addNotification('Disconnected from real-time updates', 'warning');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setSocketConnected(false);
      setConnectionAttempts(prev => prev + 1);
      addNotification(`Connection failed (attempt ${connectionAttempts + 1})`, 'error');
    });

    socketRef.current.on('reconnect_attempt', (attemptNumber) => {
      console.log('Reconnection attempt:', attemptNumber);
      addNotification(`Reconnecting... (attempt ${attemptNumber})`, 'info');
    });

    socketRef.current.on('reconnect_failed', () => {
      console.log('Reconnection failed');
      setSocketConnected(false);
      addNotification('Failed to reconnect to real-time updates', 'error');
    });
    
    socketRef.current.on('disaster_updated', (data) => {
      console.log('Disaster updated:', data);
      if (data.action === 'create') {
        setDisasters(prev => [data.disaster, ...prev]);
        addNotification('New disaster reported', 'info');
      } else if (data.action === 'update') {
        setDisasters(prev => prev.map(d => d.id === data.disaster.id ? data.disaster : d));
        addNotification('Disaster updated', 'info');
      }
    });

    socketRef.current.on('social_media_updated', (data) => {
      console.log('Social media updated:', data);
      if (selectedDisaster?.id === data.disaster_id) {
        setSocialMedia(data.data);
        addNotification('Social media updated', 'success');
      }
    });

    socketRef.current.on('official_updates_updated', (data) => {
      console.log('Official updates received:', data);
      if (selectedDisaster?.id === data.disaster_id) {
        addNotification('Official updates received', 'info');
      }
    });

    socketRef.current.on('report_created', (data) => {
      console.log('Report created:', data);
      if (selectedDisaster?.id === data.disaster_id) {
        setReports(prev => [data.report, ...prev]);
        addNotification('New report received', 'warning');
      }
    });

    socketRef.current.on('emergency_alert', (data) => {
      console.log('Emergency alert:', data);
      addNotification(`EMERGENCY: ${data.message}`, 'error');
    });

    return () => {
      console.log('Disconnecting socket');
      if (connectionTimeout) clearTimeout(connectionTimeout);
      socketRef.current?.disconnect();
    };
  }, []);

  // Load disasters on mount
  useEffect(() => {
    loadDisasters();
  }, []);

  // Load disaster details when selected
  useEffect(() => {
    if (selectedDisaster) {
      loadDisasterDetails(selectedDisaster.id);
      socketRef.current?.emit('join_disaster', selectedDisaster.id);
    }
  }, [selectedDisaster]);

  const addNotification = (message, type) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const loadDisasters = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/disasters');
      setDisasters(data);
    } catch (error) {
      addNotification('Failed to load disasters', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDisasterDetails = async (id) => {
    try {
      setLoading(true);
      console.log('Loading disaster details for:', id);
      
      const [socialData, resourcesData, reportsData, analyticsData] = await Promise.all([
        apiCall(`/disasters/${id}/social-media`).catch((err) => {
          console.error('Social media error:', err);
          return [];
        }),
        apiCall(`/disasters/${id}/resources`).catch((err) => {
          console.error('Resources error:', err);
          return [];
        }),
        apiCall(`/disasters/${id}/reports`).catch((err) => {
          console.error('Reports error:', err);
          return [];
        }),
        apiCall(`/disasters/${id}/analytics`).catch((err) => {
          console.error('Analytics error:', err);
          return null;
        })
      ]);
      
      console.log('Loaded data:', { socialData, resourcesData, reportsData, analyticsData });
      
      setSocialMedia(socialData);
      setResources(resourcesData);
      setReports(reportsData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Load disaster details error:', error);
      addNotification('Failed to load disaster details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    if (selectedDisaster) {
      addNotification('Refreshing data...', 'info');
      await loadDisasterDetails(selectedDisaster.id);
    }
  };

  const createDisaster = async (formData) => {
    try {
      await apiCall('/disasters', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      addNotification('Disaster created successfully', 'success');
      setShowCreateForm(false);
      loadDisasters();
    } catch (error) {
      addNotification('Failed to create disaster', 'error');
    }
  };

  const submitReport = async (formData) => {
    try {
      await apiCall('/reports', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          disaster_id: selectedDisaster.id
        })
      });
      addNotification('Report submitted successfully', 'success');
      setShowReportForm(false);
    } catch (error) {
      addNotification('Failed to submit report', 'error');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'badge-error',
      monitoring: 'badge-warning',
      resolved: 'badge-success',
      pending: 'badge-info'
    };
    return colors[status] || 'badge-neutral';
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      critical: <HiExclamationCircle className="w-4 h-4 text-red-500" />,
      high: <HiExclamation className="w-4 h-4 text-orange-500" />,
      medium: <HiInformationCircle className="w-4 h-4 text-yellow-500" />,
      low: <HiCheckCircle className="w-4 h-4 text-green-500" />
    };
    return icons[severity] || <HiInformationCircle className="w-4 h-4 text-gray-500" />;
  };

  const formatTimeAgo = (dateString) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  const filteredDisasters = disasters.filter(disaster => 
    disaster.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-3/4 left-1/2 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>
      {/* Notifications */}
      <div className="toast toast-top toast-end z-50">
        {notifications.map(notif => (
          <div key={notif.id} className={`alert alert-${notif.type} shadow-2xl backdrop-blur-md border border-purple-500/20`}>
            <span className="text-white">{notif.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="navbar bg-black/40 backdrop-blur-2xl border-b border-purple-500/30 shadow-2xl relative z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 via-transparent to-violet-900/20"></div>
        <div className="navbar-start relative z-10">
          <h1 className="text-sm lg:text-xl font-bold text-white flex items-center gap-2 lg:gap-3 hover:text-purple-300 transition-all duration-500">
            <div className="relative flex-shrink-0">
              <HiShieldCheck className="w-6 h-6 lg:w-8 lg:h-8 text-purple-400 drop-shadow-lg" />
              <div className="absolute inset-0 w-6 h-6 lg:w-8 lg:h-8 text-purple-400 animate-ping opacity-20">
                <HiShieldCheck className="w-6 h-6 lg:w-8 lg:h-8" />
              </div>
            </div>
            <span className="bg-gradient-to-r from-purple-300 via-violet-200 to-white bg-clip-text text-transparent font-extrabold tracking-wide hidden sm:inline">
              DISASTER RESPONSE HUB
            </span>
            <span className="bg-gradient-to-r from-purple-300 via-violet-200 to-white bg-clip-text text-transparent font-extrabold tracking-wide sm:hidden">
              DRH
            </span>
          </h1>
        </div>
        <div className="navbar-end gap-2 lg:gap-3 relative z-10">
          {/* Connection Status Indicator */}
          <div className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-4 py-1 lg:py-2 rounded-full transition-all duration-300 backdrop-blur-sm ${
            socketConnected 
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 shadow-lg shadow-emerald-500/20' 
              : 'bg-red-500/20 text-red-300 border border-red-400/50 shadow-lg shadow-red-500/20'
          }`}>
            <HiWifi className="w-3 h-3 lg:w-4 lg:h-4" />
            <span className="text-xs font-semibold hidden sm:inline">
              {socketConnected ? 'LIVE' : `OFFLINE ${connectionAttempts > 0 ? `(${connectionAttempts})` : ''}`}
            </span>
            <span className="text-xs font-semibold sm:hidden">
              {socketConnected ? '●' : '○'}
            </span>
          </div>
          
          {selectedDisaster && (
            <button 
              className="btn btn-ghost btn-xs lg:btn-sm hover:bg-purple-500/20 hover:text-purple-300 transition-all duration-300 text-gray-200 border border-purple-500/30 hover:border-purple-400/50 backdrop-blur-sm"
              onClick={refreshData}
              disabled={loading}
            >
              <HiRefresh className={`w-3 h-3 lg:w-4 lg:h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{loading ? 'SYNCING...' : 'REFRESH'}</span>
            </button>
          )}
          <button 
            className="btn btn-outline btn-xs lg:btn-sm border-purple-400/60 text-purple-300 hover:bg-purple-500/20 hover:border-purple-300 transition-all duration-300 backdrop-blur-sm font-semibold"
            onClick={() => setCurrentView(currentView === 'dashboard' ? 'ai-demo' : 'dashboard')}
          >
            <HiSparkles className="w-3 h-3 lg:w-4 lg:h-4" />
            <span className="hidden sm:inline">{currentView === 'dashboard' ? 'AI DEMO' : 'DASHBOARD'}</span>
            <span className="sm:hidden">AI</span>
          </button>
          <button 
            className="btn btn-primary btn-xs lg:btn-sm bg-gradient-to-r from-purple-600 via-violet-600 to-purple-700 border-none hover:from-purple-500 hover:via-violet-500 hover:to-purple-600 transition-all duration-300 shadow-xl shadow-purple-500/25 text-white font-bold tracking-wide hover:scale-105"
            onClick={() => setShowCreateForm(true)}
          >
            <HiPlus className="w-3 h-3 lg:w-4 lg:h-4" />
            <span className="hidden sm:inline">REPORT EVENT</span>
            <span className="sm:hidden">REPORT</span>
          </button>
          {selectedDisaster && (
            <button 
              className="btn btn-outline btn-xs lg:btn-sm border-purple-400/60 text-purple-300 hover:bg-purple-500/20 hover:border-purple-300 transition-all duration-300 backdrop-blur-sm font-semibold"
              onClick={() => setShowReportForm(true)}
            >
              <HiChatAlt2 className="w-3 h-3 lg:w-4 lg:h-4" />
              <span className="hidden sm:inline">ADD REPORT</span>
              <span className="sm:hidden">ADD</span>
            </button>
          )}
        </div>
      </div>

      {currentView === 'ai-demo' ? (
        <AIMapDemo />
      ) : (
        <div className="flex flex-col lg:flex-row h-screen">
          {/* Sidebar - Disasters List */}
          <div className="w-full lg:w-80 bg-black/30 backdrop-blur-2xl border-b lg:border-b-0 lg:border-r border-purple-500/30 p-4 lg:p-6 overflow-y-auto relative max-h-64 lg:max-h-none">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-transparent to-violet-900/10"></div>
            <div className="relative z-10">
              <div className="mb-6">
                <div className="form-control">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Search events..." 
                      className="input input-bordered input-sm w-full bg-black/40 border-purple-500/40 text-white placeholder-gray-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 transition-all duration-300 backdrop-blur-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button className="absolute right-2 top-1/2 transform -translate-y-1/2 text-purple-400 hover:text-purple-300 transition-colors duration-300">
                      <HiSearch className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {filteredDisasters.map(disaster => (
                  <div 
                    key={disaster.id}
                    className={`card bg-black/40 cursor-pointer transition-all duration-300 hover:bg-black/60 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/20 border backdrop-blur-sm ${
                      selectedDisaster?.id === disaster.id 
                        ? 'ring-2 ring-purple-400 bg-purple-500/20 border-purple-400/50 shadow-lg shadow-purple-500/30' 
                        : 'border-purple-500/20 hover:border-purple-400/40'
                    }`}
                    onClick={() => setSelectedDisaster(disaster)}
                  >
                    <div className="card-body p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="card-title text-sm text-white font-bold leading-tight">{disaster.title}</h3>
                        <div className={`badge ${getStatusColor(disaster.status)} badge-sm font-semibold`}>
                          {disaster.status.toUpperCase()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-purple-300 mb-2 font-medium">
                        <HiLocationMarker className="w-3 h-3" />
                        {disaster.location_name || 'Unknown location'}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <HiClock className="w-3 h-3" />
                        {formatTimeAgo(disaster.created_at)}
                      </div>
                      {disaster.tags && disaster.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {disaster.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="badge badge-xs badge-outline text-purple-300 border-purple-400/60 hover:bg-purple-400/20 transition-colors duration-200 font-medium">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {selectedDisaster ? (
            <div>
              {/* Disaster Header */}
              <div className="mb-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-2">{selectedDisaster.title}</h1>
                    <div className="flex items-center gap-4 text-gray-300">
                      <div className="flex items-center gap-2">
                        <HiLocationMarker className="w-4 h-4" />
                        {selectedDisaster.location_name || 'Unknown location'}
                      </div>
                      <div className={`badge ${getStatusColor(selectedDisaster.status)}`}>
                        {selectedDisaster.status}
                      </div>
                      <div className="flex items-center gap-2">
                        <HiClock className="w-4 h-4" />
                        {formatTimeAgo(selectedDisaster.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
                
                {selectedDisaster.description && (
                  <p className="text-gray-300 mb-4">{selectedDisaster.description}</p>
                )}

                {/* Analytics Summary */}
                {analytics && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4 mb-6">
                    <div className="stat bg-base-100/10 rounded-lg">
                      <div className="stat-title text-gray-400">Total Reports</div>
                      <div className="stat-value text-white">{analytics.total_reports}</div>
                    </div>
                    <div className="stat bg-base-100/10 rounded-lg">
                      <div className="stat-title text-gray-400">Resources</div>
                      <div className="stat-value text-white">{analytics.total_resources}</div>
                    </div>
                    <div className="stat bg-base-100/10 rounded-lg">
                      <div className="stat-title text-gray-400">Verified</div>
                      <div className="stat-value text-white">{analytics.verification_status?.verified || 0}</div>
                    </div>
                    <div className="stat bg-base-100/10 rounded-lg">
                      <div className="stat-title text-gray-400">Critical</div>
                      <div className="stat-value text-white">{analytics.severity_distribution?.critical || 0}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="tabs tabs-boxed bg-base-100/10 mb-6 overflow-x-auto">
                {['overview', 'reports', 'social', 'resources'].map(tab => (
                  <button
                    key={tab}
                    className={`tab ${activeTab === tab ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Gemini AI Analysis */}
                  <GeminiAnalysis disaster={selectedDisaster} />
                  
                  {/* Disaster Map */}
                  <DisasterMap disaster={selectedDisaster} />
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Reports */}
                    <div className="card bg-base-100/10">
                      <div className="card-header p-4 border-b border-white/10">
                        <h3 className="card-title text-white">Recent Reports</h3>
                      </div>
                      <div className="card-body p-4">
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {reports.slice(0, 5).map(report => (
                            <div key={report.id} className="flex items-start gap-3 p-3 bg-base-100/10 rounded-lg">
                              {getSeverityIcon(report.severity)}
                              <div className="flex-1">
                                <p className="text-sm text-gray-300">{report.content}</p>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                                  <span>{formatTimeAgo(report.created_at)}</span>
                                  <span className={`badge badge-xs ${
                                    report.verification_status === 'authentic' ? 'badge-success' :
                                    report.verification_status === 'pending' ? 'badge-warning' :
                                    'badge-error'
                                  }`}>
                                    {report.verification_status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Available Resources */}
                    <div className="card bg-base-100/10">
                      <div className="card-header p-4 border-b border-white/10">
                        <h3 className="card-title text-white">Available Resources</h3>
                      </div>
                      <div className="card-body p-4">
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {resources.filter(r => r.availability_status === 'available').slice(0, 5).map(resource => (
                            <div key={resource.id} className="flex items-center justify-between p-3 bg-base-100/10 rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-white">{resource.name}</p>
                                <p className="text-xs text-gray-400">{resource.resource_type}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-white">{resource.quantity}</p>
                                <p className="text-xs text-green-400">Available</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'reports' && (
                <div className="card bg-base-100/10">
                  <div className="card-body p-4">
                    <div className="space-y-4">
                      {reports.map(report => (
                        <div key={report.id} className="border border-white/10 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {getSeverityIcon(report.severity)}
                              <span className="text-sm font-medium text-white">
                                {report.severity.toUpperCase()} PRIORITY
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`badge ${
                                report.verification_status === 'authentic' ? 'badge-success' :
                                report.verification_status === 'pending' ? 'badge-warning' :
                                'badge-error'
                              }`}>
                                {report.verification_status}
                              </span>
                              <span className="text-xs text-gray-400">
                                {formatTimeAgo(report.created_at)}
                              </span>
                            </div>
                          </div>
                          <p className="text-gray-300 mb-3">{report.content}</p>
                          {report.image_url && (
                            <img 
                              src={report.image_url} 
                              alt="Report" 
                              className="w-32 h-32 object-cover rounded-lg mb-3"
                            />
                          )}
                          {report.resource_needs && report.resource_needs.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {report.resource_needs.map(need => (
                                <span key={need} className="badge badge-outline badge-sm">
                                  {need}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'social' && (
                <div className="card bg-base-100/10">
                  <div className="card-body p-4">
                    <div className="space-y-4">
                      {socialMedia.map((post, index) => (
                        <div key={index} className="border border-white/10 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-400">@{post.user}</span>
                            <div className="flex items-center gap-2">
                              <span className={`badge badge-sm ${
                                post.platform === 'twitter' ? 'badge-info' :
                                post.platform === 'bluesky' ? 'badge-secondary' :
                                'badge-neutral'
                              }`}>
                                {post.platform}
                              </span>
                              <span className="text-xs text-gray-400">
                                {formatTimeAgo(post.timestamp)}
                              </span>
                            </div>
                          </div>
                          <p className="text-gray-300">{post.post}</p>
                          {post.engagement && (
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                              <span>❤️ {post.engagement.like_count || 0}</span>
                              <span>🔄 {post.engagement.retweet_count || 0}</span>
                              <span>💬 {post.engagement.reply_count || 0}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'resources' && (
                <div className="card bg-base-100/10">
                  <div className="card-body p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {resources.map(resource => (
                        <div key={resource.id} className="border border-white/10 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-white">{resource.name}</h4>
                            <span className={`badge badge-sm ${
                              resource.availability_status === 'available' ? 'badge-success' :
                              resource.availability_status === 'limited' ? 'badge-warning' :
                              'badge-error'
                            }`}>
                              {resource.availability_status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mb-2">{resource.resource_type}</p>
                          <p className="text-sm text-gray-300 mb-2">Quantity: {resource.quantity}</p>
                          {resource.contact_info && (
                            <p className="text-xs text-blue-400">{resource.contact_info}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full relative">
              <div className="text-center relative z-10">
                <div className="relative mb-8">
                  <HiInformationCircle className="w-24 h-24 text-purple-400/60 mx-auto drop-shadow-lg" />
                  <div className="absolute inset-0 w-24 h-24 text-purple-400/20 animate-ping mx-auto">
                    <HiInformationCircle className="w-24 h-24" />
                  </div>
                </div>
                <h2 className="text-4xl font-extrabold bg-gradient-to-r from-white via-purple-200 to-violet-300 bg-clip-text text-transparent mb-4 tracking-wide">
                  SELECT AN EVENT
                </h2>
                <p className="text-gray-400 text-lg font-medium">Choose an event from the sidebar to view detailed information</p>
                <div className="mt-8 px-8 py-4 bg-purple-500/10 border border-purple-500/20 rounded-lg backdrop-blur-sm">
                  <p className="text-purple-300 text-sm">Real-time disaster monitoring and response coordination</p>
                </div>
              </div>
              {/* Background decoration */}
              <div className="absolute inset-0 flex items-center justify-center opacity-5">
                <div className="w-96 h-96 border-2 border-purple-500 rounded-full"></div>
                <div className="absolute w-80 h-80 border border-purple-400 rounded-full"></div>
                <div className="absolute w-64 h-64 border border-purple-300 rounded-full"></div>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Create Disaster Modal */}
      {showCreateForm && <CreateDisasterModal onClose={() => setShowCreateForm(false)} onSubmit={createDisaster} />}
      
      {/* Submit Report Modal */}
      {showReportForm && <SubmitReportModal onClose={() => setShowReportForm(false)} onSubmit={submitReport} />}
    </div>
  );
};

// Create Disaster Modal Component
const CreateDisasterModal = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    title: '',
    location_name: '',
    description: '',
    disaster_type: '',
    tags: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    });
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-base-200">
        <h3 className="font-bold text-lg mb-4">Report New Disaster</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Title *</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
            />
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text">Location</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={formData.location_name}
              onChange={(e) => setFormData({...formData, location_name: e.target.value})}
              placeholder="City, State/Country"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Description *</span>
            </label>
            <textarea
              className="textarea textarea-bordered"
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Disaster Type</span>
            </label>
            <select
              className="select select-bordered"
              value={formData.disaster_type}
              onChange={(e) => setFormData({...formData, disaster_type: e.target.value})}
            >
              <option value="">Select type</option>
              <option value="flood">Flood</option>
              <option value="earthquake">Earthquake</option>
              <option value="fire">Fire</option>
              <option value="hurricane">Hurricane</option>
              <option value="tornado">Tornado</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Tags (comma-separated)</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={formData.tags}
              onChange={(e) => setFormData({...formData, tags: e.target.value})}
              placeholder="urgent, help, relief"
            />
          </div>

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Disaster</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Submit Report Modal Component
const SubmitReportModal = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    content: '',
    image_url: '',
    severity: 'medium',
    resource_needs: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      resource_needs: formData.resource_needs.split(',').map(need => need.trim()).filter(Boolean)
    });
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-base-200">
        <h3 className="font-bold text-lg mb-4">Submit Report</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Report Content *</span>
            </label>
            <textarea
              className="textarea textarea-bordered"
              rows="4"
              value={formData.content}
              onChange={(e) => setFormData({...formData, content: e.target.value})}
              required
              placeholder="Describe what you're seeing or experiencing..."
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Image URL</span>
            </label>
            <input
              type="url"
              className="input input-bordered"
              value={formData.image_url}
              onChange={(e) => setFormData({...formData, image_url: e.target.value})}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Severity</span>
            </label>
            <select
              className="select select-bordered"
              value={formData.severity}
              onChange={(e) => setFormData({...formData, severity: e.target.value})}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Resource Needs (comma-separated)</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={formData.resource_needs}
              onChange={(e) => setFormData({...formData, resource_needs: e.target.value})}
              placeholder="water, food, medical supplies"
            />
          </div>

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Submit Report</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default App;