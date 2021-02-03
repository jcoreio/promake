import { Resource } from './Resource'
import FileResource from './FileResource'
import Rule from './Rule'
import HashRule from './HashRule'
import TaskResource from './TaskResource'
import { ChildProcess, ExecOptions, SpawnOptions } from 'child_process'
import Verbosity from './Verbosity'
import { VerbosityLevel } from './Verbosity'
import { Readable } from 'stream'
import ExecutionContext from './ExecutionContext'

type Resources = Array<string | Resource> | string | Resource

type Targets = Resources

type BasicResource = {
  lastModified(): any
}

type CliOptions = {
  exit?: boolean
}

export default class Promake {
  static VERBOSITY: typeof Verbosity

  static checkResource(resource: any, path: string): void

  fileResources: Map<string, FileResource>
  taskResources: Map<string, TaskResource>
  rules: Map<Resource, Rule>
  verbosity: VerbosityLevel

  make(target: any, context?: ExecutionContext): Promise<void>

  log(verbosity: VerbosityLevel, ...args: any): void

  logStream(verbosity: VerbosityLevel, stream: Readable): void

  exec(command: string, options?: ExecOptions): ChildProcess

  spawn(command: string, args?: string[], options?: SpawnOptions): ChildProcess
  spawn(command: string, options?: SpawnOptions): ChildProcess

  rule(
    targets: Targets,
    recipe?: (rule: Rule) => any,
    options?: { runAtLeastOnce?: boolean }
  ): Rule
  rule(
    targets: Targets,
    prerequisites?: any,
    recipe?: (rule: Rule) => any,
    options?: { runAtLeastOnce?: boolean }
  ): Rule

  hashRule(
    algorithm: string,
    target: string | FileResource,
    prerequisites?: any,
    recipe?: (rule: HashRule) => any,
    options?: { runAtLeastOnce?: boolean }
  ): HashRule
  hashRule(
    algorithm: string,
    target: string | FileResource,
    recipe?: (rule: HashRule) => any,
    options?: { runAtLeastOnce?: boolean }
  ): HashRule

  task(name: string, prerequisites?: any, recipe?: (rule: Rule) => any): Rule
  task(name: string, recipe?: (rule: Rule) => any): Rule

  printUsage(): void

  cli(argv?: Array<string>, options?: CliOptions): Promise<any>
}
