import type { ComponentType } from "react";
import PaScreen from "@/demo/modules/pa/screen";
import OmScreen from "@/demo/modules/om/screen";
import TmScreen from "@/demo/modules/tm/screen";
import PyScreen from "@/demo/modules/py/screen";
import MmScreen from "@/demo/modules/mm/screen";
import PpScreen from "@/demo/modules/pp/screen";
import SdScreen from "@/demo/modules/sd/screen";
import WmScreen from "@/demo/modules/wm/screen";
import FiScreen from "@/demo/modules/fi/screen";
import CoScreen from "@/demo/modules/co/screen";

/** The same components the WebContainer build gets as text. */
/** What a screen may be handed: which capability to show, and a way to move to another. */
export type ScreenProps = { section?: string; onOpenSection?: (index: number) => void };

export const SCREENS: Record<string, ComponentType<ScreenProps>> = {
  pa: PaScreen,
  om: OmScreen,
  tm: TmScreen,
  py: PyScreen,
  mm: MmScreen,
  pp: PpScreen,
  sd: SdScreen,
  wm: WmScreen,
  fi: FiScreen,
  co: CoScreen,
};
