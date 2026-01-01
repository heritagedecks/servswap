'use client';

import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
};

export function CustomButton({
  className = '',
  variant = 'default',
  size = 'default',
  children,
  ...props
}: ButtonProps) {
  // Base class always applied
  let classes = 'inline-flex items-center justify-center rounded-full text-sm font-medium transition-all focus:outline-none';
  
  // Add variant classes
  if (variant === 'default') {
    classes += ' bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white hover:shadow-md transform hover:scale-105 transition-all duration-300';
  } else if (variant === 'outline') {
    classes += ' border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300';
  } else if (variant === 'ghost') {
    classes += ' bg-transparent text-indigo-600 hover:bg-indigo-50';
  } else if (variant === 'link') {
    classes += ' text-indigo-600 underline-offset-4 hover:underline';
  }
  
  // Add size classes
  if (size === 'default') {
    classes += ' h-9 px-4 py-2';
  } else if (size === 'sm') {
    classes += ' h-8 px-3 py-1.5 text-xs';
  } else if (size === 'lg') {
    classes += ' h-10 px-8 py-2.5';
  } else if (size === 'icon') {
    classes += ' h-9 w-9';
  }
  
  // Add custom classes
  if (className) {
    classes += ' ' + className;
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
} 