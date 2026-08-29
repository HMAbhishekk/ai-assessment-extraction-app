"use client";

import { useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { LogoMark, SettingsIcon, XIcon } from "./icons";
import { NAV_ITEMS, type NavSectionId, type Section } from "./navSections";

export default function AppShell({
  children,
  sidebarCollapsed = false,
  onBack,
  activeSection,
  onNavigate,
  onOpenSettings,
  onNewMapping,
  hasNotification = false,
  onDismissNotification,
  notificationText = null,
}: {
  children: ReactNode;
  sidebarCollapsed?: boolean;
  onBack?: () => void;
  activeSection: Section;
  onNavigate: (id: NavSectionId) => void;
  onOpenSettings: () => void;
  onNewMapping: () => void;
  hasNotification?: boolean;
  onDismissNotification?: () => void;
  notificationText?: string | null;
}) {
  const [collapsed, setCollapsed] = useState(sidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Follow the `sidebarCollapsed` prop whenever it changes (e.g. switching
  // screens), while still letting the user manually toggle it in between.
  const [prevSidebarCollapsed, setPrevSidebarCollapsed] = useState(sidebarCollapsed);
  if (sidebarCollapsed !== prevSidebarCollapsed) {
    setPrevSidebarCollapsed(sidebarCollapsed);
    setCollapsed(sidebarCollapsed);
  }

  const navigate = (id: NavSectionId) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        activeSection={activeSection}
        onNavigate={navigate}
        onOpenSettings={() => {
          onOpenSettings();
          setMobileOpen(false);
        }}
      />

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="animate-fade-in-up absolute inset-y-0 left-0 flex w-64 flex-col bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LogoMark />
                <span className="text-[15px] font-bold text-zinc-900">VedaAI</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-50">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-6 flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium ${
                    activeSection === item.id ? "bg-zinc-100 text-zinc-900" : "text-zinc-500"
                  }`}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => {
                  onOpenSettings();
                  setMobileOpen(false);
                }}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium ${
                  activeSection === "settings" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500"
                }`}
              >
                <SettingsIcon className="h-[18px] w-[18px]" />
                Settings
              </button>
            </nav>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onMenuClick={() => setMobileOpen(true)}
          onBack={onBack}
          activeSection={activeSection}
          onOpenSettings={onOpenSettings}
          onNewMapping={onNewMapping}
          hasNotification={hasNotification}
          onDismissNotification={onDismissNotification ?? (() => {})}
          notificationText={notificationText}
        />
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
