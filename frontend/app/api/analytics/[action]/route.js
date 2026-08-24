import { NextResponse } from 'next/server';
import axios from 'axios';

const BACKEND_URL = 'http://localhost:5001/api/analytics';

export async function GET(request, { params }) {
  const { action } = await params;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const targetUrl = url.searchParams.get('url');

  try {
    if (action === 'open') {
      // Forward open tracking to backend
      await axios.get(`${BACKEND_URL}/open/${id}`);
      // Return 1x1 transparent tracking GIF
      const gifBuffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      return new NextResponse(gifBuffer, {
        headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, max-age=0' }
      });
    }

    if (action === 'click') {
      // Forward click tracking to backend
      await axios.get(`http://localhost:5001/api/analytics/click/${id}`);
      // Redirect user to their actual intended destination URL
      return NextResponse.redirect(targetUrl || 'http://localhost:5001');
    }

    if (action === 'unsubscribe') {
      // Forward unsubscribe request to backend
      await axios.get(`${BACKEND_URL}/unsubscribe/${id}`);
      return NextResponse.html(`<!DOCTYPE html><html><body style="font-family:sans-serif; text-align:center; padding-top:60px;"><h2>Successfully Unsubscribed</h2><p>You will no longer receive emails from this list.</p></body></html>`);
    }

    return NextResponse.json({ error: 'Invalid tracking action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}