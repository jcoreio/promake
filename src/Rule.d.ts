import type Promake from './Promake'
import type { Resource } from './Resource'
import ExecutionContext from './ExecutionContext'
import * as t from 'typed-validators'

export type Props = {
  promake: Promake
  targets: readonly Resource[]
  prerequisites: readonly Resource[]
  recipe: ((rule: Rule) => any) | null | undefined
  runAtLeastOnce?: boolean
}

export default class Rule {
  promake: Promake
  targets: readonly Resource[]
  prerequisites: readonly Resource[]
  args: string[]
  recipe: ((rule: Rule) => any) | null | undefined
  runAtLeastOnce: boolean

  lastFinishTime: number | null | undefined

  _description: string | null | undefined

  constructor(props: Props)
  _make: (context: ExecutionContext) => Promise<any>
  make: (context?: ExecutionContext) => Promise<any>
  then: (
    onResolve: (() => any) | undefined,
    onReject?: (error: Error) => any
  ) => Promise<any>
  catch: (onReject: (error: Error) => any) => Promise<any>
  finally: (onSettled: () => any) => Promise<any>

  description: (() => string | null | undefined) &
    ((newDescription: string) => Rule)

  toString(): string

  inspect(): string
}

export const RuleType: t.TypeAlias<Rule>
