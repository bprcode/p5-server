const crypto = require('node:crypto')
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

function base62NoO(bigNumber) {
  const digits =
    '0123456789abcdefghijklmn-pqrstuvwxyzABCDEFGHIJKLMN_PQRSTUVWXYZ'

  const len = BigInt(digits.length)
  let result = ''

  while (bigNumber > 0n) {
    result = digits.charAt(Number(bigNumber % len)) + result
    bigNumber /= len
  }

  return result
}

async function generateUnusedUID(length = 8) {
  const min = 62n ** BigInt(length) + 1n
  while (true) {
    const uuid16 = crypto.randomUUID().replaceAll('-', '')
    const base62 = base62NoO(BigInt('0x' + uuid16) + min).slice(0, length)
    const matches = await pool.query(
      'SELECT * FROM logins WHERE uid = $1::text',
      [base62]
    )

    if (matches.rowCount === 0) {
      return base62
    }
  }
}

async function addMockUser () {
  const uid = await generateUnusedUID()
  console.log('inserting mock uid=', uid)

  await pool.query('INSERT INTO logins (uid, email, hash) VALUES ($1::text, $2::text, $3::text)',
  [uid, `mock${crypto.randomUUID().replaceAll('-', '').slice(0, 4)}@fake.net`, '12345678']
  )
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

module.exports = { createLogin, getUser, matchCredentials, addMockUser }
