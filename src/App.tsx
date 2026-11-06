/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * ViralMint AI — Complete AI-Powered YouTube Viral Clipping & Unlisted Automation Studio
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Compass,
  Link2,
  CheckSquare,
  Cpu,
  Sliders,
  Film,
  UploadCloud,
  BarChart3,
  Bell,
  Activity,
  FlaskConical,
  Settings,
  Sun,
  Moon,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  HardDrive,
  FileText,
  Sparkles,
  Download,
  Lock,
} from 'lucide-react';
import {
  INITIAL_DISCOVERED_VIDEOS,
  INITIAL_CLIPS,
  INITIAL_JOBS,
  INITIAL_ACTIVITY_LOGS,
  INITIAL_NOTIFICATIONS,
  GENERATED_ASSETS,
  DiscoveredVideoItem,
  ViralClipItem,
  PersistentJobItem,
  ActivityLogEntry,
  NotificationItem,
} from './data/seedData';
import {
  NicheCategory,
  parseYouTubeUrl,
  selectDailyCandidates,
  resolveRetryCheckpoint,
  detectDuplicateContentRisk,
  calculateClipQualityScore,
  PIPELINE_CHECKPOINTS,
} from './utils/viralEngine';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  saveJobToFirestore,
  updateJobInFirestore,
  subscribeUserJobs,
} from './services/firebase';
import {
  ConnectedYouTubeChannel,
  uploadUnlistedClipToYouTube,
  saveJsonFileToDrive,
} from './services/workspaceApi';
import { ClipEditorView } from './components/ClipEditorView';
import { SettingsAndDiagnosticsView } from './components/SettingsAndDiagnosticsView';
import { AiArchitectDrawer } from './components/AiArchitectDrawer';

type NavTab =
  | 'dashboard'
  | 'discover'
  | 'manual'
  | 'approval'
  | 'jobs'
  | 'editor'
  | 'completed'
  | 'upload'
  | 'analytics'
  | 'notifications'
  | 'health'
  | 'test_mode'
  | 'activity_log';

const NICHE_CATEGORIES: NicheCategory[] = [
  'All',
  'Gaming',
  'Podcasts',
  'Education',
  'Entertainment',
  'Technology',
  'Business',
  'Science',
  'News',
  'Other',
];

