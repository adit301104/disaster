import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, MapPin, Users, MessageSquare, Shield, Plus, Search, Filter, Bell, Activity, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import io from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_URL;
const SOCKET_URL = import.meta.env.VITE_API_URL;

// Utility function for API calls
const apiCall = async (endpoint, options = {}) => {
  const response = await fetch(`${API_BASE}${endpoint}`, {
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

// Main App Component
const App = () => {
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
  const socketRef = useRef(null);

  // Socket connection and event handlers
  useEffect(() => {
    console.log('Connecting to socket:', SOCKET_URL);
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      timeout: 20000
    });
    
    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current.id);
      addNotification('Connected to real-time updates', 'success');
    });

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
      addNotification('Disconnected from real-time updates', 'warning');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      addNotification('Failed to connect to real-time updates', 'error');
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
    const id = Date.now();
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
      critical: <AlertCircle className="w-4 h-4 text-red-500" />,
      high: <AlertTriangle className="w-4 h-4 text-orange-500" />,
      medium: <AlertCircle className="w-4 h-4 text-yellow-500" />,
      low: <CheckCircle className="w-4 h-4 text-green-500" />
    };
    return icons[severity] || <AlertCircle className="w-4 h-4 text-gray-500" />;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
      {/* Notifications */}
      <div className="toast toast-top toast-end z-50">
        {notifications.map(notif => (
          <div key={notif.id} className={`alert alert-${notif.type} shadow-lg`}>
            <span>{notif.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="navbar bg-base-100/10 backdrop-blur-xl border-b border-white/10">
        <div className="navbar-start">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-400" />
            Disaster Response Hub
          </h1>
        </div>
        <div className="navbar-end gap-2">
          {selectedDisaster && (
            <button 
              className="btn btn-ghost btn-sm"
              onClick={refreshData}
              disabled={loading}
            >
              <Activity className="w-4 h-4" />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          )}
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreateForm(true)}
          >
            <Plus className="w-4 h-4" />
            Report Disaster
          </button>
          {selectedDisaster && (
            <button 
              className="btn btn-outline btn-sm"
              onClick={() => setShowReportForm(true)}
            >
              <MessageSquare className="w-4 h-4" />
              Submit Report
            </button>
          )}
        </div>
      </div>

      <div className="flex h-screen">
        {/* Sidebar - Disasters List */}
        <div className="w-80 bg-base-100/5 backdrop-blur-xl border-r border-white/10 p-4 overflow-y-auto">
          <div className="mb-4">
            <div className="form-control">
              <div className="input-group">
                <input 
                  type="text" 
                  placeholder="Search disasters..." 
                  className="input input-bordered input-sm w-full bg-white/10"
                />
                <button className="btn btn-square btn-sm">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {disasters.map(disaster => (
              <div 
                key={disaster.id}
                className={`card bg-base-100/10 cursor-pointer transition-all hover:bg-base-100/20 ${
                  selectedDisaster?.id === disaster.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedDisaster(disaster)}
              >
                <div className="card-body p-4">
                  <div className="flex justify-between items-start">
                    <h3 className="card-title text-sm text-white">{disaster.title}</h3>
                    <div className={`badge ${getStatusColor(disaster.status)} badge-sm`}>
                      {disaster.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-300">
                    <MapPin className="w-3 h-3" />
                    {disaster.location_name || 'Unknown location'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(disaster.created_at)}
                  </div>
                  {disaster.tags && disaster.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {disaster.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="badge badge-xs badge-outline text-gray-300">
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

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedDisaster ? (
            <div>
              {/* Disaster Header */}
              <div className="mb-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-2">{selectedDisaster.title}</h1>
                    <div className="flex items-center gap-4 text-gray-300">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {selectedDisaster.location_name || 'Unknown location'}
                      </div>
                      <div className={`badge ${getStatusColor(selectedDisaster.status)}`}>
                        {selectedDisaster.status}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
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
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
              <div className="tabs tabs-boxed bg-base-100/10 mb-6">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Select a Disaster</h2>
                <p className="text-gray-400">Choose a disaster from the sidebar to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

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