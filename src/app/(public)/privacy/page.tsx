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
  Shield,
  Eye,
  Database,
  Cookie,
  Globe,
  Mail,
  Lock,
  UserCheck,
  AlertTriangle,
  Download,
  MessageSquare,
} from 'lucide-react';

const sections = [
  {
    id: 'not-hipaa',
    icon: AlertTriangle,
    title: '1. AccrediPro CoachHub Is Not a HIPAA-Covered Entity',
    content: `AccrediPro CoachHub is a coaching marketplace — not a healthcare provider, health plan, or healthcare clearinghouse. This means AccrediPro CoachHub is **not subject to HIPAA** (the Health Insurance Portability and Accountability Act).

**What this means for you:**
• Coaches on AccrediPro CoachHub are wellness and health coaches, not licensed medical providers
• Sessions are coaching conversations, not medical appointments
• Information shared in sessions is not Protected Health Information (PHI) under HIPAA law

**What we still do to protect you:**
• We encrypt all session content at rest and in transit
• We restrict access to your session notes and messages to only you and your coach
• We never sell your personal information
• We treat your health-related disclosures with the same care as any sensitive personal data

If you are working with a licensed therapist, psychiatrist, or physician on a HIPAA-regulated platform, that platform operates under different legal obligations than AccrediPro CoachHub. AccrediPro CoachHub is a coaching supplement, not a medical record system.`,
  },
  {
    id: 'not-medical',
    icon: Shield,
    title: '2. Coaches Are Not Medical Providers',
    content: `Coaches on AccrediPro CoachHub are not licensed physicians, therapists, psychologists, or other licensed medical professionals (unless separately credentialed outside the coaching context).

**Important:**
• Nothing discussed in a coaching session constitutes medical advice, diagnosis, or treatment
• Coaches cannot prescribe medications, interpret lab results, or provide clinical diagnoses
• Coaching is not a substitute for medical care, therapy, or psychiatric treatment

**If you have an urgent medical concern:**
• Contact your primary care physician
• Call 911 for emergencies
• For mental health crises, call or text 988 (Suicide & Crisis Lifeline) or text HOME to 741741 (Crisis Text Line)

This disclaimer is displayed to all users on AccrediPro CoachHub. It is not a limitation of what coaching can do — coaching is profoundly effective for many people — it is simply an accurate description of what it is.`,
  },
  {
    id: 'encryption',
    icon: Lock,
    title: '3. Session Content Is Encrypted at Rest',
    content: `We take the security of what you share seriously.

**How we protect session content:**
• All data stored in our database is encrypted at rest using AES-256 encryption
• All data transmitted between your browser and our servers is encrypted in transit using TLS 1.2+
• Session notes are stored in a private, access-controlled database — only you and your assigned coach can access them
• Audio recordings (if uploaded for AI-assisted notes) are stored in a private, encrypted storage bucket with a 7-day automatic deletion lifecycle

**Access controls:**
• Session notes are accessible ONLY to the coach who wrote them and the client they were written for
• AccrediPro CoachHub staff cannot access session content in the normal course of operations
• We do not share session content with third parties, advertisers, or analytics providers

**What encryption does NOT guarantee:**
• It does not make your data legally privileged (coaching relationships do not carry the same legal privilege as attorney-client or therapist-client relationships)
• It does not prevent a court order or legal subpoena from compelling disclosure
• No method of electronic storage is 100% immune to breach — we will notify you promptly if a breach occurs`,
  },
  {
    id: 'messaging',
    icon: MessageSquare,
    title: '4. Messaging Is Private and 1:1',
    content: `All messages exchanged on AccrediPro CoachHub are 1:1 between you and your coach (or your client). There are no group chats and no broadcast messages.

**Messaging privacy:**
• Messages are visible only to the sender and recipient
• AccrediPro CoachHub staff do not monitor or read message content in the ordinary course of business
• We may review messages in response to a reported safety concern, Terms of Service violation, or valid legal request
• Messages are stored encrypted and are not used to train AI models or sold to third parties

**System messages:**
• When you book or cancel a session, an automated system message is posted in your conversation thread (e.g., "Booking confirmed for March 12 at 2:00 PM"). These are informational only.

**Retention:**
• Messages are retained for 2 years after your last session, then deleted (unless subject to a legal hold)
• You may request earlier deletion of your message history by contacting support`,
  },
  {
    id: 'data-ownership',
    icon: Download,
    title: '5. You Can Export or Delete Your Data Anytime',
    content: `You own your data on AccrediPro CoachHub. We are a custodian, not an owner.

**Export your data:**
• Go to Settings > Data & Privacy > Export My Data to download a copy of all your personal information, session history, notes, and messages in JSON format
• Exports are generated within 24 hours and available for 7 days

**Delete your data:**
• Go to Settings > Data & Privacy > Delete My Account to permanently delete your account and all associated data
• Deletion is permanent and irreversible — we cannot recover data after deletion is confirmed
• Anonymized aggregate statistics may be retained for platform analytics even after deletion

**Portability:**
• Your exported data can be used with other platforms or shared with your healthcare team at your discretion
• We export in standard JSON format — ask support if you need a different format

**Legal exceptions:**
• We may retain certain data beyond your request if required by law, active litigation, or regulatory audit
• Payment records are retained for 7 years for tax and legal compliance, even after account deletion`,
  },
  {
    id: 'overview',
    icon: Eye,
    title: '6. Privacy Overview',
    content: `AccrediPro CoachHub ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.

**Key Points:**
• We collect information you provide directly and automatically through your use of the Service
• We use your information to provide, improve, and personalize our services
• We do not sell your personal information to third parties
• You have rights regarding your personal information, including access, correction, and deletion
• We implement security measures to protect your data

By using AccrediPro CoachHub, you consent to the data practices described in this policy. If you do not agree with these practices, please do not use our Service.`,
  },
  {
    id: 'collection',
    icon: Database,
    title: '7. Information We Collect',
    content: `**Information You Provide:**
• Account Information: Name, email address, profile photo
• Profile Information: Bio, qualifications, specialties (for coaches), preferences
• Payment Information: Payment card details, billing address (processed by Stripe — we never store full card numbers)
• Communications: Messages exchanged with coaches/clients, support inquiries
• Session Notes: Notes written by coaches after sessions

**Information Collected Automatically:**
• Device Information: Browser type, operating system, device identifiers
• Usage Data: Pages visited, features used, session duration, click patterns
• Location Data: General location based on IP address (country/city level only)
• Log Data: IP addresses, access times, referring URLs

**Information from Third Parties:**
• Authentication Providers: If you sign in via Clerk authentication
• Payment Processors: Transaction status and confirmation from Stripe
• Analytics Services: Aggregated, anonymized usage statistics`,
  },
  {
    id: 'use',
    icon: UserCheck,
    title: '8. How We Use Your Information',
    content: `We use the information we collect for the following purposes:

**Service Delivery:**
• Create and manage your account
• Facilitate coach-client connections and session bookings
• Process payments and send transaction confirmations
• Provide customer support

**Personalization:**
• Recommend coaches based on your preferences and history
• Customize your dashboard and notifications

**Communication:**
• Send service updates, security alerts, and administrative messages
• Notify you about sessions, messages, and platform activities
• Send wellness tips and coaching resources (with your consent — you can opt out anytime)

**Safety and Security:**
• Detect and prevent fraud, abuse, and safety incidents
• Enforce our Terms of Service
• Comply with legal obligations`,
  },
  {
    id: 'sharing',
    icon: Globe,
    title: '9. Information Sharing',
    content: `We may share your information in the following circumstances:

**With Your Coach/Client:**
• Coaches see client names, contact info, and session details for bookings
• Clients see coach profiles, qualifications, and availability
• Reviews and ratings are visible to other users if you post them

**With Service Providers:**
• Payment Processing: Stripe (PCI-DSS compliant)
• Authentication: Clerk (SOC 2 certified)
• Cloud Hosting: Vercel, Supabase (data stored in the US)
• Email: Resend (for transactional emails only)

**For Legal Reasons:**
• To comply with legal obligations or valid legal processes
• To protect our rights, privacy, safety, or property

**We Never:**
• Sell your personal information to advertisers or data brokers
• Share session content with third parties without your consent
• Use your health disclosures for advertising targeting`,
  },
  {
    id: 'cookies',
    icon: Cookie,
    title: '10. Cookies and Tracking',
    content: `**Types of Cookies We Use:**
• Essential Cookies: Required for authentication and security — these cannot be disabled
• Functional Cookies: Remember your preferences (theme, timezone)
• Analytics Cookies: Help us understand aggregate usage patterns (privacy-focused, no ad tracking)

**We do NOT use:**
• Third-party advertising cookies
• Cross-site tracking pixels
• Behavioral advertising profiles

**Your Choices:**
• You can manage non-essential cookie preferences in your account settings
• Blocking essential cookies will prevent login from working`,
  },
  {
    id: 'rights',
    icon: UserCheck,
    title: '11. Your Privacy Rights',
    content: `You have the following rights regarding your personal information:

Access: Request a copy of the personal information we hold about you (Settings > Export My Data)

Correction: Request correction of inaccurate information (Settings > Edit Profile)

Deletion: Request deletion of your personal information (Settings > Delete My Account)

Portability: Download your data in JSON format (Settings > Export My Data)

Objection: Object to certain processing of your information (contact support)

Withdraw Consent: Opt out of marketing emails (Settings > Notifications or the unsubscribe link in any email)

California Residents (CCPA):
You have additional rights including the right to know what information we collect and the right to opt out of the sale of personal information. Note: we do not sell personal information.

How to exercise your rights:
Email privacy@accredipro.com or use the Settings page. We respond within 30 days.`,
  },
  {
    id: 'contact',
    icon: Mail,
    title: '12. Contact Us',
    content: `If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

Privacy Inquiries:
Email: privacy@accredipro.com

General Support:
Email: support@accredipro.com
Visit: /contact page

Response Time:
We aim to respond to all privacy-related inquiries within 30 days.

Supervisory Authority:
If you are in the EU/UK and believe we have not adequately addressed your concerns, you have the right to lodge a complaint with your local data protection authority.`,
  },
];

