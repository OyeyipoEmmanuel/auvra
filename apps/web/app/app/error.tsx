"use client";

export default function WorkspaceError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-[800px] px-5 py-16 sm:px-8">
      <h1 className="text-2xl font-semibold">The workspace could not load.</h1>
      <p className="mt-3 text-[15px] text-[#a1a1aa]">
        Your data has not been changed. Try loading this view again.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-violet-600 px-4 py-2 text-[15px] font-medium text-white hover:bg-violet-500"
      >
        Try again
      </button>
    </main>
  );
}
