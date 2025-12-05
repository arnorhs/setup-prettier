import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as github from '@actions/github'
import fs from 'node:fs/promises'
import { calculateHash } from './lib/calculateHash'
import { createLogTrace } from './lib/createLogTrace'
import { exec } from './lib/exec'
import { getFilesToCheck } from './lib/getFilesToCheck'
import { npmInstallWithTmpJson } from './lib/npmInstallWithTmpJson'
import { readJsonFile } from './lib/readJsonFile'

const CACHE_KEY = 'prettier-action-cache-v1'

const logTrace = createLogTrace(core)

let pkgJson
try {
  pkgJson = await readJsonFile('./package.json')
} catch (e: any) {
  core.setFailed(e.message)
  process.exit(1)
}

const deps = Object.fromEntries(
  Object.entries({
    prettier: 'latest',
    ...pkgJson.json.devDependencies,
    ...pkgJson.json.dependencies,
  }).filter(([name]) => /^@?prettier(\/|$|\-)/.test(name)),
)

const depsHash = calculateHash(JSON.stringify(deps))
const hashKey = `${CACHE_KEY}-${depsHash}`

logTrace(`ready to restore from cache ${hashKey}`)

const usedKey = await cache.restoreCache(['./node_modules'], hashKey, [
  `${CACHE_KEY}-`,
])

logTrace(`restored cache (${usedKey ? 'hit' : 'miss'})`)

if (usedKey !== hashKey) {
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
}

try {
  core.info(JSON.stringify(github.context.repo))
  const baseRef = github.context.payload?.pull_request?.base?.repo?.sha
  const changedFiles = baseRef ? await getFilesToCheck(baseRef) : '.'

  if (changedFiles !== '.') {
    core.info(`changed files since ${baseRef}: \n${changedFiles}`)
  }

  await exec(
    `./node_modules/.bin/prettier --check ${changedFiles.split('\n').join(' ')}`,
  )

  logTrace(`prettier ran`)
} catch (e: any) {
  core.setFailed('Prettier check failed.\n' + e.message)
  process.exit(1)
}

try {
  await fs.rm('./node_modules', { recursive: true })
  logTrace('cleaned up node_modules')
} catch (e: any) {
  core.warning(`Failed to clean up node_modules: ${e.message}`)
}

core.info('Prettier check completed successfully.')
