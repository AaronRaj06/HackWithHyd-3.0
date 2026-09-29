import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#090b12', fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{
        width: '100%', maxWidth: '420px', margin: '0 16px',
        background: 'linear-gradient(145deg, hsl(232 29% 11%), hsl(232 29% 8%))',
        border: '1px solid hsl(223 22% 18%)', borderRadius: '16px', padding: '32px',
        boxShadow: '0 22px 80px hsl(231 45% 3% / .18)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <AlertCircle size={28} color="#ff716e" />
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e2ea', margin: 0 }}>404 Page Not Found</h1>
        </div>
        <p style={{ fontSize: '14px', color: '#8b8da3', margin: 0 }}>
          Did you forget to add the page to the router?
        </p>
      </div>
    </div>
  );
}
