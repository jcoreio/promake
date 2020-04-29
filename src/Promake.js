// @flow
// @flow-runtime enable

import {reify} from 'flow-runtime'
import type {Type} from 'flow-runtime'
import type {Resource} from './Resource'
import FileResource from './FileResource'
import Rule from './Rule'
import LastModifiedRule from './LastModifiedRule'
import HashRule from './HashRule'
import TaskResource from './TaskResource'
import {exec, spawn} from 'promisify-child-process'
import chalk from 'chalk'
import type {ChildProcess} from 'child_process'
import Verbosity from './Verbosity'
import type {VerbosityLevel} from './Verbosity'
import type {Readable} from 'stream'
import padEnd from 'lodash.padend'

type Resources = Array<string | Resource> | string | Resource

type Targets = Resources

type BasicResource = {
  lastModified(): any,
}

type BasicHashResource = {
  updateHash(): any,
}

const ResourcesType = (reify: Type<Array<string | BasicResource> | string | BasicResource>)
const PrerequisitesType = (reify: Type<Array<string | BasicResource | Rule> | string | BasicResource | Rule>)
const HashPrerequisitesType = (reify: Type<Array<string | BasicHashResource | Rule> | string | BasicHashResource | Rule>)

type CliOptions = {
  exit?: boolean,
}

class Promake {
  static VERBOSITY = Verbosity

  static checkResource(resource: any, path: string) {
    if (typeof resource === 'string') return
    if (!(resource instanceof Object)) {
      throw new Error('Resource must be a string or conform to the Resource interface')
    }
    if (typeof resource.lastModified !== 'function') {
      throw new Error('resource ')
    }
  }

  fileResources: Map<string, FileResource> = new Map()
  taskResources: Map<string, TaskResource> = new Map()
  rules: Map<Resource, Rule> = new Map()
  verbosity: VerbosityLevel = Verbosity.DEFAULT

  _normalizeResource = (resource: any): Resource => {
    if (typeof resource === 'string') {
      const normalized = new FileResource(resource)
      let file = this.fileResources.get(normalized.file)
      if (!file) this.fileResources.set(normalized.file, file = normalized)
      return file
    }
    return resource
  }

  _normalizePrerequisite = (resource: any): Array<Resource> | Resource => {
    if (resource instanceof Rule) return resource.targets
    return this._normalizeResource(resource)
  }

  _normalizeResources = (resources: any): Array<Resource> => {
    ResourcesType.assert(resources)
    return Array.isArray(resources)
      ? resources.map(this._normalizeResource)
      : [this._normalizeResource(resources)]
  }

  _normalizePrerequisites = (prerequisites: any): Array<Resource> => {
    PrerequisitesType.assert(prerequisites)
    if (Array.isArray(prerequisites)) return [].concat(...prerequisites.map(this._normalizePrerequisite))
    const normalized = this._normalizePrerequisite(prerequisites)
    return Array.isArray(normalized) ? normalized : [normalized]
  }

  _normalizeHashPrerequisites = (prerequisites: any): Array<Resource> => {
    HashPrerequisitesType.assert(prerequisites)
    if (Array.isArray(prerequisites)) return [].concat(...prerequisites.map(this._normalizePrerequisite))
    const normalized = this._normalizePrerequisite(prerequisites)
    return Array.isArray(normalized) ? normalized : [normalized]
  }

  _normalizeName = (name: string): Resource => {
    const result = this.taskResources.get(name) || this.fileResources.get(new FileResource(name).file)
    if (!result) throw new Error(`no task or file found for ${name}`)
    return result
  }

  _make = async (resource: any): Promise<?number> => {
    const rule = this.rules.get(resource)
    if (!rule) {
      if (typeof resource.lastModified === 'function') {
        let time = await resource.lastModified()
        if (Number.isFinite(time)) return time
      }
      throw new Error(`No rule found to make ${resource.toString()}`)
    }
    await rule
    return resource.lastModified()
  }

  log = (verbosity: VerbosityLevel, ...args: any) => {
    if (this.verbosity >= verbosity) console.error(chalk.bold('[promake]'), ...args) // eslint-disable-line no-console
  }

  logStream = (verbosity: VerbosityLevel, stream: Readable) => {
    if (this.verbosity >= verbosity) stream.pipe(process.stderr)
  }

  _logChildProcess = (child: ChildProcess) => {
    if (this.verbosity <= Verbosity.QUIET) return
    if (child.stdout) child.stdout.pipe(process.stdout)
    if (child.stderr) child.stderr.pipe(process.stderr)
  }

  exec = (command: string, options?: child_process$execOpts = {}): ChildProcess => {
    const child = exec(command, options)
    if (this.verbosity >= Verbosity.DEFAULT) console.error(chalk.gray('$'), chalk.gray(command)) // eslint-disable-line no-console
    this._logChildProcess(child)
    return child
  }

  spawn = (command: string, argsOrOptions?: Array<string> | child_process$spawnOpts, options?: child_process$spawnOpts): ChildProcess => {
    const args = Array.isArray(argsOrOptions) ? argsOrOptions : []
    if (argsOrOptions instanceof Object && !Array.isArray(argsOrOptions)) {
      options = argsOrOptions
    }
    if (!options) options = {}
    function formatArg(arg: string): string {
      if (/^[-_a-z0-9=.\/]+$/i.test(arg)) return chalk.gray(arg)
      return chalk.gray(`'${arg.replace(/'/g, "'\\''")}'`)
    }
    const child = spawn(command, args, options)
    if (this.verbosity >= Verbosity.DEFAULT) console.error(chalk.gray('$'), chalk.gray(command), ...args.map(formatArg)) // eslint-disable-line no-console
    this._logChildProcess(child)
    return child
  }

