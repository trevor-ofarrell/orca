import { describe, expect, it, vi } from 'vitest'
import {
  loadRegisteredTextMateGrammar,
  registerTextMateGrammarRegistry,
  TEXTMATE_GRAMMAR_REGISTRY
} from './textmate-grammar-registry'
import type { TextMateGrammarLoader } from './textmate-token-provider'

function createMonacoMock() {
  const factories = new Map<string, { create: () => unknown }>()
  const monaco = {
    languages: {
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

describe('TEXTMATE_GRAMMAR_REGISTRY', () => {
  it('registers the expected Monaco language ids', () => {
    const { monaco, factories } = createMonacoMock()

    registerTextMateGrammarRegistry(monaco as never)

    expect([...factories.keys()]).toEqual([
      'typescript',
      'javascript',
      'python',
      'rust',
      'go',
      'java',
      'shell',
      'yaml',
      'dockerfile',
      'css',
      'html',
      'json'
    ])
  })

  it('does not load grammars while registering provider factories', () => {
    const restoredRegistrations: (() => void)[] = []

    try {
      for (const registration of TEXTMATE_GRAMMAR_REGISTRY) {
        const originalLoadGrammar = registration.loadGrammar
        const loadGrammar = vi.fn(originalLoadGrammar)
        ;(registration as { loadGrammar: TextMateGrammarLoader }).loadGrammar = loadGrammar
        restoredRegistrations.push(() => {
          ;(registration as { loadGrammar: TextMateGrammarLoader }).loadGrammar =
            originalLoadGrammar
        })
      }

      const { monaco } = createMonacoMock()
      registerTextMateGrammarRegistry(monaco as never)

      for (const registration of TEXTMATE_GRAMMAR_REGISTRY) {
        expect(registration.loadGrammar).not.toHaveBeenCalled()
      }
    } finally {
      for (const restore of restoredRegistrations) {
        restore()
      }
    }
  })

  it('returns null for unknown scopes', async () => {
    await expect(loadRegisteredTextMateGrammar('source.unknown')).resolves.toBeNull()
  })

  it('loads grammar metadata for known scopes', async () => {
    await expect(loadRegisteredTextMateGrammar('source.python')).resolves.toMatchObject({
      scopeName: 'source.python'
    })
    await expect(loadRegisteredTextMateGrammar('text.html.basic')).resolves.toMatchObject({
      scopeName: 'text.html.basic'
    })
    await expect(loadRegisteredTextMateGrammar('source.json.comments')).resolves.toMatchObject({
      scopeName: 'source.json.comments'
    })
  })
})
