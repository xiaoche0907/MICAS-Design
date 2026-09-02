const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const childProcess = require('node:child_process')

const root = path.resolve(__dirname, '..')
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'micas-quick-cutout-'))
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc')

try {
  fs.rmSync(outDir, { recursive: true, force: true })
  const compile = childProcess.spawnSync(process.execPath, [tsc,
    '--module', 'commonjs',
    '--target', 'ES2020',
    '--lib', 'ES2020,DOM',
    '--skipLibCheck',
    '--esModuleInterop',
    '--outDir', outDir,
    path.join(root, 'ui', 'utils', 'quickCutout.ts'),
    path.join(root, 'ui', 'utils', 'imgbb.ts'),
    path.join(root, 'tests', 'quickCutout.test.ts'),
    path.join(root, 'tests', 'imageHost.test.ts'),
  ], { cwd: root, stdio: 'inherit' })
  if (compile.status !== 0) {
    process.exitCode = compile.status || 1
  } else {
    const testFiles = [
      path.join(outDir, 'tests', 'quickCutout.test.js'),
      path.join(outDir, 'tests', 'imageHost.test.js'),
      path.join(root, 'tests', 'freeimageRelay.test.cjs'),
    ]
    const run = childProcess.spawnSync(process.execPath, ['--test', ...testFiles], { cwd: root, stdio: 'inherit' })
    process.exitCode = run.status || 0
  }
} finally {
  fs.rmSync(outDir, { recursive: true, force: true })
}
