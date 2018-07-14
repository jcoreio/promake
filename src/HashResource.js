// @flow

export interface HashResource {
  /**
   * If the resource exists, updates the given hash with whatever data from
   * the resource is relevant.
   */
  updateHash(hash: crypto$Hash): Promise<any>;
}
