'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect } from 'wagmi';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';
import {
  ArrowRight, ArrowUpRight, Sun, Moon, Heart, Check, Clock3,
  ListTodo, Megaphone, RotateCw, Wallet, Menu, X, Compass, ShieldCheck,
} from 'lucide-react';
import CreatorsLeaderboard from '@/components/CreatorsLeaderboard';
import GoodHubLogo from '@/components/GoodHubLogo';
import { getWalletConnectionErrorMessage } from '@/lib/walletErrors';

const FEATURES = [
  { icon: ListTodo, title: 'Complete tasks', desc: 'Find community tasks, submit your work, and earn G$ rewards after review.', href: '/tasks', action: 'Explore tasks' },
  { icon: Megaphone, title: 'Join campaigns', desc: 'Apply to funded campaigns and contribute to work that matters to your community.', href: '/campaigns', action: 'Browse campaigns' },
  { icon: RotateCw, title: 'Daily rewards', desc: 'Earn spins from approved tasks and eligible GoodDollar UBI claims.', href: '/spin', action: 'See daily rewards' },
  { icon: Heart, title: 'Support creators', desc: 'Discover creators and send G$ directly to the people whose work you value.', href: '/leaderboard', action: 'Discover creators' },
];

const STEPS = [
  { n: '01', title: 'Connect your wallet', desc: 'Use MetaMask on Celo to explore and take part in GOODHUB activities.' },
  { n: '02', title: 'Find your next step', desc: 'Complete a task, join a campaign, claim an eligible reward, or support a creator.' },
  { n: '03', title: 'Track your activity', desc: 'See your participation and G$ activity from your personal dashboard.' },
];

interface Opportunity {
  id: string;
  title: string;
  description: string;
  reward: string;
  kind: 'task' | 'campaign';
  creatorAddress: string;
  availability: number;
  deadline: null;
}

interface PublicActivity {
  tasksCompleted: number;
  rewardsDistributed: string;
  openCampaigns: number;
}

