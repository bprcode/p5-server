const { identifyCredentials } = require('../shared/authorization')
const { listNotes, addNoteIdempotent } = require('../shared/database')
const { devLog } = require('../shared/logging')

const notebook = {}

const handleNotebookGet = (req, res) => {
  // Authorization: path-id = <bearer>
  if (req.verified.uid !== req.params.id) {
    devLog('denied: ', blue, req.verified.uid, ' !== ', yellow, req.params.id)
    return res.status(403).json({ error: 'Permission denied.' })
  }
  listNotes(req.params.id)
    .then(noteList => res.json(noteList))
    .catch(error => res.status(500).json({ error: error.message }))
}

notebook.get = [identifyCredentials, handleNotebookGet]

const handleNotebookPost = (req, res) => {
  // Authorization: path-id = <bearer>,
  //                body.key exists
  if (req.verified.uid !== req.params.id || !req.body.key) {
    log('denied note creation in ', pink, req.params.id)
    return res.status(403).json({ error: 'Permission denied.' })
  }

  addNoteIdempotent(req.body.key, req.verified.uid, {
    title: req.body.title,
    content: req.body.content,
  })
    .then(outcome => res.status(201).json(outcome))
    .catch(e => {
      log('Unable to complete note creation. ', yellow, e.message)
      res.status(500).json({ error: 'Unable to create note.' })
    })
}

notebook.post = [identifyCredentials, handleNotebookPost]

module.exports = { notebook }
