import { NextResponse } from 'next/server';
import { cekAdmin } from '../../../../lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Dipakai halaman admin untuk memastikan kata sandi benar.
export async function POST(request) {
  if (!cekAdmin(request)) {
    await new Promise((r) => setTimeout(r, 800)); // memperlambat tebak-tebakan sandi
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
