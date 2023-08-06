const {Pool} = require('pg')

const pool = new Pool()

async function getFoo () {
  const result = await pool.query('SELECT * FROM foo')
  return result.rows
}

module.exports = {pool, getFoo}
