import { Car, Gauge, Cpu, Fuel, Settings, Ruler, ShieldCheck, Wrench, Cog, Truck, Zap, CircleDot } from "lucide-react";

interface VehicleSpecsCardProps {
  specs: Record<string, any>;
}

export default function VehicleSpecsCard({ specs }: VehicleSpecsCardProps) {
  if (!specs || Object.keys(specs).length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100">
          <Car className="h-8 w-8 text-blue-600" />
        </div>

        <h2 className="text-lg font-bold text-slate-700">No Specifications Found</h2>

        <p className="mt-2 text-sm text-slate-500">This vehicle does not currently have hardware specifications.</p>
      </div>
    );
  }

  const categoryConfig: Record<
    string,
    {
      icon: any;
      gradient: string;
      light: string;
      iconColor: string;
    }
  > = {
    engine: {
      icon: Cpu,
      gradient: "from-blue-500 to-cyan-500",
      light: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    transmission: {
      icon: Settings,
      gradient: "from-purple-500 to-fuchsia-500",
      light: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    dimensions: {
      icon: Ruler,
      gradient: "from-orange-500 to-amber-500",
      light: "bg-orange-50",
      iconColor: "text-orange-600",
    },
    safety: {
      icon: ShieldCheck,
      gradient: "from-green-500 to-emerald-500",
      light: "bg-green-50",
      iconColor: "text-green-600",
    },
    suspension: {
      icon: Truck,
      gradient: "from-red-500 to-rose-500",
      light: "bg-red-50",
      iconColor: "text-red-600",
    },
    performance: {
      icon: Gauge,
      gradient: "from-indigo-500 to-blue-500",
      light: "bg-indigo-50",
      iconColor: "text-indigo-600",
    },
    fuel: {
      icon: Fuel,
      gradient: "from-yellow-500 to-orange-500",
      light: "bg-yellow-50",
      iconColor: "text-yellow-600",
    },
    electrical: {
      icon: Zap,
      gradient: "from-pink-500 to-rose-500",
      light: "bg-pink-50",
      iconColor: "text-pink-600",
    },
    drivetrain: {
      icon: Cog,
      gradient: "from-teal-500 to-cyan-500",
      light: "bg-teal-50",
      iconColor: "text-teal-600",
    },
    service: {
      icon: Wrench,
      gradient: "from-slate-600 to-slate-800",
      light: "bg-slate-100",
      iconColor: "text-slate-700",
    },
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {Object.entries(specs).map(([category, details]) => {
        const config = categoryConfig[category.toLowerCase()] || {
          icon: Car,
          gradient: "from-slate-700 to-slate-900",
          light: "bg-slate-100",
          iconColor: "text-slate-700",
        };

        const Icon = config.icon;

        return (
          <div key={category} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            {/* Header */}
            <div className={`bg-gradient-to-r ${config.gradient} relative overflow-hidden p-5`}>
              <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

              <div className="relative flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                  <Icon className="h-7 w-7 text-white" />
                </div>

                <div>
                  <h3 className="text-xl font-black tracking-wide text-white capitalize">{category.replace(/([A-Z])/g, " $1").trim()}</h3>

                  <p className="text-sm text-white/80">Vehicle hardware details</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              {typeof details === "object" && details !== null ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(details).map(([key, val]) => (
                    <div key={key} className={`${config.light} rounded-2xl border border-white p-4 transition-all duration-200 hover:scale-[1.02]`}>
                      <div className="mb-2 flex items-center gap-2">
                        <CircleDot className={`h-4 w-4 ${config.iconColor}`} />

                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{key.replace(/_/g, " ")}</span>
                      </div>

                      <div className="break-words text-sm font-bold text-slate-800 sm:text-base">{String(val)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`${config.light} rounded-2xl p-5 text-sm font-semibold text-slate-700`}>{String(details)}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
