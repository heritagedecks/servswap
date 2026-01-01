import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
} 

/**
 * Smoothly scrolls to a section of the page by ID
 * If not on the homepage and targetId is provided, it will navigate to homepage first
 */
export function scrollToSection(
  e?: React.MouseEvent<any>,
  targetId?: string,
  shouldPreventDefault = true,
  isHomePage = true
) {
  if (e && shouldPreventDefault) {
    e.preventDefault();
  }
  
  if (!isHomePage && targetId) {
    window.location.href = `/#${targetId}`;
    return;
  }

  if (targetId) {
  const element = document.getElementById(targetId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

/**
 * Smoothly scrolls to top of the page
 * If not on homepage and returnToHome is true, it will navigate to homepage first
 */
export function scrollToTop(
  e: React.MouseEvent<HTMLAnchorElement>,
  shouldPreventDefault = true,
  isHomePage = true,
  returnToHome = false
) {
  if (shouldPreventDefault) {
    e.preventDefault();
  }
  
  if (!isHomePage && returnToHome) {
    window.location.href = '/';
    return;
  }
  
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
} 