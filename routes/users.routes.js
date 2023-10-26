const express = require('express')
const router = express.Router()
const { users } = require('../controllers/users.controllers')

router
  .get('/:id/notebook', users.get)
  .post('/:id/notebook', users.post)

module.exports = router