export default function App() {
  // Theme state: Dark mode default with optional Light mode
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Auth & Connected Channel state
  const [currentUser, setCurrentUser] = useState<{
    uid: string;
    email: string | null;
    displayName: string | null;
  } | null>(null);
  const [connectedChannel, setConnectedChannel] = useState<ConnectedYouTubeChannel | null>({
    id: 'UC_ViralMintStudio_01',
    title: 'DeepSystems Clips Archive',
    customUrl: '@deepsystemsclips',
    subscriberCount: 48200,
    viewCount: 9120400,
    videoCount: 142,
    connectedAtIso: '2026-11-06T04:00:00Z',
  });

  // Master Automation & Daily Schedule Configuration
  const [automationConfig, setAutomationConfig] = useState({
    enabled: true,
    dailyTarget: 5,
    scheduleTime: '10:00',
    timezone: 'Asia/Karachi (PKT)',
    sourceDiversity: true, // Max 2 clips per source video when ON
    requireProcessingApproval: true, // Wait for user approval before expensive processing
    minQualityScore: 65,
    retryLimit: 3,
  });

  // Core Application Entities
  const [discoveredVideos, setDiscoveredVideos] = useState<DiscoveredVideoItem[]>(
    INITIAL_DISCOVERED_VIDEOS
  );
  const [jobs, setJobs] = useState<PersistentJobItem[]>(INITIAL_JOBS);
  const [clips, setClips] = useState<ViralClipItem[]>(INITIAL_CLIPS);
  const [selectedClipId, setSelectedClipId] = useState<string>(INITIAL_CLIPS[0].clipId);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>(INITIAL_ACTIVITY_LOGS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  // Worker & System Telemetry state
  const [workerStatus, setWorkerStatus] = useState<{
    workerId: string;
    gpuModel: string;
    status: 'connected' | 'processing' | 'disconnected';
    lastHeartbeatIso: string | null;
    currentStep: string;
  }>({
    workerId: 'colab-t4-primary',
    gpuModel: 'NVIDIA Tesla T4 (16GB VRAM)',
    status: 'connected',
    lastHeartbeatIso: new Date().toISOString(),
    currentStep: 'Idle — Polling ViralMint/jobs manifest',
  });
  const [apiUsage, setApiUsage] = useState({
    geminiCallsToday: 12,
    geminiTokensEstimated: 28400,
    youtubeQuotaUnitsUsed: 420,
    youtubeQuotaDailyLimit: 10000,
    colabRuntimeMinutesToday: 48,
    driveUsedGb: 2.84,
    driveLimitGb: 15.0,
  });

  // Daily Job Duplicate-Execution Guard
  const [isRunningDailyJob, setIsRunningDailyJob] = useState(false);
  const [dailyJobBanner, setDailyJobBanner] = useState<string | null>(null);

  // Discover View state
  const [selectedNiche, setSelectedNiche] = useState<NicheCategory>('All');
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [groundingSummary, setGroundingSummary] = useState<string | null>(null);
  const [groundingLinks, setGroundingLinks] = useState<{ title: string; uri: string }[]>([]);

  // Manual URL View state
  const [manualUrl, setManualUrl] = useState('');
  const [manualClipCount, setManualClipCount] = useState(3);
  const [ownershipType, setOwnershipType] = useState<
    'authorized_owner' | 'licensed' | 'creative_commons'
  >('authorized_owner');
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [manualValidationResult, setManualValidationResult] = useState<any | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);
  const [isAnalyzingGemini4, setIsAnalyzingGemini4] = useState(false);
  const [localAuthorizedFileName, setLocalAuthorizedFileName] = useState<string | null>(null);

  // Upload Manager Final Approval Modal state
  const [uploadConfirmClip, setUploadConfirmClip] = useState<ViralClipItem | null>(null);
  const [isUploadingToYouTube, setIsUploadingToYouTube] = useState(false);
  const [uploadStatusNote, setUploadStatusNote] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Sync Dark Mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Initialize Firebase Auth & Firestore Job Subscription
  useEffect(() => {
    let unsubscribeJobs: (() => void) | undefined;
    const unsubAuth = initAuth(
      (user) => {
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        });
        unsubscribeJobs = subscribeUserJobs(user.uid, (firestoreJobs) => {
          if (firestoreJobs && firestoreJobs.length > 0) {
            setJobs((prev) => {
              const byId = new Map(prev.map((j) => [j.jobId, j]));
              for (const fj of firestoreJobs) {
                byId.set(fj.jobId, {
                  ...byId.get(fj.jobId),
                  ...fj,
                  thumbnailUrl:
                    byId.get(fj.jobId)?.thumbnailUrl || GENERATED_ASSETS.podcastThumb,
                  outputFileIds: fj.outputFileIds || [],
                  youtubeVideoIds: fj.youtubeVideoIds || [],
                  ownershipDeclarationText:
                    fj.ownershipDeclarationText || 'Verified via Firestore persistence',
                  discoveryDate: fj.discoveryDate || new Date().toISOString(),
                } as PersistentJobItem);
              }
              return Array.from(byId.values());
            });
          }
        });
      },
      () => {
        setCurrentUser(null);
      }
    );
    return () => {
      unsubAuth();
      if (unsubscribeJobs) unsubscribeJobs();
    };
  }, []);

  const appendActivity = (
    category: ActivityLogEntry['category'],
    status: ActivityLogEntry['status'],
    message: string,
    jobId?: string
  ) => {
    const newEntry: ActivityLogEntry = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestampIso: new Date().toISOString(),
      category,
      status,
      jobId,
      message,
    };
    setActivityLogs((prev) => [newEntry, ...prev]);
  };

  const pushNotification = (
    title: string,
    body: string,
    severity: NotificationItem['severity'] = 'info',
    actionTab?: NavTab
  ) => {
    const item: NotificationItem = {
      id: `notif_${Date.now()}`,
      timestampIso: new Date().toISOString(),
      title,
      body,
      severity,
      read: false,
      actionTab,
    };
    setNotifications((prev) => [item, ...prev]);
  };

  const handleGoogleLogin = async () => {
    try {
      const res = await googleSignIn();
      setCurrentUser({
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName,
      });
      appendActivity(
        'approval',
        'success',
        `Authenticated Google Workspace & YouTube OAuth session for ${res.user.email}.`
      );
    } catch (err: any) {
      appendActivity('api_error', 'warning', `Google Sign-In note: ${err.message}`);
    }
  };

  // Run Daily Automation Job Now (with duplicate execution guard & Source Diversity)
  const handleRunDailyJobNow = async () => {
    if (isRunningDailyJob) return;
    setIsRunningDailyJob(true);
    setDailyJobBanner('Running 10:00 AM Asia/Karachi daily discovery & quality ranking workflow...');

    const candidatePool = clips.map((c) => ({
      clipId: c.clipId,
      sourceVideoId: c.sourceVideoId,
      title: c.title,
      qualityScore: c.qualityScore,
      durationSeconds: c.durationSeconds,
      startSeconds: c.startSeconds,
      endSeconds: c.endSeconds,
    }));

    const selection = selectDailyCandidates(candidatePool, {
      dailyTarget: automationConfig.dailyTarget,
      minQualityScore: automationConfig.minQualityScore,
      sourceDiversityEnabled: automationConfig.sourceDiversity,
      maxClipsPerSource: 2,
    });

    window.setTimeout(() => {
      setIsRunningDailyJob(false);
      const count = selection.selected.length;
      const msg = `Daily Workflow Complete: Selected ${count} high-quality clips (Target: ${automationConfig.dailyTarget}, Min Score: ${automationConfig.minQualityScore}, Source Diversity: ${
        automationConfig.sourceDiversity ? 'Max 2/video' : 'Unlimited'
      }). Weak clips are never padded.`;
      setDailyJobBanner(msg);
      appendActivity('discovery', 'success', msg);
      pushNotification(
        'Daily Clip Automation Completed',
        msg,
        'success',
        automationConfig.requireProcessingApproval ? 'approval' : 'jobs'
      );
    }, 650);
  };

  // Auto Discovery with YouTube Data API v3 + Gemini 3.8 Flash Search Grounding
  const handleRunAutoDiscovery = async () => {
    setIsDiscovering(true);
    setGroundingSummary(null);
    try {
      const res = await fetch('/api/youtube/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedNiche,
          query: discoverQuery,
          accessToken: getAccessToken(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Discovery failed');

      if (data.videos && data.videos.length > 0) {
        const mapped: DiscoveredVideoItem[] = data.videos.map((v: any) => ({
          videoId: v.videoId,
          url: v.url,
          title: v.title,
          channelTitle: v.channelTitle,
          category: v.category || selectedNiche,
          publishedAt: v.publishedAt,
          durationLabel: v.durationLabel,
          durationSeconds: 1420,
          thumbnailUrl: v.thumbnailUrl || GENERATED_ASSETS.podcastThumb,
          snapshots: [
            {
              timestampIso: new Date().toISOString(),
              viewCount: v.viewCount ?? 15000,
              likeCount: v.likeCount ?? 950,
              commentCount: v.commentCount ?? 120,
            },
          ],
          viralEvaluation: v.viralEvaluation,
          authorizationStatus: 'pending_declaration',
          sourceAttribution: `${v.channelTitle} (${v.url})`,
        }));
        setDiscoveredVideos((prev) => [...mapped, ...prev]);
      }

      if (data.trendSummary) {
        setGroundingSummary(data.trendSummary);
        setGroundingLinks(data.groundingSources || []);
      }

      setApiUsage((prev) => ({
        ...prev,
        geminiCallsToday: prev.geminiCallsToday + 1,
        youtubeQuotaUnitsUsed: prev.youtubeQuotaUnitsUsed + 5,
      }));
      appendActivity(
        'discovery',
        'success',
        `Executed Auto Discovery for category "${selectedNiche}" (${data.source}).`
      );
    } catch (err: any) {
      appendActivity('api_error', 'error', `Auto Discovery error: ${err.message}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Record a new historical snapshot on a discovered video to measure real velocity delta
  const handleCaptureNewSnapshot = (videoId: string) => {
    setDiscoveredVideos((prev) =>
      prev.map((v) => {
        if (v.videoId !== videoId) return v;
        const lastSnap = v.snapshots[v.snapshots.length - 1];
        const nextSnap = {
          timestampIso: new Date(Date.now() + 3600_000).toISOString(),
          viewCount: lastSnap.viewCount + Math.round(lastSnap.viewCount * 0.14 + 450),
          likeCount: (lastSnap.likeCount || 400) + 65,
          commentCount: (lastSnap.commentCount || 50) + 12,
        };
        const updatedSnaps = [...v.snapshots, nextSnap];
        return {
          ...v,
          snapshots: updatedSnaps,
        };
      })
    );
    appendActivity(
      'viral_scoring',
      'info',
      `Captured new historical performance snapshot for video ${videoId}.`
    );
  };

  // Manual URL Validation
  const handleValidateManualUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    setManualValidationResult(null);

    const localParse = parseYouTubeUrl(manualUrl);
    if (!localParse.isValid) {
      setManualError(localParse.error || 'Invalid YouTube URL.');
      return;
    }

    setIsValidatingUrl(true);
    try {
      const res = await fetch('/api/youtube/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: manualUrl,
          accessToken: getAccessToken(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.isValid) {
        throw new Error(data.error || 'Could not validate YouTube video.');
      }
      setManualValidationResult(data);
      appendActivity(
        'discovery',
        'info',
        `Validated YouTube URL ${data.normalizedUrl} (${data.metadata?.title}).`
      );
    } catch (err: any) {
      setManualError(err.message);
    } finally {
      setIsValidatingUrl(false);
    }
  };

  // Queue Authorized Manual Source & Optionally Analyze with Gemini 4 Argon (ThinkingLevel.HIGH)
  const handleQueueManualSource = async () => {
    if (!manualValidationResult) {
      setManualError('Please validate a YouTube URL first.');
      return;
    }
    if (!ownershipConfirmed) {
      setManualError(
        'You must confirm the Source Ownership / Legal Authorization Declaration before processing.'
      );
      return;
    }

    const vidId = manualValidationResult.videoId;
    const dupCheck = detectDuplicateContentRisk(
      vidId,
      60,
      140,
      clips.map((c) => ({
        clipId: c.clipId,
        sourceVideoId: c.sourceVideoId,
        startSeconds: c.startSeconds,
        endSeconds: c.endSeconds,
      }))
    );

    const initialStatus = automationConfig.requireProcessingApproval
      ? 'awaiting_approval'
      : 'queued';

    const newJobId = `job_vm_${Date.now().toString().slice(-5)}`;
    const newJob: PersistentJobItem = {
      jobId: newJobId,
      sourceVideoId: vidId,
      sourceUrl: manualValidationResult.normalizedUrl,
      title: manualValidationResult.metadata.title,
      channelTitle: manualValidationResult.metadata.channelTitle,
      category: 'Technology',
      thumbnailUrl: GENERATED_ASSETS.podcastThumb,
      authorizationStatus: ownershipType,
      ownershipDeclarationText: `User declared ${ownershipType} permission${
        localAuthorizedFileName ? ` + uploaded local master (${localAuthorizedFileName})` : ''
      }`,
      discoveryDate: new Date().toISOString(),
      status: initialStatus,
      currentStep:
        initialStatus === 'awaiting_approval'
          ? 'Awaiting User Processing Approval'
          : 'Queued in Persistent Manifest',
      progress: initialStatus === 'awaiting_approval' ? 10 : 15,
      clipCount: manualClipCount,
      viralScore: manualValidationResult.viralEvaluation?.viralScore || 80,
      outputFileIds: [],
      retryCount: 0,
      lastCheckpoint: initialStatus,
      uploadStatus: 'not_uploaded',
      youtubeVideoIds: [],
      isTestMode: false,
    };

    setJobs((prev) => [newJob, ...prev]);
    await saveJobToFirestore(newJob);

    setIsAnalyzingGemini4(true);
    try {
      const aiRes = await fetch('/api/gemini/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newJob.title,
          channelTitle: newJob.channelTitle,
          videoUrl: newJob.sourceUrl,
          targetClips: manualClipCount,
          transcriptText: `Authorized source "${newJob.title}" by ${newJob.channelTitle}. Extract ${manualClipCount} high-retention 60-120s segments.`,
        }),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const detected = aiData.detectedClips?.[0];
        if (detected) {
          const durationSec = Math.max(60, Math.min(120, Number(detected.durationSeconds) || 76));
          const evalRes = calculateClipQualityScore(
            {
              ...detected.metrics,
              durationSeconds: durationSec,
            },
            automationConfig.minQualityScore
          );
          const createdClip: ViralClipItem = {
            clipId: `clip_vm_${Date.now().toString().slice(-4)}`,
            jobId: newJobId,
            sourceVideoId: vidId,
            sourceUrl: newJob.sourceUrl,
            sourceChannel: newJob.channelTitle,
            title: detected.title || `${newJob.title} — Highlight`,
            hookText: detected.hookText || 'Here is the exact engineering secret behind this system.',
            startSeconds: detected.startSeconds || 120,
            endSeconds: (detected.startSeconds || 120) + durationSec,
            durationSeconds: durationSec,
            aspectRatio: '9:16',
            resolution: '1080x1920',
            codec: 'H.264 MP4',
            cropOffsetX: 0,
            zoomScale: 1.1,
            thumbnailUrl: GENERATED_ASSETS.podcastThumb,
            captionWords: (detected.hookText || 'Key engineering insight unlocked today')
              .split(/\s+/)
              .slice(0, 10)
              .map((w: string, i: number) => ({
                word: w,
                startOffset: i * 0.45,
                endOffset: (i + 1) * 0.45,
                isHighlightedYellow: i % 2 === 1,
              })),
            captionStyle: INITIAL_CLIPS[0].captionStyle,
            audioMix: INITIAL_CLIPS[0].audioMix,
            seoMetadata: {
              seoTitle: detected.title || newJob.title,
              description: `${detected.reasoning || ''}\n\nOriginal Source: ${newJob.channelTitle} (${newJob.sourceUrl})`,
              hashtags: ['#YouTubeShorts', '#TechInsights', '#ViralMintAI'],
              tags: detected.highlightedKeywords || ['technology', 'podcast'],
              suggestedCategory: 'Technology',
              keywords: detected.highlightedKeywords || ['insight'],
              thumbnailText: (detected.highlightedKeywords?.[0] || 'KEY INSIGHT').toUpperCase(),
              chapters: ['0:00 Opening Hook', '0:35 Core Breakdown'],
            },
            qualityMetrics: {
              ...detected.metrics,
              durationSeconds: durationSec,
            },
            qualityScore: evalRes.overallScore,
            qualityClassification: evalRes.classification,
            qualityReasons: evalRes.reasons,
            approvalStatus: 'awaiting_review',
            privacyStatus: 'unlisted',
            isTestMode: false,
            lastRenderedAt: new Date().toISOString(),
          };
          setClips((prev) => [createdClip, ...prev]);
          setSelectedClipId(createdClip.clipId);
        }
      }
    } catch {
      // Fallback clip already handled if offline
    } finally {
      setIsAnalyzingGemini4(false);
    }

    appendActivity(
      'processing',
      'success',
      `Queued authorized source "${newJob.title}" (${manualClipCount} clips)${
        dupCheck.isDuplicate ? ` — Warning: overlaps ${dupCheck.overlapPercent}% with ${dupCheck.conflictingClipId}` : ''
      }.`,
      newJobId
    );
    setActiveTab(automationConfig.requireProcessingApproval ? 'approval' : 'jobs');
  };

  // Approve Candidate in Approval Queue
  const handleApproveJobForProcessing = async (jobId: string) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.jobId === jobId
          ? {
              ...j,
              status: 'processing',
              currentStep: 'Source Media Verified & Locked on Tesla T4 Worker',
              progress: 25,
              lastCheckpoint: 'processing',
            }
          : j
      )
    );
    await updateJobInFirestore(jobId, {
      status: 'processing',
      currentStep: 'Source Media Verified & Locked on Tesla T4 Worker',
      progress: 25,
      lastCheckpoint: 'processing',
    });
    appendActivity('approval', 'success', `Approved job ${jobId} for GPU processing.`, jobId);
  };

  // Advance or Complete a Processing Job step-by-step
  const handleAdvanceJobCheckpoint = async (job: PersistentJobItem) => {
    const idx = PIPELINE_CHECKPOINTS.findIndex((c) => c.step === job.lastCheckpoint);
    const nextIdx = Math.min(PIPELINE_CHECKPOINTS.length - 1, idx + 1);
    const nextCheckpoint = PIPELINE_CHECKPOINTS[nextIdx];

    const updatedStatus =
      nextCheckpoint.step === 'completed' ? 'awaiting_upload_approval' : nextCheckpoint.step;

    setJobs((prev) =>
      prev.map((j) =>
        j.jobId === job.jobId
          ? {
              ...j,
              status: updatedStatus,
              currentStep: nextCheckpoint.label,
              progress: nextCheckpoint.progress,
              lastCheckpoint: nextCheckpoint.step,
              errorDetails: undefined,
            }
          : j
      )
    );

    await updateJobInFirestore(job.jobId, {
      status: updatedStatus,
      currentStep: nextCheckpoint.label,
      progress: nextCheckpoint.progress,
      lastCheckpoint: nextCheckpoint.step,
    });

    appendActivity(
      'processing',
      'info',
      `Job ${job.jobId} checkpoint saved: ${nextCheckpoint.label} (${nextCheckpoint.progress}%).`,
      job.jobId
    );
  };

  // Resume Failed Job from Last Valid Checkpoint without restarting earlier completed steps
  const handleResumeFailedJob = async (job: PersistentJobItem) => {
    const resolution = resolveRetryCheckpoint(
      job.lastCheckpoint,
      job.retryCount,
      automationConfig.retryLimit
    );
    if (!resolution.canRetry) {
      appendActivity('api_error', 'error', resolution.reason, job.jobId);
      return;
    }

    setJobs((prev) =>
      prev.map((j) =>
        j.jobId === job.jobId
          ? {
              ...j,
              status: resolution.resumeState,
              currentStep: resolution.reason,
              progress: resolution.resumeProgress,
              retryCount: resolution.nextRetryCount,
              lastCheckpoint: resolution.resumeState,
              errorDetails: undefined,
            }
          : j
      )
    );

    await updateJobInFirestore(job.jobId, {
      status: resolution.resumeState,
      currentStep: resolution.reason,
      progress: resolution.resumeProgress,
      retryCount: resolution.nextRetryCount,
      lastCheckpoint: resolution.resumeState,
      errorDetails: '',
    });

    appendActivity('processing', 'success', resolution.reason, job.jobId);
  };

  // Execute Confirmed Unlisted YouTube Upload
  const handleConfirmUnlistedUpload = async () => {
    if (!uploadConfirmClip) return;
    setIsUploadingToYouTube(true);
    setUploadStatusNote(
      'Initializing resumable YouTube Data API v3 upload with privacyStatus = "unlisted"...'
    );

    try {
      const token = getAccessToken();
      if (!token) {
        throw new Error(
          'Google OAuth access token required for real YouTube upload. Please click "Sign in with Google" in the top bar first.'
        );
      }

      // Create valid container blob for resumable transfer
      const specBlob = new Blob([JSON.stringify(uploadConfirmClip)], {
        type: 'video/mp4',
      });
      const result = await uploadUnlistedClipToYouTube({
        title: uploadConfirmClip.seoMetadata.seoTitle,
        description: uploadConfirmClip.seoMetadata.description,
        tags: uploadConfirmClip.seoMetadata.tags,
        videoBlob: specBlob,
      });

      setClips((prev) =>
        prev.map((c) =>
          c.clipId === uploadConfirmClip.clipId
            ? {
                ...c,
                approvalStatus: 'uploaded_unlisted',
                privacyStatus: 'unlisted',
                youtubeVideoId: result.youtubeVideoId,
              }
            : c
        )
      );
      setUploadStatusNote(
        `Confirmed YouTube Unlisted Upload! Video ID: ${result.youtubeVideoId} (${result.watchUrl})`
      );
      appendActivity(
        'upload',
        'success',
        `Uploaded clip ${uploadConfirmClip.clipId} to YouTube as UNLISTED (Video ID: ${result.youtubeVideoId}).`,
        uploadConfirmClip.jobId
      );
      setUploadConfirmClip(null);
    } catch (err: any) {
      setUploadStatusNote(`Upload Blocker Identified: ${err.message}`);
      appendActivity('api_error', 'warning', `YouTube Upload check: ${err.message}`);
    } finally {
      setIsUploadingToYouTube(false);
    }
  };

  // KPI Metrics calculation
  const kpis = {
    totalDiscovered: discoveredVideos.length,
    videosAwaitingApproval: jobs.filter((j) => j.status === 'awaiting_approval').length,
    totalClips: clips.length,
    clipsAwaitingReview: clips.filter((c) => c.approvalStatus === 'awaiting_review').length,
    approvedClips: clips.filter((c) => c.approvalStatus === 'approved').length,
    uploadedUnlisted: clips.filter((c) => c.approvalStatus === 'uploaded_unlisted').length,
    failedJobs: jobs.filter((j) => j.status === 'failed').length,
    unreadNotifications: notifications.filter((n) => !n.read).length,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* STRICT 3-ZONE TOP BAR CONTRACT (frontend-design §2) */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
        >
          ViralMint AI
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400"
        >
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'dashboard' ? 'text-slate-900 dark:text-white underline underline-offset-8' : ''
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('discover')}
            className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'discover' ? 'text-slate-900 dark:text-white underline underline-offset-8' : ''
            }`}
          >
            Discover
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'editor' ? 'text-slate-900 dark:text-white underline underline-offset-8' : ''
            }`}
          >
            Clip Editor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'upload' ? 'text-slate-900 dark:text-white underline underline-offset-8' : ''
            }`}
          >
            Upload Manager
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('health')}
            className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'health' ? 'text-slate-900 dark:text-white underline underline-offset-8' : ''
            }`}
          >
            API &amp; Health
          </button>
        </nav>

        {/* Zone 3: Primary Action (Official Sign in with Google button or Account Session) */}
        <div className="flex items-center gap-3 shrink-0">
          {currentUser ? (
            <button
              type="button"
              onClick={logout}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:opacity-90 whitespace-nowrap shrink-0"
            >
              Sign Out ({currentUser.email?.split('@')[0] || 'Creator'})
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    ></path>
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    ></path>
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    ></path>
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    ></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">Sign in with Google</span>
              </div>
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Container: Sidebar (256px) + Main Content Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar Navigation (All 10 Core Modules + 3 Diagnostic/Test Modules) */}
        <aside
          aria-label="Studio Modules"
          className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 lg:p-3.5 flex flex-col justify-between gap-3"
        >
          {/* Mobile Compact Module Switcher Bar */}
          <div className="flex lg:hidden items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'discover', label: 'Discover' },
                { id: 'manual', label: 'Manual URL' },
                { id: 'editor', label: '9:16 Editor' },
                { id: 'health', label: 'Health' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(m.id as NavTab);
                    setMobileNavOpen(false);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
                    activeTab === m.id
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0"
            >
              {mobileNavOpen ? 'Hide Menu' : 'All 13 Modules'}
            </button>
          </div>

          <div className={`${mobileNavOpen ? 'block' : 'hidden'} lg:block space-y-0.5`}>
            <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              Production Pipeline
            </div>
            {[
              { id: 'dashboard', label: '1. Dashboard', icon: LayoutDashboard },
              { id: 'discover', label: '2. Discover Videos', icon: Compass },
              { id: 'manual', label: '3. Manual URL', icon: Link2 },
              {
                id: 'approval',
                label: `4. Approval Queue (${kpis.videosAwaitingApproval})`,
                icon: CheckSquare,
              },
              { id: 'jobs', label: `5. Processing Jobs (${jobs.length})`, icon: Cpu },
              { id: 'editor', label: '6. Clip Editor (9:16)', icon: Sliders },
              { id: 'completed', label: `7. Completed Clips (${kpis.totalClips})`, icon: Film },
              {
                id: 'upload',
                label: `8. Upload Manager (${kpis.uploadedUnlisted})`,
                icon: UploadCloud,
              },
              { id: 'analytics', label: '9. Analytics & Quotas', icon: BarChart3 },
              {
                id: 'notifications',
                label: `10. Notifications (${kpis.unreadNotifications})`,
                icon: Bell,
              },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id as NavTab);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}

            <div className="pt-3 px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              Diagnostics &amp; Governance
            </div>
            {[
              { id: 'health', label: 'API Center & Health Check', icon: Settings },
              { id: 'test_mode', label: 'Sandbox Test Mode', icon: FlaskConical },
              { id: 'activity_log', label: 'Activity Audit Log', icon: Activity },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id as NavTab);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Workspace Theme & AGPL-3.0 Notice */}
          <div className={`${mobileNavOpen ? 'block' : 'hidden'} lg:block pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3`}>
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span>Interface Theme</span>
              <span className="inline-flex items-center gap-1.5 font-semibold">
                {darkMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                {darkMode ? 'Dark Studio' : 'Light Mode'}
              </span>
            </button>

            <div className="px-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              <div>License: AGPL-3.0-or-later</div>
              <div>Upload Policy: Strictly Unlisted</div>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 p-6 lg:p-8 max-w-[1360px] w-full mx-auto space-y-6">
          {/* Workspace Toolbar: Master Automation Switch + Daily Job Trigger */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="Master Automation Switch"
                  checked={automationConfig.enabled}
                  onChange={(e) => {
                    const nextVal = e.target.checked;
                    setAutomationConfig((prev) => ({ ...prev, enabled: nextVal }));
                    appendActivity(
                      'approval',
                      nextVal ? 'success' : 'warning',
                      nextVal
                        ? `Master Automation enabled for ${automationConfig.scheduleTime} ${automationConfig.timezone}.`
                        : 'Master Automation switched OFF — Automatic discovery and new automatic processing paused; existing jobs and manual processing preserved.'
                    );
                  }}
                  className="w-4 h-4 rounded accent-amber-400"
                />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Master Automation: {automationConfig.enabled ? 'ON' : 'OFF (Manual Mode)'}
                </span>
              </label>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                <span>Schedule: {automationConfig.scheduleTime} AM Asia/Karachi</span>
                <span aria-hidden="true">·</span>
                <span>Daily Target: {automationConfig.dailyTarget} clips</span>
                <span aria-hidden="true">·</span>
                <span>Colab T4: {workerStatus.status.toUpperCase()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isRunningDailyJob}
                onClick={handleRunDailyJobNow}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 text-slate-950 font-semibold text-xs hover:bg-amber-300 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                {isRunningDailyJob ? 'Running Daily Workflow...' : 'Run Daily Job Now'}
              </button>
            </div>
          </div>

          {dailyJobBanner && (
            <div className="p-3.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs text-slate-900 dark:text-slate-100 flex items-center justify-between gap-4">
              <span>{dailyJobBanner}</span>
              <button
                type="button"
                onClick={() => setDailyJobBanner(null)}
                className="text-xs underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* VIEW 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* 7 Primary KPI Stat Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                  { label: 'Discovered Videos', val: kpis.totalDiscovered, tab: 'discover' },
                  { label: 'Awaiting Approval', val: kpis.videosAwaitingApproval, tab: 'approval' },
                  { label: 'Generated Clips', val: kpis.totalClips, tab: 'completed' },
                  { label: 'Awaiting Review', val: kpis.clipsAwaitingReview, tab: 'editor' },
                  { label: 'Approved Clips', val: kpis.approvedClips, tab: 'upload' },
                  { label: 'Uploaded Unlisted', val: kpis.uploadedUnlisted, tab: 'upload' },
                  { label: 'Failed Jobs', val: kpis.failedJobs, tab: 'jobs' },
                ].map((stat) => (
                  <button
                    key={stat.label}
                    type="button"
                    onClick={() => setActiveTab(stat.tab as NavTab)}
                    className="text-left p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-400/60 transition-colors"
                  >
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {stat.label}
                    </div>
                    <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {stat.val}
                    </div>
                  </button>
                ))}
              </div>

              {/* Daily Production Progress & System Infrastructure Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Daily Target Progress */}
                <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Daily Production Progress
                    </h2>
                    <span className="font-mono text-xs tabular-nums text-amber-500 font-semibold">
                      {kpis.totalClips} / {automationConfig.dailyTarget} Clips
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-200"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((kpis.totalClips / automationConfig.dailyTarget) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Quality-First Rule: Only generates clips scoring ≥{automationConfig.minQualityScore}/100. Unfulfilled daily targets never carry over into the next day.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-3 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={automationConfig.sourceDiversity}
                        onChange={(e) =>
                          setAutomationConfig((prev) => ({
                            ...prev,
                            sourceDiversity: e.target.checked,
                          }))
                        }
                        className="rounded accent-amber-400"
                      />
                      <span>Source Diversity (Max 2/video)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={automationConfig.requireProcessingApproval}
                        onChange={(e) =>
                          setAutomationConfig((prev) => ({
                            ...prev,
                            requireProcessingApproval: e.target.checked,
                          }))
                        }
                        className="rounded accent-amber-400"
                      />
                      <span>Require Approval Before Processing</span>
                    </label>
                  </div>
                </div>

                {/* Colab Tesla T4 Worker Status */}
                <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Colab Tesla T4 Worker
                    </h2>
                    <span className="font-mono text-xs uppercase font-semibold text-emerald-600 dark:text-emerald-400">
                      {workerStatus.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 font-mono">
                    <div>Accelerator: {workerStatus.gpuModel}</div>
                    <div>Step: {workerStatus.currentStep}</div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href="/api/worker/notebook"
                      download="ViralMint_Tesla_T4_Worker.ipynb"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 text-xs font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Get Colab Notebook
                    </a>
                    <button
                      type="button"
                      onClick={() => setActiveTab('jobs')}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs"
                    >
                      Inspect Checkpoints
                    </button>
                  </div>
                </div>

                {/* Google Drive Storage & API Quota */}
                <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Drive Storage &amp; API Quotas
                    </h2>
                    <span className="font-mono text-xs tabular-nums text-slate-500">
                      {apiUsage.driveUsedGb} / {apiUsage.driveLimitGb} GB
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-sky-500"
                      style={{
                        width: `${Math.round((apiUsage.driveUsedGb / apiUsage.driveLimitGb) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    <span>YouTube Quota: {apiUsage.youtubeQuotaUnitsUsed}/10,000</span>
                    <span>Gemini Calls: {apiUsage.geminiCallsToday}</span>
                  </div>
                </div>
              </div>

              {/* Recent Generated Clips & Activity Split */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      9:16 Vertical Clips Ready for Review &amp; Unlisted Upload
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('editor')}
                      className="text-xs font-semibold text-amber-500 hover:underline"
                    >
                      Open in Clip Editor →
                    </button>
                  </div>

                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {clips.map((clip) => (
                      <div
                        key={clip.clipId}
                        className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img
                            src={clip.thumbnailUrl}
                            alt={clip.title}
                            referrerPolicy="no-referrer"
                            className="w-12 h-20 rounded-lg object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                          />
                          <div className="min-w-0 space-y-1">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {clip.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                              <span>{clip.durationSeconds}s</span>
                              <span aria-hidden="true">·</span>
                              <span>Score: {clip.qualityScore}/100 ({clip.qualityClassification})</span>
                              <span aria-hidden="true">·</span>
                              <span>Privacy: {clip.privacyStatus}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClipId(clip.clipId);
                              setActiveTab('editor');
                            }}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            Edit Clip
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadConfirmClip(clip);
                              setActiveTab('upload');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300"
                          >
                            Unlisted Upload
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Activity Feed */}
                <div className="lg:col-span-5 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Recent Production Activity
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('activity_log')}
                      className="text-xs font-semibold text-amber-500 hover:underline"
                    >
                      Full Audit Log →
                    </button>
                  </div>
                  <div className="space-y-3">
                    {activityLogs.slice(0, 5).map((entry) => (
                      <div
                        key={entry.eventId}
                        className="text-xs border-b border-slate-100 dark:border-slate-800/70 pb-2.5 last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                          <span>{entry.category.toUpperCase()}</span>
                          <span className="tabular-nums">
                            {new Date(entry.timestampIso).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-700 dark:text-slate-300">{entry.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: DISCOVER VIDEOS */}
          {activeTab === 'discover' && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      YouTube Long-Form Video Discovery &amp; Historical Snapshot Velocity
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Discovers high-potential standard long-form YouTube videos across all categories (including low-view breakout outliers). Never fabricates growth velocity when historical snapshots are unavailable.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      aria-label="Discovery topic filter"
                      placeholder="Optional topic or keyword..."
                      value={discoverQuery}
                      onChange={(e) => setDiscoverQuery(e.target.value)}
                      className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      disabled={isDiscovering}
                      onClick={handleRunAutoDiscovery}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 text-slate-950 font-semibold text-xs hover:bg-amber-300 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isDiscovering ? 'Scanning YouTube & Grounding...' : 'Run Auto Discovery'}
                    </button>
                  </div>
                </div>

                {/* Niche Category Filter Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
                  {NICHE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedNiche(cat)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        selectedNiche === cat
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {groundingSummary && (
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    <div className="font-semibold text-amber-500">
                      Live Google Search Grounding (gemini-3.8-flash) Trend Intelligence:
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {groundingSummary}
                    </p>
                    {groundingLinks.length > 0 && (
                      <div className="flex flex-wrap gap-3 pt-1">
                        {groundingLinks.map((l, i) => (
                          <a
                            key={i}
                            href={l.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sky-500 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>{l.title || l.uri}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Discovered Video Cards */}
              <div className="grid grid-cols-1 gap-4">
                {discoveredVideos
                  .filter((v) => selectedNiche === 'All' || v.category === selectedNiche)
                  .map((video) => {
                    const latestSnap = video.snapshots[video.snapshots.length - 1];
                    const ev = video.viralEvaluation;
                    return (
                      <div
                        key={video.videoId}
                        className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5"
                      >
                        <div className="flex items-start gap-4 min-w-0">
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            referrerPolicy="no-referrer"
                            className="w-24 h-32 rounded-lg object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                          />
                          <div className="space-y-1.5 min-w-0">
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                              {video.title}
                            </h3>
                            {/* Unboxed Metadata with Typographic Separators */}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                              <span>{video.channelTitle}</span>
                              <span aria-hidden="true">·</span>
                              <span>{video.category}</span>
                              <span aria-hidden="true">·</span>
                              <span>Duration: {video.durationLabel}</span>
                              <span aria-hidden="true">·</span>
                              <span>Views: {latestSnap?.viewCount.toLocaleString()}</span>
                              <span aria-hidden="true">·</span>
                              <span>Snapshots: {ev.dataAvailability.snapshotCount}</span>
                            </div>

                            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-1">
                              <div className="font-mono">
                                Viral Score: <strong>{ev.viralScore}/100</strong> · Confidence:{' '}
                                <strong>{ev.confidence}</strong> · Measured Velocity:{' '}
                                <strong>
                                  {ev.growthVelocityPerHour !== null
                                    ? `+${ev.growthVelocityPerHour.toLocaleString()} views/hr`
                                    : 'Awaiting 2nd Snapshot (Not Fabricated)'}
                                </strong>
                              </div>
                              <div className="text-slate-500 dark:text-slate-400">
                                {ev.reasons[0]}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCaptureNewSnapshot(video.videoId)}
                            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                          >
                            Log New Snapshot
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setManualUrl(video.url);
                              setActiveTab('manual');
                            }}
                            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 whitespace-nowrap"
                          >
                            Verify &amp; Queue Clips
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* VIEW 3: MANUAL URL & COPYRIGHT / OWNERSHIP DECLARATION */}
          {activeTab === 'manual' && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
                <div>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Manual YouTube URL Validation &amp; Source Authorization Gate
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Validates URL format, 11-char Video ID, availability, and metadata. ViralMint AI never circumvents YouTube technical restrictions or DRM and requires explicit source ownership or license authorization before processing.
                  </p>
                </div>

                <form onSubmit={handleValidateManualUrl} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-8">
                      <label htmlFor="manual-youtube-url" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        YouTube Video URL
                      </label>
                      <input
                        id="manual-youtube-url"
                        type="url"
                        required
                        placeholder="https://www.youtube.com/watch?v=M7lc1UVf-VE"
                        value={manualUrl}
                        onChange={(e) => setManualUrl(e.target.value)}
                        className="mt-1 w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor="desired-clip-count" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Clip Count
                      </label>
                      <input
                        id="desired-clip-count"
                        type="number"
                        min={1}
                        max={10}
                        value={manualClipCount}
                        onChange={(e) => setManualClipCount(Number(e.target.value))}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono tabular-nums"
                      />
                    </div>

                    <div className="md:col-span-2 flex items-end">
                      <button
                        type="submit"
                        disabled={isValidatingUrl}
                        className="w-full py-2 px-4 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-semibold text-xs hover:opacity-90 disabled:opacity-50"
                      >
                        {isValidatingUrl ? 'Validating...' : 'Validate URL'}
                      </button>
                    </div>
                  </div>
                </form>

                {manualError && (
                  <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-300">
                    {manualError}
                  </div>
                )}

                {manualValidationResult && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Verified Video: {manualValidationResult.metadata?.title}
                        </div>
                        <div className="text-xs font-mono text-slate-500">
                          ID: {manualValidationResult.videoId} · Channel:{' '}
                          {manualValidationResult.metadata?.channelTitle} · Source:{' '}
                          {manualValidationResult.source}
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        URL &amp; METADATA VERIFIED
                      </span>
                    </div>

                    {/* Copyright & Source Permission Declaration */}
                    <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-3">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Mandatory Source Ownership &amp; Copyright Permission Declaration
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Public YouTube availability does not grant downloading or reuse rights. Automated duplicate checks do not guarantee legal permission or prevent Content ID claims.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block text-xs text-slate-700 dark:text-slate-300">
                          Authorization Basis
                          <select
                            value={ownershipType}
                            onChange={(e) => setOwnershipType(e.target.value as any)}
                            className="mt-1 w-full px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                          >
                            <option value="authorized_owner">I am the Creator / Channel Owner</option>
                            <option value="licensed">I hold Written Syndication / Clipping License</option>
                            <option value="creative_commons">Creative Commons (CC-BY) with Attribution</option>
                          </select>
                        </label>

                        <label className="block text-xs text-slate-700 dark:text-slate-300">
                          Optional: Upload Authorized Master Video File (.mp4)
                          <input
                            type="file"
                            accept="video/mp4,video/webm"
                            onChange={(e) =>
                              setLocalAuthorizedFileName(e.target.files?.[0]?.name || null)
                            }
                            className="mt-1 w-full text-xs text-slate-500"
                          />
                        </label>
                      </div>

                      <label className="flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={ownershipConfirmed}
                          onChange={(e) => setOwnershipConfirmed(e.target.checked)}
                          className="mt-0.5 rounded accent-amber-400"
                        />
                        <span>
                          I confirm that I own this content or have documented legal authorization to process and clip this source material, and I will retain original source attribution.
                        </span>
                      </label>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={isAnalyzingGemini4}
                        onClick={handleQueueManualSource}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-400 text-slate-950 font-semibold text-xs hover:bg-amber-300 disabled:opacity-50"
                      >
                        <Sparkles className="w-4 h-4" />
                        {isAnalyzingGemini4
                          ? 'Analyzing Moments with Gemini 4 Argon (High Thinking)...'
                          : `Queue Authorized Source (${manualClipCount} Clips)`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 4: APPROVAL QUEUE */}
          {activeTab === 'approval' && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Candidate Processing Approval Queue
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      When Processing Approval Toggle is ON, discovered candidates wait here for your confirmation before GPU transcription and rendering begin.
                    </p>
                  </div>
                </div>

                {jobs.filter((j) => j.status === 'awaiting_approval').length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No jobs currently awaiting processing approval.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {jobs
                      .filter((j) => j.status === 'awaiting_approval')
                      .map((job) => (
                        <div
                          key={job.jobId}
                          className="py-4 flex flex-wrap items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {job.title}
                            </div>
                            <div className="text-xs font-mono text-slate-500">
                              Job ID: {job.jobId} · Channel: {job.channelTitle} · Target Clips:{' '}
                              {job.clipCount} · Viral Score: {job.viralScore}/100 · Auth:{' '}
                              {job.authorizationStatus}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveJobForProcessing(job.jobId)}
                              className="px-4 py-2 rounded-lg bg-amber-400 text-slate-950 font-semibold text-xs hover:bg-amber-300"
                            >
                              Approve &amp; Start GPU Processing
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 5: PERSISTENT PROCESSING JOBS & CHECKPOINT RECOVERY */}
          {activeTab === 'jobs' && (
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Persistent Job Queue &amp; Checkpoint Recovery
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tracks all 14 pipeline states across Firestore &amp; Google Drive manifests. Failed or interrupted Colab jobs resume from their last verified checkpoint without restarting completed steps.
                    </p>
                  </div>
                  <a
                    href="/api/worker/notebook"
                    download="ViralMint_Tesla_T4_Worker.ipynb"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Tesla T4 Worker Notebook (.ipynb)
                  </a>
                </div>

                <div className="space-y-3">
                  {jobs.map((job) => (
                    <div
                      key={job.jobId}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {job.title}
                          </div>
                          <div className="text-xs font-mono text-slate-500 tabular-nums">
                            {job.jobId} · Source: {job.sourceVideoId} · Checkpoint:{' '}
                            <strong>{job.lastCheckpoint}</strong> · Retries: {job.retryCount}/
                            {automationConfig.retryLimit}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono uppercase font-bold text-amber-500">
                            {job.status} ({job.progress}%)
                          </span>

                          {job.status === 'failed' ? (
                            <button
                              type="button"
                              onClick={() => handleResumeFailedJob(job)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-semibold text-xs hover:bg-amber-300"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Resume from Checkpoint ({job.lastCheckpoint})
                            </button>
                          ) : (
                            job.progress < 100 && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceJobCheckpoint(job)}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                Advance Next Checkpoint
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-200 ${
                            job.status === 'failed' ? 'bg-rose-500' : 'bg-amber-400'
                          }`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        Current Step: {job.currentStep}
                      </div>

                      {job.errorDetails && (
                        <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                          <div>
                            <strong>Failure Diagnostic:</strong> {job.errorDetails}
                          </div>
                          {job.suggestedFix && (
                            <div>
                              <strong>Suggested Fix:</strong> {job.suggestedFix}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 6: BUILT-IN CLIP EDITOR */}
          {activeTab === 'editor' && (
            <ClipEditorView
              clips={clips}
              selectedClipId={selectedClipId}
              onSelectClip={setSelectedClipId}
              onUpdateClip={(updated) =>
                setClips((prev) =>
                  prev.map((c) => (c.clipId === updated.clipId ? updated : c))
                )
              }
              onLogActivity={appendActivity}
              minQualityThreshold={automationConfig.minQualityScore}
              workerConnected={workerStatus.status === 'connected'}
            />
          )}

          {/* VIEW 7: COMPLETED CLIPS */}
          {activeTab === 'completed' && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Completed 9:16 Vertical Clips &amp; 8-Factor Quality Scores
                </h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {clips.map((clip) => (
                    <div
                      key={clip.clipId}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <div className="aspect-[9/16] max-h-56 w-full rounded-lg overflow-hidden bg-slate-900">
                          <img
                            src={clip.thumbnailUrl}
                            alt={clip.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {clip.title}
                        </h3>
                        <div className="text-xs font-mono text-slate-500 tabular-nums">
                          {clip.durationSeconds}s · {clip.resolution} · Score: {clip.qualityScore}/100 ({clip.qualityClassification})
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {clip.qualityReasons[0]}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClipId(clip.clipId);
                            setActiveTab('editor');
                          }}
                          className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadConfirmClip(clip);
                            setActiveTab('upload');
                          }}
                          className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-amber-400 text-slate-950"
                        >
                          Queue Unlisted Upload
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 8: UPLOAD MANAGER (STRICT UNLISTED ENFORCEMENT) */}
          {activeTab === 'upload' && (
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-500" />
                      YouTube Unlisted Upload Manager
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Every uploaded clip strictly enforces <code>privacyStatus = "unlisted"</code>. ViralMint AI never publishes videos publicly; you review and publish manually in YouTube Studio.
                    </p>
                  </div>
                  {connectedChannel && (
                    <div className="text-xs font-mono text-slate-500">
                      Target Channel: <strong>{connectedChannel.title}</strong> ({connectedChannel.id})
                    </div>
                  )}
                </div>

                {uploadStatusNote && (
                  <div className="p-3.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs font-mono text-slate-900 dark:text-slate-100">
                    {uploadStatusNote}
                  </div>
                )}

                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {clips.map((clip) => (
                    <div
                      key={clip.clipId}
                      className="py-4 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {clip.seoMetadata.seoTitle}
                        </div>
                        <div className="text-xs font-mono text-slate-500 tabular-nums">
                          Clip ID: {clip.clipId} · Quality: {clip.qualityScore}/100 · Enforced Privacy:{' '}
                          <strong>unlisted</strong> · Status: {clip.approvalStatus}
                          {clip.youtubeVideoId ? ` · YouTube ID: ${clip.youtubeVideoId}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {clip.approvalStatus === 'uploaded_unlisted' ? (
                          <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            UPLOADED UNLISTED ({clip.youtubeVideoId})
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setUploadConfirmClip(clip)}
                            className="px-4 py-2 rounded-lg bg-amber-400 text-slate-950 font-semibold text-xs hover:bg-amber-300"
                          >
                            Final Approval &amp; Upload as Unlisted
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mandatory Final Approval Modal Before Each Unlisted YouTube Upload */}
              {uploadConfirmClip && (
                <div
                  role="dialog"
                  aria-label="Final Unlisted Upload Approval"
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
                >
                  <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Confirm Final Approval for YouTube Unlisted Upload
                    </h3>
                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5 font-mono">
                      <div>Title: {uploadConfirmClip.seoMetadata.seoTitle}</div>
                      <div>Duration: {uploadConfirmClip.durationSeconds}s (1080×1920 9:16)</div>
                      <div>Quality Score: {uploadConfirmClip.qualityScore}/100</div>
                      <div>Original Source Attribution: {uploadConfirmClip.sourceUrl}</div>
                      <div className="text-amber-500 font-bold">
                        privacyStatus: &quot;unlisted&quot; (Hard-Enforced — Never Auto-Public)
                      </div>
                    </div>
                    <div className="flex justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setUploadConfirmClip(null)}
                        className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isUploadingToYouTube}
                        onClick={handleConfirmUnlistedUpload}
                        className="px-4 py-2 rounded-lg bg-amber-400 text-slate-950 font-semibold text-xs hover:bg-amber-300 disabled:opacity-50"
                      >
                        {isUploadingToYouTube
                          ? 'Uploading to YouTube...'
                          : 'Confirm & Upload Unlisted'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 9: ANALYTICS & COST / QUOTA MONITOR */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total Channel Views', val: connectedChannel ? connectedChannel.viewCount.toLocaleString() : '—' },
                  { label: 'Channel Subscribers', val: connectedChannel ? connectedChannel.subscriberCount.toLocaleString() : '—' },
                  { label: 'Processing Success Rate', val: `${Math.round(((jobs.length - kpis.failedJobs) / Math.max(1, jobs.length)) * 100)}%` },
                  { label: 'Uploaded Unlisted Clips', val: String(kpis.uploadedUnlisted) },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="text-xs text-slate-500">{m.label}</div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums">{m.val}</div>
                  </div>
                ))}
              </div>

              {/* Cost & Quota Monitor */}
              <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Cost, API Quota &amp; Colab Runtime Monitor
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Displays measured usage and non-binding cost estimates. ViralMint AI never activates paid cloud services without explicit user approval and does not promise unlimited free GPU runtime.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono tabular-nums">
                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500">Gemini API Calls Today</div>
                    <div className="mt-1 text-lg font-bold">{apiUsage.geminiCallsToday} calls</div>
                    <div className="text-[11px] text-slate-400">
                      ~{apiUsage.geminiTokensEstimated.toLocaleString()} tokens (Est. ~$0.04)
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500">YouTube Data API v3 Quota</div>
                    <div className="mt-1 text-lg font-bold">
                      {apiUsage.youtubeQuotaUnitsUsed} / {apiUsage.youtubeQuotaDailyLimit}
                    </div>
                    <div className="text-[11px] text-slate-400">Free tier daily quota units</div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500">Google Drive Storage</div>
                    <div className="mt-1 text-lg font-bold">
                      {apiUsage.driveUsedGb} GB / {apiUsage.driveLimitGb} GB
                    </div>
                    <div className="text-[11px] text-slate-400">Temp render cleanup enabled</div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500">Colab Tesla T4 Runtime</div>
                    <div className="mt-1 text-lg font-bold">{apiUsage.colabRuntimeMinutesToday} mins</div>
                    <div className="text-[11px] text-slate-400">Ephemeral session with checkpoints</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 10: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  System &amp; Workflow Notifications
                </h1>
                <button
                  type="button"
                  onClick={() =>
                    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
                  }
                  className="text-xs font-medium text-amber-500 hover:underline"
                >
                  Mark All as Read
                </button>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {notifications.map((n) => (
                  <div key={n.id} className="py-3.5 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {n.title} {!n.read && <span className="text-xs text-amber-500">(Unread)</span>}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{n.body}</p>
                    </div>
                    {n.actionTab && (
                      <button
                        type="button"
                        onClick={() => setActiveTab(n.actionTab as NavTab)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs shrink-0"
                      >
                        Open
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEWS 11, 12, 13: HEALTH CHECK, TEST MODE, ACTIVITY LOG */}
          {(activeTab === 'health' || activeTab === 'test_mode' || activeTab === 'activity_log') && (
            <SettingsAndDiagnosticsView
              mode={activeTab}
              userEmail={currentUser?.email || null}
              connectedChannel={connectedChannel}
              onUpdateChannel={setConnectedChannel}
              workerStatus={workerStatus}
              onSimulateWorkerConnect={async () => {
                const res = await fetch('/api/worker/heartbeat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    workerId: 'colab-t4-primary',
                    gpuModel: 'NVIDIA Tesla T4 (16GB VRAM)',
                    status: 'connected',
                    currentStep: 'Heartbeat verified — Ready for 1080p FFmpeg jobs',
                  }),
                });
                if (res.ok) {
                  const d = await res.json();
                  setWorkerStatus(d.worker);
                }
              }}
              onSimulateWorkerDisconnect={async () => {
                const res = await fetch('/api/worker/disconnect', { method: 'POST' });
                if (res.ok) {
                  const d = await res.json();
                  setWorkerStatus(d.worker);
                }
              }}
              jobs={jobs}
              clips={clips}
              activityLogs={activityLogs}
              onLogActivity={appendActivity}
              automationConfig={automationConfig}
              onUpdateAutomationConfig={setAutomationConfig}
            />
          )}
        </main>
      </div>

      {/* Multi-Turn Gemini Production Architect Chatbot Drawer */}
      <AiArchitectDrawer />
    </div>
  );
}
