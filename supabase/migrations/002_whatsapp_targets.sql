-- Migration 002: WhatsApp Targets & Admin Settings
-- Created: 2026-07-01
-- Adds: whatsapp_targets, admin_settings, full-text search index, composite indexes

-- ============================================
-- TABLE: whatsapp_targets
-- Nomor WA per tujuan (dikelola admin)
-- ============================================
CREATE TABLE IF NOT EXISTS public.whatsapp_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role TEXT NOT NULL UNIQUE,
    phone_number TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_targets_role ON public.whatsapp_targets(role);

ALTER TABLE public.whatsapp_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read whatsapp_targets"
    ON public.whatsapp_targets FOR SELECT USING (true);
CREATE POLICY "Service role manages whatsapp_targets"
    ON public.whatsapp_targets FOR ALL USING (
        current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role'
    );

-- Seed default targets (gunakan nomor sekolah sebagai default)
INSERT INTO public.whatsapp_targets (role, phone_number) VALUES
    ('Kepala Sekolah',        '6282382734762'),
    ('Wakil Kepala Sekolah',  '6282382734762'),
    ('Kepala Kurikulum',      '6282382734762'),
    ('Guru BK',               '6282382734762'),
    ('Wali Kelas',            '6282382734762'),
    ('Guru Mata Pelajaran',   '6282382734762'),
    ('Tata Usaha',            '6282382734762'),
    ('Bendahara',             '6282382734762'),
    ('Operator Sekolah',      '6282382734762'),
    ('Komite Sekolah',        '6282382734762'),
    ('Lainnya',               '6282382734762')
ON CONFLICT (role) DO NOTHING;

-- ============================================
-- TABLE: admin_settings
-- Konfigurasi admin (WA API, password hash, dll)
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON public.admin_settings(key);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages admin_settings"
    ON public.admin_settings FOR ALL USING (
        current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role'
    );

-- Seed default settings
INSERT INTO public.admin_settings (key, value, description) VALUES
    ('wa_api_key',         'fsk_live_123456789',  'API Key untuk FullStackNotes WhatsApp API'),
    ('wa_session_id',      'ses_xxxxxxxx',         'Session ID WhatsApp yang aktif'),
    ('wa_default_number',  '6282382734762',         'Nomor WA fallback sekolah (format: 628xxx)'),
    ('admin_password',     'SMANSABEL_Jaya',        'Password admin (akan di-hash setelah reset pertama)'),
    ('admin_username',     'SMANSABEL_7',           'Username admin')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- INDEXES TAMBAHAN untuk performa
-- ============================================
CREATE INDEX IF NOT EXISTS idx_appointments_tujuan
    ON public.appointments(tujuan_bertemu);

CREATE INDEX IF NOT EXISTS idx_appointments_nama
    ON public.appointments(nama_lengkap);

CREATE INDEX IF NOT EXISTS idx_appointments_week
    ON public.appointments(tanggal, status)
    WHERE status != 'Dibatalkan';

-- Composite index for date+status queries (laporan harian/mingguan/bulanan)
CREATE INDEX IF NOT EXISTS idx_appointments_stats
    ON public.appointments(status, tanggal, created_at);

-- ============================================
-- VIEW: appointment_stats_daily (laporan harian)
-- ============================================
CREATE OR REPLACE VIEW public.v_daily_stats AS
SELECT
    tanggal,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'Menunggu Konfirmasi') AS menunggu,
    COUNT(*) FILTER (WHERE status = 'Dikonfirmasi')       AS dikonfirmasi,
    COUNT(*) FILTER (WHERE status = 'Selesai')             AS selesai,
    COUNT(*) FILTER (WHERE status = 'Dibatalkan')          AS dibatalkan
FROM public.appointments
GROUP BY tanggal
ORDER BY tanggal DESC;

-- ============================================
-- FUNCTION: generate_weekly_report
-- ============================================
CREATE OR REPLACE FUNCTION public.get_period_report(
    p_start DATE,
    p_end   DATE
)
RETURNS TABLE (
    tanggal       DATE,
    nomor_antrian TEXT,
    nama_lengkap  TEXT,
    nomor_wa      TEXT,
    instansi      TEXT,
    tujuan_bertemu TEXT,
    keperluan     TEXT,
    jam           TIME,
    status        TEXT,
    created_at    TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.tanggal, a.nomor_antrian, a.nama_lengkap, a.nomor_wa,
        COALESCE(a.instansi, '-'), a.tujuan_bertemu, a.keperluan,
        a.jam, a.status, a.created_at
    FROM public.appointments a
    WHERE a.tanggal BETWEEN p_start AND p_end
    ORDER BY a.tanggal ASC, a.jam ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update updated_at for whatsapp_targets & admin_settings
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whatsapp_targets_updated_at
    BEFORE UPDATE ON public.whatsapp_targets
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER admin_settings_updated_at
    BEFORE UPDATE ON public.admin_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

