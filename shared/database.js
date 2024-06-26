const crypto = require('node:crypto')
const { Pool } = require('pg')
const bcrypt = require('bcrypt')
const {
  PermissionError,
  NotFoundError,
  RequestError,
  ConflictError,
} = require('./error-types')
const { devLog } = require('./logging')

const pool = new Pool()

// Invoke an async callback within a transaction context
async function transact(callback) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    return await callback(client)
  } catch (e) {
    await client.query('ROLLBACK')
    devLog('transaction rollback', yellow)
    throw e
  } finally {
    await client.query('COMMIT')
    client.release()
  }
}

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
  devLog('handling delete request for uid=', yellow, uid)
  const result = await pool.query(
    'DELETE FROM logins WHERE uid = $1::text RETURNING uid',
    [uid]
  )
  devLog('outcome=', yellow, result.rows[0])

  return result.rows[0]
}

function transactRegistration(candidate) {
  return transact(async client => {
    const previous = await client.query(
      'SELECT email FROM logins WHERE email ilike $1::text',
      [candidate.email]
    )

    if (previous.rows.length > 0) {
      devLog(candidate.email, pink, ' already taken')
      throw new ConflictError('email already in use.')
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
  })
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

async function getCalendarList(verifiedUid) {
  const result = await pool.query(
    'SELECT * FROM calendars WHERE primary_author_id = $1::text' +
      ' ORDER BY updated DESC',
    [verifiedUid]
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
  devLog('getting note list for ', blue, author)
  const result = await pool.query(
    'SELECT note_id, title, summary FROM notes WHERE author_id = $1::text ' +
      'ORDER BY created_at',
    [author]
  )

  return result.rows
}

function listEvents({ verifiedUid, calendarId, from, to }) {
  return transact(async client => {
    const author = await client.query(
      'SELECT primary_author_id FROM calendars WHERE calendar_id = $1::text;',
      [calendarId]
    )

    devLog('checking event list authorship for ', blue, calendarId)
    devLog('comparing ' + author.rows[0]?.primary_author_id + '/' + verifiedUid)

    if (!author.rows.length) {
      throw new NotFoundError('Calendar not found.')
    }

    if (verifiedUid !== author.rows[0].primary_author_id) {
      throw new PermissionError('Permission denied for event list.')
    }

    let events
    if (from && to) {
      events = await client.query(
        'SELECT * FROM events WHERE calendar_id = $1::text ' +
          'AND start_time < $2::timestamptz ' +
          'AND end_time > $3::timestamptz;',
        [calendarId, to, from]
      )
    } else {
      events = await client.query(
        'SELECT * FROM events WHERE calendar_id = $1::text;',
        [calendarId]
      )
    }

    return events.rows
  })
}

async function deleteOldIdempotencies() {
  const recycled = await pool.query(
    `DELETE FROM idempotency WHERE ` +
      `(current_timestamp - created_at) > INTERVAL '1 day' RETURNING *`
  )
  log('♻️ Removed ', recycled.rows.length, ' old records.')
}

function checkIdempotency({ key, verifiedUid, client }) {
  return client
    .query(
      'SELECT * FROM idempotency WHERE ' +
        'idem_key = $1::text AND uid = $2::text',
      [key, verifiedUid]
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
    const previous = await checkIdempotency({ key, verifiedUid: uid, client })

    if (previous) {
      devLog('already had note: ', key, uid)
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
    devLog('<< rolling back...', yellow)
    throw e
  } finally {
    await client.query('COMMIT')
    console.timeEnd(`Add idempotent ${logId}`)
    client.release()
  }
}

function addEventIdempotent({ key, verifiedUid, calendarId, event }) {
  return transact(async client => {
    // Check that the bearer has permission to add to this calendar:
    const calendar = await client.query(
      'SELECT primary_author_id FROM calendars WHERE calendar_id = $1::text',
      [calendarId]
    )

    if (!calendar.rows.length) {
      throw new NotFoundError('Calendar not found.')
    }

    if (verifiedUid !== calendar.rows[0].primary_author_id) {
      throw new PermissionError('Permission denied for calendar.')
    }

    // If a previous result exists, return it
    const previous = await checkIdempotency({ key, verifiedUid, client })

    if (previous) {
      devLog('already had event: ', key, verifiedUid)
      return previous.outcome
    }

    // Otherwise, create the event
    const eventId = await generateUnusedId('events', 'event_id', { client })
    const created = await client
      .query(
        'INSERT INTO events (event_id, summary, description, ' +
          'start_time, end_time, color_id, calendar_id) ' +
          'VALUES ($1::text, $2::text, $3::text, ' +
          '$4::timestamptz, $5::timestamptz, ' +
          '$6::text, $7::text) RETURNING *',
        [
          eventId,
          event.summary,
          event.description,
          event.start_time,
          event.end_time,
          event.color_id,
          calendarId,
        ]
      )
      .then(result => result.rows[0])

    // Record the result in the idempotency table
    await client.query(
      'INSERT INTO idempotency (idem_key, uid, outcome) ' +
        'VALUES ($1::text, $2::text, $3::jsonb) RETURNING outcome',
      [key, verifiedUid, created]
    )

    return created
  })
}

async function deleteEvent({ eventId, verifiedUid, etag }) {
  return transact(async client => {
    const result = await client.query(
      'DELETE FROM events USING calendars WHERE ' +
        'events.calendar_id = calendars.calendar_id and ' +
        'primary_author_id = $1::text and ' +
        'event_id = $2::text and ' +
        'events.etag = $3::text ' +
        'RETURNING events.event_id, events.etag, events.summary, ' +
        'events.description, events.start_time, events.end_time, events.color_id',
      [verifiedUid, eventId, etag]
    )

    if (result.rows.length) {
      return result.rows[0]
    }

    // If the request failed, find out why.
    const match = await client.query(
      'SELECT true FROM events JOIN calendars USING (calendar_id) ' +
        'WHERE event_id = $1::text AND primary_author_id = $2::text',
      [eventId, verifiedUid]
    )

    // author/calendar matched; must have been the etag:
    if (match.rows.length) {
      throw new ConflictError('etag mismatch.')
    }

    // Record does not exist, or author does not match:
    throw new NotFoundError('No resource matched request.')
  })
}

async function updateEvent({ eventId, verifiedUid, etag, updates }) {
  return transact(async client => {
    const result = await client.query(
      'UPDATE events SET summary = $1::text, ' +
        'description = $2::text, ' +
        'start_time = $3::timestamptz, ' +
        'end_time = $4::timestamptz, ' +
        'color_id = $5::text ' +
        'FROM calendars WHERE events.calendar_id = calendars.calendar_id ' +
        'AND primary_author_id = $6::text ' +
        'AND events.etag = $7::text ' +
        'AND event_id = $8::text ' +
        'RETURNING events.summary, events.description, events.start_time, ' +
        'events.end_time, events.color_id, events.etag',
      [
        updates.summary,
        updates.description,
        updates.start_time,
        updates.end_time,
        updates.color_id,
        verifiedUid,
        etag,
        eventId,
      ]
    )

    if (result.rows.length) {
      return result.rows[0]
    }

    // If the request failed, find out why.
    const match = await client.query(
      'SELECT true FROM events JOIN calendars USING (calendar_id) ' +
        'WHERE event_id = $1::text AND primary_author_id = $2::text',
      [eventId, verifiedUid]
    )

    // author/calendar matched; must have been the etag:
    if (match.rows.length) {
      // Return the current state of the record to help resolve the conflict:
      const conflict = await client.query(
        'SELECT summary, description, start_time, end_time, color_id, etag ' +
          'FROM events WHERE event_id = $1::text',
        [eventId]
      )
      devLog('returning conflict:', conflict.rows[0])

      throw new ConflictError('etag mismatch.', conflict.rows[0])
    }

    // Record does not exist, or author does not match:
    throw new NotFoundError('No resource matched request.')
  })
}

function addCalendar({ key, verifiedUid, summary }) {
  return transact(async client => {
    // If a previous result exists, return it
    const previous = await checkIdempotency({ key, verifiedUid, client })

    if (previous) {
      devLog('already had entry: ', key, verifiedUid)
      return previous.outcome
    }

    // Otherwise, generate a new identifier:
    const calendarId = await generateUnusedId('calendars', 'calendar_id', {
      client,
    })

    const created = await client
      .query(
        'INSERT INTO calendars (calendar_id, summary, primary_author_id) ' +
          'VALUES ($1::text, $2::text, $3::text) RETURNING *',
        [calendarId, summary, verifiedUid]
      )
      .then(result => result.rows[0])

    // Record the result in the idempotency table
    await client.query(
      'INSERT INTO idempotency (idem_key, uid, outcome) ' +
        'VALUES ($1::text, $2::text, $3::jsonb) RETURNING outcome',
      [key, verifiedUid, created]
    )

    return created
  })
}

function deleteCalendar({ calendarId, verifiedUid, etag }) {
  return transact(async client => {
    const result = await client.query(
      'DELETE FROM calendars WHERE ' +
        'calendar_id = $1::text AND ' +
        'primary_author_id = $2::text AND etag = $3::text ' +
        'RETURNING *',
      [calendarId, verifiedUid, etag]
    )

    if (result.rows.length) {
      return result.rows
    }

    // If nothing deleted, determine why:
    const match = await client.query(
      'SELECT true FROM calendars WHERE calendar_id = $1::text AND ' +
        'primary_author_id = $2::text',
      [calendarId, verifiedUid]
    )

    // author/calendar matched; must have been the etag:
    if (match.rows.length) {
      throw new ConflictError('etag mismatch.')
    }

    // Calendar does not exist, or author does not match:
    throw new NotFoundError('Resource not found.')
  })
}

function updateCalendar({ calendarId, verifiedUid, etag, summary }) {
  return transact(async client => {
    const result = await client.query(
      'UPDATE calendars SET summary = $4::text WHERE ' +
        'calendar_id = $1::text AND primary_author_id = $2::text AND ' +
        'etag = $3::text RETURNING *',
      [calendarId, verifiedUid, etag, summary]
    )

    if (result.rows.length) {
      return result.rows
    }

    // If nothing updated, determine why:
    const match = await client.query(
      'SELECT true FROM calendars WHERE calendar_id = $1::text AND ' +
        'primary_author_id = $2::text',
      [calendarId, verifiedUid]
    )

    // author/calendar matched; must have been the etag:
    if (match.rows.length) {
      // Return the current state of the record to help resolve the conflict:
      const conflict = await client.query(
        'SELECT summary, etag ' + 'FROM calendars WHERE calendar_id = $1::text',
        [calendarId]
      )
      devLog('returning conflict:', conflict.rows[0])

      throw new ConflictError('etag mismatch.', conflict.rows[0])
    }

    // Calendar does not exist, or author does not match:
    throw new NotFoundError('Resource not found.')
  })
}

module.exports = {
  transactRegistration,
  deleteRegistration,
  getNote,
  listNotes,
  matchCredentials,
  updateNote,
  deleteNote,
  deleteOldIdempotencies,
  addNoteIdempotent,
  getCalendarList,
  addCalendar,
  deleteCalendar,
  updateCalendar,
  listEvents,
  addEventIdempotent,
  updateEvent,
  deleteEvent,
}
