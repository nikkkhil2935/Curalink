import { useNavigate } from 'react-router-dom';
import { BrainCircuit, FlaskConical, Radar, ShieldCheck, Sparkles, Workflow } from 'lucide-react';
import { motion } from 'framer-motion';
import AppTopNav from '@/components/layout/AppTopNav.jsx';
import Card from '@/components/ui/Card.jsx';
import Button from '@/components/ui/Button.jsx';

const PLATFORM_FEATURES = [
  {
    title: 'Evidence-Linked Chat',
    text: 'Every answer can be linked back to the exact publication and trial cards used to generate it.',
    Icon: ShieldCheck
  },
  {
    title: 'Hybrid Retrieval',
    text: 'Parallel collection from PubMed, OpenAlex, and ClinicalTrials with relevance, recency, and context balancing.',
    Icon: Radar
  },
  {
    title: 'Clinical Trial Focus',
    text: 'Trial candidates are retained through reranking and surfaced with status, location relevance, and contact details.',
    Icon: FlaskConical
  },
  {
    title: 'Structured Insights',
    text: 'Condition overview, insights, trial opportunities, and follow-up prompts are returned in consistent schema.',
    Icon: BrainCircuit
  }
];

const PIPELINE_STEPS = [
  'Intent classification and query expansion',
  'Cross-source retrieval and deduplication',
  'Hybrid reranking and context curation',
  'LLM synthesis with citation alignment',
  'Message-scoped evidence rendering'
];

export default function PlatformPage() {
  const navigate = useNavigate();

  return (
    <div className="app-shell min-h-screen px-6 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <AppTopNav />

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="surface-panel rounded-3xl p-8"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-700 bg-cyan-950/30 px-3 py-1 text-xs font-semibold text-cyan-300">
            <Sparkles size={14} />
            Platform Overview
          </div>

          <h1 className="max-w-4xl text-4xl font-black leading-tight sm:text-5xl">
            A multi-page medical evidence workspace built for grounded research decisions.
          </h1>
          <p className="mt-4 max-w-3xl text-base text-slate-300 sm:text-lg">
            Curalink combines retrieval rigor, structured synthesis, and transparent evidence navigation so users can move
            from question to source-backed action quickly.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => navigate('/')}>
              Open Research Workspace
            </Button>
            <Button size="lg" variant="secondary" onClick={() => navigate('/status')}>
              Check Live Status
            </Button>
          </div>
        </motion.section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {PLATFORM_FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 * index, ease: 'easeOut' }}
            >
              <Card tone="soft" className="h-full rounded-2xl p-5">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-700 bg-blue-950/40 text-blue-300">
                  <feature.Icon size={18} />
                </div>
                <h2 className="text-lg font-semibold text-slate-100">{feature.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{feature.text}</p>
              </Card>
            </motion.div>
          ))}
        </section>

        <section className="surface-soft rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-2 text-cyan-300">
            <Workflow size={18} />
            <h2 className="text-lg font-semibold">Pipeline Flow</h2>
          </div>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {PIPELINE_STEPS.map((step, index) => (
              <li key={step} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-300">
                <span className="mb-1 inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-500">
                  Step {index + 1}
                </span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
