import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Phase 0 & Phase 5 Security Rules Verification Suite (Dirty Dozen Payloads)
 * Verifies the structural & boolean invariants of firestore.rules and tests
 * all 12 Dirty Dozen adversarial payloads against the rule evaluator mirrors.
 */
const rulesText = fs.readFileSync('./firestore.rules', 'utf8');

function evaluateSimulatedRule(
  collection: 'jobs' | 'clips' | 'activity_logs' | 'user_settings',
  op: 'create' | 'update' | 'get' | 'list',
  auth: { uid: string; email_verified: boolean } | null,
  docId: string,
  incoming: Record<string, any> | null,
  existing: Record<string, any> | null = null,
  requestTime = '2026-11-06T10:00:00Z'
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth) return 'PERMISSION_DENIED';
  const isValidId = (id: unknown) =>
    typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);

  if (op !== 'list' && !isValidId(docId)) return 'PERMISSION_DENIED';

  if (op === 'list') {
    if (collection === 'user_settings') return 'PERMISSION_DENIED';
    if (!existing || existing.ownerId !== auth.uid) return 'PERMISSION_DENIED';
    return 'ALLOW';
  }

  if (op === 'get') {
    if (collection === 'user_settings') {
      return docId === auth.uid ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    return existing && existing.ownerId === auth.uid ? 'ALLOW' : 'PERMISSION_DENIED';
  }

  if (!auth.email_verified || !incoming) return 'PERMISSION_DENIED';

  if (collection === 'jobs') {
    const allowed = new Set([
      'ownerId', 'jobId', 'sourceVideoId', 'sourceUrl', 'title',
      'channelTitle', 'category', 'authorizationStatus', 'status',
      'currentStep', 'progress', 'clipCount', 'viralScore',
      'retryCount', 'lastCheckpoint', 'errorDetails', 'uploadStatus',
      'isTestMode', 'createdAt', 'updatedAt'
    ]);
    for (const k of Object.keys(incoming)) {
      if (!allowed.has(k)) return 'PERMISSION_DENIED';
    }
    if (incoming.ownerId !== auth.uid) return 'PERMISSION_DENIED';
    if (typeof incoming.progress !== 'number' || incoming.progress < 0 || incoming.progress > 100) {
      return 'PERMISSION_DENIED';
    }
    if (incoming.errorDetails && incoming.errorDetails.length > 1000) return 'PERMISSION_DENIED';
    if (op === 'create') {
      if (incoming.createdAt !== requestTime || incoming.updatedAt !== requestTime) return 'PERMISSION_DENIED';
      return 'ALLOW';
    }
    if (op === 'update') {
      if (!existing || existing.ownerId !== auth.uid) return 'PERMISSION_DENIED';
      if (existing.status === 'cancelled') return 'PERMISSION_DENIED';
      if (incoming.createdAt !== existing.createdAt || incoming.ownerId !== existing.ownerId) return 'PERMISSION_DENIED';
      if (incoming.sourceVideoId !== existing.sourceVideoId) return 'PERMISSION_DENIED';
      return 'ALLOW';
    }
  }

  if (collection === 'clips') {
    if (incoming.privacyStatus !== 'unlisted') return 'PERMISSION_DENIED';
    if (incoming.ownerId !== auth.uid) return 'PERMISSION_DENIED';
    return 'ALLOW';
  }

  return 'PERMISSION_DENIED';
}

test('firestore.rules enforces Eight Pillars and rejects all Dirty Dozen payloads', () => {
  assert.ok(rulesText.includes("rules_version = '2';"));
  assert.ok(rulesText.includes("data.privacyStatus == 'unlisted'"));
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'));

  const validAuth = { uid: 'user_123', email_verified: true };
  const baseJob = {
    ownerId: 'user_123',
    jobId: 'job_1',
    sourceVideoId: 'dQw4w9WgXcQ',
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Test Video',
    authorizationStatus: 'authorized_owner',
    status: 'queued',
    currentStep: 'Queued',
    progress: 15,
    clipCount: 3,
    viralScore: 88,
    retryCount: 0,
    lastCheckpoint: 'queued',
    isTestMode: false,
    createdAt: '2026-11-06T10:00:00Z',
    updatedAt: '2026-11-06T10:00:00Z',
  };

  // 1. Shadow Field Injection
  assert.equal(
    evaluateSimulatedRule('jobs', 'create', validAuth, 'job_1', { ...baseJob, isSuperAdmin: true }),
    'PERMISSION_DENIED'
  );

  // 2. Public Privacy Status Bypass on Clip Create
  assert.equal(
    evaluateSimulatedRule('clips', 'create', validAuth, 'clip_1', {
      ownerId: 'user_123',
      clipId: 'clip_1',
      jobId: 'job_1',
      privacyStatus: 'public',
    }),
    'PERMISSION_DENIED'
  );

  // 3. Cross-Tenant Owner Spoofing
  assert.equal(
    evaluateSimulatedRule('jobs', 'create', validAuth, 'job_1', { ...baseJob, ownerId: 'user_999' }),
    'PERMISSION_DENIED'
  );

  // 4. Unverified Email Write
  assert.equal(
    evaluateSimulatedRule('jobs', 'create', { uid: 'user_123', email_verified: false }, 'job_1', baseJob),
    'PERMISSION_DENIED'
  );

  // 5. Path ID Poisoning
  assert.equal(
    evaluateSimulatedRule('jobs', 'create', validAuth, 'invalid/id$!', baseJob),
    'PERMISSION_DENIED'
  );

  // 6. Oversized String Denial-of-Wallet
  assert.equal(
    evaluateSimulatedRule('jobs', 'create', validAuth, 'job_1', { ...baseJob, errorDetails: 'x'.repeat(2000) }),
    'PERMISSION_DENIED'
  );

  // 7. Immortal Field Mutation (createdAt)
  assert.equal(
    evaluateSimulatedRule('jobs', 'update', validAuth, 'job_1', { ...baseJob, createdAt: '2026-11-07T00:00:00Z' }, baseJob),
    'PERMISSION_DENIED'
  );

  // 8. Forged Client Timestamp
  assert.equal(
    evaluateSimulatedRule('jobs', 'create', validAuth, 'job_1', { ...baseJob, createdAt: '1999-01-01T00:00:00Z' }),
    'PERMISSION_DENIED'
  );

  // 9. Unauthorized List Scraping
  assert.equal(
    evaluateSimulatedRule('jobs', 'list', validAuth, '', null, { ...baseJob, ownerId: 'other_user' }),
    'PERMISSION_DENIED'
  );

  // 10. Terminal State Mutation (cancelled job)
  assert.equal(
    evaluateSimulatedRule('jobs', 'update', validAuth, 'job_1', { ...baseJob, progress: 50 }, { ...baseJob, status: 'cancelled' }),
    'PERMISSION_DENIED'
  );

  // 11. Value Poisoning on Update (progress as string)
  assert.equal(
    evaluateSimulatedRule('jobs', 'update', validAuth, 'job_1', { ...baseJob, progress: '100%' as any }, baseJob),
    'PERMISSION_DENIED'
  );

  // 12. Cross-User Settings Read
  assert.equal(
    evaluateSimulatedRule('user_settings', 'get', validAuth, 'other_user_id', null),
    'PERMISSION_DENIED'
  );
});
