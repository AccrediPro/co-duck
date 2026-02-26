'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, UserCheck, Menu, Shield, Star } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const adminLinks: NavLink[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/coaches', label: 'Coaches', icon: UserCheck },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
];

interface AdminSidebarProps {
  userName?: string | null;
  userEmail?: string | null;
}

export function AdminSidebar({ userName, userEmail }: AdminSidebarProps) {
  const pathname = usePathname();

  const isActiveLink = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <Link href="/admin" className="flex items-center gap-2 text-xl font-bold">
          <Shield className="h-5 w-5 text-amber-500" />
          <span>Admin</span>
        </Link>
      </div>

      <Separator />

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {adminLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActiveLink(link.href)
                  ? 'bg-amber-500 text-white'
                  : 'text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* Back to Dashboard Link */}
      <div className="px-3 py-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <Separator />

      {/* User Info */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <UserButton afterSignOutUrl="/" />
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{userName || 'Admin'}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-amber-200 bg-gradient-to-b from-amber-50/50 to-background md:flex">
        <NavContent />
      </aside>
    </>
  );
}

export function AdminMobileHeader({ userName, userEmail }: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActiveLink = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-amber-200 bg-gradient-to-r from-amber-50/50 to-background px-4 md:hidden">
      <Link href="/admin" className="flex items-center gap-2 text-xl font-bold">
        <Shield className="h-5 w-5 text-amber-500" />
        <span>Admin</span>
      </Link>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
          <div className="flex h-full flex-col bg-gradient-to-b from-amber-50/50 to-background">
            {/* Logo */}
            <div className="flex h-16 items-center px-6">
              <Link
                href="/admin"
                className="flex items-center gap-2 text-xl font-bold"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Shield className="h-5 w-5 text-amber-500" />
                <span>Admin</span>
              </Link>
            </div>

            <Separator />

            {/* Navigation Links */}
            <nav className="flex-1 space-y-1 px-3 py-4">
              {adminLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActiveLink(link.href)
                        ? 'bg-amber-500 text-white'
                        : 'text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            <Separator />

            {/* Back to Dashboard Link */}
            <div className="px-3 py-2">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Back to Dashboard</span>
              </Link>
            </div>

            <Separator />

            {/* User Info */}
            <div className="p-4">
              <div className="flex items-center gap-3">
                <UserButton afterSignOutUrl="/" />
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">{userName || 'Admin'}</p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
