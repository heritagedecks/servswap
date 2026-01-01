'use client';

import { useState, useEffect, useRef, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/app/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, Firestore, Timestamp, orderBy, addDoc, serverTimestamp, deleteDoc, doc as firestoreDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, listAll, getDownloadURL, ref as storageRef, uploadBytes, deleteObject } from 'firebase/storage';
import { app } from '@/app/lib/firebase';
import Footer from '@/app/components/Footer';
import Header from '@/app/components/Header';
import { BadgeCheck, ThumbsUp, Smile, Trash2, Users as LucideUsers, UserPlus, Mail, UserCheck, Repeat, Pencil, Check, X, Clock, Star, CheckCircle } from "lucide-react";
import { Image as LucideImage, Plus, ArrowDown, ArrowUp } from "lucide-react";
import { createNotification, createMentionNotifications } from '@/app/lib/notifications';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import MentionInput, { extractMentions, formatDisplayText } from '@/app/components/MentionInput';
import { getAllUserSubscriptions } from '@/app/lib/subscriptions';
import { isSubscriptionActive, SubscriptionData } from '@/app/lib/stripe';
import { getUserVerificationBadge } from '@/app/lib/subscriptions';
import ProfileAvatar from '@/app/components/ProfileAvatar';

interface UserService {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  createdAt: Date;
  images: string[];
  servicesWanted?: string[];
}

interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
}

interface ProfileData {
  userId?: string;
  bio?: string;
  location?: string;
  skills?: string[];
  portfolio?: PortfolioItem[];
  bannerImage?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  bio?: string;
  location?: string;
  bannerImage?: string;
  joinedDate: Date;
  skills?: string[];
  portfolio?: PortfolioItem[];
}

interface UserData {
  displayName?: string;
  photoURL?: string;
  email?: string;
}

interface PostData {
  userId: string;
  content: string;
  createdAt: any;
  imageUrl?: string;
  linkPreview?: any;
}

interface Endorsement {
  id: string;
  fromUserId: string;
  fromUserName: string;
  swapId: string;
  swapTitle: string;
  review: string;
  rating: number;
  createdAt: Date;
  fromUserPhoto?: string;
}

interface CompletedSwap {
  id: string;
  title: string;
  completedAt: Date;
}

interface Post {
  id: string;
  userId: string;
  content: string;
  createdAt: any;
  displayName: string;
  photoURL: string;
  likes: string[];
  emoji: { [key: string]: string[] };
  comments: Comment[];
}

interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: any;
  displayName: string;
  photoURL: string;
  likes: string[];
  emoji: { [key: string]: string[] };
  replies: Reply[];
}

interface Reply {
  id: string;
  userId: string;
  text: string;
  createdAt: any;
  displayName: string;
  photoURL: string;
  likes?: string[];
  emoji?: { [key: string]: string[] };
}

interface Swap {
  id: string;
  title: string;
  participants: string[];
  completedAt: Date;
}

// Helper to upload and replace all previous images in a folder
async function uploadAndReplaceImage(userId: string, file: File, folder: string, prefix: string): Promise<string> {
  const storage = getStorage(app);
  const fileName = `${prefix}-${Date.now()}.jpg`;
  const imageRef = storageRef(storage, `${folder}/${userId}/${fileName}`);

  // Upload new image
  await uploadBytes(imageRef, file, { contentType: file.type });
  const imageURL = await getDownloadURL(imageRef);

  // List all images in the user's folder
  const folderRef = storageRef(storage, `${folder}/${userId}`);
  const allImages = await listAll(folderRef);

  // Delete all images except the newly uploaded one
  await Promise.all(
    allImages.items
      .filter(item => item.name !== fileName)
      .map(item => deleteObject(item).catch(() => {}))
  );

  return imageURL;
}

// Reusable badge component
const VerificationBadge = memo(function VerificationBadge({ userId, className = '' }: { userId: string, className?: string }) {
  const [active, setActive] = useState<boolean>(false);
  useEffect(() => {
    let mounted = true;
    async function fetchBadge() {
      if (!userId) return;
      try {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        const badge = userDocSnap.exists() ? userDocSnap.data().verificationBadge : null;
        if (mounted) setActive(!!(badge && badge.active));
      } catch (err) {
        if (mounted) setActive(false);
      }
    }
    fetchBadge();
    return () => { mounted = false; };
  }, [userId]);
  if (!active) return null;
  return <span aria-label="Verified" title="Verified"><CheckCircle className={`inline ml-1 text-blue-500 ${className}`} /></span>;
});

