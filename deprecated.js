/* No longer in use; not hosting cross-origin: */

// .options('/register', acao, async (req, res) => {
  //   res.set({
  //     'Access-Control-Allow-Headers': 'Content-Type',
  //   })
  //   res.send()
  // })

  // .options('/login', acao, async (req, res) => {
  //   res.set({
  //     'Access-Control-Allow-Headers': 'Content-Type',
  //     'Access-Control-Allow-Methods': 'DELETE',
  //   })
  //   res.send()
  // })

  // .options('/users/:id/notebook', acao, async (req, res) => {
  //   res.set({
  //     'Access-Control-Allow-Headers': 'Content-Type',
  //   })
  //   res.send()
  // })

/* Access control header not needed when same-origin: */  

// async function acao(req, res, next) {
//   res.set({
//     'Access-Control-Allow-Origin': process.env.ACAO,
//     'Access-Control-Allow-Credentials': 'true',
//     'Access-Control-Max-Age': '300',
//   })

//   await emulateLag()

//   next()
// }

