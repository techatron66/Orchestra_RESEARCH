import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const scrutinyKey = new PluginKey('scrutiny');

/**
 * ScrutinyExtension: when enabled, adds left-border decorations to paragraphs
 * based on their data-source attribute (original / verified / flagged).
 * Decorations are re-computed on every doc change when scrutiny is active.
 */
export const ScrutinyExtension = Extension.create({
  name: 'scrutinyExtension',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: scrutinyKey,
        state: {
          init: () => ({ active: false }),
          apply: (tr, prev) => {
            const meta = tr.getMeta(scrutinyKey);
            if (meta !== undefined) return { active: meta };
            return prev;
          },
        },
        props: {
          decorations(state) {
            const pluginState = scrutinyKey.getState(state) as { active: boolean } | null;
            if (!pluginState?.active) return DecorationSet.empty;

            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name !== 'paragraph') return;

              // Determine source from first mark named verifiedMark
              let source = 'original';
              node.forEach((child) => {
                child.marks.forEach((mark) => {
                  if (mark.type.name === 'verifiedMark') {
                    source = mark.attrs.confidence >= 0.85 ? 'verified' : 'flagged';
                  }
                  if (mark.type.name === 'ghostMark') {
                    source = 'flagged';
                  }
                });
              });

              const colorMap: Record<string, string> = {
                original: 'rgba(37,99,235,0.25)',
                verified: 'rgba(5,150,105,0.25)',
                flagged: 'rgba(220,38,38,0.25)',
              };
              const bgMap: Record<string, string> = {
                original: 'rgba(37,99,235,0.04)',
                verified: 'rgba(5,150,105,0.04)',
                flagged: 'rgba(220,38,38,0.04)',
              };

              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  style: [
                    `border-left: 2px solid ${colorMap[source] ?? colorMap.original}`,
                    `background: ${bgMap[source] ?? 'transparent'}`,
                    'padding-left: 9px',
                    'margin-left: -11px',
                    'border-radius: 0 3px 3px 0',
                    'transition: all 0.2s',
                  ].join(';'),
                }),
              );
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setScrutinyMode:
        (active: boolean) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(scrutinyKey, active);
            dispatch(tr);
          }
          return true;
        },
    } as never;
  },
});
