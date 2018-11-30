// @flow

import Rule from './Rule'
import TaskResource from './TaskResource'
import Verbosity from './Verbosity'

class LastModifiedRule extends Rule {
  _make = async (): Promise<any> => {
    const {targets, promake, prerequisites, recipe} = this
    const targetTimes = await Promise.all(targets.map(target => target.lastModified()))
    const prerequisiteTimes = []
    if (targets.length === 1 && targets[0] instanceof TaskResource && !recipe) {
      promake.log(Verbosity.DEFAULT, 'Making', this.toString())
    }
    for (let prerequisite of prerequisites) prerequisiteTimes.push(await promake._make(prerequisite))
    const finiteTargetTimes: Array<number> = (targetTimes.filter(Number.isFinite): any)
    if (finiteTargetTimes.length === targetTimes.length && !this.runAtLeastOnce) {
      const finitePrerequisiteTimes: Array<number> = (prerequisiteTimes.filter(Number.isFinite): any)
      const minTargetTime = Math.min(...finiteTargetTimes)
      const maxPrerequisiteTime = Math.max(...finitePrerequisiteTimes)
      if (!prerequisites.length || minTargetTime > maxPrerequisiteTime) {
        promake.log(Verbosity.DEFAULT, 'Nothing to be done for', this.toString())
        return
      }
    }
    if (recipe) {
      promake.log(Verbosity.DEFAULT, 'Making', this.toString())
      await recipe(this)
    }
    this.lastFinishTime = Date.now()
  }
}

module.exports = LastModifiedRule
