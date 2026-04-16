'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ArrowUp,
  Printer,
  FileText,
  Scale,
  Users,
  CreditCard,
  ShieldAlert,
  Mail,
} from 'lucide-react';

const sections = [
  {
    id: 'acceptance',
    icon: FileText,
    title: '1. Acceptance of Terms',
    content: `By accessing or using the Co-duck platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to all the terms and conditions, you may not access or use the Service.

These Terms apply to all visitors, users, coaches, and clients who access or use the Service. By using the Service, you represent that you are at least 18 years of age and have the legal capacity to enter into these Terms.

We may update these Terms from time to time. We will notify you of any changes by posting the new Terms on this page and updating the "Last Updated" date. Your continued use of the Service after any such changes constitutes your acceptance of the new Terms.`,
  },
  {
    id: 'services',
    icon: Users,
    title: '2. Description of Services',
    content: `Co-duck provides a platform connecting individuals seeking coaching services ("Clients") with professional coaches ("Coaches"). Our services include:

• **Coach Discovery**: Browse and search for coaches by specialty, availability, and pricing
• **Session Booking**: Schedule one-on-one and group coaching sessions
• **Communication Tools**: Secure messaging between clients and coaches
• **Payment Processing**: Secure handling of payments for coaching services
• **Progress Tracking**: Tools for tracking coaching goals and milestones

We do not provide coaching services directly. Coaches on our platform are independent professionals responsible for the quality and delivery of their services.`,
  },
  {
    id: 'accounts',
    icon: Users,
    title: '3. User Accounts',
    content: `**Account Creation**: To use certain features of the Service, you must create an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.

**Account Security**: You are responsible for safeguarding your password and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.

**Account Types**:
• **Client Accounts**: For individuals seeking coaching services
• **Coach Accounts**: For professionals providing coaching services (subject to additional verification)

**Account Termination**: We reserve the right to suspend or terminate your account at any time for violations of these Terms or for any other reason at our discretion.`,
  },
  {
    id: 'coaches',
    icon: Scale,
    title: '4. Coach Terms',
    content: `If you register as a Coach on Co-duck, you agree to the following additional terms:

**Qualifications**: You represent that you have the appropriate qualifications, training, and experience to provide coaching services in your stated areas of expertise.

**Independent Contractor**: You acknowledge that you are an independent contractor and not an employee, agent, or representative of Co-duck.

**Service Quality**: You agree to provide professional, ethical, and high-quality coaching services to clients.

**Availability**: You are responsible for keeping your calendar updated and honoring scheduled sessions.

**Fees and Payments**: You set your own rates. Co-duck charges a platform fee (currently 15%) on each transaction. Payments are processed through our secure payment system.

**Cancellation Policy**: You must establish and communicate a clear cancellation policy to clients.`,
  },
  {
    id: 'clients',
    icon: Users,
    title: '5. Client Terms',
    content: `If you use Co-duck as a Client, you agree to the following:

**Booking Sessions**: When you book a session, you enter into a direct agreement with the Coach for the services described.

**Payments**: You agree to pay for all sessions booked through the platform. Payments are processed securely through our payment provider.

**Cancellations**: You agree to abide by each Coach's cancellation policy. Refunds are subject to the Coach's policy and our dispute resolution process.

**Communication**: You agree to communicate respectfully with Coaches and other users on the platform.

**No Guarantee of Results**: Coaching outcomes depend on many factors. We do not guarantee any specific results from coaching sessions.`,
  },
  {
    id: 'payments',
    icon: CreditCard,
    title: '6. Payments and Fees',
    content: `**Payment Processing**: All payments are processed through Stripe, our secure payment provider. By using our Service, you also agree to Stripe's terms of service.

**Platform Fees**: Co-duck charges a platform fee on each transaction. Current fee structure:
• Coach platform fee: 15% of session price
• Client payment processing: Included in session price

**Refunds**: Refunds are handled according to each Coach's cancellation policy. In cases of dispute, Co-duck may mediate and determine appropriate refunds.

**Payouts**: Coaches receive payouts according to our payout schedule, typically within 7-14 business days after session completion.

**Taxes**: You are responsible for determining and paying any applicable taxes on your earnings or purchases.`,
  },
  {
    id: 'conduct',
    icon: ShieldAlert,
    title: '7. Prohibited Conduct',
    content: `You agree not to engage in any of the following prohibited activities:

• Violating any applicable laws or regulations
• Impersonating any person or entity
• Interfering with or disrupting the Service
• Attempting to gain unauthorized access to any accounts or systems
• Transmitting viruses, malware, or other harmful code
• Harassing, abusing, or threatening other users
• Using the Service for any illegal or unauthorized purpose
• Circumventing the platform to avoid fees
• Soliciting direct payments outside the platform
• Posting false or misleading information
• Violating intellectual property rights
• Collecting user data without consent`,
  },
  {
    id: 'intellectual',
    icon: FileText,
    title: '8. Intellectual Property',
    content: `**Co-duck Property**: The Service and its original content, features, and functionality are owned by Co-duck and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.

**User Content**: You retain ownership of any content you submit to the Service. By submitting content, you grant Co-duck a worldwide, non-exclusive, royalty-free license to use, copy, modify, and display such content in connection with the Service.

**Coach Materials**: Coaches retain ownership of their coaching materials, methodologies, and content shared during sessions.

**Feedback**: Any feedback, suggestions, or ideas you provide about the Service may be used by Co-duck without any obligation to you.`,
  },
  {
    id: 'liability',
    icon: Scale,
    title: '9. Limitation of Liability',
    content: `**Disclaimer**: THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.

**Limitation**: TO THE MAXIMUM EXTENT PERMITTED BY LAW, ACCREDIPRO COACHHUB SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES.

**Cap on Liability**: OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.

**Coach Services**: We are not responsible for the quality, safety, or legality of coaching services provided by Coaches on the platform.`,
  },
  {
    id: 'disputes',
    icon: Scale,
    title: '10. Dispute Resolution',
    content: `**Informal Resolution**: Before filing any formal dispute, you agree to try to resolve the dispute informally by contacting us at support@co-duck.com.

**Arbitration**: Any disputes that cannot be resolved informally shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.

**Class Action Waiver**: You agree to resolve disputes with us on an individual basis and waive any right to participate in class action lawsuits or class-wide arbitration.

**Governing Law**: These Terms shall be governed by the laws of the State of California, without regard to conflict of law principles.`,
  },
  {
    id: 'termination',
    icon: FileText,
    title: '11. Termination',
    content: `**By You**: You may terminate your account at any time by contacting us or using the account deletion feature in your settings.

**By Us**: We may terminate or suspend your account immediately, without prior notice or liability, for any reason, including if you breach these Terms.

**Effect of Termination**: Upon termination:
• Your right to use the Service will immediately cease
• You remain responsible for any outstanding payments
• Coaches must honor any pre-booked sessions or arrange refunds
• Some provisions of these Terms will survive termination`,
  },
  {
    id: 'contact',
    icon: Mail,
    title: '12. Contact Information',
    content: `If you have any questions about these Terms of Service, please contact us:

**Email**: legal@co-duck.com

**Mailing Address**:
Co-duck Legal Team
123 Innovation Drive
San Francisco, CA 94105
United States

**Support**: For general support inquiries, please visit our Contact page or email support@co-duck.com.`,
  },
];

