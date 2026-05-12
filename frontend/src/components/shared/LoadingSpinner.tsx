export function LoadingSpinner() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="size-10 border-2 border-[#4f46e5] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
