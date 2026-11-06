/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * ViralMint AI — Deterministic Seed Data & Types
 */

import {
  JobState,
  NicheCategory,
  VideoSnapshot,
  ViralScoreResult,
  ClipQualityInput,
  calculateViralPotential,
  calculateClipQualityScore,
} from '../utils/viralEngine';

export type { NicheCategory, JobState };

export const GENERATED_ASSETS = {
  podcastThumb: '/src/assets/images/thumb_tech_podcast_1793990766827.jpg',
  broadcastThumb: '/src/assets/images/thumb_gaming_esports_1793990768656.jpg',
  scienceThumb: '/src/assets/images/thumb_science_lab_1793990768824.jpg',
  creatorAvatar: '/src/assets/images/avatar_creator_profile_1793990769625.jpg',
};

export interface DiscoveredVideoItem {
  videoId: string;
  url: string;
  title: string;
  channelTitle: string;
  category: NicheCategory;
  publishedAt: string;
  durationLabel: string;
  durationSeconds: number;
  thumbnailUrl: string;
  snapshots: VideoSnapshot[];
  viralEvaluation: ViralScoreResult;
  authorizationStatus: 'authorized_owner' | 'licensed' | 'creative_commons' | 'pending_declaration';
  sourceAttribution: string;
}

export interface CaptionWord {
  word: string;
  startOffset: number; // seconds relative to clip start
  endOffset: number;
  isHighlightedYellow: boolean;
  emoji?: string;
}

export interface CaptionStyleConfig {
  fontFamily: 'Outfit' | 'Plus Jakarta Sans' | 'JetBrains Mono';
  fontSizePx: number;
  verticalPositionPercent: number; // 15 to 85
  animationStyle: 'pop_scale' | 'bounce_wave' | 'clean_fade';
  highlightColor: string; // default #FACC15 (Yellow)
  baseColor: string; // default #FFFFFF (White)
  outlineWidthPx: number;
  shadowEnabled: boolean;
  showEmojis: boolean;
}

export interface AudioMixConfig {
  originalVolumePercent: number; // default 100
  backgroundMusicEnabled: boolean;
  backgroundMusicTrack: 'Cyber Pulse (CC-BY)' | 'Deep Focus Ambient (CC0)' | 'Studio Documentary (CC-BY)';
  backgroundMusicVolumePercent: number; // capped <= 30% so original dialogue has priority
  autoDuckingEnabled: boolean;
  targetLoudnessLufs: number; // -14 LUFS
}

export interface SeoMetadataPackage {
  seoTitle: string;
  description: string;
  hashtags: string[];
  tags: string[];
  suggestedCategory: NicheCategory;
  keywords: string[];
  thumbnailText: string;
  chapters: string[];
}

export interface ViralClipItem {
  clipId: string;
  jobId: string;
  sourceVideoId: string;
  sourceUrl: string;
  sourceChannel: string;
  title: string;
  hookText: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  aspectRatio: '9:16';
  resolution: '1080x1920';
  codec: 'H.264 MP4';
  cropOffsetX: number; // -50 to 50 smart reframe horizontal pan
  zoomScale: number; // 1.0 to 1.6
  thumbnailUrl: string;
  captionWords: CaptionWord[];
  captionStyle: CaptionStyleConfig;
  audioMix: AudioMixConfig;
  seoMetadata: SeoMetadataPackage;
  qualityMetrics: ClipQualityInput;
  qualityScore: number;
  qualityClassification: 'Excellent' | 'Review recommended' | 'Reject or regenerate';
  qualityReasons: string[];
  approvalStatus: 'awaiting_review' | 'approved' | 'rejected' | 'uploaded_unlisted';
  privacyStatus: 'unlisted';
  youtubeVideoId?: string;
  driveFileId?: string;
  isTestMode: boolean;
  lastRenderedAt: string;
}

