import type { Agent } from "./types";

type Props = {
  agents: Agent[];
  isAgentActive: (name: string) => boolean;
};

export function AgentTeamGrid({ agents, isAgentActive }: Props) {
  return (
    <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {agents.map((agent) => (
        <div
          key={agent.name}
          className={`relative overflow-hidden rounded-lg bg-white p-6 shadow-lg transition-all duration-300 ${
            isAgentActive(agent.name) ? "ring-4 ring-ai-accent ring-opacity-50" : ""
          }`}
        >
          {isAgentActive(agent.name) && (
            <div className="absolute inset-0 animate-strong-pulse bg-gradient-to-br from-ai-accent/20 to-transparent" />
          )}
          <div className="relative">
            <div
              className={`mb-4 text-5xl ${
                isAgentActive(agent.name) ? "animate-strong-pulse" : ""
              }`}
            >
              {agent.icon}
            </div>
            <h3 className={`mb-1 text-xl font-semibold ${agent.color}`}>{agent.name}</h3>
            <p className="mb-3 text-sm text-gray-500">{agent.role}</p>
            <p className="text-sm text-gray-600">{agent.description}</p>
            {isAgentActive(agent.name) && (
              <div
                className={`mt-4 inline-flex animate-strong-pulse items-center rounded-full px-3 py-1 text-xs font-semibold text-white ${agent.bgColor}`}
              >
                <span className="mr-2">●</span>
                Active
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
