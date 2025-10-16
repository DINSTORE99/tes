(async function(){
  const plansEl = document.getElementById('plans');
  const selectedPlan = document.getElementById('selectedPlan');
  const emailEl = document.getElementById('email');
  const userInfo = document.getElementById('userInfo');
  const logEl = document.getElementById('log');
  const topupAmount = document.getElementById('topupAmount');
  const topupResult = document.getElementById('topupResult');

  function log(msg){
    const t = new Date().toLocaleString();
    logEl.textContent = `[${t}] ${msg}\n` + logEl.textContent;
  }

  async function loadPlans(){
    try{
      const res = await fetch('/api/plans');
      const plans = await res.json();
      plansEl.innerHTML = '';
      selectedPlan.innerHTML = '';
      plans.forEach(p => {
        const node = document.createElement('div');
        node.className = 'plan';
        node.innerHTML = `<strong>${p.name}</strong><div>Rp ${p.price.toLocaleString()}</div><div>Type: ${p.type}</div>`;
        plansEl.appendChild(node);

        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} — Rp ${p.price}`;
        selectedPlan.appendChild(opt);
      });
      log('Paket dimuat');
    }catch(err){
      log('Gagal memuat paket: ' + err.message);
    }
  }

  async function loadUser(){
    const email = emailEl.value.trim();
    if(!email) return alert('Masukkan email');
    try{
      const res = await fetch('/api/user?email='+encodeURIComponent(email));
      const user = await res.json();
      userInfo.textContent = `Saldo: Rp ${user.balance} | ID: ${user.id}`;
      log('User dimuat: ' + user.email + ' (Saldo: ' + user.balance + ')');
    }catch(err){ log('Gagal muat user: ' + err.message); }
  }

  document.getElementById('loadUser').addEventListener('click', loadUser);

  document.getElementById('createTopup').addEventListener('click', async ()=>{
    const email = emailEl.value.trim();
    const amount = Number(topupAmount.value.trim());
    if(!email || !amount) return alert('Isi email dan jumlah topup');
    try{
      const res = await fetch('/api/topup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, amount }) });
      const data = await res.json();
      if(res.ok){
        topupResult.innerHTML = `<div>Invoice dibuat: ${data.invoice.id} — <a href="${data.paymentLink}" target="_blank">Buka link pembayaran simulasi</a><br/>Catatan: ${data.note}</div>`;
        log('Invoice topup dibuat: ' + data.invoice.id);
      }else{
        log('Gagal buat invoice: ' + JSON.stringify(data));
      }
    }catch(err){ log('Error topup: ' + err.message); }
  });

  document.getElementById('buyBtn').addEventListener('click', async ()=>{
    const email = emailEl.value.trim();
    const planId = selectedPlan.value;
    if(!email) return alert('Masukkan email');
    try{
      const res = await fetch('/api/buy', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, planId, useBalance: true }) });
      const data = await res.json();
      if(res.ok){
        log('Pembelian berhasil — order id: ' + data.order.id);
        log('Provider response: ' + JSON.stringify(data.order.providerResponse));
        await loadUser();
      } else {
        log('Gagal beli: ' + (data.error || JSON.stringify(data)) );
      }
    }catch(err){ log('Error beli: ' + err.message); }
  });

  await loadPlans();
})();
