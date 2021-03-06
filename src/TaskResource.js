// @flow

import type { Resource } from './Resource'
import Promake from './Promake'

export type Props = {
  name: string,
  promake: Promake,
}

export default class TaskResource implements Resource {
  name: string
  promake: Promake

  constructor(props: Props) {
    Object.assign(this, props)
  }

  lastModified: () => Promise<?number> = async (): Promise<?number> => {
    const rule = this.promake.rules.get(this)
    if (!rule) throw new Error(`missing rule for ${this.toString()}`)
    return rule.lastFinishTime
  }

  toString(): string {
    return this.name
  }
}
