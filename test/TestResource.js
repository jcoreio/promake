// @flow

import type {Resource} from '../src/Resource'
import delay from 'delay'

export default class TestResource implements Resource {
  name: string
  mtime: ?number = null

  constructor(name: string) {
    this.name = name
  }

  touch = async (): Promise<number> => {
    await delay(10)
    return this.mtime = Date.now()
  }

  lastModified = async (): Promise<?number> => {
    return this.mtime
  }

  toString(): string {
    return JSON.stringify(this)
  }
}
