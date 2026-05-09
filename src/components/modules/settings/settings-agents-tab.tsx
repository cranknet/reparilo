import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useModalEffects } from "@/hooks/use-modal-effects";
import api from "@/lib/api";

interface AgentDefinition {
  createdAt: string;
  displayName: string;
  enabledHostedTools: string[];
  handoffKeywords: string[];
  id: string;
  instructions: string;
  isActive: boolean;
  isBuiltIn: boolean;
  model: string | null;
  name: string;
  temperature: number | null;
  toolNames: string[];
  updatedAt: string;
  vectorStoreId: string | null;
}

interface AgentFormData {
  displayName: string;
  enabledHostedTools: string[];
  handoffKeywords: string;
  id?: string;
  instructions: string;
  isActive: boolean;
  model: string;
  name: string;
  temperature: string;
  toolNames: string[];
  vectorStoreId: string;
}

const EMPTY_FORM: AgentFormData = {
  displayName: "",
  enabledHostedTools: [],
  handoffKeywords: "",
  instructions: "",
  isActive: true,
  model: "",
  name: "",
  temperature: "",
  toolNames: [],
  vectorStoreId: "",
};

const LOCAL_TOOLS = ["queryDatabase", "getSchema"];
const HOSTED_TOOLS = ["web_search", "file_search"];