export interface PersistentJobItem {
  jobId: string;
  sourceVideoId: string;
  sourceUrl: string;
  title: string;
  channelTitle: string;
  category: NicheCategory;
  thumbnailUrl: string;
  authorizationStatus: 'authorized_owner' | 'licensed' | 'creative_commons' | 'pending_declaration';
  ownershipDeclarationText: string;
  discoveryDate: string;
  status: JobState;
  currentStep: string;
  progress: number;
  clipCount: number;
  viralScore: number;
  outputFileIds: string[];
  errorDetails?: string;
  suggestedFix?: string;
  retryCount: number;
  lastCheckpoint: JobState;
  uploadStatus: 'not_uploaded' | 'awaiting_upload_approval' | 'uploaded_unlisted';
  youtubeVideoIds: string[];
  isTestMode: boolean;
}

export interface ActivityLogEntry {
  eventId: string;
  timestampIso: string;
  category:
    | 'discovery'
    | 'viral_scoring'
    | 'approval'
    | 'processing'
    | 'clip_generation'
    | 'rendering'
    | 'upload'
    | 'worker'
    | 'api_error'
    | 'backup';
  status: 'info' | 'success' | 'warning' | 'error';
  jobId?: string;
  message: string;
  details?: string;
}

export interface NotificationItem {
  id: string;
  timestampIso: string;
  title: string;
  body: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  actionTab?: string;
}

const snap1Prev: VideoSnapshot[] = [
  { timestampIso: '2026-11-06T02:00:00Z', viewCount: 42100, likeCount: 3890, commentCount: 412 },
  { timestampIso: '2026-11-06T06:00:00Z', viewCount: 58900, likeCount: 5410, commentCount: 620 },
];
const snap1Curr: VideoSnapshot = {
  timestampIso: '2026-11-06T10:00:00Z',
  viewCount: 79400,
  likeCount: 7420,
  commentCount: 890,
};

const snap2Prev: VideoSnapshot[] = [
  { timestampIso: '2026-11-06T04:00:00Z', viewCount: 6800, likeCount: 710, commentCount: 118 },
];
const snap2Curr: VideoSnapshot = {
  timestampIso: '2026-11-06T10:00:00Z',
  viewCount: 12950,
  likeCount: 1390,
  commentCount: 245,
};

const snap3Curr: VideoSnapshot = {
  timestampIso: '2026-11-06T10:00:00Z',
  viewCount: 194200,
  likeCount: 14200,
  commentCount: 1640,
};

export const INITIAL_DISCOVERED_VIDEOS: DiscoveredVideoItem[] = [
  {
    videoId: 'M7lc1UVf-VE',
    url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    title: 'Inside the Next-Gen Sub-Millisecond AI Inference Architecture',
    channelTitle: 'DeepSystems Podcast',
    category: 'Technology',
    publishedAt: '2026-11-05T16:00:00Z',
    durationLabel: '48:15',
    durationSeconds: 2895,
    thumbnailUrl: GENERATED_ASSETS.podcastThumb,
    snapshots: [...snap1Prev, snap1Curr],
    viralEvaluation: calculateViralPotential({
      publishedAtIso: '2026-11-05T16:00:00Z',
      currentSnapshot: snap1Curr,
      previousSnapshots: snap1Prev,
      categoryRelevanceScore: 94,
    }),
    authorizationStatus: 'authorized_owner',
    sourceAttribution: 'DeepSystems Podcast (https://www.youtube.com/watch?v=M7lc1UVf-VE) — Creator Owned Channel',
  },
  {
    videoId: 'aqz-KE-bpKQ',
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    title: 'Why Photonic Cryo-Processors Change Quantum Scaling Forever',
    channelTitle: 'Frontier Science Lab',
    category: 'Science',
    publishedAt: '2026-11-05T22:00:00Z',
    durationLabel: '32:40',
    durationSeconds: 1960,
    thumbnailUrl: GENERATED_ASSETS.scienceThumb,
    snapshots: [...snap2Prev, snap2Curr],
    viralEvaluation: calculateViralPotential({
      publishedAtIso: '2026-11-05T22:00:00Z',
      currentSnapshot: snap2Curr,
      previousSnapshots: snap2Prev,
      categoryRelevanceScore: 91,
    }),
    authorizationStatus: 'creative_commons',
    sourceAttribution: 'Frontier Science Lab (https://www.youtube.com/watch?v=aqz-KE-bpKQ) — CC-BY 4.0 Verified',
  },
  {
    videoId: 'jNQXAC9IVRw',
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    title: 'Live Broadcast Engineering: Zero-Drop 120fps Arena Production',
    channelTitle: 'Arena Broadcast Engineering',
    category: 'Gaming',
    publishedAt: '2026-11-04T14:00:00Z',
    durationLabel: '1:14:20',
    durationSeconds: 4460,
    thumbnailUrl: GENERATED_ASSETS.broadcastThumb,
    snapshots: [snap3Curr],
    viralEvaluation: calculateViralPotential({
      publishedAtIso: '2026-11-04T14:00:00Z',
      currentSnapshot: snap3Curr,
      previousSnapshots: [],
      categoryRelevanceScore: 86,
    }),
    authorizationStatus: 'licensed',
    sourceAttribution: 'Arena Broadcast Engineering (https://www.youtube.com/watch?v=jNQXAC9IVRw) — Written Syndication License #SL-884',
  },
];

