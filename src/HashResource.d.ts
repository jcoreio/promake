import * as t from 'typed-validators'
import { Hash } from 'crypto'

export interface HashResource {
  /**
   * If the resource exists, updates the given hash with whatever data from
   * the resource is relevant.
   */
  updateHash(hash: Hash): Promise<any>
}

export const HashResourceType: t.TypeAlias<HashResource>
