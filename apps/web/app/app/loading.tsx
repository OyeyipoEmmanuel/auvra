export default function WorkspaceLoading() {
  return (
    <div
      role="status"
      aria-label="Loading workspace"
      className="mx-auto max-w-[1280px] animate-pulse px-5 py-9 sm:px-8 lg:px-10"
    >
      <div className="h-8 w-48 rounded bg-[#202024]" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-[#18181b]" />
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-20 rounded bg-[#18181b]"
          />
        ))}
      </div>
      <div className="mt-10 h-64 rounded-lg border border-[#272727] bg-[#111113]" />
    </div>
  );
}
