(() => {
'use strict';
const products=window.ADM_PRODUCTS,Q=window.ADM_QUOTE,$=s=>document.querySelector(s),categories=['Todos','Artefatos','Meio-fio','Pisos/Pavers','Tubos','Serviços'];
const byId=id=>products.find(p=>p.id===id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let category='Todos',cart={},notes='',profile=null,timer,returnToCart=false;
const drafts={};
try {const saved=JSON.parse(localStorage.getItem('adm-orcamento-v2')||'null');if(saved){for(const item of Object.values(saved.cart||{})){const p=byId(item.id);if(p&&Q.allowed(p).includes(item.unit)&&Q.valid(item.quantity,item.unit))cart[item.id+':'+item.unit]=item;}}else{const old=JSON.parse(localStorage.getItem('adm-orcamento-v1')||'{}');for(const [id,quantity] of Object.entries(old.cart||{})){const p=byId(id);if(p){const unit=Q.allowed(p)[0];if(Q.valid(quantity,unit))cart[id+':'+unit]={id,unit,quantity};}}}}catch{}
try{const saved=JSON.parse(sessionStorage.getItem('adm-session-v2')||'{}');if(Q.profileValid(saved.profile))profile=saved.profile;notes=typeof saved.notes==='string'?saved.notes.slice(0,1200):'';}catch{}
function save(){try{localStorage.setItem('adm-orcamento-v2',JSON.stringify({cart}));}catch{}try{sessionStorage.setItem('adm-session-v2',JSON.stringify({profile,notes}));}catch{}}
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/×/g,'x').replace(/[^a-z0-9]/g,'');
function photo(p){return `<img src="assets/${encodeURIComponent(p.image)}" alt="Catálogo original: ${esc(p.name)}" loading="lazy" width="1122" height="1402">`;}
function controls(p,context='card'){const unit=drafts[p.id]?.unit||Q.allowed(p)[0],quantity=drafts[p.id]?.quantity||1;return `<form class="order-controls" data-order="${p.id}"><label class="unit-label" for="${context}-unit-${p.id}">Pedir por<select id="${context}-unit-${p.id}" name="unit" aria-label="Medida para ${p.name}">${Q.allowed(p).map(u=>`<option value="${u}" ${u===unit?'selected':''}>${Q.units[u].label}</option>`).join('')}</select></label><div class="order-action"><label for="${context}-qty-${p.id}">Quantidade<input id="${context}-qty-${p.id}" name="quantity" type="number" inputmode="${Q.units[unit].step===1?'numeric':'decimal'}" min="${Q.units[unit].step}" max="99999" step="${Q.units[unit].step}" value="${esc(quantity)}" required aria-label="Quantidade para ${p.name}"></label><button type="submit" class="button blue" aria-label="Adicionar ${p.name} à lista">+ Adicionar à lista</button></div></form>`;}
function renderProducts(){const q=normalize($('#search').value);const result=products.filter(p=>(category==='Todos'||p.category===category)&&normalize(p.name+' '+p.size+' '+p.category).includes(q));$('#clear-search').hidden=!q;$('#result-count').textContent=`${result.length} ${result.length===1?'item encontrado':'itens encontrados'}`;$('#empty-search').hidden=!!result.length;$('#products').innerHTML=result.map(p=>`<article class="product"><button class="product-visual" data-detail="${p.id}" aria-label="Ver detalhes de ${p.name}">${photo(p)}<span class="zoom-label">Ampliar ↗</span></button><div class="product-info"><span class="category">${p.category}</span><h3>${p.name}</h3><p class="measure">${p.size}</p><p class="price">Consulte o preço</p>${controls(p)}</div></article>`).join('');}
function filters(){$('#filters').innerHTML=categories.map(c=>`<button class="filter" data-category="${c}" aria-pressed="${c===category}">${c}</button>`).join('');}
function notify(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('#toast').classList.remove('show'),2800);}
function add(id,quantity,unit){const p=byId(id);if(!p||!Q.allowed(p).includes(unit)||!Q.valid(quantity,unit))throw Error('Quantidade ou medida inválida.');const key=id+':'+unit,total=Math.round(((cart[key]?.quantity||0)+quantity)*100)/100;if(!Q.valid(total,unit))throw Error('O limite por item é 99.999.');cart[key]={id,unit,quantity:total};save();renderCart();notify(`${Q.format(quantity)} ${Q.units[unit].short} adicionados à lista`);return cart[key];}
function checkout(){const ok=Q.profileValid(profile);$('#checkout').href=ok?'https://wa.me/5543998319629?text='+encodeURIComponent(Q.message(cart,products,profile,notes)):'#';$('#checkout').textContent=ok?'Finalizar orçamento no WhatsApp ↗':'Preencher dados para finalizar →';}
function renderProfile(){const p=profile;$('#customer-greeting').textContent=p?`${p.kind==='empresa'?p.company:p.name} · Entrega em ${p.city}/${p.state}`:'Vamos preparar o orçamento da sua obra?';$('#open-profile').textContent=p?'Meus dados ✓':'Meus dados';$('#delivery-summary').innerHTML=p?`<p class="eyebrow">DADOS E ENTREGA</p><strong>${esc(p.kind==='empresa'?p.company:p.name)}</strong><p>${esc(p.street)}, ${esc(p.number)}<br>${esc(p.district)} · ${esc(p.city)}/${esc(p.state)}</p>`:'<strong>Para quem é o orçamento?</strong><p>Informe seu contato e endereço de entrega.</p>';checkout();}
function renderCart(){const entries=Object.entries(cart);$('#cart-count').textContent=entries.length;$('#cart-form').hidden=!entries.length;$('#cart-items').innerHTML=entries.length?entries.map(([key,item])=>{const p=byId(item.id),u=Q.units[item.unit];return `<div class="cart-row"><div><h3>${p.name}</h3><p>${p.size} · ${u.label}<br>Consulte o preço</p><div class="quantity"><button data-minus="${key}" aria-label="Diminuir ${p.name} em ${u.label}">−</button><input type="number" inputmode="${u.step===1?'numeric':'decimal'}" min="${u.step}" max="99999" step="${u.step}" value="${item.quantity}" data-quantity="${key}" aria-label="Quantidade de ${p.name} em ${u.label}"><button data-plus="${key}" aria-label="Aumentar ${p.name} em ${u.label}">+</button><span>${u.short}</span></div></div><button class="remove" data-remove="${key}" aria-label="Remover ${p.name} em ${u.label}">Remover</button></div>`;}).join(''):'<div class="empty"><h3>Sua lista está vazia</h3><p>Escolha os produtos e serviços para começar.</p><button class="button navy" data-close="cart-dialog">Continuar no catálogo</button></div>';renderProfile();}
function detail(id){const p=byId(id);if(!p)return;$('#detail-content').innerHTML=photo(p)+`<p class="category">${p.category}</p><h2 id="detail-title">${p.name}</h2><p>${p.size}</p><strong>Consulte o preço</strong>${controls(p,'detail')}`;$('#detail-dialog').showModal();}
function step(two){$('#profile-step-one').hidden=two;$('#profile-step-two').hidden=!two;$('#profile-progress').textContent=two?'02 · ENDEREÇO DE ENTREGA':'01 · IDENTIFICAÇÃO';$('#profile-title').textContent=two?'Onde fica sua obra?':'Como podemos te atender?';$('#profile-dialog').scrollTop=0;}
function companyMode(){const company=$('#profile-form').elements.kind.value==='empresa';$('#company-field').hidden=!company;$('#company').disabled=!company;$('#company').required=company;$('#customer-name-label').textContent=company?'Nome do responsável':'Seu nome';}
function openProfile(){returnToCart=$('#cart-dialog').open;if(returnToCart)$('#cart-dialog').close();const f=$('#profile-form');f.reset();if(profile)for(const [k,v] of Object.entries(profile)){const field=f.elements.namedItem(k);if(!field)continue;if(field instanceof RadioNodeList){for(const el of field)el.checked=el.value===v;}else field.value=v;}companyMode();step(false);$('#profile-dialog').showModal();}
function validateStep(container){for(const input of container.querySelectorAll('input,select')){if(input.disabled)continue;if(input.type!=='radio')input.value=input.value.trim();input.setCustomValidity('');if(input.required&&!input.value.trim())input.setCustomValidity('Preencha este campo.');if(input.id==='customer-phone'&&!/^(?:55)?\d{10,11}$/.test(input.value.replace(/\D/g,'')))input.setCustomValidity('Informe o telefone com DDD, com 10 ou 11 dígitos.');if(input.id==='delivery-cep'&&input.value&&!/^\d{5}-?\d{3}$/.test(input.value))input.setCustomValidity('Informe um CEP com 8 dígitos.');if(!input.checkValidity()){input.reportValidity();return false;}}return true;}
$('#profile-next').onclick=()=>{if(validateStep($('#profile-step-one'))){step(true);$('#delivery-cep').focus();}};$('#profile-back').onclick=()=>step(false);
$('#profile-form').addEventListener('input',e=>{if(e.target.setCustomValidity)e.target.setCustomValidity('');});$('#profile-form').addEventListener('change',e=>{if(e.target.name==='kind')companyMode();});$('#profile-form').noValidate=true;
$('#profile-form').addEventListener('submit',e=>{e.preventDefault();if(!$('#profile-step-one').hidden){$('#profile-next').click();return;}if(!validateStep($('#profile-step-one'))){step(false);return;}if(!validateStep($('#profile-step-two')))return;profile=Object.fromEntries(new FormData(e.target).entries());for(const k in profile)profile[k]=profile[k].trim();save();renderProfile();$('#profile-dialog').close();notify('Dados e endereço salvos para este orçamento');});
$('#profile-dialog').addEventListener('close',()=>{if(returnToCart){returnToCart=false;$('#cart-dialog').showModal();}});
document.addEventListener('submit',e=>{const form=e.target.closest('[data-order]');if(!form)return;e.preventDefault();try{add(form.dataset.order,Number(form.elements.quantity.value),form.elements.unit.value);}catch(error){notify(error.message);}});
document.addEventListener('input',e=>{const form=e.target.closest('[data-order]');if(form)drafts[form.dataset.order]={quantity:form.elements.quantity.value,unit:form.elements.unit.value};});
document.addEventListener('change',e=>{const form=e.target.closest('[data-order]');if(form&&e.target.name==='unit'){const q=form.elements.quantity,u=Q.units[e.target.value];q.step=u.step;q.min=u.step;q.inputMode=u.step===1?'numeric':'decimal';if(!Q.valid(Number(q.value),e.target.value))q.value=1;drafts[form.dataset.order]={quantity:q.value,unit:e.target.value};}});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;if(d.category){category=d.category;filters();renderProducts();}if(d.detail)detail(d.detail);if('profile'in d)openProfile();if(d.close)document.getElementById(d.close).close();if(d.remove){delete cart[d.remove];save();renderCart();}if(d.minus||d.plus){const key=d.minus||d.plus,item=cart[key],step=Q.units[item.unit].step;item.quantity=Math.round(Math.max(step,Math.min(99999,item.quantity+(d.plus?1:-1)))*100)/100;save();renderCart();}});
$('#cart-items').addEventListener('input',e=>{const key=e.target.dataset.quantity;if(!key)return;const item=cart[key],value=Number(e.target.value);if(Q.valid(value,item.unit)){item.quantity=value;save();checkout();}});
$('#cart-items').addEventListener('change',e=>{const key=e.target.dataset.quantity;if(!key)return;const item=cart[key];if(!Q.valid(Number(e.target.value),item.unit)){e.target.value=item.quantity;notify('Informe uma quantidade válida para a medida escolhida.');}});
$('#search').addEventListener('input',renderProducts);$('#clear-search').onclick=()=>{$('#search').value='';renderProducts();$('#search').focus();};$('#reset-search').onclick=()=>{category='Todos';$('#search').value='';filters();renderProducts();};$('#open-cart').onclick=()=>$('#cart-dialog').showModal();$('#open-profile').onclick=openProfile;$('#notes').value=notes;$('#notes').addEventListener('input',e=>{notes=e.target.value;save();checkout();});$('#checkout').addEventListener('click',e=>{if(!Q.profileValid(profile)){e.preventDefault();openProfile();}});
for(const dialog of document.querySelectorAll('dialog:not(#profile-dialog)'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
filters();renderProducts();renderCart();openProfile();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'stage_quote_item',description:'Adiciona quantidade e medida à lista local. Não envia o orçamento.',inputSchema:{type:'object',properties:{productId:{type:'string',enum:products.map(p=>p.id)},quantity:{type:'number',exclusiveMinimum:0,maximum:99999},unit:{type:'string',enum:Object.keys(Q.units)}},required:['productId','quantity','unit'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input)throw Error('Dados inválidos');return add(input.productId,input.quantity,input.unit);}})).catch(()=>{});}catch{}}
})();


