# Curalink — Day 1 Implementation Plan
## Foundation: Project Setup + MERN Skeleton + MongoDB + Basic UI Shell

---

## 🎯 Day 1 Goals
By end of Day 1 you should have:
- [ ] Full MERN project structure (monorepo)
- [ ] MongoDB connected with all schemas
- [ ] Express API running with all routes (stubbed)
- [ ] React app with 3-panel layout shell (no real data yet)
- [ ] Patient context form working
- [ ] Basic chat UI sending/receiving messages (echo for now)
- [ ] Tailwind + shadcn/ui configured
- [ ] Environment variables + deployment config ready

**Time estimate: 8-10 hours**

---

## STEP 1: Project Structure Setup (30 min)

```
curalink/
├── client/               ← React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   ├── evidence/
│   │   │   ├── sidebar/
│   │   │   └── ui/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── store/        ← Zustand state
│   │   ├── utils/
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
├── server/               ← Node/Express backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── sessions.js
│   │   │   ├── query.js
│   │   │   ├── export.js
│   │   │   └── analytics.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Session.js
│   │   │   ├── Message.js
│   │   │   ├── SourceDoc.js
│   │   │   └── Analytics.js
│   │   ├── services/
│   │   │   ├── pipeline/
│   │   │   │   ├── intentClassifier.js
│   │   │   │   ├── queryExpander.js
│   │   │   │   ├── retriever.js
│   │   │   │   ├── normalizer.js
│   │   │   │   ├── reranker.js
│   │   │   │   ├── contextPackager.js
│   │   │   │   └── orchestrator.js
│   │   │   ├── apis/
│   │   │   │   ├── pubmed.js
│   │   │   │   ├── openalex.js
│   │   │   │   └── clinicaltrials.js
│   │   │   └── llm.js
│   │   ├── middleware/
│   │   │   ├── errorHandler.js
│   │   │   └── requestLogger.js
│   │   └── app.js
│   ├── .env
│   └── package.json
│
├── llm-service/          ← Python FastAPI LLM
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
│
└── README.md
```

### Init commands:
```bash
# Root
mkdir curalink && cd curalink
git init

# Client
npm create vite@latest client -- --template react
cd client
npm install
npm install tailwindcss @tailwindcss/vite
npm install zustand axios react-router-dom
npm install recharts
npm install lucide-react
npm install @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-badge
npx shadcn@latest init

# Server
cd ../server
npm init -y
npm install express mongoose dotenv cors axios xml2js
npm install express-rate-limit helmet morgan
npm install uuid
npm install nodemon --save-dev

# LLM Service
cd ../llm-service
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install fastapi uvicorn httpx sentence-transformers torch
```

---

## STEP 2: MongoDB Schemas (1.5 hours)

### server/src/models/Session.js
```javascript
import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  disease: { type: String, required: true, trim: true },
  intent: { type: String, trim: true, default: '' },
  location: {
    city: { type: String, default: '' },
    country: { type: String, default: '' }
  },
  demographics: {
    age: { type: Number, default: null },
    sex: { type: String, enum: ['Male', 'Female', 'Other', null], default: null }
  },
  title: { type: String, default: '' },
  queryHistory: [String],
  cachedSourceIds: [String],
  messageCount: { type: Number, default: 0 }
}, { timestamps: true });

sessionSchema.pre('save', function(next) {
  if (!this.title) {
    this.title = `${this.disease}${this.intent ? ' - ' + this.intent : ''}`;
  }
  next();
});

export default mongoose.model('Session', sessionSchema);
```

### server/src/models/Message.js
```javascript
import mongoose from 'mongoose';

const insightSchema = new mongoose.Schema({
  insight: String,
  type: { type: String, enum: ['TREATMENT', 'DIAGNOSIS', 'RISK', 'PREVENTION', 'GENERAL'] },
  source_ids: [String]
}, { _id: false });

const trialSummarySchema = new mongoose.Schema({
  summary: String,
  status: String,
  location_relevant: Boolean,
  source_ids: [String]
}, { _id: false });

const structuredAnswerSchema = new mongoose.Schema({
  condition_overview: String,
  evidence_strength: { type: String, enum: ['LIMITED', 'MODERATE', 'STRONG'] },
  research_insights: [insightSchema],
  clinical_trials: [trialSummarySchema],
  key_researchers: [String],
  recommendations: String,
  follow_up_suggestions: [String]
}, { _id: false });

const messageSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  text: { type: String, required: true },
  structuredAnswer: { type: structuredAnswerSchema, default: null },
  usedSourceIds: [String],
  retrievalStats: {
    totalCandidates: Number,
    pubmedFetched: Number,
    openalexFetched: Number,
    ctFetched: Number,
    rerankedTo: Number,
    timeTakenMs: Number
  },
  intentType: String,
  contextBadge: String     // e.g. "Using context: Parkinson's Disease"
}, { timestamps: true });

export default mongoose.model('Message', messageSchema);
```

