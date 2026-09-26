function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function validCPF(value) {
  const cpf = String(value || "").replace(/\D/g, "");
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
  const cnpj = String(value || "").replace(/\D/g, "");
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

async function consultarCNPJ(request) {
  const url = new URL(request.url);
  const cnpj = (url.searchParams.get("cnpj") || "").replace(/\D/g, "");
  if (!validCNPJ(cnpj)) return json({ success:false, message:"CNPJ inválido." }, 400);
  try {
    const upstream = await fetch("https://brasilapi.com.br/api/cnpj/v1/" + encodeURIComponent(cnpj), {
      headers: { "accept":"application/json" }
    });
    const body = await upstream.json().catch(() => null);
    if (!upstream.ok || !body) {
      const message = upstream.status === 404 ? "CNPJ não encontrado." : "Não foi possível consultar o CNPJ agora.";
      return json({ success:false, message }, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502);
    }
    return json({
      success:true,
      razao_social: body.razao_social || "",
      nome_fantasia: body.nome_fantasia || "",
      municipio: body.municipio || "",
      uf: body.uf || "",
      cep: body.cep || ""
    });
  } catch {
    return json({ success:false, message:"Consulta de CNPJ indisponível. Preencha os dados manualmente." }, 502);
  }
}

async function consultarCPF(request, env) {
  const url = new URL(request.url);
  const cpf = (url.searchParams.get("cpf") || "").replace(/\D/g, "");
  if (!validCPF(cpf)) return json({ success:false, message:"CPF inválido." }, 400);
  if (!env.CPFHUB_API_KEY) return json({ success:false, message:"Consulta de CPF ainda não foi configurada." }, 503);

  try {
    const upstream = await fetch("https://api.cpfhub.io/cpf/" + encodeURIComponent(cpf), {
      headers: { "x-api-key": env.CPFHUB_API_KEY, "accept":"application/json" }
    });
    const body = await upstream.json().catch(() => null);

    if (!upstream.ok || !body?.success || !body?.data?.name) {
      const message =
        upstream.status === 429 ? "Limite temporário de consultas atingido." :
        upstream.status === 401 ? "Credencial da consulta inválida." :
        body?.error?.message || (typeof body?.error === "string" ? body.error : null) ||
        "CPF não localizado.";
      return json({ success:false, message }, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502);
    }
    return json({ success:true, name:body.data.name });
  } catch {
    return json({ success:false, message:"Serviço de consulta indisponível. Digite o nome manualmente." }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/consultar-cpf") {
      return consultarCPF(request, env);
    }
    if (request.method === "GET" && url.pathname === "/api/consultar-cnpj") {
      return consultarCNPJ(request);
    }
    return env.ASSETS.fetch(request);
  }
};
