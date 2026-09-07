import { Extension } from '@tiptap/core';

// Per-block RTL/LTR direction — TipTap ships nothing for this. Adds a `dir`
// attribute to paragraph and listItem nodes, independent per block, so one
// paragraph can be LTR while its siblings stay RTL in the same field.
export const BLOCK_TYPES = ['paragraph', 'listItem'];

export const Direction = Extension.create({
  name: 'direction',

  addGlobalAttributes() {
    return [
      {
        types: BLOCK_TYPES,
        attributes: {
          dir: {
            default: null,
            parseHTML: (element) => element.getAttribute('dir'),
            renderHTML: (attributes) =>
              attributes.dir ? { dir: attributes.dir } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setDirection:
        (direction) =>
        ({ commands }) =>
          BLOCK_TYPES.every((type) => commands.updateAttributes(type, { dir: direction })),

      toggleDirection:
        () =>
        ({ editor, commands }) => {
          const current =
            BLOCK_TYPES.map((type) => editor.getAttributes(type)?.dir).find(Boolean) || 'rtl';
          const next = current === 'rtl' ? 'ltr' : 'rtl';
          return BLOCK_TYPES.every((type) => commands.updateAttributes(type, { dir: next }));
        },
    };
  },
});
