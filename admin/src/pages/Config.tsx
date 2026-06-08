import { useEffect, useRef, useState } from 'react';
import { api, SystemConfig } from '../api';

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function StatusDot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  const color = ok ? 'bg-emerald-400' : warn ? 'bg-amber-400' : 'bg-red-400';
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${color}`} />;
}

function ModeBadge({ mode }: { mode: string }) {
  const styles: Record<string, string> = {
    production: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pilot:      'bg-indigo-50  text-indigo-700  border-indigo-200',
    demo:       'bg-amber-50   text-amber-700   border-amber-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[mode] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {mode}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500 font-medium w-44 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-800 flex-1 text-right flex items-center justify-end gap-2">{children}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-slate-50 last:border-0">
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = 'text', placeholder }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  open, onConfirm, onCancel, loading, error,
}: {
  open: boolean; onConfirm: (key: string) => void; onCancel: () => void; loading: boolean; error: string;
}) {
  const [key, setKey] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setKey(''); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="font-semibold text-slate-900 mb-1">Confirm changes</h3>
        <p className="text-sm text-slate-500 mb-4">Re-enter your admin key to save.</p>
        <input
          ref={inputRef}
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && key && onConfirm(key)}
          placeholder="Admin key"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
        />
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={!key || loading}
            onClick={() => onConfirm(key)}
            className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
          >
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title, editing, onEdit, onCancel, onSave, restartNote, children, editChildren,
}: {
  title: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  restartNote?: boolean;
  children: React.ReactNode;
  editChildren: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
        {!editing ? (
          <button
            onClick={onEdit}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-3">
            <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
            <button onClick={onSave} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Save →</button>
          </div>
        )}
      </div>
      {!editing ? children : (
        <>
          {editChildren}
          {restartNote && (
            <p className="mt-3 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              Changes to these credentials take effect after a backend restart.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type EditingSection = 'app' | 'llm' | 'twilio' | 'cm' | null;

export function Config() {
  const [cfg, setCfg] = useState<SystemConfig | null>(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<EditingSection>(null);
  const [saved, setSaved] = useState(false);

  // Confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, string>>({});

  // App form
  const [appMode, setAppMode] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [piiMasking, setPiiMasking] = useState('true');

  // LLM form
  const [llmProvider, setLlmProvider] = useState('');
  const [llmKey, setLlmKey] = useState('');
  const [claudeModel, setClaudeModel] = useState('');
  const [openaiModel, setOpenaiModel] = useState('');

  // Twilio form
  const [twilioSid, setTwilioSid] = useState('');
  const [twilioToken, setTwilioToken] = useState('');
  const [twilioNumber, setTwilioNumber] = useState('');

  // Channel manager form
  const [cmProvider, setCmProvider] = useState('');
  const [cm1Key, setCm1Key] = useState('');
  const [cm1ChannelId, setCm1ChannelId] = useState('');

  useEffect(() => {
    api.config().then(setCfg).catch((e) => setLoadError(String(e)));
  }, []);

  const reload = () => {
    api.config().then(setCfg).catch(() => {});
  };

  const startEdit = (section: EditingSection) => {
    if (!cfg) return;
    setEditing(section);
    setSaved(false);
    if (section === 'app') {
      setAppMode(cfg.appMode);
      setAppUrl(cfg.appUrl);
      setPiiMasking(cfg.piiMasking ? 'true' : 'false');
    }
    if (section === 'llm') {
      setLlmProvider(cfg.llm.provider);
      setLlmKey('');
      setClaudeModel(cfg.llm.claudeModel);
      setOpenaiModel(cfg.llm.openaiModel);
    }
    if (section === 'twilio') {
      setTwilioSid('');
      setTwilioToken('');
      setTwilioNumber(cfg.twilio.whatsappNumber ?? '');
    }
    if (section === 'cm') {
      setCmProvider(cfg.channelManager.provider);
      setCm1Key('');
      setCm1ChannelId(cfg.channelManager.cm1ChannelId ?? '');
    }
  };

  const buildUpdates = (): Record<string, string> => {
    if (editing === 'app') {
      return { APP_MODE: appMode, APP_URL: appUrl, PII_MASKING_ENABLED: piiMasking };
    }
    if (editing === 'llm') {
      const updates: Record<string, string> = { LLM_PROVIDER: llmProvider };
      if (llmKey) {
        const keyName = llmProvider === 'claude' ? 'ANTHROPIC_API_KEY'
          : llmProvider === 'openai' ? 'OPENAI_API_KEY'
          : llmProvider === 'kimi' ? 'KIMI_API_KEY' : '';
        if (keyName) updates[keyName] = llmKey;
      }
      if (llmProvider === 'claude') updates['CLAUDE_MODEL'] = claudeModel;
      if (llmProvider === 'openai') updates['OPENAI_MODEL'] = openaiModel;
      return updates;
    }
    if (editing === 'twilio') {
      const updates: Record<string, string> = { TWILIO_WHATSAPP_NUMBER: twilioNumber };
      if (twilioSid) updates['TWILIO_ACCOUNT_SID'] = twilioSid;
      if (twilioToken) updates['TWILIO_AUTH_TOKEN'] = twilioToken;
      return updates;
    }
    if (editing === 'cm') {
      const updates: Record<string, string> = { CHANNEL_MANAGER_PROVIDER: cmProvider };
      if (cm1Key) updates['CM1_API_KEY'] = cm1Key;
      if (cm1ChannelId) updates['CM1_CHANNEL_ID'] = cm1ChannelId;
      return updates;
    }
    return {};
  };

  const handleSaveClick = () => {
    setPendingUpdates(buildUpdates());
    setConfirmError('');
    setConfirmOpen(true);
  };

  const handleConfirm = async (key: string) => {
    setConfirmLoading(true);
    setConfirmError('');
    try {
      await api.updateConfig(pendingUpdates, key);
      setConfirmOpen(false);
      setEditing(null);
      setSaved(true);
      reload();
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setConfirmLoading(false);
    }
  };

  if (loadError) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 max-w-lg">
        {loadError}
      </div>
    );
  }

  if (!cfg) return <div className="text-sm text-slate-400">Loading…</div>;

  const llmKeyLabel =
    cfg.llm.provider === 'claude' ? 'Anthropic API key'
    : cfg.llm.provider === 'openai' ? 'OpenAI API key'
    : cfg.llm.provider === 'kimi' ? 'Kimi API key'
    : 'API key';

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Config</h1>
          <p className="text-sm text-slate-400 mt-0.5">Click <strong>Edit</strong> on any section — changes save to the database and persist across restarts.</p>
        </div>
        {saved && (
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1 font-medium">
            Saved ✓
          </span>
        )}
      </div>

      {/* Application */}
      <Section
        title="Application"
        editing={editing === 'app'}
        onEdit={() => startEdit('app')}
        onCancel={() => setEditing(null)}
        onSave={handleSaveClick}
        editChildren={
          <>
            <Field label="App mode">
              <Select value={appMode} onChange={setAppMode} options={[
                { value: 'demo', label: 'demo — Twilio sandbox, allowlisted numbers only' },
                { value: 'pilot', label: 'pilot — real Twilio number, manual onboarding' },
                { value: 'production', label: 'production — channel manager active' },
              ]} />
            </Field>
            <Field label="App URL">
              <Input value={appUrl} onChange={setAppUrl} placeholder="https://yourdomain.com" />
            </Field>
            <Field label="PII masking">
              <Select value={piiMasking} onChange={setPiiMasking} options={[
                { value: 'true', label: 'On — guest phones never sent to LLM' },
                { value: 'false', label: 'Off' },
              ]} />
            </Field>
          </>
        }
      >
        <Row label="Mode"><ModeBadge mode={cfg.appMode} /></Row>
        <Row label="App URL">
          <span className="font-mono text-xs text-slate-600 truncate max-w-xs">{cfg.appUrl}</span>
        </Row>
        <Row label="PII masking">
          <StatusDot ok={cfg.piiMasking} />
          <span>{cfg.piiMasking ? 'On' : 'Off'}</span>
        </Row>
        <Row label="Admin key">
          <StatusDot ok={cfg.admin.apiKeySet} />
          <span>{cfg.admin.apiKeySet ? 'Set' : 'Not set — API is open access'}</span>
        </Row>
        <div className="mt-3 bg-slate-50 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-500 mb-1 font-medium">Webhook URL</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-700 truncate">{cfg.appUrl}/webhook/whatsapp</span>
            <button
              onClick={() => navigator.clipboard.writeText(`${cfg.appUrl}/webhook/whatsapp`)}
              className="text-xs text-indigo-600 hover:text-indigo-800 flex-shrink-0 font-medium"
            >
              Copy
            </button>
          </div>
        </div>
      </Section>

      {/* LLM */}
      <Section
        title="AI / LLM"
        editing={editing === 'llm'}
        onEdit={() => startEdit('llm')}
        onCancel={() => setEditing(null)}
        onSave={handleSaveClick}
        restartNote
        editChildren={
          <>
            <Field label="Provider">
              <Select value={llmProvider} onChange={setLlmProvider} options={[
                { value: 'mock', label: 'mock — no real AI, knowledge base only' },
                { value: 'claude', label: 'claude — Anthropic (recommended)' },
                { value: 'openai', label: 'openai — OpenAI GPT' },
                { value: 'kimi', label: 'kimi — Moonshot' },
              ]} />
            </Field>
            {llmProvider !== 'mock' && (
              <Field label={llmKeyLabel}>
                <Input type="password" value={llmKey} onChange={setLlmKey} placeholder="Leave blank to keep current" />
              </Field>
            )}
            {llmProvider === 'claude' && (
              <Field label="Claude model">
                <Input value={claudeModel} onChange={setClaudeModel} placeholder="claude-sonnet-4-6" />
              </Field>
            )}
            {llmProvider === 'openai' && (
              <Field label="OpenAI model">
                <Input value={openaiModel} onChange={setOpenaiModel} placeholder="gpt-4o-mini" />
              </Field>
            )}
          </>
        }
      >
        <Row label="Provider">
          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{cfg.llm.provider}</span>
          {cfg.llm.provider === 'mock' && <span className="text-xs text-amber-600">No real AI</span>}
        </Row>
        <Row label="Model">
          <span className="font-mono text-xs text-slate-600">{cfg.llm.model}</span>
        </Row>
        <Row label="API key">
          <StatusDot ok={cfg.llm.apiKeySet} />
          {cfg.llm.apiKeySet
            ? <span className="font-mono text-xs text-slate-500">{cfg.llm.apiKey}</span>
            : <span className="text-amber-600 text-xs">Not set</span>}
        </Row>
      </Section>

      {/* Twilio */}
      <Section
        title="Twilio / WhatsApp"
        editing={editing === 'twilio'}
        onEdit={() => startEdit('twilio')}
        onCancel={() => setEditing(null)}
        onSave={handleSaveClick}
        restartNote
        editChildren={
          <>
            <Field label="Account SID">
              <Input value={twilioSid} onChange={setTwilioSid} placeholder="Leave blank to keep current" />
            </Field>
            <Field label="Auth token">
              <Input type="password" value={twilioToken} onChange={setTwilioToken} placeholder="Leave blank to keep current" />
            </Field>
            <Field label="WhatsApp number">
              <Input value={twilioNumber} onChange={setTwilioNumber} placeholder="whatsapp:+14155238886" />
            </Field>
          </>
        }
      >
        <Row label="Account SID">
          <StatusDot ok={!!cfg.twilio.accountSid} />
          {cfg.twilio.accountSid
            ? <span className="font-mono text-xs text-slate-500">{cfg.twilio.accountSid}</span>
            : <span className="text-amber-600 text-xs">Not set</span>}
        </Row>
        <Row label="Auth token">
          <StatusDot ok={cfg.twilio.authTokenSet} />
          <span>{cfg.twilio.authTokenSet ? 'Set' : 'Not set'}</span>
        </Row>
        <Row label="WhatsApp number">
          {cfg.twilio.whatsappNumber
            ? <span className="font-mono text-xs text-slate-600">{cfg.twilio.whatsappNumber}</span>
            : <span className="text-amber-600 text-xs">Not set</span>}
        </Row>
        <Row label="Webhook validation">
          <StatusDot ok={cfg.twilio.webhookValidation} warn={!cfg.twilio.webhookValidation} />
          <span>{cfg.twilio.webhookValidation ? 'Enabled' : 'Disabled (set true in production)'}</span>
        </Row>
      </Section>

      {/* Channel Manager */}
      <Section
        title="Channel Manager"
        editing={editing === 'cm'}
        onEdit={() => startEdit('cm')}
        onCancel={() => setEditing(null)}
        onSave={handleSaveClick}
        restartNote
        editChildren={
          <>
            <Field label="Provider">
              <Select value={cmProvider} onChange={setCmProvider} options={[
                { value: 'mock', label: 'mock — fixture data only' },
                { value: 'airbnb', label: 'airbnb — requires Partner API approval' },
                { value: 'cm1', label: 'cm1 — custom channel manager (slot 1)' },
              ]} />
            </Field>
            {cmProvider === 'cm1' && (
              <>
                <Field label="CM1 API key">
                  <Input type="password" value={cm1Key} onChange={setCm1Key} placeholder="Leave blank to keep current" />
                </Field>
                <Field label="CM1 channel ID">
                  <Input value={cm1ChannelId} onChange={setCm1ChannelId} />
                </Field>
              </>
            )}
          </>
        }
      >
        <Row label="Provider">
          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{cfg.channelManager.provider}</span>
          {cfg.channelManager.provider === 'mock' && (
            <span className="text-xs text-amber-600">Mock data only</span>
          )}
        </Row>
        <Row label="Credentials">
          <StatusDot ok={cfg.channelManager.configured} warn={cfg.channelManager.provider === 'mock'} />
          <span>{cfg.channelManager.configured ? 'Configured' : cfg.channelManager.provider === 'mock' ? 'Not needed (mock)' : 'Not set'}</span>
        </Row>
        {cfg.channelManager.cm1ChannelId && (
          <Row label="CM1 channel ID">
            <span className="font-mono text-xs text-slate-600">{cfg.channelManager.cm1ChannelId}</span>
          </Row>
        )}
      </Section>

      <ConfirmModal
        open={confirmOpen}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        loading={confirmLoading}
        error={confirmError}
      />
    </div>
  );
}
