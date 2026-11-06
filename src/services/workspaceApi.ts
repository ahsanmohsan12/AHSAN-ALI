/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * ViralMint AI — Official Google Drive, Gmail & YouTube OAuth API Service
 */

import { getAccessToken } from './firebase';

export const VIRALMINT_DRIVE_FOLDERS = [
  'jobs',
  'sources',
  'processing',
  'completed',
  'approved',
  'uploaded',
  'thumbnails',
  'metadata',
  'logs',
  'backups',
];

export interface DriveStorageQuota {
  limitBytes: number;
  usageBytes: number;
  usageInDriveBytes: number;
  rootFolderId?: string;
}

export interface ConnectedYouTubeChannel {
  id: string;
  title: string;
  customUrl?: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  thumbnailUrl?: string;
  connectedAtIso: string;
}

/**
 * Fetches Google Drive storage usage & quota from Drive v3 about endpoint.
 */
export async function fetchDriveStorageQuota(): Promise<DriveStorageQuota> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Google Drive authorization required. Please sign in with Google.');
  }

  const res = await fetch(
    'https://www.googleapis.com/drive/v3/about?fields=storageQuota,user',
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    limitBytes: Number(data.storageQuota?.limit || 15 * 1024 * 1024 * 1024),
    usageBytes: Number(data.storageQuota?.usage || 0),
    usageInDriveBytes: Number(data.storageQuota?.usageInDrive || 0),
  };
}

/**
 * Ensures the `ViralMint/` root directory and all 10 required subdirectories exist in Google Drive.
 */
export async function initializeViralMintDriveFolders(): Promise<{
  rootFolderId: string;
  subfolders: Record<string, string>;
}> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Google Drive authorization required. Please sign in with Google.');
  }

  const findOrCreateFolder = async (name: string, parentId?: string): Promise<string> => {
    const qParts = [
      `mimeType='application/vnd.google-apps.folder'`,
      `name='${name}'`,
      `trashed=false`,
    ];
    if (parentId) {
      qParts.push(`'${parentId}' in parents`);
    }
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      qParts.join(' and ')
    )}&fields=files(id,name)`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create Drive folder '${name}': ${errText}`);
    }
    const created = await createRes.json();
    return created.id;
  };

  const rootFolderId = await findOrCreateFolder('ViralMint');
  const subfolders: Record<string, string> = {};
  for (const sub of VIRALMINT_DRIVE_FOLDERS) {
    subfolders[sub] = await findOrCreateFolder(sub, rootFolderId);
  }

  return { rootFolderId, subfolders };
}

/**
 * Saves a JSON manifest, backup, or metadata file to Google Drive (`drive.file` scope).
 */
export async function saveJsonFileToDrive(params: {
  fileName: string;
  payload: Record<string, any>;
  parentFolderId?: string;
}): Promise<{ fileId: string; name: string; webViewLink?: string }> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Google Drive authorization required. Please sign in with Google.');
  }

  const metadata: Record<string, any> = {
    name: params.fileName,
    mimeType: 'application/json',
  };
  if (params.parentFolderId) {
    metadata.parents = [params.parentFolderId];
  }

  const boundary = '-------viralmint_drive_multipart_boundary';
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify(params.payload, null, 2)}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    fileId: data.id,
    name: data.name,
    webViewLink: data.webViewLink,
  };
}

/**
 * Lists files created by ViralMint AI in Google Drive.
 */
export async function listViralMintDriveFiles(): Promise<
  { id: string; name: string; mimeType: string; createdTime: string; size?: string }[]
> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Google Drive authorization required.');
  }

  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?pageSize=25&fields=files(id,name,mimeType,createdTime,size)&q=trashed=false',
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Drive list failed (${res.status})`);
  }
  const data = await res.json();
  return data.files || [];
}

/**
 * Sends an email notification via Gmail API (`gmail.send` scope).
 * NOTE: Caller MUST display user confirmation dialog before invoking!
 */
export async function sendGmailAlert(params: {
  toEmail: string;
  subject: string;
  bodyText: string;
}): Promise<{ id: string; threadId: string }> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Gmail authorization required. Please sign in with Google.');
  }

  const mimeMessage = [
    `To: ${params.toEmail}`,
    `Subject: ${params.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    params.bodyText,
  ].join('\r\n');

  const base64UrlEncoded = btoa(unescape(encodeURIComponent(mimeMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64UrlEncoded }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail API send failed (${res.status}): ${errText}`);
  }

  return await res.json();
}

/**
 * Connects and verifies the user's single active YouTube channel via YouTube Data API v3.
 */
export async function fetchConnectedYouTubeChannel(): Promise<ConnectedYouTubeChannel> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('YouTube OAuth authorization required. Please sign in with Google.');
  }

  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`YouTube Channel verification failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const ch = data.items?.[0];
  if (!ch) {
    throw new Error('No YouTube channel found on this Google account.');
  }

  return {
    id: ch.id,
    title: ch.snippet?.title || 'YouTube Channel',
    customUrl: ch.snippet?.customUrl,
    subscriberCount: Number(ch.statistics?.subscriberCount || 0),
    viewCount: Number(ch.statistics?.viewCount || 0),
    videoCount: Number(ch.statistics?.videoCount || 0),
    thumbnailUrl: ch.snippet?.thumbnails?.default?.url,
    connectedAtIso: new Date().toISOString(),
  };
}

/**
 * Uploads a rendered video blob to YouTube with strictly enforced `privacyStatus = "unlisted"`.
 * Never automatically publishes videos publicly.
 */
export async function uploadUnlistedClipToYouTube(params: {
  title: string;
  description: string;
  tags: string[];
  categoryId?: string;
  videoBlob: Blob;
}): Promise<{ youtubeVideoId: string; privacyStatus: 'unlisted'; watchUrl: string }> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('YouTube Upload authorization required. Please sign in with Google.');
  }

  // HARD ENFORCEMENT: privacyStatus is ALWAYS "unlisted"
  const metadata = {
    snippet: {
      title: params.title.slice(0, 100),
      description: params.description.slice(0, 4900),
      tags: params.tags.slice(0, 15),
      categoryId: params.categoryId || '28',
    },
    status: {
      privacyStatus: 'unlisted',
      selfDeclaredMadeForKids: false,
    },
  };

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(params.videoBlob.size),
        'X-Upload-Content-Type': params.videoBlob.type || 'video/mp4',
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`YouTube resumable upload initialization failed (${initRes.status}): ${errText}`);
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('YouTube API did not return a resumable upload Location header.');
  }

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': params.videoBlob.type || 'video/mp4',
    },
    body: params.videoBlob,
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`YouTube video binary transfer failed (${putRes.status}): ${errText}`);
  }

  const uploadedData = await putRes.json();
  if (!uploadedData?.id) {
    throw new Error('YouTube API did not confirm a valid video ID.');
  }

  return {
    youtubeVideoId: uploadedData.id,
    privacyStatus: 'unlisted',
    watchUrl: `https://www.youtube.com/watch?v=${uploadedData.id}`,
  };
}
