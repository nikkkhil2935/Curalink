import SourceCard from './SourceCard.jsx';

export default function PublicationsTab({ sources }) {
  if (!sources.length) {
    return <Empty label="No publications available yet." />;
  }

  return (
    <div className="space-y-3">
      {sources.map((source, index) => (
        <SourceCard key={source._id || `pub-${index}`} source={source} prefix={`P${index + 1}`} />
      ))}
    </div>
  );
}

function Empty({ label }) {
  return <p className="text-sm text-slate-400">{label}</p>;
}
