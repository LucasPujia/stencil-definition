# Stencil Definition Navigator

VS Code extension that improves navigation between Stencil JSX tags and their `.tsx` components.

## Build

```bash
npm install
npm run watch
```

## Test in VS Code

1. Open this project in VS Code.
2. Press `F5` to start an Extension Development Host window.
3. In a Stencil project, open a `.tsx` file containing, for example, `<my-component />`.
4. Use `Ctrl+Click` or `F12` on `my-component`. If `my-component.tsx` exists, it will appear as an additional definition and navigation will go to the corresponding class or function identifier.
5. On the `@Component({ tag: 'my-component' })` decorator or its class declaration, run **Find All References** to locate occurrences in `.tsx`, `.html`, and `.css` files.

The extension does not add commands, keybindings, or menus. It integrates only through VS Code's native definition and reference providers, and activates only for `typescriptreact`.
