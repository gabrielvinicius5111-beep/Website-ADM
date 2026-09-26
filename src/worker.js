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
    return env.ASSETS.fetch(request);
  }
};
