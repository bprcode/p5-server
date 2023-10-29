const crypto = require('node:crypto')
const { Pool } = require('pg')
const bcrypt = require('bcrypt')

const pool = new Pool()

// If given valid credentials, return matching user record, null otherwise.
async function matchCredentials(email, password) {
  const timerId = (Math.random()*1000).toFixed()
  try {
    console.time(`(${timerId}) Hash comparison`)
    const record = await getUserByEmail(email)

    if (await bcrypt.compare(password, record.hash)) {
      return { uid: record.uid, name: record.name, email: record.email }
    }
  } catch (_) {}
  finally {
    console.timeEnd(`(${timerId}) Hash comparison`)
  }

  return null
}

async function transactRegistration(candidate) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
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

    await client.query('COMMIT')
    return outcome.rows[0]
  } catch (e) {
    log(e.message)
    await client.query('ROLLBACK')
  } finally {
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

// async function getUser(id) {
//   const result = await pool.query(
//     'SELECT * FROM logins WHERE uid ILIKE $1::text',
//     [id]
//   )
//   if (!result.rows.length) {
//     throw Error('User not found.')
//   }
//   return result.rows[0]
// }

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
    const previous = await client
      .query(
        'SELECT * FROM idempotency WHERE ' +
          'idem_key = $1::text AND uid = $2::text',
        [key, uid]
      )
      .then(result => result.rows[0])

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
    await client.query('COMMIT')

    log('>. Commit reached. Returning.', blue)
    return created
  } catch (e) {
    await client.query('ROLLBACK')
    log('<< rolling back...', yellow)
    throw e
  } finally {
    console.timeEnd(`Add idempotent ${logId}`)
    client.release()
  }
}

module.exports = {
  transactRegistration,
  // getUser,
  getNote,
  listNotes,
  matchCredentials,
  updateNote,
  deleteNote,
  addNoteIdempotent,
}
