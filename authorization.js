require('@bprcode/handy')
const jwt = require('jsonwebtoken')
const { matchCredentials } = require('./database')

const protect = async (req, res, next) => {
  try {
    log('protecting ', req.method, ' to ', req.originalUrl)
    const bearer = req.headers.authorization.split(/bearer /i)[1]

    const payload = jwt.verify(bearer, process.env.JWT_SECRET, {
      algorithms: ['HS512'],
    })

    log('Using values from payload: ', payload)
    req.bearer = payload

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
  const match = await matchCredentials(email, password)

  if (match) {
    return signToken(match)
  }

  return false
}

const signToken = claims => {
  const sanitized = {
    email: claims.email,
    name: claims.name,
    uid: claims.uid,
  }

  const token = jwt.sign(sanitized, process.env.JWT_SECRET, {
    algorithm: 'HS512',
    expiresIn: '120s',
  })

  return token
}

module.exports = { protect, requestToken, signToken }
