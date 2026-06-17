import type * as Monaco from 'monaco-editor'
import type { IRawGrammar } from 'vscode-textmate'
import { registerTextMateTokensProvider } from './textmate-language-registration'
import type { TextMateGrammarLoader } from './textmate-token-provider'

type MonacoModule = typeof Monaco
type GrammarModule = { default: unknown }
type GrammarImport = () => Promise<GrammarModule>

export type TextMateGrammarRegistration = {
  languageId: string
  scopeName: string
  loadGrammar: TextMateGrammarLoader
  source: string
}

const grammarLoaders: Record<string, GrammarImport> = {
  'source.ts': () => import('./textmate-grammars/js-ts/TypeScript.tmLanguage.json'),
  'source.tsx': () => import('./textmate-grammars/js-ts/TypeScriptReact.tmLanguage.json'),
  'source.js': () => import('./textmate-grammars/js-ts/JavaScript.tmLanguage.json'),
  'source.js.jsx': () => import('./textmate-grammars/js-ts/JavaScriptReact.tmLanguage.json'),
  'source.python': () => import('./textmate-grammars/python/MagicPython.tmLanguage.json'),
  'source.rust': () => import('./textmate-grammars/rust/rust.tmLanguage.json'),
  'source.go': () => import('./textmate-grammars/go/go.tmLanguage.json'),
  'source.java': () => import('./textmate-grammars/java/java.tmLanguage.json'),
  'source.shell': () => import('./textmate-grammars/shell/shell-unix-bash.tmLanguage.json'),
  'source.yaml': () => import('./textmate-grammars/yaml/yaml.tmLanguage.json'),
  'source.yaml.1.2': () => import('./textmate-grammars/yaml/yaml-1.2.tmLanguage.json'),
  'source.yaml.embedded': () => import('./textmate-grammars/yaml/yaml-embedded.tmLanguage.json'),
  'source.dockerfile': () => import('./textmate-grammars/dockerfile/docker.tmLanguage.json'),
  'source.css': () => import('./textmate-grammars/css/css.tmLanguage.json'),
  'text.html.basic': () => import('./textmate-grammars/html/html.tmLanguage.json'),
  'source.json': () => import('./textmate-grammars/json/JSON.tmLanguage.json'),
  'source.json.comments': () => import('./textmate-grammars/json/JSONC.tmLanguage.json')
}

export async function loadRegisteredTextMateGrammar(
  scopeName: string
): Promise<IRawGrammar | null> {
  const loadGrammar = grammarLoaders[scopeName]
  if (!loadGrammar) {
    return null
  }

  const grammar = await loadGrammar()
  return grammar.default as IRawGrammar
}

export const TEXTMATE_GRAMMAR_REGISTRY: readonly TextMateGrammarRegistration[] = [
  {
    languageId: 'typescript',
    scopeName: 'source.tsx',
    loadGrammar: loadRegisteredTextMateGrammar,
    source: 'microsoft/vscode extensions/typescript-basics'
  },
  {
    languageId: 'javascript',
    scopeName: 'source.js.jsx',
    loadGrammar: loadRegisteredTextMateGrammar,
    source: 'microsoft/vscode extensions/javascript'
  },
  {
    languageId: 'python',
    scopeName: 'source.python',
    loadGrammar: loadRegisteredTextMateGrammar,
    source: 'microsoft/vscode extensions/python'
  },
  {
    languageId: 'rust',
    scopeName: 'source.rust',
    loadGrammar: loadRegisteredTextMateGrammar,
    source: 'microsoft/vscode extensions/rust'
  },
  {
    languageId: 'go',
    scopeName: 'source.go',
    loadGrammar: loadRegisteredTextMateGrammar,
    source: 'microsoft/vscode extensions/go'
  },
  {
    languageId: 'java',
    scopeName: 'source.java',
    loadGrammar: loadRegisteredTextMateGrammar,
    source: 'microsoft/vscode extensions/java'
  },
  {
    languageId: 'shell',
    scopeName: 'source.shell',
    loadGrammar: loadRegisteredTextMateGrammar,
    source: 'microsoft/vscode extensions/shellscript'
  },
  {
    languageId: 'yaml',
    scopeName: 'source.yaml',
    loadGrammar: loadRegisteredTextMateGrammar,
    source: 'microsoft/vscode extensions/yaml'
  },
  {
    languageId: 'dockerfile',
    scopeName: 'source.dockerfile',
    loadGrammar: loadRegisteredTextMateGrammar,
    source: 'microsoft/vscode extensions/docker'
  },
  {
    languageId: 'css',
    scopeName: 'source.css',
    loadGrammar: loadRegisteredTextMateGrammar,
    source: 'microsoft/vscode extensions/css'
  },
  {
    languageId: 'html',
    scopeName: 'text.html.basic',
    loadGrammar: loadRegisteredTextMateGrammar,
    source: 'microsoft/vscode extensions/html'
  },
  {
    languageId: 'json',
    scopeName: 'source.json.comments',
    loadGrammar: loadRegisteredTextMateGrammar,
    source: 'microsoft/vscode extensions/json'
  }
]

export function registerTextMateGrammarRegistry(monaco: MonacoModule): void {
  for (const registration of TEXTMATE_GRAMMAR_REGISTRY) {
    registerTextMateTokensProvider(monaco, registration.languageId, {
      scopeName: registration.scopeName,
      loadGrammar: registration.loadGrammar
    })
  }
}
