type Variant = "error" | "success" | "info";

const styles: Record<Variant, string> = {
  error: "bg-red-50 border-red-200 text-red-700",
  success: "bg-green-50 border-green-200 text-green-700",
  info: "bg-blue-50 border-blue-200 text-blue-700",
};

/** Inline status banner. Use instead of alert() for user-facing feedback. */
export default function Banner({ variant = "info", children }: { variant?: Variant; children: React.ReactNode }) {
  if (!children) return null;
  return <div className={`rounded-lg border p-3 text-sm font-medium ${styles[variant]}`}>{children}</div>;
}
