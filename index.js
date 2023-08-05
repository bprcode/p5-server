#!/usr/bin/env node
const express = require('express')
require('@bprcode/handy')
const app = express()
const port = 3000

app
  .get('/', (req, res) => {
    res.send('Welcome to the server')
    log('Served: ', req.originalUrl, blue)
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

log('End of index.js reached.')
