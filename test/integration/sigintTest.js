/* eslint-disable no-console */

const fs = require('fs')
const file = process.argv[2]

fs.writeFileSync(file, `${__filename}:${new Date().toISOString()}`, 'utf8')

const timeout = setTimeout(() => {}, 60000)

process.on('SIGINT', async () => {
  if (process.argv.indexOf('--hang') >= 0) return
  clearTimeout(timeout)
  fs.unlinkSync(file)
  process.exit(0)
})
