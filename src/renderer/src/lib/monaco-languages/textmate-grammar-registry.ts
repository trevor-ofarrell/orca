import type * as Monaco from 'monaco-editor'
import { bundledLanguages, bundledLanguagesInfo } from 'shiki/langs'
import type { LanguageRegistration } from 'shiki/types'
import type { IRawGrammar } from 'vscode-textmate'
import { registerTextMateTokensProvider } from './textmate-language-registration'
import type { TextMateGrammarLoader } from './textmate-token-provider'

type MonacoModule = typeof Monaco
type ShikiLanguageModule = { default: LanguageRegistration | LanguageRegistration[] }
type ShikiLanguageLoader = () => Promise<ShikiLanguageModule>
type LoadedShikiLanguage = {
  rootScopeName: string
  grammarsByScope: Map<string, IRawGrammar>
  injectionsByScope: Map<string, string[]>
}

export type OrcaShikiLanguageRegistration = {
  monacoLanguageId: string
  shikiLanguageId: string
  language?: Monaco.languages.ILanguageExtensionPoint
}

export type TextMateGrammarRegistration = {
  languageId: string
  shikiLanguageId: string
  language?: Monaco.languages.ILanguageExtensionPoint
  scopeName: () => Promise<string>
  loadGrammar: TextMateGrammarLoader
  getInjections: (scopeName: string) => string[] | undefined
  source: string
}

const shikiLanguageLoaders = bundledLanguages as Record<string, ShikiLanguageLoader | undefined>
const shikiLanguageIds = new Set(Object.keys(shikiLanguageLoaders))

