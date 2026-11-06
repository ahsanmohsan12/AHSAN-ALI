import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseYouTubeUrl,
  calculateViralPotential,
  calculateClipQualityScore,
  selectDailyCandidates,
  resolveRetryCheckpoint,
  detectDuplicateContentRisk,
  generateColabWorkerNotebook,
} from './viralEngine';

test('parseYouTubeUrl validates standard, short, and invalid URLs accurately', () => {
  const validWatch = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(validWatch.isValid, true);
  assert.equal(validWatch.videoId, 'dQw4w9WgXcQ');

  const validShort = parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=42');
  assert.equal(validShort.isValid, true);
  assert.equal(validShort.videoId, 'dQw4w9WgXcQ');

  const invalidHost = parseYouTubeUrl('https://vimeo.com/123456789');
  assert.equal(invalidHost.isValid, false);
  assert.equal(invalidHost.videoId, null);

  const malformedId = parseYouTubeUrl('https://www.youtube.com/watch?v=short');
  assert.equal(malformedId.isValid, false);
});

test('calculateViralPotential never invents growth velocity when only a single snapshot exists', () => {
  const singleResult = calculateViralPotential({
    publishedAtIso: '2026-11-05T10:00:00Z',
    currentSnapshot: {
      timestampIso: '2026-11-06T10:00:00Z',
      viewCount: 8400,
      likeCount: 620,
      commentCount: 95,
    },
    previousSnapshots: [],
  });

  assert.equal(singleResult.growthVelocityPerHour, null);
  assert.equal(singleResult.dataAvailability.hasHistoricalDelta, false);
  assert.equal(singleResult.confidence, 'Medium (Single-Snapshot)');
  assert.ok(singleResult.viralScore >= 50);

  const multiResult = calculateViralPotential({
    publishedAtIso: '2026-11-05T10:00:00Z',
    currentSnapshot: {
      timestampIso: '2026-11-06T10:00:00Z',
      viewCount: 14400,
      likeCount: 1100,
      commentCount: 180,
    },
    previousSnapshots: [
      {
        timestampIso: '2026-11-06T04:00:00Z',
        viewCount: 8400,
        likeCount: 620,
        commentCount: 95,
      },
    ],
  });

  assert.equal(multiResult.growthVelocityPerHour, 1000);
  assert.equal(multiResult.dataAvailability.hasHistoricalDelta, true);
  assert.equal(multiResult.confidence, 'High (Multi-Snapshot)');
});

test('calculateClipQualityScore classifies 80-100 Excellent, 65-79 Review, <65 Reject', () => {
  const excellent = calculateClipQualityScore({
    hookStrength: 92,
    viralPotential: 88,
    audioClarity: 90,
    captionAccuracy: 95,
    editingQuality: 86,
    pacing: 84,
    engagementPotential: 89,
    contextCompleteness: 91,
    durationSeconds: 78,
  });
  assert.equal(excellent.classification, 'Excellent');
  assert.equal(excellent.meetsThreshold, true);
  assert.ok(excellent.overallScore >= 80);

  const review = calculateClipQualityScore({
    hookStrength: 72,
    viralPotential: 70,
    audioClarity: 75,
    captionAccuracy: 74,
    editingQuality: 70,
    pacing: 68,
    engagementPotential: 71,
    contextCompleteness: 73,
    durationSeconds: 68,
  });
  assert.equal(review.classification, 'Review recommended');
  assert.ok(review.overallScore >= 65 && review.overallScore < 80);

  const reject = calculateClipQualityScore({
    hookStrength: 45,
    viralPotential: 50,
    audioClarity: 60,
    captionAccuracy: 55,
    editingQuality: 50,
    pacing: 48,
    engagementPotential: 52,
    contextCompleteness: 49,
    durationSeconds: 42, // Also penalized for being <60s
  });
  assert.equal(reject.classification, 'Reject or regenerate');
  assert.equal(reject.meetsThreshold, false);
});

test('selectDailyCandidates enforces source diversity and never pads weak clips to reach 5', () => {
  const candidates = [
    { clipId: 'c1', sourceVideoId: 'vidA', title: 'Clip 1', qualityScore: 91, durationSeconds: 75, startSeconds: 10, endSeconds: 85 },
    { clipId: 'c2', sourceVideoId: 'vidA', title: 'Clip 2', qualityScore: 86, durationSeconds: 82, startSeconds: 120, endSeconds: 202 },
    { clipId: 'c3', sourceVideoId: 'vidA', title: 'Clip 3', qualityScore: 84, durationSeconds: 70, startSeconds: 300, endSeconds: 370 },
    { clipId: 'c4', sourceVideoId: 'vidB', title: 'Clip 4', qualityScore: 79, durationSeconds: 90, startSeconds: 40, endSeconds: 130 },
    { clipId: 'c5', sourceVideoId: 'vidC', title: 'Weak Clip', qualityScore: 54, durationSeconds: 72, startSeconds: 10, endSeconds: 82 },
  ];

  const withDiversity = selectDailyCandidates(candidates, {
    dailyTarget: 5,
    minQualityScore: 65,
    sourceDiversityEnabled: true,
  });

  // Only 3 clips qualify (2 from vidA, 1 from vidB; c3 skipped for diversity, c5 rejected for low quality)
  assert.equal(withDiversity.selected.length, 3);
  assert.equal(withDiversity.skippedForDiversity.length, 1);
  assert.equal(withDiversity.skippedForDiversity[0].clipId, 'c3');
  assert.equal(withDiversity.rejectedBelowQuality.length, 1);
  assert.equal(withDiversity.rejectedBelowQuality[0].clipId, 'c5');
});

test('resolveRetryCheckpoint resumes from last valid checkpoint without restarting job', () => {
  const resumed = resolveRetryCheckpoint('transcribing', 1, 3);
  assert.equal(resumed.canRetry, true);
  assert.equal(resumed.resumeState, 'analyzing');
  assert.equal(resumed.resumeProgress, 55);
  assert.equal(resumed.nextRetryCount, 2);

  const exhausted = resolveRetryCheckpoint('transcribing', 3, 3);
  assert.equal(exhausted.canRetry, false);
});

test('detectDuplicateContentRisk flags overlapping clips on the same source video', () => {
  const existing = [{ clipId: 'clip_01', sourceVideoId: 'dQw4w9WgXcQ', startSeconds: 60, endSeconds: 140 }];
  const dup = detectDuplicateContentRisk('dQw4w9WgXcQ', 70, 150, existing);
  assert.equal(dup.isDuplicate, true);
  assert.equal(dup.conflictingClipId, 'clip_01');

  const clean = detectDuplicateContentRisk('dQw4w9WgXcQ', 200, 280, existing);
  assert.equal(clean.isDuplicate, false);
});

test('generateColabWorkerNotebook produces valid Jupyter Notebook JSON with T4 and Drive setup', () => {
  const raw = generateColabWorkerNotebook('https://viralmint.example.com');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.nbformat, 4);
  assert.equal(parsed.metadata.colab.gpuType, 'T4');
  assert.ok(parsed.cells.length >= 4);
});
