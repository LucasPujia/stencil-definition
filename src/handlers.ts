import * as vscode from 'vscode';

const TAG_NAME = '[A-Za-z][\\w.-]*-[\\w.-]*';
const JSX_TAG_PATTERN = new RegExp(`<\\s*/?\\s*(${TAG_NAME})`, 'g');
const COMPONENT_DECORATOR_PATTERN = /@Component\s*\(\s*\{([\s\S]*?)\}\s*\)/g;
const COMPONENT_TAG_PATTERN = new RegExp(`\\btag\\s*:\\s*(['"])(${TAG_NAME})\\1`);
const CLASS_DECLARATION_PATTERN = /\bclass\s+([A-Za-z_$][\w$]*)/;
const FUNCTION_DECLARATION_PATTERN = /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/;
const ARROW_FUNCTION_PATTERN = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/;

/** Returns true only for names that can be Stencil custom-element tags. */
export function isWebComponentTag(tag: string): boolean {
  return tag.includes('-');
}

/**
 * Finds a custom-element tag name when the cursor is on the tag name in JSX.
 * The returned range is limited to the name, so attributes do not trigger it.
 */
export function extractTagAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position,
): string | undefined {
  const line = document.lineAt(position.line);
  const cursor = position.character;

  for (const match of line.text.matchAll(JSX_TAG_PATTERN)) {
    const tag = match[1];
    const matchStart = match.index ?? -1;
    const tagStart = matchStart + match[0].lastIndexOf(tag);
    const tagEnd = tagStart + tag.length;

    if (cursor >= tagStart && cursor <= tagEnd && isWebComponentTag(tag)) {
      return tag;
    }
  }

  return undefined;
}

interface ComponentTagMatch {
  tag: string;
  tagStart: number;
  tagEnd: number;
  classStart?: number;
  classEnd?: number;
  classNameStart?: number;
  classNameEnd?: number;
}

function findComponentTagMatches(text: string): ComponentTagMatch[] {
  const matches: ComponentTagMatch[] = [];

  for (const decorator of text.matchAll(COMPONENT_DECORATOR_PATTERN)) {
    const decoratorStart = decorator.index ?? -1;
    const decoratorText = decorator[0];
    const body = decorator[1];
    const bodyStart = decoratorStart + decoratorText.indexOf(body);
    const tagMatch = body.match(COMPONENT_TAG_PATTERN);

    if (!tagMatch) {
      continue;
    }

    const tag = tagMatch[2];
    if (!isWebComponentTag(tag)) {
      continue;
    }

    const tagStart = bodyStart + (tagMatch.index ?? 0) + tagMatch[0].indexOf(tag);
    const decoratorEnd = decoratorStart + decoratorText.length;
    const classMatch = CLASS_DECLARATION_PATTERN.exec(text.slice(decoratorEnd));
    const classStart = classMatch ? decoratorEnd + classMatch.index : undefined;
    const classNameStart = classMatch && classStart !== undefined
      ? classStart + classMatch[0].lastIndexOf(classMatch[1])
      : undefined;
    const classEnd = classMatch && classStart !== undefined
      ? classStart + classMatch[0].length
      : undefined;
    const classNameEnd = classNameStart !== undefined && classMatch
      ? classNameStart + classMatch[1].length
      : undefined;

    matches.push({
      tag,
      tagStart,
      tagEnd: tagStart + tag.length,
      classStart,
      classEnd,
      classNameStart,
      classNameEnd,
    });
  }

  return matches;
}

/**
 * Finds the tag associated with a Stencil component when the cursor is on
 * the decorator's tag literal or on the following class declaration.
 */
export function extractComponentTagAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position,
): string | undefined {
  const text = document.getText();
  const offset = document.offsetAt(position);

  return findComponentTagMatches(text).find((match) => {
    const onTag = offset >= match.tagStart && offset <= match.tagEnd;
    const onClass = match.classStart !== undefined
      && match.classEnd !== undefined
      && offset >= match.classStart
      && offset <= match.classEnd;

    return onTag || onClass;
  })?.tag;
}

/** Finds the first implementation file named exactly `<tag>.tsx`. */
export async function findImplementationFile(
  tag: string,
  token: vscode.CancellationToken,
): Promise<vscode.Uri | undefined> {
  if (!isWebComponentTag(tag) || token.isCancellationRequested) {
    return undefined;
  }

  const files = await vscode.workspace.findFiles(
    `**/${tag}.tsx`,
    '**/node_modules/**',
    1,
    token,
  );

  return files[0];
}

