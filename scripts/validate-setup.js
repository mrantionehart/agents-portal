#!/usr/bin/env node

/**
 * Portal Setup Validation Script
 * Validates that all necessary components are in place for Phase 5 testing
 */

const fs = require('fs')
const path = require('path')

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, '..', filePath)
  const exists = fs.existsSync(fullPath)

  if (exists) {
    const stats = fs.statSync(fullPath)
    const size = (stats.size / 1024).toFixed(1)
    log('green', `✅ ${description}`)
    log('blue', `   Path: ${filePath} (${size}KB)`)
    return true
  } else {
    log('red', `❌ ${description} NOT FOUND`)
    log('blue', `   Expected: ${filePath}`)
    return false
  }
}

function checkDirectory(dirPath, description) {
  const fullPath = path.join(__dirname, '..', dirPath)
  const exists = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()

  if (exists) {
    log('green', `✅ ${description}`)
    log('blue', `   Path: ${dirPath}`)
    return true
  } else {
    log('red', `❌ ${description} NOT FOUND`)
    return false
  }
}

function main() {
  log('bright', '\n' + '='.repeat(60))
  log('bright', '   AGENT PORTAL - SETUP VALIDATION')
  log('bright', '='.repeat(60))

  const results = {
    passed: 0,
    failed: 0,
  }

  // Check Phase 5 Testing Files
  log('cyan', '\n📋 Phase 5 Testing Documentation:')
  results.passed += checkFile('PHASE5_TEST_PLAN.md', 'Comprehensive test plan') ? 1 : 0
  results.failed += checkFile('PHASE5_TEST_PLAN.md', 'Comprehensive test plan') ? 0 : 1
  results.passed += checkFile('TESTING_CHECKLIST.md', 'QA testing checklist') ? 1 : 0
  results.failed += checkFile('TESTING_CHECKLIST.md', 'QA testing checklist') ? 0 : 1
  results.passed += checkFile(
    'PHASE5_INFRASTRUCTURE_READY.md',
    'Phase 5 infrastructure guide'
  )
    ? 1
    : 0
  results.failed += checkFile('PHASE5_INFRASTRUCTURE_READY.md', 'Phase 5 infrastructure guide')
    ? 0
    : 1

  // Check Testing Utilities
  log('cyan', '\n💻 Testing Utilities:')
  results.passed += checkFile('lib/test-utils.ts', 'Testing utilities library') ? 1 : 0
  results.failed += checkFile('lib/test-utils.ts', 'Testing utilities library') ? 0 : 1
  results.passed += checkFile('scripts/run-tests.ts', 'Automated test runner') ? 1 : 0
  results.failed += checkFile('scripts/run-tests.ts', 'Automated test runner') ? 0 : 1
  results.passed += checkFile('scripts/validate-setup.js', 'Setup validation script') ? 1 : 0
  results.failed += checkFile('scripts/validate-setup.js', 'Setup validation script') ? 0 : 1

  // Check Portal Code
  log('cyan', '\n🔧 Portal Application Code:')
  results.passed += checkDirectory('app', 'Application directory') ? 1 : 0
  results.failed += checkDirectory('app', 'Application directory') ? 0 : 1
  results.passed += checkDirectory('lib', 'Library directory') ? 1 : 0
  results.failed += checkDirectory('lib', 'Library directory') ? 0 : 1
  results.passed += checkFile('app/dashboard/page.tsx', 'Agent dashboard') ? 1 : 0
  results.failed += checkFile('app/dashboard/page.tsx', 'Agent dashboard') ? 0 : 1
  results.passed += checkFile('app/admin/dashboard/page.tsx', 'Admin dashboard') ? 1 : 0
  results.failed += checkFile('app/admin/dashboard/page.tsx', 'Admin dashboard') ? 0 : 1

  // Check Phase Summaries
  log('cyan', '\n📊 Phase Completion Documents:')
  results.passed += checkFile('PHASE3_COMPLETION_SUMMARY.md', 'Phase 3 summary') ? 1 : 0
  results.failed += checkFile('PHASE3_COMPLETION_SUMMARY.md', 'Phase 3 summary') ? 0 : 1
  results.passed += checkFile('PHASE4_COMPLETION_SUMMARY.md', 'Phase 4 summary') ? 1 : 0
  results.failed += checkFile('PHASE4_COMPLETION_SUMMARY.md', 'Phase 4 summary') ? 0 : 1
  results.passed += checkFile('ROLE_BASED_ACCESS_GUIDE.md', 'RBAC guide') ? 1 : 0
  results.failed += checkFile('ROLE_BASED_ACCESS_GUIDE.md', 'RBAC guide') ? 0 : 1

  // Check Configuration
  log('cyan', '\n⚙️  Configuration Files:')
  results.passed += checkFile('package.json', 'Package configuration') ? 1 : 0
  results.failed += checkFile('package.json', 'Package configuration') ? 0 : 1
  results.passed += checkFile('next.config.js', 'Next.js configuration') ? 1 : 0
  results.failed += checkFile('next.config.js', 'Next.js configuration') ? 0 : 1
  results.passed += checkFile('tsconfig.json', 'TypeScript configuration') ? 1 : 0
  results.failed += checkFile('tsconfig.json', 'TypeScript configuration') ? 0 : 1

  // Summary
  log('cyan', '\n' + '='.repeat(60))
  log('bright', '📊 VALIDATION SUMMARY')
  log('cyan', '='.repeat(60))

  const totalChecks = results.passed + results.failed
  const percentage = ((results.passed / totalChecks) * 100).toFixed(1)

  log('green', `✅ Passed: ${results.passed}/${totalChecks}`)
  if (results.failed > 0) {
    log('red', `❌ Failed: ${results.failed}/${totalChecks}`)
  }
  log('bright', `Pass Rate: ${percentage}%`)

  if (results.failed === 0) {
    log('green', '\n✅ All files present and accounted for!')
    log('cyan', '\nPhase 5 is ready to execute. Next steps:')
    log('blue', '1. Review PHASE5_TEST_PLAN.md for test strategy')
    log('blue', '2. Follow TESTING_CHECKLIST.md for daily testing')
    log('blue', '3. Use testing utilities in lib/test-utils.ts')
    log('blue', '4. Monitor API calls in browser DevTools')
    log('blue', '5. Track bugs in the checklist template')
    return 0
  } else {
    log('red', '\n❌ Some files are missing. Please check above.')
    return 1
  }
}

process.exit(main())
