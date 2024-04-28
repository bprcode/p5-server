const { deleteOldIdempotencies } = require('./database')

let emulateLag = async () => {}

if (process.env.NODE_ENV === 'development') {
  if (process.argv.includes('-nolag')) {
    devLog('Disabling lag emulation.', pink)
  } else {
    devLog('In dev mode. Emulating lag.', pink)
    devLog(
      'Reminder: express-async-errors will pass control' +
        ' on middleware promise rejections!'
    )
    emulateLag = () =>
      new Promise(ok => {
        const delay = 500 + 3000 * Math.random()
        const dc = Math.random()
        const waitId = Math.random().toFixed(3) * 1000

        devLog(`(${waitId}) Delaying... dc = ${dc.toFixed(3)}`, pink)
        console.time(`(${waitId}) Delayed`)

        if (dc < 0.9) {
          setTimeout(() => {
            console.timeEnd(`(${waitId}) Delayed`)
            ok()
          }, delay)
        } else {
          console.timeEnd(`(${waitId}) Delayed`)
          devLog('🪩 Simulating disconnect')
        }
      })
  }
}

async function delay(req, res, next) {
  await emulateLag()
  next()
}

async function creationMaintenance(req, res, next) {
  // Periodically prune old records:
  if (Math.random() < 0.05) {
    log('deleting old records')
    await deleteOldIdempotencies()
  }
  next()
}

function devLog(...args) {
  if (process.env.NODE_ENV === 'development') {
    return log(...args)
  }
}

module.exports = { delay, creationMaintenance, devLog }
