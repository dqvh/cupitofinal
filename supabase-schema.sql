-- =================================================================
-- CUPITO: Esquema de Tablas para Supabase
-- Copiá este script y pegalo en Supabase -> SQL Editor -> New query -> RUN
-- =================================================================

-- 1. Tabla de Usuarios y Negocios
CREATE TABLE IF NOT EXISTS cupito_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  business TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'semilla',
  created_at BIGINT,
  subscription JSONB
);

-- 2. Tabla de Datos de Negocio (servicios, horarios, reservas, reseñas, cupones)
CREATE TABLE IF NOT EXISTS cupito_data (
  user_id TEXT PRIMARY KEY REFERENCES cupito_users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_at BIGINT
);

-- 3. Índices para búsquedas ultra rápidas de URLs públicas desde el celular
CREATE INDEX IF NOT EXISTS idx_cupito_users_slug ON cupito_users (slug);
CREATE INDEX IF NOT EXISTS idx_cupito_users_email ON cupito_users (email);

-- 4. Habilitar Row Level Security (RLS) con políticas de acceso para la aplicación
ALTER TABLE cupito_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupito_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica de usuarios" ON cupito_users;
CREATE POLICY "Permitir lectura publica de usuarios" ON cupito_users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escritura publica de usuarios" ON cupito_users;
CREATE POLICY "Permitir escritura publica de usuarios" ON cupito_users FOR ALL USING (true);

DROP POLICY IF EXISTS "Permitir lectura publica de datos" ON cupito_data;
CREATE POLICY "Permitir lectura publica de datos" ON cupito_data FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escritura publica de datos" ON cupito_data;
CREATE POLICY "Permitir escritura publica de datos" ON cupito_data FOR ALL USING (true);

-- Listo! Tus tablas están creadas y listas para sincronizar en tiempo real.