export const ORCA_SHIKI_LANGUAGE_REGISTRY: readonly OrcaShikiLanguageRegistration[] = [
  { monacoLanguageId: 'typescript', shikiLanguageId: 'tsx' },
  { monacoLanguageId: 'javascript', shikiLanguageId: 'jsx' },
  { monacoLanguageId: 'json', shikiLanguageId: 'jsonc' },
  { monacoLanguageId: 'markdown', shikiLanguageId: 'markdown' },
  {
    monacoLanguageId: 'mermaid',
    shikiLanguageId: 'mermaid',
    language: { id: 'mermaid', extensions: ['.mmd', '.mermaid'], aliases: ['Mermaid'] }
  },
  { monacoLanguageId: 'css', shikiLanguageId: 'css' },
  { monacoLanguageId: 'scss', shikiLanguageId: 'scss' },
  { monacoLanguageId: 'less', shikiLanguageId: 'less' },
  { monacoLanguageId: 'html', shikiLanguageId: 'html' },
  { monacoLanguageId: 'xml', shikiLanguageId: 'xml' },
  { monacoLanguageId: 'python', shikiLanguageId: 'python' },
  { monacoLanguageId: 'rust', shikiLanguageId: 'rust' },
  { monacoLanguageId: 'go', shikiLanguageId: 'go' },
  { monacoLanguageId: 'java', shikiLanguageId: 'java' },
  { monacoLanguageId: 'kotlin', shikiLanguageId: 'kotlin' },
  { monacoLanguageId: 'c', shikiLanguageId: 'c' },
  { monacoLanguageId: 'cpp', shikiLanguageId: 'cpp' },
  { monacoLanguageId: 'csharp', shikiLanguageId: 'csharp' },
  { monacoLanguageId: 'ruby', shikiLanguageId: 'ruby' },
  { monacoLanguageId: 'php', shikiLanguageId: 'php' },
  { monacoLanguageId: 'swift', shikiLanguageId: 'swift' },
  { monacoLanguageId: 'shell', shikiLanguageId: 'shellscript' },
  { monacoLanguageId: 'bat', shikiLanguageId: 'bat' },
  { monacoLanguageId: 'powershell', shikiLanguageId: 'powershell' },
  { monacoLanguageId: 'yaml', shikiLanguageId: 'yaml' },
  { monacoLanguageId: 'ini', shikiLanguageId: 'ini' },
  { monacoLanguageId: 'sql', shikiLanguageId: 'sql' },
  { monacoLanguageId: 'graphql', shikiLanguageId: 'graphql' },
  { monacoLanguageId: 'dockerfile', shikiLanguageId: 'docker' },
  {
    monacoLanguageId: 'protobuf',
    shikiLanguageId: 'proto',
    language: { id: 'protobuf', extensions: ['.proto'], aliases: ['Protocol Buffers'] }
  },
  { monacoLanguageId: 'lua', shikiLanguageId: 'lua' },
  { monacoLanguageId: 'r', shikiLanguageId: 'r' },
  { monacoLanguageId: 'scala', shikiLanguageId: 'scala' },
  { monacoLanguageId: 'dart', shikiLanguageId: 'dart' },
  { monacoLanguageId: 'elixir', shikiLanguageId: 'elixir' },
  {
    monacoLanguageId: 'erlang',
    shikiLanguageId: 'erlang',
    language: { id: 'erlang', extensions: ['.erl', '.hrl'], aliases: ['Erlang'] }
  },
  {
    monacoLanguageId: 'haskell',
    shikiLanguageId: 'haskell',
    language: { id: 'haskell', extensions: ['.hs'], aliases: ['Haskell'] }
  },
  { monacoLanguageId: 'clojure', shikiLanguageId: 'clojure' },
  {
    monacoLanguageId: 'vue',
    shikiLanguageId: 'vue',
    language: { id: 'vue', extensions: ['.vue'], aliases: ['Vue'] }
  },
  {
    monacoLanguageId: 'svelte',
    shikiLanguageId: 'svelte',
    language: { id: 'svelte', extensions: ['.svelte'], aliases: ['Svelte'] }
  },
  {
    monacoLanguageId: 'astro',
    shikiLanguageId: 'astro',
    language: { id: 'astro', extensions: ['.astro'], aliases: ['Astro'] }
  },
  { monacoLanguageId: 'systemverilog', shikiLanguageId: 'system-verilog' },
  { monacoLanguageId: 'verilog', shikiLanguageId: 'verilog' },
  {
    monacoLanguageId: 'nim',
    shikiLanguageId: 'nim',
    language: {
      id: 'nim',
      extensions: ['.nim', '.nims', '.nimble'],
      aliases: ['Nim', 'nim']
    }
  },
  { monacoLanguageId: 'hcl', shikiLanguageId: 'terraform' },
  {
    monacoLanguageId: 'csv',
    shikiLanguageId: 'csv',
    language: { id: 'csv', extensions: ['.csv'], aliases: ['CSV'] }
  },
  {
    monacoLanguageId: 'tsv',
    shikiLanguageId: 'tsv',
    language: { id: 'tsv', extensions: ['.tsv'], aliases: ['TSV'] }
  },
  {
    monacoLanguageId: 'makefile',
    shikiLanguageId: 'make',
    language: { id: 'makefile', filenames: ['Makefile'], aliases: ['Makefile'] }
  },
  {
    monacoLanguageId: 'cmake',
    shikiLanguageId: 'cmake',
    language: {
      id: 'cmake',
      extensions: ['.cmake'],
      filenames: ['CMakeLists.txt'],
      aliases: ['CMake']
    }
  }
]

function unwrapDefault(value: unknown): unknown {
  return value && typeof value === 'object' && 'default' in value
    ? (value as { default: unknown }).default
    : value
}

function isLanguageRegistration(value: unknown): value is LanguageRegistration {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { scopeName?: unknown }).scopeName === 'string'
  )
}

export function normalizeLanguageRegistrations(value: unknown): LanguageRegistration[] {
  const actual = unwrapDefault(value)
  const registrations = Array.isArray(actual) ? actual : [actual]
  return registrations.filter(isLanguageRegistration)
}

export function hasShikiLanguage(shikiLanguageId: string): boolean {
  return shikiLanguageIds.has(shikiLanguageId)
}

