const crypto = require('node:crypto')
const { Pool } = require('pg')
const bcrypt = require('bcrypt')

const pool = new Pool()

// If given valid credentials, return matching user record, null otherwise.
async function matchCredentials(email, password) {
  const timerId = (Math.random() * 1000).toFixed()
  try {
    console.time(`(${timerId}) Hash comparison`)
    const record = await getUserByEmail(email)

    if (await bcrypt.compare(password, record.hash)) {
      return { uid: record.uid, name: record.name, email: record.email }
    }
  } catch (_) {
  } finally {
    console.timeEnd(`(${timerId}) Hash comparison`)
  }

  return null
}

async function deleteRegistration(uid) {
  log('handling delete request for uid=', yellow, uid)
  const result = await pool.query(
    'DELETE FROM logins WHERE uid = $1::text RETURNING uid',
    [uid]
  )
  log('outcome=', yellow, result.rows[0])

  return result.rows[0]
}

async function transactRegistration(candidate) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    log('>> BEGIN', green)
    const previous = await client.query(
      'SELECT email FROM logins WHERE email ilike $1::text',
      [candidate.email]
    )

    if (previous.rows.length > 0) {
      log(candidate.email, pink, ' already taken')
      throw Error('email already in use.')
    }

    // If the email is not in use, create a login:
    const hash = await bcrypt.hash(
      candidate.password,
      parseInt(process.env.SALT_ROUNDS)
    )

    const uid = await generateUnusedId('logins', 'uid', { client })

    const outcome = await pool.query(
      'INSERT INTO logins (email, name, hash, uid) VALUES ' +
        '($1::text, $2::text, $3::text, $4::text) RETURNING email, name, uid',
      [candidate.email, candidate.name, hash, uid]
    )

    return outcome.rows[0]
  } catch (e) {
    log(e.message)
    await client.query('ROLLBACK')
    log('<< ROLLBACK', pink)
  } finally {
    await client.query('COMMIT')
    client.release()
  }
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
async function generateUnusedId(table, column, options = {}) {
  const length = options.length || 8
  const enquirer = options.client || pool
  const min = 62n ** BigInt(length) + 1n
  while (true) {
    const uuid16 = crypto.randomUUID().replaceAll('-', '')
    const base62 = base62NoO(BigInt('0x' + uuid16) + min).slice(0, length)
    const matches = await enquirer.query(
      `SELECT * FROM ${table} WHERE ${column} = $1::text`,
      [base62]
    )

    if (matches.rowCount === 0) {
      return base62
    }
  }
}

async function getUserByEmail(email) {
  const result = await pool.query(
    'SELECT uid, name, email, hash FROM logins WHERE email ILIKE $1::text',
    [email]
  )
  if (!result.rows.length) {
    throw Error('User not found.')
  }
  return result.rows[0]
}

async function getCalendarList(authorId) {
  const result = await pool.query(
    'SELECT * FROM calendars WHERE primary_author_id = $1::text',
    [authorId]
  )
  return result.rows
}

async function getNote({ noteId, authorId }) {
  const result = await pool.query(
    'SELECT * FROM notes WHERE note_id = $1::text AND author_id = $2::text',
    [noteId, authorId]
  )
  if (!result.rows.length) {
    throw Error('No match found.')
  }
  return result.rows[0]
}

async function updateNote({ content, title, noteId, authorId }) {
  const result = await pool.query(
    'UPDATE notes SET content = $1::text, title = $2::text WHERE ' +
      'note_id = $3::text AND author_id = $4::text RETURNING ' +
      'note_id, title, content',
    [content, title, noteId, authorId]
  )
  if (!result.rows.length) {
    throw Error('No match found.')
  }
  return result.rows[0]
}

async function deleteNote({ noteId, authorId }) {
  const result = await pool.query(
    'DELETE FROM notes WHERE note_id = $1::text AND author_id = $2::text ',
    [noteId, authorId]
  )
  if (!result.rows.length) {
    throw Error('No match found.')
  }
  return result.rows[0]
}

async function listNotes(author) {
  log('getting note list for ', blue, author)
  const result = await pool.query(
    'SELECT note_id, title, summary FROM notes WHERE author_id = $1::text ' +
      'ORDER BY created_at',
    [author]
  )

  return result.rows
}

async function deleteOldIdempotencies() {
  const recycled = await pool.query(
    `DELETE FROM idempotency WHERE ` +
      `(current_timestamp - created_at) > INTERVAL '1 day' RETURNING *`
  )
  log('♻️ Removed ', recycled.rows.length, ' old records.')
}

function checkIdempotency({ key, uid, client }) {
  return client
    .query(
      'SELECT * FROM idempotency WHERE ' +
        'idem_key = $1::text AND uid = $2::text',
      [key, uid]
    )
    .then(result => result.rows[0])
}

async function addNoteIdempotent(key, uid, note) {
  const logId = Math.random()
  console.time(`Add idempotent ${logId}`)
  const client = await pool.connect()

  // Periodically prune old records:
  if (Math.random() < 0.05) {
    log('deleting old records')
    await deleteOldIdempotencies()
  }

  try {
    await client.query('BEGIN')

    // If a previous result exists, return it
    const previous = await checkIdempotency({ key, uid, client })

    if (previous) {
      log('already had note: ', key, uid)
      return previous.outcome
    }

    // Otherwise, create the note
    const noteId = await generateUnusedId('notes', 'note_id', { client })
    const created = await client
      .query(
        'INSERT INTO notes (note_id, author_id, content, title) ' +
          'VALUES ($1::text, $2::text, $3::text, $4::text) RETURNING *',
        [noteId, uid, note.content, note.title]
      )
      .then(result => result.rows[0])

    // Record the result in the idempotency table
    await client.query(
      'INSERT INTO idempotency (idem_key, uid, outcome) ' +
        'VALUES ($1::text, $2::text, $3::jsonb) RETURNING outcome',
      [key, uid, created]
    )

    return created
  } catch (e) {
    await client.query('ROLLBACK')
    log('<< rolling back...', yellow)
    throw e
  } finally {
    await client.query('COMMIT')
    console.timeEnd(`Add idempotent ${logId}`)
    client.release()
  }
}

async function addCalendar({ key, authorId, summary }) {
  log('Acquiring add-client', yellow)
  // Periodically prune old records:
  if (Math.random() < 0.05) {
    log('deleting old records')
    await deleteOldIdempotencies()
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // If a previous result exists, return it
    const previous = await checkIdempotency({ key, uid: authorId, client })

    if (previous) {
      log('already had entry: ', key, authorId)
      return previous.outcome
    }

    // Otherwise, generate a new identifier:
    const calendarId = await generateUnusedId('calendars', 'calendar_id', { client })

    const created = await client
      .query(
        'INSERT INTO calendars (calendar_id, summary, primary_author_id) ' +
          'VALUES ($1::text, $2::text, $3::text) RETURNING *',
        [calendarId, summary, authorId]
      )
      .then(result => result.rows[0])

    // Record the result in the idempotency table
    await client.query(
      'INSERT INTO idempotency (idem_key, uid, outcome) ' +
        'VALUES ($1::text, $2::text, $3::jsonb) RETURNING outcome',
      [key, authorId, created]
    )

    return created
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    await client.query('COMMIT')
    client.release()
  }
}

module.exports = {
  transactRegistration,
  deleteRegistration,
  getNote,
  listNotes,
  matchCredentials,
  updateNote,
  deleteNote,
  addNoteIdempotent,
  getCalendarList,
  addCalendar,
}
