const { delay } = require('../shared/shared')
const { identifyCredentials } = require('../shared/authorization')
const {
  getCalendarList,
  addCalendar,
} = require('../shared/database')

const calendars = {}

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
calendars.put = placeholder('calendars put')
calendars.delete = placeholder('calendars delete')

module.exports = { calendars }
