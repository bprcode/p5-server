#!/usr/bin/env node
require('dotenv').config({ path: '../.secret/token.env' })
const express = require('express')
const app = express()
const cookieParser = require('cookie-parser')
require('express-async-errors')
const {
  getNote,
  updateNote,
  deleteNote,
  addNoteIdempotent,
  listNotes,
  transactRegistration,
} = require('./database.js')
require('@bprcode/handy')
const {
  identifyCredentials,
  requestToken,
  cookieSeconds,
  setTokenCookie,
} = require('./authorization.js')

let emulateLag = async () => {}

if (process.env.NODE_ENV === 'development') {
  log('In dev mode. Emulating lag.', pink)
  log(
    'Reminder: express-async-errors will pass control' +
      ' on middleware promise rejections!'
  )
  emulateLag = () =>
    new Promise(ok => {
      const delay = 1500 + 500 * Math.random()
      const dc = Math.random()
      log('dc=', dc)
      if (dc < 0.9) {
        setTimeout(ok, delay)
      } else {
        log('🪩 Simulating disconnect')
      }
    })
}

async function acao(req, res, next) {
  res.set({
    'Access-Control-Allow-Origin': process.env.ACAO,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '300',
  })
  log('About to await...', pink)
  await emulateLag()
  log('Await completed.', green)

  next()
}

async function acaoNoLag(req, res, next) {
  res.set({
    'Access-Control-Allow-Origin': process.env.ACAO,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '300',
  })

  next()
}

app
  .disable('x-powered-by')
  .use(express.json())
  .use(express.text())
  .use(cookieParser())

  // PUBLIC ROUTES ____________________________________________________________

  .get('/hi', (req, res) => {
    res.send()
  })

  // Use logging on subsequent routes:
  .use('*', (req, res, next) => {
    log(
      new Date().toLocaleTimeString(),
      ` ${req.method}`,
      yellow,
      ` ${req.originalUrl}`
    )
    next()
  })

  .get('/', (req, res) => {
    res.send('Welcome to the server')
    log('Served: ', req.originalUrl, blue)
  })

  // Let the client know the state of its cookie:
  .get(
    '/me',
    acao,
    (req, res, next) => {
      if (!req.cookies.token) {
        log('User had no cookie; must login to proceed.')
        return res.status(400).json({ notice: 'Awaiting login.' })
      }
      next()
    },
    identifyCredentials,
    (req, res) => {
      log('🙋‍♀️ identifying user')
      res.json(req.verified)
    }
  )

  .options('/register', acao, async (req, res) => {
    res.set({
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.send()
  })

  .options('/login', acao, async (req, res) => {
    res.set({
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'DELETE',
    })
    res.send()
  })

  .options('/users/:id/notebook', acao, async (req, res) => {
    res.set({
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.send()
  })

  .options('/notes/:id', acao, async (req, res) => {
    res.set({
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'PUT, DELETE',
    })
    res.send()
  })

  // Create a new user
  .post('/register', acao, async (req, res) => {
    const { email, password } = req.body
    log('Attempting to create or use login: ', pink, email)

    try {
      // Attempt to register an account. Discard the result.
      await transactRegistration(req.body)

    } catch (e) {
      log('encountered registration error: ', e.message)
    }

    // Regardless of success, try to log in using the provided credentials:
    const outcome = await requestToken(email, password)
    if (outcome) {
      log('Successful creation or use: ', green, email)
      setTokenCookie(res, outcome.token)
      return res.json({
        uid: outcome.uid,
        name: outcome.name,
        email: outcome.email,
        ttl: cookieSeconds * 1000,
      })
    }

    log('Unable to use: ', pink, email)
    res.status(400).json({ error: 'email already in use.' })
  })

  // Retrieve an identity token
  .post('/login', acaoNoLag, async (req, res) => {
    const { email, password } = req.body
    log(new Date().toLocaleTimeString(), ' Received login post request', pink)
    log('Attempting login as ', email)
    const outcome = await requestToken(email, password)
    if (outcome) {
      log('providing token and credentials from:', blue, outcome)
      setTokenCookie(res, outcome.token)
      return res.json({
        uid: outcome.uid,
        name: outcome.name,
        email: outcome.email,
        ttl: cookieSeconds * 1000,
      })
    }

    res.status(401).send({ error: 'Invalid credentials.' })
  })

  // Expire an identity token
  .delete('/login', acao, (req, res) => {
    log('🧼 sending login-delete', pink)
    return res
      .cookie('token', '', {
        httpOnly: true,
        sameSite: 'Strict',
        secure: process.env.NODE_ENV !== 'development',
        expires: new Date(0),
      })
      .json({})
  })

  // SECURED ROUTES ___________________________________________________________

  // Set Access-Control-Allow-Origin, Access-Control-Allow-Credentials,
  // and extract verified fields from cookie token:
  .use('*', acao, identifyCredentials)
  .use('*', (req, res, next) => {
    if (req.verified.expired) {
      return res.status(401).json({ error: 'Token expired.' })
    }
    next()
  })

  // users routes
  .get('/users/:id/notebook', async (req, res) => {
    // Validation: path-id = <bearer>
    if (req.verified.uid !== req.params.id) {
      log('denied: ', blue, req.verified.uid, ' !== ', yellow, req.params.id)
      return res.status(401).json({ error: 'Permission denied.' })
    }
    listNotes(req.params.id)
      .then(noteList => res.json(noteList))
      .catch(error => res.status(500).json({ error: error.message }))
  })

  .post('/users/:id/notebook', async (req, res) => {
    // Validation:  path-id = <bearer>,
    //              body.key exists
    if (req.verified.uid !== req.params.id || !req.body.key) {
      log('denied note creation in ', pink, req.params.id)
      return res.status(401).json({ error: 'Permission denied.' })
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
  })

  // notes routes
  .get('/notes/:id', (req, res) => {
    // Validation: author = <bearer>, handled in query
    getNote({ noteId: req.params.id, authorId: req.verified.uid })
      .then(user => res.json(user))
      .catch(error => res.status(401).json({ error: error.message }))
  })

  .put('/notes/:id', (req, res) => {
    // Validation: author = <bearer>, handled in query
    updateNote({
      noteId: req.params.id,
      authorId: req.verified.uid,
      content: req.body.content,
      title: req.body.title,
    })
      .then(result => res.json(result))
      .catch(error => res.status(401).json({ error: 'Update denied.' }))
  })

  .delete('/notes/:id', async (req, res) => {
    // Validation: author = <bearer>, handled in query
    deleteNote({
      noteId: req.params.id,
      authorId: req.verified.uid,
    })
      .catch(() => {}) // no-op
      .finally(() => res.status(200).json({ notice: 'Request received.'}))
  })

  .get('*', (req, res) => {
    res.status(404).send('❓ Not Found')
    log('Resource not found: ', req.originalUrl, pink)
  })

  .use((err, req, res, next) => {
    res.status(500).send('⚠️ Server Error:<br>' + err.message)
    log('Server error encountered: ', pink, err.message)
    log(err.stack)
  })

const server = app.listen(process.env.PORT || 3000, () => {
  const time = [new Date().toLocaleTimeString(), pink]
  log(...time, ' App listening on: ', server.address(), ' ' + moo())
})
