'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import * as Slider from '@radix-ui/react-slider';
import { useConfigStore, type AppConfig } from '@/store/configStore';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const JOURNALS = ['Nature', 'Science', 'IEEE', 'APA', 'Cell', 'PNAS'];
const CITATIONS = ['IEEE', 'APA', 'Chicago', 'Vancouver', 'MLA'];
const PROFILES = ['Academic/Formal', 'Technical', 'Explanatory', 'Review'];
const VOICES = ['Third Person', 'First Person', 'Passive'];

export default function InstructionLedger({ open, onClose, onSaved }: Props) {
  const { config, updateConfig } = useConfigStore();
  const [tab, setTab] = useState(0);
  const [local, setLocal] = useState<AppConfig>(config);

  const tabs = ['Project', 'Tone', 'Rigor'];

  const save = async () => {
    await updateConfig(local as never);
    onSaved();
    onClose();
  };

  const set = (section: keyof AppConfig, key: string, value: unknown) => {
    setLocal((prev) => ({
      ...prev,
      [section]: { ...(prev[section] as Record<string, unknown>), [key]: value },
    }));
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-7 w-[460px] max-h-[80vh] overflow-y-auto shadow-[0_24px_60px_rgba(0,0,0,0.16)]">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="font-serif text-[22px] font-semibold text-[var(--text-1)]">
                Instruction Ledger
              </Dialog.Title>
              <Dialog.Close className="text-[var(--text-3)] hover:text-[var(--text-1)] text-lg leading-none">✕</Dialog.Close>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6">
              {tabs.map((t, i) => (
                <button
                  key={t}
                  onClick={() => setTab(i)}
                  className={`px-3 py-1.5 rounded-md font-mono text-[9.5px] border transition-all ${
                    tab === i
                      ? 'bg-[var(--text-1)] text-white border-transparent'
                      : 'bg-white text-[var(--text-2)] border-black/8 hover:bg-stone-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Project */}
            {tab === 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormGroup label="Target Journal">
                    <select
                      className="w-full px-2.5 py-2 border border-black/10 rounded-lg font-mono text-[10.5px] text-[var(--text-1)] bg-white outline-none focus:border-blue-400"
                      value={local.project.target_journal}
                      onChange={(e) => set('project', 'target_journal', e.target.value)}
                    >
                      {JOURNALS.map((j) => <option key={j}>{j}</option>)}
                    </select>
                  </FormGroup>
                  <FormGroup label="Citation Standard">
                    <select
                      className="w-full px-2.5 py-2 border border-black/10 rounded-lg font-mono text-[10.5px] text-[var(--text-1)] bg-white outline-none focus:border-blue-400"
                      value={local.project.citation_standard}
                      onChange={(e) => set('project', 'citation_standard', e.target.value)}
                    >
                      {CITATIONS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </FormGroup>
                </div>
                <FormGroup label="Research Field">
                  <input
                    type="text"
                    className="w-full px-2.5 py-2 border border-black/10 rounded-lg font-mono text-[10.5px] text-[var(--text-1)] outline-none focus:border-blue-400"
                    value={local.project.field}
                    onChange={(e) => set('project', 'field', e.target.value)}
                  />
                </FormGroup>
              </div>
            )}

            {/* Tone */}
            {tab === 1 && (
              <div className="space-y-4">
                <FormGroup label="Writing Profile">
                  <select
                    className="w-full px-2.5 py-2 border border-black/10 rounded-lg font-mono text-[10.5px] text-[var(--text-1)] bg-white outline-none focus:border-blue-400"
                    value={local.tone.profile}
                    onChange={(e) => set('tone', 'profile', e.target.value)}
                  >
                    {PROFILES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </FormGroup>
                <FormGroup label="Voice">
                  <select
                    className="w-full px-2.5 py-2 border border-black/10 rounded-lg font-mono text-[10.5px] text-[var(--text-1)] bg-white outline-none focus:border-blue-400"
                    value={local.tone.voice}
                    onChange={(e) => set('tone', 'voice', e.target.value)}
                  >
                    {VOICES.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </FormGroup>
              </div>
            )}

            {/* Rigor */}
            {tab === 2 && (
              <div className="space-y-5">
                <FormGroup label={`Scientific Rigor — ${local.rigor.level}/10`}>
                  <Slider.Root
                    className="relative flex items-center select-none touch-none w-full h-5"
                    min={1} max={10} step={1}
                    value={[local.rigor.level]}
                    onValueChange={([v]) => set('rigor', 'level', v)}
                  >
                    <Slider.Track className="bg-black/8 relative grow rounded-full h-1">
                      <Slider.Range className="absolute bg-[var(--text-1)] rounded-full h-full" />
                    </Slider.Track>
                    <Slider.Thumb className="block w-4 h-4 bg-white shadow-md rounded-full border border-black/10 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </Slider.Root>
                </FormGroup>

                {[
                  { key: 'require_citations', label: 'Require Citations' },
                  { key: 'flag_unverified_claims', label: 'Flag Unverified Claims' },
                  { key: 'peer_review_mode', label: 'Peer Review Mode' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[var(--text-2)]">{label}</span>
                    <Switch.Root
                      checked={local.rigor[key as keyof typeof local.rigor] as boolean}
                      onCheckedChange={(v) => set('rigor', key, v)}
                      className="w-9 h-5 rounded-full bg-stone-200 data-[state=checked]:bg-green-500 relative outline-none cursor-pointer transition-colors"
                    >
                      <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow-sm transition-transform translate-x-0.5 data-[state=checked]:translate-x-4" />
                    </Switch.Root>
                  </div>
                ))}

                <FormGroup label="Max Hallucination Score">
                  <input
                    type="number"
                    min={0.01} max={0.2} step={0.01}
                    className="w-full px-2.5 py-2 border border-black/10 rounded-lg font-mono text-[10.5px] text-[var(--text-1)] outline-none focus:border-blue-400"
                    value={local.rigor.max_hallucination_score}
                    onChange={(e) => set('rigor', 'max_hallucination_score', parseFloat(e.target.value))}
                  />
                </FormGroup>
              </div>
            )}

            <button
              onClick={save}
              className="w-full mt-6 py-2.5 bg-[var(--text-1)] text-white font-mono text-[11px] rounded-xl hover:bg-stone-800 transition-colors"
            >
              Save Configuration
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FormGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-[9.5px] text-[var(--text-2)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
