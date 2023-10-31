const calendars = {}

const placeholder = tag => (req, res) =>
  res
    .status(418)
    .send(tag + ' placeholder' + (req.params.id ? ` (${req.params.id})` : ''))

calendars.get = placeholder('get')
calendars.post = placeholder('post')
calendars.put = placeholder('put')
calendars.delete = placeholder('delete')

module.exports = { calendars }