interface DeclarationIdentifier {
  offset: number;
  length: number;
}

/**
 * Finds the symbol to which Go to Definition should navigate inside the
 * implementation file. A Stencil decorator takes precedence over fallbacks.
 */
function findDeclarationIdentifier(text: string, tag: string): DeclarationIdentifier | undefined {
  const component = findComponentTagMatches(text).find((match) => match.tag === tag);
  if (component?.classNameStart !== undefined && component.classNameEnd !== undefined) {
    return {
      offset: component.classNameStart,
      length: component.classNameEnd - component.classNameStart,
    };
  }

  const classMatch = CLASS_DECLARATION_PATTERN.exec(text);
  if (classMatch && classMatch.index !== undefined) {
    const offset = classMatch.index + classMatch[0].lastIndexOf(classMatch[1]);
    return { offset, length: classMatch[1].length };
  }

  const functionMatch = FUNCTION_DECLARATION_PATTERN.exec(text);
  if (functionMatch && functionMatch.index !== undefined) {
    const offset = functionMatch.index + functionMatch[0].lastIndexOf(functionMatch[1]);
    return { offset, length: functionMatch[1].length };
  }

  const arrowFunctionMatch = ARROW_FUNCTION_PATTERN.exec(text);
  if (arrowFunctionMatch && arrowFunctionMatch.index !== undefined) {
    const offset = arrowFunctionMatch.index + arrowFunctionMatch[0].indexOf(arrowFunctionMatch[1]);
    return { offset, length: arrowFunctionMatch[1].length };
  }

  return undefined;
}

/** Finds the definition symbol inside the first matching implementation file. */
export async function findImplementationLocation(
  tag: string,
  token: vscode.CancellationToken,
): Promise<vscode.Location | undefined> {
  const implementation = await findImplementationFile(tag, token);
  if (!implementation || token.isCancellationRequested) {
    return undefined;
  }

  try {
    const document = await vscode.workspace.openTextDocument(implementation);
    const declaration = findDeclarationIdentifier(document.getText(), tag);

    if (!declaration || token.isCancellationRequested) {
      return undefined;
    }

    const start = document.positionAt(declaration.offset);
    const end = document.positionAt(declaration.offset + declaration.length);
    return new vscode.Location(implementation, new vscode.Range(start, end));
  } catch {
    return undefined;
  }
}

/** Searches all TSX, HTML and CSS files for literal occurrences of the tag. */
export async function findTagReferences(
  tag: string,
  token: vscode.CancellationToken,
): Promise<vscode.Location[]> {
  if (!isWebComponentTag(tag) || token.isCancellationRequested) {
    return [];
  }

  const files = await vscode.workspace.findFiles(
    '**/*.{tsx,html,css}',
    '**/node_modules/**',
    undefined,
    token,
  );

  const locationsByFile = await Promise.all(files.map(async (uri) => {
    if (token.isCancellationRequested) {
      return [];
    }

    try {
      // Opening an already-open document also searches its current in-memory contents.
      const document = await vscode.workspace.openTextDocument(uri);
      const text = document.getText();
      const locations: vscode.Location[] = [];
      let offset = 0;

      while ((offset = text.indexOf(tag, offset)) !== -1) {
        const start = document.positionAt(offset);
        const end = document.positionAt(offset + tag.length);
        locations.push(new vscode.Location(uri, new vscode.Range(start, end)));
        offset += tag.length;
      }

      return locations;
    } catch {
      // A file can disappear between findFiles and openTextDocument.
      return [];
    }
  }));

  return token.isCancellationRequested ? [] : locationsByFile.flat();
}

export class StencilDefinitionProvider implements vscode.DefinitionProvider {
  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Definition | undefined> {
    const tag = extractTagAtPosition(document, position);
    if (!tag) {
      return undefined;
    }

    return findImplementationLocation(tag, token);
  }
}

export class StencilReferenceProvider implements vscode.ReferenceProvider {
  public provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.ReferenceContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.Location[]> {
    const tag = extractComponentTagAtPosition(document, position);
    return tag ? findTagReferences(tag, token) : Promise.resolve([]);
  }
}
