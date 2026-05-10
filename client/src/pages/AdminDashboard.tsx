import WMIResolutionPanel from "../components/adminDashboard/WMIResolutionPanel";

export default function AdminDashboard() {
  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>

      <WMIResolutionPanel />

      {/* Future components will go here */}
      {/* <OrganizationApprovalPanel /> */}
      {/* <CreditManagementPanel /> */}
    </div>
  );
}
