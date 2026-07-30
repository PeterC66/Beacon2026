// beacon2026/frontend/src/pages/members/MemberPhotoSection.jsx
//
// Member photo upload / preview block. Extracted from MemberEditor; the upload
// state and handlers still live in the parent and are passed in as props.

import { LABEL_CLS } from './memberEditorStyles.js';

export default function MemberPhotoSection({
  photoBlobUrl,
  photoDragOver,
  hasPhoto,
  photoUploading,
  photoError,
  onDrop,
  onDragOver,
  onDragLeave,
  onSelect,
  onRemove,
}) {
  return (
    <div className="mt-4">
      <label className={LABEL_CLS}>Member Photo</label>
      <div className="flex items-start gap-4">
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`w-24 h-24 rounded border-2 flex items-center justify-center transition-colors ${
            photoDragOver
              ? 'border-blue-400 bg-blue-50'
              : photoBlobUrl
                ? 'border-slate-300'
                : 'border-dashed border-slate-300'
          }`}
        >
          {photoBlobUrl ? (
            <img
              src={photoBlobUrl}
              alt="Member photo"
              className="w-full h-full object-cover rounded"
            />
          ) : (
            <span className="text-slate-400 text-xs text-center px-1">
              {photoDragOver ? 'Drop here' : 'No photo'}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif"
            onChange={onSelect}
            className="hidden"
            id="photo-upload"
          />
          <label
            htmlFor="photo-upload"
            className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-blue-600 hover:bg-blue-50 rounded text-sm cursor-pointer transition-colors"
          >
            {photoUploading ? 'Uploading…' : hasPhoto ? 'Change Photo' : 'Choose File'}
          </label>
          {hasPhoto && (
            <button
              type="button"
              onClick={onRemove}
              disabled={photoUploading}
              className="inline-flex items-center px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 rounded text-sm transition-colors"
            >
              Remove
            </button>
          )}
          <p className="text-xs text-slate-500">
            jpg, png, or gif — max 2 MB. Drag and drop or click.
            <br />
            Square format (1:1) recommended for membership cards.
          </p>
          {photoError && <p className="text-sm text-red-600 font-medium">{photoError}</p>}
        </div>
      </div>
    </div>
  );
}
