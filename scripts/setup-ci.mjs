/**
 * One-time CI/CD setup: creates Cloudflare API token page in browser,
 * then sets GitHub secrets automatically once you paste the token.
 * Run once: node scripts/setup-ci.mjs
 */
import { execSync } from 'child_process';
import { createInterface } from 'readline';

const ACCOUNT_ID = '77955b4e01630aac3d34b0bc6c9c7b61';
const TOKEN_URL  = 'https://dash.cloudflare.com/profile/api-tokens';

console.log('\n── Keto Tracker CI/CD Setup ──────────────────────────────────\n');
console.log('Opening Cloudflare API Tokens page in your browser...\n');

// Open the browser (Windows)
try { execSync(`start "" "${TOKEN_URL}"`); } catch {}

console.log('In the browser:');
console.log('  1. Click "Create Token"');
console.log('  2. Scroll down and click "Create Custom Token" → "Get started"');
console.log('  3. Token name: keto-tracker-ci');
console.log('  4. Under Permissions, add:');
console.log('       Account  |  Cloudflare Pages  |  Edit');
console.log('  5. Click "Continue to summary" → "Create Token"');
console.log('  6. Copy the token shown (you won\'t see it again)\n');
console.log('──────────────────────────────────────────────────────────────\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.question('Paste your Cloudflare API token here and press Enter: ', (token) => {
  rl.close();
  token = token.trim();

  if (!token) {
    console.error('\n✗ No token provided. Run this script again.');
    process.exit(1);
  }

  console.log('\nSetting GitHub secrets...');
  try {
    execSync(`gh secret set CLOUDFLARE_API_TOKEN --body "${token}"`,        { stdio: 'inherit' });
    execSync(`gh secret set CLOUDFLARE_ACCOUNT_ID --body "${ACCOUNT_ID}"`,  { stdio: 'inherit' });
  } catch (e) {
    console.error('\n✗ Failed to set secrets. Make sure "gh" is authenticated (gh auth status).');
    process.exit(1);
  }

  console.log('\n✓ Done! Both secrets are now set on GitHub.');
  console.log('  Every git push to master will now automatically:');
  console.log('    • Run tests');
  console.log('    • Bump the patch version (0.0.1 → 0.0.2 etc.)');
  console.log('    • Build the PWA');
  console.log('    • Deploy to https://keto-deficit-tracker.pages.dev');
  console.log('    • Create a git version tag\n');
});
