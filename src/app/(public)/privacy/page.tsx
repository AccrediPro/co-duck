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
} from 'lucide-react';

const sections = [
  {
    id: 'overview',
    icon: Eye,
    title: '1. Privacy Overview',
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
    title: '2. Information We Collect',
    content: `**Information You Provide:**
• **Account Information**: Name, email address, password, profile photo
• **Profile Information**: Bio, qualifications, specialties (for coaches), preferences
• **Payment Information**: Payment card details, billing address (processed by Stripe)
• **Communications**: Messages exchanged with coaches/clients, support inquiries

**Information Collected Automatically:**
• **Device Information**: Browser type, operating system, device identifiers
• **Usage Data**: Pages visited, features used, session duration, click patterns
• **Location Data**: General location based on IP address
• **Log Data**: IP addresses, access times, referring URLs

**Information from Third Parties:**
• **Authentication Providers**: If you sign in with Google or other providers
• **Payment Processors**: Transaction status and confirmation from Stripe
• **Analytics Services**: Aggregated usage statistics`,
  },
  {
    id: 'use',
    icon: UserCheck,
    title: '3. How We Use Your Information',
    content: `We use the information we collect for the following purposes:

**Service Delivery:**
• Create and manage your account
• Facilitate coach-client connections and session bookings
• Process payments and send transaction confirmations
• Provide customer support

**Personalization:**
• Recommend coaches based on your preferences and history
• Customize your dashboard and notifications
• Remember your settings and preferences

**Communication:**
• Send service updates, security alerts, and administrative messages
• Notify you about sessions, messages, and platform activities
• Send promotional content (with your consent, and you can opt out)

**Improvement:**
• Analyze usage patterns to improve our platform
• Develop new features and services
• Conduct research and analytics

**Safety and Security:**
• Detect and prevent fraud, abuse, and security incidents
• Enforce our Terms of Service
• Comply with legal obligations`,
  },
  {
    id: 'sharing',
    icon: Globe,
    title: '4. Information Sharing',
    content: `We may share your information in the following circumstances:

**With Other Users:**
• Coaches see client names, contact info, and session details for bookings
• Clients see coach profiles, qualifications, and availability
• Reviews and ratings are visible to other users

**With Service Providers:**
• **Payment Processing**: Stripe (for secure payment handling)
• **Authentication**: Clerk (for account management)
• **Cloud Hosting**: Vercel, AWS (for data storage)
• **Analytics**: Privacy-focused analytics providers
• **Email**: For transactional and marketing communications

**For Legal Reasons:**
• To comply with legal obligations or valid legal processes
• To protect our rights, privacy, safety, or property
• To enforce our Terms of Service
• In connection with a merger, acquisition, or sale of assets

**With Your Consent:**
• We may share information in other ways if you give us explicit consent

**We Never:**
• Sell your personal information to advertisers or data brokers
• Share sensitive information without your explicit consent`,
  },
  {
    id: 'cookies',
    icon: Cookie,
    title: '5. Cookies and Tracking',
    content: `**What Are Cookies?**
Cookies are small text files stored on your device when you visit websites. They help us recognize you and remember your preferences.

**Types of Cookies We Use:**

• **Essential Cookies**: Required for the platform to function (authentication, security)
• **Functional Cookies**: Remember your preferences (language, theme)
• **Analytics Cookies**: Help us understand how you use our platform
• **Marketing Cookies**: Used to show relevant content (only with consent)

**Your Cookie Choices:**
• You can manage cookie preferences in your browser settings
• Most browsers allow you to block or delete cookies
• Blocking essential cookies may affect platform functionality

**Other Tracking Technologies:**
• **Local Storage**: For storing preferences and session data
• **Pixel Tags**: To understand email engagement (open rates, clicks)

**Do Not Track:**
We currently do not respond to "Do Not Track" browser signals, but we respect your privacy choices through our cookie settings.`,
  },
  {
    id: 'security',
    icon: Lock,
    title: '6. Data Security',
    content: `We implement appropriate technical and organizational measures to protect your personal information:

**Technical Safeguards:**
• Encryption of data in transit (TLS/SSL) and at rest
• Secure authentication with multi-factor authentication options
• Regular security assessments and penetration testing
• Automated monitoring for suspicious activities

**Organizational Measures:**
• Limited access to personal data on a need-to-know basis
• Employee training on data protection and security
• Vendor due diligence for third-party services
• Incident response procedures

**Your Role:**
• Use strong, unique passwords for your account
• Enable two-factor authentication when available
• Do not share your login credentials
• Report suspicious activities to us immediately

**Data Breach Response:**
In the event of a data breach affecting your personal information, we will notify you and relevant authorities as required by applicable law.

**Note**: While we strive to protect your information, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security.`,
  },
  {
    id: 'retention',
    icon: Database,
    title: '7. Data Retention',
    content: `We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy:

**Active Accounts:**
• Account data: Retained while your account is active
• Session history: Retained for 3 years for service improvement
• Payment records: Retained for 7 years for tax and legal compliance
• Communications: Retained for 2 years or as required for disputes

**After Account Deletion:**
• Personal data: Deleted within 30 days of account deletion
• Backup data: May persist for up to 90 days in encrypted backups
• Anonymized data: May be retained indefinitely for analytics

**Legal Holds:**
We may retain data longer if required by law, legal proceedings, or regulatory requirements.

**Coach Content:**
Coaches may retain their own copies of session notes and materials, subject to their own privacy practices.`,
  },
  {
    id: 'rights',
    icon: UserCheck,
    title: '8. Your Privacy Rights',
    content: `Depending on your location, you may have the following rights regarding your personal information:

**Access**: Request a copy of the personal information we hold about you

**Correction**: Request correction of inaccurate or incomplete information

**Deletion**: Request deletion of your personal information (subject to legal exceptions)

**Portability**: Request a copy of your data in a portable format

**Objection**: Object to certain processing of your information

**Restriction**: Request temporary restriction of processing

**Withdraw Consent**: Withdraw consent where processing is based on consent

**How to Exercise Your Rights:**
• Access your data through your account settings
• Email us at privacy@accredipro-coachhub.com with your request
• We will respond within 30 days (or as required by local law)

**Identity Verification:**
We may need to verify your identity before processing requests to protect your privacy.

**California Residents:**
Under the CCPA, you have additional rights including the right to know what information we collect and the right to opt out of the sale of personal information (note: we do not sell personal information).`,
  },
  {
    id: 'international',
    icon: Globe,
    title: '9. International Data Transfers',
    content: `AccrediPro CoachHub is based in the United States. If you access our Service from outside the US, your information may be transferred to, stored, and processed in the US or other countries.

**Data Transfer Mechanisms:**
• Standard Contractual Clauses approved by relevant authorities
• Privacy Shield certification where applicable
• Consent for data transfer where required

**For EU/UK Users:**
We comply with GDPR requirements for data transfers, including:
• Ensuring adequate protection for transferred data
• Implementing appropriate safeguards
• Providing you with enforceable rights

**For Other Regions:**
We comply with applicable local data protection laws and implement appropriate safeguards for cross-border transfers.

If you have concerns about international data transfers, please contact us at privacy@accredipro-coachhub.com.`,
  },
  {
    id: 'children',
    icon: Shield,
    title: "10. Children's Privacy",
    content: `Our Service is not intended for children under 18 years of age.

**Our Policy:**
• We do not knowingly collect personal information from children under 18
• If we learn we have collected information from a child, we will delete it promptly
• Parents or guardians who believe their child has provided us with personal information should contact us

**Coaching Sessions:**
• Coaching sessions on our platform are designed for adults
• If coaching services for minors are offered, parental/guardian consent is required
• Coaches working with minors must comply with additional safeguards

**Contact Us:**
If you believe a child under 18 has provided personal information to us, please contact us immediately at privacy@accredipro-coachhub.com.`,
  },
  {
    id: 'changes',
    icon: Eye,
    title: '11. Changes to This Policy',
    content: `We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons.

**How We Notify You:**
• Post the updated policy on this page with a new "Last Updated" date
• Send email notifications for significant changes
• Display in-app notifications when you next use the Service

**Your Continued Use:**
Your continued use of our Service after any changes to this Privacy Policy constitutes your acceptance of the updated policy.

**Review Regularly:**
We encourage you to review this policy periodically to stay informed about how we protect your information.

**Previous Versions:**
You may request previous versions of this Privacy Policy by contacting us.`,
  },
  {
    id: 'contact',
    icon: Mail,
    title: '12. Contact Us',
    content: `If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

**Privacy Inquiries:**
Email: privacy@accredipro-coachhub.com

**Data Protection Officer:**
Email: dpo@accredipro-coachhub.com

**Mailing Address:**
AccrediPro CoachHub Privacy Team
123 Innovation Drive
San Francisco, CA 94105
United States

**General Support:**
Email: support@accredipro-coachhub.com
Visit: /contact page

**Response Time:**
We aim to respond to all privacy-related inquiries within 30 days.

**Supervisory Authority:**
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
              <Shield className="mr-2 h-4 w-4" />
              Your Privacy Matters
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-white/70">Last updated: January 31, 2026</p>
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
                  At AccrediPro CoachHub, we take your privacy seriously. This Privacy Policy
                  describes how we collect, use, share, and protect your personal information when
                  you use our platform. We believe in transparency and want you to understand
                  exactly how your data is handled.
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
                    <span>We collect only what we need to provide our services</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-burgundy">•</span>
                    <span>We never sell your personal information</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-burgundy">•</span>
                    <span>You can access, update, or delete your data anytime</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-burgundy">•</span>
                    <span>We use encryption and security best practices</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-burgundy">•</span>
                    <span>You control your communication preferences</span>
                  </li>
                </ul>
              </div>

              {/* Sections */}
              <Accordion type="multiple" className="space-y-4" defaultValue={['overview']}>
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
