# Design: Sidebar Flutuante Glassmorphism

## Objetivo
Modernizar a barra de navegação lateral (Sidebar), descolando-a da borda esquerda da tela e aplicando um efeito de "Glassmorphism" para conferir uma estética premium, leve e translúcida.

## Abordagem Aprovada
- **Estilo**: Flutuante/Glassmorphism.
- A barra será um cartão vertical arredondado (`border-radius: 20px`), afastado das bordas (`margin: 16px`).
- Fundo translúcido (`rgba(255, 255, 255, 0.7)`) com `backdrop-filter: blur(16px)` para o efeito de vidro fosco.
- **Interações**: Micro-animações nos links, que ao sofrerem *hover*, receberão um fundo estilo "pílula" (pill) com um leve gradiente e sombra projetada suave, em vez do preenchimento retangular tradicional.
- **Responsividade**: O comportamento em telas menores continuará como um menu que desliza da esquerda, mas herdará a estética de vidro translúcido.

## Arquivos Afetados
- `css/dashboard.css` (onde a `.sidebar` é estilizada)
- `css/global-tokens.css` (para definir novas variáveis de cor/sombra, se necessário)
- Ajustes finos no `.main-content` e `#sidebar-placeholder` para respeitar as novas margens da barra flutuante.
