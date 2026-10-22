"use client";

import { ChangeEvent, DragEvent, KeyboardEvent, useRef, useState } from "react";

/**
 * Multi-file variant of the drop zone inline in verify-credential-form.tsx,
 * extracted so it can accept a whole batch at once rather than one file.
 * Emits raw File objects; the caller (BatchCredentialWorkspace) owns
 * reading, bounding, and parsing each one independently.
 */
export function BatchCredentialDropZone({
  onFilesSelected,
  disabled,
}: {
  onFilesSelected: (files: File[]) => void;
  disabled: boolean;
}) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.target === dropZoneRef.current) {
      setIsDraggingOver(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker();
    }
  }

  return (
    <div
      aria-disabled={disabled}
      aria-label="Drop credential .json files here, or press Enter to browse for files"
      className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-6 text-center text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
        disabled
          ? "cursor-not-allowed border-white/10 text-slate-500"
          : isDraggingOver
            ? "border-cyan-300 bg-cyan-300/10 text-cyan-100"
            : "border-white/20 text-slate-300 hover:border-white/40"
      }`}
      onClick={(clickEvent) => {
        if (disabled || clickEvent.target === fileInputRef.current) return;
        openFilePicker();
      }}
      onDragLeave={disabled ? undefined : handleDragLeave}
      onDragOver={disabled ? undefined : handleDragOver}
      onDrop={disabled ? undefined : handleDrop}
      onKeyDown={disabled ? undefined : handleKeyDown}
      ref={dropZoneRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      <span>
        Drag and drop <span className="font-medium text-white">.json</span> credential files
        here, or{" "}
        <span className="text-cyan-200 underline underline-offset-2">browse</span>
      </span>
      <input
        accept=".json,application/json"
        aria-label="Upload credential JSON files"
        className="sr-only"
        disabled={disabled}
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
    </div>
  );
}
