const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
// Configure allowed origins
console.log('Environment ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS);
console.log('All environment variables:', Object.keys(process.env).filter(key => key.includes('ALLOWED')));

// Force include the frontend domain for production
const defaultOrigins = [
  "http://localhost:3000",
  "http://localhost:5173", 
  "http://localhost:8080",
  "https://disaster-frontend-n1cn.onrender.com"
];

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? [...new Set([...process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()), ...defaultOrigins])]
  : defaultOrigins;

console.log('Final CORS origins:', allowedOrigins);

const io = socketIo(server, { 
  cors: { 
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id"]
  },
  transports: ['websocket', 'polling']
});

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes("*")) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-user-id"]
}));

// Handle preflight requests - simplified
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.get('Origin');
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
    }
    return res.sendStatus(200);
  }
  next();
});

// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.get('Origin') || 'none'}`);
  next();
});

// Manual CORS headers as fallback
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
  }
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || '10mb' }));

// Initialize Supabase client
let supabase;
try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase credentials');
  }
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  console.log('✅ Supabase client initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Supabase:', error.message);
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
  console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing');
}

// Dummy users for authentication
const users = {
  netrunnerX: { id: 'netrunnerX', role: 'admin' },
  reliefAdmin: { id: 'reliefAdmin', role: 'admin' },
  citizen1: { id: 'citizen1', role: 'contributor' }
};

// Auth middleware
const auth = (req, res, next) => {
  const userId = req.headers['x-user-id'] || 'netrunnerX';
  req.user = users[userId] || users.netrunnerX;
  next();
};

// Rate limiting middleware
const rateLimitStore = new Map();
const rateLimit = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000; // 15 minutes
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
  
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!rateLimitStore.has(clientIp)) {
    rateLimitStore.set(clientIp, []);
  }
  
  const requests = rateLimitStore.get(clientIp).filter(time => time > windowStart);
  
  if (requests.length >= maxRequests) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  requests.push(now);
  rateLimitStore.set(clientIp, requests);
  next();
};

app.use(rateLimit);

const log = (message) => {
  const level = process.env.LOG_LEVEL || 'info';
  if (level === 'info' || level === 'debug') {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
};

// Enhanced cache functions
const getCache = async (key) => {
  try {
    const { data } = await supabase
      .from('cache')
      .select('value, expires_at')
      .eq('key', key)
      .gt('expires_at', new Date().toISOString())
      .single();
    return data?.value;
  } catch (error) {
    log(`Cache get error for key ${key}: ${error.message}`);
    return null;
  }
};

const setCache = async (key, value, ttlHours = null) => {
  try {
    const defaultTTL = parseFloat(process.env.CACHE_TTL_HOURS) || 1;
    const hours = ttlHours || defaultTTL;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    
    await supabase
      .from('cache')
      .upsert({ 
        key, 
        value: typeof value === 'object' ? JSON.stringify(value) : value, 
        expires_at: expiresAt.toISOString() 
      });
  } catch (error) {
    log(`Cache set error for key ${key}: ${error.message}`);
  }
};

// Cache cleanup function
const cleanupCache = async () => {
  try {
    await supabase
      .from('cache')
      .delete()
      .lt('expires_at', new Date().toISOString());
    log('Cache cleanup completed');
  } catch (error) {
    log(`Cache cleanup error: ${error.message}`);
  }
};

// Schedule cache cleanup
setInterval(cleanupCache, parseInt(process.env.CACHE_CLEANUP_INTERVAL) || 3600000); // 1 hour

// Free location extraction using text processing
const extractLocationWithFreeAI = async (description) => {
  const cacheKey = `free_location_${Buffer.from(description).toString('base64').slice(0, 50)}`;
  let cached = await getCache(cacheKey);
  if (cached) return typeof cached === 'string' ? cached : JSON.parse(cached);

  try {
    // Use pattern matching to extract location
    const locationName = extractLocationFromText(description);
    
    if (locationName) {
      await setCache(cacheKey, locationName);
      log(`Free AI location extraction: ${locationName}`);
      return locationName;
    }
    
    return null;
  } catch (error) {
    log(`Free AI location extraction error: ${error.message}`);
    return null;
  }
};

const extractLocationFromText = (text) => {
  // Common location patterns
  const patterns = [
    // City, State format
    /(?:in|near|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})(?:\s|$|[.,!?])/gi,
    // City, Country format
    /(?:in|near|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+)(?:\s|$|[.,!?])/gi,
    // Just city names with common location words
    /(?:in|near|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(?:\s+(?:City|County|Area|Region|downtown|district))/gi,
    // State names
    /(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)/gi,
    // Major cities
    /(New York|Los Angeles|Chicago|Houston|Phoenix|Philadelphia|San Antonio|San Diego|Dallas|San Jose|Austin|Jacksonville|Fort Worth|Columbus|Charlotte|San Francisco|Indianapolis|Seattle|Denver|Washington|Boston|El Paso|Nashville|Detroit|Oklahoma City|Portland|Las Vegas|Memphis|Louisville|Baltimore|Milwaukee|Albuquerque|Tucson|Fresno|Sacramento|Mesa|Kansas City|Atlanta|Long Beach|Colorado Springs|Raleigh|Miami|Virginia Beach|Omaha|Oakland|Minneapolis|Tulsa|Arlington|Tampa|New Orleans)/gi
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Clean up the match
      let location = matches[0].replace(/^(in|near|at)\s+/i, '').trim();
      location = location.replace(/[.,!?]$/, ''); // Remove trailing punctuation
      return location;
    }
  }
  
  return null;
};

