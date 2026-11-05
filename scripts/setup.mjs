#!/usr/bin/env node
// GitHub 에서 저장소를 내려받고 .env 를 만들어 주는 준비 스크립트입니다. (외부 패키지 없이 Node 와 git 만 사용)
//
// ① 저장소를 이미 내려받았을 때 (저장소 안에서 실행)
//   node scripts/setup.mjs             각 폴더의 .env.example 을 .env 로 복사 (이미 있는 .env 는 그대로 둠)
//   node scripts/setup.mjs --install   위 작업 + backend·frontend 에서 npm install
//   node scripts/setup.mjs --force     이미 있는 .env 도 덮어씀 (기존 파일은 .env.bak 으로 백업)
//
// ② 아무것도 없는 상태에서 (이 파일 하나만 있으면 됨)
//   node setup.mjs --clone                     git clone → ./TA 폴더 → .env 복사
//   node setup.mjs --clone --install           위 작업 + npm install
//   node setup.mjs --clone my-folder           내려받을 폴더 이름 지정
//   node setup.mjs --clone --repo <주소>       다른 저장소/포크에서 내려받기
//
// npm 으로는(저장소 안에서): npm run setup / npm run setup:install / npm run setup -- --force
import { constants, copyFileSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, relative, resolve, sep } from 'node:path'

const DEFAULT_REPO = 'https://github.com/lsh34206/TA.git'
// .env.example 이나 package.json 을 찾지 않을 폴더
const SKIP_DIRS = new Set(['node_modules', 'dist', 'data', 'docs', 'interview-prep', 'scripts'])
const USAGE = `사용법: node scripts/setup.mjs [--install] [--force]
        node setup.mjs --clone [폴더] [--repo <주소>] [--install] [--force]

  (옵션 없음)  .env.example 을 .env 로 복사합니다. 이미 있는 .env 는 건드리지 않습니다.
  --clone      먼저 GitHub 에서 저장소를 내려받습니다. (기본 ${DEFAULT_REPO})
               폴더를 적지 않으면 저장소 이름(TA)으로 현재 위치에 만듭니다.
  --repo       --clone 으로 내려받을 저장소 주소
  --install    복사 후 backend·frontend 에서 npm install 도 실행합니다.
  --force      이미 있는 .env 도 .env.example 로 덮어씁니다. 기존 파일은 .env.bak 으로 백업합니다.`

function fail(message, code = 1) {
  console.error(message)
  process.exit(code)
}

// ---------- 옵션 읽기 ----------
const flags = new Set()
let repo = DEFAULT_REPO
let folder
const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--help' || arg === '-h') {
    console.log(USAGE)
    process.exit(0)
  } else if (arg === '--repo') {
    repo = args[++i]
    if (!repo || repo.startsWith('-')) fail(`--repo 뒤에는 저장소 주소를 적어 주세요.\n\n${USAGE}`, 2)
  } else if (['--clone', '--install', '--force'].includes(arg)) {
    flags.add(arg)
  } else if (arg.startsWith('-') || folder !== undefined) {
    fail(`알 수 없는 옵션: ${arg}\n\n${USAGE}`, 2)
  } else {
    folder = arg
  }
}
const clone = flags.has('--clone')
const force = flags.has('--force')
const install = flags.has('--install')
if (!clone && (folder !== undefined || repo !== DEFAULT_REPO)) {
  fail(`폴더 이름이나 --repo 는 --clone 과 함께 써야 합니다.\n\n${USAGE}`, 2)
}

// ---------- 1. 내려받기 (--clone) ----------
/** 저장소 주소에서 폴더 이름을 뽑습니다. https://github.com/a/TA.git → TA */
function folderNameOf(url) {
  return url.replace(/[\\/]+$/, '').split(/[\\/:]/).pop().replace(/\.git$/, '')
}

/** git clone 을 실행하고 내려받은 폴더의 절대 경로를 돌려줍니다. */
function cloneRepo() {
  const name = folder ?? folderNameOf(repo)
  if (!name || name === '.' || name === '..') fail('저장소 주소에서 폴더 이름을 알 수 없습니다. 폴더 이름을 직접 적어 주세요.')
  const dest = resolve(process.cwd(), name)

  if (existsSync(join(dest, '.git'))) {
    console.log(`이미 내려받은 폴더입니다: ${dest}\n  git clone 은 건너뛰고 .env 준비만 합니다. (최신으로 받으려면 그 폴더에서 git pull)\n`)
    return dest
  }
  if (existsSync(dest) && readdirSync(dest).length > 0) {
    fail(`${dest} 폴더가 비어 있지 않습니다. 다른 폴더 이름을 적거나 그 폴더를 정리한 뒤 다시 실행하세요.`)
  }
  if (spawnSync('git', ['--version'], { stdio: 'ignore' }).status !== 0) {
    fail('git 을 찾을 수 없습니다. https://git-scm.com 에서 설치한 뒤 다시 실행하세요.')
  }

  console.log(`git clone ${repo}\n  → ${dest}\n`)
  // '--' 는 주소가 옵션(예: --upload-pack=…)으로 해석되는 것을 막습니다. 셸을 거치지 않으므로 주소가 명령으로 실행되지도 않습니다.
  const result = spawnSync('git', ['clone', '--', repo, dest], { stdio: 'inherit' })
  if (result.status !== 0) {
    fail('\ngit clone 이 실패했습니다. 주소와 네트워크 연결(비공개 저장소라면 GitHub 로그인)을 확인하세요.', result.status ?? 1)
  }
  console.log()
  return dest
}

