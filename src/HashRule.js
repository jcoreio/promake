// @flow

import type Promake from './Promake'
import Rule from './Rule'
import {createHash} from 'crypto'
import fs from 'fs'
import type {HashResource} from './HashResource'
import type FileResource from './FileResource'
import Verbosity from './Verbosity'
import promisify from 'es6-promisify'

export type Props = {
  hashAlgorithm: string,
  promake: Promake,
  targets: [FileResource],
  prerequisites: $ReadOnlyArray<HashResource>,
  recipe: ?((rule: Rule) => ?Promise<any>),
  runAtLeastOnce?: boolean,
}

class HashRule extends Rule {
  hashAlgorithm: string

  constructor(props: Props) {
    super((props: any))
    const {targets, prerequisites} = props
    if (targets.length !== 1 || typeof targets[0].file !== 'string') {
      throw new Error('targets must contain a single FileResource')
    }
    for (let prerequisite of prerequisites) {
      if (typeof prerequisite.updateHash !== 'function') throw new Error(
        `prerequisite lacks an updateHash function: ${String(prerequisite)}`
      )
    }
  }

  _make = async (): Promise<any> => {
    const hash = createHash(this.hashAlgorithm)
    const {targets, promake, recipe} = this
    const prerequisites: $ReadOnlyArray<HashResource> = (this.prerequisites: any)
    const [target] = targets
    if (!target) throw new Error('missing target')
    const {file} = (target: any)
    if (typeof file !== 'string') throw new Error('missing targets[0].file')

    for (let prerequisite of prerequisites) {
      await promake._make(prerequisite)
      await prerequisite.updateHash(hash)
    }
    const digest = hash.digest('hex')
    let lastDigest
    try {
      lastDigest = (await promisify(fs.readFile)(file, 'utf8')).trim()
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    if (lastDigest === digest) {
      promake.log(Verbosity.DEFAULT, 'Nothing to be done for', this, 'hash:', lastDigest)
      return
    }
    if (recipe) {
      promake.log(Verbosity.DEFAULT, 'Making', this, 'hash:', lastDigest)
      await recipe(this)
    }
    await promisify(fs.writeFile)(file, digest, 'utf8')
    this.lastFinishTime = Date.now()
  }
}

module.exports = HashRule