  rule = (targets: Targets, prerequisites?: any, recipe?: (rule: Rule) => ?Promise<any>, options?: {runAtLeastOnce?: boolean}): Rule => {
    if (typeof prerequisites === 'function') {
      options = (recipe: any)
      recipe = (prerequisites: any)
      prerequisites = null
    }
    if (!prerequisites && !recipe) {
      if (Array.isArray(targets)) throw new Error('You must pass only one target when looking up a rule')
      const target = this._normalizeResource(targets)
      const rule = this.rules.get(target)
      if (!rule) throw new Error(`No rule found for ${target.toString()}`)
      return rule
    }
    const rule = new LastModifiedRule({
      promake: this,
      targets: this._normalizeResources(targets),
      prerequisites: prerequisites ? this._normalizePrerequisites(prerequisites) : [],
      recipe,
      runAtLeastOnce: Boolean(options && options.runAtLeastOnce),
    })
    for (let target of rule.targets) {
      if (this.rules.has(target)) throw new Error(`A rule for ${target.toString()} already exists`)
      this.rules.set(target, rule)
    }
    return rule
  }

  hashRule = (algorithm: string, target: string | FileResource, prerequisites?: any, recipe?: (rule: Rule) => ?Promise<any>, options?: {runAtLeastOnce?: boolean}): Rule => {
    const finalTarget: FileResource = (this._normalizeResource(target): any)
    if (typeof prerequisites === 'function') {
      options = (recipe: any)
      recipe = (prerequisites: any)
      prerequisites = null
    }
    if (!prerequisites && !recipe) {
      const rule = this.rules.get(finalTarget)
      if (!rule) throw new Error(`No rule found for ${target.toString()}`)
      return rule
    }
    const rule = new HashRule({
      hashAlgorithm: algorithm,
      promake: this,
      targets: [finalTarget],
      prerequisites: prerequisites ? (this._normalizeHashPrerequisites(prerequisites): $ReadOnlyArray<any>) : [],
      recipe,
      runAtLeastOnce: Boolean(options && options.runAtLeastOnce),
    })
    for (let target of rule.targets) {
      if (this.rules.has(target)) throw new Error(`A rule for ${target.toString()} already exists`)
      this.rules.set(target, rule)
    }
    return rule
  }

  task = (name: string, prerequisites: any, recipe?: (rule: Rule) => ?Promise<any>): Rule => {
    if (prerequisites instanceof Function) {
      recipe = (prerequisites: any)
      prerequisites = null
    }
    if (!prerequisites && !recipe) {
      const target = this.taskResources.get(name)
      const result = target ? this.rules.get(target) : null
      if (!result) throw new Error(`No task named ${name} exists`)
      return result
    }
    if (this.taskResources.has(name)) throw new Error(`A task named ${name} already exists`)
    const target = new TaskResource({name, promake: this})
    this.taskResources.set(name, target)
    const rule = new LastModifiedRule({
      promake: this,
      targets: [target],
      prerequisites: prerequisites ? this._normalizePrerequisites((prerequisites: any)) : [],
      recipe,
    })
    this.rules.set(target, rule)
    return rule
  }

  printUsage = () => {
    const {version, homepage} = require('./packageInfo')
    const tasks = [...this.taskResources.keys()].sort()
    const taskColumnWidth = Math.max(16, ...tasks.map(name => name.length)) + 2
    process.stderr.write(`promake CLI, version ${version}
${homepage}/tree/v${version}

Usage:
  ./<script> [options...] [tasks...]

Options:
  -q, --quiet       suppress output
  -v, --verbose     verbose output

Tasks:
  ${tasks.map(task =>
      `${padEnd(task, taskColumnWidth)}${this.task(task).description() || ''}`
    ).join('\n  ') || '(No tasks defined)'}
`)
  }

  cli = async (argv: Array<string> = process.argv, options?: CliOptions = {}): Promise<any> => {
    let ruleArgsMode = false
    try {
      argv = argv.slice(2)
      const targets: Array<Resource> = []
      let lastTarget: ?Resource
      for (let i = 0; i < argv.length; i++) {
        if (ruleArgsMode) {
          if (argv[i] === '--') {
            ruleArgsMode = false
          } else if (lastTarget) {
            this.rule(lastTarget).args.push(argv[i].replace(/^--(-+)$/, '$1'))
          }
        } else if (argv[i].startsWith('-')) {
          if (lastTarget) {
            if (argv[i] === '--') {
              this.rule(lastTarget).args = []
              ruleArgsMode = true
            } else {
              this.rule(lastTarget).args.push(argv[i])
            }
          } else {
            switch (argv[i]) {
            case '-q':
            case '--quiet':
              this.verbosity = Verbosity.QUIET
              break
            case '-v':
            case '--verbose':
              this.verbosity = Verbosity.HIGH
              break
            default:
              throw new Error(`unrecognized option: ${argv[i]}`)
            }
          }
        } else {
          try {
            targets.push(lastTarget = this._normalizeName(argv[i]))
          } catch (error) {
            if (lastTarget) {
              this.rule(lastTarget).args.push(argv[i])
            } else {
              throw error
            }
          }
        }
      }
      if (!targets.length) this.printUsage()
      for (let target of targets) await this._make(target)

      if (options.exit !== false) process.exit(0)
    } catch (error) {
      if (options.exit !== false) {
        this.log(Verbosity.DEFAULT, error.stack)
        process.exit(1)
      }
      throw error
    }
  }
}

module.exports = Promake
