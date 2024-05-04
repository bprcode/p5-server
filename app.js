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
const { devLog, renderLog } = require('./shared/logging')
const { identifyCredentials } = require('./shared/authorization')

app
  .disable('x-powered-by')
  .use(express.json())
  .use(express.text())
  .use(cookieParser())

  .get('/hi', (req, res) => {
    res.send()
  })

  .get('/favicon.ico', (req, res) => {
    res.header('Cache-Control', 'max-age=604800')
    res.sendFile('internal-favicon.svg', {
      root: 'static/public',
    })
  })

  .get('/logs', [
    identifyCredentials,
    (req, res) => {
    // Authorization: uid = ADMIN_UID
    if(req.verified.uid === process.env.ADMIN_UID) {
      return res.send(renderLog())
    }
    res.send('Credential mismatch.')
  }])

  // Use logging on subsequent routes:
  .use('*', (req, res, next) => {
    devLog(
      new Date().toLocaleTimeString(),
      ` ${req.ip} ${req.protocol} ${req.method}`,
      yellow,
      ` ${req.originalUrl}`
    )
    next()
  })

  .use('/timeout', (req, res) => {})

  .get('/', (req, res) => {
    res.sendFile('public/index.html', {
      root: 'static',
      maxAge: 3600 * 1000,
    })
  })

  .use(express.static(path.join('static', 'public'), {
    maxAge: 604800 * 1000,
  }))

  .use([
    delay,
    (req, res, next) => {
      if (process.env.NODE_ENV === 'development') {
        res.set({
          'Access-Control-Allow-Origin': process.env.ACAO,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Headers': 'content-type',
          'Access-Control-Allow-Methods': 'POST, PUT, GET, OPTIONS, DELETE',
          'Access-Control-Max-Age': '3600',
        })

        if (req.method === 'OPTIONS') {
          return res.send()
        }
      }

      next()
    },
  ])

// API ROUTES _________________________________________________________________
const v1 = express.Router()
v1
  .use('*', (req, res, next) => {
    res.header('Cache-Control', 'no-cache, private')
    next()
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

// ERROR HANDLERS _____________________________________________________________
app
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
  if(process.env.NODE_ENV === 'development') {
    log('\n\n\n🔷 ', 'Development Environment', blue)
  } else {
    log('\n\n\n🟡 ', 'Production Environment', yellow)
  }
  const time = [new Date().toLocaleTimeString(), pink]
  log(...time, ' App listening on: ', server.address(), ' ' + moo())
})
