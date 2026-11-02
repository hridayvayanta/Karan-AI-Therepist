'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Send, 
  Brain, 
  Sparkles, 
  Smile, 
  Settings, 
  X, 
  Plus, 
  Trash2, 
  Radio, 
  MessageSquare,
  CheckCircle2,
  Calendar,
  Activity
} from 'lucide-react';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

interface MemoryItem {
  id: string;
  category: string;
  fact: string;
  createdAt: string;
}

export default function KaranApp() {
  // App state
  const [mode, setMode] = useState<'voice' | 'chat'>('voice');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hey Hriday. I'm here. How's everything going with you today?",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');

  // Drawers & Modals
  const [showMemoryDrawer, setShowMemoryDrawer] = useState(false);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState('project');

  const [showMoodModal, setShowMoodModal] = useState(false);
  const [moodScore, setMoodScore] = useState(7);
  const [moodNotes, setMoodNotes] = useState('');
  const [moodSaved, setMoodSaved] = useState(false);

  // Speech Recognition Reference
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initial Load: Fetch voices, past conversation, memories
  useEffect(() => {
    // Load voices
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
        // Find best natural English voice
        const preferred = voices.find(v => 
          v.name.includes('Natural') || 
          v.name.includes('Daniel') || 
          v.name.includes('Google UK English Male') || 
          v.name.includes('Google US English') ||
          v.lang.startsWith('en')
        );
        if (preferred) setSelectedVoice(preferred.name);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    // Load initial chat history
    fetch('/api/chat')
      .then(res => res.json())
      .then(data => {
        if (data && data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          setConversationId(data.id);
        }
      })
      .catch(() => {});

    // Load memories
    fetchMemories();
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMemories = () => {
    fetch('/api/memories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMemories(data);
      })
      .catch(() => {});
  };

  // 2. Speech Synthesis (Karan Speaks)
  const speakText = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    // Clean markdown symbols for natural speech
    const cleanSpeech = text
      .replace(/[*_#`~\[\]()]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    
    if (selectedVoice) {
      const voiceObj = availableVoices.find(v => v.name === selectedVoice);
      if (voiceObj) utterance.voice = voiceObj;
    }

    utterance.rate = 1.0;
    utterance.pitch = 0.98;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // 3. Speech Recognition (User Speaks)
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please use Google Chrome or Edge.');
      return;
    }

    // Stop ongoing speech
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setLiveTranscript('');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const finalTranscript = event.results[i][0].transcript;
          setLiveTranscript(finalTranscript);
          handleSendMessage(finalTranscript);
          stopListening();
          return;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setLiveTranscript(interim);
    };

    recognition.onerror = (e: any) => {
      console.warn('Speech recognition error:', e.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error(e);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // 4. Send Message Handler
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text || !text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLiveTranscript('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          conversationId,
        }),
      });

      const data = await res.json();
      if (data.reply) {
        const assistantMsg: Message = { role: 'assistant', content: data.reply };
        setMessages(prev => [...prev, assistantMsg]);
        if (data.conversationId) setConversationId(data.conversationId);

        // Speak aloud
        speakText(data.reply);

        // Refresh memories in case a new fact was detected
        fetchMemories();
      }
    } catch (error) {
      console.error('Chat error:', error);
      const fallbackMsg: Message = {
        role: 'assistant',
        content: "I'm right here with you, Hriday. Tell me more about what you're thinking.",
      };
      setMessages(prev => [...prev, fallbackMsg]);
      speakText(fallbackMsg.content);
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Memory Management
  const handleAddMemory = async () => {
    if (!newMemoryText.trim()) return;
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fact: newMemoryText.trim(),
          category: newMemoryCategory,
        }),
      });
      if (res.ok) {
        setNewMemoryText('');
        fetchMemories();
      }
    } catch (e) {}
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      const res = await fetch('/api/memories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) fetchMemories();
    } catch (e) {}
  };

  // 6. Mood Check-in
  const handleSaveMood = async () => {
    try {
      const res = await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: moodScore,
          notes: moodNotes,
        }),
      });
      if (res.ok) {
        setMoodSaved(true);
        setTimeout(() => {
          setShowMoodModal(false);
          setMoodSaved(false);
          setMoodNotes('');
        }, 1200);
      }
    } catch (e) {}
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#09090d] text-[#f4f4f7] overflow-hidden">
      {/* Top Header */}
      <header className="h-16 border-b border-white/[0.06] bg-[#0c0c12]/80 backdrop-blur-md px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-400 flex items-center justify-center font-bold text-xs text-white shadow-lg shadow-purple-500/20">
            K
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-wide">Karan</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">Personal AI Companion · Free Offline Core</span>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center bg-[#151520] p-1 rounded-xl border border-white/[0.08]">
          <button
            onClick={() => setMode('voice')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'voice'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Voice Talk
          </button>
          <button
            onClick={() => setMode('chat')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'chat'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Everyday Chat
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Daily Mood Button */}
          <button
            onClick={() => setShowMoodModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-zinc-300 transition-colors"
            title="Log Today's Mood"
          >
            <Smile className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Daily Check-in</span>
          </button>

          {/* Memory Drawer Button */}
          <button
            onClick={() => setShowMemoryDrawer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-zinc-300 transition-colors relative"
            title="Karan's Memory Drawer"
          >
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Memories</span>
            {memories.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 text-[10px] flex items-center justify-center font-mono">
                {memories.length}
              </span>
            )}
          </button>

          {/* Voice Output Mute Toggle */}
          <button
            onClick={() => {
              setVoiceEnabled(!voiceEnabled);
              if (voiceEnabled) window.speechSynthesis?.cancel();
            }}
            className={`p-2 rounded-lg border transition-colors ${
              voiceEnabled
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                : 'bg-white/[0.04] border-white/[0.08] text-zinc-500'
            }`}
            title={voiceEnabled ? 'Voice Output Active' : 'Voice Output Muted'}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col overflow-hidden">
        {mode === 'voice' ? (
          /* ==========================================================================
             VOICE TALK MODE (AMBIENT GLOWING ORB INTERFACE)
             ========================================================================== */
          <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
            {/* Ambient Background Gradient */}
            <div className="absolute inset-0 bg-radial-at-c from-purple-900/10 via-transparent to-transparent pointer-events-none"></div>

            {/* Glowing Interactive Voice Orb */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center mb-8">
              {isListening && (
                <>
                  <div className="ripple-ring"></div>
                  <div className="ripple-ring" style={{ animationDelay: '1s' }}></div>
                  <div className="ripple-ring" style={{ animationDelay: '2s' }}></div>
                </>
              )}

              <div
                onClick={toggleListening}
                className={`w-48 h-48 sm:w-56 sm:h-56 rounded-full cursor-pointer flex flex-col items-center justify-center transition-all duration-700 relative z-10 ${
                  isSpeaking
                    ? 'orb-speaking bg-gradient-to-tr from-purple-600 via-indigo-500 to-pink-500'
                    : isListening
                    ? 'orb-listening bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500'
                    : 'orb-idle bg-gradient-to-tr from-purple-900/80 via-indigo-900/60 to-purple-800/80 border border-purple-500/30'
                }`}
              >
                {isSpeaking ? (
                  <div className="flex items-center gap-1.5 h-6">
                    <span className="w-1.5 h-6 bg-white rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-8 bg-white rounded-full animate-bounce [animation-delay:0.15s]"></span>
                    <span className="w-1.5 h-10 bg-white rounded-full animate-bounce [animation-delay:0.3s]"></span>
                    <span className="w-1.5 h-7 bg-white rounded-full animate-bounce [animation-delay:0.45s]"></span>
                    <span className="w-1.5 h-4 bg-white rounded-full animate-bounce [animation-delay:0.6s]"></span>
                  </div>
                ) : isListening ? (
                  <Mic className="w-10 h-10 text-white animate-pulse" />
                ) : (
                  <div className="flex flex-col items-center">
                    <Mic className="w-8 h-8 text-purple-200 mb-1 opacity-80" />
                    <span className="text-[11px] font-medium tracking-wider uppercase text-purple-200/70">
                      Tap to Speak
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Live Subtitle Transcript Display */}
            <div className="max-w-xl w-full text-center min-h-[80px] flex flex-col items-center justify-center px-4">
              {isListening && (
                <p className="text-purple-300 text-sm font-medium animate-pulse">
                  {liveTranscript ? `"${liveTranscript}"` : 'Listening... Speak naturally'}
                </p>
              )}
              {isLoading && (
                <p className="text-zinc-400 text-xs tracking-wide flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
                  Karan is thinking...
                </p>
              )}
              {!isListening && !isLoading && messages.length > 0 && (
                <div className="bg-[#12121c]/80 border border-white/[0.06] rounded-2xl p-4 shadow-xl backdrop-blur-md">
                  <p className="text-zinc-200 text-sm sm:text-base leading-relaxed">
                    {messages[messages.length - 1].content}
                  </p>
                </div>
              )}
            </div>

            {/* Voice Controls Bar */}
            <div className="mt-8 flex items-center gap-4">
              <button
                onClick={toggleListening}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all ${
                  isListening
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" /> Stop Listening
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" /> Start Speaking
                  </>
                )}
              </button>

              {availableVoices.length > 0 && (
                <select
                  value={selectedVoice}
                  onChange={e => setSelectedVoice(e.target.value)}
                  className="bg-[#151520] border border-white/[0.08] text-xs text-zinc-300 rounded-full px-4 py-2.5 outline-none cursor-pointer max-w-[200px] truncate"
                >
                  {availableVoices
                    .filter(v => v.lang.startsWith('en'))
                    .map(v => (
                      <option key={v.name} value={v.name}>
                        {v.name.slice(0, 24)}
                      </option>
                    ))}
                </select>
              )}
            </div>
          </div>
        ) : (
          /* ==========================================================================
             CHAT & JOURNAL MODE
             ========================================================================== */
          <div className="flex-1 flex flex-col h-full max-w-3xl w-full mx-auto p-4 sm:p-6 overflow-hidden">
            {/* Quick Prompt Starters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-2 no-scrollbar">
              {[
                "How was today's progress?",
                "I'm feeling a bit burnt out",
                "Let's review my goals",
                "Brainstorming PLINTH features",
                "Give me a grounding thought",
              ].map((starter, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(starter)}
                  className="whitespace-nowrap px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-zinc-300 transition-colors"
                >
                  {starter}
                </button>
              ))}
            </div>

            {/* Chat Thread */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={index}
                    className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-xs font-semibold text-purple-300 flex-shrink-0 mt-1">
                        K
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        isUser
                          ? 'bg-purple-600 text-white rounded-tr-sm'
                          : 'bg-[#151520] border border-white/[0.06] text-zinc-200 rounded-tl-sm shadow-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex items-center gap-2 text-zinc-500 text-xs py-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:0.4s]"></div>
                  <span>Karan is writing...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="pt-4 border-t border-white/[0.06]">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2 bg-[#12121c] border border-white/[0.1] rounded-2xl p-2 px-3 shadow-lg focus-within:border-purple-500/50 transition-colors"
              >
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-2 rounded-xl transition-colors ${
                    isListening ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Speech-to-text dictation"
                >
                  <Mic className="w-5 h-5" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Talk to Karan about anything..."
                  className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none px-2"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || isLoading}
                  className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white transition-all shadow-md shadow-purple-600/20"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ==========================================================================
         MEMORY DRAWER (SLIDE-OVER)
         ========================================================================== */}
      {showMemoryDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0e0e16] border-l border-white/[0.08] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-sm">Karan's Memory Drawer</h3>
              </div>
              <button
                onClick={() => setShowMemoryDrawer(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 border-b border-white/[0.06] bg-white/[0.02]">
              <label className="text-xs text-zinc-400 block mb-2 font-medium">Teach Karan a New Memory</label>
              <div className="flex gap-2 mb-2">
                <select
                  value={newMemoryCategory}
                  onChange={e => setNewMemoryCategory(e.target.value)}
                  className="bg-[#161622] border border-white/[0.08] rounded-lg text-xs text-zinc-300 px-2 py-1.5 outline-none"
                >
                  <option value="project">Project</option>
                  <option value="habit">Habit</option>
                  <option value="goal">Goal</option>
                  <option value="preference">Preference</option>
                </select>
                <input
                  type="text"
                  value={newMemoryText}
                  onChange={e => setNewMemoryText(e.target.value)}
                  placeholder="e.g. I work best late at night..."
                  className="flex-1 bg-[#161622] border border-white/[0.08] rounded-lg text-xs text-zinc-200 px-3 py-1.5 outline-none"
                />
              </div>
              <button
                onClick={handleAddMemory}
                disabled={!newMemoryText.trim()}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-xs font-semibold rounded-lg text-white transition-colors"
              >
                Save Memory to SQLite
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
                Saved Memories ({memories.length})
              </p>
              {memories.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-xs">
                  No memories yet. Karan will auto-learn facts from your conversations or you can add them above.
                </div>
              ) : (
                memories.map(m => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-start justify-between gap-3 group"
                  >
                    <div>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 mb-1.5 inline-block">
                        {m.category}
                      </span>
                      <p className="text-xs text-zinc-200 leading-relaxed">{m.fact}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteMemory(m.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition-opacity"
                      title="Forget this memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
         DAILY MOOD CHECK-IN MODAL
         ========================================================================== */}
      {showMoodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#11111a] border border-white/[0.1] rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowMoodModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-semibold text-base mb-1">Daily Check-in</h3>
            <p className="text-xs text-zinc-400 mb-6">How are you feeling right now on a scale of 1 to 10?</p>

            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-purple-400 font-mono">{moodScore}</span>
              <span className="text-xs text-zinc-500 block mt-1">
                {moodScore >= 8 ? 'Feeling energized & great' : moodScore >= 5 ? 'Steady & okay' : 'Tough / Need rest'}
              </span>
            </div>

            <input
              type="range"
              min="1"
              max="10"
              value={moodScore}
              onChange={e => setMoodScore(Number(e.target.value))}
              className="w-full accent-purple-500 mb-6 cursor-pointer"
            />

            <textarea
              value={moodNotes}
              onChange={e => setMoodNotes(e.target.value)}
              placeholder="Any quick thought on why you feel this way?"
              className="w-full bg-[#181826] border border-white/[0.08] rounded-xl text-xs text-zinc-200 p-3 outline-none resize-none h-20 mb-4"
            />

            <button
              onClick={handleSaveMood}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-xs font-semibold rounded-xl text-white transition-colors flex items-center justify-center gap-2"
            >
              {moodSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Logged!
                </>
              ) : (
                'Save to Journal'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
