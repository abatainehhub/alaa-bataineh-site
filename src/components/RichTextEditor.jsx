import React, { forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, List,
  AlignRight, AlignCenter, AlignLeft, AlignJustify,
} from 'lucide-react';
import { Direction } from '../lib/directionMark';

const ALIGN_CYCLE = ['right', 'center', 'left', 'justify'];
const ALIGN_ICONS = { right: AlignRight, center: AlignCenter, left: AlignLeft, justify: AlignJustify };

const ToolbarButton = ({ active, onClick, title, children }) => (
  <button
    type="button"
    title={title}
    onMouseDown={(e) => e.preventDefault()} // keep editor selection/focus on click
    onClick={onClick}
    className={`p-2 rounded-lg transition ${
      active ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'
    }`}
  >
    {children}
  </button>
);

const Toolbar = ({ editor }) => {
  if (!editor) return null;

  const currentAlign = ALIGN_CYCLE.find((a) => editor.isActive({ textAlign: a })) || 'right';
  const AlignIcon = ALIGN_ICONS[currentAlign];
  const isLtrMarked = editor.isActive('direction', { dir: 'ltr' });
  const isRtlMarked = editor.isActive('direction', { dir: 'rtl' });

  const cycleAlign = () => {
    const next = ALIGN_CYCLE[(ALIGN_CYCLE.indexOf(currentAlign) + 1) % ALIGN_CYCLE.length];
    editor.chain().focus().setTextAlign(next).run();
  };

  return (
    <div className="flex items-center flex-wrap gap-1 bg-slate-100 p-1.5 rounded-t-2xl border border-b-0 border-slate-200">
      <ToolbarButton title="غامق" active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton title="مائل" active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton title="تسطير" active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon size={16} />
      </ToolbarButton>

      <span className="w-px h-5 bg-slate-300 mx-1" />

      <ToolbarButton title={`المحاذاة: ${currentAlign} (اضغط للتبديل)`} active={false} onClick={cycleAlign}>
        <AlignIcon size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="اتجاه النص المحدد: من اليسار لليمين (LTR)"
        active={isLtrMarked}
        onClick={() => editor.chain().focus().toggleDirectionMark('ltr').run()}
      >
        <span className="text-[10px] font-black w-6 text-center inline-block">LTR</span>
      </ToolbarButton>
      <ToolbarButton
        title="اتجاه النص المحدد: من اليمين لليسار (RTL)"
        active={isRtlMarked}
        onClick={() => editor.chain().focus().toggleDirectionMark('rtl').run()}
      >
        <span className="text-[10px] font-black w-6 text-center inline-block">RTL</span>
      </ToolbarButton>

      <span className="w-px h-5 bg-slate-300 mx-1" />

      <ToolbarButton title="قائمة نقطية" active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={16} />
      </ToolbarButton>
    </div>
  );
};

// Uncontrolled-content rich text field: TipTap owns the DOM/selection, we
// only read HTML out via onChange. Pass a `resetKey` that changes whenever
// the field should be reloaded from `value` (e.g. modal opens for a
// different item) — remounting is far safer than fighting TipTap's internal
// state with a controlled-value sync on every keystroke.
//
// Exposes `insertContent(html)` via ref for callers that need to inject
// content programmatically (e.g. the AI-assist buttons) without going
// through the value/onChange loop, which this component never re-reads
// from after mount.
export const RichTextEditor = forwardRef(({ value, onChange, placeholder, minHeight = '6rem' }, ref) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        link: false,
      }),
      TextAlign.configure({ types: ['paragraph', 'listItem'], defaultAlignment: 'right' }),
      Direction,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  useImperativeHandle(ref, () => ({
    insertContent: (html) => editor?.chain().focus().insertContent(html).run(),
  }), [editor]);

  return (
    <div dir="rtl">
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        style={{ minHeight }}
        className="rich-editor-content w-full p-4 bg-slate-50 border border-slate-200 rounded-b-2xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white outline-none transition leading-relaxed text-slate-800"
      />
    </div>
  );
});
RichTextEditor.displayName = 'RichTextEditor';
