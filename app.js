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

app
  .disable('x-powered-by')
  .use(express.json())
  .use(express.text())
  .use(cookieParser())

  // For development server only:
  .use((req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
      res.set({
        'access-control-allow-origin': process.env.ACAO,
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'POST, GET, OPTIONS, DELETE',
      })
    }

    next()
  })

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

  .use('/timeout', (req, res) => {})

  .use(
    express.static(
      path.join(
        'static',
        process.env.NODE_ENV === 'production' ? 'production' : 'development'
      )
    )
  )

  .use(indexRoutes)
  .use('/users', usersRoutes)
  .use('/notes', notesRoutes)
  .use('/calendars', calendarsRoutes)

  // ERROR HANDLERS ___________________________________________________________

  .get('*', (req, res) => {
    log('Resource not found: ', req.originalUrl, pink)
    res.status(404).sendFile('404.html', { root: 'static' })
  })

  .use((err, req, res, next) => {
    if (err instanceof SpecificError) {
      log('Handling SpecificError descendant: ', blue, err.name)
      return res.status(err.code).json({ error: err.message })
    }

    log('Unrecognized error encountered: ', pink, err.message)
    log(err.stack)
    res.status(500).send('⚠️ Server Error:<br>' + err.message)
  })

const server = app.listen(process.env.PORT || 3000, () => {
  const time = [new Date().toLocaleTimeString(), pink]
  log(...time, ' App listening on: ', server.address(), ' ' + moo())
})
