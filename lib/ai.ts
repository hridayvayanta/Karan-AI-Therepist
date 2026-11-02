import { GoogleGenerativeAI } from '@google/generative-ai';
import { KARAN_SYSTEM_PROMPT, CompanionMemory, generateLocalCompanionResponse } from './persona';

export async function askKaran(
  userMessage: string,
  memories: CompanionMemory[] = [],
  history: { role: string; content: string }[] = []
): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // Build context from memories
  let memoryPrompt = '';
  if (memories.length > 0) {
    memoryPrompt = `\n\nTHINGS YOU REMEMBER ABOUT HRIDAY:\n` + memories.map(m => `- [${m.category}] ${m.fact}`).join('\n');
  }

  const fullSystemInstruction = KARAN_SYSTEM_PROMPT + memoryPrompt;

  // 1. Try Google Gemini API (100% Free Tier)
  if (geminiKey && geminiKey.trim() !== '') {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: fullSystemInstruction,
      });

      // Format history for Gemini
      const contents = history.slice(-6).map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      }));

      contents.push({
        role: 'user',
        parts: [{ text: userMessage }],
      });

      const response = await model.generateContent({ contents });
      const text = response.response.text();
      if (text && text.trim()) {
        return text.trim();
      }
    } catch (err: any) {
      console.warn('Gemini API call failed, falling back to local companion brain:', err.message);
    }
  }

  // 2. Try Groq Free Tier (Llama 3)
  if (groqKey && groqKey.trim() !== '') {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: fullSystemInstruction },
            ...history.slice(-6),
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 600
        })
      });
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        return content.trim();
      }
    } catch (err: any) {
      console.warn('Groq API call failed:', err.message);
    }
  }

  // 3. Fallback to intelligent local conversational brain (Zero cost, Zero keys)
  return generateLocalCompanionResponse(userMessage, memories, history);
}
