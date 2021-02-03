// @flow

import * as t from 'typed-validators'

export interface Resource {
  /**
   * If the resource doesn't exist, returns null or undefined.
   * Otherwise, returns the resource's last modified time, in milliseconds.
   */
  lastModified(): Promise<?number>;
}

export const ResourceType: t.TypeAlias<Resource> = t.alias(
  'Resource',
  (t.record(t.any(), t.any()): any)
)

ResourceType.addConstraint((resource: any): ?string => {
  if (
    typeof resource.lastModified !== 'function' ||
    resource.lastModified.length !== 0
  )
    return 'must have a lastModified method that takes no arguments'
})
