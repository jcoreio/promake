import type { Resource } from './Resource'
import type { HashResource } from './HashResource'
import { Hash } from 'crypto'

export default class FileResource implements Resource, HashResource {
  file: string

  constructor(file: string)

  lastModified(): Promise<number | null | undefined>

  updateHash(hash: Hash): Promise<any>

  toString(): string
}
