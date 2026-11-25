import { access, copyFile, cp, mkdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = resolve(projectRoot, 'dist')
const builtIndex = resolve(distRoot, 'index.html')
const builtAssets = resolve(distRoot, 'assets')
const builtHtaccess = resolve(distRoot, '.htaccess')
const websiteIndex = resolve(projectRoot, 'index.html')
const websiteAssets = resolve(projectRoot, 'assets')
const websiteHtaccess = resolve(projectRoot, '.htaccess')

await access(builtIndex, constants.R_OK)
await access(builtAssets, constants.R_OK)
await access(builtHtaccess, constants.R_OK)

// Publish only Vite's generated files. Everything else in the website folder is preserved.
await mkdir(websiteAssets, { recursive: true })
await cp(builtAssets, websiteAssets, { recursive: true, force: true })
await copyFile(builtHtaccess, websiteHtaccess)
await copyFile(builtIndex, websiteIndex)

console.log('Published dist/index.html, dist/assets, and dist/.htaccess to optimize/back-office.')
