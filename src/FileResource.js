// @flow

import type { Resource } from './Resource'
import type { HashResource } from './HashResource'
import { resolve, normalize, relative } from 'path'
import fs from 'fs'
import promisify from 'es6-promisify'

const stat = promisify(fs.stat)

class FileResource implements Resource, HashResource {
  file: string

  constructor(file: string) {
    this.file = normalize(resolve(file))
  }

  async lastModified(): Promise<?number> {
    try {
      const { mtimeMs, mtime } = await stat(this.file)
      return mtimeMs != null ? mtimeMs : mtime.getTime()
    } catch (err) {
      if (err.code === 'ENOENT') return null
      throw err
    }
  }

  updateHash(hash: crypto$Hash): Promise<any> {
    return new Promise(
      (resolve: () => void, reject: (error: Error) => void) => {
        const input = fs.createReadStream(this.file)
        input.on('readable', () => {
          const data = input.read()
          if (data) hash.update(data)
          else resolve()
        })
        input.on('error', reject)
      }
    )
  }

  toString(): string {
    return relative(process.cwd(), this.file)
  }
}

module.exports = FileResource
