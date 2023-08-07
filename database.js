const { Pool } = require('pg')
const bcrypt = require('bcrypt')

const pool = new Pool()

async function getFoo() {
  const result = await pool.query('SELECT * FROM foo')
  return result.rows
}

async function testCredentials(email, password) {
  const record = await getUser(email)
  return bcrypt.compare(password, record.hash)
}

async function createLogin(candidate) {
  // Is the login available?
  const previous = await pool.query(
    'SELECT * FROM logins WHERE email ILIKE $1::text',
    [candidate.email]
  )

  if (previous.rows.length > 0) {
    log(candidate.email, pink, ' already taken')
    throw Error('email already in use.')
  }

  // Create the login:
  const hash = await bcrypt.hash(
    candidate.password,
    parseInt(process.env.SALT_ROUNDS)
  )

  await pool.query(
    'INSERT INTO logins (email, display_name, hash) VALUES ' +
      '($1::text, $2::text, $3::text)',
    [candidate.email, candidate.name, hash]
  )

  return candidate.email
}

async function getUser(email) {
  const result = await pool.query(
    'SELECT * FROM logins WHERE email ILIKE $1::text',
    [email]
  )
  if (!result.rows.length) {
    throw Error('User not found.')
  }
  return result.rows[0]
}

module.exports = { pool, getFoo, createLogin, getUser, testCredentials }
