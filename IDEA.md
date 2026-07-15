O fluxo está compatível com o MVP. O principal ajuste é tornar **banco, valor e confiança obrigatórios na resposta da análise**, sem exigir o banco como condição absoluta de aprovação. Quando não identificado, o resultado deve informar isso claramente. 

# Fluxo obrigatório revisado — LP Pix MVP

## Visão geral

```text
01. Oferta e CTA
        ↓
02. Upload de imagem
        ↓
03. Análise por IA/OCR
        ↓
04. Resultado da validação
        ↓
05. Liberação do WhatsApp
```

O usuário somente poderá acessar o WhatsApp após uma resposta positiva do backend.

---

# 01. Oferta e CTA

## Objetivo

Apresentar a oferta de forma clara e direcionar o usuário para o envio do comprovante Pix.

## Conteúdo obrigatório

A primeira área visível da página deverá apresentar:

### Headline principal

```text
Entre para o Grupo VIP de Dicas Esportivas
```

A headline deverá:

* aparecer no primeiro carregamento;
* explicar claramente a oferta;
* ser o principal destaque visual da página;
* funcionar corretamente em smartphones.

### Benefício

```text
Receba análises, informações e conteúdos exclusivos diretamente pelo WhatsApp.
```

### Valor mínimo

```text
Envie um comprovante Pix no valor mínimo de R$ 97,00 para solicitar o acesso.
```

O valor deverá ser obtido da mesma configuração usada nas regras do backend, evitando divergência entre interface e validação.

### Aviso 18+

O aviso deverá estar claramente visível, próximo da oferta ou do CTA.

```text
Conteúdo destinado exclusivamente a maiores de 18 anos.
```

Não deverá ficar oculto apenas no rodapé, modal ou termos de uso.

### Avisos adicionais

```text
Aposte com responsabilidade.

Não existe garantia de lucro ou retorno financeiro.

A validação analisa apenas as informações visíveis no comprovante.
```

### Chamada para ação

```text
Enviar comprovante Pix
```

## Comportamento do CTA

Ao clicar no botão:

1. a página deverá rolar até a seção de upload;
2. a área de upload deverá receber foco ou destaque;
3. nenhum acesso ao WhatsApp deverá ser liberado;
4. nenhuma aprovação deverá ser calculada no frontend.

## Critérios de aceite

* A headline está visível no primeiro carregamento.
* O benefício está claramente explicado.
* O valor mínimo está informado.
* O aviso 18+ está visível.
* Existe aviso sobre jogo responsável.
* Não existe promessa de lucro.
* O CTA direciona até o upload.
* A seção funciona em smartphones.

---

# 02. Upload de imagem

## Objetivo

Permitir o envio de uma foto, imagem ou screenshot do comprovante Pix.

## Formatos aceitos

* `.jpg`;
* `.jpeg`;
* `.png`;
* `.webp`.

## Limite máximo

O limite deverá ser configurado e documentado.

```env
MAX_UPLOAD_SIZE_MB=8
```

A interface deverá informar o limite ao usuário.

Exemplo:

```text
Envie uma imagem JPG, PNG ou WebP de até 8 MB.
```

## Formas de envio

No computador:

* selecionar uma imagem;
* substituir a imagem;
* remover a imagem antes do envio.

No smartphone:

* tirar uma foto com a câmera;
* selecionar uma imagem da galeria;
* selecionar um screenshot.

## Preview

Após a seleção, mostrar:

* imagem selecionada;
* nome do arquivo;
* tamanho aproximado;
* botão para remover;
* botão para substituir;
* botão para analisar.

## Validações no frontend

Verificar:

* arquivo selecionado;
* extensão permitida;
* MIME type permitido;
* tamanho máximo;
* prevenção de envio duplicado.

## Validações no backend

Verificar novamente:

* tamanho real;
* MIME type;
* assinatura binária;
* conteúdo real da imagem;
* possibilidade de processamento.

O frontend não deverá ser considerado uma barreira de segurança.

## Critérios de aceite

* Aceita JPG, JPEG, PNG e WebP.
* Rejeita formatos não permitidos.
* Rejeita arquivos acima do limite.
* Permite câmera e galeria no smartphone.
* Mostra preview.
* Permite remover ou substituir.
* Não permite envios simultâneos.

---

# 03. Análise por IA/OCR

## Objetivo

Analisar o comprovante e extrair as informações necessárias para a validação.

## Processamento obrigatório

O backend deverá:

1. receber a imagem;
2. validar o arquivo;
3. corrigir a orientação;
4. redimensionar a imagem quando necessário;
5. remover metadados;
6. enviar a imagem para o provedor de IA/OCR;
7. validar a resposta recebida;
8. aplicar as regras do MVP.

## Informações que deverão ser analisadas

A IA/OCR deverá tentar identificar:

* presença de texto relacionado a um comprovante Pix;
* banco ou instituição financeira;
* valor monetário;
* moeda;
* confiança da leitura.

## Resposta interna esperada

```ts
interface PixAnalysisResult {
  isPixReceipt: boolean;
  bank: string | null;
  amountCents: number | null;
  currency: "BRL" | null;
  confidence: number;
}
```

O valor deverá ser representado em centavos.

Exemplo:

```ts
amountCents: 9700;
```

## Regras de validação

```env
MIN_PIX_AMOUNT_CENTS=9700
MIN_AI_CONFIDENCE=0.75
```

O comprovante será aprovado quando:

* a imagem parecer ser um comprovante Pix;
* o valor for identificado;
* o valor for igual ou superior ao mínimo;
* a moeda for BRL;
* a confiança atingir o mínimo configurado.

## Banco identificado

A análise deverá tentar identificar o banco.

Porém, no MVP, o banco não deverá ser uma condição absoluta para aprovação, pois alguns comprovantes podem não mostrar claramente a instituição.

