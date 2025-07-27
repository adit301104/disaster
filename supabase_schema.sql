-- Disaster Response Application - Complete Supabase PostgreSQL Schema
-- This file contains all the necessary tables, functions, and policies for the disaster response app

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create custom types
CREATE TYPE disaster_status AS ENUM ('active', 'resolved', 'monitoring', 'archived');
CREATE TYPE disaster_type AS ENUM ('flood', 'earthquake', 'hurricane', 'wildfire', 'tornado', 'tsunami', 'volcanic', 'drought', 'blizzard', 'other');
CREATE TYPE report_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE verification_status AS ENUM ('pending', 'authentic', 'suspicious', 'fake', 'verification_failed');
CREATE TYPE resource_type AS ENUM ('food', 'water', 'shelter', 'medical', 'transportation', 'clothing', 'tools', 'communication', 'fuel', 'other');
CREATE TYPE availability_status AS ENUM ('available', 'reserved', 'distributed', 'unavailable');
CREATE TYPE user_role AS ENUM ('admin', 'contributor', 'viewer');

-- =============================================
-- MAIN TABLES
-- =============================================

-- Disasters table - Main entity for disaster events
CREATE TABLE disasters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location_name VARCHAR(255),
    location GEOMETRY(POINT, 4326), -- PostGIS point for geographic coordinates
    location_details JSONB, -- Store geocoding details (formatted_address, source, etc.)
    disaster_type disaster_type NOT NULL DEFAULT 'other',
    status disaster_status NOT NULL DEFAULT 'active',
    tags TEXT[] DEFAULT '{}', -- Array of tags for categorization
    owner_id VARCHAR(100) NOT NULL, -- User who created the disaster
    audit_trail JSONB DEFAULT '[]', -- Track all changes
    metadata JSONB DEFAULT '{}', -- Additional flexible data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports table - User-submitted reports for disasters
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disaster_id UUID NOT NULL REFERENCES disasters(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    location GEOMETRY(POINT, 4326),
    location_name VARCHAR(255),
    resource_needs TEXT[] DEFAULT '{}',
    severity report_severity DEFAULT 'medium',
    verification_status verification_status DEFAULT 'pending',
    verification_details JSONB,
    verified_at TIMESTAMPTZ,
    verified_by VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resources table - Available resources for disaster response
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disaster_id UUID NOT NULL REFERENCES disasters(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    resource_type resource_type NOT NULL,
    quantity INTEGER DEFAULT 1,
    location GEOMETRY(POINT, 4326),
    location_name VARCHAR(255),
    contact_info JSONB, -- Phone, email, address, etc.
    availability_status availability_status DEFAULT 'available',
    created_by VARCHAR(100) NOT NULL,
    allocated_to VARCHAR(100), -- User who reserved/received the resource
    allocated_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cache table - For caching external API responses
CREATE TABLE cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(500) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social media data table - Store fetched social media posts
CREATE TABLE social_media_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disaster_id UUID NOT NULL REFERENCES disasters(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'twitter', 'bluesky', 'mock', etc.
    post_id VARCHAR(255), -- External post ID
    content TEXT NOT NULL,
    author VARCHAR(255),
    author_handle VARCHAR(255),
    engagement_data JSONB, -- likes, retweets, replies, etc.
    post_url TEXT,
    posted_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Official updates table - Store official disaster updates
CREATE TABLE official_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disaster_id UUID NOT NULL REFERENCES disasters(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL, -- 'FEMA', 'Red Cross', etc.
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    url TEXT,
    published_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- User activity log table - Track user actions
CREATE TABLE user_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50), -- 'disaster', 'report', 'resource'
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Disasters indexes
CREATE INDEX idx_disasters_status ON disasters(status);
CREATE INDEX idx_disasters_type ON disasters(disaster_type);
CREATE INDEX idx_disasters_created_at ON disasters(created_at DESC);
CREATE INDEX idx_disasters_location ON disasters USING GIST(location);
CREATE INDEX idx_disasters_tags ON disasters USING GIN(tags);
CREATE INDEX idx_disasters_owner ON disasters(owner_id);

-- Reports indexes
CREATE INDEX idx_reports_disaster_id ON reports(disaster_id);
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_severity ON reports(severity);
CREATE INDEX idx_reports_verification_status ON reports(verification_status);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_reports_location ON reports USING GIST(location);

-- Resources indexes
CREATE INDEX idx_resources_disaster_id ON resources(disaster_id);
CREATE INDEX idx_resources_type ON resources(resource_type);
CREATE INDEX idx_resources_status ON resources(availability_status);
CREATE INDEX idx_resources_created_by ON resources(created_by);
CREATE INDEX idx_resources_location ON resources USING GIST(location);
CREATE INDEX idx_resources_created_at ON resources(created_at DESC);

-- Cache indexes
CREATE INDEX idx_cache_key ON cache(key);
CREATE INDEX idx_cache_expires_at ON cache(expires_at);

-- Social media indexes
CREATE INDEX idx_social_media_disaster_id ON social_media_posts(disaster_id);
CREATE INDEX idx_social_media_platform ON social_media_posts(platform);
CREATE INDEX idx_social_media_posted_at ON social_media_posts(posted_at DESC);

-- Official updates indexes
CREATE INDEX idx_official_updates_disaster_id ON official_updates(disaster_id);
CREATE INDEX idx_official_updates_source ON official_updates(source);
CREATE INDEX idx_official_updates_published_at ON official_updates(published_at DESC);

-- User activity indexes
CREATE INDEX idx_user_activity_user_id ON user_activity_log(user_id);
CREATE INDEX idx_user_activity_action ON user_activity_log(action);
CREATE INDEX idx_user_activity_created_at ON user_activity_log(created_at DESC);

-- =============================================
-- FUNCTIONS FOR GEOGRAPHIC QUERIES
-- =============================================

-- Function to find disasters near a point
CREATE OR REPLACE FUNCTION disasters_near_point(
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    radius_meters INTEGER DEFAULT 10000
)
RETURNS TABLE(
    id UUID,
    title VARCHAR(255),
    description TEXT,
    location_name VARCHAR(255),
    location GEOMETRY(POINT, 4326),
    location_details JSONB,
    disaster_type disaster_type,
    status disaster_status,
    tags TEXT[],
    owner_id VARCHAR(100),
    audit_trail JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    distance_meters DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
AS $$
    SELECT 
        d.*,
        ST_Distance(
            d.location::geography,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        ) as distance_meters
    FROM disasters d
    WHERE d.location IS NOT NULL
    AND ST_DWithin(
        d.location::geography,
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        radius_meters
    )
    ORDER BY distance_meters;
$$;

-- Function to find resources near a point
CREATE OR REPLACE FUNCTION resources_near_point(
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    radius_meters INTEGER DEFAULT 10000
)
RETURNS TABLE(
    id UUID,
    disaster_id UUID,
    name VARCHAR(255),
    description TEXT,
    resource_type resource_type,
    quantity INTEGER,
    location GEOMETRY(POINT, 4326),
    location_name VARCHAR(255),
    contact_info JSONB,
    availability_status availability_status,
    created_by VARCHAR(100),
    allocated_to VARCHAR(100),
    allocated_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    distance_meters DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
AS $$
    SELECT 
        r.*,
        ST_Distance(
            r.location::geography,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        ) as distance_meters
    FROM resources r
    WHERE r.location IS NOT NULL
    AND ST_DWithin(
        r.location::geography,
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        radius_meters
    )
    ORDER BY distance_meters;
$$;

-- Function to find reports near a point
CREATE OR REPLACE FUNCTION reports_near_point(
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    radius_meters INTEGER DEFAULT 10000
)
RETURNS TABLE(
    id UUID,
    disaster_id UUID,
    user_id VARCHAR(100),
    content TEXT,
    image_url TEXT,
    location GEOMETRY(POINT, 4326),
    location_name VARCHAR(255),
    resource_needs TEXT[],
    severity report_severity,
    verification_status verification_status,
    verification_details JSONB,
    verified_at TIMESTAMPTZ,
    verified_by VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    distance_meters DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
AS $$
    SELECT 
        r.*,
        ST_Distance(
            r.location::geography,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        ) as distance_meters
    FROM reports r
    WHERE r.location IS NOT NULL
    AND ST_DWithin(
        r.location::geography,
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        radius_meters
    )
    ORDER BY distance_meters;
$$;

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER
LANGUAGE SQL
AS $$
    DELETE FROM cache WHERE expires_at < NOW();
    SELECT ROW_COUNT();
$$;

-- Function to get disaster statistics
CREATE OR REPLACE FUNCTION get_disaster_statistics(disaster_uuid UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
    SELECT jsonb_build_object(
        'disaster_id', disaster_uuid,
        'total_reports', (SELECT COUNT(*) FROM reports WHERE disaster_id = disaster_uuid),
        'verified_reports', (SELECT COUNT(*) FROM reports WHERE disaster_id = disaster_uuid AND verification_status = 'authentic'),
        'pending_reports', (SELECT COUNT(*) FROM reports WHERE disaster_id = disaster_uuid AND verification_status = 'pending'),
        'total_resources', (SELECT COUNT(*) FROM resources WHERE disaster_id = disaster_uuid),
        'available_resources', (SELECT COUNT(*) FROM resources WHERE disaster_id = disaster_uuid AND availability_status = 'available'),
        'severity_distribution', (
            SELECT jsonb_object_agg(severity, count)
            FROM (
                SELECT severity, COUNT(*) as count
                FROM reports 
                WHERE disaster_id = disaster_uuid
                GROUP BY severity
            ) severity_counts
        ),
        'resource_type_distribution', (
            SELECT jsonb_object_agg(resource_type, count)
            FROM (
                SELECT resource_type, COUNT(*) as count
                FROM resources 
                WHERE disaster_id = disaster_uuid
                GROUP BY resource_type
            ) resource_counts
        )
    );
$$;

-- =============================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to relevant tables
CREATE TRIGGER update_disasters_updated_at BEFORE UPDATE ON disasters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE disasters ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_media_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE official_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- Disasters policies
CREATE POLICY "Disasters are viewable by everyone" ON disasters
    FOR SELECT USING (true);

CREATE POLICY "Users can create disasters" ON disasters
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own disasters or admins can update any" ON disasters
    FOR UPDATE USING (
        owner_id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
    );

CREATE POLICY "Users can delete their own disasters or admins can delete any" ON disasters
    FOR DELETE USING (
        owner_id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
    );

-- Reports policies
CREATE POLICY "Reports are viewable by everyone" ON reports
    FOR SELECT USING (true);

CREATE POLICY "Users can create reports" ON reports
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own reports or admins can update any" ON reports
    FOR UPDATE USING (
        user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
    );

CREATE POLICY "Users can delete their own reports or admins can delete any" ON reports
    FOR DELETE USING (
        user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
    );

-- Resources policies
CREATE POLICY "Resources are viewable by everyone" ON resources
    FOR SELECT USING (true);

CREATE POLICY "Users can create resources" ON resources
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own resources or admins can update any" ON resources
    FOR UPDATE USING (
        created_by = current_setting('request.jwt.claims', true)::json->>'sub'
        OR current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
    );

CREATE POLICY "Users can delete their own resources or admins can delete any" ON resources
    FOR DELETE USING (
        created_by = current_setting('request.jwt.claims', true)::json->>'sub'
        OR current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
    );

-- Cache policies (admin only for direct access)
CREATE POLICY "Cache is accessible by admins only" ON cache
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
    );

-- Social media posts policies
CREATE POLICY "Social media posts are viewable by everyone" ON social_media_posts
    FOR SELECT USING (true);

CREATE POLICY "Only admins can manage social media posts" ON social_media_posts
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
    );

-- Official updates policies
CREATE POLICY "Official updates are viewable by everyone" ON official_updates
    FOR SELECT USING (true);

CREATE POLICY "Only admins can manage official updates" ON official_updates
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
    );

-- User activity log policies
CREATE POLICY "Users can view their own activity" ON user_activity_log
    FOR SELECT USING (
        user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
    );

CREATE POLICY "Activity logs can be created by anyone" ON user_activity_log
    FOR INSERT WITH CHECK (true);

-- =============================================
-- SAMPLE DATA FOR TESTING
-- =============================================

-- Insert sample disasters
INSERT INTO disasters (title, description, location_name, location, disaster_type, status, tags, owner_id) VALUES
(
    'Hurricane Milton Aftermath',
    'Category 4 hurricane caused widespread flooding and power outages across central Florida',
    'Tampa, FL',
    ST_SetSRID(ST_MakePoint(-82.4572, 27.9506), 4326),
    'hurricane',
    'active',
    ARRAY['hurricane', 'flooding', 'power-outage', 'evacuation'],
    'netrunnerX'
),
(
    'California Wildfire Emergency',
    'Fast-moving wildfire threatening residential areas in Riverside County',
    'Riverside, CA',
    ST_SetSRID(ST_MakePoint(-117.3961, 33.9533), 4326),
    'wildfire',
    'active',
    ARRAY['wildfire', 'evacuation', 'air-quality'],
    'reliefAdmin'
),
(
    'Midwest Tornado Outbreak',
    'Multiple tornadoes reported across Oklahoma and Kansas',
    'Oklahoma City, OK',
    ST_SetSRID(ST_MakePoint(-97.5164, 35.4676), 4326),
    'tornado',
    'monitoring',
    ARRAY['tornado', 'severe-weather', 'damage-assessment'],
    'citizen1'
);

-- Insert sample reports
INSERT INTO reports (disaster_id, user_id, content, severity, resource_needs) VALUES
(
    (SELECT id FROM disasters WHERE title = 'Hurricane Milton Aftermath'),
    'citizen1',
    'Severe flooding on Main Street, water level approximately 3 feet. Several cars stranded.',
    'high',
    ARRAY['water pumps', 'rescue boats', 'emergency shelter']
),
(
    (SELECT id FROM disasters WHERE title = 'California Wildfire Emergency'),
    'netrunnerX',
    'Smoke visible from Highway 91. Air quality very poor, recommend N95 masks.',
    'medium',
    ARRAY['air masks', 'water', 'evacuation transport']
);

-- Insert sample resources
INSERT INTO resources (disaster_id, name, resource_type, quantity, location_name, contact_info, created_by) VALUES
(
    (SELECT id FROM disasters WHERE title = 'Hurricane Milton Aftermath'),
    'Emergency Shelter - Community Center',
    'shelter',
    200,
    'Tampa Community Center, FL',
    '{"phone": "+1-813-555-0123", "email": "shelter@tampacommunity.org"}',
    'reliefAdmin'
),
(
    (SELECT id FROM disasters WHERE title = 'California Wildfire Emergency'),
    'Water Distribution Point',
    'water',
    1000,
    'Riverside Fire Station #1',
    '{"phone": "+1-951-555-0456", "address": "123 Fire Station Rd, Riverside, CA"}',
    'netrunnerX'
);

-- =============================================
-- VIEWS FOR COMMON QUERIES
-- =============================================

-- View for disaster summary with statistics
CREATE VIEW disaster_summary AS
SELECT 
    d.*,
    (SELECT COUNT(*) FROM reports r WHERE r.disaster_id = d.id) as total_reports,
    (SELECT COUNT(*) FROM reports r WHERE r.disaster_id = d.id AND r.verification_status = 'authentic') as verified_reports,
    (SELECT COUNT(*) FROM resources res WHERE res.disaster_id = d.id) as total_resources,
    (SELECT COUNT(*) FROM resources res WHERE res.disaster_id = d.id AND res.availability_status = 'available') as available_resources
FROM disasters d;

-- View for recent activity
CREATE VIEW recent_activity AS
SELECT 
    'disaster' as type,
    d.id,
    d.title as title,
    d.owner_id as user_id,
    d.created_at,
    d.location_name
FROM disasters d
WHERE d.created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 
    'report' as type,
    r.id,
    LEFT(r.content, 100) as title,
    r.user_id,
    r.created_at,
    r.location_name
FROM reports r
WHERE r.created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 
    'resource' as type,
    res.id,
    res.name as title,
    res.created_by as user_id,
    res.created_at,
    res.location_name
FROM resources res
WHERE res.created_at > NOW() - INTERVAL '7 days'

ORDER BY created_at DESC;

-- =============================================
-- SCHEDULED FUNCTIONS (for cron jobs)
-- =============================================

-- Function to archive old disasters
CREATE OR REPLACE FUNCTION archive_old_disasters()
RETURNS INTEGER
LANGUAGE SQL
AS $$
    UPDATE disasters 
    SET status = 'archived'
    WHERE status = 'resolved' 
    AND updated_at < NOW() - INTERVAL '90 days';
    
    SELECT ROW_COUNT();
$$;

-- Function to clean old cache entries (run this periodically)
CREATE OR REPLACE FUNCTION cleanup_old_cache()
RETURNS INTEGER
LANGUAGE SQL
AS $$
    DELETE FROM cache WHERE expires_at < NOW();
    SELECT ROW_COUNT();
$$;

-- Function to clean old social media posts (keep only last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_social_media()
RETURNS INTEGER
LANGUAGE SQL
AS $$
    DELETE FROM social_media_posts WHERE fetched_at < NOW() - INTERVAL '30 days';
    SELECT ROW_COUNT();
$$;

-- =============================================
-- FINAL SETUP COMMANDS
-- =============================================

-- Grant necessary permissions (adjust as needed for your Supabase setup)
-- These might need to be adjusted based on your Supabase configuration

-- Create indexes for full-text search
CREATE INDEX idx_disasters_title_search ON disasters USING gin(to_tsvector('english', title));
CREATE INDEX idx_disasters_description_search ON disasters USING gin(to_tsvector('english', description));
CREATE INDEX idx_reports_content_search ON reports USING gin(to_tsvector('english', content));

-- Add constraints for data integrity
ALTER TABLE disasters ADD CONSTRAINT check_location_with_name 
    CHECK ((location IS NULL AND location_name IS NULL) OR (location IS NOT NULL OR location_name IS NOT NULL));

ALTER TABLE resources ADD CONSTRAINT check_positive_quantity 
    CHECK (quantity > 0);

-- Add comments for documentation
COMMENT ON TABLE disasters IS 'Main table storing disaster events and their details';
COMMENT ON TABLE reports IS 'User-submitted reports related to disasters';
COMMENT ON TABLE resources IS 'Available resources for disaster response';
COMMENT ON TABLE cache IS 'Cache table for external API responses';
COMMENT ON TABLE social_media_posts IS 'Social media posts fetched for disasters';
COMMENT ON TABLE official_updates IS 'Official updates from government and relief organizations';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Disaster Response Database Schema Setup Complete!';
    RAISE NOTICE 'Tables created: disasters, reports, resources, cache, social_media_posts, official_updates, user_activity_log';
    RAISE NOTICE 'Functions created: disasters_near_point, resources_near_point, reports_near_point, get_disaster_statistics';
    RAISE NOTICE 'Views created: disaster_summary, recent_activity';
    RAISE NOTICE 'Sample data inserted for testing';
END $$;