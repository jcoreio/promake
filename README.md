# promake

[![Build Status](https://travis-ci.org/jcoreio/promake.svg?branch=master)](https://travis-ci.org/jcoreio/promake)
[![Coverage Status](https://codecov.io/gh/jcoreio/promake/branch/master/graph/badge.svg)](https://codecov.io/gh/jcoreio/promake)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

Promise-based JS make clone that can target anything, not just files

- [promake](#promake)
  * [Why promake? Why not `jake`, `sake`, etc?](#why-promake--why-not-jake-sake-etc)
  * [Quick start](#quick-start)
- [API Reference](#api-reference)
  * [`class Promake`](#class-promake)
    + [`rule(targets, [prerequisites], [recipe], [options])`](#ruletargets-prerequisites-recipe-options)
    + [`hashRule(algorithm, target, prerequisites, [recipe], [options])`](#hashrulealgorithm-target-prerequisites-recipe-options)
    + [`task(name, [prerequisites], [recipe])`](#taskname-prerequisites-recipe)
    + [`exec(command, [options])`](#execcommand-options)
    + [`spawn(command, [args], [options])`](#spawncommand-args-options)
    + [`cli(argv = process.argv, [options])`](#cliargv--processargv-options)
    + [`log(verbosity, ...args)`](#logverbosity-args)
    + [`logStream(verbosity, stream)`](#logstreamverbosity-stream)
    + [`static Verbosity`](#static-verbosity)
  * [`class Rule`](#class-rule)
    + [`promake`](#promake-2)
    + [`targets`](#targets)
    + [`prerequisites`](#prerequisites)
    + [`args`](#args)
    + [`description([newDescription])`](#descriptionnewdescription)
    + [`then(onResolved, [onRejected])`](#thenonresolved-onrejected)
    + [`catch(onRejected)`](#catchonrejected)
  * [The `Resource` interface](#the-resource-interface)
    + [`lastModified()`](#lastmodified-promisenumber)
  * [The `HashResource` interface](#the-hashresource-interface)
    + [`updateHash(hash: Hash): Promise`](#updatehashhash-hash-promise)
- [How to](#how-to)
  * [Glob Files](#glob-files)
  * [Perform File System Operations](#perform-file-system-operations)
  * [Execute Shell Commands](#execute-shell-commands)
  * [Pass args through to a shell command](#pass-args-through-to-a-shell-command)
  * [Make Tasks Prerequisites of Other Tasks](#make-tasks-prerequisites-of-other-tasks)
  * [Depend on Values of Environment Variables](#depend-on-values-of-environment-variables)
  * [List available tasks](#list-available-tasks)
- [Examples](#examples)
  * [Transpiling files with Babel](#transpiling-files-with-babel)
  * [Basic Webapp](#basic-webapp)

## Why promake?  Why not `jake`, `sake`, etc?

I wouldn't have introduced a new build tool if I hadn't thought I could significantly improve on what others offer.
Here is what promake does that others don't:

#### Promise-based interface
All other JS build tools I've seen have a callback-based API, which is much more cumbersome to use on modern JS VMs
than promises and `async`/`await`

#### Supports arbitrary resource types as targets and prerequistes
In addition to files.  For instance you could have a rule that only builds a given docker image if some files or other
docker images have been updated since the last image was created.

#### No inversion of control container like `jake`, `mocha`, etc.
You tell it to run the CLI in your script, instead of running your script via a CLI.  This means:
* You can easily use ES2015 and Coffeescript since you control the script
* It doesn't pollute the global namespace with its own methods like `jake` does
* It's obvious how to split your rule and task definitions into multiple files
* You could even use it in the browser for optimizing various chains of contingent operations

# Quick start

### Install promake

```sh
npm install --save-dev promake
```

### Create a make script

Save the following file as `promake` (or whatever name you want):
```js
#!/usr/bin/env node

const Promake = require('promake')

const {task, cli} = new Promake()

task('hello', () => console.log('hello world!'))

cli()
```

Make the script executable:
```
> chmod +x promake
```

### Run the make script

```
> ./promake hello
hello world!
```

# API Reference

## `class Promake`

`Promake` is just a class that you instantiate, add rules and tasks to, and then tell what to run.  All of its methods
are autobound, so you can write `const {task, rule, cli} = new Promake()` and then run the methods directly without any
problems.

`const Promake = require('promake')`

### `rule(targets, [prerequisites], [recipe], [options])`

Creates a rule that indicates that `targets` can be created from `prerequisites` by running the given `recipe`.
If all `targets` exist and are newer than all `prerequisites`, `promake` will assume they are up-to-date and skip
the `recipe`.

If there is another rule for a given prerequisite, `promake` will run that rule first before running the recipe for this
rule.  If any prerequisite doesn't exist and there is no rule for it, the build will fail.

##### `target` (required) and `prerequisites` (optional)
These can be:
* a `string` (strings are always interpreted as file system paths relative to the working directory)
* an object conforming to [the `Resource` interface](#the-resource-interface)
* (*`prerequisites` only*) another `Rule`, which is the same as adding that `Rule`'s own `targets` as prerequisites.
* or an array of the above

**Warning**: glob patterns (e.g. `src/**/*.js`) in `targets` or `prerequisites` will not be expanded; instead you must
glob yourself and pass in the array of matching files.  See [Glob Files](#glob-files) for an example of how to do so.

##### `recipe` (optional)
A function that should ensure that `targets` get created or updated.  It will be called with one argument: the
[`Rule`](#class-rule) being run.

If `recipe` returns a `Promise`,
`promake` will wait for it to resolve before moving on to the next rule or task.  If the `recipe` throws an Error or
returns a `Promise` that rejects, the build will fail.

##### `options` (optional)
* `runAtLeastOnce` - if true, the `recipe` will be run at least once, even if the `targets` are apparently up-to-date.
  This is useful for rules that need to look at the contents of targets to decide whether to update them.

#### Returns
The created [`Rule`](#class Rule).

You can get the `Rule` for a given target by calling `rule(target)` (without `prerequisites` or `recipe`), but it will
throw and `Error` if no such `Rule` exists, or you call it with multiple targets.

### `hashRule(algorithm, target, prerequisites, [recipe], [options])`

Creates a rule that determines if it needs to be run by testing if the hash of
the prerequisites has changed (is different than the previous has written in
`target`, or `target` doesn't exist yet).  After it does run, it will write the
hash to `target`.

This was created to help with CI builds where timestamps can't be used to
determine whether something cached from the previous build needs to be rebuilt.

##### `algorithm` (required)

The [`crypto.createHash`](http://devdocs.io/node/crypto#crypto_crypto_createhash_algorithm_options) algorithm to use.

##### `target` (required)
This must be a `string` or `FileResource`, to which the hash of the
`prerequisites` will be written.

##### `prerequisites` (required)
This must be an array of strings (file paths) or objects conforming to [the `HashResource` interface](#the-hashresource-interface)
**Warning**: glob patterns (e.g. `src/**/*.js`) in `targets` or `prerequisites` will not be expanded; instead you must
glob yourself and pass in the array of matching files.  See [Glob Files](#glob-files) for an example of how to do so.

##### `recipe` (optional)
A function that should ensure that `targets` get created or updated.  It will be called with one argument: the
[`Rule`](#class-rule) being run.

If `recipe` returns a `Promise`,
`promake` will wait for it to resolve before moving on to the next rule or task.  If the `recipe` throws an Error or
returns a `Promise` that rejects, the build will fail.

##### `options` (optional)
* `runAtLeastOnce` - if true, the `recipe` will be run at least once, even if the `targets` are apparently up-to-date.
  This is useful for rules that need to look at the contents of targets to decide whether to update them.

#### Returns
The created [`Rule`](#class Rule).

### `task(name, [prerequisites], [recipe])`

Creates a task, which is really just a `rule`, but can be run by `name` from the CLI regardless of whether `name` is an
actual file that exists, similar to a [phony target in `make`](https://www.gnu.org/software/make/manual/make.html#Phony-Targets).

Task names take precedence over file names when specifying what to build in CLI options.

You can set the description for the task by calling [`.description()`](#descriptionnewdescription)
on the returned `Rule`.  This description will be printed alongside the task
if you call the CLI without any targets.  For example:
```js
task('clean', () =>
  require('fs-extra').remove('build')
).description('removes build output')
```

##### `name`
The name of the task

##### `prerequisites` (optional)
These take the same form as for a `rule`, and if given, `promake` will ensure that they exist and are
up-to-date before the task is running, running any rules applicable to the `prerequisites` as necessary.

**Warning**: putting the `name` of another task in `prerequisites` does not work because all `string`s in
`prerequisites` are interpreted as files.  See
[Make Tasks Prerequisites of Other Tasks](#make-tasks-prerequisites-of-other-tasks) for more details.

##### `recipe` (optional)
If given, it will be run any time the task is requested, even if the `prerequisites` are up-to-date.
`recipe` will be called with one argument: the [`Rule`](#class-rule) being run.

If `recipe` returns a `Promise`,
`promake` will wait for it to resolve before moving on to the next rule or task.  If the `recipe` throws an Error or
returns a `Promise` that rejects, the build will fail.

#### Returns
The created [`Rule`](#class Rule).

Calling `task(name)` without any `prerequisites` or `recipe` looks up and returns the previously created task `Rule` for
`name`, but *it will throw an `Error`* if no such task exists.

### `exec(command, [options])`

This is a wrapper for [`exec` from `promisify-child-process`](https://github.com/itsjustcon/node-promisify-child-process#exec)
with a bit of extra logic to handle logging.  It has the same
API as [`child_process`](http://devdocs.io/node/child_process#child_process_child_process_exec_command_options_callback)
but the returned `ChildProcess` also has `then` and `catch` methods like a `Promise`, so it can be `await`ed.

### `spawn(command, [args], [options])`

This is a wrapper for [`spawn` from `promisify-child-process`](https://github.com/itsjustcon/node-promisify-child-process#spawn)
with a bit of extra logic to handle logging.  It has the same
API as [`child_process`](http://devdocs.io/node/child_process#child_process_child_process_spawn_command_args_options)
but the returned `ChildProcess` also has `then` and `catch` methods like a `Promise`, so it can be `await`ed.

### `cli(argv = process.argv, [options])`
Runs the command-line interface for the given arguments, which should include requested targets
(names of files or tasks).
Unless `options.exit === false`, after running all requested targets, it will exit the process with a code
of 0 if the build succeeded, and nonzero if the build failed.

If no targets are requested, prints usage info and the list of available tasks and exits with a code of 0.

##### `argv` (optional, default: `process.argv`)
The command-line arguments.  May include:
* Task names - these tasks will be run, in the order requested
* File names - rules for these files will be run, in the order requested
* `--quiet`, `-q`: suppress output

You can pass args to the rule for a target by adding `-- args...` after the rule:
```
runDocker -- --rm --env FOO=BAR
```

If you want to pass args to multiple rules, put another `--` after the args to a rule:
```
runDocker -- --rm --env FOO=BAR -- runNpm -- install --save-dev somepackage
```
(args to rule for `runDocker`: `--rm --env FOO=BAR`, args to rule for `runNpm`: `install --save-dev somepackage`)

If, god forbit, you want to pass `--` as an arg to a rule, use `----`:
```
runNpm -- nyc ---- --grep something
```
(args to rule for `runNpm` become `nyc -- --grep something`)

##### `options` (optional)
An object that may have the following properties:
* `exit` - unless this is `false`, `cli()` will exit once it has finished running the requested tasks and file rules.

#### Returns
A `Promise` that will resolve when `Promake` finishes running the requested tasks and file rules, or throw if it fails
(but this is only useful if `options.exit === false` to prevent `cli()` from calling `process.exit` when it's done).

### `log(verbosity, ...args)`

Logs `...args` to `console.error` unless `verbosity` is higher than the user requested.

#### `verbosity`

One of the enum constants in [`Promake.Verbosity`](#static-verbosity).

#### `...args`

The things to log

### `logStream(verbosity, stream)`

Pipes `stream` to `stderr` unless `verbosity` is higher than the user requested.

#### `verbosity`

One of the enum constants in [`Promake.Verbosity`](#static-verbosity).

#### `stream`

An instance of [`stream.Readable`](http://devdocs.io/node/stream#stream_class_stream_readable).

### `static Verbosity`

An enumeration of verbosity levels for logging: has keys `QUIET`, `DEFAULT`, and `HIGH`.

## `class Rule`

This is an instance of a rule created by `Promake.rule` or `Promake.task`.  It has the following properties:

### `promake`

The instance of `Promake` this rule was created in.

### `targets`

The normalized array of resources this rule produces.

### `prerequisites`

The normalized array of resources that must be made before running this rule.

### `args`

Any args for this rule (from the [CLI](#cliargv--processargv-options), usually)

### `description([newDescription])`

Gets or sets the description of this rule.  If you provide an argument,
sets the description and returns this rule.  Otherwise, returns the
description.

### `then(onResolved, [onRejected])`

Starts running this rule if it isn't already, and calls `onResolved` when it finishes or `onReject` when it fails.

### `catch(onRejected)`

Same as calling `then(undefined, onRejected)`.

## The `Resource` interface

This is an abstraction that allows `promake` to apply the same build logic to input and output resources of any type,
not just files.  (Internally, `promake` converts all `strings` in `targets` and `prerequisites` to `FileResource`s.)

**Warning**: due to the semantics of JS [Maps](http://devdocs.io/javascript/global_objects/map), two `Resource`
instances are always considered different, even if they represent the same resource.  So if you are using non-file
`Resource`s, you should only create and use a single instance for a given resource.

Currently, instances need to define only one method:

##### `lastModified(): Promise<?number>`

If the resource doesn't exist, the returned `Promise` should resolve to `null` or `undefined`.
Otherwise, it should resolve to the resource's last modified time, in milliseconds.

## The `HashResource` interface

This is an abstraction that allows `promake` to apply the same build logic to input and output resources of any type,
not just files.  (Internally, `promake` converts all `strings` in `targets` and `prerequisites` to `FileResource`s.)

Currently, instances need to define only one method:

##### `updateHash(hash: Hash): Promise<any>`

If the resource exists, the given `hash` should be updated with whatever data
from the resource is relevant (e.g. the contents of a file, which is what
`FileResource`'s implementation of `updateHash` does)

# How to

## Glob files

`promake` has no built-in globbing; you must pass arrays of files to `rule`s and `task`s.  This is easy with the
`glob` package:
```sh
npm install --save-dev glob
```

In your promake script:
```js
const glob = require('glob').sync
const srcFiles = glob('src/**/*.js')
const libFiles = srcFiles.map(file => file.replace(/^src/, 'lib'))
rule(libFiles, srcFiles, () => { /* code that compiles srcFiles to libFiles */ })
```

## Perform File System Operations

I recommend using [`fs-extra`](https://github.com/jprichardson/node-fs-extra):
```sh
npm install --save-dev fs-extra
```

To perform a single operation in a task, you can just return the `Promise` from async `fs-extra` operations:
```js
const fs = require('fs-extra')
rule(dest, src, () => fs.copy(src, dest))
```

To perform multiple operations one after another, you can use an async lambda and `await` each operation:
```js
const path = require('path')
const fs = require('fs-extra')
rule(dest, src, async () => {
  await fs.mkdirs(path.dirname(dest)))
  await fs.copy(src, dest))
})
```

## Execute Shell Commands

Use the [`exec` method](#execcommand-options)
or the [`spawn` method](#spawncommand-args-options) of your `Promake` instance.
```js
const {rule, exec, spawn} = new Promake()
```

To run a single command in a task, you can just return the result of `exec` or `spawn` because it is Promise-like:
```js
rule(dest, src, () => exec(`cp ${src} ${dest}`))
```

To run multiple commands, you can use an async lambda and `await` each `exec` or `spawn` call:
```js
rule(dest, src, async () => {
  await exec(`cp ${src} ${dest}`)
  await exec(`git add ${dest}`)
  await exec(`git commit -m "update ${dest}"`)
})
```

## Pass args through to a shell command

The args from the CLI are avaliable on [`Rule.args`](#args):

```js
const {rule, spawn} = new Promake()

task('npm', rule => spawn('npm', rule.args))
```

And run your task with:
```
./promake npm -- install --save-dev somepackage
```

See [CLI documentation](#cliargv--processargv-options) for more details.

## Make Tasks Prerequisites of Other Tasks

Putting the `name` of another task in the `prerequisites` of `rule` or `task` does not work because all `string`s in
`prerequisites` are interpreted as files.

Instead, you can just include the `Rule` returned by `rule` or `task` in the `prerequisites` of another.  For example:
```js
const serverTask = task('server', [...serverBuildFiles, ...universalBuildFiles])
const clientTask = task('client', clientBuildFiles)
task('build', [serverTask, clientTask])
```

Or you can call `task(name)` to get a reference to the previously created `Rule`:
```js
task('server', [...serverBuildFiles, ...universalBuildFiles])
task('client', clientBuildFiles)
task('build', [task('server'), task('client')])
```

Sometimes I like to use the following structure for defining an `all` task:
```js
task('all', [
  task('server', [...serverBuildFiles, ...universalBuildFiles]),
  task('client', clientBuildFiles),
])
```

## Depend on Values of Environment Variables

Use the [`promake-env` package](https://github.com/jcoreio/promake-env):
```sh
npm install --save-dev promake-env
```

```js
const {rule, exec} = new Promake()
const envRule = require('promake-env').envRule(rule)

const src = ...
const lib = ...
const buildEnv = 'lib/.buildEnv'

envRule(buildEnv, ['NODE_ENV', 'BABEL_ENV'])
rule(lib, [...src, buildEnv], () => exec('babel src/ --out-dir lib'))
```

## List available tasks

Run the CLI without specifying any targets.  For instance if your
build file is `promake`, run:

```
> ./promake
promake CLI, version X.X.X
https://github.com/jcoreio/promake/tree/vX.X.X

Usage:
  ./<script> [options...] [tasks...]

Options:
  -q, --quiet       suppress output
  -v, --verbose     verbose output

Tasks:
  build             build server and client
  build:client
  build:server
  clean             remove all build output
```

# Examples

## Transpiling files with Babel

Install `glob`:
```sh
npm install --save-dev glob
```

Create the following promake script:
```js
#!/usr/bin/env node

const Promake = require('promake')
const glob = require('glob').sync

const srcFiles = glob('src/**/*.js')
const libFiles = srcFiles.map(file => file.replace(/^src/, 'lib'))
const libPrerequisites = [...srcFiles, '.babelrc', ...glob('src/**/.babelrc')]

const {rule, task, exec, cli} = new Promake()
rule(libFiles, libPrerequisites, () => exec(`babel src/ --out-dir lib`))
task('build', libFiles)

cli()
```

The `libFiles` `rule` tells `promake`:
* That running the recipe will create the files in `libFiles`
* That it should only run the recipe if a file in `libFiles` is older than a file in `libPrerequistes`

If you want to run `babel` separately on each file, so that it doesn't rebuild any files that haven't changed, you can
create a rule for each file:
```js
srcFiles.forEach(srcFile => {
  const libFile = srcFile.replace(/^src/, 'lib')
  rule(libFile, [srcFile, '.babelrc'], () => exec(`babel ${srcFile} -o ${libFile}`))
})
```
However, I don't recommend this because `babel-cli` takes time to start up and this will generally be much slower than
just recompiling the entire directory in a single `babel` command.

## Basic Webapp

This is an example promake script for a webapp with the following structure:

- `build/`
  * `assets/`
    + `client.bundle.js` (client webpack bundle)
  * `server/` (compiled output of `src/server`)
  * `universal/` (compiled output of `src/universal`)
  * `.clientEnv` (environment variables for last client build)
  * `.dockerEnv` (environment variables for last docker build)
  * `.serverEnv` (environment variables for last server build)
  * `.universalEnv` (environment variables for last universal build)
- `src/`
  * `client/`
  * `server/`
  * `universal/` (code shared by `client` and `server`)
- `.babelrc`
- `.dockerignore`
- `Dockerfile`
- `webpack.config.js`

```js
#!/usr/bin/env node

const Promake = require('promake')
const glob = require('glob').sync
const fs = require('fs-extra')

const serverEnv = 'build/.serverEnv'
const serverSourceFiles = glob('src/server/**/*.js')
const serverBuildFiles = serverSourceFiles.map(file => file.replace(/^src/, 'build'))
const serverPrerequistes = [...serverSourceFiles, serverEnv, '.babelrc', ...glob('src/server/**/.babelrc')]

const universalEnv = 'build/.universalEnv'
const universalSourceFiles = glob('src/universal/**/*.js')
const universalBuildFiles = universalSourceFiles.map(file => file.replace(/^src/, 'build'))
const universalPrerequistes = [...universalSourceFiles, universalEnv, '.babelrc', ...glob('src/universal/**/.babelrc')]

const clientEnv = 'build/.clientEnv'
const clientPrerequisites = [
  ...universalSourceFiles,
  ...glob('src/client/**/*.js'),
  ...glob('src/client/**/*.css'),
  clientEnv,
  '.babelrc',
  ...glob('src/client/**/.babelrc'),
]
const clientBuildFiles = [
  'build/assets/client.bundle.js',
]

const dockerEnv = 'build/.dockerEnv'

const {rule, task, cli, exec} = new Promake()
const envRule = require('promake-env').envRule(rule)

envRule(serverEnv, ['NODE_ENV', 'BABEL_ENV'])
envRule(universalEnv, ['NODE_ENV', 'BABEL_ENV'])
envRule(clientEnv, ['NODE_ENV', 'BABEL_ENV', 'NO_UGLIFY', 'CI'])
envRule(dockerEnv, ['NPM_TOKEN'])

rule(serverBuildFiles, serverPrerequistes, () => exec('babel src/server/ --out-dir build/server'))
rule(universalBuildFiles, universalPrerequistes, () => exec('babel src/universal/ --out-dir build/universal'))
rule(clientBuildFiles, clientPrerequisites, async () => {
  await fs.mkdirs('build')
  await exec('webpack --progress --colors')
})

task('server', [...serverBuildFiles, ...universalBuildFiles]),
task('client', clientBuildFiles),

task('docker', [task('server'), task('client'), 'Dockerfile', '.dockerignore', dockerEnv], () =>
  exec(`docker build . --build-arg NPM_TOKEN=${process.env.NPM_TOKEN}`)
)

task('clean', () => fs.remove('build'))

cli()
```
