require('@bprcode/handy')
const jwt = require('jsonwebtoken')
const { testCredentials } = require('./database')

const protect = async (req, res, next) => {
  try {
    const bearer = req.headers.authorization.split(/bearer /i)[1]

    const payload = jwt.verify(bearer, process.env.JWT_SECRET, {
      algorithms: ['HS512'],
    })

    log('Using value from payload: ', payload)
    req._email = payload.email

    log('🗝️ Good token. Allowed.')
    next()
  } catch (e) {
    log('Verification failed: ', pink, e.message)
    res
      .status(401) // Not Authorized
      .send(`🔒 Access Denied.`)
  }
}

// Return a bearer token if the password matches the stored hash
const requestToken = async (email, password) => {
  log('requesting token for ', email)
  if (await testCredentials(email, password)) {
    return generateToken(email)
  }

  return false
}

const generateToken = email => {
  const token = jwt.sign({ email }, process.env.JWT_SECRET, {
    algorithm: 'HS512',
    expiresIn: '3000s',
  })

  return token
}

module.exports = { protect, requestToken, generateToken }
