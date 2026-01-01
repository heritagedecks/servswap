'use client';

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import { useAuth } from '@/app/context/AuthContext';
import { db, storage as appStorage, app } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getStorage, ref as storageRef, FirebaseStorage, getBlob, listAll, deleteObject } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';
import { uploadFileWithProgress, fakeUploadFile } from '@/app/lib/uploadUtils';
import { getApps } from 'firebase/app';
import heic2any from 'heic2any';
import Cropper from 'react-easy-crop';
import Modal from 'react-modal';
import type { Area } from 'react-easy-crop';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  bio: z.string().max(500, 'Bio cannot exceed 500 characters').optional().nullable(),
  location: z.string().max(100, 'Location cannot exceed 100 characters').optional().nullable(),
  skills: z.string().max(200, 'Skills cannot exceed 200 characters').optional().nullable(),
});

const portfolioItemSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().max(200, 'Description cannot exceed 200 characters'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PortfolioItemFormValues = z.infer<typeof portfolioItemSchema>;

interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
}

interface UserProfile {
  bio?: string;
  location?: string;
  skills?: string[];
  portfolio?: PortfolioItem[];
  bannerImage?: string;
  updatedAt?: any;
}

// Add type annotation for appStorage
if (!appStorage) throw new Error('Firebase storage is not initialized');
const typedAppStorage: FirebaseStorage = appStorage;

