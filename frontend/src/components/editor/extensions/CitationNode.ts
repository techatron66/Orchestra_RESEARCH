import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citationNode: {
      insertCitation: (attrs: {
        citationId: string;
        refId: string;
        claimText: string;
        chunkIndex: number;
        label: number;
      }) => ReturnType;
    };
  }
}

export const CitationNode = Node.create({
  name: 'citationNode',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      citationId: { default: null },
      refId: { default: '' },
      claimText: { default: '' },
      chunkIndex: { default: 0 },
      label: { default: 1 },
    };
  },

  parseHTML() {
    return [{ tag: 'cite[data-citation-id]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'cite',
      mergeAttributes(HTMLAttributes, {
        'data-citation-id': node.attrs.citationId,
        'data-ref-id': node.attrs.refId,
        'data-chunk-index': node.attrs.chunkIndex,
        class: 'citation-node',
        title: node.attrs.claimText?.slice(0, 100) ?? '',
        contenteditable: 'false',
      }),
      `[${node.attrs.label}]`,
    ];
  },

  addCommands() {
    return {
      insertCitation:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});
