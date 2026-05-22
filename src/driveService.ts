/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Google Drive API helper methods
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API_URL = 'https://www.googleapis.com/upload/drive/v3/files';

/**
 * Searches for a file or folder in Google Drive.
 */
export async function findFileOrFolder(
  accessToken: string,
  name: string,
  mimeType?: string,
  parentId?: string
): Promise<string | null> {
  let query = `name = '${name.replace(/'/g, "\\'")}' and trashed = false`;
  if (mimeType) {
    query += ` and mimeType = '${mimeType}'`;
  }
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id,name)`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Drive search failed: ${response.statusText}. Details: ${errText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

/**
 * Creates a folder in Google Drive.
 */
export async function createFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string> {
  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch(DRIVE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Folder creation failed: ${response.statusText}. Details: ${errText}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Finds a folder, or creates it if it doesn't exist.
 */
export async function findOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string> {
  const existingId = await findFileOrFolder(
    accessToken,
    folderName,
    'application/vnd.google-apps.folder',
    parentId
  );
  if (existingId) {
    return existingId;
  }
  return await createFolder(accessToken, folderName, parentId);
}

/**
 * Deletes a file in Google Drive.
 */
export async function deleteDriveFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errText = await response.text();
    console.warn(`Failed to delete file ${fileId} from Drive: ${response.statusText}. Details: ${errText}`);
  }
}

/**
 * Converts a data URL with a base64 string directly into a Blob.
 * Bypasses fetch(dataUrl) which commonly throws "String did not match expected pattern" on multiple mobile devices and Safari.
 */
export function dataURLtoBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  if (parts.length < 2) {
    throw new Error('Data URL inválido');
  }
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const base64Str = parts[1].replace(/\s/g, ''); // remove any spaces or whitespace
  
  let binaryStr: string;
  try {
    binaryStr = atob(base64Str);
  } catch (err) {
    // Fallback if atob needs padding
    let cleaned = base64Str;
    while (cleaned.length % 4 > 0) {
      cleaned += '=';
    }
    binaryStr = atob(cleaned);
  }

  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Uploads a base64 JPEG image to Google Drive inside a parent folder.
 * If the file already exists, it updates it. Else, it creates it.
 */
export async function uploadResidentPhoto(
  accessToken: string,
  fileName: string,
  parentId: string,
  photoDataUrl: string,
  existingFileId?: string
): Promise<string> {
  // Extract base64 part
  const matches = photoDataUrl.match(/^data:image\/jpeg;base64,(.+)$/);
  if (!matches || matches.length !== 2) {
    throw new Error('Formato de foto inválido. Deve ser um Data URL image/jpeg em base64.');
  }
  
  const base64Data = matches[1];

  // If we already know the file id, we can update (PATCH) the file content
  if (existingFileId) {
    const blobData = dataURLtoBlob(photoDataUrl);

    const response = await fetch(`${UPLOAD_API_URL}/${existingFileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'image/jpeg',
      },
      body: blobData,
    });

    if (response.ok) {
      return existingFileId;
    }
    // If patch fails for some reason, proceed to recreate it
  }

  // To check if a file with this name already exists in this folder to prevent duplicates
  const alreadyExistingId = await findFileOrFolder(accessToken, fileName, 'image/jpeg', parentId);
  if (alreadyExistingId) {
    // Update existing
    const blobData = dataURLtoBlob(photoDataUrl);

    const response = await fetch(`${UPLOAD_API_URL}/${alreadyExistingId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'image/jpeg',
      },
      body: blobData,
    });

    if (response.ok) {
      return alreadyExistingId;
    }
  }

  // Create new file with Multipart Upload
  const metadata = {
    name: fileName,
    mimeType: 'image/jpeg',
    parents: [parentId],
  };

  const boundary = '3d9f75bf-12a8-4bb6-b6d8-9a4f4ef1d6ea';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  // Build multipart content
  const metadataPart = 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata);
  const mediaPart = 'Content-Type: image/jpeg\r\n' + 'Content-Transfer-Encoding: base64\r\n\r\n' + base64Data;

  const rawMultipartBody = delimiter + metadataPart + delimiter + mediaPart + closeDelimiter;

  const response = await fetch(`${UPLOAD_API_URL}?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: rawMultipartBody,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Photo upload failed: ${response.statusText}. Details: ${errText}`);
  }

  const data = await response.json();
  return data.id;
}
