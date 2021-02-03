import type Rule from './Rule'

export default class ExecutionContext {
  rulePromises: Map<Rule, Promise<any>>

  make(
    rule: Rule,
    recipe: (context: ExecutionContext) => Promise<any>
  ): Promise<any>
}