function AgentRow({
  agent,
  onEdit,
  onDelete,
  t,
}: {
  agent: AgentDefinition;
  onDelete: () => void;
  onEdit: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-surface-container-low p-4 transition-colors hover:bg-surface-container-high/60">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-on-surface text-sm">
            {agent.displayName}
          </span>
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-mono text-on-surface-variant text-xs">
            {agent.name}
          </span>
          {agent.isBuiltIn && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary text-xs uppercase">
              {t("ai_defs_built_in")}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium text-xs ${agent.isActive ? "bg-success/10 text-success" : "bg-on-surface-variant/10 text-on-surface-variant"}`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${agent.isActive ? "bg-success" : "bg-on-surface-variant/40"}`}
            />
            {agent.isActive ? t("status_active") : t("status_inactive")}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-on-surface-variant text-xs">
          {agent.instructions || t("ai_defs_instructions_placeholder")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          aria-label={`${t("ai_defs_edit")} ${agent.displayName}`}
          className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg p-2 text-on-surface-variant text-xs transition-colors hover:bg-surface-container hover:text-primary"
          onClick={onEdit}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">edit</span>
        </button>
        <button
          aria-label={`${t("delete")} ${agent.displayName}`}
          className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg p-2 text-on-surface-variant text-xs transition-colors hover:bg-surface-container hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
          disabled={agent.isBuiltIn}
          onClick={onDelete}
          title={agent.isBuiltIn ? t("ai_defs_built_in") : undefined}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </div>
    </div>
  );
}

function AgentForm({
  initial,
  isEdit,
  onCancel,
  onSaved,
  t,
}: {
  initial: AgentFormData;
  isEdit: boolean;
  onCancel: () => void;
  onSaved: () => void;
  t: (key: string) => string;
}) {
  const [form, setForm] = useState<AgentFormData>(initial);
  const [saving, setSaving] = useState(false);

  function toggleLocalTool(tool: string) {
    setForm((f) => ({
      ...f,
      toolNames: f.toolNames.includes(tool)
        ? f.toolNames.filter((t) => t !== tool)
        : [...f.toolNames, tool],
    }));
  }

  function toggleHostedTool(tool: string) {
    setForm((f) => ({
      ...f,
      enabledHostedTools: f.enabledHostedTools.includes(tool)
        ? f.enabledHostedTools.filter((t) => t !== tool)
        : [...f.enabledHostedTools, tool],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        handoffKeywords: form.handoffKeywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        model: form.model || undefined,
        temperature: form.temperature ? Number(form.temperature) : undefined,
        vectorStoreId: form.vectorStoreId || undefined,
      };
      if (isEdit && initial.id) {
        await api.put(`/ai/definitions/${initial.id}`, payload);
        toast.success(t("ai_defs_updated"));
      } else {
        await api.post("/ai/definitions", payload);
        toast.success(t("ai_defs_created"));
      }
      onSaved();
    } catch {
      toast.error(t("settings_save_error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <label
            className="block font-semibold text-on-surface text-sm"
            htmlFor="agent-display-name"
          >
            {t("ai_defs_display_name")}
          </label>
          <input
            className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
            id="agent-display-name"
            onChange={(e) =>
              setForm((f) => ({ ...f, displayName: e.target.value }))
            }
            placeholder={t("ai_defs_display_name_placeholder")}
            required
            value={form.displayName}
          />
        </div>
        <div className="space-y-2">
          <label
            className="block font-semibold text-on-surface text-sm"
            htmlFor="agent-name"
          >
            {t("ai_defs_name")}
          </label>
          <input
            className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            disabled={isEdit}
            id="agent-name"
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t("ai_defs_name_placeholder")}
            required
            value={form.name}
          />
          <p className="text-on-surface-variant text-xs">
            {t("ai_defs_name_help")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <label
            className="block font-semibold text-on-surface text-sm"
            htmlFor="agent-model"
          >
            {t("ai_defs_model")}
          </label>
          <input
            className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
            id="agent-model"
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            placeholder={t("ai_defs_model_placeholder")}
            value={form.model}
          />
          <p className="text-on-surface-variant text-xs">
            {t("ai_defs_model_help")}
          </p>
        </div>
        <div className="space-y-2">
          <label
            className="block font-semibold text-on-surface text-sm"
            htmlFor="agent-temperature"
          >
            {t("ai_defs_temperature")}
          </label>
          <input
            className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
            id="agent-temperature"
            max="2"
            min="0"
            onChange={(e) =>
              setForm((f) => ({ ...f, temperature: e.target.value }))
            }
            placeholder="0.7"
            step="0.1"
            type="number"
            value={form.temperature}
          />
          <p className="text-on-surface-variant text-xs">
            {t("ai_defs_temperature_help")}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label
          className="block font-semibold text-on-surface text-sm"
          htmlFor="agent-instructions"
        >
          {t("ai_defs_instructions")}
        </label>
        <textarea
          className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
          id="agent-instructions"
          onChange={(e) =>
            setForm((f) => ({ ...f, instructions: e.target.value }))
          }
          placeholder={t("ai_defs_instructions_placeholder")}
          rows={5}
          value={form.instructions}
        />
        <p className="text-on-surface-variant text-xs">
          {t("ai_defs_instructions_help")}
        </p>
      </div>

      <div className="rounded-2xl bg-surface-container-low p-5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-on-surface text-sm">
            {t("ai_defs_active")}
          </span>
          <button
            aria-checked={form.isActive}
            aria-label={t("ai_defs_active")}
            className="relative h-6 w-11 rounded-full transition-colors"
            onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
            role="switch"
            style={{
              backgroundColor: form.isActive
                ? "var(--color-primary)"
                : "var(--color-outline-variant)",
            }}
            type="button"
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-on-primary shadow-sm transition-all"
              style={{ insetInlineStart: form.isActive ? "22px" : "2px" }}
            />
          </button>
        </div>
        <p className="mt-1 text-on-surface-variant text-xs">
          {t("ai_defs_active_desc")}
        </p>
      </div>

      <div className="rounded-2xl bg-surface-container-low p-5">
        <h4 className="font-semibold text-on-surface text-sm">
          {t("ai_defs_tools")}
        </h4>
        <div className="mt-3 space-y-2">
          {LOCAL_TOOLS.map((tool) => (
            <label
              className="flex cursor-pointer items-center gap-3"
              key={tool}
            >
              <input
                checked={form.toolNames.includes(tool)}
                className="h-4 w-4 rounded accent-primary"
                onChange={() => toggleLocalTool(tool)}
                type="checkbox"
              />
              <span className="text-on-surface text-sm">{tool}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-surface-container-low p-5">
        <h4 className="font-semibold text-on-surface text-sm">
          {t("ai_defs_hosted_tools")}
        </h4>
        <div className="mt-3 space-y-2">
          {HOSTED_TOOLS.map((tool) => (
            <label
              className="flex cursor-pointer items-center gap-3"
              key={tool}
            >
              <input
                checked={form.enabledHostedTools.includes(tool)}
                className="h-4 w-4 rounded accent-primary"
                onChange={() => toggleHostedTool(tool)}
                type="checkbox"
              />
              <span className="text-on-surface text-sm">
                {tool === "web_search"
                  ? t("ai_defs_hosted_web_search")
                  : t("ai_defs_hosted_file_search")}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label
          className="block font-semibold text-on-surface text-sm"
          htmlFor="agent-keywords"
        >
          {t("ai_defs_keywords")}
        </label>
        <input
          className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
          id="agent-keywords"
          onChange={(e) =>
            setForm((f) => ({ ...f, handoffKeywords: e.target.value }))
          }
          placeholder={t("ai_defs_keywords_placeholder")}
          value={form.handoffKeywords}
        />
        <p className="text-on-surface-variant text-xs">
          {t("ai_defs_keywords_help")}
        </p>
      </div>

      <div className="space-y-2">
        <label
          className="block font-semibold text-on-surface text-sm"
          htmlFor="agent-vector-store"
        >
          {t("ai_defs_vector_store_id")}
        </label>
        <input
          className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
          id="agent-vector-store"
          onChange={(e) =>
            setForm((f) => ({ ...f, vectorStoreId: e.target.value }))
          }
          placeholder={t("ai_defs_vector_store_placeholder")}
          value={form.vectorStoreId}
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          className="flex min-h-11 items-center gap-2 rounded-xl bg-surface-container px-5 py-2.5 font-bold text-on-surface-variant text-sm transition-all hover:bg-surface-container-high"
          onClick={onCancel}
          type="button"
        >
          {t("cancel")}
        </button>
        <button
          className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-on-primary text-sm transition-all active:opacity-80 disabled:opacity-60"
          disabled={saving}
          type="submit"
        >
          {saving && (
            <span className="material-symbols-outlined animate-spin text-[18px]">
              progress_activity
            </span>
          )}
          {t("save")}
        </button>
      </div>
    </form>
  );
}

export default function SettingsAgentsTab() {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentDefinition | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<AgentDefinition | null>(
    null
  );
  const deleteDialogRef = useRef<HTMLDivElement>(null);

  useModalEffects(
    deleteTarget !== null,
    () => setDeleteTarget(null),
    deleteDialogRef
  );

  const fetchAgents = useCallback(async () => {
    try {
      const res = await api.get<AgentDefinition[]>("/ai/definitions");
      setAgents(res.data);
    } catch {
      toast.error(t("settings_save_error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAgents().catch(() => {
      // Error handled by toast in fetchAgents
    });
  }, [fetchAgents]);

  function handleEdit(agent: AgentDefinition) {
    setEditingAgent(agent);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingAgent(null);
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }
    try {
      await api.delete(`/ai/definitions/${deleteTarget.id}`);
      toast.success(t("ai_defs_deleted"));
      setDeleteTarget(null);
      await fetchAgents();
    } catch {
      toast.error(t("settings_save_error"));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  if (showForm) {
    const formInitial: AgentFormData = editingAgent
      ? {
          displayName: editingAgent.displayName,
          enabledHostedTools: editingAgent.enabledHostedTools,
          handoffKeywords: editingAgent.handoffKeywords.join(", "),
          id: editingAgent.id,
          instructions: editingAgent.instructions,
          isActive: editingAgent.isActive,
          model: editingAgent.model ?? "",
          name: editingAgent.name,
          temperature: editingAgent.temperature?.toString() ?? "",
          toolNames: editingAgent.toolNames,
          vectorStoreId: editingAgent.vectorStoreId ?? "",
        }
      : { ...EMPTY_FORM };

    return (
      <AgentForm
        initial={formInitial}
        isEdit={!!editingAgent}
        onCancel={handleFormClose}
        onSaved={() => {
          handleFormClose();
          fetchAgents().catch(() => {
            // Error handled by toast in fetchAgents
          });
        }}
        t={t}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-on-primary text-sm transition-all active:opacity-80"
          onClick={() => setShowForm(true)}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t("ai_defs_add")}
        </button>
      </div>
      {agents.length === 0 ? (
        <div className="rounded-2xl bg-surface-container-low py-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">
            smart_toy
          </span>
          <p className="mt-3 font-semibold text-on-surface-variant text-sm">
            {t("ai_defs_empty")}
          </p>
          <p className="mt-1 text-on-surface-variant text-xs">
            {t("ai_defs_empty_desc")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <AgentRow
              agent={agent}
              key={agent.id}
              onDelete={() => setDeleteTarget(agent)}
              onEdit={() => handleEdit(agent)}
              t={t}
            />
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-on-surface/40">
          <div
            className="relative z-[60] mx-4 w-full max-w-[360px] overflow-y-auto rounded-2xl bg-surface-container-lowest shadow-2xl"
            ref={deleteDialogRef}
          >
            <div className="px-6 py-6">
              <h3 className="font-bold font-headline text-lg text-on-surface">
                {t("ai_defs_delete_confirm_title")}
              </h3>
              <p className="mt-2 text-on-surface-variant text-sm">
                {t("ai_defs_delete_confirm_desc")}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4">
              <button
                className="flex min-h-11 items-center gap-2 rounded-xl bg-surface-container px-5 py-2.5 font-bold text-on-surface-variant text-sm transition-all hover:bg-surface-container-high"
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="flex min-h-11 items-center gap-2 rounded-xl bg-error px-5 py-2.5 font-bold text-on-error text-sm transition-all active:opacity-80"
                onClick={handleDelete}
                type="button"
              >
                {t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