// Multi-service geocoding (Google Maps, Mapbox, OpenStreetMap)
const geocodeLocation = async (locationName) => {
  const cacheKey = `geocode_${locationName}`;
  let cached = await getCache(cacheKey);
  if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;

  let coords = null;

  // Try Google Maps first
  if (process.env.GOOGLE_MAPS_API_KEY && !coords) {
    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: locationName,
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });
      
      if (response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        coords = {
          lat: location.lat,
          lng: location.lng,
          formatted_address: response.data.results[0].formatted_address,
          source: 'google_maps'
        };
        log(`Google Maps geocoding successful: ${locationName}`);
      }
    } catch (error) {
      log(`Google Maps geocoding error: ${error.message}`);
    }
  }

  // Mapbox geocoding removed

  // Fallback to OpenStreetMap
  if (!coords) {
    try {
      const response = await axios.get(`${process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org'}/search`, {
        params: {
          q: locationName,
          format: 'json',
          limit: 1,
          addressdetails: 1
        },
        headers: { 'User-Agent': process.env.NOMINATIM_USER_AGENT || 'DisasterResponseApp/1.0' }
      });
      
      if (response.data.length > 0) {
        const result = response.data[0];
        coords = {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          formatted_address: result.display_name,
          source: 'openstreetmap'
        };
        log(`OpenStreetMap geocoding successful: ${locationName}`);
      }
    } catch (error) {
      log(`OpenStreetMap geocoding error: ${error.message}`);
    }
  }

  if (coords) {
    await setCache(cacheKey, coords);
  }
  
  return coords;
};

