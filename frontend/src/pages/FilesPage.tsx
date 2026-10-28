import type { ChangeEvent, RefObject } from 'react';
import type { TranslationCatalog } from '../i18n';
import type { StoredFile } from '../types';

interface FilesPageProps {
  copy: TranslationCatalog;
  files: StoredFile[];
  notice: string;
  isUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  apiUrl: (path: string) => string;
  onUpload: (file: File | undefined) => void;
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesPage({
  copy,
  files,
  notice,
  isUploading,
  fileInputRef,
  apiUrl,
  onUpload,
}: FilesPageProps) {
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    onUpload(event.currentTarget.files?.[0]);
  }

  return (
    <section className="workspace" aria-labelledby="welcome-title">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 id="welcome-title">{copy.headline}</h1>
          <p className="intro">{copy.description}</p>
        </div>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          aria-label={copy.uploadFile}
          onChange={handleFileChange}
        />
        <button
          className="upload-button"
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <span aria-hidden="true">＋</span>{isUploading ? copy.uploading : copy.uploadFile}
        </button>
      </header>
      <section className="files-panel" aria-labelledby="files-heading">
        <h2 id="files-heading">{copy.filesHeading}</h2>
        {notice && <p className="notice" role="status">{notice}</p>}
        {files.length === 0 ? (
          <p className="empty-files">{copy.emptyFiles}</p>
        ) : (
          <ul className="file-list">
            {files.map((file) => (
              <li className="file-row" key={file.id}>
                <div className="file-details">
                  <span className="file-name" title={file.name}>{file.name}</span>
                  <span className="file-meta">
                    {formatFileSize(file.sizeBytes)} · {file.status === 'AVAILABLE' ? copy.fileReady : file.status === 'FAILED' ? copy.fileFailed : copy.fileProcessing}
                  </span>
                </div>
                {file.status === 'AVAILABLE' && (
                  <a className="download-link" href={apiUrl(`/api/files/${encodeURIComponent(file.id)}`)}>
                    {copy.download}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
