const { delay } = require('../shared/shared')
const { identifyCredentials } = require('../shared/authorization')
const {
  getCalendarList,
  addCalendar,
  deleteCalendar,
} = require('../shared/database')

const calendars = { id: { events: { id: {} }} }

const placeholder = tag => (req, res) =>
  res
    .status(418)
    .send(tag + ' placeholder' + (req.params.id ? ` (${req.params.id})` : ''))

const handleListCalendars = async (req, res) => {
  log(`Retrieving catalog for ${req.verified.uid}`)
  const result = await getCalendarList(req.verified.uid)
  res.json(result)
}

calendars.get = [delay, identifyCredentials, handleListCalendars]

const handleCreateCalendar = async (req, res) => {
  try {
    if (!req.body.key) {
      throw Error('No idempotency key specified.')
    }
    const result = await addCalendar({
      key: req.body.key,
      authorId: req.verified.uid,
      summary: req.body.summary || 'New Calendar',
    })
    res.json(result)
  } catch (e) {
    log('caught error in post handler:', e.message)
    res.status(400).json({ error: e.message })
  }
}

calendars.post = [delay, identifyCredentials, handleCreateCalendar]

const handleDeleteCalendar = async (req, res) => {
  // Authorization:
  // Bearer uid matches primary_author_id, etag matches current value
  // handled in query.
  try {
    if(!req.body.etag) { 
      throw Error('Missing etag.')
    }

    const result = await deleteCalendar({
      authorId: req.verified.uid,
      calendarId: req.params.calendarId,
      etag: req.body.etag,
    })
    res.json(result)
  } catch(e) {
    res.status(400).json({error: e.message })
  }
}

calendars.id.delete = [ delay, identifyCredentials, handleDeleteCalendar ]

calendars.put = placeholder('calendars put')

module.exports = { calendars }