export default function UserProfilePage() {
  const params = useParams();
  const userId = params?.userId ? String(params.userId) : '';
  const router = useRouter();
  const { user, updateUserProfile } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userServices, setUserServices] = useState<UserService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [profileImage, setProfileImage] = useState<string>("");
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
  const [newPostImagePreview, setNewPostImagePreview] = useState<string | null>(null);
  const [newPostLinkPreview, setNewPostLinkPreview] = useState<any>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isOwnProfile = user && user.uid === userId;
  const [maximizedImage, setMaximizedImage] = useState<string | null>(null);
  const [feedPage, setFeedPage] = useState(0);
  const POSTS_PER_PAGE = 3;
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const [postInteractions, setPostInteractions] = useState<{ [postId: string]: any }>({});
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState<{ [postId: string]: boolean }>({});
  const emojiList = ["👍", "🔥", "😂", "😍", "🎉", "😮", "😢", "👏", "💯"];
  const [commentInteractions, setCommentInteractions] = useState<{ [commentId: string]: any }>({});
  const [replyInputs, setReplyInputs] = useState<{ [commentId: string]: string }>({});
  const [showReplyBox, setShowReplyBox] = useState<{ [commentId: string]: boolean }>({});
  const [showCommentEmojiPicker, setShowCommentEmojiPicker] = useState<{ [commentId: string]: boolean }>({});
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState<{ [replyId: string]: boolean }>({});
  const [showAllComments, setShowAllComments] = useState<{ [postId: string]: boolean }>({});
  const [showComments, setShowComments] = useState<{ [postId: string]: boolean }>({});
  const [showEndorseModal, setShowEndorseModal] = useState(false);
  const [completedSwaps, setCompletedSwaps] = useState<CompletedSwap[]>([]);
  const [selectedSwap, setSelectedSwap] = useState<string>('');
  const [endorsementReview, setEndorsementReview] = useState('');
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [isEndorsing, setIsEndorsing] = useState(false);
  const [endorsementRating, setEndorsementRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const reviewsPerPage = 3;
  const searchParams = useSearchParams();
  const postId = searchParams?.get('postId');
  const [connectionsCount, setConnectionsCount] = useState<number>(0);
  const [totalSwapsCount, setTotalSwapsCount] = useState<number>(0);
  const [connectionsModalOpen, setConnectionsModalOpen] = useState(false);
  const [profileConnections, setProfileConnections] = useState<any[]>([]);
  const [viewerConnections, setViewerConnections] = useState<any[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [mutualConnections, setMutualConnections] = useState<string[]>([]);
  const [connectionsUserInfo, setConnectionsUserInfo] = useState<{[uid: string]: any}>({});
  const [connectionsTab, setConnectionsTab] = useState<'all' | 'mutual'>('all');
  const endorsementsSectionRef = useRef<HTMLDivElement>(null);
  // Add state for selectedService at the top with other useState hooks
  const [selectedService, setSelectedService] = useState<UserService | null>(null);
  // Add a ref for the listings row
  const listingsRowRef = useRef<HTMLDivElement>(null);
  // Add a ref for the endorsements carousel
  const endorsementsRowRef = useRef<HTMLDivElement>(null);
  // Add edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editBanner, setEditBanner] = useState<File | null>(null);
  const [editBannerPreview, setEditBannerPreview] = useState<string | null>(null);
  // Add new state for section edit modes
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [editingBanner, setEditingBanner] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  // Add new state for editing name/location
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(userProfile?.displayName || '');
  const [editLocationValue, setEditLocationValue] = useState(userProfile?.location || '');
  const [connectionStatus, setConnectionStatus] = useState<'pending' | 'connected' | 'none' | 'incoming'>('none');
  const [connectionRequestPopupOpen, setConnectionRequestPopupOpen] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [hasVerificationSubscription, setHasVerificationSubscription] = useState(false);
  const [hasVerificationBadge, setHasVerificationBadge] = useState(false);

  const profileSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    bio: z.string().max(500, 'Bio cannot exceed 500 characters').optional().nullable(),
    location: z.string().max(100, 'Location cannot exceed 100 characters').optional().nullable(),
    skills: z.string().max(200, 'Skills cannot exceed 200 characters').optional().nullable(),
  });

  const { register: editRegister, handleSubmit: handleEditSubmit, formState: { errors: editErrors }, setValue: setEditValue, reset: resetEditForm } = useForm({
    resolver: zodResolver(profileSchema) as any,
    defaultValues: {
      name: userProfile?.displayName || '',
      bio: userProfile?.bio || '',
      location: userProfile?.location || '',
      skills: userProfile?.skills?.join(', ') || '',
    },
  });

  useEffect(() => {
    if (editMode && userProfile) {
      setEditValue('name', userProfile.displayName || '');
      setEditValue('bio', userProfile.bio || '');
      setEditValue('location', userProfile.location || '');
      setEditValue('skills', userProfile.skills?.join(', ') || '');
      setEditImagePreview(userProfile.photoURL || '');
      setEditBannerPreview(userProfile.bannerImage || '');
    }
  }, [editMode, userProfile, setEditValue]);

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditImage(file);
      setEditImagePreview(URL.createObjectURL(file));
    }
  };
  const handleEditBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditBanner(file);
      setEditBannerPreview(URL.createObjectURL(file));
    }
  };

  const onSubmitEditProfile = async (data: any) => {
    setEditSubmitting(true);
    setEditError('');
    setEditSuccess('');
    try {
      console.log('Updating profile with data:', data);
      
      // Prepare skills array
      const skillsArray = data.skills
        ? (typeof data.skills === 'string' 
        ? data.skills.split(',').map((s: string) => s.trim()).filter((s: string) => s)
           : data.skills)
        : [];
        
      // Handle image uploads (profile & banner)
      let photoURL = userProfile?.photoURL || '';
      let bannerURL = userProfile?.bannerImage || '';
      
      if (editImage) {
        console.log('Uploading profile image');
        photoURL = await uploadAndReplaceImage(userId, editImage, 'profile-images', 'profile');
        
        // Update Firebase Auth profile with new photoURL
        if (user && user.uid === userId) {
          try {
            await updateUserProfile(photoURL);
          } catch (err) {
            console.error('Failed to update Auth profile:', err);
            // Continue with the rest of the function even if this fails
          }
        }
      }
      
      if (editBanner) {
        console.log('Uploading banner image');
        bannerURL = await uploadAndReplaceImage(userId, editBanner, 'banner-images', 'banner');
      }
      
      // Ensure we're only updating fields that were actually edited
      const profileUpdates: any = {
        updatedAt: serverTimestamp(),
      };
      
      // Add conditional fields to the update
      if ('bio' in data) profileUpdates.bio = data.bio || '';
      if ('location' in data) profileUpdates.location = data.location || '';
      if ('skills' in data) profileUpdates.skills = skillsArray;
      if (editBanner || data.bannerImage) profileUpdates.bannerImage = bannerURL;
      
      console.log('Updating profile with:', profileUpdates);
      
      // Update Firestore profile document
      const profileRef = doc(db, 'profiles', userId);
      
      try {
        await getDoc(profileRef);
        await updateDoc(profileRef, profileUpdates);
      } catch (error) {
        // If document doesn't exist, create it
        console.log('Profile document may not exist, creating it');
        await setDoc(profileRef, {
          ...profileUpdates,
          userId,
          createdAt: serverTimestamp(),
        });
      }
      
      // Update user document if name or photo changed
      const userUpdates: any = {
        updatedAt: serverTimestamp(),
      };
      
      if ('displayName' in data || 'name' in data) {
        userUpdates.displayName = data.displayName || data.name || userProfile?.displayName;
        
        // Update Firebase Auth display name if the current user is editing their own profile
        if (user && user.uid === userId && ('displayName' in data || 'name' in data)) {
          try {
            const newDisplayName = data.displayName || data.name || userProfile?.displayName;
            await updateUserProfile(photoURL, newDisplayName);
          } catch (err) {
            console.error('Failed to update Auth display name:', err);
            // Continue with the rest of the function even if this fails
          }
        }
      }
      
      if (editImage || data.photoURL) {
        userUpdates.photoURL = photoURL;
      }
      
      // Only update user doc if we have fields to update
      if (Object.keys(userUpdates).length > 1) {
        console.log('Updating user document with:', userUpdates);
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, userUpdates);
      }
      
      // Update local state to reflect changes immediately
      if (userProfile) {
        const updatedProfile = {
          ...userProfile,
          displayName: data.displayName || data.name || userProfile.displayName,
          bio: 'bio' in data ? data.bio || 'No bio available' : userProfile.bio,
          location: 'location' in data ? data.location || 'Location not specified' : userProfile.location,
          skills: 'skills' in data ? skillsArray : userProfile.skills,
          photoURL: editImage ? photoURL : userProfile.photoURL,
          bannerImage: editBanner ? bannerURL : userProfile.bannerImage,
        };
        
        setUserProfile(updatedProfile);
        
        // If we updated the banner image, make sure it's displayed
        if (editBanner) {
          setEditBannerPreview(null);
          setEditBanner(null);
        }
        
        // If we updated the profile image, make sure it's displayed
        if (editImage) {
          setEditImagePreview(null);
          setEditImage(null);
        }
      }
      
      setEditSuccess('Profile updated successfully!');
      
      // Close edit mode if we're editing from the main form
      if (data.name) {
      setEditMode(false);
      }
      
      // Reset specific edit states
      setEditingAbout(false);
      setEditingName(false);
      setEditingAvatar(false);
      setEditingBanner(false);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setEditError(err.message || 'Failed to update profile');
    } finally {
      setEditSubmitting(false);
    }
  };

  const scrollListings = (direction: 'left' | 'right') => {
    if (!listingsRowRef.current) return;
    const scrollAmount = 340; // width of one card + gap
    listingsRowRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const scrollEndorsements = (direction: 'left' | 'right') => {
    if (!endorsementsRowRef.current) return;
    const scrollAmount = 380; // width of one card + gap
    endorsementsRowRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    console.log(`Scrolling endorsements ${direction}`); // Add logging for debugging
  };

  // Add this check function near the other state declarations
  const hasEndorsedSwap = (swapId: string) => {
    return endorsements.some(e => e.swapId === swapId);
  };

  useEffect(() => {
    if (!user) return; // Only fetch if logged in
    const fetchUserData = async () => {
      setLoading(true);
      
      try {
        const userDocRef = doc(db as Firestore, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          
          setUserInfo(userData);
          console.log('User data fetched:', userData);
          
          // Enhanced profile image handling logic
          if (userData.photoURL) {
            console.log('Using photoURL from user data:', userData.photoURL);
            setProfileImage(userData.photoURL);
          } else {
            // If no photoURL in user data, look in profile-images directory
            try {
              console.log('No photoURL found, trying Firebase Storage');
              const storage = getStorage(app);
              
              // This matches the exact path structure used in the dashboard profile page
              // The userId is the target user's ID from the URL parameter
              const profileImagesPath = `profile-images/${userId}`;
              console.log('Looking for profile images at path:', profileImagesPath);
              const profileImagesRef = ref(storage, profileImagesPath);
              
              // List all profile images for this user
              listAll(profileImagesRef)
                .then((result) => {
                  console.log(`Found ${result.items.length} profile images for user ${userId}`);
                  
                  if (result.items.length > 0) {
                    // Sort items by name to get the most recent one (matching the "profile-${Date.now()}.jpg" pattern)
                    const sortedItems = [...result.items].sort((a, b) => {
                      // Extract timestamp from filename if possible
                      const getTimestamp = (name: string) => {
                        const match = name.match(/profile-(\d+)/);
                        return match ? parseInt(match[1]) : 0;
                      };
                      
                      const timeA = getTimestamp(a.name);
                      const timeB = getTimestamp(b.name);
                      
                      return timeB - timeA; // Sort descending (newest first)
                    });
                    
                    // Get URL of the most recent item
                    console.log('Getting URL for most recent profile image:', sortedItems[0].name);
                    return getDownloadURL(sortedItems[0]);
                  } else {
                    throw new Error('No profile images found');
                  }
                })
                .then((url) => {
                  console.log('Retrieved profile image URL:', url);
                  setProfileImage(url);
                })
                .catch((err) => {
                  console.warn('Could not find profile image in expected location:', err);
                  
                  // If we couldn't find images in the exact folder, try the broader approach
                  const rootProfileImagesRef = ref(storage, 'profile-images');
                  
                  listAll(rootProfileImagesRef)
                    .then((result) => {
                      console.log('Looking through all profile image folders:', result.prefixes.length);
                      
                      // First try exact match on userId
                      let matchingFolder = result.prefixes.find(prefix => prefix.name === userId);
                      
                      if (!matchingFolder) {
                        console.log('No exact userId match, looking for partial matches');
                        // Then try partial matches
                        matchingFolder = result.prefixes.find(prefix => 
                          userId.includes(prefix.name) || prefix.name.includes(userId)
                        );
                      }
                      
                      if (matchingFolder) {
                        console.log('Found potential matching folder:', matchingFolder.name);
                        return listAll(matchingFolder);
                      } else {
                        // Don't throw error, just use default profile image
                        console.log('No matching profile folder found, using default image');
                        setProfileImage('');
                        return null;
                      }
                    })
                    .then((folderContents) => {
                      if (!folderContents) return; // Exit early if we already set the default image
                      
                      if (folderContents.items.length > 0) {
                        console.log(`Found ${folderContents.items.length} images in folder`);
                        
                        // Sort to get the most recent one based on the profile-${timestamp} naming
                        const sortedItems = [...folderContents.items].sort((a, b) => {
                          // Extract timestamp from filename if possible
                          const getTimestamp = (name: string) => {
                            const match = name.match(/profile-(\d+)/);
                            return match ? parseInt(match[1]) : 0;
                          };
                          
                          const timeA = getTimestamp(a.name);
                          const timeB = getTimestamp(b.name);
                          
                          return timeB - timeA; // Sort descending (newest first)
                        });
                        
                        console.log('Using most recent image:', sortedItems[0].name);
                        return getDownloadURL(sortedItems[0]);
                      } else {
                        // No images in folder, use default image
                        console.log('No images in profile folder, using default image');
                        setProfileImage('');
                        return null;
                      }
                    })
                    .then((url) => {
                      if (url) {
                        console.log('Retrieved fallback image URL:', url);
                        setProfileImage(url);
                      }
                      // If url is null, we've already set the default image
                    })
                    .catch((finalError) => {
                      console.error('All profile image retrieval methods failed:', finalError);
                      // Use first letter of name as fallback (this matches what's in the render section)
                      setProfileImage('');
                    });
                });
            } catch (error) {
              console.error('Error in profile image retrieval flow:', error);
              setProfileImage('');
            }
          }
          
          // Fetch reviews for this user
          const reviewsQuery = query(
            collection(db as Firestore, 'reviews'),
            where('reviewedUserId', '==', userId),
            orderBy('timestamp', 'desc')
          );
          
          const reviewsSnapshot = await getDocs(reviewsQuery);
          const reviewsData = reviewsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          setReviews(reviewsData);
          console.log('Reviews fetched:', reviewsData);
        } else {
          console.error('User not found');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (userId) {
      fetchUserData();
    }
  }, [userId, user]);

  useEffect(() => {
    if (!user) return; // Only fetch if logged in
    const fetchUserProfile = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch basic user account data
        const userDocRef = doc(db as Firestore, 'users', userId as string);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
          setError("User not found");
          setIsLoading(false);
          return;
        }
        
        const userData = userDocSnap.data();
        console.log("User data fetched:", userId);
        
        // Fetch detailed profile data from the profiles collection
        const profileDocRef = doc(db as Firestore, 'profiles', userId as string);
        const profileDocSnap = await getDoc(profileDocRef);
        
        let profileData: ProfileData = {};
        if (profileDocSnap.exists()) {
          profileData = profileDocSnap.data() as ProfileData;
        }
        
        // Combine data from both collections
        setUserProfile({
          uid: userDocSnap.id,
          displayName: userData.displayName || 'Anonymous User',
          email: userData.email || '',
          photoURL: profileImage || userData.photoURL || '',
          bio: profileData.bio || 'No bio available',
          location: profileData.location || 'Location not specified',
          bannerImage: profileData.bannerImage || '',
          joinedDate: userData.createdAt ? userData.createdAt.toDate() : new Date(),
          skills: profileData.skills || [],
          portfolio: profileData.portfolio || []
        });
        
        // Fetch user's services
        const servicesQuery = query(
          collection(db as Firestore, 'services'),
          where('userId', '==', userId)
        );
        
        const servicesSnapshot = await getDocs(servicesQuery);
        const servicesData: UserService[] = [];
        
        servicesSnapshot.forEach((doc) => {
          const data = doc.data();
          servicesData.push({
            id: doc.id,
            title: data.title,
            description: data.description,
            category: data.category,
            location: data.location || 'Remote',
            createdAt: data.createdAt?.toDate() || new Date(),
            images: data.images || [],
            servicesWanted: data.servicesWanted || []
          });
        });
        
        setUserServices(servicesData);
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError('Failed to load user profile. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (userId) {
      fetchUserProfile();
    }
  }, [userId, profileImage, user]);

  // Fetch feed posts
  useEffect(() => {
    setFeedLoading(true);
    (async () => {
      try {
        const postsQuery = query(
          collection(db, 'profilePosts'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        );
        const postsSnap = await getDocs(postsQuery);
        const posts = await Promise.all(postsSnap.docs.map(async (postDoc) => {
          const postData = postDoc.data() as PostData;
          // Fetch post author data
          const userDocRef = doc(db, 'users', postData.userId);
          const userDocSnap = await getDoc(userDocRef);
          const userData = (userDocSnap.exists() ? userDocSnap.data() : {}) as UserData;
          
          // Fetch likes
          const likesSnap = await getDocs(collection(db, 'profilePosts', postDoc.id, 'likes'));
          const likes = likesSnap.docs.map(doc => doc.id);
          
          // Fetch emoji reactions
          const emojiSnap = await getDocs(collection(db, 'profilePosts', postDoc.id, 'emojiReactions'));
          const emojiData: { [emoji: string]: string[] } = {};
          emojiSnap.docs.forEach(emojiDoc => {
            const { emoji, userId } = emojiDoc.data();
            if (!emojiData[emoji]) emojiData[emoji] = [];
            emojiData[emoji].push(userId);
          });

          // Fetch comments with their likes and reactions
          const commentsQuery = query(
            collection(db, 'profilePosts', postDoc.id, 'comments'),
            orderBy('createdAt', 'asc')
          );
          const commentsSnap = await getDocs(commentsQuery);
          const comments = await Promise.all(commentsSnap.docs.map(async (commentDoc) => {
            const commentData = commentDoc.data();
            const commentUserDocRef = doc(db, 'users', commentData.userId);
            const commentUserDocSnap = await getDoc(commentUserDocRef);
            const commentUserData = (commentUserDocSnap.exists() ? commentUserDocSnap.data() : {}) as UserData;

            // Fetch comment likes
            const commentLikesSnap = await getDocs(collection(db, 'profilePosts', postDoc.id, 'comments', commentDoc.id, 'likes'));
            const commentLikes = commentLikesSnap.docs.map(doc => doc.id);

            // Fetch comment emoji reactions
            const commentEmojiSnap = await getDocs(collection(db, 'profilePosts', postDoc.id, 'comments', commentDoc.id, 'emojiReactions'));
            const commentEmojiData: { [emoji: string]: string[] } = {};
            commentEmojiSnap.docs.forEach(emojiDoc => {
              const { emoji, userId } = emojiDoc.data();
              if (!commentEmojiData[emoji]) commentEmojiData[emoji] = [];
              commentEmojiData[emoji].push(userId);
            });

            // Fetch replies
            const repliesQuery = query(
              collection(db, 'profilePosts', postDoc.id, 'comments', commentDoc.id, 'replies'),
              orderBy('createdAt', 'asc')
            );
            const repliesSnap = await getDocs(repliesQuery);
            const replies = await Promise.all(repliesSnap.docs.map(async (replyDoc) => {
              const replyData = replyDoc.data();
              const replyUserDocRef = doc(db, 'users', replyData.userId);
              const replyUserDocSnap = await getDoc(replyUserDocRef);
              const replyUserData = (replyUserDocSnap.exists() ? replyUserDocSnap.data() : {}) as UserData;
              return {
                id: replyDoc.id,
                ...replyData,
                displayName: replyUserData.displayName || 'User',
                photoURL: replyUserData.photoURL || '/default-avatar.png'
              };
            }));

            return {
              id: commentDoc.id,
              ...commentData,
              displayName: commentUserData.displayName || 'User',
              photoURL: commentUserData.photoURL || '/default-avatar.png',
              likes: commentLikes,
              emoji: commentEmojiData,
              replies
            };
          }));

          return {
            id: postDoc.id,
            ...postData,
            displayName: userData.displayName || 'User',
            photoURL: userData.photoURL || '/default-avatar.png',
            likes,
            emoji: emojiData,
            comments
          };
        }));
        
        setFeedPosts(posts);
        setFeedLoading(false);
      } catch (error) {
        console.error('Error fetching posts:', error);
        setFeedLoading(false);
      }
    })();
  }, [userId, showPostModal]);

  // Fetch likes, comments, emoji for all posts
  useEffect(() => {
    if (!feedPosts.length) return;
    const fetchInteractions = async () => {
      const interactions: { [postId: string]: any } = {};
      for (const post of feedPosts) {
        // Likes
        const likesSnap = await getDocs(collection(db, 'profilePosts', post.id, 'likes'));
        const likes = likesSnap.docs.map(doc => doc.id);
        // Emoji
        const emojiSnap = await getDocs(collection(db, 'profilePosts', post.id, 'emojiReactions'));
        const emojiData: { [emoji: string]: string[] } = {};
        emojiSnap.docs.forEach(doc => {
          const { emoji, userId } = doc.data();
          if (!emojiData[emoji]) emojiData[emoji] = [];
          emojiData[emoji].push(userId);
        });
        // Comments
        const commentsSnap = await getDocs(query(collection(db, 'profilePosts', post.id, 'comments'), orderBy('createdAt', 'asc')));
        const comments = commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        interactions[post.id] = { likes, emoji: emojiData, comments };
      }
      setPostInteractions(interactions);
    };
    fetchInteractions();
  }, [feedPosts]);

  // Fetch comment likes, emoji, replies
  useEffect(() => {
    const fetchCommentInteractions = async () => {
      // Map postId to comments for fallback
      const postIdMap: { [commentId: string]: string } = {};
      for (const post of feedPosts) {
        (postInteractions[post.id]?.comments || []).forEach((comment: any) => {
          if (!comment.postId) comment.postId = post.id;
          postIdMap[comment.id] = post.id;
        });
      }
      const allComments = feedPosts.flatMap(post => postInteractions[post.id]?.comments || []);
      const interactions: { [commentId: string]: any } = {};
      for (const comment of allComments) {
        const postId = comment.postId || postIdMap[comment.id];
        if (!postId) continue; // Defensive: skip if postId is still missing
        // Likes
        const likesSnap = await getDocs(collection(db, 'profilePosts', postId, 'comments', comment.id, 'likes'));
        const likes = likesSnap.docs.map(doc => doc.id);
        // Emoji
        const emojiSnap = await getDocs(collection(db, 'profilePosts', postId, 'comments', comment.id, 'emojiReactions'));
        const emojiData: { [emoji: string]: string[] } = {};
        emojiSnap.docs.forEach(doc => {
          const { emoji, userId } = doc.data();
          if (!emojiData[emoji]) emojiData[emoji] = [];
          emojiData[emoji].push(userId);
        });
        // Replies
        const repliesSnap = await getDocs(query(collection(db, 'profilePosts', postId, 'comments', comment.id, 'replies'), orderBy('createdAt', 'asc')));
        const replies = await Promise.all(repliesSnap.docs.map(async (replyDoc) => {
          const replyData = replyDoc.data();
          
          // Fetch reply likes
          const replyLikesSnap = await getDocs(collection(db, 'profilePosts', postId, 'comments', comment.id, 'replies', replyDoc.id, 'likes'));
          const replyLikes = replyLikesSnap.docs.map(doc => doc.id);
          
          // Fetch reply emoji reactions
          const replyEmojiSnap = await getDocs(collection(db, 'profilePosts', postId, 'comments', comment.id, 'replies', replyDoc.id, 'emojiReactions'));
          const replyEmojiData: { [emoji: string]: string[] } = {};
          replyEmojiSnap.docs.forEach(doc => {
            const { emoji, userId } = doc.data();
            if (!replyEmojiData[emoji]) replyEmojiData[emoji] = [];
            replyEmojiData[emoji].push(userId);
          });
          
          return {
            id: replyDoc.id,
            ...replyData,
            likes: replyLikes,
            emoji: replyEmojiData
          };
        }));
        
        interactions[comment.id] = { likes, emoji: emojiData, replies };
      }
      setCommentInteractions(interactions);
    };
    if (feedPosts.length && Object.keys(postInteractions).length) fetchCommentInteractions();
  }, [feedPosts, postInteractions]);

  // Helper: extract first URL from text
  function extractFirstUrl(text: string) {
    // Match http(s)://, www., or bare domains (servswap.com, sub.domain.com, etc)
    const urlRegex = /(?:https?:\/\/[^\s]+)|(?:www\.[^\s]+)|(?:[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+\.[a-zA-Z]{2,}(?:\/[^-\s]*)?)/gi;
    const match = text.match(urlRegex);
    if (!match) return null;
    let url = match[0].replace(/^[@(\[\{]+/, ''); // Remove leading @, (, [, {
    // Prepend https:// if missing
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return url;
  }

  // Helper: fetch link preview
  async function fetchLinkPreview(url: string) {
    try {
      const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
      if (!res.ok) return null;
      const { data } = await res.json();
      // Normalize to your expected structure
      return {
        title: data.title,
        description: data.description,
        image: data.image?.url,
        url: data.url
      };
    } catch {
      return null;
    }
  }

  // Watch for link in new post content
  useEffect(() => {
    const url = extractFirstUrl(newPostContent);
    if (url) {
      fetchLinkPreview(url).then(setNewPostLinkPreview);
    } else {
      setNewPostLinkPreview(null);
    }
  }, [newPostContent]);

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewPostImage(file);
      setNewPostImagePreview(URL.createObjectURL(file));
    }
  };

  // Handle new post submit (with image and link preview)
  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() && !newPostImage) return;
    setPosting(true);
    let imageUrl = '';
    if (newPostImage) {
      const storage = getStorage(app);
      const fileRef = storageRef(storage, `profilePosts/${userId}/${Date.now()}-${newPostImage.name}`);
      await uploadBytes(fileRef, newPostImage);
      imageUrl = await getDownloadURL(fileRef);
    }
    let linkPreview = null;
    if (newPostLinkPreview) {
      linkPreview = newPostLinkPreview;
    }
    
    // Create the post
    const docRef = await addDoc(collection(db, 'profilePosts'), {
      userId,
      content: newPostContent.trim(),
      createdAt: serverTimestamp(),
      authorName: user?.displayName || 'You',
      authorPhoto: user?.photoURL || '',
      imageUrl,
      linkPreview,
    });
    
    // Process mentions for notifications
    if (user) {
      await createMentionNotifications(
        newPostContent,
        docRef.id,
        user.uid,
        user.displayName || 'User',
        'post'
      );
    }
    
    setNewPostContent('');
    setNewPostImage(null);
    setNewPostImagePreview(null);
    setNewPostLinkPreview(null);
    setShowPostModal(false);
    setPosting(false);
  };

  // Function to handle initiating a swap with this user
  const handleContactUser = () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    
    // Redirect to messaging or swap initiation with this user
    router.push(`/dashboard/inbox/new?recipientId=${userId}`);
  };

  // Function to handle sending a connection request
  const handleConnect = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    
    try {
      // If there's an incoming request, accept it
      if (connectionStatus === 'incoming') {
        // Find the incoming request
        const incomingRequestQuery = query(
          collection(db, 'connectionRequests'),
          where('fromUserId', '==', userId),
          where('toUserId', '==', user.uid),
          where('status', '==', 'pending')
        );
        
        const incomingRequestSnap = await getDocs(incomingRequestQuery);
        
        if (!incomingRequestSnap.empty) {
          const request = incomingRequestSnap.docs[0];
          
          // Update the request status to accepted
          await updateDoc(doc(db, 'connectionRequests', request.id), {
            status: 'accepted'
          });
          
          // Check if a connection already exists
          const existingConnectionQuery = query(
            collection(db, 'connections'),
            where('users', 'array-contains', user.uid),
            where('status', '==', 'connected')
          );
          
          const existingConnectionSnap = await getDocs(existingConnectionQuery);
          const alreadyConnected = existingConnectionSnap.docs.some(doc => {
            const data = doc.data();
            return data.users.includes(userId);
          });
          
          // Only create a new connection if one doesn't already exist
          if (!alreadyConnected) {
            // Create a connection
            await addDoc(collection(db, 'connections'), {
              users: [user.uid, userId],
              status: 'connected',
              createdAt: serverTimestamp(),
              lastActive: serverTimestamp()
            });
          }
          
          // Create notification for accepting request
          await createNotification({
            userId: userId,
            type: 'follow',
            senderId: user.uid,
            senderName: user.displayName || 'User',
            message: `${user.displayName || 'User'} accepted your request to connect`,
            link: '/dashboard/connections'
          });
          
          // Update connection status in UI
          setConnectionStatus('connected');
          
          // Clean up any other pending requests between these users
          await cleanupConnectionRequests(user.uid, userId);
          
          return;
        }
      }
      
      // Always check for existing requests first, regardless of connectionStatus 
      // This ensures accurate status even after a cancelled request
      
      // Check if a connection request already exists FROM current user TO profile user
      const existingOutgoingRequestQuery = query(
        collection(db, 'connectionRequests'),
        where('fromUserId', '==', user.uid),
        where('toUserId', '==', userId),
        where('status', 'in', ['pending', 'accepted'])
      );
      
      const existingOutgoingRequestSnap = await getDocs(existingOutgoingRequestQuery);
      
      if (!existingOutgoingRequestSnap.empty) {
        // Request already exists - update UI but don't show alert
        setConnectionStatus('pending');
        setPendingRequestId(existingOutgoingRequestSnap.docs[0].id);
        return;
      }
      
      // Also check if a connection request already exists FROM profile user TO current user
      const existingIncomingRequestQuery = query(
        collection(db, 'connectionRequests'),
        where('fromUserId', '==', userId),
        where('toUserId', '==', user.uid),
        where('status', 'in', ['pending', 'accepted'])
      );
      
      const existingIncomingRequestSnap = await getDocs(existingIncomingRequestQuery);
      
      if (!existingIncomingRequestSnap.empty) {
        // There's an incoming request, we should accept it instead of creating a new one
        const request = existingIncomingRequestSnap.docs[0];
        
        // Update the request status
        await updateDoc(doc(db, 'connectionRequests', request.id), {
          status: 'accepted'
        });
        
        // Create a connection
        await addDoc(collection(db, 'connections'), {
          users: [user.uid, userId],
          status: 'connected',
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp()
        });
        
        // Create notification for accepted request
        await createNotification({
          userId: userId,
          type: 'follow',
          senderId: user.uid,
          senderName: user.displayName || 'User',
          message: `${user.displayName || 'User'} accepted your request to connect`,
          link: '/dashboard/connections'
        });
        
        // Update connection status in UI
        setConnectionStatus('connected');
        
        // Clean up any other pending requests between these users
        await cleanupConnectionRequests(user.uid, userId);
        
        return;
      }
      
      // Check if user has already connected with this profile
      const existingConnectionQuery = query(
        collection(db, 'connections'),
        where('users', 'array-contains', user.uid),
        where('status', '==', 'connected')
      );
      
      const existingConnectionSnap = await getDocs(existingConnectionQuery);
      const alreadyConnected = existingConnectionSnap.docs.some(doc => {
        const data = doc.data();
        return data.users.includes(userId);
      });
      
      if (alreadyConnected) {
        // Already connected - just update UI
        setConnectionStatus('connected');
        return;
      }
      
      // Create a new connection request
      const requestData = {
        fromUserId: user.uid,
        fromUserName: user.displayName || 'User',
        fromUserPhoto: user.photoURL || '',
        toUserId: userId,
        status: 'pending',
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'connectionRequests'), requestData);
      
      // Store request ID for potential cancellation
      setPendingRequestId(docRef.id);
      
      // Create notification for connection request
      await createNotification({
        userId: userId,
        type: 'follow',
        senderId: user.uid,
        senderName: user.displayName || 'User',
        message: `${user.displayName || 'Someone'} requested to connect with you`,
        link: '/dashboard/connections?tab=requests'
      });
      
      // Update UI to show request was sent
      setConnectionStatus('pending');
    } catch (error) {
      console.error('Error sending connection request:', error);
    }
  };
  
  // Helper function to clean up connection requests between two users
  const cleanupConnectionRequests = async (userA: string, userB: string) => {
    try {
      // Find all requests in both directions that are still pending
      const requestsQueryA = query(
        collection(db, 'connectionRequests'),
        where('fromUserId', '==', userA),
        where('toUserId', '==', userB),
        where('status', '==', 'pending')
      );
      
      const requestsQueryB = query(
        collection(db, 'connectionRequests'),
        where('fromUserId', '==', userB),
        where('toUserId', '==', userA),
        where('status', '==', 'pending')
      );
      
      const [snapshotA, snapshotB] = await Promise.all([
        getDocs(requestsQueryA),
        getDocs(requestsQueryB)
      ]);
      
      // Update all pending requests to 'accepted'
      const updatePromises = [...snapshotA.docs, ...snapshotB.docs].map(doc => 
        updateDoc(doc.ref, { status: 'accepted' })
      );
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error cleaning up connection requests:', error);
    }
  };
  
  const getCategoryColor = (category: string) => {
    const categoryColors: {[key: string]: string} = {
      'Technology': 'bg-blue-100 text-blue-800',
      'Design': 'bg-purple-100 text-purple-800',
      'Marketing': 'bg-green-100 text-green-800',
      'Writing': 'bg-yellow-100 text-yellow-800',
      'Business': 'bg-gray-100 text-gray-800',
      'Lifestyle': 'bg-pink-100 text-pink-800',
      'Education': 'bg-indigo-100 text-indigo-800',
      'Health': 'bg-teal-100 text-teal-800',
      'Entertainment': 'bg-red-100 text-red-800',
      'Other': 'bg-orange-100 text-orange-800'
    };
    
    return categoryColors[category] || 'bg-indigo-100 text-indigo-800';
  };

  // Delete post handler
  const handleDeletePost = async (post: any) => {
    setDeletingPostId(post.id);
    setShowDeleteConfirm(true);
  };

  const confirmDeletePost = async () => {
    const post = feedPosts.find(p => p.id === deletingPostId);
    if (!post) return;
    // Remove from UI instantly
    setFeedPosts(prev => prev.filter(p => p.id !== deletingPostId));
    setShowDeleteConfirm(false);
    setDeletingPostId(null);
    // Delete from Firestore
    await deleteDoc(firestoreDoc(db, 'profilePosts', post.id));
    // Delete image from Storage if present
    if (post.imageUrl) {
      try {
        const storage = getStorage(app);
        const fileRef = storageRef(storage, post.imageUrl.replace(/^https?:\/\/[^/]+\/o\//, '').replace(/\?.*$/, '').replace(/%2F/g, '/'));
        await deleteObject(fileRef);
      } catch (err) {
        // Ignore errors (image may already be gone)
      }
    }
  };

  // Like/unlike post
  const handleLike = async (postId: string) => {
    if (!user) return;
    const likeRef = doc(db, 'profilePosts', postId, 'likes', user.uid);
    const post = feedPosts.find(p => p.id === postId);
    if (!post) return;
    
    const hasLiked = post.likes?.includes(user.uid);
    try {
      if (hasLiked) {
        await deleteDoc(likeRef);
        // Update local state
        setFeedPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              likes: p.likes?.filter((id: string) => id !== user.uid) || []
            };
          }
          return p;
        }));

        // Create notification for like
        if (post.userId !== user.uid) {
          await createNotification({
            userId: post.userId,
            type: 'like',
            senderId: user.uid,
            senderName: user.displayName || 'User',
            postId: postId
          });
        }
      } else {
        await setDoc(likeRef, { userId: user.uid });
        // Update local state
        setFeedPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              likes: [...(p.likes || []), user.uid]
            };
          }
          return p;
        }));

        // Create notification for like
        if (post.userId !== user.uid) {
          await createNotification({
            userId: post.userId,
            type: 'like',
            senderId: user.uid,
            senderName: user.displayName || 'User',
            postId: postId
          });
        }
      }
    } catch (error) {
      console.error('Error handling like:', error);
    }
  };

  // Add type guard for user ID
  const isUserId = (id: string | undefined): id is string => {
    return typeof id === 'string' && id.length > 0;
  };

  // Update the emoji reaction handlers
  const handleEmoji = async (postId: string, emoji: string) => {
    if (!user) return;
    const emojiRef = doc(db, 'profilePosts', postId, 'emojiReactions', `${emoji}_${user.uid!}`);
    const post = feedPosts.find(p => p.id === postId);
    if (!post) return;
    
    const hasReacted = post.emoji?.[emoji]?.includes(user.uid);
    try {
      if (hasReacted) {
        await deleteDoc(emojiRef);
        // Update local state
        setFeedPosts(prev => prev.map(p => {
          if (p.id === postId) {
            const updatedEmoji = { ...p.emoji };
            if (updatedEmoji[emoji]) {
              updatedEmoji[emoji] = updatedEmoji[emoji].filter((id: string) => id !== user.uid);
              if (updatedEmoji[emoji].length === 0) {
                delete updatedEmoji[emoji];
              }
            }
            return { ...p, emoji: updatedEmoji };
          }
          return p;
        }));
      } else {
        await setDoc(emojiRef, { emoji, userId: user.uid });
        // Update local state
        setFeedPosts(prev => prev.map(p => {
          if (p.id === postId) {
            const updatedEmoji = { ...p.emoji };
            if (!updatedEmoji[emoji]) {
              updatedEmoji[emoji] = [];
            }
            if (!updatedEmoji[emoji].includes(user.uid)) {
              updatedEmoji[emoji].push(user.uid);
            }
            return { ...p, emoji: updatedEmoji };
          }
          return p;
        }));
      }
      setShowEmojiPicker(prev => ({ ...prev, [postId]: false }));
    } catch (error) {
      console.error('Error handling emoji:', error);
    }
  };

  // Add comment
  const handleAddComment = async (postId: string) => {
    if (!user) return;
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const commentRef = collection(db, 'profilePosts', postId, 'comments');
    const newComment = {
      userId: user.uid,
      text,
      createdAt: serverTimestamp(),
      displayName: user.displayName || 'User',
      photoURL: user.photoURL || '/default-avatar.png'
    };

    const docRef = await addDoc(commentRef, newComment);
    
    // Update local state
    setFeedPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          comments: [...(p.comments || []), { id: docRef.id, ...newComment }]
        };
      }
      return p;
    }));

    // Create notification for comment
    const post = feedPosts.find(p => p.id === postId);
    if (post && post.userId !== user.uid) {
      await createNotification({
        userId: post.userId,
        type: 'comment',
        senderId: user.uid,
        senderName: user.displayName || 'User',
        postId: postId,
        comment: text,
        link: `/profile/${post.userId}?postId=${postId}`
      });
    }
    
    // Process mentions
    await createMentionNotifications(
      text,
      postId,
      user.uid,
      user.displayName || 'User',
      'comment'
    );

    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
  };

  // Like/unlike comment
  const handleLikeComment = async (postId: string, commentId: string) => {
    if (!user) return;
    const likeRef = doc(db, 'profilePosts', postId, 'comments', commentId, 'likes', user.uid);
    const post = feedPosts.find(p => p.id === postId);
    if (!post) return;
    
    const comment = post.comments.find((c: Comment) => c.id === commentId);
    if (!comment) return;
    
    const hasLiked = comment.likes?.includes(user.uid);
    try {
      if (hasLiked) {
        await deleteDoc(likeRef);
        // Update local state
        setFeedPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              comments: p.comments.map((c: Comment) => {
                if (c.id === commentId) {
                  return {
                    ...c,
                    likes: c.likes?.filter((id: string) => id !== user.uid) || []
                  };
                }
                return c;
              })
            };
          }
          return p;
        }));
      } else {
        await setDoc(likeRef, { userId: user.uid });
        // Update local state
        setFeedPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              comments: p.comments.map((c: Comment) => {
                if (c.id === commentId) {
                  return {
                    ...c,
                    likes: [...(c.likes || []), user.uid]
                  };
                }
                return c;
              })
            };
          }
          return p;
        }));
      }
    } catch (error) {
      console.error('Error handling comment like:', error);
    }
  };

  // Update the emoji reaction handlers
  const handleCommentEmoji = async (postId: string, commentId: string, emoji: string) => {
    if (!user) return;
    const emojiRef = doc(db, 'profilePosts', postId, 'comments', commentId, 'emojiReactions', `${emoji}_${user.uid!}`);
    const post = feedPosts.find(p => p.id === postId);
    if (!post) return;
    
    const comment = post.comments.find((c: Comment) => c.id === commentId);
    if (!comment) return;
    
    const hasReacted = comment.emoji?.[emoji]?.includes(user.uid);
    try {
      if (hasReacted) {
        await deleteDoc(emojiRef);
        // Update local state
        setFeedPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              comments: p.comments.map((c: Comment) => {
                if (c.id === commentId) {
                  const updatedEmoji = { ...c.emoji };
                  if (updatedEmoji[emoji]) {
                    updatedEmoji[emoji] = updatedEmoji[emoji].filter((id: string) => id !== user.uid);
                    if (updatedEmoji[emoji].length === 0) {
                      delete updatedEmoji[emoji];
                    }
                  }
                  return { ...c, emoji: updatedEmoji };
                }
                return c;
              })
            };
          }
          return p;
        }));
      } else {
        await setDoc(emojiRef, { emoji, userId: user.uid });
        // Update local state
        setFeedPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              comments: p.comments.map((c: Comment) => {
                if (c.id === commentId) {
                  const updatedEmoji = { ...c.emoji };
                  if (!updatedEmoji[emoji]) {
                    updatedEmoji[emoji] = [];
                  }
                  if (!updatedEmoji[emoji].includes(user.uid)) {
                    updatedEmoji[emoji].push(user.uid);
                  }
                  return { ...c, emoji: updatedEmoji };
                }
                return c;
              })
            };
          }
          return p;
        }));
      }
      setShowCommentEmojiPicker(prev => ({ ...prev, [comment.id]: false }));
    } catch (error) {
      console.error('Error handling comment emoji:', error);
    }
  };

  // Add reply to comment
  const handleAddReply = async (postId: string, commentId: string) => {
    if (!user) return;
    const text = replyInputs[commentId]?.trim();
    if (!text) return;

    const replyRef = collection(db, 'profilePosts', postId, 'comments', commentId, 'replies');
    const newReply = {
      userId: user.uid,
      text,
      createdAt: serverTimestamp(),
      displayName: user.displayName || 'User',
      photoURL: user.photoURL || '/default-avatar.png'
    };

    try {
      const docRef = await addDoc(replyRef, newReply);
      
      // Update local state
      setFeedPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            comments: p.comments.map((c: Comment) => {
              if (c.id === commentId) {
                return {
                  ...c,
                  replies: [...(c.replies || []), { id: docRef.id, ...newReply }]
                };
              }
              return c;
            })
          };
        }
        return p;
      }));

      // Create notification for reply
      const post = feedPosts.find(p => p.id === postId);
      const comment = post?.comments.find((c: Comment) => c.id === commentId);
      if (post && comment && comment.userId !== user.uid) {
        await createNotification({
          userId: comment.userId,
          type: 'comment',
          senderId: user.uid,
          senderName: user.displayName || 'User',
          postId: postId,
          comment: text,
          link: `/profile/${post.userId}?postId=${postId}`
        });
      }
      
      // Process mentions
      await createMentionNotifications(
        text,
        postId,
        user.uid,
        user.displayName || 'User',
        'reply',
        postId // parent post ID
      );

      setReplyInputs(prev => ({ ...prev, [commentId]: '' }));
      setShowReplyBox(prev => ({ ...prev, [commentId]: false }));
    } catch (error) {
      console.error('Error adding reply:', error);
    }
  };

  // Handle key press for comments and replies
  const handleKeyPress = (e: React.KeyboardEvent, postId: string, commentId?: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (commentId) {
        handleAddReply(postId, commentId);
      } else {
        handleAddComment(postId);
      }
    }
  };

  // Defensive helper for includes
  function safeIncludes(arr: any, value: any) {
    return Array.isArray(arr) ? arr.includes(value) : false;
  }

  // Add delete comment handler
  const handleDeleteComment = async (postId: string, commentId: string) => {
    // Remove from UI instantly
    setPostInteractions(prev => {
      const postComments = prev[postId]?.comments?.filter((c: any) => c.id !== commentId) || [];
      return { ...prev, [postId]: { ...prev[postId], comments: postComments } };
    });
    setCommentInteractions(prev => {
      const newInteractions = { ...prev };
      delete newInteractions[commentId];
      return newInteractions;
    });
    await deleteDoc(doc(db, 'profilePosts', postId, 'comments', commentId));
  };

  // Add delete reply handler
  const handleDeleteReply = async (postId: string, commentId: string, replyId: string) => {
    // Remove from UI instantly
    setFeedPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          comments: p.comments.map((c: Comment) => {
            if (c.id === commentId) {
              return {
                ...c,
                replies: c.replies.filter((r: Reply) => r.id !== replyId)
              };
            }
            return c;
          })
        };
      }
      return p;
    }));
    
    await deleteDoc(doc(db, 'profilePosts', postId, 'comments', commentId, 'replies', replyId));
  };

  // Like/unlike reply
  const handleLikeReply = async (postId: string, commentId: string, replyId: string) => {
    if (!user) return;
    const likeRef = doc(db, 'profilePosts', postId, 'comments', commentId, 'replies', replyId, 'likes', user.uid);
    const post = feedPosts.find(p => p.id === postId);
    if (!post) return;
    
    const comment = post.comments.find((c: Comment) => c.id === commentId);
    if (!comment) return;
    
    const reply = comment.replies.find((r: Reply) => r.id === replyId);
    if (!reply) return;
    
    const hasLiked = reply.likes?.includes(user.uid);
    try {
      if (hasLiked) {
        await deleteDoc(likeRef);
        // Update local state
        setFeedPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              comments: p.comments.map((c: Comment) => {
                if (c.id === commentId) {
                  return {
                    ...c,
                    replies: c.replies.map((r: Reply) => {
                      if (r.id === replyId) {
                        return {
                          ...r,
                          likes: r.likes?.filter((id: string) => id !== user.uid) || []
                        };
                      }
                      return r;
                    })
                  };
                }
                return c;
              })
            };
          }
          return p;
        }));
      } else {
        await setDoc(likeRef, { userId: user.uid });
        // Update local state
        setFeedPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              comments: p.comments.map((c: Comment) => {
                if (c.id === commentId) {
                  return {
                    ...c,
                    replies: c.replies.map((r: Reply) => {
                      if (r.id === replyId) {
                        return {
                          ...r,
                          likes: [...(r.likes || []), user.uid]
                        };
                      }
                      return r;
                    })
                  };
                }
                return c;
              })
            };
          }
          return p;
        }));
      }
    } catch (error) {
      console.error('Error handling reply like:', error);
    }
  };

  // Add emoji reaction to reply
  const handleReplyEmoji = async (postId: string, commentId: string, replyId: string, emoji: string) => {
    if (!user) return;
    const emojiRef = doc(db, 'profilePosts', postId, 'comments', commentId, 'replies', replyId, 'emojiReactions', `${emoji}_${user.uid!}`);
    const post = feedPosts.find(p => p.id === postId);
    if (!post) return;
    
    const comment = post.comments.find((c: Comment) => c.id === commentId);
    if (!comment) return;
    
    const reply = comment.replies.find((r: Reply) => r.id === replyId);
    if (!reply) return;
    
    const hasReacted = reply.emoji?.[emoji]?.includes(user.uid);
    try {
      if (hasReacted) {
        await deleteDoc(emojiRef);
        // Update local state
        setFeedPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              comments: p.comments.map((c: Comment) => {
                if (c.id === commentId) {
                  return {
                    ...c,
                    replies: c.replies.map((r: Reply) => {
                      if (r.id === replyId) {
                        const updatedEmoji = { ...r.emoji };
                        if (updatedEmoji[emoji]) {
                          updatedEmoji[emoji] = updatedEmoji[emoji].filter((id: string) => id !== user.uid);
                          if (updatedEmoji[emoji].length === 0) {
                            delete updatedEmoji[emoji];
                          }
                        }
                        return { ...r, emoji: updatedEmoji };
                      }
                      return r;
                    })
                  };
                }
                return c;
              })
            };
          }
          return p;
        }));
      } else {
        await setDoc(emojiRef, { emoji, userId: user.uid });
        // Update local state
        setFeedPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              comments: p.comments.map((c: Comment) => {
                if (c.id === commentId) {
                  return {
                    ...c,
                    replies: c.replies.map((r: Reply) => {
                      if (r.id === replyId) {
                        const updatedEmoji = { ...r.emoji };
                        if (!updatedEmoji[emoji]) {
                          updatedEmoji[emoji] = [];
                        }
                        if (!updatedEmoji[emoji].includes(user.uid)) {
                          updatedEmoji[emoji].push(user.uid);
                        }
                        return { ...r, emoji: updatedEmoji };
                      }
                      return r;
                    })
                  };
                }
                return c;
              })
            };
          }
          return p;
        }));
      }
      setShowReplyEmojiPicker(prev => ({ ...prev, [replyId]: false }));
    } catch (error) {
      console.error('Error handling reply emoji:', error);
    }
  };

  // Add new useEffect to fetch completed swaps
  useEffect(() => {
    const fetchCompletedSwaps = async () => {
      if (!user || !userId) {
        console.log('Missing user or userId:', { user: !!user, userId });
        return;
      }
      
      try {
        console.log('Starting swap fetch for:', { 
          currentUser: user.uid, 
          targetUser: userId,
          currentUserName: user.displayName
        });
        
        // Query for completed swaps
        const swapsQuery = query(
          collection(db, 'swaps'),
          where('status', '==', 'completed')
        );
        
        const swapsSnapshot = await getDocs(swapsQuery);
        console.log('Found completed swaps:', swapsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })));
        
        const swaps = swapsSnapshot.docs
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.message || 'Swap',
              providerId: data.providerId,
              receiverId: data.receiverId,
              status: data.status,
              completedAt: data.completedAt?.toDate() || data.updatedAt?.toDate() || new Date()
            };
          })
          .filter(swap => {
            // Log each swap we're checking
            console.log('Analyzing swap:', {
              id: swap.id,
              title: swap.title,
              status: swap.status,
              providerId: swap.providerId,
              receiverId: swap.receiverId,
              currentUserIsProvider: swap.providerId === user.uid,
              currentUserIsReceiver: swap.receiverId === user.uid,
              targetUserIsProvider: swap.providerId === userId,
              targetUserIsReceiver: swap.receiverId === userId
            });
            
            // Check if either user is the provider or receiver
            const isValidSwap = 
              (swap.providerId === userId && swap.receiverId === user.uid) ||
              (swap.providerId === user.uid && swap.receiverId === userId);
            
            return isValidSwap;
          });
        
        console.log('Final filtered swaps:', swaps);
        setCompletedSwaps(swaps);
      } catch (error) {
        console.error('Error fetching completed swaps:', error);
      }
    };
    
    fetchCompletedSwaps();
  }, [user, userId]);

  // Fetch endorsements and reviewer profile photos
  useEffect(() => {
    const fetchEndorsements = async () => {
      if (!userId) return;
      try {
        const endorsementsQuery = query(
          collection(db, 'endorsements'),
          where('toUserId', '==', userId),
          orderBy('createdAt', 'desc')
        );
        const endorsementsSnapshot = await getDocs(endorsementsQuery);
        const endorsementsData = await Promise.all(
          endorsementsSnapshot.docs.map(async docSnap => {
            const data = docSnap.data();
            // Fetch reviewer profile photo
            let fromUserPhoto = data.fromUserPhoto;
            if (!fromUserPhoto && data.fromUserId) {
              try {
                const userDoc = await getDoc(doc(db, 'users', data.fromUserId));
                if (userDoc.exists()) {
                  fromUserPhoto = userDoc.data().photoURL || '';
                }
              } catch {}
            }
            return {
              id: docSnap.id,
              fromUserId: data.fromUserId,
              fromUserName: data.fromUserName,
              swapId: data.swapId,
              swapTitle: data.swapTitle,
              review: data.review,
              rating: data.rating,
              createdAt: data.createdAt?.toDate() || new Date(),
              fromUserPhoto: fromUserPhoto || '',
            };
          })
        );
        setEndorsements(endorsementsData);
      } catch (error) {
        console.error('Error fetching endorsements:', error);
      }
    };
    fetchEndorsements();
  }, [userId]);

  // Update the handleEndorse function
  const handleEndorse = async () => {
    if (!user || !selectedSwap || !endorsementReview.trim() || endorsementRating === 0) return;
    
    // Check if user has already endorsed this swap
    if (hasEndorsedSwap(selectedSwap)) {
      alert("You have already endorsed this swap!");
      setShowEndorseModal(false);
      return;
    }
    
    setIsEndorsing(true);
    try {
      const newEndorsement = {
        fromUserId: user.uid,
        fromUserName: user.displayName || 'Anonymous',
        toUserId: userId,
        swapId: selectedSwap,
        swapTitle: completedSwaps.find(s => s.id === selectedSwap)?.title || '',
        review: endorsementReview.trim(),
        rating: endorsementRating,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'endorsements'), newEndorsement);
      
      // Update local state with the actual document ID
      setEndorsements(prev => [{
        id: docRef.id,
        ...newEndorsement,
        createdAt: new Date()
      }, ...prev]);
      
      // Reset form
      setSelectedSwap('');
      setEndorsementReview('');
      setEndorsementRating(0);
      setShowEndorseModal(false);
    } catch (error) {
      console.error('Error adding endorsement:', error);
    } finally {
      setIsEndorsing(false);
    }
  };

  useEffect(() => {
    if (postId && feedPosts.length > 0) {
      const el = document.getElementById(`post-${postId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-indigo-400');
        setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400'), 2000);
      }
    }
  }, [feedPosts, postId]);

  // Fetch connections count
  useEffect(() => {
    const fetchConnectionsCount = async () => {
      if (!userId) return;
      try {
        const connectionsQuery = query(
          collection(db, 'connections'),
          where('users', 'array-contains', userId),
          where('status', '==', 'connected')
        );
        const connectionsSnap = await getDocs(connectionsQuery);
        setConnectionsCount(connectionsSnap.size);
      } catch (error) {
        console.error('Error fetching connections count:', error);
      }
    };
    fetchConnectionsCount();
  }, [userId]);

  // Add new useEffect here
  
  // Fetch total completed swaps count
  useEffect(() => {
    const fetchTotalSwapsCount = async () => {
      if (!userId) return;
      try {
        // Query for swaps where the user is provider
        const providerSwapsQuery = query(
          collection(db, 'swaps'),
          where('providerId', '==', userId),
          where('status', '==', 'completed')
        );
        
        // Query for swaps where the user is receiver
        const receiverSwapsQuery = query(
          collection(db, 'swaps'),
          where('receiverId', '==', userId),
          where('status', '==', 'completed')
        );
        
        // Fetch both queries
        const [providerSnap, receiverSnap] = await Promise.all([
          getDocs(providerSwapsQuery),
          getDocs(receiverSwapsQuery)
        ]);
        
        // Combine and deduplicate swaps (in case somehow a user appears as both provider and receiver)
        const swapIds = new Set([
          ...providerSnap.docs.map(doc => doc.id),
          ...receiverSnap.docs.map(doc => doc.id)
        ]);
        
        setTotalSwapsCount(swapIds.size);
      } catch (error) {
        console.error('Error fetching total swaps count:', error);
      }
    };
    fetchTotalSwapsCount();
  }, [userId]);

  // Fetch all connections for the profile user
  useEffect(() => {
    const fetchConnections = async () => {
      if (!userId) return;
      try {
        const connectionsQuery = query(
          collection(db, 'connections'),
          where('users', 'array-contains', userId),
          where('status', '==', 'connected')
        );
        const snap = await getDocs(connectionsQuery);
        const connections = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProfileConnections(connections);
      } catch (error) {
        console.error('Error fetching profile connections:', error);
      }
    };
    fetchConnections();
  }, [userId]);

  // Fetch all connections for the viewer (if logged in)
  useEffect(() => {
    if (!user) return;
    const fetchViewerConnections = async () => {
      try {
        const connectionsQuery = query(
          collection(db, 'connections'),
          where('users', 'array-contains', user.uid),
          where('status', '==', 'connected')
        );
        const snap = await getDocs(connectionsQuery);
        const connections = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setViewerConnections(connections);
      } catch (error) {
        console.error('Error fetching viewer connections:', error);
      }
    };
    fetchViewerConnections();
  }, [user]);

  // Compute mutual connections
  useEffect(() => {
    if (!user || !profileConnections.length || !viewerConnections.length) {
      setMutualConnections([]);
      return;
    }
    // Get all user IDs connected to the profile user
    const profileUserIds = new Set(profileConnections.flatMap(conn => conn.users.filter((id: string) => id !== userId)));
    // Get all user IDs connected to the viewer
    const viewerUserIds = new Set(viewerConnections.flatMap(conn => conn.users.filter((id: string) => id !== user?.uid)));
    // Find intersection
    const mutuals = Array.from(profileUserIds).filter(id => viewerUserIds.has(id));
    setMutualConnections(mutuals);
  }, [user, profileConnections, viewerConnections, userId]);

  // Fetch user info for each connection (for modal display)
  useEffect(() => {
    const fetchUserInfos = async () => {
      const uids = Array.from(new Set(profileConnections.flatMap(conn => conn.users.filter((id: string) => id !== userId))));
      if (uids.length === 0) return;
      const infos: {[uid: string]: any} = {};
      await Promise.all(uids.map(async (uid) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) infos[uid] = userDoc.data();
        } catch {}
      }));
      setConnectionsUserInfo(infos);
    };
    fetchUserInfos();
  }, [profileConnections, userId]);

  // Connect with a connection
  const handleConnectWithConnection = async (targetUserId: string) => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setConnectingId(targetUserId);
    try {
      // Check if already connected
      const existingConnectionQuery = query(
        collection(db, 'connections'),
        where('users', 'array-contains', user.uid),
        where('status', '==', 'connected')
      );
      const snap = await getDocs(existingConnectionQuery);
      const alreadyConnected = snap.docs.some(doc => {
        const data = doc.data();
        return data.users.includes(targetUserId);
      });
      if (alreadyConnected) {
        alert('You are already connected with this user.');
        setConnectingId(null);
        return;
      }
      // Send connection request
      const requestData = {
        fromUserId: user.uid,
        fromUserName: user.displayName || 'User',
        fromUserPhoto: user.photoURL || '',
        toUserId: targetUserId,
        status: 'pending',
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'connectionRequests'), requestData);
      await createNotification({
        userId: targetUserId,
        type: 'follow',
        senderId: user.uid,
        senderName: user.displayName || 'User',
        message: `${user.displayName || 'Someone'} wants to connect with you`
      });
      alert('Connection request sent!');
    } catch (error) {
      alert('Failed to send connection request.');
    } finally {
      setConnectingId(null);
    }
  };

  // Check for endorsement query params
  useEffect(() => {
    if (user && userId && userId !== user.uid) {
      const endorse = searchParams?.get('endorse');
      const swapId = searchParams?.get('swapId');
      
      if (endorse === 'true') {
        setShowEndorseModal(true);
        
        if (swapId) {
          setSelectedSwap(swapId);
        }
      }
    }
  }, [user, userId, searchParams]);

  // 2. Add a handler to scroll to endorsements section
  const handleScrollToEndorsements = () => {
    if (endorsementsSectionRef.current) {
      endorsementsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    setEditNameValue(userProfile?.displayName || '');
    setEditLocationValue(userProfile?.location || '');
  }, [userProfile]);

  // Check connection status between current user and profile user
  useEffect(() => {
    if (!user || !userId || user.uid === userId) return;

    const checkConnectionStatus = async () => {
      try {
        // Check for existing connection
        const existingConnectionQuery = query(
          collection(db, 'connections'),
          where('users', 'array-contains', user.uid),
          where('status', '==', 'connected')
        );
        
        const existingConnectionSnap = await getDocs(existingConnectionQuery);
        const alreadyConnected = existingConnectionSnap.docs.some(doc => {
          const data = doc.data();
          return data.users.includes(userId);
        });
        
        if (alreadyConnected) {
          setConnectionStatus('connected');
          return;
        }
        
        // Check for outgoing request - when current user sent a request to profile user
        const outgoingRequestQuery = query(
          collection(db, 'connectionRequests'),
          where('fromUserId', '==', user.uid),
          where('toUserId', '==', userId),
          where('status', 'in', ['pending', 'accepted'])
        );
        
        const outgoingRequestSnap = await getDocs(outgoingRequestQuery);
        
        if (!outgoingRequestSnap.empty) {
          setConnectionStatus('pending');
          // Store the request ID for potential cancellation
          setPendingRequestId(outgoingRequestSnap.docs[0].id);
          return;
        }
        
        // Check for incoming request - when profile user sent a request to current user
        const incomingRequestQuery = query(
          collection(db, 'connectionRequests'),
          where('fromUserId', '==', userId),
          where('toUserId', '==', user.uid),
          where('status', 'in', ['pending', 'accepted'])
        );
        
        const incomingRequestSnap = await getDocs(incomingRequestQuery);
        
        if (!incomingRequestSnap.empty) {
          setConnectionStatus('incoming');
          return;
        }
        
        // Neither connected nor pending
        setConnectionStatus('none');
      } catch (error) {
        console.error('Error checking connection status:', error);
      }
    };
    
    checkConnectionStatus();
  }, [user, userId, connectionStatus]);

  // Add a function to cancel connection request
  const handleCancelRequest = async () => {
    if (!user || !pendingRequestId) return;
    
    try {
      // First update UI state immediately
      setConnectionStatus('none');
      setPendingRequestId(null);
      
      // Then delete the connection request in the background
      await deleteDoc(doc(db, 'connectionRequests', pendingRequestId));
    } catch (error) {
      console.error('Error canceling connection request:', error);
    }
  };

  useEffect(() => {
    if (!user) return;
    const checkSubscription = async () => {
      const subscriptions = await getAllUserSubscriptions(user.uid);
      const hasActiveMainPlan = subscriptions.some(
        (sub) => isSubscriptionActive(sub) && sub.planId !== 'verification'
      );
      if (!hasActiveMainPlan) {
        window.location.href = '/pricing';
      }
    };
    checkSubscription();
  }, [user]);

  useEffect(() => {
    // Fetch verification status and verification subscription
    const fetchVerificationAndSubscription = async () => {
      try {
        // Fetch verification status
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        let verified = false;
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          verified = userData?.verification?.status === 'verified';
        }
        setIsVerified(verified);

        // Fetch all subscriptions for the user
        const subscriptions = await getAllUserSubscriptions(userId);
        const verificationSub = subscriptions.find(
          (sub) => sub.planId === 'verification' && isSubscriptionActive(sub)
        );
        setHasVerificationBadge(!!verificationSub);
      } catch (error) {
        console.error('Error fetching verification badge:', error);
      }
    };
    fetchVerificationAndSubscription();
  }, [userId]);

  if (!userProfile) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
            <p className="text-lg text-gray-700">Loading profile...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Profile header */}
        <div 
          className={`text-white py-16 relative`}
          style={{
            background: userProfile.bannerImage 
              ? 'none' 
              : 'linear-gradient(to right, #4f46e5, #9333ea, #ec4899)'
          }}
        >
          {/* Banner section: always show pencil in edit mode, even if no banner image */}
          <div className="absolute inset-0 z-0">
            {userProfile.bannerImage && (
              <Image 
                src={userProfile.bannerImage} 
                alt="Profile banner" 
                fill 
                className="object-cover"
                priority
              />
            )}
            {/* Overlay to ensure text readability */}
            <div className="absolute inset-0 bg-black bg-opacity-40"></div>
            {/* Always show edit button for banner when in edit mode */}
            {isOwnProfile && editMode && (
              <button
                className="absolute bottom-4 right-4 bg-white rounded-full p-2 shadow hover:bg-indigo-100 transition z-10"
                onClick={() => setEditingBanner(true)}
                aria-label="Edit banner image"
              >
                <Pencil className="h-5 w-5 text-indigo-600" />
              </button>
            )}
          </div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="flex flex-col lg:flex-row items-center justify-between">
              {/* Floating Edit Profile toggle button - REMOVED */}
              <div className="flex flex-col lg:flex-row items-center relative">
                {/* Profile Picture with pencil overlay in edit mode */}
                <div className="h-32 w-32 md:h-40 md:w-40 rounded-full overflow-hidden border-4 border-white shadow-xl mb-6 md:mb-0 md:mr-8 relative">
                  {userProfile.photoURL ? (
                    <Image 
                      src={userProfile.photoURL} 
                      alt={userProfile.displayName} 
                      width={160} 
                      height={160} 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                      <span className="text-white text-4xl font-medium">{userProfile.displayName.charAt(0)?.toUpperCase() || 'U'}</span>
                    </div>
                  )}
                  {isOwnProfile && editMode && (
                    <button
                      className="absolute bottom-2 right-2 bg-white rounded-full p-2 shadow hover:bg-indigo-100 transition"
                      onClick={() => setEditingAvatar(true)}
                      aria-label="Edit profile picture"
                    >
                      <Pencil className="h-5 w-5 text-indigo-600" />
                    </button>
                  )}
                </div>
                <div className="flex-1">
                  {/* Edit Profile button below profile picture - REMOVED */}
                  {/* Editable Name and Location */}
                  <div className="flex items-center gap-2">
                    {editingName ? (
                      <>
                        <input
                          type="text"
                          value={editNameValue}
                          onChange={e => setEditNameValue(e.target.value)}
                          className="text-3xl md:text-4xl font-bold border-b-2 border-indigo-300 focus:border-indigo-600 outline-none bg-transparent px-1"
                          style={{ minWidth: 120 }}
                        />
                        <button onClick={async () => { await onSubmitEditProfile({ ...userProfile, displayName: editNameValue, location: editLocationValue }); setEditingName(false); }} className="ml-1 text-green-600 hover:text-green-800"><Check className="h-5 w-5" /></button>
                        <button onClick={() => { setEditNameValue(userProfile.displayName || ''); setEditLocationValue(userProfile.location || ''); setEditingName(false); }} className="ml-1 text-gray-400 hover:text-red-500"><X className="h-5 w-5" /></button>
                      </>
                    ) : (
                      <>
                        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-2">
                          {userProfile?.displayName ?? ''}
                          <span style={{ display: 'flex', alignItems: 'center' }}>
                            <VerificationBadge userId={userProfile?.uid} className="h-6 w-6 align-middle" />
                          </span>
                          {isOwnProfile && editMode && (
                            <button onClick={() => setEditingName(true)} className="ml-2 text-indigo-600 hover:text-indigo-800" aria-label="Edit name/location"><Pencil className="h-4 w-4" /></button>
                          )}
                        </h1>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {editingName ? (
                      <>
                        <input
                          type="text"
                          value={editLocationValue}
                          onChange={e => setEditLocationValue(e.target.value)}
                          className="text-indigo-100 border-b-2 border-indigo-300 focus:border-indigo-600 outline-none bg-transparent px-1 text-base md:text-lg"
                          style={{ minWidth: 80 }}
                          placeholder="City, Country"
                        />
                      </>
                    ) : (
                      <p className="text-indigo-100 flex items-center justify-center md:justify-start">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {userProfile.location}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-indigo-100 mb-3">Member since {userProfile.joinedDate.toLocaleDateString()}</p>
                    {isOwnProfile && (
                      <button
                        className="bg-indigo-600 text-white px-3 py-2 rounded-full shadow-lg flex items-center gap-2 hover:bg-indigo-700 transition ml-4"
                        onClick={() => {
                          const newEditMode = !editMode;
                          setEditMode(newEditMode);
                          
                          // If turning off edit mode, reset all other editing states
                          if (!newEditMode) {
                            setEditingName(false);
                            setEditingAbout(false);
                            setEditingAvatar(false);
                            setEditingBanner(false);
                            // Reset any form values to match current profile data
                            setEditNameValue(userProfile.displayName || '');
                            setEditLocationValue(userProfile.location || '');
                          }
                        }}
                        aria-label="Toggle edit mode"
                      >
                        <Pencil className="h-5 w-5" />
                        {editMode ? 'Done' : 'Edit Profile'}
                      </button>
                    )}
                  </div>
                  
                  {/* Connection buttons moved under Member since text */}
                  {!isOwnProfile && user && (
                    <div className="flex gap-3 mt-2 lg:mt-0">
                      <button
                        onClick={connectionStatus === 'pending' ? 
                          handleCancelRequest : 
                          handleConnect}
                        disabled={connectionStatus === 'connected'}
                        className={`py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium shadow-lg transition ${
                          connectionStatus === 'connected'
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : connectionStatus === 'pending'
                            ? 'bg-blue-100 text-blue-700 cursor-pointer hover:bg-red-100 hover:text-red-700'
                            : connectionStatus === 'incoming'
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {connectionStatus === 'connected' ? (
                          <>
                            <UserCheck className="h-5 w-5" />
                            Connected
                          </>
                        ) : connectionStatus === 'pending' ? (
                          <>
                            <Clock className="h-5 w-5" />
                            Cancel Request
                          </>
                        ) : connectionStatus === 'incoming' ? (
                          <>
                            <UserPlus className="h-5 w-5" />
                            Accept Request
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-5 w-5" />
                            Connect
                          </>
                        )}
                      </button>
                      
                      {/* Endorse button - only show if connected */}
                      {connectionStatus === 'connected' && (
                        <button
                          onClick={() => setShowEndorseModal(true)}
                          className="py-2.5 px-4 rounded-lg bg-indigo-600 text-white flex items-center justify-center gap-2 text-sm font-medium shadow-lg hover:bg-indigo-700 transition"
                        >
                          <Star className="h-5 w-5" />
                          Endorse
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Add connection and endorse buttons in the header section */}
              <div className="mt-6 lg:mt-0 text-center mx-auto lg:mx-0 lg:ml-8 flex flex-col gap-4 w-full max-w-[180px]">
                {/* Endorsements stat box - make it clickable */}
                <button
                  type="button"
                  onClick={handleScrollToEndorsements}
                  className="bg-white bg-opacity-10 rounded-lg py-6 px-4 backdrop-blur-sm flex flex-col items-center focus:outline-none hover:bg-opacity-20 transition cursor-pointer"
                  aria-label="Scroll to endorsements section"
                >
                  <div className="text-3xl font-bold text-white mb-2">
                    {endorsements.length > 0 
                      ? (endorsements.reduce((acc, e) => acc + e.rating, 0) / endorsements.length).toFixed(1)
                      : "0.0"
                    }
                  </div>
                  <div className="flex items-center justify-center mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        className={`w-5 h-5 ${
                          endorsements.length > 0 && star <= Math.round(endorsements.reduce((acc, e) => acc + e.rating, 0) / endorsements.length)
                            ? 'text-yellow-400'
                            : 'text-gray-300'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <div className="text-white text-sm">
                    {endorsements.length > 0 
                      ? `${endorsements.length} ${endorsements.length === 1 ? 'endorsement' : 'endorsements'}`
                      : "No Endorsements Yet"
                    }
                  </div>
                </button>
                
                {/* Total Swaps count box */}
                <div className="bg-white bg-opacity-10 rounded-lg py-6 px-4 backdrop-blur-sm flex flex-col items-center">
                  <div className="flex items-center gap-2 mb-1">
                    <Repeat className="h-6 w-6 text-indigo-200" />
                    <span className="text-2xl font-bold text-white">{totalSwapsCount}</span>
                  </div>
                  <div className="text-white text-sm">{totalSwapsCount === 1 ? 'Completed Swap' : 'Completed Swaps'}</div>
                </div>
                
                {/* Connections count box */}
                <button
                  className="bg-white bg-opacity-10 rounded-lg py-6 px-4 backdrop-blur-sm flex flex-col items-center focus:outline-none hover:bg-opacity-20 transition"
                  onClick={() => setConnectionsModalOpen(true)}
                  type="button"
                  aria-label="Show connections"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <LucideUsers className="h-6 w-6 text-indigo-200" />
                    <span className="text-2xl font-bold text-white">{connectionsCount}</span>
                  </div>
                  <div className="text-white text-sm">{connectionsCount === 1 ? 'Connection' : 'Connections'}</div>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Endorsement Modal */}
        {showEndorseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md relative animate-scaleup-avatar">
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
                onClick={() => setShowEndorseModal(false)}
                aria-label="Close"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <h3 className="text-xl font-bold mb-4 text-gray-900">Endorse {userProfile.displayName}</h3>
              
              {completedSwaps.length === 0 ? (
                <div className="text-center py-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-600 mb-2">No completed swaps yet</p>
                  <p className="text-sm text-gray-500">You need to complete a swap with {userProfile.displayName} before you can endorse them.</p>
                </div>
              ) : completedSwaps.every(swap => hasEndorsedSwap(swap.id)) ? (
                <div className="text-center py-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-gray-600 mb-2">All swaps endorsed!</p>
                  <p className="text-sm text-gray-500">You have already endorsed all completed swaps with {userProfile.displayName}.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Completed Swap
                    </label>
                    <select
                      value={selectedSwap}
                      onChange={(e) => setSelectedSwap(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    >
                      <option value="">Choose a swap...</option>
                      {completedSwaps
                        .filter(swap => !hasEndorsedSwap(swap.id))
                        .map(swap => (
                          <option key={swap.id} value={swap.id}>
                            {swap.title} - {swap.completedAt.toLocaleDateString()}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rate Your Experience
                    </label>
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setEndorsementRating(star)}
                          onMouseEnter={() => setHoveredRating(star)}
                          onMouseLeave={() => setHoveredRating(0)}
                          className="focus:outline-none"
                        >
                          <svg
                            className={`w-8 h-8 ${
                              star <= (hoveredRating || endorsementRating)
                                ? 'text-yellow-400'
                                : 'text-gray-300'
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {hoveredRating === 0
                        ? endorsementRating === 0
                          ? 'Select a rating'
                          : `${endorsementRating} star${endorsementRating === 1 ? '' : 's'}`
                        : `${hoveredRating} star${hoveredRating === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Describe Your Experience
                    </label>
                    <textarea
                      value={endorsementReview}
                      onChange={(e) => setEndorsementReview(e.target.value)}
                      placeholder="Share your experience working with this person..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      rows={4}
                      required
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2 mt-6">
                    <button
                      onClick={() => setShowEndorseModal(false)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEndorse}
                      disabled={!selectedSwap || !endorsementReview.trim() || endorsementRating === 0 || isEndorsing}
                      className={`px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white ${
                        !selectedSwap || !endorsementReview.trim() || endorsementRating === 0 || isEndorsing
                          ? 'bg-indigo-400 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                      }`}
                    >
                      {isEndorsing ? 'Endorsing...' : 'Submit Endorsement'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* About Me Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-md p-6 relative">
            {/* About Me Section: always show pencil in edit mode, even if no about info */}
            <h2 className="text-2xl font-bold text-gray-900 mb-4">About Me</h2>
            {isOwnProfile && editMode && !editingAbout && (
              <button
                className="absolute top-4 right-4 bg-white rounded-full p-2 shadow hover:bg-indigo-100 transition"
                onClick={() => setEditingAbout(true)}
                aria-label="Edit about"
              >
                <Pencil className="h-5 w-5 text-indigo-600" />
              </button>
            )}
            {/* If editingAbout, show form for bio/skills with save/cancel */}
            {editingAbout ? (
              <form onSubmit={handleEditSubmit(async (data) => { await onSubmitEditProfile({ ...userProfile, bio: data.bio, skills: data.skills }); setEditingAbout(false); })} className="space-y-4">
                <textarea
                  id="edit-bio"
                  rows={4}
                  {...editRegister('bio')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Tell others about yourself and your skills"
                ></textarea>
                <input
                  id="edit-skills"
                  type="text"
                  {...editRegister('skills')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="React, JavaScript, Node.js, Design (comma separated)"
                />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setEditingAbout(false)} className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">Cancel</button>
                  <button type="submit" className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">Save</button>
                </div>
              </form>
            ) : (
              <div className="prose max-w-none">
                <p className="text-gray-700">{userProfile.bio}</p>
                {userProfile.skills && userProfile.skills.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {userProfile.skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Feed Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Activity Feed</h2>
              {isOwnProfile && (
                <button
                  onClick={() => setShowPostModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  New Post
                </button>
              )}
            </div>
            {feedLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : feedPosts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No posts yet. {isOwnProfile ? "Share something with your network!" : "This user hasn't posted anything yet."}
              </div>
            ) : (
              <div className={`space-y-6 pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 ${feedPosts.length > 3 ? 'h-[600px] overflow-y-auto' : ''}`}>
                {feedPosts.map((post) => (
                  <div key={post.id} id={`post-${post.id}`} className="bg-white rounded-2xl shadow-lg p-6 flex flex-col gap-4 hover:shadow-xl transition-all border border-gray-100">
                    {/* Top: Avatar, Name, Timestamp */}
                    <div className="flex items-center gap-3">
                      <Link href={`/profile/${post.userId}`} className="flex-shrink-0">
                        <ProfileAvatar 
                          src={post.photoURL} 
                          alt={post.displayName} 
                          size={44}
                          className="border border-gray-200"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${post.userId}`} className="font-semibold text-gray-900 text-base leading-tight truncate hover:text-indigo-600 transition-colors">
                          {post.displayName}
                          <VerificationBadge userId={post.userId} className="h-5 w-5 align-text-bottom" />
                        </Link>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {post.createdAt && typeof post.createdAt.toDate === 'function'
                            ? post.createdAt.toDate().toLocaleString()
                            : post.createdAt && typeof post.createdAt === 'number'
                            ? new Date(post.createdAt).toLocaleString()
                            : ''}
                        </div>
                      </div>
                      {(user && post.userId === user.uid) && (
                        <button onClick={() => handleDeletePost(post)} className="text-gray-300 hover:text-red-500 p-2 rounded-full transition">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                    {/* Content */}
                    <div className="text-gray-800 text-[15px] mb-3 whitespace-pre-line">
                      {formatDisplayText(post.content)}
                    </div>
                    {/* Images grid (if any) */}
                    {post.imageUrl && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          className="p-0 m-0 border-none bg-transparent cursor-pointer w-full h-56"
                          onClick={() => setMaximizedImage(post.imageUrl)}
                          aria-label="View image larger"
                        >
                          <Image
                            src={String(post.imageUrl || '/default-image.png')}
                            alt="Post image"
                            width={600}
                            height={340}
                            className="object-cover w-full h-56 rounded-xl border border-gray-100"
                          />
                        </button>
                      </div>
                    )}
                    {/* Actions row */}
                    <div className="flex items-center justify-between mt-2 text-gray-500 text-sm">
                      <div className="flex items-center gap-4">
                        <button onClick={() => handleLike(post.id)} className={`flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 transition ${post.likes?.includes(user?.uid || '') ? 'text-indigo-600' : ''}`}>
                          <ThumbsUp className="h-5 w-5" />
                          <span>{post.likes?.length || 0}</span>
                        </button>
                        <button onClick={() => setShowComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))} className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 transition">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.8l-4 1 1-4A8.96 8.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          <span>{post.comments?.length || 0}</span>
                        </button>
                        {/* Emoji reactions */}
                        <div className="flex items-center gap-1">
                          {Object.entries(post.emoji || {}).map(([emoji, userIds]) => {
                            const typedUserIds = userIds as string[];
                            return (
                              <button key={emoji} onClick={() => handleEmoji(post.id, emoji)} className={`flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 transition ${typedUserIds.includes(user?.uid || '') ? 'bg-indigo-100 text-indigo-600' : ''}`}>
                                <span>{emoji}</span>
                                <span className="text-xs">{typedUserIds.length}</span>
                              </button>
                            );
                          })}
                          <div className="relative">
                            <button onClick={() => setShowEmojiPicker(prev => ({ ...prev, [post.id]: !prev[post.id] }))} className="text-gray-400 hover:text-indigo-600 p-1 rounded-full transition">
                              <Smile className="h-5 w-5" />
                            </button>
                            {showEmojiPicker[post.id] && (
                              <div className="absolute z-10 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 p-3 w-64">
                                <div className="grid grid-cols-4 gap-2">
                                  {emojiList.map((emoji) => (
                                    <button key={emoji} onClick={() => handleEmoji(post.id, emoji)} className="p-2 hover:bg-indigo-50 rounded-lg transition-colors duration-200 flex items-center justify-center text-xl hover:scale-110 transform">{emoji}</button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Save (placeholders for now) */}
                      <div className="flex items-center gap-3">
                        <button className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 transition">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5v14l7-7 7 7V5a2 2 0 00-2-2H7a2 2 0 00-2 2z" /></svg>
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                    {/* Comments section (toggle) */}
                    {showComments[post.id] && (
                      <div className="mt-4 space-y-4">
                        {post.comments?.map((comment: Comment) => (
                          <div key={comment.id} className="flex space-x-3">
                            <Link href={`/profile/${comment.userId}`} className="flex-shrink-0">
                              <ProfileAvatar 
                                src={comment.photoURL} 
                                alt={comment.displayName} 
                                size={32}
                              />
                            </Link>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div>
                                  <Link href={`/profile/${comment.userId}`} className="font-semibold text-gray-900 hover:text-indigo-600">
                                    {comment.displayName}
                                    <VerificationBadge userId={comment.userId} className="h-3 w-3 align-text-bottom" />
                                  </Link>
                                  <p className="text-sm text-gray-500">
                                    {comment.createdAt && typeof comment.createdAt.toDate === 'function' ? comment.createdAt.toDate().toLocaleDateString() : ''}
                                  </p>
                                </div>
                                {(user && comment.userId === user.uid) && (
                                  <button
                                    onClick={() => handleDeleteComment(post.id, comment.id)}
                                    className="text-gray-400 hover:text-red-500"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              <div className="text-gray-700">
                                {formatDisplayText(comment.text)}
                              </div>
                              <div className="mt-2 flex items-center space-x-4">
                                <button
                                  onClick={() => handleLikeComment(post.id, comment.id)}
                                  className={`flex items-center space-x-1 ${user?.uid && comment.likes?.includes(user.uid) ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                  <span className="text-sm">{comment.likes?.length || 0}</span>
                                </button>
                                <div className="flex items-center space-x-2">
                                  {Object.entries(comment.emoji || {}).map(([emoji, userIds]) => {
                                    const typedUserIds = userIds as string[];
                                    return (
                                      <button
                                        key={emoji}
                                        onClick={() => handleCommentEmoji(post.id, comment.id, emoji)}
                                        className={`flex items-center space-x-1 px-2 py-1 rounded-full ${
                                          typedUserIds.includes(user?.uid || '') ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                      >
                                        <span>{emoji}</span>
                                        <span className="text-sm">{typedUserIds.length}</span>
                                      </button>
                                    );
                                  })}
                                  <div className="relative">
                                    <button
                                      onClick={() => setShowCommentEmojiPicker(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                                      className="text-gray-500 hover:text-indigo-600"
                                    >
                                      <Smile className="h-4 w-4" />
                                    </button>
                                    {showCommentEmojiPicker[comment.id] && (
                                      <div className="absolute z-10 top-6 left-0 bg-white rounded-xl shadow-lg border border-gray-100 p-3 w-48">
                                        <div className="grid grid-cols-3 gap-2">
                                          {emojiList.map((emoji) => (
                                            <button
                                              key={emoji}
                                              onClick={() => handleCommentEmoji(post.id, comment.id, emoji)}
                                              className="p-2 hover:bg-indigo-50 rounded-lg transition-colors duration-200 flex items-center justify-center text-xl hover:scale-110 transform"
                                            >
                                              {emoji}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => setShowReplyBox(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                                  className="text-gray-500 hover:text-indigo-600 text-sm"
                                >
                                  Reply
                                </button>
                              </div>
                              {showReplyBox[comment.id] && (
                                <div className="mt-2">
                                  <MentionInput
                                    value={replyInputs[comment.id] || ''}
                                    onChange={(value) => setReplyInputs(prev => ({ ...prev, [comment.id]: value }))}
                                    placeholder="Write a reply... Type @ to mention someone"
                                    rows={2}
                                    className="w-full"
                                  />
                                  <div className="mt-2 flex justify-end">
                                    <button
                                      onClick={() => handleAddReply(post.id, comment.id)}
                                      disabled={!replyInputs[comment.id]?.trim()}
                                      className={`px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white ${
                                        !replyInputs[comment.id]?.trim()
                                          ? 'bg-indigo-400 cursor-not-allowed'
                                          : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                                      }`}
                                    >
                                      Post Reply
                                    </button>
                                  </div>
                                </div>
                              )}
                              {comment.replies && comment.replies.length > 0 && (
                                <div className="mt-2 space-y-2">
                                  {comment.replies.map((reply: Reply) => (
                                    <div key={reply.id} className="flex space-x-3 pl-8">
                                      <Link href={`/profile/${reply.userId}`} className="flex-shrink-0">
                                        <ProfileAvatar 
                                          src={reply.photoURL} 
                                          alt={reply.displayName} 
                                          size={24}
                                        />
                                      </Link>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <Link href={`/profile/${reply.userId}`} className="font-semibold text-gray-900 hover:text-indigo-600">
                                              {reply.displayName}
                                              <VerificationBadge userId={reply.userId} className="h-3 w-3 align-text-bottom" />
                                            </Link>
                                            <p className="text-sm text-gray-500">
                                              {reply.createdAt && typeof reply.createdAt.toDate === 'function' ? reply.createdAt.toDate().toLocaleDateString() : ''}
                                            </p>
                                          </div>
                                          {(user && reply.userId === user.uid) && (
                                            <button
                                              onClick={() => handleDeleteReply(post.id, comment.id, reply.id)}
                                              className="text-gray-400 hover:text-red-500"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </button>
                                          )}
                                        </div>
                                        <div className="text-gray-700 text-sm">
                                          {formatDisplayText(reply.text)}
                                        </div>
                                        <div className="mt-2 flex items-center space-x-3">
                                          <button
                                            onClick={() => handleLikeReply(post.id, comment.id, reply.id)}
                                            className={`flex items-center space-x-1 ${
                                              user?.uid && reply.likes?.includes(user.uid) ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'
                                            }`}
                                          >
                                            <ThumbsUp className="h-3 w-3" />
                                            <span className="text-xs">{reply.likes?.length || 0}</span>
                                          </button>
                                          <div className="flex items-center space-x-2">
                                            {Object.entries(reply.emoji || {}).map(([emoji, userIds]) => {
                                              const typedUserIds = userIds as string[];
                                              return (
                                                <button
                                                  key={emoji}
                                                  onClick={() => handleReplyEmoji(post.id, comment.id, reply.id, emoji)}
                                                  className={`flex items-center space-x-1 px-1.5 py-0.5 rounded-full ${
                                                    typedUserIds.includes(user?.uid || '') ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                  }`}
                                                >
                                                  <span>{emoji}</span>
                                                  <span className="text-xs">{typedUserIds.length}</span>
                                                </button>
                                              );
                                            })}
                                            <div className="relative">
                                              <button
                                                onClick={() => setShowReplyEmojiPicker(prev => ({ ...prev, [reply.id]: !prev[reply.id] }))}
                                                className="text-gray-500 hover:text-indigo-600"
                                              >
                                                <Smile className="h-3 w-3" />
                                              </button>
                                              {showReplyEmojiPicker[reply.id] && (
                                                <div className="absolute z-10 top-5 left-0 bg-white rounded-xl shadow-lg border border-gray-100 p-2 w-40">
                                                  <div className="grid grid-cols-3 gap-1">
                                                    {emojiList.map((emoji) => (
                                                      <button
                                                        key={emoji}
                                                        onClick={() => handleReplyEmoji(post.id, comment.id, reply.id, emoji)}
                                                        className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors duration-200 flex items-center justify-center text-sm hover:scale-110 transform"
                                                      >
                                                        {emoji}
                                                      </button>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {/* Always-visible comment input */}
                        {user && (
                          <div className="mt-4">
                            <MentionInput
                              value={commentInputs[post.id] || ''}
                              onChange={(value) => setCommentInputs(prev => ({ ...prev, [post.id]: value }))}
                              placeholder="Write a comment... Type @ to mention someone"
                              rows={2}
                              className="w-full"
                            />
                            <div className="mt-2 flex justify-end">
                              <button
                                onClick={() => handleAddComment(post.id)}
                                disabled={!commentInputs[post.id]?.trim()}
                                className={`px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white ${!commentInputs[post.id]?.trim() ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
                              >
                                Post Comment
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div> {/* end feed container */}
        </div> {/* end feed section */}

        {/* Portfolio section */}
        {userProfile.portfolio && userProfile.portfolio.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Portfolio</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userProfile.portfolio.map((item, index) => (
                  <div 
                    key={index} 
                    className="border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group"
                    onClick={() => setMaximizedImage(item.imageUrl)}
                  >
                    <div className="relative h-48 overflow-hidden">
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        className="object-cover transform group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-lg text-gray-900 mb-2">{item.title}</h3>
                      <p className="text-gray-600 text-sm">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* What My Swappers are Saying section */}
        {endorsements.length > 0 && (
          <div
            ref={endorsementsSectionRef}
            id="endorsements-section"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative"
          >
            <div className="bg-white rounded-xl shadow-md p-6 relative">
              <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">What My Swappers are Saying</h2>
              {/* Arrow buttons for carousel navigation */}
              <button
                type="button"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white bg-opacity-80 rounded-full shadow p-2 hover:bg-indigo-100 transition"
                style={{ display: endorsements.length > reviewsPerPage ? 'block' : 'none' }}
                onClick={() => scrollEndorsements('left')}
                aria-label="Scroll left"
              >
                <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white bg-opacity-80 rounded-full shadow p-2 hover:bg-indigo-100 transition"
                style={{ display: endorsements.length > reviewsPerPage ? 'block' : 'none' }}
                onClick={() => scrollEndorsements('right')}
                aria-label="Scroll right"
              >
                <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
              <div className="relative">
                <div ref={endorsementsRowRef} className="flex gap-6 overflow-x-auto pb-2 hide-scrollbar scroll-smooth">
                  {endorsements.map(endorsement => (
                    <div key={endorsement.id} className="bg-white rounded-lg p-6 hover:shadow-lg transition-all duration-200 min-w-[360px] max-w-xs flex-shrink-0">
                      <div className="flex items-center mb-4">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg
                            key={star}
                            className={`w-5 h-5 ${star <= endorsement.rating ? 'text-yellow-400' : 'text-gray-200'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <p className="text-gray-700 mb-4">{endorsement.review}</p>
                      <div className="flex items-center">
                        <Link href={`/profile/${endorsement.fromUserId}`} className="flex-shrink-0">
                          <ProfileAvatar
                            src={endorsement.fromUserPhoto}
                            alt={endorsement.fromUserName}
                            size={40}
                            className="mr-3"
                          />
                        </Link>
                        <div className="flex-1">
                          <Link
                            href={`/profile/${endorsement.fromUserId}`}
                            className="font-semibold text-indigo-600 hover:text-indigo-700 block"
                          >
                            {endorsement.fromUserName}
                          </Link>
                          <span className="text-sm text-gray-500">
                            {endorsement.createdAt.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Services section */}
        {userServices.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
            <div className="bg-white rounded-xl shadow-md p-6 relative">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Live Services</h2>
              {/* Arrow buttons */}
              <button
                type="button"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white bg-opacity-80 rounded-full shadow p-2 hover:bg-indigo-100 transition"
                style={{ display: userServices.length > 3 ? 'block' : 'none' }}
                onClick={() => scrollListings('left')}
                aria-label="Scroll left"
              >
                <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white bg-opacity-80 rounded-full shadow p-2 hover:bg-indigo-100 transition"
                style={{ display: userServices.length > 3 ? 'block' : 'none' }}
                onClick={() => scrollListings('right')}
                aria-label="Scroll right"
              >
                <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
              <div ref={listingsRowRef} className="flex gap-6 overflow-x-auto pb-2 hide-scrollbar scroll-smooth">
                {userServices.map((service) => (
                  <div
                    key={service.id}
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 min-w-[320px] max-w-xs flex-shrink-0 cursor-pointer"
                    onClick={() => setSelectedService(service)}
                  >
                    {service.images && service.images.length > 0 && (
                      <div className="relative h-48 overflow-hidden">
                        <Image
                          src={service.images[0]}
                          alt={service.title}
                          fill
                          className="object-cover transform group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg text-gray-900 truncate">{service.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(service.category)}`}>{service.category}</span>
                      </div>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{service.description}</p>
                      <div className="flex items-center text-sm text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {service.location}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Modal for extended view */}
        {selectedService && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={() => setSelectedService(null)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-8 relative" onClick={e => e.stopPropagation()}>
              <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-700" onClick={() => setSelectedService(null)}>
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-lg font-medium mr-3">
                  {userProfile?.displayName?.charAt(0) || 'U'}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{userProfile?.displayName}</div>
                  <div className="text-sm text-gray-500">{selectedService.location}</div>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedService.title}</h2>
              <div className="mb-3 text-sm text-gray-500">Category: <span className="font-medium text-indigo-700">{selectedService.category}</span></div>
              <p className="text-base text-gray-700 mb-4 whitespace-pre-line">{selectedService.description}</p>
              {/* Show servicesWanted if present */}
              {selectedService.servicesWanted && selectedService.servicesWanted.length > 0 && (
                <div className="mb-4">
                  <div className="font-semibold text-gray-900 mb-1">Looking for:</div>
                  <ul className="list-disc pl-5 space-y-1 text-gray-700">
                    {selectedService.servicesWanted.map((wanted, i) => (
                      <li key={i}>{wanted}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedService.images && selectedService.images.length > 0 && (
                <div className="mb-4 grid grid-cols-1 gap-2">
                  {selectedService.images.map((img, i) => (
                    <div key={i} className="relative h-40 rounded-lg overflow-hidden">
                      <Image src={img} alt={selectedService.title + ' image'} fill className="object-cover" />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end mt-6">
                <button onClick={() => setSelectedService(null)} className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Image maximization modal */}
        {maximizedImage && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
            onClick={() => setMaximizedImage(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh] w-full h-full">
              <Image
                src={maximizedImage}
                alt="Maximized image"
                fill
                className="object-contain"
              />
              <button
                className="absolute top-4 right-4 text-white hover:text-gray-300"
                onClick={() => setMaximizedImage(null)}
              >
                <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* New Post Modal */}
        {showPostModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-2xl mx-4 animate-appear">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Create New Post</h3>
                <button
                  onClick={() => setShowPostModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="Close"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handlePostSubmit}>
                <div className="mb-4">
                  <MentionInput
                    value={newPostContent}
                    onChange={(value) => setNewPostContent(value)}
                    placeholder="What's on your mind? Type @ to mention someone..."
                    rows={4}
                    className=""
                  />
                </div>
                
                {newPostImagePreview && (
                  <div className="relative mb-4">
                    <Image
                      src={newPostImagePreview}
                      alt="Preview"
                      width={400}
                      height={300}
                      className="max-h-60 rounded-lg object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setNewPostImage(null);
                        setNewPostImagePreview(null);
                      }}
                      className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-1 text-white hover:bg-opacity-70"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {newPostLinkPreview && (
                  <div className="mb-4 border rounded-lg overflow-hidden">
                    <div className="p-3">
                      <h4 className="font-medium text-gray-900">{newPostLinkPreview.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">{newPostLinkPreview.description}</p>
                    </div>
                    {newPostLinkPreview.image && (
                      <div className="relative h-40">
                        <Image
                          src={newPostLinkPreview.image}
                          alt={newPostLinkPreview.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <label className="flex items-center text-indigo-600 hover:text-indigo-700 cursor-pointer">
                    <LucideImage className="h-5 w-5 mr-2" />
                    <span className="text-sm font-medium">Add Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  
                  <button
                    type="submit"
                    disabled={(!newPostContent.trim() && !newPostImage) || posting}
                    className={`px-4 py-2 rounded-md text-white font-medium ${
                      (!newPostContent.trim() && !newPostImage) || posting
                        ? 'bg-indigo-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {posting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Post Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Post</h3>
              <p className="text-gray-500 mb-6">Are you sure you want to delete this post? This action cannot be undone.</p>
              
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeletePost}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Connections Modal */}
        {connectionsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-lg relative animate-scaleup-avatar max-h-[80vh] overflow-y-auto">
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
                onClick={() => setConnectionsModalOpen(false)}
                aria-label="Close"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h3 className="text-xl font-bold mb-4 text-gray-900 flex items-center gap-2">
                <LucideUsers className="h-6 w-6 text-indigo-600" /> Connections
              </h3>
              {/* Tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  className={`px-4 py-2 rounded-t-lg font-semibold focus:outline-none transition border-b-2 ${connectionsTab === 'all' ? 'border-indigo-600 text-indigo-700 bg-indigo-50' : 'border-transparent text-gray-500 bg-gray-100 hover:bg-indigo-50'}`}
                  onClick={() => setConnectionsTab('all')}
                  type="button"
                >
                  All Connections
                </button>
                <button
                  className={`px-4 py-2 rounded-t-lg font-semibold focus:outline-none transition border-b-2 ${connectionsTab === 'mutual' ? 'border-indigo-600 text-indigo-700 bg-indigo-50' : 'border-transparent text-gray-500 bg-gray-100 hover:bg-indigo-50'} ${!user ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={() => user && setConnectionsTab('mutual')}
                  type="button"
                  disabled={!user}
                >
                  Mutual Connections
                </button>
              </div>
              {/* Tab Content */}
              {connectionsTab === 'mutual' ? (
                user ? (
                  mutualConnections.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {mutualConnections.map(uid => {
                        const info = connectionsUserInfo[uid];
                        if (!info) return null;
                        const isViewer = user && user.uid === uid;
                        const alreadyConnected = user && viewerConnections.some(conn => conn.users.includes(uid));
                        return (
                          <div key={uid} className="flex items-center gap-3 bg-indigo-50 rounded-lg px-3 py-2">
                            <Link href={`/profile/${uid}`} className="flex-shrink-0">
                              <ProfileAvatar 
                                src={info.photoURL} 
                                alt={info.displayName || 'User'} 
                                size={40}
                              />
                            </Link>
                            <div className="flex-1 min-w-0">
                              <Link href={`/profile/${uid}`} className="font-medium text-indigo-900 hover:text-indigo-700 transition">
                                {info.displayName || 'User'}
                              </Link>
                              <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">Mutual</span>
                            </div>
                            {!isViewer && user && (
                              alreadyConnected ? (
                                <button className="flex items-center gap-1 px-3 py-1 rounded bg-green-100 text-green-700 text-xs font-semibold cursor-default" disabled>
                                  <UserCheck className="h-4 w-4" /> Connected
                                </button>
                              ) : (
                                <button
                                  className="flex items-center gap-1 px-3 py-1 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
                                  onClick={() => handleConnectWithConnection(uid)}
                                  disabled={!!connectingId}
                                >
                                  {connectingId === uid ? (
                                    <span className="animate-spin h-4 w-4 mr-1 border-t-2 border-b-2 border-white rounded-full"></span>
                                  ) : (
                                    <UserPlus className="h-4 w-4" />
                                  )}
                                  Connect
                                </button>
                              )
                            )}
                            {isViewer && user && (
                              <span className="text-xs text-gray-400">You</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-gray-500 text-center">No mutual connections.</div>
                  )
                ) : (
                  <div className="text-gray-400 text-center py-8">Sign in to see mutual connections.</div>
                )
              ) : (
                <div className="flex flex-col gap-3">
                  {profileConnections.length === 0 && (
                    <div className="text-gray-500 text-center">No connections yet.</div>
                  )}
                  {profileConnections.flatMap(conn => conn.users.filter((id: string) => id !== userId)).map(uid => {
                    const info = connectionsUserInfo[uid];
                    if (!info) return null;
                    const isMutual = user && mutualConnections.includes(uid);
                    const isViewer = user && user.uid === uid;
                    const alreadyConnected = user && viewerConnections.some(conn => conn.users.includes(uid));
                    return (
                      <div key={uid} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                        <Link href={`/profile/${uid}`} className="flex-shrink-0">
                          <ProfileAvatar 
                            src={info.photoURL} 
                            alt={info.displayName || 'User'} 
                            size={40}
                          />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link href={`/profile/${uid}`} className="font-medium text-gray-900 hover:text-indigo-700 transition">
                            {info.displayName || 'User'}
                          </Link>
                          {isMutual && <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">Mutual</span>}
                        </div>
                        {!isViewer && user && (
                          alreadyConnected ? (
                            <button className="flex items-center gap-1 px-3 py-1 rounded bg-green-100 text-green-700 text-xs font-semibold cursor-default" disabled>
                              <UserCheck className="h-4 w-4" /> Connected
                            </button>
                          ) : (
                            <button
                              className="flex items-center gap-1 px-3 py-1 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
                              onClick={() => handleConnectWithConnection(uid)}
                              disabled={!!connectingId}
                            >
                              {connectingId === uid ? (
                                <span className="animate-spin h-4 w-4 mr-1 border-t-2 border-b-2 border-white rounded-full"></span>
                              ) : (
                                <UserPlus className="h-4 w-4" />
                              )}
                              Connect
                            </button>
                          )
                        )}
                        {isViewer && user && (
                          <span className="text-xs text-gray-400">You</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
 
 

        {/* Connection Request Popup */}
        {connectionRequestPopupOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
            onClick={() => setConnectionRequestPopupOpen(false)} // Close when clicking outside
          >
            <div 
              className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl"
              onClick={e => e.stopPropagation()} // Prevent closing when clicking inside the popup
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Connection Request</h3>
              <p className="text-gray-600 mb-6">
                Your connection request to {userProfile?.displayName} is pending. Would you like to cancel it?
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setConnectionRequestPopupOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Close
                </button>
                <button
                  onClick={handleCancelRequest}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  Cancel Request
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Avatar Edit Modal */}
        {editingAvatar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Profile Picture</h3>
              
              <div className="flex flex-col items-center mb-4">
                {editImagePreview ? (
                  <div className="relative h-32 w-32 rounded-full overflow-hidden mb-4">
                    <Image
                      src={editImagePreview}
                      alt="Profile preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center mb-4">
                    <span className="text-gray-400 text-4xl">{userProfile?.displayName?.charAt(0)?.toUpperCase() || 'U'}</span>
                  </div>
                )}
                
                <div className="flex flex-col items-center">
                  <label
                    htmlFor="avatar-upload"
                    className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Select Image
                    <input
                      id="avatar-upload"
                      name="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleEditImageChange}
                    />
                  </label>
                  <p className="mt-2 text-xs text-gray-500">
                    JPG, PNG or GIF. Max 5MB.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditImagePreview(user?.photoURL || null);
                    setEditImage(null);
                    setEditingAvatar(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editImage) {
                      onSubmitEditProfile({ photoURL: editImage });
                    }
                    setEditingAvatar(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                  disabled={!editImage}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Banner Edit Modal */}
        {editingBanner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Profile Banner</h3>
              
              <div className="flex flex-col items-center mb-4">
                {editBannerPreview ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden mb-4">
                    <Image
                      src={editBannerPreview}
                      alt="Banner preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-40 rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center mb-4">
                    <span className="text-white text-lg">Banner Preview</span>
                  </div>
                )}
                
                <div className="flex flex-col items-center">
                  <label
                    htmlFor="banner-upload"
                    className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Select Banner Image
                    <input
                      id="banner-upload"
                      name="banner-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleEditBannerChange}
                    />
                  </label>
                  <p className="mt-2 text-xs text-gray-500">
                    Recommended size: 1920 x 400 pixels. JPG, PNG or GIF. Max 10MB.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditBannerPreview(userProfile?.bannerImage || null);
                    setEditBanner(null);
                    setEditingBanner(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editBanner) {
                      onSubmitEditProfile({ bannerImage: editBanner });
                    }
                    setEditingBanner(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                  disabled={!editBanner}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}