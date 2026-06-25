import type { NavItem } from "@/components/AppShell";

export const GARAGE_NAV: NavItem[] = [
  { href: "/garage", label: "Jobs" },
  { href: "/garage/customers", label: "Customers" },
  { href: "/garage/appointments", label: "Appointments" },
  { href: "/garage/parts", label: "Parts" },
];

export const INSURER_NAV: NavItem[] = [
  { href: "/insurer", label: "Vehicle lookup" },
  { href: "/insurer/claims", label: "Submit claim" },
  { href: "/insurer/police", label: "Police report" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Analytics" },
  { href: "/admin/orgs", label: "Organizations" },
  { href: "/admin/trust", label: "Trust & Fraud" },
  { href: "/admin/conflicts", label: "Conflicts" },
  { href: "/admin/settings", label: "Settings" },
];
