// @flow

import type {Resource} from './Resource'
import FileResource from './FileResource'
import Rule from './Rule'
import TaskResource from './TaskResource'
import {exec} from 'child-process-async'
import chalk from 'chalk'
// $FlowFixMe
import type {ChildProcess} from 'child-process-async'

type Resources = Array<any> | string | Resource

type CliOptions = {
  exit?: boolean,
}

export const VERBOSITY_QUIET = 0
export const VERBOSITY_DEFAULT = 1
export const VERBOSITY_HIGH = 2

type Verbosity = 0 | 1 | 2

class Promake {
  fileResources: Map<string, FileResource> = new Map()
  taskResources: Map<string, TaskResource> = new Map()
  rules: Map<Resource, Rule> = new Map()
  verbosity: Verbosity = VERBOSITY_DEFAULT

  _normalizeResource = (resource: string | Resource): Resource => {
    if (typeof resource === 'string') {
      let file = this.fileResources.get(resource)
      if (!file) this.fileResources.set(resource, file = new FileResource(resource))
      return file
    }
    return resource
  }

  _normalizeResources = (resources: Resources): Array<Resource> => {
    return Array.isArray(resources)
      ? resources.map(this._normalizeResource)
      : [this._normalizeResource(resources)]
  }

  _normalizeNames = (names: Array<string>): Array<Resource> => {
    return names.map((name: string): Resource => {
      const result = this.taskResources.get(name) || this.fileResources.get(name)
      if (!result) throw new Error(`no task or file found for ${name}`)
      return result
    })
  }

  _make = async (resource: Resource): Promise<?number> => {
    const rule = this.rules.get(resource)
    if (!rule) {
      let time = await resource.lastModified()
      if (Number.isFinite(time)) return time
      throw new Error(`No rule found to make ${resource.toString()}`)
    }
    await rule
    return resource.lastModified()
  }

  _log = (verbosity: Verbosity, ...args: any) => {
    if (this.verbosity >= verbosity) console.error(...args) // eslint-disable-line no-console
  }

  _logChildProcess = (child: ChildProcess) => {
    if (this.verbosity <= VERBOSITY_QUIET) return
    if (child.stdout) child.stdout.pipe(process.stdout)
    if (child.stderr) child.stderr.pipe(process.stderr)
  }

  exec = (command: string, options?: child_process$execOpts = {}): ChildProcess => {
    const child = exec(command, options)
    this._log(VERBOSITY_DEFAULT, chalk.gray('$'), chalk.gray(command))
    this._logChildProcess(child)
    return child
  }

  rule = (targets: Resources, prerequisites: ?Resources, recipe: () => ?Promise<any>, options?: {runAtLeastOnce?: boolean}): Rule => {
    if (typeof prerequisites === 'function') {
      options = (recipe: any)
      recipe = (prerequisites: any)
      prerequisites = null
    }
    const rule = new Rule({
      promake: this,
      targets: this._normalizeResources(targets),
      prerequisites: prerequisites ? this._normalizeResources(prerequisites) : [],
      recipe,
      runAtLeastOnce: Boolean(options && options.runAtLeastOnce),
    })
    for (let target of rule.targets) this.rules.set(target, rule)
    return rule
  }

  task = (name: string, prerequisites?: any, recipe?: () => ?Promise<any>): Rule => {
    if (prerequisites instanceof Function) {
      recipe = prerequisites
      prerequisites = []
    }
    const target = new TaskResource({name, promake: this})
    this.taskResources.set(name, target)
    const rule = new Rule({
      promake: this,
      targets: [target],
      prerequisites: prerequisites ? this._normalizeResources((prerequisites: any)) : [],
      recipe,
    })
    this.rules.set(target, rule)
    return rule
  }

  cli = async (argv: Array<string> = process.argv, options?: CliOptions = {}): Promise<any> => {
    argv = argv.slice(2)
    const resourceNames: Array<string> = []
    for (let i = 0; i < argv.length; i++) {
      if (argv[i].startsWith('-')) {
        switch (argv[i]) {
        case '-q':
        case '--quiet':
          this.verbosity = VERBOSITY_QUIET
          break
        case '-v':
        case '--verbose':
          this.verbosity = VERBOSITY_HIGH
          break
        }
      } else {
        resourceNames.push(argv[i])
      }
    }
    const resources = this._normalizeNames(resourceNames)

    try {
      for (let resource of resources) {
        await this._make(resource)
      }
      if (options.exit !== false) process.exit(0)
    } catch (error) {
      if (options.exit !== false) {
        this._log(VERBOSITY_DEFAULT, error.stack)
        process.exit(1)
      }
      throw error
    }
  }
}

// $FlowFixMe
module.exports = Promake

