try {
  module.exports = require('./package.json')
} catch (error) {
  module.exports = require('../package.json')
}
