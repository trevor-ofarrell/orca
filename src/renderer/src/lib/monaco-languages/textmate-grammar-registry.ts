/* eslint-disable max-lines -- Why: explicit Shiki loader and Orca language maps avoid importing Shiki's full language catalogue. */
import type * as Monaco from 'monaco-editor'
import type { LanguageRegistration } from '@shikijs/types'
import type { IRawGrammar } from 'vscode-textmate'
import { registerTextMateTokensProvider } from './textmate-language-registration'
import type { TextMateGrammarLoader } from './textmate-token-provider'

type MonacoModule = typeof Monaco
type ShikiLanguageModule = { default: LanguageRegistration | LanguageRegistration[] }
export type ShikiLanguageLoader = () => Promise<ShikiLanguageModule>
export type ShikiLanguageLoaderMap = Record<string, ShikiLanguageLoader | undefined>
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

export type ShikiLanguageResolver = {
  hasLanguage: (shikiLanguageId: string) => boolean
  loadLanguage: (shikiLanguageId: string) => Promise<LanguageRegistration[]>
}

export const SHIKI_LANGUAGE_LOADERS = {
  tsx: () => import('@shikijs/langs/tsx'),
  jsx: () => import('@shikijs/langs/jsx'),
  typescript: () => import('@shikijs/langs/typescript'),
  javascript: () => import('@shikijs/langs/javascript'),
  jsonc: () => import('@shikijs/langs/jsonc'),
  json: () => import('@shikijs/langs/json'),
  markdown: () => import('@shikijs/langs/markdown'),
  mermaid: () => import('@shikijs/langs/mermaid'),
  css: () => import('@shikijs/langs/css'),
  scss: () => import('@shikijs/langs/scss'),
  sass: () => import('@shikijs/langs/sass'),
  less: () => import('@shikijs/langs/less'),
  stylus: () => import('@shikijs/langs/stylus'),
  postcss: () => import('@shikijs/langs/postcss'),
  html: () => import('@shikijs/langs/html'),
  'html-derivative': () => import('@shikijs/langs/html-derivative'),
  xml: () => import('@shikijs/langs/xml'),
  python: () => import('@shikijs/langs/python'),
  rust: () => import('@shikijs/langs/rust'),
  go: () => import('@shikijs/langs/go'),
  java: () => import('@shikijs/langs/java'),
  kotlin: () => import('@shikijs/langs/kotlin'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  csharp: () => import('@shikijs/langs/csharp'),
  ruby: () => import('@shikijs/langs/ruby'),
  php: () => import('@shikijs/langs/php'),
  swift: () => import('@shikijs/langs/swift'),
  shellscript: () => import('@shikijs/langs/shellscript'),
  bat: () => import('@shikijs/langs/bat'),
  powershell: () => import('@shikijs/langs/powershell'),
  yaml: () => import('@shikijs/langs/yaml'),
  ini: () => import('@shikijs/langs/ini'),
  toml: () => import('@shikijs/langs/toml'),
  sql: () => import('@shikijs/langs/sql'),
  graphql: () => import('@shikijs/langs/graphql'),
  docker: () => import('@shikijs/langs/docker'),
  proto: () => import('@shikijs/langs/proto'),
  lua: () => import('@shikijs/langs/lua'),
  r: () => import('@shikijs/langs/r'),
  scala: () => import('@shikijs/langs/scala'),
  dart: () => import('@shikijs/langs/dart'),
  elixir: () => import('@shikijs/langs/elixir'),
  erlang: () => import('@shikijs/langs/erlang'),
  haskell: () => import('@shikijs/langs/haskell'),
  clojure: () => import('@shikijs/langs/clojure'),
  vue: () => import('@shikijs/langs/vue'),
  svelte: () => import('@shikijs/langs/svelte'),
  astro: () => import('@shikijs/langs/astro'),
  'system-verilog': () => import('@shikijs/langs/system-verilog'),
  verilog: () => import('@shikijs/langs/verilog'),
  nim: () => import('@shikijs/langs/nim'),
  terraform: () => import('@shikijs/langs/terraform'),
  csv: () => import('@shikijs/langs/csv'),
  tsv: () => import('@shikijs/langs/tsv'),
  make: () => import('@shikijs/langs/make'),
  cmake: () => import('@shikijs/langs/cmake'),
  coffee: () => import('@shikijs/langs/coffee'),
  json5: () => import('@shikijs/langs/json5'),
  pug: () => import('@shikijs/langs/pug')
} satisfies ShikiLanguageLoaderMap

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

export function createShikiLanguageResolver(
  loaders: ShikiLanguageLoaderMap
): ShikiLanguageResolver {
  const loadedLanguages = new Map<string, Promise<LanguageRegistration[]>>()
  const hasLanguage = (shikiLanguageId: string): boolean => Boolean(loaders[shikiLanguageId])

  async function loadLanguage(
    shikiLanguageId: string,
    seen = new Set<string>()
  ): Promise<LanguageRegistration[]> {
    if (seen.has(shikiLanguageId)) {
      return []
    }

    const loadLanguageModule = loaders[shikiLanguageId]
    if (!loadLanguageModule) {
      return []
    }

    const cachedLanguage = loadedLanguages.get(shikiLanguageId)
    if (cachedLanguage) {
      return cachedLanguage
    }

    const loadedLanguage = (async () => {
      const registrations = normalizeLanguageRegistrations(await loadLanguageModule())
      const nextSeen = new Set(seen)
      nextSeen.add(shikiLanguageId)
      const embeddedLanguageIds = Array.from(
        new Set(registrations.flatMap((registration) => registration.embeddedLangsLazy ?? []))
      )
      const embeddedRegistrations = (
        await Promise.all(
          embeddedLanguageIds.map((embeddedLanguageId) =>
            loadLanguage(embeddedLanguageId, nextSeen)
          )
        )
      ).flat()

      return [...embeddedRegistrations, ...registrations]
    })()
    loadedLanguages.set(shikiLanguageId, loadedLanguage)
    return loadedLanguage
  }

  return { hasLanguage, loadLanguage }
}

const defaultShikiLanguageResolver = createShikiLanguageResolver(SHIKI_LANGUAGE_LOADERS)

export function hasShikiLanguage(shikiLanguageId: string): boolean {
  return defaultShikiLanguageResolver.hasLanguage(shikiLanguageId)
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
  registration: OrcaShikiLanguageRegistration,
  resolver: ShikiLanguageResolver = defaultShikiLanguageResolver
): TextMateGrammarRegistration | null {
  if (!resolver.hasLanguage(registration.shikiLanguageId)) {
    return null
  }

  let loadedLanguagePromise: Promise<LoadedShikiLanguage> | undefined
  let loadedLanguage: LoadedShikiLanguage | undefined

  async function loadLanguage(): Promise<LoadedShikiLanguage> {
    loadedLanguagePromise ??= resolver.loadLanguage(registration.shikiLanguageId).then((items) => {
      const loaded = createLoadedShikiLanguage(items)
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
    source: `@shikijs/langs/${registration.shikiLanguageId}`
  }
}

export const TEXTMATE_GRAMMAR_REGISTRY: readonly TextMateGrammarRegistration[] =
  ORCA_SHIKI_LANGUAGE_REGISTRY.flatMap((registration) => {
    const textMateRegistration = createShikiTextMateGrammarRegistration(registration)
    return textMateRegistration ? [textMateRegistration] : []
  })

export const TEXTMATE_GRAMMAR_SOURCES: readonly string[] = Object.keys(SHIKI_LANGUAGE_LOADERS)

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
