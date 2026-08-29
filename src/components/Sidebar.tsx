"use client";

import { LogoMark, PanelToggleIcon, SettingsIcon, SparkleIcon } from "./icons";
import { NAV_ITEMS, type NavSectionId, type Section } from "./navSections";
import { TEACHER_NAME } from "./profile";

export default function Sidebar({
  collapsed,
  onToggle,
  activeSection,
  onNavigate,
  onOpenSettings,
}: {
  collapsed: boolean;
  onToggle: () => void;
  activeSection: Section;
  onNavigate: (id: NavSectionId) => void;
  onOpenSettings: () => void;
}) {
  if (collapsed) {
    return (
      <aside className="hidden w-16 shrink-0 flex-col items-center gap-4 border-r border-zinc-200 bg-white py-4 lg:flex">
        <LogoMark />
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm"
          title="AI Teacher's Toolkit - not part of this demo"
        >
          <SparkleIcon className="h-4 w-4" />
        </button>
        <nav className="mt-2 flex flex-col items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              title={item.label}
              onClick={() => onNavigate(item.id)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                activeSection === item.id ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
              }`}
            >
              <item.icon className="h-[18px] w-[18px]" />
            </button>
          ))}
        </nav>
        <div className="mt-auto flex flex-col items-center gap-3">
          <button
            onClick={onOpenSettings}
            title="Settings"
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              activeSection === "settings" ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
            }`}
          >
            <SettingsIcon className="h-[18px] w-[18px]" />
          </button>
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300" title={TEACHER_NAME} />
          <button
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
            title="Expand sidebar"
          >
            <PanelToggleIcon className="h-4 w-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-white px-4 py-4 lg:flex">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="text-[15px] font-bold text-zinc-900">VedaAI</span>
        </div>
        <button
          onClick={onToggle}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
          title="Collapse sidebar"
        >
          <PanelToggleIcon className="h-4 w-4" />
        </button>
      </div>

      <button
        title="Not part of this demo - the full VedaAI product shell is shown to match the design"
        className="mt-5 flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800"
      >
        <SparkleIcon className="h-3.5 w-3.5 text-brand-400" />
        AI Teacher&apos;s Toolkit
      </button>

      <nav className="mt-6 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium transition-colors ${
              activeSection === item.id ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
            }`}
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </button>
        ))}
      </nav>

      <button
        onClick={onOpenSettings}
        className={`mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium transition-colors ${
          activeSection === "settings" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
        }`}
      >
        <SettingsIcon className="h-[18px] w-[18px]" />
        Settings
      </button>

      <div className="mt-auto flex items-center gap-2.5 rounded-xl px-2 py-2.5">
        <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-zinc-800">{TEACHER_NAME}</p>
        </div>
      </div>
    </aside>
  );
}
