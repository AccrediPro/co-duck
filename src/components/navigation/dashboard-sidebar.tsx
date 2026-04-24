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
  roles?: UserRole[];
  showBadge?: boolean;
}

interface NavSection {
  label: string;
  links: NavLink[];
}

// Build grouped navigation sections based on role
function getNavSectionsForRole(role: UserRole): NavSection[] {
  const sections: NavSection[] = [];

  // Overview is always first, ungrouped
  sections.push({
    label: '',
    links: [{ href: '/dashboard', label: 'Overview', icon: Home }],
  });

  if (role === 'coach') {
    sections.push({
      label: 'Coaching',
      links: [
        { href: '/dashboard/sessions', label: 'Sessions', icon: CalendarDays },
        { href: '/dashboard/clients', label: 'My Clients', icon: Users },
        { href: '/dashboard/availability', label: 'Availability', icon: Clock },
        { href: '/dashboard/memberships', label: 'Memberships', icon: Repeat },
        { href: '/dashboard/forms', label: 'Forms', icon: ClipboardList },
        {
          href: '/dashboard/iconnect',
          label: 'iConnect',
          icon: LayoutList,
          showBadge: true,
        },
      ],
    });
    sections.push({
      label: 'Account',
      links: [
        { href: '/dashboard/profile', label: 'Profile', icon: User },
        { href: '/dashboard/payments', label: 'Payments', icon: CreditCard },
        { href: '/dashboard/embed', label: 'Embed Widget', icon: Code2 },
        {
          href: '/dashboard/messages',
          label: 'Messages',
          icon: MessageSquare,
          showBadge: true,
        },
        { href: '/dashboard/settings', label: 'Settings', icon: Settings },
      ],
    });
  } else if (role === 'client') {
    sections.push({
      label: 'Coaching',
      links: [
        { href: '/dashboard/my-coaches', label: 'My Coach', icon: UserCheck },
        { href: '/dashboard/my-sessions', label: 'My Sessions', icon: CalendarDays },
        { href: '/dashboard/my-memberships', label: 'Memberships', icon: Repeat },
        {
          href: '/dashboard/iconnect',
          label: 'iConnect',
          icon: LayoutList,
          showBadge: true,
        },
      ],
    });
    sections.push({
      label: 'Account',
      links: [
        { href: '/dashboard/profile', label: 'Profile', icon: User },
        {
          href: '/dashboard/messages',
          label: 'Messages',
          icon: MessageSquare,
          showBadge: true,
        },
        { href: '/dashboard/settings', label: 'Settings', icon: Settings },
      ],
    });
  } else {
    // Admin sees both
    sections.push({
      label: 'Coaching',
      links: [
        { href: '/dashboard/sessions', label: 'Sessions', icon: CalendarDays },
        { href: '/dashboard/clients', label: 'My Clients', icon: Users },
        { href: '/dashboard/availability', label: 'Availability', icon: Clock },
        { href: '/dashboard/memberships', label: 'Memberships', icon: Repeat },
        { href: '/dashboard/forms', label: 'Forms', icon: ClipboardList },
        { href: '/dashboard/my-coaches', label: 'My Coach', icon: UserCheck },
        { href: '/dashboard/my-sessions', label: 'My Sessions', icon: CalendarDays },
        { href: '/dashboard/my-memberships', label: 'Memberships', icon: Repeat },
        {
          href: '/dashboard/iconnect',
          label: 'iConnect',
          icon: LayoutList,
          showBadge: true,
        },
      ],
    });
    sections.push({
      label: 'Account',
      links: [
        { href: '/dashboard/profile', label: 'Profile', icon: User },
        { href: '/dashboard/payments', label: 'Payments', icon: CreditCard },
        { href: '/dashboard/embed', label: 'Embed Widget', icon: Code2 },
        {
          href: '/dashboard/messages',
          label: 'Messages',
          icon: MessageSquare,
          showBadge: true,
        },
        { href: '/dashboard/settings', label: 'Settings', icon: Settings },
      ],
    });
  }

  return sections;
}

