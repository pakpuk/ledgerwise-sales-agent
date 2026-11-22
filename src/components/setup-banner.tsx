import { featureStatus } from "@/infrastructure/container";

/** Plain-language notice of what isn't configured yet, so nothing silently pretends to work. */
export function SetupBanner() {
  const missing = featureStatus().filter((f) => !f.ok);
  if (missing.length === 0) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-medium">Some features are not connected yet</p>
      <ul className="mt-1 list-disc pl-5">
        {missing.map((f) => (
          <li key={f.key}>
            <span className="font-mono text-xs">{f.key}</span>: {f.affects}
          </li>
        ))}
      </ul>
    </div>
  );
}
