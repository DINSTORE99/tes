(async function(){
  function el(id) { return document.getElementById(id); }
  async function loadUsers(){ const res = await fetch('/api/admin/users'); const data = await res.json(); document.getElementById('users').innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`; }
  async function loadTopups(){ const res = await fetch('/api/admin/topups'); const data = await res.json(); document.getElementById('topups').innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`; }
  async function loadOrders(){ const res = await fetch('/api/admin/orders'); const data = await res.json(); document.getElementById('orders').innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`; }
  await loadUsers(); await loadTopups(); await loadOrders();
})();