### server/src/models/SourceDoc.js
```javascript
import mongoose from 'mongoose';

const sourceDocSchema = new mongoose.Schema({
  _id: { type: String },  // "pubmed:41732954"
  type: { type: String, enum: ['publication', 'trial'], required: true },
  source: { type: String, enum: ['PubMed', 'OpenAlex', 'ClinicalTrials'], required: true },
  title: { type: String, required: true },
  abstract: { type: String, default: '' },
  authors: [String],
  year: Number,
  url: String,
  // Trial-specific
  status: String,
  phase: String,
  eligibility: String,
  locations: [String],
  contacts: [{
    name: String,
    email: String,
    phone: String
  }],
  // Analytics
  queryAssociations: [String],
  timesUsed: { type: Number, default: 0 },
  // Computed scores (stored for debug/reuse)
  lastRelevanceScore: Number
}, { timestamps: true });

export default mongoose.model('SourceDoc', sourceDocSchema);
```

### server/src/models/Analytics.js
```javascript
import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
  event: { type: String, enum: ['query', 'export', 'trial_click', 'source_click', 'session_start'] },
  disease: String,
  intentType: String,
  sessionId: mongoose.Schema.Types.ObjectId,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

export default mongoose.model('Analytics', analyticsSchema);
```

---

## STEP 3: Express Server Setup (1 hour)

### server/src/app.js
```javascript
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import sessionRoutes from './routes/sessions.js';
import queryRoutes from './routes/query.js';
import analyticsRoutes from './routes/analytics.js';
import exportRoutes from './routes/export.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
app.use('/api/', limiter);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/export', exportRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  const llmStatus = await fetch(`${process.env.LLM_SERVICE_URL}/health`)
    .then(r => r.ok ? 'online' : 'offline')
    .catch(() => 'offline');
  
  res.json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    llm: llmStatus,
    timestamp: new Date().toISOString()
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

export default app;
```

### server/src/routes/sessions.js
```javascript
import express from 'express';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import Analytics from '../models/Analytics.js';

const router = express.Router();

// Create new session
router.post('/', async (req, res, next) => {
  try {
    const { disease, intent, location, demographics } = req.body;
    
    if (!disease) return res.status(400).json({ error: 'Disease is required' });
    
    const session = await Session.create({
      disease: disease.trim(),
      intent: intent?.trim() || '',
      location: location || {},
      demographics: demographics || {}
    });
    
    // Track analytics
    await Analytics.create({
      event: 'session_start',
      disease: disease.toLowerCase(),
      sessionId: session._id
    });
    
    res.status(201).json({ session });
  } catch (err) { next(err); }
});

// Get session with messages
router.get('/:id', async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    const messages = await Message.find({ sessionId: req.params.id }).sort({ createdAt: 1 });
    res.json({ session, messages });
  } catch (err) { next(err); }
});

// List recent sessions
router.get('/', async (req, res, next) => {
  try {
    const sessions = await Session.find()
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('disease intent location title messageCount createdAt');
    res.json({ sessions });
  } catch (err) { next(err); }
});

// Delete session
router.delete('/:id', async (req, res, next) => {
  try {
    await Session.findByIdAndDelete(req.params.id);
    await Message.deleteMany({ sessionId: req.params.id });
    res.json({ message: 'Session deleted' });
  } catch (err) { next(err); }
});

export default router;
```

### server/.env
```
MONGODB_URI=mongodb+srv://your_connection_string
LLM_SERVICE_URL=http://127.0.0.1:8001
FRONTEND_URL=http://localhost:5173
PORT=5000
PUBMED_EMAIL=your@email.com
```

---

## STEP 4: React App Structure + Tailwind Setup (1.5 hours)

