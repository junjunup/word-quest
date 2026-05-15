import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

function runConfigImport(envPatch) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', "import './src/config/index.js'; console.log('CONFIG_OK')"], {
    cwd: process.cwd(),
    env: { ...process.env, ...envPatch },
    encoding: 'utf-8'
  })
}

function assertFails(name, envPatch, expectedText) {
  const result = runConfigImport({
    NODE_ENV: 'production',
    JWT_SECRET: '',
    MONGODB_URI: '',
    CORS_ORIGIN: '',
    ...envPatch
  })
  assert.notEqual(result.status, 0, `${name} should fail in production`)
  const output = `${result.stdout}\n${result.stderr}`
  assert.match(output, expectedText, `${name} should mention ${expectedText}`)
}

function assertPasses(name, envPatch) {
  const result = runConfigImport({
    NODE_ENV: 'production',
    JWT_SECRET: 'prod_jwt_secret_with_more_than_32_chars_2026',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/word-quest-prod',
    CORS_ORIGIN: 'https://wordquest.example.com',
    ...envPatch
  })
  assert.equal(result.status, 0, `${name} should pass: ${result.stderr}`)
  assert.match(result.stdout, /CONFIG_OK/)
}

assertFails('missing JWT_SECRET', { JWT_SECRET: '' }, /JWT_SECRET/)
assertFails('weak JWT_SECRET', { JWT_SECRET: '123456' }, /JWT_SECRET/)
assertFails('missing MONGODB_URI', { MONGODB_URI: '' }, /MONGODB_URI/)
assertFails('missing CORS_ORIGIN', { CORS_ORIGIN: '' }, /CORS_ORIGIN/)
assertFails('wildcard CORS_ORIGIN', { CORS_ORIGIN: '*' }, /CORS_ORIGIN/)
assertPasses('strong production config', {})

console.log(JSON.stringify({ status: 'PASS', checks: ['jwt-secret', 'mongodb-uri', 'cors-origin'] }, null, 2))
