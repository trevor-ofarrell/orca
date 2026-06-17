import type * as Monaco from 'monaco-editor'

type MonacoModule = typeof Monaco

export const ORCA_MONACO_LIGHT_THEME = 'orca-vs'
export const ORCA_MONACO_DARK_THEME = 'orca-vs-dark'

export function registerOrcaMonacoTheme(monaco: MonacoModule): void {
  monaco.editor.defineTheme(ORCA_MONACO_LIGHT_THEME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'string', foreground: 'a31515' },
      { token: 'constant.numeric', foreground: '098658' },
      { token: 'constant.language', foreground: '0000ff' },
      { token: 'keyword', foreground: '0000ff' },
      { token: 'storage', foreground: '0000ff' },
      { token: 'entity.name.function', foreground: '795e26' },
      { token: 'entity.name.type', foreground: '267f99' },
      { token: 'entity.name.class', foreground: '267f99' },
      { token: 'entity.name.tag', foreground: '800000' },
      { token: 'support.class', foreground: '267f99' },
      { token: 'support.function', foreground: '795e26' },
      { token: 'variable.parameter', foreground: '001080' },
      { token: 'invalid', foreground: 'cd3131' }
    ],
    colors: {}
  })

  monaco.editor.defineTheme(ORCA_MONACO_DARK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'constant.numeric', foreground: 'b5cea8' },
      { token: 'constant.language', foreground: '569cd6' },
      { token: 'keyword', foreground: '569cd6' },
      { token: 'storage', foreground: '569cd6' },
      { token: 'entity.name.function', foreground: 'dcdcaa' },
      { token: 'entity.name.type', foreground: '4ec9b0' },
      { token: 'entity.name.class', foreground: '4ec9b0' },
      { token: 'entity.name.tag', foreground: '569cd6' },
      { token: 'support.class', foreground: '4ec9b0' },
      { token: 'support.function', foreground: 'dcdcaa' },
      { token: 'variable.parameter', foreground: '9cdcfe' },
      { token: 'invalid', foreground: 'f44747' }
    ],
    colors: {}
  })
}
