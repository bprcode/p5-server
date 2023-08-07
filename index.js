#!/usr/bin/env node
require('dotenv').config({ path: '../.secret/token.env' })
const express = require('express')
const app = express()
require('express-async-errors')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const port = 3000
const { pool, getFoo, createLogin } = require('./database.js')
require('@bprcode/handy')
const { protect, requestToken, generateToken } = require('./authorization.js')

app
  .use(express.json())
  .use(express.text())

  .get('/', (req, res) => {
    res.send('Welcome to the server')
    log('Served: ', req.originalUrl, blue)
  })

  .get('/me', protect, async (req, res) => {
    res.send('🙋‍♂️ Hello ' + req.bearer.email)
  })
  
  // Create a new user
  .post('/register', async (req, res) => {
    const candidate = req.body
    log('Attempting to create ', blue, candidate)
    if (await createLogin(candidate)) {
      const token = generateToken(candidate.email)
      res.json(token)
    }
  })

  // Retrieve a bearer token
  .post('/login', async (req, res) => {
    const user = req.body
    log('Attempting login as ', user.email)
    const outcome = await requestToken(user.email, user.password)
    if (outcome) {
      return res.json(outcome)
    }

    res.status(401).send('🛑 Invalid credentials.')
  })

  .get('*', (req, res) => {
    res.status(404).send('❓ Not Found')
    log('Resource not found: ', req.originalUrl, pink)
  })

  .use((err, req, res, next) => {
    res.status(500).send('⚠️ Server Error:<br>' + err.message)
    log('Server error encountered: ', pink, err.message)
  })

const server = app.listen(port, () => {
  const time = [new Date().toLocaleTimeString(), pink]
  const listening = [' App listening on port ', server.address().port, yellow]
  log(...time, ...listening, ' ' + moo())
})
