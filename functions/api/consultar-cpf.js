function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store",
      "x-content-type-options":"nosniff"
    }
  });
}

function validCPF(value){
  const cpf=String(value||"").replace(/\D/g,"");
  if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf)) return false;
  let sum=0;
  for(let i=0;i<9;i++) sum+=Number(cpf[i])*(10-i);
  let d1=(sum*10)%11;if(d1===10)d1=0;
  if(d1!==Number(cpf[9]))return false;
  sum=0;
  for(let i=0;i<10;i++)sum+=Number(cpf[i])*(11-i);
  let d2=(sum*10)%11;if(d2===10)d2=0;
  return d2===Number(cpf[10]);
}

export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const cpf=(url.searchParams.get("cpf")||"").replace(/\D/g,"");
  if(!validCPF(cpf)) return json({success:false,message:"CPF inválido."},400);
  if(!context.env.CPFHUB_API_KEY) return json({success:false,message:"Consulta de CPF ainda não foi configurada."},503);

  try{
    const upstream=await fetch("https://api.cpfhub.io/cpf/"+encodeURIComponent(cpf),{
      headers:{
        "x-api-key":context.env.CPFHUB_API_KEY,
        "accept":"application/json"
      }
    });
    const body=await upstream.json().catch(()=>null);
    if(!upstream.ok || !body?.success || !body?.data?.name){
      const msg=upstream.status===429 ? "Limite temporário de consultas atingido."
        : upstream.status===401 ? "Credencial da consulta inválida."
        : body?.error?.message || (typeof body?.error==="string"?body.error:null) || "CPF não localizado.";
      return json({success:false,message:msg},upstream.status>=400&&upstream.status<600?upstream.status:502);
    }
    // Minimização: o navegador recebe somente o nome necessário ao orçamento.
    return json({success:true,name:body.data.name},200);
  }catch{
    return json({success:false,message:"Serviço de consulta indisponível. Digite o nome manualmente."},502);
  }
}
