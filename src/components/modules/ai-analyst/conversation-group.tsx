import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface ConversationGroupProps {
  children: ReactNode;
  label: string;
}

function Group({ children, label }: ConversationGroupProps) {
  return (
    <div>
      <h4 className="mt-4 mb-2 px-3 font-bold text-on-surface-variant text-xs uppercase tracking-wider first:mt-0">
        {label}
      </h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

interface GroupedConversations {
  older: ConversationItemData[];
  starred: ConversationItemData[];
  thisWeek: ConversationItemData[];
  today: ConversationItemData[];
  yesterday: ConversationItemData[];
}

export interface ConversationItemData {
  agentName: string | null;
  createdAt: string;
  firstMessage: string | null;
  id: string;
  messageCount: number;
  starred: boolean;
  title: string | null;
  updatedAt: string;
}

function getDateCategory(
  dateStr: string
): "older" | "thisWeek" | "today" | "yesterday" {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);

  if (date >= today) {
    return "today";
  }
  if (date >= yesterday) {
    return "yesterday";
  }
  if (date >= weekStart) {
    return "thisWeek";
  }
  return "older";
}

function groupByDate(
  conversations: ConversationItemData[]
): GroupedConversations {
  const groups: GroupedConversations = {
    older: [],
    starred: [],
    thisWeek: [],
    today: [],
    yesterday: [],
  };

  for (const conv of conversations) {
    if (conv.starred) {
      groups.starred.push(conv);
    } else {
      groups[getDateCategory(conv.updatedAt)].push(conv);
    }
  }

  return groups;
}

interface ConversationGroupListProps {
  conversations: ConversationItemData[];
  renderItem: (conv: ConversationItemData) => ReactNode;
}

export default function ConversationGroupList({
  conversations,
  renderItem,
}: ConversationGroupListProps) {
  const { t } = useTranslation();
  const groups = groupByDate(conversations);

  return (
    <div>
      {groups.starred.length > 0 && (
        <Group label={t("ai_history_starred")}>
          {groups.starred.map((c) => (
            <div key={c.id}>{renderItem(c)}</div>
          ))}
        </Group>
      )}
      {groups.today.length > 0 && (
        <Group label={t("ai_history_today")}>
          {groups.today.map((c) => (
            <div key={c.id}>{renderItem(c)}</div>
          ))}
        </Group>
      )}
      {groups.yesterday.length > 0 && (
        <Group label={t("ai_history_yesterday")}>
          {groups.yesterday.map((c) => (
            <div key={c.id}>{renderItem(c)}</div>
          ))}
        </Group>
      )}
      {groups.thisWeek.length > 0 && (
        <Group label={t("ai_history_this_week")}>
          {groups.thisWeek.map((c) => (
            <div key={c.id}>{renderItem(c)}</div>
          ))}
        </Group>
      )}
      {groups.older.length > 0 && (
        <Group label={t("ai_history_older")}>
          {groups.older.map((c) => (
            <div key={c.id}>{renderItem(c)}</div>
          ))}
        </Group>
      )}
    </div>
  );
}
