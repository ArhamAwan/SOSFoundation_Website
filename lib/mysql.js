// MySQL / MariaDB support, for hosting that has no Postgres (such as cPanel shared hosting).
// The site's queries are written for Postgres. toMysql() rewrites the few Postgres-only parts they use,
// so the same code runs on both databases. Set DATABASE_URL=mysql://user:password@host/database to use it.

// The tables, in MariaDB form. JSON columns are LONGTEXT holding JSON; they are parsed when read.
const TABLES = {
  users: `CREATE TABLE IF NOT EXISTS users (
     id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(200) NOT NULL, email VARCHAR(191) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
     role VARCHAR(20) NOT NULL DEFAULT 'editor', active BOOLEAN NOT NULL DEFAULT TRUE,
     created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), last_login_at DATETIME(6) NULL)`,
  sessions: `CREATE TABLE IF NOT EXISTS sessions (
     token_hash VARCHAR(128) PRIMARY KEY, user_id INT NOT NULL, remember BOOLEAN NOT NULL DEFAULT FALSE,
     created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), last_seen_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
     KEY (user_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`,
  login_fails: `CREATE TABLE IF NOT EXISTS login_fails (email VARCHAR(191) NOT NULL, at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), KEY (email))`,
  media: `CREATE TABLE IF NOT EXISTS media (
     id INT AUTO_INCREMENT PRIMARY KEY, url TEXT NOT NULL, filename TEXT NOT NULL DEFAULT '', alt TEXT NOT NULL DEFAULT '', credit TEXT NOT NULL DEFAULT '',
     shows_people BOOLEAN NOT NULL DEFAULT FALSE, consent BOOLEAN NOT NULL DEFAULT FALSE, pos VARCHAR(40) NOT NULL DEFAULT 'center',
     width INT NULL, height INT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), uploaded_by INT NULL)`,
  media_files: `CREATE TABLE IF NOT EXISTS media_files (media_id INT PRIMARY KEY, content_type VARCHAR(100) NOT NULL, bytes LONGBLOB NOT NULL,
     FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE)`,
  items: `CREATE TABLE IF NOT EXISTS items (
     id INT AUTO_INCREMENT PRIMARY KEY, type VARCHAR(32) NOT NULL, slug VARCHAR(191) NOT NULL, title TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'draft',
     data LONGTEXT NOT NULL DEFAULT '{}', sort INT NOT NULL DEFAULT 0,
     created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_by INT NULL,
     UNIQUE KEY type_slug (type, slug))`,
  settings: `CREATE TABLE IF NOT EXISTS settings (\`key\` VARCHAR(191) PRIMARY KEY, value LONGTEXT NOT NULL)`,
  submissions: `CREATE TABLE IF NOT EXISTS submissions (
     id INT AUTO_INCREMENT PRIMARY KEY, form VARCHAR(100) NOT NULL, page VARCHAR(255) NOT NULL DEFAULT '', data LONGTEXT NOT NULL DEFAULT '[]',
     status VARCHAR(20) NOT NULL DEFAULT 'new', note TEXT NOT NULL DEFAULT '', sheet TEXT NOT NULL DEFAULT '', ip_hash VARCHAR(128) NOT NULL DEFAULT '',
     created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), KEY (ip_hash), KEY (form))`,
};
const JSON_COLUMNS = new Set(['data', 'value']);

const UNIT = { day: 'DAY', days: 'DAY', minute: 'MINUTE', minutes: 'MINUTE', hour: 'HOUR', hours: 'HOUR' };

