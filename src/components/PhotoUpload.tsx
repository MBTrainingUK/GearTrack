import { useRef, useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, STORAGE_ENABLED } from '../lib/firebase';
import { ImagePlus, X, Loader2, Lock } from 'lucide-react';

interface Props {
  folder: string;
  urls: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
}

export default function PhotoUpload({ folder, urls, onChange, maxFiles = 5 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // If Storage isn't enabled, show a disabled placeholder
  if (!STORAGE_ENABLED) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-400">
        <Lock size={14} />
        <span>
          Photo uploads require Firebase Storage (Blaze plan). Set{' '}
          <code className="rounded bg-gray-100 px-1 text-xs">VITE_STORAGE_ENABLED=true</code>{' '}
          in .env.local once activated.
        </span>
      </div>
    );
  }

  async function handleFiles(files: FileList) {
    if (!files.length) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      const compressed = await compressImage(file, 800);
      const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      await new Promise<void>((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, compressed);
        task.on(
          'state_changed',
          (snap) => setProgress((snap.bytesTransferred / snap.totalBytes) * 100),
          reject,
          async () => {
            newUrls.push(await getDownloadURL(task.snapshot.ref));
            resolve();
          }
        );
      });
    }
    onChange([...urls, ...newUrls].slice(0, maxFiles));
    setUploading(false);
    setProgress(0);
  }

  function remove(url: string) {
    onChange(urls.filter((u) => u !== url));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {urls.map((url) => (
          <div key={url} className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(url)}
              className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {urls.length < maxFiles && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span className="mt-1 text-[10px]">{Math.round(progress)}%</span>
              </>
            ) : (
              <>
                <ImagePlus size={18} />
                <span className="mt-1 text-[10px]">Add photo</span>
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  );
}

async function compressImage(file: File, maxWidth: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.82);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

