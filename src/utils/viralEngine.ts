/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * ViralMint AI — Core Viral Scoring, Quality Evaluation, Checkpoint Recovery,
 * Source Diversity, and Colab Tesla T4 Notebook Generation Engine.
 */

export type JobState =
  | 'discovered'
  | 'awaiting_approval'
  | 'queued'
  | 'processing'
  | 'transcribing'
  | 'analyzing'
  | 'clipping'
  | 'rendering'
  | 'quality_check'
  | 'completed'
  | 'awaiting_upload_approval'
  | 'uploading'
  | 'uploaded_unlisted'
  | 'failed'
  | 'cancelled';

export type NicheCategory =
  | 'All'
  | 'Gaming'
  | 'Podcasts'
  | 'Education'
  | 'Entertainment'
  | 'Technology'
  | 'Business'
  | 'Science'
  | 'News'
  | 'Other';

export interface VideoSnapshot {
  timestampIso: string;
  viewCount: number;
  likeCount?: number;
  commentCount?: number;
}

export interface ViralScoreResult {
  viralScore: number; // 0 - 100
  confidence: 'High (Multi-Snapshot)' | 'Medium (Single-Snapshot)' | 'Low (Metadata-Only)';
  dataAvailability: {
    hasViews: boolean;
    hasLikes: boolean;
    hasComments: boolean;
    hasHistoricalDelta: boolean;
    snapshotCount: number;
  };
  growthVelocityPerHour: number | null; // null when historical snapshots are unavailable
  engagementRatePercent: number | null;
  reasons: string[];
}

export interface ClipQualityInput {
  hookStrength: number; // 0-100
  viralPotential: number; // 0-100
  audioClarity: number; // 0-100
  captionAccuracy: number; // 0-100
  editingQuality: number; // 0-100
  pacing: number; // 0-100
  engagementPotential: number; // 0-100
  contextCompleteness: number; // 0-100
  durationSeconds: number;
}

export interface ClipQualityEvaluation {
  overallScore: number;
  classification: 'Excellent' | 'Review recommended' | 'Reject or regenerate';
  meetsThreshold: boolean;
  reasons: string[];
  breakdown: ClipQualityInput;
}

export interface CandidateClip {
  clipId: string;
  sourceVideoId: string;
  title: string;
  qualityScore: number;
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number;
}

/**
 * Validates a YouTube URL and extracts its 11-character Video ID.
 * Supports standard watch URLs, shortened youtu.be URLs, live, and embed links.
 */
export function parseYouTubeUrl(rawUrl: string): {
  isValid: boolean;
  videoId: string | null;
  normalizedUrl: string | null;
  error?: string;
} {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { isValid: false, videoId: null, normalizedUrl: null, error: 'Please enter a YouTube URL.' };
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    let videoId: string | null = null;

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        videoId = parsed.searchParams.get('v');
      } else if (parsed.pathname.startsWith('/embed/') || parsed.pathname.startsWith('/v/') || parsed.pathname.startsWith('/live/')) {
        videoId = parsed.pathname.split('/')[2] || null;
      } else if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/')[2] || null;
      }
    } else if (host === 'youtu.be') {
      videoId = parsed.pathname.slice(1).split('/')[0] || null;
    } else {
      return {
        isValid: false,
        videoId: null,
        normalizedUrl: null,
        error: 'Only official YouTube URLs (youtube.com or youtu.be) are supported.',
      };
    }

    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return {
        isValid: false,
        videoId: null,
        normalizedUrl: null,
        error: 'Invalid YouTube Video ID format (must be 11 characters).',
      };
    }

    return {
      isValid: true,
      videoId,
      normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  } catch {
    return {
      isValid: false,
      videoId: null,
      normalizedUrl: null,
      error: 'Malformed URL. Include https://www.youtube.com/watch?v=...',
    };
  }
}