const q1Metrics: ClipQualityInput = {
  hookStrength: 94,
  viralPotential: 91,
  audioClarity: 92,
  captionAccuracy: 96,
  editingQuality: 89,
  pacing: 90,
  engagementPotential: 92,
  contextCompleteness: 93,
  durationSeconds: 78,
};
const q1Eval = calculateClipQualityScore(q1Metrics, 65);

const q2Metrics: ClipQualityInput = {
  hookStrength: 88,
  viralPotential: 86,
  audioClarity: 90,
  captionAccuracy: 94,
  editingQuality: 85,
  pacing: 84,
  engagementPotential: 87,
  contextCompleteness: 89,
  durationSeconds: 92,
};
const q2Eval = calculateClipQualityScore(q2Metrics, 65);

const q3Metrics: ClipQualityInput = {
  hookStrength: 74,
  viralPotential: 76,
  audioClarity: 81,
  captionAccuracy: 85,
  editingQuality: 72,
  pacing: 70,
  engagementPotential: 75,
  contextCompleteness: 78,
  durationSeconds: 68,
};
const q3Eval = calculateClipQualityScore(q3Metrics, 65);

export const INITIAL_CLIPS: ViralClipItem[] = [
  {
    clipId: 'clip_vm_101',
    jobId: 'job_vm_201',
    sourceVideoId: 'M7lc1UVf-VE',
    sourceUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    sourceChannel: 'DeepSystems Podcast',
    title: 'Why Memory Bandwidth Is the Real AI Bottleneck in 2026',
    hookText: 'Everyone blames GPU compute, but 91% of your latency is actually memory movement.',
    startSeconds: 412,
    endSeconds: 490,
    durationSeconds: 78,
    aspectRatio: '9:16',
    resolution: '1080x1920',
    codec: 'H.264 MP4',
    cropOffsetX: -4,
    zoomScale: 1.12,
    thumbnailUrl: GENERATED_ASSETS.podcastThumb,
    captionWords: [
      { word: 'Everyone', startOffset: 0.0, endOffset: 0.45, isHighlightedYellow: false },
      { word: 'blames', startOffset: 0.45, endOffset: 0.85, isHighlightedYellow: false },
      { word: 'GPU', startOffset: 0.85, endOffset: 1.3, isHighlightedYellow: true, emoji: '⚡' },
      { word: 'compute,', startOffset: 1.3, endOffset: 1.8, isHighlightedYellow: true },
      { word: 'but', startOffset: 1.8, endOffset: 2.05, isHighlightedYellow: false },
      { word: '91%', startOffset: 2.05, endOffset: 2.6, isHighlightedYellow: true, emoji: '🔥' },
      { word: 'of', startOffset: 2.6, endOffset: 2.8, isHighlightedYellow: false },
      { word: 'latency', startOffset: 2.8, endOffset: 3.35, isHighlightedYellow: true },
      { word: 'is', startOffset: 3.35, endOffset: 3.55, isHighlightedYellow: false },
      { word: 'memory', startOffset: 3.55, endOffset: 4.1, isHighlightedYellow: true },
      { word: 'bandwidth.', startOffset: 4.1, endOffset: 4.8, isHighlightedYellow: true },
    ],
    captionStyle: {
      fontFamily: 'Outfit',
      fontSizePx: 42,
      verticalPositionPercent: 74,
      animationStyle: 'pop_scale',
      highlightColor: '#FACC15',
      baseColor: '#FFFFFF',
      outlineWidthPx: 4,
      shadowEnabled: true,
      showEmojis: true,
    },
    audioMix: {
      originalVolumePercent: 100,
      backgroundMusicEnabled: true,
      backgroundMusicTrack: 'Deep Focus Ambient (CC0)',
      backgroundMusicVolumePercent: 14,
      autoDuckingEnabled: true,
      targetLoudnessLufs: -14,
    },
    seoMetadata: {
      seoTitle: 'Why Memory Bandwidth Is the Real AI Bottleneck (Not FLOPs)',
      description:
        'An breakdown of why SRAM locality and HBM bandwidth dictate real-world token generation speed.\n\nOriginal Source: DeepSystems Podcast (https://www.youtube.com/watch?v=M7lc1UVf-VE)',
      hashtags: ['#AIEngineering', '#GPUs', '#SystemsArchitecture', '#TechPodcast'],
      tags: ['AI inference', 'GPU memory bandwidth', 'HBM3e', 'DeepSystems Podcast', 'hardware architecture'],
      suggestedCategory: 'Technology',
      keywords: ['memory bandwidth', 'AI latency', 'GPU bottleneck'],
      thumbnailText: '91% OF LATENCY IS MEMORY',
      chapters: ['0:00 The Compute Myth', '0:28 HBM vs SRAM Wall', '0:58 How Wafer-Scale Fixes It'],
    },
    qualityMetrics: q1Metrics,
    qualityScore: q1Eval.overallScore,
    qualityClassification: q1Eval.classification,
    qualityReasons: q1Eval.reasons,
    approvalStatus: 'approved',
    privacyStatus: 'unlisted',
    driveFileId: 'drive_file_vm_101_mp4',
    isTestMode: false,
    lastRenderedAt: '2026-11-06T09:42:00Z',
  },
  {
    clipId: 'clip_vm_102',
    jobId: 'job_vm_202',
    sourceVideoId: 'aqz-KE-bpKQ',
    sourceUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    sourceChannel: 'Frontier Science Lab',
    title: 'How 4-Kelvin Optical Interconnects Eliminate Thermal Noise',
    hookText: 'Inside this gold cryostat, copper wires are replaced with single-photon waveguides.',
    startSeconds: 820,
    endSeconds: 912,
    durationSeconds: 92,
    aspectRatio: '9:16',
    resolution: '1080x1920',
    codec: 'H.264 MP4',
    cropOffsetX: 2,
    zoomScale: 1.18,
    thumbnailUrl: GENERATED_ASSETS.scienceThumb,
    captionWords: [
      { word: 'Inside', startOffset: 0.0, endOffset: 0.4, isHighlightedYellow: false },
      { word: 'this', startOffset: 0.4, endOffset: 0.7, isHighlightedYellow: false },
      { word: '4-Kelvin', startOffset: 0.7, endOffset: 1.3, isHighlightedYellow: true, emoji: '❄️' },
      { word: 'cryostat,', startOffset: 1.3, endOffset: 1.9, isHighlightedYellow: true },
      { word: 'copper', startOffset: 1.9, endOffset: 2.35, isHighlightedYellow: false },
      { word: 'is', startOffset: 2.35, endOffset: 2.55, isHighlightedYellow: false },
      { word: 'replaced', startOffset: 2.55, endOffset: 3.1, isHighlightedYellow: false },
      { word: 'by', startOffset: 3.1, endOffset: 3.3, isHighlightedYellow: false },
      { word: 'photons.', startOffset: 3.3, endOffset: 4.1, isHighlightedYellow: true, emoji: '✨' },
    ],
    captionStyle: {
      fontFamily: 'Outfit',
      fontSizePx: 40,
      verticalPositionPercent: 76,
      animationStyle: 'bounce_wave',
      highlightColor: '#FACC15',
      baseColor: '#FFFFFF',
      outlineWidthPx: 4,
      shadowEnabled: true,
      showEmojis: true,
    },
    audioMix: {
      originalVolumePercent: 100,
      backgroundMusicEnabled: true,
      backgroundMusicTrack: 'Studio Documentary (CC-BY)',
      backgroundMusicVolumePercent: 12,
      autoDuckingEnabled: true,
      targetLoudnessLufs: -14,
    },
    seoMetadata: {
      seoTitle: 'Inside a 4-Kelvin Photonic Quantum Interconnect',
      description:
        'Why replacing coaxial copper cables with optical fibers inside dilution refrigerators unlocks 100,000-qubit scaling.\n\nSource: Frontier Science Lab (https://www.youtube.com/watch?v=aqz-KE-bpKQ) CC-BY 4.0',
      hashtags: ['#QuantumComputing', '#Photonics', '#Physics', '#Cryogenics'],
      tags: ['quantum computing', 'dilution refrigerator', 'photonics', 'cryostat'],
      suggestedCategory: 'Science',
      keywords: ['4-kelvin cryostat', 'optical interconnect', 'quantum scaling'],
      thumbnailText: 'ZERO THERMAL NOISE AT 4K',
      chapters: ['0:00 The Coaxial Heat Problem', '0:34 Single-Photon Waveguides', '1:10 Lab Test Results'],
    },
    qualityMetrics: q2Metrics,
    qualityScore: q2Eval.overallScore,
    qualityClassification: q2Eval.classification,
    qualityReasons: q2Eval.reasons,
    approvalStatus: 'uploaded_unlisted',
    privacyStatus: 'unlisted',
    youtubeVideoId: 'yt_unlisted_98kLm2P',
    driveFileId: 'drive_file_vm_102_mp4',
    isTestMode: false,
    lastRenderedAt: '2026-11-06T08:30:00Z',
  },
  {
    clipId: 'clip_vm_103',
    jobId: 'job_vm_203',
    sourceVideoId: 'jNQXAC9IVRw',
    sourceUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    sourceChannel: 'Arena Broadcast Engineering',
    title: 'How Redundant Genlock Saves Live Esports Broadcasts',
    hookText: 'When a main fiber line drops mid-finals, genlock failover has 4 milliseconds to react.',
    startSeconds: 1420,
    endSeconds: 1488,
    durationSeconds: 68,
    aspectRatio: '9:16',
    resolution: '1080x1920',
    codec: 'H.264 MP4',
    cropOffsetX: 8,
    zoomScale: 1.08,
    thumbnailUrl: GENERATED_ASSETS.broadcastThumb,
    captionWords: [
      { word: 'When', startOffset: 0.0, endOffset: 0.35, isHighlightedYellow: false },
      { word: 'main', startOffset: 0.35, endOffset: 0.7, isHighlightedYellow: false },
      { word: 'fiber', startOffset: 0.7, endOffset: 1.1, isHighlightedYellow: true },
      { word: 'drops,', startOffset: 1.1, endOffset: 1.55, isHighlightedYellow: true },
      { word: 'genlock', startOffset: 1.55, endOffset: 2.1, isHighlightedYellow: true, emoji: '🎯' },
      { word: 'switches', startOffset: 2.1, endOffset: 2.6, isHighlightedYellow: false },
      { word: 'in', startOffset: 2.6, endOffset: 2.8, isHighlightedYellow: false },
      { word: '4ms.', startOffset: 2.8, endOffset: 3.4, isHighlightedYellow: true },
    ],
    captionStyle: {
      fontFamily: 'Outfit',
      fontSizePx: 42,
      verticalPositionPercent: 75,
      animationStyle: 'pop_scale',
      highlightColor: '#FACC15',
      baseColor: '#FFFFFF',
      outlineWidthPx: 4,
      shadowEnabled: true,
      showEmojis: false,
    },
    audioMix: {
      originalVolumePercent: 100,
      backgroundMusicEnabled: false,
      backgroundMusicTrack: 'Cyber Pulse (CC-BY)',
      backgroundMusicVolumePercent: 10,
      autoDuckingEnabled: true,
      targetLoudnessLufs: -14,
    },
    seoMetadata: {
      seoTitle: 'How 4ms Genlock Failover Saves Live Arena Broadcasts',
      description:
        'A tour of dual-path SMPTE ST 2110 broadcast switching during live tournament production.\n\nSource: Arena Broadcast Engineering (https://www.youtube.com/watch?v=jNQXAC9IVRw)',
      hashtags: ['#BroadcastEngineering', '#EsportsProduction', '#LiveVideo'],
      tags: ['SMPTE 2110', 'genlock', 'broadcast switcher', 'live production'],
      suggestedCategory: 'Gaming',
      keywords: ['genlock failover', 'broadcast engineering', 'live video'],
      thumbnailText: '4MS FAILOVER SWITCH',
      chapters: ['0:00 Fiber Line Cut', '0:25 SMPTE 2110 Hitless Merge'],
    },
    qualityMetrics: q3Metrics,
    qualityScore: q3Eval.overallScore,
    qualityClassification: q3Eval.classification,
    qualityReasons: q3Eval.reasons,
    approvalStatus: 'awaiting_review',
    privacyStatus: 'unlisted',
    driveFileId: 'drive_file_vm_103_mp4',
    isTestMode: false,
    lastRenderedAt: '2026-11-06T10:12:00Z',
  },
];

