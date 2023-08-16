#!/usr/bin/env node
require('dotenv').config({ path: '../.secret/token.env' })
const express = require('express')
const app = express()
const cookieParser = require('cookie-parser')
require('express-async-errors')
const port = 3000
const {
  createLogin,
  getNote,
  addNote,
  updateNote,
  listNotes,
} = require('./database.js')
require('@bprcode/handy')
const {
  identifyCredentials,
  requestToken,
  signToken,
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

function setTokenCookie(res, token) {
  return res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: process.env.NODE_ENV !== 'development',
    maxAge: 2 * 60 * 1000,
  })
}

app
  .disable('x-powered-by')
  .use(express.json())
  .use(express.text())
  .use(cookieParser())

  .use('*', (req, res, next) => {
    log(
      new Date().toLocaleTimeString(),
      ` ${req.method}`,
      yellow,
      ` ${req.originalUrl}`
    )
    next()
  })

  // PUBLIC ROUTES ____________________________________________________________

  .get('/', (req, res) => {
    res.send('Welcome to the server')
    log('Served: ', req.originalUrl, blue)
  })

  .get('/me', acao, identifyCredentials, (req, res) => {
    log('🙋‍♀️ identifying user')
    if (req.verified.expired) {
      return res.json({ error: 'Expired credentials' })
    } else if (req.verified.error) {
      return res.status(400).json(req.verified)
    }

    res.json(req.verified)
  })

  .get('/cookie', acao, (req, res) => {
    const cid = (Math.random() * 100).toFixed(0)
    log(`Sending cookie ${cid} 🍪`)
    // res.set({
    //   'Set-Cookie':
    //     `chocolate=tasty` +
    //     ` ${cid};` +
    //     ` Max-Age=120; SameSite=Strict; HttpOnly`,
    // })
    setTokenCookie(res, 'strawberry')
    res.send('chocolate chip')
  })

  .get('/check', acao, (req, res) => {
    log('☑️ Checking headers:')
    log(req.headers)
    log('req.cookies = ', req.cookies)
    res.send(':)')
  })

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
    res.send()
  })

  .options('/notes/:id', acao, async (req, res) => {
    res.set({
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'PUT',
    })
    res.send()
  })

  // Create a new user
  .post('/register', acao, async (req, res) => {
    const candidate = req.body

    try {
      const claims = await createLogin(candidate)
      const signed = signToken(claims)
      setTokenCookie(res, signed)
      res.json(claims)
    } catch (e) {
      if (e.message.match('email already in use')) {
        res.status(400).json({ error: 'email already in use.' })
      } else {
        res.status(500).json({ error: 'Server error.' })
      }
    }
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
    // Validation: path-id = <bearer>
    if (req.verified.uid !== req.params.id) {
      log('denied: ', blue, req.verified.uid, ' !== ', yellow, req.params.id)
      return res.status(401).json({ error: 'Permission denied.' })
    }

    addNote({
      author: req.params.id,
      content: req.body.content,
      title: req.body.title,
    })
      .then(posted => {
        log('successfully returned ', posted)
        res.json(posted)
      })
      .catch(error => {
        log('insert error: ', error.message)
        res.json({ error: error.message })
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
    log('Applying updates: ', yellow, req.body.content, ', ', req.body.title)
    // Validation: author = <bearer>, handled in query
    updateNote({
      noteId: req.params.id,
      authorId: req.verified.uid,
      content: req.body.content,
      title: req.body.title,
    })
      .then(result => res.json(result))
      .catch(error => res.status(401).json({ error: error.message }))
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

const server = app.listen(port, () => {
  const time = [new Date().toLocaleTimeString(), pink]
  const listening = [
    ' App listening on: http://localhost:' + server.address().port,
  ]
  log(...time, ...listening, ' ' + moo())
})
