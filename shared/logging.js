const logBufferSize = 100
const logBuffer = []
const startTime = new Date()

function bodyTemplate(body) {
  return (
    `<body style="background-color:#111;color:#ddd;` +
    `font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;` +
    `padding-top:4rem;"><div style="width:80ch;margin:auto;` +
    `max-height:80vh;overflow:scroll;">` +
    body +
    `</div></body>`
  )
}

function devLog(...args) {
  logBuffer.push(args)
  while (logBuffer.length > logBufferSize) {
    logBuffer.shift()
  }

  if (process.env.NODE_ENV === 'development') {
    return log(...args)
  }
}

function renderMessage(message) {
  let i = 0
  const colorized = []
  const colors = {
    [pink]: 'lightcoral',
    [blue]: 'dodgerblue',
    [yellow]: 'orange',
    [green]: 'lightgreen',
  }

  for (part of message) {
    if (typeof part === 'symbol' && i > 0) {
      colorized[i - 1] = `<span style="color:${colors[part]};">${
        colorized[i - 1]
      }</span>`
    } else {
      colorized.push(part)
      i++
    }
  }
  return colorized.join('')
}

function renderLog() {
  const uptime = new Date() - startTime
  return bodyTemplate(
    `<h3>Uptime: ${Math.floor(uptime / 1000 / 60 / 60 / 24)}d` +
      ` ${Math.floor(uptime / 1000 / 60 / 60) % 60}h` +
      ` ${Math.floor(uptime / 1000 / 60) % 60}m` +
      ` ${Math.floor(uptime / 1000) % 60}s </h3>` +
      `<ul style="list-style-type:none;padding:0;">${logBuffer
        .map(
          (m, i) =>
            `<li style="padding:4px;background-color:#${
              i % 2 ? '112' : '223'
            };">${renderMessage(m)}</li>`
        )
        .join('')}</ul><div id="last"></div>`
  )
}

module.exports = { devLog, renderLog }
