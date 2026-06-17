import { describe, expect, it, vi } from 'vitest'
import {
  createShikiTextMateGrammarRegistration,
  getMissingShikiLanguageMappings,
  loadRegisteredTextMateGrammar,
  normalizeLanguageRegistrations,
  ORCA_SHIKI_LANGUAGE_REGISTRY,
  registerTextMateGrammarRegistry,
  TEXTMATE_GRAMMAR_REGISTRY
} from './textmate-grammar-registry'
import type { TextMateGrammarLoader } from './textmate-token-provider'

function createMonacoMock(registeredLanguages: { id: string }[] = []) {
  const languages = [...registeredLanguages]
  const factories = new Map<string, { create: () => unknown }>()
  const monaco = {
    languages: {
      getLanguages: vi.fn(() => languages),
      register: vi.fn((language: { id: string }) => {
        languages.push({ id: language.id })
      }),
      registerTokensProviderFactory: vi.fn(
        (languageId: string, factory: { create: () => unknown }) => {
          factories.set(languageId, factory)
          return { dispose: vi.fn() }
        }
      )
    }
  }

  return { monaco, factories }
}

const expectedRegisteredLanguageIds = [
  'typescript',
  'javascript',
  'json',
  'markdown',
  'mermaid',
  'css',
  'scss',
  'less',
  'html',
  'xml',
  'python',
  'rust',
  'go',
  'java',
  'kotlin',
  'c',
  'cpp',
  'csharp',
  'ruby',
  'php',
  'swift',
  'shell',
  'bat',
  'powershell',
  'yaml',
  'ini',
  'sql',
  'graphql',
  'dockerfile',
  'protobuf',
  'lua',
  'r',
  'scala',
  'dart',
  'elixir',
  'erlang',
  'haskell',
  'clojure',
  'vue',
  'svelte',
  'astro',
  'systemverilog',
  'verilog',
  'nim',
  'hcl',
  'csv',
  'tsv',
  'makefile',
  'cmake'
]

describe('TEXTMATE_GRAMMAR_REGISTRY', () => {
  it('maps Orca-detected language ids to valid Shiki languages', () => {
    expect(getMissingShikiLanguageMappings()).toEqual([])
    expect(TEXTMATE_GRAMMAR_REGISTRY.map((registration) => registration.languageId)).toEqual(
      expectedRegisteredLanguageIds
    )
    expect(
      ORCA_SHIKI_LANGUAGE_REGISTRY.map((registration) => registration.monacoLanguageId)
    ).not.toContain('notebook')
  })

  it('registers Monaco token provider factories and missing language metadata', () => {
    const { monaco, factories } = createMonacoMock([{ id: 'typescript' }])

    registerTextMateGrammarRegistry(monaco as never)

    expect([...factories.keys()]).toEqual(expectedRegisteredLanguageIds)
    expect(monaco.languages.register).toHaveBeenCalledWith({
      id: 'mermaid',
      extensions: ['.mmd', '.mermaid'],
      aliases: ['Mermaid']
    })
    expect(monaco.languages.register).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'typescript' })
    )
  })

  it('does not load grammars while registering provider factories', () => {
    const restoredRegistrations: (() => void)[] = []

    try {
      for (const registration of TEXTMATE_GRAMMAR_REGISTRY) {
        const originalLoadGrammar = registration.loadGrammar
        const originalScopeName = registration.scopeName
        const loadGrammar = vi.fn(originalLoadGrammar)
        const scopeName = vi.fn(originalScopeName)
        ;(registration as { loadGrammar: TextMateGrammarLoader }).loadGrammar = loadGrammar
        ;(registration as { scopeName: () => Promise<string> }).scopeName = scopeName
        restoredRegistrations.push(() => {
          ;(registration as { loadGrammar: TextMateGrammarLoader }).loadGrammar =
            originalLoadGrammar
          ;(registration as { scopeName: () => Promise<string> }).scopeName = originalScopeName
        })
      }

      const { monaco } = createMonacoMock()
      registerTextMateGrammarRegistry(monaco as never)

      for (const registration of TEXTMATE_GRAMMAR_REGISTRY) {
        expect(registration.loadGrammar).not.toHaveBeenCalled()
        expect(registration.scopeName).not.toHaveBeenCalled()
      }
    } finally {
      for (const restore of restoredRegistrations) {
        restore()
      }
    }
  })

  it('loads root grammar metadata for a known Shiki language', async () => {
    const registration = TEXTMATE_GRAMMAR_REGISTRY.find((item) => item.languageId === 'typescript')
    expect(registration).toBeDefined()

    const rootScopeName = await registration!.scopeName()

    expect(rootScopeName).toBe('source.tsx')
    await expect(registration!.loadGrammar(rootScopeName)).resolves.toMatchObject({
      scopeName: 'source.tsx'
    })
  })

  it('loads embedded grammars from Shiki language modules', async () => {
    const registration = TEXTMATE_GRAMMAR_REGISTRY.find((item) => item.languageId === 'html')
    expect(registration).toBeDefined()

    await registration!.scopeName()

    await expect(registration!.loadGrammar('source.js')).resolves.toMatchObject({
      scopeName: 'source.js'
    })
    await expect(registration!.loadGrammar('source.css')).resolves.toMatchObject({
      scopeName: 'source.css'
    })
  })

  it('exposes Shiki injection metadata after loading a language module', async () => {
    const registration = TEXTMATE_GRAMMAR_REGISTRY.find((item) => item.languageId === 'vue')
    expect(registration).toBeDefined()

    await registration!.scopeName()

    expect(registration!.getInjections('source.vue')).toEqual(
      expect.arrayContaining(['vue.directives', 'vue.interpolations'])
    )
  })

  it('returns null for unknown scopes', async () => {
    const registration = TEXTMATE_GRAMMAR_REGISTRY.find((item) => item.languageId === 'typescript')
    expect(registration).toBeDefined()

    await expect(registration!.loadGrammar('source.unknown')).resolves.toBeNull()
  })

  it('loads grammar metadata through the registry helper', async () => {
    await expect(loadRegisteredTextMateGrammar('source.python')).resolves.toMatchObject({
      scopeName: 'source.python'
    })
  })

  it('skips unknown Shiki language mappings safely', () => {
    expect(
      createShikiTextMateGrammarRegistration({
        monacoLanguageId: 'unknown',
        shikiLanguageId: 'missing-shiki-language'
      })
    ).toBeNull()
  })

  it('normalizes Shiki language module exports', () => {
    const grammar = { scopeName: 'source.test', name: 'test', patterns: [] }

    expect(normalizeLanguageRegistrations({ default: grammar })).toEqual([grammar])
    expect(normalizeLanguageRegistrations({ default: [grammar] })).toEqual([grammar])
    expect(normalizeLanguageRegistrations({ default: [null, grammar] })).toEqual([grammar])
  })
})
