const { delay, creationMaintenance } = require('../shared/shared')
const { identifyCredentials } = require('../shared/authorization')
const {
  getCalendarList,
  addCalendar,
  deleteCalendar,
  updateCalendar,
  listEvents,
  addEventIdempotent,
} = require('../shared/database')
const { RequestError } = require('../shared/error-types')

const calendars = { id: { events: { id: {} } } }

const placeholder = tag => (req, res) =>
  res.status(418).send(tag + ' placeholder')

const handleListCalendars = async (req, res) => {
  log(`Retrieving catalog for ${req.verified.uid}`)
  const result = await getCalendarList(req.verified.uid)
  res.json(result)
}

calendars.all = [delay, identifyCredentials]

calendars.get = [handleListCalendars]

const handleCreateCalendar = async (req, res) => {
  if (!req.body.key) {
    throw new RequestError('No idempotency key specified.')
  }
  const result = await addCalendar({
    key: req.body.key,
    authorId: req.verified.uid,
    summary: req.body.summary || 'New Calendar',
  })
  res.json(result)
}

calendars.post = [creationMaintenance, handleCreateCalendar]

const handleDeleteCalendar = async (req, res) => {
  // Authorization:
  // Bearer uid matches primary_author_id, etag matches current value
  // handled in query.
  if (!req.body.etag) {
    throw new RequestError('Missing etag.')
  }

  const result = await deleteCalendar({
    authorId: req.verified.uid,
    calendarId: req.params.id,
    etag: req.body.etag,
  })
  res.json(result)
}

calendars.id.delete = [handleDeleteCalendar]

const handleUpdateCalendar = async (req, res) => {
  // Authorization:
  // Bearer uid matches primary_author_id, etag matches current value
  // handled in query.
  if (!req.body.etag) {
    throw new RequestError('Missing etag.')
  }

  const result = await updateCalendar({
    authorId: req.verified.uid,
    calendarId: req.params.id,
    etag: req.body.etag,
    summary: req.body.summary || '',
  })
  res.json(result)
}

calendars.id.put = [handleUpdateCalendar]

const handleCreateEvent = async (req, res) => {
  // Authorization:
  // Bearer uid matches primary_author_id of calendar
  // handled in transaction
  if (!req.body.key) {
    throw new RequestError('Idempotency key not specified.')
  }
  if (!req.body.start_time || !req.body.end_time) {
    throw new RequestError('Time range not specified.')
  }

  const result = await addEventIdempotent({
    key: req.body.key,
    uid: req.verified.uid,
    calendarId: req.params.id,
    event: {
      summary: req.body.summary || 'New Event',
      description: req.body.description || '',
      start_time: req.body.start_time || '',
      end_time: req.body.end_time || '',
      color_id: req.body.color_id || '#0af',
    },
  })
  res.json(result)
}

calendars.id.events.post = [creationMaintenance, handleCreateEvent]

const handleListEvents = async (req, res) => {
  // Authorization:
  // bearer uid matches primary_author_id of calendar
  const result = await listEvents({
    uid: req.verified.uid,
    calendarId: req.params.id,
  })

  res.json(result)
}

calendars.id.events.get = [handleListEvents]

calendars.id.events.id.put = placeholder('modify event')
calendars.id.events.id.delete = placeholder('delete event')

module.exports = { calendars }
