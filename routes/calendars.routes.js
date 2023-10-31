const express = require('express')
const router = express.Router()
const { calendars } = require('../controllers/calendars.controllers')

router
  .get('/:id', calendars.get)
  .post('/', calendars.post)
  .put('/:id', calendars.put)
  .delete('/:id', calendars.delete)

module.exports = router
