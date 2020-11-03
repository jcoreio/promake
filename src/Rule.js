// @flow

import type Promake from './Promake'
import type {Resource} from './Resource'
import ExecutionContext from './ExecutionContext'

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

  _description: ?string

  constructor(props: Props) {
    Object.assign(this, props)
  }

  _make = async (context: ExecutionContext): Promise<any> => {
    throw new Error('not implemented, this is an abstract class')
  }

  make = (context?: ExecutionContext = new ExecutionContext()): Promise<any> => {
    return context.make(this, this._make)
  }

  then = (onResolve: ?(() => any), onReject?: (error: Error) => any): Promise<any> =>
    this.make().then(onResolve, onReject)

  catch = (onReject: (error: Error) => any): Promise<any> =>
    this.make().catch(onReject)

  finally = (onSettled: () => any): Promise<any> =>
    this.make().finally(onSettled)

  description: (() => ?string) & ((newDescription: string) => Rule) = function (newDescription?: string): any {
    if (!arguments.length) return this._description
    this._description = newDescription
    return this
  }.bind(this)

  toString(): string {
    if (this.targets.length > 1) return `${String(this.targets[0])} (+${this.targets.length} more)`
    return String(this.targets[0])
  }

  inspect(): string {
    return this.toString()
  }
}

module.exports = Rule
