import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const user = await currentUser();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <UserButton afterSignOutUrl="/" />
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Welcome, {user?.firstName || 'User'}!</h2>
          <p className="text-gray-600">
            You are signed in as <strong>{user?.emailAddresses[0]?.emailAddress}</strong>
          </p>
          <p className="mt-2 text-sm text-gray-500">User ID: {userId}</p>
        </div>

        <div className="mt-6 rounded-lg bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            This is a protected route. Only authenticated users can access this page. The middleware
            automatically redirects unauthenticated users to the sign-in page.
          </p>
        </div>
      </div>
    </div>
  );
}
