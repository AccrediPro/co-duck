'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  User,
  Users,
  UserCheck,
  CalendarDays,
  Clock,
  Code2,
  Settings,
  Menu,
  CreditCard,
  MessageSquare,
  LayoutList,
  Repeat,
  ClipboardList,
} from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount';
import { useIConnectUnread } from '@/hooks/useIConnectUnread';

type UserRole = 'admin' | 'coach' | 'client';

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[]; // If undefined, visible to all roles
  showBadge?: boolean; // Whether to show unread badge for this link
}

// Common links visible to all roles
const commonLinks: NavLink[] = [
  { href: '/dashboard', label: 'Overview', icon: Home },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare, showBadge: true },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

// Profile link visible to all roles
const profileLink: NavLink = { href: '/dashboard/profile', label: 'Profile', icon: User };

// Coach-specific links
const coachLinks: NavLink[] = [
  { href: '/dashboard/sessions', label: 'Sessions', icon: CalendarDays, roles: ['coach'] },
  { href: '/dashboard/clients', label: 'My Clients', icon: Users, roles: ['coach'] },
  { href: '/dashboard/availability', label: 'Availability', icon: Clock, roles: ['coach'] },
  { href: '/dashboard/memberships', label: 'Memberships', icon: Repeat, roles: ['coach'] },
  { href: '/dashboard/forms', label: 'Forms', icon: ClipboardList, roles: ['coach'] },
  { href: '/dashboard/embed', label: 'Embed widget', icon: Code2, roles: ['coach'] },
  { href: '/dashboard/payments', label: 'Payments', icon: CreditCard, roles: ['coach'] },
  {
    href: '/dashboard/iconnect',
    label: 'iConnect',
    icon: LayoutList,
    roles: ['coach'],
    showBadge: true,
  },
];

// Client-specific links
const clientLinks: NavLink[] = [
  { href: '/dashboard/my-coaches', label: 'My Coach', icon: UserCheck, roles: ['client'] },
  { href: '/dashboard/my-sessions', label: 'My Sessions', icon: CalendarDays, roles: ['client'] },
  {
    href: '/dashboard/my-memberships',
    label: 'Memberships',
    icon: Repeat,
    roles: ['client'],
  },
  {
    href: '/dashboard/iconnect',
    label: 'iConnect',
    icon: LayoutList,
    roles: ['client'],
    showBadge: true,
  },
];

// Get navigation links based on user role
function getNavLinksForRole(role: UserRole): NavLink[] {
  const links: NavLink[] = [commonLinks[0]]; // Overview first

  // Profile link visible to all roles
  links.push(profileLink);

  if (role === 'coach') {
    links.push(...coachLinks);
  } else if (role === 'client') {
    links.push(...clientLinks);
  } else if (role === 'admin') {
    // Admins see both coach and client links
    links.push(...coachLinks, ...clientLinks);
  }

  // Messages link (visible to all)
  links.push(commonLinks[1]);
  // Settings last
  links.push(commonLinks[2]);
  return links;
}

interface DashboardSidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  userRole?: UserRole;
  unreadMessageCount?: number;
  iconnectUnreadCount?: number;
}

export function DashboardSidebar({
  userName,
  userEmail,
  userRole = 'client',
  unreadMessageCount: initialUnreadCount = 0,
  iconnectUnreadCount: initialIConnectUnread = 0,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const navLinks = getNavLinksForRole(userRole);
  const unreadMessageCount = useUnreadMessageCount(initialUnreadCount);
  const iconnectUnreadCount = useIConnectUnread(initialIConnectUnread);

  const isActiveLink = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-background md:flex">
        {/* Logo + Notification Bell */}
        <div className="flex h-16 items-center justify-between px-6">
          <Link
            href="/"
            className="flex min-h-[44px] min-w-0 flex-1 items-center truncate text-sm font-bold"
          >
            Co-duck
          </Link>
          <NotificationBell />
        </div>

        <Separator />

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const badgeCount =
              link.href === '/dashboard/messages'
                ? unreadMessageCount
                : link.href === '/dashboard/iconnect'
                  ? iconnectUnreadCount
                  : 0;
            const showBadge = link.showBadge && badgeCount > 0;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActiveLink(link.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{link.label}</span>
                {showBadge && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
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
      </aside>
    </>
  );
}

export function DashboardMobileHeader({
  userName,
  userEmail,
  userRole = 'client',
  unreadMessageCount: initialUnreadCount = 0,
  iconnectUnreadCount: initialIConnectUnread = 0,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navLinks = getNavLinksForRole(userRole);
  const unreadMessageCount = useUnreadMessageCount(initialUnreadCount);
  const iconnectUnreadCount = useIConnectUnread(initialIConnectUnread);

  const isActiveLink = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
      <Link href="/" className="flex min-h-[44px] items-center whitespace-nowrap text-xl font-bold">
        Co-duck
      </Link>

      <div className="flex items-center gap-2">
        <NotificationBell />
        {/* Unread badge indicator on mobile header */}
        {unreadMessageCount > 0 && (
          <Link
            href="/dashboard/messages"
            className="relative flex min-h-[44px] min-w-[44px] items-center justify-center"
          >
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
            </span>
          </Link>
        )}
        {iconnectUnreadCount > 0 && (
          <Link
            href="/dashboard/iconnect"
            className="relative flex min-h-[44px] min-w-[44px] items-center justify-center"
          >
            <LayoutList className="h-5 w-5 text-muted-foreground" />
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--brand-accent))] px-1 text-[10px] font-medium text-white">
              {iconnectUnreadCount > 99 ? '99+' : iconnectUnreadCount}
            </span>
          </Link>
        )}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} modal={false}>
          <SheetTrigger asChild>
            <Button variant="ghost" className="h-11 w-11 p-0" aria-label="Open navigation menu">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-64 p-0 [&>button]:right-3 [&>button]:top-3 [&>button]:h-11 [&>button]:w-11 [&>button]:opacity-100"
            onInteractOutside={() => setMobileMenuOpen(false)}
          >
            <SheetTitle className="sr-only">Dashboard Navigation</SheetTitle>
            <div className="flex h-full flex-col">
              {/* Logo */}
              <div className="flex h-16 items-center px-6">
                <Link
                  href="/"
                  className="flex min-h-[44px] items-center truncate text-sm font-bold"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Co-duck
                </Link>
              </div>

              <Separator />

              {/* Navigation Links */}
              <nav className="flex-1 space-y-1 px-3 py-4">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const badgeCount =
                    link.href === '/dashboard/messages'
                      ? unreadMessageCount
                      : link.href === '/dashboard/iconnect'
                        ? iconnectUnreadCount
                        : 0;
                  const showBadge = link.showBadge && badgeCount > 0;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActiveLink(link.href)
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{link.label}</span>
                      {showBadge && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
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
      </div>
    </header>
  );
}
