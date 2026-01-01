'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import Image from 'next/image';
import Link from 'next/link';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  connections?: any[];
  className?: string;
  onKeyPress?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export default function MentionInput({ 
  value, 
  onChange, 
  placeholder = 'Write something...', 
  rows = 3,
  connections = [],
  className = '',
  onKeyPress
}: MentionInputProps) {
  const { user } = useAuth();
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [allConnections, setAllConnections] = useState<any[]>([]);
  
  // Load user connections initially if not provided
  useEffect(() => {
    const fetchConnections = async () => {
      if (!user || connections.length > 0) return;
      
      try {
        const connectionsQuery = query(
          collection(db, 'connections'),
          where('users', 'array-contains', user.uid),
          where('status', '==', 'connected')
        );
        
        const connectionsSnap = await getDocs(connectionsQuery);
        const connectionsList: any[] = [];
        
        // For each connection, get the other user's info
        await Promise.all(connectionsSnap.docs.map(async (doc) => {
          const data = doc.data();
          const otherUserId = data.users.find((uid: string) => uid !== user.uid);
          
          if (otherUserId) {
            // Get user data for the connection
            const userDoc = await getDocs(query(
              collection(db, 'users'),
              where('uid', '==', otherUserId)
            ));
            
            if (!userDoc.empty) {
              const userData = userDoc.docs[0].data();
              connectionsList.push({
                id: otherUserId,
                displayName: userData.displayName || 'User',
                photoURL: userData.photoURL || '',
              });
            }
          }
        }));
        
        setAllConnections(connectionsList);
      } catch (error) {
        console.error('Error fetching connections:', error);
      }
    };
    
    fetchConnections();
  }, [user, connections]);
  
  // Monitor input for @ mentions
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const visibleValue = e.target.value; // What the user sees (without IDs)
    const position = e.target.selectionStart;
    setCursorPosition(position);
    
    // Before updating the real value, we need to map from visible positions to actual positions
    // This is complex because the visible text and actual text can be different lengths
    
    // First, map the visible text to the current value with special formats
    // We need to figure out what the user actually typed, considering the existing mentions
    
    // For simplicity, let's get the text before and after the current cursor
    if (position !== null) {
      // Get the text before cursor in the visible input
      const visibleTextBeforeCursor = visibleValue.substring(0, position);
      // Get the text after cursor in the visible input
      const visibleTextAfterCursor = visibleValue.substring(position);
      
      // Check if we're in a mention context (after a @)
      const mentionMatch = visibleTextBeforeCursor.match(/@([^@\s]*)$/);
      
      if (mentionMatch) {
        const query = mentionMatch[1].toLowerCase();
        setMentionQuery(query);
        setShowSuggestions(true);
        
        // Filter connections based on the query
        const connectionsToUse = connections.length > 0 ? connections : allConnections;
        const filteredResults = connectionsToUse.filter(conn => 
          conn.displayName.toLowerCase().includes(query)
        ).slice(0, 5); // Limit to 5 results
        
        setMentionResults(filteredResults);
      } else {
        setShowSuggestions(false);
        setMentionQuery(null);
        setMentionResults([]);
      }
      
      // Now construct the new value with any special format strings preserved
      // For now, we'll just pass the visible value and handle advanced use cases later
      onChange(visibleValue);
    }
  };
  
  // Handle selection from mention suggestions
  const handleSelectMention = (user: any) => {
    if (cursorPosition !== null && mentionQuery !== null) {
      // Replace the partial mention with the full username
      const beforeMention = value.substring(0, cursorPosition - mentionQuery.length - 1);
      const afterMention = value.substring(cursorPosition);
      
      // Store the mention with a special format for internal use: @[userId](displayName)
      // But only display @displayName to the user
      const specialFormat = `@[${user.id}](${user.displayName}) `;
      
      // Create the final text with the special format (which will be parsed later)
      const newText = beforeMention + specialFormat + afterMention;
      
      // Update the text
      onChange(newText);
      setShowSuggestions(false);
      setMentionQuery(null);
      
      // Focus back on the input and position cursor correctly
      if (inputRef.current) {
        inputRef.current.focus();
        // Set cursor position after the mention
        const newPosition = beforeMention.length + specialFormat.length;
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.selectionStart = newPosition;
            inputRef.current.selectionEnd = newPosition;
          }
        }, 0);
      }
    }
  };
  
  // Create a custom display value for the textarea that replaces the special format with just @name
  const getDisplayValue = (text: string): string => {
    return text.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, (match, id, name) => `@${name} `);
  };
  
  // Format the text for display (replace mention format with highlighted mentions)
  const formatTextWithMentions = (text: string) => {
    // This would be used if we wanted to display formatted mentions in the input itself
    return text;
  };
  
  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        value={getDisplayValue(value)}
        onChange={handleChange}
        onKeyPress={onKeyPress}
        placeholder={placeholder}
        rows={rows}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${className}`}
      />
      
      {/* Mention suggestions dropdown */}
      {showSuggestions && mentionResults.length > 0 && (
        <div className="absolute z-10 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto w-full max-w-sm">
          {mentionResults.map((result) => (
            <div 
              key={result.id}
              onClick={() => handleSelectMention(result)}
              className="flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                {result.photoURL ? (
                  <Image 
                    src={result.photoURL} 
                    alt={result.displayName} 
                    width={32} 
                    height={32} 
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full bg-indigo-500 flex items-center justify-center text-white text-sm font-medium">
                    {result.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="font-medium text-gray-800">{result.displayName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper functions to parse mentions from the text
export const extractMentions = (text: string): { id: string; name: string }[] => {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentions: { id: string; name: string }[] = [];
  
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      id: match[1],
      name: match[2]
    });
  }
  
  return mentions;
};

// Format text for display with highlighted mentions
export const formatDisplayText = (text: string): React.ReactNode => {
  const parts = [];
  let lastIndex = 0;
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  
  let match;
  let index = 0;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${index}`}>{text.substring(lastIndex, match.index)}</span>);
      index++;
    }
    
    // Get the user ID and name from the match
    const userId = match[1];
    const userName = match[2];
    
    // Add the mention as a styled span with a link to the user's profile
    parts.push(
      <Link 
        key={`mention-${index}`} 
        href={`/profile/${userId}`}
        className="text-indigo-600 font-medium hover:underline"
      >
        @{userName}
      </Link>
    );
    index++;
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${index}`}>{text.substring(lastIndex)}</span>);
  }
  
  return <>{parts}</>;
}; 