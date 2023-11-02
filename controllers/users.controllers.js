const { delay } = require('../shared/shared')
const { identifyCredentials } = require('../shared/authorization')
const {
  listNotes,
  addNoteIdempotent,
  getCatalog,
} = require('../shared/database')

const notebook = {}
const catalog = {}
const placeholder = tag => (req, res) =>
  res
    .status(418)
    .send(tag + ' placeholder' + (req.params.id ? ` (${req.params.id})` : ''))

const handleNotebookGet = (req, res) => {
  // Validation: path-id = <bearer>
  if (req.verified.uid !== req.params.id) {
    log('denied: ', blue, req.verified.uid, ' !== ', yellow, req.params.id)
    return res.status(403).json({ error: 'Permission denied.' })
  }
  listNotes(req.params.id)
    .then(noteList => res.json(noteList))
    .catch(error => res.status(500).json({ error: error.message }))
}

notebook.get = [delay, identifyCredentials, handleNotebookGet]

const handleNotebookPost = (req, res) => {
  // Validation:  path-id = <bearer>,
  //              body.key exists
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

notebook.post = [delay, identifyCredentials, handleNotebookPost]

const handleCatalogGet = async (req, res) => {
  log(`Retrieving catalog for ${req.verified.uid}`)
  const result = await getCatalog(req.verified.uid)
  res.json(result)
}

catalog.get = [delay, identifyCredentials, handleCatalogGet]

const handleCatalogPost = (req, res) => {
  const foo = () => log('foo')
  try{
    foo(req.verified.uid)
  } catch(e) {
    log('caught error in post handler')
    res.status(400).json({error: 'Login required before adding calendar.'})
     
  }
}

catalog.post = [ delay, identifyCredentials, handleCatalogPost]
catalog.put = placeholder('catalog put')
catalog.delete = placeholder('catalog delete')

module.exports = { notebook, catalog }
