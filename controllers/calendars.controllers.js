const { creationMaintenance } = require('../shared/shared')
const { devLog } = require('../shared/logging')
const { identifyCredentials } = require('../shared/authorization')
const {
  getCalendarList,
  addCalendar,
  deleteCalendar,
  updateCalendar,
  listEvents,
  addEventIdempotent,
  updateEvent,
  deleteEvent,
} = require('../shared/database')
const { RequestError, PermissionError } = require('../shared/error-types')

const calendars = {
  id: { events: {} },
  events: { id: {} },
}

const placeholder = tag => (req, res) =>
  res.status(418).send(tag + ' placeholder')

const handleListCalendars = async (req, res) => {
  devLog(`Retrieving catalog for ${req.verified.uid}`)
  const result = await getCalendarList(req.verified.uid)
  res.json(result)
}

calendars.all = [identifyCredentials]

calendars.get = [handleListCalendars]

const handleCreateCalendar = async (req, res) => {
  if (!req.body.key) {
    throw new RequestError('No idempotency key specified.')
  }
  const result = await addCalendar({
    key: req.body.key,
    verifiedUid: req.verified.uid,
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
    verifiedUid: req.verified.uid,
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
    verifiedUid: req.verified.uid,
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
    verifiedUid: req.verified.uid,
    calendarId: req.params.id,
    event: {
      summary: req.body.summary || 'New Event',
      description: req.body.description || '',
      start_time: req.body.start_time,
      end_time: req.body.end_time,
      color_id: req.body.color_id || '#0af',
    },
  })
  res.json(result)
}

calendars.id.events.post = [creationMaintenance, handleCreateEvent]

const handleListEvents = async (req, res) => {
  devLog('from=', yellow, req.query.from, ' to=', yellow, req.query.to)
  // Authorization:
  // bearer uid matches primary_author_id of calendar
  const result = await listEvents({
    verifiedUid: req.verified.uid,
    calendarId: req.params.id,
    from: req.query.from,
    to: req.query.to,
  })
  res.json(result)
}

calendars.id.events.get = [handleListEvents]

const handleUpdateEvent = async (req, res) => {
  // Authorization:
  // bearer uid matches primary_author_id of calendar corresponding to event
  // Handled in query.
  if (!req.body.etag) {
    throw new RequestError('Missing etag.')
  }

  if (
    !req.body.start_time ||
    !req.body.end_time ||
    !req.body.summary ||
    !req.body.description ||
    !req.body.color_id
  ) {
    throw new RequestError('Incomplete update fields.')
  }

  const result = await updateEvent({
    eventId: req.params.id,
    verifiedUid: req.verified.uid,
    etag: req.body.etag,
    updates: {
      summary: req.body.summary,
      description: req.body.description,
      start_time: req.body.start_time,
      end_time: req.body.end_time,
      color_id: req.body.color_id,
    },
  })

  res.json(result)
}

calendars.events.id.put = [handleUpdateEvent]

const handleDeleteEvent = async (req, res) => {
  // Authorization:
  // bearer uid matches primary author of calendar referenced by this event
  // Handled in query.
  if (!req.body.etag) {
    throw new RequestError('Etag required.')
  }

  const result = await deleteEvent({
    verifiedUid: req.verified.uid,
    etag: req.body.etag,
    eventId: req.params.id,
  })

  res.json(result)
}

calendars.events.id.delete = [handleDeleteEvent]

// Invoke a request handler, turning .json responses into promise resolutions
// and wrapping errors into error objects.
const invokeHandler = handler => (req, res) => {
  return new Promise(resolve => {
    const intercept = { json: json => resolve(json) }
    handler(req, { ...res, ...intercept }).catch(e => {
      devLog('⚠️ Caught ', pink, e.message)
      const notice = { error: e.message }
      if (e.conflict) {
        notice.conflict = e.conflict
      }

      resolve(notice)
    })
  })
}

// Dispatch an array of batched updates to their respective handlers.
const handleBatchUpdate = async (req, res) => {
  const results = []
  const maxActions = 50
  if (!Array.isArray(req.body)) {
    throw new RequestError('Array expected for batch updates.')
  }

  if (req.body.length > maxActions) {
    throw new RequestError(`Batch actions exceeded max length (${maxActions})`)
  }

  for (const r of req.body) {
    const subrequest = { ...req, params: { ...req.params }, body: r.body }
    let result = null

    switch (r.action) {
      case 'POST':
        result = await invokeHandler(handleCreateEvent)(subrequest, res)
        break
      case 'PUT':
        subrequest.params.id = r.event_id
        result = await invokeHandler(handleUpdateEvent)(subrequest, res)
        break
      case 'DELETE':
        subrequest.params.id = r.event_id
        result = await invokeHandler(handleDeleteEvent)(subrequest, res)
        break
      default:
        throw new RequestError(`Batch action not supported: ${r.action}`)
    }

    results.push(result)
  }

  res.json(results)
}

calendars.id.events.batchUpdate = [handleBatchUpdate]

module.exports = { calendars }
