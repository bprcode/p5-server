const express = require('express')
const router = express.Router()
const { notebook } = require('../controllers/users.controllers')

router
  .get('/:id/notebook', notebook.get)
  .post('/:id/notebook', notebook.post)

module.exports = router
