# promake

[![Build Status](https://travis-ci.org/jcoreio/promake.svg?branch=master)](https://travis-ci.org/jcoreio/promake)
[![Coverage Status](https://codecov.io/gh/jcoreio/promake/branch/master/graph/badge.svg)](https://codecov.io/gh/jcoreio/promake)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

Promise-based JS make clone that can target anything, not just files

- [promake](#promake)
  * [Why promake? Why not `jake`, `sake`, etc?](#why-promake-why-not-jake-sake-etc)
  * [Quick start](#quick-start)
    + [Install promake](#install-promake)
    + [A minimal make script](#a-minimal-make-script)
- [API Reference](#api-reference)
  * [`class Promake`](#class-promake)
    + [`rule(targets, prerequisites, recipe)`](#rule-targets-prerequisites-recipe)
    + [`task(name, [prerequisites], [recipe])`](#task-name-prerequisites-recipe)
    + [`cli(argv = process.argv)`](#cli-argv--process-argv)
  * [The `Resource` interface](#the-resource-interface)
    + [lastModified(): Promise](#lastmodified-promise)
  * [How to](#how-to)
    + [Globbing](#globbing)
    + [Executing shell commands](#executing-shell-commands)
  * [Examples](#examples)
    + [Transpiling files with Babel](#transpiling-files-with-babel)

## Why promake?  Why not `jake`, `sake`, etc?

I wouldn't have introduced a new build tool if I hadn't thought I could significantly improve on what others offer.
Here is what promake does that others don't:

* It has a promise-based interface, which is much less cumbersome to use on modern JS VMs than callbacks
* It supports arbitrary resource types as targets and prerequisites.  For instance you could have a rule that only
builds a given docker image if some files or other docker images have been updated since the last image was created.
* You tell it to run the CLI in your script, instead of running your script with a CLI.  This means:
  * You can easily use ES2015 and Coffeescript since you control the script
  * It doesn't pollute the global namespace with its own methods like `jake` does
  * It's obvious how to split your rule and task definitions into multiple files
  * You could even use it in the browser for optimizing various chains of contingent operations

## Quick start

### Install promake

```sh
npm install --save-dev promake
```

### A minimal make script

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

Then run the `hello` task:
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

### `rule(targets, prerequisites, recipe)`
Creates a rule that indicates that `targets` can be created from `prerequisites` by running the given `recipe`.
If all `targets` exist and are newer than all `prerequisites`, `promake` will assume they are up-to-date and skip
the `recipe`.

If there is another rule for a given prerequisite, `promake` will run that rule first before running the recipe for this
rule.  If any prerequisite doesn't exist and there is no rule for it, the build will fail.

The `targets` and `prerequisites` can be:
* a `string` (strings are always interpreted as file system paths relative to the working directory)
* an object conforming to [the `Resource` interface](#the-resource-interface)
* or an array of the above

The `recipe` is a function that should ensure that `targets` get created or updated.  If it returns a `Promise`,
`promake` will wait for it to resolve before moving on to the next rule or task.  If the `recipe` throws an Error or
returns a `Promise` that rejects, the build will fail.

### `task(name, [prerequisites], [recipe])`

Creates a task that can be run by `name` from the CLI regardless of whether `name` is an actual file that exists,
similar to a [phony target in `make`](https://www.gnu.org/software/make/manual/make.html#Phony-Targets).

The `prerequisites` take the same form as for a `rule`, and if given, `promake` will ensure that they exist and are
up-to-date before the task is running, running any rules applicable to the `prerequisites` as necessary.

If `recipe` is given, it will be run any time the task is requested, even if the `prerequisites` are up-to-date.

### `cli(argv = process.argv)`

Runs the command-line interface for the given arguments.  The arguments may include:
* Task names -- these tasks will be run, in the order requested
* File names -- rules for these files will be run, in the order requested

After running all requested tasks and file rules, it will exit the process with a code of 0 if the build succeeded, and
nonzero if the build failed.

## The `Resource` interface

This is an abstraction that allows `promake` to apply the same build logic to input and output resources of any type,
not just files.  (Internally, `promake` converts all `strings` in `targets` and `prerequisites` to `FileResource`s.)

**Warning**: due to the semantics of JS [Maps](http://devdocs.io/javascript/global_objects/map), two `Resource`
instances are always considered different, even if they represent the same resource.  So if you are using non-file
`Resource`s, you should only create and use a single instance for a given resource.

Currently, instances need to define only one method:

### lastModified(): Promise<?number>

If the resource doesn't exist, returns null or undefined.
Otherwise, returns the resource's last modified time, in milliseconds.

## How to

### Globbing

`promake` has no built-in globbing; you must pass arrays of files to `rule`s and `task`s.  This is easy with the
`glob` package:
```sh
npm install --save-dev glob
```

In your script:
```js
const glob = require('glob').sync
const srcFiles = glob('src/**/*.js')
const libFiles = srcFiles.map(file => file.replace(/^src/, 'lib'))
rule(libFiles, srcFiles, () => { /* code that compiles srcFiles to libFiles */ })
```

### File System Operations

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

### Executing shell commands

The `Promake` class has an `exec` method, which is really just a wrapper for `require('child-process-async').exec` that
controls logging.
```js
const {rule, exec} = new Promake()
```

To run a single command in a task, you can just return the result of `exec` because it is Promise-like:
```js
rule(dest, src, () => exec(`cp ${src} ${dest}`))
```

To run multiple commands, you can use an async lambda and `await` each `exec` call:
```js
rule(dest, src, async () => {
  await exec(`cp ${src} ${dest}`)
  await exec(`git add ${dest}`)
  await exec(`git commit -m "update ${dest}"`)
})
```

## Examples

### Transpiling files with Babel

Install `glob`:
```sh
npm install --save-dev glob
```

Create the following make script:
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

