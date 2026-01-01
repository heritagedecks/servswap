import { storage } from './firebaseCompat';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

// Add helper for better error messages
const getDetailedErrorMessage = (error: any): string => {
  const errorCode = error?.code || '';
  const errorMessage = error?.message || 'Unknown error';
  
  // Handle specific Firebase error codes
  if (errorCode === 'storage/unauthorized' || errorMessage.includes('Missing or insufficient permissions')) {
    return `Firebase Storage permission denied. You need to configure Firebase Storage rules in the Firebase Console.
    
Go to https://console.firebase.google.com/ > Select your project > Storage > Rules and add these rules:

rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}

And click "Publish"`;
  }
  
  if (errorCode === 'storage/quota-exceeded') {
    return 'Storage quota exceeded. Please contact the administrator.';
  }
  
  if (errorCode === 'storage/canceled') {
    return 'Upload canceled. Please try again.';
  }
  
  if (errorCode === 'storage/invalid-checksum') {
    return 'File corrupted during upload. Please try again.';
  }
  
  if (errorCode === 'storage/retry-limit-exceeded') {
    return 'Upload failed multiple times. Check your network connection and try again.';
  }
  
  return `Upload error (${errorCode}): ${errorMessage}`;
};

/**
 * Debug helper function to log detailed information about the file and storage path
 */
const logUploadDebug = (file: File, storagePath: string, userId: string) => {
  console.log('=== UPLOAD DEBUG INFO ===');
  console.log('File:', {
    name: file.name,
    type: file.type,
    size: `${(file.size / 1024).toFixed(2)} KB`,
    lastModified: new Date(file.lastModified).toISOString()
  });
  console.log('Storage path:', storagePath);
  console.log('User ID:', userId);
  console.log('========================');
};

/**
 * Clean and validate a storage path
 * Ensures the path follows the structure allowed by Firebase Storage rules
 */
const getValidStoragePath = (path: string, userId: string, fileName: string): string => {
  // Extract the base path (profile-images, banner-images, portfolio-images)
  let basePath = path.split('/')[0];
  
  // Default to portfolio-images if not a recognized path
  if (!['profile-images', 'banner-images', 'portfolio-images'].includes(basePath)) {
    console.warn(`Path "${basePath}" not recognized. Using "portfolio-images" instead.`);
    basePath = 'portfolio-images';
  }
  
  // For portfolio items, keep any additional path parts (like item ID)
  if (basePath === 'portfolio-images' && path.includes('/')) {
    const pathParts = path.split('/');
    if (pathParts.length >= 2) {
      // If path has format "portfolio-images/itemId", keep that structure
      return `${basePath}/${userId}/${pathParts[1]}/${fileName}`;
    }
  }
  
  // Default path structure
  return `${basePath}/${userId}/${fileName}`;
};

/**
 * Upload a file to Firebase Storage with progress tracking
 * This function uses a different method than the one in the profile page
 * 
 * @param file The file to upload
 * @param path The storage path to upload to
 * @param userId The user ID for the path
 * @param onProgress Optional callback for progress updates
 * @returns Promise with the download URL
 */
export const uploadFileWithProgress = (
  file: File,
  path: string,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }

    try {
      // Generate unique file name
      const fileId = uuidv4();
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `${fileId}.${fileExtension}`;
      
      // Get validated storage path
      const storagePath = getValidStoragePath(path, userId, fileName);
      
      // Log detailed debug info
      logUploadDebug(file, storagePath, userId);
      
      // Create storage reference
      if (!storage) throw new Error('Firebase Storage is not initialized');
      const storageRef = ref(storage, storagePath);

      // Set metadata
      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedBy: userId,
          originalName: file.name,
          uploadTime: new Date().toISOString()
        }
      };

      // Report initial progress
      if (onProgress) {
        onProgress(1); // Start at 1% to show user something is happening
      }
      
      // Create upload task with resumable upload
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);
      
      // Register for progress events
      const progressHandler = (snapshot: any) => {
        // Calculate and report progress
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        console.log(`Upload progress: ${progress}% (${snapshot.bytesTransferred}/${snapshot.totalBytes} bytes)`);
        
        if (onProgress) {
          // Ensure progress is at least 1% to show activity
          onProgress(Math.max(1, progress));
        }
      };
      
      // Register state change observer
      uploadTask.on(
        'state_changed',
        progressHandler,
        (error) => {
          // Handle failed uploads with better error messages
          console.error('Upload failed:', error);
          reject(new Error(getDetailedErrorMessage(error)));
        },
        async () => {
          // Handle successful uploads
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('File uploaded successfully. Download URL:', downloadURL);
            
            // Force progress to 100% on completion
            if (onProgress) {
              onProgress(100);
            }
            
            resolve(downloadURL);
          } catch (error) {
            console.error('Error getting download URL:', error);
            reject(new Error(getDetailedErrorMessage(error)));
          }
        }
      );
    } catch (error) {
      console.error('Upload error:', error);
      reject(new Error(getDetailedErrorMessage(error)));
    }
  });
};

/**
 * A simpler upload function without progress tracking
 */
export const uploadFile = async (
  file: File,
  path: string,
  userId: string
): Promise<string> => {
  if (!file) throw new Error('No file provided');
  
  // Perform simple validation
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error(`File too large. Maximum size is 5MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  }
  
  try {
    return await uploadFileWithProgress(file, path, userId);
  } catch (error: any) {
    console.error('Upload error:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
};

/**
 * Simplest possible upload function - use as temporary fallback
 * Works in memory only, does not actually upload to Firebase
 * Use only if Firebase Storage permissions are not properly configured
 */
export const fakeUploadFile = async (file: File): Promise<string> => {
  return new Promise((resolve) => {
    // Create a local URL for demo purposes
    const reader = new FileReader();
    reader.onload = (e) => {
      // This URL is only valid for the current session
      const dataUrl = e.target?.result as string;
      // Simulate a delay for realistic behavior
      setTimeout(() => resolve(dataUrl), 1500);
    };
    reader.readAsDataURL(file);
  });
}; 