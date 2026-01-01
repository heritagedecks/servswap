'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface ProfileAvatarProps {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
  linkToProfile?: boolean;
  userId?: string;
}

/**
 * ProfileAvatar component to display user avatars consistently throughout the application
 * 
 * @param src - URL of the profile image
 * @param alt - Alt text, usually the user's display name
 * @param size - Size of the avatar in pixels
 * @param className - Additional CSS classes
 * @param linkToProfile - Whether to wrap the avatar in a link to the user's profile
 * @param userId - User ID, required if linkToProfile is true
 */
export default function ProfileAvatar({ 
  src, 
  alt, 
  size = 40, 
  className = '',
  linkToProfile = false,
  userId
}: ProfileAvatarProps) {
  // Check if src is valid - we're now more strict about what constitutes a valid image
  // We'll only use the image if it's a non-empty string that doesn't include 'CheckCircle'
  // and doesn't contain 'default-avatar.png' (which is 404ing)
  const hasValidImage = src && 
                       src !== '' && 
                       !src.includes('CheckCircle') && 
                       !src.includes('default-avatar.png') &&
                       src.startsWith('http');
  
  // Render the avatar with appropriate fallback
  const avatar = (
    <div 
      className={`rounded-full overflow-hidden ${className}`} 
      style={{ width: size, height: size }}
    >
      {hasValidImage ? (
        <Image 
          src={src as string} 
          alt={alt} 
          width={size} 
          height={size} 
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
          <span className="text-white font-bold" style={{ fontSize: size * 0.4 }}>
            {alt?.charAt(0)?.toUpperCase() || 'U'}
          </span>
        </div>
      )}
    </div>
  );

  // If linkToProfile is true and userId is provided, wrap the avatar in a link
  if (linkToProfile && userId) {
    return (
      <Link href={`/profile/${userId}`} className="flex-shrink-0">
        {avatar}
      </Link>
    );
  }

  // Otherwise, return just the avatar
  return avatar;
} 