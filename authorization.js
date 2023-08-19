require('@bprcode/handy')
const jwt = require('jsonwebtoken')
const { matchCredentials } = require('./database')

const cookieSeconds = 60 * 0.5

/**
 * Extract and verify the request's bearer token.
 * If verified, store the claims in req.verified.
 */
const identifyCredentials = async (req, res, next) => {
  if (!req.cookies.token) {
    log('❔ No cookie.')
    return res.status(401).json({ error: 'No identification provided.' })
  }

  // Otherwise, validate the token:
  try {
    const payload = jwt.verify(req.cookies.token, process.env.JWT_SECRET, {
      algorithms: ['HS512'],
    })

    // log('🗝️ Using values from payload: ', payload)
    req.verified = payload

    next()
  } catch (e) {
    log('❌ Verification failed: ', pink, e.message)
    req.verified = Object.create(null)

    if (e.message === 'jwt expired') {
      req.verified.expired = true

      // For any other reason...
    } else {
      req.verified.error = 'Invalid credentials.'
    }

    return next()
  }
}

// Return a bearer token if the password matches the stored hash
const requestToken = async (email, password) => {
  log('requesting token for ', email)
  const match = await matchCredentials(email, password)

  if (match) {
    log('💚 match succeeded, returning signed token')
    return { ...match, token: signToken(match) }
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
    expiresIn: cookieSeconds,
  })

  return token
}

module.exports = { identifyCredentials, requestToken, signToken, cookieSeconds }
