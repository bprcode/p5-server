#!/usr/bin/env node
require('@bprcode/handy')
require('dotenv').config({ path: '../.secret/token.env' })
const express = require('express')
const app = express()
require('express-async-errors')
const port = 3000
const { pool, getFoo } = require('./database.js')

log({ FOO: process.env.FOO }, { BAR: process.env.BAR })

app
  .get('/', (req, res) => {
    res.send('Welcome to the server')
    log('Served: ', req.originalUrl, blue)
  })
  .get('/foo', async (req, res)=> {
    log('Acquiring Foo.......')
    const foo = await getFoo()
    res.json(foo)
  })
  .get('/slow', async (req, res) => {
    log('🐢 Making request s l o w l y ...')
    await new Promise(k => setTimeout(k, 10000))
    log('⏰ Slow request done!')
    res.send('That sure was a slow request.')
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

process.on('exit', () => {
  log('exit handler triggered~', pink)
})
process.on('SIGINT', () => {
  log('SIGINT handler triggered~', pink)
  process.exit(2)
})
