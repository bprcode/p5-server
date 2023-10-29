const express = require('express')
const router = express.Router()
const { login, register, me } = require('../controllers/index.controllers')

router
  .get('/me', me.get)
  .post('/register', register.post)
  .delete('/register', register.delete)
  .post('/login', login.post)
  .delete('/login', login.delete)

module.exports = router
