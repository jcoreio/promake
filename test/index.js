// @flow

import { describe, it } from 'mocha'
import { expect } from 'chai'
import sinon from 'sinon'
import { exec, spawn } from 'promisify-child-process'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import { RuntimeTypeError } from 'typed-validators'
import Promake from '../src'
import TestResource from './TestResource'
import poll from '@jcoreio/poll'

describe('Promake', () => {
  describe('.task', () => {
    it('throws when another task for the given name already exists', () => {
      const { task } = new Promake()
      task('foo', () => {})
      expect(() => task('foo', () => {})).to.throw(Error)
    })
    describe('with no prerequisites or recipe', () => {
      it('returns Rule for a task', () => {
        const { task } = new Promake()
        const fooTask = task('foo', () => {})
        const barTask = task('bar', () => {})
        expect(task('foo')).to.equal(fooTask)
        expect(task('bar')).to.equal(barTask)
      })
      it('throws when multiple targets are passed', () => {
        const { task } = new Promake()
        task('foo', () => {})
        task('bar', () => {})
        // $FlowFixMe
        expect(() => task(['foo', 'bar'])).to.throw(Error)
      })
      it('throws when no task for target exists', () => {
        const { task } = new Promake()
        expect(() => task('foo')).to.throw(Error)
      })
    })
  })
  describe('.rule', () => {
    it('resolves and normalizes file targets', () => {
      const { rule } = new Promake()
      const fooRule = rule('foo', () => {})
      const barRule = rule(path.resolve('somedir/../bar'), () => {})

      expect(rule(path.resolve('foo'))).to.equal(fooRule)
      expect(rule('bar')).to.equal(barRule)
    })
    it('throws when invalid target types are given', () => {
      const { rule } = new Promake()
      // $FlowFixMe
      expect(() => rule(2, () => {})).to.throw(RuntimeTypeError)
      // $FlowFixMe
      expect(() => rule([2], () => {})).to.throw(RuntimeTypeError)
      // $FlowFixMe
      expect(() => rule([() => {}], () => {})).to.throw(RuntimeTypeError)
      expect(() =>
        // $FlowFixMe
        rule(
          rule('hello', () => {}),
          () => {}
        )
      ).to.throw(RuntimeTypeError)
    })
    it('throws when invalid prerequisite types are given', () => {
      const { rule } = new Promake()
      // $FlowFixMe
      expect(() => rule('hello', 2, () => {})).to.throw(RuntimeTypeError)
      // $FlowFixMe
      expect(() => rule('hello', [2], () => {})).to.throw(RuntimeTypeError)
      // $FlowFixMe
      expect(() => rule('hello', [() => {}], () => {})).to.throw(
        RuntimeTypeError
      )
    })
    it('throws when a rule for a given target already exists', () => {
      const { rule } = new Promake()
      rule('foo', () => {})
      // $FlowFixMe
      expect(() => rule('foo', () => {})).to.throw(Error)
    })
    describe('with no prerequisites or receipe', () => {
      it('returns Rule for a target', () => {
        const { rule } = new Promake()
        const fooRule = rule('foo', () => {})
        const barBazRule = rule(['bar', 'baz'], () => {})
        expect(rule('foo')).to.equal(fooRule)
        expect(rule('bar')).to.equal(barBazRule)
        expect(rule('baz')).to.equal(barBazRule)
      })
      it('throws when multiple targets are passed', () => {
        const { rule } = new Promake()
        rule('foo', () => {})
        rule('bar', () => {})
        expect(() => rule(['foo', 'bar'])).to.throw(Error)
      })
      it('throws when no rule for target exists', () => {
        const { rule } = new Promake()
        expect(() => rule('foo')).to.throw(Error)
      })
    })
    describe('.then', () => {
      it('runs prerequisites that are missing', async () => {
        const { rule } = new Promake()

        const foo = new TestResource('foo')
        const bar = new TestResource('bar')
        const baz = new TestResource('baz')

        const barTime = await bar.touch()

        rule(foo, () => foo.touch())
        await rule(baz, [foo, bar], () => baz.touch())

        const fooMtime = foo.mtime
        const barMtime = bar.mtime
        const bazMtime = baz.mtime
        if (fooMtime == null) throw new Error('expected fooMtime to be defined')
        if (barMtime == null) throw new Error('expected barMtime to be defined')
        if (bazMtime == null) throw new Error('expected bazMtime to be defined')

        expect(barMtime).to.equal(barTime)
        expect(fooMtime).to.be.above(barMtime)
        expect(bazMtime).to.be.above(fooMtime)
        expect(bazMtime).to.be.above(barMtime)
      })
      it("doesn't rerun rule when target is newer", async () => {
        const { rule } = new Promake()
        const foo = new TestResource('foo')
        const bar = new TestResource('bar')
        const baz = new TestResource('baz')

        await foo.touch()
        await bar.touch()
        await baz.touch()
        const bazTime = await baz.lastModified()
        expect(bazTime).to.exist

        rule(foo, () => foo.touch())
        await rule(baz, [foo, bar], () => baz.touch())

        expect(await baz.lastModified()).to.equal(bazTime)
      })
      it('respects runAtLeastOnce', async () => {
        const { rule } = new Promake()
        const foo = new TestResource('foo')

        await foo.touch()
        const fooTime = await foo.lastModified()
        if (fooTime == null) throw new Error('expected fooTime to be defined')

        await rule(foo, () => foo.touch(), { runAtLeastOnce: true })

        expect(await foo.lastModified()).to.be.above(fooTime)
      })
      it("doesn't rerun rule when called again", async () => {
        const { rule } = new Promake()
        const foo = new TestResource('foo')
        const bar = new TestResource('bar')
        const baz = new TestResource('baz')

        await bar.touch()

        rule(foo, () => foo.touch())
        const bazRule = rule(baz, [foo, bar], () => baz.touch())
        await bazRule
        const bazTime = await baz.lastModified()
        if (bazTime == null) throw new Error('expected bazTime to be defined')

        await bazRule
        expect(await baz.lastModified()).to.equal(bazTime)
      })
      it('reruns rule when target is older', async () => {
        const { rule } = new Promake()

        const foo = new TestResource('foo')
        const bar = new TestResource('bar')
        const baz = new TestResource('baz')

        await baz.touch()
        await foo.touch()
        await bar.touch()
        const bazTime = await baz.lastModified()
        if (bazTime == null) throw new Error('expected bazTime to be defined')

        rule(foo, () => foo.touch())
        await rule(baz, [foo, bar], () => baz.touch())

        expect(await baz.lastModified()).to.be.above(bazTime)
      })
      it('throws when one of the prerequisites cannot be made', async () => {
        const { rule } = new Promake()

        const foo = new TestResource('foo')
        const bar = new TestResource('bar')
        const baz = new TestResource('baz')

        const onResolved = sinon.spy()
        const onRejected = sinon.spy()

        rule(foo, () => foo.touch())
        await rule(baz, [foo, bar], () => baz.touch()).then(
          onResolved,
          onRejected
        )

        expect(onResolved.called).to.be.false
        expect(onRejected.args[0][0]).to.be.an.instanceOf(Error)
      })
      it('calls recipe with Rule instance', async () => {
        const { rule } = new Promake()
        const recipe = sinon.spy()
        const fooRule = rule(new TestResource('foo'), recipe)
        await fooRule
        expect(recipe.args[0][0]).to.equal(fooRule)
      })
    })
  })
  describe('.hashRule', () => {
    it('resolves and normalizes file targets', () => {
      const { rule, hashRule } = new Promake()
      const fooRule = hashRule('md5', 'foo', ['bar'], () => {})
      const barRule = hashRule(
        'md5',
        path.resolve('somedir/../bar'),
        ['bar'],
        () => {}
      )

      expect(rule(path.resolve('foo'))).to.equal(fooRule)
      expect(rule('bar')).to.equal(barRule)
    })
    it('throws when invalid target types are given', () => {
      const { hashRule } = new Promake()
      // $FlowFixMe
      expect(() => hashRule('md5', 2, ['bar'], () => {})).to.throw()
      // $FlowFixMe
      expect(() => hashRule('md5', ['foo'], ['bar'], () => {})).to.throw()
      expect(() =>
        // $FlowFixMe
        hashRule(
          'md5',
          () => {},
          () => {}
        )
      ).to.throw()
    })
    it('throws when invalid prerequisite types are given', () => {
      const { hashRule } = new Promake()
      // $FlowFixMe
      expect(() => hashRule('md5', 'hello', 2, () => {})).to.throw(
        RuntimeTypeError
      )
      // $FlowFixMe
      expect(() => hashRule('md5', 'hello', [2], () => {})).to.throw(
        RuntimeTypeError
      )
      // $FlowFixMe
      expect(() => hashRule('md5', 'hello', [() => {}], () => {})).to.throw(
        RuntimeTypeError
      )
    })
    it('throws when a rule for a given target already exists', () => {
      const { rule, hashRule } = new Promake()
      rule('foo', () => {})
      // $FlowFixMe
      expect(() => hashRule('md5', 'foo', ['bar'], () => {})).to.throw(Error)
    })
    it('accepts custom HashResource implementations as prerequisites', () => {
      const { hashRule } = new Promake()
      hashRule(
        'md5',
        'foo',
        [
          {
            updateHash(hash: any): any {
              hash.update('blargh')
            },
          },
        ],
        () => {}
      )
    })
    it('rejects bad HashResource implementations as prerequisites', () => {
      const { hashRule } = new Promake()
      expect(() => hashRule('md5', 'foo', [{}], () => {})).to.throw(
        RuntimeTypeError
      )
    })
  })
  describe('.cli', () => {
    it('runs prerequisites that are missing', async () => {
      const { rule, task, cli } = new Promake()

      const foo = new TestResource('foo')
      const bar = new TestResource('bar')
      const baz = new TestResource('baz')

      const barTime = await bar.touch()

      rule(foo, () => foo.touch())
      rule(baz, [foo, bar], () => baz.touch())
      task('makeBaz', baz)

      await cli(['node', 'promake.js', 'makeBaz'], { exit: false })

      const fooMtime = foo.mtime
      const barMtime = bar.mtime
      const bazMtime = baz.mtime
      if (fooMtime == null) throw new Error('expected fooMtime to be defined')
      if (barMtime == null) throw new Error('expected barMtime to be defined')
      if (bazMtime == null) throw new Error('expected bazMtime to be defined')

      expect(barMtime).to.equal(barTime)
      expect(fooMtime).to.be.above(barMtime)
      expect(bazMtime).to.be.above(fooMtime)
      expect(bazMtime).to.be.above(barMtime)
    })
    it('increases verbosity when called with -v', async () => {
      const promake = new Promake()

      await promake.cli(['node', 'promake.js', '-v'], { exit: false })
      expect(promake.verbosity).to.equal(Promake.VERBOSITY.HIGH)
    })
    it('increases verbosity when called with --verbose', async () => {
      const promake = new Promake()

      await promake.cli(['node', 'promake.js', '--verbose'], { exit: false })
      expect(promake.verbosity).to.equal(Promake.VERBOSITY.HIGH)
    })
    it('rejects when called with invalid target', async () => {
      const { cli } = new Promake()

      let error: ?Error
      await cli(['node', 'promake.js', 'blah'], { exit: false }).catch(
        (err) => (error = err)
      )

      expect(error).to.be.an.instanceOf(Error)
    })
    it('passes args with -- to rules', async () => {
      const { rule, task, cli } = new Promake()

      const foo = new TestResource('foo')
      const bar = new TestResource('bar')
      rule(foo, () => foo.touch())
      rule(bar, () => bar.touch())

      let fooArgs: ?Array<string>
      let barArgs: ?Array<string>

      task('foo', foo, (rule) => (fooArgs = rule.args))
      task('bar', bar, (rule) => (barArgs = rule.args))

      await cli(
        [
          'node',
          'promake.js',
          'foo',
          '--',
          'a',
          '----',
          'b',
          '--',
          'bar',
          '--',
          'c',
          'd',
        ],
        { exit: false }
      )

      expect(fooArgs).to.deep.equal(['a', '--', 'b'])
      expect(barArgs).to.deep.equal(['c', 'd'])
    })
    it('passes args without -- to rules', async () => {
      const { rule, task, cli } = new Promake()

      const foo = new TestResource('foo')
      const qux = new TestResource('qux')
      rule(foo, () => foo.touch())
      rule(qux, () => qux.touch())

      let fooArgs: ?Array<string>
      let quxArgs: ?Array<string>

      task('foo', foo, (rule) => (fooArgs = rule.args))
      task('qux', qux, (rule) => (quxArgs = rule.args))

      await cli(['node', 'promake.js', 'foo', 'bar', 'baz', 'qux', 'blah'], {
        exit: false,
      })

      expect(fooArgs).to.deep.equal(['bar', 'baz'])
      expect(quxArgs).to.deep.equal(['blah'])
    })
  })
  describe('integration test', function () {
    this.timeout(15 * 60000)
    const promake = path.resolve(__dirname, 'integration', 'promake')
    it('cleans', async () => {
      await exec(`babel-node ${promake} clean`)
      expect(await fs.pathExists('test/integration/promake/build')).to.be.false
    })
    it('prints usage and task list when no targets are requested', async () => {
      const { stderr } = await exec(`babel-node ${promake} -v`)
      expect(String(stderr).replace(/\s*$/gm, '')).to.contain(`
Tasks:
  build             build server and client
  build:ci          build server and client in CI
  build:client
  build:client:ci
  build:server
  build:server:ci
  clean             remove all build output`)
    })
    it('builds after clean', async () => {
      await exec(`babel-node ${promake} clean build`)
      expect(
        await fs.pathExists('test/integration/build/assets/client.bundle.js')
      ).to.be.true
      expect(await fs.pathExists('test/integration/build/server/index.js')).to
        .be.true
      expect(await fs.pathExists('test/integration/build/server/foo/index.js'))
        .to.be.true
      expect(await fs.pathExists('test/integration/build/universal/index.js'))
        .to.be.true
      expect(
        await fs.pathExists('test/integration/build/universal/foo/index.js')
      ).to.be.true
    })
    it("doesn't rebuild after build", async () => {
      await exec(`babel-node ${promake} clean build`)
      const { stderr } = await exec(`babel-node ${promake} build`)
      expect(stderr).to.match(/nothing to be done for build\/server/i)
      expect(stderr).to.match(/nothing to be done for build\/universal/i)
      expect(stderr).to.match(/nothing to be done for build\/assets/i)
    })
    it('outputs nothing when run with -q', async () => {
      const { stdout, stderr } = await exec(`babel-node ${promake} build -q`)
      expect(stdout).to.match(/^\s*$/m)
      expect(stderr).to.match(/^\s*$/m)
    })
    it('outputs nothing when run with --quiet', async () => {
      const { stdout, stderr } = await exec(
        `babel-node ${promake} build --quiet`
      )
      expect(stdout).to.match(/^\s*$/m)
      expect(stderr).to.match(/^\s*$/m)
    })
    it.only(`forwards SIGINT and waits for children to exit`, async function () {
      const tmpDir = path.join(os.tmpdir(), `promake-${Math.random()}`)
      await fs.mkdirs(tmpDir)
      const files = ['file1.txt', 'file2.txt'].map((file) =>
        path.join(tmpDir, file)
      )
      const child = spawn(
        'babel-node',
        [promake, 'sigintTest', '--', ...files],
        { stdio: 'inherit' }
      )
      await poll(async () => {
        for (const file of files) {
          expect(
            await fs.exists(file),
            `expected ${file} to be created by sigintTest task`
          ).to.be.true
        }
      }, 50).timeout(10000)
      await Promise.all([child, child.kill('SIGINT')])
      for (const file of files) {
        expect(
          await fs.exists(file),
          `expected ${file} to be removed by sigintTest task SIGINT handler`
        ).to.be.false
      }
    })
    it.only(`on second SIGINT, kills children with SIGKILL`, async function () {
      const tmpDir = path.join(os.tmpdir(), `promake-${Math.random()}`)
      await fs.mkdirs(tmpDir)
      const files = ['file1.txt', 'file2.txt'].map((file) =>
        path.join(tmpDir, file)
      )
      const child = spawn(
        'babel-node',
        [promake, 'sigintTest', '--', ...files],
        { stdio: 'inherit' }
      )
      await poll(async () => {
        for (const file of files) {
          expect(
            await fs.exists(file),
            `expected ${file} to be created by sigintTest task`
          ).to.be.true
        }
      }, 50).timeout(10000)
      await Promise.all([child, child.kill('SIGINT'), child.kill('SIGINT')])
      for (const file of files) {
        expect(
          await fs.exists(file),
          `expected ${file} not to be removed by sigintTest task SIGINT handler`
        ).to.be.true
      }
    })
    describe('hash rules', () => {
      it('builds after clean', async () => {
        await exec(`babel-node ${promake} clean build:ci`)
        expect(await fs.pathExists('test/integration/build/server.hash')).to.be
          .true
        expect(await fs.pathExists('test/integration/build/universal.hash')).to
          .be.true
        expect(await fs.pathExists('test/integration/build/client.hash')).to.be
          .true
        expect(
          await fs.pathExists('test/integration/build/assets/client.bundle.js')
        ).to.be.true
        expect(await fs.pathExists('test/integration/build/server/index.js')).to
          .be.true
        expect(
          await fs.pathExists('test/integration/build/server/foo/index.js')
        ).to.be.true
        expect(await fs.pathExists('test/integration/build/universal/index.js'))
          .to.be.true
        expect(
          await fs.pathExists('test/integration/build/universal/foo/index.js')
        ).to.be.true
      })
      it("doesn't rebuild after build", async () => {
        await exec(`babel-node ${promake} clean build:ci`)
        const { stderr } = await exec(`babel-node ${promake} build:ci`)
        expect(stderr).to.match(/nothing to be done for build\/server.hash/i)
        expect(stderr).to.match(/nothing to be done for build\/universal.hash/i)
        expect(stderr).to.match(/nothing to be done for build\/client.hash/i)
      })
      it("rebuilds when hash doesn't match", async () => {
        await exec(`babel-node ${promake} clean build:ci`)
        await fs.writeFile(
          'test/integration/build/server.hash',
          'blahblahblah',
          'utf8'
        )
        const { stderr } = await exec(`babel-node ${promake} build:ci`)
        expect(stderr).not.to.match(
          /nothing to be done for build\/server.hash/i
        )
        expect(stderr).to.match(/nothing to be done for build\/universal.hash/i)
        expect(stderr).to.match(/nothing to be done for build\/client.hash/i)
      })
    })
  })
})
