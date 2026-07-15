# LP Pix

Landing page MVP para validar comprovantes Pix antes de liberar o acesso ao WhatsApp.

## Stack

- Next.js 16 + App Router
- React 19
- TypeScript
- Vitest + Testing Library
- Sharp para pré-processamento da imagem
- file-type para validação da assinatura binária

## Variáveis de ambiente

Copie `.env.example` para `.env.local`.

```env
MAX_UPLOAD_SIZE_MB=8
MIN_PIX_AMOUNT_CENTS=9700
MIN_AI_CONFIDENCE=0.75
WHATSAPP_URL=https://wa.me/5500000000000
WHATSAPP_MESSAGE=Olá, meu comprovante foi analisado e quero acessar o Grupo VIP.
OCR_PROVIDER=mock
OPENAI_API_KEY=
NEXT_PUBLIC_META_PIXEL_ID=123456789012345
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
```

## Tracking: Meta Pixel + Google Analytics 4

Implementado para o funil atual da LP Pix (**Opção A**).

### IDs públicos esperados

- `NEXT_PUBLIC_META_PIXEL_ID`
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`

Sem esses IDs, os scripts de terceiros não são injetados, mas o frontend continua funcional.

### Eventos implementados

| Momento | Meta Pixel | GA4 | Detalhes |
|---|---|---|---|
| Carregamento da página | `PageView` | `page_view` | Disparado 1x por carregamento do componente. |
| Clique em `Selecione comprovante Pix` / `Enviar nova imagem` | `InitiateCheckout` | `begin_checkout` | Marca o início do fluxo de envio do comprovante. |
| Comprovante aprovado pela IA/OCR | `Purchase` | `purchase` | Envia valor, moeda, item e `transaction_id` único retornado pela API. |

### Payload de compra enviado

Meta Pixel:

```js
fbq('track', 'Purchase', {
  value: 97.0,
  currency: 'BRL',
  content_name: 'Grupo VIP de Dicas em Bet',
  payment_method: 'pix'
});
```

GA4:

```js
gtag('event', 'purchase', {
  transaction_id: 'pix_validation_unique_id',
  value: 97.0,
  currency: 'BRL',
  items: [{
    item_id: 'grupo-vip-bet',
    item_name: 'Grupo VIP de Dicas em Bet'
  }]
});
```

### Evidência de funcionamento

- testes de UI cobrindo os eventos de:
  - `PageView` / `page_view`
  - `InitiateCheckout` / `begin_checkout`
  - `Purchase` / `purchase`
- resposta da API agora retorna `transactionId` único para o evento de compra
- scripts de bootstrap do Meta Pixel e GA4 são carregados no layout quando os IDs públicos estão configurados

## Provedores OCR

### `OCR_PROVIDER=mock`
Modo local para desenvolvimento e QA sem chave externa.

Comportamentos do mock:
- nome normal de arquivo → aprovado
- arquivo com `low-amount` no nome → valor de R$ 50,00
- arquivo com `low-confidence` no nome → confiança baixa
- arquivo com `not-pix` no nome → não reconhecido como comprovante Pix

### `OCR_PROVIDER=openai`
Usa `OPENAI_API_KEY` no backend e envia a imagem já tratada para a API da OpenAI. A chave nunca vai para o frontend.

O prompt do OCR foi ajustado para priorizar o **banco/app de quem enviou o Pix**. A ordem desejada é:

1. marca/logo/cabeçalho do app emissor usado para fazer o Pix;
2. seção `Origem` / pagador / remetente / conta debitada;
3. banco do destinatário apenas como último fallback.

Quando houver nome societário e marca comercial, o OCR também tenta preferir o nome mais reconhecível para exibição, por exemplo `Nubank` em vez de `Nu Pagamentos`.

## Rodando localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`.

## Verificações executadas

```bash
npm run lint
npm test
npm run build
```

## Segurança implementada

- upload validado no frontend e novamente no backend
- verificação de extensão, MIME type, assinatura binária e processabilidade real
- correção de orientação e remoção de metadados via Sharp
- URL do WhatsApp montada apenas no servidor
- OCR executado apenas no backend
- rate limit simples por IP no endpoint
- sem persistência permanente da imagem
- resposta pública sem expor CPF, chave Pix ou texto bruto do OCR
