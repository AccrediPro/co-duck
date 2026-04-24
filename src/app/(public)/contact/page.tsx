'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Mail, MapPin, Clock, Send, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const contactInfo = [
  {
    icon: Mail,
    title: 'Email',
    details: 'support@accredipro.com',
    description: 'Send us an email anytime',
  },
  {
    icon: MapPin,
    title: 'Location',
    details: 'San Francisco, CA',
    description: 'United States',
  },
  {
    icon: Clock,
    title: 'Response Time',
    details: 'Within 24 hours',
    description: 'Monday - Friday',
  },
];

const faqs = [
  {
    question: 'How do I find the right coach for me?',
    answer:
      'Browse our coaches page where you can filter by specialty, price range, and availability. Each coach has a detailed profile with their background, approach, and reviews from other clients.',
  },
  {
    question: "What if I'm not satisfied with my session?",
    answer:
      'We offer a satisfaction guarantee. If you are not happy with your first session with a coach, contact us within 48 hours and we will help you find a better match or provide a refund.',
  },
  {
    question: 'How do I become a coach on the platform?',
    answer:
      'Coach accounts are set up by our team. If you are interested in coaching on AccrediPro CoachHub, please contact us and we will get you started.',
  },
  {
    question: 'Are the sessions confidential?',
    answer:
      'Yes, absolutely. All communication between you and your coach is private and encrypted. We take your privacy seriously and maintain strict confidentiality standards.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit cards and process payments securely through Stripe. Coaches can set their prices in various currencies.',
  },
  {
    question: 'Can I reschedule or cancel a session?',
    answer:
      "Yes, you can reschedule or cancel sessions through your dashboard. Please check your coach's cancellation policy as some may require advance notice.",
  },
];

const MAX_MESSAGE_LENGTH = 1000;

export default function ContactPage() {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formState.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formState.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formState.subject) {
      newErrors.subject = 'Please select a subject';
    }

    if (!formState.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formState.message.length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  const handleInputChange = (field: keyof typeof formState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  if (isSubmitted) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--brand-accent-light))]">
            <CheckCircle className="h-10 w-10 text-[hsl(var(--brand-warm))]" />
          </div>
          <h1 className="text-3xl font-bold">Message Sent!</h1>
          <p className="mt-4 text-muted-foreground">
            Thank you for reaching out. We will get back to you within 24 hours.
          </p>
          <Button className="mt-8 h-11" asChild>
            <Link href="/">Return Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-burgundy-dark to-burgundy">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Get in Touch
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
              Have a question or need assistance? We are here to help. Fill out the form below and
              we will get back to you as soon as possible.
            </p>
          </div>
        </div>
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      </section>

      {/* Contact Info Cards */}
      <section className="border-y border-burgundy/10 bg-cream py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 sm:grid-cols-3">
            {contactInfo.map((info) => (
              <Card key={info.title} className="border-0 bg-white shadow-sm">
                <CardContent className="flex items-start gap-4 p-6">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-burgundy/10">
                    <info.icon className="h-6 w-6 text-burgundy" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{info.title}</h3>
                    <p className="text-sm font-medium text-burgundy">{info.details}</p>
                    <p className="text-sm text-muted-foreground">{info.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form & FAQ */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* Contact Form */}
            <div>
              <h2 className="text-2xl font-bold text-burgundy-dark">Send Us a Message</h2>
              <p className="mt-2 text-muted-foreground">
                Fill out the form and we will respond within 24 hours.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={formState.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formState.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Select
                    value={formState.subject}
                    onValueChange={(value) => handleInputChange('subject', value)}
                  >
                    <SelectTrigger
                      className={cn('min-h-[44px]', errors.subject ? 'border-red-500' : '')}
                    >
                      <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Inquiry</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                      <SelectItem value="coaching">Coaching Questions</SelectItem>
                      <SelectItem value="partnership">Partnership</SelectItem>
                      <SelectItem value="feedback">Feedback</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.subject && <p className="text-sm text-red-500">{errors.subject}</p>}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="message">Message</Label>
                    <span className="text-sm text-muted-foreground">
                      {formState.message.length}/{MAX_MESSAGE_LENGTH}
                    </span>
                  </div>
                  <Textarea
                    id="message"
                    placeholder="How can we help you?"
                    rows={5}
                    maxLength={MAX_MESSAGE_LENGTH}
                    value={formState.message}
                    onChange={(e) => handleInputChange('message', e.target.value)}
                    className={errors.message ? 'border-red-500' : ''}
                  />
                  {errors.message && <p className="text-sm text-red-500">{errors.message}</p>}
                </div>

                <Button type="submit" size="lg" className="h-11 w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    'Sending...'
                  ) : (
                    <>
                      Send Message
                      <Send className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* FAQ Section */}
            <div>
              <h2 className="text-2xl font-bold text-burgundy-dark">Frequently Asked Questions</h2>
              <p className="mt-2 text-muted-foreground">Find quick answers to common questions.</p>

              <Accordion type="single" collapsible className="mt-8">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`faq-${index}`}>
                    <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              <Card className="mt-8 bg-cream">
                <CardHeader>
                  <CardTitle className="text-lg">Still have questions?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Can&apos;t find the answer you&apos;re looking for? Send us a message and
                    we&apos;ll be happy to help.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