### client/vite.config.js
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
});
```

### client/src/App.jsx
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import ResearchInterface from '@/pages/ResearchInterface';
import AnalyticsDashboard from '@/pages/AnalyticsDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/research/:sessionId" element={<ResearchInterface />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### client/src/store/useAppStore.js (Zustand)
```javascript
import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  // Session state
  currentSession: null,
  messages: [],
  isLoading: false,
  
  // Evidence panel state
  sources: [],
  activeTab: 'publications',   // 'publications' | 'trials' | 'researchers' | 'timeline'
  
  // UI state
  showContextForm: false,
  
  setSession: (session) => set({ currentSession: session }),
  addMessage: (msg) => set(state => ({ messages: [...state.messages, msg] })),
  setMessages: (messages) => set({ messages }),
  setSources: (sources) => set({ sources }),
  setLoading: (val) => set({ isLoading: val }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setShowContextForm: (val) => set({ showContextForm: val }),
  
  reset: () => set({
    currentSession: null,
    messages: [],
    sources: [],
    isLoading: false
  })
}));
```

### client/src/pages/ResearchInterface.jsx (SHELL — no real data yet)
```jsx
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ChatPanel from '@/components/chat/ChatPanel';
import EvidencePanel from '@/components/evidence/EvidencePanel';
import Sidebar from '@/components/sidebar/Sidebar';
import { useAppStore } from '@/store/useAppStore';
import axios from 'axios';

