// @flow

import type Promake from './Promake'
import type {Resource} from './Resource'

export type Props = {
  promake: Promake,
  targets: $ReadOnlyArray<Resource>,
  prerequisites: $ReadOnlyArray<Resource>,
  recipe: ?((rule: Rule) => ?Promise<any>),
  runAtLeastOnce?: boolean,
}

class Rule {
  promake: Promake
  targets: $ReadOnlyArray<Resource>
  prerequisites: $ReadOnlyArray<Resource>
  args: Array<string> = []
  recipe: ?((rule: Rule) => ?Promise<any>)
  runAtLeastOnce: boolean = false

  lastFinishTime: ?number
  promise: ?Promise<any>

  _description: ?string

  constructor(props: Props) {
    Object.assign(this, props)
  }

  _make = async (): Promise<any> => {
    throw new Error('not implemented, this is an abstract class')
  }

  make = (): Promise<any> => {
    return this.promise = this._make()
  }

  description: (() => ?string) & ((newDescription: string) => Rule) = function (newDescription?: string): any {
    if (!arguments.length) return this._description
    this._description = newDescription
    return this
  }.bind(this)

  then = (onResolve: ?(() => any), onReject?: (error: Error) => any): Promise<any> => {
    let {promise} = this
    if (!promise) promise = this.make()
    return promise.then((onResolve: any), onReject)
  }

  toString(): string {
    if (this.targets.length > 1) return `${String(this.targets[0])} (+${this.targets.length} more)`
    return String(this.targets[0])
  }

  inspect(): string {
    return this.toString()
  }
}

module.exports = Rule
