
let emulateLag = async () => {}

if (process.env.NODE_ENV === 'development') {
  log('In dev mode. Emulating lag.', pink)
  log(
    'Reminder: express-async-errors will pass control' +
      ' on middleware promise rejections!'
  )
  emulateLag = () =>
    new Promise(ok => {
      const delay = 1500 + 500 * Math.random()
      const dc = Math.random()
      const waitId = Math.random().toFixed(3) * 1000

      log(`(${waitId}) Delaying... dc = ${dc.toFixed(3)}`, pink)
      console.time(`(${waitId}) Delayed`)

      if (dc < 0.9) {
        setTimeout(() => {
          console.timeEnd(`(${waitId}) Delayed`)
          ok()
        }, delay)
      } else {
        log('🪩 Simulating disconnect')
      }
    })
}

async function acao(req, res, next) {
  res.set({
    'Access-Control-Allow-Origin': process.env.ACAO,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '300',
  })

  await emulateLag()

  next()
}

module.exports = { acao }
