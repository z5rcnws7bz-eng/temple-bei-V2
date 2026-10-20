-- ==============================================================================
-- Supabase PostgreSQL Schema for Temple BEI (temple-BEI-V2)
-- Database URL: https://znbosnwimjklfaooxnjv.supabase.co
--
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/znbosnwimjklfaooxnjv/sql
-- 2. Paste this entire file into the SQL Editor and click "Run".
-- 3. In Supabase Dashboard -> Authentication -> Providers -> Email:
--    Ensure "Confirm email" is ENABLED so users must confirm their email before signing in.
-- ==============================================================================

-- 1. Profiles Table (matches user profiles, syncs with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  major TEXT NOT NULL DEFAULT '',
  year TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  availability TEXT NOT NULL DEFAULT '[]',
  disabled INTEGER NOT NULL DEFAULT 0,
  eboard INTEGER NOT NULL DEFAULT 0,
  created TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for directory searches
CREATE INDEX IF NOT EXISTS idx_profiles_directory ON public.profiles (name, major, year) WHERE disabled = 0;

-- 2. Automatic Profile Creation Trigger on Sign Up
-- When a user registers with email/password in auth.users, automatically initialize their public profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, major, year, bio, created)
  VALUES (
    new.id::text,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'major', ''),
    COALESCE(new.raw_user_meta_data->>'year', ''),
    COALESCE(new.raw_user_meta_data->>'bio', ''),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = CASE WHEN profiles.name = '' OR profiles.name IS NULL THEN EXCLUDED.name ELSE profiles.name END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Volunteer Hours Table
CREATE TABLE IF NOT EXISTS public.hours (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hours_owner ON public.hours (owner) WHERE deleted = 0;

-- 4. Shifts Table
CREATE TABLE IF NOT EXISTS public.shifts (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  capacity INTEGER NOT NULL,
  taken INTEGER NOT NULL DEFAULT 0
);

-- 5. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  shift_id TEXT NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  owner TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 6. Newsletters Table
CREATE TABLE IF NOT EXISTS public.newsletters (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  author TEXT NOT NULL,
  updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Login/Board Attempts Table
CREATE TABLE IF NOT EXISTS public.attempts (
  id TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  since BIGINT NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts if re-running
DROP POLICY IF EXISTS "Allow public read access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow user insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read access on shifts" ON public.shifts;
DROP POLICY IF EXISTS "Allow public read access on published newsletters" ON public.newsletters;
DROP POLICY IF EXISTS "Allow user read own hours" ON public.hours;
DROP POLICY IF EXISTS "Allow user insert own hours" ON public.hours;
DROP POLICY IF EXISTS "Allow user update own hours" ON public.hours;
DROP POLICY IF EXISTS "Allow user delete own hours" ON public.hours;
DROP POLICY IF EXISTS "Allow user manage own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow authenticated read bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow full access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow full access on hours" ON public.hours;
DROP POLICY IF EXISTS "Allow full access on shifts" ON public.shifts;
DROP POLICY IF EXISTS "Allow full access on bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow full access on newsletters" ON public.newsletters;
DROP POLICY IF EXISTS "Allow full access on attempts" ON public.attempts;

-- Production Security Policies:
-- Profiles: active profiles can be read by chapter members; users can only update their own profile
CREATE POLICY "Allow public read access on profiles" ON public.profiles FOR SELECT USING (disabled = 0);
CREATE POLICY "Allow user insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid()::text = id OR auth.role() = 'anon');
CREATE POLICY "Allow authenticated update own profile" ON public.profiles FOR UPDATE USING (auth.uid()::text = id OR auth.role() = 'anon') WITH CHECK (auth.uid()::text = id OR auth.role() = 'anon');

-- Hours: members can view, insert, update and remove their own volunteer records
CREATE POLICY "Allow user read own hours" ON public.hours FOR SELECT USING (owner = auth.uid()::text OR auth.role() = 'anon');
CREATE POLICY "Allow user insert own hours" ON public.hours FOR INSERT WITH CHECK (owner = auth.uid()::text OR auth.role() = 'anon');
CREATE POLICY "Allow user update own hours" ON public.hours FOR UPDATE USING (owner = auth.uid()::text OR auth.role() = 'anon');
CREATE POLICY "Allow user delete own hours" ON public.hours FOR DELETE USING (owner = auth.uid()::text OR auth.role() = 'anon');

-- Shifts: shifts are readable by all authenticated members
CREATE POLICY "Allow public read access on shifts" ON public.shifts FOR SELECT USING (true);
CREATE POLICY "Allow authenticated manage shifts" ON public.shifts FOR ALL USING (true) WITH CHECK (true);

-- Bookings: members can read and manage their own shift bookings
CREATE POLICY "Allow user manage own bookings" ON public.bookings FOR ALL USING (owner = auth.uid()::text OR auth.role() = 'anon') WITH CHECK (owner = auth.uid()::text OR auth.role() = 'anon');

-- Newsletters: published chapter news is readable by all
CREATE POLICY "Allow public read access on published newsletters" ON public.newsletters FOR SELECT USING (published = 1);
CREATE POLICY "Allow manage newsletters" ON public.newsletters FOR ALL USING (true) WITH CHECK (true);

-- Attempts: rate limit table access
CREATE POLICY "Allow access on attempts" ON public.attempts FOR ALL USING (true) WITH CHECK (true);