function formatReward(rawAmount: string) {
  return Number(formatUnits(BigInt(rawAmount), 18))
    .toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function subscribeToScroll(onStoreChange: () => void) {
  window.addEventListener('scroll', onStoreChange, { passive: true });
  return () => window.removeEventListener('scroll', onStoreChange);
}

async function loadOpportunities(): Promise<Opportunity[]> {
  const [tasksResponse, campaignsResponse] = await Promise.all([
    fetch('/api/tasks'),
    fetch('/api/campaigns'),
  ]);
  const [tasks, campaigns] = await Promise.all([tasksResponse.json(), campaignsResponse.json()]);
  if (!tasksResponse.ok || !campaignsResponse.ok) {
    throw new Error(tasks.error || campaigns.error || 'Live opportunities are temporarily unavailable.');
  }
  return [
    ...(tasks as Array<{ id: string; title: string; description: string; reward_per_completion: string; creator_address: string; slots: number }>)
      .map((task) => ({
        id: `task-${task.id}`,
        title: task.title,
        description: task.description,
        reward: task.reward_per_completion,
        kind: 'task' as const,
        creatorAddress: task.creator_address,
        availability: task.slots,
        deadline: null,
      })),
    ...(campaigns as Array<{ id: string; title: string; description: string; reward_per_participant: string; creator_address: string; available_participants: number }>)
      .map((campaign) => ({
        id: `campaign-${campaign.id}`,
        title: campaign.title,
        description: campaign.description,
        reward: campaign.reward_per_participant,
        kind: 'campaign' as const,
        creatorAddress: campaign.creator_address,
        availability: campaign.available_participants,
        deadline: null,
      })),
  ].slice(0, 4);
}

/* ─── Page ──────────────────────────────────────────────────── */

export default function LandingPage() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [opportunityFilter, setOpportunityFilter] = useState<'all' | 'task' | 'campaign'>('all');
  const scrolled = useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > 8,
    () => false,
  );
  const router = useRouter();
  const { isConnected } = useAccount();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const opportunitiesQuery = useQuery({
    queryKey: ['homepage-opportunities'],
    queryFn: loadOpportunities,
    staleTime: 60_000,
  });
  const activityQuery = useQuery<PublicActivity>({
    queryKey: ['public-platform-activity'],
    queryFn: async () => {
      const response = await fetch('/api/public/activity');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load platform activity.');
      return data;
    },
    staleTime: 60_000,
  });

  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');

  // Move to the dashboard after MetaMask connects.
  useEffect(() => {
    if (launching && isConnected) router.push('/dashboard');
  }, [launching, isConnected, router]);

  const launchApp = useCallback(async () => {
    if (isConnected) {
      router.push('/dashboard');
      return;
    }

    const metaMask = connectors[0];
    if (!metaMask) {
      setLaunchError('MetaMask is not available. Install the MetaMask browser extension and try again.');
      return;
    }

    setLaunchError('');
    setLaunching(true);
    try {
      await connectAsync({ connector: metaMask, chainId: 42220 });
    } catch (error) {
      setLaunching(false);
      setLaunchError(getWalletConnectionErrorMessage(error));
    }
  }, [isConnected, router, connectors, connectAsync]);

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div
        aria-hidden
        className="landing-grid pointer-events-none absolute inset-x-0 top-16 -z-10 h-[680px] opacity-70"
      />

      {/* ─── Navbar ─────────────────────────────────────────── */}
      <header className={`sticky top-0 z-50 border-b transition-colors duration-200 ${
        scrolled ? 'border-line bg-background/90 shadow-sm backdrop-blur-xl' : 'border-transparent bg-background/70 backdrop-blur-md'
      }`}>
        <nav className="mx-auto flex h-16 w-full max-w-[min(1680px,94vw)] items-center justify-between px-6 2xl:px-10 max-lg:max-w-6xl max-lg:px-5">
          <Link href="/" aria-label="GOODHUB home" className="flex items-center">
            <GoodHubLogo />
          </Link>

          <div className="flex items-center gap-1 max-md:hidden">
            {[
              ['Explore', '#opportunities'],
              ['What you can do', '#features'],
              ['How it works', '#how-it-works'],
              ['Creator spotlight', '#leaderboard'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title="Toggle theme"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card text-muted-foreground transition-colors hover:text-foreground"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            )}
            <button
              onClick={launchApp}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 max-md:hidden"
            >
              {isConnecting ? 'Connecting…' : 'Launch app'}
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-line bg-card max-md:flex"
            >
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        {menuOpen && (
          <div id="mobile-navigation" className="border-t border-line bg-background px-5 py-3 md:hidden">
            {[
              ['Explore', '#opportunities'],
              ['What you can do', '#features'],
              ['How it works', '#how-it-works'],
              ['Creator spotlight', '#leaderboard'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-2 py-2.5 text-sm font-medium text-muted-foreground"
              >
                {label}
              </a>
            ))}
            <button
              onClick={() => { setMenuOpen(false); launchApp(); }}
              className="mt-2 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-bold text-primary-foreground"
            >
              {isConnecting ? 'Connecting…' : 'Launch app'}
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </header>

      {launchError && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-xl items-start justify-between gap-4 rounded-xl border border-line bg-card p-4 text-sm shadow-lg"
        >
          <p>
            {launchError}
          </p>
          <button
            type="button"
            onClick={() => setLaunchError('')}
            aria-label="Dismiss setup message"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ─── Hero ───────────────────────────────────────────── */}
      <section className="mx-auto grid w-full max-w-[min(1440px,94vw)] grid-cols-[minmax(0,1fr)_minmax(390px,0.9fr)] items-center gap-16 px-6 py-20 2xl:gap-24 2xl:px-10 max-lg:grid-cols-1 max-lg:max-w-6xl max-lg:gap-12 max-lg:px-5 max-lg:py-14">
        <div className="motion-safe:animate-fade-up motion-reduce:animate-none 2xl:pr-10">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Community participation, powered by G$
          </p>
          <h1 className="mt-4 max-w-[13ch] font-display text-[clamp(3rem,5.4vw,5.6rem)] leading-[0.98] font-bold tracking-[-0.055em] max-md:text-5xl">
            Turn participation into <span className="relative inline-block whitespace-nowrap">
              <span className="relative z-10">opportunity.</span>
              <span className="absolute inset-x-0 bottom-1 z-0 h-3 rounded-sm bg-accent/80 max-md:h-2" />
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground max-md:text-base">
            Discover tasks, join campaigns, earn G$, and support the communities you care about. Everything you need to participate and grow, in one place.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 max-sm:flex-col max-sm:items-stretch">
            <button
              onClick={launchApp}
              className="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {isConnecting ? 'Connecting…' : 'Explore GOODHUB'}
              <ArrowRight size={16} />
            </button>
            <a
              href="#how-it-works"
              className="flex h-12 items-center justify-center rounded-lg border border-line bg-card/70 px-6 text-sm font-semibold transition-colors hover:border-foreground/30"
            >
              How it works
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {['Tasks', 'Campaigns', 'Daily rewards', 'Creator support'].map((label) => (
              <span key={label} className="rounded-md border border-line bg-card/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative motion-safe:animate-fade-in motion-reduce:animate-none">
          <div className="landing-grid absolute -inset-5 rounded-2xl opacity-60" aria-hidden="true" />
          <div className="glass-panel relative rounded-2xl border border-white/60 p-5 shadow-[0_16px_50px_rgba(16,38,74,0.08)] max-sm:p-3">
            <div className="rounded-xl border border-line/80 bg-card/90 p-5 backdrop-blur-xl max-sm:p-4">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">GOODHUB overview</p>
                  <p className="mt-1 font-display text-lg font-bold">Your community hub</p>
                </div>
                <span className="rounded-md bg-accent/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">Preview</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-line bg-background/80 p-3.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet size={14} /> Wallet balance</div>
                  <p className="mt-2 font-display text-xl font-bold">Connect wallet</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Live balance appears in your dashboard</p>
                </div>
                <div className="rounded-lg border border-line bg-background/80 p-3.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><RotateCw size={14} /> Daily rewards</div>
                  <p className="mt-2 font-display text-xl font-bold">Spin to earn</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Eligibility depends on your activity</p>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-line bg-background/80 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Opportunity discovery</p>
                    <p className="mt-1 text-sm font-bold">Find a way to contribute</p>
                  </div>
                  <Compass size={17} className="text-primary" />
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-md border border-success/20 bg-success-bg/50 px-3 py-2">
                  <Check size={14} className="text-success" />
                  <p className="text-xs font-medium">Complete work, submit proof, earn after review</p>
                </div>
                <Link href="#opportunities" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">
                  Browse live opportunities <ArrowRight size={13} />
                </Link>
              </div>
              <p className="mt-3 text-center text-[10px] text-muted-foreground">Illustrative interface preview · not account activity</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Verified platform activity" className="border-y border-line bg-card/60">
        <div className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-line px-5 py-7 max-sm:grid-cols-1 max-sm:divide-x-0 max-sm:divide-y">
          {[
            {
              label: 'Tasks completed',
              value: activityQuery.isPending ? '—' : activityQuery.isError ? 'Unavailable' : activityQuery.data.tasksCompleted.toLocaleString(),
            },
            {
              label: 'Rewards distributed',
              value: activityQuery.isPending ? '—' : activityQuery.isError ? 'Unavailable' : `${formatReward(activityQuery.data.rewardsDistributed)} G$`,
            },
            {
              label: 'Open campaigns',
              value: activityQuery.isPending ? '—' : activityQuery.isError ? 'Unavailable' : activityQuery.data.openCampaigns.toLocaleString(),
            },
          ].map((metric) => (
            <div key={metric.label} className="px-8 py-2 text-center max-sm:px-2 max-sm:py-4">
              <p className="font-display text-2xl font-bold tracking-tight">{metric.value}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">{metric.label}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Verified platform records</p>
            </div>
          ))}
        </div>
        {activityQuery.isError && (
          <div className="mx-auto max-w-6xl px-5 pb-5 text-center">
            <button type="button" onClick={() => void activityQuery.refetch()} className="text-xs font-semibold text-primary">
              Platform metrics unavailable · Retry
            </button>
          </div>
        )}
      </section>

      <section id="features" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-5 py-20 max-md:py-14">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">What you can do</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight max-md:text-2xl">A practical hub for community participation</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Find a meaningful way to contribute, earn rewards for approved work, and support the creators you care about.</p>
          </div>
          <div className="mt-8 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {FEATURES.map(({ icon: Icon, title, desc, href, action }, index) => (
              <article key={title} className={`group flex flex-col border border-line bg-card/80 p-5 transition-colors hover:border-foreground/25 hover:bg-card motion-safe:animate-fade-up motion-reduce:animate-none ${index === 0 ? 'rounded-l-xl max-sm:rounded-xl' : ''} ${index === 3 ? 'rounded-r-xl max-sm:rounded-xl' : ''}`}>
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/70 text-accent-foreground">
                  <Icon size={17} />
                </span>
                <h3 className="mt-4 font-display text-base font-bold">{title}</h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                <Link href={href} className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-primary">
                  {action} <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="opportunities" className="border-y border-line bg-card/40 scroll-mt-24">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Live marketplace</span>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">Real opportunities, ready to explore</h2>
            </div>
            <Link href={opportunityFilter === 'campaign' ? '/campaigns' : '/tasks'} className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              View all {opportunityFilter === 'campaign' ? 'campaigns' : opportunityFilter === 'task' ? 'tasks' : 'opportunities'} <ArrowRight size={15} />
            </Link>
          </div>
          <div className="mt-6 flex w-fit gap-1 rounded-lg border border-line bg-card p-1" role="group" aria-label="Filter opportunities">
            {([
              ['all', 'All'],
              ['task', 'Tasks'],
              ['campaign', 'Campaigns'],
            ] as const).map(([filter, label]) => (
              <button
                key={filter}
                type="button"
                onClick={() => setOpportunityFilter(filter)}
                aria-pressed={opportunityFilter === filter}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  opportunityFilter === filter ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {opportunitiesQuery.isPending ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[0, 1, 2, 3].map((item) => <div key={item} className="h-40 animate-pulse rounded-lg border border-line bg-card" />)}
            </div>
          ) : opportunitiesQuery.isError ? (
            <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-card p-5 text-sm text-muted-foreground">
              <span>{opportunitiesQuery.error instanceof Error ? opportunitiesQuery.error.message : 'Live opportunities are temporarily unavailable.'}</span>
              <button type="button" onClick={() => void opportunitiesQuery.refetch()} className="font-semibold text-primary">Retry</button>
            </div>
          ) : (
            <>
              {opportunitiesQuery.data.filter((opportunity) => opportunityFilter === 'all' || opportunity.kind === opportunityFilter).length === 0 ? (
                <div className="mt-6 rounded-lg border border-dashed border-line bg-card/70 p-8 text-center">
                  <p className="text-sm font-semibold">No open {opportunityFilter === 'all' ? 'opportunities' : `${opportunityFilter}s`} right now</p>
                  <p className="mt-1 text-xs text-muted-foreground">Check back soon—new listings appear here when organizers publish them.</p>
                </div>
              ) : (
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  {opportunitiesQuery.data
                    .filter((opportunity) => opportunityFilter === 'all' || opportunity.kind === opportunityFilter)
                    .slice(0, 4)
                    .map((opportunity) => {
                      const isTask = opportunity.kind === 'task';
                      return (
                  <article key={opportunity.id} className="rounded-lg border border-line bg-card p-5 transition-colors hover:border-foreground/25">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-md bg-accent/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
                        {isTask ? 'Task' : 'Campaign'}
                      </span>
                      <span className="font-mono text-sm font-bold">{formatReward(opportunity.reward)} G$</span>
                    </div>
                    <h3 className="mt-3 font-display text-lg font-bold">{opportunity.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{opportunity.description}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[11px] text-muted-foreground">
                      <span>Organizer <span className="font-mono text-foreground">{opportunity.creatorAddress.slice(0, 6)}…{opportunity.creatorAddress.slice(-4)}</span></span>
                      <span>{opportunity.availability} {isTask ? 'slots' : 'spots'} available</span>
                      <span className="inline-flex items-center gap-1"><Clock3 size={11} /> Deadline: {opportunity.deadline ?? 'No deadline set'}</span>
                      <span>Reward per {isTask ? 'completion' : 'participant'}</span>
                    </div>
                    <Link href={isTask ? '/tasks' : '/campaigns'} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      View details <ArrowRight size={14} />
                    </Link>
                  </article>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ─── How it works ───────────────────────────────────── */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24 max-md:py-16">
        <div className="text-center">
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            How it works
          </span>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight max-md:text-3xl">
            Three steps to get involved
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-5 max-md:grid-cols-1">
          {STEPS.map((step, i) => (
            <div key={step.n} className="group relative rounded-2xl border border-line bg-card p-7 transition-shadow hover:shadow-lg">
              <span className="font-mono text-xs font-bold text-muted-foreground/40">{step.n}</span>
              <h3 className="mt-3 font-display text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              {i < 2 && (
                <ArrowRight
                  size={18}
                  className="absolute top-1/2 -right-3 z-10 hidden -translate-y-1/2 text-muted-foreground/40 md:block"
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-card/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-[0.8fr_1.2fr] md:items-center max-md:py-16">
          <div>
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Built for everyone
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
              Communities grow when everyone can contribute.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              GOODHUB brings participants, organizers, and creators into one shared space—with clear requirements, transparent reviews, and direct community support.
            </p>
            <button
              onClick={launchApp}
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get started <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Participants', 'Find tasks, apply to campaigns, and track your approved rewards.'],
              ['Organizers', 'Fund community work, set expectations, and review contributions.'],
              ['Creators', 'Build a public page and receive direct G$ support.'],
            ].map(([title, description]) => (
              <div key={title} className="rounded-lg border border-line bg-card p-4">
                <h3 className="font-display text-sm font-bold">{title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CreatorsLeaderboard />

      {/* ─── Contract transparency ──────────────────────────── */}
      <section id="contract" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24 max-md:py-16">
        <div className="grid grid-cols-2 items-center gap-12 rounded-xl border border-line bg-card/80 p-8 backdrop-blur-md max-md:grid-cols-1 max-md:p-5">
          <div>
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              <ShieldCheck size={13} className="mr-1 inline" /> Trust and transparency
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
              Know what to expect.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Tasks and campaigns are funded in G$ escrow. Organizers review submissions, and approved task rewards or campaign payments are released through their on-chain escrow contracts. Activity figures above reflect recorded approvals and completed campaign payouts. Wallet verification is optional for general GOODHUB use; verified wallets are required only for spins based on UBI claims.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              GOODHUB is an independent community app using G$ on Celo. It is not an official GoodDollar product.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {[
              ['Creator Registry (Celo)', '0x9c69aa76f0D565eC514563E36bf9371ba7E74F05'],
              ['GoodDollar (G$)', '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A'],
            ].map(([label, addr]) => (
              <a
                key={addr}
                href={`https://celoscan.io/address/${addr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-background px-4 py-3.5 transition-colors hover:border-foreground/30"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold">{label}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{addr}</p>
                </div>
                <ArrowUpRight size={15} className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ──────────────────────────────────────── */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-24 text-center max-md:py-16">
          <h2 className="font-display text-5xl font-bold tracking-tight max-md:text-3xl">
            Find your place in the community.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-muted-foreground">
            Explore tasks, join campaigns, earn eligible rewards, or support a creator with G$.
          </p>
          <button
            onClick={launchApp}
            className="mt-8 inline-flex h-13 items-center gap-2 rounded-xl bg-primary px-8 text-base font-bold text-primary-foreground transition-all hover:opacity-90 hover:shadow-xl"
          >
            Explore GOODHUB
            <ArrowRight size={17} />
          </button>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-line bg-card/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-8 max-sm:flex-col max-sm:gap-4">
          <GoodHubLogo className="h-8 text-sm" />
          <p className="font-mono text-[11px] text-muted-foreground">
            Community rewards using G$ on Celo
          </p>
        </div>
      </footer>
    </div>
  );
}
