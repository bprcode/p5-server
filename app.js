#!/usr/bin/env node
require('dotenv').config({ path: '../.secret/token.env' })
const path = require('node:path')
const express = require('express')
const app = express()
const cookieParser = require('cookie-parser')
require('express-async-errors')
require('@bprcode/handy')
const indexRoutes = require('./routes/index.routes')
const usersRoutes = require('./routes/users.routes')
const notesRoutes = require('./routes/notes.routes')
const calendarsRoutes = require('./routes/calendars.routes')
const { SpecificError } = require('./shared/error-types')
const { delay } = require('./shared/shared')

function devLog(...args) {
  if (process.env.NODE_ENV === 'development') {
    log(...args)
  }
}

app
  .disable('x-powered-by')
  .use(express.json())
  .use(express.text())
  .use(cookieParser())

  .use([
    delay,
    (req, res, next) => {
      if (process.env.NODE_ENV === 'development') {
        res.set({
          'access-control-allow-origin': process.env.ACAO,
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'content-type',
          'access-control-allow-methods': 'POST, PUT, GET, OPTIONS, DELETE',
        })

        if (req.method === 'OPTIONS') {
          log('Serving options request...', blue)
          return res.send()
        }
      }

      next()
    },
  ])

  .get('/hi', (req, res) => {
    res.send()
  })

  .get('/favicon.ico', (req, res) => {
    res.sendFile('internal-favicon.svg', {
      root: 'static/public',
    })
  })

  // Use logging on subsequent routes:
  .use('*', (req, res, next) => {
    devLog(
      new Date().toLocaleTimeString(),
      ` ${req.method}`,
      yellow,
      ` ${req.originalUrl}`
    )
    next()
  })

  .use('/timeout', (req, res) => {})

  .use(express.static(path.join('static', 'public')))

// API ROUTES _________________________________________________________________
const v1 = express.Router()
v1.get('/hi', (req, res) => {
  res.send()
})
  .use(indexRoutes)
  .use('/users', usersRoutes)
  .use('/notes', notesRoutes)
  .use('/calendars', calendarsRoutes)

app.use('/api/v1', v1)

// NAVIGATION HANDLERS ________________________________________________________
app
  .get('/welcome', (req, res) => {
    devLog('Rerouting to welcome page: ', req.originalUrl, green)
    return res.sendFile('public/welcome.html', { root: 'static' })
  })

  .get('*', (req, res) => {
    devLog('Rerouting request to index: ', req.originalUrl, green)
    return res.sendFile('public/index.html', { root: 'static' })
  })

  // ERROR HANDLERS ___________________________________________________________
  .use((err, req, res, next) => {
    if (err instanceof SpecificError) {
      devLog('Handling specific error: ', err.name, blue, ' - ' + err.message)
      return res.status(err.code).json({
        error: err.message,
        conflict: err.conflict,
      })
    }

    log('Unrecognized error encountered: ', pink, err.message)
    log(err.stack)
    res.status(500).send('⚠️ Server Error:<br>' + err.message)
  })

const server = app.listen(process.env.PORT || 3000, () => {
  const time = [new Date().toLocaleTimeString(), pink]
  log(...time, ' App listening on: ', server.address(), ' ' + moo())
})
