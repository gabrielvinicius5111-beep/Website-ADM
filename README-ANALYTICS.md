# ADM Site V4.7 — painel privado

Base: Website-ADM, revisão a37e8d8 baixada em 28/09/2026. Todos os arquivos públicos, formulários, logos e fotos foram preservados. Nenhuma credencial real está incluída. Esta versão foi testada localmente; a publicação e a validação na sua conta Cloudflare dependem da configuração abaixo.

## 1. Preparar o banco Cloudflare D1

No computador, instale Node.js LTS. Abra um terminal na pasta que contém package.json e execute:

```sh
npm install
npx wrangler login
npx wrangler d1 create adm-analytics
```

Copie o `database_id` retornado para `wrangler.jsonc`, substituindo `SUBSTITUA_PELO_ID_DO_D1`. Preserve o binding `ANALYTICS_DB`. O ID do banco não é uma senha e pode ficar no GitHub.

Crie as tabelas antes de publicar:

```sh
npx wrangler d1 migrations apply ANALYTICS_DB --remote
```

Alternativa pelo painel Cloudflare: crie um banco D1 chamado `adm-analytics`, execute o conteúdo de `migrations/0001_analytics.sql` no console SQL desse banco e copie seu ID para `wrangler.jsonc`. O arquivo configura o binding no deploy.

## 2. Cadastrar secrets

Em Workers & Pages → seu Worker `adm-artefatos` → Settings → Variables and Secrets, adicione como **Secret**:

| Nome | Valor |
|---|---|
| `ADMIN_USERNAME` | Seu usuário, por exemplo `admin`. Use letras/números ASCII, sem dois-pontos. |
| `ADMIN_PASSWORD` | Senha aleatória exclusiva com pelo menos 32 caracteres ASCII. |
| `ANALYTICS_HASH_SECRET` | Outro segredo aleatório, diferente da senha, com pelo menos 32 caracteres. |
| `CPFHUB_API_KEY` | Preserve o secret existente da consulta automática de CPF. |

Você pode gerar cada segredo separadamente em um gerenciador de senhas ou executar duas vezes:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Não envie esses valores ao GitHub, não coloque em arquivos públicos e não compartilhe prints. Também é possível cadastrá-los pelo terminal:

```sh
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ANALYTICS_HASH_SECRET
```

## 3. Publicar

Substitua os arquivos na raiz do repositório pelo conteúdo deste ZIP, incluindo `src`, `migrations`, `public`, `package.json` e `wrangler.jsonc`. Mantenha `public/assets` completa. Faça commit/push somente após preencher o ID do banco e preparar as tabelas/secrets.

Na integração GitHub do Cloudflare Workers, use `npm install` como instalação e `npx wrangler deploy` como comando de deploy. Não é necessário build do site. Pelo terminal, `npm run deploy` faz a publicação.

O `wrangler.jsonc` mantém o nome `adm-artefatos`. Se o Worker real tiver outro nome, ajuste esse campo antes de configurar secrets e publicar. Preserve seu domínio/rotas na conta existente. Isto é um projeto **Workers com Static Assets**, não Cloudflare Pages.

Bindings/configuração incluídos:

- `ASSETS`: pasta pública do site.
- `ANALYTICS_DB`: banco D1 privado.
- `assets.run_worker_first: true`: faz a autenticação e a contagem passarem pelo backend, inclusive para páginas servidas do cache de assets.
- Cron `15 3 * * *`: exclusão diária às 03:15 UTC (00:15 de Brasília).
- Logs automáticos e traces desativados para não registrar URLs de consultas de documentos nas novas invocações. Isso não remove logs anteriores nem configurações externas da conta.

## 4. Acessar e conferir

Abra `https://SEU-DOMINIO/admin`, preferencialmente em janela anônima. O navegador pedirá usuário e senha. Não há link público para o painel e o backend exige autenticação a cada solicitação. Feche todas as janelas anônimas ao terminar: a autenticação HTTP Basic pode ficar guardada pelo navegador durante a sessão. Use somente HTTPS. Para revogar o acesso, altere `ADMIN_PASSWORD`.

1. Abra o site público; aguarde alguns segundos e veja o registro no painel.
2. Selecione 1, 7 ou 30 dias; confira contagem e dispositivo.
3. Em outro navegador sem autenticação, abra `/admin`: nenhum dado deve aparecer sem a senha.
4. Confira as consultas de CPF, CNPJ e CEP e as imagens. As APIs externas continuam dependendo dos seus serviços/credenciais existentes.
5. Confira no Cloudflare que o Cron está ativo. A propagação pode demorar alguns minutos.

O painel permite até 30 requisições autenticadas/tentativas por IP em cada intervalo fixo de 15 minutos. Após o limite, aguarde. É uma proteção básica contra tentativas de senha; use uma senha aleatória longa. Usuários autorizados da sua conta Cloudflare/D1 também têm acesso ao banco.

## Métricas e privacidade

- Uma visualização é uma resposta HTML bem-sucedida a GET `/` ou `/index.html`. Atualizar a página conta novamente. Cliques e etapas internas do formulário não contam como novas páginas.
- Robôs reconhecidos por User-Agent, pré-carregamentos sinalizados, arquivos, APIs e o painel não contam. Requisições com DNT ou GPC ativado são respeitadas e não registradas. A filtragem não identifica todos os robôs.
- Data/hora é armazenada em UTC e mostrada em Brasília.
- O IP vem do cabeçalho `CF-Connecting-IP` fornecido pelo Cloudflare. O IP completo não é salvo: armazena-se a rede mascarada (/24 no IPv4 e /48 no IPv6) e um identificador HMAC-SHA256 de IP + User-Agent, protegido pelo secret. Não se grava o User-Agent bruto, parâmetros de URL, documentos, nomes ou dados do formulário.
- Visitantes únicos são uma **estimativa por IP + User-Agent** dentro do período selecionado. Não representam pessoas identificadas. Redes compartilhadas podem agrupar visitantes; mudanças de rede ou navegador podem duplicá-los. Sem IP disponível, a visualização é contada, mas não entra em únicos.
- O tipo celular/tablet/computador é inferido pelo User-Agent. O modelo exato não está disponível de forma confiável; alguns tablets podem parecer computadores.
- Os registros e identificadores são pseudonimizados, não uma garantia de anonimato. Nenhum cookie de analytics é criado. Não há endpoint público que liste os dados.
- A janela é móvel de até 30 dias; não há total histórico permanente. O painel sempre filtra essa janela. O Cron apaga fisicamente os registros mais antigos uma vez por dia (pode haver até cerca de 24 horas adicionais antes da exclusão). Monitore falhas do Cron. Backups/Time Travel do D1 têm retenção própria gerenciada pelo Cloudflare.
- Mantenha uma informação de privacidade adequada à operação do site explicando finalidade, dados técnicos, retenção e contato. O design público não foi modificado nesta entrega.
- Trocar `ANALYTICS_HASH_SECRET` altera os identificadores futuros e pode duplicar estimativas durante a transição. Para apagar todos os registros imediatamente, execute no console D1: `DELETE FROM visits; DELETE FROM auth_attempts;`.

## Testes e limitações

`npm test` executa os testes com Node.js 24 (SQLite local), sem dependências adicionais. Eles cobrem rotas protegidas, limites de acesso, contagem, mascaramento, exclusão e roteamento original de validação CPF/CNPJ. Não simulam toda a infraestrutura Cloudflare nem validam credenciais de serviços externos. Sem banco/secrets corretos, o painel falha fechado; o site público continua atendendo mesmo se o registro de visitas falhar.

Fontes oficiais de configuração:

- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/d1/get-started/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
