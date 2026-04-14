import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ghostMark: {
      setGhostMark: (attrs: { paragraphId: string; generatedBy: string }) => ReturnType;
      unsetGhostMark: () => ReturnType;
    };
  }
}

export const GhostMark = Mark.create({
  name: 'ghostMark',
  priority: 1000,

  addAttributes() {
    return {
      paragraphId: { default: null },
      generatedBy: { default: 'kimi-k2.5' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-ghost]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-ghost': 'true',
        class: 'ghost-mark',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setGhostMark:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetGhostMark:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
