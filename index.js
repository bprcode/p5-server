#!/usr/bin/env node
require('dotenv').config({ path: '../.secret/token.env' })
const express = require('express')
const app = express()
require('express-async-errors')
const port = 3000
const {
  createLogin,
  addMockUser,
  getUser,
  getNote,
  addNote,
  listNotes,
} = require('./database.js')
require('@bprcode/handy')
const { protect, requestToken, signToken } = require('./authorization.js')

function acao(req, res, next) {
  res.set({
    'Access-Control-Allow-Origin': process.env.ACAO,
    'Access-Control-Max-Age': '3000',
  })
  next()
}

app
  .disable('x-powered-by')
  .use(express.json())
  .use(express.text())

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

  .post('/mockuser', async (req, res) => {
    await addMockUser()
    res.send('ok ' + moo())
  })

  .post('/mocknote', async (req, res) => {
    await addNote(
      '164dccb6-68c9-42ce-838b-9992b0fd2842',
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
        'Maecenas sed ipsum posuere, congue urna ut, iaculis magna. ' +
        'In hac habitasse platea dictumst. Sed ac ligula in velit ' +
        'commodo ullamcorper.'
    )
    res.send('thanks for the thoughtful note ' + moo())
  })

  .get('/users*', (req, res, next) => {
    log('(users middleware -- protect this route later)')
    next()
  })

  .get('/users/:id', (req, res) => {
    log('got users request for', green, req.params.id)
    getUser(req.params.id)
      .then(user => res.json(user))
      .catch(error => res.json({ error: error.message }))
  })

  .get('/users/:id/notebook', acao, async (req, res) => {
    log('got notebook request for ', blue, req.params.id)
    listNotes(req.params.id)
      .then(noteList => res.json(noteList))
      .catch(error => res.json({ error: error.message }))
  })

  .get('/notes*', (req, res, next) => {
    log('(notes middleware -- protect this route later)')
    next()
  })

  .get('/notes/:id', (req, res) => {
    getNote(req.params.id)
      .then(user => res.json(user))
      .catch(error => res.json({ error: error.message }))
  })

  .get('/me', protect, async (req, res) => {
    res.send('🙋‍♂️ Hello ' + req.bearer.name + ` (${req.bearer.email})`)
  })

  // Create a new user
  .post('/register', async (req, res) => {
    const candidate = req.body
    log('Attempting to create ', blue, candidate)

    const claims = await createLogin(candidate)
    const token = signToken(claims)
    res.json(token)
  })

  .options('/login', acao, async (req, res) => {
    res.set({ 'Access-Control-Allow-Headers': 'Content-Type' })
    res.send()
  })

  // Retrieve a bearer token
  .post('/login', acao, async (req, res) => {
    const { email, password } = req.body
    log(new Date().toLocaleTimeString(), ' Received login post request', pink)
    log('Attempting login as ', email)
    const outcome = await requestToken(email, password)
    if (outcome) {
      return res.json({ token: outcome })
    }

    res.status(401).send({ error: 'Invalid credentials.' })
  })

  .options('/mock', acao, (req, res) => {
    log('Preflight request received: ', yellow, req.originalUrl)
    res.set({
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.send()
  })

  .post('/mock', acao, protect, (req, res) => {
    log('/mock ', yellow, ' obeying post from bearer=', req.bearer.name)

    res.send('👍 nice post man')
  })

  .get('/ping', acao, (req, res) => {
    log('Got ping request with headers:', blue)
    log(req.headers)

    res.send(moo() + ' pong!')
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
