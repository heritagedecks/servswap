'use client';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/app/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, setDoc, deleteDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { Smile, ThumbsUp, Trash2, Pencil, CheckCircle } from 'lucide-react';
import React from 'react';
import Header from '../components/Header';
import { useRouter } from 'next/navigation';
import MentionInput, { extractMentions, formatDisplayText } from '../components/MentionInput';
import { createNotification, createMentionNotifications } from '../lib/notifications';
import { getUserSubscription, getAllUserSubscriptions } from '../lib/subscriptions';
import { isSubscriptionActive, SubscriptionData } from '../lib/stripe';
import { getStorage } from 'firebase/storage';
import { app } from '@/app/lib/firebase';
import ProfileAvatar from '../components/ProfileAvatar';

interface Post {
  id: string;
  userId: string;
  displayName: string;
  photoURL: string;
  content: string;
  createdAt: any;
  imageUrl?: string;
  likes: string[];
  emoji: { [emoji: string]: string[] };
  comments: Comment[];
}

interface Comment {
  id: string;
  userId: string;
  displayName: string;
  photoURL: string;
  text: string;
  createdAt: any;
  likes: string[];
  emoji: { [emoji: string]: string[] };
  replies: Reply[];
}

interface Reply {
  id: string;
  userId: string;
  displayName: string;
  photoURL: string;
  text: string;
  createdAt: any;
  likes: string[];
  emoji: { [emoji: string]: string[] };
}

const emojiList = ["👍", "🔥", "😂", "😍", "🎉", "😮", "😢", "👏", "💯"];

function hasActiveMainPlan(subscriptions: SubscriptionData[]): boolean {
  return subscriptions.some(
    (sub: SubscriptionData) => isSubscriptionActive(sub) && sub.planId !== 'verification'
  );
}

