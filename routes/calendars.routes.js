const express = require('express')
const router = express.Router()
const { calendars } = require('../controllers/calendars.controllers')

router
  .get('/', calendars.get)
  .post('/', calendars.post)
  .put('/:id', calendars.id.put)
  .delete('/:id', calendars.id.delete)
  .get('/:id/events', calendars.id.events.get)
  .post('/:id/events', calendars.id.events.post)
  .put('/:calendarId/events/:eventId', calendars.id.events.id.put)
  .delete('/:calendarId/events/:eventId', calendars.id.events.id.delete)

module.exports = router
