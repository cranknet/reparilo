// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import ChatEmptyState from "../chat-empty-state";

const DAILY_REVENUE_PROMPT_NAME = /daily_revenue/i;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ChatEmptyState", () => {
  it("sends the selected shop-floor prompt", () => {
    const onSendMessage = vi.fn();

    render(
      <MemoryRouter>
        <ChatEmptyState agentEnabled onSendMessage={onSendMessage} />
      </MemoryRouter>
    );

    fireEvent.click(
      screen.getByRole("button", { name: DAILY_REVENUE_PROMPT_NAME })
    );

    expect(onSendMessage).toHaveBeenCalledWith(
      "ai_agent_prompt_daily_revenue_text"
    );
  });

  it("limits the first decision point to three primary prompts", () => {
    render(
      <MemoryRouter>
        <ChatEmptyState agentEnabled onSendMessage={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
