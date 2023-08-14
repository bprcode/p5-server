const crypto = require('node:crypto')
const { Pool } = require('pg')
const bcrypt = require('bcrypt')

const pool = new Pool()

// If given valid credentials, return matching user record, null otherwise.
async function matchCredentials(email, password) {
  try {
    const record = await getUserByEmail(email)

    if (await bcrypt.compare(password, record.hash)) {
      return record
    }
  } catch (e) {}

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

  const uid = await generateUnusedId('logins', 'uid')

  await pool.query(
    'INSERT INTO logins (email, name, hash, uid) VALUES ' +
      '($1::text, $2::text, $3::text, $4::text)',
    [candidate.email, candidate.name, hash, uid]
  )

  return { email: candidate.email, name: candidate.name }
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

/**
 * Generate a random unused base62 id of a specified length. Entity names
 * are unsanitized and must not be exposed to user input.
 */
async function generateUnusedId(table, column, length = 8) {
  const min = 62n ** BigInt(length) + 1n
  while (true) {
    const uuid16 = crypto.randomUUID().replaceAll('-', '')
    const base62 = base62NoO(BigInt('0x' + uuid16) + min).slice(0, length)
    const matches = await pool.query(
      `SELECT * FROM ${table} WHERE ${column} = $1::text`,
      [base62]
    )

    if (matches.rowCount === 0) {
      return base62
    }
  }
}

async function addMockUser() {
  const uid = await generateUnusedId('logins', 'uid')
  console.log('inserting mock uid=', uid)

  await pool.query(
    'INSERT INTO logins (uid, email, hash) ' +
      'VALUES ($1::text, $2::text, $3::text)',
    [
      uid,
      `mock${crypto.randomUUID().replaceAll('-', '').slice(0, 4)}@fake.net`,
      '12345678',
    ]
  )
}

async function getUserByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM logins WHERE email ILIKE $1::text',
    [email]
  )
  if (!result.rows.length) {
    throw Error('User not found.')
  }
  return result.rows[0]
}

async function getUser(id) {
  const result = await pool.query(
    'SELECT * FROM logins WHERE uid ILIKE $1::text',
    [id]
  )
  if (!result.rows.length) {
    throw Error('User not found.')
  }
  return result.rows[0]
}

async function addNote({ author, content, title }) {
  const noteId = await generateUnusedId('notes', 'note_id')
  const result = await pool.query(
    'INSERT INTO notes (note_id, author_id, content, title) ' +
      'VALUES ($1::text, $2::text, $3::text, $4::text) RETURNING *',
    [noteId, author, content, title]
  )
  return result.rows[0]
}

async function getNote({noteId, authorId}) {
  const result = await pool.query(
    'SELECT * FROM notes WHERE note_id = $1::text AND author_id = $2::text',
    [noteId, authorId]
  )
  if (!result.rows.length) {
    throw Error('No matching note found.')
  }
  return result.rows[0]
}

async function updateNote({ content, title, noteId, authorId }) {
  const result = await pool.query(
    'UPDATE notes SET content = $1::text, title = $2::text WHERE ' +
      'note_id = $3::text AND author_id = $4::text RETURNING *',
    [content, title, noteId, authorId]
  )
  if (!result.rows.length) {
    throw Error('No match found.')
  }
  return result.rows[0]
}

async function listNotes(author) {
  log('getting note list for ', blue, author)
  const result = await pool.query(
    'SELECT note_id, summary FROM notes WHERE author_id = $1::text',
    [author]
  )

  return result.rows
}

module.exports = {
  createLogin,
  getUser,
  getNote,
  listNotes,
  matchCredentials,
  addMockUser,
  addNote,
  updateNote,
}
