const { delay } = require('../shared/shared')
const {
  identifyCredentials,
  requestToken,
  setTokenCookie,
  cookieSeconds,
} = require('../shared/authorization')
const { transactRegistration } = require('../shared/database')

const me = {}
const login = {}
const register = {}

// Let the client know the state of its cookie:
me.get = [
  delay,
  (req, res, next) => {
    if (!req.cookies.token) {
      log('User had no cookie; must login to proceed.')
      return res.status(400).json({ notice: 'Awaiting login.' })
    }
    next()
  },
  identifyCredentials,
  (req, res) => {
    log('🙋‍♀️ identifying user')
    res.json(req.verified)
  },
]

// Retrieve an identity token
login.post = [
  delay,
  async (req, res) => {
    const { email, password } = req.body
    log(new Date().toLocaleTimeString(), ' Received login post request', pink)
    log('Attempting login as ', email)
    const outcome = await requestToken(email, password)
    if (outcome) {
      setTokenCookie(res, outcome.token)
      return res.json({
        uid: outcome.uid,
        name: outcome.name,
        email: outcome.email,
        ttl: cookieSeconds * 1000,
      })
    }

    res.status(403).send({ error: 'Invalid credentials.' })
  },
]

// Expire an identity token
login.delete = [
  delay,
  (req, res) => {
    log('🧼 sending login-delete', pink)
    return res
      .cookie('token', '', {
        httpOnly: true,
        sameSite: 'Strict',
        secure: process.env.NODE_ENV !== 'development',
        expires: new Date(0),
      })
      .json({})
  },
]

// Create a new user
register.post = [
  delay,
  async (req, res) => {
    const { email, password } = req.body
    log('Attempting to create or use login: ', pink, email)

    try {
      // Attempt to register an account. Discard the result.
      await transactRegistration(req.body)
    } catch (e) {
      log('encountered registration error: ', e.message)
    }

    // Regardless of success, try to log in using the provided credentials:
    const outcome = await requestToken(email, password)
    if (outcome) {
      log('Successful creation or use: ', green, email)
      setTokenCookie(res, outcome.token)
      return res.json({
        uid: outcome.uid,
        name: outcome.name,
        email: outcome.email,
        ttl: cookieSeconds * 1000,
      })
    }

    log('Unable to use: ', pink, email)
    res.status(409).json({ error: 'email already in use.' })
  },
]

module.exports = { me, login, register }