// CPF/CNPJ do orçamento
(() => {
 const form=document.getElementById('profile-form'), doc=document.getElementById('customer-document');
 if(!form||!doc)return;
 const label=document.getElementById('document-label'),help=document.getElementById('document-help');
 const d=v=>v.replace(/\D/g,'');
 const cpf=v=>{v=d(v).slice(0,11);return v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')};
 const cnpj=v=>{v=d(v).slice(0,14);return v.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2')};
 const update=()=>{const emp=form.querySelector('[name=kind]:checked')?.value==='empresa';label.textContent=emp?'CNPJ':'CPF';help.textContent=emp?'Informe o CNPJ para identificação do orçamento.':'Informe o CPF para identificação do orçamento.';doc.placeholder=emp?'00.000.000/0000-00':'000.000.000-00';doc.maxLength=emp?18:14;doc.value=emp?cnpj(doc.value):cpf(doc.value)};
 form.querySelectorAll('[name=kind]').forEach(x=>x.addEventListener('change',()=>{doc.value='';update()}));
 doc.addEventListener('input',()=>{doc.value=form.querySelector('[name=kind]:checked')?.value==='empresa'?cnpj(doc.value):cpf(doc.value)});
 update();
})();




// V3.1 — validação matemática completa de CPF e CNPJ
(() => {
  const digits = v => String(v || '').replace(/\D/g, '');

  function validCPF(value) {
    const cpf = digits(value);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
    let d1 = (sum * 10) % 11;
    if (d1 === 10) d1 = 0;
    if (d1 !== Number(cpf[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
    let d2 = (sum * 10) % 11;
    if (d2 === 10) d2 = 0;
    return d2 === Number(cpf[10]);
  }

  function validCNPJ(value) {
    const cnpj = digits(value);
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    const calc = base => {
      let factor = base.length - 7, total = 0;
      for (const n of base) {
        total += Number(n) * factor--;
        if (factor < 2) factor = 9;
      }
      const r = total % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const d1 = calc(cnpj.slice(0, 12));
    const d2 = calc(cnpj.slice(0, 12) + d1);
    return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
  }

  const form = document.getElementById('profile-form');
  const input = document.getElementById('customer-document');
  const error = document.getElementById('document-error');
  const label = document.getElementById('document-label');
  const help = document.getElementById('document-help');
  if (!form || !input) return;

  const isCompany = () =>
    document.querySelector('input[name="kind"]:checked')?.value === 'empresa';

  function check(show = true) {
    const company = isCompany();
    const raw = digits(input.value);
    const ok = company ? validCNPJ(raw) : validCPF(raw);
    input.setCustomValidity(ok ? '' : (company ? 'CNPJ inválido.' : 'CPF inválido.'));
    input.classList.toggle('invalid-document', !ok && raw.length > 0);
    if (error) {
      error.textContent = company ? 'CNPJ inválido. Confira os números informados.' : 'CPF inválido. Confira os números informados.';
      error.hidden = !show || ok || raw.length === 0;
    }
    return ok;
  }

  function refreshType() {
    const company = isCompany();
    if (label) label.textContent = company ? 'CNPJ' : 'CPF';
    if (help) help.textContent = company
      ? 'Informe o CNPJ. A validação é feita antes de continuar.'
      : 'Informe o CPF. A validação é feita antes de continuar.';
    const nameLabel=document.getElementById('customer-name-label');
    const nameInput=document.getElementById('customer-name');
    if(nameLabel) nameLabel.textContent=company?'Nome do responsável':'Nome completo';
    if(nameInput) nameInput.placeholder=company?'Nome do responsável pelo orçamento':'Seu nome completo';
    check(false);
  }

  input.addEventListener('blur', () => check(true));
  input.addEventListener('input', () => {
    input.setCustomValidity('');
    input.classList.remove('invalid-document');
    if (error) error.hidden = true;
  });
  document.querySelectorAll('input[name="kind"]').forEach(el => el.addEventListener('change', refreshType));

  // Captura antes dos demais listeners: impede salvar/avançar com documento inválido.
  form.addEventListener('submit', e => {
    if (!check(true)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      input.reportValidity();
      input.focus();
    }
  }, true);

  window.ADMDocumentValidator = { validCPF, validCNPJ };
  refreshType();
  try{
    const saved=JSON.parse(sessionStorage.getItem('adm-session-v2')||'{}');
    if(saved.profile && !window.ADM_QUOTE.profileValid(saved.profile)){
      sessionStorage.removeItem('adm-session-v2');
    }
  }catch{}
})();


// V4.2 — consulta segura de CPF via Cloudflare Pages Function
(() => {
 const btn=document.getElementById('consult-cpf');
 const status=document.getElementById('cpf-lookup-status');
 const doc=document.getElementById('customer-document');
 const name=document.getElementById('customer-name');
 const box=document.getElementById('cpf-lookup');
 if(!btn||!doc||!name)return;

 const digits=v=>String(v||'').replace(/\D/g,'');
 const isCompany=()=>document.querySelector('input[name="kind"]:checked')?.value==='empresa';

 function sync(){
   if(box) box.hidden=isCompany();
   if(status) status.textContent='';
 }
 document.querySelectorAll('input[name="kind"]').forEach(x=>x.addEventListener('change',sync));
 sync();

 btn.addEventListener('click',async()=>{
   const cpf=digits(doc.value);
   const validator=window.ADMDocumentValidator;
   if(cpf.length!==11 || (validator && !validator.validCPF(cpf))){
     status.textContent='Informe um CPF válido primeiro.';
     status.dataset.state='error';
     doc.focus();
     return;
   }
   btn.disabled=true;
   status.textContent='Consultando…';
   status.dataset.state='loading';
   try{
     const r=await fetch('/api/consultar-cpf?cpf='+encodeURIComponent(cpf),{
       method:'GET',
       headers:{'Accept':'application/json'}
     });
     const data=await r.json().catch(()=>({}));
     if(!r.ok || !data.success || !data.name) throw new Error(data.message||'Não foi possível consultar o CPF.');
     name.value=data.name;
     name.dispatchEvent(new Event('input',{bubbles:true}));
     status.textContent='CPF localizado. Nome preenchido ✓';
     status.dataset.state='success';
   }catch(e){
     status.textContent=e.message||'Consulta indisponível. Digite o nome manualmente.';
     status.dataset.state='error';
   }finally{
     btn.disabled=false;
   }
 });
})();
