import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { askKaran } from '@/lib/ai';

export async function POST(req: NextRequest) {
  try {
    const { message, conversationId } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Find or create conversation
    let convId = conversationId;
    if (!convId) {
      const newConv = await prisma.conversation.create({
        data: {
          title: message.slice(0, 32) + '...',
        },
      });
      convId = newConv.id;
    }

    // 2. Fetch past memories from SQLite
    const memories = await prisma.memory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    // 3. Fetch recent message history
    const pastMessages = await prisma.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    const history = pastMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // 4. Save User message to SQLite
    await prisma.message.create({
      data: {
        conversationId: convId,
        role: 'user',
        content: message,
      },
    });

    // 5. Ask Karan
    const reply = await askKaran(message, memories, history);

    // 6. Save Karan's reply to SQLite
    await prisma.message.create({
      data: {
        conversationId: convId,
        role: 'assistant',
        content: reply,
      },
    });

    // 7. Auto-detect personal memories to save in background
    const lower = message.toLowerCase();
    if (
      lower.includes('i love') ||
      lower.includes('i like') ||
      lower.includes('my goal') ||
      lower.includes('working on') ||
      lower.includes('i am feeling') ||
      lower.includes('i hate') ||
      lower.includes('my project')
    ) {
      try {
        await prisma.memory.create({
          data: {
            category: lower.includes('goal') ? 'goal' : lower.includes('project') ? 'project' : 'preference',
            fact: message.length > 120 ? message.slice(0, 120) + '...' : message,
          },
        });
      } catch (e) {
        // ignore memory save error
      }
    }

    return NextResponse.json({
      reply,
      conversationId: convId,
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversationId');

    if (!conversationId) {
      // Return latest conversation or empty
      const latestConv = await prisma.conversation.findFirst({
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 50,
          },
        },
      });
      return NextResponse.json(latestConv || { messages: [] });
    }

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
    });

    return NextResponse.json(conv || { messages: [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