interface DashboardSidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  userRole?: UserRole;
  unreadMessageCount?: number;
  iconnectUnreadCount?: number;
}

function NavLinkItem({
  link,
  isActive,
  badgeCount,
  onClick,
}: {
  link: NavLink;
  isActive: boolean;
  badgeCount: number;
  onClick?: () => void;
}) {
  const Icon = link.icon;
  const showBadge = link.showBadge && badgeCount > 0;

  return (
    <Link
      href={link.href}
      onClick={onClick}
      className={cn(
        'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'border-l-[3px] border-l-gold bg-burgundy text-white'
          : 'text-muted-foreground hover:bg-burgundy/5 hover:text-burgundy'
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{link.label}</span>
      {showBadge && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-xs font-medium text-white">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </Link>
  );
}

function NavSections({
  sections,
  isActiveLink,
  getBadgeCount,
  onClick,
}: {
  sections: NavSection[];
  isActiveLink: (href: string) => boolean;
  getBadgeCount: (link: NavLink) => number;
  onClick?: () => void;
}) {
  return (
    <>
      {sections.map((section, idx) => (
        <div key={section.label || idx}>
          {section.label && (
            <>
              {idx > 0 && <div className="mx-3 my-1 border-b border-burgundy/10" />}
              <p className="mb-2 mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-burgundy/60">
                {section.label}
              </p>
            </>
          )}
          {section.links.map((link) => (
            <NavLinkItem
              key={link.href}
              link={link}
              isActive={isActiveLink(link.href)}
              badgeCount={getBadgeCount(link)}
              onClick={onClick}
            />
          ))}
        </div>
      ))}
    </>
  );
}

export function DashboardSidebar({
  userName,
  userEmail,
  userRole = 'client',
  unreadMessageCount: initialUnreadCount = 0,
  iconnectUnreadCount: initialIConnectUnread = 0,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const sections = getNavSectionsForRole(userRole);
  const unreadMessageCount = useUnreadMessageCount(initialUnreadCount);
  const iconnectUnreadCount = useIConnectUnread(initialIConnectUnread);

  const isActiveLink = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const getBadgeCount = (link: NavLink) => {
    if (link.href === '/dashboard/messages') return unreadMessageCount;
    if (link.href === '/dashboard/iconnect') return iconnectUnreadCount;
    return 0;
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-background md:flex">
        {/* Logo + Notification Bell */}
        <div className="flex h-16 items-center justify-between px-6">
          <Link
            href="/"
            className="flex min-h-[44px] min-w-0 flex-1 items-center truncate text-sm font-bold text-burgundy-dark"
          >
            AccrediPro CoachHub
          </Link>
          <NotificationBell />
        </div>

        <Separator />

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <NavSections
            sections={sections}
            isActiveLink={isActiveLink}
            getBadgeCount={getBadgeCount}
          />
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
  const sections = getNavSectionsForRole(userRole);
  const unreadMessageCount = useUnreadMessageCount(initialUnreadCount);
  const iconnectUnreadCount = useIConnectUnread(initialIConnectUnread);

  const isActiveLink = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const getBadgeCount = (link: NavLink) => {
    if (link.href === '/dashboard/messages') return unreadMessageCount;
    if (link.href === '/dashboard/iconnect') return iconnectUnreadCount;
    return 0;
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
      <Link
        href="/"
        className="flex min-h-[44px] items-center whitespace-nowrap text-xl font-bold text-burgundy-dark"
      >
        AccrediPro CoachHub
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
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-medium text-white">
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
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-medium text-white">
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
                  className="flex min-h-[44px] items-center truncate text-sm font-bold text-burgundy-dark"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  AccrediPro CoachHub
                </Link>
              </div>

              <Separator />

              {/* Navigation Links */}
              <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
                <NavSections
                  sections={sections}
                  isActiveLink={isActiveLink}
                  getBadgeCount={getBadgeCount}
                  onClick={() => setMobileMenuOpen(false)}
                />
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
