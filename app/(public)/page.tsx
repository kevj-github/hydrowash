import Link from 'next/link'
import Image from 'next/image'
import { Wrench, Zap, Package, ArrowRight, Cpu, ShieldCheck, FileText, CircleCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Section, SectionInner } from '@/components/ui/section'
import { SectionHeading } from '@/components/ui/section-heading'
import { ServiceCard } from '@/components/ui/service-card'
import { StepItem } from '@/components/ui/step-item'
import { Reveal } from '@/components/ui/reveal'

const PHOTO_SERVICE_MAINTENANCE = 'https://images.pexels.com/photos/32588555/pexels-photo-32588555.jpeg?auto=compress&cs=tinysrgb&w=800'
const PHOTO_SERVICE_FAULT = 'https://images.pexels.com/photos/6471912/pexels-photo-6471912.jpeg?auto=compress&cs=tinysrgb&w=800'
const PHOTO_SERVICE_INSTALL = 'https://images.pexels.com/photos/7347538/pexels-photo-7347538.jpeg?auto=compress&cs=tinysrgb&w=800'
const PHOTO_WHY_US = 'https://images.pexels.com/photos/5463576/pexels-photo-5463576.jpeg?auto=compress&cs=tinysrgb&w=1200'
const PHOTO_CTA = 'https://images.pexels.com/photos/7587368/pexels-photo-7587368.jpeg?auto=compress&cs=tinysrgb&w=1920'

const services = [
  {
    code: 'M–01',
    icon: Wrench,
    title: 'General Maintenance',
    description: 'Regular servicing, chemical wash, and overhaul to keep your AC running at peak efficiency year-round.',
    photoSrc: PHOTO_SERVICE_MAINTENANCE,
    photoAlt: 'Aircon maintenance and cleaning',
  },
  {
    code: 'F–02',
    icon: Zap,
    title: 'Fault Repair',
    description: 'Fast diagnosis and repair for all aircon faults — from water leaks to no cooling. We come to you.',
    photoSrc: PHOTO_SERVICE_FAULT,
    photoAlt: 'Aircon fault repair technician',
  },
  {
    code: 'I–03',
    icon: Package,
    title: 'Installation',
    description: 'Professional installation of new AC units with proper setup, testing, and post-install support.',
    photoSrc: PHOTO_SERVICE_INSTALL,
    photoAlt: 'New aircon unit installation',
  },
]

const steps = [
  { level: 'Watch', label: 'Choose your service', description: 'Maintenance, repair, or install — tell us the condition.' },
  { level: 'Warning', label: 'Pick a date & slot', description: 'Up to 5 dates, 3 time windows each. We fit your week.' },
  { level: 'Confirmed', label: 'We arrive & resolve', description: 'Technician confirmed. Your booking is locked in.' },
]

