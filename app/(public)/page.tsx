import Link from 'next/link'
import { Wind, Wrench, Zap, Package, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Section, SectionInner } from '@/components/ui/section'
import { SectionHeading } from '@/components/ui/section-heading'
import { ServiceCard } from '@/components/ui/service-card'
import { StepItem } from '@/components/ui/step-item'

const services = [
  {
    icon: Wrench,
    title: 'General Maintenance',
    description: 'Regular servicing, chemical wash, and overhaul to keep your AC running at peak efficiency year-round.',
  },
  {
    icon: Zap,
    title: 'Fault Repair',
    description: 'Fast diagnosis and repair for all aircon faults — from water leaks to no cooling. We come to you.',
  },
  {
    icon: Package,
    title: 'Installation',
    description: 'Professional installation of new AC units with proper setup, testing, and post-install support.',
  },
]

const steps = [
  { label: 'Choose your service', description: 'Select the type of job' },
  { label: 'Pick a date & slot', description: 'Choose a time that suits you' },
  { label: 'We confirm & arrive', description: 'Your booking is locked in' },
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const bookHref = user ? '/book' : '/auth/register'

  return (
    <>
      {/* Hero — dark navy */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#0C2340] to-[#0F172A] text-white">
        {/* Dot grid texture */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle, #93C5FD 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden
        />
        {/* Sentinel for scroll-aware navbar */}
        <div id="hero-sentinel" className="absolute top-0 left-0 w-px h-px" aria-hidden />

        <SectionInner className="relative py-24 sm:py-32 text-center">
          {/* Label */}
          <div className="animate-fade-up inline-flex items-center gap-2 bg-white/10 text-sky-300 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
            <Wind size={12} />
            Trusted for 5 years across Singapore
          </div>

          {/* Heading */}
          <h1 className="animate-fade-up-delay-1 font-heading font-bold text-4xl sm:text-6xl lg:text-7xl leading-tight mb-6">
            Hydrowash home
            <br />
            <span className="text-sky-400">aircon solution.</span>
          </h1>

          {/* Subheading */}
          <p className="animate-fade-up-delay-2 text-slate-300 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed mb-10">
            5 years of expert aircon servicing — maintenance,
            fault repair, and installation across Singapore.
          </p>

          {/* CTA */}
          <div className="animate-fade-up-delay-3 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={bookHref}
              className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold px-8 py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/30 cursor-pointer"
            >
              Book a Service
              <ArrowRight size={16} />
            </Link>
            {!user && (
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3.5 rounded-xl transition-all duration-200 cursor-pointer"
              >
                Sign In
              </Link>
            )}
          </div>
        </SectionInner>
      </section>

      {/* Stat strip */}
      <section className="bg-white border-b border-border">
        <SectionInner className="py-8">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="font-heading font-bold text-3xl text-primary">5+</p>
              <p className="text-sm text-muted-foreground mt-1">Years in service</p>
            </div>
            <div>
              <p className="font-heading font-bold text-3xl text-primary">All</p>
              <p className="text-sm text-muted-foreground mt-1">AC makes &amp; models</p>
            </div>
            <div>
              <p className="font-heading font-bold text-3xl text-primary">SG</p>
              <p className="text-sm text-muted-foreground mt-1">Island-wide coverage</p>
            </div>
          </div>
        </SectionInner>
      </section>

      {/* Services — white */}
      <Section className="bg-white py-20">
        <SectionInner>
          <SectionHeading
            label="Our Services"
            title="Everything your AC needs"
            subtitle="From routine maintenance to emergency repairs, we handle all makes and models across Singapore."
          />
          <div className="grid sm:grid-cols-3 gap-6">
            {services.map(s => (
              <ServiceCard key={s.title} icon={s.icon} title={s.title} description={s.description} />
            ))}
          </div>
        </SectionInner>
      </Section>

      {/* How it works — muted bg */}
      <Section className="bg-muted py-20">
        <SectionInner>
          <SectionHeading
            label="Process"
            title="How it works"
            subtitle="Three steps and we handle the rest."
          />
          <div className="flex flex-col sm:flex-row items-center justify-center gap-0 max-w-2xl mx-auto">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <StepItem
                  number={i + 1}
                  label={step.label}
                  description={step.description}
                />
                {i < steps.length - 1 && (
                  <div className="hidden sm:block w-16 h-px bg-border mx-2 flex-shrink-0 mb-6" />
                )}
              </div>
            ))}
          </div>
        </SectionInner>
      </Section>

      {/* CTA — dark navy */}
      <Section className="bg-[#0F172A] py-20">
        <SectionInner className="text-center">
          <SectionHeading
            label="Get started"
            title="Ready to book?"
            subtitle="Create an account in seconds and schedule your first service today."
            light
          />
          <Link
            href={bookHref}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold px-8 py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/30 cursor-pointer"
          >
            Get Started
            <ArrowRight size={16} />
          </Link>
        </SectionInner>
      </Section>
    </>
  )
}
