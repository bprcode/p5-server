const express = require('express')
const router = express.Router()
const { notes } = require('../controllers/notes.controllers')

router
  .get('/:id', notes.get)
  .put('/:id', notes.put)
  .delete('/:id', notes.delete)

module.exports = router
