const express = require('express')
const router = express.Router()
const { calendars } = require('../controllers/calendars.controllers')

router
  .use('/', calendars.all)
  .get('/', calendars.get)
  .post('/', calendars.post)
  .put('/:id', calendars.id.put)
  .delete('/:id', calendars.id.delete)
  .get('/:id/events', calendars.id.events.get)
  .post('/:id/events', calendars.id.events.post)
  .put('/events/:id', calendars.events.id.put)
  .delete('/events/:id', calendars.events.id.delete)
  .post('/:id/events[:]batchUpdate', calendars.id.events.batchUpdate)

module.exports = router
