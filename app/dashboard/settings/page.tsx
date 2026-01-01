'use client';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Lock, Trash2, UserX, Mail, AlertTriangle, CheckCircle, 
  X, ShieldAlert, Shield
} from 'lucide-react';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [changePwEmailSent, setChangePwEmailSent] = useState(false);
  const [error, setError] = useState('');

  // Placeholder for change password
  const handleChangePassword = async () => {
    if (!user) return;
    if (user.providerData.some((p: any) => p.providerId === 'google.com')) {
      setError('Password change is not available for Google sign-in accounts.');
      return;
    }
    setChangePwEmailSent(true);
  };

  // Placeholder for delete account
  const handleDeleteAccount = async () => {
    setDeleting(true);
    setTimeout(() => {
      setDeleting(false);
      setShowDeleteModal(false);
      signOut();
      router.push('/');
    }, 2000);
  };

  // Placeholder for deactivate account
  const handleDeactivateAccount = async () => {
    setDeactivating(true);
    setTimeout(() => {
      setDeactivating(false);
      setShowDeactivateModal(false);
      signOut();
      router.push('/');
    }, 2000);
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 via-gray-50 to-indigo-50">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center p-2 bg-indigo-100 rounded-xl mb-4">
            <Shield className="h-6 w-6 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Settings</h1>
          <p className="text-gray-500 max-w-md mx-auto">Manage your account settings and preferences</p>
        </div>

        <div className="grid gap-6">
          {/* Security Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-md">
            <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 px-6 py-4 border-b border-indigo-100">
              <div className="flex items-center">
                <div className="bg-white p-2 rounded-lg shadow-sm mr-3">
                  <Lock className="h-5 w-5 text-indigo-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Security</h2>
              </div>
            </div>
            
            <div className="p-6">
              <div className="bg-gradient-to-r from-indigo-50 to-white rounded-xl p-4 mb-4">
                <h3 className="font-medium text-gray-900 mb-2">Password Management</h3>
                <p className="text-gray-600 text-sm mb-4">
                  {user?.providerData.some((p: any) => p.providerId === 'google.com')
                    ? 'You signed in with Google. Password change is not available.'
                    : 'Send a password reset email to change your account password.'}
                </p>
                
                <button
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-medium shadow-sm hover:from-indigo-600 hover:to-indigo-700 transition-all duration-200 transform hover:translate-y-[-1px] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 focus:ring-offset-2"
                  onClick={handleChangePassword}
                  disabled={user?.providerData.some((p: any) => p.providerId === 'google.com')}
                >
                  <Mail className="mr-2 h-4 w-4" /> 
                  Send Password Reset Email
                </button>
                
                {changePwEmailSent && (
                  <div className="mt-4 flex items-center p-3 bg-green-50 rounded-lg border border-green-100">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-green-700 text-sm font-medium">Password reset email sent! Check your inbox.</span>
                  </div>
                )}
                
                {error && (
                  <div className="mt-4 flex items-center p-3 bg-red-50 rounded-lg border border-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                    <span className="text-red-700 text-sm font-medium">{error}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Account Status Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-md">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-100">
              <div className="flex items-center">
                <div className="bg-white p-2 rounded-lg shadow-sm mr-3">
                  <ShieldAlert className="h-5 w-5 text-gray-700" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Account Status</h2>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Deactivate Account */}
              <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-5 border border-gray-100">
                <div className="flex items-start">
                  <div className="mr-4 mt-1">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <UserX className="h-5 w-5 text-gray-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-2">Deactivate Account</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Temporarily hide your profile and services from others. Your comments and posts on other profiles will remain visible. You can reactivate by logging in again.
                    </p>
                    <button
                      className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-gradient-to-r from-gray-600 to-gray-700 text-white font-medium shadow-sm hover:from-gray-700 hover:to-gray-800 transition-all duration-200 transform hover:translate-y-[-1px] focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 focus:ring-offset-2"
                      onClick={() => setShowDeactivateModal(true)}
                    >
                      <UserX className="mr-2 h-4 w-4" /> Deactivate Account
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Delete Account */}
              <div className="bg-gradient-to-r from-red-50 to-white rounded-xl p-5 border border-red-100">
                <div className="flex items-start">
                  <div className="mr-4 mt-1">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Trash2 className="h-5 w-5 text-red-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-red-600 mb-2">Delete Account</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      <span className="font-semibold text-red-600">Warning:</span> This will permanently erase your account and all data from ServSwap. This action cannot be undone.
                    </p>
                    <button
                      className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white font-medium shadow-sm hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:translate-y-[-1px] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 focus:ring-offset-2"
                      onClick={() => setShowDeleteModal(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity" 
               onClick={() => !deleting && setShowDeleteModal(false)}></div>
          
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden transform transition-all animate-modal-in">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 to-red-600"></div>
            
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg mr-3">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Delete Account</h3>
                </div>
                
                {!deleting && (
                  <button 
                    onClick={() => setShowDeleteModal(false)}
                    className="p-1.5 rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                )}
              </div>
              
              <div className="bg-red-50 rounded-xl p-4 mb-6 border border-red-100">
                <p className="text-gray-800">
                  Are you sure you want to <span className="text-red-600 font-bold">permanently delete</span> your account? All your data will be erased and this action cannot be undone.
                </p>
              </div>
              
              <div className="flex justify-end gap-3">
                {!deleting && (
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                )}
                
                <button
                  onClick={handleDeleteAccount}
                  className={`px-5 py-2.5 rounded-lg font-medium shadow-sm focus:outline-none focus:ring-2 transition-all ${
                    deleting 
                      ? 'bg-red-100 text-red-600 border border-red-200' 
                      : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 focus:ring-red-500 focus:ring-offset-2'
                  }`}
                  disabled={deleting}
                >
                  {deleting ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Trash2 className="mr-1.5 h-4 w-4" /> 
                      Permanently Delete
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity" 
               onClick={() => !deactivating && setShowDeactivateModal(false)}></div>
          
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden transform transition-all animate-modal-in">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-gray-400 to-gray-500"></div>
            
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-100 rounded-lg mr-3">
                    <UserX className="h-6 w-6 text-gray-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Deactivate Account</h3>
                </div>
                
                {!deactivating && (
                  <button 
                    onClick={() => setShowDeactivateModal(false)}
                    className="p-1.5 rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                )}
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
                <p className="text-gray-800">
                  Are you sure you want to <span className="font-semibold">deactivate</span> your account? Your profile and services will be hidden, but you can reactivate it by logging in again.
                </p>
              </div>
              
              <div className="flex justify-end gap-3">
                {!deactivating && (
                  <button
                    onClick={() => setShowDeactivateModal(false)}
                    className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                )}
                
                <button
                  onClick={handleDeactivateAccount}
                  className={`px-5 py-2.5 rounded-lg font-medium shadow-sm focus:outline-none focus:ring-2 transition-all ${
                    deactivating 
                      ? 'bg-gray-100 text-gray-600 border border-gray-200' 
                      : 'bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800 focus:ring-gray-500 focus:ring-offset-2'
                  }`}
                  disabled={deactivating}
                >
                  {deactivating ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deactivating...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <UserX className="mr-1.5 h-4 w-4" /> 
                      Deactivate Account
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        @keyframes modal-in {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-modal-in {
          animation: modal-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
} 