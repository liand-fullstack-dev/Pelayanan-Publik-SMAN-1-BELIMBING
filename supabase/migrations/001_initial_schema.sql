-- Migration: Initial schema for SMAN 1 Belimbing Appointment System
-- Created: 2026-06-29
-- Security: Row Level Security enabled, anti-injection via parameterized queries

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: appointments
-- ============================================
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nomor_antrian TEXT NOT NULL UNIQUE,
    nama_lengkap TEXT NOT NULL,
    nomor_wa TEXT NOT NULL,
    instansi TEXT,
    tujuan_bertemu TEXT NOT NULL,
    keperluan TEXT NOT NULL,
    tanggal DATE NOT NULL,
    jam TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'Menunggu Konfirmasi' 
        CHECK (status IN ('Menunggu Konfirmasi', 'Dikonfirmasi', 'Selesai', 'Dibatalkan')),
    dokumen_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_tanggal ON public.appointments(tanggal);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON public.appointments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_nomor_antrian ON public.appointments(nomor_antrian);

-- ============================================
-- TABLE: admin_sessions (for login tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_token TEXT NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON public.admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON public.admin_sessions(expires_at);

-- ============================================
-- TABLE: rate_limit_logs (for rate limiting)
-- ============================================
CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_address INET NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_endpoint ON public.rate_limit_logs(ip_address, endpoint, timestamp DESC);

-- ============================================
-- TABLE: activity_logs (audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Appointments: Allow all read (public), insert (public), update/delete (admin only via service role)
CREATE POLICY "Allow public read appointments" 
    ON public.appointments FOR SELECT USING (true);

CREATE POLICY "Allow public insert appointments" 
    ON public.appointments FOR INSERT WITH CHECK (true);

-- Admin sessions: Only service role can manage
CREATE POLICY "Service role manages sessions" 
    ON public.admin_sessions FOR ALL USING (false);

-- Rate limit logs: Only service role
CREATE POLICY "Service role manages rate limits" 
    ON public.rate_limit_logs FOR ALL USING (false);

-- Activity logs: Only service role
CREATE POLICY "Service role manages activity logs" 
    ON public.activity_logs FOR ALL USING (false);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Generate queue number
CREATE OR REPLACE FUNCTION public.generate_queue_number(p_tanggal DATE)
RETURNS TEXT AS $$
DECLARE
    v_count INTEGER;
    v_prefix TEXT;
    v_number TEXT;
BEGIN
    -- Count existing appointments for this date
    SELECT COUNT(*) INTO v_count 
    FROM public.appointments 
    WHERE tanggal = p_tanggal;

    -- Generate prefix based on date (A-Z cycling)
    v_prefix := CHR(65 + (v_count / 999)::INTEGER % 26);

    -- Format: A-001, A-002, etc.
    v_number := v_prefix || '-' || LPAD(((v_count % 999) + 1)::TEXT, 3, '0');

    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Clean expired sessions
CREATE OR REPLACE FUNCTION public.clean_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM public.admin_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- REALTIME SETUP
-- ============================================
-- Enable realtime for appointments table
BEGIN;
  -- Add table to publication (if not already)
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'appointments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
    END IF;
  END $$;
COMMIT;

COMMENT ON TABLE public.appointments IS 'Stores all appointment requests with RLS protection';
COMMENT ON TABLE public.admin_sessions IS 'Admin session tokens with expiry';
COMMENT ON TABLE public.rate_limit_logs IS 'Rate limiting tracking per IP';
COMMENT ON TABLE public.activity_logs IS 'Audit trail for admin actions';