// Simple image verification without API keys
const verifyImageWithFreeAI = async (imageUrl, disasterType = null) => {
  const cacheKey = `verify_${Buffer.from(imageUrl).toString('base64').slice(0, 50)}`;
  let cached = await getCache(cacheKey);
  if (cached) return typeof cached === 'string' ? cached : JSON.parse(cached);

  try {
    // Simple verification based on URL patterns and basic checks
    const verification = performBasicImageVerification(imageUrl, disasterType);
    
    const result = {
      analysis: verification.status,
      confidence: verification.confidence,
      reasoning: verification.reasoning,
      timestamp: new Date().toISOString(),
      image_url: imageUrl
    };
    
    await setCache(cacheKey, result);
    log(`Image verification completed for: ${imageUrl}`);
    return result;
  } catch (error) {
    log(`Image verification error: ${error.message}`);
    return {
      analysis: "verification_failed",
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

const performBasicImageVerification = (imageUrl, disasterType) => {
  // Basic URL and format checks
  const url = imageUrl.toLowerCase();
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    'fake', 'mock', 'test', 'sample', 'placeholder',
    'lorem', 'dummy', 'example'
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => url.includes(pattern));
  
  if (isSuspicious) {
    return {
      status: 'suspicious',
      confidence: 85,
      reasoning: 'URL contains patterns commonly associated with test or fake content'
    };
  }
  
  // Check for common image hosting services (more likely to be authentic)
  const trustedHosts = [
    'imgur.com', 'flickr.com', 'instagram.com', 'twitter.com',
    'facebook.com', 'reddit.com', 'news', 'gov'
  ];
  
  const isTrustedHost = trustedHosts.some(host => url.includes(host));
  
  if (isTrustedHost) {
    return {
      status: 'authentic',
      confidence: 75,
      reasoning: 'Image hosted on commonly used platform, appears legitimate'
    };
  }
  
  // Check file extension
  const hasValidExtension = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  
  if (!hasValidExtension) {
    return {
      status: 'suspicious',
      confidence: 70,
      reasoning: 'Unusual file format or missing file extension'
    };
  }
  
  // Default to pending verification
  return {
    status: 'pending',
    confidence: 60,
    reasoning: 'Image requires manual verification - automated analysis inconclusive'
  };
};

// Enhanced social media integration (Twitter/Bluesky/Mock)
const fetchSocialMedia = async (disasterId, keywords = []) => {
  const cacheKey = `social_${disasterId}_${keywords.join('_')}`;
  let cached = await getCache(cacheKey);
  if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;

  let socialData = [];

  // Twitter API integration removed

  // Try Bluesky if Twitter failed
  if (socialData.length === 0 && process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_PASSWORD) {
    try {
      // Bluesky authentication
      const authResponse = await axios.post('https://bsky.social/xrpc/com.atproto.server.createSession', {
        identifier: process.env.BLUESKY_IDENTIFIER,
        password: process.env.BLUESKY_PASSWORD
      });

      const accessJwt = authResponse.data.accessJwt;

      // Search for posts
      const searchResponse = await axios.get('https://bsky.social/xrpc/app.bsky.feed.searchPosts', {
        params: {
          q: keywords.length > 0 ? keywords.join(' ') : 'disaster emergency relief',
          limit: 20
        },
        headers: {
          'Authorization': `Bearer ${accessJwt}`
        }
      });

      if (searchResponse.data.posts) {
        socialData = searchResponse.data.posts.map(post => ({
          post: post.record.text,
          user: post.author.handle,
          timestamp: post.record.createdAt,
          platform: 'bluesky',
          id: post.uri
        }));
        log(`Bluesky API returned ${socialData.length} posts`);
      }
    } catch (error) {
      log(`Bluesky API error: ${error.message}`);
    }
  }

  // Fallback to mock data if both failed or if mock is enabled
  if (socialData.length === 0 || process.env.ENABLE_MOCK_SOCIAL_MEDIA === 'true') {
    const mockKeywords = keywords.length > 0 ? keywords : ['floodrelief', 'disaster', 'urgent', 'help', 'emergency'];
    socialData = [
      { post: `#${mockKeywords[0]} Need food supplies in affected area`, user: "citizen1", timestamp: new Date().toISOString(), platform: 'mock' },
      { post: `Water shortage reported #${mockKeywords[1]}`, user: "helpseeker", timestamp: new Date().toISOString(), platform: 'mock' },
      { post: `SOS - medical assistance needed #${mockKeywords[2]}`, user: "emergency123", timestamp: new Date().toISOString(), platform: 'mock' },
      { post: `Evacuation route blocked, need alternative #${mockKeywords[0]}`, user: "localresident", timestamp: new Date().toISOString(), platform: 'mock' },
      { post: `Shelter space available for 50 people #${mockKeywords[1]}`, user: "reliefcenter", timestamp: new Date().toISOString(), platform: 'mock' }
    ];
    log(`Using mock social media data with ${socialData.length} posts`);
  }
  
  await setCache(cacheKey, socialData, 0.5); // 30 min cache
  return socialData;
};

// Enhanced official updates scraping
const fetchOfficialUpdates = async (disasterId, locationName = null) => {
  const cacheKey = `official_${disasterId}_${locationName || 'general'}`;
  let cached = await getCache(cacheKey);
  if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;

  let updates = [];

  // FEMA updates
  try {
    const femaResponse = await axios.get('https://www.fema.gov/about/news-multimedia/news-stories', {
      timeout: 10000,
      headers: { 'User-Agent': 'DisasterResponseApp/1.0' }
    });
    
    const $ = cheerio.load(femaResponse.data);
    $('.views-row').slice(0, 3).each((i, elem) => {
      const title = $(elem).find('h3 a').text().trim();
      const link = $(elem).find('h3 a').attr('href');
      const date = $(elem).find('.date-display-single').text().trim();
      
      if (title && link) {
        updates.push({
          source: "FEMA",
          title: title,
          content: title,
          link: link.startsWith('http') ? link : `https://www.fema.gov${link}`,
          timestamp: date || new Date().toISOString(),
          type: 'official'
        });
      }
    });
    log(`FEMA scraping found ${updates.filter(u => u.source === 'FEMA').length} updates`);
  } catch (error) {
    log(`FEMA scraping error: ${error.message}`);
  }

  // Red Cross updates
  try {
    const redCrossResponse = await axios.get('https://www.redcross.org/about-us/news-and-events', {
      timeout: 10000,
      headers: { 'User-Agent': 'DisasterResponseApp/1.0' }
    });
    
    const $ = cheerio.load(redCrossResponse.data);
    $('.m-card').slice(0, 3).each((i, elem) => {
      const title = $(elem).find('h3').text().trim();
      const link = $(elem).find('a').attr('href');
      const summary = $(elem).find('p').text().trim();
      
      if (title && link) {
        updates.push({
          source: "Red Cross",
          title: title,
          content: summary || title,
          link: link.startsWith('http') ? link : `https://www.redcross.org${link}`,
          timestamp: new Date().toISOString(),
          type: 'official'
        });
      }
    });
    log(`Red Cross scraping found ${updates.filter(u => u.source === 'Red Cross').length} updates`);
  } catch (error) {
    log(`Red Cross scraping error: ${error.message}`);
  }

  // Fallback mock data if scraping failed
  if (updates.length === 0) {
    updates = [
      { 
        source: "FEMA", 
        title: "Emergency Response Activated",
        content: locationName ? `Emergency response services activated in ${locationName}` : "Emergency response services activated in affected areas", 
        timestamp: new Date().toISOString(),
        type: 'official'
      },
      { 
        source: "Red Cross", 
        title: "Relief Centers Established",
        content: locationName ? `Relief centers established near ${locationName}` : "Relief centers established in affected areas", 
        timestamp: new Date().toISOString(),
        type: 'official'
      },
      {
        source: "Emergency Services",
        title: "Evacuation Procedures",
        content: "Follow local emergency evacuation procedures and stay tuned for updates",
        timestamp: new Date().toISOString(),
        type: 'official'
      }
    ];
    log('Using mock official updates data');
  }
  
  await setCache(cacheKey, updates);
  return updates;
};

// API Routes

// Enhanced geocoding endpoint
app.post('/geocode', auth, async (req, res) => {
  try {
    const { description, locationName: providedLocation } = req.body;
    let locationName = providedLocation;
    
    if (!locationName && description) {
      locationName = await extractLocationWithFreeAI(description);
    }
    
    if (!locationName) {
      return res.status(400).json({ error: 'Could not extract or find location' });
    }
    
    const coords = await geocodeLocation(locationName);
    if (!coords) {
      return res.status(400).json({ error: 'Could not geocode location' });
    }
    
    res.json({ 
      locationName, 
      coordinates: coords,
      extractedFromDescription: !providedLocation
    });
  } catch (error) {
    log(`Geocoding endpoint error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced disaster CRUD with better location handling
app.post('/disasters', auth, async (req, res) => {
  try {
    const { title, location_name, description, tags, disaster_type } = req.body;
    
    let locationName = location_name;
    if (!locationName && description) {
      locationName = await extractLocationWithFreeAI(description);
    }
    
    let location = null;
    let locationDetails = null;
    if (locationName) {
      const coords = await geocodeLocation(locationName);
      if (coords) {
        location = `POINT(${coords.lng} ${coords.lat})`;
        locationDetails = coords;
      }
    }
    
    const auditTrail = [{
      action: 'create',
      user_id: req.user.id,
      timestamp: new Date().toISOString(),
      ip_address: req.ip
    }];
    
    const { data, error } = await supabase
      .from('disasters')
      .insert({
        title,
        location_name: locationName,
        location,
        location_details: locationDetails,
        description,
        tags: tags || [],
        disaster_type,
        owner_id: req.user.id,
        audit_trail: auditTrail,
        status: 'active'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    log(`Disaster created: ${title} at ${locationName}`);
    io.emit('disaster_updated', { action: 'create', disaster: data });
    
    // Trigger initial data fetch for the new disaster
    setTimeout(async () => {
      try {
        await fetchSocialMedia(data.id, tags);
        await fetchOfficialUpdates(data.id, locationName);
        io.emit('disaster_data_updated', { disaster_id: data.id });
      } catch (err) {
        log(`Error fetching initial data for disaster ${data.id}: ${err.message}`);
      }
    }, 1000);
    
    res.status(201).json(data);
  } catch (error) {
    log(`Create disaster error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced disasters list with filtering
app.get('/disasters', auth, async (req, res) => {
  try {
    if (!supabase) {
      // Return mock data if Supabase is not available
      const mockDisasters = [
        {
          id: '1',
          title: 'Sample Flood Emergency',
          location_name: 'Sample City, State',
          description: 'This is sample data - Supabase connection not available',
          status: 'active',
          disaster_type: 'flood',
          tags: ['urgent', 'flood', 'help'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '2',
          title: 'Sample Earthquake Alert',
          location_name: 'Another City, State',
          description: 'This is sample data - Supabase connection not available',
          status: 'monitoring',
          disaster_type: 'earthquake',
          tags: ['earthquake', 'alert'],
          created_at: new Date(Date.now() - 86400000).toISOString(),
          updated_at: new Date(Date.now() - 86400000).toISOString()
        }
      ];
      return res.json(mockDisasters);
    }

    const { tag, lat, lng, radius = 10000, status, disaster_type, limit = 50 } = req.query;
    let query = supabase.from('disasters').select('*');
    
    if (tag) {
      query = query.contains('tags', [tag]);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (disaster_type) {
      query = query.eq('disaster_type', disaster_type);
    }
    
    if (lat && lng) {
      query = query.rpc('disasters_near_point', {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radius_meters: parseInt(radius)
      });
    }
    
    query = query.limit(parseInt(limit)).order('created_at', { ascending: false });
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.json(data || []);
  } catch (error) {
    log(`Get disasters error: ${error.message}`);
    // Return mock data on error
    const mockDisasters = [
      {
        id: 'error-1',
        title: 'Database Connection Error',
        location_name: 'System Status',
        description: 'Unable to connect to database. This is sample data.',
        status: 'pending',
        disaster_type: 'other',
        tags: ['system', 'error'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    res.json(mockDisasters);
  }
});

// Enhanced disaster update
app.put('/disasters/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const { data: current } = await supabase
      .from('disasters')
      .select('audit_trail, owner_id')
      .eq('id', id)
      .single();
    
    // Check permissions
    if (current?.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const auditTrail = [...(current?.audit_trail || []), {
      action: 'update',
      user_id: req.user.id,
      timestamp: new Date().toISOString(),
      changes: Object.keys(updates),
      ip_address: req.ip
    }];
    
    const { data, error } = await supabase
      .from('disasters')
      .update({ ...updates, audit_trail: auditTrail, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    log(`Disaster updated: ${id} by ${req.user.id}`);
    io.emit('disaster_updated', { action: 'update', disaster: data });
    
    res.json(data);
  } catch (error) {
    log(`Update disaster error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/disasters/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check permissions
    const { data: disaster } = await supabase
      .from('disasters')
      .select('owner_id')
      .eq('id', id)
      .single();
    
    if (disaster?.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { error } = await supabase
      .from('disasters')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    log(`Disaster deleted: ${id} by ${req.user.id}`);
    io.emit('disaster_updated', { action: 'delete', id });
    
    res.status(204).send();
  } catch (error) {
    log(`Delete disaster error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced social media endpoint
app.get('/disasters/:id/social-media', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { keywords } = req.query;
    
    const keywordArray = keywords ? keywords.split(',') : [];
    const data = await fetchSocialMedia(id, keywordArray);
    
    io.emit('social_media_updated', { disaster_id: id, data });
    res.json(data);
  } catch (error) {
    log(`Social media fetch error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced resources endpoint
app.get('/disasters/:id/resources', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng, radius = 10000, resource_type } = req.query;
    
    if (!supabase) {
      // Return mock resources if Supabase is not available
      const mockResources = [
        {
          id: '1',
          disaster_id: id,
          name: 'Emergency Water Supply',
          resource_type: 'water',
          quantity: '1000 bottles',
          availability_status: 'available',
          contact_info: 'Contact: Emergency Services',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          disaster_id: id,
          name: 'Medical Supplies',
          resource_type: 'medical',
          quantity: '50 kits',
          availability_status: 'limited',
          contact_info: 'Contact: Red Cross',
          created_at: new Date().toISOString()
        }
      ];
      return res.json(mockResources);
    }
    
    let query = supabase
      .from('resources')
      .select('*')
      .eq('disaster_id', id);
    
    if (resource_type) {
      query = query.eq('resource_type', resource_type);
    }
    
    if (lat && lng) {
      query = query.rpc('resources_near_point', {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radius_meters: parseInt(radius)
      });
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    io.emit('resources_updated', { disaster_id: id, resources: data });
    res.json(data || []);
  } catch (error) {
    log(`Resources fetch error: ${error.message}`);
    // Return mock data on error
    const mockResources = [
      {
        id: 'error-1',
        disaster_id: req.params.id,
        name: 'Database Error - Mock Resource',
        resource_type: 'other',
        quantity: 'N/A',
        availability_status: 'unavailable',
        contact_info: 'System Error',
        created_at: new Date().toISOString()
      }
    ];
    res.json(mockResources);
  }
});

// Enhanced official updates endpoint
app.get('/disasters/:id/official-updates', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get disaster location for contextual updates
    const { data: disaster } = await supabase
      .from('disasters')
      .select('location_name')
      .eq('id', id)
      .single();
    
    const data = await fetchOfficialUpdates(id, disaster?.location_name);
    res.json(data);
  } catch (error) {
    log(`Official updates fetch error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced image verification endpoint
app.post('/disasters/:id/verify-image', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl, disasterType } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }
    
    const result = await verifyImageWithFreeAI(imageUrl, disasterType);
    
    // Update report verification status
    await supabase
      .from('reports')
      .update({ 
        verification_status: result.analysis,
        verification_details: result,
        verified_at: new Date().toISOString(),
        verified_by: req.user.id
      })
      .eq('disaster_id', id)
      .eq('image_url', imageUrl);
    
    log(`Image verified for disaster ${id}: ${imageUrl}`);
    res.json({ verification: result });
  } catch (error) {
    log(`Image verification error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced reports endpoint
app.post('/reports', auth, async (req, res) => {
  try {
    const { disaster_id, content, image_url, location, resource_needs, severity } = req.body;
    
    let verificationStatus = 'pending';
    let verificationDetails = null;
    
    // Auto-verify image if provided
    if (image_url) {
      const { data: disaster } = await supabase
        .from('disasters')
        .select('disaster_type')
        .eq('id', disaster_id)
        .single();
      
      verificationDetails = await verifyImageWithFreeAI(image_url, disaster?.disaster_type);
      verificationStatus = verificationDetails.analysis;
    }
    
    const { data, error } = await supabase
      .from('reports')
      .insert({
        disaster_id,
        user_id: req.user.id,
        content,
        image_url,
        location,
        resource_needs: resource_needs || [],
        severity: severity || 'medium',
        verification_status: verificationStatus,
        verification_details: verificationDetails,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    log(`Report created for disaster ${disaster_id} by ${req.user.id}`);
    io.emit('report_created', { disaster_id, report: data });
    
    res.status(201).json(data);
  } catch (error) {
    log(`Create report error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get reports for a disaster
app.get('/disasters/:id/reports', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, severity, limit = 50 } = req.query;
    
    if (!supabase) {
      // Return mock reports if Supabase is not available
      const mockReports = [
        {
          id: '1',
          disaster_id: id,
          user_id: 'citizen1',
          content: 'Water levels rising rapidly in downtown area',
          severity: 'high',
          verification_status: 'pending',
          resource_needs: ['water', 'evacuation'],
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          disaster_id: id,
          user_id: 'netrunnerX',
          content: 'Emergency shelter needed for 50 families',
          severity: 'critical',
          verification_status: 'authentic',
          resource_needs: ['shelter', 'food'],
          created_at: new Date(Date.now() - 3600000).toISOString()
        }
      ];
      return res.json(mockReports);
    }
    
    let query = supabase
      .from('reports')
      .select('*')
      .eq('disaster_id', id);
    
    if (status) {
      query = query.eq('verification_status', status);
    }
    
    if (severity) {
      query = query.eq('severity', severity);
    }
    
    query = query.limit(parseInt(limit)).order('created_at', { ascending: false });
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.json(data || []);
  } catch (error) {
    log(`Get reports error: ${error.message}`);
    // Return mock data on error
    const mockReports = [
      {
        id: 'error-1',
        disaster_id: req.params.id,
        user_id: 'system',
        content: 'Database connection error - this is mock data',
        severity: 'low',
        verification_status: 'pending',
        resource_needs: [],
        created_at: new Date().toISOString()
      }
    ];
    res.json(mockReports);
  }
});

// Resources management
app.post('/disasters/:id/resources', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, quantity, location, contact_info, availability_status } = req.body;
    
    const { data, error } = await supabase
      .from('resources')
      .insert({
        disaster_id: id,
        name,
        resource_type: type,
        quantity,
        location,
        contact_info,
        availability_status: availability_status || 'available',
        created_by: req.user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    log(`Resource created for disaster ${id}: ${name}`);
    io.emit('resource_created', { disaster_id: id, resource: data });
    
    res.status(201).json(data);
  } catch (error) {
    log(`Create resource error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Analytics endpoint
app.get('/disasters/:id/analytics', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!supabase) {
      // Return mock analytics if Supabase is not available
      const mockAnalytics = {
        disaster_id: id,
        total_reports: 5,
        severity_distribution: {
          low: 1,
          medium: 2,
          high: 1,
          critical: 1
        },
        verification_status: {
          verified: 2,
          pending: 2,
          suspicious: 1,
          fake: 0
        },
        total_resources: 3,
        resource_types: {
          water: 1,
          medical: 1,
          shelter: 1
        },
        available_resources: 2,
        disaster_status: 'active',
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      };
      return res.json(mockAnalytics);
    }
    
    // Get disaster details
    const { data: disaster } = await supabase
      .from('disasters')
      .select('*')
      .eq('id', id)
      .single();
    
    if (!disaster) {
      // Return mock analytics for non-existent disaster
      const mockAnalytics = {
        disaster_id: id,
        total_reports: 0,
        severity_distribution: { low: 0, medium: 0, high: 0, critical: 0 },
        verification_status: { verified: 0, pending: 0, suspicious: 0, fake: 0 },
        total_resources: 0,
        resource_types: {},
        available_resources: 0,
        disaster_status: 'unknown',
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      };
      return res.json(mockAnalytics);
    }
    
    // Get reports count and severity distribution
    const { data: reports } = await supabase
      .from('reports')
      .select('severity, verification_status')
      .eq('disaster_id', id);
    
    // Get resources count and types
    const { data: resources } = await supabase
      .from('resources')
      .select('resource_type, availability_status')
      .eq('disaster_id', id);
    
    // Calculate analytics
    const analytics = {
      disaster_id: id,
      total_reports: reports?.length || 0,
      severity_distribution: {
        low: reports?.filter(r => r.severity === 'low').length || 0,
        medium: reports?.filter(r => r.severity === 'medium').length || 0,
        high: reports?.filter(r => r.severity === 'high').length || 0,
        critical: reports?.filter(r => r.severity === 'critical').length || 0
      },
      verification_status: {
        verified: reports?.filter(r => r.verification_status === 'authentic').length || 0,
        pending: reports?.filter(r => r.verification_status === 'pending').length || 0,
        suspicious: reports?.filter(r => r.verification_status === 'suspicious').length || 0,
        fake: reports?.filter(r => r.verification_status === 'fake').length || 0
      },
      total_resources: resources?.length || 0,
      resource_types: resources?.reduce((acc, r) => {
        acc[r.resource_type] = (acc[r.resource_type] || 0) + 1;
        return acc;
      }, {}) || {},
      available_resources: resources?.filter(r => r.availability_status === 'available').length || 0,
      disaster_status: disaster.status,
      created_at: disaster.created_at,
      last_updated: disaster.updated_at || disaster.created_at
    };
    
    res.json(analytics);
  } catch (error) {
    log(`Analytics error: ${error.message}`);
    // Return mock analytics on error
    const mockAnalytics = {
      disaster_id: req.params.id,
      total_reports: 0,
      severity_distribution: { low: 0, medium: 0, high: 0, critical: 0 },
      verification_status: { verified: 0, pending: 0, suspicious: 0, fake: 0 },
      total_resources: 0,
      resource_types: {},
      available_resources: 0,
      disaster_status: 'error',
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString()
    };
    res.json(mockAnalytics);
  }
});

// Bulk operations for admin users
app.post('/disasters/bulk-update', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { disaster_ids, updates } = req.body;
    
    if (!disaster_ids || !Array.isArray(disaster_ids) || disaster_ids.length === 0) {
      return res.status(400).json({ error: 'disaster_ids array is required' });
    }
    
    const { data, error } = await supabase
      .from('disasters')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .in('id', disaster_ids)
      .select();
    
    if (error) throw error;
    
    log(`Bulk update completed for ${disaster_ids.length} disasters by ${req.user.id}`);
    io.emit('disasters_bulk_updated', { disaster_ids, updates });
    
    res.json({ updated_count: data.length, disasters: data });
  } catch (error) {
    log(`Bulk update error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Mock social media endpoint for testing
app.get('/mock-social-media', auth, (req, res) => {
  const { keywords, count = 10 } = req.query;
  const keywordArray = keywords ? keywords.split(',') : ['disaster', 'emergency', 'relief'];
  
  const mockData = Array.from({ length: parseInt(count) }, (_, i) => ({
    post: `Mock post ${i + 1}: #${keywordArray[i % keywordArray.length]} situation update`,
    user: `user${i + 1}`,
    timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(), // Random time in last 24h
    platform: 'mock',
    engagement: {
      retweet_count: Math.floor(Math.random() * 50),
      like_count: Math.floor(Math.random() * 100),
      reply_count: Math.floor(Math.random() * 20)
    }
  }));
  
  res.json(mockData);
});

// Maps service endpoint (using free OpenStreetMap)
app.get('/api/maps-config', auth, (req, res) => {
  res.json({
    provider: 'openstreetmap',
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    services: {
      supabase: !!process.env.SUPABASE_URL,
      free_ai: true, // Free AI text processing always available
      openstreetmap: true, // Free mapping service
      // mapbox removed
      // twitter removed
      bluesky: !!(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_PASSWORD)
    }
  });
});

// CORS test endpoint
app.get('/cors-test', (req, res) => {
  res.json({
    message: 'CORS is working!',
    origin: req.get('Origin'),
    timestamp: new Date().toISOString(),
    allowedOrigins: allowedOrigins
  });
});

// WebSocket connections with enhanced features
io.on('connection', (socket) => {
  log(`Client connected: ${socket.id}`);
  
  // Join disaster-specific rooms
  socket.on('join_disaster', (disasterId) => {
    socket.join(`disaster_${disasterId}`);
    log(`Client ${socket.id} joined disaster room: ${disasterId}`);
  });
  
  // Leave disaster rooms
  socket.on('leave_disaster', (disasterId) => {
    socket.leave(`disaster_${disasterId}`);
    log(`Client ${socket.id} left disaster room: ${disasterId}`);
  });
  
  // Real-time location updates
  socket.on('location_update', (data) => {
    socket.to(`disaster_${data.disaster_id}`).emit('user_location_update', {
      user_id: data.user_id,
      location: data.location,
      timestamp: new Date().toISOString()
    });
  });
  
  // Emergency alerts
  socket.on('emergency_alert', (data) => {
    if (data.disaster_id) {
      io.to(`disaster_${data.disaster_id}`).emit('emergency_alert', {
        message: data.message,
        severity: data.severity,
        location: data.location,
        timestamp: new Date().toISOString()
      });
    } else {
      io.emit('emergency_alert', {
        message: data.message,
        severity: data.severity,
        location: data.location,
        timestamp: new Date().toISOString()
      });
    }
    log(`Emergency alert broadcast: ${data.message}`);
  });
  
  socket.on('disconnect', () => {
    log(`Client disconnected: ${socket.id}`);
  });
});

// Periodic updates for active disasters
const updateActiveDisasters = async () => {
  try {
    const { data: activeDisasters } = await supabase
      .from('disasters')
      .select('id, tags, location_name')
      .eq('status', 'active')
      .limit(10);
    
    if (activeDisasters && activeDisasters.length > 0) {
      for (const disaster of activeDisasters) {
        // Update social media data
        const socialData = await fetchSocialMedia(disaster.id, disaster.tags);
        io.to(`disaster_${disaster.id}`).emit('social_media_updated', {
          disaster_id: disaster.id,
          data: socialData
        });
        
        // Update official updates
        const officialData = await fetchOfficialUpdates(disaster.id, disaster.location_name);
        io.to(`disaster_${disaster.id}`).emit('official_updates_updated', {
          disaster_id: disaster.id,
          data: officialData
        });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      log(`Updated data for ${activeDisasters.length} active disasters`);
    }
  } catch (error) {
    log(`Periodic update error: ${error.message}`);
  }
};

// Schedule periodic updates
const updateInterval = parseInt(process.env.MOCK_SOCIAL_MEDIA_UPDATE_INTERVAL) || 300000; // 5 minutes
setInterval(updateActiveDisasters, updateInterval);

// Error handling middleware
app.use((error, req, res, next) => {
  log(`Unhandled error: ${error.message}`);
  log(`Stack trace: ${error.stack}`);
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'] || 'unknown'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method 
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('SIGINT received, shutting down gracefully');
  server.close(() => {
    log('Process terminated');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  log(`🚀 Enhanced Disaster Response Server running on port ${PORT}`);
  log(`📊 Health check available at http://localhost:${PORT}/health`);
  log(`🔗 WebSocket server enabled with CORS origin: ${process.env.ALLOWED_ORIGINS || '*'}`);
  
  // Log enabled services
  const services = [];
  if (process.env.SUPABASE_URL) services.push('Supabase');
  services.push('Free AI Processing'); // Always available
  services.push('OpenStreetMap'); // Free mapping service
  // Mapbox removed
  // Twitter API removed
  if (process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_PASSWORD) services.push('Bluesky');
  
  log(`🔌 Enabled integrations: ${services.join(', ')}`);
});

module.exports = app;