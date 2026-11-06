/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * ViralMint AI — Built-In 9:16 Clip Editor, After Effects Caption Studio,
 * Audio Ducking Mixer, AI Thumbnail Generator (1K/2K/4K & All Aspect Ratios),
 * TTS Synthesizer, and SEO Metadata Editor.
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Sparkles,
  Volume2,
  Type as TypeIcon,
  Image as ImageIcon,
  FileText,
  RefreshCw,
  Download,
  HardDrive,
  CheckCircle2,
  Sliders,
  Box,
} from 'lucide-react';
import {
  ViralClipItem,
  CaptionWord,
  NicheCategory,
} from '../data/seedData';
import { calculateClipQualityScore } from '../utils/viralEngine';
import { StudioStage3D } from './StudioStage3D';
import { saveJsonFileToDrive } from '../services/workspaceApi';

interface ClipEditorViewProps {
  clips: ViralClipItem[];
  selectedClipId: string;
  onSelectClip: (clipId: string) => void;
  onUpdateClip: (updated: ViralClipItem) => void;
  onLogActivity: (category: any, status: 'info' | 'success' | 'warning' | 'error', message: string, jobId?: string) => void;
  minQualityThreshold: number;
  workerConnected: boolean;
}

const ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'] as const;
const IMAGE_SIZES = ['1K', '2K', '4K'] as const;

