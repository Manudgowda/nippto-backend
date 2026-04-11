const API = 'https://nippto-backend-production.up.railway.app/api';

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(page).classList.add('active');
  event.target.classList.add('active');
  if (page === 'rides') loadRides();
  if (page === 'drivers') loadDrivers();
  if (page === 'users') loadUsers();
}

function badge(status) {
  return `<span class="badge badge-${status}">${status}</span>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

async function loadDashboard() {
  try {
    const [ridesRes, usersRes, driversRes] = await Promise.all([
      fetch(`${API}/admin/rides`),
      fetch(`${API}/admin/users`),
      fetch(`${API}/admin/drivers`)
    ]);

    const ridesData = await ridesRes.json();
    const usersData = await usersRes.json();
    const driversData = await driversRes.json();

    const rides = ridesData.rides || [];
    const users = usersData.users || [];
    const drivers = driversData.drivers || [];

    document.getElementById('total-rides').textContent = rides.length;
    document.getElementById('total-users').textContent = users.length;
    document.getElementById('total-drivers').textContent = drivers.length;

    const revenue = rides
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => sum + parseFloat(r.fare || 0), 0);
    document.getElementById('total-revenue').textContent = '₹' + revenue.toFixed(2);

    const tbody = document.getElementById('recent-rides-table');
    const recent = rides.slice(0, 10);
    tbody.innerHTML = recent.length === 0
      ? '<tr><td colspan="6" style="text-align:center;color:#888">No rides found</td></tr>'
      : recent.map(r => `
        <tr>
          <td style="font-family:monospace;font-size:12px">${r.id.substring(0, 8)}...</td>
          <td>${r.pickup_address || '-'}</td>
          <td>${r.drop_address || '-'}</td>
          <td>₹${r.fare || '0'}</td>
          <td>${badge(r.status)}</td>
          <td>${formatDate(r.created_at)}</td>
        </tr>
      `).join('');

  } catch (err) {
    console.error('Dashboard error:', err);
    document.getElementById('total-rides').textContent = 'Error';
    document.getElementById('total-users').textContent = 'Error';
    document.getElementById('total-drivers').textContent = 'Error';
    document.getElementById('total-revenue').textContent = 'Error';
  }
}

async function loadRides() {
  try {
    const tbody = document.getElementById('rides-table');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888">Loading...</td></tr>';

    const res = await fetch(`${API}/admin/rides`);
    const data = await res.json();
    const rides = data.rides || [];

    tbody.innerHTML = rides.length === 0
      ? '<tr><td colspan="7" style="text-align:center;color:#888">No rides found</td></tr>'
      : rides.map(r => `
        <tr>
          <td style="font-family:monospace;font-size:12px">${r.id.substring(0, 8)}...</td>
          <td>${r.pickup_address || '-'}</td>
          <td>${r.drop_address || '-'}</td>
          <td>${r.vehicle_type || '-'}</td>
          <td>₹${r.fare || '0'}</td>
          <td>${badge(r.status)}</td>
          <td>${formatDate(r.created_at)}</td>
        </tr>
      `).join('');
  } catch (err) {
    document.getElementById('rides-table').innerHTML =
      '<tr><td colspan="7" style="text-align:center;color:red">❌ Failed to load rides</td></tr>';
  }
}

async function loadDrivers() {
  try {
    const tbody = document.getElementById('drivers-table');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888">Loading...</td></tr>';

    const res = await fetch(`${API}/admin/drivers`);
    const data = await res.json();
    const drivers = data.drivers || [];

    tbody.innerHTML = drivers.length === 0
      ? '<tr><td colspan="7" style="text-align:center;color:#888">No drivers found</td></tr>'
      : drivers.map(d => `
        <tr>
          <td>${d.name || 'N/A'}</td>
          <td>${d.phone}</td>
          <td>${d.vehicle_type || 'N/A'}</td>
          <td>${badge(d.is_online ? 'online' : 'offline')}</td>
          <td>⭐ ${d.rating || '5.0'}</td>
          <td>${d.total_rides || 0}</td>
          <td>
            ${!d.is_verified
              ? `<button onclick="verifyDriver('${d.id}')"
                   style="background:#2ECC71;color:white;border:none;
                          padding:6px 12px;border-radius:6px;cursor:pointer;
                          font-size:12px;font-weight:600">
                   ✓ Verify
                 </button>`
              : `<span style="color:#2ECC71;font-weight:600;font-size:12px">✅ Verified</span>`
            }
            <button onclick="banDriver('${d.id}')"
              style="background:#e74c3c;color:white;border:none;
                     padding:6px 12px;border-radius:6px;cursor:pointer;
                     font-size:12px;font-weight:600;margin-left:4px">
              🚫 Ban
            </button>
          </td>
        </tr>
      `).join('');
  } catch (err) {
    document.getElementById('drivers-table').innerHTML =
      '<tr><td colspan="7" style="text-align:center;color:red">❌ Failed to load drivers</td></tr>';
  }
}

async function verifyDriver(driverId) {
  try {
    const res = await fetch(`${API}/admin/drivers/${driverId}/verify`, { method: 'PUT' });
    const data = await res.json();
    if (data.success) {
      alert('✅ Driver verified successfully!');
      loadDrivers();
    } else {
      alert('❌ Failed: ' + data.message);
    }
  } catch (err) {
    alert('❌ Error verifying driver');
  }
}

async function loadUsers() {
  try {
    const tbody = document.getElementById('users-table');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888">Loading...</td></tr>';

    const res = await fetch(`${API}/admin/users`);
    const data = await res.json();
    const users = data.users || [];

    tbody.innerHTML = users.length === 0
      ? '<tr><td colspan="6" style="text-align:center;color:#888">No users found</td></tr>'
      : users.map(u => `
        <tr>
          <td>${u.name || 'N/A'}</td>
          <td>${u.phone}</td>
          <td>${u.email || 'N/A'}</td>
          <td>${badge(u.is_active ? 'active' : 'banned')}</td>
          <td>${formatDate(u.created_at)}</td>
          <td>
            ${u.is_active
              ? `<button onclick="banUser('${u.id}')"
                   style="background:#e74c3c;color:white;border:none;
                          padding:6px 12px;border-radius:6px;cursor:pointer;
                          font-size:12px;font-weight:600">
                   🚫 Ban
                 </button>`
              : `<span style="color:#e74c3c;font-weight:600;font-size:12px">🚫 Banned</span>`
            }
          </td>
        </tr>
      `).join('');
  } catch (err) {
    document.getElementById('users-table').innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:red">❌ Failed to load users</td></tr>';
  }
}

async function banUser(userId) {
  if (!window.confirm('Are you sure you want to ban this user?')) return;
  try {
    const res = await fetch(`${API}/admin/users/${userId}/ban`, { method: 'PUT' });
    const data = await res.json();
    if (data.success) {
      alert('🚫 User banned successfully');
      loadUsers();
    } else {
      alert('❌ Failed: ' + data.message);
    }
  } catch (err) {
    alert('❌ Error banning user');
  }
}

async function banDriver(driverId) {
  if (!window.confirm('Are you sure you want to ban this driver?')) return;
  try {
    const res = await fetch(`${API}/admin/drivers/${driverId}/ban`, { method: 'PUT' });
    const data = await res.json();
    if (data.success) {
      alert('🚫 Driver banned successfully');
      loadDrivers();
    } else {
      alert('❌ Failed: ' + data.message);
    }
  } catch (err) {
    alert('❌ Error banning driver');
  }
}

loadDashboard();