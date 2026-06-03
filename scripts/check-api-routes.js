#!/usr/bin/env node
// ============================================================================
// CI enforcement — Agent Portal route security markers (Sprint 5D, H5)
// ============================================================================
// Walks app/api/**/route.ts and asserts every file either:
//   (a) imports/uses a security wrapper:
//         withAuth / requireAuth
//         withWebhookSignature / requireWebhookSignature
//   (b) explicitly declares  export const PUBLIC_ROUTE = true
//
// Files that existed at Sprint 5D are listed in
// scripts/.api-routes-baseline.json and are grandfathered. Any NEW route
// (not in the baseline) must satisfy the marker rule or the build fails.
//
// The intent is to make it hard to accidentally ship a route without
// consciously deciding on authentication. Move a route off the baseline
// by editing the JSON and removing its path — the route then falls under
// active enforcement.
// ============================================================================
'use strict'

const fs = require('fs')
const path = require('path')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const ROUTES_DIR = path.join(PROJECT_ROOT, 'app', 'api')
const BASELINE_PATH = path.join(__dirname, '.api-routes-baseline.json')

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(full))
    } else if (entry.isFile() && entry.name === 'route.ts') {
      files.push(full)
    }
  }
  return files
}

function relFromRoot(p) {
  return path.relative(PROJECT_ROOT, p).replace(/\\/g, '/')
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    return { routes: [] }
  }
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
}

// The marker patterns. Each is matched as a substring against the file's
// source text. The patterns are intentionally loose to catch named-import
// + alias variations like  import { withAuth as wa } ...  while staying
// fast (no AST parse needed).
const MARKER_PATTERNS = [
  // Auth wrappers / helpers
  /\bwithAuth\b/,
  /\brequireAuth\b/,
  // Webhook signature wrappers / helpers
  /\bwithWebhookSignature\b/,
  /\brequireWebhookSignature\b/,
  // Explicit public-route opt-out
  /export\s+const\s+PUBLIC_ROUTE\s*=\s*true/,
]

function fileSatisfies(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  return MARKER_PATTERNS.some((re) => re.test(text))
}

function main() {
  if (!fs.existsSync(ROUTES_DIR)) {
    console.log('[check-api-routes] no app/api directory — nothing to check')
    return 0
  }

  const baseline = loadBaseline()
  const baselineSet = new Set((baseline.routes || []).map((p) => p.replace(/\\/g, '/')))

  const allRoutes = walk(ROUTES_DIR).map(relFromRoot).sort()
  const violations = []
  let newRouteCount = 0
  let grandfatheredCount = 0
  let satisfiedCount = 0

  for (const rel of allRoutes) {
    const abs = path.join(PROJECT_ROOT, rel)
    const inBaseline = baselineSet.has(rel)
    const satisfies = fileSatisfies(abs)

    if (satisfies) {
      satisfiedCount++
      continue
    }
    if (inBaseline) {
      grandfatheredCount++
      continue
    }
    newRouteCount++
    violations.push(rel)
  }

  const total = allRoutes.length
  console.log(
    `[check-api-routes] scanned ${total} routes — ` +
      `${satisfiedCount} with marker, ${grandfatheredCount} grandfathered, ` +
      `${newRouteCount} new`
  )

  if (violations.length > 0) {
    console.error('\n[check-api-routes] FAIL — new routes without a security marker:\n')
    for (const v of violations) console.error(`  - ${v}`)
    console.error(
      '\nEvery new route.ts under app/api/** must either:\n' +
        '  1. use withAuth() / requireAuth() from @/lib/security  (authenticated)\n' +
        '  2. use withWebhookSignature() / requireWebhookSignature() (signed webhook)\n' +
        '  3. declare  export const PUBLIC_ROUTE = true            (intentionally public)\n\n' +
        'If a listed route should be grandfathered instead, add its path to\n' +
        'scripts/.api-routes-baseline.json under "routes". Otherwise add the\n' +
        'appropriate marker. See lib/security/index.ts for the wrappers.\n'
    )
    return 1
  }
  return 0
}

const code = main()
process.exit(code)
