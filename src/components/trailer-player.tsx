export function TrailerLink({ trailerId, title }: { trailerId: string; title: string }) {
  return (
    <a
      href={`https://www.youtube.com/watch?v=${trailerId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover font-bold"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M8 5v14l11-7z" />
      </svg>
      PVを再生
    </a>
  );
}
