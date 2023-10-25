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

  .use(
    express.static(
      path.join(
        'static',
        process.env.NODE_ENV === 'production' ? 'production' : 'development'
      )
    )
  )

  .use(indexRoutes)
  .use(usersRoutes)
  .use(notesRoutes)

  // ERROR HANDLERS ___________________________________________________________

  .get('*', (req, res) => {
    log('Resource not found: ', req.originalUrl, pink)
    res.status(404).sendFile('404.html', { root: 'static' })
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
