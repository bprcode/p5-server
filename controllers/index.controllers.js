const {
  identifyCredentials,
  requestToken,
  setTokenCookie,
  cookieSeconds,
} = require('../shared/authorization')
const {
  transactRegistration,
  deleteRegistration,
} = require('../shared/database')
const { PermissionError, ConflictError } = require('../shared/error-types')

const me = {}
const login = {}
const register = {}

// Let the client know the state of its cookie:
me.get = [
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

    throw new PermissionError('Invalid credentials.')
  },
]

// Expire an identity token
login.delete = [
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

// Delete a user registration
register.delete = [
  identifyCredentials,
  (req, res) => {
    // Authorization: <bearer> exists
    log('Trying to delete registration: ', yellow, req.verified.uid)
    deleteRegistration(req.verified.uid)
      .then(() => res.send())
      .catch(e => {
        log('Failed to delete registration: ', yellow, e.message)
        res.status(500).json({ error: 'Failed to delete registration.' })
      })
  },
]

// Create a new user
register.post = [
  async (req, res) => {
    const { email, password } = req.body
    log('Attempting to create or use login: ', pink, email)

    // Attempt to register an account. Discard the result.
    await transactRegistration(req.body)

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
    throw new ConflictError('email already in use.')
  },
]

module.exports = { me, login, register }
