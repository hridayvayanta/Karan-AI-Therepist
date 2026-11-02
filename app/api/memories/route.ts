import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const memories = await prisma.memory.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(memories);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { fact, category } = await req.json();
    if (!fact) {
      return NextResponse.json({ error: 'Fact is required' }, { status: 400 });
    }

    const memory = await prisma.memory.create({
      data: {
        fact: fact.trim(),
        category: category || 'general',
      },
    });

    return NextResponse.json(memory);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.memory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
