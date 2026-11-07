"use client";

import { useRef, useState } from "react";
import { FileUp, LoaderCircle, Paperclip, X } from "lucide-react";

type AttachedFile = { id: string; fileName: string; sizeBytes: number };

const allowed = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv";
const maxBytes = 10 * 1024 * 1024;

export function RequestFiles({
  files,
  onChange,
}: {
  files: AttachedFile[];
  onChange: (files: AttachedFile[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File): Promise<AttachedFile> {
    if (file.size > maxBytes) throw new Error("Each file must be 10 MB or smaller.");
    const contentType =
      file.type ||
      (file.name.toLowerCase().endsWith(".csv")
        ? "text/csv"
        : file.name.toLowerCase().endsWith(".txt")
          ? "text/plain"
          : "");
    const sha256 = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    const ticketResponse = await fetch("/api/files/upload-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType, sizeBytes: file.size, sha256 }),
    });
    if (!ticketResponse.ok) throw new Error("This file type or size is not supported.");
    const ticket = (await ticketResponse.json()) as { uploadUrl: string };
    const uploadResponse = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!uploadResponse.ok)
      throw new Error("The private upload failed. Check that storage is running.");
    const result = (await uploadResponse.json()) as { file: AttachedFile };
    return result.file;
  }

  return (
    <div className="mt-7 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface)] p-4">
      <div className="flex items-center gap-2 text-[14px] font-medium text-[#c7c7cc]">
        <Paperclip className="size-4" />
        Attachments
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={uploading || files.length >= 10}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[#44444a] px-3 py-1.5 text-[13px] text-zinc-200 transition hover:border-violet-400 disabled:opacity-50"
        >
          {uploading ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <FileUp className="size-3.5" />
          )}
          {uploading ? "Uploading…" : "Add files"}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept={allowed}
        className="sr-only"
        multiple
        onChange={async (event) => {
          setError(null);
          setUploading(true);
          try {
            let uploaded = files;
            for (const file of Array.from(event.target.files ?? [])) {
              if (uploaded.length >= 10) throw new Error("A request can have at most 10 files.");
              uploaded = [...uploaded, await upload(file)];
              onChange(uploaded);
            }
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Upload failed.");
          } finally {
            event.target.value = "";
            setUploading(false);
          }
        }}
      />
      <p className="mt-2 text-[13px] leading-5 text-[#85858e]">
        PDF, images, text, or CSV · up to 10 files · 10 MB each. Files stay private to your account.
      </p>
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-[13px] text-zinc-300"
            >
              <Paperclip className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{file.fileName}</span>
              <span className="text-zinc-500">{Math.ceil(file.sizeBytes / 1024)} KB</span>
              <button
                type="button"
                aria-label={`Remove ${file.fileName}`}
                onClick={() => onChange(files.filter((item) => item.id !== file.id))}
                className="rounded p-1 hover:bg-white/10"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 text-[13px] text-rose-300"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function RequestFileDownload({ id, name }: { id: string; name: string }) {
  const [error, setError] = useState(false);
  return (
    <button
      type="button"
      className="text-left text-[14px] text-violet-300 hover:underline"
      onClick={async () => {
        setError(false);
        const response = await fetch(`/api/files/${id}/download-link`);
        if (!response.ok) return setError(true);
        const data = (await response.json()) as { url: string };
        window.location.assign(data.url);
      }}
    >
      {name}
      {error ? " · download unavailable" : ""}
    </button>
  );
}
