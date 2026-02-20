import { useState, useRef, useCallback, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  Trash2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 20;

interface UploadingFile {
  id: string;
  file: File;
  preview: string;
  status: 'compressing' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface PropertyImageUploadProps {
  propertyId: string;
  organizationId: string;
  existingImages: string[];
  onImagesChange: (images: string[]) => void;
  disabled?: boolean;
}

export function PropertyImageUpload({
  propertyId,
  organizationId,
  existingImages,
  onImagesChange,
  disabled = false,
}: PropertyImageUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      uploadingFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalCount = existingImages.length + uploadingFiles.filter((f) => f.status !== 'error').length;
  const canUpload = totalCount < MAX_FILES && !disabled;

  const validateFiles = useCallback(
    (files: File[]): File[] => {
      const valid: File[] = [];
      const remaining = MAX_FILES - totalCount;

      for (const file of files) {
        if (valid.length >= remaining) {
          toast.error('Limite atteinte', {
            description: `Maximum ${MAX_FILES} photos par bien.`,
          });
          break;
        }
        if (!ACCEPTED_TYPES.includes(file.type)) {
          toast.error('Format non supporté', {
            description: `${file.name} : utilisez JPG, PNG ou WebP.`,
          });
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast.error('Fichier trop volumineux', {
            description: `${file.name} : maximum 5 Mo.`,
          });
          continue;
        }
        valid.push(file);
      }
      return valid;
    },
    [totalCount],
  );

  const compressImage = useCallback(async (file: File): Promise<File> => {
    return imageCompression(file, {
      maxWidthOrHeight: 1920,
      maxSizeMB: 1,
      fileType: 'image/webp',
      initialQuality: 0.85,
      useWebWorker: true,
    });
  }, []);

  const updateEntry = useCallback(
    (id: string, patch: Partial<UploadingFile>) => {
      if (!mountedRef.current) return;
      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      );
    },
    [],
  );

  const processFiles = useCallback(
    async (files: File[]) => {
      const validated = validateFiles(files);
      if (validated.length === 0) return;

      const newEntries: UploadingFile[] = validated.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        status: 'compressing' as const,
      }));

      setUploadingFiles((prev) => [...prev, ...newEntries]);

      const uploadedUrls: string[] = [];

      for (const entry of newEntries) {
        try {
          // Compress
          updateEntry(entry.id, { status: 'compressing' });
          const compressed = await compressImage(entry.file);

          if (!mountedRef.current) return;

          // Upload
          updateEntry(entry.id, { status: 'uploading' });
          const timestamp = Date.now();
          const safeName = entry.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = `${organizationId}/${propertyId}/${timestamp}-${safeName.replace(/\.\w+$/, '.webp')}`;

          const { error: uploadError } = await supabase.storage
            .from('property-images')
            .upload(filePath, compressed, {
              contentType: 'image/webp',
              upsert: false,
            });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('property-images')
            .getPublicUrl(filePath);

          uploadedUrls.push(urlData.publicUrl);
          updateEntry(entry.id, { status: 'done' });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Erreur inconnue';
          updateEntry(entry.id, { status: 'error', error: message });
          toast.error(`Erreur : ${entry.file.name}`, { description: message });
        }
      }

      if (!mountedRef.current) return;

      if (uploadedUrls.length > 0) {
        onImagesChange([...existingImages, ...uploadedUrls]);
        toast.success(
          uploadedUrls.length === 1
            ? 'Photo ajoutee'
            : `${uploadedUrls.length} photos ajoutees`,
        );
      }

      // Clean up completed entries after delay
      setTimeout(() => {
        if (!mountedRef.current) return;
        setUploadingFiles((prev) => prev.filter((f) => f.status === 'error'));
      }, 2000);
    },
    [validateFiles, compressImage, updateEntry, organizationId, propertyId, existingImages, onImagesChange],
  );

  const deleteImage = useCallback(
    async (imageUrl: string) => {
      setDeletingUrl(imageUrl);
      try {
        // Extract storage path from public URL
        const bucketPrefix = '/storage/v1/object/public/property-images/';
        const pathIndex = imageUrl.indexOf(bucketPrefix);

        if (pathIndex !== -1) {
          const storagePath = decodeURIComponent(
            imageUrl.slice(pathIndex + bucketPrefix.length),
          );

          if (storagePath.startsWith(organizationId)) {
            const { error } = await supabase.storage
              .from('property-images')
              .remove([storagePath]);

            if (error) {
              toast.error('Erreur de suppression', { description: error.message });
              return;
            }
          }
        }

        onImagesChange(existingImages.filter((img) => img !== imageUrl));
        toast.success('Photo supprimee');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue';
        toast.error('Erreur de suppression', { description: message });
      } finally {
        setDeletingUrl(null);
      }
    },
    [organizationId, existingImages, onImagesChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!canUpload) return;
      processFiles(Array.from(e.dataTransfer.files));
    },
    [canUpload, processFiles],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (canUpload) setIsDragOver(true);
    },
    [canUpload],
  );

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) processFiles(Array.from(files));
      if (inputRef.current) inputRef.current.value = '';
    },
    [processFiles],
  );

  const isUploading = uploadingFiles.some(
    (f) => f.status === 'compressing' || f.status === 'uploading',
  );

  return (
    <div className="space-y-4">
      {/* Existing Images Grid */}
      {existingImages.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {existingImages.map((url, index) => (
            <div
              key={url}
              className="relative group aspect-[4/3] rounded-lg overflow-hidden border border-white/10"
            >
              <img
                src={url}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
              <button
                type="button"
                onClick={() => deleteImage(url)}
                disabled={deletingUrl === url || disabled}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-black/60 hover:bg-red-500/80 text-white"
              >
                {deletingUrl === url ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
              <span className="absolute bottom-1 left-1 text-[10px] text-white/70 bg-black/50 px-1.5 py-0.5 rounded">
                {index + 1}/{existingImages.length}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Uploading Files */}
      {uploadingFiles.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {uploadingFiles.map((entry) => (
            <div
              key={entry.id}
              className="relative aspect-[4/3] rounded-lg overflow-hidden border border-white/10"
            >
              <img
                src={entry.preview}
                alt="Upload en cours"
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                {entry.status === 'compressing' && (
                  <div className="flex flex-col items-center gap-1">
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                    <span className="text-[10px] text-white/80">Compression...</span>
                  </div>
                )}
                {entry.status === 'uploading' && (
                  <div className="flex flex-col items-center gap-1">
                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                    <span className="text-[10px] text-white/80">Envoi...</span>
                  </div>
                )}
                {entry.status === 'done' && (
                  <CheckCircle className="w-6 h-6 text-green-400" />
                )}
                {entry.status === 'error' && (
                  <div className="flex flex-col items-center gap-1">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-[10px] text-red-300 text-center px-1 line-clamp-2">
                      {entry.error || 'Erreur'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drop Zone */}
      {canUpload && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !isUploading && inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer min-h-[120px]',
            isDragOver
              ? 'border-blue-400 bg-blue-500/10 scale-[1.01]'
              : 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-blue-500/50',
            isUploading && 'pointer-events-none opacity-60',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <Upload className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-center">
            <p className="text-sm text-white font-medium">
              {isDragOver ? 'Deposez vos photos' : 'Glissez vos photos ici'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ou cliquez pour selectionner
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            JPG, PNG, WebP — Max 5 Mo par fichier — {existingImages.length}/{MAX_FILES} photos
          </p>
        </div>
      )}
    </div>
  );
}
