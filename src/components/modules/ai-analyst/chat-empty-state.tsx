import { useTranslation } from "react-i18next";
import { Link } from "react-router";

interface ChatEmptyStateProps {
  agentEnabled: boolean;
  onSendMessage: (message: string) => void;
}

interface CapabilityCardProps {
  hint?: string;
  icon: string;
  prompts: Array<{ key: string; textKey: string }>;
  title: string;
  variant?: "featured" | "default";
}

function CapabilityCard({
  hint,
  icon,
  prompts,
  title,
  variant = "default",
}: CapabilityCardProps) {
  const { t } = useTranslation();
  const isFeatured = variant === "featured";

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl p-4 ${
        isFeatured
          ? "border border-primary/30 bg-primary/5"
          : "bg-surface-container-lowest"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className="material-symbols-outlined text-primary text-xl"
          style={isFeatured ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          {icon}
        </span>
        <span className="font-bold text-on-surface text-sm">{title}</span>
      </div>
      {hint && (
        <p className="flex items-center gap-1 text-primary text-xs">
          <span className="material-symbols-outlined text-xs">
            auto_awesome
          </span>
          {hint}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {prompts.map((prompt) => (
          <button
            className="rounded-lg px-2.5 py-1.5 text-left text-on-surface-variant text-xs transition-colors hover:bg-surface-container-high"
            key={prompt.key}
            onClick={() => {
              // noop - parent handles via quick prompts
            }}
            type="button"
          >
            {t(prompt.textKey)}
          </button>
        ))}
      </div>
    </div>
  );
}

const QUICK_PROMPTS = [
  {
    icon: "shopping_cart",
    key: "daily_revenue",
    textKey: "ai_agent_prompt_daily_revenue_text",
  },
  {
    icon: "database",
    key: "low_stock",
    textKey: "ai_agent_prompt_low_stock_text",
  },
  {
    icon: "pie_chart",
    key: "profit_margin",
    textKey: "ai_agent_prompt_profit_margin_text",
  },
] as const;

export default function ChatEmptyState({
  agentEnabled,
  onSendMessage,
}: ChatEmptyStateProps) {
  const { t } = useTranslation();

  if (!agentEnabled) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm rounded-2xl bg-surface-container-lowest p-6 text-center shadow-sm">
          <span className="material-symbols-outlined mb-3 text-4xl text-on-surface-variant">
            smart_toy
          </span>
          <h3 className="mb-2 font-bold text-lg text-on-surface">
            {t("ai_agent_disabled")}
          </h3>
          <p className="mb-4 text-on-surface-variant text-sm">
            {t("ai_agent_disabled_desc")}
          </p>
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-on-primary text-sm transition-colors hover:opacity-90"
            to="/settings?tab=ai"
          >
            <span className="material-symbols-outlined text-base">
              settings
            </span>
            {t("ai_agent_open_settings")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h2 className="mb-2 font-bold font-headline text-2xl text-on-surface">
            {t("ai_agent_empty_welcome")}
          </h2>
          <p className="text-on-surface-variant text-sm">
            {t("ai_agent_empty_desc")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <CapabilityCard
              hint={t("ai_agent_empty_featured_hint")}
              icon="monitoring"
              prompts={[
                {
                  key: "today_summary",
                  textKey: "ai_agent_prompt_today_summary_text",
                },
                {
                  key: "sales_trend",
                  textKey: "ai_agent_prompt_sales_trend_text",
                },
                {
                  key: "top_products",
                  textKey: "ai_agent_prompt_top_products_text",
                },
              ]}
              title={t("ai_agent_empty_sales")}
              variant="featured"
            />
          </div>

          <CapabilityCard
            icon="inventory_2"
            prompts={[
              {
                key: "stock_level",
                textKey: "ai_agent_prompt_stock_level_text",
              },
              {
                key: "inventory_check",
                textKey: "ai_agent_prompt_inventory_check_text",
              },
            ]}
            title={t("ai_agent_empty_inventory")}
          />
          <CapabilityCard
            icon="person"
            prompts={[
              {
                key: "top_customers",
                textKey: "ai_agent_prompt_top_customers_text",
              },
              {
                key: "customer_history",
                textKey: "ai_agent_prompt_customer_history_text",
              },
            ]}
            title={t("ai_agent_empty_customers")}
          />
          <CapabilityCard
            icon="pie_chart"
            prompts={[
              {
                key: "profit_report",
                textKey: "ai_agent_prompt_profit_report_text",
              },
              { key: "expenses", textKey: "ai_agent_prompt_expenses_text" },
            ]}
            title={t("ai_agent_empty_finance")}
          />
        </div>

        <div>
          <p className="mb-3 font-bold text-on-surface-variant text-xs uppercase tracking-wider">
            {t("ai_agent_empty_quick_tip")}
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-2 font-medium text-on-surface-variant text-xs transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                key={prompt.key}
                onClick={() => {
                  onSendMessage(t(prompt.textKey));
                }}
                type="button"
              >
                <span className="material-symbols-outlined text-sm">
                  {prompt.icon}
                </span>
                {t(`ai_agent_prompt_${prompt.key}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
