import { NextResponse } from 'next/server';

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const group = searchParams.get('group') || 'All';

    // Forward the delete request to your Express backend running on port 5001
    const backendRes = await fetch(`http://localhost:5001/api/contacts/group/all?group=${encodeURIComponent(group)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json({ error: data.error || 'Failed to delete group contacts.' }, { status: backendRes.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Group delete proxy error:', err);
    return NextResponse.json({ error: 'Backend service unavailable.' }, { status: 500 });
  }
}