const root = clone ? cloneRepo() : join(import.meta.dirname, '..')

// ---------- 2. .env 만들기 ----------
/** 저장소 루트와 그 바로 아래 폴더들(backend, frontend …). */
function projectDirs() {
  const subdirs = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))
    .map((e) => join(root, e.name))
  return [root, ...subdirs]
}

const rel = (path) => relative(root, path).split(sep).join('/') || '.'

/** .env.example → .env. 반환값: 'copied' | 'skipped' | 'replaced'. */
function copyEnv(dir) {
  const example = join(dir, '.env.example')
  const target = join(dir, '.env')
  if (force && existsSync(target)) {
    copyFileSync(target, `${target}.bak`)
    copyFileSync(example, target)
    return 'replaced'
  }
  try {
    // COPYFILE_EXCL: 대상이 이미 있으면 덮어쓰지 않고 EEXIST 로 실패 (확인과 복사 사이에 생긴 파일도 보호)
    copyFileSync(example, target, constants.COPYFILE_EXCL)
    return 'copied'
  } catch (error) {
    if (error.code === 'EEXIST') return 'skipped'
    throw error
  }
}

const results = []
for (const dir of projectDirs()) {
  if (!existsSync(join(dir, '.env.example'))) continue
  results.push({ dir, state: copyEnv(dir) })
}

if (results.length === 0) {
  fail(`${root} 에서 .env.example 파일을 찾지 못했습니다. 저장소 루트의 scripts/ 폴더에서 실행하고 있는지 확인하세요.`)
}

const MESSAGE = {
  copied: '복사했습니다',
  skipped: '이미 있어 그대로 둡니다 (덮어쓰려면 --force)',
  replaced: '덮어썼습니다 (기존 파일은 .env.bak 으로 백업)',
}
console.log('환경 파일')
for (const { dir, state } of results) {
  console.log(`  ${rel(join(dir, '.env')).padEnd(14)} ${MESSAGE[state]}`)
}

// 예시 값(change-me…)이 그대로 남아 있으면 알려 줍니다. 개발에서는 괜찮지만 운영에서는 서버가 시작하지 않습니다.
const placeholders = results.filter(({ dir }) => /change-me/.test(readFileSync(join(dir, '.env'), 'utf8')))
if (placeholders.length > 0) {
  const files = placeholders.map(({ dir }) => rel(join(dir, '.env'))).join(', ')
  console.log(`\n참고: ${files} 에 개발용 예시 값(change-me…)이 들어 있습니다.`)
  console.log('  로컬 개발에는 그대로 써도 됩니다. 운영(NODE_ENV=production)에서는 JWT_SECRET·SEED_PASSWORD 를 바꾸세요.')
}

// ---------- 3. 의존성 설치 (--install) ----------
if (install) {
  const packages = projectDirs().filter((dir) => dir !== root && existsSync(join(dir, 'package.json')))
  for (const dir of packages) {
    console.log(`\n[${rel(dir)}] npm install`)
    // Windows 에서 npm 은 .cmd 파일이라 shell 을 거쳐야 실행됩니다. (cwd 는 인자가 아니라 옵션이므로 경로의 공백·& 는 문제없음)
    const run = spawnSync('npm', ['install'], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' })
    if (run.status !== 0) {
      fail(`\n[${rel(dir)}] npm install 이 실패했습니다. 위 출력을 확인한 뒤 다시 실행하세요.`, run.status ?? 1)
    }
  }
}

// ---------- 안내 ----------
const installStep = install ? '' : 'npm install && '
console.log('\n다음 단계 (터미널 2개)')
if (clone) console.log(`  cd ${relative(process.cwd(), root) || '.'}`)
console.log(`  cd backend  && ${installStep}npm run start:dev    (http://localhost:3000/api)`)
console.log(`  cd frontend && ${installStep}npm run dev          (http://localhost:5173)`)
