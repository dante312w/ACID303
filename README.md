# ÁCIDO 303

Landing conceptual para una noche de acid techno (marca, evento y artistas ficticios — proyecto de portafolio).

La pieza central es **AC-303**, un secuenciador de 16 pasos tocable que sintetiza en vivo una línea ácida estilo TB-303 (oscilador saw/square → filtro resonante con envolvente, acento y slide) más kick, hat y clap, todo con Web Audio API y sin samples. La página entera late al tempo del secuenciador.

## Correr en local

```bash
python -m http.server 5174
```

y abrir http://localhost:5174

## Estructura

- `js/engine.js` — motor de audio (voz 303, batería, sidechain, saturación)
- `js/sequencer.js` — grilla, perillas, scheduler con lookahead, presets, compartir patrón por URL, osciloscopios y pulso `--pulse`
- `js/main.js` — toast, barra de compra móvil, mini-patrones de entradas
- `js/animation.js` — entradas y revelados con GSAP + ScrollTrigger
- `css/style.css` — estilos (tokens en `:root`)
