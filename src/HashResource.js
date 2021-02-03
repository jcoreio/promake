// @flow

import * as t from 'typed-validators'

export interface HashResource {
  /**
   * If the resource exists, updates the given hash with whatever data from
   * the resource is relevant.
   */
  updateHash(hash: crypto$Hash): Promise<any>;
}

export const HashResourceType: t.TypeAlias<HashResource> = t.alias(
  'HashResource',
  (t.record(t.any(), t.any()): any)
)

HashResourceType.addConstraint((resource: any): ?string => {
  if (typeof resource.updateHash !== 'function' || resource.updateHash.length !== 1)
    return 'must have an updateHash method that takes one argument'
})
