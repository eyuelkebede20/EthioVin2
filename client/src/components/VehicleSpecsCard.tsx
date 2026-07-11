import { Car, Gauge, Cpu, Fuel, Settings, Ruler, ShieldCheck, Wrench, Cog, Truck, Zap, CircleDot, Weight, Tag } from "lucide-react";

interface VehicleSpecsCardProps {
  specs: Record<string, unknown>;
}

interface CategoryStyle {
  icon: React.ComponentType<{ className?: string }>;
  gradient: string; // header gradient
  glow: string; // hover shadow color
  chip: string; // field chip background
  dot: string; // accent dot color
}

const DEFAULT_STYLE: CategoryStyle = {
  icon: Car,
  gradient: "from-orange-500 to-amber-600",
  glow: "hover:shadow-orange-300/50",
  chip: "bg-orange-50",
  dot: "text-orange-500",
};

// Warm, orange-family palette so every card stays on-theme while categories
// remain distinguishable. Keys are the lower-cased spec section names.
const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  engine: { icon: Cpu, gradient: "from-orange-500 to-red-500", glow: "hover:shadow-orange-300/50", chip: "bg-orange-50", dot: "text-orange-600" },
  transmission: { icon: Settings, gradient: "from-amber-500 to-orange-500", glow: "hover:shadow-amber-300/50", chip: "bg-amber-50", dot: "text-amber-600" },
  weightandcapacity: { icon: Weight, gradient: "from-orange-600 to-amber-500", glow: "hover:shadow-orange-300/50", chip: "bg-orange-50", dot: "text-orange-600" },
  dimensions: { icon: Ruler, gradient: "from-amber-600 to-yellow-500", glow: "hover:shadow-amber-300/50", chip: "bg-amber-50", dot: "text-amber-600" },
  tiresandchassis: { icon: CircleDot, gradient: "from-rose-500 to-orange-500", glow: "hover:shadow-rose-300/50", chip: "bg-rose-50", dot: "text-rose-500" },
  classification: { icon: Tag, gradient: "from-orange-500 to-rose-500", glow: "hover:shadow-orange-300/50", chip: "bg-orange-50", dot: "text-orange-600" },
  electricvehicle: { icon: Zap, gradient: "from-emerald-500 to-teal-500", glow: "hover:shadow-emerald-300/50", chip: "bg-emerald-50", dot: "text-emerald-600" },
  marketinformation: { icon: Tag, gradient: "from-yellow-500 to-amber-600", glow: "hover:shadow-yellow-300/50", chip: "bg-yellow-50", dot: "text-yellow-600" },
  // generic fall-backs
  safety: { icon: ShieldCheck, gradient: "from-orange-500 to-amber-500", glow: "hover:shadow-orange-300/50", chip: "bg-orange-50", dot: "text-orange-600" },
  suspension: { icon: Truck, gradient: "from-rose-500 to-orange-500", glow: "hover:shadow-rose-300/50", chip: "bg-rose-50", dot: "text-rose-500" },
  performance: { icon: Gauge, gradient: "from-orange-600 to-red-500", glow: "hover:shadow-orange-300/50", chip: "bg-orange-50", dot: "text-orange-600" },
  fuel: { icon: Fuel, gradient: "from-amber-500 to-yellow-500", glow: "hover:shadow-amber-300/50", chip: "bg-amber-50", dot: "text-amber-600" },
  electrical: { icon: Zap, gradient: "from-yellow-500 to-orange-500", glow: "hover:shadow-yellow-300/50", chip: "bg-yellow-50", dot: "text-yellow-600" },
  drivetrain: { icon: Cog, gradient: "from-amber-600 to-orange-600", glow: "hover:shadow-amber-300/50", chip: "bg-amber-50", dot: "text-amber-600" },
  service: { icon: Wrench, gradient: "from-orange-700 to-amber-700", glow: "hover:shadow-orange-300/50", chip: "bg-orange-50", dot: "text-orange-700" },
};

const humanize = (s: string) =>
  s
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim();

export default function VehicleSpecsCard({ specs }: VehicleSpecsCardProps) {
  if (!specs || Object.keys(specs).length === 0) {
    return (
      <div className="card border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-100 shadow-md">
        <div className="card-body items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-200/70">
            <Car className="h-8 w-8 text-orange-600" />
          </div>
          <h2 className="card-title text-slate-700">No Specifications Found</h2>
          <p className="text-sm text-slate-500">This vehicle does not currently have hardware specifications.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {Object.entries(specs).map(([category, details]) => {
        const style = CATEGORY_STYLES[category.toLowerCase()] ?? DEFAULT_STYLE;
        const Icon = style.icon;

        return (
          <div
            key={category}
            className={`card overflow-hidden border border-orange-100 bg-base-100 shadow-lg transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${style.glow}`}
          >
            {/* Header */}
            <div className={`relative overflow-hidden bg-gradient-to-r ${style.gradient} p-5`}>
              {/* shine highlights */}
              <div className="pointer-events-none absolute -right-2 -top-6 h-24 w-24 rounded-full bg-white/25 blur-2xl" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />

              <div className="relative flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur ring-1 ring-white/30">
                  <Icon className="h-7 w-7 text-white drop-shadow" />
                </div>
                <div>
                  <h3 className="text-xl font-black capitalize tracking-wide text-white drop-shadow-sm">{humanize(category)}</h3>
                  <p className="text-sm text-white/85">Vehicle hardware details</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="card-body p-5">
              {typeof details === "object" && details !== null ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Object.entries(details as Record<string, unknown>).map(([key, val]) => (
                    <div key={key} className={`rounded-xl border border-white ${style.chip} p-3 shadow-sm transition-transform duration-200 hover:scale-[1.03]`}>
                      <div className="mb-1 flex items-center gap-2">
                        <CircleDot className={`h-3.5 w-3.5 ${style.dot}`} />
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{humanize(key)}</span>
                      </div>
                      <div className="break-words text-sm font-bold text-slate-800 sm:text-base">{String(val)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`rounded-xl ${style.chip} p-4 text-sm font-semibold text-slate-700`}>{String(details)}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
