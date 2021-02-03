import type Promake from './Promake'
import Rule from './Rule'
import type { HashResource } from './HashResource'
import type FileResource from './FileResource'
import type ExecutionContext from './ExecutionContext'

export type Props = {
  hashAlgorithm: string
  promake: Promake
  targets: [FileResource]
  prerequisites: readonly HashResource[]
  recipe: ((rule: Rule) => any) | null | undefined
  runAtLeastOnce?: boolean
}

export default class HashRule extends Rule {
  hashAlgorithm: string

  constructor(props: Props)

  _make: (context: ExecutionContext) => Promise<any>
}
