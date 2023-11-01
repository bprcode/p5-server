const express = require('express')
const router = express.Router()
const { notebook, catalog } = require('../controllers/users.controllers')

router
  .get('/:id/notebook', notebook.get)
  .post('/:id/notebook', notebook.post)
  .get('/catalog', catalog.get)
  .post('/catalog', catalog.post)
  .put('/catalog/:id', catalog.put)
  .delete('/catalog/:id', catalog.delete)

module.exports = router