const tableOfContents = sections.map((section) => ({
  id: section.id,
  title: section.title,
}));

export default function PrivacyPage() {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);

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
              <Shield className="mr-2 h-4 w-4" />
              Your Privacy Matters
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-white/70">Last updated: April 16, 2026</p>
            <p className="mx-auto mt-2 text-sm text-white/70">
              Learn how we collect, use, and protect your personal information.
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button variant="outline" asChild>
                <Link href="/terms">View Terms of Service</Link>
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
                  At AccrediPro CoachHub, we take your privacy seriously — especially because our
                  coaches often support clients through vulnerable health transitions. This Privacy
                  Policy describes how we collect, use, share, and protect your personal
                  information. We believe in transparency and want you to understand exactly how
                  your data is handled.
                </p>
              </div>

              {/* Quick Summary */}
              <div className="mb-8 rounded-lg border-2 border-burgundy/20 bg-burgundy/5 p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold">
                  <Shield className="h-5 w-5 text-burgundy" />
                  Privacy at a Glance
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-burgundy">•</span>
                    <span>
                      AccrediPro CoachHub is NOT a HIPAA-covered entity — coaches are not medical
                      providers
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-burgundy">•</span>
                    <span>Session content is encrypted at rest and in transit</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-burgundy">•</span>
                    <span>
                      Messaging is private 1:1 — no third-party access in normal operations
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-burgundy">•</span>
                    <span>You can export or delete your data anytime from Settings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-burgundy">•</span>
                    <span>We never sell your personal information</span>
                  </li>
                </ul>
              </div>

              {/* Sections */}
              <Accordion
                type="multiple"
                className="space-y-4"
                defaultValue={['not-hipaa', 'not-medical']}
              >
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
                            {paragraph}
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
                  Your privacy is important to us. If you have any questions about this Privacy
                  Policy, please don&apos;t hesitate to contact us.
                </p>
                <div className="mt-4 flex justify-center gap-4">
                  <Button variant="outline" asChild>
                    <Link href="/terms">Terms of Service</Link>
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
