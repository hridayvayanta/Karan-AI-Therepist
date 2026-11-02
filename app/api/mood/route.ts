import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const moods = await prisma.moodCheckin.findMany({
      orderBy: { createdAt: 'desc' },
      take: 14,
    });
    return NextResponse.json(moods);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { score, notes, tags } = await req.json();
    if (typeof score !== 'number' || score < 1 || score > 10) {
      return NextResponse.json({ error: 'Score must be between 1 and 10' }, { status: 400 });
    }

    const checkin = await prisma.moodCheckin.create({
      data: {
        score,
        notes: notes || '',
        tags: tags || '',
      },
    });

    return NextResponse.json(checkin);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
