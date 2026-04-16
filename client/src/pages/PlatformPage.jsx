import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap, Search, Brain, Activity, Database, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppTopNav from '../components/layout/AppTopNav';

const FeatureCard = ({ icon: Icon, title, description, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    className="bg-gray-900 rounded-2xl p-6 shadow-sm hover:bg-gray-800/80 transition-colors group"
  >
    <div className="h-12 w-12 rounded-xl bg-gray-800 flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
      <Icon size={24} />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-gray-400 leading-relaxed text-sm">
      {description}
    </p>
  </motion.div>
);

export default function PlatformPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 selection:bg-blue-500/30 font-sans">
      <AppTopNav borderless />
      
      {/* Hero */}
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center px-3 py-1 mb-8 rounded-full bg-blue-950 text-blue-400 text-sm font-medium border border-blue-900/50">
            <Zap size={14} className="mr-2" />
            Curalink Clinical Engine 2.0
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-tight mb-6">
            The next generation of <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
              precision oncology.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Unifying PubMed, OpenAlex, and ClinicalTrials.gov with state-of-the-art LLM synthesis. Built for researchers, clinicians, and trial navigators.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/app" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center">
              Start Researching <ArrowRight size={18} className="ml-2" />
            </Link>
            <Link to="/status" className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
              System Status
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Grid of Features */}
      <section className="py-20 px-6 max-w-7xl mx-auto border-t border-gray-800/30">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard 
            icon={Brain}
            title="Semantic Synthesis"
            description="Our custom retrieval pipeline doesn't just keyword match—it understands intent, parsing clinical context to find relevant signals."
            delay={0.1}
          />
          <FeatureCard 
            icon={Database}
            title="Real-Time Federations"
            description="Live API connects to PubMed, OpenAlex, and ClinicalTrials.gov, dynamically extracting cohorts, inclusion criteria, and outcomes."
            delay={0.2}
          />
          <FeatureCard 
            icon={Search}
            title="Intelligent Reranking"
            description="Cross-encoder semantic ranking pushes the strongest evidence to the top based on evidence strength, recency, and geographic relevance."
            delay={0.3}
          />
          <FeatureCard 
            icon={Shield}
            title="Evidence Grounding"
            description="No hallucinations. Every insight points back to a verifiable citation token [P1], [T2], linking you directly to the source."
            delay={0.4}
          />
          <FeatureCard 
            icon={Activity}
            title="Clinical Trial Matching"
            description="Our advanced geographic algorithms parse unstructured location data to connect patients with nearby recruiting phase II/III trials."
            delay={0.5}
          />
          <FeatureCard 
            icon={Zap}
            title="Sub-second Processing"
            description="Optimized vector lookups and streaming LLM responses ensure you get actionable clinical insights the moment you need them."
            delay={0.6}
          />
        </div>
      </section>
      
      {/* Footer CTA */}
      <section className="py-24 px-6 text-center max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-white mb-6">Ready to accelerate discovery?</h2>
        <Link to="/app" className="inline-flex items-center text-blue-400 hover:text-blue-300 font-medium text-lg transition-colors">
          Open the Research Interface <ArrowRight size={20} className="ml-2" />
        </Link>
      </section>
    </div>
  );
}
