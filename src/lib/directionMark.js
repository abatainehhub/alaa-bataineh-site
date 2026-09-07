import { Mark, mergeAttributes } from '@tiptap/core';

// Inline RTL/LTR direction override — a mark, like Bold/Italic/Underline,
// not a paragraph-level attribute. Applies only to the exact selection, so
// a single English reference inside an Arabic paragraph can be forced LTR
// while the surrounding text stays untouched.
//
// Renders as <span dir="ltr|rtl" style="unicode-bidi: isolate">. The
// unicode-bidi: isolate is deliberate: it makes the marked run establish
// its own bidi context so it doesn't bleed into the surrounding text's
// character/punctuation ordering — without it, mixing an LTR run inside an
// RTL base paragraph (or vice versa) can still visually scramble trailing
// punctuation via the Unicode Bidi Algorithm.
export const Direction = Mark.create({
  name: 'direction',

  addAttributes() {
    return {
      dir: {
        default: null,
        renderHTML: (attributes) => (attributes.dir ? { dir: attributes.dir } : {}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[dir]',
        getAttrs: (element) => {
          const dir = element.getAttribute('dir');
          return dir === 'ltr' || dir === 'rtl' ? { dir } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { style: 'unicode-bidi: isolate' }), 0];
  },

  addCommands() {
    return {
      setDirectionMark:
        (dir) =>
        ({ commands }) =>
          commands.setMark(this.name, { dir }),

      unsetDirectionMark:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),

      // Toggle: applying the same direction again removes the mark
      // (reverts to inherited/paragraph direction); applying the other
      // direction replaces it — same two-state feel as Bold/Italic, just
      // with a direction argument instead of an implicit boolean.
      toggleDirectionMark:
        (dir) =>
        ({ editor, commands }) =>
          editor.isActive(this.name, { dir })
            ? commands.unsetMark(this.name)
            : commands.setMark(this.name, { dir }),
    };
  },
});
