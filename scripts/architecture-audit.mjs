import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

const packageJson = JSON.parse(read('package.json'))
const frontendPackage = JSON.parse(read('frontend/package.json'))

if (packageJson.dependencies?.next || packageJson.devDependencies?.next) failures.push('Next.js must not be a dependency of the standalone Node API.')
if (frontendPackage.dependencies?.next || frontendPackage.devDependencies?.next) failures.push('Next.js must not be a dependency of the React/Vite frontend.')

for (const legacyPath of ['next.config.js', 'next.config.mjs', 'next.config.ts', 'next-env.d.ts', 'middleware.ts', 'middleware.js', 'pages', 'app']) {
  if (exists(legacyPath)) failures.push(`Legacy Next.js artifact remains: ${legacyPath}`)
}

for (const legacyPath of ['access_token.php', 'confirmation.php', 'error_log']) {
  if (exists(legacyPath)) failures.push(`Legacy runtime/credential artifact remains: ${legacyPath}`)
}

const server = read('server/index.ts')
for (const required of ['MAX_BODY_BYTES', 'requestTimeout', 'headersTimeout', 'Access-Control-Allow-Origin', 'Internal server error.', 'SIGTERM', '/ready']) {
  if (!server.includes(required)) failures.push(`Standalone API hardening marker missing: ${required}`)
}

const sourceFiles = []
function walk(relativeDir) {
  const absoluteDir = path.join(root, relativeDir)
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relative = path.join(relativeDir, entry.name)
    if (['node_modules', '.git', 'dist', 'coverage'].includes(entry.name)) continue
    if (entry.isDirectory()) walk(relative)
    else if (/\.(ts|tsx|js|mjs|cjs|php|env)$/.test(entry.name)) sourceFiles.push(relative)
  }
}
walk('.')

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
]
for (const file of sourceFiles) {
  const content = read(file)
  if (secretPatterns.some((pattern) => pattern.test(content))) failures.push(`Possible committed secret material detected in ${file}`)
}

if (failures.length) {
  console.error('Architecture/security audit failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Architecture/security audit passed.')
