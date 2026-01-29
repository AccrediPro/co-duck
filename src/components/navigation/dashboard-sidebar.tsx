'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, CalendarDays, Clock, Settings, Menu } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

type UserRole = 'admin' | 'coach' | 'client';

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[]; // If undefined, visible to all roles
}

// Common links visible to all roles
const commonLinks: NavLink[] = [
  { href: '/dashboard', label: 'Overview', icon: Home },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

// Coach-specific links
const coachLinks: NavLink[] = [
  { href: '/dashboard/profile', label: 'Profile', icon: User, roles: ['coach'] },
  { href: '/dashboard/sessions', label: 'Sessions', icon: CalendarDays, roles: ['coach'] },
  { href: '/dashboard/availability', label: 'Availability', icon: Clock, roles: ['coach'] },
];

// Client-specific links
const clientLinks: NavLink[] = [
  { href: '/dashboard/my-sessions', label: 'My Sessions', icon: CalendarDays, roles: ['client'] },
];

// Get navigation links based on user role
function getNavLinksForRole(role: UserRole): NavLink[] {
  const links: NavLink[] = [commonLinks[0]]; // Overview first

  if (role === 'coach') {
    links.push(...coachLinks);
  } else if (role === 'client') {
    links.push(...clientLinks);
  } else if (role === 'admin') {
    // Admins see both coach and client links
    links.push(...coachLinks, ...clientLinks);
  }

  links.push(commonLinks[1]); // Settings last
  return links;
}

interface DashboardSidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  userRole?: UserRole;
}

export function DashboardSidebar({
  userName,
  userEmail,
  userRole = 'client',
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const navLinks = getNavLinksForRole(userRole);

  const isActiveLink = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <Link href="/" className="text-xl font-bold">
          CoachHub
        </Link>
      </div>

      <Separator />

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActiveLink(link.href)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* User Info */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <UserButton afterSignOutUrl="/" />
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{userName || 'User'}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-background md:flex">
        <NavContent />
      </aside>
    </>
  );
}

export function DashboardMobileHeader({
  userName,
  userEmail,
  userRole = 'client',
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navLinks = getNavLinksForRole(userRole);

  const isActiveLink = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
      <Link href="/" className="text-xl font-bold">
        CoachHub
      </Link>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Dashboard Navigation</SheetTitle>
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-16 items-center px-6">
              <Link href="/" className="text-xl font-bold" onClick={() => setMobileMenuOpen(false)}>
                CoachHub
              </Link>
            </div>

            <Separator />

            {/* Navigation Links */}
            <nav className="flex-1 space-y-1 px-3 py-4">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActiveLink(link.href)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <Separator />

            {/* User Info */}
            <div className="p-4">
              <div className="flex items-center gap-3">
                <UserButton afterSignOutUrl="/" />
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">{userName || 'User'}</p>
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