// Helper to extract storage path from Firebase Storage download URL
function extractStoragePathFromUrl(url: string): string | null {
  const match = url.match(/\/o\/(.*?)\?/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  return null;
}

// Helper to fetch a remote image as a File using Firebase Storage SDK
async function fetchImageAsFileFromFirebase(storagePath: string, filename = 'banner.jpg'): Promise<File> {
  const storage = getStorage(app);
  const fileRef = storageRef(storage, storagePath);
  const blob = await getBlob(fileRef);
  return new File([blob], filename, { type: blob.type });
}

// Helper to upload and replace all previous images in a folder
async function uploadAndReplaceImage(userId: string, file: File, folder: string, prefix: string): Promise<string> {
  try {
    console.log(`Starting upload for ${prefix} image:`, file.name, file.size);
    
    // Get Firebase storage reference
    const storage = getStorage(app);
    console.log('Got storage reference');
    
    // Create a unique file name with timestamp to avoid cache issues
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${prefix}-${Date.now()}.${fileExtension}`;
    const path = `${folder}/${userId}/${fileName}`;
    
    console.log('Upload path:', path);
    const imageRef = ref(storage, path);
    
    // Upload new image with content type
    console.log('Uploading file...');
    await uploadBytes(imageRef, file, { 
      contentType: file.type,
      customMetadata: {
        userId,
        originalName: file.name
      }
    });
    
    console.log('File uploaded, getting download URL');
    const imageURL = await getDownloadURL(imageRef);
    console.log('Download URL obtained:', imageURL);
    
    return imageURL;
  } catch (error) {
    console.error('Error in uploadAndReplaceImage:', error);
    throw error;
  }
}

export default function ProfilePage() {
  const { user, updateUserProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [showPortfolioForm, setShowPortfolioForm] = useState(false);
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedBanner, setSelectedBanner] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [selectedProjectImage, setSelectedProjectImage] = useState<File | null>(null);
  const [projectImagePreview, setProjectImagePreview] = useState<string | null | undefined>(undefined);
  const [isUploadingProjectImage, setIsUploadingProjectImage] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    bio: '',
    location: '',
    skills: [],
    portfolio: [],
    bannerImage: ''
  });
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [bannerUploadProgress, setBannerUploadProgress] = useState<number>(0);
  const [showBannerCrop, setShowBannerCrop] = useState(false);
  const [bannerCrop, setBannerCrop] = useState({ x: 0, y: 0 });
  const [bannerZoom, setBannerZoom] = useState(1);
  const [bannerCroppedAreaPixels, setBannerCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number; } | null>(null);
  const [rawBannerFile, setRawBannerFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema) as any,
    defaultValues: {
      name: user?.displayName || '',
      bio: '',
      location: '',
      skills: '',
    },
  });

  const {
    register: registerPortfolio,
    handleSubmit: handleSubmitPortfolio,
    formState: { errors: portfolioErrors },
    reset: resetPortfolioForm,
  } = useForm<PortfolioItemFormValues>({
    resolver: zodResolver(portfolioItemSchema) as any,
    defaultValues: {
      title: '',
      description: '',
    },
  });

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        // Fetch profile data from Firestore
        const profileDocRef = doc(db, 'profiles', user.uid);
        const profileDocSnap = await getDoc(profileDocRef);
        
        if (profileDocSnap.exists()) {
          const profileData = profileDocSnap.data() as UserProfile;
          setUserProfile(profileData);
          
          // Set form values
          setValue('name', user.displayName || '');
          setValue('bio', profileData.bio || '');
          setValue('location', profileData.location || '');
          setValue('skills', profileData.skills ? profileData.skills.join(', ') : '');
          
          // Set banner preview if exists
          if (profileData.bannerImage) {
            setBannerPreview(profileData.bannerImage);
            console.log("Banner loaded:", profileData.bannerImage);
          }
          
          // Set portfolio items - ensure we have valid data
          if (profileData.portfolio && Array.isArray(profileData.portfolio) && profileData.portfolio.length > 0) {
            console.log("Loaded portfolio items:", profileData.portfolio.length);
            setPortfolioItems(profileData.portfolio);
          } else {
            console.log("No portfolio items found");
            setPortfolioItems([]);
          }
        } else {
          // Create empty profile if it doesn't exist
          await setDoc(profileDocRef, {
            userId: user.uid,
            bio: '',
            location: '',
            skills: [],
            portfolio: [],
            bannerImage: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          console.log("Created new empty profile");
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        setErrorMessage('Failed to load profile. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [user, setValue]);

  // Add debugging for banner image loading
  useEffect(() => {
    if (bannerPreview) {
      console.log("Banner image loaded in UI:", bannerPreview);
    }
  }, [bannerPreview]);

  const uploadImage = async (file: File, path: string): Promise<string> => {
    if (!user) throw new Error('User not authenticated');
    if (!file) throw new Error('No file selected');
    
    // Check file size (max 5MB)
    const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeInBytes) {
      throw new Error(`File size exceeds 5MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    }
    
    // Function to upload with timeout
    const uploadWithTimeout = async () => {
      // Create a promise that rejects after timeout
      const timeout = new Promise<never>((_, reject) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          reject(new Error('Upload timed out after 30 seconds'));
        }, 30000); // 30 second timeout
      });
      
      try {
        // Create a unique file name
        const fileId = uuidv4();
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const fileName = `${fileId}.${fileExtension}`;
        const fullPath = `${path}/${user.uid}/${fileName}`;
        console.log(`Uploading to path: ${fullPath}`);
        
        // Create a reference to the storage location
        const storageRef = ref(typedAppStorage, fullPath);
        
        // Define metadata with content type
        const metadata = {
          contentType: file.type,
          customMetadata: {
            'uploadedBy': user.uid,
            'originalName': file.name
          }
        };
        
        console.log(`Starting upload: ${file.name} (${file.size} bytes)`);
        
        // The actual upload promise
        const uploadPromise = async () => {
          // Upload the file and wait for completion
          const uploadResult = await uploadBytes(storageRef, file, metadata);
          console.log('Upload completed successfully', uploadResult);
          
          // Get the download URL
          const downloadURL = await getDownloadURL(uploadResult.ref);
          console.log('Download URL obtained:', downloadURL);
          
          return downloadURL;
        };
        
        // Race between the timeout and the upload
        return await Promise.race([uploadPromise(), timeout]);
      } catch (error: any) {
        console.error('Error during upload:', error);
        throw error;
      }
    };
    
    // Try the upload with 3 retries
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`Upload attempt ${attempts} of ${maxAttempts}`);
        return await uploadWithTimeout();
      } catch (error: any) {
        console.error(`Upload attempt ${attempts} failed:`, error);
        
        // If we've exhausted all attempts, throw the error
        if (attempts >= maxAttempts) {
          throw new Error(`Upload failed after ${maxAttempts} attempts: ${error.message}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // We should never reach here due to the throw in the loop
    throw new Error('Unknown upload error');
  };

  // Enhanced test function with detailed error reporting
  const testDirectUpload = async (file: File): Promise<string> => {
    if (!user || !file) {
      throw new Error('User or file missing for upload test');
    }
    
    console.log('==== DIRECT UPLOAD TEST ====');
    console.log('File details:', {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      lastModified: new Date(file.lastModified).toISOString()
    });
    console.log('User:', {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName
    });
    
    try {
      // Check if Firebase is properly initialized
      console.log('Firebase apps:', getApps().length);
      console.log('Storage bucket:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
      
      // Get direct storage reference
      const storage = getStorage(app);
      console.log('Storage instance:', storage);
      
      const testPath = `test-uploads/${user.uid}/${Date.now()}-${file.name}`;
      console.log('Upload path:', testPath);
      
      const testRef = storageRef(storage, testPath);
      console.log('Storage reference:', testRef);
      
      // Simple metadata
      const metadata = {
        contentType: file.type,
      };
      
      console.log('Starting direct upload to Firebase Storage...');
      
      // Direct upload with no abstraction - wrapped in try/catch for detailed error
      try {
        const uploadResult = await uploadBytes(testRef, file, metadata);
        console.log('Direct upload successful!', uploadResult);
        
        try {
          const downloadURL = await getDownloadURL(uploadResult.ref);
          console.log('Download URL obtained:', downloadURL);
          return downloadURL;
        } catch (urlError: any) {
          console.error('Failed to get download URL:', urlError);
          throw new Error(`Upload succeeded but couldn't get download URL: ${urlError.message}`);
        }
      } catch (uploadError: any) {
        console.error('Upload bytes failed:', uploadError);
        
        // Check for specific error codes
        const errorCode = uploadError.code || '';
        const errorMessage = uploadError.message || '';
        
        if (errorCode === 'storage/unauthorized' || errorMessage.includes('permission')) {
          throw new Error(`Firebase Storage permissions denied. Update your rules in Firebase Console: ${errorMessage}`);
        }
        
        if (errorCode === 'storage/invalid-argument') {
          throw new Error(`Invalid upload parameters: ${errorMessage}`);
        }
        
        if (errorCode === 'storage/canceled') {
          throw new Error(`Upload was canceled: ${errorMessage}`);
        }
        
        if (errorCode === 'storage/unknown') {
          throw new Error(`Unknown storage error. Check your Firebase config: ${errorMessage}`);
        }
        
        // Generic error fallback
        throw new Error(`Firebase Storage upload failed: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error('DIRECT UPLOAD ERROR:', error);
      throw error;
    }
  };

  // Enhanced test button function with more feedback
  const handleTestUpload = async () => {
    if (!selectedBanner && !selectedImage && !selectedProjectImage) {
      setErrorMessage('Please select an image first to test upload');
      return;
    }
    
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('Initiating test upload...');
    
    try {
      // Use whatever image is selected
      const fileToTest = selectedBanner || selectedImage || selectedProjectImage;
      if (!fileToTest) {
        throw new Error('No file selected');
      }
      
      console.log('Selected file for test:', fileToTest.name);
      setSuccessMessage(`Testing upload of ${fileToTest.name}...`);
      
      const downloadUrl = await testDirectUpload(fileToTest);
      setSuccessMessage(`Test upload successful! URL: ${downloadUrl.substring(0, 50)}...`);
      
      // Display the image
      const imgElement = document.createElement('img');
      imgElement.src = downloadUrl;
      imgElement.style.width = '200px';
      imgElement.style.height = 'auto';
      imgElement.style.display = 'block';
      imgElement.style.margin = '10px auto';
      imgElement.alt = 'Uploaded test image';
      
      // Find the success message div and append the image
      const successDiv = document.querySelector('.bg-green-100');
      if (successDiv) {
        successDiv.appendChild(imgElement);
      }
    } catch (error: any) {
      console.error('Test upload failed:', error);
      setErrorMessage(`Test upload failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Replace the onSubmitProfile and onSubmitPortfolioItem functions to use direct upload
  const onSubmitProfile: SubmitHandler<ProfileFormValues> = async (data) => {
    if (!user) return;
    
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      // Process skills
      const skillsArray = data.skills 
        ? data.skills.split(',').map(skill => skill.trim()).filter(skill => skill !== '')
        : [];
      
      // Handle profile photo upload
      let photoURL = user.photoURL || '';
      if (selectedImage) {
        try {
          console.log('Uploading profile image directly...');
          photoURL = await uploadAndReplaceImage(user.uid, selectedImage, 'profile-images', 'profile');
          // Update auth profile
          await updateUserProfile(photoURL);
        } catch (error: any) {
          console.error('Profile image upload failed:', error);
          setErrorMessage(`Profile image upload failed: ${error.message}`);
          setIsSubmitting(false);
          return;
        }
      }
      
      // Handle banner upload
      let bannerURL = userProfile.bannerImage || '';
      if (selectedBanner) {
        try {
          console.log('Uploading banner directly...');
          setBannerUploadProgress(10);
          bannerURL = await uploadAndReplaceImage(user.uid, selectedBanner, 'banner-images', 'banner');
          setBannerUploadProgress(100);
          console.log('Banner upload success:', bannerURL);
        } catch (error: any) {
          console.error('Banner upload failed:', error);
          setErrorMessage(`Banner upload failed: ${error.message}`);
          setBannerUploadProgress(0);
          setIsSubmitting(false);
          return;
        }
      }
      
      // Update Firestore
      try {
        console.log('Updating profile in Firestore...');
        
        // Save to profile document
        const profileRef = doc(db, 'profiles', user.uid);
        const profileSnapshot = await getDoc(profileRef);
        
        if (profileSnapshot.exists()) {
          // Update existing profile
          await updateDoc(profileRef, {
            bio: data.bio || '',
            location: data.location || '',
            skills: skillsArray,
            bannerImage: bannerURL || profileSnapshot.data().bannerImage || '',
            updatedAt: serverTimestamp()
          });
        } else {
          // Create new profile
          await setDoc(profileRef, {
            userId: user.uid,
            bio: data.bio || '',
            location: data.location || '',
            skills: skillsArray,
            portfolio: [],
            bannerImage: bannerURL || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
        
        // Update user document
        await updateDoc(doc(db, 'users', user.uid), {
          displayName: data.name,
          photoURL,
          updatedAt: serverTimestamp()
        });
        
        // Update local state
        setUserProfile({
          ...userProfile,
          bio: data.bio || '',
          location: data.location || '',
          skills: skillsArray,
          bannerImage: bannerURL || userProfile.bannerImage || '',
        });
        
        // Update banner preview
        if (bannerURL) {
          setBannerPreview(bannerURL);
        }
        
        // Reset upload states
        setSelectedImage(null);
        setSelectedBanner(null);
        
        setSuccessMessage('Profile updated successfully!');
      } catch (error: any) {
        console.error('Firestore update failed:', error);
        setErrorMessage(`Failed to save profile: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Profile update failed:', error);
      setErrorMessage(`Update failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
      setBannerUploadProgress(0);
    }
  };
  
  const onSubmitPortfolioItem: SubmitHandler<PortfolioItemFormValues> = async (data) => {
    if (!user) return;
    
    setIsUploadingProjectImage(true);
    setErrorMessage('');
    setUploadProgress(10);
    
    try {
      // Generate ID for new items
      const itemId = editingPortfolioId || `port-${uuidv4()}`;
      
      // Default image URL (if no new image)
      let imageUrl = 'https://placehold.co/600x400/indigo/white?text=Project';
      
      // If editing, use existing image unless a new one is selected
      if (editingPortfolioId && !selectedProjectImage) {
        const existingItem = portfolioItems.find(item => item.id === editingPortfolioId);
        if (existingItem) {
          imageUrl = existingItem.imageUrl;
        }
      }
      
      // Upload new image if selected
      if (selectedProjectImage) {
        try {
          console.log('Uploading portfolio image directly...');
          
          // Direct upload
          const storage = getStorage(app);
          const imageRef = storageRef(storage, `portfolio-images/${user.uid}/${itemId}/${Date.now()}.jpg`);
          
          setUploadProgress(30);
          const uploadResult = await uploadBytes(imageRef, selectedProjectImage, {
            contentType: selectedProjectImage.type
          });
          
          setUploadProgress(80);
          imageUrl = await getDownloadURL(uploadResult.ref);
          setUploadProgress(100);
          
          console.log('Portfolio image upload success:', imageUrl);
        } catch (error: any) {
          console.error('Portfolio image upload failed:', error);
          setErrorMessage(`Image upload failed: ${error.message}`);
          setIsUploadingProjectImage(false);
          setUploadProgress(0);
          return;
        }
      }
      
      // Create portfolio item
      const portfolioItem = {
        id: itemId,
        title: data.title,
        description: data.description,
        imageUrl,
      };
      
      // Update items array
      let updatedItems: PortfolioItem[];
      if (editingPortfolioId) {
        updatedItems = portfolioItems.map(item => 
          item.id === editingPortfolioId ? portfolioItem : item
        );
      } else {
        updatedItems = [...portfolioItems, portfolioItem];
      }
      
      // Save to Firestore
      try {
        console.log('Saving portfolio to Firestore...');
        
        const profileRef = doc(db, 'profiles', user.uid);
        const profileSnapshot = await getDoc(profileRef);
        
        if (profileSnapshot.exists()) {
          // Update existing profile
          await updateDoc(profileRef, {
            portfolio: updatedItems,
            updatedAt: serverTimestamp()
          });
        } else {
          // Create new profile with portfolio
          await setDoc(profileRef, {
            userId: user.uid,
            bio: '',
            location: '',
            skills: [],
            portfolio: updatedItems,
            bannerImage: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
        
        // Update local state
        setPortfolioItems(updatedItems);
        
        // Reset states
        resetPortfolioForm();
        setShowPortfolioForm(false);
        setEditingPortfolioId(null);
        setSelectedProjectImage(null);
        setProjectImagePreview(undefined);
        
        setSuccessMessage('Portfolio updated successfully!');
      } catch (error: any) {
        console.error('Firestore update failed:', error);
        setErrorMessage(`Failed to save portfolio: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Portfolio submission failed:', error);
      setErrorMessage(`Update failed: ${error.message}`);
    } finally {
      setIsUploadingProjectImage(false);
      setTimeout(() => setUploadProgress(0), 1500);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Profile image change triggered');
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      console.log('Selected profile image:', file.name, file.size);
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };
  
  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Banner image change triggered');
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      console.log('Selected banner image:', file.name, file.size);
      setRawBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
      setShowBannerCrop(true);
    }
  };

  const handleEditPortfolioItem = (id: string) => {
    const item = portfolioItems.find((item) => item.id === id);
    if (item) {
      resetPortfolioForm({
        title: item.title,
        description: item.description,
      });
      setEditingPortfolioId(id);
      setShowPortfolioForm(true);
      setProjectImagePreview(item.imageUrl);
    }
  };

  const handleProjectImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(''); // Clear any previous errors
    if (e.target.files && e.target.files[0]) {
      let file = e.target.files[0];
      let isHeic = file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic' || file.type === 'image/heif';
      if (isHeic) {
        try {
          const convertedBlob = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.92,
          });
          const jpegBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          file = new File([jpegBlob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
        } catch (err) {
          setErrorMessage('Failed to convert HEIC image. Please try a different image.');
          return;
        }
      }
      // Validate file type (after conversion)
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setErrorMessage('Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.');
        return;
      }
      // Validate file size (max 20MB)
      const maxSizeInBytes = 20 * 1024 * 1024; // 20MB
      if (file.size > maxSizeInBytes) {
        setErrorMessage(`File size exceeds 20MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        return;
      }
      // Create a preview URL and set the selected image
      try {
        const previewUrl = URL.createObjectURL(file);
        setSelectedProjectImage(file);
        setProjectImagePreview(previewUrl);
        if (errorMessage) {
          setErrorMessage('');
        }
      } catch (error) {
        console.error('Error creating preview URL:', error);
        setErrorMessage('Error creating image preview. Please try a different image.');
      }
    }
  };

  const handleDeletePortfolioItem = async (id: string) => {
    if (!user) return;
    
    if (confirm('Are you sure you want to delete this portfolio item?')) {
      try {
        const updatedItems = portfolioItems.filter((item) => item.id !== id);
        setPortfolioItems(updatedItems);
        
        // Update in Firestore
        const profileDocRef = doc(db, 'profiles', user.uid);
        await updateDoc(profileDocRef, {
          portfolio: updatedItems,
          updatedAt: serverTimestamp()
        });
        
        setSuccessMessage('Portfolio item deleted successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (error) {
        console.error('Error deleting portfolio item:', error);
        setErrorMessage('Failed to delete portfolio item. Please try again.');
      }
    }
  };

  // Helper to get cropped image
  async function getCroppedImg(
    imageSrc: string,
    croppedAreaPixels: { x: number; y: number; width: number; height: number; }
  ): Promise<Blob | null> {
    try {
      console.log('Starting image cropping');
      console.log('Crop area:', croppedAreaPixels);
      
      const OUTPUT_WIDTH = 1920;
      const aspectRatio = croppedAreaPixels.height / croppedAreaPixels.width;
      const OUTPUT_HEIGHT = Math.round(OUTPUT_WIDTH * aspectRatio);
      
      console.log(`Output dimensions: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}`);
      
      // Create an image object
      const createImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image();
        img.addEventListener('load', () => resolve(img));
        img.addEventListener('error', (err) => reject(err));
        img.setAttribute('crossOrigin', 'anonymous');
        img.src = url;
      });
      
      console.log('Loading source image');
      const image = await createImage(imageSrc);
      console.log('Image loaded, dimensions:', image.width, image.height);
      
      // Create a canvas to draw the cropped image
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }
      
      // Draw the cropped image
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        OUTPUT_WIDTH,
        OUTPUT_HEIGHT
      );
      
      console.log('Image drawn on canvas');
      
      // Convert canvas to blob
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => {
          console.log('Canvas converted to blob:', blob ? `${Math.round(blob.size / 1024)}KB` : 'null');
          resolve(blob);
        }, 'image/jpeg', 0.95);
      });
    } catch (error) {
      console.error('Error in getCroppedImg:', error);
      return null;
    }
  }

  const onBannerCropComplete = (
    croppedArea: any,
    croppedAreaPixels: { x: number; y: number; width: number; height: number; }
  ) => {
    setBannerCroppedAreaPixels(croppedAreaPixels);
  };

  const handleBannerCropSave = async () => {
    if (!bannerPreview || !bannerCroppedAreaPixels || !rawBannerFile) {
      console.error('Missing data for crop:', {
        bannerPreview: !!bannerPreview,
        croppedAreaPixels: !!bannerCroppedAreaPixels,
        rawBannerFile: !!rawBannerFile
      });
      return;
    }
    
    console.log('Saving cropped banner');
    try {
      const croppedBlob = await getCroppedImg(bannerPreview, bannerCroppedAreaPixels);
      console.log('Got cropped blob:', !!croppedBlob);
      
      if (!croppedBlob) {
        console.error('Failed to get cropped image');
        return;
      }
      
      const croppedFile = new File([croppedBlob as Blob], rawBannerFile.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
      console.log('Created file from blob:', croppedFile.name, croppedFile.size);
      
      setSelectedBanner(croppedFile);
      setBannerPreview(URL.createObjectURL(croppedFile));
      setShowBannerCrop(false);
      
      console.log('Banner crop completed successfully');
    } catch (error) {
      console.error('Error saving cropped banner:', error);
      alert('There was an error processing the image. Please try again with a different image.');
    }
  };

  const handleBannerCropCancel = () => {
    setShowBannerCrop(false);
    setRawBannerFile(null);
    setBannerPreview(userProfile.bannerImage || null);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Profile</h1>
        <p className="text-gray-600 mt-1">
          Update your profile information and manage your portfolio
        </p>
      </div>

      {successMessage && (
        <div className="mb-6 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {errorMessage}
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Basic Information</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmitProfile)} className="p-6 space-y-6">
          {/* Profile Picture */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profile Picture
            </label>
            <div className="flex items-center">
              <div className="relative h-24 w-24 rounded-full overflow-hidden bg-gray-100">
                <Image
                  src={imagePreview || user?.photoURL || '/placeholder-avatar.png'}
                  alt="Profile picture"
                  fill
                  className="object-cover"
                  unoptimized={true}
                />
              </div>
              <div className="ml-5">
                <input
                  id="profile-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
                <label 
                  htmlFor="profile-image-upload" 
                  className="cursor-pointer inline-block bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Change
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  JPG, PNG, or GIF. Max 5MB.
                </p>
              </div>
            </div>
          </div>
          
          {/* Banner Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profile Banner
            </label>
            <div className="mt-2 mb-4">
              <div className="relative h-36 w-full overflow-hidden rounded-lg border border-gray-300 bg-gray-100">
                {bannerPreview ? (
                  <Image
                    src={bannerPreview}
                    alt="Banner preview"
                    fill
                    className="object-contain"
                    unoptimized={true}
                  />
                ) : userProfile.bannerImage ? (
                  <Image
                    src={userProfile.bannerImage}
                    alt="Banner preview"
                    fill
                    className="object-contain"
                    unoptimized={true}
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">Default Banner</span>
                  </div>
                )}
              </div>
              <div className="mt-3">
                <input
                  id="banner-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleBannerChange}
                  style={{ display: 'none' }}
                />
                <label 
                  htmlFor="banner-image-upload" 
                  className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Change Banner
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Recommended size: 1920 x 400 pixels. JPG, PNG, or GIF. Max 10MB.
                </p>
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <div className="flex items-center gap-2">
              <input
                id="name"
                type="text"
                {...register('name')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {/* Show verified checkmark for all users for now */}
              <span title="Verified" className="inline-flex items-center text-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="10" fill="#3b82f6"/>
                  <path d="M7.5 10.5l2 2 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </span>
            </div>
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Email (read-only) */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={user?.email || ''}
              readOnly
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">
              Your email address cannot be changed
            </p>
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
              Bio
            </label>
            <textarea
              id="bio"
              rows={4}
              {...register('bio')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Tell others about yourself and your skills"
            ></textarea>
            {errors.bio && (
              <p className="mt-1 text-sm text-red-600">{errors.bio.message}</p>
            )}
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              id="location"
              type="text"
              {...register('location')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="City, Country"
            />
            {errors.location && (
              <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
            )}
          </div>

          {/* Skills */}
          <div>
            <label htmlFor="skills" className="block text-sm font-medium text-gray-700 mb-1">
              Skills
            </label>
            <input
              id="skills"
              type="text"
              {...register('skills')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="React, JavaScript, Node.js, Design (comma separated)"
            />
            {errors.skills && (
              <p className="mt-1 text-sm text-red-600">{errors.skills.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Add your skills separated by commas
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Portfolio Section */}
      <div className="mt-8 bg-white shadow-sm rounded-lg border overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Portfolio</h2>
          {!showPortfolioForm && (
            <button
              type="button"
              onClick={() => setShowPortfolioForm(true)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Add Project
            </button>
          )}
        </div>

        <div className="p-6">
          {/* Portfolio Form */}
          {showPortfolioForm && (
            <div className="mb-6 p-4 border rounded-md bg-gray-50">
              <h3 className="text-md font-medium mb-3">
                {editingPortfolioId ? 'Edit Project' : 'Add New Project'}
              </h3>
              <form onSubmit={handleSubmitPortfolio(onSubmitPortfolioItem)} className="space-y-4">
                <div>
                  <label htmlFor="portfolio-title" className="block text-sm font-medium text-gray-700 mb-1">
                    Project Title
                  </label>
                  <input
                    id="portfolio-title"
                    type="text"
                    {...registerPortfolio('title')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {portfolioErrors.title && (
                    <p className="mt-1 text-sm text-red-600">{portfolioErrors.title.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="portfolio-description" className="block text-sm font-medium text-gray-700 mb-1">
                    Project Description
                  </label>
                  <textarea
                    id="portfolio-description"
                    rows={3}
                    {...registerPortfolio('description')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  ></textarea>
                  {portfolioErrors.description && (
                    <p className="mt-1 text-sm text-red-600">{portfolioErrors.description.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Image
                  </label>
                  <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-white">
                    <div className="space-y-1 text-center">
                      {projectImagePreview ? (
                        <div className="relative h-36 w-full max-w-sm mx-auto overflow-hidden rounded-md mb-3">
                          <Image
                            src={projectImagePreview || '/placeholder-image.png'}
                            alt="Project image preview"
                            width={300}
                            height={200}
                            className="object-cover"
                            unoptimized={true}
                          />
                          {isUploadingProjectImage && (
                            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                              <div className="flex flex-col items-center">
                                <div className="w-full max-w-[80%] bg-gray-200 rounded-full h-2.5 mb-2">
                                  <div 
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                                    style={{ width: `${uploadProgress}%` }}
                                  ></div>
                                </div>
                                <span className="text-white text-sm">
                                  {uploadProgress < 100 ? `Uploading: ${uploadProgress.toFixed(0)}%` : 'Processing...'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 48 48"
                          aria-hidden="true"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                      <div className="flex justify-center">
                        <input
                          id="project-image-upload"
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp,.heic"
                          onChange={handleProjectImageChange}
                          disabled={isUploadingProjectImage}
                          style={{ display: 'none' }}
                        />
                        <label 
                          htmlFor="project-image-upload" 
                          className={`cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 ${isUploadingProjectImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {projectImagePreview ? 'Change Image' : 'Upload Image'}
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        JPG, PNG, or GIF. Max 20MB.<br />
                        <span className="text-indigo-600">To upload .heic images, select 'All Files' in the file picker or drag-and-drop your image here.</span>
                      </p>
                      {selectedProjectImage && (
                        <p className="text-xs text-green-600 mt-1">
                          Selected: {selectedProjectImage.name} ({(selectedProjectImage.size / 1024).toFixed(2)} KB)
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    disabled={isUploadingProjectImage}
                    onClick={() => {
                      setShowPortfolioForm(false);
                      setEditingPortfolioId(null);
                      resetPortfolioForm();
                      setSelectedProjectImage(null);
                      setProjectImagePreview(undefined);
                    }}
                    className={`inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isUploadingProjectImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploadingProjectImage}
                    className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isUploadingProjectImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isUploadingProjectImage ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      editingPortfolioId ? 'Update Project' : 'Add Project'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Portfolio Items */}
          {portfolioItems.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500">
                You haven't added any portfolio items yet. Showcase your work to attract more service swaps!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {portfolioItems.map((item) => (
                <div key={item.id} className="border rounded-md overflow-hidden">
                  <div className="h-48 bg-gray-200 relative">
                    <Image
                      src={item.imageUrl || '/placeholder-image.png'}
                      alt={item.title}
                      fill
                      className="object-cover"
                      unoptimized={true}
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-lg">{item.title}</h3>
                    <p className="text-gray-600 text-sm mt-1">{item.description}</p>
                    <div className="flex justify-end space-x-2 mt-3">
                      <button
                        onClick={() => handleEditPortfolioItem(item.id)}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePortfolioItem(item.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showBannerCrop}
        onRequestClose={handleBannerCropCancel}
        contentLabel="Crop Banner"
        ariaHideApp={false}
        style={{ 
          overlay: { 
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 1000 
          },
          content: { 
            maxWidth: '800px', 
            margin: 'auto', 
            height: '500px',
            inset: '50px',
            borderRadius: '8px'
          } 
        }}
      >
        <h3 className="text-lg font-medium text-gray-900 mb-4">Crop Banner Image</h3>
        <div style={{ position: 'relative', width: '100%', height: 400, background: '#333' }}>
          <Cropper
            image={bannerPreview || '/placeholder-image.png'}
            crop={bannerCrop}
            zoom={bannerZoom}
            aspect={1920 / 400}
            onCropChange={setBannerCrop}
            onZoomChange={setBannerZoom}
            onCropComplete={onBannerCropComplete}
            cropShape="rect"
            showGrid={true}
          />
        </div>
        <div className="flex justify-end gap-4 mt-4">
          <button 
            onClick={handleBannerCropCancel} 
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleBannerCropSave} 
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
          >
            Save Crop
          </button>
        </div>
      </Modal>
    </div>
  );
} 