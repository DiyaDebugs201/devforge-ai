export default function LoadingSpinner({ text = 'Generating...', subtext = 'This may take up to 30 seconds on the free tier' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
      <div className="relative">
        <div className="w-12 h-12 border-2 border-brand-500/30 rounded-full" />
        <div className="absolute inset-0 w-12 h-12 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-slate-300 font-medium">{text}</p>
        {subtext && <p className="text-slate-500 text-sm mt-1">{subtext}</p>}
      </div>
    </div>
  );
}
