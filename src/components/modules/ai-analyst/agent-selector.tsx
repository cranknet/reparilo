interface AgentOption {
  description?: string;
  displayName: string;
  name: string;
}

interface AgentSelectorProps {
  agentName: string;
  agentOptions: AgentOption[];
  onAgentSwitch: (name: string) => void;
}

export default function AgentSelector({
  agentName,
  agentOptions,
  onAgentSwitch,
}: AgentSelectorProps) {
  if (agentOptions.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 overflow-x-auto px-4 pt-2 pb-1 md:px-6">
      {agentOptions.map((agent) => {
        const isSelected = agent.name === agentName;
        const shortName = agent.displayName.split(" ")[0];

        return (
          <button
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 font-semibold text-sm transition-all ${
              isSelected
                ? "bg-primary text-on-primary"
                : "border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high"
            }`}
            key={agent.name}
            onClick={() => {
              if (!isSelected) {
                onAgentSwitch(agent.name);
              }
            }}
            title={agent.description || agent.displayName}
            type="button"
          >
            {isSelected && (
              <span className="material-symbols-outlined text-base">check</span>
            )}
            <span className="hidden sm:inline">{agent.displayName}</span>
            <span className="sm:hidden">{shortName}</span>
          </button>
        );
      })}
    </div>
  );
}
