#!/usr/bin/env node
require('dotenv').config({ path: '../.secret/token.env' })
const express = require('express')
const app = express()
require('express-async-errors')
const port = 3000
const { createLogin, addMockUser } = require('./database.js')
require('@bprcode/handy')
const { protect, requestToken, signToken } = require('./authorization.js')

function acao(headers) {
  return (req, res, next) => {
    res.set({
      'Access-Control-Allow-Origin': process.env.ACAO,
      'Access-Control-Max-Age': '3000',
      ...headers,
    })
    next()
  }
}

app
  .disable('x-powered-by')
  .use(express.json())
  .use(express.text())

  .get('/', (req, res) => {
    res.send('Welcome to the server')
    log('Served: ', req.originalUrl, blue)
  })

  .get('/mocku', async (req, res) => {
    await addMockUser()
    res.send('ok')
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

  .options(
    '/login',
    acao({ 'Access-Control-Allow-Headers': 'Content-Type' }),
    async (req, res) => {
      res.send()
    }
  )

  // Retrieve a bearer token
  .post('/login', acao(), async (req, res) => {
    const { email, password } = req.body
    log(
      new Date().toLocaleTimeString(),
      ' Received login post request with body:',
      pink
    )
    console.log(req.body)
    log('Attempting login as ', email)
    const outcome = await requestToken(email, password)
    if (outcome) {
      return res.json({ token: outcome })
    }

    res.status(401).send({ error: 'Invalid credentials.' })
  })

  .options('/mock', acao(), (req, res) => {
    log('Preflight request received: ', yellow, req.originalUrl)
    res.set({
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.send()
  })

  .post('/mock', acao(), protect, (req, res) => {
    log('/mock ', yellow, ' obeying post from bearer=', req.bearer.name)

    res.send('👍 nice post man')
  })

  .get('/ping', acao(), (req, res) => {
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