/** Rewrites one Postgres query (with $1 placeholders) into MariaDB SQL with ? placeholders and the matching values. */
export function toMysql(text, params = []) {
  let s = text;
  const create = s.match(/^\s*CREATE TABLE IF NOT EXISTS (\w+)/i);
  if (create) return [TABLES[create[1]], []];

  s = s.replace(/extract\(epoch FROM \(now\(\) - ([\w.]+)\)\)::int/gi, 'TIMESTAMPDIFF(SECOND, $1, NOW(6))');
  s = s.replace(/now\(\) - \((\$\d+)::text \|\| ' (\w+)'\)::interval/gi, (m, p, u) => `NOW(6) - INTERVAL ${p} ${UNIT[u.toLowerCase()]}`);
  s = s.replace(/interval '(\d+) (\w+)'/gi, (m, n, u) => `INTERVAL ${n} ${UNIT[u.toLowerCase()]}`);
  s = s.replace(/\bnow\(\)/gi, 'NOW(6)');
  s = s.replace(/count\(\*\) FILTER \(WHERE (.+?)\)::int/gi, 'CAST(SUM(CASE WHEN $1 THEN 1 ELSE 0 END) AS SIGNED)');
  s = s.replace(/jsonb_set\(data, '\{(\w+)\}', ('[^']*'|\$\d+)(?:::text)?(?:::jsonb)?\)/gi, "JSON_SET(data, '$.$1', JSON_EXTRACT($2, '$$'))");
  s = s.replace(/data = data \|\| ('[^']*'|\$\d+)(?:::text)?(?:::jsonb)?/gi, 'data = JSON_MERGE_PATCH(data, $1)');
  s = s.replace(/(\w+)->'(\w+)' @> (\$\d+)(?:::text)?(?:::jsonb)?/gi, "JSON_CONTAINS(JSON_EXTRACT($1, '$.$2'), $3)");
  s = s.replace(/\b(\w+(?:\.\w+)?)->>'(\w+)'/g, "JSON_VALUE($1, '$.$2')");
  s = s.replace(/\bdata \? '(\w+)'/g, "JSON_CONTAINS_PATH(data, 'one', '$.$1')");
  s = s.replace(/::(text::jsonb|jsonb|text|int|interval)\b/gi, '');
  s = s.replace(/ DESC NULLS LAST/gi, ' DESC'); // MariaDB already puts NULLs last when sorting down
  s = s.replace(/= ANY\((\$\d+)\)/gi, 'IN ($1)');
  if (/ON CONFLICT \([^)]*\) DO NOTHING/i.test(s)) s = s.replace(/ON CONFLICT \([^)]*\) DO NOTHING/i, '').replace(/^\s*INSERT INTO/i, 'INSERT IGNORE INTO');
  s = s.replace(/ON CONFLICT \([^)]*\) DO UPDATE SET (\w+) = EXCLUDED\.\1/gi, 'ON DUPLICATE KEY UPDATE $1 = VALUES($1)');
  if (/\bsettings\b/i.test(s)) s = s.replace(/\bkey\b/g, '`key`');

  const values = [];
  s = s.replace(/\$(\d+)/g, (m, n) => {
    values.push(params[Number(n) - 1]);
    return '?';
  });
  return [s, values];
}

export async function connectMysql(url) {
  const mysql = (await import('mysql2/promise')).default;
  const pool = mysql.createPool({
    uri: url,
    connectionLimit: 5,
    timezone: 'Z',
    charset: 'utf8mb4',
    decimalNumbers: true,
    dateStrings: false,
    // Booleans come back as true/false and JSON columns as objects, as they do from Postgres.
    typeCast(field, next) {
      if (field.type === 'TINY' && field.length === 1) {
        const v = field.string();
        return v === null ? null : v === '1';
      }
      if (JSON_COLUMNS.has(field.name) && (field.type === 'BLOB' || field.type === 'VAR_STRING' || field.type === 'STRING' || field.type === 'JSON')) {
        const v = field.string('utf8');
        if (v === null) return null;
        try { return JSON.parse(v); } catch { return v; }
      }
      return next();
    },
  });
  // Times are stored in UTC.
  pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));
  return async (text, params = []) => {
    const [sql, values] = toMysql(text, params);
    const [rows] = await pool.query(sql, values.map((v) => (Array.isArray(v) && !/IN \(\?\)/.test(sql) ? JSON.stringify(v) : v)));
    return Array.isArray(rows) ? rows : [];
  };
}
