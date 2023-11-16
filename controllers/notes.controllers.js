const { identifyCredentials } = require('../shared/authorization')
const { updateNote, getNote, deleteNote } = require('../shared/database')

const notes = {}

const handleGet = (req, res) => {
  // Authorization: author = <bearer>, handled in query
  getNote({ noteId: req.params.id, authorId: req.verified.uid })
    .then(user => res.json(user))
    .catch(error => res.status(403).json({ error: error.message }))
}

notes.get = [identifyCredentials, handleGet]

const handlePut = (req, res) => {
  // Authorization: author = <bearer>, handled in query
  updateNote({
    noteId: req.params.id,
    authorId: req.verified.uid,
    content: req.body.content,
    title: req.body.title,
  })
    .then(result => res.json(result))
    .catch(() => {
      res.status(403).json({ error: 'Update denied.' })
    })
}

notes.put = [identifyCredentials, handlePut]

const handleDelete = (req, res) => {
  // Authorization: author = <bearer>, handled in query
  deleteNote({
    noteId: req.params.id,
    authorId: req.verified.uid,
  })
    .catch(() => {}) // no-op
    .finally(() => res.status(200).json({ notice: 'Request received.' }))
}

notes.delete = [identifyCredentials, handleDelete]

module.exports = { notes }
