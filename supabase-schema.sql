-- =================================================================
-- CUPITO: Esquema de Tablas para Supabase
-- Pegalo en Supabase -> SQL Editor -> New query -> RUN.
-- Es seguro correrlo de nuevo: solo agrega lo que falte (migración incluida).
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
  subscription JSONB,
  deleted BOOLEAN DEFAULT FALSE
);
-- Migración para bases ya creadas:
ALTER TABLE cupito_users ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- 2. Tabla de Datos de Negocio (servicios, horarios, reservas, reseñas, cupones)
CREATE TABLE IF NOT EXISTS cupito_data (
  user_id TEXT PRIMARY KEY REFERENCES cupito_users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_at BIGINT,
  deleted BOOLEAN DEFAULT FALSE
);
-- Migración para bases ya creadas:
ALTER TABLE cupito_data ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- 3. Índices para búsquedas ultra rápidas de URLs públicas desde el celular
CREATE INDEX IF NOT EXISTS idx_cupito_users_slug ON cupito_users (slug);
CREATE INDEX IF NOT EXISTS idx_cupito_users_email ON cupito_users (email);

-- 4. Limpieza: la cuenta demo nunca debe vivir en producción
DELETE FROM cupito_data WHERE user_id IN (SELECT id FROM cupito_users WHERE email = 'demo@cupito.app');
DELETE FROM cupito_users WHERE email = 'demo@cupito.app';

-- 5. Row Level Security: la app usa la key pública (anon), SIN login de Supabase.
--    Para que nadie pueda vaciar la base desde la consola del navegador:
--    - SELECT: solo filas no borradas (las páginas públicas lo necesitan).
--    - INSERT / UPDATE: permitidos (registro, reservas y sync los necesitan).
--    - DELETE: NO hay política => denegado para anon. Borrar = marcar deleted=true.
ALTER TABLE cupito_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupito_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica de usuarios" ON cupito_users;
DROP POLICY IF EXISTS "Permitir escritura publica de usuarios" ON cupito_users;
DROP POLICY IF EXISTS "users_select_not_deleted" ON cupito_users;
DROP POLICY IF EXISTS "users_insert" ON cupito_users;
DROP POLICY IF EXISTS "users_update" ON cupito_users;

CREATE POLICY "users_select_not_deleted" ON cupito_users
  FOR SELECT USING (COALESCE(deleted, FALSE) = FALSE);
CREATE POLICY "users_insert" ON cupito_users
  FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON cupito_users
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura publica de datos" ON cupito_data;
DROP POLICY IF EXISTS "Permitir escritura publica de datos" ON cupito_data;
DROP POLICY IF EXISTS "data_select_not_deleted" ON cupito_data;
DROP POLICY IF EXISTS "data_insert" ON cupito_data;
DROP POLICY IF EXISTS "data_update" ON cupito_data;

CREATE POLICY "data_select_not_deleted" ON cupito_data
  FOR SELECT USING (COALESCE(deleted, FALSE) = FALSE);
CREATE POLICY "data_insert" ON cupito_data
  FOR INSERT WITH CHECK (true);
CREATE POLICY "data_update" ON cupito_data
  FOR UPDATE USING (true) WITH CHECK (true);

-- Listo! Sin política de DELETE, la key pública ya no puede borrar nada.
-- El borrado de cuentas ahora es lógico (deleted=true) desde la app.
