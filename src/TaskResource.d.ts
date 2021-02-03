// @flow

import type { Resource } from './Resource'
import Promake from './Promake'

export type Props = {
  name: string
  promake: Promake
}

export default class TaskResource implements Resource {
  name: string
  promake: Promake

  constructor(props: Props)

  lastModified: () => Promise<number | null | undefined>

  toString(): string
}
