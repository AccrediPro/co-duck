import { UserProfile } from '@clerk/nextjs';

export default function SecuritySettingsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Security Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your password, two-factor authentication, and connected accounts
        </p>
      </div>

      <UserProfile
        appearance={{
          elements: {
            rootBox: 'w-full',
            card: 'shadow-none border rounded-lg w-full',
            navbar: 'hidden',
            pageScrollBox: 'p-0',
          },
        }}
      />
    </div>
  );
}
