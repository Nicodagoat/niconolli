import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface CSVUploadProps {
  onUpload: (file: File) => Promise<void>;
  onDownloadTemplate: () => void;
}

export default function CSVUpload({ onUpload, onDownloadTemplate }: CSVUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ status: string; message: string } | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      await processFile(file);
    }
  }, []);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const processFile = async (file: File) => {
    setUploading(true);
    setResult(null);
    try {
      await onUpload(file);
      setResult({ status: 'success', message: 'File uploaded successfully!' });
    } catch (err: any) {
      setResult({ status: 'error', message: err.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragActive ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'
        }`}
      >
        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-sm text-gray-600 mb-2">
          Drag and drop a CSV file here, or click to browse
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          className="hidden"
          id="csv-upload"
        />
        <label
          htmlFor="csv-upload"
          className="inline-block px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
        >
          Choose File
        </label>
      </div>

      {/* Template download */}
      <button
        onClick={onDownloadTemplate}
        className="flex items-center space-x-2 text-sm text-green-600 hover:text-green-700"
      >
        <FileText className="w-4 h-4" />
        <span>Download CSV Template</span>
      </button>

      {/* Upload status */}
      {uploading && (
        <div className="flex items-center space-x-2 text-sm text-blue-600">
          <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          <span>Uploading...</span>
        </div>
      )}

      {result && (
        <div className={`flex items-center space-x-2 text-sm ${
          result.status === 'success' ? 'text-green-600' : 'text-red-600'
        }`}>
          {result.status === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}
