/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * ViralMint AI — Firebase Auth, Firestore & Google Workspace OAuth Client Service
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Configure OAuth Scopes matching set_up_oauth configuration
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

const provider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'consent',
});

// In-memory access token cache (NEVER stored in localStorage/sessionStorage per security skill)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Mandatory boot connection validation per firebase-integration-rpc skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google OAuth access token from sign-in.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Sanitized Firestore Helpers adhering strictly to firebase-blueprint.json constraints
export async function saveJobToFirestore(job: {
  jobId: string;
  sourceVideoId: string;
  sourceUrl: string;
  title: string;
  channelTitle?: string;
  category?: string;
  authorizationStatus: 'authorized_owner' | 'licensed' | 'creative_commons' | 'pending_declaration';
  status: string;
  currentStep: string;
  progress: number;
  clipCount: number;
  viralScore: number;
  retryCount: number;
  lastCheckpoint: string;
  errorDetails?: string;
  uploadStatus?: string;
  isTestMode: boolean;
}) {
  const user = auth.currentUser;
  if (!user) return;
  const cleanId = job.jobId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  const path = `jobs/${cleanId}`;
  try {
    await setDoc(doc(db, 'jobs', cleanId), {
      ownerId: user.uid,
      jobId: cleanId,
      sourceVideoId: String(job.sourceVideoId).slice(0, 64),
      sourceUrl: String(job.sourceUrl).slice(0, 512),
      title: String(job.title).slice(0, 300),
      channelTitle: String(job.channelTitle || 'YouTube Creator').slice(0, 200),
      category: String(job.category || 'Technology').slice(0, 64),
      authorizationStatus: job.authorizationStatus,
      status: job.status,
      currentStep: String(job.currentStep).slice(0, 120),
      progress: Math.max(0, Math.min(100, Number(job.progress) || 0)),
      clipCount: Math.max(0, Math.min(20, Number(job.clipCount) || 1)),
      viralScore: Math.max(0, Math.min(100, Number(job.viralScore) || 75)),
      retryCount: Math.max(0, Math.min(10, Number(job.retryCount) || 0)),
      lastCheckpoint: String(job.lastCheckpoint).slice(0, 120),
      errorDetails: String(job.errorDetails || '').slice(0, 1000),
      uploadStatus: String(job.uploadStatus || 'not_uploaded').slice(0, 64),
      isTestMode: Boolean(job.isTestMode),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateJobInFirestore(
  jobId: string,
  updates: Partial<{
    status: string;
    currentStep: string;
    progress: number;
    clipCount: number;
    retryCount: number;
    lastCheckpoint: string;
    errorDetails: string;
    uploadStatus: string;
    authorizationStatus: string;
  }>
) {
  const user = auth.currentUser;
  if (!user) return;
  const cleanId = jobId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  const path = `jobs/${cleanId}`;
  try {
    await updateDoc(doc(db, 'jobs', cleanId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteJobFromFirestore(jobId: string) {
  const user = auth.currentUser;
  if (!user) return;
  const cleanId = jobId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  const path = `jobs/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'jobs', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserJobs(
  userId: string,
  onData: (jobs: any[]) => void
) {
  const q = query(collection(db, 'jobs'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data());
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'jobs');
    }
  );
}
