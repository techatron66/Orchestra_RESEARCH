import { Mark, mergeAttributes } from '@tiptap/core';

export const VerifiedMark = Mark.create({
  name: 'verifiedMark',
  priority: 999,

  addAttributes() {
    return {
      claimId: { default: null },
      verifiedBy: { default: '' },
      confidence: { default: 1.0 },
      refId: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-verified]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const confidence = parseFloat(HTMLAttributes.confidence ?? '1.0');
    const level = confidence >= 0.85 ? 'high' : 'low';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-verified': 'true',
        'data-confidence': level,
        class: 'verified-mark',
        title: `Verified by ${HTMLAttributes.verifiedBy} (${Math.round(confidence * 100)}%)`,
      }),
      0,
    ];
  },
});
