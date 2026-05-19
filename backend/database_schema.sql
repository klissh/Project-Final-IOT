-- ===== AUTH (built-in Supabase, tidak perlu dibuat manual) =====
-- auth.users

-- ===== PROFILES (siapkan untuk multi-role di masa depan) =====
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',  -- 'admin' | 'supervisor' | 'viewer'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== VIOLATIONS (log semua pelanggaran) =====
CREATE TABLE violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  violation_type TEXT NOT NULL,        -- 'no_mask' | 'no_hairnet' | 'no_both' | 'left_post'
  confidence FLOAT,                    -- skor AI saat deteksi
  screenshot_url TEXT,                 -- URL ke Supabase Storage bucket
  camera_index INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',  -- 'new' | 'reviewed' | 'false_positive'
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT
);
CREATE INDEX idx_violations_timestamp ON violations(timestamp DESC);
CREATE INDEX idx_violations_status ON violations(status);
CREATE INDEX idx_violations_type ON violations(violation_type);

-- ===== ROI CONFIG (mendukung multi-kamera di masa depan) =====
CREATE TABLE roi_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_index INT NOT NULL,
  roi_points JSONB NOT NULL,           -- [[x1,y1],[x2,y2],...] polygon points
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- ===== SYSTEM SETTINGS (single row config) =====
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_hours_start TIME DEFAULT '07:00:00',
  operating_hours_end TIME DEFAULT '22:00:00',
  telegram_enabled BOOLEAN DEFAULT TRUE,
  telegram_bot_token TEXT,
  buzzer_enabled BOOLEAN DEFAULT TRUE,
  buzzer_duration_ms INT DEFAULT 2000,
  dfplayer_track INT DEFAULT 1,
  active_camera_index INT DEFAULT 0,
  confidence_threshold FLOAT DEFAULT 0.4,
  iou_threshold FLOAT DEFAULT 0.3,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Insert satu row default saat setup awal.
INSERT INTO system_settings (operating_hours_start, operating_hours_end) VALUES ('07:00:00', '22:00:00');

-- ===== TELEGRAM RECIPIENTS (multiple supervisor) =====
CREATE TABLE telegram_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL,
  label TEXT,                          -- 'Supervisor Pagi', 'Owner', dll
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== SYSTEM HEARTBEAT (status komponen real-time) =====
CREATE TABLE system_heartbeat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component TEXT UNIQUE NOT NULL,      -- 'python_engine' | 'esp32'
  last_ping TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,                -- 'online' | 'offline' | 'error'
  metadata JSONB                       -- info tambahan (FPS, error msg, dll)
);

-- Untuk MVP (1 admin), aktifkan RLS dengan rule sederhana:
-- "Authenticated user bisa read/write semua tabel"
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON violations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE roi_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON roi_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON system_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE telegram_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON telegram_recipients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE system_heartbeat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON system_heartbeat
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
