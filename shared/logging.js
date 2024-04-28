function devLog(...args) {
  if (process.env.NODE_ENV === 'development') {
    return log(...args)
  }
}

module.exports = { devLog }
