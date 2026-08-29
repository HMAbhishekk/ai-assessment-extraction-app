"use client";

import { useState } from "react";
import { BellIcon, ChevronDownIcon, ChevronLeftIcon, HelpCircleIcon, MenuIcon, PlusIcon } from "./icons";
import { SECTION_META, type Section } from "./navSections";
import { TEACHER_NAME } from "./profile";

type OpenKey = "help" | "notifications" | "profile" | null;

export default function TopBar({
  onMenuClick,
  onBack,
  activeSection,
  onOpenSettings,
  onNewMapping,
  hasNotification,
  onDismissNotification,
  notificationText,
}: {
  onMenuClick?: () => void;
  onBack?: () => void;
  activeSection: Section;
  onOpenSettings: () => void;
  onNewMapping: () => void;
  hasNotification: boolean;
  onDismissNotification: () => void;
  notificationText: string | null;
}) {
  const [open, setOpen] = useState<OpenKey>(null);
  const meta = SECTION_META[activeSection];

  const toggle = (key: Exclude<OpenKey, null>) => {
    const next = open === key ? null : key;
    setOpen(next);
    if (next === "notifications") onDismissNotification();
  };

  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-2 text-[13.5px] font-medium text-zinc-500">
        <button
          onClick={onBack}
          disabled={!onBack}
          className="rounded-md p-1 hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label="Back"
        >
          <ChevronLeftIcon className="h-[18px] w-[18px]" />
        </button>
        <meta.icon className="h-4 w-4" />
        <span className="hidden sm:inline">{meta.label}</span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <div className="relative z-50">
          <button
            onClick={() => toggle("help")}
            className={`hidden h-8 w-8 items-center justify-center rounded-full sm:flex ${
              open === "help" ? "bg-zinc-100 text-zinc-700" : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
            }`}
            aria-label="Help"
          >
            <HelpCircleIcon className="h-[18px] w-[18px]" />
          </button>
          {open === "help" && (
            <div className="animate-fade-in-up absolute right-0 top-full mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-4 text-[12.5px] text-zinc-600 shadow-lg">
              <p className="mb-1.5 text-[13px] font-bold text-zinc-800">Quick help</p>
              <p>Upload a question paper and a scanned or handwritten answer sheet, then click Start Mapping.</p>
              <p className="mt-1.5">Extraction runs on a local AI model and can take a minute or two - progress shows live.</p>
              <p className="mt-1.5">Click any question to see AI feedback and the exact answer region highlighted on the sheet.</p>
            </div>
          )}
        </div>

        <div className="relative z-50">
          <button
            onClick={() => toggle("notifications")}
            className={`relative hidden h-8 w-8 items-center justify-center rounded-full sm:flex ${
              open === "notifications" ? "bg-zinc-100 text-zinc-700" : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
            }`}
            aria-label="Notifications"
          >
            <BellIcon className="h-[18px] w-[18px]" />
            {hasNotification && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-500" />}
          </button>
          {open === "notifications" && (
            <div className="animate-fade-in-up absolute right-0 top-full mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-4 text-[12.5px] shadow-lg">
              <p className="mb-1.5 text-[13px] font-bold text-zinc-800">Notifications</p>
              {notificationText ? (
                <p className="text-zinc-600">{notificationText}</p>
              ) : (
                <p className="text-zinc-400">No notifications yet - you&apos;ll see extraction updates here.</p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onNewMapping}
          className="hidden h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 sm:flex"
          aria-label="Start a new mapping"
          title="Start a new mapping"
        >
          <PlusIcon className="h-[18px] w-[18px]" />
        </button>

        <div className="relative z-50 hidden md:block">
          <button
            onClick={() => toggle("profile")}
            className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 ${open === "profile" ? "bg-zinc-100" : "hover:bg-zinc-50"}`}
          >
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300" />
            <span className="text-[13px] font-medium text-zinc-700">{TEACHER_NAME}</span>
            <ChevronDownIcon className="h-3.5 w-3.5 text-zinc-400" />
          </button>
          {open === "profile" && (
            <div className="animate-fade-in-up absolute right-0 top-full mt-2 w-56 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
              <div className="px-2.5 py-2">
                <p className="text-[13px] font-semibold text-zinc-800">{TEACHER_NAME}</p>
              </div>
              <div className="my-1 border-t border-zinc-100" />
              <button
                onClick={() => {
                  onOpenSettings();
                  setOpen(null);
                }}
                className="w-full rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Settings
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onMenuClick}
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-50 lg:hidden"
          aria-label="Menu"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
      </div>

      {open !== null && <div className="fixed inset-0 z-40" onClick={() => setOpen(null)} />}
    </header>
  );
}
