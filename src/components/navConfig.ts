import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  CandlestickChart,
  ChevronDown,
  ChevronUp,
  Cpu,
  LayoutDashboard,
  Lock,
  MessageSquareCode,
  Play,
  RotateCcw,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';

export type NavSection =
  | 'OFFICE_3D'
  | 'COMMAND_CENTER'
  | 'EMPLOYEES'
  | 'WAR_ROOM'
  | 'MARKET_ANALYSIS'
  | 'POSITIONS'
  | 'TRADE_HISTORY'
  | 'ANALYTICS'
  | 'SETTINGS';

export const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: typeof Building2 }> = [
  { id: 'OFFICE_3D', label: '3D Office', icon: Building2 },
  { id: 'COMMAND_CENTER', label: 'Command Center', icon: LayoutDashboard },
  { id: 'EMPLOYEES', label: 'Employees', icon: Users },
  { id: 'WAR_ROOM', label: 'AI War Room', icon: MessageSquareCode },
  { id: 'MARKET_ANALYSIS', label: 'Market Analysis', icon: CandlestickChart },
  { id: 'POSITIONS', label: 'Positions', icon: Wallet },
  { id: 'TRADE_HISTORY', label: 'Trade History', icon: ScrollText },
  { id: 'ANALYTICS', label: 'Analytics', icon: Activity },
  { id: 'SETTINGS', label: 'Settings', icon: Settings },
];

export {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
  Cpu,
  Lock,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  X,
};
