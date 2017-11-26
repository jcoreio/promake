// @flow

import type {Resource} from './Resource'
import fs from 'fs'
import promisify from 'es6-promisify'

const stat = promisify(fs.stat)

export default class FileResource implements Resource {
  file: string;

  constructor(file: string) {
    this.file = file
  }

  async lastModified(): Promise<?number> {
    try {
      const {mtimeMs, mtime} = await stat(this.file)
      return mtimeMs != null ? mtimeMs : mtime.getTime()
    } catch (err) {
      if (err.code === 'ENOENT') return null
      throw err
    }
  }

  toString(): string {
    return this.file
  }
}

