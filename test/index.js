// @flow

import {describe, it} from 'mocha'
import {expect} from 'chai'
import sinon from 'sinon'
// $FlowFixMe
import {exec} from 'child-process-async'
import fs from 'fs-extra'
import path from 'path'

import Promake from '../src'
import TestResource from './TestResource'

describe('Promake', () => {
  describe('.rule', () => {
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
  describe('.task + .cli', () => {
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
  })
  describe('integration test', function () {
    this.timeout(15 * 60000)
    const cwd = path.resolve(__dirname, 'integration')
    it('cleans', async () => {
      await exec('babel-node promake clean', {cwd})
      expect(await fs.pathExists('test/integration/promake/build')).to.be.false
    })
    it('builds after clean', async () => {
      await exec('babel-node promake clean server client', {cwd})
      expect(await fs.pathExists('test/integration/build/assets/client.bundle.js')).to.be.true
      expect(await fs.pathExists('test/integration/build/server/index.js')).to.be.true
      expect(await fs.pathExists('test/integration/build/server/foo/index.js')).to.be.true
      expect(await fs.pathExists('test/integration/build/universal/index.js')).to.be.true
      expect(await fs.pathExists('test/integration/build/universal/foo/index.js')).to.be.true
    })
    it("doesn't rebuild after build", async () => {
      await exec('babel-node promake clean server client', {cwd})
      const {stderr} = await exec('babel-node promake server client', {cwd})
      expect(stderr).not.to.match(/making/i)
      expect(stderr).to.match(/nothing to be done/i)
    })
  })
})