Quando o banco não puder ser identificado, a resposta deverá retornar:

```json
{
  "bank": null
}
```

A interface deverá mostrar:

```text
Banco identificado: Não identificado
```

## Rejeição

O comprovante deverá ser rejeitado quando:

* não parecer ser um comprovante Pix;
* o valor não for identificado;
* o valor for inferior ao mínimo;
* a moeda não for BRL;
* a imagem estiver ilegível;
* a confiança estiver abaixo do limite.

## Segurança

* A análise deverá acontecer somente no backend.
* A chave da IA não poderá aparecer no frontend.
* A imagem não deverá ser armazenada permanentemente.
* Dados pessoais não deverão ser gravados em logs.
* O endpoint deverá possuir limite de requisições.

## Critérios de aceite

* Detecta texto relacionado ao comprovante.
* Tenta identificar o banco.
* Identifica o valor monetário.
* Identifica a moeda.
* Retorna a confiança da leitura.
* Executa as regras no backend.
* Trata respostas inválidas do provedor.
* Não expõe a chave da IA.

---

# 04. Resultado

## Objetivo

Mostrar de forma clara o que foi identificado e o resultado da validação.

## Informações obrigatórias

Exibir:

* banco identificado;
* valor identificado;
* confiança da leitura;
* status da validação;
* mensagem explicativa.

A moeda poderá ser exibida junto ao valor.

## Status permitidos

```ts
type ValidationStatus =
  | "approved"
  | "rejected"
  | "error";
```

## Resultado aprovado

```text
Comprovante aprovado

Banco identificado: Nubank
Valor identificado: R$ 97,00
Confiança da leitura: 91%
Status: Aprovado
```

## Banco não identificado

```text
Comprovante aprovado

Banco identificado: Não identificado
Valor identificado: R$ 97,00
Confiança da leitura: 91%
Status: Aprovado
```

## Resultado rejeitado

```text
Comprovante não aprovado

Banco identificado: Nubank
Valor identificado: R$ 50,00
Status: Valor inferior ao mínimo necessário
```

## Imagem ilegível

```text
Não foi possível analisar o comprovante.

Envie uma nova foto ou screenshot com melhor qualidade.
```

## Privacidade

Não exibir:

* CPF completo;
* chave Pix;
* conta bancária completa;
* nome completo do pagador;
* nome completo do recebedor;
* identificador completo da transação;
* texto integral extraído pelo OCR.

## Aviso obrigatório

```text
A análise verifica apenas as informações visíveis na imagem. Ela não confirma diretamente o recebimento do pagamento pela instituição financeira.
```

## Critérios de aceite

* Exibe banco ou “Não identificado”.
* Exibe valor identificado.
* Exibe confiança.
* Exibe status.
* Exibe motivo em caso de rejeição.
* Permite enviar uma nova imagem.
* Não mostra dados pessoais desnecessários.
* Não libera o WhatsApp em caso de rejeição ou erro.

---

# 05. WhatsApp

## Objetivo

Liberar o botão do WhatsApp somente após validação positiva realizada pelo backend.

## Regra obrigatória

O botão somente deverá aparecer quando a API retornar:

```json
{
  "status": "approved",
  "whatsappUrl": "https://wa.me/..."
}
```

O frontend não poderá:

* criar a URL sozinho;
* alterar o status;
* liberar o botão com base apenas em estados locais;
* liberar o acesso antes da resposta do backend.

## Configuração

A URL deverá ser privada no servidor.

```env
WHATSAPP_URL=https://wa.me/5500000000000
WHATSAPP_MESSAGE=Olá, meu comprovante foi analisado e quero acessar o Grupo VIP.
```

Não utilizar:

```env
NEXT_PUBLIC_WHATSAPP_URL
```

## Comportamento do botão

O botão deverá:

* aparecer somente após aprovação;
* abrir o WhatsApp em nova aba;
* funcionar no computador e no smartphone;
* utilizar mensagem inicial configurável;
* não incluir informações sensíveis;
* permanecer oculto em caso de rejeição ou erro.

Texto:

```text
Continuar pelo WhatsApp
```

## Critérios de aceite

* O botão não aparece antes da análise.
* O botão não aparece durante o processamento.
* O botão não aparece após rejeição.
* O botão não aparece após erro.
* O botão aparece somente após aprovação do backend.
* A URL não está disponível no bundle inicial do frontend.
* O link funciona em desktop e smartphone.

---

# Resumo obrigatório do fluxo

```text
LP PIX

01. OFERTA E CTA
Headline principal
Benefício
Valor mínimo
Aviso 18+
Aviso de jogo responsável
Aviso de ausência de garantia de lucro
CTA para envio do comprovante

        ↓

02. UPLOAD DE IMAGEM
JPG, JPEG, PNG ou WebP
Limite máximo documentado
Câmera, galeria ou screenshot
Preview
Validação no frontend e backend

        ↓

03. ANÁLISE POR IA/OCR
Detectar comprovante Pix
Detectar texto
Identificar banco
Identificar valor monetário
Identificar moeda
Calcular confiança
Aplicar regras no backend

        ↓

04. RESULTADO
Exibir banco identificado
Exibir valor identificado
Exibir confiança
Exibir status
Permitir nova tentativa em caso negativo

        ↓

05. WHATSAPP
Liberar somente após validação positiva
URL retornada exclusivamente pelo backend
Não exibir em rejeição ou erro
```

# Condição final do MVP

O fluxo somente será considerado concluído quando cumprir integralmente a sequência:

```text
Headline + benefício + aviso 18+
        ↓
Upload válido
        ↓
Análise de banco, valor e confiança
        ↓
Resultado visível
        ↓
WhatsApp somente após aprovação
```
