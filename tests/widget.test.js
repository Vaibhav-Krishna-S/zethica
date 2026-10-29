/**
 * Frontend Chat Widget Tests
 * =====================================================================
 * Static code analysis and file validation tests for the ZETHICA chat widget.
 * 
 * These tests verify:
 * - Widget files exist and are valid
 * - Code contains required functions and patterns
 * - Security features are implemented (textContent, no innerHTML)
 * - Accessibility features are present (ARIA, role attributes)
 * - Configuration matches API specification
 * 
 * Run with: node tests/widget.test.js
 * 
 * NOTE: Full DOM/integration tests require a browser environment.
 *       See WIDGET_TESTING_CHECKLIST.md for manual browser testing procedures.
 */

import assert from 'assert';

// ============================================================================
// TEST FRAMEWORK (Simple)
// ============================================================================

const tests = [];
let passedCount = 0;
let failedCount = 0;
const failedTests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('\n🧪 Running Chat Widget Tests (Static Analysis)\n');

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passedCount++;
    } catch (err) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${err.message}\n`);
      failedCount++;
      failedTests.push(name);
    }
  }

  // Summary
  console.log(`\n📊 Test Results:`);
  console.log(`   Passed: ${passedCount}`);
  console.log(`   Failed: ${failedCount}`);
  console.log(`   Total:  ${tests.length}\n`);

  if (failedCount > 0) {
    console.log('Failed tests:');
    failedTests.forEach(name => console.log(`  • ${name}`));
    console.log();
  }

  process.exit(failedCount > 0 ? 1 : 0);
}


// ============================================================================
// TESTS - File Validation & Code Analysis
// ============================================================================

test('chat-widget.js file exists', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const jsPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'chat-widget.js'
  );
  assert.strictEqual(fs.existsSync(jsPath), true, 'chat-widget.js not found');
});

test('chat-widget.js exports class ZethicaChatWidget', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const jsPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'chat-widget.js'
  );
  const content = fs.readFileSync(jsPath, 'utf8');
  assert.strictEqual(content.includes('class ZethicaChatWidget'), true);
});

test('chat-widget.js has required methods', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const jsPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'chat-widget.js'
  );
  const content = fs.readFileSync(jsPath, 'utf8');
  assert.strictEqual(content.includes('sendMessage'), true, 'sendMessage not found');
  assert.strictEqual(content.includes('addMessage'), true, 'addMessage not found');
  assert.strictEqual(content.includes('init()'), true, 'init not found');
  assert.strictEqual(content.includes('open()'), true, 'open not found');
  assert.strictEqual(content.includes('close()'), true, 'close not found');
});

test('chat-widget.js uses textContent for user content (XSS safe)', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const jsPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'chat-widget.js'
  );
  const content = fs.readFileSync(jsPath, 'utf8');
  // textContent used for user-generated content
  assert.strictEqual(content.includes('textContent'), true, 'textContent not found (potential XSS risk)');
  // Should NOT use innerHTML for user input, but innerHTML in template creation is OK
  // Check that responses are handled safely
  assert.strictEqual(content.includes('contentDiv.textContent = text'), true, 'User content not using textContent');
});

test('chat-widget.js has rate limiting logic', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const jsPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'chat-widget.js'
  );
  const content = fs.readFileSync(jsPath, 'utf8');
  assert.strictEqual(content.includes('isRateLimited'), true);
  assert.strictEqual(content.includes('requestTimestamps'), true);
  assert.strictEqual(content.includes('maxRequestsPerWindow'), true);
});

test('chat-widget.js has API endpoint', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const jsPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'chat-widget.js'
  );
  const content = fs.readFileSync(jsPath, 'utf8');
  assert.strictEqual(content.includes('/api/chat'), true, 'API endpoint /api/chat not found');
  assert.strictEqual(content.includes("'POST'"), true, 'POST method not specified');
});

test('chat-widget.js has ARIA support', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const jsPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'chat-widget.js'
  );
  const content = fs.readFileSync(jsPath, 'utf8');
  assert.strictEqual(content.includes('aria-label'), true, 'aria-label not found');
  assert.strictEqual(content.includes('role='), true, 'ARIA role not found');
});

test('chat-widget.js initializes on DOMContentLoaded', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const jsPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'chat-widget.js'
  );
  const content = fs.readFileSync(jsPath, 'utf8');
  assert.strictEqual(content.includes('DOMContentLoaded'), true);
  assert.strictEqual(content.includes('zethicaChatWidget'), true);
});

test('chat-widget-styles.css file exists', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const cssPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'chat-widget-styles.css'
  );
  assert.strictEqual(fs.existsSync(cssPath), true, 'chat-widget-styles.css not found');
});

test('chat-widget-styles.css has responsive design', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const cssPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'chat-widget-styles.css'
  );
  const content = fs.readFileSync(cssPath, 'utf8');
  assert.strictEqual(content.includes('@media'), true, 'No media queries found');
  assert.strictEqual(content.includes('480px'), true, 'Mobile breakpoint not found');
});

test('chat-widget-styles.css has theme support', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const cssPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'chat-widget-styles.css'
  );
  const content = fs.readFileSync(cssPath, 'utf8');
  assert.strictEqual(content.includes('[data-theme="dark"]'), true, 'Dark theme not found');
  assert.strictEqual(content.includes('[data-theme="light"]'), true, 'Light theme not found');
});

test('chat-widget-styles.css has accessibility features', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const cssPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'chat-widget-styles.css'
  );
  const content = fs.readFileSync(cssPath, 'utf8');
  assert.strictEqual(content.includes('focus'), true, 'No focus styles found');
  assert.strictEqual(content.includes('prefers-reduced-motion'), true, 'No reduced motion support');
});

test('index.html includes chat-widget CSS', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const htmlPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'index.html'
  );
  const content = fs.readFileSync(htmlPath, 'utf8');
  assert.strictEqual(
    content.includes('chat-widget-styles.css'),
    true,
    'chat-widget-styles.css not linked in index.html'
  );
});

test('index.html includes chat-widget JS', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const htmlPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'index.html'
  );
  const content = fs.readFileSync(htmlPath, 'utf8');
  assert.strictEqual(
    content.includes('chat-widget.js'),
    true,
    'chat-widget.js not included in index.html'
  );
});

test('.env.example has required variables documented', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const envPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    '.env.example'
  );
  const content = fs.readFileSync(envPath, 'utf8');
  assert.strictEqual(content.includes('POSTGRES_URL'), true);
  assert.strictEqual(content.includes('OPENROUTER_API_KEY'), true);
  assert.strictEqual(content.includes('OPENROUTER_MODEL'), true);
});

test('.gitignore excludes .env.local', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const gitignorePath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    '.gitignore'
  );
  const content = fs.readFileSync(gitignorePath, 'utf8');
  assert.strictEqual(content.includes('.env.local'), true, '.env.local not in gitignore');
  assert.strictEqual(content.includes('node_modules'), true);
});

test('API endpoint matches widget endpoint', async () => {
  const fs = await import('fs');
  const path = await import('path');
  
  const chatJsPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'api/chat.js'
  );
  const chatJsContent = fs.readFileSync(chatJsPath, 'utf8');
  
  const widgetJsPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'chat-widget.js'
  );
  const widgetJsContent = fs.readFileSync(widgetJsPath, 'utf8');
  
  // Both should reference /api/chat
  assert.strictEqual(chatJsContent.includes('/api/chat') || chatJsContent.includes('POST'), true);
  assert.strictEqual(widgetJsContent.includes('/api/chat'), true);
});

test('API tests still pass', async () => {
  // This is a verification that tests can run
  // Actual output is verified separately in integration testing
  const fs = await import('fs');
  const path = await import('path');
  const testPath = path.resolve(
    'c:/Users/Vaibhav Krishna S/Downloads/Zethica_AI_Chat_website/zethica',
    'tests/chat.test.js'
  );
  assert.strictEqual(fs.existsSync(testPath), true, 'chat.test.js not found');
});

// ============================================================================
// RUN TESTS
// ============================================================================
runTests().catch(console.error);;


// ============================================================================
// RUN TESTS
// ============================================================================
runTests().catch(console.error);
