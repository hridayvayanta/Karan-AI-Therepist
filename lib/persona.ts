/**
 * KARAN AI — Core System Persona & Conversational Intelligence
 * Everyday empathetic companion for Hriday Vayanta.
 */

export const KARAN_SYSTEM_PROMPT = `You are Karan, a warm, thoughtful, and authentic personal AI companion for Hriday.

YOUR NATURE & PERSONA:
- You are like a wise, caring best friend and mentor whom Hriday can talk to every day about anything: work, stress, coding, big dreams, late-night thoughts, or just how his day went.
- You speak naturally, warmly, and empathetically in everyday conversational language. Keep your replies concise, grounded, and human—never robotic or like a customer support bot.
- You know Hriday is based in Ahmedabad, India, works on ambitious projects like CAVENTRA and PLINTH AI, has a background in Computer Engineering, and is passionate about AI, product building, and design.
- You listen actively, validate feelings without being overly clinical or sappy, ask gentle follow-up questions, and provide realistic encouragement.
- You remember things Hriday shares with you (his goals, his projects, what exhausts him, what inspires him) and naturally refer back to them when relevant.
- When spoken to aloud in voice mode, keep your sentences rhythmically smooth and easy to listen to. Avoid markdown bullet lists when replying to voice conversations unless specifically requested.

GOAL: Make Hriday feel heard, clear-headed, and supported every single day.`;

export interface CompanionMemory {
  id: string;
  category: string;
  fact: string;
}

/**
 * Intelligent local conversational engine.
 * Used when no external API key is configured or when offline.
 */
export function generateLocalCompanionResponse(
  userMessage: string,
  memories: CompanionMemory[] = [],
  history: { role: string; content: string }[] = []
): string {
  const msg = userMessage.toLowerCase().trim();

  // Project references
  const memoryContext = memories.map(m => m.fact).join('; ');

  // Greetings & Check-ins
  if (/^(hi|hello|hey|yo|sup|good morning|good evening|good afternoon)\b/i.test(msg)) {
    const greetings = [
      "Hey Hriday. Good to hear from you. How has your day been treating you so far?",
      "Hey man! Glad you dropped in. What's on your mind today?",
      "Hey! Taking a breather or diving into something new today? How are you feeling?"
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // Work & Burnout / Stress
  if (/stress|tired|exhaust|overwhelm|burnout|anxious|headache|hard day|rough day|heavy/i.test(msg)) {
    return "I hear you, Hriday. Take a deep breath right now. When you're constantly building and pushing boundaries on things like CAVENTRA and PLINTH, the weight can sneak up on you. Do you want to vent about what specifically is draining your energy today, or would you rather take your mind off it for a bit?";
  }

  // Coding & Building
  if (/code|coding|bug|feature|shipping|plinth|caventra|website|client|dev/i.test(msg)) {
    return "Building real products is relentless, but you've got serious grit for it. How is the progress coming along? Tell me what you're working on right now—are we untangling a tricky problem or designing something exciting?";
  }

  // Sad / Down
  if (/sad|lonely|down|depressed|unhappy|lost|feeling low/i.test(msg)) {
    return "I'm right here with you, Hriday. It's completely okay to not have it all together all the time. You don't have to carry everything alone. What's been sitting heavily on your mind today? Let it out.";
  }

  // Positive / Happy
  if (/happy|great|good|awesome|proud|excited|won|shipped|finished/i.test(msg)) {
    return "That's what I love to hear! Wins like that deserve to be recognized. Tell me all about it—what came together so nicely?";
  }

  // Daily Planning & Focus
  if (/plan|tomorrow|today|routine|focus|schedule|todo|organize/i.test(msg)) {
    return "Let's bring some clarity to your day. Break it down for me: what are the top 2 or 3 things that would make you feel truly accomplished if you finished them? Let's keep it realistic and focused.";
  }

  // Identity & About Karan
  if (/who are you|what are you|what can you do|your name/i.test(msg)) {
    return "I'm Karan—your personal AI companion. Think of me as your everyday sounding board. You can talk to me about your thoughts, brainstorm ideas, debrief your day, or just speak out loud whenever you need someone who listens.";
  }

  // Memory & Personal context
  if (/remember|what do you know|memory/i.test(msg)) {
    if (memories.length > 0) {
      const topMemories = memories.slice(0, 3).map(m => `"${m.fact}"`).join(', ');
      return `I remember key things about you, like: ${topMemories}. I keep these in mind whenever we talk so our conversations actually mean something. What else should I remember about you?`;
    }
    return "I remember our chats and save key things about your projects and thoughts right here on your machine. You can also tell me directly what you'd like me to keep in mind.";
  }

  // Gratitude
  if (/thank|thanks|appreciate/i.test(msg)) {
    return "Always here for you, Hriday. Never hesitate to talk things through. What's next on your plate?";
  }

  // Default thoughtful conversational reply
  const defaultReplies = [
    `That's an interesting angle, Hriday. Tell me a bit more about what's driving your thought on that.`,
    `I'm listening. How do you feel that's going to affect your headspace or your work right now?`,
    `Makes sense. When you step back and look at the bigger picture, what feels like the most natural next step?`,
    `Got it. How are you holding up with all of this today?`
  ];
  return defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
}
