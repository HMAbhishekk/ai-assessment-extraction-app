// Shared nav-section config, used by Sidebar, AppShell's mobile drawer, and
// TopBar's breadcrumb - centralized so all three stay in sync instead of
// each hardcoding their own copy of the item list.
import type { ComponentType } from "react";
import { ClipboardIcon, ClockIcon, DocumentIcon, GridIcon, SettingsIcon, UsersIcon } from "./icons";

type IconType = ComponentType<{ className?: string }>;

export type NavSectionId = "home" | "classroom" | "assignments" | "exams" | "library";
export type Section = NavSectionId | "settings";

export interface NavItem {
  id: NavSectionId;
  label: string;
  icon: IconType;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: GridIcon },
  { id: "classroom", label: "My Classroom", icon: UsersIcon },
  { id: "assignments", label: "Assignments", icon: DocumentIcon },
  { id: "exams", label: "Exams", icon: ClipboardIcon },
  { id: "library", label: "My Library", icon: ClockIcon },
];

export const SECTION_META: Record<Section, { label: string; icon: IconType }> = {
  home: NAV_ITEMS[0],
  classroom: NAV_ITEMS[1],
  assignments: NAV_ITEMS[2],
  exams: NAV_ITEMS[3],
  library: NAV_ITEMS[4],
  settings: { label: "Settings", icon: SettingsIcon },
};