export default function ResearchInterface() {
  const { sessionId } = useParams();
  const { setSession, setMessages, setLoading } = useAppStore();
  
  useEffect(() => {
    if (sessionId) {
      setLoading(true);
      axios.get(`/api/sessions/${sessionId}`)
        .then(({ data }) => {
          setSession(data.session);
          setMessages(data.messages);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [sessionId]);
  
  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 overflow-hidden">
        <ChatPanel className="w-[45%]" />
        <EvidencePanel className="w-[55%]" />
      </div>
    </div>
  );
}
```

---

## STEP 5: Landing Page + Context Form (2 hours)

### client/src/pages/LandingPage.jsx
```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ContextForm from '@/components/ContextForm';
import axios from 'axios';

export default function LandingPage() {
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();
  
  const handleStartResearch = async (formData) => {
    try {
      const { data } = await axios.post('/api/sessions', formData);
      navigate(`/research/${data.session._id}`);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8">
      {/* Hero */}
      <div className="text-center max-w-3xl mb-12">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-2xl">🔬</div>
          <h1 className="text-4xl font-bold text-white">Curalink</h1>
        </div>
        <p className="text-xl text-gray-400 mb-3">
          AI-powered medical research intelligence
        </p>
        <p className="text-gray-500 text-sm max-w-lg mx-auto">
          500+ research candidates retrieved and ranked in real-time from PubMed, OpenAlex & ClinicalTrials.gov — 
          synthesized by a local AI model with zero hallucination.
        </p>
        
        <div className="flex gap-4 justify-center mt-8">
          <button
            onClick={() => setShowForm(true)}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-white transition-all"
          >
            Start Research →
          </button>
          <button
            onClick={() => navigate('/analytics')}
            className="px-8 py-3 border border-gray-700 hover:border-gray-500 rounded-xl text-gray-400 hover:text-white transition-all"
          >
            Analytics Dashboard
          </button>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-12">
        {[
          { label: 'Research Sources', value: '3 APIs' },
          { label: 'Candidates Retrieved', value: '300-500' },
          { label: 'LLM Model', value: 'Llama 3.1 8B' }
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 rounded-xl p-5 text-center border border-gray-800">
            <p className="text-2xl font-bold text-blue-400">{stat.value}</p>
            <p className="text-gray-500 text-sm mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
      
      {showForm && (
        <ContextForm
          onSubmit={handleStartResearch}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
```

### client/src/components/ContextForm.jsx
```jsx
import { useState } from 'react';

const DISEASE_SUGGESTIONS = [
  "Parkinson's Disease", "Lung Cancer", "Diabetes Type 2",
  "Alzheimer's Disease", "Heart Disease", "Breast Cancer",
  "Multiple Sclerosis", "Rheumatoid Arthritis"
];

export default function ContextForm({ onSubmit, onClose }) {
  const [form, setForm] = useState({
    disease: '', intent: '', city: '', country: '',
    age: '', sex: ''
  });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.disease.trim()) return;
    onSubmit({
      disease: form.disease,
      intent: form.intent,
      location: { city: form.city, country: form.country },
      demographics: {
        age: form.age ? parseInt(form.age) : null,
        sex: form.sex || null
      }
    });
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-lg border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-6">Start Your Research</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">
              Disease / Condition <span className="text-red-400">*</span>
            </label>
            <input
              value={form.disease}
              onChange={e => setForm(p => ({...p, disease: e.target.value}))}
              placeholder="e.g. Parkinson's Disease, Lung Cancer..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              required
            />
            {/* Quick suggestions */}
            <div className="flex flex-wrap gap-2 mt-2">
              {DISEASE_SUGGESTIONS.slice(0,4).map(d => (
                <button
                  key={d} type="button"
                  onClick={() => setForm(p => ({...p, disease: d}))}
                  className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 border border-gray-700"
                >{d}</button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-sm text-gray-400 mb-1 block">What do you want to know?</label>
            <input
              value={form.intent}
              onChange={e => setForm(p => ({...p, intent: e.target.value}))}
              placeholder="e.g. Deep Brain Stimulation, latest treatments..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">City</label>
              <input
                value={form.city}
                onChange={e => setForm(p => ({...p, city: e.target.value}))}
                placeholder="Toronto"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Country</label>
              <input
                value={form.country}
                onChange={e => setForm(p => ({...p, country: e.target.value}))}
                placeholder="Canada"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Age (optional)</label>
              <input
                type="number" value={form.age}
                onChange={e => setForm(p => ({...p, age: e.target.value}))}
                placeholder="45"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Sex (optional)</label>
              <select
                value={form.sex}
                onChange={e => setForm(p => ({...p, sex: e.target.value}))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Prefer not to say</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-all"
            >Cancel</button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-white transition-all"
            >Begin Research →</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## STEP 6: Basic Chat Panel Shell (1 hour)

### client/src/components/chat/ChatPanel.jsx
```jsx
import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import axios from 'axios';

export default function ChatPanel({ className }) {
  const { sessionId } = useParams();
  const { messages, addMessage, setLoading, isLoading, currentSession } = useAppStore();
  const bottomRef = useRef(null);
  
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const sendMessage = async (text) => {
    // Add user message immediately
    addMessage({ role: 'user', text, createdAt: new Date() });
    setLoading(true);
    
    try {
      const { data } = await axios.post(`/api/sessions/${sessionId}/query`, { message: text });
      addMessage(data.message);
      // Update sources in evidence panel
      useAppStore.getState().setSources(data.sources || []);
    } catch (err) {
      addMessage({
        role: 'assistant',
        text: 'Sorry, something went wrong. Please try again.',
        createdAt: new Date()
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className={`flex flex-col border-r border-gray-800 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="font-semibold text-white">
          {currentSession?.disease || 'Research Assistant'}
        </h2>
        {currentSession?.location?.country && (
          <p className="text-xs text-gray-500">📍 {currentSession.location.city}, {currentSession.location.country}</p>
        )}
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-600 mt-8">
            <p className="text-4xl mb-3">🔬</p>
            <p className="text-sm">Ask anything about {currentSession?.disease || 'your condition'}.</p>
            <p className="text-xs text-gray-700 mt-1">Research is retrieved in real-time from PubMed, OpenAlex & ClinicalTrials.gov</p>
          </div>
        )}
        {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
        {isLoading && (
          <div className="flex gap-2 items-center text-gray-500 text-sm">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
            </div>
            Searching 300+ research sources...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
```

### client/src/components/chat/ChatInput.jsx
```jsx
import { useState, useRef } from 'react';
import { Mic, Send } from 'lucide-react';

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  
  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window)) return;
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onresult = (e) => setText(e.results[0][0].transcript);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };
  
  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };
  
  return (
    <div className="p-4 border-t border-gray-800">
      <div className="flex gap-2 items-end">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          placeholder="Ask about treatments, trials, researchers..."
          rows={2}
          disabled={disabled}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 text-sm"
        />
        <div className="flex flex-col gap-2">
          <button
            onClick={startVoice}
            className={`p-2.5 rounded-xl border transition-all ${isListening ? 'bg-red-500 border-red-500 text-white' : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'}`}
          >
            <Mic size={16} />
          </button>
          <button
            onClick={handleSend}
            disabled={!text.trim() || disabled}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## STEP 7: Evidence Panel + Sidebar Shell (1 hour)

### client/src/components/evidence/EvidencePanel.jsx
```jsx
import { useAppStore } from '@/store/useAppStore';
import PublicationsTab from './PublicationsTab';
import TrialsTab from './TrialsTab';
import ResearchersTab from './ResearchersTab';
import TimelineTab from './TimelineTab';

const TABS = [
  { id: 'publications', label: '📄 Publications' },
  { id: 'trials', label: '🧪 Trials' },
  { id: 'researchers', label: '👤 Researchers' },
  { id: 'timeline', label: '📈 Timeline' }
];

export default function EvidencePanel({ className }) {
  const { activeTab, setActiveTab, sources } = useAppStore();
  const publications = sources.filter(s => s.type === 'publication');
  const trials = sources.filter(s => s.type === 'trial');
  
  return (
    <div className={`flex flex-col ${className}`}>
      {/* Tab Header */}
      <div className="flex border-b border-gray-800 px-2 pt-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg mr-1 transition-all ${
              activeTab === tab.id
                ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.id === 'publications' && publications.length > 0 && (
              <span className="ml-1 text-xs bg-blue-600 rounded-full px-1.5 py-0.5">{publications.length}</span>
            )}
            {tab.id === 'trials' && trials.length > 0 && (
              <span className="ml-1 text-xs bg-green-600 rounded-full px-1.5 py-0.5">{trials.length}</span>
            )}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {sources.length === 0 ? (
          <div className="text-center text-gray-600 mt-12">
            <p className="text-3xl mb-2">📚</p>
            <p className="text-sm">Research sources will appear here after your first query</p>
          </div>
        ) : (
          <>
            {activeTab === 'publications' && <PublicationsTab sources={publications} />}
            {activeTab === 'trials' && <TrialsTab sources={trials} />}
            {activeTab === 'researchers' && <ResearchersTab sources={sources} />}
            {activeTab === 'timeline' && <TimelineTab sources={sources} />}
          </>
        )}
      </div>
    </div>
  );
}
```

---

## STEP 8: Error Handler + Middleware (30 min)

### server/src/middleware/errorHandler.js
```javascript
export function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
```

### server/src/routes/query.js (STUB for Day 1)
```javascript
import express from 'express';
import Session from '../models/Session.js';
import Message from '../models/Message.js';

const router = express.Router();

// This is a STUB — full implementation in Day 2/3
router.post('/sessions/:id/query', async (req, res, next) => {
  try {
    const { message } = req.body;
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    // Save user message
    await Message.create({ sessionId: session._id, role: 'user', text: message });
    
    // STUB response — replace with real pipeline in Day 2/3
    const stubAnswer = await Message.create({
      sessionId: session._id,
      role: 'assistant',
      text: `Research pipeline coming in Day 2. Your query about "${message}" for ${session.disease} has been received.`,
      retrievalStats: { totalCandidates: 0, pubmedFetched: 0, openalexFetched: 0, ctFetched: 0, rerankedTo: 0 }
    });
    
    session.messageCount += 2;
    session.updatedAt = new Date();
    await session.save();
    
    res.json({ message: stubAnswer, sources: [] });
  } catch (err) { next(err); }
});

export default router;
```

---

## ✅ Day 1 Checklist

- [ ] Project structure created with all folders
- [ ] All npm/pip packages installed
- [ ] MongoDB Atlas cluster created + connection string in .env
- [ ] All 5 Mongoose schemas created
- [ ] Express server running on port 5000
- [ ] `/api/health` returns `{ status: ok, mongodb: connected }`
- [ ] `/api/sessions` POST creates a session
- [ ] React app running on port 5173
- [ ] Landing page renders with Start Research button
- [ ] Context form opens and submits (creates session, navigates to /research/:id)
- [ ] ResearchInterface renders 3-panel layout (chat + evidence + sidebar)
- [ ] Chat input works, sends stub responses
- [ ] Voice input button shows (may not be fully functional yet)
- [ ] Tailwind + dark theme working throughout

## 🚀 End of Day 1 Commit Message
```
feat: day 1 - mern skeleton, mongodb schemas, landing page, chat ui shell, context form
```
