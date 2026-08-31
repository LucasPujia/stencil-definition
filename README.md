# Stencil Definition Navigator

Extensión de VS Code para mejorar la navegación entre tags JSX de Stencil y sus componentes `.tsx`.

## Compilar

```bash
npm install
npm run watch
```

## Probar en VS Code

1. Abre este proyecto en VS Code.
2. Pulsa `F5` para iniciar una ventana de Extension Development Host.
3. En un proyecto Stencil, abre un `.tsx` que contenga, por ejemplo, `<mi-boton />`.
4. Usa `Ctrl+Click` o `F12` sobre `mi-boton`. Si existe `mi-boton.tsx`, aparecerá como definición adicional y navegará al identificador de la clase o función correspondiente.
5. En el decorador `@Component({ tag: 'mi-boton' })` o en la declaración de su clase, ejecuta **Find All References** para localizar sus apariciones en `.tsx`, `.html` y `.css`.

La extensión no añade comandos, atajos ni menús: se integra únicamente mediante los providers nativos de definición y referencias, y solo se activa para `typescriptreact`.