export function getMissingShikiLanguageMappings(): string[] {
  return ORCA_SHIKI_LANGUAGE_REGISTRY.filter(
    (registration) => !hasShikiLanguage(registration.shikiLanguageId)
  ).map((registration) => registration.shikiLanguageId)
}

function createLoadedShikiLanguage(registrations: LanguageRegistration[]): LoadedShikiLanguage {
  const rootGrammar = registrations.at(-1)
  if (!rootGrammar) {
    throw new Error('Shiki language module did not provide any TextMate grammars')
  }

  const grammarsByScope = new Map<string, IRawGrammar>()
  const injectionsByScope = new Map<string, string[]>()

  for (const grammar of registrations) {
    grammarsByScope.set(grammar.scopeName, grammar as unknown as IRawGrammar)
    for (const scopeName of grammar.injectTo ?? []) {
      const injections = injectionsByScope.get(scopeName) ?? []
      injections.push(grammar.scopeName)
      injectionsByScope.set(scopeName, injections)
    }
  }

  return { rootScopeName: rootGrammar.scopeName, grammarsByScope, injectionsByScope }
}

export function createShikiTextMateGrammarRegistration(
  registration: OrcaShikiLanguageRegistration
): TextMateGrammarRegistration | null {
  const loadShikiLanguage = shikiLanguageLoaders[registration.shikiLanguageId]
  if (!loadShikiLanguage) {
    return null
  }
  const loadLanguageModule = loadShikiLanguage

  let loadedLanguagePromise: Promise<LoadedShikiLanguage> | undefined
  let loadedLanguage: LoadedShikiLanguage | undefined

  async function loadLanguage(): Promise<LoadedShikiLanguage> {
    loadedLanguagePromise ??= loadLanguageModule().then((languageModule) => {
      const loaded = createLoadedShikiLanguage(normalizeLanguageRegistrations(languageModule))
      loadedLanguage = loaded
      return loaded
    })
    return loadedLanguagePromise
  }

  return {
    languageId: registration.monacoLanguageId,
    shikiLanguageId: registration.shikiLanguageId,
    language: registration.language,
    scopeName: async () => (await loadLanguage()).rootScopeName,
    loadGrammar: async (scopeName) => (await loadLanguage()).grammarsByScope.get(scopeName) ?? null,
    getInjections: (scopeName) => loadedLanguage?.injectionsByScope.get(scopeName),
    source: `shiki/langs/${registration.shikiLanguageId}`
  }
}

export const TEXTMATE_GRAMMAR_REGISTRY: readonly TextMateGrammarRegistration[] =
  ORCA_SHIKI_LANGUAGE_REGISTRY.flatMap((registration) => {
    const textMateRegistration = createShikiTextMateGrammarRegistration(registration)
    return textMateRegistration ? [textMateRegistration] : []
  })

export const TEXTMATE_GRAMMAR_SOURCES: readonly string[] = bundledLanguagesInfo.map(
  (language) => language.id
)

export async function loadRegisteredTextMateGrammar(
  scopeName: string
): Promise<IRawGrammar | null> {
  for (const registration of TEXTMATE_GRAMMAR_REGISTRY) {
    const grammar = await registration.loadGrammar(scopeName)
    if (grammar) {
      return grammar
    }
  }

  return null
}

function registerLanguageMetadataIfNeeded(
  monaco: MonacoModule,
  language: Monaco.languages.ILanguageExtensionPoint | undefined
): void {
  if (!language) {
    return
  }
  const languageAlreadyRegistered = monaco.languages
    .getLanguages()
    .some((registeredLanguage) => registeredLanguage.id === language.id)
  if (!languageAlreadyRegistered) {
    monaco.languages.register(language)
  }
}

export function registerTextMateGrammarRegistry(monaco: MonacoModule): void {
  for (const registration of TEXTMATE_GRAMMAR_REGISTRY) {
    registerLanguageMetadataIfNeeded(monaco, registration.language)
    registerTextMateTokensProvider(monaco, registration.languageId, {
      getInjections: registration.getInjections,
      scopeName: registration.scopeName,
      loadGrammar: registration.loadGrammar
    })
  }
}
