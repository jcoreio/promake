import * as t from 'typed-validators'

export interface Resource {
  /**
   * If the resource doesn't exist, returns null or undefined.
   * Otherwise, returns the resource's last modified time, in milliseconds.
   */
  lastModified(): Promise<number | null | undefined>
}

export const ResourceType: t.TypeAlias<Resource>