// Reusable badge component
const VerificationBadge = React.memo(function VerificationBadge({ userId, className = '' }: { userId: string, className?: string }) {
  const [active, setActive] = useState<boolean>(false);
  useEffect(() => {
    let mounted = true;
    async function fetchBadge() {
      if (!userId) return;
      try {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        const userData = userDocSnap.exists() ? userDocSnap.data() : null;
        const badge = userData?.verificationBadge;
        const shouldShow = !!(badge && badge.active);
        if (mounted) setActive(shouldShow);
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

export default function SwapFeedPage() {
  const { user, loading: authLoading, initialized } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState<{ [postId: string]: boolean }>({});
  const [showCommentEmojiPicker, setShowCommentEmojiPicker] = useState<{ [commentId: string]: boolean }>({});
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState<{ [replyId: string]: boolean }>({});
  const [showComments, setShowComments] = useState<{ [postId: string]: boolean }>({});
  const [showAllComments, setShowAllComments] = useState<{ [postId: string]: boolean }>({});
  const [showReplyBox, setShowReplyBox] = useState<{ [commentId: string]: boolean }>({});
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [replyInputs, setReplyInputs] = useState<{ [commentId: string]: string }>({});
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
  const [newPostImagePreview, setNewPostImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [maximizedImage, setMaximizedImage] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!initialized) {
      return; // Wait for auth to be fully initialized before any redirects
    }
    
    if (!user && !authLoading) {
      console.log('User not authenticated, redirecting to login');
      router.push('/auth/login');
    }
  }, [user, router, initialized, authLoading]);

  useEffect(() => {
    if (!user) {
      setPosts([]);
      setLoading(false);
      return;
    }
    
    const userId = user.uid;
    setLoading(true);
    async function fetchFeedPosts() {
      // 1. Fetch all connections for the user
      const connectionsQuery = query(
        collection(db, 'connections'),
        where('users', 'array-contains', userId),
        where('status', '==', 'connected')
      );
      const connectionsSnap = await getDocs(connectionsQuery);
      const connectionUserIds = connectionsSnap.docs
        .map(doc => doc.data().users)
        .flat()
        .filter((uid: string) => uid !== userId);
      // Add self
      const allUserIds = Array.from(new Set([...connectionUserIds, userId]));
      // 2. Fetch posts for each user from 'profilePosts'
      const postsArr: Post[] = [];
      await Promise.all(
        allUserIds.map(async (uid) => {
          const postsQuery = query(
            collection(db, 'profilePosts'),
            where('userId', '==', uid),
            orderBy('createdAt', 'desc')
          );
          const postsSnap = await getDocs(postsQuery);
          const posts = await Promise.all(postsSnap.docs.map(async (postDoc) => {
            const data = postDoc.data();
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
            // Fetch comments
            const commentsQuery = query(
              collection(db, 'profilePosts', postDoc.id, 'comments'),
              orderBy('createdAt', 'asc')
            );
            const commentsSnap = await getDocs(commentsQuery);
            const comments = await Promise.all(commentsSnap.docs.map(async (commentDoc) => {
              const commentData = commentDoc.data();
              // Fetch comment likes
              const commentLikesSnap = await getDocs(collection(db, 'profilePosts', postDoc.id, 'comments', commentDoc.id, 'likes'));
              const commentLikes = commentLikesSnap.docs.map(doc => doc.id);
              // Fetch comment emoji
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
                // Fetch reply likes
                const replyLikesSnap = await getDocs(collection(db, 'profilePosts', postDoc.id, 'comments', commentDoc.id, 'replies', replyDoc.id, 'likes'));
                const replyLikes = replyLikesSnap.docs.map(doc => doc.id);
                // Fetch reply emoji
                const replyEmojiSnap = await getDocs(collection(db, 'profilePosts', postDoc.id, 'comments', commentDoc.id, 'replies', replyDoc.id, 'emojiReactions'));
                const replyEmojiData: { [emoji: string]: string[] } = {};
                replyEmojiSnap.docs.forEach(emojiDoc => {
                  const { emoji, userId } = emojiDoc.data();
                  if (!replyEmojiData[emoji]) replyEmojiData[emoji] = [];
                  replyEmojiData[emoji].push(userId);
                });
                return {
                  id: replyDoc.id,
                  userId: replyData.userId,
                  displayName: replyData.displayName || 'User',
                  photoURL: replyData.photoURL || '/default-avatar.png',
                  text: replyData.text || '',
                  createdAt: replyData.createdAt,
                  likes: replyLikes,
                  emoji: replyEmojiData
                };
              }));
              return {
                id: commentDoc.id,
                userId: commentData.userId,
                displayName: commentData.displayName || 'User',
                photoURL: commentData.photoURL || '/default-avatar.png',
                text: commentData.text || '',
                createdAt: commentData.createdAt,
                likes: commentLikes,
                emoji: commentEmojiData,
                replies
              };
            }));
            return {
              id: postDoc.id,
              userId: data.userId,
              displayName: data.displayName || 'User',
              photoURL: data.photoURL || '/default-avatar.png',
              content: data.content || '',
              createdAt: data.createdAt,
              imageUrl: data.imageUrl || undefined,
              likes,
              emoji: emojiData,
              comments
            };
          }));
          postsArr.push(...posts);
        })
      );
      // 3. Fetch user info for all unique userIds in posts
      const uniqueUserIds = Array.from(new Set(postsArr.map(post => post.userId)));
      const userInfoMap: { [uid: string]: { displayName: string; photoURL: string } } = {};
      await Promise.all(
        uniqueUserIds.map(async (uid) => {
          try {
            const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
            let displayName = 'User';
            let photoURL = '/default-avatar.png';
            if (!userDoc.empty) {
              const data = userDoc.docs[0].data();
              displayName = data.displayName || 'User';
              photoURL = data.photoURL || '/default-avatar.png';
            }
            userInfoMap[uid] = { displayName, photoURL };
          } catch {
            userInfoMap[uid] = { displayName: 'User', photoURL: '/default-avatar.png' };
          }
        })
      );
      // 4. Merge user info into posts
      const postsWithUserInfo = postsArr.map(post => ({
        ...post,
        displayName: userInfoMap[post.userId]?.displayName || post.displayName,
        photoURL: userInfoMap[post.userId]?.photoURL || post.photoURL,
      }));
      // 5. Sort posts by createdAt descending
      postsWithUserInfo.sort((a, b) => b.createdAt - a.createdAt);
      setPosts(postsWithUserInfo);
      setLoading(false);
    }
    
    console.log('Fetching feed posts for user:', userId);
    fetchFeedPosts();
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      const checkSub = async () => {
        const allSubs = await getAllUserSubscriptions(user.uid);
        if (!allSubs.length) {
          console.warn('No subscriptions found for user', user.uid);
        }
        const hasMain = hasActiveMainPlan(allSubs);
        if (!hasMain) {
          window.location.href = '/pricing';
        }
      };
      checkSub();
    }
  }, [user, authLoading]);

  // Like/unlike post
  const handleLike = async (postId: string) => {
    if (!user) return;
    const likeRef = doc(db, 'profilePosts', postId, 'likes', user.uid);
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const hasLiked = post.likes?.includes(user.uid || '');
    try {
      if (hasLiked) {
        await deleteDoc(likeRef);
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes.filter((id: string) => id !== user.uid) } : p));
      } else {
        await setDoc(likeRef, { userId: user.uid });
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: [...(p.likes || []), user.uid] } : p));
        
        // Create notification for post owner when someone likes their post
        if (post.userId !== user.uid) {
          await createNotification({
            userId: post.userId,
            type: 'like',
            senderId: user.uid,
            senderName: user.displayName || 'User',
            message: `${user.displayName || 'User'} liked your post`,
            postId,
            link: `/profile/${post.userId}?postId=${postId}`
          });
        }
      }
    } catch (error) { console.error('Error handling like:', error); }
  };

  // Emoji reaction on post
  const handleEmoji = async (postId: string, emoji: string) => {
    if (!user) return;
    const emojiRef = doc(db, 'profilePosts', postId, 'emojiReactions', `${emoji}_${user.uid}`);
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const hasReacted = post.emoji?.[emoji]?.includes(user.uid || '');
    try {
      if (hasReacted) {
        await deleteDoc(emojiRef);
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            const updatedEmoji = { ...p.emoji };
            if (updatedEmoji[emoji]) {
              updatedEmoji[emoji] = updatedEmoji[emoji].filter((id: string) => id !== user.uid);
              if (updatedEmoji[emoji].length === 0) delete updatedEmoji[emoji];
            }
            return { ...p, emoji: updatedEmoji };
          }
          return p;
        }));
      } else {
        await setDoc(emojiRef, { emoji, userId: user.uid });
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            const updatedEmoji = { ...p.emoji };
            if (!updatedEmoji[emoji]) updatedEmoji[emoji] = [];
            if (!updatedEmoji[emoji].includes(user.uid)) updatedEmoji[emoji].push(user.uid);
            return { ...p, emoji: updatedEmoji };
          }
          return p;
        }));
        
        // Create notification for post owner when someone reacts with an emoji
        if (post.userId !== user.uid) {
          await createNotification({
            userId: post.userId,
            type: 'like',
            senderId: user.uid,
            senderName: user.displayName || 'User',
            message: `${user.displayName || 'User'} reacted with ${emoji} to your post`,
            postId,
            link: `/profile/${post.userId}?postId=${postId}`
          });
        }
      }
      setShowEmojiPicker(prev => ({ ...prev, [postId]: false }));
    } catch (error) { console.error('Error handling emoji:', error); }
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
      photoURL: String(user?.photoURL || '/default-avatar.png')
    };
    const docRef = await addDoc(commentRef, newComment);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), { id: docRef.id, ...newComment, likes: [], emoji: {}, replies: [] }] } : p));
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    setShowComments(prev => ({ ...prev, [postId]: true }));
    
    // Process mentions and create notifications
    try {
      const post = posts.find(p => p.id === postId);
      if (post) {
        // Create notification for post owner if it's not the commenter
        if (post.userId !== user.uid) {
          await createNotification({
            userId: post.userId,
            type: 'comment',
            senderId: user.uid,
            senderName: user.displayName || 'User',
            message: `${user.displayName || 'User'} commented on your post`,
            postId,
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
      }
    } catch (error) {
      console.error('Error processing comment notifications:', error);
    }
  };

  // Like/unlike comment
  const handleLikeComment = async (postId: string, commentId: string) => {
    if (!user) return;
    const likeRef = doc(db, 'profilePosts', postId, 'comments', commentId, 'likes', user.uid);
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const comment = post.comments.find((c: any) => c.id === commentId);
    if (!comment) return;
    const hasLiked = comment.likes?.includes(user.uid || '');
    try {
      if (hasLiked) {
        await deleteDoc(likeRef);
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          comments: p.comments.map((c: any) => c.id === commentId ? { ...c, likes: c.likes.filter((id: string) => id !== user.uid) } : c)
        } : p));
      } else {
        await setDoc(likeRef, { userId: user.uid });
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          comments: p.comments.map((c: any) => c.id === commentId ? { ...c, likes: [...(c.likes || []), user.uid] } : c)
        } : p));
        
        // Create notification for comment owner when someone likes their comment
        if (comment.userId !== user.uid) {
          await createNotification({
            userId: comment.userId,
            type: 'like',
            senderId: user.uid,
            senderName: user.displayName || 'User',
            message: `${user.displayName || 'User'} liked your comment`,
            postId,
            comment: comment.text,
            link: `/profile/${post.userId}?postId=${postId}`
          });
        }
      }
    } catch (error) { console.error('Error handling comment like:', error); }
  };

  // Emoji on comment
  const handleCommentEmoji = async (postId: string, commentId: string, emoji: string) => {
    if (!user) return;
    const emojiRef = doc(db, 'profilePosts', postId, 'comments', commentId, 'emojiReactions', `${emoji}_${user.uid}`);
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const comment = post.comments.find((c: any) => c.id === commentId);
    if (!comment) return;
    const hasReacted = comment.emoji?.[emoji]?.includes(user.uid || '');
    try {
      if (hasReacted) {
        await deleteDoc(emojiRef);
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          comments: p.comments.map((c: any) => {
            if (c.id === commentId) {
              const updatedEmoji = { ...c.emoji };
              if (updatedEmoji[emoji]) {
                updatedEmoji[emoji] = updatedEmoji[emoji].filter((id: string) => id !== user.uid);
                if (updatedEmoji[emoji].length === 0) delete updatedEmoji[emoji];
              }
              return { ...c, emoji: updatedEmoji };
            }
            return c;
          })
        } : p));
      } else {
        await setDoc(emojiRef, { emoji, userId: user.uid });
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          comments: p.comments.map((c: any) => {
            if (c.id === commentId) {
              const updatedEmoji = { ...c.emoji };
              if (!updatedEmoji[emoji]) updatedEmoji[emoji] = [];
              if (!updatedEmoji[emoji].includes(user.uid)) updatedEmoji[emoji].push(user.uid);
              return { ...c, emoji: updatedEmoji };
            }
            return c;
          })
        } : p));
      }
      setShowCommentEmojiPicker(prev => ({ ...prev, [commentId]: false }));
    } catch (error) { console.error('Error handling comment emoji:', error); }
  };

  // Add reply
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
      photoURL: String(user?.photoURL || '/default-avatar.png')
    };
    const docRef = await addDoc(replyRef, newReply);
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      comments: p.comments.map((c: any) => c.id === commentId ? { ...c, replies: [...(c.replies || []), { id: docRef.id, ...newReply, likes: [], emoji: {} }] } : c)
    } : p));
    setReplyInputs(prev => ({ ...prev, [commentId]: '' }));
    
    // Process mentions and create notifications
    try {
      const post = posts.find(p => p.id === postId);
      if (post) {
        const comment = post.comments.find((c: any) => c.id === commentId);
        if (comment) {
          // Create notification for comment owner if it's not the replier
          if (comment.userId !== user.uid) {
            await createNotification({
              userId: comment.userId,
              type: 'comment',
              senderId: user.uid,
              senderName: user.displayName || 'User',
              message: `${user.displayName || 'User'} replied to your comment`,
              postId,
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
            postId // Parent post ID
          );
        }
      }
    } catch (error) {
      console.error('Error processing reply notifications:', error);
    }
  };

  // Like/unlike reply
  const handleLikeReply = async (postId: string, commentId: string, replyId: string) => {
    if (!user) return;
    const likeRef = doc(db, 'profilePosts', postId, 'comments', commentId, 'replies', replyId, 'likes', user.uid);
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const comment = post.comments.find((c: any) => c.id === commentId);
    if (!comment) return;
    const reply = comment.replies.find((r: any) => r.id === replyId);
    if (!reply) return;
    const hasLiked = reply.likes?.includes(user.uid || '');
    try {
      if (hasLiked) {
        await deleteDoc(likeRef);
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          comments: p.comments.map((c: any) => c.id === commentId ? {
            ...c,
            replies: c.replies.map((r: any) => r.id === replyId ? { ...r, likes: r.likes.filter((id: string) => id !== user.uid) } : r)
          } : c)
        } : p));
      } else {
        await setDoc(likeRef, { userId: user.uid });
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          comments: p.comments.map((c: any) => c.id === commentId ? {
            ...c,
            replies: c.replies.map((r: any) => r.id === replyId ? { ...r, likes: [...(r.likes || []), user.uid] } : r)
          } : c)
        } : p));
        
        // Create notification for reply owner when someone likes their reply
        if (reply.userId !== user.uid) {
          await createNotification({
            userId: reply.userId,
            type: 'like',
            senderId: user.uid,
            senderName: user.displayName || 'User',
            message: `${user.displayName || 'User'} liked your reply`,
            postId,
            comment: reply.text,
            link: `/profile/${post.userId}?postId=${postId}`
          });
        }
      }
    } catch (error) { console.error('Error handling reply like:', error); }
  };

  // Emoji on reply
  const handleReplyEmoji = async (postId: string, commentId: string, replyId: string, emoji: string) => {
    if (!user) return;
    const emojiRef = doc(db, 'profilePosts', postId, 'comments', commentId, 'replies', replyId, 'emojiReactions', `${emoji}_${user.uid}`);
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const comment = post.comments.find((c: any) => c.id === commentId);
    if (!comment) return;
    const reply = comment.replies.find((r: any) => r.id === replyId);
    if (!reply) return;
    const hasReacted = reply.emoji?.[emoji]?.includes(user.uid || '');
    try {
      if (hasReacted) {
        await deleteDoc(emojiRef);
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          comments: p.comments.map((c: any) => c.id === commentId ? {
            ...c,
            replies: c.replies.map((r: any) => {
              if (r.id === replyId) {
                const updatedEmoji = { ...r.emoji };
                if (updatedEmoji[emoji]) {
                  updatedEmoji[emoji] = updatedEmoji[emoji].filter((id: string) => id !== user.uid);
                  if (updatedEmoji[emoji].length === 0) delete updatedEmoji[emoji];
                }
                return { ...r, emoji: updatedEmoji };
              }
              return r;
            })
          } : c)
        } : p));
      } else {
        await setDoc(emojiRef, { emoji, userId: user.uid });
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          comments: p.comments.map((c: any) => c.id === commentId ? {
            ...c,
            replies: c.replies.map((r: any) => {
              if (r.id === replyId) {
                const updatedEmoji = { ...r.emoji };
                if (!updatedEmoji[emoji]) updatedEmoji[emoji] = [];
                if (!updatedEmoji[emoji].includes(user.uid)) updatedEmoji[emoji].push(user.uid);
                return { ...r, emoji: updatedEmoji };
              }
              return r;
            })
          } : c)
        } : p));
      }
      setShowReplyEmojiPicker(prev => ({ ...prev, [replyId]: false }));
    } catch (error) { console.error('Error handling reply emoji:', error); }
  };

  // Delete post
  const handleDeletePost = async (post: Post) => {
    setDeletingPostId(post.id);
    setShowDeleteConfirm(true);
  };

  const confirmDeletePost = async () => {
    const post = posts.find(p => p.id === deletingPostId);
    if (!post) return;
    setPosts(prev => prev.filter(p => p.id !== deletingPostId));
    setShowDeleteConfirm(false);
    setDeletingPostId(null);
    await deleteDoc(doc(db, 'profilePosts', post.id));
  };

  // Delete comment
  const handleDeleteComment = async (postId: string, commentId: string) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: p.comments.filter((c: any) => c.id !== commentId) } : p));
    await deleteDoc(doc(db, 'profilePosts', postId, 'comments', commentId));
  };

  // Delete reply
  const handleDeleteReply = async (postId: string, commentId: string, replyId: string) => {
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      comments: p.comments.map((c: any) => c.id === commentId ? { ...c, replies: c.replies.filter((r: any) => r.id !== replyId) } : c)
    } : p));
    await deleteDoc(doc(db, 'profilePosts', postId, 'comments', commentId, 'replies', replyId));
  };

  // Key press for comment/reply
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>, postId: string, commentId?: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (commentId) {
        handleAddReply(postId, commentId);
      } else {
        handleAddComment(postId);
      }
    }
  };

  // 2. Add handler for image selection
  function handleNewPostImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setNewPostImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setNewPostImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setNewPostImagePreview(null);
    }
  }

  // 3. Add handler for post submission
  async function handleNewPostSubmit() {
    if (!user || !newPostContent.trim()) return;
    setPosting(true);
    let imageUrl = '';
    if (newPostImage) {
      // Upload image to Firebase Storage
      const storageRef = (await import('firebase/storage')).ref;
      const { uploadBytes, getDownloadURL } = await import('firebase/storage');
      const storage = getStorage(app);
      console.log('Using storage instance:', storage);
      const imgRef = storageRef(storage, `profilePosts/${user.uid}/${Date.now()}_${newPostImage.name}`);
      await uploadBytes(imgRef, newPostImage);
      imageUrl = await getDownloadURL(imgRef);
    }
    // Add post to profilePosts (profile feed)
    const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
    const postData: any = {
      userId: user.uid,
      displayName: user.displayName || 'User',
      photoURL: String(user.photoURL || '/default-avatar.png'),
      content: newPostContent,
      createdAt: serverTimestamp(),
    };
    if (imageUrl) {
      postData.imageUrl = imageUrl;
    }
    const docRef = await addDoc(collection(db, 'profilePosts'), postData);
    
    // Process mentions for notifications
    try {
      await createMentionNotifications(
        newPostContent,
        docRef.id,
        user.uid,
        user.displayName || 'User',
        'post'
      );
    } catch (error) {
      console.error('Error processing post mentions:', error);
    }
    
    // Optimistically add the new post to the top of the feed
    setPosts(prev => [
      {
        id: docRef.id,
        userId: user.uid,
        displayName: user.displayName || 'User',
        photoURL: String(user.photoURL || '/default-avatar.png'),
        content: newPostContent,
        createdAt: new Date(),
        imageUrl: imageUrl || undefined,
        likes: [],
        emoji: {},
        comments: [],
      },
      ...prev,
    ]);
    setNewPostContent('');
    setNewPostImage(null);
    setNewPostImagePreview(null);
    setPosting(false);
  }

  // Show a loading state while auth is initializing
  if (!initialized || authLoading) {
    return (
      <>
        <Header />
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
      </>
    );
  }

  // If auth is initialized but no user, show login prompt with header
  if (!user) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Sign in to view the SwapFeed</h2>
            <p className="text-gray-600 mb-6">You need to be logged in to see posts and interact with the community.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/login" className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition shadow-sm">
                Sign In
              </Link>
              <Link href="/auth/signup" className="px-6 py-3 bg-gray-100 text-gray-800 rounded-lg font-medium hover:bg-gray-200 transition">
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="max-w-2xl mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6 text-indigo-700">SwapFeed</h1>
        {/* 1. Add the post input box above the feed */}
        <div className="bg-white rounded-2xl shadow p-5 mb-8 flex items-start gap-4 border border-gray-100">
          <ProfileAvatar 
            src={user?.photoURL} 
            alt={user?.displayName || 'User'} 
            size={44}
            className="border border-gray-200"
          />
          <div className="flex-1">
            <MentionInput
              value={newPostContent}
              onChange={setNewPostContent}
              placeholder="What's on your mind? Type @ to mention connections..."
              rows={2}
              className={posting ? "bg-gray-50 opacity-70" : "bg-gray-50"}
            />
            {newPostImagePreview && (
              <div className="mb-2 mt-2">
                <img src={newPostImagePreview} alt="Preview" className="rounded-xl max-h-48 object-cover border border-gray-200" />
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <label className="cursor-pointer text-indigo-600 hover:underline text-sm">
                Add Image
                <input type="file" accept="image/*" className="hidden" onChange={handleNewPostImageChange} />
              </label>
              <button
                onClick={handleNewPostSubmit}
                className="ml-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold shadow-sm disabled:opacity-50"
                disabled={posting || !newPostContent.trim()}
              >
                {posting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
        {/* Feed posts */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading feed...</div>
        ) : posts.length === 0 ? (
          <div className="text-center text-gray-400 py-12">No posts yet. Start by creating one!</div>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <div key={post.id} className="bg-white rounded-2xl shadow p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <Link href={`/profile/${post.userId}`} className="flex-shrink-0">
                    <ProfileAvatar 
                      src={post.photoURL} 
                      alt={post.displayName} 
                      size={40}
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${post.userId}`} className="font-semibold text-gray-900 hover:text-indigo-600">
                      {post.displayName}
                      <VerificationBadge userId={post.userId} className="h-5 w-5 align-text-bottom" />
                    </Link>
                    <div className="text-xs text-gray-400">
                      {post.createdAt && typeof post.createdAt.toDate === 'function'
                        ? post.createdAt.toDate().toLocaleString()
                        : post.createdAt && typeof post.createdAt === 'number'
                        ? new Date(post.createdAt).toLocaleString()
                        : ''}
                    </div>
                  </div>
                  {(user && post.userId === user.uid) && (
                    <button
                      onClick={() => handleDeletePost(post)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
                <div className="mb-3">
                  <div className="text-gray-800 text-[15px] whitespace-pre-line">
                    {formatDisplayText(post.content)}
                  </div>
                  {post.imageUrl && (
                    <div className="mt-3">
                      <img
                        src={post.imageUrl}
                        alt="Post image"
                        className="rounded-xl max-h-80 object-cover border border-gray-200 cursor-pointer"
                        onClick={() => setMaximizedImage(post.imageUrl!)}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 mb-2">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`flex items-center space-x-1 ${user?.uid && post.likes?.includes(user.uid || '') ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                  >
                    <ThumbsUp className="h-5 w-5" />
                    <span className="text-sm">{post.likes?.length || 0}</span>
                  </button>
                  {/* Always show comment icon/button to toggle comments */}
                  <button
                    onClick={() => setShowComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.8l-4 1 1-4A8.96 8.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>{post.comments?.length || 0}</span>
                  </button>
                  <div className="flex items-center space-x-2">
                    {Object.entries(post.emoji || {}).map(([emoji, userIds]) => {
                      const typedUserIds = userIds as string[];
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleEmoji(post.id, emoji)}
                          className={`flex items-center space-x-1 px-2 py-1 rounded-full ${typedUserIds.includes(user?.uid || '') ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
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
                {/* Comments section (conditionally visible) */}
                {showComments[post.id] && (
                  <div className="mt-4 space-y-4">
                    {post.comments?.slice(0, showAllComments[post.id] ? undefined : 3).map((comment: any) => (
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
                                {comment.createdAt && typeof comment.createdAt.toDate === 'function'
                                  ? comment.createdAt.toDate().toLocaleDateString()
                                  : comment.createdAt && typeof comment.createdAt === 'number'
                                  ? new Date(comment.createdAt).toLocaleDateString()
                                  : ''}
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
                          <p className="mt-1 text-gray-700">
                            {formatDisplayText(comment.text)}
                          </p>
                          <div className="mt-2 flex items-center space-x-4">
                            <button
                              onClick={() => handleLikeComment(post.id, comment.id)}
                              className={`flex items-center space-x-1 ${user?.uid && comment.likes?.includes(user.uid || '') ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
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
                                    className={`flex items-center space-x-1 px-2 py-1 rounded-full ${typedUserIds.includes(user?.uid || '') ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
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
                                className="bg-gray-50 resize-none"
                                onKeyPress={(e) => handleKeyPress(e, post.id, comment.id)}
                              />
                              <div className="mt-2 flex justify-end">
                                <button
                                  onClick={() => handleAddReply(post.id, comment.id)}
                                  className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                                >
                                  Reply
                                </button>
                              </div>
                            </div>
                          )}
                          {/* Replies */}
                          {comment.replies && comment.replies.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {comment.replies.map((reply: any) => (
                                <div key={reply.id} className="flex space-x-3 pl-8">
                                  <Link href={`/profile/${reply.userId}`} className="flex-shrink-0">
                                    <ProfileAvatar 
                                      src={reply.photoURL} 
                                      alt={reply.displayName} 
                                      size={28}
                                    />
                                  </Link>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <Link href={`/profile/${reply.userId}`} className="font-semibold text-gray-900 hover:text-indigo-600 text-sm">
                                          {reply.displayName}
                                          <VerificationBadge userId={reply.userId} className="h-3 w-3 align-text-bottom" />
                                        </Link>
                                        <p className="text-xs text-gray-500">
                                          {reply.createdAt && typeof reply.createdAt.toDate === 'function'
                                            ? reply.createdAt.toDate().toLocaleDateString()
                                            : reply.createdAt && typeof reply.createdAt === 'number'
                                            ? new Date(reply.createdAt).toLocaleDateString()
                                            : ''}
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
                                    <p className="mt-1 text-gray-700 text-sm">
                                      {formatDisplayText(reply.text)}
                                    </p>
                                    <div className="mt-1 flex items-center space-x-3">
                                      <button
                                        onClick={() => handleLikeReply(post.id, comment.id, reply.id)}
                                        className={`flex items-center space-x-1 ${user?.uid && reply.likes?.includes(user.uid || '') ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                                      >
                                        <ThumbsUp className="h-3 w-3" />
                                        <span className="text-xs">{reply.likes?.length || 0}</span>
                                      </button>
                                      <div className="flex items-center space-x-1">
                                        {Object.entries(reply.emoji || {}).map(([emoji, userIds]) => {
                                          const typedUserIds = userIds as string[];
                                          return (
                                            <button
                                              key={emoji}
                                              onClick={() => handleReplyEmoji(post.id, comment.id, reply.id, emoji)}
                                              className={`flex items-center space-x-1 px-1.5 py-0.5 rounded-full ${typedUserIds.includes(user?.uid || '') ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
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
                    {post.comments && post.comments.length > 3 && !showAllComments[post.id] && (
                      <button
                        onClick={() => setShowAllComments(prev => ({ ...prev, [post.id]: true }))}
                        className="text-indigo-600 hover:underline text-sm mt-2"
                      >
                        Show all comments
                      </button>
                    )}
                  </div>
                )}
                {/* Always show comment input */}
                <div className="flex items-center gap-2 mt-4 border-t pt-4">
                  <ProfileAvatar 
                    src={user?.photoURL} 
                    alt={user?.displayName || 'User'} 
                    size={36}
                    className="border border-gray-200"
                  />
                  <div className="flex-1">
                    <MentionInput
                      value={commentInputs[post.id] || ''}
                      onChange={(value) => setCommentInputs(prev => ({ ...prev, [post.id]: value }))}
                      placeholder="Write a comment... Type @ to mention someone"
                      rows={1}
                      className="bg-gray-50 resize-none"
                      onKeyPress={(e) => handleKeyPress(e, post.id)}
                    />
                  </div>
                  <button 
                    onClick={() => handleAddComment(post.id)} 
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm"
                  >
                    Comment
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md relative animate-scaleup-avatar">
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
                onClick={() => setShowDeleteConfirm(false)}
                aria-label="Close"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h3 className="text-xl font-bold mb-4 text-gray-900">Delete Post</h3>
              <p className="mb-6 text-gray-700">Are you sure you want to delete this post? This action cannot be undone.</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeletePost}
                  className="px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Maximized image modal */}
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
                onClick={e => { e.stopPropagation(); setMaximizedImage(null); }}
              >
                <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
} 