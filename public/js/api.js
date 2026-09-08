const API = {
  token() { return localStorage.getItem('sd_token'); },
  user() { try { return JSON.parse(localStorage.getItem('sd_user')); } catch { return null; } },

  async request(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token()) headers['Authorization'] = 'Bearer ' + this.token();
    const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  requireAuth() { if (!this.token()) window.location.href = '/login.html'; },
  requireAdmin() {
    const u = this.user();
    if (!this.token() || !u || u.role !== 'ADMIN') window.location.href = '/login.html';
  },
  requireStaff() {
    const u = this.user();
    if (!this.token() || !u || (u.role !== 'ADMIN' && u.role !== 'RESPONDER')) window.location.href = '/login.html';
  },
  logout() {
    localStorage.removeItem('sd_token');
    localStorage.removeItem('sd_user');
    window.location.href = '/login.html';
  },
};

function riskColor(level) {
  return { VERY_LOW: '#34D399', LOW: '#34D399', MEDIUM: '#FBBF24', HIGH: '#FB7A3C', CRITICAL: '#FF5A3C' }[level] || '#4FA3FF';
}