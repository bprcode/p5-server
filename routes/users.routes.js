const express = require('express')
const router = express.Router()
const { users, notebook } = require('../controllers/users.controllers')

router
  .get('/:id/notebook', notebook.get)
  .post('/:id/notebook', notebook.post)
  .delete('/:id', users.delete)

module.exports = router
