import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Cpu, Terminal, Shield, Settings, Download, User, Activity, LogIn, LogOut } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/src/lib/utils';
import { chatWithJarvis } from '@/src/lib/gemini';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  getDoc
} from '@/src/lib/firebase';

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export default function JarvisUI() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: "Welcome back, Sir. All systems are operational. How may I assist you today?",
      timestamp: new Date().toLocaleTimeString(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    cpu: 12,
    memory: 45,
    network: 'Stable',
    security: 'Optimal',
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Simulate system fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemStatus(prev => ({
        ...prev,
        cpu: Math.floor(Math.random() * 20) + 5,
        memory: Math.floor(Math.random() * 10) + 40,
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);

      if (currentUser) {
        // Ensure user profile exists in Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Sir',
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            role: 'user',
            createdAt: serverTimestamp()
          });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore messages listener
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const messagesRef = collection(db, 'users', user.uid, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          role: data.role,
          content: data.content,
          timestamp: data.timestamp?.toDate().toLocaleTimeString() || new Date().toLocaleTimeString()
        } as Message;
      });

      if (loadedMessages.length > 0) {
        setMessages(loadedMessages);
      }
    }, (error) => {
      console.error("Firestore Error:", error);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMessages([{
        role: 'model',
        content: "Welcome back, Sir. All systems are operational. How may I assist you today?",
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessageContent = input;
    setInput('');
    setIsLoading(true);

    // If not logged in, just use local state
    if (!user) {
      const userMessage: Message = {
        role: 'user',
        content: userMessageContent,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, userMessage]);
      
      try {
        const response = await chatWithJarvis(userMessageContent, messages.map(m => ({
          role: m.role,
          content: m.content
        })));

        const jarvisMessage: Message = {
          role: 'model',
          content: response || "I'm sorry, Sir, I encountered a slight glitch in my processing core.",
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages(prev => [...prev, jarvisMessage]);
      } catch (error) {
        console.error("Jarvis Error:", error);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Logged in: Save to Firestore
    try {
      const messagesRef = collection(db, 'users', user.uid, 'messages');
      await addDoc(messagesRef, {
        uid: user.uid,
        role: 'user',
        content: userMessageContent,
        timestamp: serverTimestamp()
      });

      const response = await chatWithJarvis(userMessageContent, messages.map(m => ({
        role: m.role,
        content: m.content
      })));

      await addDoc(messagesRef, {
        uid: user.uid,
        role: 'model',
        content: response || "I'm sorry, Sir, I encountered a slight glitch in my processing core.",
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Jarvis Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadChat = () => {
    const content = messages.map(m => `[${m.timestamp}] ${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis_session_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerSelfImprovement = () => {
    setInput("Analyze your current state and suggest one technical or aesthetic enhancement for your next version.");
    // We don't call handleSend here because we want the user to see the prompt first or we can just send it.
    // Let's just send it for a more "autonomous" feel.
  };

  useEffect(() => {
    if (input === "Analyze your current state and suggest one technical or aesthetic enhancement for your next version.") {
      handleSend();
    }
  }, [input]);

  return (
    <div className="min-h-screen bg-slate-950 text-cyan-400 font-mono selection:bg-cyan-500/30 overflow-hidden flex flex-col">
      {/* HUD Header */}
      <header className="border-b border-cyan-900/50 p-4 flex justify-between items-center bg-slate-950/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="w-10 h-10 border-2 border-dashed border-cyan-500 rounded-full flex items-center justify-center"
            >
              <Cpu size={20} />
            </motion.div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-widest uppercase">Jarvis v2.5</h1>
            <p className="text-[10px] text-cyan-600 uppercase tracking-tighter">Autonomous Intelligence System</p>
          </div>
        </div>

        <div className="flex gap-6 text-[10px] uppercase tracking-widest hidden md:flex">
          <div className="flex flex-col items-end">
            <span className="text-cyan-600">CPU LOAD</span>
            <span>{systemStatus.cpu}%</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-cyan-600">MEM USAGE</span>
            <span>{systemStatus.memory}%</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-cyan-600">SECURITY</span>
            <span className="text-green-400">{systemStatus.security}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={downloadChat}
            title="Download Session Log"
            className="p-2 hover:bg-cyan-900/30 rounded-full transition-colors text-cyan-400"
          >
            <Download size={20} />
          </button>
          {user ? (
            <button 
              onClick={handleLogout}
              title="Logout"
              className="p-2 hover:bg-cyan-900/30 rounded-full transition-colors text-cyan-400 flex items-center gap-2"
            >
              <span className="text-[10px] hidden sm:inline">{user.displayName}</span>
              <LogOut size={20} />
            </button>
          ) : (
            <button 
              onClick={handleLogin}
              title="Login with Google"
              className="p-2 hover:bg-cyan-900/30 rounded-full transition-colors text-cyan-400 flex items-center gap-2"
            >
              <span className="text-[10px] hidden sm:inline">LOGIN</span>
              <LogIn size={20} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {/* Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0891b21a_1px,transparent_1px),linear-gradient(to_bottom,#0891b21a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#0891b20d_0,transparent_100%)] pointer-events-none" />

        {/* Sidebar - System Diagnostics */}
        <aside className="w-64 border-r border-cyan-900/50 p-4 hidden lg:flex flex-col gap-6 bg-slate-950/40 backdrop-blur-sm">
          <section>
            <h2 className="text-xs font-bold mb-3 flex items-center gap-2 text-cyan-600">
              <Activity size={14} /> SYSTEM DIAGNOSTICS
            </h2>
            <div className="space-y-4">
              {['Neural Core', 'Logic Engine', 'Personality Matrix', 'Self-Evolution'].map((system) => (
                <div key={system} className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span>{system}</span>
                    <span className="text-green-400">ONLINE</span>
                  </div>
                  <div className="h-1 bg-cyan-900/50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 2, delay: Math.random() }}
                      className="h-full bg-cyan-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-auto space-y-4">
            <button 
              onClick={triggerSelfImprovement}
              className="w-full p-2 border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 rounded text-[10px] transition-all flex items-center justify-center gap-2"
            >
              <Settings size={12} /> TRIGGER SELF-EVOLUTION
            </button>
            <div className="p-3 border border-cyan-900/50 bg-cyan-950/20 rounded-lg text-[10px] leading-relaxed">
              <p className="text-cyan-600 mb-2">AUTONOMOUS UPDATE LOG:</p>
              <p className="text-cyan-400/80 italic">"Analyzing user interaction patterns... Optimizing response latency... Version 2.5 stable."</p>
            </div>
          </section>
        </aside>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col relative">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10, x: msg.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  className={cn(
                    "flex flex-col max-w-[80%] gap-1",
                    msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div className="flex items-center gap-2 text-[10px] text-cyan-600 uppercase tracking-widest">
                    {msg.role === 'model' ? <Cpu size={12} /> : <User size={12} />}
                    <span>{msg.role === 'model' ? 'Jarvis' : 'User'}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed border",
                    msg.role === 'user'
                      ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-100 rounded-tr-none"
                      : "bg-slate-900/80 border-cyan-900/50 text-cyan-400 rounded-tl-none shadow-[0_0_20px_rgba(6,182,212,0.05)]"
                  )}>
                    <div className="markdown-body prose prose-invert prose-cyan max-w-none prose-p:leading-relaxed prose-pre:bg-slate-950 prose-pre:border prose-pre:border-cyan-900/50">
                      <ReactMarkdown>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 text-cyan-600 text-xs"
              >
                <div className="flex gap-1">
                  <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                  <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                  <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                </div>
                <span>Jarvis is processing...</span>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 bg-slate-950/80 backdrop-blur-md border-t border-cyan-900/50">
            <div className="max-w-4xl mx-auto relative group">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Enter command for Jarvis..."
                className="w-full bg-slate-900 border border-cyan-900/50 rounded-xl p-4 pr-16 text-cyan-100 placeholder:text-cyan-900 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all resize-none h-14 min-h-[56px] max-h-32"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-3 bottom-3 p-2 bg-cyan-500 text-slate-950 rounded-lg hover:bg-cyan-400 disabled:opacity-50 disabled:hover:bg-cyan-500 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                <Send size={18} />
              </button>
            </div>
            <div className="mt-3 flex justify-center gap-4 text-[10px] text-cyan-900 uppercase tracking-widest">
              <span className="flex items-center gap-1"><Terminal size={10} /> Shift+Enter for new line</span>
              <span className="flex items-center gap-1"><Shield size={10} /> Secure Connection Active</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer HUD */}
      <footer className="h-8 border-t border-cyan-900/50 bg-slate-950 flex items-center px-4 justify-between text-[10px] tracking-widest text-cyan-900">
        <div className="flex gap-4">
          <span>LATENCY: 24MS</span>
          <span>UPTIME: 99.9%</span>
        </div>
        <div className="flex gap-4">
          <span className="animate-pulse text-cyan-600">SYSTEM EVOLVING...</span>
          <span>© 2026 JARVIS CORE</span>
        </div>
      </footer>
    </div>
  );
}
