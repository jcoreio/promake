// @flow

import {describe, it} from 'mocha'
import {expect} from 'chai'
import sinon from 'sinon'
// $FlowFixMe
import {exec} from 'child-process-async'
import fs from 'fs-extra'
import path from 'path'
import {RuntimeError} from 'flow-runtime'

import Promake from '../src'
import TestResource from './TestResource'

describe('Promake', () => {
  describe('.task', () => {
    it('throws when another task for the given name already exists', () => {
      const {task} = new Promake()
      task('foo', () => {})
      expect(() => task('foo', () => {})).to.throw(Error)
    })
    describe('with no prerequisites or recipe', () => {
      it('returns Rule for a task', () => {
        const {task} = new Promake()
        const fooTask = task('foo', () => {})
        const barTask = task('bar', () => {})
        expect(task('foo')).to.equal(fooTask)
        expect(task('bar')).to.equal(barTask)
      })
      it('throws when multiple targets are passed', () => {
        const {task} = new Promake()
        task('foo', () => {})
        task('bar', () => {})
        expect(() => task(['foo', 'bar'])).to.throw(Error)
      })
      it('throws when no task for target exists', () => {
        const {task} = new Promake()
        expect(() => task('foo')).to.throw(Error)
      })
    })
  })
  describe('.rule', () => {
    it('resolves and normalizes file targets', () => {
      const {rule} = new Promake()
      const fooRule = rule('foo', () => {})
      const barRule = rule(path.resolve('somedir/../bar'), () => {})

      expect(rule(path.resolve('foo'))).to.equal(fooRule)
      expect(rule('bar')).to.equal(barRule)
    })
    it('throws when invalid target types are given', () => {
      const {rule} = new Promake()
      expect(() => rule(2, () => {})).to.throw(RuntimeError)
      expect(() => rule([2], () => {})).to.throw(RuntimeError)
      expect(() => rule([() => {}], () => {})).to.throw(RuntimeError)
      expect(() => rule(rule('hello', () => {}), () => {})).to.throw(RuntimeError)
    })
    it('throws when invalid prerequisite types are given', () => {
      const {rule} = new Promake()
      expect(() => rule('hello', 2, () => {})).to.throw(RuntimeError)
      expect(() => rule('hello', [2], () => {})).to.throw(RuntimeError)
      expect(() => rule('hello', [() => {}], () => {})).to.throw(RuntimeError)
    })
    it ('throws when a rule for a given target already exists', () => {
      const {rule} = new Promake()
      rule('foo', () => {})
      expect(() => rule('foo', () => {})).to.throw(Error)
    })
    describe('with no prerequisites or receipe', () => {
      it('returns Rule for a target', () => {
        const {rule} = new Promake()
        const fooRule = rule('foo', () => {})
        const barBazRule = rule(['bar', 'baz'], () => {})
        expect(rule('foo')).to.equal(fooRule)
        expect(rule('bar')).to.equal(barBazRule)
        expect(rule('baz')).to.equal(barBazRule)
      })
      it('throws when multiple targets are passed', () => {
        const {rule} = new Promake()
        rule('foo', () => {})
        rule('bar', () => {})
        expect(() => rule(['foo', 'bar'])).to.throw(Error)
      })
      it('throws when no rule for target exists', () => {
        const {rule} = new Promake()
        expect(() => rule('foo')).to.throw(Error)
      })
    })
    describe('.then', () => {
      it('runs prerequisites that are missing', async () => {
        const {rule} = new Promake()

        const foo = new TestResource('foo')
        const bar = new TestResource('bar')
        const baz = new TestResource('baz')

        const barTime = await bar.touch()

        rule(foo, () => foo.touch())
        await rule(baz, [foo, bar], () => baz.touch())

        expect(bar.mtime).to.equal(barTime)
        expect(foo.mtime).to.be.greaterThan(bar.mtime)
        expect(baz.mtime).to.be.greaterThan(foo.mtime)
        expect(baz.mtime).to.be.greaterThan(bar.mtime)
      })
      it("doesn't rerun rule when target is newer", async () => {
        const {rule} = new Promake()
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
      it("respects runAtLeastOnce", async () => {
        const {rule} = new Promake()
        const foo = new TestResource('foo')

        await foo.touch()
        const fooTime = await foo.lastModified()
        expect(fooTime).to.exist

        await rule(foo, () => foo.touch(), {runAtLeastOnce: true})

        expect(await foo.lastModified()).to.be.greaterThan(fooTime)
      })
      it("doesn't rerun rule when called again", async () => {
        const {rule} = new Promake()
        const foo = new TestResource('foo')
        const bar = new TestResource('bar')
        const baz = new TestResource('baz')

        await bar.touch()

        rule(foo, () => foo.touch())
        const bazRule = rule(baz, [foo, bar], () => baz.touch())
        await bazRule
        const bazTime = await baz.lastModified()
        expect(bazTime).to.exist

        await bazRule
        expect(await baz.lastModified()).to.equal(bazTime)
      })
      it("reruns rule when target is older", async () => {
        const {rule} = new Promake()

        const foo = new TestResource('foo')
        const bar = new TestResource('bar')
        const baz = new TestResource('baz')

        await baz.touch()
        await foo.touch()
        await bar.touch()
        const bazTime = await baz.lastModified()
        expect(bazTime).to.exist

        rule(foo, () => foo.touch())
        await rule(baz, [foo, bar], () => baz.touch())

        expect(await baz.lastModified()).to.be.greaterThan(bazTime)
      })
      it("throws when one of the prerequisites cannot be made", async () => {
        const {rule} = new Promake()

        const foo = new TestResource('foo')
        const bar = new TestResource('bar')
        const baz = new TestResource('baz')

        const onResolved = sinon.spy()
        const onRejected = sinon.spy()

        rule(foo, () => foo.touch())
        await rule(baz, [foo, bar], () => baz.touch()).then(onResolved, onRejected)

        expect(onResolved.called).to.be.false
        expect(onRejected.args[0][0]).to.be.an.instanceOf(Error)
      })
    })
  })
  describe('.cli', () => {
    it('runs prerequisites that are missing', async () => {
      const {rule, task, cli} = new Promake()

      const foo = new TestResource('foo')
      const bar = new TestResource('bar')
      const baz = new TestResource('baz')

      const barTime = await bar.touch()

      rule(foo, () => foo.touch())
      rule(baz, [foo, bar], () => baz.touch())
      task('makeBaz', baz)

      await cli(['node', 'promake.js', 'makeBaz'], {exit: false})

      expect(bar.mtime).to.equal(barTime)
      expect(foo.mtime).to.be.greaterThan(bar.mtime)
      expect(baz.mtime).to.be.greaterThan(foo.mtime)
      expect(baz.mtime).to.be.greaterThan(bar.mtime)
    })
    it('increases verbosity when called with -v', async () => {
      const promake = new Promake()

      await promake.cli(['node', 'promake.js', '-v'], {exit: false})
      expect(promake.verbosity).to.equal(Promake.VERBOSITY.HIGH)
    })
    it('increases verbosity when called with --verbose', async () => {
      const promake = new Promake()

      await promake.cli(['node', 'promake.js', '--verbose'], {exit: false})
      expect(promake.verbosity).to.equal(Promake.VERBOSITY.HIGH)
    })
    it('rejects when called with invalid target', async () => {
      const {cli} = new Promake()

      let error: ?Error
      await cli(['node', 'promake.js', 'blah'], {exit: false}).catch(err => error = err)

      expect(error).to.be.an.instanceOf(Error)
    })
  })
  describe('integration test', function () {
    this.timeout(15 * 60000)
    const cwd = path.resolve(__dirname, 'integration')
    it('cleans', async () => {
      await exec('babel-node promake clean', {cwd})
      expect(await fs.pathExists('test/integration/promake/build')).to.be.false
    })
    it('throws an error when run with an invalid target', async () => {
      let stderr = ''
      const child = exec('babel-node promake clean glab', {cwd})
      child.stderr.on('data', chunk => stderr += chunk.toString('utf8'))
      let code
      await child.catch(error => code = error.code)
      expect(code).to.equal(1)
      expect(stderr).to.match(/Error: no task or file found for glab/)
    })
    it('builds after clean', async () => {
      await exec('babel-node promake clean build', {cwd})
      expect(await fs.pathExists('test/integration/build/assets/client.bundle.js')).to.be.true
      expect(await fs.pathExists('test/integration/build/server/index.js')).to.be.true
      expect(await fs.pathExists('test/integration/build/server/foo/index.js')).to.be.true
      expect(await fs.pathExists('test/integration/build/universal/index.js')).to.be.true
      expect(await fs.pathExists('test/integration/build/universal/foo/index.js')).to.be.true
    })
    it("doesn't rebuild after build", async () => {
      await exec('babel-node promake clean build', {cwd})
      const {stderr} = await exec('babel-node promake build', {cwd})
      expect(stderr).not.to.match(/making/i)
      expect(stderr).to.match(/nothing to be done/i)
    })
    it("outputs nothing when run with -q", async () => {
      const {stdout, stderr} = await exec('babel-node promake build -q', {cwd})
      expect(stdout).to.match(/^\s*$/m)
      expect(stderr).to.match(/^\s*$/m)
    })
    it("outputs nothing when run with --quiet", async () => {
      const {stdout, stderr} = await exec('babel-node promake build --quiet', {cwd})
      expect(stdout).to.match(/^\s*$/m)
      expect(stderr).to.match(/^\s*$/m)
    })
  })
})