const whyFeatures = [
  { icon: Zap,         label: 'Same-day availability',       desc: 'Book in the morning, we arrive the same day.' },
  { icon: Cpu,         label: 'All makes & models',           desc: 'Mitsubishi, Daikin, Panasonic, Samsung, and more.' },
  { icon: ShieldCheck, label: 'Transparent pricing',          desc: 'Fixed rates, no hidden fees, ever.' },
  { icon: FileText,    label: '1-year maintenance contracts', desc: 'Quarterly servicing, fully managed — you never have to remember to rebook.' },
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const bookHref = user ? '/book' : '/auth/login?redirect=/book'

  return (
    <>
      {/* Hero — the advisory board itself */}
      <section className="relative overflow-hidden hw-board-ground text-primary-foreground">
        <div id="hero-sentinel" className="absolute top-0 left-0 w-px h-px" aria-hidden />

        <SectionInner className="relative pt-20 pb-16 sm:pt-28 sm:pb-24">
          <div className="hw-power-on flex items-center gap-2 font-data text-xs sm:text-sm uppercase tracking-[0.2em] text-accent mb-8">
            <span className="relative flex h-1.5 w-1.5">
              <span className="hw-signal-dot absolute inline-flex h-full w-full rounded-full bg-accent motion-reduce:animate-none" />
            </span>
            Today&rsquo;s condition, Singapore
          </div>

          <div className="hw-power-on grid lg:grid-cols-[1fr_auto] gap-8 lg:gap-16 items-end mb-10">
            <div>
              <p className="font-data text-sm text-primary-foreground/50 uppercase tracking-[0.15em] mb-1">Feels like</p>
              <p className="font-data font-bold text-[5.5rem] leading-[0.85] sm:text-[9rem] lg:text-[11rem] text-primary-foreground tabular-nums">
                41<span className="text-accent">°</span>
              </p>
            </div>
            <p className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl leading-[0.95] uppercase tracking-tight max-w-xl pb-2 sm:pb-4">
              Your aircon&rsquo;s job just got harder.
              <span className="text-accent"> Ours starts now.</span>
            </p>
          </div>

          <div className="hw-power-on flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 border-t border-white/10 pt-8">
            <div className="flex items-center gap-2.5">
              <CircleCheck size={18} className="text-accent" strokeWidth={2} />
              <span className="font-data text-xs uppercase tracking-[0.12em] text-primary-foreground/70">
                Confirmed slots · under 3 minutes
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={bookHref}
                className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-sm px-7 py-3.5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
              >
                Book a Service
                <ArrowRight size={16} />
              </Link>
              {!user && (
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-primary-foreground font-semibold text-sm px-7 py-3.5 transition-all duration-200 cursor-pointer"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </SectionInner>
      </section>

      {/* Advisory bulletin — factual, not decorative stat cards */}
      <section className="bg-primary text-primary-foreground border-t border-white/10">
        <SectionInner className="py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-data text-[11px] sm:text-xs uppercase tracking-[0.12em] text-primary-foreground/60">
            <span>5+ years in service</span>
            <span className="text-accent">·</span>
            <span>All AC makes &amp; models</span>
            <span className="text-accent">·</span>
            <span>Island-wide coverage</span>
          </div>
        </SectionInner>
      </section>

      {/* Services — advisory board rows */}
      <Section className="bg-background py-20 sm:py-28">
        <SectionInner>
          <Reveal>
            <SectionHeading
              title="Every condition, handled"
              subtitle="From routine maintenance to emergency repairs, we handle all makes and models across Singapore."
              align="left"
            />
          </Reveal>
          <div className="border-b border-border">
            {services.map((s, i) => (
              <Reveal key={s.title} delayMs={i * 90}>
                <ServiceCard
                  code={s.code}
                  icon={s.icon}
                  title={s.title}
                  description={s.description}
                  photoSrc={s.photoSrc}
                  photoAlt={s.photoAlt}
                />
              </Reveal>
            ))}
          </div>
        </SectionInner>
      </Section>

      {/* Why Choose Us */}
      <Section className="bg-muted py-20 sm:py-28">
        <SectionInner>
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <Reveal className="relative h-72 lg:h-[460px] order-2 lg:order-1">
              <Image
                src={PHOTO_WHY_US}
                alt="Professional HydroWash technician"
                fill
                className="object-cover grayscale-[15%]"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-primary/10" />
              <div className="absolute bottom-0 left-0 bg-accent text-accent-foreground font-data text-xs font-bold uppercase tracking-[0.12em] px-4 py-2">
                Since 2019
              </div>
            </Reveal>
            <div className="order-1 lg:order-2">
              <Reveal>
                <SectionHeading
                  title="Your AC in expert hands"
                  subtitle="We've been keeping Singapore cool since 2019."
                  align="left"
                />
              </Reveal>
              <ul className="space-y-6 mt-8">
                {whyFeatures.map((f, i) => (
                  <Reveal key={f.label} as="li" delayMs={i * 80} className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-accent/10 text-accent flex items-center justify-center shrink-0">
                      <f.icon size={18} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="font-heading font-bold text-lg uppercase tracking-tight text-primary">{f.label}</p>
                      <p className="text-sm text-muted-foreground mt-0.5 font-body">{f.desc}</p>
                    </div>
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
        </SectionInner>
      </Section>

      {/* How it works — escalation levels */}
      <Section className="bg-background py-20 sm:py-28">
        <SectionInner>
          <Reveal>
            <SectionHeading
              title="How it resolves"
              subtitle="Three levels, and we handle the rest."
              align="left"
            />
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-10 sm:gap-6">
            {steps.map((step, i) => (
              <Reveal key={step.label} delayMs={i * 100} className="relative">
                <StepItem number={i + 1} level={step.level} label={step.label} description={step.description} />
                {i < steps.length - 1 && (
                  <ArrowRight
                    size={20}
                    strokeWidth={1.5}
                    className="hidden sm:block absolute -right-3 top-1 text-border"
                    aria-hidden
                  />
                )}
              </Reveal>
            ))}
          </div>
        </SectionInner>
      </Section>

      {/* CTA — resolved, cool, confirmed */}
      <Section className="relative py-24 sm:py-28 overflow-hidden hw-board-ground">
        <div className="absolute inset-0 opacity-25">
          <Image src={PHOTO_CTA} alt="" fill className="object-cover" aria-hidden />
        </div>
        <div className="absolute inset-0 bg-primary/70" />
        <SectionInner className="relative text-center">
          <Reveal>
            <p className="font-data text-xs uppercase tracking-[0.2em] text-accent mb-4">All clear, when you are</p>
            <SectionHeading
              title="Relief, confirmed."
              subtitle="Create an account in seconds and schedule your first service today."
              light
            />
            <Link
              href={bookHref}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-sm px-8 py-3.5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
            >
              Get Started
              <ArrowRight size={16} />
            </Link>
          </Reveal>
        </SectionInner>
      </Section>
    </>
  )
}