const tableOfContents = sections.map((section) => ({
  id: section.id,
  title: section.title,
}));

// Simple markdown renderer for bold text and bullet points
function renderMarkdown(text: string): React.ReactNode {
  // Split by bold markers and create alternating text/bold elements
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    // Check if this part is bold (wrapped in **)
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold text-foreground">
          {boldText}
        </strong>
      );
    }
    // Check for bullet points
    if (part.startsWith('• ')) {
      return (
        <span key={index} className="block pl-4">
          • {part.slice(2)}
        </span>
      );
    }
    return part;
  });
}

export default function TermsPage() {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);

      // Update active section based on scroll position
      const sectionElements = sections.map((s) => ({
        id: s.id,
        element: document.getElementById(s.id),
      }));

      for (const section of sectionElements.reverse()) {
        if (section.element) {
          const rect = section.element.getBoundingClientRect();
          if (rect.top <= 150) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-burgundy-dark to-burgundy">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center rounded-full bg-gold/20 px-4 py-2 text-sm font-medium text-white">
              <Scale className="mr-2 h-4 w-4" />
              Legal Document
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Terms of Service
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-white/70">Last updated: January 31, 2026</p>
            <p className="mx-auto mt-2 text-sm text-white/70">
              Please read these terms carefully before using Co-duck.
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button variant="outline" asChild>
                <Link href="/privacy">View Privacy Policy</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      </section>

      {/* Main Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-12 lg:grid-cols-[280px_1fr]">
            {/* Table of Contents - Sidebar */}
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Table of Contents
                </h2>
                <nav className="space-y-1">
                  {tableOfContents.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                        activeSection === item.id
                          ? 'bg-burgundy/10 font-medium text-burgundy'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {item.title}
                    </button>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Accordion Content */}
            <div className="max-w-3xl">
              {/* Mobile Table of Contents */}
              <div className="mb-8 lg:hidden">
                <details className="rounded-lg border p-4">
                  <summary className="cursor-pointer font-semibold">Table of Contents</summary>
                  <nav className="mt-4 space-y-2">
                    {tableOfContents.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => scrollToSection(item.id)}
                        className="block w-full rounded px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                      >
                        {item.title}
                      </button>
                    ))}
                  </nav>
                </details>
              </div>

              {/* Introduction */}
              <div className="mb-8 rounded-lg border bg-cream p-6">
                <p className="text-muted-foreground">
                  Welcome to Co-duck. These Terms of Service govern your use of our
                  platform and services. By accessing or using Co-duck, you agree to be
                  bound by these terms. Please read them carefully.
                </p>
              </div>

              {/* Sections */}
              <Accordion type="multiple" className="space-y-4" defaultValue={['acceptance']}>
                {sections.map((section) => (
                  <AccordionItem
                    key={section.id}
                    value={section.id}
                    id={section.id}
                    className="rounded-lg border bg-background px-6"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-burgundy/10">
                          <section.icon className="h-5 w-5 text-burgundy" />
                        </div>
                        <span className="text-left font-semibold">{section.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 pt-2">
                      <div className="prose prose-sm max-w-none text-muted-foreground">
                        {section.content.split('\n\n').map((paragraph, i) => (
                          <p key={i} className="mb-4 whitespace-pre-line">
                            {renderMarkdown(paragraph)}
                          </p>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              {/* Footer Note */}
              <div className="mt-12 rounded-lg border bg-cream p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  By using Co-duck, you acknowledge that you have read, understood, and
                  agree to be bound by these Terms of Service.
                </p>
                <div className="mt-4 flex justify-center gap-4">
                  <Button variant="outline" asChild>
                    <Link href="/privacy">Privacy Policy</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/contact">Contact Us</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-burgundy text-white shadow-lg transition-transform hover:scale-110"
          aria-label="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
