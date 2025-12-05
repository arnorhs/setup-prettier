import { exec } from './exec'

export async function getFilesToCheck(ref: string) {
  const { stdout } = await exec(`git diff --name-only ${ref}`)

  return stdout.trim()
}
