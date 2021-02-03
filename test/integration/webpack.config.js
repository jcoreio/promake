var path = require('path')

module.exports = {
  context: __dirname,
  entry: './src/client/index.js',
  output: {
    path: path.resolve(__dirname, 'build', 'assets'),
    filename: 'client.bundle.js',
  },
}
