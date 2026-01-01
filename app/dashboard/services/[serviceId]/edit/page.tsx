"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/app/context/AuthContext";
import { db, storage } from "@/app/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import heic2any from 'heic2any';

const CATEGORIES = [
  "Technology",
  "Design",
  "Writing",
  "Marketing",
  "Photography",
  "Education",
  "Business",
  "Music",
  "Health",
  "Other",
];

const serviceSchema = z.object({
  title: z
    .string()
    .min(5, { message: "Title must be at least 5 characters long" })
    .max(100, { message: "Title cannot exceed 100 characters" }),
  description: z
    .string()
    .min(20, { message: "Description must be at least 20 characters long" })
    .max(1000, { message: "Description cannot exceed 1000 characters" }),
  category: z.string().refine((val) => CATEGORIES.includes(val), {
    message: "Please select a valid category",
  }),
  location: z.string().min(2, { message: "Please provide a location" }).max(100),
  isActive: z.boolean().default(true),
  valueEstimate: z
    .number({ invalid_type_error: 'Please enter a value estimate' })
    .min(1, { message: 'Value estimate must be at least $1' }),
  servicesWanted: z.array(z.string().min(1)).optional(),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

export default function EditServicePage() {
  const router = useRouter();
  const params = useParams();
  const serviceId = params?.serviceId as string;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [initialData, setInitialData] = useState<ServiceFormValues | null>(null);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [servicesWanted, setServicesWanted] = useState<string[]>([]);
  const [serviceWantedInput, setServiceWantedInput] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema) as any,
    defaultValues: initialData || {
      title: "",
      description: "",
      category: "",
      location: "Remote",
      isActive: true,
      valueEstimate: undefined,
      servicesWanted: [],
    },
  });

  useEffect(() => {
    const fetchService = async () => {
      if (!user || !serviceId) return;
      try {
        const docRef = doc(db, "services", serviceId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setInitialData({
            title: data.title,
            description: data.description,
            category: data.category,
            location: data.location,
            isActive: data.isActive,
            valueEstimate: data.valueEstimate || 0,
            servicesWanted: data.servicesWanted || [],
          });
          setExistingImageUrls(data.images || []);
          // Set form values
          setValue("title", data.title);
          setValue("description", data.description);
          setValue("category", data.category);
          setValue("location", data.location);
          setValue("isActive", data.isActive);
          setValue("valueEstimate", data.valueEstimate || 0);
          setServicesWanted(data.servicesWanted || []);
        }
      } catch (err) {
        setError("Failed to load service data.");
      }
    };
    fetchService();
    // eslint-disable-next-line
  }, [user, serviceId, setValue]);

  const uploadImage = async (file: File): Promise<string> => {
    if (!storage) throw new Error("Firebase storage is not initialized");
    const fileId = uuidv4();
    const fileExtension = file.name.split(".").pop();
    const fileName = `${fileId}.${fileExtension}`;
    const storageRef = ref(storage, `service-images/${user?.uid}/${fileName}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const onSubmit: SubmitHandler<ServiceFormValues> = async (data) => {
    if (!user) {
      setError("You must be logged in to edit a service");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      // Upload new images and get their URLs
      const newImageUrls = await Promise.all(images.map(uploadImage));
      // Combine existing and new images
      const allImageUrls = [...existingImageUrls, ...newImageUrls];
      // Update the service in Firestore
      const docRef = doc(db, "services", serviceId);
      await updateDoc(docRef, {
        ...data,
        valueEstimate: Number(data.valueEstimate),
        servicesWanted,
        images: allImageUrls,
        updatedAt: serverTimestamp(),
      });
      router.push("/dashboard/services");
      router.refresh();
    } catch (error) {
      setError("Failed to update service. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      let newFiles: File[] = Array.from(event.target.files).slice(0, 5 - images.length - existingImageUrls.length);
      const processedFiles: File[] = [];
      for (let file of newFiles) {
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
            setError('Failed to convert HEIC image. Please try a different image.');
            continue;
          }
        }
        // Validate file type (after conversion)
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          setError('Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.');
          continue;
        }
        // Validate file size (max 5MB)
        const maxSizeInBytes = 5 * 1024 * 1024;
        if (file.size > maxSizeInBytes) {
          setError(`File size exceeds 5MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
          continue;
        }
        processedFiles.push(file);
      }
      if (images.length + existingImageUrls.length + processedFiles.length > 5) {
        alert('You can upload a maximum of 5 images');
        return;
      }
      setImages((prevImages) => [...prevImages, ...processedFiles]);
      // Create preview URLs for the new images
      const newPreviewUrls = processedFiles.map((file) => URL.createObjectURL(file));
      setPreviewUrls((prevUrls) => [...prevUrls, ...newPreviewUrls]);
    }
  };

  const removeImage = (index: number, isExisting: boolean = false) => {
    if (isExisting) {
      setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
    } else {
      setImages((prevImages) => prevImages.filter((_, i) => i !== index));
      URL.revokeObjectURL(previewUrls[index]);
      setPreviewUrls((prevUrls) => prevUrls.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Service</h1>
        <p className="text-gray-600 mt-1">Update your service details below.</p>
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
            {...register("title")}
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
            {...register("category")}
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
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            {...register("description")}
            rows={5}
            placeholder="Describe your service in detail..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            id="location"
            {...register("location")}
            type="text"
            placeholder="e.g., Remote, New York, London"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          {errors.location && (
            <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
          )}
        </div>
        <div className="flex items-center mb-2">
          <input
            id="isActive"
            type="checkbox"
            {...register("isActive")}
            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
            Active (visible in marketplace)
          </label>
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
        {/* Image upload and preview */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Service Images</label>
          <input
            type="file"
            accept="image/*,.heic"
            multiple
            onChange={handleImageChange}
            className="mb-2"
          />
          <div className="flex flex-wrap gap-3 mt-2">
            {/* Existing images */}
            {existingImageUrls.map((url, idx) => (
              <div key={url} className="relative group">
                <img src={url} alt="Service" className="h-24 w-32 object-cover rounded shadow" />
                <button
                  type="button"
                  onClick={() => removeImage(idx, true)}
                  className="absolute top-1 right-1 bg-white bg-opacity-80 rounded-full p-1 text-red-600 hover:bg-red-100"
                  title="Remove image"
                >
                  &times;
                </button>
              </div>
            ))}
            {/* New images */}
            {previewUrls.map((url, idx) => (
              <div key={url} className="relative group">
                <img src={url} alt="Preview" className="h-24 w-32 object-cover rounded shadow" />
                <button
                  type="button"
                  onClick={() => removeImage(idx, false)}
                  className="absolute top-1 right-1 bg-white bg-opacity-80 rounded-full p-1 text-red-600 hover:bg-red-100"
                  title="Remove image"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
} 