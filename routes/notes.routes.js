const express = require('express')
const { delay } = require('../shared/shared')
const { identifyCredentials } = require('../shared/authorization')
const { updateNote, getNote, deleteNote } = require('../shared/database')
const router = express.Router()

router
  // notes routes
  .get('/notes/:id', delay, identifyCredentials, (req, res) => {
    // Validation: author = <bearer>, handled in query
    getNote({ noteId: req.params.id, authorId: req.verified.uid })
      .then(user => res.json(user))
      .catch(error => res.status(403).json({ error: error.message }))
  })

  .put('/notes/:id', delay, identifyCredentials, (req, res) => {
    // Validation: author = <bearer>, handled in query
    updateNote({
      noteId: req.params.id,
      authorId: req.verified.uid,
      content: req.body.content,
      title: req.body.title,
    })
      .then(result => res.json(result))
      .catch(error => res.status(403).json({ error: 'Update denied.' }))
  })

  .delete('/notes/:id', delay, identifyCredentials, async (req, res) => {
    // Validation: author = <bearer>, handled in query
    deleteNote({
      noteId: req.params.id,
      authorId: req.verified.uid,
    })
      .catch(() => {}) // no-op
      .finally(() => res.status(200).json({ notice: 'Request received.' }))
  })

module.exports = router
