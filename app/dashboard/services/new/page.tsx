'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/app/context/AuthContext';
import { db, storage } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

const CATEGORIES = [
  'Technology',
  'Design',
  'Writing',
  'Marketing',
  'Photography',
  'Education',
  'Business',
  'Music',
  'Health',
  'Other',
];

const serviceSchema = z.object({
  title: z
    .string()
    .min(5, { message: 'Title must be at least 5 characters long' })
    .max(100, { message: 'Title cannot exceed 100 characters' }),
  description: z
    .string()
    .min(20, { message: 'Description must be at least 20 characters long' })
    .max(1000, { message: 'Description cannot exceed 1000 characters' }),
  category: z.string().refine((val) => CATEGORIES.includes(val), {
    message: 'Please select a valid category',
  }),
  location: z.string().min(2, { message: 'Please provide a location' }).max(100),
  isActive: z.boolean().default(true),
  valueEstimate: z
    .number({ invalid_type_error: 'Please enter a value estimate' })
    .min(1, { message: 'Value estimate must be at least $1' }),
  servicesWanted: z.array(z.string().min(1)).optional(),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

export default function NewServicePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [servicesWanted, setServicesWanted] = useState<string[]>([]);
  const [serviceWantedInput, setServiceWantedInput] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    getValues,
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      category: '',
      location: 'Remote',
      isActive: true,
      valueEstimate: undefined,
      servicesWanted: [],
    },
  });

  const uploadImage = async (file: File): Promise<string> => {
    if (!storage) throw new Error("Firebase storage is not initialized");
    const fileId = uuidv4();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${fileId}.${fileExtension}`;
    const storageRef = ref(storage, `service-images/${user?.uid}/${fileName}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const onSubmit: SubmitHandler<ServiceFormValues> = async (data) => {
    if (!user) {
      setError('You must be logged in to create a service');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Upload images and get their URLs
      const imageUrls = await Promise.all(
        images.map(uploadImage)
      );

      // Add the service to Firestore
      const serviceData = {
        ...data,
        valueEstimate: Number(data.valueEstimate),
        servicesWanted,
        userId: user.uid,
        userName: user.displayName || 'Anonymous User',
        userAvatar: user.photoURL || '',
        images: imageUrls,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'services'), serviceData);

      // Redirect to services list
      router.push('/dashboard/services');
      router.refresh();
    } catch (error) {
      console.error('Error creating service:', error);
      setError('Failed to create service. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      // Limit to 5 images
      const newFiles = Array.from(event.target.files).slice(0, 5 - images.length);
      
      if (images.length + newFiles.length > 5) {
        alert('You can upload a maximum of 5 images');
        return;
      }
      
      setImages((prevImages) => [...prevImages, ...newFiles]);

      // Create preview URLs for the new images
      const newPreviewUrls = newFiles.map((file) => URL.createObjectURL(file));
      setPreviewUrls((prevUrls) => [...prevUrls, ...newPreviewUrls]);
    }
  };

  const removeImage = (index: number) => {
    setImages((prevImages) => prevImages.filter((_, i) => i !== index));
    
    // Revoke the URL to avoid memory leaks
    URL.revokeObjectURL(previewUrls[index]);
    setPreviewUrls((prevUrls) => prevUrls.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Add a New Service</h1>
        <p className="text-gray-600 mt-1">
          Describe the service you can provide to others on the platform.
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Service Title
          </label>
          <input
            id="title"
            {...register('title')}
            type="text"
            placeholder="e.g., Web Development, Logo Design, Copywriting"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="category"
            {...register('category')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            id="location"
            {...register('location')}
            type="text"
            placeholder="e.g., Remote, New York City, Online"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          {errors.location && (
            <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            {...register('description')}
            rows={5}
            placeholder="Describe your service in detail. What do you offer? What are your qualifications or experience? What can people expect?"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          ></textarea>
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Images ({images.length}/5)
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
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
              <div className="flex text-sm text-gray-600">
                <label
                  htmlFor="images"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                >
                  <span>Upload images</span>
                  <input
                    id="images"
                    name="images"
                    type="file"
                    multiple
                    accept="image/*,.heic"
                    className="sr-only"
                    onChange={handleImageChange}
                    disabled={images.length >= 5}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB each (max 5 images)</p>
            </div>
          </div>
          
          {previewUrls.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-4">
              {previewUrls.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Preview ${index}`}
                    className="h-24 w-full object-cover rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 transform translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="valueEstimate" className="block text-sm font-medium text-gray-700 mb-1">
            Estimate how much this project would cost if hired ($)
          </label>
          <input
            id="valueEstimate"
            type="number"
            min={1}
            step={1}
            {...register('valueEstimate', { valueAsNumber: true })}
            placeholder="e.g., 200"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          {errors.valueEstimate && (
            <p className="mt-1 text-sm text-red-600">{errors.valueEstimate.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Services I'm looking for in return
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={serviceWantedInput}
              onChange={e => setServiceWantedInput(e.target.value)}
              placeholder="e.g., Logo Design, Marketing Advice, etc."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (serviceWantedInput.trim()) {
                    setServicesWanted(prev => [...prev, serviceWantedInput.trim()]);
                    setServiceWantedInput('');
                  }
                }
              }}
            />
            <button
              type="button"
              className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              onClick={() => {
                if (serviceWantedInput.trim()) {
                  setServicesWanted(prev => [...prev, serviceWantedInput.trim()]);
                  setServiceWantedInput('');
                }
              }}
            >
              Add
            </button>
          </div>
          {servicesWanted.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {servicesWanted.map((service, idx) => (
                <li key={idx} className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full flex items-center gap-2">
                  {service}
                  <button
                    type="button"
                    className="ml-1 text-red-500 hover:text-red-700"
                    onClick={() => setServicesWanted(prev => prev.filter((_, i) => i !== idx))}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-500 mt-1">List as many services as you'd accept in return for this listing.</p>
        </div>

        <div className="flex items-center">
          <input
            id="isActive"
            type="checkbox"
            {...register('isActive')}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
            Make this service active and available for swapping
          </label>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Service'}
          </button>
        </div>
      </form>
    </div>
  );
} 