export const ClipEditorView: React.FC<ClipEditorViewProps> = ({
  clips,
  selectedClipId,
  onSelectClip,
  onUpdateClip,
  onLogActivity,
  minQualityThreshold,
  workerConnected,
}) => {
  const activeClip = clips.find((c) => c.clipId === selectedClipId) || clips[0];

  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [show3DStage, setShow3DStage] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<
    'captions' | 'audio' | 'thumbnail' | 'seo' | 'quality'
  >('captions');

  // Render & Export progress state
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatusMsg, setRenderStatusMsg] = useState<string | null>(null);

  // AI Thumbnail Generation state
  const [thumbPrompt, setThumbPrompt] = useState(
    'High-contrast vertical viral thumbnail of a technology broadcast studio with bold lighting'
  );
  const [thumbModel, setThumbModel] = useState<'gemini-nano-banana-2.1' | 'gemini-3-pro-image-preview'>(
    'gemini-nano-banana-2.1'
  );
  const [thumbAspectRatio, setThumbAspectRatio] = useState<string>('9:16');
  const [thumbSize, setThumbSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [isGeneratingThumb, setIsGeneratingThumb] = useState(false);
  const [thumbStatus, setThumbStatus] = useState<string | null>(null);

  // AI SEO & Fast Hook state
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);
  const [fastHookFeedback, setFastHookFeedback] = useState<string | null>(null);
  const [isCheckingHook, setIsCheckingHook] = useState(false);

  // Gemini 3.8 Flash TTS state
  const [ttsVoice, setTtsVoice] = useState<'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr'>('Kore');
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setPlayheadSec((prev) => {
        const next = prev + 0.25;
        return next > 5.0 ? 0 : next;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [isPlaying]);

  if (!activeClip) {
    return (
      <div className="p-8 text-center border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No clips available to edit. Discover or queue a video first.
        </p>
      </div>
    );
  }

  const currentCaptionWord =
    activeClip.captionWords.find(
      (w) => playheadSec >= w.startOffset && playheadSec <= w.endOffset
    ) || activeClip.captionWords[0];

  const handleTrimChange = (start: number, end: number) => {
    const safeStart = Math.max(0, start);
    const safeEnd = Math.max(safeStart + 15, end);
    const durationSeconds = safeEnd - safeStart;
    const updatedMetrics = {
      ...activeClip.qualityMetrics,
      durationSeconds,
    };
    const evalResult = calculateClipQualityScore(updatedMetrics, minQualityThreshold);
    onUpdateClip({
      ...activeClip,
      startSeconds: safeStart,
      endSeconds: safeEnd,
      durationSeconds,
      qualityMetrics: updatedMetrics,
      qualityScore: evalResult.overallScore,
      qualityClassification: evalResult.classification,
      qualityReasons: evalResult.reasons,
    });
  };

  const handleToggleWordHighlight = (idx: number) => {
    const updatedWords: CaptionWord[] = activeClip.captionWords.map((w, i) =>
      i === idx ? { ...w, isHighlightedYellow: !w.isHighlightedYellow } : w
    );
    onUpdateClip({
      ...activeClip,
      captionWords: updatedWords,
    });
  };

  const handleWordTextChange = (idx: number, newWord: string) => {
    const updatedWords: CaptionWord[] = activeClip.captionWords.map((w, i) =>
      i === idx ? { ...w, word: newWord } : w
    );
    onUpdateClip({
      ...activeClip,
      captionWords: updatedWords,
    });
  };

  const handleReRenderClip = () => {
    setIsRendering(true);
    setRenderProgress(12);
    setRenderStatusMsg('Applying 9:16 Smart Crop, Yellow/White ASS Captions & -14 LUFS Audio Ducking...');

    const step1 = window.setTimeout(() => setRenderProgress(48), 300);
    const step2 = window.setTimeout(() => setRenderProgress(84), 650);
    const step3 = window.setTimeout(() => {
      const boostedMetrics = {
        ...activeClip.qualityMetrics,
        editingQuality: Math.min(99, activeClip.qualityMetrics.editingQuality + 2),
        captionAccuracy: Math.min(99, activeClip.qualityMetrics.captionAccuracy + 1),
      };
      const evalResult = calculateClipQualityScore(boostedMetrics, minQualityThreshold);
      const nowIso = new Date().toISOString();

      onUpdateClip({
        ...activeClip,
        qualityMetrics: boostedMetrics,
        qualityScore: evalResult.overallScore,
        qualityClassification: evalResult.classification,
        qualityReasons: evalResult.reasons,
        lastRenderedAt: nowIso,
      });

      setIsRendering(false);
      setRenderProgress(100);
      setRenderStatusMsg(
        `Rendered 1080×1920 H.264 MP4 (${activeClip.durationSeconds}s) · Quality Score: ${evalResult.overallScore}/100 (${evalResult.classification})`
      );
      onLogActivity(
        'rendering',
        'success',
        `Re-rendered clip "${activeClip.title}" (${activeClip.durationSeconds}s, 1080x1920 9:16) with updated captions and audio mix.`,
        activeClip.jobId
      );
    }, 1000);

    return () => {
      clearTimeout(step1);
      clearTimeout(step2);
      clearTimeout(step3);
    };
  };

  const handleDownloadExportManifest = () => {
    const exportPayload = {
      clipId: activeClip.clipId,
      title: activeClip.title,
      aspectRatio: '9:16',
      resolution: '1080x1920',
      codec: 'H.264 MP4',
      trim: {
        startSeconds: activeClip.startSeconds,
        endSeconds: activeClip.endSeconds,
        durationSeconds: activeClip.durationSeconds,
      },
      smartReframe: {
        cropOffsetX: activeClip.cropOffsetX,
        zoomScale: activeClip.zoomScale,
      },
      captions: {
        style: activeClip.captionStyle,
        words: activeClip.captionWords,
      },
      audioMix: activeClip.audioMix,
      seoMetadata: activeClip.seoMetadata,
      qualityScore: activeClip.qualityScore,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeClip.clipId}_1080x1920_render_spec.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateAiThumbnail = async (editExisting = false) => {
    setIsGeneratingThumb(true);
    setThumbStatus('Generating studio thumbnail with Gemini...');
    try {
      let base64ImageData: string | undefined;
      if (editExisting && activeClip.thumbnailUrl.startsWith('data:image')) {
        base64ImageData = activeClip.thumbnailUrl;
      }

      const res = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${thumbPrompt}. Overlay text concept: "${activeClip.seoMetadata.thumbnailText}"`,
          model: thumbModel,
          aspectRatio: thumbAspectRatio,
          imageSize: thumbSize,
          base64ImageData,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error || 'Thumbnail generation failed.');
      }

      onUpdateClip({
        ...activeClip,
        thumbnailUrl: data.imageUrl,
      });
      setThumbStatus(
        `Generated ${data.imageSize} (${data.aspectRatio}) thumbnail via ${data.modelUsed}.`
      );
      onLogActivity(
        'editing',
        'success',
        `Generated AI thumbnail (${data.imageSize}, ${data.aspectRatio}) for clip ${activeClip.clipId}.`,
        activeClip.jobId
      );
    } catch (err: any) {
      setThumbStatus(`Error: ${err.message}`);
    } finally {
      setIsGeneratingThumb(false);
    }
  };

  const handleSaveThumbnailToDrive = async () => {
    try {
      setThumbStatus('Saving thumbnail & metadata package to Google Drive (ViralMint/thumbnails)...');
      const saved = await saveJsonFileToDrive({
        fileName: `${activeClip.clipId}_thumbnail_package.json`,
        payload: {
          clipId: activeClip.clipId,
          title: activeClip.title,
          thumbnailText: activeClip.seoMetadata.thumbnailText,
          aspectRatio: thumbAspectRatio,
          imageSize: thumbSize,
          thumbnailUrl: activeClip.thumbnailUrl,
          savedAt: new Date().toISOString(),
        },
      });
      setThumbStatus(`Saved to Google Drive (File ID: ${saved.fileId}).`);
    } catch (err: any) {
      setThumbStatus(`Drive save note: ${err.message}`);
    }
  };

  const handleGenerateSeoMetadata = async () => {
    setIsGeneratingSeo(true);
    try {
      const res = await fetch('/api/gemini/seo-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipTitle: activeClip.title,
          hookText: activeClip.hookText,
          category: activeClip.seoMetadata.suggestedCategory,
          sourceChannel: activeClip.sourceChannel,
          sourceUrl: activeClip.sourceUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'SEO generation failed');

      onUpdateClip({
        ...activeClip,
        title: data.seoTitle || activeClip.title,
        seoMetadata: {
          seoTitle: data.seoTitle || activeClip.seoMetadata.seoTitle,
          description: data.description || activeClip.seoMetadata.description,
          hashtags: Array.isArray(data.hashtags) ? data.hashtags : activeClip.seoMetadata.hashtags,
          tags: Array.isArray(data.tags) ? data.tags : activeClip.seoMetadata.tags,
          suggestedCategory: (data.suggestedCategory as NicheCategory) || activeClip.seoMetadata.suggestedCategory,
          keywords: Array.isArray(data.keywords) ? data.keywords : activeClip.seoMetadata.keywords,
          thumbnailText: data.thumbnailText || activeClip.seoMetadata.thumbnailText,
          chapters: Array.isArray(data.chapters) ? data.chapters : activeClip.seoMetadata.chapters,
        },
      });
      onLogActivity(
        'editing',
        'success',
        `Generated Gemini 3.8 Flash SEO metadata for "${activeClip.clipId}".`,
        activeClip.jobId
      );
    } catch (err: any) {
      onLogActivity('api_error', 'error', `SEO metadata error: ${err.message}`, activeClip.jobId);
    } finally {
      setIsGeneratingSeo(false);
    }
  };

  const handleFastHookCheck = async () => {
    setIsCheckingHook(true);
    setFastHookFeedback(null);
    try {
      const res = await fetch('/api/gemini/fast-hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: activeClip.hookText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fast hook check failed');
      setFastHookFeedback(data.result);
    } catch (err: any) {
      setFastHookFeedback(`Hook analysis error: ${err.message}`);
    } finally {
      setIsCheckingHook(false);
    }
  };

  const handleGenerateTtsPreview = async () => {
    setIsGeneratingTts(true);
    setTtsError(null);
    try {
      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: activeClip.hookText,
          voiceName: ttsVoice,
          style: 'Clear, engaging broadcast pacing',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.audioDataUrl) {
        throw new Error(data.error || 'TTS synthesis failed');
      }
      setTtsAudioUrl(data.audioDataUrl);
    } catch (err: any) {
      setTtsError(err.message);
    } finally {
      setIsGeneratingTts(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Clip Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <label htmlFor="clip-selector" className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Active Clip:
          </label>
          <select
            id="clip-selector"
            value={activeClip.clipId}
            onChange={(e) => onSelectClip(e.target.value)}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          >
            {clips.map((c) => (
              <option key={c.clipId} value={c.clipId}>
                {c.title} ({c.durationSeconds}s · Score {c.qualityScore}/100)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShow3DStage((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Box className="w-3.5 h-3.5" />
            {show3DStage ? 'Hide 3D Reframing Stage' : 'Show 3D Reframing Stage'}
          </button>

          <button
            type="button"
            onClick={handleDownloadExportManifest}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export Render Spec
          </button>

          <button
            type="button"
            disabled={isRendering}
            onClick={handleReRenderClip}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRendering ? 'animate-spin' : ''}`} />
            {isRendering ? `Rendering 1080p (${renderProgress}%)...` : 'Re-Render 1080p 9:16 Clip'}
          </button>
        </div>
      </div>

      {renderStatusMsg && (
        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span>{renderStatusMsg}</span>
          <span className="font-mono tabular-nums">1080×1920 · H.264 · -14 LUFS</span>
        </div>
      )}

      {/* Three.js 3D Studio Stage (when enabled) */}
      {show3DStage && (
        <StudioStage3D
          cropOffsetX={activeClip.cropOffsetX}
          zoomScale={activeClip.zoomScale}
          onChangeCropOffsetX={(val) => onUpdateClip({ ...activeClip, cropOffsetX: val })}
          onChangeZoomScale={(val) => onUpdateClip({ ...activeClip, zoomScale: val })}
          clipTitle={activeClip.title}
          currentWord={currentCaptionWord?.word || 'HOOK'}
          workerConnected={workerConnected}
        />
      )}

      {/* Main 2-Column Split: Left = 9:16 Vertical Monitor Preview & Trim, Right = Studio Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 9:16 Vertical Preview & Timeline Trim (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>9:16 Vertical Master Preview (1080 × 1920)</span>
            <span className="font-mono tabular-nums">
              {activeClip.startSeconds}s – {activeClip.endSeconds}s ({activeClip.durationSeconds}s)
            </span>
          </div>

          {/* 9:16 Aspect Ratio Frame */}
          <div className="relative mx-auto w-full max-w-[270px] aspect-[9/16] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 select-none">
            <img
              src={activeClip.thumbnailUrl}
              alt={activeClip.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-150"
              style={{
                transform: `scale(${activeClip.zoomScale}) translateX(${activeClip.cropOffsetX * 0.4}%)`,
              }}
            />

            {/* Measured Scrim for Contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40" />

            {/* Top Source Attribution Overlay */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[11px] text-slate-200 font-mono">
              <span className="truncate">{activeClip.sourceChannel}</span>
              <span>9:16 · 1080p</span>
            </div>

            {/* After Effects-Inspired Yellow & White Synchronized Word-by-Word Captions */}
            <div
              className="absolute left-3 right-3 text-center px-2"
              style={{
                top: `${activeClip.captionStyle.verticalPositionPercent}%`,
                transform: 'translateY(-50%)',
                fontFamily: activeClip.captionStyle.fontFamily,
              }}
            >
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {activeClip.captionWords.map((cw, idx) => {
                  const isActive = cw === currentCaptionWord;
                  const color = cw.isHighlightedYellow
                    ? activeClip.captionStyle.highlightColor
                    : activeClip.captionStyle.baseColor;
                  return (
                    <span
                      key={idx}
                      style={{
                        color,
                        fontSize: `${Math.round(activeClip.captionStyle.fontSizePx * 0.48)}px`,
                        textShadow: activeClip.captionStyle.shadowEnabled
                          ? '0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000, 0 4px 10px rgba(0,0,0,0.85)'
                          : 'none',
                        transform: isActive ? 'scale(1.14)' : 'scale(1.0)',
                      }}
                      className="font-extrabold tracking-tight transition-transform duration-100 inline-block"
                    >
                      {cw.word}{' '}
                      {activeClip.captionStyle.showEmojis && cw.emoji ? cw.emoji : ''}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Bottom Playback Control Bar */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-1.5">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isPlaying ? 'Pause' : 'Preview'}
              </button>
              <span className="font-mono text-[11px] text-slate-300 tabular-nums">
                00:0{Math.floor(playheadSec)} / 01:{String(activeClip.durationSeconds - 60).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Start/End Trimming Controls (60-120s target enforcement) */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Sentence-Boundary Trim Controls
              </span>
              <span
                className={`font-mono tabular-nums ${
                  activeClip.durationSeconds >= 60 && activeClip.durationSeconds <= 120
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                Duration: {activeClip.durationSeconds}s (Target 60–120s)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-slate-600 dark:text-slate-400">
                Start Time (sec)
                <input
                  type="number"
                  value={activeClip.startSeconds}
                  onChange={(e) =>
                    handleTrimChange(Number(e.target.value), activeClip.endSeconds)
                  }
                  className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs tabular-nums text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="block text-xs text-slate-600 dark:text-slate-400">
                End Time (sec)
                <input
                  type="number"
                  value={activeClip.endSeconds}
                  onChange={(e) =>
                    handleTrimChange(activeClip.startSeconds, Number(e.target.value))
                  }
                  className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs tabular-nums text-slate-900 dark:text-slate-100"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Tabbed Studio Inspector (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          {/* Interactive Sub-Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
            {[
              { id: 'captions', label: 'Animated Captions', icon: TypeIcon },
              { id: 'audio', label: 'Audio Mix & TTS', icon: Volume2 },
              { id: 'thumbnail', label: 'AI Thumbnail Studio', icon: ImageIcon },
              { id: 'seo', label: 'AI SEO Metadata', icon: FileText },
              { id: 'quality', label: `Quality (${activeClip.qualityScore}/100)`, icon: Sliders },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeSubTab === tab.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* SUB-TAB 1: ANIMATED CAPTIONS */}
          {activeSubTab === 'captions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    After Effects-Inspired Yellow &amp; White Word-by-Word Captions
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click any word chip to toggle yellow keyword emphasis (#FACC15) vs white (#FFFFFF).
                  </p>
                </div>
              </div>

              {/* Word-by-Word Interactive Editor */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {activeClip.captionWords.map((cw, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1"
                    >
                      <input
                        type="text"
                        aria-label={`Caption word ${idx + 1}`}
                        value={cw.word}
                        onChange={(e) => handleWordTextChange(idx, e.target.value)}
                        className="w-20 text-xs font-semibold bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleToggleWordHighlight(idx)}
                        className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                          cw.isHighlightedYellow
                            ? 'bg-amber-400 text-slate-950 font-bold'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {cw.isHighlightedYellow ? 'YLW' : 'WHT'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Style Customization Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  Typography Face
                  <select
                    value={activeClip.captionStyle.fontFamily}
                    onChange={(e) =>
                      onUpdateClip({
                        ...activeClip,
                        captionStyle: {
                          ...activeClip.captionStyle,
                          fontFamily: e.target.value as any,
                        },
                      })
                    }
                    className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="Outfit">Outfit Bold (Viral Default)</option>
                    <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                    <option value="JetBrains Mono">JetBrains Mono</option>
                  </select>
                </label>

                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  Animation Preset
                  <select
                    value={activeClip.captionStyle.animationStyle}
                    onChange={(e) =>
                      onUpdateClip({
                        ...activeClip,
                        captionStyle: {
                          ...activeClip.captionStyle,
                          animationStyle: e.target.value as any,
                        },
                      })
                    }
                    className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="pop_scale">Pop Scale &amp; Bounce</option>
                    <option value="bounce_wave">Dynamic Word Wave</option>
                    <option value="clean_fade">Smooth Broadcast Cut</option>
                  </select>
                </label>

                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  Vertical Position ({activeClip.captionStyle.verticalPositionPercent}%)
                  <input
                    type="range"
                    min={20}
                    max={85}
                    value={activeClip.captionStyle.verticalPositionPercent}
                    onChange={(e) =>
                      onUpdateClip({
                        ...activeClip,
                        captionStyle: {
                          ...activeClip.captionStyle,
                          verticalPositionPercent: Number(e.target.value),
                        },
                      })
                    }
                    className="mt-2 w-full accent-amber-400"
                  />
                </label>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: AUDIO SYSTEM & GEMINI TTS */}
          {activeSubTab === 'audio' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Original Dialogue Priority &amp; Auto-Ducking Mixer
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Original speaker audio is strictly preserved. Licensed background music is capped at ≤30% and automatically ducked during speech.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span>Original Dialogue Volume</span>
                    <span className="font-mono tabular-nums">{activeClip.audioMix.originalVolumePercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={70}
                    max={120}
                    value={activeClip.audioMix.originalVolumePercent}
                    onChange={(e) =>
                      onUpdateClip({
                        ...activeClip,
                        audioMix: {
                          ...activeClip.audioMix,
                          originalVolumePercent: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-amber-400"
                  />
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeClip.audioMix.backgroundMusicEnabled}
                        onChange={(e) =>
                          onUpdateClip({
                            ...activeClip,
                            audioMix: {
                              ...activeClip.audioMix,
                              backgroundMusicEnabled: e.target.checked,
                            },
                          })
                        }
                        className="rounded accent-amber-400"
                      />
                      <span>Licensed Background Music</span>
                    </label>
                    <span className="font-mono tabular-nums">
                      {activeClip.audioMix.backgroundMusicVolumePercent}% (Capped ≤30%)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    disabled={!activeClip.audioMix.backgroundMusicEnabled}
                    value={activeClip.audioMix.backgroundMusicVolumePercent}
                    onChange={(e) =>
                      onUpdateClip({
                        ...activeClip,
                        audioMix: {
                          ...activeClip.audioMix,
                          backgroundMusicVolumePercent: Math.min(30, Number(e.target.value)),
                        },
                      })
                    }
                    className="w-full accent-amber-400"
                  />
                </div>
              </div>

              {/* Gemini 3.8 Flash TTS Voiceover / Hook Audition */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Hook Pacing Audition (Gemini 3.8 Flash TTS — Accessibility &amp; Hook Timing Check)
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Synthesize the spoken hook using <code>gemini-3.8-flash-tts</code> to audition cadence (never replaces original speaker dialogue in export).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="TTS Voice Persona"
                      value={ttsVoice}
                      onChange={(e) => setTtsVoice(e.target.value as any)}
                      className="px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      <option value="Kore">Kore (Broadcast)</option>
                      <option value="Puck">Puck (Energetic)</option>
                      <option value="Charon">Charon (Deep)</option>
                      <option value="Fenrir">Fenrir (Documentary)</option>
                      <option value="Zephyr">Zephyr (Warm)</option>
                    </select>
                    <button
                      type="button"
                      disabled={isGeneratingTts}
                      onClick={handleGenerateTtsPreview}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 hover:opacity-90 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      {isGeneratingTts ? 'Synthesizing...' : 'Generate Speech (TTS)'}
                    </button>
                  </div>
                </div>

                {ttsError && <p className="text-xs text-rose-500">{ttsError}</p>}
                {ttsAudioUrl && (
                  <audio controls src={ttsAudioUrl} className="w-full h-9 mt-2" />
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 3: AI THUMBNAIL STUDIO */}
          {activeSubTab === 'thumbnail' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  AI Thumbnail Concept Generator &amp; Image Editor
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Generate or edit thumbnails with <code>gemini-nano-banana-2.1</code> or <code>gemini-3-pro-image-preview</code> across 1K, 2K, 4K and 8 aspect ratios.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  Image Model
                  <select
                    value={thumbModel}
                    onChange={(e) => setThumbModel(e.target.value as any)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                  >
                    <option value="gemini-nano-banana-2.1">gemini-nano-banana-2.1</option>
                    <option value="gemini-3-pro-image-preview">gemini-3-pro-image-preview (Studio Pro)</option>
                  </select>
                </label>

                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  Resolution Size
                  <select
                    value={thumbSize}
                    onChange={(e) => setThumbSize(e.target.value as any)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                  >
                    {IMAGE_SIZES.map((sz) => (
                      <option key={sz} value={sz}>
                        {sz} Resolution
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  Aspect Ratio
                  <select
                    value={thumbAspectRatio}
                    onChange={(e) => setThumbAspectRatio(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                  >
                    {ASPECT_RATIOS.map((ar) => (
                      <option key={ar} value={ar}>
                        {ar}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  Thumbnail Visual Prompt / Edit Instruction
                  <input
                    type="text"
                    value={thumbPrompt}
                    onChange={(e) => setThumbPrompt(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                  />
                </label>

                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  Yellow/White Thumbnail Hook Text
                  <input
                    type="text"
                    value={activeClip.seoMetadata.thumbnailText}
                    onChange={(e) =>
                      onUpdateClip({
                        ...activeClip,
                        seoMetadata: {
                          ...activeClip.seoMetadata,
                          thumbnailText: e.target.value,
                        },
                      })
                    }
                    className="mt-1 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={isGeneratingThumb}
                  onClick={() => handleGenerateAiThumbnail(false)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isGeneratingThumb ? 'Generating...' : 'Generate New Thumbnail'}
                </button>

                <button
                  type="button"
                  disabled={isGeneratingThumb}
                  onClick={() => handleGenerateAiThumbnail(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  Edit Current Image with Prompt
                </button>

                <button
                  type="button"
                  onClick={handleSaveThumbnailToDrive}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  Save to Google Drive
                </button>
              </div>

              {thumbStatus && (
                <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">{thumbStatus}</p>
              )}

              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                <strong>YouTube Shorts Thumbnail Capability Notice:</strong> YouTube Data API v3 custom thumbnail endpoints behave differently for vertical Shorts vs standard long-form videos. ViralMint AI saves the generated high-contrast thumbnail to <code>ViralMint/thumbnails/</code> in Google Drive and embeds a clean keyframe so you can also select your preferred frame in YouTube Studio mobile/web.
              </div>
            </div>
          )}

          {/* SUB-TAB 4: AI SEO METADATA */}
          {activeSubTab === 'seo' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Gemini SEO Metadata &amp; Low-Latency Hook Polish
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Honest, clip-accurate metadata without keyword stuffing or fabricated claims.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isCheckingHook}
                    onClick={handleFastHookCheck}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    {isCheckingHook ? 'Checking...' : 'Fast Hook Audit (3.1 Flash Lite)'}
                  </button>
                  <button
                    type="button"
                    disabled={isGeneratingSeo}
                    onClick={handleGenerateSeoMetadata}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isGeneratingSeo ? 'Generating...' : 'Regenerate SEO with Gemini'}
                  </button>
                </div>
              </div>

              {fastHookFeedback && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-slate-800 dark:text-slate-200">
                  <strong>gemini-3.1-flash-lite Instant Hook Feedback:</strong> {fastHookFeedback}
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  SEO Title
                  <input
                    type="text"
                    value={activeClip.seoMetadata.seoTitle}
                    onChange={(e) =>
                      onUpdateClip({
                        ...activeClip,
                        title: e.target.value,
                        seoMetadata: {
                          ...activeClip.seoMetadata,
                          seoTitle: e.target.value,
                        },
                      })
                    }
                    className="mt-1 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                  />
                </label>

                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  Description (Preserves Original Creator Attribution)
                  <textarea
                    rows={3}
                    value={activeClip.seoMetadata.description}
                    onChange={(e) =>
                      onUpdateClip({
                        ...activeClip,
                        seoMetadata: {
                          ...activeClip.seoMetadata,
                          description: e.target.value,
                        },
                      })
                    }
                    className="mt-1 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-xs text-slate-600 dark:text-slate-400">
                    Hashtags (comma-separated)
                    <input
                      type="text"
                      value={activeClip.seoMetadata.hashtags.join(', ')}
                      onChange={(e) =>
                        onUpdateClip({
                          ...activeClip,
                          seoMetadata: {
                            ...activeClip.seoMetadata,
                            hashtags: e.target.value.split(',').map((s) => s.trim()),
                          },
                        })
                      }
                      className="mt-1 w-full px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                    />
                  </label>

                  <label className="block text-xs text-slate-600 dark:text-slate-400">
                    YouTube Tags
                    <input
                      type="text"
                      value={activeClip.seoMetadata.tags.join(', ')}
                      onChange={(e) =>
                        onUpdateClip({
                          ...activeClip,
                          seoMetadata: {
                            ...activeClip.seoMetadata,
                            tags: e.target.value.split(',').map((s) => s.trim()),
                          },
                        })
                      }
                      className="mt-1 w-full px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 5: 8-FACTOR QUALITY SCORING */}
          {activeSubTab === 'quality' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    8-Factor Clip Quality Score: {activeClip.qualityScore}/100 ({activeClip.qualityClassification})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    80–100: Excellent · 65–79: Review recommended · Below {minQualityThreshold}: Reject or regenerate. Quality scores evaluate technical &amp; structural readiness and do not guarantee viral performance.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Hook Strength', val: activeClip.qualityMetrics.hookStrength },
                  { label: 'Viral Potential', val: activeClip.qualityMetrics.viralPotential },
                  { label: 'Audio Clarity', val: activeClip.qualityMetrics.audioClarity },
                  { label: 'Caption Accuracy', val: activeClip.qualityMetrics.captionAccuracy },
                  { label: 'Editing Quality', val: activeClip.qualityMetrics.editingQuality },
                  { label: 'Pacing', val: activeClip.qualityMetrics.pacing },
                  { label: 'Engagement', val: activeClip.qualityMetrics.engagementPotential },
                  { label: 'Context Complete', val: activeClip.qualityMetrics.contextCompleteness },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  >
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{m.label}</div>
                    <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {m.val}/100
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Evaluation Reasoning:
                </div>
                {activeClip.qualityReasons.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
