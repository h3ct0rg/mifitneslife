import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.innerHTML !== value) el.innerHTML = value
  }, [value])

  const render = (command: string, arg?: string) => {
    document.execCommand(command, false, arg)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const onInput = () => {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const isEmpty = !value || value === '<br>' || value === '<div><br></div>'

  return (
    <div className="rte">
      <div className="rte-toolbar">
        <button type="button" className="rte-btn" onClick={() => render('bold')} title="Negrita" aria-label="Negrita">
          <strong>B</strong>
        </button>
        <button type="button" className="rte-btn" onClick={() => render('italic')} title="Cursiva" aria-label="Cursiva">
          <em>I</em>
        </button>
        <button type="button" className="rte-btn" onClick={() => render('underline')} title="Subrayado" aria-label="Subrayado">
          <u>U</u>
        </button>
        <button type="button" className="rte-btn" onClick={() => render('strikeThrough')} title="Tachado" aria-label="Tachado">
          <s>S</s>
        </button>
        <span className="rte-sep" />
        <button type="button" className="rte-btn" onClick={() => render('insertUnorderedList')} title="Lista" aria-label="Lista">
          • Lista
        </button>
        <button type="button" className="rte-btn" onClick={() => render('insertOrderedList')} title="Lista numerada" aria-label="Lista numerada">
          1. Lista
        </button>
        <span className="rte-sep" />
        <button
          type="button"
          className="rte-btn"
          onClick={() => {
            const url = window.prompt('URL del enlace')
            if (url) render('createLink', url)
          }}
          title="Insertar enlace"
          aria-label="Insertar enlace"
        >
          🔗
        </button>
        <button type="button" className="rte-btn" onClick={() => render('removeFormat')} title="Limpiar formato" aria-label="Limpiar formato">
          ⌫ Formato
        </button>
      </div>

      <div className="rte-body-wrap">
        {isEmpty && <span className="rte-placeholder">{placeholder ?? 'Escribe aquí...'}</span>}
        <div
          ref={ref}
          className="rte-body"
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
        />
      </div>
    </div>
  )
}