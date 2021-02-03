import Rule from './Rule'
import type ExecutionContext from './ExecutionContext'

export default class LastModifiedRule extends Rule {
  _make: (context: ExecutionContext) => Promise<any>
}
