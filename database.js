const { Pool } = require('pg')
const bcrypt = require('bcrypt')

const pool = new Pool()

// If given valid credentials, return matching user record, null otherwise.
async function matchCredentials(email, password) {
  const record = await getUser(email)

  if (await bcrypt.compare(password, record.hash)) {
    return record
  }

  return null
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
    'INSERT INTO logins (email, name, hash) VALUES ' +
      '($1::text, $2::text, $3::text)',
    [candidate.email, candidate.name, hash]
  )

  return { email: candidate.email, name: candidate.name, hash }
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

module.exports = { createLogin, getUser, matchCredentials }
