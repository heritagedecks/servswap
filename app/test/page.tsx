'use client';

import React from 'react';
import { Button } from '../components/ui';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Tailwind CSS Test Page
        </h1>
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Background Colors</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-16 bg-indigo-500 rounded-md flex items-center justify-center text-white font-medium">
              Indigo
            </div>
            <div className="h-16 bg-purple-500 rounded-md flex items-center justify-center text-white font-medium">
              Purple
            </div>
            <div className="h-16 bg-pink-500 rounded-md flex items-center justify-center text-white font-medium">
              Pink
            </div>
            <div className="h-16 bg-gray-500 rounded-md flex items-center justify-center text-white font-medium">
              Gray
            </div>
          </div>
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Text Colors</h2>
          <div className="space-y-2">
            <p className="text-indigo-600 font-medium">This text is indigo-600</p>
            <p className="text-purple-600 font-medium">This text is purple-600</p>
            <p className="text-pink-600 font-medium">This text is pink-600</p>
            <p className="text-gray-600 font-medium">This text is gray-600</p>
          </div>
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Button Component</h2>
          <div className="space-y-4">
            <Button className="w-full">Default Button</Button>
            <Button variant="outline" className="w-full">Outline Button</Button>
            <Button variant="ghost" className="w-full">Ghost Button</Button>
            <Button variant="link" className="w-full">Link Button</Button>
          </div>
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Gradients & Effects</h2>
          <div className="space-y-4">
            <div className="h-16 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-md flex items-center justify-center text-white font-medium">
              Gradient Background
            </div>
            <div className="h-16 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-white rounded-md flex items-center justify-center text-gray-800 font-medium">
              Hover me (Shadow Effect)
            </div>
            <div className="h-16 transform hover:scale-105 transition-transform duration-300 bg-indigo-100 rounded-md flex items-center justify-center text-indigo-800 font-medium">
              Hover me (Scale Effect)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 