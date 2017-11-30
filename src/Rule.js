// @flow

import type Promake from './Promake'
import type {Resource} from './Resource'
import TaskResource from './TaskResource'
import Verbosity from './Verbosity'

type Props = {
  promake: Promake,
  targets: Array<Resource>,
  prerequisites: Array<Resource>,
  recipe: ?((rule: Rule) => ?Promise<any>),
  runAtLeastOnce?: boolean,
}

class Rule {
  promake: Promake
  targets: Array<Resource>
  prerequisites: Array<Resource>
  args: Array<string> = []
  recipe: ?((rule: Rule) => ?Promise<any>)
  runAtLeastOnce: boolean = false

  lastFinishTime: ?number
  promise: ?Promise<any>

  constructor(props: Props) {
    Object.assign(this, props)
  }

  _make = async (): Promise<any> => {
    const {targets, promake, prerequisites, recipe} = this
    const targetTimes = await Promise.all(targets.map(target => target.lastModified()))
    const prerequisiteTimes = []
    if (targets.length === 1 && targets[0] instanceof TaskResource && !recipe) {
      promake.log(Verbosity.DEFAULT, 'Making', this)
    }
    for (let prerequisite of prerequisites) prerequisiteTimes.push(await promake._make(prerequisite))
    const finiteTargetTimes: Array<number> = (targetTimes.filter(Number.isFinite): any)
    if (finiteTargetTimes.length === targetTimes.length && !this.runAtLeastOnce) {
      const finitePrerequisiteTimes: Array<number> = (prerequisiteTimes.filter(Number.isFinite): any)
      const minTargetTime = Math.min(...finiteTargetTimes)
      const maxPrerequisiteTime = Math.max(...finitePrerequisiteTimes)
      if (!prerequisites.length || minTargetTime > maxPrerequisiteTime) {
        promake.log(Verbosity.DEFAULT, 'Nothing to be done for', this)
        return
      }
    }
    if (recipe) {
      promake.log(Verbosity.DEFAULT, 'Making', this)
      await recipe(this)
    }
    this.lastFinishTime = Date.now()
  }

  make = (): Promise<any> => {
    return this.promise = this._make()
  }

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

