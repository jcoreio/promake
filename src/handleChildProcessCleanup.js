/**
 * @prettier
 * @flow
 */

import type Promake from './Promake'
import Verbosity from './Verbosity'
import { type ChildProcess } from 'child_process'

let signalListenersInstalled = false
let killCount = 0
const runningProcesses: Set<ChildProcess> = new Set()

export default function handleChildProcessCleanup(
  promake: Promake,
  child: ChildProcess
) {
  function die() {
    process.off('SIGINT', killHandler)
    process.kill(process.pid, 'SIGINT')
  }

  function killHandler() {
    killCount++
    if (killCount === 1)
      promake.log(Verbosity.DEFAULT, 'cleaning up, please wait...')
    else
      promake.log(
        Verbosity.QUIET,
        'got second SIGINT, killing spawned processes with SIGKILL'
      )
    for (const child of runningProcesses)
      child.kill(killCount > 1 ? 'SIGKILL' : 'SIGINT')
    if (killCount > 1) die()
  }

  runningProcesses.add(child)
  const cleanupChild = () => {
    child.removeListener('close', cleanupChild)
    child.removeListener('error', cleanupChild)
    runningProcesses.delete(child)
    if (!runningProcesses.size) {
      process.off('SIGINT', killHandler)
      if (killCount) die()
    }
  }
  child.once('close', cleanupChild)
  child.once('error', cleanupChild)
  if (!signalListenersInstalled) {
    process.on('SIGINT', killHandler)
    signalListenersInstalled = true
  }
}
