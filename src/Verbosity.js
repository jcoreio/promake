// @flow

const Verbosity: {[name: string]: VerbosityLevel} = {
  QUIET: 0,
  DEFAULT: 1,
  HIGH: 2,
}

export type VerbosityLevel = 0 | 1 | 2

module.exports = Verbosity

