import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { useMemo } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minimal?: boolean
  className?: string
}

export default function RichTextEditor({ value, onChange, placeholder, minimal = false, className = '' }: RichTextEditorProps) {
  const modules = useMemo(() => ({
    toolbar: minimal
      ? [
          ['bold', 'italic', 'underline'],
          [{ color: [] }],
          ['link'],
          ['clean'],
        ]
      : [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ align: [] }],
          ['blockquote', 'code-block'],
          ['link', 'image'],
          ['clean'],
        ],
  }), [minimal])

  const formats = useMemo(() =>
    minimal
      ? ['bold', 'italic', 'underline', 'color', 'link']
      : ['header', 'bold', 'italic', 'underline', 'strike', 'color', 'background', 'list', 'align', 'blockquote', 'code-block', 'link', 'image'],
    [minimal]
  )

  return (
    <div className={`rich-text-editor ${className}`}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
      />
    </div>
  )
}

// Check if rich text content is effectively empty
export function isRichTextEmpty(html: string | undefined | null): boolean {
  if (!html) return true
  const stripped = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim()
  return stripped.length === 0
}

// Render HTML content safely with proper styling
export function RichContent({ html, className = '' }: { html: string; className?: string }) {
  if (!html || isRichTextEmpty(html)) return null
  return (
    <div
      className={`rich-content prose prose-sm max-w-none prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-blockquote:my-2 prose-blockquote:border-l-blue-400 prose-a:text-blue-600 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
