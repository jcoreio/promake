// @flow

import type Rule from './Rule'

export default class ExecutionContext {
  rulePromises: Map<Rule, Promise<any>> = new Map()

  make(rule: Rule, recipe: (context: ExecutionContext) => Promise<any>): Promise<any> {
    let promise = this.rulePromises.get(rule)
    if (!promise) this.rulePromises.set(rule, promise = recipe(this))
    return promise
  }
}
