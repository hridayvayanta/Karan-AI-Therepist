'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Send, 
  Brain, 
  Sparkles, 
  Smile, 
  X, 
  Plus, 
  Trash2, 
  Radio, 
  MessageSquare,
  CheckCircle2,
  PhoneCall,
  PhoneOff,
  Headphones,
  Flame,
  Volume
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

const NEURAL_VOICES = [
  { id: 'en-IN-PrabhatNeural', name: 'Prabhat (Indian English — Warm & Conversational)' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher (US English — Relaxed & Friendly)' },
  { id: 'en-US-AndrewNeural', name: 'Andrew (US English — Deep & Grounded)' },
  { id: 'en-US-GuyNeural', name: 'Guy (US English — Natural & Casual)' },
  { id: 'en-GB-RyanNeural', name: 'Ryan (British English — Thoughtful)' },
  { id: 'en-IN-NeerjaNeural', name: 'Neerja (Indian English — Gentle & Clear)' },
];

export default function KaranApp() {
  // App mode
  const [mode, setMode] = useState<'voice' | 'chat'>('voice');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hey Hriday. I'm right here. How are you feeling today?",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Continuous Hands-Free Call Mode State
  const [callActive, setCallActive] = useState(false);
  const [callState, setCallState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('en-IN-PrabhatNeural');
  const [voiceVolume, setVoiceVolume] = useState(true);

  // Drawers & Modals
  const [showMemoryDrawer, setShowMemoryDrawer] = useState(false);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState('project');

  const [showMoodModal, setShowMoodModal] = useState(false);
  const [moodScore, setMoodScore] = useState(7);
  const [moodNotes, setMoodNotes] = useState('');
  const [moodSaved, setMoodSaved] = useState(false);

  // Audio & Speech References
  const recognitionRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callActiveRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync ref with state
  useEffect(() => {
    callActiveRef.current = callActive;
  }, [callActive]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial Load
  useEffect(() => {
    // Load initial chat history from SQLite
    fetch('/api/chat')
      .then(res => res.json())
      .then(data => {
        if (data && data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          setConversationId(data.id);
        }
      })
      .catch(() => {});

    // Load memories from SQLite
    fetchMemories();

    return () => {
      stopCall();
    };
  }, []);

  const fetchMemories = () => {
    fetch('/api/memories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMemories(data);
      })
      .catch(() => {});
  };

  // ==========================================================================
  // NATURAL NEURAL SPEECH ENGINE (MICROSOFT NEURAL EDGETTS)
  // ==========================================================================
  const playNeuralSpeech = async (text: string): Promise<void> => {
    if (!voiceVolume) {
      if (callActiveRef.current) resumeContinuousListening();
      return;
    }

    setCallState('speaking');

    try {
      // Stop any playing audio
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }

      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: selectedVoice,
        }),
      });

      if (!res.ok) throw new Error('Neural TTS failed');

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        audioPlayerRef.current = null;
        setCallState('idle');
        // CONTINUOUS CONVERSATION LOOP: Auto-listen immediately!
        if (callActiveRef.current) {
          resumeContinuousListening();
        }
      };

      audio.onerror = () => {
        audioPlayerRef.current = null;
        setCallState('idle');
        if (callActiveRef.current) resumeContinuousListening();
      };

      await audio.play();
    } catch (err) {
      console.warn('Neural TTS failed, falling back to local speech synthesis:', err);
      // Fallback to browser speech
      fallbackSpeak(text);
    }
  };

  const fallbackSpeak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const cleanText = text.replace(/[*_#`~\[\]()]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 0.98;

    utterance.onend = () => {
      setCallState('idle');
      if (callActiveRef.current) resumeContinuousListening();
    };
    utterance.onerror = () => {
      setCallState('idle');
      if (callActiveRef.current) resumeContinuousListening();
    };

    window.speechSynthesis.speak(utterance);
  };

  // ==========================================================================
  // CONTINUOUS CONVERSATION LOOP & RECOGNITION
  // ==========================================================================
  const startCall = () => {
    setCallActive(true);
    callActiveRef.current = true;
    startContinuousListening();
  };

  const stopCall = () => {
    setCallActive(false);
    callActiveRef.current = false;
    setCallState('idle');
    setLiveTranscript('');

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const resumeContinuousListening = () => {
    setTimeout(() => {
      if (callActiveRef.current) {
        startContinuousListening();
      }
    }, 350);
  };

  const startContinuousListening = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is supported in Chrome, Edge, and Safari.');
      stopCall();
      return;
    }

    // Abort existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let currentSpokenBuffer = '';

    recognition.onstart = () => {
      setCallState('listening');
      setLiveTranscript('');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentSpokenBuffer += ' ' + event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      const activeText = (currentSpokenBuffer + ' ' + interim).trim();
      setLiveTranscript(activeText);

      // RESET SILENCE DETECTION TIMER:
      // When the user pauses speaking for 1.3 seconds, automatically submit!
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      if (activeText.length > 2) {
        silenceTimerRef.current = setTimeout(() => {
          if (callActiveRef.current && activeText.trim()) {
            try {
              recognition.stop();
            } catch (e) {}
            handleVoiceSubmit(activeText.trim());
          }
        }, 1300);
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech') {
        // No speech detected, quietly keep listening if call is active
        return;
      }
      console.warn('Recognition notice:', e.error);
    };

    recognition.onend = () => {
      // If call is still active and we aren't thinking/speaking, restart listening automatically!
      if (callActiveRef.current && callState !== 'thinking' && callState !== 'speaking') {
        try {
          recognition.start();
        } catch (e) {}
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error('Error starting recognition:', e);
    }
  };

  // Handle incoming voice submission
  const handleVoiceSubmit = async (transcript: string) => {
    if (!transcript.trim()) return;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setCallState('thinking');
    setLiveTranscript('');

    const userMsg: Message = { role: 'user', content: transcript };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: transcript,
          conversationId,
        }),
      });

      const data = await res.json();
      if (data.reply) {
        const assistantMsg: Message = { role: 'assistant', content: data.reply };
        setMessages(prev => [...prev, assistantMsg]);
        if (data.conversationId) setConversationId(data.conversationId);

        // PLAY NATURAL NEURAL AUDIO!
        await playNeuralSpeech(data.reply);

        // Refresh memories
        fetchMemories();
      }
    } catch (err) {
      console.error('Voice chat error:', err);
      const fallback = "I'm listening, Hriday. Take your time.";
      setMessages(prev => [...prev, { role: 'assistant', content: fallback }]);
      await playNeuralSpeech(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  // Text Chat Submit Handler
  const handleTextSubmit = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text || !text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
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

        if (voiceVolume) {
          playNeuralSpeech(data.reply);
        }

        fetchMemories();
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Memories
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

  // Mood
  const handleSaveMood = async () => {
    try {
      const res = await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: moodScore, notes: moodNotes }),
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
    <div className="flex flex-col h-screen w-full bg-[#08080c] text-[#f4f4f7] overflow-hidden select-none">
      {/* Top Bar */}
      <header className="h-16 border-b border-white/[0.06] bg-[#0c0c14]/90 backdrop-blur-md px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-bold text-xs text-white shadow-lg shadow-purple-600/30">
            K
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-wide">Karan</span>
              <span className={`w-2 h-2 rounded-full ${callActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}></span>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">
              {callActive ? 'Continuous Call Active · Hands-Free' : 'Online · Ready to Talk'}
            </span>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center bg-[#14141f] p-1 rounded-xl border border-white/[0.08]">
          <button
            onClick={() => setMode('voice')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'voice'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Continuous Voice
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

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Neural Voice Picker */}
          <select
            value={selectedVoice}
            onChange={e => setSelectedVoice(e.target.value)}
            className="hidden md:block bg-[#14141f] border border-white/[0.08] text-xs text-zinc-300 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer max-w-[190px] truncate"
            title="Karan's Natural Neural Voice"
          >
            {NEURAL_VOICES.map(v => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          {/* Daily Mood Check-in */}
          <button
            onClick={() => setShowMoodModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-zinc-300 transition-colors"
          >
            <Smile className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Mood</span>
          </button>

          {/* Memories */}
          <button
            onClick={() => setShowMemoryDrawer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-zinc-300 transition-colors relative"
          >
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Memories</span>
            {memories.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 text-[10px] flex items-center justify-center font-mono">
                {memories.length}
              </span>
            )}
          </button>

          {/* Mute toggle */}
          <button
            onClick={() => {
              setVoiceVolume(!voiceVolume);
              if (voiceVolume && audioPlayerRef.current) {
                audioPlayerRef.current.pause();
              }
            }}
            className={`p-2 rounded-lg border transition-colors ${
              voiceVolume
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                : 'bg-white/[0.04] border-white/[0.08] text-zinc-500'
            }`}
            title={voiceVolume ? 'Voice Output Active' : 'Muted'}
          >
            {voiceVolume ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 relative flex flex-col overflow-hidden">
        {mode === 'voice' ? (
          /* ==========================================================================
             CONTINUOUS HANDS-FREE VOICE CALL
             ========================================================================== */
          <div className="flex-1 flex flex-col items-center justify-between p-6 py-10 relative">
            {/* Background Atmosphere */}
            <div className="absolute inset-0 bg-radial-at-c from-purple-900/15 via-transparent to-transparent pointer-events-none"></div>

            {/* Top Status Call Pill */}
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${callActive ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'}`}></span>
              <span className="text-zinc-300">
                {callState === 'listening' ? 'Listening to you... Speak freely' : 
                 callState === 'thinking' ? 'Karan is thinking...' : 
                 callState === 'speaking' ? 'Karan is speaking...' : 
                 callActive ? 'Hands-Free Call Connected' : 'Call Ready'}
              </span>
            </div>

            {/* Glowing Interactive Voice Orb */}
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center my-auto">
              {callState === 'listening' && (
                <>
                  <div className="ripple-ring"></div>
                  <div className="ripple-ring" style={{ animationDelay: '1s' }}></div>
                  <div className="ripple-ring" style={{ animationDelay: '2s' }}></div>
                </>
              )}

              <div
                onClick={() => {
                  if (callActive) {
                    if (callState === 'speaking' && audioPlayerRef.current) {
                      // Barge-in: interrupt speech and listen to user
                      audioPlayerRef.current.pause();
                      setCallState('idle');
                      resumeContinuousListening();
                    } else {
                      stopCall();
                    }
                  } else {
                    startCall();
                  }
                }}
                className={`w-52 h-52 sm:w-60 sm:h-60 rounded-full cursor-pointer flex flex-col items-center justify-center transition-all duration-700 relative z-10 ${
                  callState === 'speaking'
                    ? 'orb-speaking bg-gradient-to-tr from-purple-600 via-indigo-500 to-pink-500 shadow-2xl shadow-purple-500/50'
                    : callState === 'listening'
                    ? 'orb-listening bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 shadow-2xl shadow-indigo-500/50'
                    : callActive
                    ? 'orb-idle bg-gradient-to-tr from-purple-900 via-indigo-900 to-purple-800 border border-purple-500/40'
                    : 'bg-gradient-to-tr from-zinc-900 via-[#161622] to-zinc-900 border border-white/[0.1] hover:border-purple-500/40'
                }`}
              >
                {callState === 'speaking' ? (
                  <div className="flex items-center gap-1.5 h-8">
                    <span className="w-1.5 h-6 bg-white rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-10 bg-white rounded-full animate-bounce [animation-delay:0.15s]"></span>
                    <span className="w-1.5 h-12 bg-white rounded-full animate-bounce [animation-delay:0.3s]"></span>
                    <span className="w-1.5 h-8 bg-white rounded-full animate-bounce [animation-delay:0.45s]"></span>
                    <span className="w-1.5 h-5 bg-white rounded-full animate-bounce [animation-delay:0.6s]"></span>
                  </div>
                ) : callState === 'listening' ? (
                  <div className="flex flex-col items-center">
                    <Mic className="w-12 h-12 text-white animate-pulse mb-1" />
                    <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-200">
                      Listening
                    </span>
                  </div>
                ) : callActive ? (
                  <div className="flex flex-col items-center">
                    <Headphones className="w-10 h-10 text-purple-200 mb-1" />
                    <span className="text-[11px] font-mono uppercase tracking-wider text-purple-300">
                      Connected
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <PhoneCall className="w-10 h-10 text-zinc-400 group-hover:text-purple-300 mb-2" />
                    <span className="text-xs font-semibold tracking-wider uppercase text-zinc-300">
                      Start Call
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Live Subtitle Transcript Area */}
            <div className="max-w-xl w-full text-center min-h-[90px] flex flex-col items-center justify-center px-4 mb-4">
              {liveTranscript && (
                <div className="bg-purple-950/40 border border-purple-500/30 rounded-2xl p-4 px-6 shadow-lg backdrop-blur-md mb-2">
                  <p className="text-purple-200 text-sm font-medium">"{liveTranscript}"</p>
                </div>
              )}

              {callState === 'thinking' && (
                <p className="text-zinc-400 text-xs tracking-wide flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
                  Karan is formulating his response...
                </p>
              )}

              {!liveTranscript && callState !== 'thinking' && messages.length > 0 && (
                <div className="bg-[#11111a]/80 border border-white/[0.08] rounded-2xl p-4 px-6 shadow-xl backdrop-blur-md">
                  <p className="text-zinc-200 text-sm sm:text-base leading-relaxed">
                    {messages[messages.length - 1].content}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="flex items-center gap-4">
              {callActive ? (
                <>
                  <button
                    onClick={stopCall}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-xl shadow-rose-600/30 transition-all hover:scale-105"
                  >
                    <PhoneOff className="w-4 h-4" /> End Call
                  </button>

                  {callState === 'speaking' && (
                    <button
                      onClick={() => {
                        if (audioPlayerRef.current) audioPlayerRef.current.pause();
                        setCallState('idle');
                        resumeContinuousListening();
                      }}
                      className="px-4 py-3 rounded-full text-xs font-medium bg-white/[0.08] hover:bg-white/[0.14] text-zinc-200 border border-white/[0.1] transition-all"
                    >
                      Interrupt &amp; Talk
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={startCall}
                  className="flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-xl shadow-purple-600/30 transition-all hover:scale-105"
                >
                  <PhoneCall className="w-4 h-4" /> Start Hands-Free Call
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ==========================================================================
             CHAT & JOURNAL MODE
             ========================================================================== */
          <div className="flex-1 flex flex-col h-full max-w-3xl w-full mx-auto p-4 sm:p-6 overflow-hidden">
            {/* Quick Starters */}
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
                  onClick={() => handleTextSubmit(starter)}
                  className="whitespace-nowrap px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-zinc-300 transition-colors"
                >
                  {starter}
                </button>
              ))}
            </div>

            {/* Message Thread */}
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
                          : 'bg-[#14141f] border border-white/[0.06] text-zinc-200 rounded-tl-sm shadow-sm'
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
                  <span>Karan is thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="pt-4 border-t border-white/[0.06]">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleTextSubmit();
                }}
                className="flex items-center gap-2 bg-[#11111a] border border-white/[0.1] rounded-2xl p-2 px-3 shadow-lg focus-within:border-purple-500/50 transition-colors"
              >
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
         DAILY MOOD MODAL
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
