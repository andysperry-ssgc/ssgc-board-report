import { neon } from '@neondatabase/serverless'

const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? ''
const _sql = neon(connectionString)

// Compatibility shim — wraps Neon (which returns rows directly) to match
// the { rows } shape that @vercel/postgres used, so no other files need changing.
export async function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<{ rows: T[] }> {
  const rows = (await _sql(strings, ...values)) as T[]
  return { rows }
}

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS cycles (
      id SERIAL PRIMARY KEY,
      label VARCHAR(200) NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'biweekly',
      opens_at TIMESTAMPTZ NOT NULL,
      closes_at TIMESTAMPTZ NOT NULL,
      is_current BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      cycle_id INTEGER REFERENCES cycles(id) ON DELETE CASCADE,
      person_name VARCHAR(200) NOT NULL,
      headline TEXT NOT NULL,
      progress TEXT NOT NULL,
      risks TEXT NOT NULL,
      metrics TEXT,
      board_update TEXT,
      focus TEXT,
      priorities TEXT,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(cycle_id, person_name)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      cycle_id INTEGER REFERENCES cycles(id) ON DELETE SET NULL,
      period VARCHAR(200) NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'biweekly',
      content TEXT NOT NULL,
      generated_at TIMESTAMPTZ DEFAULT NOW(),
      source VARCHAR(20) DEFAULT 'generated'
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS slack_messages (
      id SERIAL PRIMARY KEY,
      cycle_id INTEGER REFERENCES cycles(id) ON DELETE CASCADE,
      message_type VARCHAR(50) NOT NULL,
      ts VARCHAR(100),
      posted_at TIMESTAMPTZ DEFAULT NOW(),
      cancelled BOOLEAN DEFAULT false
    )
  `

  await sql`
    INSERT INTO settings (key, value) VALUES
      ('submission_url', 'https://ssgc-board-report.vercel.app'),
      ('cycle_label', 'Biweekly Update')
    ON CONFLICT (key) DO NOTHING
  `
}

export async function getSetting(key: string): Promise<string | null> {
  const result = await sql<{ value: string }>`SELECT value FROM settings WHERE key = ${key}`
  return result.rows[0]?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
  `
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const result = await sql`SELECT key, value FROM settings`
  return Object.fromEntries(result.rows.map((r) => [r.key, r.value]))
}
