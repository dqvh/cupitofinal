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
  password TEXT,
  auth_id TEXT UNIQUE,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'semilla',
  created_at BIGINT,
  subscription JSONB,
  deleted BOOLEAN DEFAULT FALSE
);
-- Migración para bases ya creadas:
ALTER TABLE cupito_users ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE cupito_users ADD COLUMN IF NOT EXISTS auth_id TEXT UNIQUE;

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
CREATE INDEX IF NOT EXISTS idx_cupito_users_auth ON cupito_users (auth_id);

-- 4. Limpieza: la cuenta demo nunca debe vivir en producción
DELETE FROM cupito_data WHERE user_id IN (SELECT id FROM cupito_users WHERE email = 'demo@cupito.app');
DELETE FROM cupito_users WHERE email = 'demo@cupito.app';

-- 5. Row Level Security CON Supabase Auth (v2).
--    Las páginas públicas (ver negocio, reservar por link) siguen siendo
--    lectura abierta. Pero ESCRIBIR solo puede el dueño logueado:
--    - SELECT: público, solo filas no borradas.
--    - INSERT / UPDATE cupito_users: solo el dueño (auth.uid() = auth_id).
--    - INSERT / UPDATE cupito_data: solo el dueño del negocio.
--    - DELETE: NO hay política => denegado. Borrar = marcar deleted=true.
--    Las escrituras de invitados (reservar, lista de espera, cancelar,
--    reseñas) pasan por /api/public/* con la service key, con validación.
--
--    IMPORTANTE en Supabase -> Authentication -> Sign In/Up:
--    ACTIVÁ "Confirm email" para que solo entren emails reales.
--    Y en Authentication -> URL Configuration poné Site URL = https://cupito.app
--    (o tu dominio de Vercel) para que el link del email vuelva a tu página.
ALTER TABLE cupito_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupito_data ENABLE ROW LEVEL SECURITY;

-- Migración Auth: columna de vínculo + password opcional (ya no se guarda)
ALTER TABLE cupito_users ADD COLUMN IF NOT EXISTS auth_id TEXT UNIQUE;
ALTER TABLE cupito_users ALTER COLUMN password DROP NOT NULL;

DROP POLICY IF EXISTS "Permitir lectura publica de usuarios" ON cupito_users;
DROP POLICY IF EXISTS "Permitir escritura publica de usuarios" ON cupito_users;
DROP POLICY IF EXISTS "users_select_not_deleted" ON cupito_users;
DROP POLICY IF EXISTS "users_insert" ON cupito_users;
DROP POLICY IF EXISTS "users_update" ON cupito_users;
DROP POLICY IF EXISTS "users_select_public" ON cupito_users;
DROP POLICY IF EXISTS "users_insert_owner" ON cupito_users;
DROP POLICY IF EXISTS "users_update_owner" ON cupito_users;

CREATE POLICY "users_select_public" ON cupito_users
  FOR SELECT USING (COALESCE(deleted, FALSE) = FALSE);
CREATE POLICY "users_insert_owner" ON cupito_users
  FOR INSERT WITH CHECK (auth.uid()::text = auth_id);
CREATE POLICY "users_update_owner" ON cupito_users
  FOR UPDATE USING (auth.uid()::text = auth_id) WITH CHECK (auth.uid()::text = auth_id);

DROP POLICY IF EXISTS "Permitir lectura publica de datos" ON cupito_data;
DROP POLICY IF EXISTS "Permitir escritura publica de datos" ON cupito_data;
DROP POLICY IF EXISTS "data_select_not_deleted" ON cupito_data;
DROP POLICY IF EXISTS "data_insert" ON cupito_data;
DROP POLICY IF EXISTS "data_update" ON cupito_data;
DROP POLICY IF EXISTS "data_select_public" ON cupito_data;
DROP POLICY IF EXISTS "data_insert_owner" ON cupito_data;
DROP POLICY IF EXISTS "data_update_owner" ON cupito_data;

CREATE POLICY "data_select_public" ON cupito_data
  FOR SELECT USING (COALESCE(deleted, FALSE) = FALSE);
CREATE POLICY "data_insert_owner" ON cupito_data
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM cupito_users u WHERE u.id = user_id AND u.auth_id = auth.uid()::text)
  );
CREATE POLICY "data_update_owner" ON cupito_data
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM cupito_users u WHERE u.id = user_id AND u.auth_id = auth.uid()::text)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM cupito_users u WHERE u.id = user_id AND u.auth_id = auth.uid()::text)
  );

-- Listo! Sin política de DELETE, la key pública ya no puede borrar nada.
-- El borrado de cuentas ahora es lógico (deleted=true) desde la app.
