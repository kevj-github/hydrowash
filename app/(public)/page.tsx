import Link from 'next/link'
import Image from 'next/image'
import { Wind, Wrench, Zap, Package, ArrowRight, CalendarCheck, Cpu, MapPin, ShieldCheck, FileText, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Section, SectionInner } from '@/components/ui/section'
import { SectionHeading } from '@/components/ui/section-heading'
import { ServiceCard } from '@/components/ui/service-card'
import { StepItem } from '@/components/ui/step-item'

// Replace these with your chosen Unsplash URLs (see plan Photo Reference table)
const PHOTO_HERO = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1920&q=80'
const PHOTO_SERVICE_MAINTENANCE = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80'
const PHOTO_SERVICE_FAULT = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=800&q=80'
const PHOTO_SERVICE_INSTALL = 'https://images.unsplash.com/photo-1613545325278-f24b0cae1224?auto=format&fit=crop&w=800&q=80'
const PHOTO_WHY_US = 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1200&q=80'
const PHOTO_CTA = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1920&q=80'

const services = [
  {
    icon: Wrench,
    title: 'General Maintenance',
    description: 'Regular servicing, chemical wash, and overhaul to keep your AC running at peak efficiency year-round.',
    photoSrc: PHOTO_SERVICE_MAINTENANCE,
    photoAlt: 'Aircon maintenance and cleaning',
  },
  {
    icon: Zap,
    title: 'Fault Repair',
    description: 'Fast diagnosis and repair for all aircon faults — from water leaks to no cooling. We come to you.',
    photoSrc: PHOTO_SERVICE_FAULT,
    photoAlt: 'Aircon fault repair technician',
  },
  {
    icon: Package,
    title: 'Installation',
    description: 'Professional installation of new AC units with proper setup, testing, and post-install support.',
    photoSrc: PHOTO_SERVICE_INSTALL,
    photoAlt: 'New aircon unit installation',
  },
]

const steps = [
  { label: 'Choose your service', description: 'Select the type of job' },
  { label: 'Pick a date & slot', description: 'Choose a time that suits you' },
  { label: 'We confirm & arrive', description: 'Your booking is locked in' },
]

const whyFeatures = [
  { icon: Zap,         label: 'Same-day availability',      desc: 'Book in the morning, we arrive the same day.' },
  { icon: Cpu,         label: 'All makes & models',          desc: 'Mitsubishi, Daikin, Panasonic, Samsung, and more.' },
  { icon: ShieldCheck, label: 'Transparent pricing',         desc: 'Fixed rates, no hidden fees, ever.' },
  { icon: FileText,    label: '1-year maintenance contracts', desc: 'Quarterly servicing, fully managed for you.' },
]

const testimonials = [
  {
    name: 'Jason T.',
    location: 'Jurong West',
    quote: 'Booked at 9am, technician arrived by noon. Chemical wash done perfectly. Highly recommend!',
  },
  {
    name: 'Priya S.',
    location: 'Bishan',
    quote: 'Finally an aircon company with transparent pricing. No surprise charges at all.',
  },
  {
    name: 'Wei Liang C.',
    location: 'Tampines',
    quote: 'Signed up for the annual contract. Best decision — no more chasing for servicing dates.',
  },
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const bookHref = user ? '/book' : '/auth/login?redirect=/book'

  return (
    <>
      {/* Hero — photo background */}
      <section className="relative overflow-hidden bg-primary text-white">
        {/* Background photo */}
        <div className="absolute inset-0">
          <Image
            src={PHOTO_HERO}
            alt="HydroWash aircon technician at work"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-primary/75" />
        </div>
        {/* Dot grid texture */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle, #93C5FD 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden
        />
        <div id="hero-sentinel" className="absolute top-0 left-0 w-px h-px" aria-hidden />

        <SectionInner className="relative py-24 sm:py-32 text-center">
          <div className="animate-fade-up inline-flex items-center gap-2 bg-white/10 text-sky-300 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
            <Wind size={12} />
            Trusted for 5 years across Singapore
          </div>
          <h1 className="animate-fade-up-delay-1 font-heading font-bold text-4xl sm:text-6xl lg:text-7xl leading-tight mb-6">
            Hydrowash home
            <br />
            <span className="text-sky-400">aircon solution.</span>
          </h1>
          <p className="animate-fade-up-delay-2 text-slate-300 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed mb-10">
            5 years of expert aircon servicing — maintenance,
            fault repair, and installation across Singapore.
          </p>
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
            <div className="flex flex-col items-center gap-1">
              <CalendarCheck size={22} className="text-accent mb-1" strokeWidth={1.75} />
              <p className="font-heading font-bold text-3xl text-primary">5+</p>
              <p className="text-sm text-muted-foreground">Years in service</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Cpu size={22} className="text-accent mb-1" strokeWidth={1.75} />
              <p className="font-heading font-bold text-3xl text-primary">All</p>
              <p className="text-sm text-muted-foreground">AC makes &amp; models</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <MapPin size={22} className="text-accent mb-1" strokeWidth={1.75} />
              <p className="font-heading font-bold text-3xl text-primary">SG</p>
              <p className="text-sm text-muted-foreground">Island-wide coverage</p>
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
              <ServiceCard
                key={s.title}
                icon={s.icon}
                title={s.title}
                description={s.description}
                photoSrc={s.photoSrc}
                photoAlt={s.photoAlt}
              />
            ))}
          </div>
        </SectionInner>
      </Section>

      {/* Why Choose Us */}
      <Section className="bg-white py-20">
        <SectionInner>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Photo */}
            <div className="relative h-80 lg:h-[440px] rounded-2xl overflow-hidden">
              <Image
                src={PHOTO_WHY_US}
                alt="Professional HydroWash technician"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-primary/10 rounded-2xl" />
            </div>
            {/* Features */}
            <div>
              <SectionHeading
                label="Why choose us"
                title="Your AC in expert hands"
                subtitle="We've been keeping Singapore cool since 2019."
                align="left"
              />
              <ul className="space-y-5 mt-6">
                {whyFeatures.map(f => (
                  <li key={f.label} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
                      <f.icon size={18} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="font-heading font-semibold text-primary text-base">{f.label}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SectionInner>
      </Section>

      {/* Testimonials */}
      <Section className="bg-muted py-20">
        <SectionInner>
          <SectionHeading
            label="Reviews"
            title="What our customers say"
            subtitle="Real feedback from homeowners across Singapore."
          />
          <div className="grid sm:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.name} className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-foreground leading-relaxed mb-5 italic">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-accent/10 text-accent font-semibold text-sm flex items-center justify-center shrink-0">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.location}, Singapore</p>
                  </div>
                </div>
              </div>
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
                <div className="flex flex-col items-center text-center px-4">
                  <div className="w-14 h-14 rounded-full bg-accent text-white font-heading font-bold text-xl flex items-center justify-center mb-3 shadow-md shadow-accent/20">
                    {i + 1}
                  </div>
                  <p className="font-heading font-semibold text-primary text-base">{step.label}</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-[140px]">{step.description}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden sm:block w-16 h-0.5 bg-accent/30 flex-shrink-0 mb-10" />
                )}
              </div>
            ))}
          </div>
        </SectionInner>
      </Section>

      {/* CTA — photo background */}
      <Section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0">
          <Image src={PHOTO_CTA} alt="" fill className="object-cover" aria-hidden />
          <div className="absolute inset-0 bg-primary/80" />
        </div>
        <SectionInner className="relative text-center">
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
