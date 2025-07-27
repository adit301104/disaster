-- Temporarily disable RLS for testing
-- Run this in your Supabase SQL editor to allow the backend to work

-- Disable RLS on all tables temporarily
ALTER TABLE disasters DISABLE ROW LEVEL SECURITY;
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE resources DISABLE ROW LEVEL SECURITY;
ALTER TABLE cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE social_media_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE official_updates DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log DISABLE ROW LEVEL SECURITY;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'RLS temporarily disabled for testing. Remember to re-enable it for production!';
END $$;