export const INITIAL_JOBS: PersistentJobItem[] = [
  {
    jobId: 'job_vm_201',
    sourceVideoId: 'M7lc1UVf-VE',
    sourceUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    title: 'Inside the Next-Gen Sub-Millisecond AI Inference Architecture',
    channelTitle: 'DeepSystems Podcast',
    category: 'Technology',
    thumbnailUrl: GENERATED_ASSETS.podcastThumb,
    authorizationStatus: 'authorized_owner',
    ownershipDeclarationText: 'Verified creator-owned podcast channel',
    discoveryDate: '2026-11-06T05:00:00Z',
    status: 'awaiting_upload_approval',
    currentStep: 'Completed & Synced to Google Drive — Awaiting Final Unlisted Upload Approval',
    progress: 100,
    clipCount: 2,
    viralScore: 91,
    outputFileIds: ['drive_file_vm_101_mp4'],
    retryCount: 0,
    lastCheckpoint: 'completed',
    uploadStatus: 'awaiting_upload_approval',
    youtubeVideoIds: [],
    isTestMode: false,
  },
  {
    jobId: 'job_vm_202',
    sourceVideoId: 'aqz-KE-bpKQ',
    sourceUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    title: 'Why Photonic Cryo-Processors Change Quantum Scaling Forever',
    channelTitle: 'Frontier Science Lab',
    category: 'Science',
    thumbnailUrl: GENERATED_ASSETS.scienceThumb,
    authorizationStatus: 'creative_commons',
    ownershipDeclarationText: 'Creative Commons CC-BY 4.0 with full source attribution',
    discoveryDate: '2026-11-06T05:00:00Z',
    status: 'uploaded_unlisted',
    currentStep: 'Uploaded to YouTube with privacyStatus="unlisted"',
    progress: 100,
    clipCount: 1,
    viralScore: 89,
    outputFileIds: ['drive_file_vm_102_mp4'],
    retryCount: 0,
    lastCheckpoint: 'completed',
    uploadStatus: 'uploaded_unlisted',
    youtubeVideoIds: ['yt_unlisted_98kLm2P'],
    isTestMode: false,
  },
  {
    jobId: 'job_vm_203',
    sourceVideoId: 'jNQXAC9IVRw',
    sourceUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    title: 'Live Broadcast Engineering: Zero-Drop 120fps Arena Production',
    channelTitle: 'Arena Broadcast Engineering',
    category: 'Gaming',
    thumbnailUrl: GENERATED_ASSETS.broadcastThumb,
    authorizationStatus: 'licensed',
    ownershipDeclarationText: 'Syndication License #SL-884 on file',
    discoveryDate: '2026-11-06T06:30:00Z',
    status: 'awaiting_approval',
    currentStep: 'Awaiting User Processing Approval (Processing Approval Toggle = ON)',
    progress: 10,
    clipCount: 2,
    viralScore: 82,
    outputFileIds: [],
    retryCount: 0,
    lastCheckpoint: 'awaiting_approval',
    uploadStatus: 'not_uploaded',
    youtubeVideoIds: [],
    isTestMode: false,
  },
  {
    jobId: 'job_vm_204_failed',
    sourceVideoId: 'dQw4w9WgXcQ',
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Distributed Consensus Under High Packet Loss — Lecture 09',
    channelTitle: 'Systems University OpenCourse',
    category: 'Education',
    thumbnailUrl: GENERATED_ASSETS.podcastThumb,
    authorizationStatus: 'creative_commons',
    ownershipDeclarationText: 'OpenCourseWare CC-BY License',
    discoveryDate: '2026-11-06T07:15:00Z',
    status: 'failed',
    currentStep: 'Interrupted during Scene & Hook Boundary Detection',
    progress: 40,
    clipCount: 2,
    viralScore: 78,
    outputFileIds: ['drive_transcript_204.json'],
    errorDetails: 'Colab Tesla T4 runtime idle timeout after Whisper transcription completed.',
    suggestedFix: 'Click "Resume from Checkpoint" to continue directly at Scene Analysis (40% -> 55%) without re-running Whisper transcription.',
    retryCount: 1,
    lastCheckpoint: 'transcribing',
    uploadStatus: 'not_uploaded',
    youtubeVideoIds: [],
    isTestMode: false,
  },
];

