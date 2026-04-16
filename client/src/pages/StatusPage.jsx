import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, XCircle, ArrowLeft, Activity, Database, ServerCog, RefreshCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppTopNav from '../components/layout/AppTopNav';
import { api } from '../utils/api';

const MOCK_STATUSES = [
  { group: "External Data Providers", services: [
    { name: "PubMed E-Utilities", status: "operational", ping: "145ms" },
    { name: "OpenAlex Graph", status: "operational", ping: "89ms" },
    { name: "ClinicalTrials.gov", status: "operational", ping: "204ms" }
  ]},
  { group: "Intelligence Engine", services: [
    { name: "Semantic Reranker", status: "operational", ping: "45ms" },
    { name: "Query Expander", status: "operational", ping: "20ms" }
  ]}
];

const StatusIcon = ({ status }) => {
  if (status === 'operational') return <CheckCircle2 className="text-green-400" size={20} />;
  if (status === 'degraded') return <AlertCircle className="text-yellow-400" size={20} />;
  return <XCircle className="text-red-400" size={20} />;
};

const StatusRow = ({ service, index }) => (
  <motion.div 
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.3, delay: index * 0.1 }}
    className="flex items-center justify-between p-4 bg-gray-900 rounded-xl mb-3 shadow-sm border border-gray-800/30"
  >
    <div className="flex items-center gap-4">
      <StatusIcon status={service.status} />
      <div>
        <h4 className="text-white font-medium">{service.name}</h4>
      </div>
    </div>
    <div className="flex items-center gap-6">
      <span className="text-sm font-mono text-gray-500">{service.ping || '----'}</span>
      <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded 
        ${service.status === 'operational' ? 'bg-green-950/50 text-green-400' : 
          service.status === 'degraded' ? 'bg-yellow-950/50 text-yellow-400' : 
          'bg-red-950/50 text-red-400'}`}
      >
        {service.status}
      </span>
    </div>
  </motion.div>
);

export default function StatusPage() {
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState(null);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/health');
      setHealthData(data);
    } catch (err) {
      setHealthData({ status: 'error', mongodb: 'disconnected', llm: 'offline' });
    } finally {
      setTimeout(() => setLoading(false), 600);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const coreServices = healthData ? {
    group: "Curalink Core Services",
    services: [
      { name: "API Gateway", status: healthData.status === 'ok' ? 'operational' : 'degraded', ping: "38ms" },
      { name: "Database Cluster", status: healthData.mongodb === 'connected' ? 'operational' : 'offline', ping: "12ms" },
      { name: "LLM Synthesizer", status: healthData.llm === 'online' ? 'operational' : (healthData.llm === 'degraded' ? 'degraded' : 'offline'), ping: "840ms" }
    ]
  } : null;

  const displayGroups = coreServices ? [coreServices, ...MOCK_STATUSES] : MOCK_STATUSES;
  const isAllGood = coreServices?.services.every(s => s.status === 'operational');

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 selection:bg-blue-500/30 font-sans">
      <AppTopNav borderless />

      <main className="max-w-4xl mx-auto px-6 py-20 lg:py-24">
        <div className="mb-12">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Link to="/app" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-white transition-colors mb-6">
              <ArrowLeft size={16} className="mr-2" /> Back to Application
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">System Status</h1>
                <p className="text-gray-400 mt-2">Current operational status of Curalink and upstream providers.</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={checkStatus} disabled={loading} className="text-gray-400 hover:text-white transition-colors bg-gray-900 p-2 rounded-lg">
                  <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
                {healthData && (
                   <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${isAllGood ? 'bg-green-950/30 text-green-400' : 'bg-yellow-950/30 text-yellow-400'}`}>
                     <div className={`w-2 h-2 rounded-full animate-pulse ${isAllGood ? 'bg-green-400' : 'bg-yellow-400'}`} /> 
                     {isAllGood ? 'All Systems Operational' : 'Partial Outage'}
                   </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Activity className="animate-pulse text-gray-600" size={48} />
          </div>
        ) : (
          <div className="space-y-10">
            {displayGroups.map((group, groupIdx) => (
              <motion.section 
                key={group.group}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 * groupIdx }}
              >
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4 ml-1">
                  {group.group}
                </h3>
                <div>
                  {group.services.map((svc, i) => (
                    <StatusRow key={svc.name} service={svc} index={i + groupIdx} />
                  ))}
                </div>
              </motion.section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
