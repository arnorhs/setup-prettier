import * as cache from '@actions/cache'
import * as core from '@actions/core'
import fs from 'node:fs/promises'
import { calculateHash } from './lib/calculateHash'
import { exec } from './lib/exec'
import { npmInstallWithTmpJson } from './lib/npmInstallWithTmpJson'
import { readPackageJson } from './lib/readPackageJson'

const CACHE_KEY = 'prettier-action-cache-v1'

let last = Date.now()

function logTrace(message: string) {
  const elapsed = ((Date.now() - last) / 1000).toFixed(2)
  core.debug(`[${elapsed}s] trace: ${message}`)
  last = Date.now()
}

let pkgJson
try {
  pkgJson = await readPackageJson('./package.json')
} catch (e: any) {
  core.setFailed(e.message)
  process.exit(1)
}

logTrace('read package.json')

const deps = Object.fromEntries(
  Object.entries({
    prettier: 'latest',
    ...pkgJson.json.devDependencies,
    ...pkgJson.json.dependencies,
  }).filter(([name]) => /^@?prettier(\/|$|\-)/.test(name)),
)

const depsHash = calculateHash(JSON.stringify(deps))
const hashKey = `${CACHE_KEY}-${depsHash}`

logTrace('hash calculated')

const usedKey = await cache.restoreCache(['./node_modules'], hashKey, [
  `${CACHE_KEY}-`,
])

logTrace(`restored cache (${usedKey ? 'hit' : 'miss'})`)

if (usedKey === hashKey) {
  core.info('Cache hit! Using cached node_modules.')
} else {
  const temporaryPackageJson = {
    name: 'temp-prettier-action-package',
    dependencies: deps,
  }

  logTrace(
    'installing with temporary package.json:\n' +
      JSON.stringify(temporaryPackageJson, null, 2),
  )

  try {
    await npmInstallWithTmpJson(temporaryPackageJson)
  } catch (e: any) {
    core.setFailed(e.message)
    process.exit(1)
  }

  logTrace('npm install completed')

  await cache.saveCache(['./node_modules'], hashKey)
  logTrace('cache saved')

  core.info('Cache miss. Installed dependencies and saved to cache.')
}

try {
  const { stdout, stderr } = await exec(
    './node_modules/.bin/prettier --check .',
  )
  logTrace(`${stdout}\n${stderr}`)
} catch (e) {
  core.setFailed('Prettier check failed. See output for details.')
  process.exit(1)
}

try {
  await fs.rmdir('./node_modules', { recursive: true })
  logTrace('cleaned up node_modules')
} catch (e: any) {
  core.warning(`Failed to clean up node_modules: ${e.message}`)
}

core.info('Prettier check completed successfully.')
