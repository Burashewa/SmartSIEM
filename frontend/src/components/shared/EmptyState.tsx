interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-8 text-center">
      <h3 className="text-lg text-white">{title}</h3>
      {description ? <p className="text-sm text-gray-400 mt-1">{description}</p> : null}
    </div>
  );
}
