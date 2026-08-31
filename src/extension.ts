import * as vscode from 'vscode';
import {
  StencilDefinitionProvider,
  StencilReferenceProvider,
} from './handlers';

export function activate(context: vscode.ExtensionContext): void {
  const typescriptReact: vscode.DocumentSelector = {
    language: 'typescriptreact',
    scheme: 'file',
  };

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      typescriptReact,
      new StencilDefinitionProvider(),
    ),
    vscode.languages.registerReferenceProvider(
      typescriptReact,
      new StencilReferenceProvider(),
    ),
  );
}

export function deactivate(): void {
  // VS Code disposes the providers through context.subscriptions.
}
