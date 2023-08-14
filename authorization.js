require('@bprcode/handy')
const jwt = require('jsonwebtoken')
const { matchCredentials } = require('./database')

/**
 * Extract and verify the request's bearer token.
 * If verified, store the claims in req.bearer.
 */
const identifySource = async (req, res, next) => {
  log('req.bearer was initially ', blue, req.bearer)
  if (!req.headers.authorization) {
    log('👻 No authorization provided. Assigning empty record.')
    req.bearer = {}
    return next()
  }

  // Otherwise, validate the token:
  try {
    log('identifying source of ', req.method, ' to ', req.originalUrl)
    const bearer = req.headers.authorization.split(/bearer /i)[1]

    const payload = jwt.verify(bearer, process.env.JWT_SECRET, {
      algorithms: ['HS512'],
    })

    log('🗝️ Using values from payload: ', payload)
    req.bearer = payload

    next()
  } catch (e) {
    req.bearer = {}
    if (e.message === 'jwt expired') { req.bearer.expired = true }
    log('❌ Verification failed: ', pink, e.message)
    log('Assigning empty record.')
    return next()
  }
}

// Return a bearer token if the password matches the stored hash
const requestToken = async (email, password) => {
  log('requesting token for ', email)
  const match = await matchCredentials(email, password)

  if (match) {
    log('💚 match succeeded, returning signed token')
    return signToken(match)
  }
  log('😡 match failed, returning false')

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
    expiresIn: '10m',
  })

  return token
}

module.exports = { identifySource, requestToken, signToken }
