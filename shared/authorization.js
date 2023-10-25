require('@bprcode/handy')
const jwt = require('jsonwebtoken')
const { matchCredentials } = require('./database')

const cookieSeconds = 60 * 2

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

    req.verified = payload

    if ((req.verified.exp - Date.now() / 1000) / cookieSeconds < 0.5) {
      refreshCookie(res, req.verified)
    }
  } catch (e) {
    log('❌ Verification failed: ', pink, e.message)

    if (e.message === 'jwt expired') {
      return res.status(401).json({ error: 'Token expired.' })
    }
    // For any other error...
    return res.status(403).json({ error: 'Invalid credentials.' })
  }

  next()
}

/**
 * Generate a fresh session cookie -- assumes claims have been verified
 */
function refreshCookie(res, verified) {
  const token = signToken(verified)
  setTokenCookie(res, token)
}

// Return a bearer token if the password matches the stored hash
const requestToken = async (email, password) => {
  log('requesting token for ', email)
  const match = await matchCredentials(email, password)

  if (match) {
    log('💚 match succeeded, returning signed token', green)
    return { ...match, token: signToken(match) }
  }
  log('😡 match failed, returning false', pink)

  return false
}

/**
 * Produce a signed token -- assumes claims have been verified
 */
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

function setTokenCookie(res, token) {
  return res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: process.env.NODE_ENV !== 'development',
    maxAge: cookieSeconds * 1000,
  })
}

module.exports = {
  identifyCredentials,
  requestToken,
  cookieSeconds,
  setTokenCookie,
}
