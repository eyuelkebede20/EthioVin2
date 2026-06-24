export default function NotMember({ kind }: { kind: string }) {
  return (
    <div className="card p-10 text-center">
      <h2 className="text-title text-fg">No {kind} access</h2>
      <p className="mx-auto mt-2 max-w-md text-body text-fg-muted">
        Your account isn&apos;t a member of a {kind} organization. Ask a super-admin to add you before using this dashboard.
      </p>
    </div>
  );
}
