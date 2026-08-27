import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    // Default Fallback Admin Credentials
    if (email.trim().toLowerCase() === 'abhishek.banerjee@ibcstudio.com' && password === 'abhishek123') {
      return NextResponse.json({
        success: true,
        message: 'Login successful!',
        user: { email: 'abhishek.banerjee@ibcstudio.com', name: 'Abhishek Banerjee' }
      });
    }

    // Forward request to Express backend on port 5001
    const backendRes = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json({ error: data.error || 'Invalid email or password.' }, { status: backendRes.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Auth proxy error:', err);
    return NextResponse.json({ error: 'Authentication service unavailable.' }, { status: 500 });
  }
}