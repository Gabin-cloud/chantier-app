"use client";

import { useState } from "react";
import { EmailTemplatesSettings } from "@/components/settings/EmailTemplatesSettings";
import { GlobalProjectConfig } from "@/components/settings/GlobalProjectConfig";
import type { EmailTemplatesSettingsData } from "@/lib/actions/email-templates";
import type { Project } from "@/lib/types/database";

type PcGlobalSettingsProps = {
  emailSettings: EmailTemplatesSettingsData;
  projects: Project[];
};

const tabs = [
  { id: "emails", label: "Mails type" },
  { id: "advanced", label: "Configuration avancée" },
] as const;

export function PcGlobalSettings({ emailSettings, projects }: PcGlobalSettingsProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("emails");

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "emails" && <EmailTemplatesSettings data={emailSettings} />}

      {activeTab === "advanced" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Configuration avancée</h2>
          <p className="mt-1 text-sm text-slate-500">
            Membres, phases, zones et panneaux de contrôle par opération.
          </p>
          <div className="mt-5">
            <GlobalProjectConfig projects={projects} />
          </div>
        </section>
      )}
    </div>
  );
}