export const INITIAL_ACTIVITY_LOGS: ActivityLogEntry[] = [
  {
    eventId: 'evt_01',
    timestampIso: '2026-11-06T10:12:00Z',
    category: 'rendering',
    status: 'success',
    jobId: 'job_vm_201',
    message: 'Rendered 1080x1920 H.264 clip_vm_101 (78s) with yellow/white pop captions and -14 LUFS audio ducking.',
  },
  {
    eventId: 'evt_02',
    timestampIso: '2026-11-06T09:50:00Z',
    category: 'upload',
    status: 'success',
    jobId: 'job_vm_202',
    message: 'Verified YouTube upload (ID: yt_unlisted_98kLm2P) with enforced privacyStatus = "unlisted".',
  },
  {
    eventId: 'evt_03',
    timestampIso: '2026-11-06T08:15:00Z',
    category: 'worker',
    status: 'warning',
    jobId: 'job_vm_204_failed',
    message: 'Colab Tesla T4 worker disconnected after saving checkpoint "transcribing" to ViralMint/jobs/.',
  },
  {
    eventId: 'evt_04',
    timestampIso: '2026-11-06T05:00:00Z',
    category: 'discovery',
    status: 'info',
    message: '10:00 AM Asia/Karachi daily discovery job scanned candidate videos and recorded historical view snapshots.',
  },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_1',
    timestampIso: '2026-11-06T10:12:00Z',
    title: 'Clip Ready for Unlisted Upload Approval',
    body: '"Why Memory Bandwidth Is the Real AI Bottleneck in 2026" scored 92/100 (Excellent) and awaits your upload confirmation.',
    severity: 'success',
    read: false,
    actionTab: 'upload',
  },
  {
    id: 'notif_2',
    timestampIso: '2026-11-06T08:15:00Z',
    title: 'Colab Worker Disconnected — Checkpoint Saved',
    body: 'Job job_vm_204_failed saved its Whisper transcript checkpoint at 40%. Resume directly from Scene Analysis.',
    severity: 'warning',
    read: false,
    actionTab: 'jobs',
  },
  {
    id: 'notif_3',
    timestampIso: '2026-11-06T06:30:00Z',
    title: 'Candidate Video Awaiting Processing Approval',
    body: '"Live Broadcast Engineering: Zero-Drop 120fps Arena Production" (Viral Score 82/100) is waiting in your Approval Queue.',
    severity: 'info',
    read: false,
    actionTab: 'approval',
  },
];
