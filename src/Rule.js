// @flow

import Promake, {VERBOSITY_DEFAULT} from './Promake'
import type {Resource} from './Resource'

type Props = {
  promake: Promake,
  targets: Array<Resource>,
  prerequisites: Array<Resource>,
  recipe: ?(() => ?Promise<any>),
}

export default class Rule {
  promake: Promake
  targets: Array<Resource>
  prerequisites: Array<Resource>
  recipe: ?(() => ?Promise<any>)

  lastFinishTime: ?number
  promise: ?Promise<any>

  constructor(props: Props) {
    Object.assign(this, props)
  }

  _make = async (): Promise<any> => {
    const targetTimes = await Promise.all(this.targets.map(target => target.lastModified()))
    const prerequisiteTimes = []
    for (let prerequisite of this.prerequisites) prerequisiteTimes.push(await this.promake._make(prerequisite))
    const finiteTargetTimes: Array<number> = (targetTimes.filter(Number.isFinite): any)
    if (finiteTargetTimes.length === targetTimes.length) {
      const finitePrerequisiteTimes: Array<number> = (prerequisiteTimes.filter(Number.isFinite): any)
      const minTargetTime = Math.min(...finiteTargetTimes)
      const maxPrerequisiteTime = Math.max(...finitePrerequisiteTimes)
      if (minTargetTime > maxPrerequisiteTime) {
        this.promake._log(VERBOSITY_DEFAULT, 'Nothing to be done for', this)
        return
      }
    }
    const {recipe} = this
    if (recipe) {
      this.promake._log(VERBOSITY_DEFAULT, 'Making', this)
      await recipe()
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
