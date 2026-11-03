import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /** id del <label>/título que nombra el editor. */
  labelledBy?: string
}

const TOOLS: { command: string; icon: string; label: string }[] = [
  { command: 'bold', icon: 'format_bold', label: 'Negrita' },
  { command: 'italic', icon: 'format_italic', label: 'Cursiva' },
  { command: 'underline', icon: 'format_underlined', label: 'Subrayado' },
  { command: 'strikeThrough', icon: 'strikethrough_s', label: 'Tachado' },
  { command: 'insertUnorderedList', icon: 'format_list_bulleted', label: 'Lista' },
  { command: 'insertOrderedList', icon: 'format_list_numbered', label: 'Lista numerada' },
]

export default function RichTextEditor({ value, onChange, placeholder, labelledBy }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.innerHTML !== value) el.innerHTML = value
  }, [value])

  const run = (command: string, arg?: string) => {
    document.execCommand(command, false, arg)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const onInput = () => {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const isEmpty = !value || value === '<br>' || value === '<div><br></div>'

  const toolButton = (key: string, icon: string, label: string, onClick: () => void) => (
    <button key={key} type="button" className="rte-btn" onClick={onClick} title={label} aria-label={label}>
      <span className="material-symbols-outlined" aria-hidden="true">
        {icon}
      </span>
    </button>
  )

  return (
    <div className="rte">
      <div className="rte-toolbar" role="toolbar" aria-label="Formato del texto">
        {TOOLS.slice(0, 4).map((t) => toolButton(t.command, t.icon, t.label, () => run(t.command)))}
        <span className="rte-sep" aria-hidden="true" />
        {TOOLS.slice(4).map((t) => toolButton(t.command, t.icon, t.label, () => run(t.command)))}
        <span className="rte-sep" aria-hidden="true" />
        {toolButton('link', 'link', 'Insertar enlace', () => {
          const url = window.prompt('URL del enlace')
          if (url) run('createLink', url)
        })}
        {toolButton('clear', 'format_clear', 'Limpiar formato', () => run('removeFormat'))}
      </div>

      <div className="rte-body-wrap">
        {isEmpty && (
          <span className="rte-placeholder" aria-hidden="true">
            {placeholder ?? 'Escribe aquí...'}
          </span>
        )}
        <div
          ref={ref}
          className="rte-body"
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-labelledby={labelledBy}
          aria-placeholder={placeholder ?? 'Escribe aquí...'}
          tabIndex={0}
          suppressContentEditableWarning
          onInput={onInput}
        />
      </div>
    </div>
  )
}