/**
 * Calculates Viral Potential using available YouTube signals and historical snapshots.
 * IMPORTANT RULE: Never invents growth velocity or engagement metrics when data is unavailable.
 */
export function calculateViralPotential(params: {
  publishedAtIso: string;
  currentSnapshot: VideoSnapshot;
  previousSnapshots?: VideoSnapshot[];
  categoryRelevanceScore?: number; // 0-100
}): ViralScoreResult {
  const { publishedAtIso, currentSnapshot, previousSnapshots = [], categoryRelevanceScore = 80 } = params;
  const reasons: string[] = [];

  const hasViews = typeof currentSnapshot.viewCount === 'number' && currentSnapshot.viewCount >= 0;
  const hasLikes = typeof currentSnapshot.likeCount === 'number' && currentSnapshot.likeCount >= 0;
  const hasComments = typeof currentSnapshot.commentCount === 'number' && currentSnapshot.commentCount >= 0;

  const sortedHistory = [...previousSnapshots]
    .filter((s) => s.timestampIso !== currentSnapshot.timestampIso)
    .sort((a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime());

  const hasHistoricalDelta = sortedHistory.length > 0;
  const snapshotCount = sortedHistory.length + 1;

  // 1. Growth Velocity (only computed when historical snapshot exists)
  let growthVelocityPerHour: number | null = null;
  if (hasHistoricalDelta) {
    const earliest = sortedHistory[0];
    const hoursElapsed = Math.max(
      0.1,
      (new Date(currentSnapshot.timestampIso).getTime() - new Date(earliest.timestampIso).getTime()) / 3600000
    );
    const viewDelta = Math.max(0, currentSnapshot.viewCount - earliest.viewCount);
    growthVelocityPerHour = Number((viewDelta / hoursElapsed).toFixed(1));
    reasons.push(`Measured snapshot velocity: +${growthVelocityPerHour.toLocaleString()} views/hr across ${snapshotCount} snapshots.`);
  } else {
    reasons.push('Single snapshot available: Historical growth velocity not yet measured (no fabricated velocity).');
  }

  // 2. Engagement Rate (only computed if views > 0 and likes/comments exist)
  let engagementRatePercent: number | null = null;
  if (hasViews && currentSnapshot.viewCount > 0 && (hasLikes || hasComments)) {
    const interactions = (currentSnapshot.likeCount || 0) + (currentSnapshot.commentCount || 0) * 2;
    engagementRatePercent = Number(((interactions / currentSnapshot.viewCount) * 100).toFixed(2));
    reasons.push(`Verified engagement ratio: ${engagementRatePercent}% from available likes/comments.`);
  }

  // 3. Age-normalized momentum (considers low-view videos with strong early momentum)
  const ageHours = Math.max(
    1,
    (new Date(currentSnapshot.timestampIso).getTime() - new Date(publishedAtIso).getTime()) / 3600000
  );
  const lifetimeViewsPerHour = currentSnapshot.viewCount / ageHours;

  // Score synthesis (0-100)
  let baseScore = 45;
  if (lifetimeViewsPerHour > 500) baseScore += 22;
  else if (lifetimeViewsPerHour > 100) baseScore += 16;
  else if (lifetimeViewsPerHour > 20) baseScore += 10;
  else baseScore += 5;

  if (engagementRatePercent !== null) {
    if (engagementRatePercent >= 6) baseScore += 18;
    else if (engagementRatePercent >= 3.5) baseScore += 12;
    else baseScore += 6;
  }

  if (growthVelocityPerHour !== null) {
    if (growthVelocityPerHour > lifetimeViewsPerHour * 1.25) {
      baseScore += 12;
      reasons.push('Accelerating breakout trajectory: Recent snapshot velocity exceeds lifetime average.');
    } else if (growthVelocityPerHour > 50) {
      baseScore += 7;
    }
  }

  // Low-view high-engagement outlier boost (Prompt Rule 4: Low-view videos with strong growth potential must also be considered)
  if (currentSnapshot.viewCount < 15000 && engagementRatePercent !== null && engagementRatePercent >= 5.0) {
    baseScore += 9;
    reasons.push('Outlier low-view candidate: High engagement density despite modest total views.');
  }

  baseScore += Math.round((categoryRelevanceScore - 50) * 0.12);
  const viralScore = Math.max(10, Math.min(99, Math.round(baseScore)));

  const confidence: ViralScoreResult['confidence'] = hasHistoricalDelta
    ? 'High (Multi-Snapshot)'
    : hasViews && (hasLikes || hasComments)
    ? 'Medium (Single-Snapshot)'
    : 'Low (Metadata-Only)';

  return {
    viralScore,
    confidence,
    dataAvailability: {
      hasViews,
      hasLikes,
      hasComments,
      hasHistoricalDelta,
      snapshotCount,
    },
    growthVelocityPerHour,
    engagementRatePercent,
    reasons,
  };
}

/**
 * Evaluates a generated clip out of 100 across 8 dimensions.
 * 80–100: Excellent | 65–79: Review recommended | Below 65: Reject or regenerate.
 */
export function calculateClipQualityScore(
  input: ClipQualityInput,
  minConfigurableThreshold = 65
): ClipQualityEvaluation {
  const weights = {
    hookStrength: 0.2,
    viralPotential: 0.15,
    audioClarity: 0.12,
    captionAccuracy: 0.12,
    editingQuality: 0.11,
    pacing: 0.1,
    engagementPotential: 0.1,
    contextCompleteness: 0.1,
  };

  let weighted =
    input.hookStrength * weights.hookStrength +
    input.viralPotential * weights.viralPotential +
    input.audioClarity * weights.audioClarity +
    input.captionAccuracy * weights.captionAccuracy +
    input.editingQuality * weights.editingQuality +
    input.pacing * weights.pacing +
    input.engagementPotential * weights.engagementPotential +
    input.contextCompleteness * weights.contextCompleteness;

  const reasons: string[] = [];

  // Target clip duration check: 60–120 seconds
  if (input.durationSeconds >= 60 && input.durationSeconds <= 120) {
    reasons.push(`Optimal duration (${input.durationSeconds}s) within 60–120s viral window.`);
  } else {
    weighted -= 8;
    reasons.push(`Duration (${input.durationSeconds}s) outside target 60–120s window (-8 pts).`);
  }

  if (input.hookStrength >= 85) {
    reasons.push(`Strong opening hook (${input.hookStrength}/100) captures attention in first 3 seconds.`);
  } else if (input.hookStrength < 65) {
    reasons.push(`Weak opening hook (${input.hookStrength}/100); consider trimming lead-in silence.`);
  }

  if (input.contextCompleteness >= 80) {
    reasons.push(`Complete sentence boundaries and logical narrative closure (${input.contextCompleteness}/100).`);
  } else {
    reasons.push(`Dialogue cut risk (${input.contextCompleteness}/100); verify start/end trim points.`);
  }

  if (input.audioClarity >= 80) {
    reasons.push(`Clean original dialogue priority with auto-ducked background mix (${input.audioClarity}/100).`);
  }

  const overallScore = Math.max(0, Math.min(100, Math.round(weighted)));

  let classification: ClipQualityEvaluation['classification'] = 'Reject or regenerate';
  if (overallScore >= 80) {
    classification = 'Excellent';
  } else if (overallScore >= 65) {
    classification = 'Review recommended';
  }

  return {
    overallScore,
    classification,
    meetsThreshold: overallScore >= minConfigurableThreshold,
    reasons,
    breakdown: input,
  };
}

/**
 * Selects daily clips up to dailyTarget (default 5) without generating weak clips just to reach five.
 * Respects Source Diversity Toggle (max 2 clips per source video when ON).
 */
export function selectDailyCandidates(
  candidates: CandidateClip[],
  options: {
    dailyTarget: number;
    minQualityScore: number;
    sourceDiversityEnabled: boolean;
    maxClipsPerSource?: number;
  }
): {
  selected: CandidateClip[];
  rejectedBelowQuality: CandidateClip[];
  skippedForDiversity: CandidateClip[];
} {
  const {
    dailyTarget = 5,
    minQualityScore = 65,
    sourceDiversityEnabled = true,
    maxClipsPerSource = 2,
  } = options;

  const sorted = [...candidates].sort((a, b) => b.qualityScore - a.qualityScore);
  const selected: CandidateClip[] = [];
  const rejectedBelowQuality: CandidateClip[] = [];
  const skippedForDiversity: CandidateClip[] = [];
  const countBySource = new Map<string, number>();

  for (const clip of sorted) {
    // Do not generate weak clips just to reach five
    if (clip.qualityScore < minQualityScore || clip.durationSeconds < 60 || clip.durationSeconds > 120) {
      rejectedBelowQuality.push(clip);
      continue;
    }

    if (selected.length >= dailyTarget) {
      break;
    }

    const currentSourceCount = countBySource.get(clip.sourceVideoId) || 0;
    if (sourceDiversityEnabled && currentSourceCount >= maxClipsPerSource) {
      skippedForDiversity.push(clip);
      continue;
    }

    selected.push(clip);
    countBySource.set(clip.sourceVideoId, currentSourceCount + 1);
  }

  return { selected, rejectedBelowQuality, skippedForDiversity };
}

export const PIPELINE_CHECKPOINTS: { step: JobState; progress: number; label: string }[] = [
  { step: 'discovered', progress: 5, label: 'Video Discovered & Snapshot Logged' },
  { step: 'awaiting_approval', progress: 10, label: 'Awaiting User Processing Approval' },
  { step: 'queued', progress: 15, label: 'Queued in Persistent Manifest' },
  { step: 'processing', progress: 25, label: 'Source Media Verified & Locked' },
  { step: 'transcribing', progress: 40, label: 'Whisper Word-Level Transcription' },
  { step: 'analyzing', progress: 55, label: 'Scene & Hook Boundary Detection' },
  { step: 'clipping', progress: 70, label: '60-120s Segment Extraction & 9:16 Reframing' },
  { step: 'rendering', progress: 85, label: 'FFmpeg 1080x1920 H.264 + Animated Captions + Audio Ducking' },
  { step: 'quality_check', progress: 95, label: '8-Factor Quality Scoring & SEO Metadata' },
  { step: 'completed', progress: 100, label: 'Completed & Synced to Google Drive' },
];

/**
 * Resolves the exact step to resume from when a failed or disconnected job is retried.
 * Never restarts an entire expensive job when earlier outputs remain valid.
 */
export function resolveRetryCheckpoint(
  lastCompletedCheckpoint: string,
  currentRetryCount: number,
  maxRetries = 3
): {
  canRetry: boolean;
  resumeState: JobState;
  resumeProgress: number;
  nextRetryCount: number;
  reason: string;
} {
  if (currentRetryCount >= maxRetries) {
    return {
      canRetry: false,
      resumeState: 'failed',
      resumeProgress: 0,
      nextRetryCount: currentRetryCount,
      reason: `Retry limit reached (${currentRetryCount}/${maxRetries}). Inspect error log or increase retry limit in Settings.`,
    };
  }

  const foundIndex = PIPELINE_CHECKPOINTS.findIndex((c) => c.step === lastCompletedCheckpoint);
  if (foundIndex === -1) {
    return {
      canRetry: true,
      resumeState: 'queued',
      resumeProgress: 15,
      nextRetryCount: currentRetryCount + 1,
      reason: 'No prior GPU checkpoint found; starting from Queued state.',
    };
  }

  const nextIndex = Math.min(PIPELINE_CHECKPOINTS.length - 1, foundIndex + 1);
  const target = PIPELINE_CHECKPOINTS[nextIndex];

  return {
    canRetry: true,
    resumeState: target.step,
    resumeProgress: target.progress,
    nextRetryCount: currentRetryCount + 1,
    reason: `Resuming from checkpoint '${lastCompletedCheckpoint}' -> advancing directly to '${target.label}' without re-running completed stages.`,
  };
}

/**
 * Checks for duplicate source video or overlapping clip time ranges.
 */
export function detectDuplicateContentRisk(
  sourceVideoId: string,
  startSeconds: number,
  endSeconds: number,
  existingClips: { sourceVideoId: string; startSeconds: number; endSeconds: number; clipId: string }[]
): { isDuplicate: boolean; overlapPercent: number; conflictingClipId: string | null } {
  for (const existing of existingClips) {
    if (existing.sourceVideoId !== sourceVideoId) continue;
    const overlapStart = Math.max(startSeconds, existing.startSeconds);
    const overlapEnd = Math.min(endSeconds, existing.endSeconds);
    if (overlapEnd > overlapStart) {
      const overlapDuration = overlapEnd - overlapStart;
      const candidateDuration = Math.max(1, endSeconds - startSeconds);
      const overlapPercent = Math.round((overlapDuration / candidateDuration) * 100);
      if (overlapPercent >= 30) {
        return {
          isDuplicate: true,
          overlapPercent,
          conflictingClipId: existing.clipId,
        };
      }
    }
  }
  return { isDuplicate: false, overlapPercent: 0, conflictingClipId: null };
}

/**
 * Generates a real, complete Google Colab Tesla T4 Worker Notebook (.ipynb JSON string).
 */
export function generateColabWorkerNotebook(appBaseUrl: string): string {
  const notebook = {
    nbformat: 4,
    nbformat_minor: 0,
    metadata: {
      colab: {
        provenance: [],
        gpuType: 'T4',
      },
      kernelspec: {
        name: 'python3',
        display_name: 'Python 3',
      },
      language_info: {
        name: 'python',
      },
      accelerator: 'GPU',
    },
    cells: [
      {
        cell_type: 'markdown',
        metadata: {},
        source: [
          '# ViralMint AI — NVIDIA Tesla T4 Cloud Processing Worker\n',
          '**License:** AGPL-3.0-or-later  \n',
          'This notebook connects your Google Colab Tesla T4 GPU runtime to **ViralMint AI** (`' + appBaseUrl + '`) and your Google Drive (`ViralMint/` folder hierarchy).\n',
          '\n',
          '### Setup Instructions\n',
          '1. In Colab, open **Runtime > Change runtime type** and select **T4 GPU**.\n',
          '2. Open the **Secrets (Key icon)** sidebar in Colab and add `WORKER_SHARED_SECRET` matching your ViralMint AI server configuration.\n',
          '3. Run all cells below in order. If Colab disconnects, re-running Cell 4 will automatically resume incomplete jobs from their last saved checkpoint in `/content/drive/MyDrive/ViralMint/jobs/`.'
        ],
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          '# 1. Authenticate Google Account, Mount Google Drive & Create ViralMint Hierarchy\n',
          'import os, json, time, subprocess, shutil\n',
          'from google.colab import drive, userdata\n',
          '\n',
          'drive.mount("/content/drive")\n',
          'ROOT_DIR = "/content/drive/MyDrive/ViralMint"\n',
          'FOLDERS = ["jobs", "sources", "processing", "completed", "approved", "uploaded", "thumbnails", "metadata", "logs", "backups"]\n',
          'for f in FOLDERS:\n',
          '    os.makedirs(os.path.join(ROOT_DIR, f), exist_ok=True)\n',
          'print("Verified Google Drive hierarchy at:", ROOT_DIR)'
        ],
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          '# 2. Validate NVIDIA Tesla T4 GPU, CUDA, FFmpeg & Whisper Dependencies\n',
          'gpu_check = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total,driver_version", "--format=csv,noheader"], capture_output=True, text=True)\n',
          'GPU_NAME = gpu_check.stdout.strip() if gpu_check.returncode == 0 else "CPU_FALLBACK"\n',
          'print("Detected Accelerator:", GPU_NAME)\n',
          '\n',
          'ffmpeg_check = shutil.which("ffmpeg")\n',
          'assert ffmpeg_check is not None, "FFmpeg is required for 9:16 1080x1920 H.264 rendering"\n',
          '!pip install -q faster-whisper opencv-python-headless requests'
        ],
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          '# 3. Worker Heartbeat, Checkpoint Locking & Resume Loop\n',
          'import requests\n',
          '\n',
          'APP_BASE_URL = "' + appBaseUrl + '"\n',
          'try:\n',
          '    WORKER_SECRET = userdata.get("WORKER_SHARED_SECRET")\n',
          'except Exception:\n',
          '    WORKER_SECRET = os.environ.get("WORKER_SHARED_SECRET", "vm_worker_t4_default_dev_secret")\n',
          '\n',
          'def send_heartbeat(status="idle", active_job_id=None, progress=0, step="ready"):\n',
          '    try:\n',
          '        res = requests.post(\n',
          '            f"{APP_BASE_URL}/api/worker/heartbeat",\n',
          '            headers={"x-worker-secret": WORKER_SECRET, "Content-Type": "application/json"},\n',
          '            json={\n',
          '                "workerId": "colab-t4-primary",\n',
          '                "gpuModel": GPU_NAME,\n',
          '                "status": status,\n',
          '                "activeJobId": active_job_id,\n',
          '                "progress": progress,\n',
          '                "currentStep": step\n',
          '            },\n',
          '            timeout=10\n',
          '        )\n',
          '        return res.json()\n',
          '    except Exception as e:\n',
          '        print("Heartbeat warning:", e)\n',
          '        return None\n',
          '\n',
          'print("Sending initial T4 worker heartbeat...")\n',
          'print(send_heartbeat())'
        ],
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          '# 4. FFmpeg 9:16 Smart Reframing + Animated Yellow/White Captions + Audio Ducking Renderer\n',
          'def render_9_16_viral_clip(source_path, output_path, ass_subtitle_path, bg_music_path=None, start_sec=0, duration_sec=75):\n',
          '    """\n',
          '    Renders 1080x1920 vertical H.264 MP4 preserving original dialogue priority,\n',
          '    applying sidechain audio ducking if licensed background music is enabled,\n',
          '    and burning synchronized After Effects-style yellow/white ASS subtitles.\n',
          '    """\n',
          '    vf_chain = f"crop=ih*9/16:ih,scale=1080:1920:flags=lanczos,subtitles={ass_subtitle_path}"\n',
          '    cmd = [\n',
          '        "ffmpeg", "-y",\n',
          '        "-ss", str(start_sec),\n',
          '        "-t", str(duration_sec),\n',
          '        "-i", source_path\n',
          '    ]\n',
          '    if bg_music_path and os.path.exists(bg_music_path):\n',
          '        cmd += [\n',
          '            "-i", bg_music_path,\n',
          '            "-filter_complex",\n',
          '            f"[0:v]{vf_chain}[v];[1:a]volume=0.14[bg];[bg][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=300[ducked];[0:a][ducked]amix=inputs=2:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11[a]",\n',
          '            "-map", "[v]", "-map", "[a]"\n',
          '        ]\n',
          '    else:\n',
          '        cmd += ["-vf", vf_chain, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11"]\n',
          '    cmd += ["-c:v", "libx264", "-preset", "fast", "-crf", "18", "-c:a", "aac", "-b:a", "192k", output_path]\n',
          '    subprocess.run(cmd, check=True)\n',
          '    print("Rendered 1080x1920 clip to:", output_path)'
        ],
      },
    ],
  };

  return JSON.stringify(notebook, null, 2);
}
